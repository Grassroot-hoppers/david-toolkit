/**
 * Unit tests for importer modules.
 * Covers: annual-stats, margins, category-mix, hourly-patterns
 */
import assert from 'node:assert/strict';
import { importAnnualStats } from '../importers/annual-stats.mjs';
import { importMargins } from '../importers/margins.mjs';
import { importCategoryMix } from '../importers/category-mix.mjs';
import { importHourlyPatterns } from '../importers/hourly-patterns.mjs';

// ── annual-stats ──────────────────────────────────────────────────────────────

{
  const header = 'ART;QUANTITE;CHIFF_AFF;EAN_MAX_DE_LA_PERIODE;TRI;CAT;CAT\n';
  const rows = [
    'BRIE DE MEAUX;120;450,00;1234567890123;1;FROMAGE;FROMAGE\n',
    'REMB BRIE DE MEAUX;-5;-18,75;1234567890123;1;FROMAGE;FROMAGE\n',
    'total\n',
    '\n',
  ].join('');

  const result = importAnnualStats(header + rows, 'export-stat-vente-2025.csv');
  assert.equal(result.type, 'annual-stats');
  assert.equal(result.year, 2025);
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].key, 'BRIE DE MEAUX');
  assert.equal(result.products[0].quantity, 120);
  assert.equal(result.products[0].revenue, 450);
  assert.equal(result.refunds.length, 1);
  assert.equal(result.refunds[0].key, 'BRIE DE MEAUX');
  assert.equal(result.refunds[0].quantity, 5);
  assert.equal(result.warnings.length, 1); // refund warning
}

// year fallback when filename has no year
{
  const header = 'ART;QUANTITE;CHIFF_AFF;EAN_MAX_DE_LA_PERIODE;TRI;CAT;CAT\n';
  const result = importAnnualStats(header + 'CAMEMBERT;10;30,00;;;;\n', 'no-year.csv');
  assert.equal(result.year, null);
}

// too short
{
  const result = importAnnualStats('', 'test.csv');
  assert.equal(result.products.length, 0);
  assert.ok(result.warnings[0].includes('short'));
}

// ── margins ───────────────────────────────────────────────────────────────────

{
  const header = ';;Total vente tvac;Total vente ht;Total achat ht;Marge ht;Ratio ht;;;;\n';
  const rows = [
    ';;1200,00;1000,00;700,00;300,00;1,43;;;\n',  // no product name → skip
    ';COMTÉ;1200,00;1000,00;700,00;300,00;1,43;;;\n',
    ';COMTÉ;600,00;500,00;350,00;150,00;1,43;;;\n', // same product — aggregated
    ';#ACOMPTE;100,00;80,00;60,00;20,00;1,33;;;\n', // junk → skip
    ';Designed by;0;0;0;0;0;;;\n',                  // junk → skip
  ].join('');

  const result = importMargins(header + rows, 'margins-2025.csv');
  assert.equal(result.type, 'margin-analysis');
  assert.equal(result.year, 2025);
  assert.equal(result.margins.length, 1);
  const m = result.margins[0];
  assert.equal(m.key, 'COMTE');
  assert.equal(m.salesTtc, 1800);
  assert.equal(m.salesHt, 1500);
  assert.equal(m.purchaseHt, 1050);
  assert.equal(m.transactionCount, 2);
  assert.ok(m.marginRatio > 0);
}

// purchaseHt === 0 → marginRatio should be 0
{
  const header = ';;Total vente tvac;Total vente ht;Total achat ht;Marge ht;Ratio ht;;;;\n';
  const result = importMargins(header + ';PAIN;100,00;80,00;0;80,00;0;;;\n', 'margins.csv');
  assert.equal(result.margins[0].marginRatio, 0);
}

// ── category-mix ──────────────────────────────────────────────────────────────

{
  const header = 'categorie_tva;Nb_produits;Total_CA;;;;;\n';
  const rows = [
    '01. FRUIT ET LEGUME 6%;30796;89639,81;17,69 %; 6;84565,86;5073,95;5073,95\n',
    '02. FRA 21%;12;3000,00;5,00 %;21;2500,00;500,00;500,00\n', // typo fix
    'total\n',
  ].join('');

  const result = importCategoryMix(header + rows, 'sta-ratioCAT-2025.csv');
  assert.equal(result.type, 'category-mix');
  assert.equal(result.year, 2025);
  assert.equal(result.categories.length, 2);

  const fruit = result.categories[0];
  assert.equal(fruit.category, '01. FRUIT ET LEGUME');
  assert.equal(fruit.vatRate, 6);
  assert.equal(fruit.totalRevenue, 89639.81);

  // typo fix: "02. FRA" → "02. FROMAGE"
  const fromage = result.categories[1];
  assert.equal(fromage.category, '02. FROMAGE');
  assert.equal(fromage.vatRate, 21);
}

// pure VAT row "0%" → uncategorized
{
  const header = 'categorie_tva;Nb_produits;Total_CA;;;;;\n';
  const result = importCategoryMix(header + '0%;5;500,00;1 %;0;480,00;20,00;20,00\n', 'cat-2024.csv');
  assert.equal(result.categories[0].category, '(uncategorized)');
  assert.equal(result.categories[0].vatRate, 0);
}

// ── hourly-patterns ───────────────────────────────────────────────────────────

{
  const header = 'JOUR;HEURE;TOTAL;TOTAL\n';
  const rows = [
    'jeudi;10;2635,13;2635,13\n',
    'samedi;11;4120,00;4120,00\n',
    'unknownday;9;100,00;100,00\n', // unknown day → skip
  ].join('');

  const result = importHourlyPatterns(header + rows, 'hourly-2025.csv');
  assert.equal(result.type, 'hourly-by-weekday');
  assert.equal(result.year, 2025);
  assert.equal(result.entries.length, 2);

  const jeudi = result.entries.find((e) => e.dayName === 'jeudi');
  assert.ok(jeudi);
  assert.equal(jeudi.dayOfWeek, 4);
  assert.equal(jeudi.hour, 10);
  assert.equal(jeudi.revenue, 2635.13);

  const samedi = result.entries.find((e) => e.dayName === 'samedi');
  assert.ok(samedi);
  assert.equal(samedi.dayOfWeek, 6);
}

// empty file
{
  const result = importHourlyPatterns('', 'test.csv');
  assert.equal(result.entries.length, 0);
  assert.ok(result.warnings[0].includes('short'));
}

console.log('importers: all tests passed');
