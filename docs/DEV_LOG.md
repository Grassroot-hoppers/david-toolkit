# David Toolkit Dev Log

This log records what I do, what I decide, and why I decide it while building David Toolkit.

## 2026-03-09 - Day 1, hackathon kickoff

My laptop is in the sun. It is a beautiful day today, so I want to mix a phone-based Cursor/agent workflow with Cursor on the web and Codecks on my MacBook Pro.

I am starting this session by asking for a roadmap based on the spec that was already written instead of jumping straight into implementation.

### Why this decision

- Day 1 should start from the existing spec, not from improvisation.
- A roadmap request is the fastest way to turn the pre-done thinking into an execution sequence.
- It also tests the real working style I want for this hackathon: phone + cloud agent + laptop review loop.

### What this means for the build

- The spec remains the source of truth.
- The roadmap becomes the operating sequence.
- Implementation should follow narrow, reviewable steps rather than broad hacking.

## 2026-03-09 - Day 1, brainstorm: what this hackathon is really about

Today is not about trying to build the final product in one leap. It is about turning the existing spec, POS context, and messy high-context notes into a working execution loop.

The core decision is to treat this hackathon as the creation of a serious `v0.1` intelligence demo first, not an "AI ordering engine" yet.

### What the hackathon is

- Build a browser-first intelligence center that can ingest real-shop shaped exports.
- Preserve the raw-vs-interpreted contract so the software stays trustworthy.
- Make the repo contributor-ready early, not only after the demo is pretty.
- Use Cursor, phone, and laptop together as part of the product-building workflow, not as a side experiment.

### What today is for

- Re-anchor on the existing roadmap and architecture.
- Decide the smallest believable day-one scope.
- Set up the operating rhythm: spec -> roadmap -> narrow task -> test -> log.
- Choose the next concrete work items that make the demo more real without widening scope too early.

### What not to do today

- Do not drift into production architecture.
- Do not pretend this is already a live ordering assistant.
- Do not widen into multi-store, auth, or heavy infrastructure.
- Do not lose the founder narrative under technical noise.

## 2026-03-09 - Day 1, end of day: what actually got done

A lot happened for a Day 1. The plan was to set up the operating rhythm and ground everything in reality. That happened — and then some.

### What happened

**Repo bootstrap**

Initial demo committed. AGENTS.md, phone-agent workflow docs, cloud agent starter skill, French operator-facing product copy, issue backlog. The repo went from nothing to contributor-ready scaffolding.

**POS Anatomy Source of Truth (dedicated branch: `pos-anatomy-source-of-truth`)**

Biggest chunk of work. Studied the POS system documentation and built a canonical registry of everything we know (and don't know) about the POS — what it tracks, what it exports, what's still unverified.

Five commits, TDD-style with a dedicated verifier (`scripts/verify-pos-anatomy.mjs`):

1. **Canonical registry** — `sample-data/config/pos-anatomy.json` with governance rules, precedence order (live evidence > documentation > older notes)
2. **Source index + report families** — 8 report families (category stats, daily closure, CA/TVA, evolutionary stats, stock movements, client segments, product listings, client listings)
3. **Core entities + workflows + companion guide** — 6 entities (product, supplier, client, sale-ticket, stock-movement, assisted-order) and 5 operator workflows (scan-sell-pay, return, standby, stock-entry, assisted-ordering). Companion doc at `docs/research/microconcept-pos-anatomy.md`
4. **Phase gate + live evidence protocol** — 5 explicit unknowns that need live export verification. Phase 2 is blocked until we capture one real `44A` CSV export
5. **Data intake structure + 3-year export SOP** — how exports get captured and stored going forward

The key decision: **no app wiring until we have one real export that proves the schema is not wishful thinking.** The registry distinguishes between "what the documentation says" and "what the POS actually exports."

**Dashboard coherence research**

Deep dive into what Notion actually contains vs what the codebase assumes vs what the old Pencil prompt described. Established a signal hierarchy:

1. Notion (strongest) — the real operational system with 23 suppliers, Cap 2026 financial framework
2. Codebase (solid) — POS scoring engine works but runs on synthetic data
3. Old Pencil prompt (weakest) — written without checking Notion, data examples were wrong

Locked several decisions: build-time data pipeline, Open-Meteo for weather, Todoist for tasks, all 23 suppliers (not a subset), performance zones drive ordering confidence.

**Pencil design exploration**

Researched Pencil (.pen files) as a design-as-code tool. Assessed fit for the David dashboard — strong match for Git-native design, CSS variable sync, and component extraction. Created the first `.pen` file (`davidtoolkit.pen`) and wrote a detailed prompt for the "Tableau de Pilotage" dashboard.

Key design shift: the warm/artisanal cream palette is out. The real users are 26-27 year olds — they want modern, sharp, high-impact. Dark background, clean typography, performance zone colors that pop.

### Decisions made

- **POS anatomy is registry-first, not code-first.** Document what we know, verify against reality, then wire into the app.
- **Performance zones are the core logic.** Rouge/Orange/Vert/Bleu isn't decoration — it's the ordering confidence signal that drives the entire dashboard.
- **Old Pencil prompt is discarded.** A new prompt must be grounded in Notion reality and the chosen visual direction.
- **Phase gate is real.** No `build-data.mjs` changes or UI work until one live export proves the schema.
- **Design direction needs brainstorming.** Structure (3 zones, no-scroll, ordering confidence) stays. The visual skin is open.

### What's next (Day 2)

Tomorrow is the data day. The goal is to go from synthetic demo data to real shop data feeding the dashboard.

- **Export two years of POS data** — pull category stats, CA/TVA, and evolutionary reports from the POS. This is the first time real historical data enters the repo.
- **Clean and normalize the exports** — handle the usual POS export mess: semicolons, Latin-1 encoding, decimal commas, inconsistent date formats. Build or extend parsers as needed.
- **Build the canonical database** — replace the synthetic `demo.json` with a real data pipeline. One canonical source that feeds the HTML dashboard.
- **Wire live data sources** — Open-Meteo for weather, Todoist for daily tasks, Notion for supplier cadences. All at build time.
- **Unblock Phase 2** — the first real `44A` CSV export lifts the phase gate on the POS anatomy registry. Once we see real columns, we can wire the registry into the build.
- **Design direction** — if time allows, brainstorm the new visual direction and write the updated Pencil prompt.

## 2026-03-10 — Day 2: The Data Day

Tuesday, March 10

#### Shipped today

* 24 real POS CSVs exported and inventoried
* Bronze → Silver → Gold data pipeline (21 tasks, 15 commits)
* Data inventory documenting all 7 file types
* Alpha dashboard design — intelligence tool, not ordering tool
* Dashboard wiring with real data (in progress)

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

### What's still on the workbench

The day isn't over. Active work on wiring the alpha dashboard:
- `demo/app.js` rewritten to load real Gold-sourced `demo.json` and Open-Meteo weather
- `demo/index.html` simplified — stripped legacy markup, added data binding points
- Legacy `public/` directory being cleaned out (the old demo shell)
- `build-data.mjs` expanded with category cleanup, supplier normalization, growth scoring

---

### Decisions

- **Phase gate: lifted.** 24 real exports proved the schema. The formats match the documentation. We can wire data into the dashboard with confidence.
- **Bronze → Silver → Gold is the architecture.** Not a temporary hack — this is the canonical data layer for everything that comes after.
- **Stock data is fake.** No stock-based signals until real inventory management exists in the POS. The dashboard is an intelligence tool, not an ordering tool.
- **The scoring reframe is permanent.** Growth-based classification (en hausse / stable / en baisse) is the honest signal. Order/watch/skip comes back only with real inventory.
- **Category and supplier cleanup happens at build time.** Raw POS names go in, clean French display names come out. The cleanup rules live in config, not in the pipeline code.

### What's next (Day 3)

The alpha dashboard should be wired and rendering real data by end of today. Tomorrow's focus shifts to polish and intelligence:

- **Finish the alpha wiring** — if not done tonight, this is the first task
- **Weekly signal engine** — the "Signal de la semaine" headline should be computed, not hardcoded. "Semaine forte" / "Semaine sous pression" based on real YoY comparison
- **Monthly timeline chart** — aggregate daily-sales into monthly totals for the trend visualization (2023–2026)
- **Supplier ordering calendar** — which suppliers are due for orders on which day of the week
- **Weather correlation** — now that we have daily revenue and Open-Meteo, can we see the rain-vs-revenue pattern?
- **Design direction brainstorm** — the visual skin. The structure is locked. The colors, typography, and feel are still open.
