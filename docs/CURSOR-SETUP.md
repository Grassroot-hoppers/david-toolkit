# Cursor Setup For David Toolkit

This repository is a good fit for Cursor's cloud-agent workflow because it is:

- pushed to GitHub
- deterministic enough to verify with `npm test`
- browser-facing, so screenshots matter
- narrow enough that issue-first work stays coherent

## Recommended Stack

- GitHub integration
- Slack integration
- Cursor web/mobile agents
- Bugbot
- Cloud agents with computer use
- MCPs: Playwright and DuckDB
- Optional MCP: Notion

## What To Enable

### 1. GitHub

Connect Cursor's GitHub integration to `Grassroot-hoppers/david-toolkit`.

Why:

- background agents clone from GitHub
- agents can open branches and PRs
- PR review becomes the main control surface on phone

### 2. Slack

Create a dedicated channel such as `#david-toolkit`.

Then:

1. Install Cursor's Slack app
2. Run `@Cursor settings`
3. Set the default repository to `Grassroot-hoppers/david-toolkit`

Why:

- easiest phone-first task launch surface
- completion notifications are faster than checking the Cursor web UI repeatedly

### 3. Web/Mobile

Install the Cursor mobile/web app from `cursor.com/agents` as a phone home-screen app.

Use it to:

- start background work
- inspect run summaries
- pick up a conversation later on desktop

## Best Phone Workflow

1. Push your latest branch or work from `main`.
2. Create or open a GitHub issue.
3. From Slack or Cursor mobile/web, assign one narrow task.
4. Require the agent to run `npm test` and open a PR.
5. Let Bugbot review the PR.
6. Review and merge from GitHub mobile.

## Prompt Pattern

Use prompts like this:

```text
Work only in Grassroot-hoppers/david-toolkit.
Implement issue #3 only.
Do not widen scope.
Run npm test.
Open a PR.
If UI changes, include screenshots.
```

## Good Phone Tasks

- add tests
- tighten parser edge cases
- edit docs
- small dashboard cards or copy changes
- small CSS/layout fixes with clear acceptance criteria

## Bad Phone Tasks

- broad architecture changes
- unpublished local-only work
- secret-dependent tasks
- visual redesign without screenshot review
- anything that depends on your local workstation state

## MCP Recommendation

Install only what helps now.

### Playwright

Use for:

- dashboard screenshot capture
- mobile-layout verification
- workflow-map UI checks

### DuckDB

Use for:

- fast CSV inspection
- export-family investigation
- data debugging without writing ad-hoc scripts first

### Notion (optional)

Use only if supplier cadence or shop context starts coming from Notion directly.

## Rules For Reliability

- never ask a cloud agent to work from unpublished local state
- keep one issue = one task
- force PRs instead of silent direct changes
- require `npm test`
- treat screenshots as part of the contract for UI work
