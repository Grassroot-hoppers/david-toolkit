# Data Pipeline Design — Day 2

**Date:** 2026-03-10
**Input:** Exploration findings from `2026-03-10-data-pipeline-exploration.md`

---

## Architecture

Two-step pipeline: **import** then **build**.

```
data/real/                    (gitignored — real POS exports go here)
  *.csv

  → scripts/import-exports.mjs
      1. Auto-detect file type from header fingerprint
      2. Detect encoding (cp1252 → latin1 → utf8)
      3. Validate columns against expected schema
      4. Normalize to clean JSON
      5. Report findings and errors

  → data/normalized/          (gitignored — clean intermediate JSON)
      products-YYYY.json      (one per year found)
      recent-sales.json
      category-mix.json
      margins.json
      import-report.json      (what was found, what matched, what didn't)

  → scripts/build-data.mjs    (modified to read from normalized/ OR sample-data/raw/)
      Scoring engine unchanged — reads normalized input, produces demo.json
```

### Fallback behavior

If `data/normalized/` does not exist, `build-data.mjs` falls back to `sample-data/raw/` (current behavior). This means the demo keeps working without real data.

---

## File Type Detection

Auto-classify CSVs by reading the first non-empty line and matching against fingerprints:

| Type | Fingerprint (uppercase header contains) | Maps to |
|------|----------------------------------------|---------|
| `product-stats` | `LIBELLE` + `TOTQUT` + `TOTCA` | `export-stat-vente` |
| `recent-sales` | `ART` + (`QUANTITE` or `CHIFF_AFF`) | `sta-satvente` |
| `category-mix` | `CATEGORIE_TVA` + `NB_PRODUITS` | `sta-ratioCAT` |
| `margin-analysis` | `TOTAL VENTE TVAC` or `MARGE HT` | `analyse` |
| `unknown` | none match | skip with warning |

This matches the Python `file_detector.py` logic.

---

## Encoding Detection

Try in order:
1. Check for UTF-8 BOM (`EF BB BF`)
2. Try decoding as UTF-8 — if no replacement characters, use it
3. Fall back to cp1252 (which is a superset of latin1 for all printable chars)

In Node.js: read as `Buffer`, try `buffer.toString('utf8')`, check for decode errors. If clean, use UTF-8. Otherwise, use a cp1252 decoder. For the common case (MicroConcept exports), cp1252 is expected.

Pragmatic shortcut: since Node's `latin1` encoding handles bytes 0x00-0xFF as-is and cp1252 only differs in 0x80-0x9F, we can:
1. Read as buffer
2. Check for `€` (0x80 in cp1252, U+20AC) — if present, use cp1252 decode
3. Otherwise, `latin1` is fine (as current code does)

---

## Column Validation

For each file type, define the expected columns and which are required vs optional:

### product-stats (export-stat-vente)

**Required:** `libelle`, `STOCK`, `PRIXACHAT`, `PRIX`, `TotQut`, `TotCA.`
**Optional:** `id`, `famille`, `type`, `C3`, `IDINTERN`, `categorie`, `conditionnement`, `Magas`
**Monthly columns:** auto-detected by `YY_MM` pattern (e.g., `24_01`, `25_03`)

If a required column is missing, report the error and skip the file.
If optional columns are missing, proceed with defaults.
Auto-detect the year prefix from monthly columns (don't hardcode `24_` or `25_`).

### recent-sales (sta-satvente)

**Required (by position):** col 0 = product name, col 1 = quantity, col 2 = revenue
**Optional:** EAN, TRI, CAT columns

### category-mix (sta-ratioCAT)

**Required (by position):** col 0 = category, col 1 = product count, col 2 = total CA
**Optional:** share (col 3), remaining columns

### margin-analysis (analyse)

**Required:** product name column, Total vente columns, Marge ht, Ratio ht
**Note:** leading empty columns — product name is at col 1 (after initial `;`)

---

## Summary Row Filtering

Skip rows where the first non-empty cell (case-insensitive) matches:
- `total`
- `nbclient`
- `nb client`
- `moyenne`
- `moyenne par client`
- (empty row)

This matches what the Python pipeline does.

---

## Multi-Year Support

Instead of hardcoding 2024+2025:

1. Scan `data/real/` for all `product-stats` type files
2. From each, extract the year prefix from monthly columns
3. Produce one `products-YYYY.json` per year
4. `build-data.mjs` loads all available years, computes YoY for the latest two

---

## Import Report

`data/normalized/import-report.json`:

```json
{
  "importedAt": "2026-03-10T14:30:00Z",
  "sourceDir": "data/real",
  "files": [
    {
      "filename": "export-stat-vente-2024.csv",
      "detectedType": "product-stats",
      "encoding": "cp1252",
      "yearPrefix": "24_",
      "rowCount": 847,
      "skippedRows": 3,
      "status": "ok",
      "warnings": ["Column 'C3' not found — using empty default"]
    }
  ],
  "errors": [],
  "summary": {
    "totalFiles": 6,
    "successfulImports": 5,
    "failedImports": 1,
    "totalProducts": 847,
    "yearsFound": [2023, 2024, 2025]
  }
}
```

---

## Normalized Output Format

### products-YYYY.json

```json
[
  {
    "key": "MOZZARELLA DI BUFALA",
    "rawName": "MOZZARELLA DI BUFALA",
    "stock": 22,
    "purchasePrice": 2.05,
    "salePrice": 4.90,
    "totalQuantity": 742,
    "totalRevenue": 3635.80,
    "monthly": [48, 46, 52, 55, 60, 66, 72, 74, 68, 64, 70, 67],
    "rawCategory": "02. FROMAGE",
    "supplierHint": "ITALIA",
    "weightedType": "02. FROMAGE"
  }
]
```

Same shape as what `parseExport()` currently returns, but pre-normalized (numbers already parsed, key already normalized).

### recent-sales.json, category-mix.json, margins.json

Same idea: pre-parsed, clean JSON matching what the current parsers return.

---

## Changes to build-data.mjs

Minimal. Add a check at the top:

1. If `data/normalized/` exists and contains files → read from there
2. Else → fall back to current `sample-data/raw/` parsing

The scoring engine, supplier mapping, and output assembly remain unchanged. The only structural change is supporting N years instead of hardcoded 2024+2025.

---

## .gitignore additions

```
data/real/
data/normalized/
```

---

## Files to create/modify

| File | Action |
|------|--------|
| `scripts/import-exports.mjs` | **Create** — the import layer |
| `scripts/build-data.mjs` | **Modify** — add normalized data fallback, multi-year support |
| `scripts/verify-data.mjs` | **Modify** — relax hardcoded assertions for real data |
| `.gitignore` | **Modify** — add `data/real/` and `data/normalized/` |
| `data/real/.gitkeep` | **Create** — empty dir for real exports |
| `ARCHITECTURE.md` | **Modify** — document the two-step pipeline |

---

## What this does NOT do

- No live data source wiring (Open-Meteo, Todoist, Notion) — that's a separate task
- No UI changes — the dashboard renders whatever `demo.json` contains
- No supplier mapping expansion — that requires Notion data
- No POS anatomy registry creation — that's the Phase 1 work from the pos-anatomy-design plan

---

## Verification

After build:

1. `node scripts/import-exports.mjs` — should detect files, validate, produce normalized output
2. `node scripts/build-data.mjs` — should read normalized data and produce `demo.json`
3. `node scripts/verify-data.mjs` — should pass with real or synthetic data
4. `npm run serve` — dashboard should render with whatever data is available
