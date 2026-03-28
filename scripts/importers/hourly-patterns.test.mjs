import assert from 'node:assert/strict';
import { importHourlyPatterns } from './hourly-patterns.mjs';

const header = "JOUR;HEURE;TOTAL;TOTAL";

// --- Basic import ---
const basic = importHourlyPatterns(`${header}\njeudi;10;2635,13;2635,13\n`, "test-2025.csv");
assert.equal(basic.entries.length, 1);
assert.equal(basic.entries[0].dayOfWeek, 4);
assert.equal(basic.entries[0].dayName, "jeudi");
assert.equal(basic.entries[0].hour, 10);
assert.equal(basic.entries[0].revenue, 2635.13);
assert.equal(basic.year, 2025);

// --- All 7 French day names are recognized ---
const allDays = [
  { name: "lundi",    dow: 1 },
  { name: "mardi",    dow: 2 },
  { name: "mercredi", dow: 3 },
  { name: "jeudi",    dow: 4 },
  { name: "vendredi", dow: 5 },
  { name: "samedi",   dow: 6 },
  { name: "dimanche", dow: 7 }
];
const dayRows = allDays.map(d => `${d.name};9;100`).join("\n");
const allResult = importHourlyPatterns(`${header}\n${dayRows}\n`, "test.csv");
assert.equal(allResult.entries.length, 7);
for (const { name, dow } of allDays) {
  const e = allResult.entries.find(x => x.dayName === name);
  assert.ok(e, `missing entry for ${name}`);
  assert.equal(e.dayOfWeek, dow);
}

// --- Unknown day names are skipped ---
const unknownDay = importHourlyPatterns(`${header}\nMonday;10;100\njeudi;11;50\n`, "test.csv");
assert.equal(unknownDay.entries.length, 1);
assert.equal(unknownDay.entries[0].dayName, "jeudi");

// --- Missing hour column produces NaN → row is skipped (not pushed) ---
const missingHour = importHourlyPatterns(`${header}\nlundi;\nlundi;9;200\n`, "test.csv");
assert.equal(missingHour.entries.length, 1, "row with missing hour must be skipped");
assert.equal(missingHour.entries[0].hour, 9);

// --- Empty file ---
const empty = importHourlyPatterns(`${header}\n`, "test.csv");
assert.equal(empty.entries.length, 0);

// --- File too short ---
const tooShort = importHourlyPatterns("", "test.csv");
assert.equal(tooShort.entries.length, 0);
assert.ok(tooShort.warnings.length > 0);

// --- Euro decimal revenue ---
const euro = importHourlyPatterns(`${header}\nsamedi;14;1 234,56\n`, "test.csv");
assert.equal(euro.entries[0].revenue, 1234.56);

console.log("hourly-patterns: all tests passed");
