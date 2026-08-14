---
name: write-plan
description: Use when a design spec or clear set of requirements exists and it's time to work out how to build it — produces ordered tasks with exact files, interfaces, success criteria, and the doc references each task needs. Follows write-design-spec, precedes execute-plan.
---

# Write Plan

Turn a spec into ordered tasks someone could execute without having been in the conversation.

Write for a capable engineer who knows nothing about this codebase, and who will read your tasks one at a time — possibly out of order, possibly with no memory of the others. Every ambiguity you leave becomes their guess.

**Done when** every spec requirement maps to a task, every task states how it's verified, and the interfaces between tasks line up exactly.

Save to `.ultra-instinct/plans/YYYY-MM-DD/<feature>.md`.

Before writing, create the local workspace and its inner safety net. Never overwrite an existing inner ignore file:

```bash
mkdir -p .ultra-instinct/plans/YYYY-MM-DD
test -e .ultra-instinct/.gitignore || printf '*\n' > .ultra-instinct/.gitignore
```

**One folder per day**, same as the design specs. A flat directory becomes fifty files nobody can scan. Create the folder if the day doesn't have one yet. Honor an existing project convention over this default.

## Map the files first

Before writing any task, list what this work creates or changes and what each file is responsible for. Task boundaries fall out of that, not the other way around.

One clear responsibility per file. Things that change together live together. Split by responsibility, not by technical layer. Prefer focused files — your own edits are most reliable in code you can hold in context at once, and a file that keeps growing is usually doing too much.

In an existing codebase, follow the patterns already there. Don't restructure unilaterally; but if a file you must touch has become unwieldy, planning a split is fair.

## Size the tasks

**A task is the smallest chunk that carries its own test cycle and is worth reviewing on its own.**

Fold setup, config, scaffolding, and docs into the task whose deliverable needs them. Split only where a reviewer could sensibly accept one task and reject its neighbor.

Every task ends with something that works and is tested. Not "the models are defined" — "you can create a user and read it back."

Most features are 3–8 tasks. Fifteen means they're too small; one means it's too big.

## Header

```markdown
# <Feature> — Implementation Plan

**Design spec:** .ultra-instinct/design/YYYY-MM-DD/<topic>.md
**Goal:** One sentence on what this builds.
**Approach:** 2–3 sentences on the architecture.
**Stack:** Key libraries, with the versions this project is on.

## Constraints

Every project-wide rule, one line each, exact values copied verbatim
from the spec — version floors, naming rules, copy strings, platform
targets, performance budgets. Every task inherits this section.

## References

Carried from the spec, plus anything you looked up while planning.
Docs, changelogs, migration guides, and the in-repo patterns to follow —
each with the version it applies to.
```

## Task shape

````markdown
### Task N: <Name>

**Delivers:** One sentence on what works when this is done.

**Files:**
- Create: `exact/path/to/file.ts`
- Modify: `exact/path/to/existing.ts` (the `handleAuth` function)
- Test: `tests/exact/path/to/file.test.ts`

**Interfaces:**
- Consumes: exact signatures this depends on from earlier tasks
- Produces: exact names, parameter types, and return types later tasks call

**References:** only what this task needs — the specific doc page, the
in-repo file to match, the mockup this screen is built from. Omit if the
task needs nothing external.

**Approach:** the shape of the implementation, and any decision the
implementer shouldn't have to re-derive — a chosen algorithm, a tricky
signature, a magic value that must match something else.

**Verify:** `<the exact command that proves this task is done>`
**Done when:** the observable behaviors that command must confirm.
````

Two parts carry most of the weight:

**Interfaces** is what makes tasks compose. An implementer may see only their own task — this block is how they learn the exact names and types their neighbors expect. Get a name wrong here and two tasks silently won't fit.

**References per task** is what keeps the implementation current. Putting the doc link where the work happens beats a bibliography at the top that nobody scrolls back to. For a task building a screen, that means linking the chosen mockup from the design spec's Visuals — the implementer should be looking at the thing they're building.

State the outcome and how it's checked. Leave the method open unless the method is load-bearing and non-obvious — then say it. You're writing instructions, not transcribing the program.

## Never write these

Plan failures, not style preferences:

- "TBD", "TODO", "implement later"
- "Add appropriate error handling" / "handle edge cases" — say *which* errors and *what* happens
- "Write tests for the above" — name the behaviors to test
- "Similar to Task 3" — repeat it; the reader may not have read Task 3
- A reference to a type, function, or field no task defines
- A **Verify** line that isn't a runnable command

## Commit rhythm

**One commit per task**, after its tests pass. Not per step. Commits are checkpoints worth returning to; "wrote a failing test" is noise in the history.

## Check it against the spec

Read the spec again cold and check your plan against it. The plan is ready when:

- **Every requirement has a task.** Walk the spec, point at the task. Anything unclaimed gets one.
- **No placeholders.** None of the patterns above survive.
- **Interfaces match.** Does `clearLayers()` in Task 3 match what Task 7 calls? Do the types line up across Consumes/Produces? This is the most common real bug in a plan.
- **Order works.** Each task runs given only the ones before it.

Fix inline and move on. No second review pass.

## Hand off

If the user explicitly asks to publish or commit the plan, use `isolate-work` and copy the finalized file to `docs/plans/YYYY-MM-DD/<feature>.md`. Update its design-spec link to the published design path when that copy exists.

Otherwise, save it locally and say where it is. Then use `execute-plan`.
