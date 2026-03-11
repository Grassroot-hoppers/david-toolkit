/**
 * Derives monthly-stats, annual-stats, category-mix, and hourly-patterns
 * Silver files from parsed transaction records.
 *
 * This is the core of the transaction-first pipeline: one CSV export from
 * the POS is enough — we compute all aggregate views from it.
 */

const DAY_NAMES = {
  1: "lundi",
  2: "mardi",
  3: "mercredi",
  4: "jeudi",
  5: "vendredi",
  6: "samedi",
  7: "dimanche"
};

/**
 * @param {Array} transactions - parsed transaction records from transactions importer
 * @param {number} year
 * @returns {{ monthlyStats, annualStats, categoryMix, hourlyPatterns }}
 */
export function aggregateFromTransactions(transactions, year) {
  const productMonthly = new Map(); // key → { key, rawName, category, months: Map<month, {qty, rev}> }
  const productAnnual = new Map();  // key → { key, rawName, category, quantity, revenue }
  const categoryVatMap = new Map(); // `${category}|${vatRate}` → { category, vatRate, products: Set, revenue, vatAmount }
  const hourlyMap = new Map();      // `${dow}|${hour}` → { dayOfWeek, dayName, hour, revenue }

  const totalRevenue = { value: 0 };

  for (const tx of transactions) {
    const { productKey, rawName, category, vatRate, price, hour, dayOfWeek } = tx;
    const qty = tx.quantity || 1;
    const date = tx.date; // "YYYY-MM-DD"
    const month = parseInt(date.slice(5, 7), 10);

    if (!price || price <= 0) continue;

    // --- Monthly stats per product ---
    if (!productMonthly.has(productKey)) {
      productMonthly.set(productKey, {
        key: productKey,
        rawName,
        category: category || "",
        months: new Map()
      });
    }
    const pm = productMonthly.get(productKey);
    if (!pm.months.has(month)) pm.months.set(month, { quantity: 0, revenue: 0 });
    const mon = pm.months.get(month);
    mon.quantity += qty;
    mon.revenue += price;

    // --- Annual stats per product ---
    if (!productAnnual.has(productKey)) {
      productAnnual.set(productKey, {
        key: productKey,
        rawName,
        category: category || "",
        quantity: 0,
        revenue: 0
      });
    }
    const pa = productAnnual.get(productKey);
    pa.quantity += qty;
    pa.revenue += price;

    // --- Category mix ---
    const catKey = `${category || "(uncategorized)"}|${vatRate || 0}`;
    if (!categoryVatMap.has(catKey)) {
      categoryVatMap.set(catKey, {
        category: category || "(uncategorized)",
        vatRate: vatRate || 0,
        products: new Set(),
        totalRevenue: 0,
        vatAmount: 0
      });
    }
    const cv = categoryVatMap.get(catKey);
    cv.products.add(productKey);
    cv.totalRevenue += price;
    const priceHt = price / (1 + (vatRate || 0) / 100);
    cv.vatAmount += price - priceHt;

    totalRevenue.value += price;

    // --- Hourly patterns ---
    const hKey = `${dayOfWeek}|${hour}`;
    if (!hourlyMap.has(hKey)) {
      hourlyMap.set(hKey, {
        dayOfWeek,
        dayName: DAY_NAMES[dayOfWeek] || String(dayOfWeek),
        hour,
        revenue: 0
      });
    }
    hourlyMap.get(hKey).revenue += price;
  }

  // --- Build monthlyStats output ---
  const monthlyStats = {
    year,
    source: "transactions",
    products: [...productMonthly.values()].map((pm) => {
      const monthly = [];
      let totalQuantity = 0;
      let totalRevenue = 0;
      for (let m = 1; m <= 12; m++) {
        const d = pm.months.get(m) || { quantity: 0, revenue: 0 };
        totalQuantity += d.quantity;
        totalRevenue += d.revenue;
        monthly.push({ month: m, quantity: d.quantity, revenue: round2(d.revenue) });
      }
      return {
        key: pm.key,
        rawName: pm.rawName,
        category: pm.category,
        monthly,
        totalQuantity,
        totalRevenue: round2(totalRevenue)
      };
    })
  };

  // --- Build annualStats output ---
  const annualStats = {
    year,
    source: "transactions",
    products: [...productAnnual.values()].map((pa) => ({
      key: pa.key,
      rawName: pa.rawName,
      quantity: pa.quantity,
      revenue: round2(pa.revenue),
      category: pa.category
    })),
    refunds: []
  };

  // --- Build categoryMix output ---
  const grandTotal = totalRevenue.value;
  const categoryMix = {
    year,
    source: "transactions",
    categories: [...categoryVatMap.values()].map((cv) => {
      const revenueExclVat = round2(cv.totalRevenue - cv.vatAmount);
      return {
        category: cv.category,
        vatRate: cv.vatRate,
        productCount: cv.products.size,
        totalRevenue: round2(cv.totalRevenue),
        share: grandTotal > 0 ? round2((cv.totalRevenue / grandTotal) * 100) : 0,
        revenueExclVat,
        vatAmount: round2(cv.vatAmount)
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue)
  };

  // --- Build hourlyPatterns output ---
  const hourlyPatterns = {
    year,
    source: "transactions",
    entries: [...hourlyMap.values()].map((e) => ({
      dayOfWeek: e.dayOfWeek,
      dayName: e.dayName,
      hour: e.hour,
      revenue: round2(e.revenue)
    })).sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.hour - b.hour)
  };

  return { monthlyStats, annualStats, categoryMix, hourlyPatterns };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
