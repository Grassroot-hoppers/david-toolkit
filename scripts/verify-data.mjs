import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const payload = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "data", "demo.json"), "utf8"));

assert.equal(payload.store, "Chez Julien");
assert.ok(payload.suppliers.length >= 4, "expected supplier panels");
assert.ok(payload.topProducts.length >= 6, "expected top products");
assert.ok(payload.insights.every((card) => card.evidence.length >= 3), "expected evidence-backed insights");
assert.ok(payload.topProducts.some((product) => product.action === "order"), "expected at least one order signal");
assert.ok(payload.categoryMix.some((category) => category.category.includes("FROMAGE")), "expected cheese category mix");

console.log("Data verification passed.");

