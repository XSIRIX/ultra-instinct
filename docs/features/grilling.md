# Grilling

## Summary

`grilling` pressure-tests a selected design before it becomes a design spec. It walks dependent choices in frontier rounds, researches facts from the project and current primary docs, recommends an answer for each choice, and leaves the decision with the user.

The build flow is:

`brainstorm -> grilling -> write-design-spec -> write-plan -> execute-plan`

## What changed

- Added one self-contained `grilling` skill and command.
- Added routing from `brainstorm` into grilling and from a confirmed grill into `write-design-spec`.
- Added an ignored resumable decision brief at `.ultra-instinct/grills/YYYY-MM-DD/<topic>.md` when work happens inside a project. Conversation-only grills create no file.
- Added command-surface, package, evaluator, documentation, and provenance coverage.
- Split the generated Codex hook configuration from Claude Code's richer lifecycle configuration.

## Decisions

- The public workflow is named only `grilling`; there are no `grill-me` or `grill-with-docs` aliases.
- A grill ends only when its material frontier is empty and the user explicitly confirms the shared design.
- Grilling never silently changes tracked `CONTEXT.md`, ADRs, or product documentation.
- Codex registers `SessionStart` only. Current local-command `PostToolUse.tool_response` is model-facing text without a trustworthy exit status, so Codex does not track mutation or verification facts or run completion gates.
- Claude Code and OpenCode retain mutation tracking and bounded verification guidance because their tested event contracts provide a reliable success signal.

## Verification

- `npm run check`: 120 tests passed and all package validators passed.
- `git diff --check`: passed.
- `npm pack --json --dry-run --silent`: succeeded with 86 package entries.
- Codex adapter coverage uses the current plain-string Bash response shape and proves it is not accepted as successful verification.
- Generated Codex package coverage proves its only registered hook is `SessionStart` for `startup|resume|clear|compact`.

## Limitations

- Paid live-model routing evaluations were not run.
- The changed plugin was not installed, published, pushed, merged, or deployed.
- Codex verification tracking remains disabled until the client exposes trustworthy command-success metadata to hooks.

## Related

- [`skills/grilling/SKILL.md`](../../skills/grilling/SKILL.md)
- [`hooks/hooks.codex.json`](../../hooks/hooks.codex.json)
- [`docs/runtime.md`](../runtime.md)
