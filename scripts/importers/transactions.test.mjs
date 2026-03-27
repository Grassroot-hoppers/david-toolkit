import assert from 'node:assert/strict';
import { importTransactions } from './transactions.mjs';

// Minimal valid CSV header + one data row
function makeCsv(...rows) {
  return ['Expr1000;article;tva;prix;categorie;EAN;temporaire8;temporaire8', ...rows].join('\n');
}

// --- Basic happy path ---
const basicCsv = makeCsv('10-03-25 09:30;BRIE DE MEAUX;6;4,5;FROMAGE;1234567890123;[MC/BC];');
const basic = importTransactions(basicCsv, 'test.csv');
assert.equal(basic.year, 2025);
assert.equal(basic.transactions.length, 1);
assert.equal(basic.transactions[0].date, '2025-03-10');
assert.equal(basic.transactions[0].hour, 9);
assert.equal(basic.transactions[0].price, 4.5);
assert.equal(basic.transactions[0].vatRate, 6);
assert.equal(basic.transactions[0].paymentMethod, 'card');
assert.equal(basic.transactions[0].category, 'FROMAGE');

// --- Year parsing: 2-digit YY pivot ---
// YY < 50 → 2000s
const y24Csv = makeCsv('01-01-24 10:00;PROD;6;1,0;CAT;;;');
const y24 = importTransactions(y24Csv, 'test.csv');
assert.equal(y24.year, 2024);
assert.equal(y24.transactions[0].date, '2024-01-01');

// YY >= 50 → 1900s (historical data guard)
const y99Csv = makeCsv('31-12-99 23:59;PROD;6;1,0;CAT;;;');
const y99 = importTransactions(y99Csv, 'test.csv');
assert.equal(y99.year, 1999);
assert.equal(y99.transactions[0].date, '1999-12-31');

const y50Csv = makeCsv('15-06-50 12:00;PROD;6;1,0;CAT;;;');
const y50 = importTransactions(y50Csv, 'test.csv');
assert.equal(y50.year, 1950);
assert.equal(y50.transactions[0].date, '1950-06-15');

// YY = 49 → 2049 (just below the pivot)
const y49Csv = makeCsv('01-01-49 08:00;PROD;6;1,0;CAT;;;');
const y49 = importTransactions(y49Csv, 'test.csv');
assert.equal(y49.year, 2049);

// --- Payment method parsing ---
const cashCsv = makeCsv('10-03-25 09:30;PROD;6;2,0;CAT;;[CASH];');
const cashTx = importTransactions(cashCsv, 'test.csv');
assert.equal(cashTx.transactions[0].paymentMethod, 'cash');

const unknownCsv = makeCsv('10-03-25 09:30;PROD;6;2,0;CAT;;[CHEQUE];');
const unknownTx = importTransactions(unknownCsv, 'test.csv');
assert.equal(unknownTx.transactions[0].paymentMethod, 'unknown');

// --- Malformed timestamp: skip row, push warning ---
const badTsCsv = makeCsv('NOT-A-DATE;PROD;6;1,0;CAT;;;');
const badTs = importTransactions(badTsCsv, 'test.csv');
assert.equal(badTs.transactions.length, 0);
assert.ok(badTs.warnings.length > 0);
assert.ok(badTs.warnings[0].includes('Unparseable'));

// --- Empty file (header only) ---
const empty = importTransactions('Expr1000;article;tva;prix;categorie;EAN;temporaire8;temporaire8', 'empty.csv');
assert.equal(empty.transactions.length, 0);
assert.equal(empty.year, null);

// --- File too short ---
const tooShort = importTransactions('', 'short.csv');
assert.equal(tooShort.transactions.length, 0);
assert.ok(tooShort.warnings.some(w => w.includes('too short')));

// --- Weighed item: quantity extracted from name prefix ---
const weightedCsv = makeCsv('10-03-25 10:00;(1360g/2,3€Kg)POTIMARRON BIO;6;3,12;LEGUMES;;;');
const weighted = importTransactions(weightedCsv, 'test.csv');
assert.equal(weighted.transactions[0].rawName, 'POTIMARRON BIO');
assert.equal(weighted.transactions[0].quantity, 1.36);

// --- dayOfWeek: 2025-03-10 is a Monday = 1 ---
assert.equal(basic.transactions[0].dayOfWeek, 1);

console.log('transactions importer: all tests passed');
