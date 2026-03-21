/**
 * Unit tests for importer edge cases.
 */
import assert from 'node:assert/strict';
import { importHourlyPatterns } from '../importers/hourly-patterns.mjs';

// --- importHourlyPatterns: normal data ---
const normalText = 'JOUR;HEURE;TOTAL;TOTAL\njeudi;10;2635,13;2635,13\nvendredi;14;1200,00;1200,00\n';
const normal = importHourlyPatterns(normalText, 'hourly-2024.csv');
assert.equal(normal.type, 'hourly-by-weekday');
assert.equal(normal.year, 2024);
assert.equal(normal.entries.length, 2);
assert.equal(normal.entries[0].dayOfWeek, 4); // jeudi = Thursday = 4
assert.equal(normal.entries[0].hour, 10);
assert.equal(normal.entries[0].revenue, 2635.13);
assert.equal(normal.entries[1].dayOfWeek, 5); // vendredi = Friday = 5
assert.equal(normal.entries[1].hour, 14);

// --- importHourlyPatterns: missing hour column must be skipped, not produce NaN/null ---
const missingHour = 'JOUR;HEURE;TOTAL;TOTAL\njeudi;;2635,13;2635,13\njeudi;10;500,00;500,00\n';
const skipped = importHourlyPatterns(missingHour, 'hourly-2024.csv');
assert.equal(skipped.entries.length, 1, 'row with empty hour should be skipped');
assert.equal(skipped.entries[0].hour, 10);
assert.notEqual(skipped.entries[0].hour, null);
assert.ok(!Number.isNaN(skipped.entries[0].hour));

// --- importHourlyPatterns: non-numeric hour must be skipped ---
const badHour = 'JOUR;HEURE;TOTAL;TOTAL\njeudi;abc;2635,13;2635,13\nsamedi;9;300,00;300,00\n';
const badSkipped = importHourlyPatterns(badHour, 'hourly-2024.csv');
assert.equal(badSkipped.entries.length, 1, 'row with non-numeric hour should be skipped');
assert.equal(badSkipped.entries[0].dayOfWeek, 6); // samedi = 6

// --- importHourlyPatterns: file too short ---
const tooShort = importHourlyPatterns('JOUR;HEURE;TOTAL;TOTAL', 'hourly-2024.csv');
assert.equal(tooShort.entries.length, 0);
assert.ok(tooShort.warnings.length > 0);

// --- importHourlyPatterns: unknown day name rows are skipped ---
const unknownDay = 'JOUR;HEURE;TOTAL;TOTAL\nfoo;10;100,00;100,00\nlundi;8;200,00;200,00\n';
const unknownResult = importHourlyPatterns(unknownDay, 'hourly-2023.csv');
assert.equal(unknownResult.entries.length, 1);
assert.equal(unknownResult.entries[0].dayOfWeek, 1); // lundi = 1
assert.equal(unknownResult.year, 2023);

console.log('importers: all tests passed');
