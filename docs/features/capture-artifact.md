# Durable Workflow Artifacts

## Summary

Ultra Instinct turns the lasting result of a completed meaningful workflow into one concise project documentation entry. Draft evidence remains private and ignored; future maintainers get the decisions and verified current behavior they need.

## What changed

- The `capture-artifact` skill chooses an existing project docs convention, updates an existing topic when possible, and otherwise selects a small semantic path under `docs/`.
- The canonical router now selects it only for freshly verified, meaningful tracked work.
- The completion flow is `verification-before-completion` → `capture-artifact` → `request-review`.
- Whole-work review includes committed, staged, unstaged, and untracked artifacts.
- The live evaluation matrix checks in-place topic updates, duplicate prevention, private-text exclusion, and skip behavior for trivial and read-only work.
- Ultra Instinct now ships fourteen canonical skills across Claude Code, Codex, OpenCode, and skills-only installs.

## Decisions

- Create one artifact per complete meaningful work item, not one per nested skill.
- Keep drafts, evaluation output, runtime facts, and working evidence under ignored `.ultra-instinct/`.
- Track the cleaned result in the project's normal docs structure. Existing repository and user conventions win.
- Prefer updating the existing topic over adding a duplicate.
- Use a skill for semantic documentation work. Hooks never write docs or make editorial decisions.
- Skip trivial edits, abandoned work, and read-only answers.

## Verification

- `npm run check` validated the skill, lifecycle order, router byte budget, catalog, metadata, runtime, adapters, packaging, and all 110 tests.
- The Skill Creator validator accepted `skills/capture-artifact/SKILL.md` and its `agents/openai.yaml` metadata.
- `npm run eval:harbor:check` passed 13 Node checks and 4 Python tests against the pinned implementation commit.
- `claude plugin validate .` accepted the Claude marketplace, and `npm pack --json --dry-run` included the new skill in the RC package.
- A disposable forward test updated an existing topic in place and excluded its fake private prompt. The maintained live scenario now grades the same behavior without storing document content in results.

## Limitations

- The agent must judge whether work is meaningful enough to deserve a durable artifact.
- Repositories without a docs convention use Ultra Instinct's semantic fallback paths.
- The skill summarizes verified repository facts; it does not preserve a session history or private reasoning.

## Related

- [`capture-artifact` skill](../../skills/capture-artifact/SKILL.md)
- [Canonical router](../../skills/using-ultra-instinct/SKILL.md)
- [Ultra Instinct v2 runtime design](../design/2026-08-12/ultra-instinct-v2-runtime.md)
- [Runtime guide](../runtime.md)
