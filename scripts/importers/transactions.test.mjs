import assert from 'node:assert/strict';
import { importTransactions } from './transactions.mjs';

const HEADER = "Expr1000;article;tva;prix;categorie;EAN;temporaire8;temporaire8";

// 2-digit year < 70 → 2000s
const csv2025 = `${HEADER}\n24-12-25 10:30;BRIE DE MEAUX;6;4,5;FROMAGE;123456;MC/BC;`;
const r25 = importTransactions(csv2025, "test.csv");
assert.equal(r25.year, 2025);
assert.equal(r25.transactions[0].date, "2025-12-24");

// 2-digit year >= 70 → 1900s (e.g. 99 → 1999, not 2099)
const csv1999 = `${HEADER}\n15-06-99 14:00;BEURRE BIO;6;2,8;CREMERIE;654321;CASH;`;
const r99 = importTransactions(csv1999, "test.csv");
assert.equal(r99.year, 1999);
assert.equal(r99.transactions[0].date, "1999-06-15");

// 2-digit year at boundary (70 → 1970)
const csv1970 = `${HEADER}\n01-01-70 09:00;PAIN;0;1,5;BOULANGERIE;111111;CASH;`;
const r70 = importTransactions(csv1970, "test.csv");
assert.equal(r70.year, 1970);
assert.equal(r70.transactions[0].date, "1970-01-01");

// 2-digit year just below boundary (69 → 2069)
const csv2069 = `${HEADER}\n31-12-69 23:59;FROMAGE;6;5,0;FROMAGE;222222;MC/BC;`;
const r69 = importTransactions(csv2069, "test.csv");
assert.equal(r69.year, 2069);

// Malformed timestamp → skipped with warning
const csvBad = `${HEADER}\nnot-a-date;BRIE;6;4,5;FROMAGE;123456;CASH;`;
const rBad = importTransactions(csvBad, "test.csv");
assert.equal(rBad.transactions.length, 0);
assert.ok(rBad.warnings.length > 0);

// Payment method detection
const csvCard = `${HEADER}\n10-03-25 11:00;GOUDA;6;3,0;FROMAGE;999;MC/BC;`;
const rCard = importTransactions(csvCard, "test.csv");
assert.equal(rCard.transactions[0].paymentMethod, "card");

const csvCash = `${HEADER}\n10-03-25 11:00;GOUDA;6;3,0;FROMAGE;999;CASH;`;
const rCash = importTransactions(csvCash, "test.csv");
assert.equal(rCash.transactions[0].paymentMethod, "cash");

// Weighed item: quantity = weightKg
const csvWeighed = `${HEADER}\n10-03-25 10:00;(500g/12,0€Kg)GRUYERE;6;6,0;FROMAGE;888;CASH;`;
const rWeighed = importTransactions(csvWeighed, "test.csv");
assert.equal(rWeighed.transactions[0].quantity, 0.5);
assert.equal(rWeighed.transactions[0].rawName, "GRUYERE");

// Unit item: quantity = null
const csvUnit = `${HEADER}\n10-03-25 10:00;BEURRE;0;2,5;CREMERIE;777;CASH;`;
const rUnit = importTransactions(csvUnit, "test.csv");
assert.equal(rUnit.transactions[0].quantity, null);

console.log("transactions: all tests passed");
