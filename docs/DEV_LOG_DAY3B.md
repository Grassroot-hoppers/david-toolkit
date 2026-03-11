# Day 3 Evening — Pipeline Completion & Data Validation

**Date:** 2026-03-11 (evening session)
**Duration:** ~2 hours

## What Got Done

### Pipeline runs end-to-end
The full Bronze → Silver → Gold → demo.json pipeline now runs successfully with all 24 CSV files from the POS. Silver layer produces 21 JSON files covering monthly-stats, annual-stats, transactions, category-mix, margins, hourly-patterns, and products for 2023–2026.

### Master Config layer introduced
Added a config-driven corrections system between Bronze and Silver:
- `category-overrides.json` — FRAIS reclassification rules (cross-reference + keyword fallback)
- `product-corrections.json` — expanded with `_meta.skuMerges` for product identity merging
- `config-loader.mjs` — utility to load and parse all config registries
- Silver import restructured to two-pass: parse all CSVs, apply corrections, then write

### Revenue discrepancy fixed
`store-summary.json` now uses a priority cascade for per-year revenue: monthly-stats totals (most complete, 3,663 products) > category-mix totals > transaction-derived totals. Result: 2025 revenue correctly shows €501K (was €207K from annual-stats).

### Junk categories filtered
`category-evolution.json` went from 149 categories (full of DIV. EAN barcodes) to 26 clean categories. Number prefixes stripped, duplicates across VAT rates merged.

### Automated validation expanded
`verify-data.mjs` now includes business-logic assertions: Saturday > Tuesday revenue, hourly peak 10h–13h, revenue floor > €300K per year, no duplicate SKUs, no junk categories, FRAIS share < 5%.

### All 22 verification checks pass

## Key Findings

- **Daily revenue:** €1,400/day (2023) growing to €2,000/day (2025–2026)
- **Peak times:** Saturday 11h and Wednesday 10h are the two biggest slots
- **Monday closed:** 3 trading days total, €12/day avg — effectively closed
- **Trading days:** ~100-114 per year from transactions (lower than expected ~250 — transactions may not cover all days)
- **Top category:** FROMAGE at €136K — confirms cheese is the core business
- **FRAIS residual:** €87K in 2023 → €14K in 2024 after POS reorganization. The reclassification config is ready but the cross-reference didn't match because FRAIS exists in category-mix (aggregated) not in monthly-stats (product-level). Fix deferred to Gold-layer FRAIS redistribution.

## What's Still Open

1. **2024 margin export** — Julien needs to export Module 46A from MicroConcept for 2024
2. **FRAIS redistribution in Gold** — category-mix 2023 "FRAIS" €87K needs splitting into FROMAGE/CHARCUTERIE/etc using monthly-stats subcategory ratios
3. **Category YoY** — shows 0% everywhere because category-mix entries duplicate across VAT rates. Need to align year-over-year calculation.
4. **Trading day coverage** — transactions only have 100-114 days/year (some days may be missing or have zero transactions)

## Commits

1. `feat: add Master Config layer (category-overrides, SKU merges, config-loader)`
2. `feat: two-pass Silver import with Master Config corrections`
3. `fix: revenue source priority cascade + junk category filtering in Gold`
4. `feat: expand verification with business-logic assertions`
