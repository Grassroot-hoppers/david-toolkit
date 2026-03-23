/**
 * Unit tests for importer modules.
 * Covers year detection (via detectYearFromFilename), core parsing paths,
 * junk-row filtering, refund separation, and margin guard.
 */
import assert from 'node:assert/strict';
import { importAnnualStats } from './annual-stats.mjs';
import { importTransactions } from './transactions.mjs';
import { importMargins } from './margins.mjs';
import { importCategoryMix } from './category-mix.mjs';
import { importHourlyPatterns } from './hourly-patterns.mjs';

// ── importAnnualStats ─────────────────────────────────────────────────────────

// Year extracted from filename via detectYearFromFilename
{
  const csv = "ART;QUANTITE;CHIFF_AFF;EAN_MAX_DE_LA_PERIODE;TRI;CAT;CAT\nBRIE DE MEAUX;42;189,50;;0;FROMAGE;FROMAGE\n";
  const r = importAnnualStats(csv, "export-stat-vente-2024.csv");
  assert.equal(r.year, 2024, "year from filename");
  assert.equal(r.products.length, 1);
  assert.equal(r.products[0].key, "BRIE DE MEAUX");
  assert.equal(r.products[0].quantity, 42);
  assert.equal(r.products[0].revenue, 189.5);
  assert.equal(r.products[0].category, "FROMAGE");
}

// No filename → year is null
{
  const csv = "ART;QUANTITE;CHIFF_AFF;EAN_MAX_DE_LA_PERIODE;TRI;CAT;CAT\nPAIN;10;25,00\n";
  const r = importAnnualStats(csv, null);
  assert.equal(r.year, null);
}

// Junk rows are filtered
{
  const csv = [
    "ART;QUANTITE;CHIFF_AFF;EAN_MAX_DE_LA_PERIODE;TRI;CAT;CAT",
    "TOTAL;999;9999",
    "NbClient;5;50",
    "BRIE DE MEAUX;1;4,50",
    "#ACOMPTE;2;10",
  ].join("\n") + "\n";
  const r = importAnnualStats(csv, "stats-2025.csv");
  assert.equal(r.products.length, 1, "junk rows filtered");
  assert.equal(r.products[0].key, "BRIE DE MEAUX");
}

// Refund rows (REMB prefix) separated from products
{
  const csv = [
    "ART;QUANTITE;CHIFF_AFF;EAN_MAX_DE_LA_PERIODE;TRI;CAT;CAT",
    "REMB BRIE DE MEAUX;-2;-9,00",
    "CAMEMBERT;5;22,50",
  ].join("\n") + "\n";
  const r = importAnnualStats(csv, "stats-2025.csv");
  assert.equal(r.products.length, 1);
  assert.equal(r.refunds.length, 1);
  assert.equal(r.refunds[0].key, "BRIE DE MEAUX");
  assert.equal(r.refunds[0].quantity, 2, "refund quantity is absolute value");
  assert.equal(r.refunds[0].revenue, 9, "refund revenue is absolute value");
}

// File too short
{
  const r = importAnnualStats("", "stats-2025.csv");
  assert.equal(r.products.length, 0);
  assert.ok(r.warnings.length > 0);
}

// ── importTransactions ────────────────────────────────────────────────────────

// Normal row: parse timestamp, derive dayOfWeek, category, payment method
{
  // 10-03-25 is Monday 10 March 2025
  const csv = [
    "Expr1000;article;tva;prix;categorie;EAN;temporaire8;temporaire8",
    "10-03-25 10:30;Brie de Meaux;6;4,50;FROMAGE;1234567;[MC/BC];",
  ].join("\n") + "\n";
  const r = importTransactions(csv, "transactions-2025.csv");
  assert.equal(r.transactions.length, 1);
  const tx = r.transactions[0];
  assert.equal(tx.date, "2025-03-10");
  assert.equal(tx.hour, 10);
  assert.equal(tx.dayOfWeek, 1, "Monday = 1");
  assert.equal(tx.vatRate, 6);
  assert.equal(tx.price, 4.5);
  assert.equal(tx.category, "FROMAGE");
  assert.equal(tx.paymentMethod, "card");
}

// Unparseable timestamp is skipped with a warning
{
  const csv = [
    "Expr1000;article;tva;prix;categorie;EAN;temporaire8;temporaire8",
    "INVALID;Brie;6;4,50;FROMAGE;;;",
  ].join("\n") + "\n";
  const r = importTransactions(csv, "transactions-2025.csv");
  assert.equal(r.transactions.length, 0);
  assert.ok(r.warnings.some((w) => w.includes("Unparseable")));
}

// Year derived from first valid timestamp
{
  const csv = [
    "Expr1000;article;tva;prix;categorie;EAN;temporaire8;temporaire8",
    "01-01-24 09:00;Pain;0;2,00;BOULANGERIE;;;",
  ].join("\n") + "\n";
  const r = importTransactions(csv, "transactions.csv");
  assert.equal(r.year, 2024);
}

// ── importMargins ─────────────────────────────────────────────────────────────

// Normal row: year from filename, marginRatio computed
{
  const csv = [
    ";;Total vente tvac;Total vente ht;Total achat ht;Marge ht;Ratio ht;;;;",
    ";;4,50;4,25;2,00;2,25;2,125",  // col[1] empty → skipped
    ";Brie de Meaux;4,50;4,25;2,00;2,25;2,125",
  ].join("\n") + "\n";
  const r = importMargins(csv, "margins-2025.csv");
  assert.equal(r.year, 2025);
  assert.equal(r.margins.length, 1);
  assert.equal(r.margins[0].key, "BRIE DE MEAUX");
  assert.equal(r.margins[0].salesHt, 4.25);
  assert.ok(r.margins[0].marginRatio > 0);
}

// purchaseHt === 0 → marginRatio must be 0, not Infinity/NaN (division-by-zero guard)
{
  const csv = [
    ";;Total vente tvac;Total vente ht;Total achat ht;Marge ht;Ratio ht;;;;",
    ";Vidange bouteille;1,00;0,90;0,00;0,90;0",
  ].join("\n") + "\n";
  const r = importMargins(csv, "margins-2025.csv");
  assert.equal(r.margins.length, 1);
  assert.equal(r.margins[0].marginRatio, 0, "purchaseHt=0 → marginRatio=0");
  assert.ok(Number.isFinite(r.margins[0].marginRatio), "marginRatio is finite");
}

// Rows with all zeros are filtered
{
  const csv = [
    ";;Total vente tvac;Total vente ht;Total achat ht;Marge ht;Ratio ht;;;;",
    ";Zero Product;0;0;0;0;0",
    ";Real Product;5,00;4,50;2,00;2,50;2,25",
  ].join("\n") + "\n";
  const r = importMargins(csv, "margins-2025.csv");
  assert.equal(r.margins.length, 1, "all-zero row filtered");
}

// ── importCategoryMix ─────────────────────────────────────────────────────────

// Category + VAT parsed from compound format "01. FRUIT ET LEGUME 6%"
{
  const csv = [
    "categorie_tva;Nb_produits;Total_CA;;;;;",
    "01. FRUIT ET LEGUME 6%;30796;89639,81;17,69 %; 6;84565,86;5073,95;5073,95",
  ].join("\n") + "\n";
  const r = importCategoryMix(csv, "category-2025.csv");
  assert.equal(r.year, 2025);
  assert.equal(r.categories.length, 1);
  assert.equal(r.categories[0].category, "01. FRUIT ET LEGUME");
  assert.equal(r.categories[0].vatRate, 6);
  assert.equal(r.categories[0].productCount, 30796);
}

// Pure VAT row "6%" → category "(uncategorized)"
{
  const csv = [
    "categorie_tva;Nb_produits;Total_CA;;;;;",
    "6%;10;500,00;5 %;6;472,00;28,00;28,00",
  ].join("\n") + "\n";
  const r = importCategoryMix(csv, "cat-2025.csv");
  assert.equal(r.categories[0].category, "(uncategorized)");
  assert.equal(r.categories[0].vatRate, 6);
}

// ── importHourlyPatterns ──────────────────────────────────────────────────────

// Year from filename, dayOfWeek mapping
{
  const csv = [
    "JOUR;HEURE;TOTAL;TOTAL",
    "jeudi;10;2635,13;2635,13",
    "samedi;14;4100,00;4100,00",
  ].join("\n") + "\n";
  const r = importHourlyPatterns(csv, "hourly-2025.csv");
  assert.equal(r.year, 2025);
  assert.equal(r.entries.length, 2);
  assert.equal(r.entries[0].dayName, "jeudi");
  assert.equal(r.entries[0].dayOfWeek, 4);
  assert.equal(r.entries[0].hour, 10);
  assert.equal(r.entries[1].dayOfWeek, 6, "samedi=6");
}

// Unknown day names are skipped
{
  const csv = [
    "JOUR;HEURE;TOTAL;TOTAL",
    "weekend;10;100,00;100,00",
    "lundi;9;500,00;500,00",
  ].join("\n") + "\n";
  const r = importHourlyPatterns(csv, "hourly-2025.csv");
  assert.equal(r.entries.length, 1, "unknown day skipped");
  assert.equal(r.entries[0].dayName, "lundi");
}

console.log("importers: all tests passed");
