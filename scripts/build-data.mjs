import fs from "node:fs";
import path from "node:path";
import xlsx from "xlsx";

const root = process.cwd();
const rawDir = path.join(root, "sample-data", "raw");
const configDir = path.join(root, "sample-data", "config");
const outputPath = path.join(root, "public", "data", "demo.json");

function parseDelimited(filePath) {
  const text = fs.readFileSync(filePath, "latin1").replace(/\r/g, "");
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split(";"));
}

function parseNumber(value) {
  if (value === undefined || value === null || value === "") {
    return 0;
  }
  return Number(String(value).replace(/\s/g, "").replace(",", ".")) || 0;
}

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/gi, " ")
    .trim()
    .toUpperCase();
}

function parseExport(fileName, yearPrefix) {
  const rows = parseDelimited(path.join(rawDir, fileName));
  const header = rows.shift();
  const monthlyColumns = header.filter((col) => col.startsWith(yearPrefix));
  const products = rows
    .filter((row) => row[2] && row[2].trim())
    .map((row) => {
      const record = Object.fromEntries(header.map((key, index) => [key, row[index] || ""]));
      const monthly = monthlyColumns.map((column) => parseNumber(record[column]));
      return {
        key: normalizeKey(record.libelle),
        rawName: record.libelle.trim(),
        stock: Math.abs(parseNumber(record.STOCK)),
        purchasePrice: parseNumber(record.PRIXACHAT),
        salePrice: parseNumber(record.PRIX),
        totalQuantity: parseNumber(record.TotQut),
        totalRevenue: parseNumber(record["TotCA."]),
        monthly,
        rawCategory: record.categorie.trim(),
        supplierHint: record.famille.trim(),
        weightedType: record.type.trim()
      };
    });
  return new Map(products.map((product) => [product.key, product]));
}

function parseRecentSales(fileName) {
  const rows = parseDelimited(path.join(rawDir, fileName));
  rows.shift();
  return new Map(
    rows
      .filter((row) => row[0] && row[0].trim())
      .map((row) => [
        normalizeKey(row[0]),
        {
          recentQuantity: parseNumber(row[1]),
          recentRevenue: parseNumber(row[2]),
          categoryHint: row[5] || ""
        }
      ])
  );
}

function parseCategoryMix(fileName) {
  const rows = parseDelimited(path.join(rawDir, fileName));
  rows.shift();
  return rows
    .filter((row) => row[0] && row[0].trim())
    .map((row) => ({
      category: row[0].trim(),
      productCount: parseNumber(row[1]),
      totalRevenue: parseNumber(row[2]),
      share: parseNumber(String(row[3]).replace("%", ""))
    }));
}

function parseMargins(fileName) {
  const rows = parseDelimited(path.join(rawDir, fileName));
  rows.shift();
  return new Map(
    rows
      .filter((row) => row[1] && row[1].trim())
      .map((row) => [
        normalizeKey(row[1]),
        {
          marginRatio: parseNumber(row[6]),
          salesHt: parseNumber(row[3]),
          purchaseHt: parseNumber(row[4]),
          marginHt: parseNumber(row[5])
        }
      ])
  );
}

function parseFinanceWorkbook(fileName) {
  const workbook = xlsx.readFile(path.join(rawDir, fileName));
  const sheet = workbook.Sheets["P&L"];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const timeline = rows
    .slice(1)
    .filter((row) => row[0] && row[1] && row[2] && row[3])
    .map((row) => ({
      month: row[0],
      revenue2023: Number(row[1]),
      revenue2024: Number(row[2]),
      revenue2025: Number(row[3]),
      margin2025: Number(row[4]),
      opex2025: Number(row[5])
    }));
  return {
    years: [
      {
        year: 2023,
        revenue: timeline.reduce((sum, row) => sum + row.revenue2023, 0)
      },
      {
        year: 2024,
        revenue: timeline.reduce((sum, row) => sum + row.revenue2024, 0)
      },
      {
        year: 2025,
        revenue: timeline.reduce((sum, row) => sum + row.revenue2025, 0),
        margin: timeline.reduce((sum, row) => sum + row.margin2025, 0),
        opex: timeline.reduce((sum, row) => sum + row.opex2025, 0)
      }
    ],
    timeline
  };
}

function buildProducts() {
  const products2024 = parseExport("export-stat-vente-2024.csv", "24_");
  const products2025 = parseExport("export-stat-vente-2025.csv", "25_");
  const recent = parseRecentSales("sta-satvente-2025.csv");
  const margins = parseMargins("analyse-2025.csv");
  const corrections = JSON.parse(fs.readFileSync(path.join(configDir, "product-corrections.json"), "utf8"));
  const context = JSON.parse(fs.readFileSync(path.join(configDir, "context.json"), "utf8"));

  const allKeys = [...products2025.keys()];
  const products = allKeys.map((key) => {
    const current = products2025.get(key);
    const previous = products2024.get(key);
    const correction = corrections[key] || {};
    const recency = recent.get(key) || { recentQuantity: 0, recentRevenue: 0 };
    const margin = margins.get(key) || { marginRatio: 0, marginHt: 0 };

    const avgMonthly = current.monthly.reduce((sum, value) => sum + value, 0) / current.monthly.length;
    const yoy = previous ? (current.totalRevenue - previous.totalRevenue) / previous.totalRevenue : 0;
    const demandPressure = recency.recentQuantity / Math.max(avgMonthly, 1);
    const stockCoverWeeks = current.stock / Math.max(recency.recentQuantity / 4, 1);
    const weatherBoost =
      correction.weatherSensitivity === "sunny-weekend" && context.weather.condition === "sunny"
        ? 1.2
        : correction.weatherSensitivity === "cold-week" && context.weather.condition !== "sunny"
          ? 1.15
          : correction.weatherSensitivity === "aperitivo-spike" && context.weather.condition === "sunny"
            ? 1.1
            : 1;

    const adjustedDemand = recency.recentQuantity * weatherBoost;
    const stockoutSuspicion = current.stock <= 12 && demandPressure > 1.2 ? Math.min(0.92, 0.55 + demandPressure / 4) : 0;
    const score =
      (stockCoverWeeks < 1.3 ? 2 : stockCoverWeeks < 2.4 ? 1 : -0.5) +
      (demandPressure > 1.25 ? 2 : demandPressure > 0.9 ? 1 : -0.5) +
      (yoy > 0.16 ? 1 : yoy < -0.08 ? -1 : 0) +
      (weatherBoost > 1 ? 0.8 : 0) +
      (stockoutSuspicion > 0.75 ? 0.8 : 0);

    const action = score >= 3 ? "order" : score >= 1.2 ? "watch" : score < 0 ? "skip" : "watch";
    const confidence = Math.max(0.42, Math.min(0.94, 0.52 + Math.abs(score) / 6));

    const evidence = [
      `stock ${current.stock}`,
      `recent ${recency.recentQuantity.toFixed(0)} units`,
      `YoY ${Math.round(yoy * 100)}%`,
      `cover ${stockCoverWeeks.toFixed(1)} weeks`
    ];
    if (stockoutSuspicion > 0.6) {
      evidence.push(`possible suppressed demand ${(stockoutSuspicion * 100).toFixed(0)}%`);
    }
    if (weatherBoost > 1) {
      evidence.push(`weather boost x${weatherBoost.toFixed(2)}`);
    }

    return {
      key,
      displayName: correction.displayName || current.rawName,
      supplier: correction.supplier || current.supplierHint || "Unmapped",
      category: correction.canonicalCategory || current.rawCategory,
      rawCategory: current.rawCategory,
      totalRevenue: current.totalRevenue,
      totalRevenue2024: previous?.totalRevenue || 0,
      recentQuantity: recency.recentQuantity,
      recentRevenue: recency.recentRevenue,
      stock: current.stock,
      demandPressure,
      stockCoverWeeks,
      yoy,
      action,
      confidence,
      adjustedDemand,
      stockoutSuspicion,
      marginRatio: margin.marginRatio,
      marginHt: margin.marginHt,
      evidence,
      weatherSensitivity: correction.weatherSensitivity || "neutral",
      perishability: correction.perishability || "medium"
    };
  });

  const suppliers = Object.entries(context.suppliers).map(([name, meta]) => {
    const supplierProducts = products.filter((product) => product.supplier === name);
    const order = supplierProducts.filter((product) => product.action === "order");
    const watch = supplierProducts.filter((product) => product.action === "watch");
    const skip = supplierProducts.filter((product) => product.action === "skip");
    const taskProducts = order.length ? order : watch.slice(0, 2);
    return {
      name,
      ...meta,
      order,
      watch,
      skip,
      tasks: taskProducts.map((product) => `${product.displayName} -> ${product.evidence[0]}, ${product.evidence[1]}`),
      summary: order.length
        ? `${order.length} items need a real decision before cutoff.`
        : watch.length
          ? `No hard order signal, but ${watch.length} items deserve a look.`
          : `Healthy position. No urgent move today.`
    };
  });

  const insights = products
    .slice()
    .sort((left, right) => right.confidence + right.stockoutSuspicion - (left.confidence + left.stockoutSuspicion))
    .slice(0, 6)
    .map((product) => ({
      title: `${product.displayName}: ${product.action === "order" ? "buy now" : product.action === "watch" ? "watch carefully" : "hold steady"}`,
      body:
        product.stockoutSuspicion > 0.7
          ? `${product.displayName} likely hit a ceiling imposed by stock, not demand. The raw recent sell-through is already strong, and the low remaining stock makes the historical curve understate real appetite.`
          : product.action === "order"
            ? `${product.displayName} is moving faster than its baseline while stock cover is tightening. The dashboard treats it as a live order candidate, not a vanity trend.`
            : product.action === "watch"
              ? `${product.displayName} is not a blind reorder, but it sits in the zone where one more good weekend can change the call.`
              : `${product.displayName} looks stable enough to deprioritize. Space and attention are more valuable elsewhere this week.`,
      confidence: product.confidence,
      evidence: product.evidence,
      rawRevenue: product.totalRevenue,
      interpretedDemand: product.adjustedDemand
    }));

  return {
    products,
    suppliers,
    insights
  };
}

function buildBriefing(products, suppliers, context) {
  const topOrder = products.filter((product) => product.action === "order").slice(0, 4);
  const slow = products
    .filter((product) => product.action === "skip")
    .sort((left, right) => left.totalRevenue - right.totalRevenue)
    .slice(0, 3);
  const hottestSupplier = suppliers
    .slice()
    .sort((left, right) => right.order.length - left.order.length)[0];

  return [
    `The week opens with ${context.weather.headline.toLowerCase()}. Fresh Italian and aperitivo signals should be treated as live, not decorative.`,
    `${hottestSupplier.name} is the sharpest supplier panel today: ${hottestSupplier.summary.toLowerCase()}`,
    `${topOrder.map((product) => product.displayName).join(", ")} are the strongest decision candidates right now.`,
    `${slow.map((product) => product.displayName).join(", ")} look like space-and-cash drags unless the next cycle proves otherwise.`
  ];
}

function buildOutput() {
  const context = JSON.parse(fs.readFileSync(path.join(configDir, "context.json"), "utf8"));
  const macro = parseFinanceWorkbook("chez-julien-finance-demo.xlsx");
  const categoryMix = parseCategoryMix("sta-ratioCAT-2025.csv");
  const { products, suppliers, insights } = buildProducts();
  const briefing = buildBriefing(products, suppliers, context);

  const kpis = {
    revenue2025: products.reduce((sum, product) => sum + product.totalRevenue, 0),
    orderSignals: products.filter((product) => product.action === "order").length,
    watchSignals: products.filter((product) => product.action === "watch").length,
    stockoutFlags: products.filter((product) => product.stockoutSuspicion > 0.6).length
  };

  const payload = {
    generatedAt: new Date().toISOString(),
    store: context.storeName,
    location: context.storeLocation,
    runDate: context.runDate,
    context,
    kpis,
    briefing,
    suppliers,
    topProducts: products.slice().sort((left, right) => right.totalRevenue - left.totalRevenue).slice(0, 8),
    slowProducts: products.slice().sort((left, right) => left.totalRevenue - right.totalRevenue).slice(0, 6),
    categoryMix,
    insights,
    macro,
    methodology: {
      rawVsInterpreted: "Raw exports stay visible. Interpretation cards are explicit inference, not hidden truth."
    }
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${outputPath}`);
}

buildOutput();

