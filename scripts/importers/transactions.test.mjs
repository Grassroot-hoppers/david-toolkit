import assert from 'node:assert/strict';
import { importTransactions } from './transactions.mjs';

// Header: Expr1000;article;tva;prix;categorie;EAN;temporaire8;temporaire8
// Payment column is cols[6] (first temporaire8)
const HEADER = "Expr1000;article;tva;prix;categorie;EAN;temporaire8;temporaire8";
const row = (ts, name, tva, prix, cat, ean, pay) =>
  `${ts};${name};${tva};${prix};${cat};${ean};${pay};`;

// --- File too short ---
const short = importTransactions("header", "test-2025.csv");
assert.equal(short.transactions.length, 0);
assert.ok(short.warnings.some(w => w.includes("short")));

// --- Single valid transaction: weighed item, card payment ---
// March 10, 2025 = Monday (ISO dayOfWeek 1)
const r = importTransactions(
  `${HEADER}\n${row("10-03-25 10:30", "(1360g/2,3€Kg)POTIMARRON BIO", "6", "2,50", "LEGUMES", "12345", "[MC/BC]")}`,
  "trans-2025.csv"
);
assert.equal(r.transactions.length, 1);
assert.equal(r.year, 2025);
const tx = r.transactions[0];
assert.equal(tx.date, "2025-03-10");
assert.equal(tx.hour, 10);
assert.equal(tx.dayOfWeek, 1);
assert.equal(tx.productKey, "POTIMARRON BIO");
assert.equal(tx.rawName, "POTIMARRON BIO");
assert.equal(tx.vatRate, 6);
assert.equal(tx.price, 2.5);
assert.equal(tx.category, "LEGUMES");
assert.equal(tx.paymentMethod, "card");
assert.equal(tx.quantity, 1.36);

// --- Unit item: no weight prefix, cash payment ---
const r2 = importTransactions(
  `${HEADER}\n${row("10-03-25 11:00", "BRIE DE MEAUX", "6", "4,50", "FROMAGE", "67890", "[CASH]")}`,
  "trans-2025.csv"
);
assert.equal(r2.transactions.length, 1);
const txUnit = r2.transactions[0];
assert.equal(txUnit.paymentMethod, "cash");
assert.equal(txUnit.quantity, null);  // no weight prefix → aggregator defaults to 1
assert.equal(txUnit.rawName, "BRIE DE MEAUX");

// --- Unknown payment method ---
const r3 = importTransactions(
  `${HEADER}\n${row("10-03-25 12:00", "PRODUCT", "6", "2,00", "CAT", "EAN", "")}`,
  "trans-2025.csv"
);
assert.equal(r3.transactions[0].paymentMethod, "unknown");

// --- Malformed timestamp: skip row, emit warning ---
const r4 = importTransactions(
  `${HEADER}\n${row("not-a-date", "PRODUCT", "6", "2,00", "CAT", "EAN", "")}`,
  "trans-2025.csv"
);
assert.equal(r4.transactions.length, 0);
assert.ok(r4.warnings.some(w => w.includes("Unparseable")));

// --- Empty product name: skip row silently ---
const r5 = importTransactions(
  `${HEADER}\n${row("10-03-25 10:00", "", "6", "2,00", "CAT", "EAN", "")}`,
  "trans-2025.csv"
);
assert.equal(r5.transactions.length, 0);

// --- Year derived from first valid timestamp ---
const r6 = importTransactions(
  `${HEADER}\n${row("10-03-24 10:00", "PRODUCT", "6", "2,00", "CAT", "EAN", "")}`,
  "file.csv"
);
assert.equal(r6.year, 2024);

// --- Euro decimal prices parsed correctly ---
const r7 = importTransactions(
  `${HEADER}\n${row("10-03-25 09:00", "CAMEMBERT", "6", "3,90", "FROMAGE", "EAN", "")}`,
  "t.csv"
);
assert.equal(r7.transactions[0].price, 3.9);

// --- Multiple rows: all parsed ---
const rows = [
  row("10-03-25 09:00", "APPLE", "6", "1,20", "FRUIT", "1", ""),
  row("11-03-25 10:00", "BANANA", "6", "0,80", "FRUIT", "2", ""),
  row("12-03-25 11:00", "CHERRY", "6", "2,00", "FRUIT", "3", ""),
].join("\n");
const r8 = importTransactions(`${HEADER}\n${rows}`, "trans-2025.csv");
assert.equal(r8.transactions.length, 3);
assert.equal(r8.year, 2025);

// --- Mixed valid/invalid rows: only valid rows included ---
const mixed = [
  row("10-03-25 09:00", "VALID", "6", "1,20", "CAT", "1", ""),
  row("bad-ts", "INVALID", "6", "1,00", "CAT", "2", ""),
  row("11-03-25 10:00", "ALSO VALID", "6", "2,00", "CAT", "3", ""),
].join("\n");
const r9 = importTransactions(`${HEADER}\n${mixed}`, "trans.csv");
assert.equal(r9.transactions.length, 2);
assert.equal(r9.warnings.length, 1);

console.log("transactions: all tests passed");
