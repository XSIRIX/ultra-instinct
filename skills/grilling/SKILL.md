---
name: grilling
description: Use when a proposed plan or design has a direction but its decisions, assumptions, or failure cases need pressure-testing before a design spec. Do not use for rough ideation, an already confirmed design, or implementation work.
---

# Grilling

Turn a plausible design into confirmed, buildable input by walking its decision tree with the user.

**Done when** every material branch is settled or explicitly deferred, the frontier is empty, the decision record is current, and the user explicitly confirms the shared understanding.

Do not write a spec, plan, or code during this skill. The agent researches and recommends. The user decides.

## Ground the proposal

Restate what is being proposed, what success means, and what is out of scope. Start from the selected result of `brainstorm`, a design the user brought, or an existing grilling brief.

When the work is inside a codebase or project workspace, inspect the relevant code, README, local docs, recent history, and pinned versions first. Check current primary documentation when the design depends on an external library, platform, API, rule, or other fact that may have changed. Answer factual questions from evidence instead of asking the user to guess.

Outside a project or repository, run the same interview in conversation. Create no file.

## Keep a local decision brief in projects

After the first material decision, create or resume:

`.ultra-instinct/grills/YYYY-MM-DD/<topic>.md`

Before writing the brief, prove its target path is ignored. In Git, run `git check-ignore -q .ultra-instinct/grills/YYYY-MM-DD/<topic>.md`. If `.ultra-instinct/.gitignore` does not exist, create it with `*`. If it exists but the grill path is not ignored, append `/grills/` without replacing any existing line. Run `git check-ignore` again before writing.

If there is no active version-control ignore mechanism, or you cannot prove the grill path is ignored, stay in conversation and create no file. Never risk turning private working notes into a tracked change.

Update the brief after every round. Preserve:

- the original proposal and success condition;
- evidence and references;
- every explored branch, including rejected and deferred choices;
- accepted decisions and their reasons;
- requirements, constraints, failure cases, and risks;
- the unresolved frontier;
- whether the user has explicitly confirmed the final understanding.

This is ignored working state, not canonical project documentation. Do not automatically edit `CONTEXT.md`, ADRs, or tracked product docs. Offer publication as a separate isolated change only when the user asks.

## Walk the decision tree

Build a decision tree from the proposal. A child choice stays blocked until its parent choice is settled. The **frontier** is the set of unresolved choices whose prerequisites are settled now.

For each round:

1. Research any frontier question that evidence can answer.
2. Group independent judgment questions into one concise message.
3. Number and title every question.
4. Give a **Recommended** answer and one short reason for each.
5. Wait for the user's decisions.
6. Record the answers, consequences, rejected branches, and new frontier.

Do not dump the whole tree at once. Do not ask a dependent question early. Do not silently choose for the user because a recommendation went unanswered.

Use concrete failure cases to expose hidden choices: invalid input, partial success, retries, permissions, cancellation, migration, rollback, observability, and testing. Only cover cases that can materially change this design.

## Confirm the boundary

When the frontier is empty, present the final shared understanding in a compact form:

- outcome and non-goals;
- chosen design and boundaries;
- important rejected alternatives;
- failure behavior;
- requirements and constraints;
- risks or explicitly deferred choices;
- evidence and references.

Ask the user to explicitly confirm that this is the design to specify. A summary without confirmation is not approval.

After confirmation, use `write-design-spec`. Pass it the confirmed brief or confirmed conversation so it can synthesize the design without re-interviewing the user.
