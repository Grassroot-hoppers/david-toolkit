import assert from 'node:assert/strict';
import { importHourlyPatterns } from './hourly-patterns.mjs';

const HEADER = "JOUR;HEURE;TOTAL;TOTAL\n";

// Happy path — all 7 days, various hours
const basicCsv = HEADER +
  "lundi;9;1200,50;1200,50\n" +
  "mardi;10;850,00;850,00\n" +
  "samedi;11;3400,75;3400,75\n";

const basic = importHourlyPatterns(basicCsv, "hourly-2025.csv");
assert.equal(basic.type, "hourly-by-weekday");
assert.equal(basic.year, 2025);
assert.equal(basic.entries.length, 3);
assert.equal(basic.entries[0].dayName, "lundi");
assert.equal(basic.entries[0].dayOfWeek, 1);
assert.equal(basic.entries[0].hour, 9);
assert.equal(basic.entries[0].revenue, 1200.5);
assert.equal(basic.entries[2].dayOfWeek, 6); // samedi

// Unknown day name is silently skipped
const withUnknown = HEADER + "monday;10;500;500\nlundi;10;200,00;200,00\n";
const unknownDay = importHourlyPatterns(withUnknown, "hourly-2025.csv");
assert.equal(unknownDay.entries.length, 1);
assert.equal(unknownDay.entries[0].dayName, "lundi");

// NaN hour is silently skipped (guards against malformed exports)
const withNanHour = HEADER + "lundi;;500;500\nlundi;10;300,00;300,00\n";
const nanHour = importHourlyPatterns(withNanHour, "hourly-2025.csv");
assert.equal(nanHour.entries.length, 1);
assert.equal(nanHour.entries[0].hour, 10);

// Zero revenue is kept (a valid closed hour)
const withZeroRev = HEADER + "mercredi;8;0;0\n";
const zeroRev = importHourlyPatterns(withZeroRev, "hourly-2025.csv");
assert.equal(zeroRev.entries.length, 1);
assert.equal(zeroRev.entries[0].revenue, 0);

// European decimal in revenue
const withEuroDecimal = HEADER + "jeudi;14;2635,13;2635,13\n";
const euroDecimal = importHourlyPatterns(withEuroDecimal, "hourly-2025.csv");
assert.equal(euroDecimal.entries[0].revenue, 2635.13);

// File too short (header only)
const tooShort = importHourlyPatterns("JOUR;HEURE;TOTAL\n", "hourly-2025.csv");
assert.equal(tooShort.entries.length, 0);
assert.ok(tooShort.warnings.length > 0);

// Year extracted from filename
const yearOnly = importHourlyPatterns(HEADER + "vendredi;12;100;100\n", "stats-2024.csv");
assert.equal(yearOnly.year, 2024);

// All ISO weekdays map correctly
const allDaysCsv = HEADER +
  "lundi;8;1;1\nmardi;8;1;1\nmercredi;8;1;1\njeudi;8;1;1\n" +
  "vendredi;8;1;1\nsamedi;8;1;1\ndimanche;8;1;1\n";
const allDays = importHourlyPatterns(allDaysCsv, "hourly-2025.csv");
assert.equal(allDays.entries.length, 7);
const dows = allDays.entries.map(e => e.dayOfWeek);
assert.deepEqual(dows, [1, 2, 3, 4, 5, 6, 7]);

console.log("hourly-patterns: all tests passed");
