// ============================================================
// Bootstrap
// ============================================================

let DATA = null;

document.addEventListener("DOMContentLoaded", async () => {
  DATA = await fetch("data/demo.json").then(r => r.json());
  initTabs();
  renderBriefing(DATA);
  renderProducts(DATA);
  renderCategories(DATA);
  renderFournisseurs(DATA);
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

// ISO 8601 week number (week 1 = first Thursday, weeks start Monday)
function getWeekNumber(d) {
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = utc.getUTCDay() || 7; // Mon=1 … Sun=7
  utc.setUTCDate(utc.getUTCDate() + 4 - day); // shift to Thursday
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil(((utc - yearStart) / 86400000 + 1) / 7);
}

// ── Belgian public holidays (client-side) ─────────────────────────────────────

function easterDate(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month, day));
}

function belgianHolidays(year) {
  const easter = easterDate(year);
  const add = (dt, n) => { const r = new Date(dt); r.setUTCDate(r.getUTCDate() + n); return r; };
  const fmt = (dt) => dt.toISOString().slice(0, 10);
  return [
    { date: `${year}-01-01`, name: "Jour de l'An",                   region: "national" },
    { date: fmt(add(easter, 1)),  name: "Lundi de Pâques",            region: "national" },
    { date: `${year}-05-01`, name: "Fête du Travail",                 region: "national" },
    { date: fmt(add(easter, 39)), name: "Ascension",                  region: "national" },
    { date: fmt(add(easter, 50)), name: "Lundi de Pentecôte",         region: "national" },
    { date: `${year}-07-11`, name: "Fête Communauté flamande",        region: "flanders" },
    { date: `${year}-07-21`, name: "Fête nationale belge",            region: "national" },
    { date: `${year}-08-15`, name: "Assomption",                      region: "national" },
    { date: `${year}-09-27`, name: "Fête Communauté française",       region: "wallonia" },
    { date: `${year}-11-01`, name: "Toussaint",                       region: "national" },
    { date: `${year}-11-11`, name: "Armistice",                       region: "national" },
    { date: `${year}-12-25`, name: "Noël",                            region: "national" },
  ];
}

function holidaysInRange(startStr, endStr) {
  const sy = parseInt(startStr.slice(0, 4), 10);
  const ey = parseInt(endStr.slice(0, 4), 10);
  const result = [];
  for (let y = sy; y <= ey; y++) {
    for (const h of belgianHolidays(y)) {
      if (h.date >= startStr && h.date <= endStr) result.push(h);
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Prediction engine ─────────────────────────────────────────────────────────

function computePrediction(wm, yearlyGrowth, weatherDaily = null) {
  const base = wm?.nextWeekSameWeekLastYear;
  if (!base) return null;

  // Local weekly trend: how did last week this year compare to last year's same week?
  const localFactor = wm.sameWeekLastYear > 0
    ? wm.lastWeekRevenue / wm.sameWeekLastYear
    : 1 + yearlyGrowth;

  // Blended trend: 60% local (more responsive), 40% full-year trend
  const annualFactor  = 1 + yearlyGrowth;
  const blendedFactor = 0.6 * localFactor + 0.4 * annualFactor;

  // Holiday factor: Belgian public holidays in the target week drive foot traffic up
  const holidays = wm.nextWeekHolidays?.length
    ? wm.nextWeekHolidays
    : holidaysInRange(wm.nextWeekStart, wm.nextWeekEnd);
  const holidayCount  = holidays.length;
  const holidayFactor = holidayCount > 0 ? 1 + holidayCount * 0.05 : 1.0;

  // Weather factor: derived from the 14-day forecast for next week
  let weatherFactor = 1.0;
  let weatherNote   = null;
  if (weatherDaily && wm.nextWeekStart && wm.nextWeekEnd) {
    const nextWeekDays = weatherDaily.time
      .map((t, i) => ({
        date:  t,
        tmax:  weatherDaily.temperature_2m_max[i],
        rain:  weatherDaily.precipitation_sum?.[i] || 0,
        code:  weatherDaily.weathercode[i],
      }))
      .filter(d => d.date >= wm.nextWeekStart && d.date <= wm.nextWeekEnd);

    if (nextWeekDays.length > 0) {
      const avgMax    = nextWeekDays.reduce((s, d) => s + d.tmax, 0) / nextWeekDays.length;
      const totalRain = nextWeekDays.reduce((s, d) => s + d.rain, 0);
      const sunDays   = nextWeekDays.filter(d => d.code <= 3).length;

      if (sunDays >= 4 && avgMax >= 18) {
        weatherFactor = 1.05;
        weatherNote   = "beau temps prévu ☀️";
      } else if (sunDays >= 3 && avgMax >= 14) {
        weatherFactor = 1.02;
        weatherNote   = "temps clément prévu";
      } else if (totalRain > 25 || (avgMax < 3)) {
        weatherFactor = 0.96;
        weatherNote   = totalRain > 25 ? "semaine pluvieuse 🌧" : "temps très froid ❄️";
      } else if (totalRain > 12) {
        weatherFactor = 0.98;
        weatherNote   = "pluie modérée prévue";
      }
    }
  }

  return {
    predictedRevenue: Math.round(base * blendedFactor * holidayFactor * weatherFactor),
    base,
    localFactor,
    annualFactor,
    blendedFactor,
    holidayFactor,
    holidayCount,
    holidays,
    weatherFactor,
    weatherNote,
    yearlyGrowth,
  };
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

// Full-year YoY growth rate (filters partial years)
function annualGrowthRate(data) {
  const fullYears = (data.macro?.years || []).filter(y => !y.isPartial);
  return fullYears.length >= 2
    ? (fullYears[fullYears.length - 1].revenue / fullYears[fullYears.length - 2].revenue) - 1
    : 0;
}

// Renders the prediction card HTML (called initially without weather, then updated)
function renderPredictionCard(wm, pred, nextWeekNum) {
  if (!pred) return "";

  const signPct = (f) => `${f > 1 ? "+" : ""}${Math.round((f - 1) * 100)}%`;
  const localLabel  = signPct(pred.localFactor);
  const annualLabel = signPct(pred.annualFactor);

  const holidayHtml = pred.holidays.length > 0
    ? `<div class="prediction-holidays">
        ${pred.holidays.map(h => {
          const flag = h.region === "flanders" ? "🇧🇪🟡" : h.region === "wallonia" ? "🇧🇪🔴" : "🇧🇪";
          return `<span class="holiday-badge">${flag} ${h.name}</span>`;
        }).join(" ")}
       </div>`
    : "";

  const weatherHtml = pred.weatherNote
    ? `<div class="prediction-weather">${pred.weatherNote} → ${signPct(pred.weatherFactor)}</div>`
    : `<div class="prediction-weather prediction-weather--loading">météo S${nextWeekNum} en cours…</div>`;

  const factorsHtml = `
    <div class="prediction-factors">
      <span class="pred-factor">tendance locale ${localLabel}</span>
      <span class="pred-factor pred-factor--sep">·</span>
      <span class="pred-factor">tendance annuelle ${annualLabel}</span>
      ${pred.holidayCount > 0 ? `<span class="pred-factor pred-factor--sep">·</span><span class="pred-factor pred-factor--holiday">+${pred.holidayCount} férié${pred.holidayCount > 1 ? "s" : ""}</span>` : ""}
    </div>`;

  return `
    <div class="briefing-card briefing-card--prediction" id="prediction-card">
      <div class="card-label">PRÉVISION SEMAINE ${nextWeekNum}
        <span class="pred-dates">(${formatShortDate(wm.nextWeekStart)} – ${formatShortDate(wm.nextWeekEnd)})</span>
      </div>
      <div class="prediction-value">${formatEuro(pred.predictedRevenue)}</div>
      <div class="prediction-basis">Même semaine l'an dernier : ${formatEuro(pred.base)}</div>
      ${factorsHtml}
      ${weatherHtml}
      ${holidayHtml}
    </div>`;
}

function formatShortDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("fr-BE", { day: "numeric", month: "short" });
}

// Cap 2026 zones: absolute weekly revenue thresholds (TTC)
const ZONE_THRESHOLDS = { rouge: 7500, orange: 9000, vert: 10500 };
const ZONE_CONFIG = {
  rouge:  { color: "#EF4444", label: "Rouge",  emoji: "🔴", signal: "Alerte. Commandez le strict minimum." },
  orange: { color: "#F97316", label: "Orange", emoji: "🟠", signal: "Zone critique. Réduisez les quantités." },
  vert:   { color: "#22C55E", label: "Vert",   emoji: "🟢", signal: "Semaine saine. Commandes normales." },
  bleu:   { color: "#3B82F6", label: "Bleu",   emoji: "🔵", signal: "Semaine forte. Commandez en confiance." },
  neutre: { color: "#6B7280", label: "—",      emoji: "⚪", signal: "Données insuffisantes pour évaluer la semaine." },
};

function computeZone(weeklyRevenue) {
  if (weeklyRevenue == null) return "neutre";
  if (weeklyRevenue < ZONE_THRESHOLDS.rouge)  return "rouge";
  if (weeklyRevenue < ZONE_THRESHOLDS.orange) return "orange";
  if (weeklyRevenue < ZONE_THRESHOLDS.vert)   return "vert";
  return "bleu";
}

function renderBriefing(data) {
  const section = document.getElementById("tab-briefing");
  const now = new Date();
  const dayName = DAY_NAMES_FR[now.getDay()];
  const weekNum = getWeekNumber(now);
  const wm = data.weeklyMetrics;

  const zone = computeZone(wm?.lastWeekRevenue);
  const zc = ZONE_CONFIG[zone];
  const yoy = wm ? wm.weekYoY : null;

  const yearlyGrowth = annualGrowthRate(data);
  const nextWeekNum  = weekNum + 1;
  const pred = wm ? computePrediction(wm, yearlyGrowth, null) : null;
  const orderingReminders = getOrderingReminders(data, dayName);

  const lastWeekLabel = wm
    ? `${formatShortDate(wm.lastWeekStart)} – ${formatShortDate(wm.lastWeekEnd)}`
    : "";
  const lastYearLabel = wm?.sameWeekLastYearStart
    ? `${formatShortDate(wm.sameWeekLastYearStart)} – ${formatShortDate(wm.sameWeekLastYearEnd)}`
    : "";

  const yoyText = yoy != null
    ? `${yoy > 0 ? "+" : ""}${Math.round(yoy * 100)}% par rapport à la même semaine l'an dernier`
    : "";

  const mtdText = wm
    ? `Depuis le début du mois : ${formatEuro(wm.mtdRevenue)}${wm.mtdYoY != null ? ` (${wm.mtdYoY > 0 ? "+" : ""}${Math.round(wm.mtdYoY * 100)}% vs l'an dernier)` : ""}`
    : "";

  section.innerHTML = `
    <div class="briefing-grid">

      <!-- HERO: ordering confidence signal -->
      <div class="briefing-card briefing-card--signal" style="border-left: 5px solid ${zc.color}; background: linear-gradient(135deg, var(--bg-card) 0%, ${zc.color}11 100%);">
        <div class="signal-header">
          <span class="signal-zone-badge" style="background: ${zc.color}">${zc.emoji} ZONE ${zc.label.toUpperCase()}</span>
          <span class="signal-date">${formatDate(now)} · Semaine ${weekNum}</span>
        </div>
        <div class="signal-message" style="color: ${zc.color}">${zc.signal}</div>
        <div class="signal-details">
          <span class="signal-revenue">${wm ? formatEuro(wm.lastWeekRevenue) : "—"} la semaine dernière</span>
          ${lastWeekLabel ? `<span class="signal-period">(${lastWeekLabel})</span>` : ""}
        </div>
        ${yoyText ? `<div class="signal-yoy">${yoyText}</div>` : ""}
      </div>

      <!-- Zone gauge: visual reference of where we stand -->
      <div class="briefing-card briefing-card--gauge">
        <div class="zone-gauge">
          ${renderZoneGauge(wm?.lastWeekRevenue)}
        </div>
        ${mtdText ? `<div class="gauge-mtd">${mtdText}</div>` : ""}
      </div>

      ${orderingReminders.length > 0 ? `
      <div class="briefing-card briefing-card--ordering">
        <div class="card-label">COMMANDES AUJOURD'HUI</div>
        <ul class="ordering-list">
          ${orderingReminders.map(s => `
            <li class="ordering-item">
              <div class="ordering-item-header">
                <span class="ordering-name">${s.name}</span>
                ${s.cutoff ? `<span class="ordering-cutoff">avant ${s.cutoff}</span>` : ""}
              </div>
              ${s.topItems && s.topItems.length > 0 ? `
                <ul class="ordering-products">
                  ${s.topItems.map(p => `<li class="ordering-product">${p.name}${p.qty ? ` <span class="ordering-qty">×${p.qty}</span>` : ""}</li>`).join("")}
                </ul>` : ""}
            </li>`).join("")}
        </ul>
      </div>` : `
      <div class="briefing-card briefing-card--ordering briefing-card--quiet">
        <div class="card-label">COMMANDES</div>
        <div class="ordering-quiet">Pas de commandes prévues aujourd'hui</div>
      </div>`}

      ${renderPredictionCard(wm, pred, nextWeekNum)}

    </div>
  `;
}

function renderZoneGauge(revenue) {
  const zones = [
    { key: "rouge",  label: "Rouge",  min: 0,     max: 7500,  color: "#EF4444" },
    { key: "orange", label: "Orange", min: 7500,  max: 9000,  color: "#F97316" },
    { key: "vert",   label: "Vert",   min: 9000,  max: 10500, color: "#22C55E" },
    { key: "bleu",   label: "Bleu",   min: 10500, max: 14000, color: "#3B82F6" },
  ];
  const gaugeMax = 14000;
  const current = computeZone(revenue);

  const segments = zones.map(z => {
    const widthPct = ((z.max - z.min) / gaugeMax * 100).toFixed(1);
    const isActive = z.key === current;
    return `<div class="gauge-segment ${isActive ? "gauge-segment--active" : ""}" style="width:${widthPct}%;background:${z.color};opacity:${isActive ? 1 : 0.25}">
      <span class="gauge-label">${z.label}</span>
      <span class="gauge-range">${z.min > 0 ? formatEuro(z.min) : ""} – ${formatEuro(z.max)}</span>
    </div>`;
  }).join("");

  const markerPct = revenue != null
    ? Math.min(100, Math.max(0, (revenue / gaugeMax) * 100)).toFixed(1)
    : null;
  const marker = markerPct != null
    ? `<div class="gauge-marker" style="left:${markerPct}%"><div class="gauge-marker-dot"></div><div class="gauge-marker-label">${formatEuro(revenue)}</div></div>`
    : "";

  return `<div class="gauge-bar">${segments}</div>${marker}`;
}

function getOrderingReminders(data, dayName) {
  if (!data.orderSchedule || !data.orderSchedule[dayName]) return [];

  const scheduledSuppliers = data.orderSchedule[dayName];
  if (!scheduledSuppliers.length) return [];

  // Primary: use the scored suppliers array (has weather-adjusted quantities)
  const suppliersArr = data.suppliers || [];
  const supMap = new Map(suppliersArr.map(s => [s.name, s]));

  // Fallback: top products per supplier from the full products list
  const prodsBySupplier = new Map();
  for (const p of data.products || []) {
    if (!p.supplier) continue;
    if (!prodsBySupplier.has(p.supplier)) prodsBySupplier.set(p.supplier, []);
    prodsBySupplier.get(p.supplier).push(p);
  }

  return scheduledSuppliers.map(entry => {
    const sup = supMap.get(entry.name) || {};
    let topItems;
    if (sup.order && sup.order.length > 0) {
      topItems = sup.order.slice(0, 3).map(p => ({
        name: p.displayName,
        qty: p.weatherAdjustedQuantity || p.recentQuantity,
      }));
    } else {
      // Fallback: show top revenue products for this supplier
      topItems = (prodsBySupplier.get(entry.name) || [])
        .sort((a, b) => b.revenue2025 - a.revenue2025)
        .slice(0, 3)
        .map(p => ({ name: p.name, qty: null }));
    }
    return { ...entry, topItems };
  });
}

// ============================================================
// Tab 1 — Weather
// ============================================================

const DAY_ABBR_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

async function fetchWeather(location) {
  try {
    const lat = (location && location.lat) ? location.lat : 50.8503;
    const lon = (location && location.lon) ? location.lon : 4.3517;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Europe%2FBrussels&forecast_days=14`;
    const res = await fetch(url);
    const wx = await res.json();

    const temp = wx.current.temperature_2m;
    const code = wx.current.weathercode;
    const emoji = weatherEmoji(code);
    document.getElementById("weather-widget").innerHTML =
      `<span class="wx-emoji">${emoji}</span> <span class="wx-temp">${temp}°C</span> · Bruxelles`;

    renderWeatherForecast(wx.daily);

    // Refresh prediction card now that we have the 14-day forecast
    if (DATA?.weeklyMetrics) {
      const wm      = DATA.weeklyMetrics;
      const growth  = annualGrowthRate(DATA);
      const weekNum = getWeekNumber(new Date());
      const pred    = computePrediction(wm, growth, wx.daily);
      const card    = document.getElementById("prediction-card");
      if (card) {
        card.outerHTML = renderPredictionCard(wm, pred, weekNum + 1);
      }
    }
  } catch {
    document.getElementById("weather-widget").textContent = "météo indisponible";
  }
}

function renderWeatherForecast(daily) {
  const briefingGrid = document.querySelector(".briefing-grid");
  if (!briefingGrid) return;

  const today = new Date().toISOString().slice(0, 10);

  const dayCards = daily.time.map((dateStr, i) => {
    const dt = new Date(dateStr + "T12:00:00");
    const dayAbbr = DAY_ABBR_FR[dt.getDay()];
    const dayNum = dt.getDate();
    const tmax = Math.round(daily.temperature_2m_max[i]);
    const tmin = Math.round(daily.temperature_2m_min[i]);
    const rain = daily.precipitation_sum?.[i] || 0;
    const code = daily.weathercode[i];
    const emoji = weatherEmoji(code);
    const isToday = dateStr === today;
    const isRainy = rain > 2;

    return `
      <div class="wx-day${isToday ? " wx-day--today" : ""}${isRainy ? " wx-day--rain" : ""}">
        <span class="wx-day-name">${dayAbbr}</span>
        <span class="wx-day-num">${dayNum}</span>
        <span class="wx-day-emoji">${emoji}</span>
        <span class="wx-day-max">${tmax}°</span>
        <span class="wx-day-min">${tmin}°</span>
        ${isRainy ? `<span class="wx-day-rain">${rain.toFixed(0)} mm</span>` : `<span class="wx-day-rain wx-day-rain--empty"></span>`}
      </div>`;
  }).join("");

  const card = document.createElement("div");
  card.className = "briefing-card briefing-card--forecast";
  card.innerHTML = `
    <div class="wx-forecast-header">
      <span class="card-label">MÉTÉO 14 JOURS — BRUXELLES</span>
      <a class="wx-radar-link" href="https://www.meteoetradar.be/" target="_blank" rel="noopener">
        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
        Radar
      </a>
    </div>
    <div class="wx-forecast-strip">${dayCards}</div>
  `;

  briefingGrid.appendChild(card);
}

function weatherEmoji(code) {
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫";
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
    if (searchQuery && !(p.displayName || p.name || "").toLowerCase().includes(searchQuery)) return false;
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
        const memberProducts = products.filter(p => g.members.includes(p.displayName || p.name));
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
      <span class="product-name">${p.displayName || p.name}</span>
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
  const clean = history.map(v => (typeof v === "number" && Number.isFinite(v)) ? v : 0);
  const W = 80, H = 24, pad = 2;
  if (clean.length === 1) {
    const cy = H / 2;
    return `<svg width="${W}" height="${H}" class="sparkline"><circle cx="${W / 2}" cy="${cy}" r="2" fill="#3B82F6"/></svg>`;
  }
  const max = Math.max(...clean, 1);
  const lastIndex = Math.max(clean.length - 1, 1);
  const points = clean.map((v, i) => {
    const x = pad + (i / lastIndex) * (W - pad * 2);
    const y = H - pad - ((v / max) * (H - pad * 2));
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const trend = clean[clean.length - 1] > clean[0];
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
// Tab 3 — Catégories
// ============================================================

function renderCategories(data) {
  const section = document.getElementById("tab-categories");
  const cats = data.categoryMix || [];
  if (!cats.length) {
    section.innerHTML = `<div class="stub-content"><p class="stub-description">Données catégories non disponibles.</p></div>`;
    return;
  }

  const totalRev = cats.reduce((s, c) => s + c.totalRevenue, 0);

  const rows = cats.map(c => {
    let yoy, yoyColor;
    if (c.yoy == null) {
      yoy = "—"; yoyColor = "#6B7280";
    } else if (Math.abs(c.yoy) > 9.99) {
      // Cap extreme YoY — likely new category with near-zero prior year
      yoy = c.yoy > 0 ? ">+999%" : "<-999%";
      yoyColor = "#6B7280";
    } else {
      yoy = `${c.yoy > 0 ? "+" : ""}${Math.round(c.yoy * 100)}%`;
      yoyColor = c.yoy > 0.05 ? "#10B981" : c.yoy < -0.05 ? "#EF4444" : "#6B7280";
    }
    const sharePct = ((c.totalRevenue / totalRev) * 100).toFixed(1);
    const barWidth = Math.round((c.totalRevenue / cats[0].totalRevenue) * 100);

    return `
      <div class="cat-row">
        <div class="cat-name-col">
          <span class="cat-name">${c.category}</span>
          <div class="cat-bar-bg"><div class="cat-bar-fill" style="width:${barWidth}%"></div></div>
        </div>
        <span class="cat-revenue">${formatEuro(c.totalRevenue)}</span>
        <span class="cat-share">${sharePct}%</span>
        <span class="cat-yoy" style="color:${yoyColor}">${yoy}</span>
        <span class="cat-count">${c.productCount.toLocaleString("fr-BE")} ventes</span>
      </div>`;
  }).join("");

  section.innerHTML = `
    <div class="categories-layout">
      <div class="categories-header">
        <div class="cat-col-name">Catégorie</div>
        <div class="cat-col-rev">CA 2025</div>
        <div class="cat-col-share">Part</div>
        <div class="cat-col-yoy">vs N-1</div>
        <div class="cat-col-count">Transactions</div>
      </div>
      <div class="categories-rows">${rows}</div>
    </div>
  `;
}

// ============================================================
// Tab 4 — Fournisseurs
// ============================================================

function renderFournisseurs(data) {
  const section = document.getElementById("tab-fournisseurs");
  const ranking = data.supplierRanking || [];
  const suppliersArr = data.suppliers || [];
  const products = data.products || [];

  if (!ranking.length) {
    section.innerHTML = `<div class="stub-content"><p class="stub-description">Données fournisseurs non disponibles.</p></div>`;
    return;
  }

  // Build supplier schedule map from the suppliers array (has order days/cutoffs)
  const schedMap = new Map();
  for (const s of suppliersArr) {
    if (s.name) schedMap.set(s.name, s);
  }

  // Build top products per supplier from the products list (already sorted by revenue)
  const prodsBySupplier = new Map();
  for (const p of products) {
    if (!p.supplier) continue;
    if (!prodsBySupplier.has(p.supplier)) prodsBySupplier.set(p.supplier, []);
    prodsBySupplier.get(p.supplier).push(p.name);
  }

  const rows = ranking.map((r) => {
    const sched = schedMap.get(r.name) || {};
    const days = sched.orderingDays?.join(", ") || sched.orderDay || null;
    const cutoff = sched.cutoff ? `avant ${sched.cutoff}` : null;
    const trend = r.enHausse > r.enBaisse ? "#10B981" : r.enBaisse > r.enHausse ? "#EF4444" : "#6B7280";
    const trendLabel = r.enHausse > r.enBaisse
      ? `↑ ${r.enHausse} en hausse`
      : r.enBaisse > r.enHausse
        ? `↓ ${r.enBaisse} en baisse`
        : "→ stable";
    const topProds = (prodsBySupplier.get(r.name) || []).slice(0, 3)
      .map(p => `<span class="sup-prod">${p}</span>`).join("");

    return `
      <div class="sup-row">
        <span class="sup-rank">${r.rank}</span>
        <div class="sup-info">
          <span class="sup-name">${r.name}</span>
          ${topProds ? `<div class="sup-products">${topProds}</div>` : ""}
        </div>
        <span class="sup-revenue">${formatEuro(r.totalRevenue)}</span>
        <span class="sup-trend" style="color:${trend}">${trendLabel}</span>
        <div class="sup-order">
          ${days ? `<span class="sup-order-day">${days}</span>` : ""}
          ${cutoff ? `<span class="sup-order-cutoff">${cutoff}</span>` : ""}
        </div>
        <span class="sup-refs">${r.productCount} réf.</span>
      </div>`;
  }).join("");

  section.innerHTML = `
    <div class="suppliers-layout">
      <div class="suppliers-header">
        <div class="sup-col-rank">#</div>
        <div class="sup-col-info">Fournisseur</div>
        <div class="sup-col-rev">CA 2025</div>
        <div class="sup-col-trend">Tendance</div>
        <div class="sup-col-order">Commande</div>
        <div class="sup-col-refs">Références</div>
      </div>
      <div class="suppliers-rows">${rows}</div>
    </div>
  `;
}

// ============================================================
// Tabs 5–7 — Stub sections
// ============================================================

function renderStubs(data) {
  const stubs = [
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
        { label: "Produits traités", value: data.kpis?.productCount || "—" },
      ]
    }
  ];

  for (const stub of stubs) {
    const section = document.getElementById(`tab-${stub.id}`);
    if (!section) continue;
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
