import assert from 'node:assert/strict';
import { importHourlyPatterns } from './hourly-patterns.mjs';

// --- Happy path ---
const basicText = [
  'JOUR;HEURE;TOTAL;TOTAL',
  'lundi;10;1234,56;1234,56',
  'mardi;14;500,00;500,00',
  'samedi;9;80,5;80,5',
].join('\n');

const basic = importHourlyPatterns(basicText, 'hourly-2025.csv');
assert.equal(basic.type, 'hourly-by-weekday');
assert.equal(basic.year, 2025);
assert.equal(basic.entries.length, 3);
assert.equal(basic.entries[0].dayOfWeek, 1); // lundi
assert.equal(basic.entries[0].dayName, 'lundi');
assert.equal(basic.entries[0].hour, 10);
assert.equal(basic.entries[0].revenue, 1234.56);
assert.equal(basic.entries[1].dayOfWeek, 2); // mardi
assert.equal(basic.entries[2].dayOfWeek, 6); // samedi
assert.equal(basic.entries[2].revenue, 80.5);

// --- NaN guard: malformed hour column is skipped, valid rows still parsed ---
const nanText = [
  'JOUR;HEURE;TOTAL;TOTAL',
  'lundi;HEURE;999;999',   // header leaked into data — hour is NaN
  'mercredi;;500;500',      // blank hour — NaN
  'jeudi;11;200;200',       // valid
].join('\n');

const nanResult = importHourlyPatterns(nanText, 'hourly-2025.csv');
assert.equal(nanResult.entries.length, 1);
assert.equal(nanResult.entries[0].dayOfWeek, 4); // jeudi
assert.equal(nanResult.entries[0].hour, 11);

// --- Unknown day names are skipped ---
// Uppercase names are lowercased before lookup, so LUNDI → lundi is still recognized.
// Only truly unknown names (English, typos, empty) are dropped.
const unknownDayText = [
  'JOUR;HEURE;TOTAL;TOTAL',
  'sunday;10;100;100',    // English day — not in FRENCH_DAYS
  'wed.;9;200;200',       // typo/abbreviation — not in FRENCH_DAYS
  'vendredi;16;300;300',
].join('\n');

const unknownResult = importHourlyPatterns(unknownDayText, 'hourly-2025.csv');
assert.equal(unknownResult.entries.length, 1);
assert.equal(unknownResult.entries[0].dayOfWeek, 5); // vendredi

// --- All seven French days map correctly ---
const allDaysText = [
  'JOUR;HEURE;TOTAL;TOTAL',
  'lundi;8;10;10',
  'mardi;8;10;10',
  'mercredi;8;10;10',
  'jeudi;8;10;10',
  'vendredi;8;10;10',
  'samedi;8;10;10',
  'dimanche;8;10;10',
].join('\n');

const allDays = importHourlyPatterns(allDaysText, 'patterns-2024.csv');
assert.equal(allDays.year, 2024);
assert.equal(allDays.entries.length, 7);
const dows = allDays.entries.map(e => e.dayOfWeek);
assert.deepEqual(dows, [1, 2, 3, 4, 5, 6, 7]);

// --- File too short (no data rows) ---
const tooShort = importHourlyPatterns('JOUR;HEURE;TOTAL;TOTAL', 'hourly-2025.csv');
assert.equal(tooShort.entries.length, 0);
assert.equal(tooShort.warnings.length, 1);

// --- Completely empty input ---
const empty = importHourlyPatterns('', 'hourly-2025.csv');
assert.equal(empty.entries.length, 0);
assert.equal(empty.warnings.length, 1);

// --- Year extracted from filename even when no year column ---
const noYearFile = importHourlyPatterns(basicText, 'export-patterns.csv');
assert.equal(noYearFile.year, null);

console.log('hourly-patterns: all tests passed');
