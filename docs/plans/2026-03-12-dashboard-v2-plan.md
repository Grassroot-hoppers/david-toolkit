# Dashboard V2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the V2 dashboard in `public/` — Tab 1 (Briefing du jour) and Tab 2 (Produits with sparklines, ABCD, ordering suggestions) as heroes, Tabs 3–7 as polished stubs.

**Architecture:** Fresh build in `public/` (3 files: index.html, styles.css, app.js). `build-demo.mjs` is extended to emit an expanded demo.json (top 150 products + monthly history + product groups + hourly heatmap). The alpha in `demo/` is untouched.

**Tech Stack:** Vanilla HTML/CSS/JS. No chart library — sparklines are inline SVG `<polyline>`. No backend. Single fetch of `data/demo.json` at page load.

---

## Phase 1 — Config files

### Task 1.1 — Create `product-groups.json`

**Files:**
- Create: `sample-data/config/product-groups.json`

**Step 1: Create the file**

Seed ~10 groups using product name keywords. Groups are keyed by `key`, have a `displayName`, and `keywords` array (case-insensitive substring match against product name).

```json
{
  "_doc": "Product groups. keywords match product name substrings (case-insensitive). members are resolved at build time.",
  "pommes": {
    "displayName": "Pommes",
    "keywords": ["pomme jonagold", "pomme granny", "pomme pink", "pomme golden", "pomme boskoop", "pomme elstar", "pomme jazz"]
  },
  "tomates": {
    "displayName": "Tomates",
    "keywords": ["tomate", "cherry tom", "tomates"]
  },
  "fromages": {
    "displayName": "Fromages (top)",
    "keywords": ["raclette", "cheddar", "emmental", "gruyère", "gruyere", "comté", "comte", "brie", "camembert", "mozzarella", "parmesan", "gouda"]
  },
  "oeufs": {
    "displayName": "Oeufs",
    "keywords": ["oeuf", "oeufs"]
  },
  "pates": {
    "displayName": "Pâtes",
    "keywords": ["penne", "spaghetti", "tagliatelle", "fusilli", "rigatoni", "farfalle", "linguine", "pâtes", "pasta"]
  },
  "huiles": {
    "displayName": "Huiles",
    "keywords": ["huile d'olive", "huile olive", "huile de tournesol", "huile tournesol", "huile de noix", "huile noix"]
  },
  "confitures": {
    "displayName": "Confitures & miels",
    "keywords": ["confiture", "miel", "gelée de"]
  },
  "chocolats": {
    "displayName": "Chocolats",
    "keywords": ["chocolat", "praline", "pralinés"]
  },
  "biscuits": {
    "displayName": "Biscuits & gâteaux",
    "keywords": ["biscuit", "gâteau", "gateau", "cookie", "sablé", "speculoos", "stroopwafel"]
  },
  "vins": {
    "displayName": "Vins",
    "keywords": ["vin blanc", "vin rouge", "vin rosé", "vin rose", "champagne", "crémant", "cava"]
  }
}
```

**Step 2: Verify it exists**

```powershell
ls sample-data/config/
```
Expected: `product-groups.json` appears in the list.

**Step 3: Commit**

```powershell
git add sample-data/config/product-groups.json
git commit -m "config: seed product-groups.json with 10 keyword-matched groups"
```

---

### Task 1.2 — Add `orderingDays` to supplier-map entries

**Files:**
- Modify: `sample-data/config/supplier-map.json`

The current format is `"INTERBIO": {"name": "Interbio"}`. Extend to `{"name": "Interbio", "orderingDays": ["lundi"]}`.

**Step 1: Read the current file**

```powershell
node -e "const s = require('./sample-data/config/supplier-map.json'); const names = [...new Set(Object.values(s).filter(v => typeof v === 'object' && v.name).map(v => v.name))].sort(); names.forEach(n => console.log(n))"
```

This prints all normalized supplier names. Use the output to decide which suppliers get ordering days.

**Step 2: Add orderingDays for known suppliers**

Edit `sample-data/config/supplier-map.json`. For each supplier that has `"name": "X"`, add `"orderingDays": [...]`. If ordering days are unknown, leave as `[]` (empty = no reminder triggered).

Common known suppliers and typical ordering days (confirm with David):
- Biofresh → `["lundi", "jeudi"]`
- Vajra → `["lundi"]`
- Interbio → `["mardi"]`
- Ankorstore suppliers → `["mercredi"]`
- Unknown suppliers → `[]`

Only add orderingDays to the **canonical** entries (unique normalized names), not to every alias. The build script will read whichever entry matches first.

**Step 3: Verify**

```powershell
node -e "const s = require('./sample-data/config/supplier-map.json'); const withDays = Object.values(s).filter(v => typeof v === 'object' && v.orderingDays && v.orderingDays.length > 0); console.log(withDays.length, 'suppliers with ordering days')"
```

Expected: at least 3 suppliers with ordering days.

**Step 4: Commit**

```powershell
git add sample-data/config/supplier-map.json
git commit -m "config: add orderingDays to supplier-map for Tab 1 briefing reminders"
```

---

## Phase 2 — Expand build-demo.mjs

### Task 2.1 — Add ABCD ranking + products[] to demo.json

**Files:**
- Modify: `scripts/build-demo.mjs`

**Context:** `build-demo.mjs` already has a `products` array from `buildFromGold()`. It currently only emits `topProducts` (top 8) and `slowProducts` (bottom 6) in the payload. We need to:
1. Add ABCD Pareto ranking to each product
2. Add `monthlyHistory` (36 months from `monthly-product-stats.json`)
3. Add `suggestedOrder` (A+B only)
4. Emit full `products[]` (top 150 by 2025 revenue) in the payload

**Step 1: Read the existing `products` variable in `buildFromGold()`**

The `products` array is built around line 400–550 of `build-demo.mjs`. Read those lines to understand the existing shape before adding.

```powershell
node -e "const d = require('./demo/data/demo.json'); const t = d.topProducts[0]; console.log(JSON.stringify(Object.keys(t)))"
```

Expected: shows existing product fields (name, supplier, action, totalRevenue, etc.)

**Step 2: Add ABCD ranking function**

Add this function to `build-demo.mjs` (before `buildFromGold`):

```js
function computeAbcd(products) {
  // Sort by 2025 revenue descending
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
```

Call it in `buildFromGold()` after `products` is fully built:
```js
computeAbcd(products);
```

**Step 3: Load monthly-product-stats and attach monthlyHistory**

Inside `buildFromGold()`, after loading Gold data, add:

```js
// Load monthly stats for sparklines (top 150 products only)
const monthlyStatsPath = path.join(root, "data", "gold", "monthly-product-stats.json");
let monthlyStatsByName = new Map();
if (fs.existsSync(monthlyStatsPath)) {
  const monthlyStats = JSON.parse(fs.readFileSync(monthlyStatsPath, "utf8"));
  // Build a lookup: productName → Map<YYYY-MM, revenue>
  for (const entry of monthlyStats) {
    if (!monthlyStatsByName.has(entry.name)) {
      monthlyStatsByName.set(entry.name, new Map());
    }
    monthlyStatsByName.get(entry.name).set(entry.month, entry.revenue);
  }
}
```

Check the shape of `monthly-product-stats.json` first:
```powershell
node -e "const m = require('./data/gold/monthly-product-stats.json'); console.log(JSON.stringify(m[0], null, 2))"
```

Use the actual field names from that output.

**Step 4: Build 36-month series per product**

After computing ABCD and loading monthlyStats, generate `monthlyHistory`:

```js
// Generate months Jan 2023 → Dec 2025
const HISTORY_MONTHS = [];
for (let y = 2023; y <= 2025; y++) {
  for (let m = 1; m <= 12; m++) {
    HISTORY_MONTHS.push(`${y}-${String(m).padStart(2, "0")}`);
  }
}

// Add monthlyHistory to each product
for (const p of products) {
  const lookup = monthlyStatsByName.get(p.name);
  p.monthlyHistory = HISTORY_MONTHS.map(month => lookup ? (lookup.get(month) || 0) : 0);
}
```

**Step 5: Add suggestedOrder for A+B products**

```js
// Compute week of year from runDate
function getWeekOfYear(dateStr) {
  const d = new Date(dateStr);
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
}

const runWeek = getWeekOfYear(context.runDate);
const runMonth = new Date(context.runDate).getMonth(); // 0-indexed

for (const p of products) {
  if (p.rank !== "A" && p.rank !== "B") {
    p.suggestedOrder = null;
    continue;
  }
  // Average revenue for same month in 2024 + 2025, divide by 4 for weekly estimate
  const monthKey2024 = `2024-${String(runMonth + 1).padStart(2, "0")}`;
  const monthKey2025 = `2025-${String(runMonth + 1).padStart(2, "0")}`;
  const lookup = monthlyStatsByName.get(p.name);
  const rev2024 = lookup ? (lookup.get(monthKey2024) || 0) : 0;
  const rev2025 = lookup ? (lookup.get(monthKey2025) || 0) : 0;
  const avgMonthly = (rev2024 + rev2025) / (rev2024 > 0 && rev2025 > 0 ? 2 : 1);
  const weeklyEst = avgMonthly / 4;
  
  // Trend factor from YoY
  const trend = p.yoy != null ? 1 + p.yoy : 1;
  const suggested = Math.round(weeklyEst * trend / (p.totalRevenue / (p.unitsSold || 1) || 1));
  
  p.suggestedOrder = suggested > 0 ? {
    qty: suggested,
    basis: `Mois ${runMonth + 1}, moy. 2024–2025${p.yoy != null ? `, tendance ${p.yoy > 0 ? "+" : ""}${Math.round(p.yoy * 100)}%` : ""}`
  } : null;
}
```

**NOTE:** The suggested quantity requires a unit price or units-sold figure. If `products` don't have `unitsSold`, use revenue estimate directly: display as `~${Math.round(weeklyEst * trend)}€ de stock` instead of units. Check what fields exist on the products object first.

**Step 6: Add full products[] to the payload**

In the `payload` object (around line 651), add:

```js
products: products
  .filter(p => p.totalRevenue > 0)
  .sort((a, b) => b.totalRevenue - a.totalRevenue)
  .slice(0, 150)
  .map(p => ({
    name: p.name || p.displayName,
    category: p.category,
    supplier: p.supplier,
    rank: p.rank,
    revenue2025: p.totalRevenue,
    revenue2024: p.prevRevenue || 0,
    growth: p.yoy,
    growthLabel: p.action,  // "hausse" | "stable" | "baisse"
    monthlyHistory: p.monthlyHistory,
    suggestedOrder: p.suggestedOrder,
  })),
```

**Step 7: Verify output**

```powershell
node scripts/build-demo.mjs
node -e "const d = require('./demo/data/demo.json'); console.log('products count:', d.products.length); const p = d.products[0]; console.log('first product:', JSON.stringify({name: p.name, rank: p.rank, histLen: p.monthlyHistory.length, order: p.suggestedOrder}))"
```

Expected: `products count: 150`, first product has `rank: "A"`, `histLen: 36`, `suggestedOrder` is not null.

**Step 8: Commit**

```powershell
git add scripts/build-demo.mjs
git commit -m "feat: add ABCD ranking, monthlyHistory, suggestedOrder to demo.json products[]"
```

---

### Task 2.2 — Add productGroups[] to demo.json

**Files:**
- Modify: `scripts/build-demo.mjs`

**Step 1: Load product-groups config and resolve members**

Add to `buildFromGold()` after ABCD computation:

```js
// Resolve product groups
const groupsConfig = JSON.parse(fs.readFileSync(
  path.join(configDir, "product-groups.json"), "utf8"
));

const productGroups = [];
for (const [key, cfg] of Object.entries(groupsConfig)) {
  if (key === "_doc") continue;
  const keywords = cfg.keywords || [];
  const members = products.filter(p => {
    const nameLower = (p.name || p.displayName || "").toLowerCase();
    return keywords.some(kw => nameLower.includes(kw.toLowerCase()));
  });
  if (members.length === 0) continue;
  
  const aggregateRevenue2025 = members.reduce((s, p) => s + p.totalRevenue, 0);
  const aggregateRevenue2024 = members.reduce((s, p) => s + (p.prevRevenue || 0), 0);
  
  // Compute 12-month seasonality (2025 only)
  const seasonality = Array(12).fill(0);
  for (const p of members) {
    if (!p.monthlyHistory) continue;
    // monthlyHistory is Jan2023...Dec2025, so indices 24-35 = 2025
    for (let m = 0; m < 12; m++) {
      seasonality[m] += p.monthlyHistory[24 + m] || 0;
    }
  }
  
  // Group rank = rank of its highest-earning member
  const topMember = members.sort((a, b) => b.totalRevenue - a.totalRevenue)[0];
  
  productGroups.push({
    key,
    displayName: cfg.displayName,
    members: members.map(p => p.name || p.displayName),
    aggregateRevenue2025,
    aggregateRevenue2024,
    yoy: aggregateRevenue2024 > 0 ? (aggregateRevenue2025 - aggregateRevenue2024) / aggregateRevenue2024 : null,
    seasonality,
    rank: topMember.rank || "C",
  });
}
productGroups.sort((a, b) => b.aggregateRevenue2025 - a.aggregateRevenue2025);
```

**Step 2: Add to payload**

In the payload object, add:
```js
productGroups,
```

**Step 3: Verify**

```powershell
node scripts/build-demo.mjs
node -e "const d = require('./demo/data/demo.json'); console.log('groups:', d.productGroups.length); d.productGroups.forEach(g => console.log(g.key, g.members.length, 'members, rev:', Math.round(g.aggregateRevenue2025)))"
```

Expected: at least 5 groups, each with 1+ members and non-zero revenue.

**Step 4: Commit**

```powershell
git add scripts/build-demo.mjs
git commit -m "feat: add productGroups[] to demo.json from product-groups.json config"
```

---

### Task 2.3 — Add trends.hourlyHeatmap + fix output path

**Files:**
- Modify: `scripts/build-demo.mjs`

**Step 1: Add hourlyHeatmap to demo.json**

In `buildFromGold()`, load the heatmap:

```js
const heatmapPath = path.join(goldDir, "hourly-heatmap.json");
let hourlyHeatmap = null;
if (fs.existsSync(heatmapPath)) {
  hourlyHeatmap = JSON.parse(fs.readFileSync(heatmapPath, "utf8"));
}
```

In the payload, update `macro` to include it in a `trends` key:

```js
trends: {
  hourlyHeatmap,
},
```

**Step 2: Write to both output paths**

Currently `outputPath` is `demo/data/demo.json`. Add a second write to `public/data/demo.json`:

Find the line:
```js
const outputPath = path.join(root, "demo", "data", "demo.json");
```

Change to:
```js
const outputPaths = [
  path.join(root, "demo", "data", "demo.json"),
  path.join(root, "public", "data", "demo.json"),
];
```

Find `fs.writeFileSync(outputPath, ...)` and replace with:
```js
for (const p of outputPaths) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(payload, null, 2));
  console.log(`  Wrote ${p}`);
}
```

**Step 3: Verify both files exist after build**

```powershell
node scripts/build-demo.mjs
ls demo/data/; ls public/data/
```

Expected: `demo.json` appears in both.

**Step 4: Commit**

```powershell
git add scripts/build-demo.mjs
git commit -m "feat: add trends.hourlyHeatmap to demo.json and write to public/data/ as well"
```

---

## Phase 3 — Tab framework

### Task 3.1 — Create `public/index.html` shell with 8 tabs

**Files:**
- Create: `public/index.html`

**Step 1: Create the HTML**

Structure: top bar (store name + weather strip) → tab nav bar → tab content area.

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=1440, initial-scale=1">
  <title>David — Tableau de Pilotage</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="app">

    <!-- TOP BAR -->
    <header class="top-bar">
      <div class="top-bar-left">
        <span class="store-name">David</span>
        <span class="store-subtitle">Tableau de pilotage</span>
      </div>
      <div class="top-bar-right">
        <div id="weather-widget" class="weather-widget">
          <span class="weather-loading">chargement météo…</span>
        </div>
        <div id="run-date" class="run-date"></div>
      </div>
    </header>

    <!-- TAB NAV -->
    <nav class="tab-nav">
      <button class="tab-btn active" data-tab="briefing">Briefing</button>
      <button class="tab-btn" data-tab="produits">Produits</button>
      <button class="tab-btn tab-btn--stub" data-tab="categories">Catégories</button>
      <button class="tab-btn tab-btn--stub" data-tab="fournisseurs">Fournisseurs</button>
      <button class="tab-btn tab-btn--stub" data-tab="tendances">Tendances</button>
      <button class="tab-btn tab-btn--stub" data-tab="pipeline">Pipeline</button>
      <button class="tab-btn tab-btn--stub" data-tab="donnees">Données</button>
    </nav>

    <!-- TAB CONTENT -->
    <main class="tab-content">
      <section id="tab-briefing" class="tab-section active"></section>
      <section id="tab-produits" class="tab-section"></section>
      <section id="tab-categories" class="tab-section stub-section"></section>
      <section id="tab-fournisseurs" class="tab-section stub-section"></section>
      <section id="tab-tendances" class="tab-section stub-section"></section>
      <section id="tab-pipeline" class="tab-section stub-section"></section>
      <section id="tab-donnees" class="tab-section stub-section"></section>
    </main>

  </div>
  <script src="app.js"></script>
</body>
</html>
```

**Step 2: Verify it opens in a browser**

```powershell
node scripts/serve.mjs
```

Open `http://localhost:3000` (or whatever port the serve script uses — check `scripts/serve.mjs` for the port). Expected: blank dark page with tab nav visible.

---

### Task 3.2 — Create `public/styles.css` — dark theme base

**Files:**
- Create: `public/styles.css`

**Step 1: Read the alpha styles for reference**

Read `demo/styles.css` lines 1–80 to grab the CSS variables and base reset. Copy the color variables and reset. The V2 uses a top tab bar instead of a sidebar — adapt the layout accordingly.

Key CSS variables to carry over from `demo/styles.css`:
- `--bg-base`, `--bg-surface`, `--bg-elevated`
- `--text-primary`, `--text-secondary`, `--text-muted`
- `--accent-blue`, `--accent-green`, `--accent-red`, `--accent-orange`
- `--border-subtle`

New layout variables for V2:
- Top bar: `height: 56px`, full width
- Tab nav: `height: 44px`, full width, tabs are buttons
- Tab content: fills remaining viewport height, scrollable

ABCD badge colors:
- A: `#F59E0B` (gold/amber)
- B: `#10B981` (green)
- C: `#F97316` (orange)
- D: `#EF4444` (red)

Sparkline SVG: `width: 80px; height: 24px;` inline, `overflow: visible`

**Step 2: Write full styles.css**

The file should cover:
- CSS reset + variables
- `.app` flex column layout
- `.top-bar` horizontal flex, 56px
- `.tab-nav` horizontal flex, 44px, scrollable on small screens
- `.tab-btn` — pill-style, active state
- `.tab-btn--stub` — slightly muted opacity (0.6) to signal "not yet built"
- `.tab-section` — hidden by default (`display: none`), `.active` shows it
- `.tab-section.stub-section` — centered placeholder content
- Product-specific: `.product-row`, `.rank-badge`, `.growth-arrow`, `.sparkline`, `.order-qty`
- Briefing-specific: `.briefing-grid`, `.perf-gauge`, `.prediction-card`, `.ordering-reminder`, `.weather-card`

**Step 3: Verify**

Reload `http://localhost:3000`. Expected: dark background, tab nav styled, tabs switch when clicked (tab switching is added in app.js next task).

---

### Task 3.3 — App bootstrap + tab switching in `public/app.js`

**Files:**
- Create: `public/app.js`

**Step 1: Write bootstrap + tab switching**

```js
// ============================================================
// Bootstrap
// ============================================================
let DATA = null;

document.addEventListener("DOMContentLoaded", async () => {
  DATA = await fetch("data/demo.json").then(r => r.json());
  initTabs();
  renderBriefing(DATA);
  renderProducts(DATA);
  renderStubs(DATA);
  fetchWeather(DATA.location);
  document.getElementById("run-date").textContent = formatDate(new Date());
});

// ============================================================
// Tab switching
// ============================================================
function initTabs() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-section").forEach(s => s.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${tab}`).classList.add("active");
    });
  });
}
```

**Step 2: Verify**

Reload browser. Click each tab button. Expected: only the matching section is visible, active tab is highlighted.

**Step 3: Commit (partial — app.js shell only)**

```powershell
git add public/index.html public/styles.css public/app.js
git commit -m "feat: public/ tab framework -- shell, styles, tab switching"
```

---

## Phase 4 — Tab 1: Briefing du jour

### Task 4.1 — Date context + performance gauge

**Files:**
- Modify: `public/app.js`

**Step 1: Add helper functions**

```js
function formatDate(d) {
  return d.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function getWeekNumber(d) {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
}

const DAY_NAMES_FR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
```

**Step 2: Add `renderBriefing(data)` function**

```js
function renderBriefing(data) {
  const section = document.getElementById("tab-briefing");
  const now = new Date();
  const dayName = DAY_NAMES_FR[now.getDay()];
  const weekNum = getWeekNumber(now);
  const wm = data.weeklyMetrics;

  // Performance gauge
  const yoy = wm ? wm.weekYoY : null;
  const zone = yoy == null ? "neutre" : yoy > 0.10 ? "verte" : yoy < -0.10 ? "rouge" : "bleue";
  const zoneColor = { verte: "#10B981", bleue: "#3B82F6", rouge: "#EF4444", neutre: "#6B7280" }[zone];

  // Week prediction: same week last year × YoY trend
  const yearlyGrowth = data.macro?.years && data.macro.years.length >= 2
    ? (data.macro.years[data.macro.years.length - 1].revenue / data.macro.years[data.macro.years.length - 2].revenue) - 1
    : 0;
  const predictedRevenue = wm?.sameWeekLastYear
    ? Math.round(wm.sameWeekLastYear * (1 + yearlyGrowth))
    : null;

  // Ordering reminders — read from supplier data if available
  const orderingReminders = getOrderingReminders(data, dayName);

  section.innerHTML = `
    <div class="briefing-grid">

      <div class="briefing-card briefing-card--date">
        <div class="briefing-date-main">${formatDate(now)}</div>
        <div class="briefing-date-sub">Semaine ${weekNum} · ${data.store || "Boutique"}</div>
      </div>

      <div class="briefing-card briefing-card--perf">
        <div class="card-label">PERFORMANCE CETTE SEMAINE</div>
        <div class="perf-numbers">
          <span class="perf-main" style="color: ${zoneColor}">
            ${wm ? formatEuro(wm.lastWeekRevenue) : "—"}
          </span>
          <span class="perf-vs">vs ${wm ? formatEuro(wm.sameWeekLastYear) : "—"} l'an passé</span>
        </div>
        <div class="perf-yoy" style="color: ${zoneColor}">
          ${yoy != null ? `${yoy > 0 ? "+" : ""}${Math.round(yoy * 100)}% · Zone ${zone}` : "Données insuffisantes"}
        </div>
        <div class="perf-mtd">
          MTD: ${wm ? formatEuro(wm.mtdRevenue) : "—"} 
          (${wm?.mtdYoY != null ? `${wm.mtdYoY > 0 ? "+" : ""}${Math.round(wm.mtdYoY * 100)}% vs N-1` : "—"})
        </div>
      </div>

      ${predictedRevenue ? `
      <div class="briefing-card briefing-card--prediction">
        <div class="card-label">PRÉVISION SEMAINE ${weekNum + 1}</div>
        <div class="prediction-value">${formatEuro(predictedRevenue)}</div>
        <div class="prediction-basis">
          Base: ${formatEuro(wm.sameWeekLastYear)} (sem. ${weekNum} 2025) 
          × tendance ${yearlyGrowth > 0 ? "+" : ""}${Math.round(yearlyGrowth * 100)}%
        </div>
      </div>` : ""}

      ${orderingReminders.length > 0 ? `
      <div class="briefing-card briefing-card--ordering">
        <div class="card-label">COMMANDES AUJOURD'HUI</div>
        <ul class="ordering-list">
          ${orderingReminders.map(s => `<li class="ordering-item">${s}</li>`).join("")}
        </ul>
      </div>` : `
      <div class="briefing-card briefing-card--ordering briefing-card--quiet">
        <div class="card-label">COMMANDES</div>
        <div class="ordering-quiet">Pas de commandes prévues aujourd'hui</div>
      </div>`}

    </div>
  `;
}

function getOrderingReminders(data, dayName) {
  // data.suppliers contains supplier info — match against ordering days if available
  if (!data.suppliers) return [];
  return data.suppliers
    .filter(s => s.orderingDays && s.orderingDays.includes(dayName))
    .map(s => s.name || s.supplier);
}

function formatEuro(n) {
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}
```

**Step 3: Verify**

Open browser Tab 1. Expected: date card, performance numbers with correct color (green/blue/red), prediction card, ordering section.

---

### Task 4.2 — Weather integration in Tab 1

**Files:**
- Modify: `public/app.js`

Copy the existing Open-Meteo fetch from `demo/app.js` (read that file to find the weather function). Adapt to populate `#weather-widget` in the top bar AND add a weather card to the briefing section.

**Step 1: Read `demo/app.js`**

```powershell
node -e "require('fs').readFileSync('demo/app.js', 'utf8').split('\n').forEach((l,i) => { if (l.toLowerCase().includes('meteo') || l.toLowerCase().includes('weather') || l.toLowerCase().includes('open-meteo')) console.log(i+1, l) })"
```

**Step 2: Port the weather fetch**

The location is available at `data.location` (a `{lat, lon}` or city name). If lat/lon exist, use Open-Meteo API directly. The alpha already fetches from `https://api.open-meteo.com/v1/forecast`.

```js
async function fetchWeather(location) {
  try {
    // Use Brussels coords if location is a string, or use data.location.lat/lon if available
    const lat = (location && location.lat) ? location.lat : 50.8503;
    const lon = (location && location.lon) ? location.lon : 4.3517;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Europe%2FBrussels&forecast_days=3`;
    const res = await fetch(url);
    const wx = await res.json();
    const temp = wx.current.temperature_2m;
    const code = wx.current.weathercode;
    const emoji = weatherEmoji(code);
    document.getElementById("weather-widget").innerHTML =
      `<span class="wx-emoji">${emoji}</span> <span class="wx-temp">${temp}°C</span> · Bruxelles`;
    
    // Add rain signal to briefing if applicable
    const rainToday = wx.daily?.precipitation_sum?.[0] > 2;
    if (rainToday) {
      const briefingSection = document.getElementById("tab-briefing");
      const rainCard = document.createElement("div");
      rainCard.className = "briefing-card briefing-card--weather";
      rainCard.innerHTML = `
        <div class="card-label">SIGNAL MÉTÉO</div>
        <div class="weather-signal">🌧 Pluie prévue aujourd'hui — historiquement +8% de passage en période pluvieuse</div>
      `;
      briefingSection.querySelector(".briefing-grid")?.appendChild(rainCard);
    }
  } catch (e) {
    document.getElementById("weather-widget").textContent = "météo indisponible";
  }
}

function weatherEmoji(code) {
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 67) return "🌧";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌦";
  return "⛈";
}
```

**Step 3: Verify**

Reload. Expected: weather widget in top bar shows temperature + emoji. If it's a rainy day, rain card appears in Tab 1.

**Step 4: Commit**

```powershell
git add public/app.js public/styles.css public/index.html
git commit -m "feat: Tab 1 briefing -- date context, performance gauge, week prediction, ordering reminder, weather"
```

---

## Phase 5 — Tab 2: Produits

### Task 5.1 — Products controls bar + ABCD filter

**Files:**
- Modify: `public/app.js`
- Modify: `public/index.html` (no change needed — Tab 2 section is empty, renderProducts fills it)

**Step 1: Write `renderProducts(data)`**

```js
function renderProducts(data) {
  const section = document.getElementById("tab-produits");
  const products = data.products || [];
  const groups = data.productGroups || [];

  section.innerHTML = `
    <div class="products-layout">
      <div class="products-controls">
        <input type="text" id="product-search" class="product-search" placeholder="Rechercher un produit…">
        <div class="rank-filters">
          <button class="rank-filter active" data-rank="all">Tout</button>
          <button class="rank-filter" data-rank="A">A</button>
          <button class="rank-filter" data-rank="B">B</button>
          <button class="rank-filter" data-rank="C">C</button>
          <button class="rank-filter" data-rank="D">D</button>
        </div>
        <select id="category-filter" class="category-filter">
          <option value="">Toutes les catégories</option>
          ${[...new Set(products.map(p => p.category).filter(Boolean))].sort()
              .map(c => `<option value="${c}">${c}</option>`).join("")}
        </select>
      </div>
      <div id="products-list" class="products-list">
        <!-- rendered by updateProductList -->
      </div>
    </div>
  `;

  // Wire up controls
  let activeRank = "all";
  let searchQuery = "";
  let categoryFilter = "";

  document.getElementById("product-search").addEventListener("input", e => {
    searchQuery = e.target.value.toLowerCase();
    updateProductList(products, groups, activeRank, searchQuery, categoryFilter);
  });

  document.getElementById("category-filter").addEventListener("change", e => {
    categoryFilter = e.target.value;
    updateProductList(products, groups, activeRank, searchQuery, categoryFilter);
  });

  document.querySelectorAll(".rank-filter").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".rank-filter").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeRank = btn.dataset.rank;
      updateProductList(products, groups, activeRank, searchQuery, categoryFilter);
    });
  });

  updateProductList(products, groups, "all", "", "");
}
```

**Step 2: Write `updateProductList`**

```js
function updateProductList(products, groups, rankFilter, searchQuery, categoryFilter) {
  const list = document.getElementById("products-list");

  // Filter products
  const filtered = products.filter(p => {
    if (rankFilter !== "all" && p.rank !== rankFilter) return false;
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (searchQuery && !(p.name || "").toLowerCase().includes(searchQuery)) return false;
    return true;
  });

  // If no search/filter, show groups first
  const showGroups = rankFilter === "all" && !searchQuery && !categoryFilter;
  let html = "";

  if (showGroups && groups.length > 0) {
    html += `<div class="groups-section">`;
    for (const g of groups) {
      const gYoy = g.yoy != null ? `${g.yoy > 0 ? "+" : ""}${Math.round(g.yoy * 100)}%` : "—";
      const gColor = g.yoy > 0.05 ? "#10B981" : g.yoy < -0.05 ? "#EF4444" : "#6B7280";
      html += `
        <div class="group-row" data-key="${g.key}">
          <span class="rank-badge rank-${g.rank}">${g.rank}</span>
          <span class="group-name">${g.displayName}</span>
          <span class="group-members">${g.members.length} produits</span>
          <span class="group-revenue">${formatEuro(g.aggregateRevenue2025)}</span>
          <span class="group-yoy" style="color: ${gColor}">${gYoy}</span>
          <span class="group-season">${renderSeasonBar(g.seasonality)}</span>
          <button class="group-expand-btn" aria-expanded="false">▶</button>
        </div>
        <div class="group-members-list" id="group-${g.key}" style="display:none"></div>
      `;
    }
    html += `</div><div class="products-divider">Tous les produits</div>`;
  }

  // Product rows
  html += `<div class="product-rows">`;
  for (const p of filtered.slice(0, 200)) {
    html += renderProductRow(p);
  }
  if (filtered.length > 200) {
    html += `<div class="more-products">+ ${filtered.length - 200} produits supplémentaires (affinez le filtre)</div>`;
  }
  html += `</div>`;

  list.innerHTML = html;

  // Wire group expand buttons
  list.querySelectorAll(".group-row").forEach(row => {
    const key = row.dataset.key;
    const btn = row.querySelector(".group-expand-btn");
    btn.addEventListener("click", () => {
      const membersDiv = document.getElementById(`group-${key}`);
      const expanded = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!expanded));
      btn.textContent = expanded ? "▶" : "▼";
      if (!expanded) {
        const g = groups.find(g => g.key === key);
        const memberProducts = products.filter(p => g.members.includes(p.name));
        membersDiv.innerHTML = memberProducts.map(renderProductRow).join("");
        membersDiv.style.display = "block";
      } else {
        membersDiv.style.display = "none";
      }
    });
  });
}
```

---

### Task 5.2 — Product row with sparkline + ordering suggestion

**Files:**
- Modify: `public/app.js`

**Step 1: Write `renderProductRow(p)`**

```js
function renderProductRow(p) {
  const growth = p.growth != null ? p.growth : null;
  const growthColor = growth > 0.05 ? "#10B981" : growth < -0.05 ? "#EF4444" : "#6B7280";
  const growthArrow = growth > 0.05 ? "↑" : growth < -0.05 ? "↓" : "→";
  const growthText = growth != null
    ? `<span style="color:${growthColor}">${growth > 0 ? "+" : ""}${Math.round(growth * 100)}% ${growthArrow}</span>`
    : `<span style="color:#6B7280">—</span>`;

  const orderHtml = (p.rank === "A" || p.rank === "B") && p.suggestedOrder
    ? `<span class="order-qty" title="${p.suggestedOrder.basis}">~${p.suggestedOrder.qty}€</span>`
    : `<span class="order-qty order-qty--empty"></span>`;

  return `
    <div class="product-row">
      <span class="rank-badge rank-${p.rank}">${p.rank}</span>
      <span class="product-name">${p.name}</span>
      <span class="product-category">${p.category || ""}</span>
      <span class="product-revenue">${formatEuro(p.revenue2025)}</span>
      <span class="product-growth">${growthText}</span>
      <span class="product-sparkline">${renderSparkline(p.monthlyHistory)}</span>
      ${orderHtml}
    </div>
  `;
}
```

**Step 2: Write `renderSparkline(history)`**

```js
function renderSparkline(history) {
  if (!history || history.length === 0) return `<svg width="80" height="24"></svg>`;
  const W = 80, H = 24, pad = 2;
  const max = Math.max(...history, 1);
  const points = history.map((v, i) => {
    const x = pad + (i / (history.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v / max) * (H - pad * 2));
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  // Color the line based on last vs first value (trend)
  const trend = history[history.length - 1] > history[0];
  const color = trend ? "#10B981" : "#EF4444";
  return `<svg width="${W}" height="${H}" class="sparkline"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
```

**Step 3: Write `renderSeasonBar(seasonality)` for group rows**

```js
function renderSeasonBar(seasonality) {
  if (!seasonality || seasonality.length !== 12) return "";
  const max = Math.max(...seasonality, 1);
  const bars = seasonality.map((v, i) => {
    const h = Math.round((v / max) * 20);
    return `<rect x="${i * 6}" y="${20 - h}" width="4" height="${h}" fill="#3B82F6" opacity="0.7"/>`;
  }).join("");
  return `<svg width="72" height="20" class="season-bar">${bars}</svg>`;
}
```

**Step 4: Verify**

Open Tab 2. Expected:
- Controls bar with search + rank filters + category dropdown
- Product groups accordion at top (click ▶ to expand)
- Product rows with rank badge, name, revenue, growth arrow, sparkline
- A/B rank products show `~Xeuro` ordering suggestion

**Step 5: Commit**

```powershell
git add public/app.js public/styles.css
git commit -m "feat: Tab 2 -- product list with ABCD badges, sparklines, groups accordion, search/filter, ordering suggestions"
```

---

## Phase 6 — Stub sections for Tabs 3–7

### Task 6.1 — Add stub content for all 5 remaining tabs

**Files:**
- Modify: `public/app.js`

**Step 1: Add `renderStubs(data)` function**

```js
function renderStubs(data) {
  const stubs = [
    {
      id: "categories",
      title: "Catégories",
      description: "Analyse revenu par rayon — chiffre d'affaires par mètre linéaire, signaux de suppression/expansion par catégorie, hiérarchie actionnable en remplacement des catégories brutes du POS.",
      preview: [
        { label: "Fromages", value: "14 000€/rayon" },
        { label: "Pâtes", value: "3 000€/rayon" },
      ]
    },
    {
      id: "fournisseurs",
      title: "Fournisseurs",
      description: "Vue par fournisseur — CA annuel, nombre de références, top 3 produits, jours de commande, lien Notion. Classement par contribution au CA.",
      preview: data.supplierRanking?.slice(0, 2).map(s => ({ label: s.supplier, value: formatEuro(s.revenue) })) || []
    },
    {
      id: "tendances",
      title: "Tendances",
      description: "Timeline mensuelle 2023–2026, heatmap horaire (jour × heure × CA), saisonnalité par catégorie. Confirme le pic du samedi 11h et les cycles saisonniers.",
      preview: [
        { label: "Pic hebdomadaire", value: "Samedi 11h" },
        { label: "Meilleur mois 2025", value: "Décembre" },
      ]
    },
    {
      id: "pipeline",
      title: "Pipeline de données",
      description: "Schéma interactif Bronze → Silver → Gold. Cliquer sur chaque nœud pour voir les fichiers source, les transformations appliquées, et un extrait des données en sortie.",
      preview: [
        { label: "Fichiers Bronze", value: "24 CSV" },
        { label: "Fichiers Gold", value: "7 JSON" },
      ]
    },
    {
      id: "donnees",
      title: "Données",
      description: "Audit de la qualité des données — mappings catégories, corrections noms produits, signaux d'anomalie. La surface d'audit pour valider ce que le pipeline a interprété.",
      preview: [
        { label: "Catégories mappées", value: data.categoryMix?.length || "—" },
        { label: "Produits traités", value: data.products?.length || "—" },
      ]
    }
  ];

  for (const stub of stubs) {
    const section = document.getElementById(`tab-${stub.id}`);
    section.innerHTML = `
      <div class="stub-content">
        <div class="stub-header">
          <h2 class="stub-title">${stub.title}</h2>
          <span class="stub-badge">Disponible dans la prochaine version</span>
        </div>
        <p class="stub-description">${stub.description}</p>
        <div class="stub-preview-cards">
          ${stub.preview.map(p => `
            <div class="stub-preview-card">
              <div class="stub-preview-label">${p.label}</div>
              <div class="stub-preview-value">${p.value}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }
}
```

**Step 2: Verify**

Click each of Tabs 3–7. Expected: each shows title, description paragraph, "Disponible dans la prochaine version" badge, and 2 greyed-out preview cards with real data where available.

**Step 3: Commit**

```powershell
git add public/app.js
git commit -m "feat: stub sections for tabs Catégories, Fournisseurs, Tendances, Pipeline, Données"
```

---

## Phase 7 — Polish + final smoke test

### Task 7.1 — Style pass on briefing grid

Review Tab 1 in the browser. Fix any layout issues:
- Cards should be in a responsive 2-column grid on wide screens, 1-column on narrow
- Performance numbers should be large and readable
- Zone color (green/blue/red) should be immediately obvious

### Task 7.2 — Style pass on products list

Review Tab 2 in the browser. Verify:
- Product rows are scannable at a glance (rank badge prominent, sparkline readable at 80px)
- Group accordion open/close is smooth
- Search filters product list live without reload
- On 1440px viewport: all columns visible without horizontal scroll
- Ordering suggestions tooltip shows on hover

### Task 7.3 — Final smoke test

```powershell
npm run build:full
node scripts/serve.mjs
```

Open `http://localhost:3000` (public/) and verify:
- [ ] Tab 1 shows correct date, real weekly performance numbers, prediction
- [ ] Tab 1 weather widget loads
- [ ] Tab 2 shows 150 products, rank badges visible, sparklines render
- [ ] Tab 2 search filters correctly
- [ ] Tab 2 product groups appear and expand
- [ ] Tab 2 A/B products show ordering suggestion
- [ ] Tabs 3–7 show stub content (not blank)
- [ ] No JavaScript console errors

### Task 7.4 — Final commit

```powershell
git add public/
git commit -m "feat: Dashboard V2 -- Tab 1 briefing + Tab 2 products + stubs for tabs 3-7"
```

---

## Time budget

| Phase | Tasks | Estimate |
|-------|-------|----------|
| 1 — Config | 1.1–1.2 | 30 min |
| 2 — demo.json | 2.1–2.3 | 90 min |
| 3 — Tab framework | 3.1–3.3 | 60 min |
| 4 — Tab 1 | 4.1–4.2 | 90 min |
| 5 — Tab 2 | 5.1–5.2 | 120 min |
| 6 — Stubs | 6.1 | 30 min |
| 7 — Polish | 7.1–7.4 | 60 min |
| **Total** | | **~8h** |

---

## Friday (2h) — If time permits

Priority order if Thursday finishes early or Friday has more time:
1. Add `monthly-stats-2026.json` to monthly history (extend HISTORY_MONTHS to include 2026 partial data)
2. Add margin % to product rows (from `marginRatio` field if available on products)
3. Improve sparkline: highlight current month with a dot
4. Add `trends.hourlyHeatmap` visualization in Tab 5 stub (even a static table is impressive)
