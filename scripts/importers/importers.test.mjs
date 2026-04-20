import assert from 'node:assert/strict';
import { importMonthlyStats } from './monthly-stats.mjs';

// Header used for all monthly-stats tests
const HEADER = ";id;libelle;famille;type;C3;STOCK;IDINTERN;categorie;conditionnement;PRIXACHAT;PRIX;TotQut;Magas;TotCA.;25_01;25_02;25_03;25_04;25_05;25_06;25_07;25_08;25_09;25_10;25_11;25_12";

// --- File too short ---
const tooShort = importMonthlyStats("", "stat-2025.csv");
assert.equal(tooShort.products.length, 0);
assert.ok(tooShort.warnings.some(w => w.includes("too short")));

// --- Junk rows are filtered, real products are kept ---
const csv = [
  HEADER,
  ";1;Brie de Meaux;Terra;;;0;;FROMAGE;;5,00;8,00;100;;800,00;8  (64,00);0;0;0;0;0;0;0;0;0;0;0",
  ";2;total",     // junk — summary row
  ";3;Nbclient",  // junk — client count row
  ";4;Moyenne par client", // junk — average row
].join("\n");

const result = importMonthlyStats(csv, "stat-2025.csv");
assert.equal(result.products.length, 1, "junk rows (total, nbclient, moyenne) must be filtered");
assert.equal(result.products[0].key, "BRIE DE MEAUX");
assert.equal(result.products[0].category, "FROMAGE");
assert.equal(result.year, 2025);

// --- Year extracted from column header prefix (e.g. "24_01" → 2024) ---
const HEADER_2024 = ";id;libelle;famille;type;C3;STOCK;IDINTERN;categorie;conditionnement;PRIXACHAT;PRIX;TotQut;Magas;TotCA.;24_01;24_02;24_03;24_04;24_05;24_06;24_07;24_08;24_09;24_10;24_11;24_12";
const yearOnly = importMonthlyStats([HEADER_2024, ";1;Gouda"].join("\n"), "ignored.csv");
assert.equal(yearOnly.year, 2024);

// --- Monthly cell parsing survives short rows ---
const shortRow = importMonthlyStats([HEADER, ";1;Comté"].join("\n"), "stat-2025.csv");
assert.equal(shortRow.products.length, 1);
assert.equal(shortRow.products[0].monthly.length, 12);
assert.ok(shortRow.products[0].monthly.every(m => m.quantity === 0 && m.revenue === 0));

console.log("importers: all tests passed");
