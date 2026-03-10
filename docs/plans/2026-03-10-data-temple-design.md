# Data Temple Design — Universal Normalized Data Layer

**Date:** 2026-03-10
**Status:** Approved
**Input:** 24 real POS CSV exports in `data/real/`, data inventory, Perplexity research on Medallion architecture

---

## Goal

Build a universal data layer — the canonical truth of what happens at the shop. Not shaped for any one dashboard. Shaped like reality. Any future consumer (dashboard, AI model, prediction engine, daily briefing agent) pulls from the same source.

## Architecture: Bronze → Silver → Gold

Follows the Medallion Architecture pattern. Three layers, each with a clear purpose.

```
data/real/*.csv                        ← BRONZE (24 raw POS exports, gitignored)
    Untouched. The source of truth.
    CP1252 encoding, semicolons, European decimals, junk rows.

        ↓  scripts/import-silver.mjs
           (detect file type, clean, normalize, structure)

data/silver/                           ← SILVER (cleaned entity-centric JSON, gitignored)
    Encoding fixed, decimals parsed, junk stripped.
    Product names normalized to stable keys.
    One file per source type per year.

        ↓  scripts/build-gold.mjs
           (aggregate, merge years, compute derived metrics)

data/gold/                             ← GOLD (dashboard-ready aggregates, gitignored)
    Small files. Fast to parse. ~1 MB total.
    What any dashboard or AI model actually loads.

        ↓  scripts/build-demo.mjs
           (assemble current dashboard format + scoring)

public/data/demo.json                  ← Current dashboard's specific slice
```

### Fallback behavior

If `data/silver/` doesn't exist, `build-gold.mjs` skips. If `data/gold/` doesn't exist, `build-demo.mjs` falls back to `sample-data/raw/` so the open-source demo works without real data.

---

## Bronze Layer: `data/real/`

Already exists. 24 CSV files across 7 types. No changes needed — these are the raw POS exports.

| Type | Files | Description |
|------|-------|-------------|
| Monthly product stats | `stat-vente-monthly-2023/24/25.csv` | Per-product monthly qty+revenue, stock, prices, supplier, category (3,667 products/yr) |
| Annual product sales | `stat-vente-annual-2023/24/25/26.csv` | Per-product annual totals (1,085–3,830 products/yr) |
| Transactions | `transactions-2023/24/25/26.csv` | Every sale line item with timestamp (~44k rows/yr) |
| Category mix | `category-mix-2023/24/25/26.csv` | Revenue by category + VAT rate |
| Margin analysis | `margin-analysis-2025-h1/h2, 2026.csv` | Per-transaction margin data (2025–2026 only) |
| Hourly by weekday | `hourly-by-weekday-2023/24/25.csv` | Annual revenue by weekday × hour |
| Product master | `product-master-full/active.csv`, `product-reference.csv` | Canonical product catalog (~3,100 products) |

---

## Silver Layer: `data/silver/`

One cleaned JSON file per source type per year. The import script handles all 7 file types (up from 3 today).

### What gets cleaned (parse & clean phase)

All cleaning happens in memory during import. No intermediate files.

- CP1252 → UTF-8 encoding
- European decimal commas → proper floats
- Weight/price prefixes stripped: `(1360g/2,3€Kg)POTIMARRON BIO` → `POTIMARRON BIO`
- Summary/footer rows filtered: `total`, `nbclient`, `Designed by Micro Concept`, `#ACOMPTE`
- Category typos fixed: `02. FRA` → `02. FROMAGE`
- Refund rows (`REMB ...`) separated but preserved
- Product names normalized to stable uppercase key (accent-stripped, whitespace-collapsed)
- Headerless product master parsed by column position
- `LINK EAN` alias rows handled

### Silver files

| File | Source | Records (est.) | Contents |
|------|--------|---------------|----------|
| `monthly-stats-YYYY.json` | stat-vente-monthly | ~3,600/yr | Per-product: 12 monthly qty+revenue, stock, buy/sell price, supplier, category, origin |
| `annual-stats-YYYY.json` | stat-vente-annual | ~1,000–3,800/yr | Per-product: total qty + revenue, EAN, category |
| `transactions-YYYY.json` | transactions | ~20k–44k/yr | Every line item: timestamp, product key, price, category, EAN, payment method |
| `category-mix-YYYY.json` | category-mix | ~65–98/yr | Per-category: revenue, product count, share %, VAT |
| `margins-YYYY.json` | margin-analysis | ~1,500/yr | Per-product (aggregated from transaction rows): sales, cost, margin, markup ratio |
| `hourly-patterns-YYYY.json` | hourly-by-weekday | ~65/yr | Per weekday × hour: annual revenue |
| `products.json` | product-master | ~3,100 | Canonical catalog: EAN, name, price, cost, stock, category, supplier, BIO label, creation/last-sold dates |

**`products.json` is the spine.** All other Silver files reference products by normalized `key`. When any consumer needs to know "what category is BRIE DE MEAUX?" — it looks here.

**Transaction Silver is the heaviest** (~3–5 MB per year). Not loaded by dashboards. Exists so Gold can be rebuilt from it.

---

## Gold Layer: `data/gold/`

Small, pre-computed, dashboard-ready. Total ~1 MB. Derived entirely from Silver.

| File | Grain | Rows (est.) | Size (est.) | Derived from | Enables |
|------|-------|-------------|-------------|-------------|---------|
| `daily-sales.json` | One row per calendar day | ~1,300 | ~80 KB | Silver transactions | Revenue trends, weather join surface, day-of-week patterns |
| `monthly-product-stats.json` | One row per product per month | ~4,000 | ~300 KB | Silver monthly-stats (all years merged) | 36-month seasonality curves, YoY by month, product lifecycle |
| `product-catalog.json` | One row per product | ~3,100 | ~400 KB | Silver products + enrichment from monthly-stats + margins | Master reference: name, category, supplier, price, cost, margin, stock, BIO, first/last seen |
| `category-evolution.json` | One row per category per year | ~300 | ~20 KB | Silver category-mix (all years) | Category share trends across 4 years |
| `hourly-heatmap.json` | One row per weekday × hour × year | ~200 | ~15 KB | Silver hourly-patterns (all years) | Peak hours, staffing, day-of-week comparison |
| `margin-ranking.json` | One row per product | ~1,500 | ~100 KB | Silver margins + catalog data | Profitability ranking, margin outliers, markup distribution |
| `store-summary.json` | One row per year | 4 | ~2 KB | Aggregated from everything | Annual KPIs: total revenue, product count, avg basket, transaction count |

### What's NOT in Gold (rebuild from Silver when needed)

- Individual transaction rows (basket analysis)
- Per-product daily curves (per-product daily sales)
- Payment method breakdown
- Intra-day hourly patterns by actual date

---

## Pipeline Scripts and Commands

### Scripts

| Script | Replaces | What it does |
|--------|----------|-------------|
| `scripts/import-silver.mjs` | `scripts/import-exports.mjs` | Reads all CSVs from `data/real/`, detects type (7 detectors), cleans, writes Silver JSON. Produces `data/silver/import-report.json`. |
| `scripts/build-gold.mjs` | Aggregation logic from `scripts/build-data.mjs` | Reads Silver, aggregates into Gold files. Pure data transformation. |
| `scripts/build-demo.mjs` | Scoring/assembly logic from `scripts/build-data.mjs` | Reads Gold + config, runs scoring engine, produces `public/data/demo.json`. Dashboard-specific. |
| `scripts/verify-data.mjs` | Updated | Validates Gold files + demo.json |

### Commands

```bash
npm run import         # Bronze → Silver
npm run build:gold     # Silver → Gold
npm run build:demo     # Gold → demo.json
npm run build:full     # All three in sequence
npm run test           # build:full → verify
```

### Migration from current scripts

- `import-exports.mjs` → absorbed into `import-silver.mjs` (expanded from 3 to 7 file type detectors)
- `build-data.mjs` → split into `build-gold.mjs` (aggregation) + `build-demo.mjs` (scoring + dashboard assembly)
- Scoring logic (order/watch/skip, weather adjustments, confidence scores) stays in `build-demo.mjs`
- `data/normalized/` → renamed to `data/silver/`

---

## File Type Detection

The import script auto-classifies each CSV by reading the first non-empty line:

| Type | Header fingerprint | Silver output |
|------|-------------------|---------------|
| `monthly-stats` | Contains `libelle` + `TotQut` or `TotCA` | `monthly-stats-YYYY.json` |
| `annual-stats` | Starts with `ART;` + contains `QUANTITE` or `CHIFF_AFF` | `annual-stats-YYYY.json` |
| `transactions` | Contains `Expr1000` + `article` | `transactions-YYYY.json` |
| `category-mix` | Starts with `categorie_tva;` + contains `Nb_produits` | `category-mix-YYYY.json` |
| `margin-analysis` | Contains `Total vente tvac` or `Marge ht` | `margins-YYYY.json` |
| `hourly-by-weekday` | Starts with `JOUR;HEURE` | `hourly-patterns-YYYY.json` |
| `product-master` | No header row; 60+ semicolon-separated columns | `products.json` |
| `product-reference` | 3 columns: `;;EAN;name;timestamp` | Merged into `products.json` |

Year is detected from filename pattern (`YYYY` in filename) or from column prefixes (`YY_MM` in monthly stats).

---

## Known Gaps

| Gap | Impact | How to fill |
|-----|--------|-------------|
| Weather history (Brussels 2023–2026) | Can't do weather correlation | Open-Meteo API (free). One script writes `data/external/weather-daily.json` |
| Belgian calendar (holidays, school breaks) | Can't explain anomalies | Static curated JSON in `data/external/calendar.json` |
| 2023/2024 margins | No profitability data before 2025 | Only if POS can re-export Module 46A for those years |
| Hourly data for 2026 | No peak hour patterns for current year | Export from POS later in the year |
| Basket grouping | Can't see which products are bought together | Derivable from Silver transactions (same timestamp = same basket). Future Gold computation. |

---

## What This Design Does NOT Do

- No live data source wiring (Open-Meteo API, Notion, Todoist)
- No UI changes — the dashboard renders whatever `demo.json` contains
- No supplier mapping expansion (requires separate config work)
- No AI/prediction models — just the data layer they would consume
- No POS anatomy registry — separate concern

---

## Verification

After full pipeline run:

1. `npm run import` — detects all 24 CSVs, produces Silver files, import report shows 0 errors
2. `npm run build:gold` — produces 7 Gold files, total < 2 MB
3. `npm run build:demo` — produces `demo.json` from Gold (not directly from CSVs)
4. `npm run test` — all assertions pass
5. `npm run serve` — dashboard renders with real data
