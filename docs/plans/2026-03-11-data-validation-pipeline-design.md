# Data Validation & Pipeline Completion — Design

> **Status:** Approved via brainstorming session (2026-03-11 evening)

**Goal:** Run the full Bronze → Silver → Gold pipeline end-to-end with all 24 CSVs, fix data quality issues, and establish the data foundation for strategic analysis.

---

## Architecture Decision: Four Layers, Not Three

The standard medallion pipeline uses Bronze / Silver / Gold. This project adds a **Master Config** layer — a persistent, versioned source of truth for human-declared knowledge about products, categories, and suppliers.

| Layer | Contents | Written By | Mutability |
|-------|----------|-----------|------------|
| **Bronze** | Raw CSVs from MicroConcept POS | POS export | Immutable |
| **Master Config** | Product identity, category overrides, supplier mappings | Julien (JSON files) | Mutable — editorial layer |
| **Silver** | Parsed + corrected JSON | `npm run import` | Regenerated each run |
| **Gold** | Aggregated analytics | `npm run build:gold` | Regenerated each run |

### Why Corrections Apply in Silver, Not Gold

Entity resolution (SKU merges, category reclassification) is data cleaning, not business logic. If applied only in Gold, every Gold script touching categories must independently handle the FRAIS fix — violating DRY and guaranteeing future bugs. Apply once in Silver; all downstream consumers get clean data.

Business logic (revenue source cascade, aggregation, scoring) stays in Gold.

---

## Master Config: Three Registries

Located in `sample-data/config/`:

### 1. `product-identity.json` (evolves from existing `product-corrections.json`)

Handles SKU merges and product naming. Existing fields (`supplier`, `displayName`, `canonicalCategory`, `weatherSensitivity`, `perishability`, `substituteGroup`) are preserved. New fields added:

```json
{
  "_meta": {
    "skuMerges": [
      { "canonical": "COMTE 18 MOIS", "aliases": ["COMTE 18M", "COMTÉ 18 MOIS AOP"] }
    ]
  },
  "COMTE 18 MOIS": {
    "supplier": "Affineur",
    "displayName": "Comté 18 mois",
    ...
  }
}
```

SKU merges live in a `_meta.skuMerges` array. Product-level overrides use the normalized key as before.

### 2. `category-overrides.json` (new)

Handles the FRAIS reclassification and category flags.

```json
{
  "_doc": "Category corrections applied during Silver import. Cross-reference runs first; keyword fallback handles the rest.",
  "crossReference": {
    "enabled": true,
    "sourceYears": [2024, 2025],
    "targetCategory": "FRAIS",
    "note": "2023 FRAIS was a catch-all. Use 2024/2025 category assignments as truth."
  },
  "keywordFallback": [
    { "target": "FROMAGE", "keywords": ["fromage", "comté", "brie", "camembert", "morbier", "reblochon", "raclette", "tomme", "beaufort", "gruyère", "emmental", "roquefort", "chèvre", "pecorino", "parmesan", "gorgonzola", "taleggio", "stilton", "gouda", "cheddar", "manchego", "feta"] },
    { "target": "CHARCUTERIE", "keywords": ["jambon", "saucisson", "coppa", "bresaola", "salami", "chorizo", "lard", "pâté", "rillettes", "terrine", "mortadelle", "pancetta", "guanciale", "nduja"] },
    { "target": "OEUF", "keywords": ["oeuf", "oeufs", "œuf", "œufs"] },
    { "target": "PATE FRAICHE", "keywords": ["pâte fraîche", "tagliatelle", "ravioli", "tortellini", "gnocchi", "pasta fresca"] }
  ],
  "productOverrides": {},
  "categoryFlags": {
    "BIO": { "isOrganic": true }
  },
  "junkCategories": ["DIV. EAN", "Fictif", "CARTE CADEAUX", "(uncategorized)"]
}
```

### 3. `supplier-map.json` (existing, unchanged structure)

Already handles supplier normalization. Will be extended with missing mappings after first Silver import.

---

## FRAIS Reclassification: Hybrid Approach

**Strategy (Approach 3 from brainstorming):**

1. **Parse all CSVs into memory** — don't write Silver yet
2. **Build a category lookup** from 2024 and 2025 monthly-stats: `{ productKey → category }`
3. **For every 2023 product where category === "FRAIS":**
   - Cross-reference: if the same product key exists in 2024/2025 with a non-FRAIS category, use that category
   - Keyword fallback: if no cross-reference match, scan product name against keyword lists
   - Unmatched: leave as FRAIS, log for manual review
4. **Write Silver files** with corrected categories
5. **Log all reclassifications** in `import-report.json` with source (cross-reference vs keyword vs unmatched)

**Implementation in `import-silver.mjs`:**

The current script processes each CSV and writes Silver immediately. It needs restructuring to a two-pass approach:
- Pass 1: Parse all CSVs into memory (same existing logic)
- Pass 2: Load Master Config, apply corrections (SKU merges, category overrides), then write Silver

This keeps the existing importers untouched — corrections are applied after parsing, before writing.

---

## Revenue Source Priority Cascade (Gold)

`store-summary.json` currently computes per-year revenue from daily-sales (transactions). The problem: transactions only capture ~40% of real revenue for some years.

**Fix in `build-gold.mjs`:** For each year, pick the best available revenue source:
1. Monthly-stats total (most complete — 3,667 products)
2. Category-mix total (captures all POS revenue including weighed items)
3. Transaction-derived daily totals (fallback)

This is aggregation logic, so it stays in Gold. Silver just provides clean data; Gold decides which source to trust.

---

## DIV. EAN Handling (Gold)

During `buildCategoryEvolution()` in `build-gold.mjs`, categories matching `junkCategories` from `category-overrides.json` are either:
- Filtered out entirely (if revenue < threshold), or
- Grouped into a single "Non classé" bucket

The filter pattern already exists in `build-demo.mjs` (`CATEGORY_FILTERS`). We move it upstream into Gold so it's applied once.

---

## Validation Strategy

### Automated (`verify-data.mjs`)

Existing structural checks plus new business-logic assertions:
- Saturday avg revenue > Tuesday avg revenue
- No zero-revenue days on known trading days (Tue–Sat)
- Hourly peak falls between 10h–13h
- Per-year revenue in store-summary > €400K (catches the €207K bug)
- FRAIS category nearly empty after reclassification
- No duplicate SKUs in product-catalog (catches missed merges)
- Import report: log count of unmatched FRAIS items

### Manual (this session)

After pipeline runs clean, review key outputs together:
- Daily revenue patterns
- Hourly heatmap peaks
- Category YoY with FRAIS reclassified
- Known product seasonality (raclette, eggs, tomatoes)

---

## 2024 Margin Integration

User exports `margin-analysis-2024.csv` from MicroConcept Module 46A, drops in `data/real/`, re-runs pipeline. Existing margin importer handles it — no code changes needed.

---

## Success Criteria

1. `data/gold/daily-sales.json` exists with daily revenue for 2023–2026
2. `data/gold/hourly-heatmap.json` exists with weekday × hour data
3. `data/gold/monthly-product-stats.json` exists with monthly series
4. `demo.json` is built from Gold, not legacy
5. Dashboard renders with real numbers
6. Revenue figures in store-summary reflect ~€500K for 2025
7. FRAIS reclassification applied — FROMAGE YoY is realistic
8. Automated validation passes
