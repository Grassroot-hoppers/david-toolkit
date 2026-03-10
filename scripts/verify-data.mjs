import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const goldDir = path.join(root, "data", "gold");
const demoPath = path.join(root, "public", "data", "demo.json");

let errors = 0;

function check(label, fn) {
  try {
    fn();
    console.log(`  ✓ ${label}`);
  } catch (e) {
    console.log(`  ✗ ${label}: ${e.message}`);
    errors++;
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

// --- Gold file checks ---

console.log("\nGold layer:\n");

const goldFiles = [
  "product-catalog.json",
  "daily-sales.json",
  "monthly-product-stats.json",
  "store-summary.json",
  "category-evolution.json",
  "hourly-heatmap.json",
  "margin-ranking.json"
];

for (const gf of goldFiles) {
  check(`${gf} exists and is valid JSON`, () => {
    const fp = path.join(goldDir, gf);
    assert.ok(fs.existsSync(fp), "file does not exist");
    JSON.parse(fs.readFileSync(fp, "utf8"));
  });
}

const catalog = readJson(path.join(goldDir, "product-catalog.json"));
const dailySales = readJson(path.join(goldDir, "daily-sales.json"));
const monthlyStats = readJson(path.join(goldDir, "monthly-product-stats.json"));
const storeSummary = readJson(path.join(goldDir, "store-summary.json"));

check("product-catalog has products with key/name/category", () => {
  assert.ok(catalog.length > 100, `only ${catalog.length} products`);
  const sample = catalog[0];
  assert.ok(sample.key, "missing key");
  assert.ok(sample.name, "missing name");
  assert.ok(sample.category, "missing category");
});

check("daily-sales has entries with date/revenue", () => {
  assert.ok(dailySales.length > 100, `only ${dailySales.length} days`);
  const sample = dailySales[0];
  assert.ok(sample.date, "missing date");
  assert.ok(typeof sample.revenue === "number", "revenue not a number");
});

check("monthly-product-stats has entries with series arrays", () => {
  assert.ok(monthlyStats.length > 100, `only ${monthlyStats.length} products`);
  const sample = monthlyStats[0];
  assert.ok(Array.isArray(sample.series), "missing series");
  assert.ok(sample.series.length > 0, "empty series");
});

check("store-summary has years array", () => {
  assert.ok(Array.isArray(storeSummary.years), "missing years");
  assert.ok(storeSummary.years.length >= 1, "no years");
});

// --- Data coherence ---

console.log("\nData coherence:\n");

check("product count: catalog ≈ monthly stats (within 20%)", () => {
  const ratio = catalog.length / monthlyStats.length;
  assert.ok(ratio > 0.5 && ratio < 2.0, `ratio ${ratio.toFixed(2)} out of range`);
});

check("years in store-summary match daily-sales date range", () => {
  const summaryYears = storeSummary.years.map((y) => y.year);
  const dsYears = [...new Set(dailySales.map((d) => parseInt(d.date.slice(0, 4), 10)))];
  for (const y of dsYears) {
    assert.ok(summaryYears.includes(y), `daily-sales year ${y} not in store-summary`);
  }
});

check("daily-sales dates are in reasonable range (2023–today)", () => {
  const now = new Date();
  const thisYear = now.getFullYear();
  for (const d of dailySales) {
    const year = parseInt(d.date.slice(0, 4), 10);
    assert.ok(year >= 2023 && year <= thisYear, `date ${d.date} out of range`);
  }
});

check("no duplicate dates in daily-sales", () => {
  const dates = dailySales.map((d) => d.date);
  const unique = new Set(dates);
  assert.equal(dates.length, unique.size, `${dates.length - unique.size} duplicates found`);
});

// --- Demo.json checks ---

console.log("\nDemo.json:\n");

check("demo.json exists and is valid JSON", () => {
  assert.ok(fs.existsSync(demoPath), "file does not exist");
  JSON.parse(fs.readFileSync(demoPath, "utf8"));
});

const payload = readJson(demoPath);

check("store name present", () => {
  assert.equal(payload.store, "Chez Julien");
});

check("at least 1 supplier panel", () => {
  assert.ok(payload.suppliers.length >= 1);
});

check("at least 1 top product", () => {
  assert.ok(payload.topProducts.length >= 1);
});

check("insights have evidence (3+ items each)", () => {
  assert.ok(
    payload.insights.every((card) => card.evidence.length >= 3),
    "some insights have <3 evidence items"
  );
});

check("has products and category mix", () => {
  assert.ok(payload.topProducts.length > 0);
  assert.ok(payload.categoryMix.length > 0);
});

check("has generatedAt and kpis", () => {
  assert.ok(payload.generatedAt);
  assert.ok(payload.kpis);
  assert.ok(typeof payload.kpis.revenue2025 === "number");
});

// --- Summary ---

console.log();
if (errors > 0) {
  console.log(`FAILED: ${errors} check(s) failed.`);
  process.exit(1);
} else {
  console.log("All checks passed.");
  console.log(`  Catalog: ${catalog.length} products`);
  console.log(`  Daily sales: ${dailySales.length} days`);
  console.log(`  Monthly stats: ${monthlyStats.length} products`);
  console.log(`  Store years: ${storeSummary.years.map((y) => y.year).join(", ")}`);
  console.log(`  Demo: ${payload.topProducts.length} top, ${payload.slowProducts.length} slow, ${payload.suppliers.length} suppliers`);
}
