import { splitCsvLines, splitCsvRow, parseEuroDecimal } from '../lib/csv-utils.mjs';

const FRENCH_DAYS = {
  lundi: 1, mardi: 2, mercredi: 3, jeudi: 4,
  vendredi: 5, samedi: 6, dimanche: 7
};

/**
 * Header: JOUR;HEURE;TOTAL;TOTAL
 * Data:   jeudi;10;2635,13;2635,13
 */
export function importHourlyPatterns(text, filename) {
  const lines = splitCsvLines(text);
  if (lines.length < 2) return { type: "hourly-by-weekday", year: null, entries: [], warnings: ["File too short"] };

  const year = filename ? detectYearFromName(filename) : null;
  const warnings = [];
  const entries = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i]);
    const dayName = (cols[0] || "").trim().toLowerCase();
    if (!dayName || !FRENCH_DAYS[dayName]) continue;

    const hour = parseInt(cols[1], 10);
    if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
      warnings.push(`Skipping row with invalid hour: "${(cols[1] || "").trim()}" (day: ${dayName})`);
      continue;
    }

    entries.push({
      dayOfWeek: FRENCH_DAYS[dayName],
      dayName,
      hour,
      revenue: parseEuroDecimal(cols[2])
    });
  }

  return { type: "hourly-by-weekday", year, entries, warnings };
}

function detectYearFromName(filename) {
  const match = String(filename).match(/(\d{4})/);
  return match ? parseInt(match[1], 10) : null;
}
