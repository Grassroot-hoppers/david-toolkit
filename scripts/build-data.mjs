import fs from "node:fs";
import path from "node:path";
import xlsx from "xlsx";

const root = process.cwd();
const rawDir = path.join(root, "sample-data", "raw");
const normalizedDir = path.join(root, "data", "normalized");
const configDir = path.join(root, "sample-data", "config");
const outputPath = path.join(root, "public", "data", "demo.json");

const useNormalized = fs.existsSync(normalizedDir) &&
  fs.readdirSync(normalizedDir).some((f) => f.endsWith(".json") && f !== "import-report.json");

const COPY = {
  en: {
    evidenceStock: (stock) => `stock ${stock}`,
    evidenceRecent: (quantity) => `recent ${quantity.toFixed(0)} units`,
    evidenceYoY: (yoy) => `YoY ${Math.round(yoy * 100)}%`,
    evidenceCover: (weeks) => `cover ${weeks.toFixed(1)} weeks`,
    evidenceSuppressedDemand: (confidence) => `possible suppressed demand ${(confidence * 100).toFixed(0)}%`,
    evidenceWeatherBoost: (boost) => `weather boost x${boost.toFixed(2)}`,
    supplierTask: (product) => `${product.displayName} -> ${product.evidence[0]}, ${product.evidence[1]}`,
    supplierSummaryOrder: (count) => `${count} items need a real decision before cutoff.`,
    supplierSummaryWatch: (count) => `No hard order signal, but ${count} items deserve a look.`,
    supplierSummaryHealthy: "Healthy position. No urgent move today.",
    insightAction: {
      order: "buy now",
      watch: "watch carefully",
      skip: "hold steady"
    },
    insightBodyStockout: (name) =>
      `${name} likely hit a ceiling imposed by stock, not demand. The raw recent sell-through is already strong, and the low remaining stock makes the historical curve understate real appetite.`,
    insightBodyOrder: (name) =>
      `${name} is moving faster than its baseline while stock cover is tightening. The dashboard treats it as a live order candidate, not a vanity trend.`,
    insightBodyWatch: (name) =>
      `${name} is not a blind reorder, but it sits in the zone where one more good weekend can change the call.`,
    insightBodySkip: (name) =>
      `${name} looks stable enough to deprioritize. Space and attention are more valuable elsewhere this week.`,
    briefingOpening: (headline) =>
      `The week opens with ${headline.toLowerCase()}. Fresh Italian and aperitivo signals should be treated as live, not decorative.`,
    briefingSupplier: (name, summary) =>
      `${name} is the sharpest supplier panel today: ${summary.toLowerCase()}`,
    briefingTop: (names) =>
      names.length === 1
        ? `${names[0]} is the strongest decision candidate right now.`
        : `${names.join(", ")} are the strongest decision candidates right now.`,
    briefingSlow: (names) =>
      names.length === 1
        ? `${names[0]} looks like a space-and-cash drag unless the next cycle proves otherwise.`
        : `${names.join(", ")} look like space-and-cash drags unless the next cycle proves otherwise.`,
    methodologyRawVsInterpreted:
      "Raw exports stay visible. Interpretation cards are explicit inference, not hidden truth."
  },
  fr: {
    evidenceStock: (stock) => `stock ${stock}`,
    evidenceRecent: (quantity) => `ventes récentes ${quantity.toFixed(0)} unités`,
    evidenceYoY: (yoy) => `vs N-1 ${Math.round(yoy * 100)}%`,
    evidenceCover: (weeks) => `couverture ${weeks.toFixed(1)} semaines`,
    evidenceSuppressedDemand: (confidence) => `demande sous-estimée possible ${(confidence * 100).toFixed(0)}%`,
    evidenceWeatherBoost: (boost) => `effet météo x${boost.toFixed(2)}`,
    supplierTask: (product) => `${product.displayName} -> ${product.evidence[0]}, ${product.evidence[1]}`,
    supplierSummaryOrder: (count) => `${count} articles demandent une vraie décision avant l'heure limite.`,
    supplierSummaryWatch: (count) => `Aucun réassort évident, mais ${count} articles méritent un contrôle.`,
    supplierSummaryHealthy: "Position saine. Aucun mouvement urgent aujourd'hui.",
    insightAction: {
      order: "à commander",
      watch: "à surveiller",
      skip: "à laisser"
    },
    insightBodyStockout: (name) =>
      `${name} a probablement été limité par le stock, pas par la demande. Les ventes récentes sont déjà fortes et le faible reliquat réduit artificiellement la courbe historique.`,
    insightBodyOrder: (name) =>
      `${name} accélère plus vite que sa base pendant que la couverture de stock se resserre. Le tableau le traite comme un vrai candidat de commande, pas comme une tendance décorative.`,
    insightBodyWatch: (name) =>
      `${name} n'est pas un réassort automatique, mais il est dans la zone où un bon week-end supplémentaire peut faire basculer la décision.`,
    insightBodySkip: (name) =>
      `${name} paraît assez stable pour passer après le reste. La place et l'attention valent plus ailleurs cette semaine.`,
    briefingOpening: (headline) =>
      `La semaine commence avec ${headline.toLowerCase()}. Les signaux apéritif et frais doivent être traités comme réels, pas décoratifs.`,
    briefingSupplier: (name, summary) =>
      `${name} est le panneau fournisseur le plus tendu aujourd'hui : ${summary.toLowerCase()}`,
    briefingTop: (names) =>
      names.length === 1
        ? `${names[0]} est le candidat de décision le plus fort ce matin.`
        : `${names.join(", ")} sont les candidats de décision les plus forts ce matin.`,
    briefingSlow: (names) =>
      names.length === 1
        ? `${names[0]} ressemble à un frein de place et de cash si le prochain cycle ne contredit pas ce signal.`
        : `${names.join(", ")} ressemblent à des freins de place et de cash si le prochain cycle ne contredit pas ce signal.`,
    methodologyRawVsInterpreted:
      "Les exports bruts restent visibles. Les cartes d'interprétation sont des inférences explicites, jamais une vérité cachée."
  }
};

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

function getLanguage(locale) {
  return String(locale || "en")
    .toLowerCase()
    .startsWith("fr")
    ? "fr"
    : "en";
}

function getCopy(locale) {
  return COPY[getLanguage(locale)];
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

function loadNormalizedProducts(year) {
  const filePath = path.join(normalizedDir, `products-${year}.json`);
  if (!fs.existsSync(filePath)) return new Map();
  const products = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return new Map(products.map((p) => [p.key, {
    ...p,
    totalQuantity: p.totalQuantity ?? p.quantity ?? 0,
    totalRevenue: p.totalRevenue ?? p.revenue ?? 0,
    stock: p.stock ?? 0,
    monthly: p.monthly ?? [],
    rawCategory: p.rawCategory ?? p.category ?? "",
    supplierHint: p.supplierHint ?? "",
    weightedType: p.weightedType ?? ""
  }]));
}

function loadNormalizedRecent() {
  const filePath = path.join(normalizedDir, "recent-sales.json");
  if (!fs.existsSync(filePath)) return new Map();
  const sales = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return new Map(sales.map((s) => [s.key, s]));
}

function loadNormalizedMargins() {
  const filePath = path.join(normalizedDir, "margins.json");
  if (!fs.existsSync(filePath)) return new Map();
  const margins = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return new Map(margins.map((m) => [m.key, m]));
}

function loadNormalizedCategoryMix() {
  const filePath = path.join(normalizedDir, "category-mix.json");
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function detectAvailableYears() {
  if (!useNormalized) return { all: [2024, 2025], current: 2025, previous: 2024, recent: null };
  const files = fs.readdirSync(normalizedDir).filter((f) => /^products-\d{4}\.json$/.test(f));
  const years = files.map((f) => parseInt(f.match(/(\d{4})/)[1], 10)).sort();
  if (years.length < 2) return { all: years, current: years[0], previous: null, recent: null };

  // Detect partial years: if the latest year has <60% products of the year before, it's partial
  const latestCount = JSON.parse(fs.readFileSync(path.join(normalizedDir, `products-${years[years.length - 1]}.json`), "utf8")).length;
  const prevCount = JSON.parse(fs.readFileSync(path.join(normalizedDir, `products-${years[years.length - 2]}.json`), "utf8")).length;
  const latestIsPartial = latestCount < prevCount * 0.6;

  if (latestIsPartial && years.length >= 3) {
    // Use second-to-last as current (full year), third-to-last as previous, latest as recent
    return {
      all: years,
      current: years[years.length - 2],
      previous: years[years.length - 3],
      recent: years[years.length - 1]
    };
  }
  if (latestIsPartial) {
    return {
      all: years,
      current: years[years.length - 2],
      previous: years.length >= 3 ? years[years.length - 3] : null,
      recent: years[years.length - 1]
    };
  }
  return { all: years, current: years[years.length - 1], previous: years[years.length - 2], recent: null };
}

function buildProducts(context, copy) {
  const yearInfo = detectAvailableYears();

  let productsCurrent, productsPrevious, recent, margins;

  if (useNormalized) {
    console.log(`  Using normalized data (years: ${yearInfo.all.join(", ")})`);
    console.log(`  Current year: ${yearInfo.current}, Previous: ${yearInfo.previous || "none"}, Recent partial: ${yearInfo.recent || "none"}`);
    productsCurrent = loadNormalizedProducts(yearInfo.current);
    productsPrevious = yearInfo.previous ? loadNormalizedProducts(yearInfo.previous) : new Map();
    // Use the partial/recent year for recency if available, otherwise the current year
    recent = yearInfo.recent ? loadNormalizedProducts(yearInfo.recent) : loadNormalizedRecent();
    if (yearInfo.recent) {
      // Convert product data into recent-sales format
      const recentMap = new Map();
      for (const [key, p] of recent) {
        recentMap.set(key, {
          recentQuantity: p.totalQuantity,
          recentRevenue: p.totalRevenue,
          categoryHint: p.rawCategory
        });
      }
      recent = recentMap;
    }
    margins = loadNormalizedMargins();
  } else {
    console.log("  Using sample-data/raw/ (no normalized data found)");
    productsCurrent = parseExport("export-stat-vente-2025.csv", "25_");
    productsPrevious = parseExport("export-stat-vente-2024.csv", "24_");
    recent = parseRecentSales("sta-satvente-2025.csv");
    margins = parseMargins("analyse-2025.csv");
  }

  const corrections = JSON.parse(fs.readFileSync(path.join(configDir, "product-corrections.json"), "utf8"));

  const hasMonthlyData = [...productsCurrent.values()].some((p) => p.monthly && p.monthly.length > 0);
  const hasStockData = [...productsCurrent.values()].some((p) => p.stock > 0);

  const JUNK_PATTERNS = /^(-TARE|BON[\s.]?REMB|REMB |CARTE CADEAU|FICTIF|#ACOMPTE|RETOUR VIDANGE|RETOUR CAUTION|VIDANGE |CAUTION )/i;
  const allKeys = [...productsCurrent.keys()].filter((key) => {
    const p = productsCurrent.get(key);
    if (JUNK_PATTERNS.test(p.rawName)) return false;
    if (p.totalRevenue <= 0) return false;
    return true;
  });
  const products = allKeys.map((key) => {
    const current = productsCurrent.get(key);
    const previous = productsPrevious.get(key);
    const correction = corrections[key] || {};
    const recency = recent.get(key) || { recentQuantity: 0, recentRevenue: 0 };
    const margin = margins.get(key) || { marginRatio: 0, marginHt: 0 };

    const yoy = previous && previous.totalRevenue > 0
      ? (current.totalRevenue - previous.totalRevenue) / previous.totalRevenue
      : 0;

    const weatherBoost =
      correction.weatherSensitivity === "sunny-weekend" && context.weather.condition === "sunny"
        ? 1.2
        : correction.weatherSensitivity === "cold-week" && context.weather.condition !== "sunny"
          ? 1.15
          : correction.weatherSensitivity === "aperitivo-spike" && context.weather.condition === "sunny"
            ? 1.1
            : 1;

    let demandPressure = 0;
    let stockCoverWeeks = 0;
    let stockoutSuspicion = 0;

    if (hasMonthlyData && current.monthly.length > 0) {
      const avgMonthly = current.monthly.reduce((sum, v) => sum + v, 0) / current.monthly.length;
      demandPressure = recency.recentQuantity / Math.max(avgMonthly, 1);
      if (hasStockData) {
        stockCoverWeeks = current.stock / Math.max(recency.recentQuantity / 4, 1);
        stockoutSuspicion = current.stock <= 12 && demandPressure > 1.2
          ? Math.min(0.92, 0.55 + demandPressure / 4) : 0;
      }
    }

    // Scoring adapts to available data
    let score;
    if (hasMonthlyData && hasStockData) {
      score =
        (stockCoverWeeks < 1.3 ? 2 : stockCoverWeeks < 2.4 ? 1 : -0.5) +
        (demandPressure > 1.25 ? 2 : demandPressure > 0.9 ? 1 : -0.5) +
        (yoy > 0.16 ? 1 : yoy < -0.08 ? -1 : 0) +
        (weatherBoost > 1 ? 0.8 : 0) +
        (stockoutSuspicion > 0.75 ? 0.8 : 0);
    } else {
      // Revenue-and-margin-based scoring when no stock/monthly data
      const revenueTier = current.totalRevenue > 5000 ? 1 : current.totalRevenue > 1000 ? 0 : -0.5;
      const yoyTier = yoy > 0.20 ? 1.5 : yoy > 0.05 ? 0.5 : yoy < -0.15 ? -1.5 : yoy < -0.05 ? -0.5 : 0;
      const marginTier = margin.marginRatio > 2.0 ? 0.5 : margin.marginRatio > 0 && margin.marginRatio < 1.3 ? -0.5 : 0;
      score = revenueTier + yoyTier + marginTier + (weatherBoost > 1 ? 0.5 : 0);
    }

    const action = score >= 2 ? "order" : score >= 0.5 ? "watch" : score < -0.5 ? "skip" : "watch";
    const confidence = Math.max(0.42, Math.min(0.94, 0.52 + Math.abs(score) / 6));

    const evidence = [];
    if (hasStockData && current.stock > 0) {
      evidence.push(copy.evidenceStock(current.stock));
    }
    evidence.push(copy.evidenceRecent(recency.recentQuantity || current.totalQuantity));
    evidence.push(copy.evidenceYoY(yoy));
    if (hasStockData && stockCoverWeeks > 0) {
      evidence.push(copy.evidenceCover(stockCoverWeeks));
    }
    if (margin.marginRatio > 0) {
      evidence.push(`marge x${margin.marginRatio.toFixed(2)}`);
    }
    if (stockoutSuspicion > 0.6) {
      evidence.push(copy.evidenceSuppressedDemand(stockoutSuspicion));
    }
    if (weatherBoost > 1) {
      evidence.push(copy.evidenceWeatherBoost(weatherBoost));
    }

    return {
      key,
      displayName: correction.displayName || current.rawName,
      supplier: correction.supplier || current.supplierHint || "Unmapped",
      category: correction.canonicalCategory || current.rawCategory,
      rawCategory: current.rawCategory,
      totalRevenue: current.totalRevenue,
      totalRevenuePrevious: previous?.totalRevenue || 0,
      recentQuantity: recency.recentQuantity || current.totalQuantity,
      recentRevenue: recency.recentRevenue || current.totalRevenue,
      stock: current.stock,
      demandPressure,
      stockCoverWeeks,
      yoy,
      action,
      confidence,
      adjustedDemand: (recency.recentQuantity || current.totalQuantity) * weatherBoost,
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
      tasks: taskProducts.map((product) => copy.supplierTask(product)),
      summary: order.length
        ? copy.supplierSummaryOrder(order.length)
        : watch.length
          ? copy.supplierSummaryWatch(watch.length)
          : copy.supplierSummaryHealthy
    };
  });

  const insights = products
    .slice()
    .sort((left, right) => right.confidence + right.stockoutSuspicion - (left.confidence + left.stockoutSuspicion))
    .slice(0, 6)
    .map((product) => ({
      title: `${product.displayName}: ${copy.insightAction[product.action]}`,
      body:
        product.stockoutSuspicion > 0.7
          ? copy.insightBodyStockout(product.displayName)
          : product.action === "order"
            ? copy.insightBodyOrder(product.displayName)
            : product.action === "watch"
              ? copy.insightBodyWatch(product.displayName)
              : copy.insightBodySkip(product.displayName),
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

function buildBriefing(products, suppliers, context, copy) {
  const topOrder = products.filter((product) => product.action === "order").slice(0, 4);
  const slow = products
    .filter((product) => product.action === "skip")
    .sort((left, right) => left.totalRevenue - right.totalRevenue)
    .slice(0, 3);
  const hottestSupplier = suppliers
    .slice()
    .sort((left, right) => right.order.length - left.order.length)[0];

  return [
    copy.briefingOpening(context.weather.headline),
    copy.briefingSupplier(hottestSupplier.name, hottestSupplier.summary),
    copy.briefingTop(topOrder.map((product) => product.displayName)),
    copy.briefingSlow(slow.map((product) => product.displayName))
  ];
}

function buildMacroFromCategories() {
  const { all: years } = detectAvailableYears();
  const macroYears = [];
  for (const year of years) {
    const catPath = path.join(normalizedDir, `category-mix-${year}.json`);
    if (fs.existsSync(catPath)) {
      const cats = JSON.parse(fs.readFileSync(catPath, "utf8"));
      const revenue = cats.reduce((sum, c) => sum + c.totalRevenue, 0);
      macroYears.push({ year, revenue: Math.round(revenue) });
    }
  }
  return { years: macroYears, timeline: [] };
}

function buildOutput() {
  const context = JSON.parse(fs.readFileSync(path.join(configDir, "context.json"), "utf8"));
  const copy = getCopy(context.productLocale);

  let macro;
  if (useNormalized) {
    macro = buildMacroFromCategories();
    console.log(`  Macro from category totals: ${macro.years.map((y) => `${y.year}: €${y.revenue}`).join(", ")}`);
  } else {
    macro = parseFinanceWorkbook("chez-julien-finance-demo.xlsx");
  }

  const categoryMix = useNormalized ? loadNormalizedCategoryMix() : parseCategoryMix("sta-ratioCAT-2025.csv");
  const { products, suppliers, insights } = buildProducts(context, copy);
  console.log(`  Products: ${products.length}, Suppliers: ${suppliers.length}`);
  const briefing = buildBriefing(products, suppliers, context, copy);

  const kpis = {
    revenue2025: products.reduce((sum, product) => sum + product.totalRevenue, 0),
    orderSignals: products.filter((product) => product.action === "order").length,
    watchSignals: products.filter((product) => product.action === "watch").length,
    stockoutFlags: products.filter((product) => product.stockoutSuspicion > 0.6).length
  };

  const payload = {
    generatedAt: new Date().toISOString(),
    productLocale: context.productLocale || "en-BE",
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
      rawVsInterpreted: copy.methodologyRawVsInterpreted
    }
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${outputPath}`);
}

buildOutput();
