import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const silverDir = path.join(root, "data", "silver");
const goldDir = path.join(root, "data", "gold");

// --- Helpers ---

function readSilver(filename) {
  const fp = path.join(silverDir, filename);
  if (!fs.existsSync(fp)) return null;
  return JSON.parse(fs.readFileSync(fp, "utf8"));
}

function readSilverGlob(prefix) {
  if (!fs.existsSync(silverDir)) return [];
  return fs.readdirSync(silverDir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .sort()
    .map((f) => readSilver(f))
    .filter(Boolean);
}

function writeGold(filename, data) {
  fs.writeFileSync(path.join(goldDir, filename), JSON.stringify(data, null, 2));
}

// --- Task 11: Product Catalog ---

function buildProductCatalog() {
  const masterData = readSilver("products.json");
  const monthlyFiles = readSilverGlob("monthly-stats-");
  const marginFiles = readSilverGlob("margins-");
  const annualFiles = readSilverGlob("annual-stats-");

  if (!masterData) {
    console.log("  [product-catalog] No products.json in Silver — skipping");
    return null;
  }

  const marginsByKey = new Map();
  for (const mf of marginFiles) {
    for (const m of mf.margins) {
      if (!marginsByKey.has(m.key)) marginsByKey.set(m.key, m);
      else {
        const existing = marginsByKey.get(m.key);
        existing.salesHt += m.salesHt;
        existing.purchaseHt += m.purchaseHt;
        existing.marginHt += m.marginHt;
        existing.marginRatio = existing.purchaseHt > 0
          ? Math.round((existing.salesHt / existing.purchaseHt) * 100) / 100 : 0;
      }
    }
  }

  // Collect per-year stats from monthly and annual data
  const yearlyByKey = new Map();
  for (const mf of monthlyFiles) {
    for (const p of mf.products) {
      if (!yearlyByKey.has(p.key)) yearlyByKey.set(p.key, []);
      yearlyByKey.get(p.key).push({ year: mf.year, revenue: p.totalRevenue, quantity: p.totalQuantity, stock: p.stock });
    }
  }
  for (const af of annualFiles) {
    for (const p of af.products) {
      if (!yearlyByKey.has(p.key)) yearlyByKey.set(p.key, []);
      const arr = yearlyByKey.get(p.key);
      if (!arr.find((e) => e.year === af.year)) {
        arr.push({ year: af.year, revenue: p.revenue, quantity: p.quantity });
      }
    }
  }

  const allYears = [...new Set([
    ...monthlyFiles.map((f) => f.year),
    ...annualFiles.map((f) => f.year)
  ])].sort();
  const latestYear = allYears[allYears.length - 1];
  const prevYear = allYears.length >= 2 ? allYears[allYears.length - 2] : null;

  const catalog = masterData.map((p) => {
    const margin = marginsByKey.get(p.key);
    const yearEntries = (yearlyByKey.get(p.key) || []).sort((a, b) => a.year - b.year);
    const yearsActive = yearEntries.map((e) => e.year);

    const latest = yearEntries.find((e) => e.year === latestYear);
    const prev = prevYear ? yearEntries.find((e) => e.year === prevYear) : null;
    const latestRevenue = latest?.revenue || 0;
    const prevRevenue = prev?.revenue || 0;

    let lifecycle = "stable";
    if (yearsActive.length === 0 || (latestRevenue === 0 && prevRevenue === 0)) {
      lifecycle = "dead";
    } else if (!prev && latest) {
      lifecycle = "new";
    } else if (prev && !latest) {
      lifecycle = "declining";
    } else if (prev && latest) {
      const change = prevRevenue > 0 ? (latestRevenue - prevRevenue) / prevRevenue : 0;
      if (change > 0.10) lifecycle = "growing";
      else if (change < -0.10) lifecycle = "declining";
    }

    return {
      key: p.key,
      name: p.name,
      ean: p.ean,
      category: p.category,
      subcategory: p.subcategory,
      supplier: p.supplier,
      salePrice: p.salePrice,
      purchasePrice: p.purchasePrice,
      marginRatio: margin?.marginRatio || 0,
      vatRate: p.vatRate,
      bioLabel: p.bioLabel,
      stock: p.stock,
      lifecycle,
      yearsActive,
      latestRevenue,
      latestQuantity: latest?.quantity || 0,
      active: p.active
    };
  });

  writeGold("product-catalog.json", catalog);
  console.log(`  product-catalog.json (${catalog.length} products)`);
  return catalog;
}

// --- Task 12: Daily Sales ---

function buildDailySales() {
  const txFiles = readSilverGlob("transactions-");
  if (txFiles.length === 0) {
    console.log("  [daily-sales] No transaction files — skipping");
    return null;
  }

  const dayMap = new Map();

  for (const tf of txFiles) {
    for (const tx of tf.transactions) {
      if (!dayMap.has(tx.date)) {
        dayMap.set(tx.date, {
          date: tx.date,
          dayOfWeek: tx.dayOfWeek,
          revenue: 0,
          itemCount: 0,
          timestamps: new Set(),
          payCard: 0,
          payCash: 0
        });
      }
      const day = dayMap.get(tx.date);
      day.revenue += tx.price;
      day.itemCount++;
      day.timestamps.add(tx.timestamp);
      if (tx.paymentMethod === "card") day.payCard += tx.price;
      else if (tx.paymentMethod === "cash") day.payCash += tx.price;
    }
  }

  const daily = [...dayMap.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      date: d.date,
      dayOfWeek: d.dayOfWeek,
      revenue: Math.round(d.revenue * 100) / 100,
      transactionCount: d.timestamps.size,
      itemCount: d.itemCount,
      avgBasket: d.timestamps.size > 0 ? Math.round((d.revenue / d.timestamps.size) * 100) / 100 : 0,
      paymentMix: {
        card: Math.round(d.payCard * 100) / 100,
        cash: Math.round(d.payCash * 100) / 100
      }
    }));

  writeGold("daily-sales.json", daily);
  console.log(`  daily-sales.json (${daily.length} days)`);
  return daily;
}

// --- Task 13: Monthly Product Stats ---

function buildMonthlyProductStats() {
  const monthlyFiles = readSilverGlob("monthly-stats-");
  if (monthlyFiles.length === 0) {
    console.log("  [monthly-product-stats] No monthly stats — skipping");
    return null;
  }

  const byKey = new Map();

  for (const mf of monthlyFiles) {
    for (const p of mf.products) {
      if (!byKey.has(p.key)) {
        byKey.set(p.key, {
          key: p.key,
          name: p.rawName,
          supplier: p.supplier,
          category: p.category,
          series: [],
          annualTotals: []
        });
      }
      const entry = byKey.get(p.key);
      for (const m of p.monthly) {
        entry.series.push({ year: mf.year, month: m.month, quantity: m.quantity, revenue: m.revenue });
      }
      entry.annualTotals.push({ year: mf.year, quantity: p.totalQuantity, revenue: p.totalRevenue });
    }
  }

  const stats = [...byKey.values()].map((e) => ({
    ...e,
    series: e.series.sort((a, b) => a.year - b.year || a.month - b.month),
    annualTotals: e.annualTotals.sort((a, b) => a.year - b.year)
  }));

  writeGold("monthly-product-stats.json", stats);
  console.log(`  monthly-product-stats.json (${stats.length} products)`);
  return stats;
}

// --- Task 14: Category Evolution ---

function buildCategoryEvolution() {
  const catFiles = readSilverGlob("category-mix-");
  if (catFiles.length === 0) {
    console.log("  [category-evolution] No category mix files — skipping");
    return null;
  }

  const byCategory = new Map();
  const JUNK_RE = /^(DIV\. EAN|Fictif|CARTE CADEAUX|\(uncategorized\))/i;

  for (const cf of catFiles) {
    for (const c of cf.categories) {
      const stripped = c.category.replace(/^\d+\.\s*/, "").replace(/\s+\d+%$/, "").trim();
      if (!stripped || JUNK_RE.test(stripped) || JUNK_RE.test(c.category)) continue;
      const baseCategory = stripped;
      if (!byCategory.has(baseCategory)) {
        byCategory.set(baseCategory, { category: baseCategory, years: new Map() });
      }
      const entry = byCategory.get(baseCategory);
      if (!entry.years.has(cf.year)) {
        entry.years.set(cf.year, { year: cf.year, revenue: 0, share: 0, productCount: 0 });
      }
      const yr = entry.years.get(cf.year);
      yr.revenue += c.totalRevenue;
      yr.share += c.share;
      yr.productCount += c.productCount;
    }
  }

  const evolution = [...byCategory.values()].map((e) => ({
    category: e.category,
    years: [...e.years.values()].sort((a, b) => a.year - b.year).map((y) => ({
      ...y,
      revenue: Math.round(y.revenue * 100) / 100,
      share: Math.round(y.share * 100) / 100
    }))
  }));

  writeGold("category-evolution.json", evolution);
  console.log(`  category-evolution.json (${evolution.length} categories)`);
  return evolution;
}

// --- Task 15: Hourly Heatmap ---

function buildHourlyHeatmap() {
  const hourlyFiles = readSilverGlob("hourly-patterns-");
  if (hourlyFiles.length === 0) {
    console.log("  [hourly-heatmap] No hourly files — skipping");
    return null;
  }

  const years = hourlyFiles.map((f) => f.year).sort();
  const entries = hourlyFiles.flatMap((f) =>
    f.entries.map((e) => ({ year: f.year, ...e }))
  );

  const heatmap = { years, entries };
  writeGold("hourly-heatmap.json", heatmap);
  console.log(`  hourly-heatmap.json (${entries.length} entries across ${years.length} years)`);
  return heatmap;
}

// --- Task 16: Margin Ranking ---

function buildMarginRanking(catalog) {
  const marginFiles = readSilverGlob("margins-");
  if (marginFiles.length === 0) {
    console.log("  [margin-ranking] No margin files — skipping");
    return null;
  }

  const catalogMap = new Map();
  if (catalog) {
    for (const p of catalog) catalogMap.set(p.key, p);
  }

  const merged = new Map();
  for (const mf of marginFiles) {
    for (const m of mf.margins) {
      if (merged.has(m.key)) {
        const existing = merged.get(m.key);
        existing.salesTtc += m.salesTtc;
        existing.salesHt += m.salesHt;
        existing.purchaseHt += m.purchaseHt;
        existing.marginHt += m.marginHt;
        existing.transactionCount += m.transactionCount;
      } else {
        merged.set(m.key, { ...m });
      }
    }
  }

  const ranking = [...merged.values()]
    .map((m) => {
      const cat = catalogMap.get(m.key);
      return {
        key: m.key,
        name: m.rawName,
        category: cat?.category || "",
        supplier: cat?.supplier || "",
        salesHt: Math.round(m.salesHt * 100) / 100,
        purchaseHt: Math.round(m.purchaseHt * 100) / 100,
        marginHt: Math.round(m.marginHt * 100) / 100,
        marginRatio: m.purchaseHt > 0 ? Math.round((m.salesHt / m.purchaseHt) * 100) / 100 : 0,
        transactionCount: m.transactionCount,
        marginPercentage: m.salesHt > 0 ? Math.round((m.marginHt / m.salesHt) * 1000) / 10 : 0
      };
    })
    .sort((a, b) => b.marginHt - a.marginHt);

  writeGold("margin-ranking.json", ranking);
  console.log(`  margin-ranking.json (${ranking.length} products)`);
  return ranking;
}

// --- Task 17: Store Summary ---

function buildStoreSummary(dailySales, catalog, categoryEvolution) {
  const monthlyFiles = readSilverGlob("monthly-stats-");
  const annualFiles = readSilverGlob("annual-stats-");
  const txFiles = readSilverGlob("transactions-");
  const catFiles = readSilverGlob("category-mix-");
  const marginFiles = readSilverGlob("margins-");
  const hourlyFiles = readSilverGlob("hourly-patterns-");

  // Compute per-year stats from daily sales
  const yearStats = new Map();
  if (dailySales) {
    for (const d of dailySales) {
      const year = parseInt(d.date.slice(0, 4), 10);
      if (!yearStats.has(year)) {
        yearStats.set(year, { year, totalRevenue: 0, tradingDays: 0, dates: [] });
      }
      const ys = yearStats.get(year);
      ys.totalRevenue += d.revenue;
      ys.tradingDays++;
      ys.dates.push(d.date);
    }
  }

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

  for (const year of [...monthlyRevByYear.keys(), ...catMixRevByYear.keys()]) {
    if (!yearStats.has(year)) {
      yearStats.set(year, { year, totalRevenue: 0, tradingDays: 0, dates: [] });
    }
  }

  for (const [year, ys] of yearStats) {
    const monthlyRev = monthlyRevByYear.get(year);
    const catMixRev = catMixRevByYear.get(year);

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

  // Enrich with product counts from annual stats
  const productCountByYear = new Map();
  for (const af of annualFiles) {
    productCountByYear.set(af.year, af.products.length);
  }
  // Category count from category evolution
  const categoryCountByYear = new Map();
  for (const cf of catFiles) {
    categoryCountByYear.set(cf.year, cf.categories.length);
  }

  const now = new Date();
  const currentYear = now.getFullYear();

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

  let dataFrom = null;
  let dataTo = null;
  if (dailySales && dailySales.length > 0) {
    dataFrom = dailySales[0].date;
    dataTo = dailySales[dailySales.length - 1].date;
  }

  const summary = {
    years,
    dataRange: { from: dataFrom, to: dataTo },
    silverCoverage: {
      monthlyStats: monthlyFiles.map((f) => f.year).sort(),
      annualStats: annualFiles.map((f) => f.year).sort(),
      transactions: txFiles.map((f) => f.year).sort(),
      categoryMix: catFiles.map((f) => f.year).sort(),
      margins: marginFiles.map((f) => f.year).sort(),
      hourlyPatterns: hourlyFiles.map((f) => f.year).sort()
    }
  };

  writeGold("store-summary.json", summary);
  console.log(`  store-summary.json (${years.length} years, ${dataFrom} to ${dataTo})`);
  return summary;
}

// --- Task 18: Orchestrator ---

function run() {
  console.log("\nBuilding Gold layer from Silver...\n");

  if (!fs.existsSync(silverDir)) {
    console.log("No data/silver/ directory found. Run 'npm run import' first.");
    process.exit(1);
  }

  const silverFiles = fs.readdirSync(silverDir).filter((f) => f.endsWith(".json") && f !== "import-report.json");
  if (silverFiles.length === 0) {
    console.log("No Silver files found. Run 'npm run import' first.");
    process.exit(1);
  }

  fs.mkdirSync(goldDir, { recursive: true });

  const catalog = buildProductCatalog();
  const dailySales = buildDailySales();
  const monthlyStats = buildMonthlyProductStats();
  const categoryEvolution = buildCategoryEvolution();
  const heatmap = buildHourlyHeatmap();
  const marginRanking = buildMarginRanking(catalog);
  const storeSummary = buildStoreSummary(dailySales, catalog, categoryEvolution);

  const goldFiles = fs.readdirSync(goldDir).filter((f) => f.endsWith(".json"));
  const totalSize = goldFiles.reduce((sum, f) => sum + fs.statSync(path.join(goldDir, f)).size, 0);
  console.log(`\nGold: ${goldFiles.length} files, ${(totalSize / 1024).toFixed(0)} KB total\n`);
}

run();
