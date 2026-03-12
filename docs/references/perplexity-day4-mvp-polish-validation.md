# David Toolkit MVP Polish Plan — Cross-Analysis Report

## Executive Summary

This report cross-analyzes the one-day polish plan for David Toolkit's Briefing (Tab 1) and Products (Tab 2) dashboard against real-world evidence, comparable projects, and technical benchmarks. The plan is fundamentally sound: vanilla HTML/CSS/JS is a validated architecture for this scale, the phased approach (Correct → Good → Usable) is well-sequenced, and most assumptions hold. Three findings require immediate attention: the CSS Grid `minmax()` pattern will cause overflow below 280px unless wrapped in `min()`, the `name`/`displayName` mismatch in product groups is a known class of data-binding bugs requiring explicit fallback logic, and the viewport meta fix is the single highest-impact change for responsive behavior.

***

## Prior Art & Comparable Projects

The plan's architecture — vanilla JS dashboard with tabs, filters, and JSON data — is not novel and has multiple successful precedents. **DashboardJS** is an open-source, zero-dependency vanilla JS dashboard component that handles tabbed recordsets with pagination, sorting, filtering, and card/list views, closely matching David Toolkit's scope. **PlainAdmin** is a vanilla JS admin template built on Bootstrap 5 with dashboard components, charts, and UI elements, demonstrating that framework-free dashboards are viable at production scale.[1][2][3]

A developer built **Dashboardy**, a complete dashboard SPA from scratch in vanilla JS with 40+ tests and zero dependencies, featuring project tracking, tasks, employees, and payrolls — a comparable complexity level to the two-tab David Toolkit. Another developer's **vanilla JS intranet dashboard** achieved 95+ Lighthouse performance scores using CSS Grid and Flexbox, with progressive enhancement and WCAG-compliant focus indicators — directly validating the Phase 3 accessibility approach in this plan.[4][5]

### What worked in comparable projects

- CSS Grid and Flexbox for layout instead of heavier frameworks consistently yields high performance scores[5]
- Tab components in vanilla JS are straightforward to implement with data-driven patterns and event delegation[6][7]
- Zero-dependency dashboards load faster and have simpler deployment — a key advantage for the static-serve model[4]

### What failed or required workaround

- Client-side filtering of thousands of DOM elements degrades performance — but this becomes an issue only above ~800-1000 rows, well beyond David Toolkit's 150-product scope[8][9]
- Vanilla JS SPAs with routing, state management, and complex DOM updates require careful architecture. However, David Toolkit's two-tab structure avoids these pitfalls entirely — no routing, no deep state trees, no complex transitions[10]

### How this plan differs

David Toolkit is notably simpler than most comparable projects because it has no backend API, no authentication, no routing, and a single JSON fetch. This simplicity is a strategic advantage for AGPL-3.0 contributor-friendliness: any developer can clone the repo, modify the HTML/JS, and understand the entire codebase in under an hour. The plan correctly keeps this simplicity as a feature, not a limitation.

***

## Architecture Validation

### Vanilla JS + Single Fetch + Client-Side Render

The architecture of loading a single `demo.json` at page load and rendering everything client-side is well-suited to this use case. Modern browsers parse JSON extremely efficiently: Google's Chrome Dev Summit benchmarks show V8 parses an 8MB JSON payload in ~150ms on cold load. David Toolkit's estimated payload of ~64KB would parse in approximately 1-2ms — effectively instantaneous.[11][12]

State management without a framework is feasible at this complexity level. A reactive state pattern can be implemented in under 100 lines of vanilla JS using a simple publish/subscribe model. For David Toolkit's scope (two tabs, rank filters, category dropdown, expandable groups), even a formal reactive store is overkill — direct DOM manipulation with event listeners on filter controls is sufficient and more transparent for contributors.[13]

The single-fetch pattern has a known failure mode: if `fetch()` has no `.catch()`, an unhandled rejection leaves a blank page. The plan correctly identifies this in Phase 2 and prescribes a single inline error message. For a tool where the operator controls when the pipeline runs, this is appropriate.[14]

### Scale Assessment: ~150 Products, Filters, Expandable Groups

Filtering an array of 150 objects and re-rendering the matching rows is trivial for modern JavaScript engines. Performance issues with client-side filtering typically surface only at 10,000+ items when combined with complex DOM updates. At 150 items, even a naive `Array.filter()` + full DOM rebuild on every filter change will execute in under 5ms.[15]

The estimated DOM element count for the Products tab is ~1,525 elements (150 rows × ~8 elements + sparkline SVGs + chrome). This is well within acceptable limits. Browser rendering issues typically begin around 1,500-3,000 DOM nodes for complex layouts, but David Toolkit's rows are simple table/card structures without heavy CSS effects.[16][8]

***

## Assumption Stress-Test

### Assumption 1: Vanilla JS Sufficient for Two-Tab Dashboard

**CONFIRMED.** Multiple production examples validate this: DashboardJS handles the exact pattern (tabs, filtering, pagination, card/list views) in vanilla JS with zero dependencies. The vanilla JS intranet dashboard achieved Lighthouse 95+ scores. The key constraint is that complexity must stay contained — adding routing, deep state trees, or real-time data would tip the balance toward a minimal framework like VanJS (1.0kB reactive layer). For the current scope, vanilla JS is the right choice.[17][2][5][1]

### Assumption 2: CSS Grid `repeat(auto-fill, minmax(280px, 1fr))` Responsive Without Overflow

**PARTIALLY CONFIRMED — REQUIRES FIX.** This pattern works correctly from 1440px down to ~280px viewport width. However, when the container width is narrower than the `minmax()` minimum (280px), grid items overflow the container rather than shrinking below that minimum. At 360px with default body margins/padding, the available content width is approximately 328-344px, which is above 280px — so it will technically work. But it is fragile: any additional padding, borders, or nested containers could push the available width below 280px and cause horizontal scroll.[18][19]

**Recommended fix:** Replace `minmax(280px, 1fr)` with `minmax(min(100%, 280px), 1fr)`. The `min()` function ensures grid items never exceed their container width, preventing overflow at any viewport. All modern browsers (Chrome 79+, Firefox 75+, Safari 11.1+) support `min()` inside `grid-template-columns`.[20][21]

```css
/* Plan's version (fragile below 280px) */
grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));

/* Recommended version (safe at any width) */
grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
```

### Assumption 3: Single Fetch, No Loading Skeleton — Acceptable UX

**CONFIRMED FOR v0.1 WITH CAVEATS.** Skeleton screens improve perceived performance and are considered best practice for content-heavy pages. However, `demo.json` is served from a local static server, meaning load time is typically <50ms. At that speed, a skeleton screen would flash and disappear before users register it, which can be more jarring than a brief blank state. For v0.1, the plan's approach is correct. If David Toolkit later loads data from a remote API or grows in payload size, adding a skeleton becomes a priority.[22][23]

### Assumption 4: 200 DOM Rows Without Virtualization

**CONFIRMED.** Virtualization (rendering only visible rows) is recommended for lists exceeding 800-2,000 items. At 200 rows, the DOM handles rendering, scrolling, and repainting without performance issues on modern desktop and tablet hardware. A Reddit thread on filtering vanilla JS cards confirms that performance issues only surfaced at 10,000 cards, and were resolved by lazy rendering — not even needed at 200.[24][25][9][8]

### Assumption 5: Payload Parse + Render Causes No Jank

**CONFIRMED.** The estimated payload size of ~64KB parses in approximately 1-2ms on V8. Even pessimistic estimates (including gzip decompression overhead on a low-end tablet) would not exceed 10ms. Google's JSON.parse benchmarks show that even 8MB payloads parse in under 160ms across all major engines. The rendering phase (building ~1,525 DOM elements) adds another 5-15ms on typical hardware. Total time from fetch to rendered dashboard: under 100ms on any modern device.[26][12]

| Metric | Estimate | Threshold for Concern |
|---|---|---|
| Payload size | ~64 KB | >1 MB |
| JSON.parse time | ~1-2 ms | >100 ms |
| DOM elements (Products tab) | ~1,525 | >3,000-5,000 |
| Filter + re-render time | <5 ms | >50 ms |
| Sparkline SVG paths | 150 | >500 |

### Assumption 6: Fetch Failure With Single Message, No Retry

**ACCEPTABLE FOR CONTEXT.** Best practice in general web development is to implement retry with exponential backoff and friendly messaging. However, David Toolkit's context is specific: the operator runs `build-demo.mjs` locally, then opens the dashboard. If `demo.json` doesn't exist, it means the pipeline hasn't been run — retrying won't help. The plan's prescribed message ("Données indisponibles. Vérifiez que le pipeline a été exécuté.") is correct and actionable for this user.[27][28][14]

### Assumption 7: French Labels Correct for Belgian/French Operators

**CONFIRMED.** Belgian French uses the same day names (lundi, mardi, mercredi, etc.) and terminology as standard French. The locale code `fr-BE` differs from `fr-FR` primarily in number/currency formatting (Belgian convention uses comma for decimal, period for thousands — same as France) and some vocabulary differences that do not affect the labels in scope. Terms like "vs … l'an passé", "Données insuffisantes", "Aucun produit" are correct standard French understood by all francophone Belgian operators. No i18n framework is needed for this scope.[29][30][31]

### Assumption 8: ISO Week Number Matches Business Definition

**CONFIRMED WITH NUANCE.** ISO 8601 defines weeks as Monday–Sunday, with week 1 being the week containing January 4. Belgium and France follow the ISO convention: the Tableau ISO-8601 calendar documentation explicitly notes that retail and financial sectors use ISO weeks for sales reporting. A French tool confirms that the current week (March 12, 2026) is ISO Week 11 (Monday March 9 – Sunday March 15).[32][33][34][35][36]

**The nuance:** JavaScript's `Date.getDay()` returns 0 for Sunday, which is the US convention. To compute ISO week numbers, the plan should use a dedicated function rather than relying on locale-dependent `toLocaleDateString('fr-BE', { week: ... })`, which may not exist in all browsers. A 10-line ISO week calculator is the safe approach:

```javascript
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
```

### Assumption 9: 360px Minimum Viewport Sufficient

**CONFIRMED.** As of February 2026, the most common mobile viewport widths globally are 414px (11.8%), 360px (9.87%), and 390px (6.87%). The 360px width remains the most widespread across mid-range Android devices. Devices with 320px viewports (older iPhones SE, budget Android) represent a negligible market share in 2026. For an operator tool targeting shop owners using desktop, tablet, or modern phones, 360px is an appropriate floor.[37][38]

### Assumption 10: Payload Shape Stable During Implementation

**CANNOT VALIDATE EXTERNALLY.** This is an internal assumption dependent on `build-demo.mjs` not changing during the one-day polish sprint. Since Julien controls both the pipeline and the dashboard, this is a reasonable assumption. Recommendation: freeze the `build-demo.mjs` output schema before starting the polish pass, and add a version field to `demo.json` (e.g., `"schemaVersion": "0.1"`) for future-proofing.

### Assumption 11: Optional a11y Sufficient for v0.1

**CONFIRMED.** Focus styles and `aria-selected` on active tabs provide a meaningful baseline. WCAG 2.4.11 (Focus Not Obscured) is Level AA and requires that focus indicators be visible and not hidden by other content. Adding `outline: 2px solid` or equivalent on `:focus-visible` for tab buttons, rank filters, and expand buttons satisfies the minimum requirement. Full WCAG 2.4.13 (Focus Appearance, Level AAA) requires minimum contrast areas for focus indicators — this can be deferred to post-MVP.[39][40]

A practical implementation:

```css
button:focus-visible, [role="tab"]:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}
```

***

## Phase-by-Phase Risk Assessment

### Phase 1 — Correct (Data & Logic)

| Task | Risk | Mitigation |
|---|---|---|
| Audit demo.json shape vs Tab 1 fields | Low | Straightforward field mapping |
| Fix name/displayName mismatch in groups | **Medium** | Use fallback: `product.displayName \|\| product.name` when matching group members to products. This is a common data-binding pattern where internal keys (`name`) diverge from display labels (`displayName`)[41] |
| Prediction week label (ISO vs local) | **Medium** | Use explicit ISO week calculation function rather than locale-dependent APIs[34][36] |
| Supplier ordering day names | Low | French day names are unambiguous[30] |
| Suggested order €/qty confirmation | Low | Document in code comment and tooltip |

### Phase 2 — Good (Layout & Robustness)

| Task | Risk | Mitigation |
|---|---|---|
| Viewport meta fix | **Critical (easy fix)** | Replace `width=1440` with `width=device-width, initial-scale=1`[42]. This single change unlocks all media queries and responsive behavior. Without it, no other responsive work takes effect on mobile. |
| CSS Grid responsive briefing | Low-Medium | Use `minmax(min(100%, 280px), 1fr)` to prevent overflow[20]. Test at 360px, 768px, 1440px. |
| Product list readable at 1024px | Low | Table columns collapse or transition to card layout below breakpoint |
| Empty/error states | Low | Follow established empty state patterns: explain why it's empty, suggest next action[43][44] |
| Fetch failure handling | Low | Add `.catch()` to fetch, render inline message, prevent broken tab rendering |

### Phase 3 — Usable (Copy & a11y)

| Task | Risk | Mitigation |
|---|---|---|
| Labels and tooltips | Low | French copy is correct for target audience[30] |
| Console errors | Low | Standard debugging |
| Focus styles | Low | Use `:focus-visible` to avoid focus rings on mouse click while maintaining keyboard accessibility[39] |
| aria-selected on tabs | Low | `setAttribute('aria-selected', 'true')` on active tab, `'false'` on others[45] |

***

## Concrete Improvements to the Plan

### 1. CSS Grid Overflow Prevention (Phase 2)

The plan specifies `repeat(auto-fill, minmax(280px, 1fr))` but does not account for the known CSS Grid overflow when the container is narrower than the minmax minimum. Add the `min()` wrapper:

```css
.briefing-grid {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
}
```

### 2. Product Group Member Matching (Phase 1)

The plan identifies the `name`/`displayName` mismatch but should specify the resolution pattern: match group members against products using a normalized key lookup, not string equality on a single field.

```javascript
// Build lookup map once
const productMap = new Map();
products.forEach(p => {
  productMap.set(p.name, p);
  if (p.displayName) productMap.set(p.displayName, p);
});

// Resolve group members
group.members.map(key => productMap.get(key)).filter(Boolean);
```

### 3. Schema Version in demo.json (Phase 1)

Add a top-level `schemaVersion` field to `demo.json` to enable future compatibility checks and guard against silent payload shape changes.

### 4. Explicit ISO Week Function (Phase 1)

Rather than relying on `Intl.DateTimeFormat` or locale-dependent date methods, include a pure ISO 8601 week calculator as specified in the Assumption 8 section above.

### 5. Error State Hierarchy (Phase 2)

The plan lists error messages but should specify precedence: fetch failure should block all tab rendering (not just show a message within tabs). The hierarchy should be:

1. **Fetch failure** → full-page message: "Données indisponibles. Vérifiez que le pipeline a été exécuté."
2. **Missing section** (e.g., no `weeklyMetrics`) → tab-level: "Données insuffisantes"
3. **Empty filter result** → inline within tab: "Aucun produit pour ce filtre"

***

## Feasibility Assessment

The one-day timeline is ambitious but achievable for a single developer familiar with the codebase. The plan is well-sequenced: Phase 1 (data correctness) must come first because layout work on incorrect data wastes effort. Phase 2 (responsive layout) is the highest-effort phase but benefits from the fact that most changes are CSS-only. Phase 3 (copy and a11y) is low-risk polish.

**Time estimate breakdown:**

| Phase | Estimated Hours | Confidence |
|---|---|---|
| Phase 1 — Correct | 2-3 hours | High |
| Phase 2 — Good | 3-4 hours | Medium (CSS debugging can expand) |
| Phase 3 — Usable | 1-2 hours | High |
| Testing across breakpoints | 1 hour | High |
| DEV_LOG + commit | 0.5 hours | High |
| **Total** | **7.5-10.5 hours** | — |

The main risk to the timeline is CSS debugging at breakpoints — responsive layout work often surfaces unexpected interactions between grid areas, overflow, and content width. The `min()` fix recommended above should reduce this risk significantly.

***

## Conclusion

The implementation plan is well-structured, correctly scoped, and addresses the right priorities for an MVP polish pass. All 11 assumptions are validated or acceptably bounded for a v0.1 release. The three actionable improvements — `min()` wrapper for CSS Grid, explicit ISO week calculation, and normalized product group member matching — should be incorporated before implementation begins. The vanilla JS + static JSON architecture is the right call for David Toolkit's contributor-friendly, AGPL-3.0 ethos: any shop owner with a text editor can understand, modify, and extend this dashboard without learning a framework.
