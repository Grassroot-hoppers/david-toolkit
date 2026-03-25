import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const configDir = path.join(root, "sample-data", "config");

export function loadMasterConfig() {
  const productCorrections = readJsonSafe(path.join(configDir, "product-corrections.json"), {});
  const categoryOverrides = readJsonSafe(path.join(configDir, "category-overrides.json"), {});
  const supplierMap = readJsonSafe(path.join(configDir, "supplier-map.json"), {});

  const skuMerges = buildSkuMergeMap(productCorrections._meta?.skuMerges || []);
  const keywordRules = (categoryOverrides.keywordFallback || []).map((rule) => ({
    target: rule.target,
    pattern: new RegExp(rule.keywords.join("|"), "i"),
  }));
  const junkCategories = new Set(
    (categoryOverrides.junkCategories || []).map((c) => c.toUpperCase())
  );
  const productCategoryOverrides = categoryOverrides.productOverrides || {};
  const crossRefConfig = categoryOverrides.crossReference || { enabled: false };

  return {
    productCorrections,
    categoryOverrides,
    supplierMap,
    skuMerges,
    keywordRules,
    junkCategories,
    productCategoryOverrides,
    crossRefConfig,
  };
}

function buildSkuMergeMap(merges) {
  const map = new Map();
  for (const merge of merges) {
    for (const alias of merge.aliases || []) {
      map.set(alias.toUpperCase(), merge.canonical.toUpperCase());
    }
  }
  return map;
}

export function applyCategoryOverride(productKey, currentCategory, categoryLookup, config) {
  if (config.productCategoryOverrides[productKey]) {
    return { category: config.productCategoryOverrides[productKey], source: "product-override" };
  }

  if (
    config.crossRefConfig.enabled &&
    currentCategory.toUpperCase() === (config.crossRefConfig.targetCategory || "").toUpperCase()
  ) {
    const crossRefCat = categoryLookup.get(productKey);
    if (crossRefCat && crossRefCat.toUpperCase() !== currentCategory.toUpperCase()) {
      return { category: crossRefCat, source: "cross-reference" };
    }
    for (const rule of config.keywordRules) {
      if (rule.pattern.test(productKey)) {
        return { category: rule.target, source: "keyword" };
      }
    }
    return { category: currentCategory, source: "unmatched" };
  }

  return { category: currentCategory, source: "original" };
}

export function resolveSkuMerge(key, skuMerges) {
  return skuMerges.get(key.toUpperCase()) || key;
}

function readJsonSafe(fp, fallback) {
  if (!fs.existsSync(fp)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(fp, "utf8"));
  } catch {
    console.warn(`  ⚠ Failed to parse config file: ${fp} — using defaults`);
    return fallback;
  }
}
