import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const goldDir = path.join(root, "data", "gold");
const configDir = path.join(root, "sample-data", "config");
const outputPath = path.join(root, "demo", "data", "demo.json");

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
    insightAction: { order: "buy now", watch: "watch carefully", skip: "hold steady" },
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
    insightAction: { order: "à commander", watch: "à surveiller", skip: "à laisser" },
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

function readGold(filename) {
  const fp = path.join(goldDir, filename);
  if (!fs.existsSync(fp)) return null;
  return JSON.parse(fs.readFileSync(fp, "utf8"));
}

function getLanguage(locale) {
  return String(locale || "en").toLowerCase().startsWith("fr") ? "fr" : "en";
}

function getCopy(locale) {
  return COPY[getLanguage(locale)];
}

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/gi, " ")
    .trim()
    .toUpperCase();
}

const CATEGORY_FILTERS = /^(DIV\. EAN|Fictif|CARTE CADEAUX|\(uncategorized\))/i;

const CATEGORY_DISPLAY = {
  "FRUIT ET LEGUME": "Fruits & Légumes",
  "FRUITS ET LEGUMES": "Fruits & Légumes",
  "FROMAGE": "Fromages",
  "FROMAGE - CHARCU": "Fromages & Charcuterie",
  "CHARCUTERIE": "Charcuterie",
  "COPRO": "Coprosain",
  "FRAIS": "Frais",
  "OEUF": "Oeufs",
  "PATE FRAICHE": "Pâtes Fraîches",
  "BOISSON": "Boissons",
  "EPICERIE": "Épicerie",
  "EPICERIE SUCREE": "Épicerie Sucrée",
  "SURGELE": "Surgelés",
  "HYGIENE": "Hygiène",
  "ENTRETIENT": "Entretien",
  "COSMETIQUE": "Cosmétique",
  "AROMA": "Aromathérapie",
  "VIDANGE": "Vidanges & Consignes",
  "BOULANGERIE": "Boulangerie",
  "REUTILISABLE": "Réutilisable",
  "A TRIER": "À trier",
  "VIANDE": "Viandes",
  "CONSERV - A TRIER": "Conserves",
  "LEGUMINEUSE": "Légumineuses",
  "TARTIN - OLEA": "Tartinables & Oléagineux",
  "SACS ET EXTRA": "Sacs & Extras",
};

function cleanCategory(raw) {
  if (!raw || CATEGORY_FILTERS.test(raw)) return null;
  const stripped = raw.replace(/^\d+\.\s*/, "").replace(/\s+\d+%$/, "").trim();
  if (!stripped || CATEGORY_FILTERS.test(stripped)) return null;
  return CATEGORY_DISPLAY[stripped.toUpperCase()] || stripped;
}

function titleCase(str) {
  return str
    .toLowerCase()
    .replace(/(?:^|\s|[-/])\S/g, (c) => c.toUpperCase())
    .replace(/\b(Bio|Dop|Aoc|Aop|Igp)\b/gi, (m) => m.toUpperCase())
    .replace(/\b(\d+)(gr|ml|cl|kg|l)\b/gi, (_, n, u) => n + u.toLowerCase());
}

function cleanProductName(rawName) {
  let name = rawName.replace(/^\([^)]*\)/, "").trim();
  return titleCase(name);
}

function loadSupplierMap() {
  const fp = path.join(configDir, "supplier-map.json");
  if (!fs.existsSync(fp)) return new Map();
  const raw = JSON.parse(fs.readFileSync(fp, "utf8"));
  const map = new Map();
  for (const [key, val] of Object.entries(raw)) {
    if (key.startsWith("_")) continue;
    map.set(key, val);
  }
  return map;
}

function resolveSupplier(hint, supplierMap) {
  if (!hint) return { name: "Non assigné", notionUrl: "" };
  const entry = supplierMap.get(hint) || supplierMap.get(hint.toUpperCase());
  if (entry) return entry;
  return { name: titleCase(hint), notionUrl: "" };
}

// --- Data Loading from Gold ---

function detectYears(storeSummary) {
  const years = storeSummary.years.sort((a, b) => a.year - b.year);
  if (years.length === 0) return { current: null, previous: null, recent: null, all: [] };

  const allYears = years.map((y) => y.year);
  const latestIsPartial = years[years.length - 1].isPartial;

  if (latestIsPartial && years.length >= 3) {
    return {
      all: allYears,
      current: years[years.length - 2].year,
      previous: years[years.length - 3].year,
      recent: years[years.length - 1].year
    };
  }
  if (latestIsPartial && years.length === 2) {
    return {
      all: allYears,
      current: years[years.length - 2].year,
      previous: null,
      recent: years[years.length - 1].year
    };
  }
  return {
    all: allYears,
    current: years[years.length - 1].year,
    previous: years.length >= 2 ? years[years.length - 2].year : null,
    recent: null
  };
}

function buildProductMaps(catalog, monthlyStats, yearInfo) {
  const catalogMap = new Map(catalog.map((p) => [p.key, p]));

  // Build productsCurrent from monthly stats for current year
  const productsCurrent = new Map();
  const productsPrevious = new Map();
  const recentMap = new Map();

  if (monthlyStats) {
    for (const p of monthlyStats) {
      const currentAnnual = p.annualTotals.find((a) => a.year === yearInfo.current);
      const previousAnnual = yearInfo.previous
        ? p.annualTotals.find((a) => a.year === yearInfo.previous)
        : null;
      const recentAnnual = yearInfo.recent
        ? p.annualTotals.find((a) => a.year === yearInfo.recent)
        : null;

      const currentMonthly = p.series
        .filter((s) => s.year === yearInfo.current)
        .map((s) => s.quantity);

      const cat = catalogMap.get(p.key);

      if (currentAnnual) {
        productsCurrent.set(p.key, {
          key: p.key,
          rawName: p.name,
          stock: cat?.stock || 0,
          purchasePrice: cat?.purchasePrice || 0,
          salePrice: cat?.salePrice || 0,
          totalQuantity: currentAnnual.quantity,
          totalRevenue: currentAnnual.revenue,
          monthly: currentMonthly,
          rawCategory: cat?.category || p.category,
          supplierHint: cat?.supplier || p.supplier,
          weightedType: ""
        });
      }
      if (previousAnnual) {
        productsPrevious.set(p.key, {
          key: p.key,
          totalRevenue: previousAnnual.revenue,
          totalQuantity: previousAnnual.quantity
        });
      }
      if (recentAnnual) {
        recentMap.set(p.key, {
          recentQuantity: recentAnnual.quantity,
          recentRevenue: recentAnnual.revenue,
          categoryHint: cat?.category || p.category
        });
      }
    }
  }

  // Fallback: use catalog for products not in monthly stats
  for (const p of catalog) {
    if (!productsCurrent.has(p.key) && p.latestRevenue > 0) {
      productsCurrent.set(p.key, {
        key: p.key,
        rawName: p.name,
        stock: p.stock,
        purchasePrice: p.purchasePrice,
        salePrice: p.salePrice,
        totalQuantity: p.latestQuantity,
        totalRevenue: p.latestRevenue,
        monthly: [],
        rawCategory: p.category,
        supplierHint: p.supplier,
        weightedType: ""
      });
    }
  }

  // Fallback: populate recentMap from catalog when monthly stats
  // doesn't cover the partial/recent year (e.g. 2026 annual-stats only)
  if (yearInfo.recent && recentMap.size === 0) {
    for (const p of catalog) {
      if (p.yearsActive.includes(yearInfo.recent) && p.latestRevenue > 0) {
        recentMap.set(p.key, {
          recentQuantity: p.latestQuantity,
          recentRevenue: p.latestRevenue,
          categoryHint: p.category
        });
      }
    }
  }

  return { productsCurrent, productsPrevious, recentMap };
}

function buildMarginMap(marginRanking) {
  if (!marginRanking) return new Map();
  return new Map(marginRanking.map((m) => [
    m.key,
    { marginRatio: m.marginRatio, marginHt: m.marginHt, salesHt: m.salesHt, purchaseHt: m.purchaseHt }
  ]));
}

// --- Scoring Engine (preserved from build-data.mjs) ---

function buildProducts(context, copy, productsCurrent, productsPrevious, recentMap, margins) {
  const corrections = JSON.parse(fs.readFileSync(path.join(configDir, "product-corrections.json"), "utf8"));
  const supplierMap = loadSupplierMap();

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
    const recency = recentMap.get(key) || { recentQuantity: 0, recentRevenue: 0 };
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

    let score;
    if (hasMonthlyData && hasStockData) {
      score =
        (stockCoverWeeks < 1.3 ? 2 : stockCoverWeeks < 2.4 ? 1 : -0.5) +
        (demandPressure > 1.25 ? 2 : demandPressure > 0.9 ? 1 : -0.5) +
        (yoy > 0.16 ? 1 : yoy < -0.08 ? -1 : 0) +
        (weatherBoost > 1 ? 0.8 : 0) +
        (stockoutSuspicion > 0.75 ? 0.8 : 0);
    } else {
      const revenueTier = current.totalRevenue > 5000 ? 1 : current.totalRevenue > 1000 ? 0 : -0.5;
      const yoyTier = yoy > 0.20 ? 1.5 : yoy > 0.05 ? 0.5 : yoy < -0.15 ? -1.5 : yoy < -0.05 ? -0.5 : 0;
      const marginTier = margin.marginRatio > 2.0 ? 0.5 : margin.marginRatio > 0 && margin.marginRatio < 1.3 ? -0.5 : 0;
      score = revenueTier + yoyTier + marginTier + (weatherBoost > 1 ? 0.5 : 0);
    }

    const action = score >= 2 ? "order" : score >= 0.5 ? "watch" : score < -0.5 ? "skip" : "watch";
    const confidence = Math.max(0.42, Math.min(0.94, 0.52 + Math.abs(score) / 6));

    const evidence = [];
    if (hasStockData && current.stock > 0) evidence.push(copy.evidenceStock(current.stock));
    evidence.push(copy.evidenceRecent(recency.recentQuantity || current.totalQuantity));
    evidence.push(copy.evidenceYoY(yoy));
    if (hasStockData && stockCoverWeeks > 0) evidence.push(copy.evidenceCover(stockCoverWeeks));
    if (margin.marginRatio > 0) evidence.push(`marge x${margin.marginRatio.toFixed(2)}`);
    if (stockoutSuspicion > 0.6) evidence.push(copy.evidenceSuppressedDemand(stockoutSuspicion));
    if (weatherBoost > 1) evidence.push(copy.evidenceWeatherBoost(weatherBoost));

    const resolvedSupplier = resolveSupplier(
      correction.supplier || current.supplierHint,
      supplierMap
    );

    return {
      key,
      displayName: correction.displayName || cleanProductName(current.rawName),
      supplier: resolvedSupplier.name,
      supplierNotionUrl: resolvedSupplier.notionUrl,
      category: correction.canonicalCategory || cleanCategory(current.rawCategory) || current.rawCategory,
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

  return { products, suppliers, insights };
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

// --- Main ---

function buildFromGold() {
  const catalog = readGold("product-catalog.json");
  const monthlyStats = readGold("monthly-product-stats.json");
  const storeSummary = readGold("store-summary.json");
  const categoryEvolution = readGold("category-evolution.json");
  const marginRanking = readGold("margin-ranking.json");

  if (!catalog || !storeSummary) {
    console.log("Missing Gold files. Run 'npm run build:gold' first.");
    process.exit(1);
  }

  const context = JSON.parse(fs.readFileSync(path.join(configDir, "context.json"), "utf8"));
  const copy = getCopy(context.productLocale);

  const yearInfo = detectYears(storeSummary);
  console.log(`  Years: current=${yearInfo.current}, previous=${yearInfo.previous}, recent=${yearInfo.recent}`);

  const { productsCurrent, productsPrevious, recentMap } = buildProductMaps(catalog, monthlyStats, yearInfo);
  const margins = buildMarginMap(marginRanking);

  console.log(`  Products: ${productsCurrent.size} current, ${productsPrevious.size} previous, ${recentMap.size} recent`);

  const { products, suppliers, insights } = buildProducts(context, copy, productsCurrent, productsPrevious, recentMap, margins);
  console.log(`  Scored: ${products.length} products, ${suppliers.length} suppliers`);

  const briefing = buildBriefing(products, suppliers, context, copy);

  // Category mix for latest year
  const latestYear = yearInfo.recent || yearInfo.current;
  let categoryMix = [];
  if (categoryEvolution) {
    const merged = new Map();
    for (const ce of categoryEvolution) {
      const clean = cleanCategory(ce.category);
      if (!clean) continue;
      const yr = ce.years.find((y) => y.year === latestYear) || ce.years[ce.years.length - 1];
      const prevYr = yearInfo.previous ? ce.years.find((y) => y.year === yearInfo.previous) : null;
      if (!yr) continue;
      const existing = merged.get(clean);
      if (existing) {
        existing.totalRevenue += yr.revenue;
        existing.productCount += yr.productCount;
        if (prevYr) existing.prevRevenue += prevYr.revenue;
      } else {
        merged.set(clean, {
          category: clean,
          productCount: yr.productCount,
          totalRevenue: yr.revenue,
          prevRevenue: prevYr ? prevYr.revenue : 0,
          share: 0,
        });
      }
    }
    const totalRev = [...merged.values()].reduce((s, c) => s + c.totalRevenue, 0);
    categoryMix = [...merged.values()]
      .map((c) => ({ ...c, share: totalRev > 0 ? (c.totalRevenue / totalRev) * 100 : 0, yoy: c.prevRevenue > 0 ? (c.totalRevenue - c.prevRevenue) / c.prevRevenue : 0 }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  // Macro data from store summary
  const macro = {
    years: storeSummary.years.map((y) => ({
      year: y.year,
      revenue: y.totalRevenue
    })),
    timeline: []
  };

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
  console.log(`  Wrote ${outputPath}`);
}

async function buildFromLegacy() {
  console.log("  No Gold data found. Falling back to legacy build-data.mjs...");
  const { execSync } = await import("node:child_process");
  execSync("node scripts/build-data.mjs", { stdio: "inherit", cwd: root });
}

async function run() {
  console.log("\nBuilding demo.json...\n");

  const hasGold = fs.existsSync(goldDir) &&
    fs.readdirSync(goldDir).some((f) => f.endsWith(".json"));

  if (hasGold) {
    console.log("  Source: Gold layer\n");
    buildFromGold();
  } else {
    console.log("  Source: Legacy (sample-data)\n");
    buildFromLegacy();
  }
}

run();
