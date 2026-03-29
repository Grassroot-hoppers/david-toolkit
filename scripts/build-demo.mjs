import fs from "node:fs";
import path from "node:path";

function loadProductMaster(configDir) {
  const csvPath = path.join(configDir, "product-master.csv");
  if (!fs.existsSync(csvPath)) {
    console.warn("  ⚠ product-master.csv not found — product groups will be empty");
    return { productToGroup: new Map(), groupDefs: new Map() };
  }
  const lines = fs.readFileSync(csvPath, "utf8").trim().split("\n");
  const header = lines[0].split(",");
  const nameIdx = header.indexOf("product_name");
  const groupKeyIdx = header.indexOf("group_key");
  const groupDisplayIdx = header.indexOf("group_display");

  // Keys are normalized to uppercase so lookup is case-insensitive
  const productToGroup = new Map();
  const groupDefs = new Map();

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    const name = fields[nameIdx]?.trim();
    const groupKey = fields[groupKeyIdx]?.trim();
    const groupDisplay = fields[groupDisplayIdx]?.trim();
    if (!name || !groupKey) continue;
    productToGroup.set(name.toUpperCase(), { key: groupKey, displayName: groupDisplay || groupKey });
    if (!groupDefs.has(groupKey) && groupDisplay) groupDefs.set(groupKey, groupDisplay);
  }
  return { productToGroup, groupDefs };
}

function parseCSVLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { fields.push(current); current = ""; }
      else { current += ch; }
    }
  }
  fields.push(current);
  return fields;
}

const root = process.cwd();
const goldDir = path.join(root, "data", "gold");
const configDir = path.join(root, "sample-data", "config");
const outputPaths = [
  path.join(root, "public", "data", "demo.json"),
];

const COPY = {
  en: {
    evidenceRecent: (quantity) => `recent ${quantity.toFixed(0)} units`,
    evidenceYoY: (yoy) => `YoY ${Math.round(yoy * 100)}%`,
    evidenceWeatherBoost: (boost) => `weather boost x${boost.toFixed(2)}`,
    supplierTask: (product) => `${product.displayName} -> ${product.evidence[0]}, ${product.evidence[1]}`,
    supplierSummaryOrder: (count) => `${count} items need a real decision before cutoff.`,
    supplierSummaryWatch: (count) => `No hard order signal, but ${count} items deserve a look.`,
    supplierSummaryHealthy: "Healthy position. No urgent move today.",
    insightAction: { order: "buy now", watch: "watch carefully", skip: "hold steady" },
    insightBodyOrder: (name) =>
      `${name} is growing significantly faster than its prior-year baseline. Revenue trend and margin profile both support restocking attention.`,
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
      "Raw exports stay visible. Interpretation cards are explicit inference, not hidden truth. No inventory data is available — all signals are growth-based."
  },
  fr: {
    evidenceRecent: (quantity) => `ventes récentes ${quantity.toFixed(0)} unités`,
    evidenceYoY: (yoy) => `vs N-1 ${Math.round(yoy * 100)}%`,
    evidenceWeatherBoost: (boost) => `effet météo x${boost.toFixed(2)}`,
    supplierTask: (product) => `${product.displayName} -> ${product.evidence[0]}, ${product.evidence[1]}`,
    supplierSummaryOrder: (count) => `${count} articles demandent une vraie décision avant l'heure limite.`,
    supplierSummaryWatch: (count) => `Aucun réassort évident, mais ${count} articles méritent un contrôle.`,
    supplierSummaryHealthy: "Position saine. Aucun mouvement urgent aujourd'hui.",
    insightAction: { order: "à commander", watch: "à surveiller", skip: "à laisser" },
    insightBodyOrder: (name) =>
      `${name} progresse nettement plus vite que sa base de l'an dernier. La tendance de chiffre d'affaires et le profil de marge justifient une attention au réassort.`,
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
      "Les exports bruts restent visibles. Les cartes d'interprétation sont des inférences explicites, jamais une vérité cachée. Aucune donnée de stock n'est disponible — tous les signaux reposent sur la croissance."
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

    const yoyScore = yoy > 0.20 ? 2 : yoy > 0.10 ? 1 : yoy > -0.10 ? 0 : yoy > -0.20 ? -1 : -2;
    const revenueTier = current.totalRevenue > 5000 ? 1 : current.totalRevenue > 1000 ? 0.5 : 0;
    const marginTier = margin.marginRatio > 2.0 ? 0.5 : margin.marginRatio > 0 && margin.marginRatio < 1.2 ? -0.5 : 0;
    const score = yoyScore + revenueTier + marginTier;

    const trend = score >= 1.5 ? "hausse" : score <= -1 ? "baisse" : "stable";
    const confidence = Math.max(0.42, Math.min(0.94, 0.52 + Math.abs(score) / 6));

    const action = trend;

    const evidence = [];
    evidence.push(copy.evidenceRecent(recency.recentQuantity || current.totalQuantity));
    evidence.push(copy.evidenceYoY(yoy));
    if (margin.marginRatio > 0) evidence.push(`marge x${margin.marginRatio.toFixed(2)}`);

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
      yoy,
      action,
      confidence,
      weatherAdjustedQuantity: (recency.recentQuantity || current.totalQuantity) * weatherBoost,
      marginRatio: margin.marginRatio,
      marginHt: margin.marginHt,
      evidence,
      weatherSensitivity: correction.weatherSensitivity || "neutral",
      perishability: correction.perishability || "medium"
    };
  });

  const suppliers = Object.entries(context.suppliers).map(([name, meta]) => {
    const supplierProducts = products.filter((product) => product.supplier === name);
    const order = supplierProducts.filter((product) => product.action === "hausse");
    const watch = supplierProducts.filter((product) => product.action === "stable");
    const skip = supplierProducts.filter((product) => product.action === "baisse");
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

  const actionLabel = { hausse: "en hausse", stable: "stable", baisse: "en baisse" };
  const insights = products
    .slice()
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 6)
    .map((product) => ({
      title: `${product.displayName}: ${actionLabel[product.action] || product.action}`,
      body:
        product.action === "hausse"
          ? copy.insightBodyOrder(product.displayName)
          : product.action === "stable"
            ? copy.insightBodyWatch(product.displayName)
            : copy.insightBodySkip(product.displayName),
      confidence: product.confidence,
      evidence: product.evidence,
      rawRevenue: product.totalRevenue
    }));

  return { products, suppliers, insights };
}

function buildBriefing(products, suppliers, context, copy) {
  const topOrder = products.filter((product) => product.action === "hausse").slice(0, 4);
  const slow = products
    .filter((product) => product.action === "baisse")
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

function buildSupplierRanking(products) {
  const bySupplier = new Map();
  for (const p of products) {
    const name = p.supplier;
    if (name === "Non assigné") continue;
    const existing = bySupplier.get(name) || {
      name,
      notionUrl: p.supplierNotionUrl || "",
      totalRevenue: 0,
      productCount: 0,
      enHausse: 0,
      enBaisse: 0,
    };
    existing.totalRevenue += p.totalRevenue;
    existing.productCount += 1;
    if (p.action === "hausse") existing.enHausse += 1;
    if (p.action === "baisse") existing.enBaisse += 1;
    bySupplier.set(name, existing);
  }

  return [...bySupplier.values()]
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

// ── ISO week helpers ──────────────────────────────────────────────────────────

// Returns { week, year } per ISO 8601 (week starts Monday, week 1 = first Thursday)
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayOfWeek = d.getUTCDay() || 7; // Mon=1 … Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek); // shift to Thursday of this ISO week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

// Returns UTC Date of the Monday of ISO week `week` of `year`
function mondayOfIsoWeek(week, year) {
  // Jan 4 is always in ISO week 1
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7; // Mon=1 … Sun=7
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1) + (week - 1) * 7);
  return monday;
}

// ── Belgian public holidays ───────────────────────────────────────────────────

// Easter Sunday for a given year (Meeus/Jones/Butcher algorithm)
function easterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-based
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month, day));
}

// Returns all Belgian public holidays for a given year.
// region: "national" = both communities, "flanders" = Flandre only, "wallonia" = Wallonie/Bruxelles only
function belgianHolidays(year) {
  const easter = easterDate(year);
  const add = (d, n) => { const r = new Date(d); r.setUTCDate(r.getUTCDate() + n); return r; };
  const fmt = (d) => d.toISOString().slice(0, 10);
  return [
    { date: `${year}-01-01`, name: "Jour de l'An",                          region: "national"  },
    { date: fmt(add(easter, 1)),  name: "Lundi de Pâques",                   region: "national"  },
    { date: `${year}-05-01`, name: "Fête du Travail",                        region: "national"  },
    { date: fmt(add(easter, 39)), name: "Ascension",                         region: "national"  },
    { date: fmt(add(easter, 50)), name: "Lundi de Pentecôte",                region: "national"  },
    { date: `${year}-07-11`, name: "Fête de la Communauté flamande",         region: "flanders"  },
    { date: `${year}-07-21`, name: "Fête nationale belge",                   region: "national"  },
    { date: `${year}-08-15`, name: "Assomption",                             region: "national"  },
    { date: `${year}-09-27`, name: "Fête de la Communauté française",        region: "wallonia"  },
    { date: `${year}-11-01`, name: "Toussaint",                              region: "national"  },
    { date: `${year}-11-11`, name: "Armistice",                              region: "national"  },
    { date: `${year}-12-25`, name: "Noël",                                   region: "national"  },
  ];
}

// Returns holidays within [startDateStr, endDateStr] (inclusive, "YYYY-MM-DD")
function holidaysInRange(startStr, endStr) {
  const years = new Set();
  const sy = parseInt(startStr.slice(0, 4), 10);
  const ey = parseInt(endStr.slice(0, 4), 10);
  for (let y = sy; y <= ey; y++) years.add(y);
  const result = [];
  for (const yr of years) {
    for (const h of belgianHolidays(yr)) {
      if (h.date >= startStr && h.date <= endStr) result.push(h);
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Weekly metrics ────────────────────────────────────────────────────────────

function buildWeeklyMetrics(dailySales, runDate) {
  if (!dailySales || dailySales.length === 0) return null;

  const salesByDate = new Map(dailySales.map((d) => [d.date, d.revenue]));
  // Use noon UTC so timezone shifts don't accidentally flip the date
  const ref = new Date(runDate + "T12:00:00Z");

  // Last completed Tue–Sat window (shop is closed Sun and Mon).
  // ISO day: Mon=1 … Sat=6 … Sun=7
  const refDay = ref.getUTCDay() || 7;
  // Days to subtract from ref to reach the most recent past Saturday:
  //   Sun(7)→1, Mon(1)→2, Tue(2)→3, Wed(3)→4, Thu(4)→5, Fri(5)→6, Sat(6)→7
  const daysToLastSat = (refDay % 7) + 1;
  const lastSat = new Date(ref);
  lastSat.setUTCDate(ref.getUTCDate() - daysToLastSat);
  const lastTue = new Date(lastSat);
  lastTue.setUTCDate(lastSat.getUTCDate() - 4); // Sat−4 = Tue

  let lastWeekRev = 0;
  for (let d = new Date(lastTue); d <= lastSat; d.setUTCDate(d.getUTCDate() + 1)) {
    lastWeekRev += salesByDate.get(d.toISOString().slice(0, 10)) || 0;
  }

  // Same ISO week last year — use ISO week number so day-of-week always aligns.
  // We anchor on the ISO week of lastTue, then pick Tue–Sat of that ISO week.
  const { week: lastWeekNum, year: lastWeekYear } = isoWeek(lastTue);
  const lastYearIsoMon = mondayOfIsoWeek(lastWeekNum, lastWeekYear - 1);
  const lastYearTue = new Date(lastYearIsoMon);
  lastYearTue.setUTCDate(lastYearIsoMon.getUTCDate() + 1); // Mon+1 = Tue
  const lastYearSat = new Date(lastYearTue);
  lastYearSat.setUTCDate(lastYearTue.getUTCDate() + 4); // Tue+4 = Sat

  let sameWeekLastYear = 0;
  for (let d = new Date(lastYearTue); d <= lastYearSat; d.setUTCDate(d.getUTCDate() + 1)) {
    sameWeekLastYear += salesByDate.get(d.toISOString().slice(0, 10)) || 0;
  }

  const weekYoY = sameWeekLastYear > 0 ? (lastWeekRev - sameWeekLastYear) / sameWeekLastYear : 0;

  // Next week Tue–Sat (the week after the last completed one)
  const nextTue = new Date(lastTue);
  nextTue.setUTCDate(lastTue.getUTCDate() + 7);
  const nextSat = new Date(nextTue);
  nextSat.setUTCDate(nextTue.getUTCDate() + 4); // Tue+4 = Sat

  // Same ISO week last year for next week — the prediction base
  const { week: nextWeekNum, year: nextWeekYear } = isoWeek(nextTue);
  const nextYearIsoMon = mondayOfIsoWeek(nextWeekNum, nextWeekYear - 1);
  const nextYearTue = new Date(nextYearIsoMon);
  nextYearTue.setUTCDate(nextYearIsoMon.getUTCDate() + 1);
  const nextYearSat = new Date(nextYearTue);
  nextYearSat.setUTCDate(nextYearTue.getUTCDate() + 4);

  let nextWeekSameWeekLastYear = 0;
  for (let d = new Date(nextYearTue); d <= nextYearSat; d.setUTCDate(d.getUTCDate() + 1)) {
    nextWeekSameWeekLastYear += salesByDate.get(d.toISOString().slice(0, 10)) || 0;
  }

  const nextWeekStartStr = nextTue.toISOString().slice(0, 10);
  const nextWeekEndStr   = nextSat.toISOString().slice(0, 10);
  const nextWeekHolidays = holidaysInRange(nextWeekStartStr, nextWeekEndStr);

  // Month-to-date
  const monthStart = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
  let mtdRevenue = 0;
  for (let d = new Date(monthStart); d < ref; d.setUTCDate(d.getUTCDate() + 1)) {
    mtdRevenue += salesByDate.get(d.toISOString().slice(0, 10)) || 0;
  }

  const lastYearMonthStart = new Date(Date.UTC(ref.getUTCFullYear() - 1, ref.getUTCMonth(), 1));
  const lastYearRef = new Date(ref);
  lastYearRef.setUTCFullYear(ref.getUTCFullYear() - 1);
  let mtdLastYear = 0;
  for (let d = new Date(lastYearMonthStart); d < lastYearRef; d.setUTCDate(d.getUTCDate() + 1)) {
    mtdLastYear += salesByDate.get(d.toISOString().slice(0, 10)) || 0;
  }

  const zone = lastWeekRev >= 10500 ? "bleu" : lastWeekRev >= 9000 ? "vert" : lastWeekRev >= 7500 ? "orange" : "rouge";

  return {
    lastWeekRevenue:           Math.round(lastWeekRev),
    lastWeekStart:             lastTue.toISOString().slice(0, 10),
    lastWeekEnd:               lastSat.toISOString().slice(0, 10),
    sameWeekLastYear:          Math.round(sameWeekLastYear),
    sameWeekLastYearStart:     lastYearTue.toISOString().slice(0, 10),
    sameWeekLastYearEnd:       lastYearSat.toISOString().slice(0, 10),
    weekYoY,
    nextWeekStart:             nextWeekStartStr,
    nextWeekEnd:               nextWeekEndStr,
    nextWeekSameWeekLastYear:  Math.round(nextWeekSameWeekLastYear),
    nextWeekHolidays,
    mtdRevenue:  Math.round(mtdRevenue),
    mtdLastYear: Math.round(mtdLastYear),
    mtdYoY: mtdLastYear > 0 ? (mtdRevenue - mtdLastYear) / mtdLastYear : 0,
    zone,
  };
}

function buildTimeline(dailySales, monthlyStats) {
  // Primary source: monthly-stats per-product series, summed by year-month.
  // This gives complete revenue (all products), unlike daily-sales which is a
  // partial transaction export (~40% of real revenue for years with monthly exports).
  if (monthlyStats && monthlyStats.length > 0) {
    const monthly = new Map();
    for (const product of monthlyStats) {
      for (const s of product.series) {
        const key = `${s.year}-${String(s.month).padStart(2, "0")}`;
        monthly.set(key, (monthly.get(key) || 0) + s.revenue);
      }
    }
    if (monthly.size > 0) {
      // Append recent months not yet covered by monthly-stats (e.g. current partial year)
      // using daily-sales transaction data as a best-available fallback.
      // Pre-compute which year-months are already covered so we aggregate all days correctly.
      if (dailySales) {
        const coveredMonths = new Set(monthly.keys());
        for (const d of dailySales) {
          const key = d.date.slice(0, 7);
          if (!coveredMonths.has(key)) {
            monthly.set(key, (monthly.get(key) || 0) + d.revenue);
          }
        }
      }
      return [...monthly.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, revenue]) => ({ month, revenue: Math.round(revenue) }));
    }
  }
  // Fallback: daily-sales only (partial — use when no monthly-stats exist)
  if (!dailySales || dailySales.length === 0) return [];
  const monthly = new Map();
  for (const d of dailySales) {
    const month = d.date.slice(0, 7);
    monthly.set(month, (monthly.get(month) || 0) + d.revenue);
  }
  return [...monthly.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, revenue]) => ({ month, revenue: Math.round(revenue) }));
}

function computeAbcd(products) {
  const sorted = [...products].sort((a, b) => b.totalRevenue - a.totalRevenue);
  const total = sorted.reduce((s, p) => s + p.totalRevenue, 0);
  let cumulative = 0;
  for (const p of sorted) {
    cumulative += p.totalRevenue;
    const share = cumulative / total;
    if (share <= 0.20) p.rank = "A";
    else if (share <= 0.50) p.rank = "B";
    else if (share <= 0.80) p.rank = "C";
    else p.rank = "D";
  }
}

function buildFromGold() {
  const catalog = readGold("product-catalog.json");
  const monthlyStats = readGold("monthly-product-stats.json");
  const storeSummary = readGold("store-summary.json");
  const categoryEvolution = readGold("category-evolution.json");
  const marginRanking = readGold("margin-ranking.json");
  const dailySales = readGold("daily-sales.json");

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

  // ABCD Pareto ranking
  computeAbcd(products);

  // Build monthly lookup: productName → Map<"YYYY-MM", revenue>
  const monthlyStatsByName = new Map();
  if (monthlyStats) {
    for (const entry of monthlyStats) {
      const byMonth = new Map();
      for (const s of entry.series || []) {
        const key = `${s.year}-${String(s.month).padStart(2, "0")}`;
        byMonth.set(key, s.revenue);
      }
      monthlyStatsByName.set(entry.name, byMonth);
    }
  }

  // 36-month history Jan 2023 → Dec 2025
  const HISTORY_MONTHS = [];
  for (let y = 2023; y <= 2025; y++) {
    for (let m = 1; m <= 12; m++) {
      HISTORY_MONTHS.push(`${y}-${String(m).padStart(2, "0")}`);
    }
  }
  for (const p of products) {
    const lookup = monthlyStatsByName.get(p.key) || monthlyStatsByName.get(p.displayName);
    p.monthlyHistory = HISTORY_MONTHS.map(month => lookup ? (lookup.get(month) || 0) : 0);
  }

  // Suggested order for A+B products (revenue estimate in €)
  const runMonth = new Date(context.runDate).getMonth();
  for (const p of products) {
    if (p.rank !== "A" && p.rank !== "B") { p.suggestedOrder = null; continue; }
    const monthKey2024 = `2024-${String(runMonth + 1).padStart(2, "0")}`;
    const monthKey2025 = `2025-${String(runMonth + 1).padStart(2, "0")}`;
    const lookup = monthlyStatsByName.get(p.key) || monthlyStatsByName.get(p.displayName);
    const rev2024 = lookup ? (lookup.get(monthKey2024) || 0) : 0;
    const rev2025 = lookup ? (lookup.get(monthKey2025) || 0) : 0;
    const avgMonthly = (rev2024 + rev2025) / (rev2024 > 0 && rev2025 > 0 ? 2 : 1);
    const weeklyEst = avgMonthly / 4;
    const trend = p.yoy != null ? 1 + p.yoy : 1;
    const suggested = Math.round(weeklyEst * trend);
    p.suggestedOrder = suggested > 0 ? {
      qty: suggested,
      basis: `Mois ${runMonth + 1}, moy. 2024–2025${p.yoy != null ? `, tendance ${p.yoy > 0 ? "+" : ""}${Math.round(p.yoy * 100)}%` : ""}`
    } : null;
  }

  // Normalise orderingDays for every supplier.
  // Sources (in priority order):
  //   1. supplier-map.json  — explicit orderingDays arrays (lowercase)
  //   2. context.json       — orderDay singular string (title-case)
  const ALL_DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
  const supplierMapData = loadSupplierMap();
  for (const s of suppliers) {
    const mapEntry = [...supplierMapData.values()].find(
      v => typeof v === "object" && v.name === s.name && v.orderingDays
    );
    if (mapEntry?.orderingDays?.length) {
      s.orderingDays = mapEntry.orderingDays;
    } else if (s.orderDay) {
      const raw = s.orderDay.toLowerCase().trim();
      if (raw === "tous les jours") {
        s.orderingDays = ALL_DAYS;
      } else {
        const day = ALL_DAYS.find(d => d === raw);
        s.orderingDays = day ? [day] : [];
      }
    } else {
      s.orderingDays = [];
    }
  }

  // Build order schedule from supplier-map (authoritative, day → [{name, cutoff}])
  const FR_DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
  const orderSchedule = Object.fromEntries(FR_DAYS.map(d => [d, []]));
  const seenNames = new Set();
  for (const entry of supplierMapData.values()) {
    if (!entry.orderingDays || entry.orderingDays.length === 0) continue;
    if (!entry.name || seenNames.has(entry.name)) continue;
    seenNames.add(entry.name);
    for (const day of entry.orderingDays) {
      if (orderSchedule[day]) {
        orderSchedule[day].push({ name: entry.name, cutoff: entry.cutoff || null });
      }
    }
  }
  // Sort each day's list alphabetically by name
  for (const day of FR_DAYS) {
    orderSchedule[day].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }

  // Resolve product groups from product-master.csv (no keyword matching)
  const { productToGroup } = loadProductMaster(configDir);

  // Most products won't be in any group — that's expected.
  // Only warn about products that appear NEW (not yet in the CSV at all).

  const groupMap = new Map();
  for (const p of products) {
    const entry = productToGroup.get((p.displayName || "").toUpperCase());
    if (!entry) continue;
    if (!groupMap.has(entry.key)) {
      groupMap.set(entry.key, { key: entry.key, displayName: entry.displayName, members: [] });
    }
    groupMap.get(entry.key).members.push(p);
  }

  const productGroups = [];
  for (const [, g] of groupMap) {
    const members = g.members;
    const aggregateRevenue2025 = members.reduce((s, p) => s + p.totalRevenue, 0);
    const aggregateRevenue2024 = members.reduce((s, p) => s + (p.totalRevenuePrevious || 0), 0);

    // 12-month seasonality (2025 only) — indices 24-35 of monthlyHistory
    const seasonality = Array(12).fill(0);
    for (const p of members) {
      if (!p.monthlyHistory) continue;
      for (let m = 0; m < 12; m++) {
        seasonality[m] += p.monthlyHistory[24 + m] || 0;
      }
    }

    const topMember = [...members].sort((a, b) => b.totalRevenue - a.totalRevenue)[0];
    productGroups.push({
      key: g.key,
      displayName: g.displayName,
      members: members.map(p => p.displayName),
      aggregateRevenue2025,
      aggregateRevenue2024,
      yoy: aggregateRevenue2024 > 0 ? (aggregateRevenue2025 - aggregateRevenue2024) / aggregateRevenue2024 : null,
      seasonality,
      rank: topMember.rank || "C",
    });
  }
  productGroups.sort((a, b) => b.aggregateRevenue2025 - a.aggregateRevenue2025);

  const briefing = buildBriefing(products, suppliers, context, copy);

  // Category mix for latest year
  const latestYear = yearInfo.recent || yearInfo.current;
  let categoryMix = [];
  if (categoryEvolution) {
    const merged = new Map();
    for (const ce of categoryEvolution) {
      const clean = cleanCategory(ce.category);
      if (!clean) continue;
      // Only include categories active in the latest or current year — no fallback to
      // arbitrary past years, which caused discontinued categories to appear with 0% YoY.
      const yr = ce.years.find((y) => y.year === latestYear)
        || ce.years.find((y) => y.year === yearInfo.current);
      if (!yr) continue;
      const prevYr = yearInfo.previous ? ce.years.find((y) => y.year === yearInfo.previous) : null;
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
      .map((c) => ({
        ...c,
        share: totalRev > 0 ? (c.totalRevenue / totalRev) * 100 : 0,
        // null signals "no prior year to compare" (new category) rather than misleading 0%
        yoy: c.prevRevenue > 0 ? (c.totalRevenue - c.prevRevenue) / c.prevRevenue : null,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  const weeklyMetrics = buildWeeklyMetrics(dailySales, context.runDate);
  const timeline = buildTimeline(dailySales, monthlyStats);
  const supplierRanking = buildSupplierRanking(products);

  const heatmapPath = path.join(goldDir, "hourly-heatmap.json");
  const hourlyHeatmap = fs.existsSync(heatmapPath)
    ? JSON.parse(fs.readFileSync(heatmapPath, "utf8"))
    : null;

  const macro = {
    years: storeSummary.years.map((y) => ({
      year: y.year,
      revenue: y.totalRevenue,
      revenueSource: y.revenueSource,
      isPartial: y.isPartial || false
    })),
    timeline,
    trends: {
      hourlyHeatmap,
    },
  };

  const kpis = {
    totalRevenue: products.reduce((sum, p) => sum + p.totalRevenue, 0),
    productCount: products.length,
    enHausse: products.filter((p) => p.action === "hausse").length,
    stable: products.filter((p) => p.action === "stable").length,
    enBaisse: products.filter((p) => p.action === "baisse").length,
    avgMargin: products.filter((p) => p.marginRatio > 0).length > 0
      ? products.filter((p) => p.marginRatio > 0).reduce((s, p) => s + p.marginRatio, 0) / products.filter((p) => p.marginRatio > 0).length
      : 0,
  };

  const payload = {
    generatedAt: new Date().toISOString(),
    productLocale: context.productLocale || "en-BE",
    store: context.storeName,
    location: context.storeLocation,
    runDate: context.runDate,
    context,
    kpis,
    weeklyMetrics,
    briefing,
    orderSchedule,
    suppliers,
    topProducts: products.slice().sort((left, right) => right.totalRevenue - left.totalRevenue).slice(0, 8),
    slowProducts: products.slice().sort((left, right) => left.totalRevenue - right.totalRevenue).slice(0, 6),
    productGroups,
    products: (() => {
      // All group member names — must always be included for group expansion to work
      const groupMemberNames = new Set(productGroups.flatMap(g => g.members));

      const mapProduct = p => ({
        name: p.displayName,
        category: p.category,
        supplier: p.supplier,
        rank: p.rank,
        revenue2025: p.totalRevenue,
        revenue2024: p.totalRevenuePrevious || 0,
        growth: p.yoy,
        growthLabel: p.action,
        marginRatio: p.marginRatio || null,
        monthlyHistory: p.monthlyHistory,
        suggestedOrder: p.suggestedOrder,
      });

      const scored = products.filter(p => p.totalRevenue > 0);
      const top150 = scored
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 150);
      const top150Names = new Set(top150.map(p => p.displayName));

      // Include any group member not already in the top-150
      const groupMemberExtras = scored.filter(
        p => groupMemberNames.has(p.displayName) && !top150Names.has(p.displayName)
      );

      return [...top150, ...groupMemberExtras].map(mapProduct);
    })(),
    categoryMix,
    supplierRanking,
    insights,
    macro,
    methodology: {
      rawVsInterpreted: copy.methodologyRawVsInterpreted
    }
  };

  for (const p of outputPaths) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(payload, null, 2));
    console.log(`  Wrote ${p}`);
  }
}

function buildFromLegacy() {
  console.error("  ERROR: No Gold data found. Run the full pipeline first:");
  console.error("    npm run import      # Bronze → Silver");
  console.error("    npm run build:gold  # Silver → Gold");
  console.error("    npm run build:demo  # Gold → demo.json");
  console.error("  Or all at once: npm run build:full");
  process.exit(1);
}

async function run() {
  console.log("\nBuilding demo.json...\n");

  const hasGold = fs.existsSync(goldDir) &&
    fs.readdirSync(goldDir).some((f) => f.endsWith(".json"));

  if (hasGold) {
    console.log("  Source: Gold layer\n");
    buildFromGold();
  } else {
    buildFromLegacy();
  }
}

run();
