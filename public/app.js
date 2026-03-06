const euro = new Intl.NumberFormat("en-BE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0
});

const percent = new Intl.NumberFormat("en-BE", {
  style: "percent",
  maximumFractionDigits: 0
});

function confidenceMarkup(value) {
  const pct = Math.round(value * 100);
  return `
    <div class="confidence">
      <span>Confidence ${pct}%</span>
      <div class="confidence-bar"><span style="width:${pct}%"></span></div>
    </div>
  `;
}

function itemMarkup(item) {
  return `
    <article class="item item-${item.action}">
      <header>
        <strong>${item.displayName}</strong>
        <span>${item.action}</span>
      </header>
      <p>${item.evidence.join(" · ")}</p>
    </article>
  `;
}

fetch("./data/demo.json")
  .then((response) => response.json())
  .then((data) => {
    document.getElementById("metric-orders").textContent = data.kpis.orderSignals;
    document.getElementById("metric-stockouts").textContent = data.kpis.stockoutFlags;
    document.getElementById("metric-revenue").textContent = euro.format(data.kpis.revenue2025);
    document.getElementById("hero-meta").innerHTML = `
      <span>${data.store}, ${data.location}</span>
      <span>Run date ${data.runDate}</span>
      <span>${data.methodology.rawVsInterpreted}</span>
    `;

    document.getElementById("context-band").innerHTML = `
      <div class="context-card hot">
        <span class="context-label">Weather</span>
        <strong>${data.context.weather.headline}</strong>
        <p>${data.context.weather.temperatureC}°C · confidence ${Math.round(data.context.weather.confidence * 100)}%</p>
      </div>
      <div class="context-card">
        <span class="context-label">Calendar</span>
        <strong>${data.context.calendar.publicHoliday}</strong>
        <p>${data.context.calendar.schoolBreak}</p>
      </div>
      <div class="context-card">
        <span class="context-label">Method</span>
        <strong>Inference stays visible</strong>
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
                <p class="eyebrow">${supplier.orderDay} · cutoff ${supplier.cutoff}</p>
                <h3>${supplier.name}</h3>
              </div>
              <p class="delivery-note">Delivers ${supplier.deliveryDay}</p>
            </div>
            <p class="supplier-summary">${supplier.summary}</p>
            <div class="supplier-columns">
              <div>
                <h4>Order</h4>
                ${(supplier.order.length ? supplier.order : []).map(itemMarkup).join("") || "<p class='empty-state'>No hard order signal.</p>"}
              </div>
              <div>
                <h4>Watch</h4>
                ${(supplier.watch.length ? supplier.watch : []).map(itemMarkup).join("") || "<p class='empty-state'>No watchlist item.</p>"}
              </div>
              <div>
                <h4>Skip</h4>
                ${(supplier.skip.length ? supplier.skip : []).map(itemMarkup).join("") || "<p class='empty-state'>No stable item yet.</p>"}
              </div>
            </div>
            <div class="task-block">
              <span class="context-label">Suggested tasks</span>
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
                <span class="context-label">Raw revenue</span>
                <strong>${euro.format(insight.rawRevenue)}</strong>
              </div>
              <div>
                <span class="context-label">Interpreted demand</span>
                <strong>${Math.round(insight.interpretedDemand)} units</strong>
              </div>
            </div>
            ${confidenceMarkup(insight.confidence)}
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
              <span>${product.action}</span>
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
              <span>${product.stock} in stock</span>
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
            <span>${row.month}</span>
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

