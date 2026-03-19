import assert from 'node:assert/strict';
import { importHourlyPatterns } from './hourly-patterns.mjs';

const header = "JOUR;HEURE;TOTAL;TOTAL";

// Normal row
const normal = importHourlyPatterns([header, "jeudi;10;2635,13;2635,13"].join("\n"), "patterns-2025.csv");
assert.equal(normal.entries.length, 1);
assert.equal(normal.entries[0].dayOfWeek, 4);
assert.equal(normal.entries[0].hour, 10);
assert.equal(normal.entries[0].revenue, 2635.13);
assert.equal(normal.year, 2025);

// Row with missing hour column → skip (NaN guard)
const missingHour = importHourlyPatterns([header, "mardi;;150,00;150,00"].join("\n"), "patterns-2025.csv");
assert.equal(missingHour.entries.length, 0, "row with empty hour should be skipped");

// Row with non-numeric hour column → skip
const badHour = importHourlyPatterns([header, "mardi;abc;150,00;150,00"].join("\n"), "patterns-2025.csv");
assert.equal(badHour.entries.length, 0, "row with non-numeric hour should be skipped");

// Unknown day name → skip
const unknownDay = importHourlyPatterns([header, "sunday;10;100;100"].join("\n"), "patterns-2025.csv");
assert.equal(unknownDay.entries.length, 0);

// Year extracted from filename (needs at least header + 1 row to pass length check)
const minFile = [header, "lundi;9;100,00;100,00"].join("\n");
assert.equal(importHourlyPatterns(minFile, "hourly-by-weekday-2024.csv").year, 2024);
assert.equal(importHourlyPatterns(minFile, "no-year.csv").year, null);

// Short file (header only) → year null, no entries
const empty = importHourlyPatterns(header, "2025.csv");
assert.equal(empty.entries.length, 0);
assert.equal(empty.year, null);

console.log("hourly-patterns: all tests passed");
