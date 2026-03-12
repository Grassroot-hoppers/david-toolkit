import {
  splitCsvLines, splitCsvRow, parseEuroDecimal, normalizeKey, parseProductName
} from '../lib/csv-utils.mjs';

/**
 * Header: Expr1000;article;tva;prix;categorie;EAN;temporaire8;temporaire8
 * Timestamp: DD-MM-YY HH:MM
 * Payment: [MC/BC] = card, [CASH] = cash
 */
export function importTransactions(text, filename) {
  const lines = splitCsvLines(text);
  if (lines.length < 2) return { type: "transactions", year: null, transactions: [], warnings: ["File too short"] };

  const dataRows = lines.slice(1);
  const warnings = [];
  const transactions = [];
  let year = null;

  for (const line of dataRows) {
    const cols = splitCsvRow(line);
    const rawTimestamp = (cols[0] || "").trim();
    if (!rawTimestamp) continue;

    const rawName = (cols[1] || "").trim();
    if (!rawName) continue;

    const parsed = parseTimestamp(rawTimestamp);
    if (!parsed) {
      warnings.push(`Unparseable timestamp: ${rawTimestamp}`);
      continue;
    }

    if (!year) year = parsed.year;

    const { name: cleaned, weightKg } = parseProductName(rawName);
    const payCol = (cols[6] || "").trim();
    let paymentMethod = "unknown";
    if (payCol.includes("MC/BC") || payCol.includes("MC") || payCol.includes("BC")) {
      paymentMethod = "card";
    } else if (payCol.includes("CASH")) {
      paymentMethod = "cash";
    }

    transactions.push({
      timestamp: parsed.iso,
      date: parsed.date,
      hour: parsed.hour,
      dayOfWeek: parsed.dayOfWeek,
      productKey: normalizeKey(cleaned),
      rawName: cleaned,
      vatRate: parseEuroDecimal(cols[2]),
      price: parseEuroDecimal(cols[3]),
      category: (cols[4] || "").trim(),
      ean: (cols[5] || "").trim(),
      paymentMethod,
      // For weighed items: quantity in kg (e.g. 1.360 for 1360g of cheese).
      // For unit items: null — the aggregator defaults to 1 per transaction line.
      quantity: weightKg
    });
  }

  return { type: "transactions", year, transactions, warnings };
}

function parseTimestamp(raw) {
  // DD-MM-YY HH:MM
  const match = raw.match(/^(\d{2})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const shortYear = parseInt(match[3], 10);
  const hour = parseInt(match[4], 10);
  const minute = parseInt(match[5], 10);
  const year = 2000 + shortYear;

  const pad = (n) => String(n).padStart(2, "0");
  const date = `${year}-${pad(month)}-${pad(day)}`;
  const iso = `${date}T${pad(hour)}:${pad(minute)}:00`;

  // dayOfWeek: 1=Monday ... 7=Sunday (ISO 8601)
  const d = new Date(year, month - 1, day);
  const dow = d.getDay();
  const dayOfWeek = dow === 0 ? 7 : dow;

  return { year, date, iso, hour, dayOfWeek };
}
