/**
 * Unit tests for build-demo.mjs helpers.
 * Covers edge cases that crashed silently before the fixes:
 *   - buildBriefing with empty suppliers list
 *   - buildBriefing with no hausse / baisse products
 *   - buildBriefing returns a non-empty array in all cases
 */
import assert from 'node:assert/strict';
import { buildBriefing } from './build-demo.mjs';

const COPY_EN = {
  briefingOpening: (headline) => `Weather: ${headline}`,
  briefingSupplier: (name, summary) => `Supplier ${name}: ${summary}`,
  briefingTop: (names) => `Top: ${names.join(', ')}`,
  briefingSlow: (names) => `Slow: ${names.join(', ')}`,
};

const CONTEXT = {
  weather: { headline: 'sunny skies', condition: 'sunny' },
  suppliers: {},
};

// --- buildBriefing: empty suppliers should not throw ---
{
  const lines = buildBriefing([], [], CONTEXT, COPY_EN);
  assert.ok(Array.isArray(lines), 'returns an array');
  assert.equal(lines.length, 1, 'only the opening line when no suppliers/products');
  assert.equal(lines[0], 'Weather: sunny skies');
}

// --- buildBriefing: suppliers present but no hausse/baisse products ---
{
  const suppliers = [
    { name: 'Terra', summary: 'All good', order: [], watch: [], skip: [] }
  ];
  const lines = buildBriefing([], suppliers, CONTEXT, COPY_EN);
  assert.ok(lines.length >= 1, 'at least opening line');
  assert.equal(lines[0], 'Weather: sunny skies');
  // Supplier line should appear because suppliers is non-empty
  assert.ok(lines.some(l => l.includes('Terra')), 'supplier line included');
  // No topOrder line (no hausse products) — must not produce broken empty-name sentence
  assert.ok(!lines.some(l => l === 'Top: '), 'no broken empty-names line for topOrder');
  // No slow line
  assert.ok(!lines.some(l => l === 'Slow: '), 'no broken empty-names line for slow');
}

// --- buildBriefing: normal case with all data populated ---
{
  const products = [
    { displayName: 'Brie', action: 'hausse', totalRevenue: 1000 },
    { displayName: 'Camembert', action: 'hausse', totalRevenue: 800 },
    { displayName: 'Yoghurt', action: 'stable', totalRevenue: 500 },
    { displayName: 'OldPate', action: 'baisse', totalRevenue: 100 },
  ];
  const suppliers = [
    { name: 'Affineur', summary: '2 items need ordering.', order: products.filter(p => p.action === 'hausse'), watch: [], skip: [] },
    { name: 'Terra',    summary: 'Healthy.', order: [], watch: [], skip: [] },
  ];
  const lines = buildBriefing(products, suppliers, CONTEXT, COPY_EN);
  assert.ok(lines.length === 4, 'opening + supplier + top + slow');
  assert.ok(lines[0].includes('sunny skies'));
  assert.ok(lines[1].includes('Affineur'), 'hottest supplier (most orders) comes first');
  assert.ok(lines[2].includes('Brie') && lines[2].includes('Camembert'), 'top products listed');
  assert.ok(lines[3].includes('OldPate'), 'slow product listed');
}

// --- buildBriefing: multiple suppliers, picks the one with most order items ---
{
  const products = [
    { displayName: 'X', action: 'hausse', totalRevenue: 100 },
    { displayName: 'Y', action: 'hausse', totalRevenue: 200 },
    { displayName: 'Z', action: 'hausse', totalRevenue: 300 },
  ];
  const suppliers = [
    { name: 'Small', summary: 'one order', order: [products[0]], watch: [], skip: [] },
    { name: 'Big',   summary: 'three orders', order: products, watch: [], skip: [] },
  ];
  const lines = buildBriefing(products, suppliers, CONTEXT, COPY_EN);
  assert.ok(lines.some(l => l.includes('Big')), 'supplier with most orders wins');
  assert.ok(!lines.some(l => l.includes('Small') && l.startsWith('Supplier')), 'smaller supplier not chosen');
}

console.log('build-demo: all tests passed');
