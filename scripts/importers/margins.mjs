import {
  splitCsvLines, splitCsvRow, parseEuroDecimal, normalizeKey, cleanProductName,
  detectYearFromFilename
} from '../lib/csv-utils.mjs';

const MARGIN_JUNK = /^(#ACOMPTE|Designed by|;\s*$|\s*$)/i;

/**
 * Header: ;;Total vente tvac;Total vente ht;Total achat ht;Marge ht;Ratio ht;;;;
 * Data rows: col[1]=product name, col[2..6]=financials, col[7]=EAN
 */
export function importMargins(text, filename) {
  const lines = splitCsvLines(text);
  if (lines.length < 2) return { type: "margin-analysis", year: null, margins: [], warnings: ["File too short"] };

  const year = filename ? detectYearFromFilename(filename) : null;
  const warnings = [];
  let skipped = 0;
  const aggregated = new Map();

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i]);
    const rawName = (cols[1] || "").trim();

    if (!rawName || rawName === " " || MARGIN_JUNK.test(rawName) || lines[i].startsWith("Designed")) {
      skipped++;
      continue;
    }

    const salesTtc = parseEuroDecimal(cols[2]);
    const salesHt = parseEuroDecimal(cols[3]);
    const purchaseHt = parseEuroDecimal(cols[4]);
    const marginHt = parseEuroDecimal(cols[5]);

    if (salesTtc === 0 && salesHt === 0 && purchaseHt === 0) {
      skipped++;
      continue;
    }

    const cleaned = cleanProductName(rawName);
    const key = normalizeKey(cleaned);

    if (aggregated.has(key)) {
      const existing = aggregated.get(key);
      existing.salesTtc += salesTtc;
      existing.salesHt += salesHt;
      existing.purchaseHt += purchaseHt;
      existing.marginHt += marginHt;
      existing.transactionCount++;
    } else {
      aggregated.set(key, {
        key,
        rawName: cleaned,
        salesTtc,
        salesHt,
        purchaseHt,
        marginHt,
        transactionCount: 1
      });
    }
  }

  const margins = [...aggregated.values()].map((m) => ({
    ...m,
    marginRatio: m.purchaseHt > 0 ? Math.round((m.salesHt / m.purchaseHt) * 100) / 100 : 0
  }));

  if (skipped > 0) warnings.push(`${skipped} junk/zero rows filtered`);
  warnings.push(`Aggregated into ${margins.length} products`);

  return { type: "margin-analysis", year, margins, warnings };
}

