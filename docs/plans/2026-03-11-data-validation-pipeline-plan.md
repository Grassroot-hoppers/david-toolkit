# Data Validation & Pipeline Completion — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Run the full Bronze → Silver → Gold pipeline with all 24 CSVs, apply Master Config corrections (FRAIS reclassification, SKU merges), fix revenue discrepancy, and validate the data foundation.

**Architecture:** Four-layer pipeline (Bronze → Master Config → Silver → Gold). Corrections apply during Silver import so all downstream consumers get clean data. Revenue source cascade stays in Gold. See `docs/plans/2026-03-11-data-validation-pipeline-design.md` for rationale.

**Tech Stack:** Node.js ESM scripts, no dependencies. JSON config files. Vanilla HTML/JS dashboard.

---

## Task 1: Create `category-overrides.json`

**Files:**
- Create: `sample-data/config/category-overrides.json`

**Step 1: Write the config file**

```json
{
  "_doc": "Category corrections applied during Silver import. Cross-reference runs first; keyword fallback handles unmatched FRAIS items.",
  "crossReference": {
    "enabled": true,
    "sourceYears": [2024, 2025],
    "targetCategory": "FRAIS",
    "note": "2023 FRAIS was a catch-all. Products that exist in 2024/2025 with a real category get remapped."
  },
  "keywordFallback": [
    { "target": "FROMAGE", "keywords": ["fromage", "comté", "comte", "brie", "camembert", "morbier", "reblochon", "raclette", "tomme", "beaufort", "gruyère", "gruyere", "emmental", "roquefort", "chèvre", "chevre", "pecorino", "parmesan", "parmigiano", "gorgonzola", "taleggio", "stilton", "gouda", "cheddar", "manchego", "feta", "mozzarella", "burrata", "ricotta", "mascarpone", "scamorza", "provolone", "mont d'or", "mont d or", "époisses", "epoisses", "munster", "maroilles", "pont l'évêque", "livarot", "cantal", "ossau", "laguiole", "salers", "abondance", "langres", "chaource", "brillat", "saint nectaire", "saint-nectaire", "fourme", "bleu d'auvergne", "bleu de gex", "vacherin"] },
    { "target": "CHARCUTERIE", "keywords": ["jambon", "saucisson", "coppa", "bresaola", "salami", "chorizo", "lard", "pâté", "pate", "rillettes", "terrine", "mortadelle", "mortadella", "pancetta", "guanciale", "nduja", "speck", "prosciutto", "fiocco", "lonza", "capocollo"] },
    { "target": "OEUF", "keywords": ["oeuf", "oeufs", "œuf", "œufs", "egg"] },
    { "target": "PATE FRAICHE", "keywords": ["pâte fraîche", "pate fraiche", "tagliatelle", "ravioli", "tortellini", "gnocchi", "pasta fresca", "linguine", "fettuccine", "pappardelle", "orecchiette"] },
    { "target": "FRUIT ET LEGUME", "keywords": ["tomate", "salade", "carotte", "courgette", "aubergine", "poivron", "concombre", "radis", "navet", "betterave", "chou", "brocoli", "epinard", "fenouil", "artichaut", "asperge", "pomme", "poire", "banane", "orange", "citron", "fraise", "framboise", "cerise", "raisin", "figue", "kiwi", "mangue", "ananas", "avocat", "melon", "pastèque", "peche", "abricot", "prune", "nectarine", "clementine", "mandarine", "pamplemousse", "grenade", "litchi", "fruit de la passion", "datte", "noix de coco"] }
  ],
  "productOverrides": {},
  "junkCategories": ["DIV. EAN", "Fictif", "CARTE CADEAUX", "(uncategorized)"]
}
```

**Step 2: Verify the file is valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('sample-data/config/category-overrides.json','utf8')); console.log('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add sample-data/config/category-overrides.json
git commit -m "feat: add category-overrides.json for FRAIS reclassification config"
```

---

## Task 2: Add `_meta.skuMerges` to `product-identity.json`

**Files:**
- Modify: `sample-data/config/product-corrections.json`

The existing file already has product-level overrides keyed by normalized name. We add a `_meta` key with SKU merge rules. For now this is an empty array — we'll populate it after seeing Silver output.

**Step 1: Add the `_meta` block**

Add at the top of the JSON object:

```json
{
  "_meta": {
    "skuMerges": [],
    "doc": "Canonical key + aliases. During Silver import, all alias keys get remapped to canonical before aggregation."
  },
  "MOZZARELLA DI BUFALA": { ... }
}
```

**Step 2: Verify JSON valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('sample-data/config/product-corrections.json','utf8')); console.log('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add sample-data/config/product-corrections.json
git commit -m "feat: add _meta.skuMerges to product-corrections for SKU merge config"
```

---

## Task 3: Create config loader utility

**Files:**
- Create: `scripts/lib/config-loader.mjs`

This module loads all three config files and provides lookup functions used by the import step.

**Step 1: Write the module**

```javascript
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const configDir = path.join(root, "sample-data", "config");

export function loadMasterConfig() {
  const productCorrections = readJsonSafe(path.join(configDir, "product-corrections.json"), {});
  const categoryOverrides = readJsonSafe(path.join(configDir, "category-overrides.json"), {});
  const supplierMap = readJsonSafe(path.join(configDir, "supplier-map.json"), {});

  const skuMerges = buildSkuMergeMap(productCorrections._meta?.skuMerges || []);
  const keywordRules = (categoryOverrides.keywordFallback || []).map((rule) => ({
    target: rule.target,
    pattern: new RegExp(rule.keywords.join("|"), "i"),
  }));
  const junkCategories = new Set(
    (categoryOverrides.junkCategories || []).map((c) => c.toUpperCase())
  );
  const productCategoryOverrides = categoryOverrides.productOverrides || {};
  const crossRefConfig = categoryOverrides.crossReference || { enabled: false };

  return {
    productCorrections,
    categoryOverrides,
    supplierMap,
    skuMerges,
    keywordRules,
    junkCategories,
    productCategoryOverrides,
    crossRefConfig,
  };
}

function buildSkuMergeMap(merges) {
  const map = new Map();
  for (const merge of merges) {
    for (const alias of merge.aliases || []) {
      map.set(alias.toUpperCase(), merge.canonical.toUpperCase());
    }
  }
  return map;
}

export function applyCategoryOverride(productKey, currentCategory, categoryLookup, config) {
  if (config.productCategoryOverrides[productKey]) {
    return { category: config.productCategoryOverrides[productKey], source: "product-override" };
  }

  if (
    config.crossRefConfig.enabled &&
    currentCategory.toUpperCase() === (config.crossRefConfig.targetCategory || "").toUpperCase()
  ) {
    const crossRefCat = categoryLookup.get(productKey);
    if (crossRefCat && crossRefCat.toUpperCase() !== currentCategory.toUpperCase()) {
      return { category: crossRefCat, source: "cross-reference" };
    }
    for (const rule of config.keywordRules) {
      if (rule.pattern.test(productKey)) {
        return { category: rule.target, source: "keyword" };
      }
    }
    return { category: currentCategory, source: "unmatched" };
  }

  return { category: currentCategory, source: "original" };
}

export function resolveSkuMerge(key, skuMerges) {
  return skuMerges.get(key.toUpperCase()) || key;
}

function readJsonSafe(fp, fallback) {
  if (!fs.existsSync(fp)) return fallback;
  return JSON.parse(fs.readFileSync(fp, "utf8"));
}
```

**Step 2: Verify it loads without error**

Run: `node -e "import('./scripts/lib/config-loader.mjs').then(m => { const c = m.loadMasterConfig(); console.log('Loaded:', Object.keys(c).join(', ')); })"`
Expected: `Loaded: productCorrections, categoryOverrides, supplierMap, skuMerges, keywordRules, junkCategories, productCategoryOverrides, crossRefConfig`

**Step 3: Commit**

```bash
git add scripts/lib/config-loader.mjs
git commit -m "feat: add config-loader utility for Master Config layer"
```

---

## Task 4: Restructure `import-silver.mjs` — two-pass with corrections

**Files:**
- Modify: `scripts/import-silver.mjs`

The current script parses each CSV and writes Silver immediately. We restructure to:
- Pass 1: Parse all CSVs into memory (same logic, no file writes)
- Pass 2: Build category cross-reference lookup, apply corrections, then write

**Step 1: Add imports**

At the top of `scripts/import-silver.mjs`, add after existing imports:

```javascript
import { loadMasterConfig, applyCategoryOverride, resolveSkuMerge } from "./lib/config-loader.mjs";
```

**Step 2: Restructure `run()` into two passes**

Replace the current `run()` function. The new version:
1. Parses all CSVs into `results` (existing logic, unchanged)
2. Loads Master Config
3. Builds a category lookup from 2024/2025 monthly-stats results
4. Applies SKU merges and category overrides to all results
5. Writes Silver with corrected data
6. Writes import-report.json with correction stats

```javascript
function run() {
  console.log(`\nImporting POS exports from: ${realDir}\n`);

  if (!fs.existsSync(realDir)) {
    console.log("No data/real/ directory found. Nothing to import.");
    process.exit(0);
  }

  const csvFiles = fs.readdirSync(realDir)
    .filter((f) => f.toLowerCase().endsWith(".csv"))
    .sort();

  if (csvFiles.length === 0) {
    console.log("No CSV files found in data/real/.");
    process.exit(0);
  }

  console.log(`Found ${csvFiles.length} CSV file(s):\n`);

  // --- Pass 1: Parse all CSVs ---
  const results = [];

  for (const file of csvFiles) {
    const filePath = path.join(realDir, file);
    try {
      const buffer = fs.readFileSync(filePath);
      const { text, encoding } = decodeBuffer(buffer);
      const lines = splitCsvLines(text);

      if (lines.length === 0) {
        console.log(`  ${file.padEnd(45)} → empty file`);
        results.push({ file, error: "empty", encoding });
        continue;
      }

      const fileType = detectFileType(lines[0]);
      const year = detectYearFromFilename(file);

      if (fileType === "unknown") {
        console.log(`  ${file.padEnd(45)} → unknown format (skipped)`);
        results.push({ file, error: "unknown format", encoding });
        continue;
      }

      let result;
      switch (fileType) {
        case "product-master":
          result = importProductMaster(text);
          break;
        case "monthly-stats":
          result = importMonthlyStats(text, file);
          break;
        case "annual-stats":
          result = importAnnualStats(text, file);
          break;
        case "transactions":
          result = importTransactions(text, file);
          break;
        case "category-mix":
          result = importCategoryMix(text, file);
          break;
        case "margin-analysis":
          result = importMargins(text, file);
          break;
        case "hourly-by-weekday":
          result = importHourlyPatterns(text, file);
          break;
      }

      if (!result.year && year) result.year = year;

      const count = countRows(result);
      const yearStr = result.year ? result.year : "?";
      console.log(`  ${file.padEnd(45)} → ${fileType.padEnd(18)} | ${encoding.padEnd(8)} | ${String(count).padStart(6)} rows | ${yearStr}`);
      if (result.warnings?.length) {
        result.warnings.forEach((w) => console.log(`    > ${w}`));
      }

      results.push({ file, encoding, fileType, year: result.year, ...result });
    } catch (err) {
      console.log(`  ${file.padEnd(45)} → ERROR: ${err.message}`);
      results.push({ file, error: err.message });
    }
  }

  // --- Pass 2: Apply corrections ---
  console.log("\nApplying Master Config corrections...\n");
  const config = loadMasterConfig();
  const correctionLog = applyCorrections(results, config);

  console.log(`  SKU merges applied: ${correctionLog.skuMerges}`);
  console.log(`  Categories reclassified: ${correctionLog.categoryReclassified}`);
  console.log(`    via cross-reference: ${correctionLog.crossRef}`);
  console.log(`    via keyword: ${correctionLog.keyword}`);
  console.log(`    unmatched FRAIS: ${correctionLog.unmatched}`);

  // --- Write Silver ---
  console.log("\nWriting Silver output:\n");
  fs.mkdirSync(silverDir, { recursive: true });

  writeSilver(results);

  const report = buildReport(csvFiles, results, correctionLog);
  fs.writeFileSync(path.join(silverDir, "import-report.json"), JSON.stringify(report, null, 2));
  console.log(`  import-report.json`);

  console.log(`\nSummary:`);
  console.log(`  Files: ${csvFiles.length} processed, ${results.filter((r) => !r.error).length} ok, ${results.filter((r) => r.error).length} skipped`);
  const years = [...new Set(results.filter((r) => r.year).map((r) => r.year))].sort();
  console.log(`  Years: ${years.join(", ")}`);
  console.log();
}
```

**Step 3: Add `applyCorrections()` function**

Add this new function after `countRows()`:

```javascript
function applyCorrections(results, config) {
  const log = { skuMerges: 0, categoryReclassified: 0, crossRef: 0, keyword: 0, unmatched: 0, unmatchedProducts: [] };

  // Build category lookup from source years (2024, 2025)
  const sourceYears = config.crossRefConfig.sourceYears || [];
  const categoryLookup = new Map();

  for (const r of results) {
    if (r.error || !sourceYears.includes(r.year)) continue;
    const products = r.products || [];
    for (const p of products) {
      if (p.category && p.category.toUpperCase() !== "FRAIS" && !categoryLookup.has(p.key)) {
        categoryLookup.set(p.key, p.category);
      }
    }
  }

  console.log(`  Category lookup built: ${categoryLookup.size} product→category mappings from years ${sourceYears.join(", ")}`);

  // Apply corrections to all results
  for (const r of results) {
    if (r.error) continue;

    // Apply to products arrays (monthly-stats, annual-stats, product-master)
    const products = r.products || [];
    for (const p of products) {
      // SKU merges
      const mergedKey = resolveSkuMerge(p.key, config.skuMerges);
      if (mergedKey !== p.key) {
        p.key = mergedKey;
        log.skuMerges++;
      }

      // Category overrides
      if (p.category) {
        const { category, source } = applyCategoryOverride(p.key, p.category, categoryLookup, config);
        if (source !== "original") {
          p.originalCategory = p.category;
          p.category = category;
          p.categorySource = source;
          log.categoryReclassified++;
          if (source === "cross-reference") log.crossRef++;
          else if (source === "keyword") log.keyword++;
          else if (source === "unmatched") {
            log.unmatched++;
            log.unmatchedProducts.push({ key: p.key, name: p.rawName || p.name, year: r.year });
          }
        }
      }
    }

    // Apply SKU merges to margins
    const margins = r.margins || [];
    for (const m of margins) {
      const mergedKey = resolveSkuMerge(m.key, config.skuMerges);
      if (mergedKey !== m.key) {
        m.key = mergedKey;
        log.skuMerges++;
      }
    }

    // Apply SKU merges to transactions
    const transactions = r.transactions || [];
    for (const t of transactions) {
      if (t.productKey) {
        const mergedKey = resolveSkuMerge(t.productKey, config.skuMerges);
        if (mergedKey !== t.productKey) {
          t.productKey = mergedKey;
          log.skuMerges++;
        }
      }
    }
  }

  return log;
}
```

**Step 4: Update `buildReport()` to include correction stats**

Replace the `buildReport` function:

```javascript
function buildReport(csvFiles, results, correctionLog) {
  return {
    importedAt: new Date().toISOString(),
    sourceDir: realDir,
    totalFiles: csvFiles.length,
    successful: results.filter((r) => !r.error).length,
    skipped: results.filter((r) => r.error).length,
    corrections: {
      skuMerges: correctionLog.skuMerges,
      categoryReclassified: correctionLog.categoryReclassified,
      crossReference: correctionLog.crossRef,
      keyword: correctionLog.keyword,
      unmatchedFrais: correctionLog.unmatched,
      unmatchedProducts: correctionLog.unmatchedProducts,
    },
    files: results.map((r) => ({
      file: r.file,
      fileType: r.fileType || "unknown",
      encoding: r.encoding || "unknown",
      year: r.year || null,
      rows: countRows(r),
      status: r.error ? "skipped" : "ok",
      warnings: r.warnings || [],
      error: r.error || null
    }))
  };
}
```

**Step 5: Run the import**

Run: `npm run import`
Expected: All 24 CSVs processed. Console shows correction stats. `data/silver/` populated with JSON files. `import-report.json` shows corrections applied.

**Step 6: Verify Silver output**

Run: `node -e "const r = JSON.parse(require('fs').readFileSync('data/silver/import-report.json','utf8')); console.log('Files:', r.totalFiles, '| OK:', r.successful, '| Corrections:', JSON.stringify(r.corrections))"`
Expected: 24 files, corrections object shows reclassification counts.

**Step 7: Commit**

```bash
git add scripts/import-silver.mjs
git commit -m "feat: two-pass import with Master Config corrections (FRAIS reclassification, SKU merges)"
```

---

## Task 5: Fix revenue source priority in `build-gold.mjs`

**Files:**
- Modify: `scripts/build-gold.mjs` — `buildStoreSummary()` function

**Step 1: Update `buildStoreSummary()` to use best revenue source per year**

The current function computes per-year revenue only from daily-sales (transactions). We add a priority cascade: monthly-stats > category-mix > transactions.

In `buildStoreSummary()`, after the existing `yearStats` computation from dailySales, add revenue override logic:

```javascript
// After the yearStats loop, before building the years array:

// Revenue priority cascade: monthly-stats > category-mix > transactions
const monthlyRevByYear = new Map();
for (const mf of monthlyFiles) {
  const total = mf.products.reduce((s, p) => s + p.totalRevenue, 0);
  monthlyRevByYear.set(mf.year, total);
}
const catMixRevByYear = new Map();
for (const cf of catFiles) {
  const total = cf.categories.reduce((s, c) => s + c.totalRevenue, 0);
  catMixRevByYear.set(cf.year, total);
}

// Ensure all years from all sources exist in yearStats
for (const year of [...monthlyRevByYear.keys(), ...catMixRevByYear.keys()]) {
  if (!yearStats.has(year)) {
    yearStats.set(year, { year, totalRevenue: 0, tradingDays: 0, dates: [] });
  }
}

for (const [year, ys] of yearStats) {
  const monthlyRev = monthlyRevByYear.get(year);
  const catMixRev = catMixRevByYear.get(year);
  const txRev = ys.totalRevenue;

  if (monthlyRev && monthlyRev > 0) {
    ys.totalRevenue = monthlyRev;
    ys.revenueSource = "monthly-stats";
  } else if (catMixRev && catMixRev > 0) {
    ys.totalRevenue = catMixRev;
    ys.revenueSource = "category-mix";
  } else {
    ys.revenueSource = "transactions";
  }
}
```

Also update the `years` mapping to include `revenueSource`:

```javascript
const years = [...yearStats.values()]
  .sort((a, b) => a.year - b.year)
  .map((ys) => ({
    year: ys.year,
    totalRevenue: Math.round(ys.totalRevenue),
    revenueSource: ys.revenueSource || "transactions",
    productCount: productCountByYear.get(ys.year) || 0,
    categoryCount: categoryCountByYear.get(ys.year) || 0,
    tradingDays: ys.tradingDays,
    avgDailyRevenue: ys.tradingDays > 0 ? Math.round(ys.totalRevenue / ys.tradingDays) : 0,
    isPartial: ys.year === currentYear
  }));
```

**Step 2: Run Gold build**

Run: `npm run build:gold`
Expected: `store-summary.json` shows 2025 revenue ~€500K, not €207K.

**Step 3: Verify**

Run: `node -e "const s = JSON.parse(require('fs').readFileSync('data/gold/store-summary.json','utf8')); s.years.forEach(y => console.log(y.year, '€'+y.totalRevenue, y.revenueSource))"`
Expected: 2025 revenue > €400K with source "monthly-stats" or "category-mix".

**Step 4: Commit**

```bash
git add scripts/build-gold.mjs
git commit -m "fix: revenue source priority cascade (monthly-stats > category-mix > transactions)"
```

---

## Task 6: Filter junk categories in Gold

**Files:**
- Modify: `scripts/build-gold.mjs` — `buildCategoryEvolution()` function

**Step 1: Add junk category filtering**

At the top of `build-gold.mjs`, add:

```javascript
import { loadMasterConfig } from "./lib/config-loader.mjs";
```

In `buildCategoryEvolution()`, after reading category files and before building `byCategory`, add filtering:

```javascript
const config = loadMasterConfig();
const junkPattern = new RegExp(
  `^(${[...config.junkCategories].map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
  'i'
);
```

Then in the loop where categories are processed, skip junk:

```javascript
for (const cf of catFiles) {
  for (const c of cf.categories) {
    const baseCategory = c.category.replace(/^\d+\.\s*/, "").replace(/\s+\d+%$/, "").trim();
    if (junkPattern.test(baseCategory)) continue;
    // ... existing logic
  }
}
```

**Step 2: Run Gold build**

Run: `npm run build:gold`

**Step 3: Verify no DIV. EAN categories in output**

Run: `node -e "const e = JSON.parse(require('fs').readFileSync('data/gold/category-evolution.json','utf8')); const junk = e.filter(c => /DIV\. EAN|Fictif|CARTE CADEAUX/i.test(c.category)); console.log('Junk categories:', junk.length)"`
Expected: `Junk categories: 0`

**Step 4: Commit**

```bash
git add scripts/build-gold.mjs
git commit -m "fix: filter junk categories (DIV. EAN, Fictif, etc.) from category-evolution"
```

---

## Task 7: Build demo and smoke-test

**Files:**
- No code changes — execution only.

**Step 1: Build demo**

Run: `npm run build:demo`
Expected: `demo/data/demo.json` written successfully.

**Step 2: Verify demo structure**

Run: `node -e "const d = JSON.parse(require('fs').readFileSync('demo/data/demo.json','utf8')); console.log('KPIs:', JSON.stringify(d.kpis)); console.log('Categories:', d.categoryMix.length); console.log('Suppliers:', d.supplierRanking.length); console.log('Macro years:', d.macro.years.map(y => y.year+':€'+y.revenue).join(', ')); console.log('Timeline:', d.macro.timeline.length, 'months'); console.log('Weekly:', d.weeklyMetrics ? 'yes' : 'null')"`

Expected: KPIs with real numbers, categories > 10, macro years showing ~€500K for 2025, timeline populated, weeklyMetrics present.

**Step 3: Start dev server and open dashboard**

Run: `npm run serve`
Open `http://localhost:4173` in browser. Verify:
- KPIs render with real numbers
- Top products list looks correct
- Supplier panels show real data
- No JavaScript errors in console

---

## Task 8: Expand automated validation

**Files:**
- Modify: `scripts/verify-data.mjs`

**Step 1: Add business-logic assertions**

After the existing "Data coherence" section (around line 78), add:

```javascript
console.log("\nBusiness-logic checks:\n");

check("Saturday avg revenue > Tuesday avg revenue", () => {
  const byDay = new Map();
  for (const d of dailySales) {
    const dow = d.dayOfWeek || new Date(d.date).getDay();
    if (!byDay.has(dow)) byDay.set(dow, { total: 0, count: 0 });
    const entry = byDay.get(dow);
    entry.total += d.revenue;
    entry.count++;
  }
  const satAvg = byDay.has(6) ? byDay.get(6).total / byDay.get(6).count : 0;
  const tueAvg = byDay.has(2) ? byDay.get(2).total / byDay.get(2).count : 0;
  assert.ok(satAvg > tueAvg, `Saturday avg €${satAvg.toFixed(0)} <= Tuesday avg €${tueAvg.toFixed(0)}`);
});

check("hourly heatmap peak between 10h-13h", () => {
  const heatmap = readJson(path.join(goldDir, "hourly-heatmap.json"));
  const hourTotals = new Map();
  for (const e of heatmap.entries) {
    const hour = e.hour;
    hourTotals.set(hour, (hourTotals.get(hour) || 0) + (e.revenue || e.totalRevenue || 0));
  }
  let peakHour = 0, peakRev = 0;
  for (const [h, rev] of hourTotals) {
    if (rev > peakRev) { peakHour = h; peakRev = rev; }
  }
  assert.ok(peakHour >= 10 && peakHour <= 13, `peak hour is ${peakHour}, expected 10-13`);
});

check("per-year revenue > €400K in store-summary (catches partial-data bug)", () => {
  const fullYears = storeSummary.years.filter((y) => !y.isPartial);
  for (const y of fullYears) {
    assert.ok(y.totalRevenue > 400000, `${y.year} revenue €${y.totalRevenue} < €400K — likely using incomplete data source`);
  }
});

check("FRAIS category small after reclassification", () => {
  const catEvolution = readJson(path.join(goldDir, "category-evolution.json"));
  const frais = catEvolution.find((c) => c.category.toUpperCase() === "FRAIS");
  if (frais) {
    const totalRevAllCats = catEvolution.reduce((s, c) => s + c.years.reduce((sy, y) => sy + y.revenue, 0), 0);
    const fraisRev = frais.years.reduce((s, y) => s + y.revenue, 0);
    const fraisShare = fraisRev / totalRevAllCats;
    assert.ok(fraisShare < 0.05, `FRAIS is ${(fraisShare * 100).toFixed(1)}% of total — reclassification may have missed items`);
  }
});

check("no duplicate SKUs in product-catalog", () => {
  const keys = catalog.map((p) => p.key);
  const unique = new Set(keys);
  const dupeCount = keys.length - unique.size;
  assert.ok(dupeCount === 0, `${dupeCount} duplicate key(s) found — check SKU merge config`);
});
```

**Step 2: Run tests**

Run: `npm run test`
Expected: All checks pass. If any fail, investigate and fix upstream (config or build scripts).

**Step 3: Commit**

```bash
git add scripts/verify-data.mjs
git commit -m "feat: add business-logic assertions (revenue floor, FRAIS share, hourly peak, etc.)"
```

---

## Task 9: Integrate 2024 margin export

**Files:**
- No code changes — user action + pipeline re-run.

**Step 1: User exports margin data**

Julien: Export margin stats for 01/01/2024–31/12/2024 from the POS. Save as `data/real/margin-analysis-2024.csv`.

**Step 2: Re-run full pipeline**

Run: `npm run build:full`
Expected: Pipeline processes the new file. `data/silver/margins-2024.json` appears. `data/gold/margin-ranking.json` now includes 2024 data.

**Step 3: Verify margins**

Run: `node -e "const m = JSON.parse(require('fs').readFileSync('data/gold/margin-ranking.json','utf8')); console.log('Products with margin data:', m.length)"`
Expected: Product count increases compared to before adding 2024 data.

**Step 4: Re-run tests**

Run: `node scripts/verify-data.mjs`
Expected: All checks pass.

---

## Task 10: Manual validation session

**Files:**
- No code changes — review with the user.

**Step 1: Review daily-sales**

```bash
node -e "
const d = JSON.parse(require('fs').readFileSync('data/gold/daily-sales.json','utf8'));
const byYear = new Map();
for (const day of d) {
  const y = day.date.slice(0,4);
  if (!byYear.has(y)) byYear.set(y, { days: 0, rev: 0 });
  byYear.get(y).days++;
  byYear.get(y).rev += day.revenue;
}
for (const [y, s] of [...byYear].sort()) {
  console.log(y + ': ' + s.days + ' days, €' + Math.round(s.rev) + ' total, €' + Math.round(s.rev/s.days) + '/day avg');
}
"
```

Ask Julien: Do these daily averages look right? ~€1,500-2,000 on a Saturday?

**Step 2: Review hourly heatmap**

```bash
node -e "
const h = JSON.parse(require('fs').readFileSync('data/gold/hourly-heatmap.json','utf8'));
const byHour = new Map();
for (const e of h.entries) {
  const key = e.dayOfWeek + ':' + String(e.hour).padStart(2,'0');
  byHour.set(key, (byHour.get(key) || 0) + (e.revenue || e.totalRevenue || 0));
}
const sorted = [...byHour].sort((a,b) => b[1] - a[1]).slice(0,10);
console.log('Top 10 day:hour slots:');
sorted.forEach(([k,v]) => console.log('  ' + k + ' → €' + Math.round(v)));
"
```

Ask Julien: Is Saturday 11h the peak? Is Monday near-zero?

**Step 3: Review category YoY after FRAIS reclassification**

```bash
node -e "
const e = JSON.parse(require('fs').readFileSync('data/gold/category-evolution.json','utf8'));
const fromage = e.find(c => /fromage/i.test(c.category));
if (fromage) {
  console.log('FROMAGE by year:');
  fromage.years.forEach(y => console.log('  ' + y.year + ': €' + Math.round(y.revenue)));
}
const frais = e.find(c => c.category.toUpperCase() === 'FRAIS');
if (frais) {
  console.log('Residual FRAIS:');
  frais.years.forEach(y => console.log('  ' + y.year + ': €' + Math.round(y.revenue)));
}
"
```

Ask Julien: Does FROMAGE 2023→2024 growth look realistic now (not 200%+)?

---

## Task 11: Update supplier map with missing mappings

**Files:**
- Modify: `sample-data/config/supplier-map.json`

**Step 1: Find unmapped suppliers**

```bash
node -e "
const products = JSON.parse(require('fs').readFileSync('data/silver/products.json','utf8'));
const map = JSON.parse(require('fs').readFileSync('sample-data/config/supplier-map.json','utf8'));
const mapped = new Set(Object.keys(map).filter(k => !k.startsWith('_')));
const unmapped = new Map();
for (const p of products) {
  if (p.supplier && !mapped.has(p.supplier)) {
    unmapped.set(p.supplier, (unmapped.get(p.supplier) || 0) + 1);
  }
}
const sorted = [...unmapped].sort((a,b) => b[1] - a[1]);
console.log('Unmapped suppliers (' + sorted.length + '):');
sorted.forEach(([name, count]) => console.log('  ' + name + ' (' + count + ' products)'));
"
```

**Step 2: Add missing mappings**

For each unmapped supplier with significant product count, add an entry to `supplier-map.json`. Use your judgment on canonical names.

**Step 3: Re-run pipeline**

Run: `npm run build:full && node scripts/verify-data.mjs`

**Step 4: Commit**

```bash
git add sample-data/config/supplier-map.json
git commit -m "fix: add missing supplier mappings found during Silver import"
```

---

## Task 12: Commit & document

**Files:**
- Modify: `docs/DEV_LOG.md`
- Create: `docs/DEV_LOG_DAY3B.md` (evening session)

**Step 1: Write the day log**

Document:
- Pipeline now runs end-to-end (Bronze → Silver → Gold → demo.json)
- Master Config layer introduced (category-overrides.json, product-identity in product-corrections.json)
- FRAIS reclassification applied via hybrid cross-reference + keyword
- Revenue discrepancy resolved (priority cascade)
- What Gold files now contain
- Validation passes
- What analyses are now possible

**Step 2: Update DEV_LOG.md**

Add a link to the new day log.

**Step 3: Final commit**

```bash
git add docs/DEV_LOG.md docs/DEV_LOG_DAY3B.md docs/plans/2026-03-11-data-validation-pipeline-design.md docs/plans/2026-03-11-data-validation-pipeline-plan.md
git commit -m "docs: day 3 evening — pipeline completion, FRAIS reclassification, validation"
```
