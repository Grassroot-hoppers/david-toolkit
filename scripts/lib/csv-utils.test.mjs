import {
  parseEuroDecimal, parseMonthlyCell, parsePercentage,
  cleanProductName, parseProductName, detectFileType, normalizeKey, isJunkRow,
  splitCsvLines, splitCsvRow, detectYearFromFilename
} from './csv-utils.mjs';
import assert from 'node:assert/strict';

// parseEuroDecimal
assert.equal(parseEuroDecimal("12,868"), 12.868);
assert.equal(parseEuroDecimal("1031293,00"), 1031293);
assert.equal(parseEuroDecimal(""), 0);
assert.equal(parseEuroDecimal(null), 0);
assert.equal(parseEuroDecimal(undefined), 0);
assert.equal(parseEuroDecimal("0"), 0);
assert.equal(parseEuroDecimal(" 3,50 "), 3.5);

// parseMonthlyCell
assert.deepEqual(parseMonthlyCell("26  (0)"), { quantity: 26, revenue: 0 });
assert.deepEqual(parseMonthlyCell("7418  (218,88)"), { quantity: 7418, revenue: 218.88 });
assert.deepEqual(parseMonthlyCell(""), { quantity: 0, revenue: 0 });
assert.deepEqual(parseMonthlyCell(null), { quantity: 0, revenue: 0 });

// parsePercentage
assert.equal(parsePercentage("17,69 %"), 17.69);
assert.equal(parsePercentage("0 %"), 0);
assert.equal(parsePercentage(null), 0);

// cleanProductName (backwards-compat wrapper)
assert.equal(cleanProductName("(1360g/2,3€Kg)POTIMARRON BIO"), "POTIMARRON BIO");
assert.equal(cleanProductName("(00106g/34,68€Kg)FILET DE POULET"), "FILET DE POULET");
assert.equal(cleanProductName("BRIE DE MEAUX"), "BRIE DE MEAUX");
assert.equal(cleanProductName("(122g/5,8€Kg)POMME NATYRA BIO"), "POMME NATYRA BIO");

// parseProductName — name + weightKg extraction
assert.deepEqual(parseProductName("(1360g/2,3€Kg)POTIMARRON BIO"), { name: "POTIMARRON BIO", weightKg: 1.360 });
assert.deepEqual(parseProductName("(00106g/34,68€Kg)GRUYERE"), { name: "GRUYERE", weightKg: 0.106 });
assert.deepEqual(parseProductName("(250g)BEURRE"), { name: "BEURRE", weightKg: 0.250 });
assert.deepEqual(parseProductName("CONFITURE FRAISE"), { name: "CONFITURE FRAISE", weightKg: null });
assert.deepEqual(parseProductName("BRIE DE MEAUX"), { name: "BRIE DE MEAUX", weightKg: null });

// detectFileType
assert.equal(
  detectFileType(";id;libelle;famille;type;C3;STOCK;IDINTERN;categorie;conditionnement;PRIXACHAT;PRIX;TotQut;Magas;TotCA.;25_01"),
  "monthly-stats"
);
assert.equal(
  detectFileType("ART;QUANTITE;CHIFF_AFF;EAN_MAX_DE_LA_PERIODE;TRI;CAT;CAT"),
  "annual-stats"
);
assert.equal(
  detectFileType("Expr1000;article;tva;prix;categorie;EAN;temporaire8;temporaire8"),
  "transactions"
);
assert.equal(
  detectFileType("categorie_tva;Nb_produits;Total_CA;;;;;"),
  "category-mix"
);
assert.equal(
  detectFileType(";;Total vente tvac;Total vente ht;Total achat ht;Marge ht;Ratio ht;;;;"),
  "margin-analysis"
);
assert.equal(
  detectFileType("JOUR;HEURE;TOTAL;TOTAL"),
  "hourly-by-weekday"
);

// normalizeKey
assert.equal(normalizeKey("Brie de Meaux"), "BRIE DE MEAUX");
assert.equal(normalizeKey("PÂTÉ EN CROÛTE"), "PATE EN CROUTE");
assert.equal(normalizeKey("  café  latte  "), "CAFE LATTE");

// isJunkRow
assert.equal(isJunkRow("total"), true);
assert.equal(isJunkRow("Nbclient"), true);
assert.equal(isJunkRow("Moyenne par client"), true);
assert.equal(isJunkRow(""), true);
assert.equal(isJunkRow(null), true);
assert.equal(isJunkRow("BRIE DE MEAUX"), false);
assert.equal(isJunkRow("#ACOMPTE"), true);

// splitCsvLines
assert.deepEqual(splitCsvLines("a\nb\nc\n"), ["a", "b", "c"]);
assert.deepEqual(splitCsvLines("a\r\nb\r\n"), ["a", "b"]);

// splitCsvRow
assert.deepEqual(splitCsvRow("a;b;c"), ["a", "b", "c"]);
assert.deepEqual(splitCsvRow("a;b;"), ["a", "b", ""]);

// detectYearFromFilename
assert.equal(detectYearFromFilename("stat-vente-monthly-2025.csv"), 2025);
assert.equal(detectYearFromFilename("margin-analysis-2025-h1.csv"), 2025);
assert.equal(detectYearFromFilename("no-year.csv"), null);

console.log("csv-utils: all tests passed");
