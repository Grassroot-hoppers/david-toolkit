const EURO = new Intl.NumberFormat('fr-BE', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0
});

const PCT = (v) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;

const TREND_UP_ICON = `<svg class="kpi-trend-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`;
const TREND_DOWN_ICON = `<svg class="kpi-trend-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg>`;
const BOLT_ICON = `<svg class="stat-icon stat-icon--green" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>`;
const LINK_ICON = `<svg class="supplier-url-icon" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`;

function $(id) { return document.getElementById(id); }
function text(id, val) { const el = $(id); if (el) el.textContent = val; }
function html(id, val) { const el = $(id); if (el) el.innerHTML = val; }

const ZONE_COLORS = { rouge: 'var(--zone-rouge)', orange: 'var(--zone-orange)', vert: 'var(--zone-vert)', bleu: 'var(--zone-bleu)' };
const ZONE_LABELS = { rouge: 'Rouge', orange: 'Orange', vert: 'Vert', bleu: 'Bleu' };

function renderSignal(data) {
  const wm = data.weeklyMetrics;
  text('signal-headline', data.briefing[0]);

  const statsHtml = [];
  if (wm) {
    const icon = wm.weekYoY >= 0 ? TREND_UP_ICON : TREND_DOWN_ICON;
    const cls = wm.weekYoY >= 0 ? 'stat-text--green' : 'stat-text--muted';
    statsHtml.push(`<div class="stat">${icon}<span class="${cls}">${PCT(wm.weekYoY)} vs N-1</span></div>`);
  }
  statsHtml.push(`<span class="stat-text--muted">${data.kpis.enHausse} en hausse · ${data.kpis.enBaisse} en baisse</span>`);
  statsHtml.push(`<div class="stat">${BOLT_ICON}<span class="stat-text--green">${data.kpis.stable} stables</span></div>`);
  html('signal-stats', statsHtml.join(''));

  const ctx = data.context;
  text('signal-context', [
    ctx.calendar?.publicHoliday,
    ctx.calendar?.schoolBreak
  ].filter(Boolean).join(' · '));
}

function renderKPIs(data) {
  const wm = data.weeklyMetrics;
  if (!wm) return;

  const card1 = `
    <div class="kpi-card">
      <span class="kpi-label">Semaine dernière</span>
      <span class="kpi-value">${EURO.format(wm.lastWeekRevenue)}</span>
      <div class="kpi-zone-row">
        <span class="zone-dot" style="background:${ZONE_COLORS[wm.zone]}"></span>
        <span class="zone-text" style="color:${ZONE_COLORS[wm.zone]}">${ZONE_LABELS[wm.zone]}</span>
      </div>
      <span class="kpi-date">${wm.lastWeekStart} → ${wm.lastWeekEnd}</span>
      <div class="kpi-trend">${wm.weekYoY >= 0 ? TREND_UP_ICON : TREND_DOWN_ICON}<span class="kpi-trend-text">${PCT(wm.weekYoY)} vs N-1</span></div>
    </div>`;

  const card2 = `
    <div class="kpi-card">
      <span class="kpi-label">Même semaine N-1</span>
      <span class="kpi-value">${EURO.format(wm.sameWeekLastYear)}</span>
      <span class="kpi-date">Référence historique</span>
      <span class="kpi-ref">${data.store}, ${data.location}</span>
    </div>`;

  const card3 = `
    <div class="kpi-card">
      <span class="kpi-label">Mois en cours (MTD)</span>
      <span class="kpi-value kpi-value--accent">${EURO.format(wm.mtdRevenue)}</span>
      <span class="kpi-date">vs ${EURO.format(wm.mtdLastYear)} N-1</span>
      <div class="kpi-trend">${wm.mtdYoY >= 0 ? TREND_UP_ICON : TREND_DOWN_ICON}<span class="kpi-trend-text">${PCT(wm.mtdYoY)} vs N-1</span></div>
    </div>`;

  html('kpi-row', card1 + card2 + card3);
}

function renderSuppliers(data) {
  const ranking = data.supplierRanking || [];
  const top = ranking.slice(0, 5);

  text('supplier-sub', `${data.context.runDate} — Top ${top.length} fournisseurs`);

  const cards = top.map(s => {
    const pill = s.enHausse > 0
      ? `${s.enHausse} en hausse`
      : s.enBaisse > 0
        ? `${s.enBaisse} en baisse`
        : `${s.productCount} produits`;

    return `
      <div class="supplier-card">
        <div class="supplier-top-row">
          <span class="supplier-name">${s.name.toUpperCase()}</span>
          <span class="category-pill">${pill}</span>
        </div>
        <div class="supplier-url-row">
          ${LINK_ICON}
          <span class="supplier-url-text">${EURO.format(s.totalRevenue)}/an · ${s.productCount} produits</span>
        </div>
        <span class="supplier-delivery">#${s.rank} fournisseur par CA</span>
      </div>`;
  }).join('');

  html('supplier-list', cards);
}

function renderCategories(data) {
  const cats = (data.categoryMix || []).slice(0, 8);
  text('cat-count', `${data.categoryMix?.length || 0} catégories`);

  const rows = cats.map(c => {
    const yoyText = c.yoy ? PCT(c.yoy) : '';
    const yoyCls = c.yoy > 0 ? 'stat-text--green' : 'stat-text--muted';
    return `
      <div class="task-row">
        <div class="task-left">
          <span class="task-circle" style="background:${c.share > 15 ? 'var(--accent)' : c.share > 5 ? 'var(--zone-vert)' : 'var(--border-subtle)'}; border:none"></span>
          <span class="task-text">${c.category}</span>
        </div>
        <span class="task-tag">${Math.round(c.share)}% ${yoyText ? `<span class="${yoyCls}">${yoyText}</span>` : ''}</span>
      </div>`;
  }).join('');

  html('category-list', rows);
}

function renderPerformanceZone(data) {
  const wm = data.weeklyMetrics;
  if (!wm) return;

  text('perf-current-val', EURO.format(wm.lastWeekRevenue));

  const pct = Math.min(100, (wm.lastWeekRevenue / 14000) * 100);
  const markerLine = $('gauge-marker-line');
  const markerDot = $('gauge-marker-dot');
  if (markerLine) markerLine.style.left = `${pct}%`;
  if (markerDot) markerDot.style.left = `calc(${pct}% - 3px)`;

  const badge = $('zone-badge');
  if (badge) {
    badge.textContent = `ZONE ${ZONE_LABELS[wm.zone].toUpperCase()}`;
    badge.style.background = ZONE_COLORS[wm.zone];
  }

  const perfBadge = document.querySelector('.perf-badge-text');
  const perfDot = document.querySelector('.perf-badge-dot');
  if (perfBadge) {
    perfBadge.textContent = `Zone ${ZONE_LABELS[wm.zone]}`;
    perfBadge.style.color = ZONE_COLORS[wm.zone];
  }
  if (perfDot) perfDot.style.background = ZONE_COLORS[wm.zone];
}

function renderSidebarPerf(data) {
  const wm = data.weeklyMetrics;
  if (wm) {
    text('sidebar-perf-zone', `Zone ${ZONE_LABELS[wm.zone]}`);
    text('sidebar-perf-meta', `${EURO.format(wm.lastWeekRevenue)} · Sem. dernière`);
  }
}

function setupNav() {
  const navItems = document.querySelectorAll('.nav-item[data-screen]');
  const screens = document.querySelectorAll('.main-content');
  const screenMap = { dashboard: 'screen-dashboard', roadmap: 'screen-roadmap' };

  navItems.forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const screenId = screenMap[item.dataset.screen];
      if (!screenId) return;
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      screens.forEach(s => s.classList.remove('active'));
      document.getElementById(screenId).classList.add('active');
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupNav();

  fetch('./data/demo.json')
    .then(r => {
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      return r.json();
    })
    .then(data => {
      document.title = `David — ${data.store}`;
      renderSignal(data);
      renderKPIs(data);
      renderSuppliers(data);
      renderCategories(data);
      renderPerformanceZone(data);
      renderSidebarPerf(data);
    })
    .catch(err => {
      console.error('Failed to load demo.json:', err);
      text('signal-headline', 'Données non disponibles — lancez npm run build:demo');
    });
});
