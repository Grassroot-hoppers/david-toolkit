# David Toolkit Bugbot Rules

Bugbot should review this repository as a retail-data product, not as a generic web demo.

## Prioritize These Findings

1. Parser regressions in export handling.
   Focus on semicolon-delimited CSVs, decimal commas, malformed rows, weighted-product edge cases, and spreadsheet ingestion safety.

2. Anything that weakens the raw-vs-interpreted contract.
   If a change hides inference behind raw numbers, removes confidence signaling, or makes demand interpretation look more certain than it is, treat that as a real bug.

3. Mobile and browser regressions.
   Changes to `public/index.html`, `public/app.js`, or `public/styles.css` should be checked for broken layout, unreadable cards, and overflow on narrow screens.

4. Silent data-shape drift.
   If build scripts, sample data, or config shapes change without updated docs or verification coverage, call it out.

5. Security-sensitive parsing behavior.
   Pay extra attention to spreadsheet parsing, unsafe HTML insertion, or changes that widen the attack surface around imported files.

## Expect From Contributors

- `npm test` must pass for every functional change.
- UI changes should include updated screenshots when practical.
- Docs must be updated when the workflow, input shape, or contributor path changes.

## Do Not Nitpick

- Minor prose edits that do not change meaning.
- Taste-level style differences with no functional impact.
- Broad rewrite suggestions unless a concrete bug or risk justifies them.
