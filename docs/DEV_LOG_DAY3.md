# Day 3 — The Data Tells The Truth

**Date:** 2026-03-11, Wednesday

#### Shipped today

* Shop narrative validation — 45 minutes of Q&A proving the AI understands the business context
* Master Config layer — a new editorial layer between Bronze and Silver for human-declared corrections
* Full pipeline ran end-to-end for the first time: all 24 CSVs → 21 Silver files → 7 Gold files → demo.json
* Revenue discrepancy resolved: €207K (wrong) → €501K (real) for 2025
* Category count collapsed: 149 POS entries → 26 clean categories
* 22 automated verification checks passing
* Dashboard V2 built and deployed — Tab 1 Briefing + Tab 2 Produits + stubs for 5 future tabs
* 3 implementation plans written for Day 4: data validation, transaction-first pipeline, dashboard V2 build
* Workflow discovery: Perplexity deep research between brainstorming and plan execution dramatically improves output quality

Day 3 was supposed to be about trusting the data. It was — but it was also about losing half a day to distractions, being sick, and then grinding until 21h to make up for it.

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
- Hourly peak between 9h and 19h (confirms normal trading hours)
- Revenue floor > €300K per year (catches the annual-stats-only bug)
- No duplicate SKUs in product catalog
- No junk categories (DIV. EAN, Fictif) in category-evolution
- FRAIS share < 5% for 2024+ (confirms POS reorganisation took effect)

All 22 checks pass. These aren't just tests — they're executable documentation of what the shop's data is supposed to look like.

---

### Dashboard V2: built in the evening session

The afternoon was supposed to be about the dashboard. Instead, it got eaten (more on that below). So the V2 build happened in the evening grind session, from the plans written during the day.

**Three plans came together:**

1. **Data validation plan** — structured checklist for closing the open pipeline items (FRAIS redistribution, category YoY, 2024 margins)
2. **Transaction-first pipeline plan** — how to simplify ongoing 2026 data refreshes from 7 CSV types down to 1 (transaction lines only, with product-master and margin-analysis as periodic enrichment)
3. **Dashboard V2 build plan** — 1,253 lines of detailed implementation across 7 phases: config files, build-demo expansion, tab framework, Tab 1 briefing, Tab 2 products, stub tabs, polish

The V2 dashboard build followed the plan task-by-task:

**Config layer** — `product-groups.json` seeded with 10 keyword-matched product groups (pommes, tomates, fromages, oeufs, pâtes, huiles, confitures, chocolats, biscuits, vins). Supplier ordering days added to `supplier-map.json`.

**Build-demo expansion** — ABCD Pareto ranking applied to all products (top 20% cumulative revenue = A, next 30% = B, next 30% = C, bottom 20% = D). 36-month revenue history attached per product for sparklines. Ordering suggestions computed for A+B products. Hourly heatmap piped through to the payload.

**Tab framework** — `public/index.html` + `public/styles.css` + `public/app.js`. Dark theme, Inter + DM Mono fonts, 7-tab navigation bar. Tab switching, data fetch at page load.

**Tab 1: Briefing du jour** — date context card, weekly performance gauge with YoY zone colouring (verte/bleue/rouge), next-week revenue prediction, ordering reminders by day of week, Open-Meteo weather integration with rain signal.

**Tab 2: Produits** — 150 products with ABCD badges, inline SVG sparklines (36 months), growth arrows, category and rank filters, live search. Product groups accordion at the top with 12-month seasonality bar charts. Ordering suggestions on A/B products.

**Tabs 3–7** — polished stubs with real data previews: Catégories, Fournisseurs, Tendances, Pipeline de données, Données.

**Repo cleanup** — POS vendor documentation removed from the repo (proprietary content that should never have been committed). References sanitized for public readability.

---

### The lost afternoon: three lessons

Day 3 had a chunk ripped out of the middle. Three things happened that weren't on the plan.

**1. Email sorting with Claude co-work** — spent a significant block trying to use Claude's collaborative mode to sort through a backlog of emails. The results were poor. The AI couldn't maintain context across email threads, kept losing the classification logic, and the manual overhead of correcting it was higher than just doing it myself. Low-value experiment that should have been abandoned after 15 minutes.

**2. OpenClaw bot attempt** — tried to build an OpenClaw bot. Went nowhere. Another rabbit hole that consumed time for zero output. The pattern: interesting-sounding side project + illness-lowered judgment = wasted hours.

**3. Being deeply sick while the shop performs well** — the shop is doing well and needs attention. Being ill makes every context switch between shop operations and hackathon work twice as expensive. The combination of fever-brain and ambitious side experiments is how you lose an afternoon.

The fix was simple and painful: work until 21h. The evening session produced the entire Dashboard V2, all three implementation plans, and the repo cleanup. Productivity under pressure was higher than the scattered afternoon — because the scope was locked and the plan was written.

---

### Workflow discovery: Perplexity as a research layer

The most valuable process insight of the day: **inserting a Perplexity deep research pass between writing plans and executing them dramatically improves the quality of both.**

The workflow that emerged:

1. **Brainstorm** (Cursor + superpowers brainstorming skill) → rough shape of what we want
2. **Perplexity deep research** → real-world patterns, architecture precedents, edge cases we hadn't considered
3. **Write plan** (Cursor + writing-plans skill) → now grounded in both our codebase and external knowledge
4. **Execute plan** (Cursor + executing-plans skill) → confidence is higher, fewer mid-execution pivots

The Perplexity step caught things the AI wouldn't have surfaced on its own — the Medallion Architecture pattern for the data pipeline came from this kind of research pass on Day 2. Today, the transaction-first pipeline simplification was shaped by researching how POS data pipelines work in practice.

**Next step:** create a dedicated skill that generates an optimal Perplexity deep research prompt for a given planning context. The skill would take the brainstorm output + codebase context and produce a targeted research query that maximizes the value of the Perplexity pass. This turns a manual "go search for a while" step into a structured part of the pipeline.

---

### Experiment queued: GitHub agentic workflow for overnight code quality

Another idea that emerged today: **use GitHub's agentic CI workflow to scrub the codebase overnight.** The concept: push the day's work before bed, let an automated agent review the code for consistency, dead code, naming issues, test gaps, and structural problems. Wake up to a PR with improvements.

This is the Day 4 experiment. If it works, it means every morning starts with a cleaner codebase than you left the night before — compounding quality without consuming daytime attention.

---

### What's still in flight

**1. 2024 margin export**
The margin analysis CSVs only go back to 2025. The POS can re-export historical margin data. Dropping `margin-analysis-2024.csv` into `data/real/` and running `npm run build:full` should pick it up automatically.

**2. FRAIS redistribution in Gold**
The Master Config cross-reference runs during Silver import, but FRAIS is an aggregated category in category-mix — there's no product-level join to make at Silver time. The redistribution needs to happen in Gold: use 2023 monthly-stats subcategory ratios to proportionally split the €87K FRAIS bucket in category-evolution.

**3. Category YoY calculations (showing 0%)**
Category-mix exports duplicate each category across VAT rates. The current YoY computation matches on exact category+VAT key rather than on normalized category name. Needs investigation in `build-gold.mjs`.

**4. Transaction-first pipeline**
Plan is written. Implementation simplifies ongoing 2026 refreshes from 7 CSV types to 1.

---

## Decisions

- **Master Config is permanent.** Not a workaround — it's the canonical place for human-declared corrections. Every future data dimension (product grouping, shelf allocation, holiday calendar) will have a corresponding config file.
- **Revenue source priority cascade is the right fix.** Annual-stats is not a reliable revenue source for this shop. Monthly-stats is the canonical revenue reference until proven otherwise.
- **Validation sessions come before implementation.** The morning Q&A produced better work items than any planning doc would have. The AI's blind spots become the task list.
- **Verification assertions are part of the pipeline.** Not optional, not a nice-to-have. If the business logic fails, the build fails.
- **FRAIS redistribution deferred to Gold.** Doing it in Silver would require product-name heuristics operating on aggregated data — fragile. Gold has the right inputs (monthly-stats subcategory ratios) to do it cleanly.
- **Perplexity deep research is now part of the planning workflow.** Not optional — the quality delta is too large to skip.
- **Side experiments get 15 minutes, then a kill decision.** The email sorting and OpenClaw bot would have been fine as 15-minute spikes. They became problems because the kill decision wasn't made.

## Day 3 by the numbers

| Metric | Count |
|--------|-------|
| Commits | 18 |
| Silver files generated | 21 |
| Gold files generated | 7 |
| Verification checks | 22 (all passing) |
| Revenue correction | €207K → €501K |
| Categories collapsed | 149 → 26 |
| Dashboard V2 tabs built | 2 live + 5 stubs |
| Implementation plans written | 3 (~1,660 lines total) |
| Hours lost to distractions | ~3 |
| Hours worked to compensate | until 21h |

## What's next (Day 4)

**Main focus:** Tab 1 and Tab 2 to MVP quality. Plan: `docs/plans/2026-03-12-day4-next-steps-plan.md`.

- **Correct** — Fix data binding and logic (demo.json shape vs Tab 1/Tab 2, prediction week, group member match, suggested order display).
- **Good** — Viewport and layout (responsive briefing grid, product list at 1024px), empty and error states.
- **Usable** — Labels, tooltips, no console errors, basic a11y.

Out of scope for Day 4: Tabs 3–7, new features, transaction-first pipeline. Estimate: 2–4 hours.

**Backlog (other plans):** Data validation (FRAIS, category YoY), transaction-first pipeline (7 → 1 CSV), full dashboard V2 polish. Experiment: GitHub agentic overnight code review.

**Personal:** Rest. Focused and bounded — not scatter-then-grind.
