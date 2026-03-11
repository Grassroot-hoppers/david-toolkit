import fs from "node:fs";
import path from "node:path";
import { decodeBuffer, splitCsvLines, detectFileType, detectYearFromFilename } from "./lib/csv-utils.mjs";
import { importProductMaster } from "./importers/product-master.mjs";
import { importMonthlyStats } from "./importers/monthly-stats.mjs";
import { importAnnualStats } from "./importers/annual-stats.mjs";
import { importTransactions } from "./importers/transactions.mjs";
import { importCategoryMix } from "./importers/category-mix.mjs";
import { importMargins } from "./importers/margins.mjs";
import { importHourlyPatterns } from "./importers/hourly-patterns.mjs";
import { loadMasterConfig, applyCategoryOverride, resolveSkuMerge } from "./lib/config-loader.mjs";

const root = process.cwd();
const realDir = path.join(root, "data", "real");
const silverDir = path.join(root, "data", "silver");

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

function countRows(result) {
  return result.products?.length
    || result.transactions?.length
    || result.categories?.length
    || result.margins?.length
    || result.entries?.length
    || 0;
}

function applyCorrections(results, config) {
  const log = { skuMerges: 0, categoryReclassified: 0, crossRef: 0, keyword: 0, unmatched: 0, unmatchedProducts: [] };

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

  for (const r of results) {
    if (r.error) continue;

    const products = r.products || [];
    for (const p of products) {
      const mergedKey = resolveSkuMerge(p.key, config.skuMerges);
      if (mergedKey !== p.key) {
        p.key = mergedKey;
        log.skuMerges++;
      }

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

    const margins = r.margins || [];
    for (const m of margins) {
      const mergedKey = resolveSkuMerge(m.key, config.skuMerges);
      if (mergedKey !== m.key) {
        m.key = mergedKey;
        log.skuMerges++;
      }
    }

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

function writeSilver(results) {
  // Product masters — merge full + active
  const productMasters = results.filter((r) => r.fileType === "product-master");
  if (productMasters.length > 0) {
    const allProducts = new Map();
    let fullFile = null;
    let activeFile = null;

    for (const pm of productMasters) {
      const isActive = pm.file.toLowerCase().includes("active");
      if (isActive) activeFile = pm;
      else fullFile = pm;
      for (const p of pm.products) {
        if (!allProducts.has(p.key)) allProducts.set(p.key, { ...p, active: isActive });
      }
    }

    if (fullFile && activeFile) {
      const activeKeys = new Set(activeFile.products.map((p) => p.key));
      for (const [key, p] of allProducts) {
        p.active = activeKeys.has(key);
      }
    }

    const products = [...allProducts.values()];
    writeJson("products.json", products);
    console.log(`  products.json (${products.length} products)`);
  }

  // Group other results by type and year
  const byTypeYear = {};
  for (const r of results) {
    if (r.error || r.fileType === "product-master") continue;
    const key = `${r.fileType}-${r.year}`;
    if (!byTypeYear[key]) byTypeYear[key] = { fileType: r.fileType, year: r.year, results: [] };
    byTypeYear[key].results.push(r);
  }

  for (const { fileType, year, results: group } of Object.values(byTypeYear)) {
    switch (fileType) {
      case "monthly-stats": {
        const merged = group.flatMap((r) => r.products);
        const filename = `monthly-stats-${year}.json`;
        writeJson(filename, { year, products: merged });
        console.log(`  ${filename} (${merged.length} products)`);
        break;
      }
      case "annual-stats": {
        const products = group.flatMap((r) => r.products);
        const refunds = group.flatMap((r) => r.refunds || []);
        const filename = `annual-stats-${year}.json`;
        writeJson(filename, { year, products, refunds });
        console.log(`  ${filename} (${products.length} products, ${refunds.length} refunds)`);
        break;
      }
      case "transactions": {
        const transactions = group.flatMap((r) => r.transactions);
        const filename = `transactions-${year}.json`;
        writeJson(filename, { year, transactions });
        console.log(`  ${filename} (${transactions.length} transactions)`);
        break;
      }
      case "category-mix": {
        const categories = group.flatMap((r) => r.categories);
        const filename = `category-mix-${year}.json`;
        writeJson(filename, { year, categories });
        console.log(`  ${filename} (${categories.length} categories)`);
        break;
      }
      case "margin-analysis": {
        // Merge multiple margin files for the same year (H1+H2)
        const mergedMargins = new Map();
        for (const r of group) {
          for (const m of r.margins) {
            if (mergedMargins.has(m.key)) {
              const existing = mergedMargins.get(m.key);
              existing.salesTtc += m.salesTtc;
              existing.salesHt += m.salesHt;
              existing.purchaseHt += m.purchaseHt;
              existing.marginHt += m.marginHt;
              existing.transactionCount += m.transactionCount;
              existing.marginRatio = existing.purchaseHt > 0
                ? Math.round((existing.salesHt / existing.purchaseHt) * 100) / 100
                : 0;
            } else {
              mergedMargins.set(m.key, { ...m });
            }
          }
        }
        const margins = [...mergedMargins.values()];
        const filename = `margins-${year}.json`;
        writeJson(filename, { year, margins });
        console.log(`  ${filename} (${margins.length} products from ${group.length} file(s))`);
        break;
      }
      case "hourly-by-weekday": {
        const entries = group.flatMap((r) => r.entries);
        const filename = `hourly-patterns-${year}.json`;
        writeJson(filename, { year, entries });
        console.log(`  ${filename} (${entries.length} entries)`);
        break;
      }
    }
  }
}

function writeJson(filename, data) {
  fs.writeFileSync(path.join(silverDir, filename), JSON.stringify(data, null, 2));
}

function buildReport(csvFiles, results, correctionLog) {
  return {
    importedAt: new Date().toISOString(),
    sourceDir: realDir,
    totalFiles: csvFiles.length,
    successful: results.filter((r) => !r.error).length,
    skipped: results.filter((r) => r.error).length,
    corrections: correctionLog ? {
      skuMerges: correctionLog.skuMerges,
      categoryReclassified: correctionLog.categoryReclassified,
      crossReference: correctionLog.crossRef,
      keyword: correctionLog.keyword,
      unmatchedFrais: correctionLog.unmatched,
      unmatchedProducts: correctionLog.unmatchedProducts,
    } : null,
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

run();
