# Product Master Sheet — Design

## Problem

The dashboard classifies products into groups using keyword matching (`product-groups.json`). Every time a French product name reuses a food word in a compound way ("Gaufres Aux Oeufs" → matched to Oeufs instead of left alone), someone has to add an `excludeKeywords` entry, rebuild, and redeploy. The exception list grows forever. This is a data problem being solved with code.

## Solution

Create a **product master CSV** — one row per product, with an explicit category. The dashboard reads from this file. No keyword logic. No guessing.

```
product_name,category
Oeuf BIO,Oeufs
Boite 6 Oeufs BIO,Oeufs
10 Oeufs BIO,Oeufs
Gaufres Aux Oeufs,Épicerie Sucrée
Crepe Aux Oeufs BIO,Épicerie Sucrée
Tarama Aux Oeufs De Truite,Traiteur
Mozzarella Di Bufala,Fromages
Comté 18 Mois,Fromages
```

That's it. Product name → category. A human edits this file. The build reads it.

## How it works

1. **Generate the seed file.** A script extracts every unique product name from the existing Gold data. It runs the current keyword logic one last time to pre-fill categories. Output: `sample-data/config/product-master.csv` with ~2,000 rows, most already correct.

2. **Replace the keyword engine.** `build-demo.mjs` loads the CSV, builds a `Map<productName, category>`. For product groups in the dashboard, it groups by category. No regex, no excludeKeywords.

3. **Delete `product-groups.json`.** Gone. All the keyword/exclude logic in `build-demo.mjs` (lines 826–869) is replaced with a Map lookup.

4. **Handle new products.** When a new product appears in a CSV import that isn't in the master file, the build logs `⚠ UNCLASSIFIED: "Pâté En Croûte Maison"`. You add one row to the CSV, rebuild. Done.

## What stays the same

- The Bronze → Silver → Gold pipeline — untouched
- POS categories from `category-overrides.json` — untouched
- The `productGroups[]` shape in `demo.json` — same structure, built from CSV instead of regex
- Tab 2 accordion, sparklines, ABCD ranking — unchanged
- Everything in `public/` — unchanged

## File

`sample-data/config/product-master.csv` — committed to git, editable in any spreadsheet app or text editor.

## Verification

A test file encodes known edge cases:

```js
test('compound names are not misclassified', () => {
  const master = loadProductMaster();
  expect(master.get('Gaufres Aux Oeufs')).not.toBe('Oeufs');
  expect(master.get('Oeuf BIO')).toBe('Oeufs');
  expect(master.get('Tomate Coeur De Boeuf')).not.toBe('Boeuf & Viandes');
});
```

## Why this kills the tech debt

- Fixing a misclassification = editing one cell, not writing code
- Adding 100 new products = adding 100 rows, not debugging 100 keyword collisions
- Anyone can edit it — no developer needed
- If someone forks the repo, they bring their own product master with their own categories
