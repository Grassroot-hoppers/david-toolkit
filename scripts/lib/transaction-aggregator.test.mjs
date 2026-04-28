/**
 * Unit tests for transaction-aggregator.mjs (transaction-first pipeline core).
 * See: https://github.com/Grassroot-hoppers/david-toolkit/issues/8
 */
import assert from 'node:assert/strict';
import { aggregateFromTransactions } from './transaction-aggregator.mjs';

// --- Empty input ---
const empty = aggregateFromTransactions([], 2025);
assert.equal(empty.monthlyStats.products.length, 0);
assert.equal(empty.annualStats.products.length, 0);
assert.equal(empty.categoryMix.categories.length, 0);
assert.equal(empty.hourlyPatterns.entries.length, 0);
assert.equal(empty.monthlyStats.year, 2025);
assert.equal(empty.annualStats.source, 'transactions');

// --- Single transaction ---
const singleTx = [{
  productKey: 'BRIE DE MEAUX',
  rawName: 'Brie de Meaux',
  category: 'FROMAGE',
  vatRate: 6,
  price: 4.5,
  date: '2025-03-10',
  hour: 10,
  dayOfWeek: 1,
  quantity: 1
}];
const single = aggregateFromTransactions(singleTx, 2025);
assert.equal(single.annualStats.products.length, 1);
assert.equal(single.annualStats.products[0].revenue, 4.5);
assert.equal(single.annualStats.products[0].key, 'BRIE DE MEAUX');
assert.equal(single.categoryMix.categories.length, 1);
assert.equal(single.categoryMix.categories[0].share, 100);
assert.equal(single.categoryMix.categories[0].category, 'FROMAGE');
assert.equal(single.hourlyPatterns.entries.length, 1);
assert.equal(single.hourlyPatterns.entries[0].hour, 10);
assert.equal(single.hourlyPatterns.entries[0].dayName, 'lundi');
assert.equal(single.monthlyStats.products.length, 1);
assert.equal(single.monthlyStats.products[0].monthly[2].revenue, 4.5); // month 3 = index 2
assert.equal(single.monthlyStats.products[0].totalRevenue, 4.5);

// --- Null/undefined date: skip malformed transaction (no throw) ---
const withNullDate = [
  { ...singleTx[0], date: null },
  { ...singleTx[0], date: undefined, productKey: 'OTHER' }
];
const skipped = aggregateFromTransactions(withNullDate, 2025);
assert.equal(skipped.annualStats.products.length, 0);
assert.equal(skipped.categoryMix.categories.length, 0);

// --- Multiple transactions same product/month: accumulation ---
const multipleSame = [
  { ...singleTx[0], price: 3, quantity: 1 },
  { ...singleTx[0], price: 2.5, quantity: 2 }
];
const multi = aggregateFromTransactions(multipleSame, 2025);
assert.equal(multi.annualStats.products[0].revenue, 5.5);
assert.equal(multi.annualStats.products[0].quantity, 3);
assert.equal(multi.monthlyStats.products[0].monthly[2].revenue, 5.5);
assert.equal(multi.monthlyStats.products[0].totalQuantity, 3);

// --- grandTotal === 0: share is 0 (empty input already covered; explicit category with no revenue not possible) ---
assert.equal(empty.categoryMix.categories.length, 0);

// --- vatRate 0: VAT calculation divides by 1 + 0/100 ---
const zeroVat = [{
  productKey: 'BREAD',
  rawName: 'Bread',
  category: 'BOULANGERIE',
  vatRate: 0,
  price: 2,
  date: '2025-01-15',
  hour: 9,
  dayOfWeek: 2,
  quantity: 1
}];
const zeroVatResult = aggregateFromTransactions(zeroVat, 2025);
assert.equal(zeroVatResult.categoryMix.categories.length, 1);
assert.equal(zeroVatResult.categoryMix.categories[0].vatRate, 0);
assert.equal(zeroVatResult.categoryMix.categories[0].vatAmount, 0);
assert.equal(zeroVatResult.categoryMix.categories[0].revenueExclVat, 2);

// --- Skip zero/negative price ---
const withZeroPrice = [
  { ...singleTx[0], price: 0 },
  { ...singleTx[0], price: -1, productKey: 'NEG' }
];
const noZero = aggregateFromTransactions(withZeroPrice, 2025);
assert.equal(noZero.annualStats.products.length, 0);

// --- All four output shapes present ---
const out = aggregateFromTransactions(singleTx, 2025);
assert.ok(out.monthlyStats && out.annualStats && out.categoryMix && out.hourlyPatterns);
assert.equal(out.monthlyStats.source, 'transactions');
assert.equal(out.annualStats.refunds.length, 0);

// --- null quantity defaults to 1 (weighed items have weightKg, unit items pass null) ---
const nullQty = [{
  productKey: 'JAMBON',
  rawName: 'Jambon',
  category: 'CHARCUTERIE',
  vatRate: 6,
  price: 3.2,
  date: '2025-05-01',
  hour: 11,
  dayOfWeek: 4,
  quantity: null
}];
const nullQtyResult = aggregateFromTransactions(nullQty, 2025);
assert.equal(nullQtyResult.annualStats.products[0].quantity, 1);
assert.equal(nullQtyResult.monthlyStats.products[0].totalQuantity, 1);

// --- Accumulation across two different months for the same product ---
const twoMonths = [
  { ...singleTx[0], date: '2025-02-10', price: 4, quantity: 2 },
  { ...singleTx[0], date: '2025-04-15', price: 6, quantity: 3 }
];
const twoMonthsResult = aggregateFromTransactions(twoMonths, 2025);
assert.equal(twoMonthsResult.annualStats.products.length, 1);
assert.equal(twoMonthsResult.annualStats.products[0].revenue, 10);
assert.equal(twoMonthsResult.annualStats.products[0].quantity, 5);
const febEntry = twoMonthsResult.monthlyStats.products[0].monthly[1]; // index 1 = month 2
assert.equal(febEntry.revenue, 4);
assert.equal(febEntry.quantity, 2);
const aprEntry = twoMonthsResult.monthlyStats.products[0].monthly[3]; // index 3 = month 4
assert.equal(aprEntry.revenue, 6);
assert.equal(aprEntry.quantity, 3);

console.log('transaction-aggregator: all tests passed');
