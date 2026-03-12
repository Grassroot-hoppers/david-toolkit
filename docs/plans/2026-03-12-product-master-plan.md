# Product Master Sheet — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace keyword-matching product groups with a product master CSV where every product has an explicit category assignment.

**Architecture:** A script generates `product-master.csv` from existing Gold data + current keyword logic as seed. `build-demo.mjs` loads the CSV as a Map lookup instead of running regex. `product-groups.json` is deleted.

**Tech Stack:** Node.js, CSV (no new dependencies).

---

## Task 1 — Generate the seed CSV

**Files:**
- Create: `scripts/generate-product-master.mjs`
- Output: `sample-data/config/product-master.csv`

**Step 1: Write the generator script**

```js
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const goldDir = path.join(root, "data", "gold");
const configDir = path.join(root, "sample-data", "config");

const catalog = JSON.parse(fs.readFileSync(path.join(goldDir, "product-catalog.json"), "utf8"));
const groupsConfig = JSON.parse(fs.readFileSync(path.join(configDir, "product-groups.json"), "utf8"));

// Run the current keyword logic one last time to seed group assignments
function matchGroup(productName) {
  for (const [key, cfg] of Object.entries(groupsConfig)) {
    if (key === "_doc") continue;
    const keywords = cfg.keywords || [];
    const excludeKeywords = cfg.excludeKeywords || [];
    const kwPatterns = keywords.map(kw => {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(?<![a-z])${escaped}(?![a-z])`, "i");
    });
    const exPatterns = excludeKeywords.map(kw => new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    if (kwPatterns.some(re => re.test(productName)) && !exPatterns.some(re => re.test(productName))) {
      return { key, displayName: cfg.displayName };
    }
  }
  return null;
}

// Build rows: product_name, category (POS), group_key, group_display
const rows = [["product_name", "pos_category", "group_key", "group_display"]];

for (const p of catalog) {
  const name = p.name || p.key;
  const posCategory = p.category || "";
  const group = matchGroup(name);
  rows.push([
    name,
    posCategory,
    group ? group.key : "",
    group ? group.displayName : "",
  ]);
}

// Sort alphabetically by product name
rows.sort((a, b) => {
  if (a[0] === "product_name") return -1;
  if (b[0] === "product_name") return 1;
  return a[0].localeCompare(b[0], "fr");
});

// Write CSV — quote fields that contain commas
function csvLine(fields) {
  return fields.map(f => f.includes(",") || f.includes('"') ? `"${f.replace(/"/g, '""')}"` : f).join(",");
}

const csv = rows.map(csvLine).join("\n") + "\n";
const outPath = path.join(configDir, "product-master.csv");
fs.writeFileSync(outPath, csv);

// Stats
const grouped = rows.filter(r => r[2] && r[2] !== "group_key").length;
const total = rows.length - 1;
console.log(`Wrote ${outPath}`);
console.log(`  ${total} products, ${grouped} with group assignment, ${total - grouped} ungrouped`);
```

**Step 2: Run it**

```powershell
node scripts/generate-product-master.mjs
```

Expected: prints product count (~2,920) and group assignment count. Creates `sample-data/config/product-master.csv`.

**Step 3: Verify the CSV looks sane**

```powershell
node -e "const lines = require('fs').readFileSync('sample-data/config/product-master.csv','utf8').trim().split('\n'); console.log('Rows:', lines.length - 1); console.log('Header:', lines[0]); console.log('Sample:'); lines.slice(1,6).forEach(l => console.log(' ', l))"
```

Expected: header is `product_name,pos_category,group_key,group_display`, ~2,920 data rows, sample rows show real product names.

**Step 4: Verify known edge cases in the seed**

```powershell
node -e "const lines = require('fs').readFileSync('sample-data/config/product-master.csv','utf8').trim().split('\n'); for (const l of lines) { if (l.toLowerCase().includes('gaufre') || l.toLowerCase().includes('oeuf')) console.log(l); }"
```

Expected: "Gaufres Aux Oeufs" (or similar) should NOT have `oeufs` as group_key. Products like "Oeuf BIO" SHOULD have `oeufs`.

**Step 5: Commit**

```powershell
git add scripts/generate-product-master.mjs sample-data/config/product-master.csv
git commit -m "feat: generate product-master.csv seed from existing keyword logic"
```

---

## Task 2 — Write the CSV loader utility

**Files:**
- Create: `scripts/lib/product-master.mjs`

**Step 1: Write the loader**

```js
import fs from "node:fs";
import path from "node:path";

/**
 * Load product-master.csv and return two Maps:
 * - productToGroup: Map<productName, { key, displayName }>
 * - groupDefs: Map<groupKey, displayName>
 */
export function loadProductMaster(configDir) {
  const csvPath = path.join(configDir, "product-master.csv");
  if (!fs.existsSync(csvPath)) {
    console.warn("⚠ product-master.csv not found, product groups will be empty");
    return { productToGroup: new Map(), groupDefs: new Map() };
  }

  const lines = fs.readFileSync(csvPath, "utf8").trim().split("\n");
  const header = lines[0].split(",");
  const nameIdx = header.indexOf("product_name");
  const groupKeyIdx = header.indexOf("group_key");
  const groupDisplayIdx = header.indexOf("group_display");

  const productToGroup = new Map();
  const groupDefs = new Map();

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    const name = fields[nameIdx]?.trim();
    const groupKey = fields[groupKeyIdx]?.trim();
    const groupDisplay = fields[groupDisplayIdx]?.trim();
    if (!name) continue;
    if (groupKey) {
      productToGroup.set(name, { key: groupKey, displayName: groupDisplay || groupKey });
      if (!groupDefs.has(groupKey) && groupDisplay) {
        groupDefs.set(groupKey, groupDisplay);
      }
    }
  }

  return { productToGroup, groupDefs };
}

function parseCSVLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { fields.push(current); current = ""; }
      else { current += ch; }
    }
  }
  fields.push(current);
  return fields;
}
```

**Step 2: Verify with a quick smoke test**

```powershell
node -e "import('file:///c:/Users/julien/Documents/dev/david-toolkit/scripts/lib/product-master.mjs').then(m => { const { productToGroup, groupDefs } = m.loadProductMaster('sample-data/config'); console.log('Products mapped:', productToGroup.size); console.log('Groups:', [...groupDefs.entries()].map(([k,v]) => k + '=' + v).join(', ')); })"
```

Expected: prints product count and group names matching what was in `product-groups.json`.

**Step 3: Commit**

```powershell
git add scripts/lib/product-master.mjs
git commit -m "feat: add product-master.csv loader utility"
```

---

## Task 3 — Replace keyword matching in build-demo.mjs

**Files:**
- Modify: `scripts/build-demo.mjs` (lines 826–869)

**Step 1: Add the import at the top of build-demo.mjs**

At the top, after the existing imports, add:

```js
import { loadProductMaster } from "./lib/product-master.mjs";
```

**Step 2: Replace the keyword matching block (lines 826–869)**

Find this block (starts with `// Resolve product groups from config`):

```js
  // Resolve product groups from config
  const groupsConfig = JSON.parse(fs.readFileSync(path.join(configDir, "product-groups.json"), "utf8"));
  const productGroups = [];
  for (const [key, cfg] of Object.entries(groupsConfig)) {
    // ... keyword matching logic ...
  }
  productGroups.sort((a, b) => b.aggregateRevenue2025 - a.aggregateRevenue2025);
```

Replace the ENTIRE block (from `// Resolve product groups from config` through `productGroups.sort(...)`) with:

```js
  // Resolve product groups from product-master.csv
  const { productToGroup, groupDefs } = loadProductMaster(configDir);

  // Flag unclassified products
  const unclassified = products.filter(p => {
    const name = p.displayName || "";
    return name && !productToGroup.has(name);
  });
  if (unclassified.length > 0) {
    console.warn(`  ⚠ ${unclassified.length} products not in product-master.csv:`);
    for (const p of unclassified.slice(0, 10)) {
      console.warn(`    - "${p.displayName}"`);
    }
    if (unclassified.length > 10) console.warn(`    ... and ${unclassified.length - 10} more`);
  }

  // Build product groups by grouping products that share the same group_key
  const groupMap = new Map();
  for (const p of products) {
    const entry = productToGroup.get(p.displayName || "");
    if (!entry) continue;
    if (!groupMap.has(entry.key)) {
      groupMap.set(entry.key, {
        key: entry.key,
        displayName: entry.displayName,
        members: [],
      });
    }
    groupMap.get(entry.key).members.push(p);
  }

  const productGroups = [];
  for (const [key, g] of groupMap) {
    const members = g.members;
    const aggregateRevenue2025 = members.reduce((s, p) => s + p.totalRevenue, 0);
    const aggregateRevenue2024 = members.reduce((s, p) => s + (p.totalRevenuePrevious || 0), 0);

    const seasonality = Array(12).fill(0);
    for (const p of members) {
      if (!p.monthlyHistory) continue;
      for (let m = 0; m < 12; m++) {
        seasonality[m] += p.monthlyHistory[24 + m] || 0;
      }
    }

    const topMember = [...members].sort((a, b) => b.totalRevenue - a.totalRevenue)[0];
    productGroups.push({
      key,
      displayName: g.displayName,
      members: members.map(p => p.displayName),
      aggregateRevenue2025,
      aggregateRevenue2024,
      yoy: aggregateRevenue2024 > 0 ? (aggregateRevenue2025 - aggregateRevenue2024) / aggregateRevenue2024 : null,
      seasonality,
      rank: topMember.rank || "C",
    });
  }
  productGroups.sort((a, b) => b.aggregateRevenue2025 - a.aggregateRevenue2025);
```

**Step 3: Verify the build still works**

```powershell
node scripts/build-demo.mjs
```

Expected: builds successfully. May print some `⚠ UNCLASSIFIED` warnings (for products in the build's `products` array that aren't in the CSV — this is expected if the CSV was seeded from catalog but the build uses `displayName` which may differ).

**Step 4: Verify demo.json product groups are equivalent**

```powershell
node -e "const d = JSON.parse(require('fs').readFileSync('public/data/demo.json','utf8')); console.log('Groups:', d.productGroups.length); d.productGroups.forEach(g => console.log(g.key, g.members.length, 'members, rev:', Math.round(g.aggregateRevenue2025)))"
```

Expected: same groups as before (pommes, tomates, fromages, oeufs, etc.) with similar member counts and revenue. Small differences are OK if the keyword regex matched slightly differently than exact name lookup.

**Step 5: Commit**

```powershell
git add scripts/build-demo.mjs
git commit -m "feat: replace keyword matching with product-master.csv lookup in build-demo"
```

---

## Task 4 — Delete product-groups.json

**Files:**
- Delete: `sample-data/config/product-groups.json`

**Step 1: Delete the file**

```powershell
git rm sample-data/config/product-groups.json
```

**Step 2: Search for any remaining references**

```powershell
rg "product-groups" --type js
```

Expected: no hits in build-demo.mjs (we removed it in Task 3). The generator script (`generate-product-master.mjs`) still references it — that's fine, it was a one-time seed tool. Add a comment at the top of that file:

```js
// ONE-TIME SCRIPT: Generated the initial product-master.csv from keyword logic.
// product-groups.json has been deleted. This script is kept for reference only.
```

**Step 3: Verify build still works without product-groups.json**

```powershell
node scripts/build-demo.mjs
```

Expected: builds without error. No reference to product-groups.json.

**Step 4: Commit**

```powershell
git add -A
git commit -m "chore: delete product-groups.json — replaced by product-master.csv"
```

---

## Task 5 — Write edge-case tests

**Files:**
- Create: `scripts/lib/product-master.test.mjs`

**Step 1: Write the test file**

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadProductMaster } from "./product-master.mjs";

describe("product-master.csv", () => {
  const { productToGroup } = loadProductMaster("sample-data/config");

  it("loads products", () => {
    assert.ok(productToGroup.size > 100, `Expected 100+ mapped products, got ${productToGroup.size}`);
  });

  it("real eggs are in oeufs group", () => {
    // Find any product containing "oeuf" that IS in the oeufs group
    const oeufsProducts = [...productToGroup.entries()]
      .filter(([_, v]) => v.key === "oeufs")
      .map(([name]) => name);
    assert.ok(oeufsProducts.length > 0, "Expected at least 1 product in oeufs group");
    for (const name of oeufsProducts) {
      assert.ok(
        name.toLowerCase().includes("oeuf"),
        `Product "${name}" in oeufs group should contain "oeuf"`
      );
    }
  });

  it("compound egg products are NOT in oeufs group", () => {
    const compounds = ["gaufre", "crepe", "crêpe", "tarama", "mousse", "caraque"];
    for (const [name, group] of productToGroup) {
      const lower = name.toLowerCase();
      if (compounds.some(c => lower.includes(c)) && lower.includes("oeuf")) {
        assert.notEqual(group.key, "oeufs",
          `"${name}" contains egg as ingredient, should NOT be in oeufs group`);
      }
    }
  });

  it("tomate coeur de boeuf is NOT in boeuf group", () => {
    for (const [name, group] of productToGroup) {
      if (name.toLowerCase().includes("tomate") && name.toLowerCase().includes("boeuf")) {
        assert.notEqual(group.key, "boeuf",
          `"${name}" is a tomato variety, not beef`);
      }
    }
  });
});
```

**Step 2: Run the tests**

```powershell
node --test scripts/lib/product-master.test.mjs
```

Expected: all tests pass.

**Step 3: Commit**

```powershell
git add scripts/lib/product-master.test.mjs
git commit -m "test: add edge-case tests for product-master.csv classifications"
```

---

## Task 6 — Add npm script for re-seeding

**Files:**
- Modify: `package.json`

**Step 1: Add the script**

Add to the `scripts` section of `package.json`:

```json
"generate:product-master": "node scripts/generate-product-master.mjs"
```

**Step 2: Verify**

```powershell
npm run generate:product-master
```

Expected: regenerates the CSV.

**Step 3: Commit**

```powershell
git add package.json
git commit -m "chore: add npm script for product-master CSV generation"
```

---

## Time budget

| Task | Estimate |
|------|----------|
| 1 — Generate seed CSV | 5 min |
| 2 — CSV loader utility | 5 min |
| 3 — Replace keyword matching | 10 min |
| 4 — Delete product-groups.json | 3 min |
| 5 — Edge-case tests | 5 min |
| 6 — npm script | 2 min |
| **Total** | **~30 min** |
