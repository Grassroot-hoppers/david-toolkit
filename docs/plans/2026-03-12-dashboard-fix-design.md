# Dashboard Fix Design — 2026-03-12

**Goal:** Fix all broken/wrong things in `public/` dashboard (Briefing + Produits tabs), delete `demo/` entirely, make `npm run serve` serve `public/` by default.

---

## What's broken and the fix for each

### Fix 1 — Supplier ordering schedule (complete rewrite)

**Problem:** The current `suppliers` array in demo.json has wrong `orderDay` field, wrong supplier names, and the `getOrderingReminders()` function checks `orderingDays` (plural array, lowercase) while the data has `orderDay` (singular string, capitalized). Result: almost no ordering reminders show.

**Real ordering schedule** (source of truth from David):

| Day | Suppliers | Notes |
|-----|-----------|-------|
| jeudi | Gâteau Sur La Cerise, Confiserie Gourmande | — |
| vendredi | Coprosain | avant midi |
| samedi | Lalero, Gros Chêne, Jumi | avant 14h |
| samedi | Levain, Interbio, Seminibus, Pasta Mobil | Pasta Mobil avant 15h |
| mardi | Schietekat, From Un, Di Santo, Delibio, Vajra | — |

**Fix:**
1. Update `sample-data/config/supplier-map.json` — add `orderingDays: ["samedi"]` and optional `cutoff: "14:00"` to each supplier entry
2. Update `scripts/build-demo.mjs` — emit a new top-level `orderSchedule` object in demo.json: `{ lundi: [], mardi: [{name, cutoff}], ..., samedi: [{name, cutoff}] }`
3. Update `public/app.js` `getOrderingReminders()` — read from `data.orderSchedule[dayName]` instead of filtering suppliers array

**Display:** Ordering card shows supplier name + cutoff time if present (e.g. "Lalero — avant 14h")

---

### Fix 2 — Prediction calculation

**Problem:** `macro.years` includes 2026 as a partial year (88k revenue). The trend calculation uses the last two entries: 2025 full (501k) vs 2026 partial (88k) = -82%. This destroys the prediction.

**Fix:** In `public/app.js`, filter `macro.years` to exclude `isPartial: true` entries before computing yearly growth:

```js
const fullYears = data.macro?.years?.filter(y => !y.isPartial) || [];
const yearlyGrowth = fullYears.length >= 2
  ? (fullYears[fullYears.length - 1].revenue / fullYears[fullYears.length - 2].revenue) - 1
  : 0;
```

2024→2025 = +16.4%. Prediction for week 11 becomes ~7,696€ (6,610 × 1.164), which is reasonable.

---

### Fix 3 — Suggested order display (units → spend €)

**Problem:** `suggestedOrder.qty` is units (e.g. 240 eggs), displayed as `~240€` which is wrong and confusing.

**Fix:** Display as weekly spend estimate in €. The build already computes `weeklyEst` (revenue). Show it as `~Xeuro/sem` where X = rounded weekly revenue estimate. Change label in column header to "Commande suggérée".

In `public/app.js`, change `renderProductRow`:
- `~${p.suggestedOrder.qty}€` → compute spend from `suggestedOrder.qty` × unit price, OR: simpler — have `build-demo.mjs` emit a `weeklySpend` field alongside `qty`, and display that.

Simplest path: add `weeklySpend` to `suggestedOrder` in `build-demo.mjs` (the `weeklyEst * trend` value that's already computed), then display `~${Math.round(p.suggestedOrder.weeklySpend)}€` in the UI.

---

### Fix 4 — Delete demo/, update serve default

**Problem:** `demo/` is dead code. `npm run serve` still points to `demo/` by default.

**Fix:**
1. Delete `demo/` folder entirely
2. In `scripts/serve.mjs`, change default root from `"demo"` to `"public"`
3. In `package.json`, update `"serve"` script to simply `"node scripts/serve.mjs"` (no `--root` needed since default is now `public`)
4. Remove `"serve:v2"` script (redundant)

---

## Files to change

| File | Change |
|------|--------|
| `sample-data/config/supplier-map.json` | Add `orderingDays` + `cutoff` to all known suppliers |
| `scripts/build-demo.mjs` | Emit `orderSchedule` in payload; add `weeklySpend` to `suggestedOrder` |
| `public/app.js` | Fix prediction (filter partial years); fix `getOrderingReminders`; fix order display |
| `scripts/serve.mjs` | Default root → `public` |
| `package.json` | Update `serve` script; remove `serve:v2` |
| `demo/` | Delete entirely |

---

## Success criteria

- [ ] Ordering card on jeudi shows: Gâteau Sur La Cerise, Confiserie Gourmande
- [ ] Prediction shows ~7 500–8 000€ (not 1 161€)
- [ ] Suggested orders show `~Xeuro/sem` (not units)
- [ ] `npm run serve` serves `public/` at port 4173
- [ ] `demo/` folder is gone
- [ ] No JS console errors
