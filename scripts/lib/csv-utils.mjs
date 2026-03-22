// --- Encoding ---

const CP1252_MAP = {
  0x80: "\u20AC", 0x82: "\u201A", 0x83: "\u0192", 0x84: "\u201E",
  0x85: "\u2026", 0x86: "\u2020", 0x87: "\u2021", 0x88: "\u02C6",
  0x89: "\u2030", 0x8A: "\u0160", 0x8B: "\u2039", 0x8C: "\u0152",
  0x8E: "\u017D", 0x91: "\u2018", 0x92: "\u2019", 0x93: "\u201C",
  0x94: "\u201D", 0x95: "\u2022", 0x96: "\u2013", 0x97: "\u2014",
  0x98: "\u02DC", 0x99: "\u2122", 0x9A: "\u0161", 0x9B: "\u203A",
  0x9C: "\u0153", 0x9E: "\u017E", 0x9F: "\u0178"
};

export function decodeBuffer(buffer) {
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { text: buffer.toString("utf8").slice(1), encoding: "utf8-bom" };
  }
  const asUtf8 = buffer.toString("utf8");
  if (!asUtf8.includes("\ufffd")) {
    return { text: asUtf8, encoding: "utf8" };
  }
  const bytes = new Uint8Array(buffer);
  let result = "";
  for (const byte of bytes) {
    result += CP1252_MAP[byte] || String.fromCharCode(byte);
  }
  return { text: result, encoding: "cp1252" };
}

// --- CSV Parsing ---

export function splitCsvLines(text) {
  return text.replace(/\r/g, "").split("\n").filter(Boolean);
}

export function splitCsvRow(line) {
  return line.split(";");
}

// --- Number Parsing ---

export function parseEuroDecimal(value) {
  if (value === undefined || value === null || value === "") return 0;
  let cleaned = String(value).replace(/\s/g, "");
  // European locale: if both '.' and ',' are present, '.' is the thousand separator
  if (cleaned.includes(".") && cleaned.includes(",")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    cleaned = cleaned.replace(",", ".");
  }
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

export function parseMonthlyCell(value) {
  if (!value || !String(value).trim()) return { quantity: 0, revenue: 0 };
  const str = String(value).trim();
  const match = str.match(/^\s*(\S+)\s+\((\S+)\)\s*$/);
  if (!match) return { quantity: parseEuroDecimal(str), revenue: 0 };
  return {
    quantity: parseEuroDecimal(match[1]),
    revenue: parseEuroDecimal(match[2])
  };
}

export function parsePercentage(value) {
  if (!value) return 0;
  return parseEuroDecimal(String(value).replace(/%/g, ""));
}

// --- Name Normalization ---

export function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/gi, " ")
    .trim()
    .toUpperCase();
}

/**
 * Parses a raw product name, extracting an optional weight prefix.
 * Returns the cleaned name and the weight in kg (null for non-weighed items).
 *
 * Handles formats like:
 *   (1360g/2,3€Kg)POTIMARRON BIO  → { name: "POTIMARRON BIO", weightKg: 1.360 }
 *   (00106g/34,68€Kg)GRUYERE      → { name: "GRUYERE", weightKg: 0.106 }
 *   (250g)BEURRE                  → { name: "BEURRE", weightKg: 0.250 }
 *   CONFITURE FRAISE              → { name: "CONFITURE FRAISE", weightKg: null }
 */
export function parseProductName(rawName) {
  let name = String(rawName || "").trim();
  let weightKg = null;

  // Weight + price prefix: (1360g/2,3€Kg)PRODUCT or (00106g/34,68€Kg)PRODUCT
  const weightPriceMatch = name.match(/^\((\d+)g\/[\d,]+.?(?:€Kg|€\/Kg|Kg)\)/i);
  if (weightPriceMatch) {
    weightKg = parseInt(weightPriceMatch[1], 10) / 1000;
    name = name.slice(weightPriceMatch[0].length).trim();
  } else {
    // Weight-only prefix: (123g)PRODUCT
    const weightOnlyMatch = name.match(/^\((\d+)g\)/i);
    if (weightOnlyMatch) {
      weightKg = parseInt(weightOnlyMatch[1], 10) / 1000;
      name = name.slice(weightOnlyMatch[0].length).trim();
    }
  }

  return { name, weightKg };
}

export function cleanProductName(rawName) {
  return parseProductName(rawName).name;
}

// --- File Type Detection ---

export function detectFileType(firstLine) {
  const lower = firstLine.toLowerCase();
  const upper = firstLine.toUpperCase();

  if (lower.includes("libelle") && (upper.includes("TOTQUT") || upper.includes("TOTCA"))) {
    return "monthly-stats";
  }
  if (upper.startsWith("ART;") && (upper.includes("QUANTITE") || upper.includes("CHIFF_AFF"))) {
    return "annual-stats";
  }
  if (upper.includes("EXPR1000") && lower.includes("article")) {
    return "transactions";
  }
  if (lower.startsWith("categorie_tva")) {
    return "category-mix";
  }
  if (lower.includes("total vente tvac") || lower.includes("marge ht")) {
    return "margin-analysis";
  }
  if (upper.startsWith("JOUR;HEURE")) {
    return "hourly-by-weekday";
  }
  // Product master: no header keywords match, many semicolons (60+ columns)
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  if (semicolonCount >= 40) {
    return "product-master";
  }
  return "unknown";
}

export function detectYearFromFilename(filename) {
  const match = String(filename).match(/(\d{4})/);
  return match ? parseInt(match[1], 10) : null;
}

// --- Junk Row Detection ---

const JUNK_PATTERNS = /^(total|nbclient|nb client|moyenne|moyenne par client|fictif|carte cadeaux|div\. ean|Designed by|#ACOMPTE)\s*$/i;

export function isJunkRow(firstCell) {
  if (!firstCell || !String(firstCell).trim()) return true;
  return JUNK_PATTERNS.test(String(firstCell).trim());
}
