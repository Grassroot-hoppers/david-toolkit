---
name: perplexity-cross-analysis
description: Use when a design plan or implementation plan has been produced and needs validation against real-world evidence before moving to the next planning or execution phase
---

# Perplexity Cross-Analysis

## Overview

Generate a self-contained Perplexity Deep Research prompt that validates a plan against real-world evidence. The prompt is pasted as a single message — a stranger reading it should understand the project, the plan, and exactly what validation is needed without access to your codebase.

**Core principle:** The highest-value output is making hidden assumptions explicit and testable. Most plan failures come from untested assumptions, not bad architecture.

**Announce at start:** "I'm using the perplexity-cross-analysis skill to generate a validation prompt."

## When to Use

- After a **design plan** has been produced, before writing the implementation plan
- After an **implementation plan** has been produced, before execution
- When the user explicitly asks to validate a plan against external evidence

Do NOT use when: the plan is a minor tweak, a docs-only change, or the user wants to skip validation.

## Process

1. **Identify phase** — design plan or implementation plan?
2. **Extract context** — collect the six required elements below from the plan and project files
3. **Surface implicit assumptions** — this is the critical step most agents skip
4. **Generate prompt** — fill the template, calibrated to the current phase
5. **Present to user in chat** — output the complete prompt in a single fenced code block so the user can copy it. Do NOT save the prompt to a file — present it directly in the conversation.
6. **Tell user:** "Paste this into Perplexity Deep Research. Save the response as `docs/references/perplexity-<topic>-validation.md` so the next phase can reference it."

## Context Extraction

Collect these **before** generating the prompt:

| Element | Where to find it |
|---------|------------------|
| Project name & one-liner | README or plan header — this is Perplexity's search anchor |
| The plan being validated | The plan document (full text or focused summary) |
| Success criteria | Plan header, design doc, or ask the user |
| Architecture & tech stack | Plan header — focuses search on relevant experiences |
| Core assumptions (explicit AND implicit) | See extraction guidance below |
| Known risks & open questions | Plan or design doc — prevents re-surfacing known issues |

**Optional:** target audience, constraints (budget, licensing, timeline), prior art already evaluated, geographic/regulatory context. Check LICENSE, README, and config files for licensing and regulatory constraints worth including.

### Assumption Extraction

<HARD-GATE>
Do NOT skip this step. Do NOT list only what the plan explicitly calls "assumptions."
</HARD-GATE>

Read the plan deeply and surface assumptions the author didn't state. Look for:

- **Technology bets** — "CSS Grid is sufficient" (is it?), "no framework needed" (really?)
- **Scale assumptions** — "product list won't exceed N items," "JSON payload stays under X MB"
- **Environment assumptions** — "modern browsers only," "always online," "viewport ≥320px"
- **Data assumptions** — "CSV format won't change," "API will remain free," "data arrives clean"
- **User assumptions** — "users understand category hierarchy," "mobile use is secondary"

Present each as a numbered, testable claim. This is what makes the prompt dramatically more useful than a generic "validate my plan" request.

## Phase Calibration

| After… | Emphasize | De-emphasize | Tone |
|--------|-----------|--------------|------|
| Design plan | Prior art, architecture validation, alternative approaches | Library compatibility, deployment specifics | "Is this the right approach?" |
| Implementation plan | Library compatibility, known bugs, deployment patterns, benchmarks | High-level architecture alternatives (already decided) | "Will this work in production?" |

## Prompt Template

Generate by filling this template. Adjust section 6 and emphasis per phase calibration.

~~~
I need you to cross-analyze a [design/implementation] plan for **[PROJECT NAME]**: [one-liner description].

## The Plan

[Full plan text or a focused summary — enough for someone with no access to the codebase to understand the approach, constraints, and key decisions]

## Success Criteria

[What "working" means for this plan — concrete, testable outcomes]

## Architecture & Tech Stack

[Technologies, patterns, and hard constraints (licensing, no-server, etc.)]

## Assumptions to Validate

These are the explicit and implicit assumptions in this plan. For each one, find real-world evidence that supports or contradicts it:

1. [Assumption — framed as a testable claim]
2. [...]

## Known Risks (already identified — do NOT re-surface these)

- [Risk 1]
- [Risk 2]

## Research Objectives

Investigate these six areas. For each finding, cite the source URL and explain its relevance to THIS specific plan:

1. **Prior Art & Comparable Projects** — Existing solutions for similar problems with similar audiences. What worked, what failed, and how this plan differs.

2. **Architecture Validation** — The chosen tech stack evaluated against documented production experiences and known failure modes at comparable scale.

3. **Assumption Stress-Test** — Check each assumption listed above against real-world evidence. For each one, state: **supported**, **contradicted**, or **no evidence found**.

4. **Blind Spot Detection** — Risks and failure modes commonly encountered by similar projects but NOT mentioned in this plan or the known-risks section.

5. **Alternative Approaches** — For each major design decision, at least one credible alternative with evidence of its effectiveness and a concrete trade-off analysis.

6. **[CONDITIONAL — pick one based on context]**
   - If geographic/legal/regulatory context is relevant: **Regulatory & Ecosystem Fit** — relevant regulations (GDPR, data residency, cooperative law, licensing constraints) and ecosystem compatibility.
   - Otherwise: **Deployment & Operational Concerns** — deployment patterns, monitoring, failure recovery, and operational lessons from similar production systems.

## Required Output Format

Structure your response as numbered sections matching the six objectives above. For each finding include:
- **Source URL**
- **Relevance** to this specific plan (not generic advice)
- **Recommendation:** keep / change / investigate further

End with a **Priority Action List**: the 5 most important things to change or validate before proceeding, ranked by impact.

**If you cannot find evidence for a specific area, state that explicitly rather than speculating.**
~~~

## Feeding Results Back

After the user pastes Perplexity's response:

1. Save as `docs/references/perplexity-<topic>-validation.md`
2. The next skill in the pipeline (writing-plans or executing-plans) reads this file as reference context
3. Priority Action List items should be addressed in the plan before proceeding

## Common Mistakes

- **Skipping assumption extraction** — Listing only explicit assumptions. The implicit ones are where plans actually fail. Read the plan deeply.
- **Overloading the prompt** — One plan per prompt. Don't try to validate design and implementation simultaneously.
- **Generic context** — "A web app" gives Perplexity nothing to search for. Include specific tech, scale, audience, and constraints.
- **Omitting known risks** — Without this section, Perplexity wastes its research budget re-discovering what you already know.
- **Summarizing instead of including** — Include the full plan text (or a thorough summary). Perplexity needs the details to give specific feedback, not generic advice.
