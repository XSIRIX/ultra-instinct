# Harbor A/B Benchmark

## Goal

Measure whether Ultra Instinct improves completed agent work, rather than only improving skill routing. The benchmark must compare a true vanilla client with the same client running Ultra Instinct's default `guided` profile under identical, reproducible conditions.

## Context

The existing `evals/` suite checks routing, hook behavior, compaction recovery, and bounded continuation across Claude Code, Codex, and OpenCode. It does not provide a true Ultra-off control because the `lite` profile still exposes the canonical skills, and it does not grade substantial end-to-end work in public benchmark environments.

Terminal-Bench 2.1 supplies 89 containerized tasks with executable verifiers. Harbor 0.16.1 is the official runner and supports installed coding agents, repeated trials, clean environments, trajectory export, and custom agent import paths. The first experiment will use Codex because one client is enough to validate the experimental method before multiplying cost across all three clients.

## Requirements

1. Provide two Codex conditions named `codex-vanilla` and `codex-ultra-guided`.
2. Both conditions must use the same Codex version, exact model identifier, reasoning effort, prompt, tool permissions, timeout, task image, authentication method, and Harbor agent implementation.
3. The vanilla condition must not register Ultra Instinct skills, hooks, bootstrap text, or runtime state.
4. The treatment condition must install Ultra Instinct from Git commit `ce3f5da4e6dca5fbeebece061976379835ba70b4`, enable the native Codex plugin, and set `ULTRA_INSTINCT_PROFILE=guided`.
5. Both conditions must receive the same archived Ultra source outside the task workspace so installation mechanics and uploaded bytes do not create an environmental difference. Only plugin registration may differ.
6. Every trial must use a clean container, isolated `CODEX_HOME`, and isolated `ULTRA_INSTINCT_STATE_DIR`.
7. Pin Harbor to `0.16.1` and Terminal-Bench 2.1 to Harbor Hub dataset revision `6`.
8. Provide three fixed experiment manifests:
   - smoke: 3 tasks, 1 attempt, 2 conditions, 6 trials;
   - pilot: 15 tasks, 3 attempts, 2 conditions, 90 trials;
   - full: all 89 tasks, 5 attempts, 2 conditions, 890 trials.
9. Freeze the smoke and pilot task lists before any live result is observed. The pilot must contain ten software/debugging tasks and five neutral terminal tasks.
10. Require the operator to provide an exact model identifier and Codex version when preparing a run. Floating aliases such as `latest` are invalid.
11. Generate a replayable Harbor job file and a separate run manifest before any paid execution.
12. Never start a model-backed Harbor run from validation, preparation, reporting, or the normal repository test suite.
13. Parse Harbor `result.json` files without an LLM judge. The primary outcome is the benchmark verifier reward.
14. Report task pass rate, paired pass-rate difference, a task-clustered 95% bootstrap interval, tokens, estimated cost, duration, errors, helped tasks, hurt tasks, and unchanged tasks.
15. Treat a missing condition, mismatched model, mismatched Codex version, mismatched task checksum, or incomplete attempt count as an invalid comparison rather than silently dropping it.
16. Keep errored trials in the denominator with zero reward, report their exception types, and mark the inferential verdict invalid until the errors are resolved or rerun.
17. A full-run improvement claim requires the lower bound of the paired 95% interval to be above zero. Non-inferiority requires the lower bound to be above negative five percentage points.
18. Flag an efficiency regression when median cost or input tokens rise by more than 15% without a positive completion result.
19. Keep generated jobs, downloaded task data, credentials, and result artifacts out of Git.
20. Document local Docker smoke execution and x86 cloud pilot/full execution. No cloud resource or paid model run is part of setup.

## Design

### Experiment manifests

`evals/harbor/manifests/` contains reviewed JSON inputs for smoke, pilot, and full runs. A manifest defines the dataset revision, task list, attempt count, condition names, and expected trial count. The full manifest selects the entire pinned dataset instead of duplicating 89 names.

The smoke task set is:

- `cancel-async-tasks`
- `git-multibranch`
- `regex-log`

The pilot adds the following twelve tasks, giving ten software/debugging tasks and five neutral terminal tasks overall:

- `build-cython-ext`
- `cobol-modernization`
- `configure-git-webserver`
- `custom-memory-heap-crash`
- `db-wal-recovery`
- `fix-code-vulnerability`
- `fix-ocaml-gc`
- `large-scale-text-editing`
- `log-summary-date-ranges`
- `modernize-scientific-stack`
- `openssl-selfsigned-cert`
- `pypi-server`

### Run preparation

`evals/harbor/prepare.mjs` accepts a reviewed manifest, label, exact model, exact Codex version, reasoning effort, environment, and concurrency. It validates all values and writes two ignored files beneath `evals/results/harbor/<label>/`:

- `job.json`, consumed by `harbor run -c`;
- `run-manifest.json`, the immutable experimental record used by the reporter.

Preparation is offline. It does not download the dataset, install Harbor, authenticate, create a sandbox, or start an agent. Existing labels are refused unless the operator explicitly chooses a new label.

The generated job contains both conditions in one Harbor job so trials share the same wall-clock window. The two agents use one concurrency group. This prevents one condition from receiving a higher parallelism allowance.

### Codex conditions

`evals/harbor/agents/codex_ab.py` subclasses Harbor's pinned Codex adapter through one shared base. Both conditions:

- install the same pinned Codex version through Harbor;
- archive the exact Ultra commit on the host;
- upload the same archive contents to `/opt/ultra-instinct`;
- use Harbor's normal Codex command, authentication, trajectory conversion, and cleanup.

During the Codex home setup performed by the parent adapter, `codex-ultra-guided` adds the uploaded local marketplace and installs `ultra-instinct@ultra-instinct`. `codex-vanilla` performs no registration. The plugin source remains outside the task workspace in both conditions.

The parent Harbor adapter already creates and removes `/tmp/codex-home` per trial. The generated job additionally fixes `ULTRA_INSTINCT_STATE_DIR=/tmp/ultra-instinct-state` and disables live web search for both conditions.

### Reporting

`evals/harbor/analyze.mjs` reads the prepared run manifest and one completed Harbor job directory. It validates the experiment grid before calculating metrics.

Pairing occurs by task. Each task must contain the expected number of vanilla and guided attempts with matching model, Codex version, and task checksum. Errors remain in the denominator with zero reward and are also reported separately.

The paired completion delta is calculated from task-level mean rewards. The 95% interval uses a deterministic task-clustered bootstrap: resample tasks with replacement, retain all attempts within each selected task, and use the seed stored in the run manifest. This avoids treating repeated attempts for one task as independent tasks.

The reporter writes `comparison.json` and `comparison.md` beside the run manifest. Reports never change benchmark results and never invoke a model.

### Reproducible Python environment

`evals/harbor/pyproject.toml` and `uv.lock` pin Harbor 0.16.1 and Python 3.12 or newer. The optional `daytona` dependency enables the recommended x86 cloud path. Local validation imports the custom agents against the pinned Harbor package but does not execute a trial.

## Constraints

- Node.js 20 or newer.
- Python 3.12 or newer.
- Harbor exactly 0.16.1.
- Terminal-Bench 2.1 dataset revision exactly 6.
- Codex version and model must be exact operator inputs recorded before launch.
- Default reasoning effort is `high`; supported values are `low`, `medium`, `high`, and `xhigh`.
- Default local concurrency is 1. Cloud concurrency must be supplied explicitly and is capped at 32 by preparation.
- The smoke may run with Docker. Pilot and full runs should use an x86 cloud environment because the current local Docker host is ARM with 8 GB memory.
- Primary grading is deterministic verifier reward. LLM-as-judge output cannot decide acceptance.
- Generated artifacts live under ignored `evals/results/harbor/`.
- Setup and tests must not consume model credits.

## References

- [Terminal-Bench 2.1 release](https://www.tbench.ai/news/terminal-bench-2-1) — 89-task corrected dataset.
- [Terminal-Bench 2.1 dataset](https://hub.harborframework.com/datasets/terminal-bench/terminal-bench-2-1/6) — Harbor Hub revision 6 and task catalog.
- [Terminal-Bench 2.1 repository](https://github.com/harbor-framework/terminal-bench-2-1) — five-trial leaderboard protocol.
- [Harbor 0.16.1](https://github.com/harbor-framework/harbor/tree/v0.16.1) — pinned runner source.
- [Harbor agents](https://www.harborframework.com/docs/agents) — custom agent import paths and installed agents.
- [Harbor adapter guidance](https://www.harborframework.com/docs/datasets/adapters) — parity requirements for pinned versions, commands, models, tools, and prompts.
- Existing routing evaluation: `evals/README.md`.
- Existing Codex driver: `evals/clients/codex.mjs`.
- Existing result policy: `evals/compare.mjs`.

## Out of scope

- Running paid smoke, pilot, or full trials.
- Publishing a Terminal-Bench leaderboard entry.
- Testing `strict` before `guided` passes the pilot.
- Claude Code or OpenCode Harbor treatment agents in the first implementation.
- Changing Ultra Instinct runtime behavior in response to results that do not yet exist.

## Open questions

None. The operator selects the exact production model and Codex version as required run inputs; these are experimental parameters, not unresolved design choices.
