# Day 4 — Data Validation & Pipeline Completion

**Date:** 2026-03-12
**Goal:** Get the full Bronze → Silver → Gold pipeline running with all 24 CSVs, fix data quality issues found during shop narrative validation, and establish the data foundation for strategic analysis.

**Context:** A full validation conversation on March 11 ([shop-narrative-validation](be12e5d6-a6d3-4e8e-912d-9a64c6e85e74)) confirmed the AI understands the shop correctly but exposed critical gaps: no daily/hourly data in Gold, no 2024 margins, and a revenue discrepancy between macro.years (~€207K) and category-mix totals (~€505K) for 2025. All raw data already exists in `data/real/` — the pipeline code is built but has never been run end-to-end.

---

## Phase 1: Run the Pipeline (Morning — 45 min)

The code exists. Silver and Gold are empty. This is execution + bug-fixing.

### Task 1.1 — Run `npm run import` and verify Silver output
**Time:** 10 min
**Files:** `data/silver/` (output)

Run `npm run import`. Expect it to process all 24 CSVs from `data/real/`. Check `data/silver/import-report.json` for:
- [ ] All 7 file types detected (monthly-stats, annual-stats, transactions, category-mix, margin-analysis, hourly-by-weekday, product-master)
- [ ] 0 errors
- [ ] Transaction files parsed with timestamps → `transactions-YYYY.json`
- [ ] Hourly files parsed → `hourly-patterns-YYYY.json`
- [ ] Monthly stats parsed → `monthly-stats-YYYY.json`
- [ ] Product master parsed → `products.json`
- [ ] Margins parsed → `margins-2025.json`, `margins-2026.json`

If any file type fails detection or parsing, fix the importer before moving on.

### Task 1.2 — Run `npm run build:gold` and verify Gold output
**Time:** 10 min
**Files:** `data/gold/` (output)

Run `npm run build:gold`. Expect 7 Gold files:
- [ ] `daily-sales.json` — one row per calendar day (from transactions). Should cover 2023-2026.
- [ ] `monthly-product-stats.json` — per-product monthly series (from monthly-stats). Should cover 2023-2025.
- [ ] `product-catalog.json` — master catalog with margins, lifecycle, years active.
- [ ] `category-evolution.json` — per-category per-year revenue/share.
- [ ] `hourly-heatmap.json` — weekday × hour × year revenue matrix.
- [ ] `margin-ranking.json` — per-product margin data.
- [ ] `store-summary.json` — per-year KPIs.

**Critical check:** Open `daily-sales.json` and verify it has actual dates and daily revenue. Open `hourly-heatmap.json` and verify it has the Saturday 11h peak. If either is null/empty, the corresponding Silver files weren't generated correctly — go back to Task 1.1.

### Task 1.3 — Run `npm run build:demo` and verify demo.json
**Time:** 10 min
**Files:** `public/data/demo.json` (output)

Run `npm run build:demo`. The new demo.json should now include:
- [ ] `weeklyMetrics` — populated (not null) with last-week revenue from daily-sales
- [ ] `macro.timeline` — monthly revenue series (not empty array)
- [ ] `supplierRanking` — ranked supplier list
- [ ] `categoryMix` with `yoy` field on each category

Compare the new demo.json structure against the old one. The dashboard should still render correctly.

### Task 1.4 — Run `npm run test` (full pipeline + verification)
**Time:** 5 min

Run `npm run test`. Fix any verification failures. This runs `scripts/verify-data.mjs` against the Gold + demo output.

### Task 1.5 — Smoke-test the dashboard
**Time:** 10 min

Run `npm run serve` and open the dashboard in a browser. Verify:
- [ ] KPIs render with real numbers
- [ ] Top products list looks correct
- [ ] Supplier panels show real data
- [ ] No JavaScript errors in console

---

## Phase 2: Fix Data Quality Issues (Late Morning — 60 min)

Issues identified during the validation conversation that affect analysis accuracy.

### Task 2.1 — Revenue discrepancy: macro.years vs category-mix totals
**Time:** 20 min
**Files:** `scripts/build-gold.mjs` (store-summary), `scripts/build-demo.mjs` (macro.years)

**Problem:** `macro.years` shows 2025 revenue as €207K (from annual-stats product-sales files), but category-mix totals sum to ~€505K. The annual-stats files only capture ~40% of real revenue. Monthly-stats files have 3,667 products vs. 2,407 in annual-stats.

**Fix:** `store-summary.json` should compute per-year total revenue from the BEST available source for each year, in priority order:
1. Monthly-stats total (most complete — 3,667 products with monthly breakdown)
2. Category-mix total (captures all POS revenue including weighed items)
3. Annual-stats total (fallback — least complete)

Check what `build-gold.mjs` currently uses. If it's using annual-stats, switch to monthly-stats or category-mix. The `macro.years` in demo.json should show the real ~€500K revenue, not the partial €207K.

**Verify:** After fix, `store-summary.json` should show 2025 revenue close to €505K (matching category-mix).

### Task 2.2 — Category-mix YoY needs FRAIS reclassification awareness
**Time:** 20 min
**Files:** `scripts/build-gold.mjs` (category-evolution)

**Problem:** FROMAGE shows apparent 200%+ growth 2023→2024 because ~€38K of cheese was in FRAIS in 2023 but moved to FROMAGE in 2024. This inflates FROMAGE YoY and deflates FRAIS YoY, making both misleading.

**Options (pick one, annotate the other for later):**
- **Option A — Note, don't fix.** Add a `caveat` field to category-evolution.json for 2023→2024 transitions where FRAIS was a catch-all. Let the dashboard display a warning. Simplest.
- **Option B — Merge FRAIS into subcategories retroactively.** Use the product-level data from 2023 (which has product names) to reclassify FRAIS items into their true categories. This requires name-matching heuristics (cheese keywords, meat keywords, etc.) and is error-prone but more accurate.

**Recommendation:** Option A for tomorrow. Option B as a separate task later — it requires the analysis logic from this conversation (cheese keywords regex, etc.) to be turned into pipeline code.

### Task 2.3 — DIV. EAN categories in category-mix
**Time:** 10 min
**Files:** `scripts/build-gold.mjs` or `scripts/importers/category-mix.mjs`

**Problem:** Dozens of "DIV. EAN 2600xxx" categories appear in category-mix data. These are unresolved barcodes in the POS (items scanned but not properly categorized). They represent small revenue (~€1-2K total) but create noise in category analysis.

**Fix:** The `build-demo.mjs` already filters these with `CATEGORY_FILTERS = /^(DIV\. EAN|Fictif|CARTE CADEAUX|\(uncategorized\))/i`. Ensure `build-gold.mjs` applies the same filter when building `category-evolution.json`, or at minimum groups them into a single "Non classé" bucket.

### Task 2.4 — Supplier map: add missing mappings
**Time:** 10 min
**Files:** `sample-data/config/supplier-map.json`

**Problem:** Ankorstore has ~10 misspellings. Some suppliers from the product-master may not be in the map yet.

**Fix:** After Silver import, grep the product-master data for supplier names not in the current map. Add the missing ones. Low priority — only affects supplier-level reporting, not revenue totals.

---

## Phase 3: Validate New Data (Early Afternoon — 30 min)

Once Phase 1+2 are done, validate that the Gold layer now answers what we couldn't answer before.

### Task 3.1 — Daily revenue validation
**Time:** 10 min
**File:** `data/gold/daily-sales.json`

Check:
- [ ] What's the average daily revenue? (Expect ~€1,500-2,000 on a Saturday, less on weekdays)
- [ ] What's the Saturday vs Tuesday ratio?
- [ ] Are there obvious gaps (days with €0 revenue that should have sales)?
- [ ] What does a holiday week look like vs. a normal week?
- [ ] How many trading days per year? (Shop is closed Sunday + Monday?)

### Task 3.2 — Hourly heatmap validation
**Time:** 10 min
**File:** `data/gold/hourly-heatmap.json`

Check:
- [ ] Saturday 11h should be the peak (~€25K annual / 52 = ~€485/hour average)
- [ ] Monday should be near-zero or very low (€1,665 annual total per data-inventory)
- [ ] What are the opening hours? (When does revenue start and stop each day?)
- [ ] Has the hourly pattern shifted between 2023 and 2025?

### Task 3.3 — Monthly seasonality validation
**Time:** 10 min
**File:** `data/gold/monthly-product-stats.json`

Check a few key products:
- [ ] Raclette: should peak in winter months (Nov-Feb), drop in summer
- [ ] Tomatoes/Basilic: should peak in summer
- [ ] Oeufs: should be relatively flat year-round
- [ ] Cookie Gâteau sur la Cerise: check if seasonal or steady

---

## Phase 4: 2024 Margin Data (Afternoon — 15 min)

### Task 4.1 — Check if 2024 margin export is possible from POS
**Time:** 15 min (user action)

**Question for Julien:** Can you re-export margin stats for the period 01/01/2024 – 31/12/2024 from the POS? If yes:
1. Export it
2. Name it `margin-analysis-2024.csv`
3. Drop it in `data/real/`
4. Re-run `npm run build:full`

If the POS doesn't allow historical re-exports for margin data, this is a permanent gap. We'll work with 2025+ margins only.

---

## Phase 5: Commit & Document (End of Day — 15 min)

### Task 5.1 — Commit pipeline state
**Time:** 5 min

If any code was changed (bug fixes in importers, build-gold fixes), commit with a clear message explaining what was fixed and why.

### Task 5.2 — Update DEV_LOG
**Time:** 10 min
**File:** `docs/DEV_LOG.md`, new `docs/DEV_LOG_DAY4.md`

Document:
- Pipeline now runs end-to-end (Bronze → Silver → Gold → demo.json)
- Revenue discrepancy resolved (or documented if not yet fixed)
- What Gold files now contain
- Data quality issues found and their status
- What analyses are now possible that weren't before

---

## Success Criteria

By end of day, these must be true:

1. **`data/gold/daily-sales.json` exists and has daily revenue for 2023-2026** — this is the single most important output
2. **`data/gold/hourly-heatmap.json` exists with weekday × hour data** — answers "when do people shop"
3. **`data/gold/monthly-product-stats.json` exists with monthly series** — answers seasonality questions
4. **`demo.json` is built from Gold, not from the legacy normalized/ path**
5. **Dashboard renders correctly with the new data**
6. **Revenue figures in store-summary reflect true shop revenue (~€500K for 2025), not the partial €207K**

## What This Unlocks (Day 5+)

With daily + hourly + monthly data in Gold:
- **Weather correlation**: join daily-sales with Open-Meteo API → quantify the sunny-weekend effect
- **Seasonal ordering playbook**: raclette ramp-up timing, summer produce shift, December peak
- **Staffing insights**: hourly heatmap → when to have someone at the cheese counter
- **Weekly performance tracking**: actual week-over-week trends with date context
- **Boulangerie restart baseline**: track the new baker's impact from week 1
- **True YoY by month**: January '24 vs January '25 at category and product level
- **Margin trend** (once 2024 data is available): is profitability improving as the mix shifts toward cheese?
