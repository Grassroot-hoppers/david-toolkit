# Research: Using Pencil (.pen) for the David Dashboard

## What is Pencil?

Pencil is a vector design tool that runs **inside your IDE** (Cursor, VS Code, Claude Code, etc.). It uses `.pen` files — a JSON-based, Git-friendly design format. Key differentiator: **design-as-code**. Designs live alongside your source files, get committed, branched, diffed, and merged like any other file.

Docs: https://docs.pencil.dev/
Last updated: Feb 22, 2026.

## Core Capabilities

### The .pen Format
- JSON object tree (similar to HTML/SVG DOM)
- Every object has a unique `id` and a `type` (rectangle, frame, text, path, ellipse, icon_font, ref, etc.)
- Flexbox-style layout (`layout: "vertical" | "horizontal"`, `gap`, `padding`, `justifyContent`, `alignItems`)
- Multiple fills (solid, gradient, image, mesh_gradient), strokes, effects (blur, shadow)
- **Components & instances**: any object with `reusable: true` becomes a component; `ref` type creates instances with property overrides and nested `descendants` customization
- **Slots**: frames inside components marked with `slot` property for child injection
- **Variables & themes**: document-wide variables (`$color.background`, `$text.title`), multi-axis theming (light/dark, regular/condensed)
- **Prompt & Context objects**: special object types `prompt` and `context` — can carry text content and model info, likely used for AI-assisted generation

### AI Integration (MCP)
Pencil exposes MCP tools when running:
- `batch_design` — insert, copy, update, replace, move, delete design elements; generate and place images
- `batch_get` — read design components, hierarchy, search by pattern
- `get_screenshot` — render preview of current design
- `snapshot_layout` — analyze layout structure, detect overlaps/positioning issues
- `get_editor_state` — current selection, active file
- `get_variables` / `set_variables` — read/write design tokens

### Design ↔ Code
- **Design → Code**: open `.pen` in IDE, press Cmd+K, ask "Generate React code for this design" or "Export this as plain HTML/CSS"
- **Code → Design**: "Recreate the Header component from src/layouts/Header.tsx in this .pen file"
- **Variable sync**: "Create Pencil variables from my globals.css" / "Sync these design tokens to my CSS"
- Supported output: React, TypeScript, Next.js, Vue, Svelte, plain HTML/CSS. Styling: Tailwind, CSS Modules, Styled Components, plain CSS. Component libs: Shadcn UI, Radix, Chakra, Material UI.

### Built-in UI Kits
- Shadcn UI, Halo, Lunaris, Nitro design systems available as starter kits

## The David Dashboard Today

### Tech Stack
- Plain HTML/CSS/JS — no framework
- Fonts: Fraunces (display/serif), Space Grotesk (sans), IBM Plex Mono (mono)
- Node.js build step: CSV/XLSX → `demo.json` → static page
- Served on port 4173

### Visual Design System (from styles.css)
| Token | Value | Role |
|-------|-------|------|
| `--bg` | `#f4ead8` | Page background (warm cream) |
| `--ink` | `#17110f` | Primary text (near-black) |
| `--panel` | `rgba(255,251,246,0.88)` | Card/panel background |
| `--panel-dark` | `#17110f` | Dark card bg (insight cards) |
| `--line` | `rgba(23,17,15,0.15)` | Borders/dividers |
| `--gold` | `#bf7a21` | Accent/highlight |
| `--red` | `#b4482d` | Danger/order urgency |
| `--green` | `#35644f` | Positive/skip |
| `--teal` | `#2c6d74` | Secondary accent |
| `--muted` | `#74665c` | Secondary text |

### Layout Structure
```
page-shell (max-width: 1480px)
├── hero (grid: 1.8fr + 1fr)
│   ├── hero-copy (dark bg, gradient glow)
│   │   ├── eyebrow (mono, gold, uppercase)
│   │   ├── h1 (Fraunces, clamp 3-5.4rem)
│   │   ├── lede paragraph
│   │   └── hero-meta (pill badges)
│   └── hero-rail (3 metric cards)
│       └── metric-card (label + big number)
├── context-band (3-col grid)
│   └── context-card (weather, calendar, method)
├── layout (grid: 2.1fr + 0.9fr sidebar)
│   ├── panel-stack
│   │   ├── panel: Brief du matin (briefing cards)
│   │   ├── panel: Centre fournisseurs (supplier cards → 3-col: order/watch/skip)
│   │   └── panel: Indices interprétés (2-col dark insight cards with confidence bars)
│   └── sidebar
│       ├── panel: Pression catégories (category rows with bars)
│       ├── panel: Meilleurs mouvements (product rows)
│       ├── panel: Lents (slow product rows)
│       └── panel: Contexte macro (year cards + trend bars)
```

### Key Visual Patterns
- **Glassmorphism**: `backdrop-filter: blur(14px)`, semi-transparent backgrounds
- **Warm palette**: cream/gold/dark brown — artisanal, deliberate feeling
- **Pill-shaped elements**: `border-radius: 999px` for badges, bars, meta pills
- **Large border-radius**: 16px–28px on cards and panels
- **Dark-on-light + light-on-dark**: hero-copy and insight cards are inverted (dark bg, light text)
- **Grid-dominant**: CSS Grid for everything — hero, context band, layout, supplier columns, insight grid
- **Responsive**: collapses to single column at 1180px and 720px
- **Confidence visualization**: horizontal bars with gold-to-amber gradient
- **Trend bars**: vertical mini-bar charts with current year highlighted

## Fit Assessment: Pencil × David Dashboard

### What works well
1. **Git-native design files** — `.pen` files committed alongside `index.html`, `styles.css`, `app.js`. Version history for design decisions.
2. **CSS variable sync** — Pencil variables can map 1:1 to the existing `--bg`, `--ink`, `--gold`, etc. tokens in `styles.css`. Two-way sync keeps them aligned.
3. **Component extraction** — The dashboard has clear repeating patterns (metric-card, supplier-card, insight-card, product-row, briefing-card, category-row, year-card). These map to Pencil `reusable` components.
4. **No framework needed** — Pencil can export plain HTML/CSS, which matches the "no framework" constraint.
5. **IDE integration** — design + code in the same Cursor window. No context-switching to Figma.
6. **AI prompt workflow** — we can describe screens/components in natural language and Pencil + MCP generates the visual, then we export to code.
7. **Theming** — Pencil's multi-axis theme system could let us design both a "current warm" theme and future variants (dark mode, condensed mobile) in one file.

### What to watch out for
1. **No auto-save** — manual Cmd+S required. Easy to lose work. Must commit frequently.
2. **Young tool** — docs last updated Feb 2026. Some features feel in-progress (properties panel: "content coming soon"). Expect rough edges.
3. **Export fidelity** — docs warn "canvas vs export mismatch" can happen. Need to verify generated HTML/CSS against the existing hand-crafted styles.
4. **No existing Pencil design** — starting from zero. The current dashboard was code-first. Importing code→design is the recommended first step.
5. **Plain HTML export quality** — most examples focus on React/Tailwind output. The plain HTML/CSS path may be less polished.
6. **Team of one** — the design-as-code collab benefits matter less when it's a solo founder.

### Constraints to honor
- Dashboard must remain plain HTML/CSS/JS (no React adoption forced by tool)
- Existing CSS variable names and warm color palette are intentional — don't lose them
- French operator-facing copy — designs need real French text, not lorem ipsum
- Raw vs interpreted distinction must be visible in the design
- Confidence scores need visual representation

## Strategy: Prompt-Driven Design in Pencil

### Phase 1: Foundation
Create `design/dashboard.pen` at the repo root. Import the existing CSS variables as Pencil variables. This becomes the source of truth for the design system.

### Phase 2: Component Library
Build reusable components for every card type: metric-card, context-card, briefing-card, supplier-card (with 3-column variant), insight-card, product-row, category-row, year-card, trend-bars. Each as a `reusable: true` object with slots where appropriate.

### Phase 3: Full Page Composition
Compose the full dashboard layout using instances of the component library. This is the "design spec" that validates layout, spacing, typography, and hierarchy.

### Phase 4: Evolution Prompts
Use the .pen file as the living design surface for v0.2 features (file-drop import flow, exportable supplier recap, improved stockout model UI) — design first, generate code second.

## Prompt Catalog (Draft)

Below are prompts we'd use inside Pencil (Cmd+K) to build the design. These should be stored as a reference and iterated on.

### Setup Prompts
1. "Create Pencil variables from these CSS tokens: --bg: #f4ead8, --ink: #17110f, --panel: rgba(255,251,246,0.88), --panel-dark: #17110f, --line: rgba(23,17,15,0.15), --gold: #bf7a21, --red: #b4482d, --green: #35644f, --teal: #2c6d74, --muted: #74665c"
2. "Create text style variables: --display font Fraunces for headings, --sans font Space Grotesk for body, --mono font IBM Plex Mono for labels"

### Component Prompts
3. "Design a metric-card component: rounded rectangle (24px radius), panel background, contains a mono uppercase label (0.76rem, muted color) and a large value number (2.4rem, ink color). Vertical layout, 22px padding."
4. "Design a context-card component: rounded rectangle (22px radius), light semi-transparent bg, contains a gold mono uppercase label, a bold title (1.1rem), and a body text line. Has a 'hot' variant with a warm gold gradient overlay."
5. "Design a briefing-card component: rounded rectangle (18px radius), warm gradient background, grid layout with a 56px left column for a mono gold index number and a right column for the briefing text."
6. "Design a supplier-card component: rounded rectangle (22px radius), off-white bg (#fffaf4). Header row with supplier name (h3) and delivery date. Summary text. Below: 3-column grid of item-cards. Each item-card: 16px radius, 12px padding, header with product name and mono uppercase tag, body text. Three variants: item-order (red tint), item-watch (gold tint), item-skip (green tint)."
7. "Design an insight-card component: rounded rectangle (20px radius), dark gradient bg (panel-dark to slightly lighter), light text (#f8f0e3). Contains: eyebrow, paragraph (0.82 opacity), evidence-chip row (pill-shaped chips with subtle bg), raw vs interpreted two-column, confidence bar (gold gradient on dark track, 8px height, full-width)."
8. "Design product-row component: flex row, space-between, 16px radius, subtle bg (4% ink). Product name on left, mono value on right. 'slow' variant with red tint."
9. "Design category-row component: flex row with labels, followed by a full-width 10px bar (progress indicator, gold-to-teal gradient on 8% ink track)."
10. "Design year-card component: flex row, 16px radius, warm gradient bg, year label and value."
11. "Design trend-bars component: 4 vertical bars (12px wide, 999px top radius), 78px max height, default color 18% ink, current year highlighted with gold-to-red gradient."

### Layout Prompts
12. "Create the dashboard page at 1480px width. Hero section: 2-column grid (1.8fr + 1fr). Left: dark panel (28px radius) with version eyebrow, large Fraunces heading 'Ancien POS dedans. Pilotage clair dehors.', lede paragraph, and meta pills. Right: 3 stacked metric-cards."
13. "Below the hero: 3-column context band with context-card instances."
14. "Main layout: 2-column grid (2.1fr + 0.9fr). Left panel-stack: Brief du matin panel with 3 briefing-cards, Centre fournisseurs panel with 2 supplier-cards, Indices interprétés panel with 4 insight-cards in 2×2 grid."
15. "Right sidebar: 4 compact panels stacked — Pression catégories (3 category rows), Meilleurs mouvements (4 product rows), Lents (3 slow product rows), Contexte macro (year strip + trend bars)."

### Responsive Prompts
16. "Create a 720px mobile variant of the dashboard: single column, reduced padding (20px on cards), h1 unconstrained width."

### Future Feature Prompts (v0.2)
17. "Design a file-drop import zone: large dashed-border area, centered icon and instruction text, drag-active state with gold border glow."
18. "Design a supplier recap export card: print-friendly layout, supplier name header, product table with order/watch/skip columns, totals row."

---

**Read this. Correct anything I got wrong before we plan.**

In particular:
- Are the prompt descriptions matching what you envision?
- Any components or sections I missed?
- Any design direction you want to push (darker? more minimal? different from current?)
- Do you want to keep the current visual identity exactly, or use this as a chance to evolve it?
