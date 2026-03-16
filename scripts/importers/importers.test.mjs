/**
 * Unit tests for the type-specific CSV importers.
 * Covers regressions for:
 *   - hourly-patterns: NaN hour guard (fix: parseInt NaN propagation)
 *   - monthly-stats: negative stock preserved (fix: Math.abs removed)
 *   - annual-stats / margins / category-mix / hourly-patterns: detectYearFromFilename reuse
 */
import assert from 'node:assert/strict';
import { importHourlyPatterns } from './hourly-patterns.mjs';
import { importMonthlyStats } from './monthly-stats.mjs';
import { importAnnualStats } from './annual-stats.mjs';
import { importMargins } from './margins.mjs';
import { importCategoryMix } from './category-mix.mjs';

// ---------------------------------------------------------------------------
// importHourlyPatterns
// ---------------------------------------------------------------------------

// Basic parse: valid rows produce correct entries
{
  const text = [
    'JOUR;HEURE;TOTAL;TOTAL',
    'lundi;10;1234,56;1234,56',
    'samedi;14;500,00;500,00'
  ].join('\n');
  const result = importHourlyPatterns(text, 'hourly-2025.csv');
  assert.equal(result.entries.length, 2);
  assert.equal(result.entries[0].dayOfWeek, 1);
  assert.equal(result.entries[0].hour, 10);
  assert.equal(result.entries[0].revenue, 1234.56);
  assert.equal(result.entries[1].dayOfWeek, 6);
  assert.equal(result.entries[1].hour, 14);
  assert.equal(result.year, 2025);
}

// NaN hour guard: rows with empty or non-numeric hour must be skipped, not produce NaN
{
  const text = [
    'JOUR;HEURE;TOTAL;TOTAL',
    'lundi;;500,00;500,00',       // empty hour
    'mardi;ABC;300,00;300,00',    // non-numeric hour
    'jeudi;9;100,00;100,00'       // valid row
  ].join('\n');
  const result = importHourlyPatterns(text, null);
  assert.equal(result.entries.length, 1, 'invalid-hour rows must be skipped');
  assert.equal(result.entries[0].dayOfWeek, 4);
  assert.equal(result.entries[0].hour, 9);
  // Ensure no NaN slipped through
  for (const e of result.entries) {
    assert.ok(Number.isFinite(e.hour), `hour must be finite, got ${e.hour}`);
  }
}

// Unknown day names are already skipped (existing behaviour, still holds)
{
  const text = [
    'JOUR;HEURE;TOTAL;TOTAL',
    'monday;10;100,00;100,00',   // English — unknown
    'vendredi;11;200,00;200,00'
  ].join('\n');
  const result = importHourlyPatterns(text, null);
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].dayOfWeek, 5);
}

// Year detection via filename
{
  const text = 'JOUR;HEURE;TOTAL;TOTAL\nlundi;8;99,00;99,00\n';
  assert.equal(importHourlyPatterns(text, 'hourly-patterns-2024.csv').year, 2024);
  assert.equal(importHourlyPatterns(text, 'no-year.csv').year, null);
}

// ---------------------------------------------------------------------------
// importMonthlyStats
// ---------------------------------------------------------------------------

// Negative stock is preserved (Math.abs removed)
{
  const text = [
    ';id;libelle;famille;type;C3;STOCK;IDINTERN;categorie;conditionnement;PRIXACHAT;PRIX;TotQut;Magas;TotCA.;25_01;25_02',
    ';001;Brie de Meaux;Fromager;FRM;BE;-5;INT001;FROMAGE;1;8,00;12,50;100;MAIN;1250,00;50  (625,00);50  (625,00)'
  ].join('\n');
  const result = importMonthlyStats(text, 'export-stat-vente-2025.csv');
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].stock, -5, 'negative stock must be preserved, not flipped to positive');
  assert.equal(result.products[0].key, 'BRIE DE MEAUX');
  assert.equal(result.year, 2025);
}

// Positive stock is also still correct
{
  const text = [
    ';id;libelle;famille;type;C3;STOCK;IDINTERN;categorie;conditionnement;PRIXACHAT;PRIX;TotQut;Magas;TotCA.;25_03',
    ';002;Gruyère;Fromager;FRM;CH;12;INT002;FROMAGE;1;6,00;10,00;80;MAIN;800,00;80  (800,00)'
  ].join('\n');
  const result = importMonthlyStats(text, null);
  assert.equal(result.products[0].stock, 12);
}

// ---------------------------------------------------------------------------
// importAnnualStats — year extracted from filename
// ---------------------------------------------------------------------------
{
  const text = [
    'ART;QUANTITE;CHIFF_AFF;EAN_MAX_DE_LA_PERIODE;TRI;CAT;CAT',
    'Brie de Meaux;120;1500,00;3659053400020;1;FROMAGE;FROMAGE'
  ].join('\n');
  const result = importAnnualStats(text, 'analyse-2023.csv');
  assert.equal(result.year, 2023);
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].key, 'BRIE DE MEAUX');
  assert.equal(result.products[0].revenue, 1500);
}

// Refund rows (REMB prefix) are separated
{
  const text = [
    'ART;QUANTITE;CHIFF_AFF;EAN_MAX_DE_LA_PERIODE;TRI;CAT;CAT',
    'Brie;10;100,00;;;FROMAGE;FROMAGE',
    'REMB Brie;2;20,00;;;FROMAGE;FROMAGE'
  ].join('\n');
  const result = importAnnualStats(text, null);
  assert.equal(result.products.length, 1);
  assert.equal(result.refunds.length, 1);
  assert.equal(result.refunds[0].key, 'BRIE');
}

// ---------------------------------------------------------------------------
// importMargins — year extracted from filename
// ---------------------------------------------------------------------------
{
  const text = [
    ';;Total vente tvac;Total vente ht;Total achat ht;Marge ht;Ratio ht;;;;',
    ';Brie de Meaux;1250,00;1041,67;800,00;241,67;1,30;;;'
  ].join('\n');
  const result = importMargins(text, 'margins-2024-h1.csv');
  assert.equal(result.year, 2024);
  assert.equal(result.margins.length, 1);
  assert.ok(result.margins[0].marginRatio > 0);
}

// Zero-value rows are filtered
{
  const text = [
    ';;Total vente tvac;Total vente ht;Total achat ht;Marge ht;Ratio ht;;;;',
    ';Zero Product;0;0;0;0;0;;;'
  ].join('\n');
  const result = importMargins(text, null);
  assert.equal(result.margins.length, 0);
}

// ---------------------------------------------------------------------------
// importCategoryMix — year extracted from filename
// ---------------------------------------------------------------------------
{
  const text = [
    'categorie_tva;Nb_produits;Total_CA;;;;;',
    '01. FRUIT ET LEGUME 6%;100;10000,00;20 %;;9433,96;566,04;566,04'
  ].join('\n');
  const result = importCategoryMix(text, 'sta-ratioCAT-2025.csv');
  assert.equal(result.year, 2025);
  assert.equal(result.categories.length, 1);
  assert.equal(result.categories[0].category, '01. FRUIT ET LEGUME');
  assert.equal(result.categories[0].vatRate, 6);
}

// Typo fix applied
{
  const text = [
    'categorie_tva;Nb_produits;Total_CA;;;;;',
    '02. FRA 6%;50;5000,00;10 %;;4716,98;283,02;283,02'
  ].join('\n');
  const result = importCategoryMix(text, null);
  assert.equal(result.categories[0].category, '02. FROMAGE');
}

console.log('importers: all tests passed');
