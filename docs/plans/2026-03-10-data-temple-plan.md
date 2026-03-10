# Data Temple Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Bronze → Silver → Gold data pipeline that normalizes all 24 POS CSV exports into a universal, dashboard-ready data layer.

**Architecture:** Three-stage pipeline. `import-silver.mjs` reads messy CSVs and writes cleaned JSON (Silver). `build-gold.mjs` aggregates Silver into small dashboard-ready files (Gold). `build-demo.mjs` reads Gold and produces the current dashboard's `demo.json`. See `docs/plans/2026-03-10-data-temple-design.md` for full design.

**Tech Stack:** Node.js (ESM), no new dependencies. Pure fs/path/buffer operations.

---

## Phase 1: Foundation

### Task 1: Scaffolding

**Files:**
- Modify: `.gitignore`
- Modify: `package.json`
- Create: `data/silver/.gitkeep`
- Create: `data/gold/.gitkeep`
- Create: `data/external/.gitkeep`

**Step 1:** Update `.gitignore` to add:
```
data/silver/
data/gold/
data/external/
```
Keep existing `data/real/` entry. Keep existing `data/normalized/` entry (legacy, will be removed later).

**Step 2:** Update `package.json` scripts:
```json
{
  "import": "node scripts/import-silver.mjs",
  "build:gold": "node scripts/build-gold.mjs",
  "build:demo": "node scripts/build-demo.mjs",
  "build": "npm run build:demo",
  "build:full": "npm run import && npm run build:gold && npm run build:demo",
  "test": "npm run build:full && node scripts/verify-data.mjs"
}
```
Keep `serve`, `dev`, `prepare:sample` unchanged.

**Step 3:** Create `.gitkeep` files in `data/silver/`, `data/gold/`, `data/external/`.

**Step 4:** Verify: `npm run import` should fail gracefully (script doesn't exist yet).

**Step 5:** Commit: `chore: scaffold data temple directory structure`

---

### Task 2: Core Utilities Module

**Files:**
- Create: `scripts/lib/csv-utils.mjs`

This module is shared by all importers. Extract and improve the encoding/parsing logic from the current `import-exports.mjs`.

**Step 1:** Create `scripts/lib/csv-utils.mjs` with these exported functions:

```javascript
// --- Encoding ---
export function decodeBuffer(buffer)
// Returns { text: string, encoding: 'utf8-bom' | 'utf8' | 'cp1252' }
// Logic: check BOM → try UTF-8 (no replacement chars) → fall back to cp1252 map
// Copy from current import-exports.mjs lines 24-47, already correct.

// --- CSV Parsing ---
export function splitCsvLines(text)
// Returns string[] — split on \n, strip \r, filter empty lines

export function splitCsvRow(line)
// Returns string[] — split on semicolons
// Handle edge case: trailing semicolons produce empty strings (keep them)

// --- Number Parsing ---
export function parseEuroDecimal(value)
// "12,868" → 12.868, "1031293,00" → 1031293, "" → 0, null → 0
// Strip whitespace, replace comma with dot, return Number or 0

export function parseMonthlyCell(value)
// Parses compound monthly column: "26  (0)" → { quantity: 26, revenue: 0 }
// Also handles: "7418  (218,88)" → { quantity: 7418, revenue: 218.88 }
// Also handles: "" or missing → { quantity: 0, revenue: 0 }
// Regex: /^\s*(\S+)\s+\((\S+)\)\s*$/ then parseEuroDecimal each capture

export function parsePercentage(value)
// "17,69 %" → 17.69, strips % sign then parseEuroDecimal

// --- Name Normalization ---
export function normalizeKey(value)
// Uppercase, accent-strip (NFD + remove combining marks), collapse non-alphanumeric to single space, trim
// Copy from current import-exports.mjs lines 63-70, already correct.

export function cleanProductName(rawName)
// Strip weight/price prefixes:
//   "(1360g/2,3€Kg)POTIMARRON BIO" → "POTIMARRON BIO"
//   "(00106g/34,68€Kg)FILET DE POULET" → "FILET DE POULET"
//   "(122g/5,8€Kg)POMME NATYRA BIO" → "POMME NATYRA BIO"
// Regex: /^\(\d+g\/[\d,]+.?(?:Kg|€Kg|€\/Kg)\)/i → strip match
// Also handle euro sign appearing as ? due to encoding: /^\(\d+g\/[\d,]+.?Kg\)/i
// Then trim result

// --- File Type Detection ---
export function detectFileType(firstLine)
// Returns one of: 'monthly-stats' | 'annual-stats' | 'transactions' | 'category-mix'
//               | 'margin-analysis' | 'hourly-by-weekday' | 'product-master' | 'unknown'
//
// Detection rules (check first line, case-insensitive):
//   monthly-stats:     contains 'libelle' AND (contains 'TotQut' OR 'TotCA')
//   annual-stats:      starts with 'ART;' AND (contains 'QUANTITE' OR 'CHIFF_AFF')
//   transactions:      contains 'Expr1000' AND contains 'article'
//   category-mix:      starts with 'categorie_tva' (case-insensitive)
//   margin-analysis:   contains 'Total vente tvac' OR contains 'Marge ht'
//   hourly-by-weekday: starts with 'JOUR;HEURE'
//   product-master:    no header keywords match AND line has 40+ semicolons (60+ columns)
//   unknown:           fallback

export function detectYearFromFilename(filename)
// Extract first 4-digit number: "stat-vente-monthly-2025.csv" → 2025
// "margin-analysis-2025-h1.csv" → 2025
// Returns number or null

// --- Junk Row Detection ---
export function isJunkRow(firstCell)
// Returns true if the row is a summary/footer to skip
// Matches (case-insensitive): total, nbclient, nb client, moyenne, moyenne par client,
//   fictif, carte cadeaux, div. ean, Designed by, #ACOMPTE, empty/whitespace-only
```

**Step 2:** Write a test file `scripts/lib/csv-utils.test.mjs`:
```javascript
import { parseEuroDecimal, parseMonthlyCell, cleanProductName, detectFileType, normalizeKey } from './csv-utils.mjs';
import assert from 'node:assert/strict';

// parseEuroDecimal
assert.equal(parseEuroDecimal("12,868"), 12.868);
assert.equal(parseEuroDecimal("1031293,00"), 1031293);
assert.equal(parseEuroDecimal(""), 0);
assert.equal(parseEuroDecimal(null), 0);

// parseMonthlyCell
assert.deepEqual(parseMonthlyCell("26  (0)"), { quantity: 26, revenue: 0 });
assert.deepEqual(parseMonthlyCell("7418  (218,88)"), { quantity: 7418, revenue: 218.88 });
assert.deepEqual(parseMonthlyCell(""), { quantity: 0, revenue: 0 });

// cleanProductName
assert.equal(cleanProductName("(1360g/2,3€Kg)POTIMARRON BIO"), "POTIMARRON BIO");
assert.equal(cleanProductName("BRIE DE MEAUX"), "BRIE DE MEAUX");

// detectFileType
assert.equal(detectFileType(";id;libelle;famille;type;C3;STOCK;IDINTERN;categorie;conditionnement;PRIXACHAT;PRIX;TotQut;Magas;TotCA.;25_01"), "monthly-stats");
assert.equal(detectFileType("ART;QUANTITE;CHIFF_AFF;EAN_MAX_DE_LA_PERIODE;TRI;CAT;CAT"), "annual-stats");
assert.equal(detectFileType("Expr1000;article;tva;prix;categorie;EAN;temporaire8;temporaire8"), "transactions");
assert.equal(detectFileType("categorie_tva;Nb_produits;Total_CA;;;;;"), "category-mix");
assert.equal(detectFileType(";;Total vente tvac;Total vente ht;Total achat ht;Marge ht;Ratio ht;;;;"), "margin-analysis");
assert.equal(detectFileType("JOUR;HEURE;TOTAL;TOTAL"), "hourly-by-weekday");

// normalizeKey
assert.equal(normalizeKey("Brie de Meaux"), "BRIE DE MEAUX");
assert.equal(normalizeKey("PÂTÉ EN CROÛTE"), "PATE EN CROUTE");

console.log("csv-utils: all tests passed");
```

**Step 3:** Run: `node scripts/lib/csv-utils.test.mjs`. Expected: all tests pass.

**Step 4:** Commit: `feat: add core CSV utilities module with tests`

---

## Phase 2: Silver Importers

Each importer is a function that takes a file path and returns a structured object. The orchestrator script calls them.

### Task 3: Product Master Importer

**Files:**
- Create: `scripts/importers/product-master.mjs`

This is the trickiest importer — no header row, 60+ columns by position.

**Step 1:** Create the importer. Key column positions (0-indexed, after leading `;;`):

```
col 0-1: empty (leading ;;)
col 2: EAN / internal ID
col 3: product name
col 4: sale price
col 5: stock level
col 6: (zero)
col 7: VAT rate (%)
col 8: main category ("04. EPICERIE")
col 9: supplier/famille ("INTERBIO")
col 10-11: zeroes
col 12: purchase price
col 13: subcategory ("04. CONSERV - SAUCE")
col ~30: (appears to be quantity fields)
col ~37: BIO label ("BIO" or empty)
col ~40-41: creation date, last sold date (DD-MM-YY HH:MM:SS)
col ~44: supplier name again
```

The function should:
1. Read and decode the file
2. Split into rows, split each row by `;`
3. Skip rows where col 3 (name) is empty or starts with `LINK EAN`
4. For each valid row, extract:
   ```json
   {
     "key": "<normalizeKey(name)>",
     "ean": "<col 2>",
     "name": "<col 3, trimmed>",
     "salePrice": "<parseEuroDecimal(col 4)>",
     "stock": "<parseEuroDecimal(col 5)>",
     "vatRate": "<parseEuroDecimal(col 7)>",
     "category": "<col 8, trimmed>",
     "supplier": "<col 9, trimmed>",
     "purchasePrice": "<parseEuroDecimal(col 12)>",
     "subcategory": "<col 13, trimmed>",
     "bioLabel": "<col ~37, trimmed, or empty string>",
     "createdDate": "<col ~40, parsed or raw string>",
     "lastSoldDate": "<col ~41, parsed or raw string>",
     "active": true
   }
   ```
5. Return array of products

**Important:** The BIO label and date column positions may vary. During implementation, log a few sample rows and verify the exact positions. The positions listed above are from examining 3 rows of `product-master-full.csv` — they should be confirmed against more rows.

**Step 2:** Write inline test with 2-3 hardcoded CSV lines (copy from the actual file). Verify parsing produces correct output.

**Step 3:** Run test, verify pass.

**Step 4:** Commit: `feat: add product master Silver importer`

---

### Task 4: Monthly Stats Importer

**Files:**
- Create: `scripts/importers/monthly-stats.mjs`

This is the most valuable importer. The header is:
```
;id;libelle;famille;type;C3;STOCK;IDINTERN;categorie;conditionnement;PRIXACHAT;PRIX;TotQut;Magas;TotCA.;YY_01;YY_02;...;YY_12
```

Monthly columns contain compound values: `"7418  (218,88)"` = 7418 qty, €218.88 revenue. Use `parseMonthlyCell()`.

**Step 1:** Create the importer:
1. Read and decode the file
2. Parse header to find the monthly column names (match `/^\d{2}_\d{2}$/` pattern)
3. Auto-detect year prefix from those columns (e.g., `25_01` → 2025)
4. For each data row:
   - Skip if `libelle` (col 2) is empty or whitespace
   - Parse monthly cells into `{ quantity, revenue }` pairs
   - Extract:
   ```json
   {
     "key": "<normalizeKey(libelle)>",
     "rawName": "<libelle trimmed>",
     "internalId": "<id col>",
     "supplier": "<famille trimmed>",
     "mainType": "<type trimmed>",
     "origin": "<C3 trimmed>",
     "stock": "<abs(parseEuroDecimal(STOCK))>",
     "internalRef": "<IDINTERN trimmed>",
     "category": "<categorie trimmed>",
     "conditioning": "<parseEuroDecimal(conditionnement)>",
     "purchasePrice": "<parseEuroDecimal(PRIXACHAT)>",
     "salePrice": "<parseEuroDecimal(PRIX)>",
     "totalQuantity": "<parseEuroDecimal(TotQut)>",
     "totalRevenue": "<parseEuroDecimal(TotCA.)>",
     "monthly": [
       { "month": 1, "quantity": 7418, "revenue": 218.88 },
       ...12 entries
     ]
   }
   ```
5. Return `{ year, products }`.

**Step 2:** Write test with header + 2 data rows from actual file. Verify monthly cell parsing works.

**Step 3:** Run test, verify pass.

**Step 4:** Commit: `feat: add monthly stats Silver importer`

---

### Task 5: Annual Stats Importer

**Files:**
- Create: `scripts/importers/annual-stats.mjs`

Refactor from current `importProductSales()` in `import-exports.mjs`.

Header: `ART;QUANTITE;CHIFF_AFF;EAN_MAX_DE_LA_PERIODE;TRI;CAT;CAT`

**Step 1:** Create importer (mostly copy from existing, clean up):
1. Skip header row
2. For each data row:
   - Skip if name is empty
   - Skip summary rows: `total`, `Nbclient`, `Moyenne par client` (use `isJunkRow()`)
   - Separate refund rows (`REMB ...`) — store in separate array
   - Extract:
   ```json
   {
     "key": "<normalizeKey(name)>",
     "rawName": "<name trimmed>",
     "quantity": "<parseEuroDecimal(col 1)>",
     "revenue": "<parseEuroDecimal(col 2)>",
     "ean": "<col 3 trimmed>",
     "category": "<col 6 trimmed (last CAT column)>"
   }
   ```
3. Return `{ year, products, refunds }`.

**Step 2:** Test with 3 rows including a refund and a summary row.

**Step 3:** Commit: `feat: add annual stats Silver importer`

---

### Task 6: Transaction Importer

**Files:**
- Create: `scripts/importers/transactions.mjs`

Header: `Expr1000;article;tva;prix;categorie;EAN;temporaire8;temporaire8`

This is the heaviest importer (~44k rows/year). Must be efficient.

**Step 1:** Create importer:
1. Skip header row
2. For each data row:
   - Parse timestamp: `"03-01-25 14:41"` → ISO date string `"2025-01-03T14:41:00"`
     - Format is DD-MM-YY HH:MM. Convert YY to YYYY (add 2000).
   - Clean product name with `cleanProductName()` (strip weight prefixes)
   - Detect payment method from `temporaire8` columns: `[MC/BC]` → `"card"`, `[CASH]` → `"cash"`, empty → `"unknown"`
   - Extract:
   ```json
   {
     "timestamp": "2025-01-03T14:41:00",
     "date": "2025-01-03",
     "hour": 14,
     "dayOfWeek": 5,
     "productKey": "<normalizeKey(cleaned name)>",
     "rawName": "<cleaned name>",
     "vatRate": "<parseEuroDecimal(tva)>",
     "price": "<parseEuroDecimal(prix)>",
     "category": "<categorie trimmed>",
     "ean": "<EAN trimmed>",
     "paymentMethod": "card"
   }
   ```
3. Return `{ year, transactions }`.

**Performance note:** 44k rows is fine. JSON.stringify of 44k objects takes <1 second in Node.

**Step 2:** Test with 3 transaction rows including a weighted product.

**Step 3:** Commit: `feat: add transaction Silver importer`

---

### Task 7: Category Mix Importer

**Files:**
- Create: `scripts/importers/category-mix.mjs`

Refactor from current `importCategoryMix()`. Header: `categorie_tva;Nb_produits;Total_CA;;;;;`

**Step 1:** Create importer:
1. Skip header
2. Skip junk rows (use `isJunkRow()`)
3. For each row:
   - Parse category name (may include VAT rate: `"01. FRUIT ET LEGUME 6%"`)
   - Split category name from VAT rate if present
   - Fix known typos: `"02. FRA"` → `"02. FROMAGE"`
   - Extract:
   ```json
   {
     "category": "01. FRUIT ET LEGUME",
     "vatRate": 6,
     "productCount": 30796,
     "totalRevenue": 89639.81,
     "share": 17.69,
     "revenueExclVat": 84565.86,
     "vatAmount": 5073.95
   }
   ```
4. Return `{ year, categories }`.

**Step 2:** Test with 3 rows including one with `0%` VAT and a `total` summary row.

**Step 3:** Commit: `feat: add category mix Silver importer`

---

### Task 8: Margin Importer

**Files:**
- Create: `scripts/importers/margins.mjs`

Refactor from current `importMargins()`. Header: `;;Total vente tvac;Total vente ht;Total achat ht;Marge ht;Ratio ht;;;;`

**Step 1:** Create importer:
1. Skip header
2. Skip junk rows: `#ACOMPTE`, `Designed by Micro Concept`, zero rows, empty names
3. Clean product names with `cleanProductName()` (weight prefixes appear here too)
4. **Aggregate by product key** — multiple rows per product (each = one transaction)
5. Per aggregated product:
   ```json
   {
     "key": "<normalizeKey(cleaned name)>",
     "rawName": "<cleaned name>",
     "salesTtc": 123.45,
     "salesHt": 116.46,
     "purchaseHt": 72.80,
     "marginHt": 43.66,
     "marginRatio": 1.60,
     "transactionCount": 15
   }
   ```
6. Return `{ year, margins }`.

**Step 2:** Test with 3 rows including a junk row and two rows for same product (to test aggregation).

**Step 3:** Commit: `feat: add margin analysis Silver importer`

---

### Task 9: Hourly Patterns Importer

**Files:**
- Create: `scripts/importers/hourly-patterns.mjs`

Simplest importer. Header: `JOUR;HEURE;TOTAL;TOTAL`

**Step 1:** Create importer:
1. Skip header
2. For each row:
   - Map French day names to ISO day numbers: `lundi`→1, `mardi`→2, `mercredi`→3, `jeudi`→4, `vendredi`→5, `samedi`→6, `dimanche`→7
   - Extract:
   ```json
   {
     "dayOfWeek": 4,
     "dayName": "jeudi",
     "hour": 10,
     "revenue": 2635.13
   }
   ```
3. Return `{ year, entries }`.

**Step 2:** Test with 3 rows.

**Step 3:** Commit: `feat: add hourly patterns Silver importer`

---

### Task 10: Import Orchestrator

**Files:**
- Create: `scripts/import-silver.mjs`

This is the main entry point. It replaces `scripts/import-exports.mjs`.

**Step 1:** Create the orchestrator:
1. Scan `data/real/` for all `.csv` files
2. For each file:
   a. Read as buffer, decode with `decodeBuffer()`
   b. Get first non-empty line
   c. Call `detectFileType()` to classify
   d. Route to the appropriate importer function
   e. Catch errors per file (don't crash the whole import)
   f. Log results: filename, detected type, encoding, row count, warnings
3. Collect all results by type
4. Write Silver output files:
   - `data/silver/products.json` — from product-master importer. If both `product-master-full.csv` and `product-master-active.csv` exist, merge (full catalog, flag active products)
   - `data/silver/monthly-stats-YYYY.json` — one per year
   - `data/silver/annual-stats-YYYY.json` — one per year
   - `data/silver/transactions-YYYY.json` — one per year
   - `data/silver/category-mix-YYYY.json` — one per year
   - `data/silver/margins-YYYY.json` — one per year (merge H1+H2 files for same year)
   - `data/silver/hourly-patterns-YYYY.json` — one per year
   - `data/silver/import-report.json` — comprehensive report
5. Print summary to console

**Step 2:** Run: `npm run import`. Expected output:
```
Importing POS exports from: data/real/

Found 24 CSV file(s):

  category-mix-2023.csv          → category-mix | cp1252 | 98 categories | 2023
  category-mix-2024.csv          → category-mix | cp1252 | 86 categories | 2024
  ...
  transactions-2025.csv          → transactions  | cp1252 | 43737 rows    | 2025
  ...

Writing Silver output:
  products.json (3108 products)
  monthly-stats-2023.json (3667 products)
  ...
  transactions-2025.json (43737 transactions)
  ...

Summary:
  Files: 24 processed, 21 ok, 3 skipped (product-reference.csv, .gitkeep, ...)
  Years: 2023, 2024, 2025, 2026
  Silver files: 18 written
```

**Step 3:** Verify: check that Silver JSON files exist and are valid JSON (parse them with `JSON.parse`).

**Step 4:** Commit: `feat: import-silver orchestrator — reads all 24 CSVs, writes Silver JSON`

---

## Phase 3: Gold Builders

Each builder reads from Silver and writes one Gold file.

### Task 11: Product Catalog Builder

**Files:**
- Add function to: `scripts/build-gold.mjs`

Merge Silver `products.json` + enrichment from `monthly-stats` + `margins` into one canonical product catalog.

**Logic:**
1. Start from Silver `products.json` (product master) as the base
2. For each product:
   - Enrich with latest year's stats from monthly-stats: totalQuantity, totalRevenue, stock
   - Enrich with margin data if available: marginRatio, marginHt
   - Determine lifecycle status:
     - `"new"` — appears in latest year but not in year-2
     - `"growing"` — revenue YoY > +10%
     - `"declining"` — revenue YoY < -10%
     - `"stable"` — otherwise
     - `"dead"` — in product master but no sales in latest 2 years
   - Determine years active (which years appear in annual-stats or monthly-stats)
3. Output `data/gold/product-catalog.json`:
   ```json
   [
     {
       "key": "BRIE DE MEAUX",
       "name": "BRIE DE MEAUX",
       "ean": "5425010321313",
       "category": "02. FROMAGE",
       "subcategory": "02. VACHE",
       "supplier": "FROM UN",
       "salePrice": 29.5,
       "purchasePrice": 12.868,
       "marginRatio": 1.60,
       "vatRate": 6,
       "bioLabel": "BIO",
       "stock": 22,
       "lifecycle": "stable",
       "yearsActive": [2023, 2024, 2025],
       "latestRevenue": 2207.66,
       "latestQuantity": 74910
     }
   ]
   ```

**Commit:** `feat: Gold product catalog builder`

---

### Task 12: Daily Sales Builder

**Files:**
- Add function to: `scripts/build-gold.mjs`

Aggregate Silver transactions into one row per calendar day.

**Logic:**
1. Read all `transactions-YYYY.json` Silver files
2. Group by `date` field
3. Per day:
   ```json
   {
     "date": "2025-01-03",
     "dayOfWeek": 5,
     "revenue": 1234.56,
     "transactionCount": 87,
     "itemCount": 142,
     "avgBasket": 14.19,
     "paymentMix": { "card": 1050.00, "cash": 184.56 }
   }
   ```
4. Sort by date ascending
5. Output `data/gold/daily-sales.json`

**Note on transaction count:** A "transaction" (basket) is a group of line items with the same timestamp. Count distinct timestamps per day, not line items.

**Commit:** `feat: Gold daily sales builder`

---

### Task 13: Monthly Product Stats Builder

**Files:**
- Add function to: `scripts/build-gold.mjs`

Merge all years of monthly stats into one file with 36+ monthly data points per product.

**Logic:**
1. Read all `monthly-stats-YYYY.json` Silver files
2. For each product key, merge monthly arrays across years
3. Output `data/gold/monthly-product-stats.json`:
   ```json
   [
     {
       "key": "BRIE DE MEAUX",
       "name": "BRIE DE MEAUX",
       "supplier": "FROM UN",
       "category": "02. FROMAGE",
       "series": [
         { "year": 2023, "month": 1, "quantity": 48, "revenue": 218.88 },
         { "year": 2023, "month": 2, "quantity": 46, "revenue": 210.50 },
         ...
         { "year": 2025, "month": 12, "quantity": 67, "revenue": 305.10 }
       ],
       "annualTotals": [
         { "year": 2023, "quantity": 742, "revenue": 3635.80 },
         { "year": 2024, "quantity": 780, "revenue": 3900.00 },
         { "year": 2025, "quantity": 710, "revenue": 3500.00 }
       ]
     }
   ]
   ```

**Commit:** `feat: Gold monthly product stats builder`

---

### Task 14: Category Evolution Builder

**Files:**
- Add function to: `scripts/build-gold.mjs`

**Logic:**
1. Read all `category-mix-YYYY.json` Silver files
2. Merge categories across years, aggregating VAT splits into one category entry
3. Output `data/gold/category-evolution.json`:
   ```json
   [
     {
       "category": "01. FRUIT ET LEGUME",
       "years": [
         { "year": 2023, "revenue": 89639.81, "share": 17.69, "productCount": 30796 },
         { "year": 2024, "revenue": 85000.00, "share": 17.20, "productCount": 28500 },
         { "year": 2025, "revenue": 82000.00, "share": 16.80, "productCount": 27000 }
       ]
     }
   ]
   ```

**Commit:** `feat: Gold category evolution builder`

---

### Task 15: Hourly Heatmap Builder

**Files:**
- Add function to: `scripts/build-gold.mjs`

**Logic:**
1. Read all `hourly-patterns-YYYY.json` Silver files
2. Merge into one structure per year
3. Output `data/gold/hourly-heatmap.json`:
   ```json
   {
     "years": [2023, 2024, 2025],
     "entries": [
       { "year": 2023, "dayOfWeek": 6, "dayName": "samedi", "hour": 11, "revenue": 25226.13 },
       ...
     ]
   }
   ```

**Commit:** `feat: Gold hourly heatmap builder`

---

### Task 16: Margin Ranking Builder

**Files:**
- Add function to: `scripts/build-gold.mjs`

**Logic:**
1. Read Silver `margins-YYYY.json` files (only 2025 and 2026 available)
2. Merge margin data across files for same year (H1 + H2)
3. Enrich with product catalog data (category, supplier)
4. Sort by total marginHt descending
5. Output `data/gold/margin-ranking.json`:
   ```json
   [
     {
       "key": "BRIE DE MEAUX",
       "name": "BRIE DE MEAUX",
       "category": "02. FROMAGE",
       "supplier": "FROM UN",
       "salesHt": 3400.00,
       "purchaseHt": 2125.00,
       "marginHt": 1275.00,
       "marginRatio": 1.60,
       "transactionCount": 156,
       "marginPercentage": 37.5
     }
   ]
   ```

**Commit:** `feat: Gold margin ranking builder`

---

### Task 17: Store Summary Builder

**Files:**
- Add function to: `scripts/build-gold.mjs`

**Logic:**
1. Compute from Gold files already built (daily-sales, product-catalog, category-evolution)
2. Output `data/gold/store-summary.json`:
   ```json
   {
     "years": [
       {
         "year": 2023,
         "totalRevenue": 506000,
         "productCount": 3830,
         "categoryCount": 98,
         "tradingDays": 312,
         "avgDailyRevenue": 1622,
         "isPartial": false
       },
       ...
       {
         "year": 2026,
         "totalRevenue": 84000,
         "productCount": 1085,
         "tradingDays": 58,
         "avgDailyRevenue": 1448,
         "isPartial": true
       }
     ],
     "dataRange": { "from": "2023-01-01", "to": "2026-03-08" },
     "silverCoverage": {
       "monthlyStats": [2023, 2024, 2025],
       "annualStats": [2023, 2024, 2025, 2026],
       "transactions": [2023, 2024, 2025, 2026],
       "categoryMix": [2023, 2024, 2025, 2026],
       "margins": [2025, 2026],
       "hourlyPatterns": [2023, 2024, 2025]
     }
   }
   ```

**Commit:** `feat: Gold store summary builder`

---

### Task 18: Gold Build Orchestrator

**Files:**
- Create: `scripts/build-gold.mjs`

**Step 1:** Assemble the main script that:
1. Checks `data/silver/` exists and has files
2. Runs each builder in dependency order:
   - Product catalog first (other builders may reference it)
   - Daily sales
   - Monthly product stats
   - Category evolution
   - Hourly heatmap
   - Margin ranking (needs catalog)
   - Store summary (needs other Gold files)
3. Reports what was built and file sizes
4. Falls back gracefully if some Silver files are missing (e.g., no margin data for 2023)

**Step 2:** Run: `npm run build:gold`. Expected: 7 Gold files written, total < 2 MB.

**Step 3:** Commit: `feat: build-gold orchestrator — aggregates Silver into Gold`

---

## Phase 4: Dashboard Migration

### Task 19: Build Demo Script

**Files:**
- Create: `scripts/build-demo.mjs`
- Keep: `scripts/build-data.mjs` (untouched, as legacy fallback)

**Step 1:** Create `build-demo.mjs` that:
1. Checks if `data/gold/` exists and has files
2. If yes: reads Gold files, runs the scoring engine (copied from current `build-data.mjs` buildProducts/buildBriefing logic), outputs `public/data/demo.json`
3. If no: falls back to running `build-data.mjs` logic directly (sample-data path)
4. The scoring engine reads from Gold:
   - `product-catalog.json` → product data + margins + stock
   - `monthly-product-stats.json` → monthly arrays for seasonality/demand analysis
   - `store-summary.json` → macro/KPI data
   - `category-evolution.json` → category mix
5. Reads `sample-data/config/context.json` and `product-corrections.json` for supplier mapping, weather adjustments, display names
6. Outputs `public/data/demo.json` in the exact same shape as today (dashboard doesn't change)

**Step 2:** Run: `npm run build:full` (import → gold → demo). Verify `demo.json` is produced.

**Step 3:** Open dashboard with `npm run serve`. Verify it renders.

**Step 4:** Commit: `feat: build-demo reads from Gold layer`

---

### Task 20: Updated Verification

**Files:**
- Modify: `scripts/verify-data.mjs`

**Step 1:** Expand verification to check:
1. Gold files exist and are valid JSON:
   - `data/gold/product-catalog.json` — has products, each with key/name/category
   - `data/gold/daily-sales.json` — has entries, each with date/revenue
   - `data/gold/monthly-product-stats.json` — has entries with series arrays
   - `data/gold/store-summary.json` — has years array
2. Demo.json assertions (existing, kept):
   - Store name present
   - At least 1 supplier, 1 top product
   - Insights have evidence
3. Data coherence checks:
   - Product count in catalog ≈ product count in monthly stats (within 20%)
   - Years in store-summary match years in other Gold files
   - Daily-sales date range looks reasonable (no dates before 2023 or after today)

**Step 2:** Run: `npm run test`. Expected: all pass.

**Step 3:** Commit: `feat: verify Gold + demo data integrity`

---

## Phase 5: Cleanup

### Task 21: Remove Legacy, Update Docs

**Files:**
- Delete: `scripts/import-exports.mjs` (replaced by `import-silver.mjs`)
- Modify: `ARCHITECTURE.md` — update pipeline diagram to show Bronze → Silver → Gold
- Modify: `docs/data-inventory.md` — add section on Silver/Gold output shapes
- Modify: `.gitignore` — remove `data/normalized/` entry if no longer needed

**Step 1:** Remove old import script, update docs.

**Step 2:** Run: `npm run build:full && npm run test` — full pipeline still works.

**Step 3:** Commit: `chore: remove legacy import-exports.mjs, update architecture docs`

---

## Execution Order Summary

| Phase | Tasks | Estimated time | Can parallelize? |
|-------|-------|---------------|-----------------|
| 1. Foundation | Tasks 1–2 | 15 min | No (sequential) |
| 2. Silver importers | Tasks 3–10 | 60 min | Tasks 3–9 are independent, Task 10 depends on all |
| 3. Gold builders | Tasks 11–18 | 45 min | Tasks 12–16 are independent, 17–18 depend on earlier |
| 4. Dashboard migration | Tasks 19–20 | 30 min | Sequential |
| 5. Cleanup | Task 21 | 10 min | — |

**Total estimated: ~2.5 hours of implementation time.**

Each task ends with a commit. If any task fails, the previous commits are safe — no half-baked state.
