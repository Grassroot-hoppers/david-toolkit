/**
 * Semantic product classifier — generates product-master.csv
 *
 * Uses POS category as the primary signal, then product semantics.
 * Key insight: "TOMATE COEUR DE BOEUF" has POS cat "01. FRUIT ET LEGUME",
 * so it's correctly classified as tomates without ever needing an excludeKeyword.
 * "GAUFRES AUX OEUFS" has POS cat "05. EPICERIE SUCREE", not "02. OEUF",
 * so it's never pulled into the oeufs group.
 */

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const catalog = JSON.parse(
  fs.readFileSync(path.join(root, "data", "gold", "product-catalog.json"), "utf8")
);

const GROUP_DEFS = {
  pommes:     "Pommes",
  tomates:    "Tomates",
  fromages:   "Fromages (top)",
  oeufs:      "Oeufs",
  boeuf:      "Boeuf & Viandes",
  pates:      "Pâtes",
  huiles:     "Huiles",
  confitures: "Confitures & miels",
  chocolats:  "Chocolats",
  biscuits:   "Biscuits & gâteaux",
  vins:       "Vins",
};

function classify(name, posCategory) {
  const n = name.toUpperCase();
  const c = (posCategory || "").toUpperCase();

  // ─── OEUFS ─────────────────────────────────────────────────────────────────
  // Primary signal: POS category "02. OEUF" = actual eggs
  // Products in EPICERIE SUCREE with "oeufs" in the name are confectionery (Easter eggs)
  if (c.includes("02. OEUF")) return "oeufs";

  // ─── TOMATES ───────────────────────────────────────────────────────────────
  // Fresh/canned tomatoes — note: "TOMATE COEUR DE BOEUF" is in FRUIT ET LEGUME,
  // so it correctly goes here, never into boeuf
  if ((c.includes("FRUIT ET LEGUME") || c.includes("FRUITS ET LEGUMES")) && n.includes("TOMAT")) {
    return "tomates";
  }
  // Canned tomatoes in épicerie
  if (c.includes("EPICERIE") && (
    n.startsWith("TOMATES PELEES") ||
    n === "TOMATES PELEES EN CUBES" ||
    n.includes("POMODORI PELATI") ||
    n.includes("POMODORI SPACCATI") ||
    n.includes("DATTERINI GIALLI AL NATURALE BIO")
  )) return "tomates";

  // ─── FROMAGES (top) ────────────────────────────────────────────────────────
  // Specific cheese varieties only, not all cheeses
  if (c.includes("FROMAGE")) {
    const CHEESE_TYPES = [
      "RACLETTE", "CHEDDAR", "EMMENTAL",
      "GRUYERE", "GRUYÈRE",
      "COMTÉ", "COMTE",
      "BRIE",
      "CAMEMBERT",
      "MOZZARELLA", "MOZZA ", "MOZZA PER",
      "BURRATA",
      "PARMESAN", "PARMIGIANO",
      "GOUDA",
    ];
    if (CHEESE_TYPES.some(t => n.includes(t))) return "fromages";
  }

  // ─── BOEUF & VIANDES ───────────────────────────────────────────────────────
  // POS categories COPRO and VIANDE = butcher products
  // Only assign if product is clearly beef/veal/steak
  if (c.includes("02. COPRO") || c.includes("02. VIANDE")) {
    const BEEF_WORDS = [
      "BOEUF", "VEAU", "ENTRECOTE", "ENTRECÔTE",
      "STEAK", "FILET MIGNON", "HACHE BOEUF",
      "BOUILLI DE BOEUF", "HAMBURGER BOEUF",
      "BROCHETTES DE BOEUF", "CARBONNADE",
      "MIGNON DE BOEUF", "CONTREFILET BOEUF",
      "COPPA DE BOEUF",
    ];
    if (BEEF_WORDS.some(w => n.includes(w))) return "boeuf";
  }
  // Bouillon de boeuf in épicerie
  if (c.includes("EPICERIE") && n.includes("BOUILLON") && n.includes("BOEUF")) return "boeuf";

  // ─── PÂTES ─────────────────────────────────────────────────────────────────
  // Dry pasta only (not fresh pasta from pâte fraîche, not pasta dishes/sauces)
  if (c.includes("EPICERIE")) {
    const PASTA_SHAPES = [
      "SPAGHETTI", "PENNE ", "PENNE BIO", "FUSILLI", "RIGATONI",
      "FARFALLE", "LINGUINE", "TAGLIATELLE", "BUCATINI",
      "ORECCHIETTE", "PACCHERI", "TUBETTI", "CONCHIGLIE",
      "STROZZAPRETI", "COQUILLETTE", "ALFABETO", "SPAGHETTONI",
      "SEDANINI", "BUSIATE", "BUSIATA", "PENNE SS GLUTEN",
      "PENNE CAPPELLI", "CONCHIGLIE CAPPELLI",
      "SPAGHETTI ALLA CHITARRA", "LINGUINE A LA MAIN",
    ];
    if (PASTA_SHAPES.some(w => n.includes(w))) return "pates";
    // Lasagne sheets (not lasagne dishes)
    if (n === "PATE LASAGNE GIROLOMONI") return "pates";
    // Nidi tagliatelle
    if (n.includes("NIDI TAGLIATELLE")) return "pates";
  }

  // ─── HUILES ────────────────────────────────────────────────────────────────
  // Olive oils and cooking oils — very distinctive product names
  if (
    n.includes("HUILE D'OLIVE") ||
    n.includes("HUILE D'OLIVES") ||
    n.includes("HUILE DE TOURNESOL") ||
    n.includes("HUILE TOURNESOL") ||
    n.includes("HUILE DE NOIX") ||
    n === "HUILE DE COLZA"
  ) return "huiles";

  // ─── CONFITURES & MIELS ────────────────────────────────────────────────────
  if (n.includes("CONFITURE") || n.includes("MARMELADE") || n.includes("MARMELLATA")) {
    return "confitures";
  }
  // Honey: must start with MIEL to avoid "MIEL" in compound words like "VINAIGRETTE AU MIEL"
  if (n.startsWith("MIEL ") || n === "MIEL") return "confitures";
  // Gelée de — keyword from original config
  if (n.startsWith("GELEE DE") || n.startsWith("GELÉE DE")) return "confitures";
  // Miel soufflé products
  if (n.startsWith("MIEL SOUFFLÉ") || n.startsWith("MIEL BEELGIUM")) return "confitures";

  // ─── CHOCOLATS ─────────────────────────────────────────────────────────────
  // Chocolate tablets, pralines, chocolate confectionery
  // Only in EPICERIE SUCREE to avoid "chocolat" in drinks, granola, etc.
  if (c.includes("EPICERIE SUCREE")) {
    // Chocolate bars that start with CHOCOLAT or are clearly bars
    if (n.startsWith("CHOCOLAT ") || n.startsWith("CHOCOLAT,")) return "chocolats";
    // Dark/milk chocolate bars with percentages (NOIR 70%, LAIT 37%, etc.)
    if (/^(NOIR|LAIT)\s+\d+%/.test(n)) return "chocolats";
    // English-label chocolate bars (DARK CHOCALATE, MILK CHOCALATE)
    if (n.startsWith("DARK CHOC") || n.startsWith("MILK CHOC")) return "chocolats";
    // Pralines — Belgian chocolate pralines
    if (n.includes("PRALINE") || n.includes("PRALINÉE") || n.includes("PRALINÉS")) return "chocolats";
    // Easter chocolate eggs (OEUFS * in EPICERIE SUCREE = confectionery, not real eggs)
    if (n.startsWith("OEUFS ") && c.includes("EPICERIE SUCREE")) return "chocolats";
    if (n.startsWith("OEUF ") && c.includes("EPICERIE SUCREE")) return "chocolats";
    // Oeufs caraque, oeufs drageifiés etc.
    if (n === "OEUFS CARAQUE" || n === "OEUFS DRAGEIFIES") return "chocolats";
    // Specific praline/chocolate lines
    if (n.startsWith("NAO ") && (n.includes("CHOCOLAT") || n.includes("PRALINE") || n.includes("OEUFS"))) return "chocolats";
  }

  // ─── BISCUITS & GÂTEAUX ────────────────────────────────────────────────────
  if (c.includes("EPICERIE SUCREE")) {
    const BISCUIT_WORDS = [
      "BISCUIT", "COOKIE", "SPECULOOS", "SABLÉ", "SABLES ", "SABLÉS",
      "GAUFRE", "GAUFRINETTE", "STROOPWAFEL",
      "SHORTBREAD", "MADELEINE", "CRACKERS", "CRACKER",
    ];
    // Exclude products that are already in chocolats
    if (BISCUIT_WORDS.some(w => n.includes(w))) return "biscuits";
  }

  // ─── VINS ──────────────────────────────────────────────────────────────────
  if (c.includes("BOISSON")) {
    if (
      n.includes("CHAMPAGNE") ||
      n.includes("CRÉMANT") || n.includes("CREMANT") ||
      n.includes("PROSECCO") ||
      n.includes("CAVA ") || n === "CAVA BRUT GRAN FERRAN" ||
      n.includes("CAVA BRUT") ||
      n.includes("CLAIRETTE DE DIE")
    ) return "vins";
    // Wines: products in boisson with vintage year pattern or explicit vin/rouge/blanc/rosé
    if (n.includes("VIN BLANC") || n.includes("VIN ROUGE") ||
        n.includes("VIN ROSÉ") || n.includes("VIN ROSE")) return "vins";
    // BIB wines
    if (n.startsWith("BIB ") && (n.includes("ROUGE") || n.includes("BLANC") || n.includes("ROSE"))) return "vins";
    // Named wine regions/types
    const WINE_INDICATORS = [
      "PINOT", "CHARDONNAY", "SAUVIGNON", "MERLOT", "SYRAH", "GRENACHE",
      "CABERNET", "VIOGNIER", "RIESLING", "GEWURZTRAMINER",
      "BORDEAUX", "BOURGOGNE", "ALSACE", "SANCERRE", "CHIANTI",
      "MONTEPULCIANO", "PRIMITIVO", "NERO D'AVOLA", "BARBERA",
      "TOURAINE", "CHINON", "BEAUJOLAIS", "BEAUFORT",
    ];
    // Only apply wine indicators if product has a year (vintage) or known wine naming pattern
    if (WINE_INDICATORS.some(w => n.includes(w)) && /20\d\d|AOC|AOP|IGP|DOC|DOP/.test(n)) return "vins";
  }

  // ─── POMMES ────────────────────────────────────────────────────────────────
  if (c.includes("FRUIT ET LEGUME") || c.includes("FRUITS ET LEGUMES")) {
    if (n.startsWith("POMME ")) return "pommes";
  }
  // Apple products
  if (n.startsWith("COMPOTE DE POMMES")) return "pommes";
  if (n.startsWith("PUREE DE POMMES")) return "pommes";
  if (n.includes("POMMES SECHEES")) return "pommes";

  return null;
}

// ─── Generate CSV ─────────────────────────────────────────────────────────────

const rows = [["product_name", "pos_category", "group_key", "group_display"]];

for (const p of catalog) {
  const name = (p.name || p.key || "").trim();
  const posCategory = (p.category || "").trim();
  if (!name) continue;

  const groupKey = classify(name, posCategory);
  const groupDisplay = groupKey ? GROUP_DEFS[groupKey] : "";

  rows.push([name, posCategory, groupKey || "", groupDisplay]);
}

// Sort: header first, then alphabetically
rows.sort((a, b) => {
  if (a[0] === "product_name") return -1;
  if (b[0] === "product_name") return 1;
  return a[0].localeCompare(b[0], "fr");
});

function csvField(f) {
  if (f.includes(",") || f.includes('"') || f.includes("\n")) {
    return `"${f.replace(/"/g, '""')}"`;
  }
  return f;
}

const csv = rows.map(r => r.map(csvField).join(",")).join("\n") + "\n";
const outPath = path.join(root, "sample-data", "config", "product-master.csv");
fs.writeFileSync(outPath, csv, "utf8");

// Stats
const grouped = rows.filter(r => r[2] && r[2] !== "group_key");
const byGroup = {};
for (const [, , key] of grouped) {
  byGroup[key] = (byGroup[key] || 0) + 1;
}

console.log(`\nWrote ${outPath}`);
console.log(`  ${rows.length - 1} products total`);
console.log(`  ${grouped.length} assigned to a group`);
console.log(`  ${rows.length - 1 - grouped.length} unassigned (no group)`);
console.log("\nGroups:");
for (const [key, count] of Object.entries(byGroup).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${key.padEnd(12)} ${String(count).padStart(4)} products  (${GROUP_DEFS[key]})`);
}

// Verify known edge cases
console.log("\n--- Edge case verification ---");
const productMap = new Map(rows.slice(1).map(r => [r[0], r[2]]));
const checks = [
  ["GAUFRES AUX OEUFS BIO",         "biscuits",  "gaufres = waffles, should be in biscuits not oeufs"],
  ["GAUFRES AUX OEUFS CHOCO BIO",   "biscuits",  "gaufres choco = waffles, should be in biscuits not oeufs"],
  ["CREPE AUX OEUFS BIO",           null,       "crêpe should NOT be in oeufs"],
  ["TARAMA AUX OEUFS DE TRUITE 100G", null,     "tarama should NOT be in oeufs"],
  ["OEUFS CARAQUE",                 "chocolats","Easter choc eggs should be in chocolats"],
  ["OEUF BIO",                      "oeufs",    "real eggs should be in oeufs"],
  ["BOITE 6 OEUFS BIO",             "oeufs",    "real eggs should be in oeufs"],
  ["10 OEUFS BIO",                  "oeufs",    "real eggs should be in oeufs"],
  ["TOMATE COEUR DE BOEUF BIO",     "tomates",  "Coeur de Boeuf is a tomato variety"],
  ["TOMATE GRAPPE IT BIO",          "tomates",  "fresh tomato should be in tomates"],
  ["FILET MIGNON DE BOEUF",         "boeuf",    "beef should be in boeuf"],
  ["BOUILLON DE BOEUF FERMIER",     "boeuf",    "beef bouillon should be in boeuf"],
  ["SPAGHETTI GIROLOMONI",          "pates",    "spaghetti should be in pates"],
  ["FUSILLI GIROLOMONI",            "pates",    "fusilli should be in pates"],
  ["MIEL D'ORANGER SICILE",         "confitures","honey should be in confitures"],
  ["CONFITURE FRAMBOISE 80%",       "confitures","jam should be in confitures"],
  ["VINAIGRETTE AU MIEL BIO 25CL",  null,       "vinaigrette au miel should NOT be in confitures"],
];

let passed = 0;
let failed = 0;
for (const [name, expected, desc] of checks) {
  const actual = productMap.get(name) || null;
  const ok = actual === expected;
  if (ok) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}`);
    console.log(`    expected: ${expected ?? "(no group)"}, got: ${actual ?? "(no group)"}`);
    console.log(`    ${desc}`);
    failed++;
  }
}
console.log(`\n${passed}/${passed + failed} checks passed`);
