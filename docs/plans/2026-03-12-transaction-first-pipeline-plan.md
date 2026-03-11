# Transaction-First Pipeline Simplification

**Date:** 2026-03-12  
**Goal:** Restructure the pipeline so only ONE CSV (transaction lines) is needed for ongoing 2026 updates, with product-master + margin-analysis as periodic enrichment.

**Problem:** As 2026 advances, every refresh requires hunting down 7 different CSV exports from the POS. Most of these (monthly-stats, annual-stats, category-mix, hourly-by-weekday) are just pre-aggregated views of what already exists in the transaction-level CSV.

---

## Current State: 7 CSV Types

| CSV Type | What it adds | Can transactions replace it? |
|----------|-------------|------------------------------|
| **transactions** | Every sale line: datetime, product, price, category, VAT, payment | — This IS the source |
| monthly-stats | Per-product monthly qty + revenue | **YES** — aggregate from transactions |
| annual-stats | Per-product annual qty + revenue | **YES** — aggregate from transactions |
| category-mix | Per-category revenue + VAT split | **YES** — aggregate from transactions |
| hourly-by-weekday | Revenue by weekday × hour | **YES** — aggregate from transactions |
| **product-master** | Purchase price, supplier, BIO label, subcategory | **NO** — not in transactions |
| **margin-analysis** | Actual purchase cost at time of sale | **NO** — not in transactions |

**Bottom line:** 4 of 7 CSV types are redundant if you have transactions.

---

## Target State: 3 CSV Types

### 1. Transaction CSV (frequent — every 1-2 weeks)
**Your only regular export.** Drop the file, run the pipeline, done.

From this single file the pipeline will compute:
- Daily revenue, transaction count, average basket, payment mix
- Hourly heatmap (weekday × hour)
- Monthly product-level stats (quantity, revenue)
- Annual product-level stats
- Category mix and category evolution
- Product growth/decline trends
- YoY comparisons at every level
- Seasonality patterns

### 2. Product Master CSV (periodic — monthly or quarterly)
Refreshes the enrichment layer:
- Purchase price → enables approximate margin calculation
- Supplier name → enables supplier ranking
- BIO label, subcategory → metadata
- Stock levels → if you ever want inventory views

### 3. Margin Analysis CSV (periodic — quarterly or half-yearly)
The only source for **exact** margins (actual cost at time of sale, not current catalog price). Export once a quarter to true-up the margin picture.

Without it, margins are still computed using product-master purchase prices — close enough for most decisions, but not exact.

---

## Implementation Plan

### Phase 1: Make the transaction importer produce all Silver aggregates (~3h)

**What changes:** When `import-silver.mjs` processes a transaction CSV, it should ALSO emit:
- `monthly-stats-YYYY.json` (aggregated from transactions)
- `annual-stats-YYYY.json` (aggregated from transactions)  
- `category-mix-YYYY.json` (aggregated from transactions)
- `hourly-patterns-YYYY.json` (aggregated from transactions)

**How it works:**

#### Task 1.1 — New aggregation module: `scripts/lib/transaction-aggregator.mjs`
**Time:** 45 min  
**Creates:** A pure function that takes an array of parsed transaction records and returns all four aggregate structures.

```
Input:  [{ timestamp, date, hour, dayOfWeek, productKey, price, category, vatRate, paymentMethod }, ...]

Output: {
  monthlyStats:    [{ key, rawName, monthly: [{ month, quantity, revenue }], totalQuantity, totalRevenue }],
  annualStats:     [{ key, rawName, quantity, revenue, category }],
  categoryMix:     [{ category, vatRate, productCount, totalRevenue, revenueExclVat, vatAmount, share }],
  hourlyPatterns:  [{ dayOfWeek, dayName, hour, revenue }]
}
```

The aggregation logic is straightforward — group-by operations on the parsed transactions. The VAT split for category-mix uses the `vatRate` field already present in each transaction line.

**Verify:** Unit-testable — feed it known transactions, check the sums.

#### Task 1.2 — Wire aggregator into transaction importer
**Time:** 30 min  
**Modifies:** `scripts/importers/transactions.mjs`

After parsing transactions and writing `transactions-YYYY.json`, also call the aggregator and write the four derived Silver files. Use a `source: "transactions"` field in each output so Gold builders can tell whether a Silver file came from a dedicated CSV or was derived.

#### Task 1.3 — Make Silver import prefer dedicated CSVs when available
**Time:** 20 min  
**Modifies:** `scripts/import-silver.mjs`

Import order matters: if both `stat-vente-monthly-2025.csv` AND `transactions-2025.csv` exist, the dedicated monthly-stats CSV wins (it may be more complete for legacy years). The transaction-derived version is only used when no dedicated CSV exists.

Logic: after all CSVs are processed, for each year, check if `monthly-stats-YYYY.json` was written by a dedicated importer. If not, fill it from the transaction aggregator.

This means: for 2023-2025 (where you already have all the CSVs), nothing changes. For 2026+, the transaction CSV alone fills all the gaps.

#### Task 1.4 — Validate: transaction-derived aggregates match dedicated CSVs
**Time:** 30 min  

For 2025 (where we have both transaction CSV and all dedicated CSVs), compare:
- Transaction-derived monthly revenue per product vs. monthly-stats CSV values
- Transaction-derived category totals vs. category-mix CSV values
- Transaction-derived hourly patterns vs. hourly-by-weekday CSV values

Expect them to be close but not identical (the dedicated CSVs may include items that aren't in the transaction export, or vice versa). Document the delta. If the delta is >5%, investigate.

### Phase 2: Simplify the Gold build (~1h)

#### Task 2.1 — Gold builders should not care about Silver source
**Time:** 30 min  
**Modifies:** `scripts/build-gold.mjs`

Currently Gold builders read specific Silver files. They should keep doing exactly that — the change is invisible to them. The Silver layer is the contract; whether it was filled by a dedicated CSV or derived from transactions doesn't matter.

**One exception:** `store-summary.mjs` currently has a revenue priority (monthly-stats > category-mix > transactions). This should be updated: if a Silver file has a `source: "transactions"` marker, it counts as transaction-tier in the priority.

#### Task 2.2 — Verify full pipeline with only transaction CSV for 2026
**Time:** 30 min  

Test: remove all 2026 CSVs from `data/real/` EXCEPT `transactions-2026-partial.csv`. Run the full pipeline. Verify that:
- All Silver files for 2026 are generated
- All Gold files include 2026 data
- `demo.json` renders correctly
- Revenue figures are consistent

### Phase 3: Document the new workflow (~30 min)

#### Task 3.1 — Update README / data docs
**Time:** 15 min  

Document the three-tier CSV model:
1. **Transaction CSV** — export every 1-2 weeks, this is your main data feed
2. **Product master** — export monthly/quarterly for supplier + cost enrichment  
3. **Margin analysis** — export quarterly for exact margin data

Include the POS menu path for each export so you don't have to remember.

#### Task 3.2 — Add a convenience script: `npm run update`
**Time:** 15 min  

A script that:
1. Looks for any new CSV in `data/real/`
2. Runs `import-silver` (just for the new files if possible, or full re-import)
3. Runs `build-gold`
4. Runs `build-demo`
5. Prints a summary: "Processed X transactions, updated Y through Z"

This is your one-command refresh: drop the CSV, run `npm run update`, done.

---

## What You Lose (and Why It's Fine)

| Lost capability | Why it's fine |
|----------------|---------------|
| Monthly-stats has `stock` column | Stock is also in product-master. And stock is a point-in-time snapshot anyway — it's stale the moment you export it. |
| Monthly-stats has `PRIXACHAT` | Purchase price is in product-master. Updated with each master refresh. |
| Annual-stats captures some items not in transaction export | This was the €207K vs €505K discrepancy — annual-stats was actually LESS complete, not more. Transactions are more complete. |
| Category-mix has pre-computed VAT breakdowns | Transactions have the VAT rate per line. The aggregator computes the same split. |
| Hourly-by-weekday is an annual summary | Transactions can compute this for any time window, not just full years. More flexible. |

## What About Historical Data (2023-2025)?

**Don't touch it.** The dedicated CSVs for 2023-2025 are already imported and working. The pipeline keeps using them. This change only affects 2026 going forward.

If you want to validate that the transaction-derived data matches, run the comparison in Task 1.4. But there's no reason to throw away working Silver files for past years.

---

## Approximate Margin vs. Exact Margin

Without margin-analysis CSV, the pipeline can still compute margins by joining:
- Transaction revenue per product (from transactions)
- Purchase price per product (from product-master)

This gives **approximate margin** = sale price / purchase price. It's approximate because:
- Product-master has TODAY's purchase price, not the price at time of each sale
- For weighed items, the relationship between sale price and purchase price is straightforward
- For promotional or price-changed items, there's a small error

For a shop where prices change slowly and you refresh the master quarterly, this is accurate to within ~2-5%. The quarterly margin-analysis export gives you exact numbers to true-up.

---

## Success Criteria

After implementation:
1. Dropping a single transaction CSV in `data/real/` and running `npm run update` produces a complete, working dashboard
2. All existing 2023-2025 data is untouched
3. No degradation in data quality for any metric the dashboard currently shows
4. The quarterly enrichment (product-master + margins) adds precision but isn't blocking
