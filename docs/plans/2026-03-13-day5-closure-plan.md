# Day 5 Closure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the hackathon with a visually correct dashboard, a contributor guide, a Day 5 devlog, and a v0.1.0 git tag.

**Architecture:** No pipeline changes. All fixes are UI-only or new documentation files. The current demo.json on disk was built on the main workstation with full POS data — it must not be rebuilt on this machine.

**Tech Stack:** Vanilla JS (app.js), Markdown, Git

---

## ⚠️ CRITICAL: Do not run `npm run build:demo` or `npm run build:full` during this plan

The Silver data on this laptop is incomplete (sample only, real CSVs are on the main workstation). Rebuilding demo.json here would destroy 359 working sparklines. All pipeline work must happen on the main workstation.

---

## Task 1: Fix dead sparklines — UI fallback

**What:** 122 products have `monthlyHistory` as 36 zeros. The sparkline renderer draws a flat red line at the bottom (the "dead" visual). Replace it with an empty SVG — neutral, not broken.

**Files:**
- Modify: `public/app.js` (function `renderSparkline`, lines 652–670)

**Step 1: Read the current renderSparkline function**

Confirm lines 652–670 match this:
```js
function renderSparkline(history) {
  if (!history || history.length === 0) return `<svg width="80" height="24"></svg>`;
  const clean = history.map(v => (typeof v === "number" && Number.isFinite(v)) ? v : 0);
  // ...
  const max = Math.max(...clean, 1);
  // ...
  const trend = clean[clean.length - 1] > clean[0];
  const color = trend ? "#10B981" : "#EF4444";
  return `<svg ...><polyline points="${points}" .../></svg>`;
}
```

**Step 2: Add all-zero guard at the top of renderSparkline**

After the existing empty-array guard, add:
```js
function renderSparkline(history) {
  if (!history || history.length === 0) return `<svg width="80" height="24"></svg>`;
  const clean = history.map(v => (typeof v === "number" && Number.isFinite(v)) ? v : 0);
  // NEW: if all values are zero, return empty sparkline (no data, not broken)
  if (clean.every(v => v === 0)) return `<svg width="80" height="24" class="sparkline sparkline--empty"></svg>`;
  // ... rest of function unchanged
```

**Step 3: Verify visually**

Run: `npm run serve`
Open: http://localhost:4173 → Tab 2 (Produits)
Expected: Products with no history show blank space, not a flat red line. Products with real history still show colored sparklines.

**Step 4: Commit**

```bash
git add public/app.js
git commit -m "fix: show empty sparkline for products with no monthly history"
```

---

## Task 2: Remove displayName — use name everywhere

**What:** Zero products have a `displayName` field. The UI uses `p.displayName || p.name` fallback throughout. This creates silent inconsistency. Remove all `displayName` references in `app.js` — use `name` as the single canonical field.

**Files:**
- Modify: `public/app.js`

**Step 1: Find all displayName usages**

Run: `grep -n "displayName" public/app.js`

Expected output (4 occurrences):
- Line 399: `name: p.displayName,` (in getOrderingReminders)
- Line 568: `if (searchQuery && !(p.displayName || p.name || "").toLowerCase()` (in updateProductList)
- Line 617: `const memberProducts = products.filter(p => g.members.includes(p.displayName || p.name));` (in group expand handler)
- Line 642: `<span class="product-name">${p.displayName || p.name}</span>` (in renderProductRow)

**Step 2: Replace all four occurrences**

- Line 399: `name: p.displayName,` → `name: p.name,`
- Line 568: `!(p.displayName || p.name || "")` → `!(p.name || "")`
- Line 617: `g.members.includes(p.displayName || p.name)` → `g.members.includes(p.name)`
- Line 642: `p.displayName || p.name` → `p.name`

**Step 3: Verify group expand works**

Run: `npm run serve`
Open: http://localhost:4173 → Tab 2
Action: Click expand (▶) on the first product group (Fromages)
Expected: Members list appears with real product names, not empty.

**Step 4: Commit**

```bash
git add public/app.js
git commit -m "fix: remove displayName fallback, use name as single canonical field"
```

---

## Task 3: Write the Contributor Guide

**What:** Create `docs/CONTRIBUTOR_GUIDE.md` — a developer-facing document for anyone who wants to understand, run, or continue this project. Written for a technical co-founder. Honest about known issues. No marketing.

**Files:**
- Create: `docs/CONTRIBUTOR_GUIDE.md`

**Content structure (write in order):**

### 1. What This Is
David Toolkit is a browser-first retail intelligence dashboard for independent shop owners. It ingests POS CSV exports, runs them through a 3-stage build pipeline, and produces a static JSON file that powers a live dashboard — no server, no database, no runtime dependencies in production.

### 2. Repository Structure
```
data/
  real/          Bronze — raw POS CSV exports (gitignored, kept on main workstation)
  silver/        Silver — normalized JSON, one file per data type per year
  gold/          Gold — aggregated, analysis-ready JSON (6 files)
public/
  index.html     Dashboard shell
  app.js         All dashboard logic (627 lines, browser-only)
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

### 3. The Pipeline

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

### 4. How to Update With New Data

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

### 5. Design Decisions

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

### 6. Known Issues

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

### 7. What Comes Next

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

### 8. The Day 4 Devlog

Read `docs/DEV_LOG_DAY4.md` before touching the pipeline. It is the most accurate technical brief in this repository. It identifies the exact failure modes, the naming convention debt, and the architectural decision tree. It was written in real time by the founder at the moment the complexity ceiling was hit. A technical co-founder should treat it as the starting specification.

---

**Step 4: Commit**

```bash
git add docs/CONTRIBUTOR_GUIDE.md
git commit -m "docs: add CONTRIBUTOR_GUIDE.md for handoff and onboarding"
```

---

## Task 4: Write Day 5 Devlog

**What:** A closing entry under 400 words. What was fixed today. What v0.1 is. What the live link is. What comes next. Not a victory lap — a handoff note.

**Files:**
- Create: `docs/DEV_LOG_DAY5.md`

**Content template:**

```markdown
# Day 5 — v0.1.0

**Date:** 2026-03-13

## What Happened

Day 5 was about closing, not building.

The dashboard had two visual bugs carried from Day 4: 122 products showed a flat red sparkline (dead line instead of blank) because they have no monthly history in the POS data. A displayName field referenced throughout app.js didn't exist on any product — the fallback to name worked for display but created silent inconsistency in group member matching.

Both are fixed. Dead sparklines now show blank. Name is the single canonical field.

## What v0.1 Is

A working retail intelligence dashboard for an independent shop, built in 5 days by a non-engineer between shop shifts.

**Live:** [link to GitHub Pages]

**What works:**
- Tab 1 (Briefing): zone signal, ordering reminders, next-week revenue prediction with weather and Belgian holidays, 14-day forecast
- Tab 2 (Produits): 481 products with ABCD ranking, search, category filter, product group expand/collapse, sparklines for 359 products
- Tab 3 (Catégories): category mix with revenue, share, YoY growth
- Tab 4 (Fournisseurs): supplier ranking, ordering days, top products per supplier
- Tabs 5–7: stubs (labelled as coming next)

**What doesn't work yet:**
- Sparklines for 122 products with no monthly POS data
- Tabs 5–7
- Real-time data (rebuild required after each POS export)

## The Honest Assessment

The Deep Research brief was right: this isn't a failed hackathon. It's a v0.1 that does what it says it does, documented honestly, with the debt catalogued.

The Day 4 devlog is the most important document in this repo. Anyone picking this up should read it first.

## What's Next

Fix the sparkline data source. Modularize build-demo.mjs. Implement Tabs 5–7. Find a technical co-founder who can own the pipeline.

The foundation is real. The architecture is documented. The data is real. The wall is known.
```

**Step 2: Commit**

```bash
git add docs/DEV_LOG_DAY5.md
git commit -m "docs: Day 5 devlog — v0.1.0 closure"
```

---

## Task 5: Update README + Tag v0.1.0

**What:** Update the README status section to reflect v0.1 shipped. Add link to CONTRIBUTOR_GUIDE. Tag the release.

**Files:**
- Modify: `README.md`

**Step 1: Read the current README status section**

Find the section that describes the current status (search for "v0.1" or "Status").

**Step 2: Update the status**

Replace the current status block with:
```markdown
## Status

**v0.1.0 — Shipped 2026-03-13 after a 5-day solo hackathon.**

Tabs 1–4 are functional with real data. Tabs 5–7 are documented stubs. The pipeline works on the main workstation with POS CSV exports.

→ [Live dashboard](https://[your-github-pages-url])
→ [Contributor Guide](docs/CONTRIBUTOR_GUIDE.md) — start here if you want to continue this
→ [Day 4 Devlog](docs/DEV_LOG_DAY4.md) — the honest technical brief
```

**Step 3: Commit and tag**

```bash
git add README.md
git commit -m "docs: update README for v0.1.0 release"
git tag v0.1.0
git push --tags
```

**Step 4: Verify tag exists**

Run: `git tag`
Expected: `v0.1.0` appears in the list.

---

## Execution Summary

| Task | File(s) | Est. time |
|------|---------|-----------|
| 1. Sparkline fallback | public/app.js | 20 min |
| 2. Remove displayName | public/app.js | 20 min |
| 3. Contributor Guide | docs/CONTRIBUTOR_GUIDE.md | 60 min |
| 4. Day 5 Devlog | docs/DEV_LOG_DAY5.md | 30 min |
| 5. README + tag | README.md | 15 min |
| **Total** | | **~2h25** |
