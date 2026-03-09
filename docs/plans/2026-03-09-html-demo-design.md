# HTML Demo Design — David V2 Dark

**Date:** 2026-03-09
**Goal:** Standalone HTML demo of the V2 dark dashboard from `davidtoolkit.pen`. Hackathon deliverable.

## Decisions

- **Scope:** All 3 screens (Tableau de Pilotage, Collapsed State, Roadmap Semaine)
- **Location:** `demo/` folder, zero dependencies on existing build pipeline
- **Navigation:** Single `index.html`, JS toggles visibility of screen sections
- **Data:** All hardcoded French text from the .pen file — no `demo.json`, no build step
- **Approach:** Deep-read .pen node properties for exact colors/fonts/spacing, hand-write clean HTML/CSS

## Files

```
demo/
  index.html    — single page, all 3 screens
  styles.css    — design system + layouts
  app.js        — sidebar navigation
```

## Design Tokens (from .pen)

| Token | Value | Usage |
|-------|-------|-------|
| --bg-page | #0A0A0B | Page background |
| --bg-sidebar | #141417 | Sidebar |
| --bg-card | #141417 | Cards |
| --bg-card-inner | #1A1A1D | Inner cards, tags |
| --border | #1F1F23 | Borders |
| --border-subtle | #2A2A2E | Checkboxes |
| --text-primary | #FFFFFF | Headings |
| --text-secondary | #ADADB0 | Body |
| --text-muted | #6B6B70 | Labels |
| --text-dim | #4A4A4E | Context text |
| --text-subtle | #52525B | Gauge labels |
| --accent | #FF5C00 | Active/CTA |
| --accent-bg | rgba(255,92,0,0.09) | Active backgrounds |
| --zone-rouge | #EF4444 | Zone red |
| --zone-orange | #F97316 | Zone orange |
| --zone-vert | #22C55E | Zone green |
| --zone-bleu | #3B82F6 | Zone blue |

**Fonts:** Inter (UI), DM Mono (data), Instrument Serif (titles)
**Icons:** Lucide via CDN
**Radii:** 6/8/10/12/100px

## Layout

- Sidebar: 260px fixed, `#141417`, right border `#1F1F23`
- Main: flex-grow, padding 28px 36px (dashboard) / 24px 32px (roadmap)
- Dashboard top bar: title + badge left, weather strip right
- Middle row: signal+KPIs left (grow), supplier cards right (420px)
- Bottom row: tasks left (grow, 280px height), performance right (380px)
- Roadmap: 5 equal columns, gap 12px
