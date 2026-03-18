/**
 * Unit tests for importer edge cases.
 * Covers data-integrity fixes: date rollover, invalid hours, and CSV edge cases.
 */
import assert from 'node:assert/strict';
import { importTransactions } from './transactions.mjs';
import { importHourlyPatterns } from './hourly-patterns.mjs';

// --- importTransactions: date rollover rejection ---
// Feb 30 is not a real date; JS silently rolls it over to Mar 2.
// After the fix, parseTimestamp returns null and the row is skipped.
const CSV_HEADER = 'Expr1000;article;tva;prix;categorie;EAN;temporaire8;temporaire8';
const invalidDateCsv = `${CSV_HEADER}\n30-02-25 10:30;BRIE DE MEAUX;6;4,50;FROMAGE;123;;`;
const invalidDateResult = importTransactions(invalidDateCsv, 'test-2025.csv');
assert.equal(invalidDateResult.transactions.length, 0, 'rolled-over date must be rejected');
assert.ok(
  invalidDateResult.warnings.some(w => w.includes('30-02-25')),
  'warning must mention the bad timestamp'
);

// --- importTransactions: valid transaction passes through ---
const validCsv = `${CSV_HEADER}\n10-03-25 10:30;BRIE DE MEAUX;6;4,50;FROMAGE;123;;`;
const validResult = importTransactions(validCsv, 'test-2025.csv');
assert.equal(validResult.transactions.length, 1, 'valid row must be imported');
assert.equal(validResult.transactions[0].price, 4.5);
assert.equal(validResult.transactions[0].vatRate, 6);
assert.equal(validResult.year, 2025);
assert.equal(validResult.transactions[0].date, '2025-03-10');
assert.equal(validResult.transactions[0].dayOfWeek, 1); // Monday

// --- importTransactions: empty file ---
const emptyResult = importTransactions('', 'empty.csv');
assert.equal(emptyResult.transactions.length, 0);
assert.ok(emptyResult.warnings.length > 0);

// --- importTransactions: row with missing timestamp is skipped ---
const missingTsCsv = `${CSV_HEADER}\n;BRIE DE MEAUX;6;4,50;FROMAGE;123;;`;
const missingTsResult = importTransactions(missingTsCsv, 'test.csv');
assert.equal(missingTsResult.transactions.length, 0);

// --- importHourlyPatterns: NaN hour is skipped with a warning ---
const HOURLY_HEADER = 'JOUR;HEURE;TOTAL;TOTAL';
const nanHourCsv = `${HOURLY_HEADER}\nlundi;;500,00;500,00\nmardi;10;300,00;300,00`;
const nanHourResult = importHourlyPatterns(nanHourCsv, 'test-2025.csv');
assert.equal(nanHourResult.entries.length, 1, 'NaN hour row must be skipped');
assert.equal(nanHourResult.entries[0].dayOfWeek, 2, 'only mardi row survives');
assert.ok(nanHourResult.warnings.length > 0, 'warning must be emitted for bad hour');

// --- importHourlyPatterns: out-of-range hour (>23) is skipped with a warning ---
const outOfRangeCsv = `${HOURLY_HEADER}\nlundi;99;500,00;500,00\nmercredi;14;200,00;200,00`;
const outOfRangeResult = importHourlyPatterns(outOfRangeCsv, 'test-2025.csv');
assert.equal(outOfRangeResult.entries.length, 1, 'hour 99 must be skipped');
assert.equal(outOfRangeResult.entries[0].hour, 14);
assert.ok(outOfRangeResult.warnings.some(w => w.includes('99')));

// --- importHourlyPatterns: valid data passes through ---
const validHourlyCsv = `${HOURLY_HEADER}\njeudi;10;2635,13;2635,13\nvendredi;14;1200,00;1200,00`;
const validHourlyResult = importHourlyPatterns(validHourlyCsv, 'test-2025.csv');
assert.equal(validHourlyResult.entries.length, 2);
assert.equal(validHourlyResult.entries[0].dayOfWeek, 4); // jeudi
assert.equal(validHourlyResult.entries[0].hour, 10);
assert.equal(validHourlyResult.entries[0].revenue, 2635.13);

console.log('importers: all tests passed');
