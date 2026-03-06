const UI_COPY = {
  en: {
    runDate: "Run date",
    weather: "Weather",
    calendar: "Calendar",
    method: "Method",
    inferenceHeadline: "Inference stays visible",
    confidence: "Confidence",
    delivery: "Delivers",
    cutoff: "cutoff",
    order: "Order",
    watch: "Watch",
    skip: "Skip",
    noOrder: "No hard order signal.",
    noWatch: "No watchlist item.",
    noSkip: "No stable item yet.",
    tasks: "Suggested tasks",
    rawRevenue: "Raw revenue",
    interpretedDemand: "Interpreted demand",
    units: "units",
    inStock: "in stock",
    actions: {
      order: "order",
      watch: "watch",
      skip: "hold"
    },
    months: {
      Jan: "Jan",
      Feb: "Feb",
      Mar: "Mar",
      Apr: "Apr",
      May: "May",
      Jun: "Jun",
      Jul: "Jul",
      Aug: "Aug",
      Sep: "Sep",
      Oct: "Oct",
      Nov: "Nov",
      Dec: "Dec"
    }
  },
  fr: {
    runDate: "Analyse du",
    weather: "Météo",
    calendar: "Calendrier",
    method: "Méthode",
    inferenceHeadline: "L'inférence reste visible",
    confidence: "Confiance",
    delivery: "Livré",
    cutoff: "limite",
    order: "Commander",
    watch: "Surveiller",
    skip: "Laisser",
    noOrder: "Aucun signal fort de commande.",
    noWatch: "Aucun article en surveillance.",
    noSkip: "Aucun article stable pour l'instant.",
    tasks: "Actions suggérées",
    rawRevenue: "Chiffre brut",
    interpretedDemand: "Demande interprétée",
    units: "unités",
    inStock: "en stock",
    actions: {
      order: "commander",
      watch: "surveiller",
      skip: "laisser"
    },
    months: {
      Jan: "janv.",
      Feb: "févr.",
      Mar: "mars",
      Apr: "avr.",
      May: "mai",
      Jun: "juin",
      Jul: "juil.",
      Aug: "août",
      Sep: "sept.",
      Oct: "oct.",
      Nov: "nov.",
      Dec: "déc."
    }
  }
};

function getLanguage(locale) {
  return String(locale || "fr")
    .toLowerCase()
    .startsWith("fr")
    ? "fr"
    : "en";
}

function translateMonth(label, ui) {
  return ui.months[label] || label;
}

function confidenceMarkup(value, ui) {
  const pct = Math.round(value * 100);
  return `
    <div class="confidence">
      <span>${ui.confidence} ${pct}%</span>
      <div class="confidence-bar"><span style="width:${pct}%"></span></div>
    </div>
  `;
}

function itemMarkup(item, ui) {
  return `
    <article class="item item-${item.action}">
      <header>
        <strong>${item.displayName}</strong>
        <span>${ui.actions[item.action]}</span>
      </header>
      <p>${item.evidence.join(" · ")}</p>
    </article>
  `;
}

fetch("./data/demo.json")
  .then((response) => response.json())
  .then((data) => {
    const language = getLanguage(data.productLocale);
    const ui = UI_COPY[language];
    const euro = new Intl.NumberFormat(data.productLocale || "fr-BE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0
    });

    document.documentElement.lang = language;
    document.getElementById("metric-orders").textContent = data.kpis.orderSignals;
    document.getElementById("metric-stockouts").textContent = data.kpis.stockoutFlags;
    document.getElementById("metric-revenue").textContent = euro.format(data.kpis.revenue2025);
    document.getElementById("hero-meta").innerHTML = `
      <span>${data.store}, ${data.location}</span>
      <span>${ui.runDate} ${data.runDate}</span>
      <span>${data.methodology.rawVsInterpreted}</span>
    `;

    document.getElementById("context-band").innerHTML = `
      <div class="context-card hot">
        <span class="context-label">${ui.weather}</span>
        <strong>${data.context.weather.headline}</strong>
        <p>${data.context.weather.temperatureC}°C · ${ui.confidence.toLowerCase()} ${Math.round(data.context.weather.confidence * 100)}%</p>
      </div>
      <div class="context-card">
        <span class="context-label">${ui.calendar}</span>
        <strong>${data.context.calendar.publicHoliday}</strong>
        <p>${data.context.calendar.schoolBreak}</p>
      </div>
      <div class="context-card">
        <span class="context-label">${ui.method}</span>
        <strong>${ui.inferenceHeadline}</strong>
        <p>${data.methodology.rawVsInterpreted}</p>
      </div>
    `;

    document.getElementById("briefing-list").innerHTML = data.briefing
      .map(
        (line, index) => `
          <div class="briefing-card">
            <span class="briefing-index">0${index + 1}</span>
            <p>${line}</p>
          </div>
        `
      )
      .join("");

    document.getElementById("supplier-grid").innerHTML = data.suppliers
      .map(
        (supplier) => `
          <section class="supplier-card">
            <div class="supplier-head">
              <div>
                <p class="eyebrow">${supplier.orderDay} · ${ui.cutoff} ${supplier.cutoff}</p>
                <h3>${supplier.name}</h3>
              </div>
              <p class="delivery-note">${ui.delivery} ${supplier.deliveryDay}</p>
            </div>
            <p class="supplier-summary">${supplier.summary}</p>
            <div class="supplier-columns">
              <div>
                <h4>${ui.order}</h4>
                ${(supplier.order.length ? supplier.order : []).map((item) => itemMarkup(item, ui)).join("") || `<p class='empty-state'>${ui.noOrder}</p>`}
              </div>
              <div>
                <h4>${ui.watch}</h4>
                ${(supplier.watch.length ? supplier.watch : []).map((item) => itemMarkup(item, ui)).join("") || `<p class='empty-state'>${ui.noWatch}</p>`}
              </div>
              <div>
                <h4>${ui.skip}</h4>
                ${(supplier.skip.length ? supplier.skip : []).map((item) => itemMarkup(item, ui)).join("") || `<p class='empty-state'>${ui.noSkip}</p>`}
              </div>
            </div>
            <div class="task-block">
              <span class="context-label">${ui.tasks}</span>
              <ul>
                ${supplier.tasks.map((task) => `<li>${task}</li>`).join("")}
              </ul>
            </div>
          </section>
        `
      )
      .join("");

    document.getElementById("insight-grid").innerHTML = data.insights
      .map(
        (insight) => `
          <article class="insight-card">
            <h3>${insight.title}</h3>
            <p>${insight.body}</p>
            <div class="evidence-chip-row">
              ${insight.evidence.map((entry) => `<span class="evidence-chip">${entry}</span>`).join("")}
            </div>
            <div class="raw-interpreted">
              <div>
                <span class="context-label">${ui.rawRevenue}</span>
                <strong>${euro.format(insight.rawRevenue)}</strong>
              </div>
              <div>
                <span class="context-label">${ui.interpretedDemand}</span>
                <strong>${Math.round(insight.interpretedDemand)} ${ui.units}</strong>
              </div>
            </div>
            ${confidenceMarkup(insight.confidence, ui)}
          </article>
        `
      )
      .join("");

    document.getElementById("category-list").innerHTML = data.categoryMix
      .map(
        (category) => `
          <div class="category-row">
            <div>
              <strong>${category.category}</strong>
              <span>${euro.format(category.totalRevenue)}</span>
            </div>
            <div class="category-bar"><span style="width:${Math.min(category.share * 2.4, 100)}%"></span></div>
          </div>
        `
      )
      .join("");

    document.getElementById("top-products").innerHTML = data.topProducts
      .map(
        (product) => `
          <div class="product-row">
            <div>
              <strong>${product.displayName}</strong>
              <span>${product.category}</span>
            </div>
            <div>
              <strong>${euro.format(product.totalRevenue)}</strong>
              <span>${ui.actions[product.action]}</span>
            </div>
          </div>
        `
      )
      .join("");

    document.getElementById("slow-products").innerHTML = data.slowProducts
      .map(
        (product) => `
          <div class="product-row slow">
            <div>
              <strong>${product.displayName}</strong>
              <span>${product.category}</span>
            </div>
            <div>
              <strong>${euro.format(product.totalRevenue)}</strong>
              <span>${product.stock} ${ui.inStock}</span>
            </div>
          </div>
        `
      )
      .join("");

    document.getElementById("macro-year-strip").innerHTML = data.macro.years
      .map(
        (year) => `
          <div class="year-card">
            <span>${year.year}</span>
            <strong>${euro.format(year.revenue)}</strong>
          </div>
        `
      )
      .join("");

    document.getElementById("macro-trend").innerHTML = data.macro.timeline
      .map(
        (row) => `
          <div class="trend-row">
            <span>${translateMonth(row.month, ui)}</span>
            <div class="trend-bars">
              <span style="height:${row.revenue2023 / 900}px"></span>
              <span style="height:${row.revenue2024 / 900}px"></span>
              <span class="current" style="height:${row.revenue2025 / 900}px"></span>
            </div>
          </div>
        `
      )
      .join("");
  });
