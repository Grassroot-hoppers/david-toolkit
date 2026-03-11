# Data Inventory

All real POS exports live in `data/real/` (gitignored). This document describes every file, its source, structure, and what analyses it enables.

**POS system:** Legacy Windows POS (Belgian bio food shop)
**Encoding:** CP1252 (semicolon-delimited, European decimal commas)
**Last updated:** 2026-03-10

---

## 1. Monthly Product Stats (ExportStatVente — Module 45A/45B)

**The most valuable files.** Per-product monthly breakdown: quantity + revenue for each of 12 months, plus supplier, stock, prices, category, and origin.

| File | Year | Products | Source |
|------|------|----------|--------|
| `stat-vente-monthly-2023.csv` | 2023 | 3,667 | ExportStatVente_10032026_1251 |
| `stat-vente-monthly-2024.csv` | 2024 | 3,667 | ExportStatVente_10032026_1308 |
| `stat-vente-monthly-2025.csv` | 2025 | 3,667 | ExportStatVente_10032026_1248 |

**Header:**
```
;id;libelle;famille;type;C3;STOCK;IDINTERN;categorie;conditionnement;PRIXACHAT;PRIX;TotQut;Magas;TotCA.;YY_01;YY_02;...;YY_12
```

**Key columns:**

| Column | Meaning | Example |
|--------|---------|---------|
| `id` | Internal product ID or EAN | `5` or `5425010321313` |
| `libelle` | Product name | `BRIE DE MEAUX` |
| `famille` | Supplier | `FROM UN`, `INTERBIO`, `VAJRA`, `COPROSAIN` |
| `type` | Main category | `02. FROMAGE`, `01. FRUIT ET LEGUME` |
| `C3` | Origin/region | `Haute-Savoie`, `Larzac`, `BIO` |
| `STOCK` | Current stock (negative = units sold through) | `-36694` |
| `categorie` | Subcategory | `02. VACHE`, `01. FRUIT` |
| `conditionnement` | Pack/conditioning size | `1`, `6`, `12` |
| `PRIXACHAT` | Purchase price (€/unit) | `12,868` |
| `PRIX` | Sale price (€/unit) | `29,5` |
| `TotQut` | Total quantity for the year | `74910` |
| `TotCA.` | Total revenue for the year (€) | `2207,66` |
| `YY_MM` | Monthly: `quantity  (revenue)` | `7418  (218,88)` |

**Enables:** Monthly seasonality, YoY by month, 3-year trends, supplier analysis, margin calculation, stock health, product lifecycle tracking.

**Note:** The `id` column uses internal sequential IDs in the 2025 file (1248) but EAN codes in 2023/2024 files. Product matching should use `libelle` (normalized) as the join key.

---

## 2. Annual Product Sales (Module 44A — Quté et CA de ventes)

Per-product annual totals: quantity sold + revenue. Simpler than the monthly files but cover 2026 partial data too.

| File | Year | Products | Period |
|------|------|----------|--------|
| `stat-vente-annual-2023.csv` | 2023 | 3,830 | Jan 1 – Dec 31 |
| `stat-vente-annual-2024.csv` | 2024 | 3,028 | Jan 1 – Dec 31 |
| `stat-vente-annual-2025.csv` | 2025 | 2,436 | Jan 1 – Dec 31 |
| `stat-vente-annual-2026-partial.csv` | 2026 | 1,085 | Jan 1 – Mar 8 |

**Header:**
```
ART;QUANTITE;CHIFF_AFF;EAN_MAX_DE_LA_PERIODE;TRI;CAT;CAT
```

**Key columns:**

| Column | Meaning | Example |
|--------|---------|---------|
| `ART` | Product name | `BANANE BIO` |
| `QUANTITE` | Total quantity (possibly grams for weighed items) | `1031293,00` |
| `CHIFF_AFF` | Total revenue (€) | `3414,50` |
| `EAN_MAX_DE_LA_PERIODE` | EAN barcode | `456` or `5407007250066` |
| `CAT` (col 5) | Category + product name concatenated | `01. FRUIT ET LEGUMEBANANE BIO` |
| `CAT` (col 6) | Category only | `01. FRUIT ET LEGUME` |

**Enables:** YoY product ranking, product count by year (assortment evolution), 2026 partial data (not available in monthly files).

**Quirks:**
- Sorted by revenue descending (top sellers first)
- Contains refund rows (`REMB ...`) and deposit returns (`RETOUR VIDANGE`)
- Bottom rows contain summary: `total`, `Nbclient`, `Moyenne par client`
- No supplier, no stock, no prices — use monthly files for those

---

## 3. Category Mix (Module 44A — Tableau de bord)

Revenue breakdown by category + VAT rate.

| File | Year | Categories | Period |
|------|------|-----------|--------|
| `category-mix-2023.csv` | 2023 | 98 | Jan 1 – Dec 31 |
| `category-mix-2024.csv` | 2024 | 86 | Jan 1 – Dec 31 |
| `category-mix-2025.csv` | 2025 | 65 | Jan 1 – Dec 31 |
| `category-mix-2026-partial.csv` | 2026 | 65 | Jan 1 – Mar 8 |

**Header:**
```
categorie_tva;Nb_produits;Total_CA;;;;;
```

**Key columns:**

| Column | Meaning | Example |
|--------|---------|---------|
| `categorie_tva` | Category + VAT rate | `01. FRUIT ET LEGUME 6%` |
| `Nb_produits` | Number of product sales in category | `30796` |
| `Total_CA` | Total revenue (€) | `89639,81` |
| col 3 | Revenue share (%) | `17,69 %` |
| col 4 | VAT rate | `6` |
| col 5 | Revenue excl. VAT (€) | `84565,86` |
| col 6–7 | VAT amount | `5073,95` |

**Enables:** Category share evolution, VAT analysis, category growth/decline by year.

**Quirks:**
- Same category appears multiple times with different VAT rates (e.g., `02. FROMAGE 0%`, `02. FROMAGE 6%`)
- Bottom rows: `total`, `Nbclient`, `Moyenne par client`, `Fictif`, `carte cadeaux`
- Category typos: `02. FRA` (truncated) appears in 2025

---

## 4. Margin Analysis (Statistique Marge)

Per-transaction margin data: sale price, purchase price, margin, ratio. Individual line items (not aggregated by product).

| File | Year | Transactions | Period |
|------|------|-------------|--------|
| `margin-analysis-2025-h1.csv` | 2025 | 18,828 | ~Jan–Jun 2025 |
| `margin-analysis-2025-h2.csv` | 2025 | 21,012 | ~Jul–Dec 2025 |
| `margin-analysis-2026-jan-feb.csv` | 2026 | 7,639 | Jan–Feb 2026 |

**Header:**
```
;;Total vente tvac;Total vente ht;Total achat ht;Marge ht;Ratio ht;;;;
```

**Key columns:**

| Column | Meaning | Example |
|--------|---------|---------|
| col 1 | Product name (sometimes with weight prefix) | `(00106g/34,68€Kg)FILET DE POULET ROTI ITALIEN` |
| col 2 | Sale price incl. VAT (€) | `3,68` |
| col 3 | Sale price excl. VAT (€) | `3,47` |
| col 4 | Purchase price excl. VAT (€) | `2,17` |
| col 5 | Margin excl. VAT (€) | `1,30` |
| col 6 | Markup ratio | `1,60` |
| col 7 | EAN/internal ID | `2603651` |

**Enables:** Per-product margin analysis, margin outliers, markup ratio distribution, profitability ranking.

**Quirks:**
- Multiple rows per product (each row = one sale transaction, not aggregated)
- Weight/price prefixes in names: `(00106g/34,68€Kg)PRODUCT` — must be stripped
- Contains `#ACOMPTE###` payment rows (filter out)
- Ends with POS vendor footer row
- **No date column** — transactions have no timestamps
- No margin data for 2023 or 2024

---

## 5. Product Master Data (ExportRoulStock)

Full product catalog — every product in the POS system with all metadata.

| File | Products | Description |
|------|----------|-------------|
| `product-master-full.csv` | 3,108 | Complete catalog including inactive products |
| `product-master-active.csv` | 1,924 | Filtered subset (recently sold products) |
| `product-reference.csv` | 3,666 | Lightweight: just EAN, name, timestamp |

**Structure (full/active):** ~60+ semicolon-separated columns (no header row). Key fields by position:

| Position | Meaning | Example |
|----------|---------|---------|
| col 2 | EAN / internal ID | `5425010321313` |
| col 3 | Product name | `MAYONNAISE BIO 310GR` |
| col 4 | Sale price (€) | `4,6` |
| col 5 | Stock level | `19` or `-41` |
| col 7 | VAT rate (%) | `6` |
| col 8 | Main category | `04. EPICERIE` |
| col 9 | Supplier (famille) | `INTERBIO` |
| col 12 | Purchase price (€) | `2,7` |
| col 13 | Subcategory | `04. CONSERV - SAUCE` |
| ~col 31 | Created date | `18-04-25 13:05:20` |
| ~col 32 | Last sold date | `18-12-24 15:27:01` |
| ~col 33 | Another date | `23-08-23 10:57:38` |
| ~col 37 | Label (BIO, etc.) | `BIO` |
| ~col 41 | Real supplier name | `INTERBIO` |

**Structure (reference):** 3 columns: `;;EAN;product_name;timestamp`

**Enables:** Product master reference for joining, supplier mapping, stock snapshots, product creation/activity dates, BIO label tracking.

**Quirks:**
- No header row — columns must be identified by position
- Dates in `DD-MM-YY HH:MM:SS` format
- `LINK EAN :XXXX` rows are product aliases/redirects
- `OLD_` prefix in IDINTERN indicates deprecated products

---

## 6. Hourly Revenue by Weekday (Module 44A — CA par heure/jour)

Annual revenue aggregated by day-of-week and hour. One row per (weekday, hour) pair.

| File | Year | Rows | Period |
|------|------|------|--------|
| `hourly-by-weekday-2023.csv` | 2023 | 64 | Jan 1 – Dec 31 |
| `hourly-by-weekday-2024.csv` | 2024 | 68 | Jan 1 – Dec 31 |
| `hourly-by-weekday-2025.csv` | 2025 | 65 | Jan 1 – Dec 31 |

**Header:**
```
JOUR;HEURE;TOTAL;TOTAL
```

**Key columns:**

| Column | Meaning | Example |
|--------|---------|---------|
| `JOUR` | Day of week (French) | `samedi`, `mardi`, `mercredi` |
| `HEURE` | Hour (24h format) | `10`, `17` |
| `TOTAL` | Revenue for all [weekday] at [hour] across the year (€) | `25226,13` |

**Enables:** Saturday vs Tuesday comparison, peak hour analysis, staffing optimization, opening hours evaluation.

**Key insight from 2025 data:**
- Saturday 11h = €25,226 (biggest single hour)
- Wednesday 11h = €21,707 (second biggest)
- Monday total = €1,665 (barely open — staff activity?)
- Thursday total = €57,124 (smallest real trading day)

**Note:** This is aggregated across the entire year — not per-week. To get average Saturday revenue per hour, divide by ~52 weeks.

---

## 7. Transaction Detail (Module 44A — Détails des ventes)

**The richest dataset.** Every individual sale line with date, time, product, price, category, EAN, and payment method.

| File | Year | Transactions | Period |
|------|------|-------------|--------|
| `transactions-2023.csv` | 2023 | 43,737 | Jan 1 – Dec 31 |
| `transactions-2024.csv` | 2024 | 43,737 | Jan 1 – Dec 31 |
| `transactions-2025.csv` | 2025 | 43,737 | Jan 1 – Dec 31 |
| `transactions-2026-partial.csv` | 2026 | 19,465 | Jan 1 – Mar 8 |

**Header:**
```
Expr1000;article;tva;prix;categorie;EAN;temporaire8;temporaire8
```

**Key columns:**

| Column | Meaning | Example |
|--------|---------|---------|
| `Expr1000` | Date + time | `03-01-25 14:41` |
| `article` | Product name (may include weight prefix) | `(1360g/2,3€Kg)POTIMARRON BIO` |
| `tva` | VAT rate (%) | `6`, `21`, `0` |
| `prix` | Sale price (€) | `2,82` |
| `categorie` | Category | `01. FRUIT ET LEGUME` |
| `EAN` | EAN barcode or internal ID | `474`, `5411087001722` |
| `temporaire8` | Payment method | `[MC/BC]`, `[CASH]`, or empty |

**Enables:** Daily revenue trends, weather correlation (join date with Open-Meteo), basket reconstruction (same timestamp = same ticket), hourly patterns by actual date, seasonal patterns with daily resolution, day-of-week analysis with date context, customer visit frequency (ticket count per day).

**Quirks:**
- Weight-sold items have prefixes: `(1360g/2,3€Kg)POTIMARRON BIO`
- Payment methods: `[MC/BC]` = card, `[CASH]` = cash, empty = unknown
- 2023 data has empty payment columns (possibly not tracked yet)
- Deposit returns (`VIDANGE`) are included as normal transactions
- ~150,000 transactions across 3 full years + 2026 partial

---

## What This Data Can Answer

### Fully answerable now

- **Monthly seasonality** per product (36 months: 2023–2025)
- **Year-over-year by month** (Jan '23 vs Jan '24 vs Jan '25)
- **Saturday vs Tuesday** — directly from hourly-by-weekday files, or computed from transactions
- **Hourly sales patterns** — peak hours, quiet hours, by day of week
- **Daily revenue trends** — from transaction timestamps, joinable with weather
- **Weather correlation** — join daily revenue (from transactions) with Open-Meteo API data
- **Basket analysis** — same timestamp = same ticket, enables basket composition analysis
- **Supplier performance** and growth over time
- **Category share evolution** across years
- **Product margin analysis** and outlier detection
- **Stock health** assessment
- **Product lifecycle**: new, growing, declining, dead
- **Assortment changes**: what appeared/disappeared each year
- **Payment method mix**: card vs cash trends (2024-2025+)

### Still needs additional data sources

| Analysis | What's needed |
|----------|---------------|
| Weather correlation | Open-Meteo API (free) — join with daily transaction totals |
| Customer loyalty patterns | Module 47 or FIDEL data (GDPR-sensitive) |
| 2023/2024 margins | Margin exports for those years |
| Supplier order history | Module 35A ordering data |

---

## Discarded Files

| Original name | Reason |
|---------------|--------|
| `ExportStatVente_10032026_1252.csv` | Duplicate of 1248 (both 2025) |
| `ExportRoulStock_10032026_1244.csv` | Empty file (just `;;`) |
