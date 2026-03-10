# Architecture

## Shape

David Toolkit is a static browser app backed by a three-stage local build pipeline.

```text
data/real/*.csv  (real POS exports, gitignored)
        ↓
scripts/import-silver.mjs  (detect, decode, normalize per file type)
        ↓
data/silver/*.json  (clean per-type, per-year JSON — gitignored)
        ↓
scripts/build-gold.mjs  (aggregate, enrich, cross-reference)
        ↓
data/gold/*.json  (dashboard-ready aggregates — gitignored)
        ↓
scripts/build-demo.mjs  (score, rank, assemble)
        ↓
demo/data/demo.json
        ↓
public/index.html + app.js + styles.css
```

Gold data is required. If missing, `build-demo.mjs` exits with instructions to run the full pipeline.

## Pipeline Commands

```bash
npm run import       # Bronze → Silver: detect and normalize CSVs from data/real/
npm run build:gold   # Silver → Gold: aggregate into dashboard-ready files
npm run build:demo   # Gold → demo.json: score products, assemble payload
npm run build:full   # All three steps in sequence
npm run test         # Full pipeline + verify assertions
```

## Pipeline Stages

### Bronze: Raw CSV exports (`data/real/`)

24 CSV files from the POS system. Mixed encodings (CP1252, UTF-8). Semicolon-delimited. European decimal commas. 7 different file types auto-detected by header fingerprint.

### Silver: Normalized JSON (`data/silver/`)

One JSON file per type per year. Clean, structured, typed. Produced by `import-silver.mjs` which routes each CSV through a type-specific importer.

| File type | Importer | Output |
|-----------|----------|--------|
| `monthly-stats` | `importers/monthly-stats.mjs` | `monthly-stats-YYYY.json` |
| `annual-stats` | `importers/annual-stats.mjs` | `annual-stats-YYYY.json` |
| `transactions` | `importers/transactions.mjs` | `transactions-YYYY.json` |
| `category-mix` | `importers/category-mix.mjs` | `category-mix-YYYY.json` |
| `margin-analysis` | `importers/margins.mjs` | `margins-YYYY.json` |
| `hourly-by-weekday` | `importers/hourly-patterns.mjs` | `hourly-patterns-YYYY.json` |
| `product-master` | `importers/product-master.mjs` | `products.json` |

Shared utilities live in `scripts/lib/csv-utils.mjs` (encoding detection, number parsing, name normalization, file type detection).

### Gold: Dashboard-ready aggregates (`data/gold/`)

Cross-referenced, enriched files built from Silver by `build-gold.mjs`:

| File | Contents |
|------|----------|
| `product-catalog.json` | Canonical product list with lifecycle, margins, multi-year stats |
| `daily-sales.json` | One row per calendar day with revenue, basket size, payment mix |
| `monthly-product-stats.json` | Per-product monthly time series across all years |
| `category-evolution.json` | Category revenue/share trends over time |
| `hourly-heatmap.json` | Revenue by day-of-week × hour |
| `margin-ranking.json` | Products ranked by margin contribution |
| `store-summary.json` | Per-year totals, data coverage, date range |

### Demo: Scored payload (`demo/data/demo.json`)

`build-demo.mjs` reads Gold, applies the scoring engine (demand pressure, stock cover, weather sensitivity, YoY change), and produces the final dashboard payload.

## Why This Shape

- Easy for outsiders to run (sample data works out of the box)
- Works on static hosting
- Keeps private imports local and gitignored
- Makes the evidence pipeline inspectable at every stage
- Each stage produces readable intermediate files
- Silver is reusable for future dashboards and analysis
- Gold is dashboard-ready without re-processing raw data

## Subsystems

### Correction layer

`sample-data/config/product-corrections.json` is the human override layer. It fixes aliases, supplier mapping, category cleanup, weather sensitivity, perishability, and substitute groups.

### Interpretation layer

The app never mutates raw evidence invisibly. Every insight card carries raw evidence, interpreted claim, confidence score, and rationale tags.

### Front-end

Plain HTML/CSS/JS. The product surface is locale-aware. Operator-facing copy can be switched through config while repository docs stay in English.

Sections: overview, context, supplier command center, category pressure, product movers, raw vs interpreted evidence, macro health.
