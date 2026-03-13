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
