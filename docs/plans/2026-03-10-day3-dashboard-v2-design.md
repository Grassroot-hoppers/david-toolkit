# Day 3+ Design — Dashboard V2: Real Intelligence Tool

**Date:** 2026-03-10 (end of Day 2)
**Status:** Approved through brainstorming session
**Approach:** Single-page vanilla HTML/CSS/JS, tab-based, one expanded demo.json

## Context

Day 2 delivered the full Bronze → Silver → Gold data pipeline with 24 real POS CSVs and an alpha dashboard. But the alpha is a metrics summary, not an operator's tool. The next phase turns it into something genuinely useful for running a shop.

Three priorities emerged:

1. **Trust the data** — human-in-the-loop cleaning passes for categories, product names, ABCD ranking
2. **Visualize the pipeline** — interactive Bronze → Silver → Gold diagram in the dashboard
3. **Multi-tab real intelligence** — 8 tabs, no gimmick demo text, a tool that helps make daily decisions

## Priority 1: Data Trust Workflow

### Pattern

Every data dimension gets:
1. A **listing script** that dumps raw data in reviewable format
2. A **config file** where corrections live
3. The **pipeline reads the config** and applies corrections at build time

### Categories

- Script: `npm run list:categories` → prints all raw POS category names grouped by current auto-clean mapping
- User reviews, dictates corrections via speech-to-text
- Config: `sample-data/config/category-map.json` — raw name → clean name
- Pipeline applies during `build-demo`

### Product Names

- Script: `npm run list:products` → prints top 200 products by revenue with auto-cleaned name vs raw POS name
- AI first pass: title-case, strip weight prefixes, fix encoding (already partially done)
- User reviews top 200 (~80% of revenue), dictates corrections
- Config: `sample-data/config/product-corrections.json` — overrides keyed by raw name
- Long tail (201-3000) keeps AI-cleaned names unless flagged later

### ABCD Ranking

- Computed by revenue Pareto at build time:
  - **A** = top 20% of cumulative revenue
  - **B** = next 30% of cumulative revenue
  - **C** = next 30%
  - **D** = bottom 20% (candidates to delist)
- Script: `npm run list:ranking` → prints proposed ABCD with revenue per product
- User reviews, overrides where needed
- Config: `sample-data/config/ranking-overrides.json` — product name → forced rank

### Order of Work

Categories first (smallest list, highest dashboard impact), then ABCD ranking (shapes Produits tab), then product names (cosmetic but important for trust).

## Priority 2: Expanded Data Model

One expanded `demo.json` (~1-1.5MB). Single fetch, simple.

```json
{
  "meta": {
    "generatedAt": "ISO timestamp",
    "bronzeFiles": 24,
    "silverFiles": 6,
    "goldFiles": 7,
    "pipeline": { "nodes, edges, sample data for Pipeline tab" }
  },
  "overview": {
    "weeklySignal": {},
    "prediction": { "nextWeek, drivers, confidence" },
    "briefing": { "text, alerts, orderingDay, holidays, weather" },
    "kpis": {}
  },
  "products": [
    {
      "name": "clean name",
      "rawName": "POS name",
      "group": "group key if grouped",
      "category": "clean category",
      "supplier": "clean supplier",
      "rank": "A|B|C|D",
      "revenue2025": 0,
      "revenue2024": 0,
      "growth": 0.0,
      "growthLabel": "en hausse|stable|en baisse",
      "monthlyHistory": ["36 months"],
      "seasonalityPattern": "peak months, dead months",
      "suggestedOrder": { "quantity, basis, periodLabel" }
    }
  ],
  "productGroups": [
    {
      "key": "pommes",
      "displayName": "Pommes",
      "members": ["product names"],
      "aggregateRevenue": 0,
      "seasonality": ["12-month pattern"],
      "rank": "A"
    }
  ],
  "categories": [
    {
      "name": "clean name",
      "revenue": 0,
      "share": 0.0,
      "yoyGrowth": 0.0,
      "productCount": 0,
      "shelfCount": 0,
      "revenuePerShelf": 0,
      "abcdDistribution": { "A": 0, "B": 0, "C": 0, "D": 0 },
      "yearlyHistory": ["4 years"],
      "treeParent": "parent category"
    }
  ],
  "categoryTree": { "hierarchical category structure" },
  "suppliers": [
    {
      "name": "clean name",
      "revenue": 0,
      "productCount": 0,
      "notionUrl": "",
      "topProducts": [],
      "orderingDays": ["lundi", "jeudi"]
    }
  ],
  "trends": {
    "monthlyRevenue": ["2023-01 through 2026-03"],
    "hourlyHeatmap": ["7 days × 14 hours"],
    "seasonality": {}
  },
  "audit": {
    "categoryMap": {},
    "unmappedProducts": [],
    "rankingBreakdown": { "A": 0, "B": 0, "C": 0, "D": 0 }
  }
}
```

Weather stays live (Open-Meteo at page load).

## Priority 3: Tab Architecture

Single HTML page. Tab bar below the top bar (title + weather strip). Each tab is a `<section>` that shows/hides. Dark theme stays.

### Tab 1 — Briefing du jour

Daily operational briefing. Not metrics — intelligence.

**Daily intelligence text** — generated at build time, context-aware:
- What day it is operationally ("Lundi — jour de commande Biofresh, Vajra")
- Upcoming events affecting ordering ("Vacances de Pâques dans 12 jours — anticiper stock frais")
- Weather-aware alerts ("Pluie prévue jeudi-vendredi — historiquement +15% de passage en semaine pluvieuse")
- Peremption awareness ("Produits frais commandés mercredi dernier arrivent à J+5 — vérifier avant de recommander")
- Seasonal signals ("Même semaine 2025: pic de ventes fruits rouges, début saison asperges")

**Context engine** needs:
- Belgian holiday calendar (static config: `holidays-be.json`)
- Supplier ordering days (from `supplier-map.json`, extended)
- Fresh produce shelf life rules (new config: `shelf-life.json`)
- Weather forecast (Open-Meteo, already wired)
- Historical same-period data (from Gold)

**Next-week prediction** — statistical, not ML:
- Same period last year × trend factor × holiday adjustment × weather factor
- Shows predicted revenue range + key drivers ("Why: last year 9,200€, trend +8%, no holidays")
- As the week progresses, shows actual vs predicted

**Performance gauge** — stays but minimal. Small element, not the centerpiece.

### Tab 2 — Produits

Two levels: product groups and individual products.

**Product groups** (new concept):
- Config: `sample-data/config/product-groups.json` — user-defined groupings
- Example: "Pommes" group contains Pomme Jonagold, Pomme Granny Smith, Pomme Pink Lady
- Pipeline aggregates revenue, seasonality, ordering patterns at group level
- Group view: seasonality curve (12-month pattern from 3 years), trend, ABCD rank
- Expand group → individual entries

**Individual products:**
- Performance timeline (mini sparkline: 36 months)
- ABCD rank badge
- Growth trend + seasonality pattern
- **Suggested ordering quantity** for this period — demand-based: "historically ~45 units in week 11, trending +12%, suggest ordering 50"
- Search, filter by rank/category/supplier/group

Ordering suggestion is a reference number, not a command. Bridge to future ordering tool.

### Tab 3 — Catégories

Two dimensions: revenue performance AND physical shelf space.

**Shelf mapping:**
- New manual data: `sample-data/config/shelf-allocation.json`
- How many shelf-meters each category occupies
- User inputs this once, updates when layout changes

**Revenue per shelf** — the killer metric:
- "Pâtes: 4 shelves, 12,000€/year = 3,000€/shelf"
- "Fromage: 2 shelves, 28,000€/year = 14,000€/shelf"
- Instantly shows where space is wasted

**Category tree remapping:**
- Config: `sample-data/config/category-tree.json`
- Actionable hierarchy replacing flat POS categories
- Example: Frais → Fromage, Charcuterie, Produits Laitiers

**Kill/expand signals:**
- Each row: revenue trend, revenue per shelf, product count, ABCD distribution within category
- 4 shelves + declining revenue + mostly C/D products = shrink candidate

### Tab 4 — Fournisseurs (unreviewed)

Supplier cards sorted by revenue. Name, annual revenue, product count, top 3 products, growth trend. Notion links. Design pending user review.

### Tab 5 — Tendances (unreviewed)

Monthly revenue timeline (2023-2026), hourly heatmap, seasonality insights. Design pending user review.

### Tab 6 — Pipeline (unreviewed)

Interactive Bronze → Silver → Gold flow diagram. Click nodes to see sample data. Design pending user review.

### Tab 7 — Données (unreviewed)

Data audit view: category mappings, product name mappings, anomaly flags. The "trust the data" review surface. Design pending user review.

### Tab 8 — À réfléchir

Placeholder. Static list of ideas for future versions.

## New Config Files Needed

| File | Purpose |
|------|---------|
| `sample-data/config/category-map.json` | Raw POS category → clean name |
| `sample-data/config/product-corrections.json` | Product name overrides |
| `sample-data/config/ranking-overrides.json` | ABCD rank overrides |
| `sample-data/config/product-groups.json` | Product group definitions (pommes, etc.) |
| `sample-data/config/shelf-allocation.json` | Shelf-meters per category |
| `sample-data/config/category-tree.json` | Actionable category hierarchy |
| `sample-data/config/holidays-be.json` | Belgian holiday calendar |
| `sample-data/config/shelf-life.json` | Fresh produce shelf life rules |

Existing config files extended:
- `sample-data/config/supplier-map.json` — add `orderingDays` per supplier

## Out of Scope

- Real stock/inventory tracking (POS doesn't support it)
- Backend/server (stays static HTML + JSON)
- User accounts, multi-store
- Tabs 4-7 detailed design (parked until tabs 1-3 are built)
- Interactive data editing in the browser (edits via config + rebuild)

## Implementation Sequence

1. Data trust passes (categories → ABCD → product names)
2. New config files and pipeline extensions
3. Expanded demo.json structure
4. Tab framework (navigation + section switching)
5. Tab 1: Briefing du jour with context engine
6. Tab 2: Produits with groups, timelines, ordering suggestions
7. Tab 3: Catégories with shelf mapping
8. Tabs 4-7: after review
