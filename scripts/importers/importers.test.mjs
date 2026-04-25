import assert from 'node:assert/strict';
import { importHourlyPatterns } from './hourly-patterns.mjs';
import { importAnnualStats } from './annual-stats.mjs';
import { importCategoryMix } from './category-mix.mjs';
import { importMargins } from './margins.mjs';
import { importTransactions } from './transactions.mjs';

// --- importHourlyPatterns ---

// Normal: two valid rows
const normalCsv = "JOUR;HEURE;TOTAL;TOTAL\njeudi;10;2635,13;2635,13\nlundi;9;1200,00;1200,00\n";
const normal = importHourlyPatterns(normalCsv, "hourly-2025.csv");
assert.equal(normal.type, "hourly-by-weekday");
assert.equal(normal.year, 2025);
assert.equal(normal.entries.length, 2);
assert.equal(normal.entries[0].dayOfWeek, 4); // jeudi = 4
assert.equal(normal.entries[0].hour, 10);
assert.equal(normal.entries[0].revenue, 2635.13);
assert.equal(normal.entries[1].dayName, "lundi");

// NaN hour guard: blank hour column must be skipped, not stored as NaN
const blankHourCsv = "JOUR;HEURE;TOTAL;TOTAL\njeudi;;2635,13;2635,13\njeudi;10;1000,00;1000,00\n";
const blankHour = importHourlyPatterns(blankHourCsv, "2025.csv");
assert.equal(blankHour.entries.length, 1, "row with blank hour should be skipped");
assert.equal(blankHour.entries[0].hour, 10);
assert.ok(Number.isFinite(blankHour.entries[0].hour), "stored hour must be a finite number");

// Non-numeric hour must also be skipped
const badHourCsv = "JOUR;HEURE;TOTAL;TOTAL\njeudi;AM;2635,13;2635,13\njeudi;11;500,00;500,00\n";
const badHour = importHourlyPatterns(badHourCsv, "2025.csv");
assert.equal(badHour.entries.length, 1, "row with non-numeric hour should be skipped");

// Unknown day name: row should be skipped silently
const unknownDayCsv = "JOUR;HEURE;TOTAL;TOTAL\nfriday;10;500,00;500,00\n";
const unknownDay = importHourlyPatterns(unknownDayCsv, "2025.csv");
assert.equal(unknownDay.entries.length, 0);

// File too short
const tooShort = importHourlyPatterns("JOUR;HEURE;TOTAL;TOTAL\n", "2025.csv");
assert.equal(tooShort.entries.length, 0);
assert.ok(tooShort.warnings.length > 0);

// --- importAnnualStats ---

const annualCsv = [
  "ART;QUANTITE;CHIFF_AFF;EAN_MAX_DE_LA_PERIODE;TRI;CAT;CAT",
  "BRIE DE MEAUX;150;1800,00;1234567890;1;FROMAGE;FROMAGE",
  "REMB BRIE DE MEAUX;-5;-60,00;;;;"
].join("\n");
const annual = importAnnualStats(annualCsv, "export-stat-vente-2025.csv");
assert.equal(annual.type, "annual-stats");
assert.equal(annual.year, 2025);
assert.equal(annual.products.length, 1);
assert.equal(annual.products[0].key, "BRIE DE MEAUX");
assert.equal(annual.products[0].quantity, 150);
assert.equal(annual.products[0].revenue, 1800);
assert.equal(annual.refunds.length, 1);
assert.equal(annual.refunds[0].key, "BRIE DE MEAUX");
assert.equal(annual.refunds[0].quantity, 5); // absolute value

// Junk rows are skipped
const annualWithJunk = "ART;QUANTITE;CHIFF_AFF;EAN;TRI;CAT;CAT\nTotal;1000;5000;;;\nMARGUERITE;20;100;;;;\n";
const annualJunk = importAnnualStats(annualWithJunk, "2025.csv");
assert.equal(annualJunk.products.length, 1);
assert.equal(annualJunk.products[0].key, "MARGUERITE");

// --- importCategoryMix ---

const catCsv = [
  "categorie_tva;Nb_produits;Total_CA;;;;;",
  "01. FRUIT ET LEGUME 6%;30796;89639,81;17,69 %; 6;84565,86;5073,95;5073,95",
  "02. FRA 21%;100;5000,00;1,00 %; 21;4132,23;867,77;867,77"
].join("\n");
const cat = importCategoryMix(catCsv, "sta-ratioCAT-2025.csv");
assert.equal(cat.type, "category-mix");
assert.equal(cat.year, 2025);
assert.equal(cat.categories.length, 2);
assert.equal(cat.categories[0].category, "01. FRUIT ET LEGUME");
assert.equal(cat.categories[0].vatRate, 6);
assert.equal(cat.categories[0].totalRevenue, 89639.81);
assert.ok(Math.abs(cat.categories[0].share - 17.69) < 0.01);

// TYPO_FIXES: "02. FRA" → "02. FROMAGE"
assert.equal(cat.categories[1].category, "02. FROMAGE");

// --- importMargins ---

// Data rows have one leading semicolon (name at cols[1]), matching the real CSV format:
//   ;;Total vente tvac;...   ← header (two leading empties)
//   ;PRODUCT NAME;...        ← data (one leading empty, name at cols[1])
const marginCsv = [
  ";;Total vente tvac;Total vente ht;Total achat ht;Marge ht;Ratio ht;;;;",
  ";BRIE DE MEAUX;1200,00;1000,00;850,00;150,00;1,18;;;;",
  "; #ACOMPTE;500,00;420,00;390,00;30,00;1,08;;;;" // junk — should be skipped
].join("\n");
const margins = importMargins(marginCsv, "analyse-2025.csv");
assert.equal(margins.type, "margin-analysis");
assert.equal(margins.year, 2025);
assert.equal(margins.margins.length, 1);
assert.equal(margins.margins[0].key, "BRIE DE MEAUX");
assert.equal(margins.margins[0].salesTtc, 1200);
assert.equal(margins.margins[0].purchaseHt, 850);

// marginRatio: salesHt / purchaseHt = 1000 / 850 ≈ 1.18
assert.ok(margins.margins[0].marginRatio > 0);

// zero-row guard: all-zero financials are skipped
const allZeroCsv = ";;Total vente tvac;Total vente ht;Total achat ht;Marge ht;Ratio ht;;;;\n;GHOST;0;0;0;0;0;;;;\n;REAL;100;80;60;20;1.33;;;;\n";
const zeroGuard = importMargins(allZeroCsv, "2025.csv");
assert.equal(zeroGuard.margins.length, 1);
assert.equal(zeroGuard.margins[0].key, "REAL");

// --- importTransactions ---

const txCsv = [
  "Expr1000;article;tva;prix;categorie;EAN;temporaire8;temporaire8",
  "10-03-25 10:30;(1360g/2,3€Kg)POTIMARRON BIO;6;3,13;FRUIT ET LEGUME;123456;MC/BC;",
  "10-03-25 11:00;BRIE DE MEAUX;6;4,50;FROMAGE;654321;CASH;"
].join("\n");
const tx = importTransactions(txCsv, "transactions-2025.csv");
assert.equal(tx.type, "transactions");
assert.equal(tx.year, 2025);
assert.equal(tx.transactions.length, 2);
// Weighed item: weightKg extracted, stored as quantity
assert.equal(tx.transactions[0].rawName, "POTIMARRON BIO");
assert.ok(Math.abs(tx.transactions[0].quantity - 1.360) < 0.001);
assert.equal(tx.transactions[0].paymentMethod, "card");
assert.equal(tx.transactions[0].date, "2025-03-10");
assert.equal(tx.transactions[0].hour, 10);
// Unit item: quantity is null (aggregator defaults to 1)
assert.equal(tx.transactions[1].quantity, null);
assert.equal(tx.transactions[1].paymentMethod, "cash");

// Unparseable timestamp: warning logged, row skipped
const badTsCsv = "Expr1000;article;tva;prix;categorie;EAN;pay;\nBADTS;BRIE;6;4,50;FROM;123;CASH;\n10-03-25 10:00;GOOD;6;4,50;FROM;123;CASH;\n";
const badTs = importTransactions(badTsCsv, "2025.csv");
assert.equal(badTs.transactions.length, 1);
assert.ok(badTs.warnings.some(w => w.includes("Unparseable")));

console.log("importers: all tests passed");
