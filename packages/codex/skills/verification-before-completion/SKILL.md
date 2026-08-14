---
name: verification-before-completion
description: Use when work appears complete and you are about to claim it works, is fixed, or is ready. Do not use old output or confidence as proof; run fresh checks that cover the claim.
---

# Verification Before Completion

Prove the claim you are about to make.

**Done when** fresh evidence covers the changed behavior and the wider risk, or the unverified boundary is stated plainly.

## Verify

1. Name the exact claim: what works, where, and under which conditions.
2. Choose the command or observation that would fail if that claim were false.
3. Run it now against the current tree. Read the complete exit status and relevant output.
4. Run the wider maintained suite in proportion to the change's risk.
5. Check the diff for unintended files, debug code, and whitespace errors.

A formatter does not prove compilation. A unit test does not prove a browser flow. A green CI run for another commit does not prove this tree.

Report what ran and what passed. If a check cannot run, say why, what remains unproven, and the smallest next step. Never turn “not observed” into “works.”

For a completed meaningful tracked workflow, hand the fresh evidence to `capture-artifact` before whole-branch review. Skip that handoff for trivial edits, abandoned work, and read-only answers.
