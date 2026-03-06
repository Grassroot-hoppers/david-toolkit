# Contributing to David Toolkit

## First Principles

David Toolkit is built for real shop operators. If a contribution makes the code cleaner but the operator experience worse, it is the wrong contribution.

Contributions should improve at least one of these:

- trust in the numbers
- clarity of the interface
- speed of setup
- legibility of the evidence behind a recommendation

## Workflow

1. Open an issue or comment on an existing one before large work.
2. Keep changes scoped to one concern.
3. Include before/after notes in the pull request.
4. Run:

```bash
npm run build:data
npm test
```

## Design Constraints

- Preserve the raw vs interpreted distinction.
- Never hide uncertain inference behind confident language.
- Keep the app browser-first and static-host friendly.
- Prefer plain JavaScript over framework sprawl at this stage.

## Data Rules

- Do not commit private operator exports.
- Use sanitized sample data for public contributions.
- If you add a new adapter, document the format in [`DATA_SOURCES.md`](DATA_SOURCES.md).

## Good First Contributions

- new export adapters
- evidence-card UI improvements
- accessibility fixes
- stronger tests around decimal commas, encodings, and malformed rows

## Cursor / Agent Contributions

If you are using Cursor, Slack agents, or background agents, also read:

- [`docs/CURSOR-SETUP.md`](docs/CURSOR-SETUP.md)
- [`docs/CURSOR-AUTOMATIONS.md`](docs/CURSOR-AUTOMATIONS.md)
- `.cursor/BUGBOT.md`
