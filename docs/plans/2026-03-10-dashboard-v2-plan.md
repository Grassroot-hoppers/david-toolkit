# Dashboard V2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the alpha dashboard from a metrics summary into a multi-tab retail intelligence tool with trusted data, pipeline visualization, and actionable product/category intelligence.

**Architecture:** Single-page vanilla HTML/CSS/JS app. One expanded `demo.json` produced by `build-demo.mjs` from Gold layer data + config files. 8 tabs, all rendered client-side from the JSON. No framework, no backend.

**Tech Stack:** Node.js scripts (ESM), vanilla HTML/CSS/JS, Open-Meteo API (weather).

**Design doc:** `docs/plans/2026-03-10-day3-dashboard-v2-design.md`

---

## Phase A: Data Trust — Listing Scripts & Config Files

The foundation. Build listing scripts so the operator can review raw data and dictate corrections.

### Task 1: Category listing script + config

**Files:**
- Create: `scripts/list-categories.mjs`
- Create: `sample-data/config/category-map.json`
- Modify: `package.json` (add `list:categories` script)

**Step 1: Create category-map.json from existing CATEGORY_DISPLAY**

Extract the hardcoded `CATEGORY_DISPLAY` map from `scripts/build-demo.mjs:107-134` into a standalone config file at `sample-data/config/category-map.json`. Format:

```json
{
  "_doc": "Maps raw POS category names (uppercased, stripped of prefix/suffix) to clean display names. Reviewed by operator.",
  "FRUIT ET LEGUME": "Fruits & Légumes",
  "FROMAGE": "Fromages"
}
```

Include all entries currently in the `CATEGORY_DISPLAY` object, plus `CATEGORY_FILTERS` patterns as a `_filters` array.

**Step 2: Create listing script**

Create `scripts/list-categories.mjs` that:
1. Reads `data/gold/category-evolution.json`
2. Extracts all unique raw category names
3. For each: shows the raw name, the current auto-cleaned result, and the config mapping (if any)
4. Groups output: "Mapped" (has config entry), "Auto-cleaned" (no config, auto-clean worked), "Unmapped" (no config, auto-clean returned null/raw)
5. Prints total counts

Output format (stdout, reviewable):
```
=== MAPPED (24 catégories) ===
  "FRUIT ET LEGUME" → Fruits & Légumes (config)
  "FROMAGE" → Fromages (config)
  ...

=== AUTO-CLEANED (3 catégories) ===
  "PAIN" → Pain (auto title-case)
  ...

=== FILTERED (12 entrées supprimées) ===
  "DIV. EAN VRAC" (junk pattern)
  ...

=== REVIEW NEEDED (0) ===
  (none)
```

**Step 3: Add npm script**

Add to `package.json` scripts: `"list:categories": "node scripts/list-categories.mjs"`

**Step 4: Update build-demo.mjs to read from config**

Replace the hardcoded `CATEGORY_DISPLAY` and `CATEGORY_FILTERS` in `scripts/build-demo.mjs` with reads from `sample-data/config/category-map.json`. The `cleanCategory()` function should load the map and filters from the config file.

**Step 5: Run and verify**

```
npm run list:categories
```

Expected: All current categories listed. No "REVIEW NEEDED" entries (existing map covers them). Then:

```
npm run build:demo
```

Expected: `demo.json` unchanged — same output, just reading from config now.

**Step 6: Commit**

```
git add scripts/list-categories.mjs sample-data/config/category-map.json package.json scripts/build-demo.mjs
git commit -m "feat: extract category map to config, add listing script"
```

---

### Task 2: ABCD ranking computation + listing script

**Files:**
- Modify: `scripts/build-demo.mjs` (add ABCD Pareto computation)
- Create: `scripts/list-ranking.mjs`
- Create: `sample-data/config/ranking-overrides.json`
- Modify: `package.json` (add `list:ranking` script)

**Step 1: Add ABCD Pareto to build-demo.mjs**

After the `buildProducts()` function runs and returns the `products` array, add a function `assignABCD(products)`:

```javascript
function assignABCD(products) {
  const overrides = JSON.parse(fs.readFileSync(
    path.join(configDir, "ranking-overrides.json"), "utf8"
  ));
  const sorted = [...products].sort((a, b) => b.totalRevenue - a.totalRevenue);
  const totalRev = sorted.reduce((s, p) => s + p.totalRevenue, 0);

  let cumulative = 0;
  for (const p of sorted) {
    if (overrides[p.key]) {
      p.rank = overrides[p.key];
      cumulative += p.totalRevenue;
      continue;
    }
    cumulative += p.totalRevenue;
    const pct = cumulative / totalRev;
    p.rank = pct <= 0.20 ? "A" : pct <= 0.50 ? "B" : pct <= 0.80 ? "C" : "D";
  }
  return products;
}
```

Call it: `const rankedProducts = assignABCD(products);`

Include `rank` in each product object in the final `demo.json` payload.

**Step 2: Create ranking-overrides.json**

```json
{
  "_doc": "Manual ABCD rank overrides. Key = product key, value = A|B|C|D. Reviewed by operator."
}
```

**Step 3: Create listing script**

Create `scripts/list-ranking.mjs` that:
1. Runs the build pipeline logic (or reads from a recently built `demo.json`)
2. Prints products grouped by rank: A, B, C, D
3. For each: name, revenue, cumulative %, category, supplier
4. Summary line: "A: 120 produits (52% CA) | B: 380 (28%) | C: 900 (15%) | D: 1600 (5%)"

**Step 4: Add npm script**

`"list:ranking": "node scripts/list-ranking.mjs"`

**Step 5: Run and verify**

```
npm run build:demo
npm run list:ranking
```

Expected: Products ranked by revenue. A products are top sellers.

**Step 6: Commit**

```
git add scripts/list-ranking.mjs scripts/build-demo.mjs sample-data/config/ranking-overrides.json package.json
git commit -m "feat: add ABCD Pareto ranking with listing script"
```

---

### Task 3: Product name listing script

**Files:**
- Create: `scripts/list-products.mjs`
- Modify: `package.json` (add `list:products` script)

**Step 1: Create listing script**

Create `scripts/list-products.mjs` that:
1. Reads `demo.json` (must be built first)
2. Lists top 200 products by revenue
3. For each: raw POS name, auto-cleaned name, correction (if any from product-corrections.json), rank, revenue
4. Flags obvious issues: names that are ALL CAPS still, names with weight prefixes not stripped, names shorter than 3 chars

Output format:
```
=== TOP 200 PRODUCTS BY REVENUE ===

  #1 [A] 4,820€  "MAYONNAISE BIO 310GR" → Mayonnaise Bio 310gr ✓
  #2 [A] 4,100€  "POMME JONAGOLD KG" → Pomme Jonagold Kg ✓
  ...
  #45 [B] 890€   "(00106g/34,68€Kg)FILET POULET" → (00106g/34,68€Kg)filet Poulet ⚠ weight prefix

=== FLAGGED (12 issues) ===
  #45 weight prefix not stripped: "(00106g/34,68€Kg)FILET POULET"
  ...
```

**Step 2: Add npm script**

`"list:products": "node scripts/list-products.mjs"`

**Step 3: Run and verify**

```
npm run list:products
```

**Step 4: Commit**

```
git add scripts/list-products.mjs package.json
git commit -m "feat: add product name listing script for review"
```

---

### Task 4: Human review sessions (INTERACTIVE — requires operator)

**This task is NOT automated. It's a facilitated session.**

**Step 1: Category review**

Run `npm run list:categories`. Operator reviews output, dictates corrections:
- "PAIN should be Boulangerie"
- "CONSERV - A TRIER merge with EPICERIE"
- etc.

Update `sample-data/config/category-map.json` with corrections. Re-run `npm run list:categories` to verify. Repeat until operator is satisfied.

**Step 2: ABCD ranking review**

Run `npm run list:ranking`. Operator reviews, dictates overrides:
- "Product X should be A not B because it's essential for shop identity"
- "Product Y should be D, we're delisting it"

Update `sample-data/config/ranking-overrides.json`. Re-run to verify.

**Step 3: Product name review**

Run `npm run list:products`. Operator reviews top 200, dictates corrections.
Update `sample-data/config/product-corrections.json`. Re-run to verify.

**Step 4: Commit all corrections**

```
git add sample-data/config/
git commit -m "feat: operator-reviewed data — categories, rankings, product names"
```

---

## Phase B: Expanded demo.json

Extend `build-demo.mjs` to produce the full data needed for all tabs.

### Task 5: Include all products in demo.json (not just top 20)

**Files:**
- Modify: `scripts/build-demo.mjs`

**Step 1: Expand the payload**

Currently the payload includes `topProducts` (top 8) and `slowProducts` (bottom 6). Replace with the full `products` array (all ~3000, with rank). Keep `topProducts` and `slowProducts` as convenience slices for Tab 1.

In the `payload` object in `buildFromGold()`, add:

```javascript
products: rankedProducts.map(p => ({
  key: p.key,
  name: p.displayName,
  rawName: productsCurrent.get(p.key)?.rawName || p.key,
  category: p.category,
  supplier: p.supplier,
  supplierNotionUrl: p.supplierNotionUrl,
  rank: p.rank,
  revenue: p.totalRevenue,
  revenuePrevious: p.totalRevenuePrevious,
  growth: p.yoy,
  growthLabel: p.action,
  marginRatio: p.marginRatio,
  recentQuantity: p.recentQuantity,
  evidence: p.evidence,
})),
```

**Step 2: Add monthly history per product**

For each product, include the 36-month revenue history from `monthlyStats`. This powers sparklines in Tab 2.

```javascript
monthlyHistory: (monthlyStats || [])
  .find(ms => ms.key === p.key)
  ?.series.map(s => ({ year: s.year, month: s.month, revenue: s.revenue, quantity: s.quantity }))
  || []
```

**Step 3: Run and verify**

```
npm run build:demo
```

Check `demo/data/demo.json`: should now contain a `products` array with ~3000 entries. File size should be ~1-2MB.

**Step 4: Commit**

```
git commit -am "feat: include full product catalog with monthly history in demo.json"
```

---

### Task 6: Add audit section to demo.json

**Files:**
- Modify: `scripts/build-demo.mjs`

**Step 1: Build audit data**

Add to the payload:

```javascript
audit: {
  categoryMap: JSON.parse(fs.readFileSync(path.join(configDir, "category-map.json"), "utf8")),
  supplierMap: Object.fromEntries(
    [...loadSupplierMap().entries()].filter(([k]) => !k.startsWith("_"))
  ),
  rankingBreakdown: {
    A: rankedProducts.filter(p => p.rank === "A").length,
    B: rankedProducts.filter(p => p.rank === "B").length,
    C: rankedProducts.filter(p => p.rank === "C").length,
    D: rankedProducts.filter(p => p.rank === "D").length,
  },
  totalProducts: rankedProducts.length,
  unmappedCategories: /* products where cleanCategory returned raw value */,
  unmappedSuppliers: /* products where supplier is "Non assigné" */,
},
```

**Step 2: Add pipeline metadata**

```javascript
meta: {
  generatedAt: new Date().toISOString(),
  pipeline: {
    bronze: { fileCount: fs.readdirSync(path.join(root, "data", "real")).filter(f => f.endsWith(".csv")).length },
    silver: { fileCount: fs.readdirSync(path.join(root, "data", "silver")).filter(f => f.endsWith(".json")).length },
    gold: { fileCount: fs.readdirSync(goldDir).filter(f => f.endsWith(".json")).length },
    nodes: [
      { id: "bronze", label: "Bronze (CSV bruts)", type: "layer", fileCount: N },
      { id: "silver", label: "Silver (JSON nettoyé)", type: "layer", fileCount: N },
      { id: "gold", label: "Gold (agrégats)", type: "layer", fileCount: N },
      { id: "demo", label: "demo.json", type: "output" },
    ],
    edges: [
      { from: "bronze", to: "silver", label: "import-silver.mjs" },
      { from: "silver", to: "gold", label: "build-gold.mjs" },
      { from: "gold", to: "demo", label: "build-demo.mjs" },
    ]
  }
},
```

**Step 3: Run and verify**

```
npm run build:demo
```

Check `demo/data/demo.json` has `audit` and `meta.pipeline` sections.

**Step 4: Commit**

```
git commit -am "feat: add audit section and pipeline metadata to demo.json"
```

---

### Task 7: Belgian holiday calendar + context engine

**Files:**
- Create: `sample-data/config/holidays-be.json`
- Modify: `scripts/build-demo.mjs` (add briefing generator)

**Step 1: Create holidays-be.json**

Belgian public holidays 2024-2027. Format:

```json
{
  "_doc": "Belgian public holidays. Used for prediction adjustments and daily briefing.",
  "holidays": [
    { "date": "2026-01-01", "name": "Nouvel An", "impact": "closed" },
    { "date": "2026-04-05", "name": "Dimanche de Pâques", "impact": "closed" },
    { "date": "2026-04-06", "name": "Lundi de Pâques", "impact": "closed" },
    { "date": "2026-05-01", "name": "Fête du Travail", "impact": "closed" },
    { "date": "2026-05-14", "name": "Ascension", "impact": "boost" },
    { "date": "2026-05-24", "name": "Dimanche de Pentecôte", "impact": "closed" },
    { "date": "2026-05-25", "name": "Lundi de Pentecôte", "impact": "closed" },
    { "date": "2026-07-21", "name": "Fête nationale", "impact": "closed" },
    { "date": "2026-08-15", "name": "Assomption", "impact": "closed" },
    { "date": "2026-11-01", "name": "Toussaint", "impact": "closed" },
    { "date": "2026-11-11", "name": "Armistice", "impact": "closed" },
    { "date": "2026-12-25", "name": "Noël", "impact": "closed" }
  ],
  "schoolBreaks": [
    { "start": "2026-02-16", "end": "2026-02-27", "name": "Carnaval" },
    { "start": "2026-04-06", "end": "2026-04-17", "name": "Pâques" },
    { "start": "2026-07-01", "end": "2026-08-31", "name": "Été" },
    { "start": "2026-10-26", "end": "2026-11-06", "name": "Toussaint" },
    { "start": "2026-12-21", "end": "2027-01-02", "name": "Noël" }
  ]
}
```

Include 2024, 2025, 2026, 2027.

**Step 2: Build context engine in build-demo.mjs**

Add a `buildBriefingV2(products, suppliers, dailySales, context, holidays, runDate)` function that generates:

```javascript
{
  dayOfWeek: "Mardi",
  isOrderingDay: true,
  orderingSuppliers: [{ name: "Interbio", cutoff: "09:30" }, { name: "Pantry", cutoff: "17:00" }],
  upcomingHolidays: [{ name: "Pâques", daysUntil: 12, impact: "closed" }],
  upcomingSchoolBreak: { name: "Pâques", daysUntil: 12, status: "approaching" },
  weatherAlerts: [],  // filled at page load from Open-Meteo
  seasonalSignals: ["Même semaine 2025: pic fruits rouges"],
  prediction: {
    nextWeekRevenue: 9800,
    confidence: "medium",
    drivers: ["Last year same week: 9200€", "Trend: +8%", "No holidays"],
    basis: { lastYearSameWeek: 9200, trendFactor: 1.08, holidayFactor: 1.0 }
  },
  briefingText: "Mardi — jour de commande Interbio (avant 09h30) et Pantry (avant 17h). Vacances de Pâques dans 12 jours — anticiper les commandes de produits frais..."
}
```

The `briefingText` is assembled from the structured data above — not hardcoded prose.

**Step 3: Add prediction model**

Simple statistical prediction in `buildPrediction(dailySales, runDate, holidays)`:

```javascript
function buildPrediction(dailySales, runDate, holidays) {
  // Find same ISO week last year
  // Get that week's total revenue
  // Apply YoY trend factor from recent 4-week average
  // Check if any holiday falls in the predicted week → adjust
  // Return { revenue, confidence, drivers[] }
}
```

Confidence levels: "high" (3 years of data for this week), "medium" (2 years), "low" (1 year or less).

**Step 4: Run and verify**

```
npm run build:demo
```

Check `demo/data/demo.json` has `overview.briefing` with structured data.

**Step 5: Commit**

```
git commit -am "feat: Belgian holiday calendar + context engine with weekly prediction"
```

---

## Phase C: Tab Framework

Replace the current 2-screen navigation with an 8-tab system.

### Task 8: Tab navigation in HTML

**Files:**
- Modify: `demo/index.html`
- Modify: `demo/app.js`
- Modify: `demo/styles.css`

**Step 1: Replace sidebar nav items with tab-relevant items**

The current sidebar has: Tableau de bord, Roadmap, Fournisseurs, Commandes, Inventaire, Équipe, Paramètres. Most are non-functional placeholders.

Replace with the 8 real tabs:
1. Briefing (icon: calendar/sun)
2. Produits (icon: package)
3. Catégories (icon: grid/layout)
4. Fournisseurs (icon: truck)
5. Tendances (icon: trending-up)
6. Pipeline (icon: git-branch/workflow)
7. Données (icon: database)
8. À réfléchir (icon: lightbulb)

Each `<a>` gets `data-screen="briefing"`, `data-screen="produits"`, etc.

**Step 2: Add section scaffolding**

After the existing `<main id="screen-dashboard">`, add empty sections for each tab:

```html
<main class="main-content" id="screen-produits">
  <div class="top-bar"><h1 class="page-title">Produits</h1></div>
  <div class="tab-content" id="tab-produits"></div>
</main>

<main class="main-content" id="screen-categories">
  <div class="top-bar"><h1 class="page-title">Catégories</h1></div>
  <div class="tab-content" id="tab-categories"></div>
</main>
```

...and so on for all 8 tabs.

**Step 3: Update setupNav() in app.js**

Replace the hardcoded `screenMap` with a dynamic lookup:

```javascript
function setupNav() {
  const navItems = document.querySelectorAll('.nav-item[data-screen]');
  const screens = document.querySelectorAll('.main-content');

  navItems.forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const screenId = `screen-${item.dataset.screen}`;
      const target = document.getElementById(screenId);
      if (!target) return;
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      screens.forEach(s => s.classList.remove('active'));
      target.classList.add('active');
    });
  });
}
```

**Step 4: Add basic tab content styles**

In `styles.css`, add `.tab-content` with appropriate padding. Each tab's content will be rendered by JS.

**Step 5: Run and verify**

Open `demo/index.html` in browser. Click each tab — should switch screens. Only Briefing (the renamed Tab 1) has real content; others show their title.

**Step 6: Commit**

```
git commit -am "feat: 8-tab navigation framework replacing 2-screen layout"
```

---

## Phase D: Tab 1 — Briefing du jour

### Task 9: Render the daily briefing

**Files:**
- Modify: `demo/app.js` (rewrite `renderSignal` → `renderBriefing`)
- Modify: `demo/index.html` (update Tab 1 section)
- Modify: `demo/styles.css` (briefing-specific styles)

**Step 1: Restructure Tab 1 HTML**

Replace the current "SIGNAL DE LA SEMAINE" + KPI cards + Categories + Performance Zone layout with:

```html
<!-- Briefing du jour -->
<div class="briefing-section">
  <div class="briefing-text" id="briefing-text"></div>
  <div class="briefing-alerts" id="briefing-alerts"></div>
</div>

<!-- Prediction -->
<div class="prediction-section">
  <div class="prediction-card" id="prediction-card"></div>
  <div class="prediction-tracking" id="prediction-tracking"></div>
</div>

<!-- KPI row (kept, minimal) -->
<div class="kpi-row" id="kpi-row"></div>

<!-- Performance gauge (kept, small) -->
<div class="gauge-mini" id="gauge-mini"></div>
```

**Step 2: Render briefing text**

New function `renderBriefing(data)` in `app.js`:
- Reads `data.overview.briefing`
- Renders the `briefingText` as the main headline
- Renders ordering suppliers with cutoff times
- Renders upcoming holidays as alert cards
- Renders seasonal signals

**Step 3: Render prediction**

New function `renderPrediction(data)`:
- Shows predicted revenue for next week with confidence badge
- Lists drivers ("Why this prediction: ...")
- If mid-week: shows actual vs predicted progress bar

**Step 4: Weather-aware briefing (client-side enhancement)**

After fetching weather from Open-Meteo (already done), enhance the briefing text:
- If rain forecasted for Fri/Sat: append weather alert
- Compare with historical rainy-week revenue if available

**Step 5: Style the briefing**

The briefing text should be prominent, readable, in the shop operator's language. Large type for the main message. Smaller cards for supporting data.

**Step 6: Run and verify**

Open browser. Tab 1 should show the daily briefing with ordering info, prediction, and KPIs.

**Step 7: Commit**

```
git commit -am "feat: Tab 1 — daily operational briefing with prediction"
```

---

## Phase E: Tab 2 — Produits

### Task 10: Product table with search, filter, ABCD badges

**Files:**
- Modify: `demo/app.js` (add `renderProduits`)
- Modify: `demo/index.html` (Tab 2 section)
- Modify: `demo/styles.css` (table styles)

**Step 1: Build the product table renderer**

New function `renderProduits(data)` in `app.js`:

```javascript
function renderProduits(data) {
  const container = $('tab-produits');
  // Summary bar
  const summary = buildRankingSummary(data.products);
  // Filter controls: rank checkboxes, category dropdown, supplier dropdown, search input
  // Product table: sortable columns
  // Each row: rank badge (colored), name, category, supplier, revenue, growth %, trend
}
```

**Step 2: Add filter + search functionality**

Client-side filtering:
- Text search filters by product name (case-insensitive substring)
- Rank filter: checkboxes for A, B, C, D (all checked by default)
- Category dropdown: all categories
- Supplier dropdown: all suppliers
- Sort by clicking column headers

Keep state in a simple object, re-render the table body on filter change.

**Step 3: ABCD badge styling**

```css
.rank-badge { display: inline-block; width: 24px; height: 24px; border-radius: 4px; text-align: center; font-weight: 600; font-size: 12px; line-height: 24px; }
.rank-A { background: var(--zone-bleu); color: white; }
.rank-B { background: var(--zone-vert); color: white; }
.rank-C { background: var(--zone-orange); color: white; }
.rank-D { background: var(--zone-rouge); color: white; }
```

**Step 4: Summary bar at top**

"120 produits A — 52% du CA | 380 produits B — 28% du CA | 900 produits C — 15% | 1600 produits D — 5%"

**Step 5: Run and verify**

Open Tab 2. Should see full product table. Test: search for "pomme", filter by rank A, sort by revenue descending.

**Step 6: Commit**

```
git commit -am "feat: Tab 2 — product table with ABCD ranking, search, filters"
```

---

### Task 11: Product sparklines + ordering suggestions

**Files:**
- Modify: `demo/app.js` (add sparkline renderer, ordering suggestion)
- Modify: `demo/styles.css`

**Step 1: Inline SVG sparkline**

For each product row, render a tiny 36-point SVG sparkline from `monthlyHistory`:

```javascript
function sparkline(history, width = 100, height = 24) {
  if (!history || history.length === 0) return '';
  const vals = history.map(h => h.revenue);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const range = max - min || 1;
  const points = vals.map((v, i) =>
    `${(i / (vals.length - 1)) * width},${height - ((v - min) / range) * height}`
  ).join(' ');
  return `<svg class="sparkline" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="1.5"/>
  </svg>`;
}
```

Add as a column in the product table.

**Step 2: Ordering suggestion**

For products with rank A or B, compute a suggested order quantity:
- Find same-period-last-year weekly sales for this product
- Apply trend factor (growth %)
- Display: "~45 unités / semaine" or "—" for C/D products

This computation happens in `build-demo.mjs` and is stored in `product.suggestedOrder`.

**Step 3: Run and verify**

Tab 2 should now show sparklines and ordering suggestions for top products.

**Step 4: Commit**

```
git commit -am "feat: Tab 2 — sparklines and ordering suggestions"
```

---

### Task 12: Product groups config + aggregation

**Files:**
- Create: `sample-data/config/product-groups.json`
- Modify: `scripts/build-demo.mjs` (aggregate groups)
- Modify: `demo/app.js` (group view in Tab 2)

**Step 1: Create product-groups.json**

Initial groups — operator will expand this over time:

```json
{
  "_doc": "Product group definitions. Key = group name, value = array of product name patterns (case-insensitive substring match).",
  "Pommes": ["pomme", "apple"],
  "Tomates": ["tomate"],
  "Fromages frais": ["mozzarella", "burrata", "ricotta"],
  "Pâtes": ["spaghetti", "penne", "fusilli", "tagliatelle", "linguine"]
}
```

**Step 2: Aggregate in build-demo.mjs**

Add `buildProductGroups(products, monthlyStats)`:
- For each group, find matching products by name pattern
- Aggregate: total revenue, combined seasonality, ABCD rank (by group total)
- Add `productGroups` to the payload

**Step 3: Render group view in Tab 2**

Add a toggle at the top of Tab 2: "Produits | Groupes". When "Groupes" is active, show group-level rows. Click to expand → individual products within the group.

**Step 4: Run and verify**

Tab 2 "Groupes" view should show aggregated groups. Expand "Pommes" to see individual varieties.

**Step 5: Commit**

```
git commit -am "feat: product groups — config, aggregation, expandable view"
```

---

## Phase F: Tab 3 — Catégories

### Task 13: Shelf allocation config + category tree

**Files:**
- Create: `sample-data/config/shelf-allocation.json`
- Create: `sample-data/config/category-tree.json`
- Modify: `scripts/build-demo.mjs` (merge shelf data into categories)

**Step 1: Create shelf-allocation.json**

Initial estimate — operator refines by walking the shop:

```json
{
  "_doc": "Shelf-meters per category. Operator maintains this by physical count.",
  "Fruits & Légumes": 8,
  "Fromages": 3,
  "Charcuterie": 2,
  "Épicerie": 6,
  "Épicerie Sucrée": 4,
  "Pâtes Fraîches": 1,
  "Boissons": 4,
  "Frais": 3,
  "Surgelés": 2,
  "Hygiène": 2,
  "Entretien": 1,
  "Cosmétique": 1,
  "Boulangerie": 2,
  "Oeufs": 0.5,
  "Légumineuses": 1
}
```

**Step 2: Create category-tree.json**

```json
{
  "_doc": "Actionable category hierarchy. Operator defines groupings that match shop layout.",
  "Frais": ["Fromages", "Charcuterie", "Frais", "Pâtes Fraîches", "Oeufs"],
  "Épicerie": ["Épicerie", "Épicerie Sucrée", "Légumineuses", "Conserves"],
  "Fruits & Légumes": ["Fruits & Légumes"],
  "Boissons": ["Boissons"],
  "Boulangerie": ["Boulangerie"],
  "Surgelés": ["Surgelés"],
  "Soin & Maison": ["Hygiène", "Entretien", "Cosmétique"]
}
```

**Step 3: Merge into build-demo.mjs**

Read both configs. For each category in `categoryMix`, add:
- `shelfCount` from shelf-allocation.json
- `revenuePerShelf` = revenue / shelfCount
- `treeParent` from category-tree.json

Add `categoryTree` to the payload.

**Step 4: Run and verify**

```
npm run build:demo
```

Check `demo.json` categories have `shelfCount` and `revenuePerShelf`.

**Step 5: Commit**

```
git commit -am "feat: shelf allocation + category tree configs, merged into demo.json"
```

---

### Task 14: Render Tab 3 — Catégories

**Files:**
- Modify: `demo/app.js` (add `renderCategories`)
- Modify: `demo/index.html` (Tab 3 content)
- Modify: `demo/styles.css`

**Step 1: Category bars with revenue per shelf**

Render horizontal bars sorted by revenue. Each bar shows:
- Category name
- Revenue (absolute + share %)
- YoY growth arrow
- Shelf count
- **Revenue per shelf** (the key metric, highlighted)
- ABCD distribution within category (small pills)

**Step 2: Tree view**

Group categories by their tree parent. Collapsible sections:
- "Frais (38% du CA, 9.5 étagères, 12,400€/étagère)"
  - Fromages: 28,000€, 3 étagères, 9,333€/ét.
  - Charcuterie: 14,000€, 2 étagères, 7,000€/ét.
  - ...

**Step 3: Kill/expand signals**

Color-code revenue-per-shelf:
- Green: above average (good space efficiency)
- Orange: below average
- Red: significantly below average AND declining YoY

Add a "bottom line" row: "Pâtes: 4 étagères pour 3,000€/ét. vs moyenne 8,500€/ét. — en baisse -12% YoY"

**Step 4: Run and verify**

Tab 3 shows categories with shelf efficiency. Tree view collapses/expands.

**Step 5: Commit**

```
git commit -am "feat: Tab 3 — category space efficiency with tree view"
```

---

## Phase G: Placeholder Tabs

### Task 15: Tabs 4-8 placeholder content

**Files:**
- Modify: `demo/app.js`
- Modify: `demo/index.html`

**Step 1: Fournisseurs (Tab 4)**

Move the existing supplier ranking rendering (from current Tab 1) into Tab 4. Keep current design — it already works. Add: supplier ordering days from context.json.

**Step 2: Tendances (Tab 5)**

Placeholder with the monthly revenue timeline data displayed as a simple HTML table. Note: "Chart visualization coming soon." The data is already in `demo.json.macro.timeline`.

**Step 3: Pipeline (Tab 6)**

Render the `meta.pipeline` nodes and edges as a simple HTML flow diagram using CSS flexbox. Each node is a card showing the layer name and file count. Arrows between them.

Click a node → show sample data (first 3 entries from the corresponding Gold/Silver file). This requires loading the data from demo.json's `meta.pipeline` section.

**Step 4: Données (Tab 7)**

Three sections: Catégories, Produits, Fournisseurs. Each shows the current mapping from `audit` section of demo.json. Simple table: raw name → clean name.

**Step 5: À réfléchir (Tab 8)**

Static content:

```html
<div class="placeholder-content">
  <h2>Idées pour les prochaines versions</h2>
  <ul>
    <li>Corrélation météo ↔ chiffre d'affaires</li>
    <li>Calendrier de commande interactif</li>
    <li>Alertes DLC automatiques</li>
    <li>Intégration Notion pour tâches quotidiennes</li>
    <li>Export PDF du briefing hebdomadaire</li>
    <li>Mode mobile pour consultation en rayon</li>
  </ul>
</div>
```

**Step 6: Commit**

```
git commit -am "feat: placeholder content for tabs 4-8"
```

---

## Phase H: Polish & Verify

### Task 16: End-to-end verification

**Step 1: Full pipeline rebuild**

```
npm run build:full
```

Verify no errors.

**Step 2: Browser walkthrough**

Open `demo/index.html`. Click through all 8 tabs. Check:
- [ ] Tab 1: Briefing renders with real text, prediction shows, KPIs work
- [ ] Tab 2: All products visible, search works, ABCD filters work, sparklines render
- [ ] Tab 3: Categories with shelf data, tree view collapses, revenue/shelf highlighted
- [ ] Tab 4: Supplier cards with ordering days
- [ ] Tab 5: Timeline data visible
- [ ] Tab 6: Pipeline diagram clickable
- [ ] Tab 7: Data audit tables populated
- [ ] Tab 8: Ideas list static

**Step 3: Commit final state**

```
git commit -am "chore: dashboard V2 end-to-end verification pass"
```

---

## Sequencing Summary

| Phase | Tasks | Estimated Time | Dependencies |
|-------|-------|---------------|--------------|
| A: Data Trust | 1-4 | 2-3 hours (incl. human review) | None |
| B: Expanded JSON | 5-7 | 1-2 hours | Phase A |
| C: Tab Framework | 8 | 30-45 min | None (can parallel with A) |
| D: Tab 1 Briefing | 9 | 1-1.5 hours | Phases B, C |
| E: Tab 2 Produits | 10-12 | 2-3 hours | Phases B, C |
| F: Tab 3 Catégories | 13-14 | 1-2 hours | Phases B, C |
| G: Placeholders | 15 | 45 min | Phase C |
| H: Verify | 16 | 30 min | All |

**Total: ~10-14 hours of work across 2-3 days.**

**Critical path:** Phase A (data trust) → Phase B (expanded JSON) → Phases D/E/F (tabs).

Phase C (tab framework) can start in parallel with Phase A.

**Day 3 realistic target:** Phases A + B + C = trusted data, expanded JSON, tab framework working. Possibly Tab 1 if time allows.

**Day 4 target:** Tabs 1-3 fully functional.

**Day 5 target:** Placeholder tabs, polish, verification.
