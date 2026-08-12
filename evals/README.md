# Cross-client evaluations

The eval suite asks Claude Code, Codex, and OpenCode to perform the same nine small scenarios. It records only normalized facts. Raw prompts and model output are never written to results.

## Free deterministic checks

```bash
npm run check
npm run eval -- --dry-run --client all --profile guided --repeat 5 --label guided
```

Dry-run validates the scenario matrix. It does not start a client, call a model, create result files, or change client state.

## Paid live model runs

Live runs consume model credits. They use temporary fixture workspaces and delete each workspace after grading. Claude uses print mode with no session persistence. Codex uses an ephemeral app-server thread. OpenCode uses a temporary workspace-local plugin loader.

Codex may add a temporary fixture to trusted-project state. OpenCode may keep a local session record. The runner refuses either client until you explicitly allow that client state:

```bash
npm run eval -- --client all --profile lite --repeat 5 --label baseline --allow-client-state
npm run eval -- --client all --profile guided --repeat 5 --label guided --models-from baseline --allow-client-state
npm run eval -- --client all --profile strict --repeat 5 --label strict --models-from baseline --allow-client-state
```

`--models-from baseline` reuses the exact model slug reported by each baseline client. A comparison fails if the model changes.

Run one cheaper slice with `--client claude`, `--client codex`, or `--client opencode`. Use `--model <exact-slug>` only when every selected client accepts that slug.

## Compare and report

```bash
npm run eval:compare -- --baseline baseline --candidate guided
npm run eval:report -- --runs baseline,guided,strict
```

Acceptance requires:

- each positive case routes correctly in at least four of five runs per client;
- guided positive routing is at least 90% overall;
- false-positive routing is at most 10% and no more than five percentage points above baseline;
- when baseline is below 70%, guided improves by at least 20 percentage points;
- compaction recovery and strict completion stay bounded.

Ignored results live under `.ultra-instinct/evals/<label>/<client>/<profile>/`. Each folder contains sanitized traces plus JSON and Markdown summaries. The combined report records client version, exact model slug, operating system, profile, and failure signatures.

## Trace contents

Allowed trace events are:

- client metadata: client, version, model, OS, profile;
- skill loaded or announced;
- tool category: read, mutation, verification, or other;
- hook stage;
- strict continuation;
- compaction restoration result;
- final success or failure.

The trace sanitizer drops all other fields before anything reaches disk.
