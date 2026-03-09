# Pencil Prompt — David: Tableau de Pilotage

## How to use

1. Open or create `dashboard-demo.pen` in Cursor
2. Cmd+K to open the AI prompt panel
3. Paste the full prompt below
4. Let Pencil generate the complete dashboard
5. Iterate with follow-up prompts as needed

---

## The Prompt

```
Design a complete single-screen dashboard called "David — Tableau de Pilotage" at 1440x900. No scroll. Everything fits in one viewport. This is a morning dashboard for a specialty food shop team in Brussels — they open it once before the shop opens and it tells them everything they need to know for the day.

The team is 26-27 years old. The design must be modern, sharp, and high-impact — not corporate SaaS, not cozy artisanal. Think Linear meets a specialty food shop. The key design twist: incorporate subtle wood texture or wood grain elements to represent the physical shop — but as an accent, not a theme. The rest is clean, tight, and contemporary.

Design system:
- Background: dark or very dark — not black, but deep. Could be a very dark warm gray or charcoal with a hint of wood warmth.
- Cards: sharp edges or very subtle radius (4-8px max). Semi-transparent or frosted glass on dark. Clean separation.
- Typography: modern sans-serif for everything. Monospace for numbers and data. Large, bold numbers. No serifs.
- Accent colors that POP against dark:
  - Performance zones (these are critical, must be unmissable):
    - Rouge: intense red — danger
    - Orange: warm orange — caution
    - Vert: bright green — healthy
    - Bleu: electric blue — ideal/go
  - Muted text: medium gray
  - Wood accent: a subtle warm brown or timber tone used sparingly (dividers, background texture patch, or a single accent element)
- Icons: lucide or similar line icons, light weight
- Language: ALL text in French. No English anywhere.

The dashboard has one core logic: last week's revenue determines the ordering confidence for this week. The performance zone (rouge/orange/vert/bleu) is the most important visual element — it tells the team whether to order big or small.

Layout: 3 zones, top to bottom, with a thin header bar.

--- HEADER BAR ---
Left: "Chez Julien" in bold, followed by "— Mardi 10 mars 2026" in lighter weight.
Right: Performance zone badge — a colored pill with the zone name. For this demo: a blue pill reading "ZONE BLEUE" (because last week was 12,000 EUR = above 10,500 threshold).

--- ZONE 1: SIGNAL DE LA SEMAINE (top, ~25% of viewport) ---

This is the most important zone. It answers: "Should I order big or small this week?"

Left side (~60%): The ordering confidence signal.
- Big bold sentence: "Semaine forte. Commandez en confiance."
- Colored with the zone color (electric blue for this demo)
- Below: "+14% vs même semaine 2025" in green with an arrow-up icon
- Below: "Objectif mars : 43 500 € · Rythme actuel : en avance" in muted text
- Below: "Pas de vacances scolaires · Pas de jour férié · Printemps dans 10 jours" in small muted monospace

Right side (~40%): Weather strip — 6 days in a compact horizontal row:
- Mar 10 (highlighted as "AUJOURD'HUI" in accent color): Éclaircies, 15°C
- Mer 11: Soleil, 15°C
- Jeu 12: Éclaircies, 16°C
- Ven 13: Soleil, 17°C
- Sam 14: Bruine, 17°C (slightly muted/dimmed to signal rain)
- Dim 15: Éclaircies, 16°C
Each day: weather icon (sun, cloud-sun, cloud-drizzle), temperature big, day name small. Compact cards, ~100px wide.

--- ZONE 2: AUJOURD'HUI (middle, ~45% of viewport) ---

Split into two columns.

Left column (~60%): COMMANDES DU JOUR
Label: "COMMANDES" in monospace, small, uppercase, muted
Sub-label: "Mardi — 3 fournisseurs à commander aujourd'hui"

3 supplier cards in a vertical stack:

Card 1:
- Supplier: "SCHIETSE"
- Category tag: "Charcuterie" (small pill)
- Method: "webshop.schietse.com" with a small external-link icon
- One line: "Livraison jeudi · Commande hebdomadaire"
- Button: "Ouvrir fiche Notion →" (accent colored text, subtle background)

Card 2:
- Supplier: "INTERBIO"
- Category tag: "Bio & Épicerie"
- Method: "shop.interbio.be"
- One line: "Livraison demain si avant midi · #1 fournisseur (121K€/an)"
- Button: "Ouvrir fiche Notion →"

Card 3:
- Supplier: "FROM UN"
- Category tag: "Fromages"
- Method: "Téléphone"
- One line: "Livraison jeudi · #2 fournisseur (76K€/an)"
- Button: "Ouvrir fiche Notion →"

Each card should have a very subtle left border in the zone color (blue) — a visual reminder that we're in confidence mode.

Right column (~40%): TÂCHES DU JOUR
Label: "TÂCHES" in monospace, small, uppercase, muted
Sub-label: "8 tâches aujourd'hui"

Compact rows, no heavy cards — just a clean list:
1. ○ Nettoyage paniers, poignées, pinces, vitrines — tag: Hebdo
2. ○ Nettoyage profond frigos (0/3) — tag: Hebdo
3. ○ Vérifier box overflow — tag: Entretien
4. ○ Nettoyer sceaux frigos — tag: Entretien
5. ○ Réorganisation fromage par catégorie — tag: Hebdo
6. ○ Shine — resets — tag: Rangement
7. ○ Vérifier stock fruits & légumes — tag: Quotidien
8. ○ Mise à jour prix affichés — tag: Quotidien

Each row: empty circle (checkbox feel), task text (14px), tag right-aligned (10px monospace, muted). Rows 32-36px height, subtle bottom border. The wood texture accent could appear here — as a very faint background grain on this column, or as a thin warm-brown divider between tasks and orders.

--- ZONE 3: LE POULS (bottom, ~30% of viewport) ---

3 KPI cards in a horizontal row, equal width.

Card 1: "Semaine dernière"
- "12 000 €" (big number, 36px, bold)
- Zone badge: small blue dot + "Bleue" text
- "2–8 mars 2026" (small, muted)
- "+14% vs 2025" (green text, arrow-up)

Card 2: "Même semaine 2025"
- "10 500 €" (big number, 36px, bold)
- "10–16 mars 2025" (small, muted)
- No zone badge (historical reference only)

Card 3: "Objectif mensuel"
- "43 500 €" (big number, 36px, bold, accent color)
- "Mars 2026" (small, muted)
- "Rythme : en avance" (green text)
- "Charges fixes : ~12 200 €/mois" (small, muted, as context)

Below the 3 cards, a thin full-width bar showing the performance zone scale:
Rouge | Orange | Vert | Bleu — with a marker showing where "12 000 €" falls (in the blue zone). This is a simple horizontal gradient bar with zone labels, like a fuel gauge. The marker is a small triangle or dot.

All text in French. No English anywhere. The design should feel like something a 27-year-old shop manager would screenshot and share — sharp, data-driven, modern, with just enough warmth from the wood accent to feel like their shop, not a generic SaaS tool.
```

---

## Context for the agents

- **Date**: Tuesday March 10, 2026
- **Store**: Chez Julien, Bruxelles
- **Performance zone**: Bleu (last week 12,000 EUR > 10,500 threshold)
- **Zone logic**: Rouge < 7,500 | Orange 7,500-9,000 | Vert 9,000-10,500 | Bleu > 10,500
- **Year-over-year**: +14% vs same week 2025
- **Monthly target**: 43,500 EUR (March 2026)
- **Fixed charges**: ~12,200 EUR/month
- **Weather**: Open-Meteo Brussels, March 10-15
- **Tasks**: From Todoist "Chez Julien" workspace, all due today
- **Suppliers ordering Tuesday**: SCHIETSE (charcuterie), INTERBIO (bio), FROM UN (fromages) — placeholder until full cadence data arrives
- **Notion fournisseurs page**: https://www.notion.so/2f2cbce566f8817d8368c4dd88e857be
- **Real supplier count**: 23 active suppliers across 7 categories

## Follow-up prompts (for iteration after initial generation)

- "Make the zone badge bigger — it should be the first thing you see"
- "The weather strip needs more breathing room"
- "Add more contrast between the supplier cards and the task list"
- "The performance bar at the bottom should be bolder — make it a full design element, not an afterthought"
- "Try a different wood texture treatment — maybe as a subtle grain overlay on the header bar"
- "The supplier cards need to feel more actionable — bigger buttons"
- "Export this as plain HTML and CSS"
