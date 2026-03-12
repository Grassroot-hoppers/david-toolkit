import assert from 'node:assert/strict';
import { importHourlyPatterns } from '../importers/hourly-patterns.mjs';
import { importTransactions } from '../importers/transactions.mjs';
import { importAnnualStats } from '../importers/annual-stats.mjs';
import { importCategoryMix } from '../importers/category-mix.mjs';
import { importMargins } from '../importers/margins.mjs';

// --- importHourlyPatterns ---

// Normal row is parsed correctly
{
  const csv = "JOUR;HEURE;TOTAL;TOTAL\njeudi;10;2635,13;2635,13\n";
  const result = importHourlyPatterns(csv, "hourly-2025.csv");
  assert.equal(result.year, 2025);
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].hour, 10);
  assert.equal(result.entries[0].revenue, 2635.13);
  assert.equal(result.entries[0].dayOfWeek, 4);
}

// NaN guard: row with missing hour column is skipped (not emitted as NaN)
{
  const csv = "JOUR;HEURE;TOTAL;TOTAL\njeudi;;100,00;\nlundi;9;50,00;\n";
  const result = importHourlyPatterns(csv, null);
  assert.equal(result.entries.length, 1, "row with empty hour must be skipped");
  assert.equal(result.entries[0].dayOfWeek, 1); // lundi
  assert.equal(result.entries[0].hour, 9);
}

// Unknown day names are silently skipped
{
  const csv = "JOUR;HEURE;TOTAL;TOTAL\nunknownday;10;100,00;\nsamedi;14;200,00;\n";
  const result = importHourlyPatterns(csv, null);
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].dayOfWeek, 6); // samedi
}

// Empty file returns empty entries
{
  const result = importHourlyPatterns("JOUR;HEURE;TOTAL;TOTAL\n", null);
  assert.equal(result.entries.length, 0);
}

// --- importTransactions year fallback ---

// Year is extracted from timestamps when present
{
  const csv = "Expr1000;article;tva;prix;categorie;EAN;temporaire8;temporaire8\n01-03-25 10:30;FROMAGE BRIE;6;4,50;FROMAGE;;;";
  const result = importTransactions(csv, "transactions-2025.csv");
  assert.equal(result.year, 2025);
  assert.equal(result.transactions.length, 1);
}

// Year falls back to filename when all timestamps are unparseable
{
  const csv = "Expr1000;article;tva;prix;categorie;EAN;temporaire8;temporaire8\nBAD_TIMESTAMP;FROMAGE BRIE;6;4,50;FROMAGE;;;";
  const result = importTransactions(csv, "transactions-2024.csv");
  assert.equal(result.year, 2024, "year must fall back to filename when no valid timestamps");
}

// Year is null when neither timestamps nor filename provide one
{
  const csv = "Expr1000;article;tva;prix;categorie;EAN;temporaire8;temporaire8\nBAD_TIMESTAMP;FROMAGE BRIE;6;4,50;FROMAGE;;;";
  const result = importTransactions(csv, "no-year.csv");
  assert.equal(result.year, null);
}

// --- importAnnualStats year from filename ---
{
  const csv = "ART;QUANTITE;CHIFF_AFF;EAN_MAX_DE_LA_PERIODE;TRI;CAT;CAT\nBRIE DE MEAUX;100;450,00;;;FROMAGE;\n";
  const result = importAnnualStats(csv, "stat-vente-2023.csv");
  assert.equal(result.year, 2023);
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].key, "BRIE DE MEAUX");
}

// Refund rows are separated
{
  const csv = "ART;QUANTITE;CHIFF_AFF;EAN_MAX_DE_LA_PERIODE;TRI;CAT;CAT\nREMB BRIE;-2;-9,00;;;;;\n";
  const result = importAnnualStats(csv, "2024.csv");
  assert.equal(result.products.length, 0);
  assert.equal(result.refunds.length, 1);
  assert.equal(result.refunds[0].rawName, "BRIE");
  assert.equal(result.refunds[0].quantity, 2);
}

// --- importCategoryMix year from filename ---
{
  const csv = "categorie_tva;Nb_produits;Total_CA;;;;;\n01. FRUIT ET LEGUME 6%;30796;89639,81;17,69 %; 6;84565,86;5073,95;5073,95\n";
  const result = importCategoryMix(csv, "sta-ratioCAT-2025.csv");
  assert.equal(result.year, 2025);
  assert.equal(result.categories.length, 1);
  assert.equal(result.categories[0].category, "01. FRUIT ET LEGUME");
  assert.equal(result.categories[0].vatRate, 6);
}

// --- importMargins year from filename ---
{
  const csv = ";;Total vente tvac;Total vente ht;Total achat ht;Marge ht;Ratio ht;;;;\n;BRIE DE MEAUX;450,00;400,00;250,00;150,00;1,60;;;;;\n";
  const result = importMargins(csv, "margins-2024.csv");
  assert.equal(result.year, 2024);
  assert.equal(result.margins.length, 1);
  assert.equal(result.margins[0].rawName, "BRIE DE MEAUX");
  assert.ok(result.margins[0].marginRatio > 0, "marginRatio must be computed");
}

// marginRatio is 0 when purchaseHt is 0 (division-by-zero guard)
{
  const csv = ";;Total vente tvac;Total vente ht;Total achat ht;Marge ht;Ratio ht;;;;\n;GRATIS;10,00;8,00;0;8,00;0;;;;;\n";
  const result = importMargins(csv, null);
  assert.equal(result.margins[0].marginRatio, 0, "marginRatio must be 0 when purchaseHt is 0");
}

console.log("importers: all tests passed");
