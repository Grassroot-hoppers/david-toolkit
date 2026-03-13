import assert from 'node:assert/strict';
import { importMonthlyStats } from './monthly-stats.mjs';

// Shared header: ;id;libelle;famille;type;C3;STOCK;IDINTERN;categorie;conditionnement;PRIXACHAT;PRIX;TotQut;Magas;TotCA.;25_01;25_02
const HEADER = ';id;libelle;famille;type;C3;STOCK;IDINTERN;categorie;conditionnement;PRIXACHAT;PRIX;TotQut;Magas;TotCA.;25_01;25_02';
// Valid product row: libelle at col 2, 25_01 at col 15, 25_02 at col 16
const BRIE_ROW  = ';1;BRIE DE MEAUX;FROMAGER;FROMAGE;FR;10;;FROMAGE;1;3,50;6,00;100;;600;10  (60);8  (48)';
const CAMEM_ROW = ';2;CAMEMBERT;FROMAGER;FROMAGE;FR;5;;FROMAGE;1;2,50;5,00;50;;250;4  (20);6  (30)';

// --- File too short ---
const tooShort = importMonthlyStats('', 'stats-2025.csv');
assert.equal(tooShort.products.length, 0);
assert.ok(tooShort.warnings.length > 0);

// --- Year detection from header columns ---
const twoRows = [HEADER, BRIE_ROW].join('\n');
const result = importMonthlyStats(twoRows, 'stats-2025.csv');
assert.equal(result.type, 'monthly-stats');
assert.equal(result.year, 2025);
assert.equal(result.products.length, 1);
assert.equal(result.products[0].key, 'BRIE DE MEAUX');
assert.equal(result.products[0].rawName, 'BRIE DE MEAUX');
assert.equal(result.products[0].category, 'FROMAGE');
assert.equal(result.products[0].monthly.length, 2);
assert.equal(result.products[0].monthly[0].month, 1);
assert.equal(result.products[0].monthly[0].quantity, 10);
assert.equal(result.products[0].monthly[0].revenue, 60);

// --- Junk row filtering (the core fix) ---
// All known junk labels must be dropped; valid rows must survive
const junkCsv = [
  HEADER,
  BRIE_ROW,
  ';;Total;;;;;;;;;;;;;;; ',          // "Total" → junk
  ';;NBClient;;;;;;;;;;;;;; ',         // "NBClient" → junk
  ';;Moyenne par client;;;;;;;;;; ',   // "Moyenne par client" → junk
  ';;Fictif;;;;;;;;;;;;;; ',           // "Fictif" → junk
  ';;#ACOMPTE;;;;;;;;;;;;;; ',         // "#ACOMPTE" → junk
  CAMEM_ROW
].join('\n');

const junkResult = importMonthlyStats(junkCsv, 'stats-2025.csv');
assert.equal(junkResult.products.length, 2, 'junk rows must be filtered, valid rows kept');
assert.equal(junkResult.products[0].key, 'BRIE DE MEAUX');
assert.equal(junkResult.products[1].key, 'CAMEMBERT');

// --- Empty libelle rows skipped ---
const withEmptyLibelle = [HEADER, ';;', BRIE_ROW].join('\n');
const noEmpty = importMonthlyStats(withEmptyLibelle, 'stats-2025.csv');
assert.equal(noEmpty.products.length, 1);

// --- No monthly-column header → year null ---
const noMonthHeader = ';id;libelle;famille\n;1;BRIE DE MEAUX;FROMAGER';
const noYear = importMonthlyStats(noMonthHeader, 'no-year.csv');
assert.equal(noYear.year, null);
assert.equal(noYear.products.length, 1);

// --- Accent handling in product name (UTF-8 normalisation) ---
const accentCsv = [HEADER, ';3;PÂTÉ EN CROÛTE;CHARCUTERIE;;FR;2;;CHARCUTERIE;1;4,00;8,00;30;;240;3  (24);5  (40)'].join('\n');
const accentResult = importMonthlyStats(accentCsv, 'stats-2025.csv');
assert.equal(accentResult.products[0].rawName, 'PÂTÉ EN CROÛTE');
assert.equal(accentResult.products[0].key, 'PATE EN CROUTE'); // normalizeKey strips diacritics

console.log('monthly-stats: all tests passed');
