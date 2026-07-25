---
name: mockup
description: Use when a design question is easier to settle by showing than describing — builds 2-3 genuinely different visual takes on a screen, layout, or flow so the user can pick. Also covers lighter visuals (ASCII layouts, diagrams) when a full mockup is overkill.
---

# Mockup

Some questions are cheaper to answer with a picture. "Which of these three?" gets a real answer in seconds; "how should the settings page be laid out?" gets a shrug.

**Done when** the user has picked a direction, or told you which parts of which takes they want combined.

## Build in the project, don't commit them

Mockups belong in the project — you want to view them, and design skills need the project's real assets, tokens, and components. But you build three and throw two away, and the brainstorm they came from may not end in a build at all.

So: **build them in the project, uncommitted, and don't trigger isolation.**

```bash
git check-ignore -q .mockups || { echo ".mockups/" >> .gitignore; }
mkdir -p .mockups/<topic>
```

- **No branch, no worktree, no commit.** `isolate-work` fires on the first *committed* artifact. A mockup you're about to discard isn't one, and branching for a conversation that might end in "interesting, never mind" is backwards.
- **`.mockups/` is git-ignored scratch.** Adding the ignore line doesn't need a commit of its own — it rides along whenever the branch is created.
- **Show, don't file.** The deliverable is the user seeing them and picking. Render them however this harness renders things best; the files are just where they live.

If the user explicitly asks to keep one outside this flow ("save that, I'm sending it to someone"), ask where it should go.

## Offer before you build

Mockups cost real tokens. Ask first, in its own message, when a specific visual question actually arises — not preemptively because the topic is UI:

> Easier to show than describe — want me to put together a few takes on this so you can pick?

A question about a UI *topic* isn't automatically a visual question. "What does 'compact mode' mean here?" is conceptual — answer it in text. "Which of these layouts?" is visual — build it.

If they decline, continue in text and don't ask again unless they raise it.

## Match the weight to the question

| Question | What to build |
|---|---|
| Which layout / visual direction? | Full mockups, 2–3 takes |
| How do these screens connect? | A flow diagram |
| Where does this element go? | ASCII sketch in the terminal is often enough |
| What does the data look like? | A table or a rendered sample |

Don't build a full HTML mockup when six lines of ASCII answer the question.

## Building the takes

**Use the design skills that are installed.** If the project has a design system, component library, brand kit, or UI skill available, that governs how things look — invoke it. This skill decides *that* you mock up and *how many*; those decide what good looks like. Improvising your own visual style when a design skill is sitting right there is the main way this goes wrong.

If the codebase already has UI, match it. Pull real colors, spacing, and components from the existing code rather than inventing a parallel aesthetic.

**Make the takes actually different.** Three variations on the same idea waste everyone's time. Each take should embody a different decision — different information hierarchy, different navigation model, different density. Name the idea behind each one:

> **A — Sidebar-first.** Everything reachable in one click, denser.
> **B — Progressive.** One thing at a time, more clicks, less overwhelm.
> **C — Single-page.** Everything scrolls, no navigation at all.

**Use real content.** Real labels, plausible data, realistic text lengths. Lorem ipsum hides exactly the problems a mockup exists to find.

Cover the states that matter, not just the happy one — empty, loading, error, and the case with far more data than looks comfortable.

## Presenting

Show them together so they can be compared, say which you'd pick and why, and make it easy to mix: "B's navigation with A's density" is a normal and good answer.

## Once one is chosen

Note the winning path and one line on why it won. Then it stops being scratch:

- `write-design-spec` moves it into `docs/design/YYYY-MM-DD/assets/` and links it from the Visuals section
- `write-plan` points the frontend tasks at it, so whoever builds the UI is looking at the thing they're building

Don't move it yourself here — there's no branch yet. Rejected takes stay in `.mockups/`.

If the brainstorm ends without a build, the scratch files were the right cost. Nothing to clean up, nothing in git.
