import {
  splitCsvLines, splitCsvRow, parseEuroDecimal, parsePercentage, isJunkRow
} from '../lib/csv-utils.mjs';

const TYPO_FIXES = {
  "02. FRA": "02. FROMAGE"
};

/**
 * Header: categorie_tva;Nb_produits;Total_CA;;;;;
 * Data:   01. FRUIT ET LEGUME 6%;30796;89639,81;17,69 %; 6;84565,86;5073,95;5073,95
 */
export function importCategoryMix(text, filename) {
  const lines = splitCsvLines(text);
  if (lines.length < 2) return { type: "category-mix", year: null, categories: [], warnings: ["File too short"] };

  const year = filename ? detectYearFromName(filename) : null;
  const warnings = [];
  const categories = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i]);
    const raw = (cols[0] || "").trim();
    if (!raw || isJunkRow(raw)) { skipped++; continue; }

    const { category, vatRate } = parseCategoryVat(raw, cols[4]);

    categories.push({
      category,
      vatRate,
      productCount: parseEuroDecimal(cols[1]),
      totalRevenue: parseEuroDecimal(cols[2]),
      share: parsePercentage(cols[3]),
      revenueExclVat: parseEuroDecimal(cols[5]),
      vatAmount: parseEuroDecimal(cols[6])
    });
  }

  if (skipped > 0) warnings.push(`${skipped} summary/junk rows filtered`);
  return { type: "category-mix", year, categories, warnings };
}

function parseCategoryVat(raw, vatCol) {
  // "01. FRUIT ET LEGUME 6%" → category="01. FRUIT ET LEGUME", vatRate=6
  // "0%" → category="(uncategorized)", vatRate=0
  const vatMatch = raw.match(/^(.+?)\s+(\d+)%$/);
  let category, vatRate;

  if (vatMatch) {
    category = vatMatch[1].trim();
    vatRate = parseInt(vatMatch[2], 10);
  } else {
    const pureVat = raw.match(/^\s*(\d+)%$/);
    if (pureVat) {
      category = "(uncategorized)";
      vatRate = parseInt(pureVat[1], 10);
    } else {
      category = raw;
      vatRate = parseEuroDecimal(vatCol);
    }
  }

  category = TYPO_FIXES[category] || category;
  return { category, vatRate };
}

function detectYearFromName(filename) {
  const match = String(filename).match(/(\d{4})/);
  return match ? parseInt(match[1], 10) : null;
}
