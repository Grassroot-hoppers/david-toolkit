# Dashboard Coherence Research (Revised)

## Signal Hierarchy (User-Corrected)

1. **NOTION** (strongest) — The real operational system. 23 suppliers, ordering rhythms, product priorities, Cap 2026 financial targets. This is ground truth.
2. **CODEBASE** (solid) — The POS scoring engine, CSS design system, and build pipeline. Functional but running on synthetic data.
3. **PENCIL PROMPT** (weakest) — Written without checking Notion. Useful as a layout sketch but its data examples are wrong. Must be rewritten against Notion reality.

## Locked Decisions

- **Data pipeline**: Build-time. `npm run build:data` calls all APIs, bakes everything into `demo.json`. Runs **once in the morning** — one fresh snapshot for the day.
- **Weather**: Open-Meteo API at build time. Free, no key. Brussels 50.85N/4.35E. 7-day daily forecast (temperature, weather code, precipitation).
- **Tasks**: Todoist REST API (`@doist/todoist-api-typescript`) at build time. Workspace is **"Chez Julien"** (not personal). Pull **all tasks due today**. Todoist MCP for design-time only.
- **Notion scope**: All 23 suppliers + ordering rhythm + Cap 2026 performance zones + monthly CA targets. Not full operational (no SOPs, no checklists — those stay in Notion/iPad).
- **Suppliers**: All 23. No subset. Extract from Notion fiches and bake into `suppliers.json`.
- **Performance zones drive ordering**: The zone color is not decorative — it is the **ordering confidence signal**. Bleu = "commandez en confiance." Orange = "réduisez les quantités." This is the core logic of the dashboard.
- **Pencil prompt**: Rewrite from scratch. The old prompt is discarded.

---

## What Notion Actually Contains (Deep Read)

### Workspace Structure

```
ACCUEIL CHEZ JULIEN
  +-- Operations Quotidiennes (checklists ouverture/fermeture)
  +-- Fournisseurs & Commandes (23 suppliers + Planning DB)
  +-- Procedures SOPs (15+ standard procedures)
  +-- Recettes & Produits
  +-- Gestion & Finances (Cap 2026, Fygr, tresorerie)
  +-- Equipe (reunions, onboarding)
```

### The 23 Real Suppliers (by category)

- **Fromages & Cremerie**: FROM UN, JUMI, GROS CHENE, LALERO, SEGARATI
- **Charcuterie & Viandes**: SCHIETSE, COPROSAIN, LALERO
- **Produits Italiens**: TERRA, DI SANTO, PASTA MOBIL
- **Vins & Boissons**: HOMAVINUM, WINE NOT
- **Bio & Epicerie**: INTERBIO, VAJRA, DELIBIO, TERROIRSIT, MARMA
- **Pains frais**: SEMINIBUS
- **Gourmandises**: ANKORSTORE, CONFISERIE GOURMANDE, LE GATEAU SUR LA CERISE

**Top 5 by CA**: INTERBIO (121,753 EUR), FROM UN (76,754 EUR), LALERO (33,206 EUR), COPROSAIN (29,221 EUR), TERRA (25,400 EUR)

### Supplier Ordering Data (from Notion fiches)

Each supplier fiche contains:

- **Ordering method**: webshop URL, email, phone
- **Ordering cadence**: specific day of week + delivery day
- **Product list**: with priority tiers (A = never out of stock, B = normal, C = minimal)
- **Stock minimums**: per product
- **Seasonal calendar**: what's available when (e.g. INTERBIO has full month-by-month F&L calendar)

Known cadences from fiches read:

- SCHIETSE: order Tuesday, delivery Thursday, via webshop.schietse.com
- INTERBIO: J+1 if before noon, via shop.interbio.be
- LALERO: order by Saturday night, via email to veronique@lalero.be
- (remaining 20 suppliers: cadence needs to be extracted from their Notion fiches)

### Cap 2026 — Tableau de Bord (Financial Framework)

**Weekly CA Performance Zones:**

- Rouge (< 7,500 EUR): Cash burn — total alert
- Orange (7,500-9,000 EUR): Break-even — critical zone
- Vert (9,000-10,500 EUR): Healthy — sustainable
- Bleu (> 10,500 EUR): Ideal — profits reinvestable

**Monthly Targets (TTC):**

- Jan: 35,500 | Feb: 39,500 | Mar: 43,500 | Apr: 45,000
- May: 43,000 | Jun: 40,500 | Jul: 31,500 | Aug: 27,000
- Sep: 39,500 | Oct: 43,500 | Nov: 48,500 | Dec: 66,500
- **Annual target: ~504,000 EUR**

**Fixed Charges**: ~12,200 EUR/month
**Treasury Floor**: Never below 12,000 EUR (2 weeks of fixed charges)

**Action Plans** (built into Notion):

- 2 consecutive orange weeks: analyze causes, check stock, review orders, identify promos
- Treasury < 12K: 3 escalation levels (delay invoices -> reduce orders -> adjust staff hours)

### Planning de Commandes Fournisseurs (Database Schema)

Fields: Commande (title), Fournisseur (select), Date de commande, Date de livraison prevue, Statut (En attente / Commande / En cours de livraison / Livre / Annule), Priorite (Basse / Moyenne / Haute / Urgente), Montant HT, Numero de bon de commande, Bon de commande (URL), Responsable, Contact fournisseur

Views: Table (sorted by order date desc), Board (grouped by supplier), Calendar (by delivery date)

---

## What the Current Code Has vs What It Needs

### The Build Pipeline Today

```
sample-data/raw/*.csv     -->  parsers (semicolon, latin1, decimal commas)
sample-data/config/        -->  context.json (5 fake suppliers, manual weather)
                               product-corrections.json (aliases, categories)
scripts/build-data.mjs     -->  scoring engine (demand, stockout, confidence)
public/data/demo.json      -->  static HTML/CSS/JS dashboard
```

### What Must Change

**`context.json` must be replaced/expanded:**

- Current: 5 synthetic suppliers with orderDay/cutoff/deliveryDay
- Needed: 23 real suppliers from Notion with ordering method, cadence, product priorities, Notion page URLs
- Source: Extract from Notion fiches at build time, or maintain a `suppliers.json` seeded from Notion

**Weather must become live:**

- Current: manual entry in `context.json` (headline, temperatureC, condition)
- Needed: Open-Meteo API call at build time
- Endpoint: `https://api.open-meteo.com/v1/forecast?latitude=50.85&longitude=4.35&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max&timezone=Europe/Brussels`
- Returns: 7-day forecast with weather codes (WMO standard) that map to sun/cloud/rain icons

**Tasks must come from Todoist:**

- Current: none
- Needed: Todoist REST API call at build time
- SDK: `@doist/todoist-api-typescript`
- Auth: Bearer token (TODOIST_API_TOKEN env var)
- Workspace: "Chez Julien" (not personal)
- Filter: all tasks due today — no project/label filtering needed
- At design time: Todoist MCP at `https://ai.todoist.net/mcp` for pulling real tasks into Pencil mockups

**Financial framework must be added — and it drives ordering:**

- Current: single `kpis.revenue2025` number
- Needed: Cap 2026 performance zones, current week zone color, monthly target, year-over-year delta
- The zone color becomes the **ordering confidence signal** — this is the dashboard's core output
- Source: Hardcode zones in config (they're stable business rules from Cap 2026)
- Zone thresholds: rouge < 7.5K, orange 7.5-9K, vert 9-10.5K, bleu > 10.5K (weekly TTC)
- Monthly targets: bake into config from Cap 2026 page

### What Stays the Same

- The POS CSV parsing and product scoring engine — this is sound
- The build-time -> static HTML pattern — confirmed by user
- The `product-corrections.json` human override layer

### What Gets Replaced: The Design System

The current warm/artisanal palette (cream #f4ead8, beige panels, Fraunces serif, gold accents) was designed for a "founder-grade" aesthetic. **This is being reconsidered.**

The real users are a team of 26-27 year olds running the shop day-to-day. They want something **modern, cool, high-impact** — not cozy artisanal. The design direction needs brainstorming (separate from this research doc), but the constraint is clear: the beige/cream look is out. The new design should feel like a tool young operators are proud to open every morning.

---

## The Pencil Prompt: What's Wrong and What's Right

### What the prompt got right (keep as structure, not style)

- 3-zone layout: Context -> Tasks -> Pulse
- 1440x900 no-scroll constraint
- "Chez Julien" header with date
- Weather strip concept (6 days)
- Sales signal banner as the key weekly insight
- Supplier order cards with "Ouvrir fiche Notion" links
- Task checklist from Todoist
- 3 KPI cards for weekly pulse (last week, same week 2025, forecast)

(The warm artisanal design system is **not** kept — replaced by a modern direction. See "Design Direction" section below.)

### Why the old prompt is discarded

It was written without checking Notion. The 3 hardcoded suppliers, the generic task list, the missing financial framework — all wrong. The layout intuitions (3 zones, weather strip, no-scroll) were reasonable, but the data and logic were invented. A new prompt must be grounded in the real Notion data and the ordering-confidence model.

### The Core Logic the Dashboard Must Express

This is the central insight: **the performance zone determines ordering confidence**.

```
Last week's CA (from POS)
         |
         v
Performance zone (rouge / orange / vert / bleu)
         |
         v
Ordering confidence signal for THIS week
  - Bleu (>10.5K): "Semaine forte. Commandez en confiance."
  - Vert (9-10.5K): "Semaine saine. Commandes normales."
  - Orange (7.5-9K): "Zone critique. Reduisez les quantites."
  - Rouge (<7.5K): "Alerte. Commandez le strict minimum."
         |
         v
Today's supplier order cards (filtered by cadence)
  - Which suppliers have their order day today?
  - Each card links to the Notion fiche
  - The ordering signal applies to ALL of today's orders
         |
         v
"Ouvrir fiche Notion" --> the owner acts
```

The dashboard answers one question: **"Should I order big or small this week, and who do I order from today?"**

### Revised Dashboard Concept (for new Pencil prompt)

- **Header**: "Chez Julien — [date, French]" + zone badge (colored dot + zone name)
- **Zone 1 — SIGNAL DE LA SEMAINE**: The ordering confidence signal. Big, impossible to miss. Zone color as background tint. One sentence: "Semaine forte. Commandez en confiance." Below: weather strip (6 days, Open-Meteo), calendar line (vacances, jours feries), year-over-year delta.
- **Zone 2A — COMMANDES DU JOUR**: Suppliers whose order day is today. Each card: supplier name, category, ordering method, link to Notion fiche. If no orders today: "Pas de commandes aujourd'hui." The zone color from Zone 1 tints these cards too — visual reminder of the confidence level.
- **Zone 2B — TACHES DU JOUR**: All Todoist tasks due today from the "Chez Julien" workspace. Compact rows with checkboxes.
- **Zone 3 — LE POULS**: 3 KPI cards — last week (with zone badge), same week 2025, monthly target pace. Plus fixed charges reminder if treasury is near floor.

---

## Data Flow Diagram

```
At build time (npm run build:data):

  Open-Meteo API -----> weather forecast (7 days)
  Todoist REST API ---> today's tasks
  Notion MCP/API -----> (future: live supplier data)
  POS CSV exports ----> product scoring engine
  context.json -------> supplier cadences, store config
  Cap 2026 config ----> performance zones, monthly targets
       |
       v
  build-data.mjs --> demo.json --> static HTML dashboard
```

---

## Demo Context

The demo is based on **Tuesday March 10, 2026** — the data from the original prompt is reusable:

- Last week CA: ~12,000 EUR (Bleu zone — ideal)
- Same week 2025: ~10,500 EUR
- Year-over-year: +14%
- Weather: Brussels mid-March (eclaircies, 15-17C)
- Calendar: no school holidays, no public holidays, spring in 10 days
- Tuesday is an order day for SCHIETSE (charcuterie, webshop)

Supplier cadences for the remaining 20 suppliers will be provided later today. Last week's actual CA will come when the excels are imported — for the demo, the 12K figure from the existing context is sufficient.

---

## Resolved Questions

1. **Suppliers**: All 23. Extract from Notion, bake into `suppliers.json`. No subset.
2. **Todoist**: "Chez Julien" workspace. All tasks due today. No project/label filter.
3. **Build frequency**: Once in the morning. One snapshot for the day.
4. **Pencil prompt**: Rewrite from scratch. Old prompt is discarded.
5. **Performance zones**: They drive ordering confidence. Zone thresholds are stable business rules from Cap 2026.
6. **Supplier cadences**: Coming later today. Don't block on it.
7. **Last week's CA**: Use demo data (12K) for now. Real data comes with excel import.

## Design Direction (To Be Brainstormed)

The current warm/artisanal palette (cream, beige, gold, Fraunces serif) is **out**.

**Who uses this dashboard**: A team of 26-27 year olds running a specialty food shop in Brussels. They open this every morning before the shop opens.

**What they want**: Modern. Cool. High impact. Less "beautiful," more "wow." Something they're proud to pull up — not something that looks like their grandma's recipe book.

**What this means for the design**: The entire CSS design system needs to be reconsidered. Fonts, colors, layout density, visual language — all open. The structural layout (3 zones, no-scroll, ordering-confidence logic) stays. The skin changes completely.

**Next step**: Brainstorm 2-3 design directions, pick one, then write the new Pencil prompt grounded in both the Notion data model and the chosen visual direction.

---

## Next Step

Read this. If the research is complete and the ordering-confidence logic is right, we move to brainstorming the design direction — then write the new prompt.
