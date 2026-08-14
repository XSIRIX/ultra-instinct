---
name: systematic-debugging
description: Use when a test, build, runtime, or integration failure has an unexplained cause and needs evidence-led diagnosis before a fix. Do not use when the cause is already confirmed; use tdd for that behavior change.
---

# Systematic Debugging

Find the cause before changing the code.

**Done when** one testable root-cause hypothesis explains the evidence, or the remaining uncertainty and next observation are explicit.

## Ground the expected behavior

Before any edit, run one bounded grounding pass:

1. Reproduce the failure and read the full error and producing code path.
2. Search the repository for the same boundary, nearby working paths, and the established implementation pattern.
3. Identify the pinned version of any library, framework, API, or platform involved.
4. When external behavior or an unfamiliar error is involved, use web search or Exa to read one to three authoritative sources for that version. Prefer official docs and source code, then release notes and issue trackers.
5. State what should happen, what actually happens, and which evidence establishes the difference.

For purely internal logic with no external contract, the repository pass is enough. Do not manufacture unrelated searches.

Reuse these references through diagnosis, TDD, and review. Search again only if the hypothesis changes or a fix fails. If search is unavailable, state that limit instead of guessing or claiming the guidance is current.

## Investigate

1. Separate observed facts from guesses.
2. Compare the failing path with a nearby working path.
3. Trace bad data or state backward to where it first becomes wrong.

Do not stack speculative fixes. Each edit destroys evidence and makes the next result harder to interpret.

## Test the hypothesis

State one hypothesis in a falsifiable form: “X causes the failure because Y; if true, Z will happen.” Run the smallest check that can disprove it.

If it fails, record what changed in your understanding and form a new hypothesis. If an earlier fix attempt failed, treat that as new evidence, stop editing, and return to the grounding pass instead of stacking another patch. If the hypothesis holds, hand the confirmed behavior change to `tdd`: add the regression test, watch it fail for the same reason, then implement the smallest fix.

If the issue is environmental or external, report the exact evidence and boundary instead of inventing a code change.
