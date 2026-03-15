import assert from 'node:assert/strict';
import { importHourlyPatterns } from './hourly-patterns.mjs';

// --- File too short ---
const tooShort = importHourlyPatterns("JOUR;HEURE;TOTAL;TOTAL", "hourly-2025.csv");
assert.equal(tooShort.entries.length, 0);
assert.ok(tooShort.warnings.length > 0);

// --- Basic parsing ---
const csv = [
  "JOUR;HEURE;TOTAL;TOTAL",
  "lundi;9;1200,50;1200,50",
  "samedi;14;3500,00;3500,00",
  "dimanche;11;800,25;800,25"
].join("\n");
const basic = importHourlyPatterns(csv, "hourly-2025.csv");
assert.equal(basic.year, 2025);
assert.equal(basic.entries.length, 3);
assert.equal(basic.entries[0].dayOfWeek, 1); // lundi = 1
assert.equal(basic.entries[0].hour, 9);
assert.equal(basic.entries[0].revenue, 1200.50);
assert.equal(basic.entries[1].dayOfWeek, 6); // samedi = 6
assert.equal(basic.entries[2].dayName, "dimanche");

// --- Unknown day name is skipped ---
const withUnknown = [
  "JOUR;HEURE;TOTAL;TOTAL",
  "monday;9;100,00;100,00",
  "mardi;10;200,00;200,00"
].join("\n");
const withUnknownResult = importHourlyPatterns(withUnknown, "hourly-2024.csv");
assert.equal(withUnknownResult.entries.length, 1);
assert.equal(withUnknownResult.entries[0].dayName, "mardi");

// --- Empty hour column produces no NaN entry (regression guard) ---
const withEmptyHour = [
  "JOUR;HEURE;TOTAL;TOTAL",
  "mercredi;;500,00;500,00",
  "jeudi;11;300,00;300,00"
].join("\n");
const emptyHourResult = importHourlyPatterns(withEmptyHour, "hourly-2025.csv");
assert.equal(emptyHourResult.entries.length, 1);
assert.equal(emptyHourResult.entries[0].hour, 11);
assert.equal(emptyHourResult.entries.every(e => Number.isFinite(e.hour)), true);

// --- No year in filename ---
const noYear = importHourlyPatterns(csv, "hourly.csv");
assert.equal(noYear.year, null);

console.log("hourly-patterns: all tests passed");
