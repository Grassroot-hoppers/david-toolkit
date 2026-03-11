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

// ============================================================
// Helpers
// ============================================================

function formatDate(d) {
  return d.toLocaleDateString("fr-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function getWeekNumber(d) {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
}

function formatEuro(n) {
  return new Intl.NumberFormat("fr-BE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(n);
}

const DAY_NAMES_FR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

// ============================================================
// Tab 1 — Briefing du jour
// ============================================================

function renderBriefing(data) {
  const section = document.getElementById("tab-briefing");
  const now = new Date();
  const dayName = DAY_NAMES_FR[now.getDay()];
  const weekNum = getWeekNumber(now);
  const wm = data.weeklyMetrics;

  const yoy = wm ? wm.weekYoY : null;
  const zone = yoy == null ? "neutre" : yoy > 0.10 ? "verte" : yoy < -0.10 ? "rouge" : "bleue";
  const zoneColor = { verte: "#22C55E", bleue: "#3B82F6", rouge: "#EF4444", neutre: "#6B7280" }[zone];

  const yearlyGrowth = data.macro?.years && data.macro.years.length >= 2
    ? (data.macro.years[data.macro.years.length - 1].revenue / data.macro.years[data.macro.years.length - 2].revenue) - 1
    : 0;
  const predictedRevenue = wm?.sameWeekLastYear
    ? Math.round(wm.sameWeekLastYear * (1 + yearlyGrowth))
    : null;

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
  if (!data.suppliers) return [];
  return data.suppliers
    .filter(s => s.orderingDays && s.orderingDays.includes(dayName))
    .map(s => s.name || s.supplier);
}

// ============================================================
// Tab 1 — Weather
// ============================================================

async function fetchWeather(location) {
  try {
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
  } catch {
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

// ============================================================
// Tab 2 — Produits
// ============================================================

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
      <div id="products-list" class="products-list"></div>
    </div>
  `;

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

function updateProductList(products, groups, rankFilter, searchQuery, categoryFilter) {
  const list = document.getElementById("products-list");

  const filtered = products.filter(p => {
    if (rankFilter !== "all" && p.rank !== rankFilter) return false;
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (searchQuery && !(p.name || "").toLowerCase().includes(searchQuery)) return false;
    return true;
  });

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

  html += `<div class="product-rows">`;
  for (const p of filtered.slice(0, 200)) {
    html += renderProductRow(p);
  }
  if (filtered.length > 200) {
    html += `<div class="more-products">+ ${filtered.length - 200} produits supplémentaires (affinez le filtre)</div>`;
  }
  html += `</div>`;

  list.innerHTML = html;

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

function renderSparkline(history) {
  if (!history || history.length === 0) return `<svg width="80" height="24"></svg>`;
  const W = 80, H = 24, pad = 2;
  const max = Math.max(...history, 1);
  const points = history.map((v, i) => {
    const x = pad + (i / (history.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v / max) * (H - pad * 2));
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const trend = history[history.length - 1] > history[0];
  const color = trend ? "#10B981" : "#EF4444";
  return `<svg width="${W}" height="${H}" class="sparkline"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function renderSeasonBar(seasonality) {
  if (!seasonality || seasonality.length !== 12) return "";
  const max = Math.max(...seasonality, 1);
  const bars = seasonality.map((v, i) => {
    const h = Math.round((v / max) * 20);
    return `<rect x="${i * 6}" y="${20 - h}" width="4" height="${h}" fill="#3B82F6" opacity="0.7"/>`;
  }).join("");
  return `<svg width="72" height="20" class="season-bar">${bars}</svg>`;
}

// ============================================================
// Tabs 3–7 — Stub sections
// ============================================================

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
