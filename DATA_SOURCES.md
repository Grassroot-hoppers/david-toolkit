# Data Sources

## Raw Files

### `export-stat-vente-2024.csv`
### `export-stat-vente-2025.csv`

Expected shape:

- semicolon-delimited
- one row per article
- category, stock, price, total quantity, total CA, monthly columns

Used for:

- yearly product intelligence
- stock signals
- year-over-year comparisons

### `sta-satvente-2025.csv`

Expected shape:

- article-level recent sales summary

Used for:

- near-term momentum
- supplier command scoring

### `sta-ratioCAT-2025.csv`

Expected shape:

- category totals and shares

Used for:

- category pressure cards
- mix changes

### `analyse-2025.csv`

Expected shape:

- item-level revenue, cost, and margin style columns

Used for:

- margin hotspots
- low-margin warnings

### `chez-julien-finance-demo.xlsx`

Expected sheets:

- `P&L`
- `Datas 2025`
- `Datas 2024`
- `Datas 2023`
- `Datas Budget 2026`
- `Mapping`

Used for:

- 3-year macro context

## Config Files

### `product-corrections.json`

The human cleanup layer. This is the most important file if the raw catalog is messy.

### `context.json`

Defines:

- run date
- weather snapshot
- holiday / calendar signals
- supplier deadlines

## Privacy Standard

Public repos should use sanitized sample data only.

If you run the app on private exports, keep those files outside the repo and do not commit generated artifacts containing sensitive information.

