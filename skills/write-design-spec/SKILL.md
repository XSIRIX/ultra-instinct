---
name: write-design-spec
description: Use when a design has been agreed and the work is going to be built — captures the design and its requirements as a document, including the references and mockups it was grounded in. Covers system design and frontend design alike. First committed artifact, so it also triggers isolation. Follows brainstorm, precedes write-plan.
---

# Write Design Spec

Lock the agreed design into a document. This is where a conversation becomes a commitment.

Covers whatever kind of design the work needed — system architecture, a data model, a frontend surface, an API contract, or all of them. The document holds the design *and* the requirements it has to satisfy.

**Done when** someone who wasn't in the conversation could read it and build the right thing — with no placeholders, no contradictions, and no requirement that could be read two ways.

## Isolate first

This file is the work's first committed artifact. Before creating it, use `isolate-work` to get onto a dedicated branch or worktree. If you're already isolated, that skill detects it and returns immediately.

Design doc, plan, and implementation all live on the same branch, so the branch tells the whole story.

**Bring the visuals in now.** Mockups from brainstorming were built in a temp directory outside the repo, so exploring three takes wouldn't put anything in the user's checkout before anyone committed to building. Now that the branch exists, the chosen one gets committed:

```bash
mkdir -p docs/design/YYYY-MM-DD/assets
cp "<mockup-dir>/<chosen>.html" docs/design/YYYY-MM-DD/assets/
git add docs/design/YYYY-MM-DD/assets/<chosen>.html
```

`<mockup-dir>` is the absolute temp path `mockup` printed when it built them. If you don't have it, ask rather than guessing — a temp path isn't reconstructible.

**Copy the file you already built. Do not rebuild it.** The committed asset must be the exact thing the user looked at and picked — same bytes. Regenerating it from your description of it, or "cleaning it up" on the way in, means the implementer builds from a copy of a memory instead of from the approved design.

If the mockup referenced project assets by absolute path, fix those to repo-relative paths *after* committing the original, as a separate visible change — so the diff shows exactly what moved away from what was approved.

Link it from Visuals with one line on why that take won. Leave the rejected takes in scratch.

## What this document is

*What and why*, precise enough to build from. Not *how and in what order* — that's `write-plan`. No task breakdown, no file-by-file steps.

Save to `docs/design/YYYY-MM-DD/<topic>.md`.

**One folder per day.** A flat directory becomes fifty files nobody can scan. The date folder keeps a day's work together, sorts chronologically, and stays browsable after a year. Create it if it doesn't exist; add to it if the day already has one. Honor an existing project convention over this default.

## Shape

Use the sections the work needs. A small feature might use four; a subsystem might use all of them.

```markdown
# <Topic>

## Goal
What is true after this ships that isn't true now. One or two sentences.

## Context
Why this, why now. What exists today and where it falls short.

## Requirements
Numbered and testable. "Sessions expire after 30 minutes of inactivity"
— not "sessions should be secure."

## Design
Components and responsibilities, the interfaces between them, how data
moves. For a frontend surface: structure, states, and behavior — not
just how it looks.

## Constraints
Version floors, dependency limits, naming and copy rules, platform
targets, performance budgets. Exact values. Everything downstream
inherits this section.

## References
Every doc, guide, changelog, RFC, or existing-code pattern that shaped
this design — with the version it applies to.

- [Next.js caching](https://…) — v16, `use cache` replaces unstable_cache
- Existing pattern: `src/lib/auth/session.ts` — follow this shape

## Visuals
The chosen mockup, diagrams, flows — and one line on why that take won.
Link the files.

## Out of scope
What this deliberately does not do.

## Open questions
Anything genuinely undecided. Empty is the goal.
```

**References and Visuals are not decoration.** They're how the plan and the implementation stay grounded in what you actually verified, three days and one context compaction later. Skipping them means whoever builds this codes from memory. Carry them forward into the plan.

## Before you save

Read it back cold, as if you hadn't written it. It's ready when:

- **No placeholders.** No "TBD", no "etc.", no vague requirement. A "TBD" here becomes a guess in the implementation.
- **No contradictions.** The Design actually delivers the Requirements; no two requirements conflict.
- **No ambiguity.** Nothing could be read two ways. Where it could, pick one and write it explicitly.
- **No open questions** — or each is explicitly deferred with a stated default. A plan built on an open question produces code built on a guess.

Fix what you find inline. No second pass.

## Hand off

Commit it, then give the user the chance to read it:

> Design spec is at `<path>`. Worth a read before I plan the implementation — say the word and I'll start.

Then use `write-plan`.
