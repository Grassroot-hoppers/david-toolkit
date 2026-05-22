import assert from "node:assert/strict";
import { importProductMaster } from "./product-master.mjs";
import { importTransactions } from "./transactions.mjs";

const transactionHeader = "Expr1000;article;tva;prix;categorie;EAN;temporaire8;temporaire8";

{
  const text = [
    transactionHeader,
    "02-01-25 09:15;(0075g/18,50€/Kg)COMTE AOP;6;1,39;FRAIS;1234567890123;[MC/BC];"
  ].join("\n");

  const result = importTransactions(text, "transactions-edge-2025.csv");

  assert.equal(result.transactions.length, 1);
  assert.equal(result.transactions[0].rawName, "COMTE AOP");
  assert.equal(result.transactions[0].quantity, 0.075);
  assert.equal(result.transactions[0].price, 1.39);
  assert.equal(result.transactions[0].paymentMethod, "card");
}

assert.throws(
  () => importTransactions([
    transactionHeader,
    "02-01-25 09:15;(0075g/18,50€/Kg)COMTE AOP;6;1,39;FRAIS;1234567890123"
  ].join("\n"), "transactions-broken-2025.csv"),
  /transactions-broken-2025\.csv row 2 transactions: expected at least 7 semicolon columns, got 6/
);

assert.throws(
  () => importProductMaster(";;123;COMTE AOP;18,50;4;6;FRAIS;FROMAGE", "product-master-broken.csv"),
  /product-master-broken\.csv row 1 product-master: expected at least 50 semicolon columns, got 9/
);

console.log("malformed-rows: all tests passed");
