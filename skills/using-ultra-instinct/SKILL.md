---
name: using-ultra-instinct
description: Use when the user asks about ultra-instinct itself — how it works, what skills exist, which to use, where to start — or says "use ultra instinct". A brief on the suite and how to route within it. Not a workflow step; produces no artifact.
---

# Using Ultra Instinct

If you were dispatched as a subagent to execute a specific task, ignore this — you were given your scope already.

## The rule

Pick the skill before you act, not after. That includes before asking clarifying questions and before exploring the codebase — the skills say *how* to do both, so reading one first changes what you do. If it turns out wrong once you're in it, drop it; checking costs seconds, not checking costs a whole approach done the default way.

Say which one you're using in a line — "using `write-plan` to turn the spec into tasks" — then follow it. Don't recite the chain; most work touches two or three of these.

Process before implementation. `brainstorm` sets the approach, the building skills carry it out. "Let's build X" is `brainstorm` first, not `execute-plan` first.

User instructions win. CLAUDE.md, AGENTS.md, and anything the user says directly override these skills; these skills override your defaults.

## The suite

Nine skills covering idea → merged. No hooks, no session injection — each loads when it applies.

```
brainstorm ──┬─→ (just thinking, stop here)
    │        │
  mockup     └─→ write-design-spec ──→ write-plan ──→ execute-plan ──→ request-review ──→ finish-branch
  (temp)            │                                      │
               isolate-work                               tdd
```

## Routing

Match where the user actually is, not the top of the chain:

| They have | Use |
|---|---|
| A rough idea, nothing written | `brainstorm` |
| A visual question — layout, screen, flow | `mockup` |
| An agreed design, in conversation only | `write-design-spec` |
| A spec, or clear written requirements | `write-plan` |
| A plan on disk | `execute-plan` |
| A small bugfix or behavior change | `tdd` alone |
| A built branch | `request-review`, then `finish-branch` |
| A first artifact about to be written | `isolate-work` (no-ops if already isolated) |

Every skill needs its input to exist, but that input can come from anywhere — the user's head, a doc from last week, another session. Don't rerun an earlier stage to manufacture something that already exists in another form. If the entry point is genuinely ambiguous, ask once.

## Facts worth having when asked

- **Artifacts:** mockups in a temp directory outside the repo (chosen ones get copied to `docs/design/<date>/assets/`), `docs/design/YYYY-MM-DD/<topic>.md`, `docs/plans/YYYY-MM-DD/<feature>.md`. Dated directories because flat ones stop being scannable.
- **Isolation is late** — the branch or worktree starts at the first *committed* artifact (the spec), not at the conversation.
- **Docs over memory** — anything touching a library or API is checked against current docs. Those links flow spec References → per-task references → read by `execute-plan` before it writes against that API.
- **`brainstorm` may end with nothing.** Not every conversation is a project.
- **`execute-plan` runs to completion** — no per-task check-ins unless the user asks before it starts.
- **One review pass** at the end, over the whole branch. **One commit per task**, not per step.
- Install: `npx skills add xsirix/ultra-instinct` (`-g` global, `--skill <name>` for one).
