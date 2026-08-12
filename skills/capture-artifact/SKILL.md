---
name: capture-artifact
description: Use after fresh verification of a completed meaningful tracked workflow, before whole-branch review — turns durable outcomes, decisions, verification, limitations, and related material into one concise project documentation entry. Skip nested skills, trivial edits, abandoned work, and read-only answers.
---

# Capture Artifact

Create exactly one artifact per completed meaningful work item, not once per nested skill. If the work produced no durable change, skip this skill and say why.

## Gather facts

Use the current diff, fresh verification results, relevant code and docs, and useful drafts under `.ultra-instinct/`. Record verified current truth, not a story of how the work unfolded.

## Choose the destination

1. Follow the existing repository docs convention and any direct project or user instruction.
2. Search existing documentation for the same topic. Update an existing artifact before creating a duplicate.
3. When no convention exists, choose the smallest semantic fallback:
   - `docs/features/<slug>.md`
   - `docs/architecture/<slug>.md`
   - `docs/operations/<slug>.md`
   - `docs/decisions/<slug>.md`
   - `docs/<slug>.md`

## Write the artifact

Use only the sections that help a future maintainer:

- Summary
- What changed
- Decisions
- Verification
- Limitations
- Related

Keep it concise and useful without the original conversation. Link to canonical code, specs, or docs when that is more durable than copying details.

Exclude prompts, transcripts, private reasoning, secrets, raw tool output, a chronological diary, and an exhaustive file list. Draft evidence stays ignored under `.ultra-instinct/`; the cleaned artifact belongs under `docs/` and is tracked with the work.

Run only after fresh verification and before `request-review`. Never invoke this skill from a hook, and never create extra artifacts for nested workflow steps.
