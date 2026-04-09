import assert from 'node:assert/strict';
import { importMonthlyStats } from './monthly-stats.mjs';

// --- Minimal valid header for a 2-month window ---
const HEADER = ';id;libelle;famille;type;C3;STOCK;IDINTERN;categorie;conditionnement;PRIXACHAT;PRIX;TotQut;Magas;TotCA.;25_01;25_02';

// --- Helper to build a data row ---
function row(libelle, jan = '10  (5,0)', feb = '20  (10,0)') {
  return `;1;${libelle};FAM;type;;0;REF;FROMAGE;1;2,50;5,00;30;0;15,00;${jan};${feb}`;
}

// --- Normal product is included ---
const normal = importMonthlyStats([HEADER, row('BRIE DE MEAUX')].join('\n'), 'stat-2025.csv');
assert.equal(normal.products.length, 1);
assert.equal(normal.products[0].key, 'BRIE DE MEAUX');
assert.equal(normal.products[0].monthly[0].month, 1);
assert.equal(normal.products[0].monthly[0].quantity, 10);
assert.equal(normal.products[0].monthly[0].revenue, 5);
assert.equal(normal.products[0].monthly[1].revenue, 10);
assert.equal(normal.year, 2025);

// --- Junk rows are filtered ---
const junkNames = ['TOTAL', 'Nbclient', 'Moyenne par client', 'FICTIF', 'CARTE CADEAUX', 'DIV. EAN'];
for (const junk of junkNames) {
  const result = importMonthlyStats([HEADER, row(junk)].join('\n'), 'stat-2025.csv');
  assert.equal(result.products.length, 0, `Expected junk row "${junk}" to be filtered`);
}

// --- Empty libelle is filtered ---
const empty = importMonthlyStats([HEADER, row('')].join('\n'), 'stat-2025.csv');
assert.equal(empty.products.length, 0);

// --- Mixed: valid product among junk rows ---
const mixed = importMonthlyStats(
  [HEADER, row('TOTAL'), row('COMTÉ'), row('Moyenne par client'), row('GRUYÈRE')].join('\n'),
  'stat-2025.csv'
);
assert.equal(mixed.products.length, 2);
assert.ok(mixed.products.some(p => p.key === 'COMTE'));
assert.ok(mixed.products.some(p => p.key === 'GRUYERE'));

// --- File too short ---
const short = importMonthlyStats(HEADER, 'stat-2025.csv');
assert.equal(short.products.length, 0);
assert.equal(short.warnings[0], 'File too short');

// --- Year extracted from header prefix ---
assert.equal(normal.year, 2025);

console.log('monthly-stats importer: all tests passed');
