/**
 * Unit tests for importers — covering fixed bugs and key data paths.
 */
import assert from 'node:assert/strict';
import { importHourlyPatterns } from './hourly-patterns.mjs';
import { importMonthlyStats } from './monthly-stats.mjs';

// ── importHourlyPatterns ──────────────────────────────────────────────────────

// Normal row
const hourlyNormal = `JOUR;HEURE;TOTAL;TOTAL
jeudi;10;2635,13;2635,13
samedi;14;4100,00;4100,00`;
const hourlyResult = importHourlyPatterns(hourlyNormal, 'sta-satvente-2025.csv');
assert.equal(hourlyResult.year, 2025);
assert.equal(hourlyResult.entries.length, 2);
assert.equal(hourlyResult.entries[0].hour, 10);
assert.equal(hourlyResult.entries[0].dayOfWeek, 4); // jeudi = 4
assert.equal(hourlyResult.entries[1].revenue, 4100);

// Bug fix: row with missing/invalid hour must be silently skipped (was NaN before fix)
const hourlyBadHour = `JOUR;HEURE;TOTAL;TOTAL
lundi;;500,00;500,00
mardi;abc;300,00;300,00
mercredi;9;200,00;200,00`;
const hourlyBadResult = importHourlyPatterns(hourlyBadHour, 'test.csv');
assert.equal(hourlyBadResult.entries.length, 1, 'rows with missing/invalid hour should be skipped');
assert.equal(hourlyBadResult.entries[0].dayName, 'mercredi');
assert.equal(hourlyBadResult.entries[0].hour, 9);

// Unknown day name skipped
const hourlyUnknownDay = `JOUR;HEURE;TOTAL;TOTAL
unknown;10;100,00;100,00
vendredi;11;500,00;500,00`;
const hourlyUnknown = importHourlyPatterns(hourlyUnknownDay, 'test.csv');
assert.equal(hourlyUnknown.entries.length, 1);
assert.equal(hourlyUnknown.entries[0].dayName, 'vendredi');

// Empty file
const hourlyEmpty = importHourlyPatterns('JOUR;HEURE;TOTAL;TOTAL', 'test.csv');
assert.equal(hourlyEmpty.entries.length, 0);

// ── importMonthlyStats ────────────────────────────────────────────────────────

const monthlyHeader = ';id;libelle;famille;type;C3;STOCK;IDINTERN;categorie;conditionnement;PRIXACHAT;PRIX;TotQut;Magas;TotCA.;25_01;25_02;25_03;25_04;25_05;25_06;25_07;25_08;25_09;25_10;25_11;25_12';
const monthlyDataRow = ';1;BRIE DE MEAUX;FROMAGER;FROMAGE;FR;5;;FROMAGE;0;8,50;12,00;100;2;1200;10 (120);8 (96);12 (144);0;0;0;0;0;0;0;0;0';
const monthlyJunkRow = ';99;total;;;;;0;;;;;;1000;1;10000;50 (600);0;0;0;0;0;0;0;0;0;0;0';
const monthlyNbClient = ';98;NBClient;;;;;0;;;;;;0;1;0;5 (0);0;0;0;0;0;0;0;0;0;0;0';

// Normal import
const monthlyText = [monthlyHeader, monthlyDataRow].join('\n');
const monthlyResult = importMonthlyStats(monthlyText, 'stat-2025.csv');
assert.equal(monthlyResult.year, 2025);
assert.equal(monthlyResult.products.length, 1);
assert.equal(monthlyResult.products[0].key, 'BRIE DE MEAUX');
assert.equal(monthlyResult.products[0].monthly.length, 12);

// Bug fix: junk rows (total, NBClient) must be filtered out
const monthlyWithJunk = [monthlyHeader, monthlyDataRow, monthlyJunkRow, monthlyNbClient].join('\n');
const monthlyJunkResult = importMonthlyStats(monthlyWithJunk, 'stat-2025.csv');
assert.equal(monthlyJunkResult.products.length, 1, '"total" and "NBClient" rows should be filtered by isJunkRow');
assert.equal(monthlyJunkResult.products[0].key, 'BRIE DE MEAUX');

// Empty libelle skipped
const monthlyEmptyName = [monthlyHeader, ';2;;FOURNISSEUR;TYPE;FR;0;;CAT;0;0;0;0;1;0;0;0;0;0;0;0;0;0;0;0;0'].join('\n');
const monthlyEmptyResult = importMonthlyStats(monthlyEmptyName, 'stat-2025.csv');
assert.equal(monthlyEmptyResult.products.length, 0);

// File too short
const monthlyShort = importMonthlyStats('', 'stat-2025.csv');
assert.equal(monthlyShort.products.length, 0);
assert.ok(monthlyShort.warnings.length > 0);

console.log('importers: all tests passed');
