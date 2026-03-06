---
name: Cloud agent starter
description: Use when a Cloud agent starts work in this repo and needs immediate setup, run, mock, and test instructions.
---

# David Toolkit Cloud agent starter

## Repo reality

- This repo is a static browser app with a local data-build step.
- There is no in-app login flow.
- There is no server-side auth, database, or runtime feature-flag system.
- The main control points are `sample-data/raw`, `sample-data/config/context.json`, and `sample-data/config/product-corrections.json`.

## First 5 minutes

1. Reuse an existing `npm run serve` process if one is already running instead of starting a duplicate server.
2. Run `npm install`.
3. If `sample-data/raw/chez-julien-finance-demo.xlsx` is missing, run `npm run prepare:sample`.
4. Run `npm run build:data`.
5. Start the app with `npm run serve`.
6. Open `http://localhost:4173`.
7. Before finishing any functional change, run `npm test`.

## Login, secrets, and flags

- If a task says "log in," verify whether it means Cursor, GitHub, or Slack. The app itself has no login.
- Do not invent mock auth. There is nothing in-repo that needs credentials to render the demo.
- Treat config and sample-data edits as the repo's "scenario toggles." There are no formal feature flags to flip.

## Common scenario knobs

### `sample-data/config/context.json`

Use this to mock:

- run date
- weather headline, temperature, and confidence
- holiday and school-break context
- supplier order deadlines

Then run:

- `npm run build:data`
- `npm test`
- refresh the browser

Expected downstream changes:

- hero metadata
- context band
- morning briefing copy
- supplier cutoff text

### `sample-data/config/product-corrections.json`

Use this to mock:

- display names
- supplier mapping
- canonical categories
- weather sensitivity
- perishability

Then run:

- `npm run build:data`
- `npm test`
- refresh the browser

Expected downstream changes:

- supplier cards
- top/slow product lists
- interpreted evidence cards

### `sample-data/raw/*.csv`

Use these when the task is about parser behavior, scoring inputs, or sample scenarios.

Then run:

- `npm run build:data`
- `npm test`

Check:

- `public/data/demo.json` was regenerated
- the dashboard still renders at `http://localhost:4173`

### `npm run prepare:sample`

Run this when the workbook `sample-data/raw/chez-julien-finance-demo.xlsx` is missing or needs regeneration.

Afterwards run:

- `npm run build:data`
- `npm test`

## Codebase areas and testing workflows

### 1. Import and scoring pipeline

Files:

- `scripts/build-data.mjs`
- `scripts/verify-data.mjs`
- `sample-data/raw/*`
- `sample-data/config/*`

Use this workflow when touching parsing, normalization, supplier scoring, or JSON payload shape:

1. Make the change.
2. Run `npm run build:data`.
3. Run `npm test`.
4. Inspect `public/data/demo.json` if the task changes payload shape or scenario output.
5. Reload the app and confirm the dashboard still renders real data, not a blank state.

High-signal checks:

- supplier panels still exist
- at least one product still lands in `order`
- interpreted cards still include evidence and confidence

### 2. Static UI shell

Files:

- `public/index.html`
- `public/app.js`
- `public/styles.css`

Use this workflow when touching layout, copy, rendering, or browser behavior:

1. Ensure data exists with `npm run build:data`.
2. Start or reuse `npm run serve`.
3. Open `http://localhost:4173`.
4. Verify:
   - hero metrics populate
   - context cards render
   - supplier cards show order/watch/skip columns
   - interpreted evidence cards show confidence bars
   - sidebar sections render without obvious overflow
5. Run `npm test` before wrapping up, even for UI work, because the UI depends on generated data.

### 3. Scenario tuning and mock "feature flags"

Files:

- `sample-data/config/context.json`
- `sample-data/config/product-corrections.json`

Use this workflow when you need to simulate weather shifts, supplier timing, or catalog cleanup without adding new infrastructure:

1. Edit the config JSON.
2. Run `npm run build:data && npm test`.
3. Refresh the browser.
4. Verify the exact UI surfaces that should change.

This is the correct replacement for "set a feature flag" in this repo.

### 4. Docs, rules, and agent workflow files

Files:

- `README.md`
- `docs/*`
- `.cursor/*`

Use this workflow when changing instructions rather than product behavior:

1. Verify every command you mention still works now.
2. Prefer `npm test` plus a quick app smoke check if the doc changes startup or testing instructions.
3. Keep instructions concrete and copy-pasteable.

## Fast troubleshooting

- `npm test` fails because `public/data/demo.json` is missing: run `npm run build:data`.
- `npm run build:data` fails because the workbook is missing: run `npm run prepare:sample`.
- The app loads blank or stale data: rebuild with `npm run build:data`, then hard-refresh the browser.
- Port `4173` is busy: run `PORT=4174 npm run serve`.
- A task asks for login or feature-flag work: confirm the request matches this repo, because neither exists in-app today.

## How to update this skill

When you discover a new testing trick or runbook step:

1. Add it to the most relevant codebase area, not a grab-bag notes section.
2. Include the trigger, the exact command or edit, and what success looks like.
3. Remove or replace stale guidance instead of piling on contradictory advice.
4. If the core startup path changed, update `First 5 minutes` in the same change.
