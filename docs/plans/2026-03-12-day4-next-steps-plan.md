# Day 4 — Rush to MVP: Tab 1 & Tab 2 Correct, Good, Usable

**Date:** 2026-03-12  
**Goal:** Make Briefing (Tab 1) and Produits (Tab 2) correct, good, and usable. They are bare-bones today; Day 4 is the polish pass that gets them to MVP quality.

**Out of scope:** Tabs 3–7 (stay stubs), new features, transaction-first pipeline. Only Tab 1 and Tab 2.

**Validation:** Cross-analysis report in `docs/references/perplexity-day4-mvp-polish-validation.md`. Key changes incorporated below: CSS Grid `min()` wrapper, ISO week function, error-state hierarchy, optional schemaVersion.

---

## 1. Current state

- **Tab 1 (Briefing):** Date, performance gauge (last week vs same week last year, YoY, zone), MTD, next-week prediction, ordering reminders, weather (top bar + optional rain card). Logic and data binding may have bugs; layout may break on small screens.
- **Tab 2 (Produits):** Search, rank filters (A/B/C/D), category filter, product groups (expand/collapse), product rows (rank, name, category, revenue, growth, sparkline, suggested order). Possible bugs: group members matching (`g.members` vs product `name`), suggested order showing `qty` as €; layout and empty states may be rough.

---

## 2. Definition of done for Day 4

| Dimension | Tab 1 (Briefing) | Tab 2 (Produits) |
|------------|------------------|------------------|
| **Correct** | Data binding matches demo.json; prediction uses correct week; ordering reminders show when suppliers have today in orderingDays; no wrong field names. | Product list and filters use correct fields (name, category, rank, revenue2025, growth, suggestedOrder); group expand shows the right products (member match by name/displayName); suggested order displays sensibly (qty or €). |
| **Good** | Layout works on narrow viewport; cards don’t overflow; empty/insufficient data shows a clear message, not broken layout. | Table/list readable; no horizontal scroll at ~1024px; empty search/filter shows message; group expand doesn’t break. |
| **Usable** | User can read “how did we do this week” and “who to order from today” at a glance. | User can find products, filter by rank/category, see growth and suggested order without confusion. |

---

## 3. Phase 1 — Correct (data & logic)

### 1.1 — Audit demo.json shape vs Tab 1

**Files:** `scripts/build-demo.mjs` (reference), `public/app.js` (Tab 1).

- Confirm `weeklyMetrics`: `lastWeekRevenue`, `sameWeekLastYear`, `weekYoY`, `mtdRevenue`, `mtdYoY`.
- Confirm `macro.years[]` for prediction (year-over-year trend).
- Confirm `suppliers[]`: each has `name` or `supplier` and `orderingDays` (array of French day names).
- Fix any mismatch: e.g. if payload uses `supplier` but UI expects `name`, use one consistently in `getOrderingReminders` and rendering.

**Verification:** Run `npm run build:full`, open Tab 1; check ordering reminders and prediction numbers against a known week.

### 1.2 — Prediction week label

**Files:** `public/app.js`.

- Use an explicit ISO 8601 week function (validation: ISO matches Belgian/French retail). Replace or augment getWeekNumber with an ISO week calculator so the prediction label is unambiguously next week. Card says "PRÉVISION SEMAINE ${weekNum + 1}". If we’re in week 11, that’s “Semaine 12” — confirm that’s “next week” in your locale (ISO week vs local). If wrong, use explicit “Semaine prochaine” or compute next week number.

**Verification:** Check that the label matches the intended week at year boundaries.

### 1.3 — Tab 2: product field names and group member match

**Files:** `public/app.js`, `scripts/build-demo.mjs`.

- Products in payload: `name`, `category`, `rank`, `revenue2025`, `growth`, `monthlyHistory`, `suggestedOrder`. Confirm `renderProductRow` and filters use these (not `displayName` unless payload sends it).
- Group members: `productGroups[].members` are displayNames (build-demo). Match to products via fallback `(p.displayName || p.name)` in filters and expand. For robustness, optional: build a `Map` from both `name` and `displayName` to product and resolve `group.members` with `productMap.get(key)` so both keys work.

**Verification:** Expand a product group; members listed in the group should appear.

### 1.4 — Suggested order display

**Files:** `public/app.js`, `scripts/build-demo.mjs`.

- build-demo emits `suggestedOrder: { qty, basis }` — qty may be units or a revenue-based number. Current UI shows `~${p.suggestedOrder.qty}€` which implies euros. If qty is units, show e.g. `~${p.suggestedOrder.qty} u.` and keep basis in title; if it’s revenue, keep `~${p.suggestedOrder.qty}€`. Decide from build-demo logic and document in plan.

**Verification:** A+B products with suggestedOrder show a sensible value and tooltip.

---

## 4. Phase 2 — Good (layout & robustness)

### 2.1 — Viewport and Tab 1 layout

**Files:** `public/index.html`, `public/styles.css`.

- **Viewport (critical):** Replace `width=1440` with `width=device-width, initial-scale=1`. Without this, no responsive work takes effect on mobile.
- Briefing grid: use `grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr))` so items never overflow when container is narrower than 280px (validation: plain `minmax(280px, 1fr)` can cause horizontal scroll below 280px).

**Verification:** Resize to ~360px and ~768px; no horizontal scroll; cards stack.

### 2.2 — Tab 2 layout

**Files:** `public/styles.css`, `public/app.js` (if needed).

- Products list/table: at ~1024px, all columns (rank, name, category, revenue, growth, sparkline, order) visible without horizontal scroll, or collapse to a card layout on narrow.
- Rank filters and category dropdown: wrap or scroll on small screens so they don’t break the layout.

**Verification:** Resize; product rows readable; filters usable.

### 2.3 — Empty and error states (hierarchy)

**Files:** `public/app.js`.

Apply in order (validation: fetch failure must block all tab rendering). (1) **Fetch failure:** Add `.catch()` to the demo.json fetch; on failure render full-page "Données indisponibles. Vérifiez que le pipeline a été exécuté." and do not call renderBriefing/renderProducts/renderStubs. (2) **Missing section:** Tab-level "Données insuffisantes" in Briefing; hide prediction card if no macro. (3) **Empty filter:** Tab 2 inline "Aucun produit" or "Aucun produit pour ce filtre".

- Tab 1: If `weeklyMetrics` is null or missing, show “Données insuffisantes” (or similar) instead of “— —” everywhere; same for missing macro (prediction card can hide).
- Tab 2: If `products.length === 0` or filtered list is empty, show “Aucun produit” (or “Aucun produit pour ce filtre”) instead of a blank area.
- If `fetch("data/demo.json")` fails, show a single message (e.g. in the main content area) “Données indisponibles. Vérifiez que le pipeline a été exécuté.” and avoid rendering broken tabs.

**Verification:** Point to missing/invalid demo.json or filter to no results; see clear message.

---

## 5. Phase 3 — Usable (copy & quick wins)

### 3.1 — Labels and tooltips

**Files:** `public/app.js`, `public/index.html` if needed.

- Briefing: Ensure “vs … l’an passé” and “Zone verte/bleue/rouge” are clear; MTD label understandable.
- Produits: Suggested order tooltip (`title`) shows `suggestedOrder.basis`; column headers or placeholders obvious (e.g. “Commande suggérée”).

**Verification:** Quick read-through; no ambiguous labels.

### 3.2 — Console and a11y

**Files:** `public/app.js`, `public/index.html`, `public/styles.css`.

- No JavaScript errors in console when loading and switching tabs.
- Focus styles: use `:focus-visible` so keyboard users get a visible outline without focus ring on mouse click. Example: `button:focus-visible, [role="tab"]:focus-visible { outline: 2px solid var(--zone-bleu); outline-offset: 2px; }` for tab buttons, rank filters, group expand.
- ARIA: set `aria-selected="true"` on active tab, `aria-selected="false"` on others; ensure tab buttons have `role="tab"` if not native semantics.

**Verification:** Open DevTools; run through Tab 1 and Tab 2 with keyboard; fix any errors.

---

## 6. Success criteria (Day 4 exit)

- [ ] Tab 1: Correct data (ordering reminders, prediction, performance numbers); works with real demo.json; layout responsive; clear when data is missing.
- [ ] Tab 2: Correct product and group data; filters and expand work; suggested order display and tooltip correct; layout usable at 1024px and narrow; empty state when no products.
- [ ] No console errors; fetch failure handled.
- [ ] Changes committed; short note in DEV_LOG that Day 4 = Tab 1 & Tab 2 MVP polish.

---

## 7. Order of work

1. Phase 1 (correct) — fixes bugs and data binding so both tabs show the right numbers and list.
2. Phase 2 (good) — viewport, grid, and empty/error states so layout and robustness are solid.
3. Phase 3 (usable) — labels, tooltips, console clean, optional a11y.

Estimate: about 2–3 hours if data shape is mostly aligned; up to 4 if several binding/display fixes are needed.
