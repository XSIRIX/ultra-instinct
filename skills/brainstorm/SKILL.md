---
name: brainstorm
description: Use when the user brings an idea, feature, problem, or "what if" to think through — explores intent, constraints, and approaches through dialogue, grounded in current docs rather than memory. Produces shared understanding; only writes a document if the user decides to build.
---

# Brainstorm

Turn a rough idea into a clear one through conversation.

**Done when** the user either understands the problem well enough to stop, or has a design they've agreed to and want built. Both are real endings. Don't manufacture a document out of a conversation that was just thinking.

## Ground yourself before proposing anything

Two cheap sources of context, both worth having before you open your mouth:

**The codebase** — relevant files, README, recent commits, the patterns already in use. A question you could have answered by reading is a wasted question.

**The outside world** — if the idea touches a library, framework, API, or platform, check what's actually current before recommending it. Use whatever search and fetch tools you have: web search, Exa, a docs-fetching skill, the library's own docs. Check the version the project is actually pinned to, not the latest release.

Your training data has a cutoff; the ecosystem doesn't. A confident recommendation for a pattern that was deprecated eight months ago is worse than saying "let me check."

**Keep every link you used.** Anything that shaped the design goes into the spec's References section. The user shouldn't have to re-find what you already read, and neither should you, three tasks into the implementation.

## Ask what you need to know

Group related questions in one message; split when an answer would change what you'd ask next. Don't ration yourself to one question per turn, and don't dump twenty at once.

What's worth knowing: what the user wants to be true afterward, what constrains it (stack, deadlines, things that mustn't break), how they'll know it worked, and what's explicitly out of scope.

Concrete options beat open prompts. "Per-user or per-org?" beats "how should permissions work?"

## Check the size early

If the idea is really several independent systems, say so before refining details. Help split it into pieces that each ship on their own, then brainstorm the first piece. Ten questions polishing something that needs decomposing is ten wasted questions.

## Put real options on the table

2–3 approaches, your recommendation first with the reasoning. Every option needs an honest trade-off — one you'd never pick isn't an option, it's padding.

Apply YAGNI hard. Every feature in the design should trace to something the user actually said.

**If the work has a visual surface** — a screen, a layout, a flow, a component — a picture settles arguments that paragraphs won't. Use `mockup` to offer the user real mockups of the competing takes. Offer it when a specific visual question comes up, not preemptively for anything UI-adjacent.

Mockups built here are scratch — they live under ignored `.ultra-instinct/mockups/<topic>/` and don't start a branch. Nothing has been committed to yet, and most get thrown away. A chosen mockup may be referenced by `write-design-spec`; publish it only when the user explicitly asks.

## Present the design

Sections sized to their complexity — a sentence where it's obvious, a few paragraphs where it's subtle. Check in as you go rather than delivering a monolith and asking "good?"

Cover what's relevant: the pieces and their boundaries, how data moves, what happens when things fail, how it gets tested. Skip what isn't.

**Design for parts that fit in your head.** Each unit does one thing, exposes a clear interface, and is testable alone. If you can't say what a unit does without describing its internals, the boundary is wrong. This isn't purity — focused files are where your own edits are most reliable.

**In an existing codebase:** follow the patterns that are there. Where existing code genuinely blocks the work, fold a targeted fix into the design. Don't propose unrelated refactors.

## Ending

If the user wants it built, use `write-design-spec` — it saves the agreed design under ignored `.ultra-instinct/design/` and the implementation moves onto its own branch. Publish the spec only when the user explicitly asks.

If it was just thinking, stop here. Ask which it is if it's unclear; don't assume the first.
