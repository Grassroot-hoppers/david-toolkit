# Alpha Dashboard Design — Honest Big Picture

**Date:** 2026-03-10
**Goal:** Ship a useful alpha of the Pencil V2 dark dashboard today, fed with real data from the POS pipeline.

## Context

The data pipeline works (24 CSVs → Silver → Gold → demo.json). The Pencil V2 dark dashboard (`demo/`) is a beautiful static shell. But the data feeding it is broken: scoring is based on non-existent stock data, categories are polluted, product names are raw POS caps, suppliers are unmapped, and the trend chart is empty.

**Critical fact:** Stock was never implemented in the POS. The STOCK field = cumulative sold units (initial 0, -41 = sold 41). It must never be used.

## Design Decisions

### Reframe: intelligence tool, not ordering tool

The dashboard becomes a **big picture intelligence tool** for the team:
- "How is the shop doing this week vs last year?"
- "Which categories are growing or shrinking?"
- "Which products are moving fastest?"
- "Which suppliers matter most?"

Ordering support comes later when real inventory data exists.

### Scoring: growth-based, not stock-based

Replace order/watch/skip with honest growth classification:
- **en hausse**: YoY revenue growth > 10%, or strong recent momentum
- **stable**: YoY within -10% to +10%
- **en baisse**: YoY revenue decline > 10%

No stock cover. No stockout suspicion. No demand pressure (requires inventory baseline).

### Categories: clean the 149 → ~15

1. Strip "XX. " numbering prefix
2. Strip VAT rate suffixes (" 0%", " 6%", " 21%")
3. Merge same-name categories (sum revenue + product count)
4. Filter out "DIV. EAN *", "Fictif", "CARTE CADEAUX", "(uncategorized)"
5. Title case: "FRUIT ET LEGUME" → "Fruits et Légumes"

### Product names: auto title-case

- "MAYONNAISE BIO 310GR" → "Mayonnaise Bio 310gr"
- Strip weight prefixes: "(00106g/34,68€Kg)FILET..." → "Filet..."
- Use hand-corrected displayName when it exists (14 products in corrections.json)

### Supplier names: normalize 85 → ~40

Build `sample-data/config/supplier-map.json`:
- Dedup typos: TERROIRIST/TERROIRSIT/TERROIRISTE → "Terroirist"
- ANKORSTORE/ANKORESTORE/ANKOR STORE/ANKORESTRORE/ANKOSTORE/ANKHORESTORE → "Ankorstore"
- VAJRA/VARJA → "Vajra"
- SCHIETSE/SCHIETZE → "Schietse"
- CONFISERIE/CONFISERIE GOURMANDE/CONFISERIE GOURANDE → "Confiserie Gourmande"
- BIONATURELS/BIONATUREL → "Bionaturels"
- HOMAVINUM/HOMA VINUM → "Homa Vinum"
- THE FOOD HUB/FOOD HUB → "The Food Hub"
- Keep all others as title-cased POS names
- Include Notion page URL per supplier when available
- Rank by total annual revenue

### Weekly metrics from daily-sales.json

Compute at build time:
- Last full week revenue (Mon–Sat)
- Same calendar week last year
- Week-over-week % change
- Year-over-year % change for same week
- Month-to-date vs same period last year
- Performance zone: Rouge (<7500) / Orange (7500-9000) / Vert (9000-10500) / Bleu (>10500)

### Monthly timeline

Aggregate daily-sales.json into monthly totals for 2023–2026, populating `macro.timeline` for the trend chart.

### Weather: Open-Meteo API

Fetch at page load in app.js:
- Endpoint: `https://api.open-meteo.com/v1/forecast?latitude=50.85&longitude=4.35&daily=temperature_2m_max,weathercode&timezone=Europe/Brussels`
- Brussels coordinates (50.85°N, 4.35°E)
- 7-day forecast → populate weather strip cards
- Map WMO weather codes to icons and French descriptions
- No API key needed, free tier sufficient

### Notion links for suppliers

Add `notionUrl` field to supplier-map.json. The "Ouvrir fiche Notion →" button opens the real Notion page. For suppliers without a Notion page, button is hidden or disabled.

## Dashboard Layout (Pencil V2 Dark)

### Top bar
- Title: "Tableau de Pilotage"
- Weather strip: 6 cards with real forecast from Open-Meteo

### Middle-left: Signal de la semaine
- **Headline**: Computed from weekly YoY ("Semaine forte", "Semaine stable", "Semaine sous pression")
- **Stats row**: Real YoY %, month target pace
- **Context**: Calendar info from context.json

### Middle-left: 3 KPI cards
1. **Semaine dernière**: Real weekly revenue + zone badge + YoY %
2. **Même semaine 2025**: Same calendar week last year as reference
3. **Objectif mensuel**: Month-to-date, projected total, charges fixes

### Middle-right: Commandes du jour
- Top 3 suppliers by annual revenue, filtered to those due for ordering today (by day of week)
- Real POS supplier names, cleaned
- Annual revenue context: "#1 fournisseur (121K€/an)"
- "Ouvrir fiche Notion →" links to real Notion page

### Bottom-left: Top Catégories (replaces Tâches du jour)
- Top 8–10 categories by revenue share
- Each row: clean name, share %, YoY change indicator
- Uses task-row styling pattern

### Bottom-right: Performance zones gauge
- Real weekly revenue, marker position computed
- Zone thresholds: 7500 / 9000 / 10500

### Roadmap screen
- Keep as-is (static). Useful reference, not data-driven for alpha.

## Files Changed

| File | Change |
|------|--------|
| `scripts/build-demo.mjs` | New scoring, category cleanup, product names, supplier normalization, weekly metrics, monthly timeline |
| `sample-data/config/supplier-map.json` | **New**: POS famille → normalized name + Notion URL |
| `demo/app.js` | Load demo.json + Open-Meteo API, populate all dashboard elements |
| `demo/index.html` | Add id attributes for data binding, swap tasks section for categories |
| `demo/styles.css` | Style categories list (reuse task-row pattern) |

## Out of Scope (Alpha)

- Inventory / stock-based ordering (no stock data exists)
- Product detail drill-down page
- Dynamic tasks from Notion (future feature)
- Editable supplier cards
- Backend / server — stays as static HTML + JSON
