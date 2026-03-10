# David Toolkit

**A browser-first intelligence center for independent shop owners.**

David Toolkit starts where most small shops already are: an old POS, exported spreadsheets, supplier deadlines, and too much judgment trapped in one person's head. This repo turns that reality into a clean, open-source intelligence layer.

This first demo is built around a real independent food shop context. It reads retail exports, applies a curated correction layer, overlays weather and calendar context, and renders a founder-grade dashboard that separates raw evidence from interpreted signals.

![David Toolkit preview](public/assets/preview.png)

## What Works Today

- Parses `ExportStatVente`, `STA_satvente`, `STA_ratioCAT`, and `Analyse_00` style exports
- Builds a browser-ready intelligence center with:
  - supplier command panels
  - product and category intelligence
  - raw vs interpreted demand signals
  - weather and holiday overlays
  - 3-year macro context when a finance workbook is present
- Ships with a sanitized sample dataset so outsiders can run the demo without private shop data
- Includes a verification script that checks parser and scoring assumptions
- Supports a French operator-facing product surface through `sample-data/config/context.json` while keeping the repo and docs in English

## Quick Start

```bash
npm install
npm run build:demo   # requires Gold data in data/gold/
npm run serve
```

Open `http://localhost:4173`.

Or build everything from raw CSVs:

```bash
npm install
npm run build:full   # import → gold → demo in one step
npm run serve
```

## Using Your Own Data

Place your POS CSV exports in `data/real/` (gitignored). The pipeline auto-detects 7 file types by header fingerprint: monthly stats, annual stats, transactions, category mix, margin analysis, hourly patterns, and product master.

Then run:

```bash
npm run build:full
```

## Repository Guide

- [`ARCHITECTURE.md`](ARCHITECTURE.md) explains the importer, scoring model, and front-end structure.
- [`DATA_SOURCES.md`](DATA_SOURCES.md) documents every expected file and mapping layer.
- [`DEMO.md`](DEMO.md) gives a demo script for talks, videos, and a `Show HN` style launch.
- [`ROADMAP.md`](ROADMAP.md) shows what comes next.
- [`docs/ISSUE_BACKLOG.md`](docs/ISSUE_BACKLOG.md) seeds the first public issue backlog.
- [`docs/CURSOR-SETUP.md`](docs/CURSOR-SETUP.md) defines the recommended Cursor, Slack, mobile, and MCP workflow for this repo.
- [`docs/CURSOR-AUTOMATIONS.md`](docs/CURSOR-AUTOMATIONS.md) contains the first automation specs worth creating.

## Contribution Standard

This repo is meant to be contributor-ready from day one.

- Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request.
- Respect the [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
- Report security issues through [`SECURITY.md`](SECURITY.md).
- Agent-based contributors should also read `.cursor/BUGBOT.md` and the PR template expectations.

## Why AGPL

The point of David Toolkit is not just “source visible.” It is a real commons project. If someone runs an improved hosted version, those improvements should stay in the commons. That is why the code is licensed under `AGPL-3.0-only`.

## Status

`v0.1` is a serious demo, not a production system.

- It is strong enough to show the concept clearly.
- It is not yet a live ordering engine.
- All “AI-corrected” interpretations remain visible as **inference** with confidence tags, never hidden truth.
