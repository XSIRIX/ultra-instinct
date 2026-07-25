---
name: execute-plan
description: Use when an implementation plan exists and it's time to build it — works through the tasks with TDD, checking current library docs rather than coding from memory, committing per task. Runs to completion without check-ins. Follows write-plan, precedes request-review.
---

# Execute Plan

**The goal is a completed plan.** Not a task, not a checkpoint — the whole plan, tested and committed.

## Before you start

Get isolated if you aren't (`isolate-work`). Read the plan end to end once, note the Constraints and References, and create a todo per task.

Then scan for contradictions: tasks that conflict with each other or the Constraints, interfaces that don't line up, a requirement no task covers. Raise everything you find **at once, now** — one batched question beats five interruptions later. If the scan is clean, just start; don't announce that it's clean.

## Run to completion

Work the tasks in order. Don't stop between them to ask "should I continue?" or to summarize progress — the user asked for the plan to be built, so build it. The commits and test output are the record; narrate lightly.

Stop only for a blocker you genuinely can't resolve, an ambiguity where every reading leads somewhere materially different, a plan defect that invalidates later tasks, or completion. When you stop, say exactly what's blocking and what you need.

## Each task is done when

- Its tests were written first, watched fail, and now pass (`tdd`)
- The task's **Verify** command passes
- The full suite is green
- It's committed, with a message saying what changed and why

How you get there is yours. Nothing leaves a task red — a failing suite at the end of Task 3 is Task 3's problem, not Task 8's.

## Don't code from memory

Library APIs move faster than training data. Before writing non-trivial code against an external library, framework, or platform API:

- Read the plan's **References** for that task first — that's why they're there
- Check the version the project actually pins (`package.json`, lockfile, `Cargo.toml`, `pyproject.toml`) and read the docs *for that version*
- Use whatever search and fetch tools you have — web search, Exa, docs-fetching skills — when the references don't cover what you hit
- Match the codebase's existing usage of that library over anything you find externally

If you discover something the plan's references got wrong or missed, add it to them. The next task benefits, and so does the reviewer.

Code written against last year's API is a bug you find at runtime, not compile time.

## Use the skills you have

Other installed skills exist for a reason. If a task touches a domain one covers — a framework, a design system, a database, a deployment target — invoke it rather than improvising. This skill governs *process*; those govern *substance*.

## Delegating tasks

Optional. Worth it when a task is well-specified and self-contained and your context is filling with detail you won't need again.

If you delegate: one task per subagent, never two implementers at once (they'll collide on the same files). Hand over the task text, its Interfaces block, its References, and the Constraints — not your session history. Point at files rather than pasting them; anything pasted into a prompt lives in your context for the rest of the session.

Verify the result yourself — read the diff, run the tests. A subagent reporting success is a claim, not evidence. If one comes back blocked, give it more context or a stronger model; don't re-run the same thing and hope.

## Evidence before claims

"Tests pass" means you ran them in this message and read the output. Not an earlier run, not "should pass." "Build works" means exit 0 — a clean linter proves nothing about compilation. "The bug is fixed" means you retested the original symptom. "The agent did it" means you read the diff.

If you're about to write "should now", "I believe", or "Perfect!" before running anything — run it first.

## When the plan is done

All tasks complete, suite green, everything committed. Use `request-review`.
