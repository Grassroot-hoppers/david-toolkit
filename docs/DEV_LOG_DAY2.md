# Day 2 — The Data Day

**Date:** 2026-03-10, Tuesday

#### Shipped today

* 24 real POS CSVs exported and inventoried
* Bronze → Silver → Gold data pipeline (6 Silver importers, 7 Gold builders, 28 commits)
* Data inventory documenting all 7 file types
* Alpha dashboard — real data, live weather, growth scoring, category/supplier cleanup
* V2 design doc — 8-tab intelligence tool architecture for Day 3+

Yesterday was about anchoring the project in reality — building the operating rhythm, proving we can work phone + laptop + Cursor, and establishing what we know vs what we assume. Today was about backing all of that up with actual data.

The Day 1 phase gate said: "no dashboard wiring until we have one real export proving the file format in practice." Today we blew past that gate with 24 exports, a full data architecture, and a running pipeline.

---

### The POS data archaeology

The morning started at the shop. Sitting at the POS terminal, exporting everything: 3 years of monthly product stats, 4 years of annual sales, 4 years of transaction detail, category breakdowns, margin analysis, hourly traffic patterns, and the full product master catalog.

24 CSV files. CP1252 encoding, semicolon-delimited, European decimal commas. The usual Belgian POS mess.

Then the inventory work: reading every single file, documenting every column, every quirk, every edge case. The result is `docs/data-inventory.md` — a 314-line canonical reference for every file type:

1. **Monthly Product Stats** (3,667 products × 12 months × 3 years) — the most valuable files
2. **Annual Product Sales** (1,085–3,830 products/year, including 2026 partial)
3. **Category Mix** (65–98 categories/year with VAT breakdowns)
4. **Margin Analysis** (~47,000 transaction-level margin rows, 2025–2026 only)
5. **Product Master** (3,108 products, 60+ columns, no header row)
6. **Hourly Revenue by Weekday** (peak hour analysis across 3 years)
7. **Transaction Detail** (~150,000 individual sale lines across 3+ years)

Key discovery: the `id` column uses internal sequential IDs in some files but EAN codes in others. Product matching must use normalized name as the join key, not ID. This would have been invisible with synthetic data.

---

### Two designs, then the right one

The first design was a simple two-step pipeline: import CSVs to normalized JSON, then build `demo.json` from that. It worked on paper but felt flat — too shaped for the current dashboard, not shaped for reality.

The breakthrough came from research into the Medallion Architecture pattern. The data isn't for one dashboard. It's for every future consumer: the weekly briefing, the AI ordering assistant, the supplier analysis, the seasonal prediction engine. All of them need the same canonical truth.

So the "Data Temple" was born: Bronze → Silver → Gold.

```
data/real/*.csv            ← BRONZE (24 raw POS exports, untouched)
    ↓  import-silver.mjs
data/silver/               ← SILVER (cleaned, entity-centric JSON)
    ↓  build-gold.mjs
data/gold/                 ← GOLD (small, pre-computed, dashboard-ready)
    ↓  build-demo.mjs
public/data/demo.json      ← Current dashboard's specific slice
```

Each layer has a clear job. Bronze is the raw truth. Silver is the cleaned truth. Gold is the computed truth. Any new consumer plugs into Gold — or into Silver if it needs more granularity.

---

### 21 tasks in 25 minutes

The implementation plan had 21 tasks across 5 phases. The execution was fast — 15 commits between 13:43 and 14:07.

**Phase 1 — Foundation (2 tasks)**
- Directory scaffolding (`data/silver/`, `data/gold/`, npm scripts)
- Core CSV utilities module (`scripts/lib/csv-utils.mjs`) with tests: encoding detection, decimal parsing, compound monthly cell parsing (`"7418  (218,88)"` → `{ quantity: 7418, revenue: 218.88 }`), product name cleaning, file type detection

**Phase 2 — Silver Importers (8 tasks)**

Six specialized importers, each handling one POS export type:

- **Product Master** — the trickiest. No header row, 60+ columns by position. EAN, name, price, cost, stock, category, supplier, BIO label, creation date, last sold date.
- **Monthly Stats** — per-product monthly breakdown. Auto-detects year from column prefixes (`25_01` → 2025). Parses compound `quantity (revenue)` cells.
- **Annual Stats** — simpler per-product annual totals. Filters refund rows and summary footers.
- **Transactions** — the heaviest. ~44k rows/year. Timestamp parsing (`03-01-25 14:41` → ISO), weight prefix stripping, payment method detection.
- **Category Mix** — category + VAT rate splitting, typo correction (`02. FRA` → `02. FROMAGE`).
- **Hourly Patterns** — French day names to ISO day numbers, revenue by weekday × hour.

Plus the orchestrator (`import-silver.mjs`): scans `data/real/`, auto-classifies each CSV by header fingerprint, routes to the right importer, writes Silver JSON, produces an import report.

**Phase 3 — Gold Builders (7 files from one script)**

`build-gold.mjs` reads Silver and produces 7 dashboard-ready aggregate files:

| Gold file | What it contains |
|-----------|-----------------|
| `product-catalog.json` | Master reference: every product with category, supplier, price, margin, lifecycle status |
| `daily-sales.json` | One row per calendar day — revenue trends, weather join surface |
| `monthly-product-stats.json` | 36-month seasonality curves per product |
| `category-evolution.json` | Category share trends across 4 years |
| `hourly-heatmap.json` | Peak hours by weekday, multi-year |
| `margin-ranking.json` | Profitability ranking with margin ratios |
| `store-summary.json` | Annual KPIs: total revenue, product count, trading days |

**Phase 4 — Dashboard migration**

`build-demo.mjs` reads from Gold instead of directly from CSVs. The scoring engine applies, `demo.json` comes out the other end. Verified with `verify-data.mjs`.

**Phase 5 — Cleanup**

Removed legacy `import-exports.mjs`. Updated architecture docs. The old `data/normalized/` path still works as fallback.

The full pipeline: `npm run import` → `npm run build:gold` → `npm run build:demo`. Or just `npm run build:full`.

---

### The stock lie

The most important discovery of the day happened while studying the Gold output.

The `STOCK` field in the POS exports is not current inventory. It's cumulative sold units from an initial value of zero. A product showing `STOCK: -41` means "41 units have been sold since the counter was last reset." The POS was never set up with real stock management.

This means every stock-based signal in the current scoring engine — stock cover days, stockout suspicion, demand pressure — is built on fiction. The entire ordering confidence framework that drives the performance zones is based on data that doesn't exist.

This is exactly the kind of thing the Day 1 phase gate was designed to catch.

---

### Alpha dashboard reframe

With stock data gone, the dashboard can't be an ordering tool. Not yet. Not until real inventory tracking exists.

So the alpha becomes what it honestly can be: **a big picture intelligence tool.**

- "How is the shop doing this week vs last year?"
- "Which categories are growing or shrinking?"
- "Which products are moving fastest?"
- "Which suppliers matter most?"

**New scoring** — growth-based, not stock-based:
- **en hausse**: YoY revenue growth > 10%
- **stable**: within ±10%
- **en baisse**: YoY decline > 10%

**Category cleanup** — the raw POS exports have 149 category entries (same category with different VAT rates, typos, junk entries). The alpha cleans them down to ~15 meaningful categories with proper French title case.

**Supplier normalization** — 85 raw POS supplier names contain duplicates, typos, and variations (ANKORSTORE/ANKORESTORE/ANKOR STORE/ANKORESTRORE/ANKOSTORE/ANKHORESTORE). Mapped down to ~40 clean names with Notion page links.

**Weekly metrics from real data** — last full week revenue, same-week-last-year comparison, week-over-week change, performance zone placement. All computed from `daily-sales.json`.

**Live weather** — Open-Meteo API (free, no key needed) fetched at page load for Brussels. Real 7-day forecast in the weather strip.

---

### The alpha ships

Everything on the workbench landed. 28 commits across the full day.

`demo/app.js` was rewritten from scratch to load Gold-sourced `demo.json` and populate every section with real data — weekly metrics, category breakdown, top products with growth badges, supplier ranking, monthly revenue timeline. No hardcoded numbers. Every figure traces back through Gold → Silver → Bronze to real POS exports.

`demo/index.html` was stripped of legacy markup and rebuilt with data-binding IDs. The old `public/` directory (static demo shell with preview screenshot) was removed entirely — the new `demo/` directory is the only dashboard now.

Live Brussels weather from Open-Meteo API loads at page render. 7-day forecast in the weather strip, no API key needed.

The old `build-data.mjs` with its stock-fiction scoring was deleted. Replaced by a clean `build-demo.mjs` that reads from Gold and applies honest growth-based scoring, category cleanup (~149 raw POS entries → ~15 meaningful categories), and supplier normalization (85 raw names → ~40 clean names with Notion links).

Final cleanup: dropped the `xlsx` dependency that was pulling in two high-severity vulnerabilities (prototype pollution, ReDoS). The pipeline never needed it — all POS exports are CSV.

---

### The brainstorming pivot

With the alpha working, the natural question was: "Is this actually useful?" The honest answer: not yet. A metrics summary isn't what an operator reaches for at 7am before opening. It's what you glance at once and forget.

So the end of Day 2 became a brainstorming session for what the dashboard needs to become: a **real intelligence tool** with daily operational value.

Three priorities crystallized:

1. **Trust the data** — the auto-cleaned categories and product names are ~80% right, but the 20% that's wrong undermines everything. Every data dimension needs a human-in-the-loop review pass: listing scripts that dump data in reviewable format, config files where corrections live, and a pipeline that applies them at build time.

2. **ABCD product ranking** — revenue Pareto classification. A-products (top 20% of cumulative revenue) get attention, D-products (bottom 20%) are delist candidates. This replaces the meaningless "en hausse / stable / en baisse" with something that drives action.

3. **Multi-tab architecture** — eight tabs, each with a specific operational purpose. Not a single scrolling page with everything. A daily briefing tab that says what today means operationally. A products tab with seasonality curves and ordering suggestions. A categories tab with revenue-per-shelf-meter analysis. A pipeline visualization tab.

The result is `docs/plans/2026-03-10-day3-dashboard-v2-design.md` — a full design document covering the expanded data model, tab architecture, new config files, and implementation sequence. This is the plan for Day 3+.

---

## Decisions

- **Phase gate: lifted.** 24 real exports proved the schema. The formats match the documentation. We can wire data into the dashboard with confidence.
- **Bronze → Silver → Gold is the architecture.** Not a temporary hack — this is the canonical data layer for everything that comes after.
- **Stock data is fake.** No stock-based signals until real inventory management exists in the POS. The dashboard is an intelligence tool, not an ordering tool.
- **The scoring reframe is permanent.** Growth-based classification (en hausse / stable / en baisse) is the honest signal for now. ABCD Pareto ranking replaces it in V2.
- **Category and supplier cleanup happens at build time.** Raw POS names go in, clean French display names come out. The cleanup rules live in config, not in the pipeline code.
- **The alpha is a proof of concept, not the product.** It proved the pipeline works end-to-end with real data. V2 is the product.

## Day 2 by the numbers

| Metric | Count |
|--------|-------|
| Commits | 28 |
| POS files exported and inventoried | 24 |
| Silver importers built | 6 |
| Gold builders | 7 |
| Raw supplier names cleaned | 85 → ~40 |
| Raw category entries cleaned | 149 → ~15 |
| Vulnerabilities eliminated | 2 (dropped xlsx) |
| Design docs written | 3 (pipeline, alpha, V2) |

## What's next (Day 3)

The V2 design doc (`docs/plans/2026-03-10-day3-dashboard-v2-design.md`) is the roadmap. Day 3 focuses on data trust and the first three tabs:

1. **Data trust passes** — listing scripts + config files for categories, ABCD ranking, and product names. Categories first (smallest list, highest dashboard impact), then ABCD ranking, then product name review.
2. **New config files and pipeline extensions** — `category-map.json`, `ranking-overrides.json`, `product-corrections.json`, `product-groups.json`, `shelf-allocation.json`, `category-tree.json`, `holidays-be.json`.
3. **Tab framework** — single HTML page with tab bar, section switching, dark theme.
4. **Tab 1: Briefing du jour** — daily operational intelligence with context engine (ordering days, holiday calendar, weather, same-period-last-year signals, next-week prediction).
5. **Tab 2: Produits** — product groups, ABCD badges, 36-month sparklines, ordering suggestions.
6. **Tab 3: Catégories** — revenue per shelf-meter, category tree, kill/expand signals.
7. **Tabs 4–7** — design pending review after tabs 1–3 are built.
