import assert from 'node:assert/strict';
import { importMonthlyStats } from './monthly-stats.mjs';

const HEADER = ';id;libelle;famille;type;C3;STOCK;IDINTERN;categorie;conditionnement;PRIXACHAT;PRIX;TotQut;Magas;TotCA.;26_01;26_02';

// Normal product row
const BRIE_ROW = ';42;Brie de Meaux;FERM;fromagé;FR;5;INT001;FROMAGE;1;3,5;8,9;120;0;1068;30 (267,0);25 (222,5)';

// Junk rows that must be filtered
const TOTAL_ROW   = ';99;Total;;;;;;;;;;;;;';
const NB_ROW      = ';98;NbClient;;;;;;;;;;;;;';
const MOY_ROW     = ';97;Moyenne par client;;;;;;;;;;;;;';
const FICTIF_ROW  = ';96;Fictif;;;;;;;;;;;;;';
const ACOMPTE_ROW = ';95;#ACOMPTE;;;;;;;;;;;;;';

// --- Baseline: one normal product, no junk ---
{
  const text = [HEADER, BRIE_ROW].join('\n');
  const result = importMonthlyStats(text, 'stat-2026.csv');
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].key, 'BRIE DE MEAUX');
  assert.equal(result.year, 2026);
}

// --- Junk rows are silently dropped ---
{
  const text = [HEADER, BRIE_ROW, TOTAL_ROW, NB_ROW, MOY_ROW, FICTIF_ROW, ACOMPTE_ROW].join('\n');
  const result = importMonthlyStats(text, 'stat-2026.csv');
  assert.equal(result.products.length, 1, `Expected 1 product, got ${result.products.length}`);
  assert.equal(result.products[0].key, 'BRIE DE MEAUX');
}

// --- Empty libelle rows are dropped ---
{
  const emptyRow = ';;;;;;;;;;;;;;;';
  const text = [HEADER, BRIE_ROW, emptyRow].join('\n');
  const result = importMonthlyStats(text, 'stat-2026.csv');
  assert.equal(result.products.length, 1);
}

// --- File too short ---
{
  const result = importMonthlyStats('only one line', 'stat-2026.csv');
  assert.equal(result.products.length, 0);
  assert.ok(result.warnings.length > 0);
}

console.log('monthly-stats: all tests passed');
