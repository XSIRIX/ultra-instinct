# ultra-instinct

A lightweight agent skill set for shipping features: **brainstorm → spec → plan → build → review**.

Nine skills, no hooks, no session-start injection, no framework. The model picks them up when they apply, the same way it picks up any other skill.

## Install

```bash
npx skills add xsirix/ultra-instinct
```

Global (available in every project):

```bash
npx skills add xsirix/ultra-instinct -g
```

Just one skill:

```bash
npx skills add xsirix/ultra-instinct --skill tdd
```

Works with Claude Code, Codex, Cursor, OpenCode, Gemini CLI, and ~70 other agents via the [skills CLI](https://github.com/vercel-labs/skills).

## The flow

```
brainstorm ──┬─→ (just thinking, stop here)
    │        │
  mockup     └─→ write-design-spec ──→ write-plan ──→ execute-plan ──→ request-review ──→ finish-branch
 .mockups/          │                                      │
 (ignored)     isolate-work                               tdd
```

| Skill | Fires when |
|---|---|
| `brainstorm` | An idea or problem needs thinking through. May end without an artifact. |
| `mockup` | A design question is easier to settle by showing than describing. |
| `write-design-spec` | The design is settled and it's going to be built. First committed artifact — triggers isolation. |
| `write-plan` | A spec exists and needs to become ordered, executable tasks. |
| `isolate-work` | Before the first artifact. Detects existing isolation and no-ops. |
| `execute-plan` | A plan exists. Runs to completion, TDD per task, one commit per task. |
| `tdd` | Any feature, bugfix, or behavior change. |
| `request-review` | Implementation is done. One reviewer subagent over the whole branch. |
| `finish-branch` | Reviewed and green. Merge, PR, or keep. |

Nothing forces you through all nine. `tdd` and `mockup` are useful alone. `brainstorm` often ends at "now I understand the problem." The chain exists for work big enough to need it.

## Design choices

**Right altitude, not minimum rules.** Instructions state the outcome and how it's verified, then leave the method open — *unless* the method is load-bearing and non-obvious, in which case it's stated exactly. Both failure modes are real: brittle step-by-step procedure, and vague guidance that assumes shared context the model doesn't have. ([Anthropic on context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents))

**No hook.** Nothing is injected into every session. Skills load when the model decides they're relevant and cost nothing when they aren't.

**No compliance tables.** No "Common Rationalizations", no "Red Flags — STOP", no `<EXTREMELY-IMPORTANT>` wrappers. If a rule needs a table of excuses to enforce it, the rule isn't explaining itself well enough.

**Grounded in current docs, not memory.** `brainstorm` checks real docs before recommending anything. What it found lands in the spec's References, gets carried into the plan *per task*, and is what `execute-plan` reads before writing against an API — so the links sit where the work happens instead of in a bibliography nobody scrolls back to.

**Brainstorming can end in nothing.** Not every conversation is a project.

**Isolation is late.** The worktree happens when the first *committed* artifact gets written — the spec — not before the conversation starts.

**Mockups are scratch until they're chosen.** Built in the project under git-ignored `.mockups/`, so exploring three visual takes doesn't force a branch for work nobody has committed to yet — and never lands in `docs/`. Once one is picked, it moves into `docs/design/<date>/assets/`, gets linked from the design spec's Visuals, and gets referenced by the frontend tasks in the plan. Rejected takes never touch git.

**Docs are grouped by day.** `docs/design/YYYY-MM-DD/<topic>.md` and `docs/plans/YYYY-MM-DD/<feature>.md`. A flat plans directory hits fifty files fast and stops being scannable.

**One review.** At the end, over the whole branch, one fix pass. Per-task review gates cost more than they catch when the plan is good and every task ships green tests.

**One commit per task.** Not per step.

## License

MIT
