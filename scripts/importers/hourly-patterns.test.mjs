import assert from 'node:assert/strict';
import { importHourlyPatterns } from './hourly-patterns.mjs';

// --- Normal row ---
const HEADER = 'JOUR;HEURE;TOTAL;TOTAL\n';
const basicInput = HEADER + 'jeudi;10;2635,13;2635,13\nsamedi;14;1200,00;1200,00\n';
const basic = importHourlyPatterns(basicInput, 'hourly-2025.csv');
assert.equal(basic.year, 2025);
assert.equal(basic.entries.length, 2);
assert.equal(basic.entries[0].dayOfWeek, 4); // jeudi = 4
assert.equal(basic.entries[0].dayName, 'jeudi');
assert.equal(basic.entries[0].hour, 10);
assert.equal(basic.entries[0].revenue, 2635.13);
assert.equal(basic.entries[1].dayOfWeek, 6); // samedi = 6
assert.equal(basic.entries[1].hour, 14);

// --- NaN / blank hour: row must be skipped, not stored as NaN ---
const nanInput = HEADER + 'lundi;;500,00;500,00\n' + 'mardi;abc;300,00;300,00\n' + 'mercredi;9;100,00;100,00\n';
const nanResult = importHourlyPatterns(nanInput, 'hourly-2025.csv');
assert.equal(nanResult.entries.length, 1, 'rows with NaN hour must be skipped');
assert.equal(nanResult.entries[0].dayName, 'mercredi');
assert.equal(nanResult.entries[0].hour, 9);

// --- Unknown day name: skip ---
const unknownDay = HEADER + 'monday;10;100,00;100,00\n' + 'vendredi;11;200,00;200,00\n';
const unknownResult = importHourlyPatterns(unknownDay, 'hourly-2025.csv');
assert.equal(unknownResult.entries.length, 1);
assert.equal(unknownResult.entries[0].dayName, 'vendredi');

// --- File too short ---
const short = importHourlyPatterns('JOUR;HEURE;TOTAL;TOTAL', 'hourly-2025.csv');
assert.equal(short.entries.length, 0);
assert.equal(short.warnings[0], 'File too short');

// --- Year from filename ---
const noYear = importHourlyPatterns(basicInput, 'export.csv');
assert.equal(noYear.year, null);

// --- Revenue uses parseEuroDecimal (comma as decimal sep) ---
const euroInput = HEADER + 'lundi;9;1234,56;1234,56\n';
const euroResult = importHourlyPatterns(euroInput, 'h.csv');
assert.equal(euroResult.entries[0].revenue, 1234.56);

// --- Zero revenue row is stored (not filtered) ---
const zeroInput = HEADER + 'mardi;8;0;0\n';
const zeroResult = importHourlyPatterns(zeroInput, 'h.csv');
assert.equal(zeroResult.entries.length, 1);
assert.equal(zeroResult.entries[0].revenue, 0);

console.log('hourly-patterns: all tests passed');
