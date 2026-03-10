import { splitCsvLines, splitCsvRow, parseEuroDecimal, normalizeKey } from '../lib/csv-utils.mjs';

/**
 * No header row. 74 columns, semicolon-delimited, positional.
 *
 * col 0-1: empty (leading ;;)
 * col 2:   EAN / internal ID
 * col 3:   product name
 * col 4:   sale price
 * col 5:   stock level (can be negative)
 * col 7:   VAT rate (%)
 * col 8:   main category
 * col 9:   supplier / famille
 * col 12:  purchase price
 * col 13:  subcategory
 * col 43:  created date (DD-MM-YY HH:MM:SS)
 * col 44:  last sold date
 * col 49:  BIO label ("BIO" or empty)
 */
export function importProductMaster(text) {
  const lines = splitCsvLines(text);
  const products = [];
  const warnings = [];

  for (const line of lines) {
    const cols = splitCsvRow(line);
    const name = (cols[3] || "").trim();

    if (!name || name.startsWith("LINK EAN")) continue;

    products.push({
      key: normalizeKey(name),
      ean: (cols[2] || "").trim(),
      name,
      salePrice: parseEuroDecimal(cols[4]),
      stock: parseEuroDecimal(cols[5]),
      vatRate: parseEuroDecimal(cols[7]),
      category: (cols[8] || "").trim(),
      supplier: (cols[9] || "").trim(),
      purchasePrice: parseEuroDecimal(cols[12]),
      subcategory: (cols[13] || "").trim(),
      bioLabel: (cols[49] || "").trim(),
      createdDate: (cols[43] || "").trim(),
      lastSoldDate: (cols[44] || "").trim(),
      active: true
    });
  }

  if (products.length === 0) {
    warnings.push("No valid product rows found");
  }

  return { type: "product-master", products, warnings };
}
