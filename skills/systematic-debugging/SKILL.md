---
name: systematic-debugging
description: Use when a test, build, runtime, or integration failure has an unexplained cause and needs evidence-led diagnosis before a fix. Do not use when the cause is already confirmed; use tdd for that behavior change.
---

# Systematic Debugging

Find the cause before changing the code.

**Done when** one testable root-cause hypothesis explains the evidence, or the remaining uncertainty and next observation are explicit.

## Investigate

1. Reproduce the failure with the smallest reliable command or action.
2. Read the full error and the code path that produces it.
3. Separate observed facts from guesses.
4. Compare the failing path with a nearby working path.
5. Trace bad data or state backward to where it first becomes wrong.

Do not stack speculative fixes. Each edit destroys evidence and makes the next result harder to interpret.

## Test the hypothesis

State one hypothesis in a falsifiable form: “X causes the failure because Y; if true, Z will happen.” Run the smallest check that can disprove it.

If it fails, record what changed in your understanding and form a new hypothesis. If it holds, hand the confirmed behavior change to `tdd`: add the regression test, watch it fail for the same reason, then implement the smallest fix.

If the issue is environmental or external, report the exact evidence and boundary instead of inventing a code change.
