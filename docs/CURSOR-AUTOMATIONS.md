# Cursor Automation Specs

These are the first three automations worth creating for `david-toolkit`.

They are written as operator specs so they can be copied into Cursor Automations with minimal editing.

## 1. Morning Test Debt

**Trigger**

- Weekdays in the morning

**Purpose**

- Find merged changes that should have added or expanded tests but did not.

**Prompt**

```text
Review recent merged changes in Grassroot-hoppers/david-toolkit.
Look for parser, scoring, and UI behavior changes that appear under-tested.
Open a PR only if the missing tests are clear and the scope stays narrow.
Run npm test before opening the PR.
Summarize what changed and why those tests were missing.
```

**Success**

- catches obvious missing tests
- does not create noisy speculative PRs

## 2. Weekly Founder Digest

**Trigger**

- Sunday evening

**Purpose**

- Give Julien one high-signal summary of repo health before the next work block.

**Prompt**

```text
Summarize the current state of Grassroot-hoppers/david-toolkit.
Report:
- merged PRs since the last digest
- open issues grouped by theme
- docs drift
- dependency or security concerns
- the most leverageable next 3 tasks
Do not produce fluff.
Keep it short and founder-readable.
```

**Success**

- one concise weekly operating brief
- clear next actions without re-reading the repo manually

## 3. Dependency Watch

**Trigger**

- Daily

**Purpose**

- Watch for actionable dependency changes, especially around spreadsheet parsing risk.

**Prompt**

```text
Check Grassroot-hoppers/david-toolkit for actionable dependency and security changes.
Prioritize spreadsheet parsing libraries and anything touching imported files.
Only report if something changed that is worth acting on now.
If a dependency risk becomes fixable, open an issue or PR with a concrete recommendation.
```

**Success**

- low-noise warning system
- early notice if the current `xlsx` risk becomes fixable

## Notes

- Keep automations narrow and repo-specific.
- Do not let them branch into roadmap writing or broad refactors.
- Prefer summary comments, issues, or small PRs over large autonomous changes.
