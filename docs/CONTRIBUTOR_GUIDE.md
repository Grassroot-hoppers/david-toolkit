# Contributor Guide

## 1. What This Is

David Toolkit is a browser-first retail intelligence dashboard for independent shop owners. It ingests POS CSV exports, runs them through a 3-stage build pipeline, and produces a static JSON file that powers a live dashboard — no server, no database, no runtime dependencies in production.

---

## 2. Repository Structure

```
data/
  real/          Bronze — raw POS CSV exports (gitignored, kept on main workstation)
  silver/        Silver — normalized JSON, one file per data type per year
  gold/          Gold — aggregated, analysis-ready JSON (6 files)
public/
  index.html     Dashboard shell
  app.js         All dashboard logic (~870 lines, browser-only)
  styles.css     All styles
  data/
    demo.json    The single payload the dashboard reads (58K lines, built by pipeline)
scripts/
  import-silver.mjs    Bronze → Silver (detects CSV type by header fingerprint)
  build-gold.mjs       Silver → Gold (aggregation and analysis)
  build-demo.mjs       Gold → demo.json (1078 lines, most complex file)
  importers/           One importer per CSV type
  lib/                 Shared utilities
docs/
  DEV_LOG.md           Day 1–3 development log
  DEV_LOG_DAY4.md      Day 4 log — the most important document in this repo
  plans/               Design and implementation plans per feature
sample-data/
  config/              product-master.csv, supplier-map.json, category-overrides.json
```

---

## 3. The Pipeline

```
data/real/*.csv          (Bronze — raw POS exports, gitignored)
       ↓ npm run import
data/silver/*.json       (Silver — normalized, one file per data type)
       ↓ npm run build:gold
data/gold/*.json         (Gold — aggregated, 6 files)
       ↓ npm run build:demo
public/data/demo.json    (single dashboard payload)
       ↓ git push → GitHub Pages
Live dashboard (browser-only, no backend)
```

**Commands:**

```bash
npm install
npm run serve           # serve public/ at http://localhost:4173 (no build)
npm run build:demo      # Gold → demo.json (fast, uses existing gold files)
npm run build:full      # full rebuild: import + build:gold + build:demo
npm run build:full && npm run serve  # typical dev cycle
```

---

## 4. How to Update With New Data

⚠️ **Pipeline must run on the machine that has the POS CSV files.** The `data/real/` directory is gitignored — CSVs never leave the shop computer.

1. On the main workstation: export weekly CSVs from your POS system
2. Place them in `data/real/`
3. Run `npm run build:full`
4. Verify: open http://localhost:4173 — check product count (~481), recent week revenue, sparklines are alive
5. If everything looks right:
   ```bash
   git add public/data/demo.json
   git commit -m "data: update week YYYY-WNN"
   git push
   ```
6. GitHub Pages deploys automatically. Dashboard is live within ~60 seconds.

---

## 5. Design Decisions

**Why static JSON (no database, no server)?**
The shop owner needs zero infrastructure. The dashboard runs from GitHub Pages. No Supabase, no Postgres, no Node.js in production. The entire intelligence layer runs at build time on a local machine.

**Why Medallion architecture (Bronze/Silver/Gold)?**
Chosen on Day 1 to separate concerns: raw data, normalized data, analysis-ready data. Technically correct for the long term. Over-engineered for solo maintenance alongside a shop — the main architectural debt. See Day 4 devlog for the full diagnosis.

**Why ABCD ranking?**
Pareto principle applied to retail. A = top 20% by revenue (defend), B = next 30% (grow), C = long tail (monitor), D = candidates for removal. Thresholds are set in `sample-data/config/context.json`.

**Why Cap 2026 zones (Rouge/Orange/Vert/Bleu)?**
Weekly revenue thresholds calibrated to this specific shop's break-even and target range. Not generic. The owner sets them in context.json. The zone signal drives ordering confidence: Zone Rouge = reduce orders, Zone Bleu = order in confidence.

**Why browser-only dashboard?**
No backend means no hosting costs, no maintenance, no secrets in production. The tradeoff: no real-time data, no multi-user sessions, no auth. Acceptable for v0.1 — a single shop, a single owner.

---

## 6. Known Issues

**P0 — Pipeline must run on main workstation**
The `data/real/` CSV files are gitignored. `npm run build:full` must be run on the machine that has the POS exports. The demo.json committed to the repo was built on the main workstation with full data. Running build:full on a laptop without the CSVs will produce degraded output (fewer products, no sparkline history). **Do not rebuild demo.json on a machine without the full data/real/ directory.**

**P1 — monthly-product-stats.json only covers 14 of 481 products**
The POS `monthly-stats` CSV type only exports data for ~14 products (a specific product group). The other 467 products get their sparkline history from transaction aggregation. This works when the full transaction data is present, but fails silently on partial data. Fix: build sparklines from daily-sales aggregation per product rather than relying on the monthly-stats CSV type.

**P2 — build-demo.mjs is 1078 lines with no modular structure**
The main maintenance risk. A bug can originate in 6 different places: POS export → Bronze parsing → Master Config → Silver schema → Gold aggregation → demo.json build → UI rendering. Recommended fix: split into product-builder.mjs, supplier-builder.mjs, category-builder.mjs, briefing-builder.mjs. Each file owns one concern.

**P3 — No schema validation between pipeline stages**
Fields like `revenue2025`, `latestRevenue`, `totalRevenue` represent similar concepts differently across files. There is no schema definition file. A field renamed in one stage silently passes zeros downstream. Fix: define a JSON Schema for each Silver and Gold file type, validate at each stage boundary.

**P4 — weeklyMetrics dates become stale**
`weeklyMetrics.nextWeekStart` is set at build time, not runtime. After a few weeks without rebuilding, the "next week" prediction will reference the past. Fix: compute the prediction dates at runtime in app.js relative to `new Date()`.

**P5 — Category-mix entries may be duplicated by VAT rate**
Some POS exports emit "02. FROMAGE 6%" and "02. FROMAGE 21%" as separate entries. The Gold build normalizes these (strips the VAT suffix), but coverage depends on the exact CSV format. Verify `category-evolution.json` after each import if YoY figures look wrong.

---

## 7. What Comes Next

**Immediate (next sprint — whoever picks this up):**
- Fix P1: build monthly sparklines from daily-sales aggregation per product key (remove dependency on monthly-stats CSV type)
- Fix P2: modularize build-demo.mjs into 4 builder files
- Fix P4: compute weeklyMetrics dates at runtime

**Medium term:**
- Implement Tabs 5–7 (Tendances hourly heatmap, Pipeline schema viewer, Données audit)
- Automated weekly data push: GitHub Action that runs build:full when CSVs are pushed to a private branch
- product-master.csv as the single source of truth for product names, categories, and suppliers (replacing the current keyword-matching approach)

**Architecture decision pending:**
The Day 4 devlog documents an Option A vs Option B choice for the pipeline. Read it before touching anything. Option B (transaction-first, 2 files instead of 6) is the recommended long-term path for solo maintainability. The current architecture is correct but over-engineered.

---

## 8. The Day 4 Devlog

Read `docs/DEV_LOG_DAY4.md` before touching the pipeline. It is the most accurate technical brief in this repository. It identifies the exact failure modes, the naming convention debt, and the architectural decision tree. It was written in real time by the founder at the moment the complexity ceiling was hit. A technical co-founder should treat it as the starting specification.
