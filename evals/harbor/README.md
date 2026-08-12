# Harbor A/B benchmark

This measures the same Codex model in two clean conditions:

- `codex-vanilla`: Ultra Instinct is fully off.
- `codex-ultra-guided`: the pinned Ultra Instinct plugin runs with `guided`.

Terminal-Bench 2.1 revision 6 supplies executable graders. No model judges the result.

## Free setup

Requirements: Node.js 20+, Python 3.12+, [`uv`](https://docs.astral.sh/uv/), Git, and Docker for a local smoke run.

```bash
npm install
npm run eval:harbor:check
```

The check pins Harbor 0.16.1, validates both agents, and runs the result-analysis tests. It does not download Terminal-Bench, start a sandbox, or call a model.

## Prepare a run for free

First record the exact model and Codex CLI version you want to test. Do not use `latest` or `default`.

```bash
npm run eval:harbor:prepare -- \
  --experiment smoke \
  --label smoke-001 \
  --model openai/REPLACE_WITH_EXACT_MODEL \
  --codex-version 0.147.0 \
  --reasoning high \
  --environment docker \
  --concurrency 1
```

This writes only:

- `.ultra-instinct/harbor/smoke-001/job.json`
- `.ultra-instinct/harbor/smoke-001/run-manifest.json`

Both are ignored by Git. Read both files before launch. Confirm the model, Codex version, source commit, task count, attempt count, and expected trials.

## Paid run boundary

The commands below call a paid model. They are intentionally not npm scripts. Run them only after checking the generated files and approving the expected spend.

Export the key in your current shell. Do not place it in a tracked file:

```bash
export OPENAI_API_KEY="replace-me"
```

Local Docker smoke — 3 tasks × 1 attempt × 2 conditions = **6 trials**:

```bash
uv run --project evals/harbor --locked \
  harbor run -c .ultra-instinct/harbor/smoke-001/job.json
```

Do not add `--yes`: Harbor should show any host-access or sharing prompt. Running locally does not upload results by default. Do not run `harbor upload` unless you separately choose to publish them.

The smoke only checks plumbing. A local ARM or low-memory Docker machine may not represent benchmark performance.

## Cost gate before the pilot

Analyze the smoke first. Use its actual total cost to estimate the next stage:

- pilot estimate = smoke cost ÷ 6 × 90;
- full estimate = smoke cost ÷ 6 × 890.

Stop and get a separate approval for that amount. If Harbor cannot report cost, use your provider bill instead. A candidate with no completion gain is flagged when its median input tokens or cost rises by more than **15%**.

## Cloud pilot and full run

Use an x86 Daytona environment for the larger stages. Set `DAYTONA_API_KEY`, then prepare a new label with `--environment daytona` and an explicitly chosen concurrency.

Pilot — 15 tasks × 3 attempts × 2 conditions = **90 trials**:

```bash
export DAYTONA_API_KEY="replace-me"
npm run eval:harbor:prepare -- \
  --experiment pilot \
  --label pilot-001 \
  --model openai/REPLACE_WITH_EXACT_MODEL \
  --codex-version 0.147.0 \
  --reasoning high \
  --environment daytona \
  --concurrency 4
uv run --project evals/harbor --extra daytona --locked \
  harbor run -c .ultra-instinct/harbor/pilot-001/job.json
```

Full — all 89 tasks × 5 attempts × 2 conditions = **890 trials**. Prepare it the same way with `--experiment full --label full-001`. Run it only after the pilot is valid and useful.

Smoke and pilot results are descriptive. Only a valid full run supports an improvement or non-inferiority claim.

## Analyze completed results

Harbor writes a dated job folder beneath the prepared run's `harbor-jobs/` directory. Pass that exact folder to the analyzer:

```bash
npm run eval:harbor:analyze -- \
  --run smoke-001 \
  --job-dir .ultra-instinct/harbor/smoke-001/harbor-jobs/REPLACE_WITH_JOB_FOLDER
```

The command writes `comparison.json` and `comparison.md` beside the run manifest. It does not call a model and does not upload anything.

The comparison is invalid if a trial is missing, errored, lacks a reward, or changes model, Codex version, task checksum, or attempt count. Errored trials remain in the score as zero. Fix or rerun them before interpreting the confidence interval.

## Decision rule

- Improvement: the full run's lower 95% paired bound is above 0.
- Non-inferior: the lower bound is above -5 percentage points.
- Regression: it meets neither threshold.
- Invalid: the experiment grid or a trial is broken; draw no conclusion.

The interval resamples whole tasks, not individual repeated attempts. This keeps five attempts on one task from pretending to be five independent tasks.
