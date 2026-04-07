import {
  splitCsvLines, splitCsvRow, parseEuroDecimal, normalizeKey, isJunkRow,
  detectYearFromFilename
} from '../lib/csv-utils.mjs';

/**
 * Header: ART;QUANTITE;CHIFF_AFF;EAN_MAX_DE_LA_PERIODE;TRI;CAT;CAT
 */
export function importAnnualStats(text, filename) {
  const lines = splitCsvLines(text);
  if (lines.length < 2) return { type: "annual-stats", year: null, products: [], refunds: [], warnings: ["File too short"] };

  const dataRows = lines.slice(1);
  const year = filename ? detectYearFromFilename(filename) : null;
  const warnings = [];
  const products = [];
  const refunds = [];

  for (const line of dataRows) {
    const cols = splitCsvRow(line);
    const name = (cols[0] || "").trim();
    if (!name || isJunkRow(name)) continue;

    const quantity = parseEuroDecimal(cols[1]);
    const revenue = parseEuroDecimal(cols[2]);
    const ean = (cols[3] || "").trim();
    const category = (cols[6] || cols[5] || "").trim();

    if (name.startsWith("REMB ")) {
      refunds.push({
        key: normalizeKey(name.slice(5)),
        rawName: name.slice(5).trim(),
        quantity: Math.abs(quantity),
        revenue: Math.abs(revenue)
      });
      continue;
    }

    products.push({
      key: normalizeKey(name),
      rawName: name,
      quantity,
      revenue,
      ean,
      category
    });
  }

  if (refunds.length > 0) {
    warnings.push(`${refunds.length} refund rows (REMB) separated`);
  }

  return { type: "annual-stats", year, products, refunds, warnings };
}

