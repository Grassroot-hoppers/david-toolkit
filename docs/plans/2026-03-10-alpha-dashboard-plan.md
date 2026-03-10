# Alpha Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a data-driven Pencil V2 dark dashboard fed with real, honest POS data — no stock fiction, clean categories, readable product names, real weekly metrics, live weather.

**Architecture:** `build-demo.mjs` reads Gold layer JSON, applies cleanup/scoring/aggregation, writes `public/data/demo.json`. `demo/app.js` loads that JSON + Open-Meteo API at page load and populates the static HTML shell. No backend, no framework.

**Tech Stack:** Node.js ES modules (build), vanilla HTML/CSS/JS (dashboard), Open-Meteo REST API (weather)

---

### Task 1: Create supplier mapping config

**Files:**
- Create: `sample-data/config/supplier-map.json`

**Step 1: Create the mapping file**

Map POS `famille` names to normalized display names. Include known Notion URLs (empty string if unknown).

```json
{
  "_doc": "Maps POS famille values to normalized supplier names. Keys are UPPERCASE POS names.",
  "INTERBIO": { "name": "Interbio", "notionUrl": "" },
  "interbio": { "name": "Interbio", "notionUrl": "" },
  "INTER": { "name": "Interbio", "notionUrl": "" },
  "VAJRA": { "name": "Vajra", "notionUrl": "" },
  "VARJA": { "name": "Vajra", "notionUrl": "" },
  "varja": { "name": "Vajra", "notionUrl": "" },
  "MARMA": { "name": "Marma", "notionUrl": "" },
  "FROM UN": { "name": "From Un", "notionUrl": "" },
  "TERROIRIST": { "name": "Terroirist", "notionUrl": "" },
  "TERROIRSIT": { "name": "Terroirist", "notionUrl": "" },
  "TERROIRISTE": { "name": "Terroirist", "notionUrl": "" },
  "ANKORSTORE": { "name": "Ankorstore", "notionUrl": "" },
  "ANKORESTORE": { "name": "Ankorstore", "notionUrl": "" },
  "ANKOR STORE": { "name": "Ankorstore", "notionUrl": "" },
  "ANKOSTORE": { "name": "Ankorstore", "notionUrl": "" },
  "ANKORESTRORE": { "name": "Ankorstore", "notionUrl": "" },
  "ANKHORESTORE": { "name": "Ankorstore", "notionUrl": "" },
  "ANKORSTRORE": { "name": "Ankorstore", "notionUrl": "" },
  "TERRA": { "name": "Terra", "notionUrl": "" },
  "COPROSAIN": { "name": "Coprosain", "notionUrl": "" },
  "LAMBERT": { "name": "Lambert", "notionUrl": "" },
  "DYNAMIS": { "name": "Dynamis", "notionUrl": "" },
  "DELIBIO": { "name": "Délibio", "notionUrl": "" },
  "CONFISERIE": { "name": "Confiserie Gourmande", "notionUrl": "" },
  "CONFISERIE GOURMANDE": { "name": "Confiserie Gourmande", "notionUrl": "" },
  "CONFISERIE GOURANDE": { "name": "Confiserie Gourmande", "notionUrl": "" },
  "PASCAL": { "name": "Pascal", "notionUrl": "" },
  "HOMAVINUM": { "name": "Homa Vinum", "notionUrl": "" },
  "HOMA VINUM": { "name": "Homa Vinum", "notionUrl": "" },
  "CAMELLIA": { "name": "Camellia", "notionUrl": "" },
  "LALERO": { "name": "Lalero", "notionUrl": "" },
  "GREENZ": { "name": "Greenz", "notionUrl": "" },
  "GREENDEN": { "name": "Greenz", "notionUrl": "" },
  "FERME DU PEUPLIER": { "name": "Ferme du Peuplier", "notionUrl": "" },
  "GROS CHENE": { "name": "Gros Chêne", "notionUrl": "" },
  "FROMAGERIE DU GROS CHENE": { "name": "Gros Chêne", "notionUrl": "" },
  "JUMI": { "name": "Jumi", "notionUrl": "" },
  "LE GATEAU SUR LA CERISE": { "name": "Le Gâteau sur la Cerise", "notionUrl": "" },
  "THE FOOD HUB": { "name": "The Food Hub", "notionUrl": "" },
  "FOOD HUB": { "name": "The Food Hub", "notionUrl": "" },
  "REAL": { "name": "Real", "notionUrl": "" },
  "URBI": { "name": "Urbi", "notionUrl": "" },
  "MISAO": { "name": "Misao", "notionUrl": "" },
  "BJORN": { "name": "Bjorn", "notionUrl": "" },
  "SCHIETSE": { "name": "Schietse", "notionUrl": "" },
  "SCHIETZE": { "name": "Schietse", "notionUrl": "" },
  "PASTA MOBIL": { "name": "Pasta Mobil", "notionUrl": "" },
  "PASTA MOBILE": { "name": "Pasta Mobil", "notionUrl": "" },
  "BIODIS": { "name": "Biodis", "notionUrl": "" },
  "BIONATURELS": { "name": "Bionaturels", "notionUrl": "" },
  "BIONATUREL": { "name": "Bionaturels", "notionUrl": "" },
  "NONSOLOVINO": { "name": "Nonsolovino", "notionUrl": "" },
  "SWET": { "name": "Swet", "notionUrl": "" },
  "JOKA": { "name": "Joka", "notionUrl": "" },
  "DI SANTO": { "name": "Di Santo", "notionUrl": "" },
  "ELEADORA": { "name": "Eleadora", "notionUrl": "" },
  "divin": { "name": "Divin", "notionUrl": "" },
  "DIVIN": { "name": "Divin", "notionUrl": "" },
  "CLAVIE": { "name": "Clavie", "notionUrl": "" },
  "HUGO": { "name": "Hugo", "notionUrl": "" },
  "GUDULE": { "name": "Gudule", "notionUrl": "" },
  "WINE NOT": { "name": "Wine Not", "notionUrl": "" },
  "AUTENTIC": { "name": "Autentic", "notionUrl": "" },
  "LEVAIN": { "name": "Levain", "notionUrl": "" },
  "LOBET": { "name": "Lobet", "notionUrl": "" },
  "SEGARATI": { "name": "Segarati", "notionUrl": "" },
  "TAKANA": { "name": "Takana", "notionUrl": "" },
  "LABELGE": { "name": "La Belge", "notionUrl": "" },
  "LA BELGE": { "name": "La Belge", "notionUrl": "" },
  "PAIN DIT VIN": { "name": "Pain Dit Vin", "notionUrl": "" },
  "ARTOS": { "name": "Artos", "notionUrl": "" },
  "UNION": { "name": "Union", "notionUrl": "" },
  "SMEKK": { "name": "Smekk", "notionUrl": "" },
  "GILI": { "name": "Gili", "notionUrl": "" },
  "PROVINA": { "name": "Provina", "notionUrl": "" },
  "SURREALISTE": { "name": "Surréaliste", "notionUrl": "" },
  "NAO": { "name": "Nao", "notionUrl": "" },
  "CHEZ JULIEN": { "name": "Chez Julien", "notionUrl": "" },
  "BIOSANO": { "name": "Biosano", "notionUrl": "" },
  "LE PALAIS DE LA TRUFFE": { "name": "Le Palais de la Truffe", "notionUrl": "" },
  "MANU": { "name": "Manu", "notionUrl": "" },
  "BOITE DE FER": { "name": "Boîte de Fer", "notionUrl": "" },
  "FLOUMONT": { "name": "Floumont", "notionUrl": "" },
  "SUPERSEC": { "name": "Supersec", "notionUrl": "" },
  "PODOR": { "name": "Podor", "notionUrl": "" },
  "VIRGINIE T": { "name": "Virginie T", "notionUrl": "" }
}
```

**Step 2: Verify**

Run: `node -e "const m = require('./sample-data/config/supplier-map.json'); console.log(Object.keys(m).length, 'mappings')"`
Expected: ~80 mappings, no parse errors.

**Step 3: Commit**

```bash
git add sample-data/config/supplier-map.json
git commit -m "feat: add POS supplier name mapping with typo deduplication"
```

---

### Task 2: Rewrite build-demo.mjs — category cleanup

**Files:**
- Modify: `scripts/build-demo.mjs`

**Step 1: Add category cleanup function**

Add after the `normalizeKey` function (~line 103):

```javascript
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
```

**Step 2: Update category evolution processing**

In `buildFromGold()`, replace the category mix block (~lines 437-450) to use `cleanCategory` and merge duplicates:

```javascript
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
```

**Step 3: Verify**

Run: `node scripts/build-demo.mjs && node -e "const d = require('./public/data/demo.json'); console.log(d.categoryMix.length, 'categories'); d.categoryMix.slice(0,5).forEach(c => console.log(c.category, Math.round(c.share)+'%'))"`
Expected: ~15-20 categories (not 149), clean French names, shares that sum to ~100%.

**Step 4: Commit**

```bash
git add scripts/build-demo.mjs
git commit -m "feat: clean category names — strip prefixes, VAT rates, merge dupes, filter junk"
```

---

### Task 3: Rewrite build-demo.mjs — product name cleanup + supplier normalization

**Files:**
- Modify: `scripts/build-demo.mjs`

**Step 1: Add product name and supplier helper functions**

Add after the category functions:

```javascript
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
```

**Step 2: Update the product builder**

In `buildProducts()`, update the product mapping (~line 316-319) to use clean names and supplier map:

```javascript
const supplierMap = loadSupplierMap();

// Inside the allKeys.map callback, replace the return object:
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
  // ... rest stays same
};
```

**Step 3: Verify**

Run: `node scripts/build-demo.mjs && node -e "const d = require('./public/data/demo.json'); d.topProducts.slice(0,5).forEach(p => console.log(p.displayName, '|', p.supplier))"`
Expected: Title-cased product names, normalized supplier names (not raw POS caps).

**Step 4: Commit**

```bash
git add scripts/build-demo.mjs
git commit -m "feat: clean product names (title case) and normalize supplier names from mapping"
```

---

### Task 4: Rewrite build-demo.mjs — growth-based scoring (kill stock)

**Files:**
- Modify: `scripts/build-demo.mjs`

**Step 1: Replace the scoring block in buildProducts**

Replace the entire scoring section (lines ~276-304) with:

```javascript
// Growth-based scoring — no stock data available
const yoyScore = yoy > 0.20 ? 2 : yoy > 0.10 ? 1 : yoy > -0.10 ? 0 : yoy > -0.20 ? -1 : -2;
const revenueTier = current.totalRevenue > 5000 ? 1 : current.totalRevenue > 1000 ? 0.5 : 0;
const marginTier = margin.marginRatio > 2.0 ? 0.5 : margin.marginRatio > 0 && margin.marginRatio < 1.2 ? -0.5 : 0;
const score = yoyScore + revenueTier + marginTier;

const trend = score >= 1.5 ? "hausse" : score <= -1 ? "baisse" : "stable";
const confidence = Math.max(0.42, Math.min(0.94, 0.52 + Math.abs(score) / 6));

// Remove all stock/demand variables — set to 0
const demandPressure = 0;
const stockCoverWeeks = 0;
const stockoutSuspicion = 0;
```

Also update the action assignment and evidence block:

```javascript
const action = trend; // "hausse" / "stable" / "baisse" replaces order/watch/skip

const evidence = [];
evidence.push(copy.evidenceRecent(recency.recentQuantity || current.totalQuantity));
evidence.push(copy.evidenceYoY(yoy));
if (margin.marginRatio > 0) evidence.push(`marge x${margin.marginRatio.toFixed(2)}`);
```

**Step 2: Update the supplier builder to use trend instead of action**

In the supplier building section (~lines 342-361), replace references to `product.action === "order"` with `product.action === "hausse"`, etc:

```javascript
const order = supplierProducts.filter((p) => p.action === "hausse");
const watch = supplierProducts.filter((p) => p.action === "stable");
const skip = supplierProducts.filter((p) => p.action === "baisse");
```

**Step 3: Update KPIs in the payload**

Replace the kpis block (~lines 462-466):

```javascript
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
```

**Step 4: Verify**

Run: `node scripts/build-demo.mjs && node -e "const d = require('./public/data/demo.json'); console.log('KPIs:', JSON.stringify(d.kpis, null, 2))"`
Expected: `enHausse` should be << 1030 (the old broken number). Reasonable distribution across hausse/stable/baisse.

**Step 5: Commit**

```bash
git add scripts/build-demo.mjs
git commit -m "feat: growth-based scoring — kill stock fiction, classify by YoY trend"
```

---

### Task 5: Add weekly metrics + monthly timeline to build-demo.mjs

**Files:**
- Modify: `scripts/build-demo.mjs`

**Step 1: Add weekly metrics computation**

Add a new function that reads `daily-sales.json` from Gold:

```javascript
function buildWeeklyMetrics(dailySales, runDate) {
  if (!dailySales || dailySales.length === 0) return null;

  const salesByDate = new Map(dailySales.map((d) => [d.date, d.revenue]));
  const ref = new Date(runDate);

  // Last full week (Mon-Sat before runDate)
  const lastSat = new Date(ref);
  lastSat.setDate(ref.getDate() - ref.getDay()); // Sunday
  lastSat.setDate(lastSat.getDate() - 1); // Saturday
  const lastMon = new Date(lastSat);
  lastMon.setDate(lastSat.getDate() - 5); // Monday

  let lastWeekRev = 0;
  for (let d = new Date(lastMon); d <= lastSat; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    lastWeekRev += salesByDate.get(key) || 0;
  }

  // Same calendar week last year
  const lastYearMon = new Date(lastMon);
  lastYearMon.setFullYear(lastYearMon.getFullYear() - 1);
  const lastYearSat = new Date(lastYearMon);
  lastYearSat.setDate(lastYearMon.getDate() + 5);

  let sameWeekLastYear = 0;
  for (let d = new Date(lastYearMon); d <= lastYearSat; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    sameWeekLastYear += salesByDate.get(key) || 0;
  }

  const weekYoY = sameWeekLastYear > 0 ? (lastWeekRev - sameWeekLastYear) / sameWeekLastYear : 0;

  // Month-to-date
  const monthStart = new Date(ref.getFullYear(), ref.getMonth(), 1);
  let mtdRevenue = 0;
  for (let d = new Date(monthStart); d < ref; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    mtdRevenue += salesByDate.get(key) || 0;
  }

  // Same MTD last year
  const lastYearMonthStart = new Date(ref.getFullYear() - 1, ref.getMonth(), 1);
  const lastYearRef = new Date(ref);
  lastYearRef.setFullYear(ref.getFullYear() - 1);
  let mtdLastYear = 0;
  for (let d = new Date(lastYearMonthStart); d < lastYearRef; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    mtdLastYear += salesByDate.get(key) || 0;
  }

  const zone = lastWeekRev >= 10500 ? "bleu" : lastWeekRev >= 9000 ? "vert" : lastWeekRev >= 7500 ? "orange" : "rouge";

  return {
    lastWeekRevenue: Math.round(lastWeekRev),
    lastWeekStart: lastMon.toISOString().slice(0, 10),
    lastWeekEnd: lastSat.toISOString().slice(0, 10),
    sameWeekLastYear: Math.round(sameWeekLastYear),
    weekYoY,
    mtdRevenue: Math.round(mtdRevenue),
    mtdLastYear: Math.round(mtdLastYear),
    mtdYoY: mtdLastYear > 0 ? (mtdRevenue - mtdLastYear) / mtdLastYear : 0,
    zone,
  };
}
```

**Step 2: Add monthly timeline builder**

```javascript
function buildTimeline(dailySales) {
  if (!dailySales || dailySales.length === 0) return [];
  const monthly = new Map();
  for (const d of dailySales) {
    const month = d.date.slice(0, 7); // "2025-03"
    monthly.set(month, (monthly.get(month) || 0) + d.revenue);
  }
  return [...monthly.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, revenue]) => ({ month, revenue: Math.round(revenue) }));
}
```

**Step 3: Wire into buildFromGold**

After loading Gold files, add:

```javascript
const dailySales = readGold("daily-sales.json");
const weeklyMetrics = buildWeeklyMetrics(dailySales, context.runDate);
const timeline = buildTimeline(dailySales);
```

Update the payload to include:

```javascript
const macro = {
  years: storeSummary.years.map((y) => ({ year: y.year, revenue: y.totalRevenue })),
  timeline,
};

// Add weeklyMetrics to the payload:
weeklyMetrics,
```

**Step 4: Verify**

Run: `node scripts/build-demo.mjs && node -e "const d = require('./public/data/demo.json'); console.log('Weekly:', JSON.stringify(d.weeklyMetrics, null, 2)); console.log('Timeline entries:', d.macro.timeline.length)"`
Expected: weeklyMetrics with real revenue numbers, timeline with 30+ monthly entries.

**Step 5: Commit**

```bash
git add scripts/build-demo.mjs
git commit -m "feat: add weekly metrics and monthly timeline from daily sales"
```

---

### Task 6: Build supplier ranking for Commandes du jour

**Files:**
- Modify: `scripts/build-demo.mjs`

**Step 1: Rebuild the suppliers section**

Replace the supplier builder in `buildProducts` to rank by actual revenue and include all real suppliers (not just the 5 from config):

```javascript
function buildSupplierRanking(products, supplierMap) {
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
```

Add this to the payload as `supplierRanking`.

**Step 2: Determine today's ordering suppliers**

Add ordering schedule info. For the alpha, hardcode a day-of-week → supplier mapping in context.json (or derive from existing supplier config). The dashboard filters `supplierRanking` to show only today's suppliers.

**Step 3: Verify**

Run: `node scripts/build-demo.mjs && node -e "const d = require('./public/data/demo.json'); d.supplierRanking.slice(0,5).forEach(s => console.log(s.rank, s.name, Math.round(s.totalRevenue)+'€', s.productCount+'p'))"`
Expected: Top suppliers by real revenue (Interbio ~120K, From Un, Vajra, etc).

**Step 4: Commit**

```bash
git add scripts/build-demo.mjs
git commit -m "feat: add supplier ranking by real revenue"
```

---

### Task 7: Wire demo/index.html — add data-binding IDs + swap tasks for categories

**Files:**
- Modify: `demo/index.html`

**Step 1: Add id attributes to dynamic elements**

Add `id` attributes to all elements that need data binding:
- Signal headline: `id="signal-headline"`
- Stats row entries: `id="signal-yoy"`, `id="signal-pace"`
- Context text: `id="signal-context"`
- KPI values: `id="kpi-last-week"`, `id="kpi-last-year"`, `id="kpi-month-target"`
- KPI trends: `id="kpi-week-yoy"`, `id="kpi-month-trend"`
- KPI dates: `id="kpi-week-dates"`, `id="kpi-year-dates"`
- Zone badge: `id="zone-badge"`
- Supplier cards container: `id="supplier-cards"`
- Performance gauge value: `id="perf-value"`, marker: `id="gauge-marker-line"`, `id="gauge-marker-dot"`
- Weather cards container: `id="weather-strip"`

**Step 2: Replace Tâches du jour with Top Catégories**

Replace the `.bot-left` task section in screen-dashboard with:

```html
<div class="bot-left">
  <div class="task-header">
    <span class="section-label">TOP CATÉGORIES</span>
    <div style="display:flex;align-items:center;gap:12px">
      <span class="task-count" id="cat-count"></span>
      <svg class="chevron-icon" ...></svg>
    </div>
  </div>
  <div class="task-list" id="category-list">
    <!-- Populated by app.js -->
  </div>
</div>
```

Also do the same for screen-collapsed.

**Step 3: Verify**

Open `demo/index.html` in browser — should still render correctly with placeholder structure.

**Step 4: Commit**

```bash
git add demo/index.html
git commit -m "feat: add data-binding IDs, swap tasks section for top categories"
```

---

### Task 8: Wire demo/app.js — load data and populate dashboard

**Files:**
- Modify: `demo/app.js`

**Step 1: Rewrite app.js to load demo.json and populate all sections**

This is the largest single task. The new app.js:
1. Fetches `../public/data/demo.json`
2. Populates signal card (headline, YoY, pace, context)
3. Populates 3 KPI cards (revenue numbers, dates, trends, zone)
4. Populates supplier cards (top 3 due today, or top 3 overall)
5. Populates category list (top 8 categories with share + YoY)
6. Populates performance gauge (value, marker position, zone)

Key implementation details:
- Format euros: `new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })`
- Zone color mapping: rouge → red, orange → orange, vert → green, bleu → blue
- Gauge marker: position % = `(revenue / 14000) * 100`, capped at 100

**Step 2: Verify**

Run: `npx serve demo` or open in browser. All numbers should be real data.

**Step 3: Commit**

```bash
git add demo/app.js
git commit -m "feat: data-driven dashboard — load demo.json, populate all sections"
```

---

### Task 9: Add Open-Meteo weather API

**Files:**
- Modify: `demo/app.js`

**Step 1: Add weather fetching function**

```javascript
const WMO_CODES = {
  0: { desc: "Soleil", icon: "sun" },
  1: { desc: "Éclaircies", icon: "sun-cloud" },
  2: { desc: "Nuageux", icon: "cloud" },
  3: { desc: "Couvert", icon: "cloud" },
  45: { desc: "Brouillard", icon: "cloud" },
  51: { desc: "Bruine", icon: "rain" },
  53: { desc: "Bruine", icon: "rain" },
  61: { desc: "Pluie", icon: "rain" },
  63: { desc: "Pluie mod.", icon: "rain" },
  65: { desc: "Forte pluie", icon: "rain" },
  71: { desc: "Neige", icon: "snow" },
  80: { desc: "Averses", icon: "rain" },
  95: { desc: "Orage", icon: "storm" },
};

async function fetchWeather() {
  const url = "https://api.open-meteo.com/v1/forecast?latitude=50.85&longitude=4.35&daily=temperature_2m_max,weathercode&timezone=Europe/Brussels&forecast_days=7";
  const res = await fetch(url);
  const data = await res.json();
  return data.daily.time.map((date, i) => ({
    date,
    temp: Math.round(data.daily.temperature_2m_max[i]),
    code: data.daily.weathercode[i],
    ...(WMO_CODES[data.daily.weathercode[i]] || { desc: "—", icon: "cloud" }),
  }));
}
```

**Step 2: Populate weather strip from API data**

Replace the static weather cards with dynamically generated ones using the same HTML/CSS pattern.

**Step 3: Verify**

Open dashboard — weather strip should show real Brussels forecast with correct temps and icons.

**Step 4: Commit**

```bash
git add demo/app.js
git commit -m "feat: live Brussels weather from Open-Meteo API"
```

---

### Task 10: Final integration — rebuild, verify, serve

**Step 1: Full rebuild**

```bash
node scripts/import-silver.mjs
node scripts/build-gold.mjs
node scripts/build-demo.mjs
```

**Step 2: Verify data quality**

```bash
node -e "
const d = require('./public/data/demo.json');
console.log('Products:', d.kpis.productCount);
console.log('En hausse:', d.kpis.enHausse);
console.log('Stable:', d.kpis.stable);
console.log('En baisse:', d.kpis.enBaisse);
console.log('Categories:', d.categoryMix.length);
console.log('Suppliers:', d.supplierRanking?.length);
console.log('Timeline months:', d.macro.timeline.length);
console.log('Weekly rev:', d.weeklyMetrics?.lastWeekRevenue);
"
```

**Step 3: Serve and visually verify**

```bash
npx serve demo -l 4173
```

Open http://localhost:4173 — verify:
- [ ] KPI cards show real euro amounts
- [ ] Signal headline matches weekly trend
- [ ] Supplier cards show real suppliers with revenue
- [ ] Category list shows ~15 clean categories with shares
- [ ] Performance gauge shows real weekly revenue
- [ ] Weather strip shows real Brussels forecast
- [ ] No "1,030 order signals" or stock-based noise anywhere

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: alpha dashboard — honest big picture with real POS data"
```
