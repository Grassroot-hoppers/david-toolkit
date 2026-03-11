# Day 3 — The Data Tells The Truth

**Date:** 2026-03-11, Wednesday

#### Shipped today

* Shop narrative validation — 45 minutes of Q&A proving the AI understands the business context
* Master Config layer — a new editorial layer between Bronze and Silver for human-declared corrections
* Full pipeline ran end-to-end for the first time: all 24 CSVs → 21 Silver files → 7 Gold files → demo.json
* Revenue discrepancy resolved: €207K (wrong) → €501K (real) for 2025
* Category count collapsed: 149 POS entries → 26 clean categories
* 22 automated verification checks passing

Day 3 was about trusting the data. The pipeline existed on paper since Day 2 but had never run end-to-end with real files. When it did, it confirmed some things and broke others. The fixes required building infrastructure that wasn't on the original plan — and that infrastructure turned out to be the most important thing built all week.

---

### Morning: questioning the AI

Day 3 started differently. Before touching any code, a long shop narrative validation session — 45 minutes of questions designed to probe whether the AI actually understands the shop or is just pattern-matching on data.

The session covered: what kind of shop this is, how the cheese counter works, why Monday is closed, what FRAIS means in the category structure, how Belgian VAT tiers affect the data, what the seasonal pattern for raclette looks like, how Ankorstore fits into the supplier mix, why some products appear at different EANs.

The AI got most of it right. The places where it didn't — those became the work items for the rest of the day. Specifically:

- The Gold pipeline had never been run. Silver and Gold directories were empty.
- `daily-sales.json` and `hourly-heatmap.json` didn't exist yet.
- The revenue figure in `store-summary.json` was €207K for 2025 — obviously wrong for a shop doing half a million euros.
- Category YoY was showing 0% everywhere due to VAT-rate duplicates in the category-mix data.

The validation session also surfaced the FRAIS problem clearly: in 2023, the POS had a catch-all "FRAIS" category holding €87K of product that the shop operator knew was mostly cheese and charcuterie. In 2024, after a POS reorganisation, those products moved to proper categories. This created artificial YoY swings that would look like FROMAGE tripling overnight — true in the data, completely misleading as analysis.

---

### The pipeline's first run

Running `npm run import` against all 24 CSVs produced 21 Silver JSON files: monthly-stats for 2023/2024/2025, annual-stats for four years, transactions for three years, category-mix for four years, hourly-by-weekday for three years, margin analysis for 2025 and 2026, and the full product master catalog.

Then the Gold build ran. Seven files came out. And then the numbers started talking.

**Daily revenue:** €1,400/day in 2023, growing to €2,000/day in 2025–2026. The growth trajectory is real and consistent.

**Peak times:** Saturday 11h and Wednesday 10h are the two biggest revenue slots of the week. Both are market days in the area — the data confirms that foot traffic follows the outdoor market schedule.

**Monday:** 3 trading days total, €12/day average. Effectively closed. The data matches what the operator said.

**Top category:** FROMAGE at €136K — confirms cheese is the core business by revenue. No ambiguity.

But the headline KPI was wrong by a factor of 2.4. The `macro.years` figure for 2025 showed €207K. Every operator in the shop knows the shop does around €500K. Something was broken upstream.

---

### The revenue discrepancy

The annual-stats files (`produits-annee-YYYY.csv`) only captured 2,407 products. The monthly-stats files have 3,667. The difference is weighed items, variable-weight cheese, and anything sold by the piece rather than scanned. The annual-stats export simply doesn't include everything the shop sells.

`build-gold.mjs` was reading annual-stats for `store-summary.json`. Switched to a priority cascade:

1. **Monthly-stats total** (3,663 products, most complete)
2. **Category-mix total** (captures all POS revenue including weighed items, fallback)
3. **Transaction-derived total** (least complete, last resort)

After the fix: 2025 revenue shows €501K. That's the real number.

---

### Master Config: the fourth layer

The FRAIS problem exposed a design gap. The pipeline had no place to express human knowledge about the data. Category-mix says "FRAIS: €87K". The AI can infer that FRAIS = perishables = mostly cheese. But inference isn't the same as declaration, and wrong inference at build time produces wrong dashboards.

The fix was to add an explicit editorial layer: **Master Config**.

```
data/real/*.csv          ← BRONZE (raw POS exports)
    ↓
sample-data/config/      ← MASTER CONFIG (human-declared corrections)
    ↓  import-silver.mjs
data/silver/             ← SILVER (parsed + corrected JSON)
    ↓  build-gold.mjs
data/gold/               ← GOLD (aggregated analytics)
```

Three config registries:

**`category-overrides.json`** — FRAIS reclassification rules. Two-pass system: cross-reference first (if the product name appears in monthly-stats with a known category, use that), keyword fallback second (cheese keywords → FROMAGE, meat keywords → CHARCUTERIE, etc.). The cross-reference pass didn't match for 2023 because the FRAIS entries are in category-mix (aggregated) rather than monthly-stats (product-level) — so the redistribution stayed incomplete. The config is ready; the Gold-layer FRAIS redistribution is what's needed to finish it.

**`product-corrections.json`** — expanded with `_meta.skuMerges`. Products with multiple EANs (common for cheese recuts) get merged under a canonical name at parse time.

**`config-loader.mjs`** — utility that loads and validates all config registries, with schema checks so a malformed config fails loudly.

Silver import restructured from single-pass to two-pass: parse all CSVs first, apply Master Config corrections, then write. This means all corrections are applied consistently regardless of which file is processed first.

---

### Verification: 22 checks now pass

`verify-data.mjs` was extended beyond structural checks into business-logic assertions:

- Saturday > Tuesday revenue (if not, the pipeline is broken)
- Hourly peak between 10h and 13h (confirms market-day pattern)
- Revenue floor > €300K per year (catches the annual-stats-only bug)
- No duplicate SKUs in product catalog
- No junk categories (DIV. EAN, Fictif) in category-evolution
- FRAIS share < 5% for 2024+ (confirms POS reorganisation took effect)

All 22 checks pass. These aren't just tests — they're executable documentation of what the shop's data is supposed to look like.

---

### What's still in flight today

**1. 2024 margin export**
The margin analysis CSVs only go back to 2025. The POS can re-export historical margin data. Dropping `margin-analysis-2024.csv` into `data/real/` and running `npm run build:full` should pick it up automatically — the Silver importer already handles the format.

**2. FRAIS redistribution in Gold**
The Master Config cross-reference runs during Silver import, but FRAIS is an aggregated category in category-mix — there's no product-level join to make at Silver time. The redistribution needs to happen in Gold: use 2023 monthly-stats subcategory ratios (which have real FROMAGE/CHARCUTERIE/etc. product-level data) to proportionally split the €87K FRAIS bucket in category-evolution. This converts a misleading 200%+ FROMAGE growth figure into an honest one.

**3. Category YoY calculations (showing 0%)**
Category-mix exports duplicate each category across VAT rates (e.g., FROMAGE appears as both 6% and 0% VAT rows). The current YoY computation likely matches on exact category+VAT key rather than on normalized category name. Needs investigation in `build-gold.mjs` — probably a one-line groupBy change.

**4. Gold data test**
A structured read-through of all 7 Gold files against expected values. Raclette should peak in winter. Tomatoes in summer. Eggs flat. The Saturday heatmap should confirm the 11h spike. This is the final sanity check before the Gold layer can be called production-ready.

---

## Decisions

- **Master Config is permanent.** Not a workaround — it's the canonical place for human-declared corrections. Every future data dimension (product grouping, shelf allocation, holiday calendar) will have a corresponding config file.
- **Revenue source priority cascade is the right fix.** Annual-stats is not a reliable revenue source for this shop. Monthly-stats is the canonical revenue reference until proven otherwise.
- **Validation sessions come before implementation.** The morning Q&A produced better work items than any planning doc would have. The AI's blind spots become the task list.
- **Verification assertions are part of the pipeline.** Not optional, not a nice-to-have. If the business logic fails, the build fails.
- **FRAIS redistribution deferred to Gold.** Doing it in Silver would require product-name heuristics operating on aggregated data — fragile. Gold has the right inputs (monthly-stats subcategory ratios) to do it cleanly.

## Day 3 by the numbers

| Metric | Count |
|--------|-------|
| Commits | 7 |
| Silver files generated | 21 |
| Gold files generated | 7 |
| Verification checks | 22 (all passing) |
| Revenue correction | €207K → €501K |
| Categories collapsed | 149 → 26 |
| Design + plan docs written | 2 |

## What's next (Day 4)

Day 4 plan is in `docs/plans/2026-03-12-day4-data-validation-plan.md`. The focus is finishing what Day 3 started:

1. Close the open items from today (FRAIS redistribution, category YoY, 2024 margins)
2. Run structured validation on all Gold files
3. Confirm daily-sales, hourly-heatmap, and monthly-product-stats contain what they're supposed to contain
4. Commit a clean pipeline state with all fixes in place
5. Begin Tab 1 of the V2 dashboard (Briefing du jour) if time allows
