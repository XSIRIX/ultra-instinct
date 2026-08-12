# Harbor A/B Benchmark — Implementation Plan

**Design spec:** `docs/design/2026-08-12/harbor-ab-benchmark.md`
**Goal:** Build a free-to-prepare, paid-to-run Harbor experiment that measures vanilla Codex against Codex with Ultra Instinct `guided` on Terminal-Bench 2.1.
**Approach:** Keep both conditions in one Harbor job and implement them as two thin subclasses of one pinned Harbor Codex adapter. Prepare immutable job inputs offline, then analyze deterministic Harbor verifier results with task-clustered paired statistics.
**Stack:** Node.js 20+, Python 3.12+, Harbor 0.16.1, Terminal-Bench 2.1 revision 6, Codex CLI supplied as an exact run parameter.

## Constraints

- Do not call a model, create cloud resources, download Terminal-Bench tasks, or alter normal Codex state during setup or validation.
- Test Ultra source commit `ce3f5da4e6dca5fbeebece061976379835ba70b4`.
- Pin Harbor exactly to 0.16.1 and Terminal-Bench 2.1 exactly to revision 6.
- Require exact model and Codex version inputs; reject floating aliases.
- `codex-vanilla` must register no Ultra capabilities. `codex-ultra-guided` must install the native local plugin with `ULTRA_INSTINCT_PROFILE=guided`.
- Use one shared agent implementation, task set, concurrency pool, authentication method, prompt, permissions, timeout, and verifier.
- Keep generated jobs and results under ignored `evals/results/harbor/`.
- Deterministic verifier reward is the primary outcome; no LLM judge participates.
- Errored trials count as zero and invalidate the inferential verdict until rerun.
- Commit once per task after its focused check and the full repository suite pass.

## References

- [Design spec](../../design/2026-08-12/harbor-ab-benchmark.md)
- [Harbor 0.16.1 Codex adapter](https://github.com/harbor-framework/harbor/blob/v0.16.1/src/harbor/agents/installed/codex.py)
- [Harbor custom agents](https://www.harborframework.com/docs/agents)
- [Harbor job concepts](https://www.harborframework.com/docs/core-concepts)
- [Harbor adapter parity checklist](https://www.harborframework.com/docs/datasets/adapters)
- [Terminal-Bench 2.1 dataset revision 6](https://hub.harborframework.com/datasets/terminal-bench/terminal-bench-2-1/6)
- Existing test runner: `validation/test.mjs`

### Task 1: Offline experiment preparation

**Delivers:** Reviewed smoke, pilot, and full manifests can generate a locked Harbor job description without starting or installing anything.

**Files:**
- Create: `evals/harbor/contracts.mjs`
- Create: `evals/harbor/prepare.mjs`
- Create: `evals/harbor/manifests/smoke.json`
- Create: `evals/harbor/manifests/pilot.json`
- Create: `evals/harbor/manifests/full.json`
- Create: `tests/harbor/prepare.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `loadExperimentManifest(path)` returning a validated frozen experiment definition.
- Produces: `createRunFiles(options)` returning `{ job, runManifest }` without filesystem or network effects.
- Produces: `prepareRun(options)` writing `job.json` and `run-manifest.json` to a new label directory.
- Produces CLI: `npm run eval:harbor:prepare -- --experiment <smoke|pilot|full> --label <safe-label> --model <provider/exact-model> --codex-version <semver> [--reasoning high] [--environment docker|daytona] [--concurrency N]`.
- Job agent import paths are `evals.harbor.agents.codex_ab:CodexVanilla` and `evals.harbor.agents.codex_ab:CodexUltraGuided`.

**References:**
- Design requirements 7–12.
- Harbor `JobConfig`, `DatasetConfig`, and `AgentConfig` at version 0.16.1.

**Approach:** Validate the experiment files as closed JSON contracts. Generate one job containing both agents in a shared concurrency group, the pinned dataset revision, fixed task filters, and the expected number of attempts. Record a deterministic bootstrap seed, source commit, versions, parameters, and expected trial count in the run manifest. Refuse existing output labels and any model or version containing `latest`, `default`, wildcard syntax, or whitespace.

**Verify:** `node validation/test.mjs tests/harbor/prepare.test.mjs`
**Done when:** Tests first fail for missing preparation behavior, then prove all three trial counts, frozen task lists, identical condition settings, safe input rejection, and zero side effects outside the requested output directory.

### Task 2: True-off and guided Codex agents

**Delivers:** Harbor can instantiate two Codex agents whose only functional difference is native Ultra plugin registration.

**Files:**
- Create: `evals/__init__.py`
- Create: `evals/harbor/__init__.py`
- Create: `evals/harbor/agents/__init__.py`
- Create: `evals/harbor/agents/codex_ab.py`
- Create: `evals/harbor/pyproject.toml`
- Create: `evals/harbor/uv.lock`
- Create: `evals/harbor/tests/test_codex_ab.py`

**Interfaces:**
- Consumes: exact source commit and profile from `evals/harbor/manifests/*.json` through generated agent kwargs/environment.
- Produces: `CodexVanilla`, a Harbor `Codex` subclass named `codex-vanilla`.
- Produces: `CodexUltraGuided`, a Harbor `Codex` subclass named `codex-ultra-guided`.
- Produces: shared snapshot upload to `/opt/ultra-instinct` from `git archive <sourceCommit>`.
- Produces: guided registration commands `codex plugin marketplace add /opt/ultra-instinct --json` and `codex plugin add ultra-instinct@ultra-instinct --json` during the parent's isolated Codex-home setup.

**References:**
- Harbor 0.16.1 `Codex.run`, `_build_register_skills_command`, `_build_register_mcp_servers_command`, and `BaseInstalledAgent.setup`.
- Codex local marketplace CLI verified with Codex 0.147.0.

**Approach:** Pin the Python environment with `uv`. One private base subclass archives and uploads the same commit for both conditions. Override the parent's registration hook to append plugin commands only for the guided subclass, while preserving any MCP registration. Do not copy Harbor's run loop. Validate the uploaded archive contains the expected plugin manifest and commit metadata before upload.

**Verify:** `UV_CACHE_DIR=/tmp/ultra-harbor-uv uv run --project evals/harbor --group dev pytest evals/harbor/tests`
**Done when:** Tests first fail for missing agents, then prove both classes inherit Harbor's adapter, report distinct names, upload identical committed source, preserve parent registration, and only guided registers the plugin and profile.

### Task 3: Paired result analysis

**Delivers:** A completed Harbor job produces a deterministic, auditable comparison without a model judge.

**Files:**
- Create: `evals/harbor/analyze.mjs`
- Create: `tests/harbor/analyze.test.mjs`

**Interfaces:**
- Consumes: `run-manifest.json` plus one Harbor job directory containing per-trial `result.json` files.
- Produces: `loadHarborTrials(jobDir)` normalized to condition, task, reward, error, checksum, model, version, tokens, cost, and duration.
- Produces: `analyzeHarborRun({ runManifest, trials })` returning validity, task-level pairs, aggregate metrics, deterministic 95% interval, efficiency flags, and verdict.
- Produces CLI: `npm run eval:harbor:analyze -- --run <label> --job-dir <path>` writing `comparison.json` and `comparison.md` beside the prepared run manifest.

**References:**
- Harbor 0.16.1 `TrialResult`, `VerifierResult`, and `AgentContext` JSON contracts.
- Design requirements 13–18.

**Approach:** Require exactly the manifest's attempt count per condition and task. Match conditions at task level and reject version, model, or checksum drift. Count missing reward and exceptions as zero; record exceptions and withhold an inferential verdict. Calculate task-level mean deltas, then use a seeded task-clustered bootstrap with 10,000 resamples. Make the primary verdict depend only on completion and validity; treat token, cost, duration, and tool-process metrics as secondary diagnostics.

**Verify:** `node validation/test.mjs tests/harbor/analyze.test.mjs`
**Done when:** Tests first fail for missing analysis, then prove helped/hurt/unchanged classification, error handling, mismatch rejection, deterministic intervals, non-inferiority and improvement rules, and the 15% efficiency guardrail.

### Task 4: Reproducible operator workflow

**Delivers:** An operator can validate, prepare, inspect, explicitly launch, and analyze the benchmark without confusing free setup with paid execution.

**Files:**
- Create: `evals/harbor/README.md`
- Create: `tests/static/harbor-benchmark.test.mjs`
- Modify: `README.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: preparation, Python agent, and analysis commands from Tasks 1–3.
- Produces: `npm run eval:harbor:check` for free Node and Python checks.
- Documents: local Docker smoke command, Daytona pilot/full command, required credentials, exact expected trial counts, cost preflight after smoke, result locations, no-upload default, and the explicit paid boundary.

**References:**
- [Harbor getting started](https://www.harborframework.com/docs/getting-started)
- [Harbor jobs](https://www.harborframework.com/docs/run-jobs)
- Existing `evals/README.md` wording for paid-run consent.

**Approach:** Keep launch commands manual and visually separated from preparation commands. Require the operator to inspect `run-manifest.json` before `harbor run`. Explain that the 6-run smoke checks plumbing, the 90-run pilot detects large effects, and only the 890-run five-attempt experiment supports the recognized full comparison.

**Verify:** `npm run check && npm run eval:harbor:check`
**Done when:** The complete repository and pinned Python adapter suite pass, documentation names every required input and output, generated files remain ignored, and no command run by validation can start a paid trial.
