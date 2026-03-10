# Data Pipeline Exploration — Day 2

**Date:** 2026-03-10
**Purpose:** Understand what the existing CSV files look like, how `build-data.mjs` parses them, and what will break when real POS exports replace the synthetic data.

---

## Current State

All 5 CSV files in `sample-data/raw/` are **synthetic/sanitized** — 14 products, clean encoding, no edge cases. The pipeline works perfectly on this toy dataset. The question is what happens with real data.

---

## File-by-File Analysis

### export-stat-vente-2024.csv (yearly product stats)

| Property | Value |
|----------|-------|
| **Size** | 2146 bytes, 14 data rows |
| **Encoding** | No BOM. ASCII-safe (no accented chars in synthetic data). Parser reads as `latin1`. |
| **Delimiter** | Semicolon |
| **Header** | `;id;libelle;famille;type;C3;STOCK;IDINTERN;categorie;conditionnement;PRIXACHAT;PRIX;TotQut;Magas;TotCA.;24_01;24_02;...;24_12` |
| **Leading semicolon** | Yes — column 0 is always empty |
| **Monthly columns** | `24_01` through `24_12` — quantity by month |
| **Numbers** | European decimal comma: `2,05`, `3635,80` |
| **Parser** | `parseExport("export-stat-vente-2024.csv", "24_")` |

**Parser logic:** Reads header, finds columns starting with `24_`. Creates records via `Object.fromEntries(header.map(...))`. Accesses by column name: `record.libelle`, `record.STOCK`, `record.PRIXACHAT`, `record.PRIX`, `record.TotQut`, `record["TotCA."]`, `record.categorie`, `record.famille`, `record.type`. Normalizes product name to uppercase key.

**Risk with real data:** If real 44A export has different column names or order, the header-based lookup will silently produce `undefined` values that `parseNumber()` converts to 0.

### export-stat-vente-2025.csv (same structure, year prefix 25_)

Identical structure. Same risks.

### sta-satvente-2025.csv (recent sales)

| Property | Value |
|----------|-------|
| **Size** | 1443 bytes, 14 data rows |
| **Header** | `ART;QUANTITE;CHIFF_AFF;EAN_MAX_DE_LA_PERIODE;TRI;CAT;CAT` |
| **No leading semicolon** | Different from export-stat-vente |
| **Numbers** | `84,00`, `436,80` |
| **TRI column** | Contains IDINTERN (e.g., `1001`) |
| **CAT columns** | Col 5 = "category + product name" concat, Col 6 = just category |
| **Parser** | `parseRecentSales()` — positional: `row[0]`=name, `row[1]`=qty, `row[2]`=revenue, `row[5]`=category |

**Risk with real data:** The parser is purely positional. If columns shift or new columns appear, everything breaks silently.

### sta-ratioCAT-2025.csv (category mix)

| Property | Value |
|----------|-------|
| **Size** | 426 bytes, 6 categories |
| **Header** | `categorie_tva;Nb_produits;Total_CA;;;;;` (trailing empty cols) |
| **Category format** | `01. FRUIT ET LEGUME 6%` — includes TVA rate |
| **Unnamed columns** | Cols 4-7 contain: VAT rate, HT amount, TVA amount, another TVA amount |
| **Parser** | `parseCategoryMix()` — positional: `row[0]`=category, `row[1]`=count, `row[2]`=CA, `row[3]`=share |

**Risk with real data:** Real export may have summary rows ("total", "nbclient") that need filtering. The Python pipeline's `csv_importer.py` already handles this — `build-data.mjs` does not.

### analyse-2025.csv (margins)

| Property | Value |
|----------|-------|
| **Size** | 989 bytes, 14 data rows + 1 zero row |
| **Header** | `;;Total vente tvac;Total vente ht;Total achat ht;Marge ht;Ratio ht;;;;` |
| **Leading empty cols** | Cols 0-1 are `;` then product name |
| **Zero row** | Row 2 is `; ;0,00;0,00;...` — parser skips it via `row[1].trim()` check |
| **IDINTERN** | In col 7 (e.g., `1001`) |
| **Parser** | `parseMargins()` — positional: `row[1]`=name, `row[3]`=salesHt, `row[4]`=purchaseHt, `row[5]`=marginHt, `row[6]`=ratio |

**Risk with real data:** May have additional summary rows, different column positions.

---

## Cross-Cutting Observations

### Encoding
- Current parser: `fs.readFileSync(filePath, "latin1")` — works for cp1252 superset
- Real POS exports use cp1252 (confirmed by Python pipeline research)
- latin1 read will work for cp1252 characters but may produce wrong characters for some cp1252-specific codepoints (0x80-0x9F range: €, ", ", etc.)
- The Python pipeline tries `cp1252` first, then `latin-1`, then `utf-8`

### Product matching
- Products are matched by normalized uppercase name (`normalizeKey()`)
- Accent stripping: NFD + remove combining marks — should handle French accents
- `product-corrections.json` has exactly 14 entries — one per synthetic product
- Real data: hundreds of products with no corrections → they'll use raw names, raw categories, `supplier: "Unmapped"`, default weather/perishability

### Supplier mapping
- `context.json` defines 5 suppliers: Terra, Affineur, Pantry, Interbio, Atelier
- Products get supplier from `correction.supplier || current.supplierHint || "Unmapped"`
- `supplierHint` comes from the `famille` column in export-stat-vente
- Real data: `famille` values will be real supplier names from the POS, not matching the 5 configured ones
- Result: most products will be `"Unmapped"` unless corrections cover them

### The scaling problem
- 14 products → ~500-2000 products in a real shop
- 14 corrections → 0% coverage of new products
- 5 configured suppliers → 23 real suppliers (per Notion research)
- Build-data scoring still works (it's math), but the dashboard will be dominated by uncorrected products with no supplier panels

---

## What build-data.mjs Does NOT Handle

1. **Missing files** — crashes if any CSV is missing (no try/catch, no optional files)
2. **Summary/footer rows** — no filtering for "total", "nbclient", "moyenne par client"
3. **BOM detection** — assumes no BOM
4. **Column validation** — no check that expected columns exist
5. **Year prefix detection** — hardcoded `"24_"` and `"25_"` — adding 2023 requires code change
6. **Encoding edge cases** — latin1 vs cp1252 for €, smart quotes, etc.
7. **Multiple years** — only handles 2024+2025 pair, not 2023+2024+2025

---

## What the Python Pipeline Already Handles (reuse candidates)

| Capability | Python location | Node.js equivalent needed |
|------------|----------------|---------------------------|
| Encoding detection (cp1252/latin1/utf8) | `csv_importer.py:try_open()` | Yes |
| File type detection by header | `file_detector.py:detect_csv_type()` | Yes |
| Euro decimal parsing with scientific notation | `csv_importer.py:parse_euro_decimal()` | Partially (no sci notation handling) |
| Summary row filtering | `csv_importer.py` import logic | Yes |
| Duplicate import protection | `daily.py` checks `source_file` | Nice to have |

---

## Immediate Questions for Real Data

When real exports arrive, verify:

1. Does 44A "Quté et CA de ventes" produce the `export-stat-vente` column layout? Or something different?
2. What are the actual `famille` values? Do they match supplier names?
3. Are there summary/total rows at the bottom?
4. What encoding are the files? (Check for `€` signs, accented characters)
5. Does the yearly export include monthly breakdown columns (`YY_MM` format)?
6. How many products? How many categories?
7. What does the 2023 export look like? Same column structure?

---

## Reconciliation: POS Anatomy Claims vs Parser Reality

### POS anatomy registry status

The `pos-anatomy.json` file **does not exist** in the current tree. The design plan (`docs/plans/2026-03-09-pos-anatomy-design.md`) was written on Day 1 but the work was done on a branch (`pos-anatomy-source-of-truth`) that is not merged. The phase gate still holds: no app wiring until a real export proves the schema.

### What the manual research claims about 44A exports

From `scraps/retail-analytics/docs/plans/2026-02-25-microconcept-pos-data-exports-research.md`:

- Module 44A has multiple report types: "Détails des ventes", "Quté et CA de ventes", "CA par heure/jour/période", "Tableau de bord"
- CSV export is explicitly documented for 44A
- User enters filename, clicks "Exporter en CSV"
- Export path is partially visible in the manual (truncated in PDF)

**Unknown:** Whether the "Quté et CA de ventes" export produces the exact column layout the parsers expect (`id;libelle;famille;type;C3;STOCK;IDINTERN;categorie;conditionnement;PRIXACHAT;PRIX;TotQut;Magas;TotCA.;YY_01-YY_12`). This is the single most important question.

### Parser-to-report mapping (hypothesis)

| Parser function | Expected CSV | Likely POS source | Confidence |
|----------------|-------------|-------------------|------------|
| `parseExport()` | `export-stat-vente-*.csv` | 44A "Quté et CA de ventes" (full year) | Medium — column layout unverified |
| `parseRecentSales()` | `sta-satvente-2025.csv` | 44A "Quté et CA de ventes" (short period) | Low — might be same report with different columns |
| `parseCategoryMix()` | `sta-ratioCAT-2025.csv` | 44A "Tableau de bord" | Medium — category format unverified |
| `parseMargins()` | `analyse-2025.csv` | 46A "Statistique Marge" | Low — export not confirmed in manual |

### Supplier mapping gap

- **Dashboard coherence research** identifies 23 real suppliers from Notion
- **context.json** has 5: Terra, Affineur, Pantry, Interbio, Atelier
- **Real CSV** `famille` column will contain POS supplier codes, not these names
- The correction layer (`product-corrections.json`) maps `famille` → canonical supplier for 14 products only
- **Gap:** Hundreds of products will have unmapped suppliers

### The 2023 gap

- `build-data.mjs` hardcodes `parseExport("export-stat-vente-2024.csv", "24_")` and `parseExport("export-stat-vente-2025.csv", "25_")`
- Adding 2023 requires a code change to `buildProducts()` — currently it only computes YoY from 2024→2025
- With 3 years: can compute 2-year trends, seasonal patterns, and YoY for both 2024 and 2025

---

## Design Implications

Based on the exploration and reconciliation, the new pipeline needs:

1. **Encoding detection** — try cp1252, then latin-1, then utf-8 (matching Python pipeline)
2. **Column validation** — read header, verify expected columns exist, report mismatches
3. **File type detection** — auto-detect which CSV type based on header fingerprint (matching Python `file_detector.py`)
4. **Summary row filtering** — skip "total", "nbclient", "moyenne par client" rows
5. **Year detection** — auto-discover `YY_MM` column prefixes instead of hardcoding
6. **3-year support** — handle 2023+2024+2025 in scoring
7. **Graceful degradation** — if a file is missing, report it and continue with what's available
8. **Structured error output** — when columns don't match expectations, report exactly what's wrong
9. **Real data directory** — separate from `sample-data/raw/` (gitignored for privacy)
10. **Normalization step** — produce clean intermediate data that `build-data.mjs` can consume regardless of whether input is synthetic or real
