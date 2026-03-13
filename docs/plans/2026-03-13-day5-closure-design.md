# Day 5 Closure Design — David Toolkit v0.1

**Date:** 2026-03-13  
**Approach:** C — Time-boxed pipeline fix + UI fallback + contributor guide  
**Hard constraint:** 4 hours total. No scope creep.

---

## What We're Doing and Why

The hackathon produced a real working dashboard with 481 products, 4 functional tabs, and a live deployment. Two things make it look broken to a visitor: dead sparklines on 65 high-revenue products (flat red line instead of history), and zero displayName fields causing potential group membership mismatches. The pipeline itself has 14 entries in monthly-product-stats.json when it should have 400+. This is the root cause.

The goal today is not to rebuild anything. It is to fix what makes the dashboard look broken, verify the pipeline works with new data, and write a document honest enough that a technical co-founder can pick this up and know exactly what they're inheriting.

---

## Section 1 — Pipeline Fix (60 min hard cap)

**Root cause:** `build-gold.mjs` generates `monthly-product-stats.json` from a specific Silver importer. Only 14 products receive monthly history. The product catalog has 6,074 entries; the dashboard renders 481. The 467 products without history have `monthlyHistory: [0,0,...,0]` (36 zeros), which renders as a flat red sparkline.

**Most likely cause:** Key mismatch between POS product names (Silver) and normalized product names (Gold/demo). The join fails silently and fills zeros.

**Fix strategy:**
1. Read `build-gold.mjs` — find the function that builds monthly-product-stats
2. Diagnose the join: what key is used, what's in Silver, what's in the product catalog
3. Fix the join (loosen matching or normalize both sides)
4. Rebuild and verify monthly-product-stats.json has 400+ entries with real revenue values

**Hard timebox rule:** At 45 minutes, if root cause is not confirmed, stop pipeline work and apply UI fallback only. No exceptions. This is the Day 4 trap.

**UI fallback (applied regardless):** In `renderSparkline()`, detect all-zero history and return an empty SVG instead of a flat red line. Neutral, not broken.

---

## Section 2 — displayName Cleanup (20 min)

**What's broken:** No product has a `displayName` field (0 of 481). The UI uses `p.displayName || p.name` everywhere for display — this works fine via fallback. But product group member matching uses `g.members.includes(p.displayName || p.name)`, which may fail if group member names in the JSON don't exactly match `p.name`.

**Fix:** Remove all `displayName` references from `app.js`. Use `name` everywhere. Verify 2-3 product groups expand and show correct members.

**Single naming convention going forward:** `name` is the canonical field. `displayName` is dead.

---

## Section 3 — Contributor Guide (60 min)

**File:** `docs/CONTRIBUTOR_GUIDE.md`

**Audience:** A technical co-founder or developer who clones this repo and needs to understand it, run it, and continue it. Not a user guide. Not marketing.

**Structure:**

### 1. What This Is
David Toolkit is a browser-first retail intelligence dashboard for independent shop owners. It ingests POS CSV exports, runs them through a 3-stage build pipeline, and produces a static JSON file that powers a live dashboard — no server, no database, no runtime dependencies.

### 2. Architecture
```
data/real/*.csv          (Bronze — raw POS exports, gitignored)
       ↓ npm run import
data/silver/*.json       (Silver — normalized, one file per data type)
       ↓ npm run build:gold
data/gold/*.json         (Gold — aggregated, analysis-ready)
       ↓ npm run build:demo
public/data/demo.json    (Demo — single payload for the dashboard)
       ↓ GitHub Pages
Dashboard (browser-only, no backend)
```

Key files:
- `scripts/import-silver.mjs` — Bronze → Silver. Detects CSV type by header fingerprint. Routes to importers in `scripts/importers/`.
- `scripts/build-gold.mjs` — Silver → Gold. Aggregates into 6 Gold files.
- `scripts/build-demo.mjs` — Gold → demo.json. 1078 lines. The most complex file.
- `public/app.js` — Dashboard. 627 lines. Browser-only. Reads demo.json via fetch.

### 3. How to Run
```bash
npm install
npm run build:demo    # fast: uses existing Silver/Gold
npm run serve         # http://localhost:4173
npm run build:full    # full rebuild from Bronze CSVs
```

### 4. How to Update With New Data
1. Export CSVs from your POS system
2. Place them in `data/real/`
3. Run `npm run build:full`
4. Verify: check console for errors, open http://localhost:4173, confirm product count and recent week revenue look correct
5. If everything looks right: `git add public/data/demo.json && git commit -m "data: update week YYYY-WNN" && git push`
6. GitHub Pages deploys automatically on push to main

### 5. Design Decisions

**Why Medallion architecture (Bronze/Silver/Gold)?**  
Chosen on Day 1 to separate concerns: raw data, normalized data, analysis-ready data. The long-term correct choice. Overly complex for one developer to maintain solo — the known debt.

**Why static JSON (no database, no server)?**  
Shop owner needs zero infrastructure. The dashboard runs from GitHub Pages. No Supabase, no Postgres, no Node.js in production. The build step happens locally before deploy.

**Why browser-only dashboard?**  
Same reason. No backend means no hosting costs, no maintenance, no secrets in production. The tradeoff: no real-time data, no multi-user, no auth.

**Why ABCD ranking?**  
Pareto principle applied to retail. A = top 20% by revenue (defend), B = next 30% (grow), C = long tail (monitor), D = candidates for removal. Thresholds are configurable in `build-demo.mjs`.

**Why Cap 2026 zones (Rouge/Orange/Vert/Bleu)?**  
Weekly revenue thresholds calibrated to this specific shop's break-even and target range. Not generic. The owner sets them in context.json.

### 6. Known Issues (Priority Order)

**P1 — monthly-product-stats.json only covers 14 of 481 products**  
Root cause: key mismatch between Silver monthly-stats data and product-catalog names. Effect: 65 products show flat/dead sparklines. Fix: repair the join in `build-gold.mjs`. Estimated effort: 2-4 hours for someone who reads the full pipeline.

**P2 — build-demo.mjs is 1078 lines with no modular structure**  
This is the main maintenance risk. A bug can hide in 6 places (POS → Bronze → Silver → Gold → demo.json → UI). Recommended fix: Option B from the Day 4 devlog — simplify to a transaction-first pipeline. Estimated effort: 1-2 days for a developer who knows the domain.

**P3 — No field naming convention enforced**  
`displayName` vs `name` existed as two competing fields. `displayName` has been removed. `name` is now canonical. But other fields (e.g. `revenue2025`, `latestRevenue`, `totalRevenue`) represent similar concepts differently across files. A schema definition file would prevent this.

**P4 — Category-mix entries duplicated by VAT rate**  
"02. FROMAGE 6%" and "02. FROMAGE 21%" are separate entries in some Silver files. Normalization happens in build-gold but may be incomplete. Check `category-evolution.json` for duplicate category names before trusting YoY figures.

**P5 — weeklyMetrics dates are hardcoded to last build date**  
`weeklyMetrics.nextWeekStart` is set at build time, not runtime. After a few weeks without rebuilding, the "next week" prediction will reference the past. Fix: compute relative to current date at runtime, or enforce regular rebuilds.

### 7. What Comes Next

**Short term (next developer sprint):**
- Fix monthly-product-stats join (P1)
- Modularize build-demo.mjs — split into product-builder, supplier-builder, category-builder, briefing-builder
- Implement Tabs 5-7 (Tendances, Pipeline, Données)

**Medium term:**
- Option B pipeline: transaction-first, simpler, two files instead of six
- product-master.csv as single source of truth for product names and categories
- Automated weekly data ingestion (GitHub Action that runs build:full on CSV push)

**Architecture decision pending:**
The Day 4 devlog documents the Option A vs Option B choice explicitly. Read it before touching the pipeline. The current architecture is correct but over-engineered for solo maintenance. A technical co-founder should evaluate whether to fix-in-place or rebuild Option B before the shop owner has to maintain it.

---

## Section 4 — Pipeline Verification (20 min)

After fixing the pipeline, verify the full cycle works:
1. Run `npm run build:full` — confirm no Node.js errors
2. Check `data/gold/monthly-product-stats.json` — confirm 400+ entries
3. Check `public/data/demo.json` — confirm `monthlyHistory` arrays have non-zero values for major products
4. Open dashboard at localhost:4173 — confirm sparklines are alive on Tab 2

Document any errors or surprises in the Day 5 devlog.

---

## Section 5 — Closure (20 min)

**Day 5 devlog:** Under 400 words. What was fixed. What v0.1 does. What the live link is. What comes next. Honest. Not a victory lap.

**Git tag:** `git tag v0.1.0 && git push --tags`

**README update:** Change status section to reflect v0.1 shipped. Add link to CONTRIBUTOR_GUIDE.md.

---

## Time Budget

| Task | Time |
|------|------|
| Pipeline fix (timebox) | 60 min |
| UI fallback (sparkline) | 15 min |
| displayName cleanup | 20 min |
| Contributor guide | 60 min |
| Pipeline verification | 20 min |
| Day 5 devlog + tag + README | 20 min |
| **Total** | **~3h15** |

Buffer: ~45 min. Use it only if pipeline fix needs it, not for new features.
