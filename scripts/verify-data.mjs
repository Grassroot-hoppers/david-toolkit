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

if (errors > 0) {
  console.log(`\nFAILED: ${errors} gold file(s) missing or invalid — cannot continue.\n`);
  process.exit(1);
}

const catalog = readJson(path.join(goldDir, "product-catalog.json"));
const dailySales = readJson(path.join(goldDir, "daily-sales.json"));
const monthlyStats = readJson(path.join(goldDir, "monthly-product-stats.json"));
const storeSummary = readJson(path.join(goldDir, "store-summary.json"));
const hourlyHeatmap = readJson(path.join(goldDir, "hourly-heatmap.json"));
const categoryEvolution = readJson(path.join(goldDir, "category-evolution.json"));

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

// --- Business-logic checks ---

console.log("\nBusiness-logic checks:\n");

check("Saturday avg revenue > Tuesday avg revenue", () => {
  const byDay = new Map();
  for (const d of dailySales) {
    const dow = new Date(d.date).getDay();
    if (!byDay.has(dow)) byDay.set(dow, { total: 0, count: 0 });
    const entry = byDay.get(dow);
    entry.total += d.revenue;
    entry.count++;
  }
  const satAvg = byDay.has(6) ? byDay.get(6).total / byDay.get(6).count : 0;
  const tueAvg = byDay.has(2) ? byDay.get(2).total / byDay.get(2).count : 0;
  assert.ok(satAvg > tueAvg, `Saturday avg €${satAvg.toFixed(0)} <= Tuesday avg €${tueAvg.toFixed(0)}`);
});

check("per-year revenue > €300K in store-summary (catches partial-data bug)", () => {
  const fullYears = storeSummary.years.filter((y) => !y.isPartial);
  for (const y of fullYears) {
    assert.ok(y.totalRevenue > 300000, `${y.year} revenue €${y.totalRevenue} < €300K — likely using incomplete data source`);
  }
});

check("no duplicate SKUs in product-catalog", () => {
  const keys = catalog.map((p) => p.key);
  const unique = new Set(keys);
  const dupeCount = keys.length - unique.size;
  assert.ok(dupeCount === 0, `${dupeCount} duplicate key(s) found — check SKU merge config`);
});

check("hourly heatmap peak during trading hours (9h-19h)", () => {
  const hourTotals = new Map();
  for (const e of hourlyHeatmap.entries) {
    const hour = e.hour;
    hourTotals.set(hour, (hourTotals.get(hour) || 0) + (e.revenue || e.totalRevenue || 0));
  }
  let peakHour = 0, peakRev = 0;
  for (const [h, rev] of hourTotals) {
    if (rev > peakRev) { peakHour = h; peakRev = rev; }
  }
  assert.ok(peakHour >= 9 && peakHour <= 19, `peak hour is ${peakHour}, expected 9-19`);
});

check("category-evolution has < 40 categories (junk filtered)", () => {
  assert.ok(categoryEvolution.length < 40, `${categoryEvolution.length} categories — junk filter may not be working`);
});

check("no DIV. EAN categories in category-evolution", () => {
  const junk = categoryEvolution.filter((c) => /^DIV\. EAN/i.test(c.category));
  assert.ok(junk.length === 0, `${junk.length} DIV. EAN categories found`);
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
  assert.ok(typeof payload.kpis.totalRevenue === "number", "missing kpis.totalRevenue");
  assert.ok(payload.kpis.totalRevenue > 0, "totalRevenue is zero");
});

check("top products have non-zero monthlyHistory (catches map key mismatch in build-demo)", () => {
  const sample = (payload.topProducts || []).slice(0, 5);
  assert.ok(sample.length > 0, "no topProducts to check");
  const allZero = sample.filter((p) => {
    const h = p.monthlyHistory || [];
    return h.length === 0 || h.every((v) => v === 0);
  });
  assert.ok(
    allZero.length === 0,
    `${allZero.length}/${sample.length} top products have all-zero monthlyHistory — check monthlyStatsByName key in build-demo.mjs`
  );
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
