import {
  splitCsvLines, splitCsvRow, parseEuroDecimal, parseMonthlyCell, normalizeKey
} from '../lib/csv-utils.mjs';

/**
 * Header: ;id;libelle;famille;type;C3;STOCK;IDINTERN;categorie;conditionnement;PRIXACHAT;PRIX;TotQut;Magas;TotCA.;YY_01;YY_02;...;YY_12
 * Monthly columns contain compound values: "57  (34,2)" = 57 qty, €34.20 revenue
 */
export function importMonthlyStats(text, filename) {
  const lines = splitCsvLines(text);
  if (lines.length < 2) return { type: "monthly-stats", year: null, products: [], warnings: ["File too short"] };

  const header = splitCsvRow(lines[0]);

  const monthlyColRegex = /^(\d{2})_(\d{2})$/;
  const monthlyCols = [];
  let yearPrefix = null;

  for (let i = 0; i < header.length; i++) {
    const match = header[i].match(monthlyColRegex);
    if (match) {
      if (!yearPrefix) yearPrefix = parseInt(match[1], 10);
      monthlyCols.push({ index: i, month: parseInt(match[2], 10) });
    }
  }

  const year = yearPrefix !== null ? 2000 + yearPrefix : null;

  const colIndex = {};
  for (let i = 0; i < header.length; i++) {
    colIndex[header[i].trim()] = i;
  }

  const warnings = [];
  const products = [];

  for (let r = 1; r < lines.length; r++) {
    const cols = splitCsvRow(lines[r]);
    const libelle = (cols[colIndex["libelle"]] || "").trim();
    if (!libelle) continue;

    const monthly = monthlyCols.map(({ month, index }) => {
      const cell = parseMonthlyCell(cols[index]);
      return { month, quantity: cell.quantity, revenue: cell.revenue };
    });

    products.push({
      key: normalizeKey(libelle),
      rawName: libelle,
      internalId: (cols[colIndex["id"]] || "").trim(),
      supplier: (cols[colIndex["famille"]] || "").trim(),
      mainType: (cols[colIndex["type"]] || "").trim(),
      origin: (cols[colIndex["C3"]] || "").trim(),
      stock: parseEuroDecimal(cols[colIndex["STOCK"]]),
      internalRef: (cols[colIndex["IDINTERN"]] || "").trim(),
      category: (cols[colIndex["categorie"]] || "").trim(),
      conditioning: parseEuroDecimal(cols[colIndex["conditionnement"]]),
      purchasePrice: parseEuroDecimal(cols[colIndex["PRIXACHAT"]]),
      salePrice: parseEuroDecimal(cols[colIndex["PRIX"]]),
      totalQuantity: parseEuroDecimal(cols[colIndex["TotQut"]]),
      totalRevenue: parseEuroDecimal(cols[colIndex["TotCA."]]),
      monthly
    });
  }

  return { type: "monthly-stats", year, products, warnings };
}
