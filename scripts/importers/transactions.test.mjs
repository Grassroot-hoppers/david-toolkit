import assert from 'node:assert/strict';
import { importTransactions } from './transactions.mjs';

// --- File too short ---
const tooShort = importTransactions("header line\n", "test-2025.csv");
assert.equal(tooShort.transactions.length, 0);
assert.ok(tooShort.warnings.some(w => w.includes("too short")));

// --- Valid row: timestamp + payment + product ---
const HEADER = "Expr1000;article;tva;prix;categorie;EAN;payment";
const validRow = `${HEADER}\n13-03-25 10:30;(1360g/2,3€Kg)POTIMARRON BIO;6;4,5;FRUIT ET LEGUME;3760123;MC/BC`;
const valid = importTransactions(validRow, "tx-2025.csv");
assert.equal(valid.transactions.length, 1);
assert.equal(valid.year, 2025);
const tx = valid.transactions[0];
assert.equal(tx.date, "2025-03-13");
assert.equal(tx.hour, 10);
assert.equal(tx.productKey, "POTIMARRON BIO");
assert.equal(tx.rawName, "POTIMARRON BIO");
assert.equal(tx.quantity, 1.360);  // weightKg stored as quantity for weighed items
assert.equal(tx.price, 4.5);
assert.equal(tx.vatRate, 6);
assert.equal(tx.category, "FRUIT ET LEGUME");
assert.equal(tx.paymentMethod, "card");

// --- Payment: cash ---
const cashRow = `${HEADER}\n13-03-25 11:00;BRIE;6;5;FROMAGE;123;CASH`;
const cash = importTransactions(cashRow, "tx-2025.csv");
assert.equal(cash.transactions[0].paymentMethod, "cash");

// --- Payment: unknown ---
const unknownRow = `${HEADER}\n13-03-25 12:00;BRIE;6;5;FROMAGE;123;VIREMENT`;
const unknown = importTransactions(unknownRow, "tx-2025.csv");
assert.equal(unknown.transactions[0].paymentMethod, "unknown");

// --- dayOfWeek: 2025-03-13 is Thursday (ISO 4) ---
assert.equal(tx.dayOfWeek, 4);

// --- Invalid timestamp: warning emitted, row skipped ---
const badTs = `${HEADER}\n99/99/99 99:99;PRODUCT;6;5;CAT;EAN;MC/BC\n13-03-25 10:00;GOOD;6;3;CAT;EAN;CASH`;
const badResult = importTransactions(badTs, "tx-2025.csv");
assert.equal(badResult.transactions.length, 1);
assert.ok(badResult.warnings.some(w => w.includes("Unparseable")));

// --- Empty product name: row skipped ---
const emptyName = `${HEADER}\n13-03-25 10:00;;6;5;CAT;EAN;CASH`;
const noName = importTransactions(emptyName, "tx-2025.csv");
assert.equal(noName.transactions.length, 0);

// --- Unit item (no weight prefix): quantity is null ---
const unitRow = `${HEADER}\n13-03-25 09:00;CONFITURE FRAISE;6;3,5;EPICERIE;456;MC`;
const unit = importTransactions(unitRow, "tx-2025.csv");
assert.equal(unit.transactions[0].quantity, null);  // null = unit item (not weighed)
assert.equal(unit.transactions[0].paymentMethod, "card");

console.log("transactions: all tests passed");
