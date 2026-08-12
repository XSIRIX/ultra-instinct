import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const defaultConditions = ["codex-vanilla", "codex-ultra-guided"];

function numberOrNull(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

function sumNullable(values) {
  const present = values.filter(Number.isFinite);
  return present.length ? present.reduce((sum, value) => sum + value, 0) : null;
}

function agentContexts(result) {
  if (result.agent_result) return [result.agent_result];
  return (result.step_results ?? []).map((step) => step.agent_result).filter(Boolean);
}

function durationSeconds(result) {
  const timing = result.agent_execution?.started_at && result.agent_execution?.finished_at
    ? result.agent_execution
    : result.started_at && result.finished_at
      ? result
      : null;
  if (!timing) return null;
  const duration = Date.parse(timing.finished_at) - Date.parse(timing.started_at);
  return Number.isFinite(duration) && duration >= 0 ? duration / 1000 : null;
}

function exceptionType(result) {
  if (result.exception_info?.exception_type) return result.exception_info.exception_type;
  const stepError = (result.step_results ?? []).find((step) => step.exception_info)?.exception_info;
  return stepError?.exception_type ?? null;
}

function verifierReward(result) {
  const rewards = result.verifier_result?.rewards;
  if (!rewards || typeof rewards !== "object") return null;
  if (Number.isFinite(rewards.reward)) return Number(rewards.reward);
  const values = Object.values(rewards).filter(Number.isFinite);
  return values.length === 1 ? Number(values[0]) : null;
}

function modelName(modelInfo) {
  if (!modelInfo?.name) return null;
  if (!modelInfo.provider || modelInfo.name.includes("/")) return modelInfo.name;
  return `${modelInfo.provider}/${modelInfo.name}`;
}

function taskSlug(taskName) {
  return String(taskName ?? "").split(/[\\/]/).filter(Boolean).at(-1) ?? "";
}

function isVerificationCall(call) {
  const fn = call?.function ?? call ?? {};
  const text = `${fn.name ?? ""} ${typeof fn.arguments === "string"
    ? fn.arguments
    : JSON.stringify(fn.arguments ?? "")}`;
  return /(?:^|\s|[/_-])(?:test|tests|check|verify|pytest|vitest|jest|cargo test|go test|npm test|bun test)(?:\s|$|[/_.-])/i.test(text);
}

async function trajectoryMetrics(trialDirectory) {
  try {
    const trajectory = JSON.parse(
      await readFile(path.join(trialDirectory, "agent", "trajectory.json"), "utf8"),
    );
    const calls = (trajectory.steps ?? []).flatMap((step) => step.tool_calls ?? []);
    return {
      toolCalls: calls.length,
      verificationCalls: calls.filter(isVerificationCall).length,
    };
  } catch (error) {
    if (error?.code === "ENOENT") return { toolCalls: null, verificationCalls: null };
    throw new Error(`Cannot parse trajectory for ${path.basename(trialDirectory)}: ${error.message}`);
  }
}

function normalizeResult(result, processMetrics) {
  const contexts = agentContexts(result);
  const reportedError = exceptionType(result);
  const measuredReward = verifierReward(result);
  const error = reportedError ?? (measuredReward === null ? "MissingReward" : null);
  return {
    condition: result.agent_info?.name ?? null,
    task: taskSlug(result.task_name),
    reward: error ? 0 : measuredReward,
    error,
    checksum: result.task_checksum ?? null,
    model: modelName(result.agent_info?.model_info),
    codexVersion: result.agent_info?.version ?? null,
    inputTokens: sumNullable(contexts.map((context) => context.n_input_tokens)),
    cacheTokens: sumNullable(contexts.map((context) => context.n_cache_tokens)),
    outputTokens: sumNullable(contexts.map((context) => context.n_output_tokens)),
    costUsd: sumNullable(contexts.map((context) => context.cost_usd)),
    durationSeconds: durationSeconds(result),
    ...processMetrics,
  };
}

export async function loadHarborTrials(jobDirectory) {
  const entries = await readdir(jobDirectory, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory()).sort((a, b) => (
    a.name.localeCompare(b.name)
  ));
  const trials = [];
  for (const entry of directories) {
    const trialDirectory = path.join(jobDirectory, entry.name);
    let source;
    try {
      source = await readFile(path.join(trialDirectory, "result.json"), "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    let result;
    try {
      result = JSON.parse(source);
    } catch (error) {
      throw new Error(`Cannot parse result for ${entry.name}: ${error.message}`);
    }
    trials.push(normalizeResult(result, await trajectoryMetrics(trialDirectory)));
  }
  return trials;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function quantile(sortedValues, probability) {
  if (!sortedValues.length) return null;
  const position = (sortedValues.length - 1) * probability;
  const lower = Math.floor(position);
  const fraction = position - lower;
  return sortedValues[lower + 1] === undefined
    ? sortedValues[lower]
    : sortedValues[lower] + fraction * (sortedValues[lower + 1] - sortedValues[lower]);
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function clusteredInterval(taskDeltas, bootstrap) {
  if (!taskDeltas.length) return { lower: null, upper: null, iterations: bootstrap.iterations };
  const random = mulberry32(bootstrap.seed);
  const samples = [];
  for (let iteration = 0; iteration < bootstrap.iterations; iteration += 1) {
    let total = 0;
    for (let index = 0; index < taskDeltas.length; index += 1) {
      total += taskDeltas[Math.floor(random() * taskDeltas.length)];
    }
    samples.push(total / taskDeltas.length);
  }
  samples.sort((a, b) => a - b);
  return {
    lower: quantile(samples, 0.025),
    upper: quantile(samples, 0.975),
    iterations: bootstrap.iterations,
  };
}

function metricSummary(trials) {
  return {
    trials: trials.length,
    passRate: mean(trials.map((trial) => trial.error ? 0 : trial.reward)),
    medianInputTokens: median(trials.map((trial) => trial.inputTokens)),
    totalInputTokens: sumNullable(trials.map((trial) => trial.inputTokens)),
    medianCacheTokens: median(trials.map((trial) => trial.cacheTokens)),
    totalCacheTokens: sumNullable(trials.map((trial) => trial.cacheTokens)),
    medianOutputTokens: median(trials.map((trial) => trial.outputTokens)),
    totalOutputTokens: sumNullable(trials.map((trial) => trial.outputTokens)),
    medianCostUsd: median(trials.map((trial) => trial.costUsd)),
    totalCostUsd: sumNullable(trials.map((trial) => trial.costUsd)),
    medianDurationSeconds: median(trials.map((trial) => trial.durationSeconds)),
    medianToolCalls: median(trials.map((trial) => trial.toolCalls)),
    medianVerificationCalls: median(trials.map((trial) => trial.verificationCalls)),
    errors: trials.filter((trial) => trial.error).length,
  };
}

function efficiencyMetric(control, guided, hasCompletionGain) {
  const relativeChange = control === null || guided === null || control === 0
    ? null
    : (guided - control) / control;
  const overThreshold = control === 0 ? guided > 0 : relativeChange > 0.15;
  return {
    controlMedian: control,
    guidedMedian: guided,
    relativeChange,
    regression: !hasCompletionGain && control !== null && guided !== null && overThreshold,
  };
}

function pushOnce(issues, message) {
  if (!issues.includes(message)) issues.push(message);
}

export function analyzeHarborRun({ runManifest, trials }) {
  const issues = [];
  const conditions = runManifest.conditions ?? defaultConditions;
  if (conditions.length !== 2 || new Set(conditions).size !== 2) {
    throw new Error("The run manifest must define exactly two unique conditions.");
  }
  const [control, guided] = conditions;
  const observedTasks = [...new Set(trials.map((trial) => trial.task))].sort();
  const expectedTasks = runManifest.taskNames === null ? observedTasks : [...runManifest.taskNames];

  if (expectedTasks.length !== runManifest.expectedTaskCount) {
    issues.push(`Expected ${runManifest.expectedTaskCount} tasks but found ${expectedTasks.length}.`);
  }
  if (trials.length !== runManifest.expectedTrials) {
    issues.push(`Expected ${runManifest.expectedTrials} trials but found ${trials.length}.`);
  }
  for (const trial of trials) {
    if (!conditions.includes(trial.condition)) {
      pushOnce(issues, `Unexpected condition: ${trial.condition ?? "missing"}.`);
    }
    if (!expectedTasks.includes(trial.task)) pushOnce(issues, `Unexpected task: ${trial.task || "missing"}.`);
    if (trial.model !== runManifest.model) {
      pushOnce(issues, `Model mismatch: expected ${runManifest.model}, found ${trial.model ?? "missing"}.`);
    }
    if (trial.codexVersion !== runManifest.codexVersion) {
      pushOnce(
        issues,
        `Codex version mismatch: expected ${runManifest.codexVersion}, found ${trial.codexVersion ?? "missing"}.`,
      );
    }
  }

  const taskResults = expectedTasks.map((task) => {
    const taskTrials = trials.filter((trial) => trial.task === task);
    const checksums = new Set(taskTrials.map((trial) => trial.checksum).filter(Boolean));
    if (checksums.size !== 1 || taskTrials.some((trial) => !trial.checksum)) {
      issues.push(`Task ${task} has a missing or mismatched checksum.`);
    }
    const rewards = {};
    for (const condition of conditions) {
      const conditionTrials = taskTrials.filter((trial) => trial.condition === condition);
      if (conditionTrials.length !== runManifest.attempts) {
        issues.push(
          `Task ${task} condition ${condition} has ${conditionTrials.length} attempts; expected ${runManifest.attempts}.`,
        );
      }
      rewards[condition] = mean(conditionTrials.map((trial) => trial.error ? 0 : trial.reward)) ?? 0;
    }
    const delta = rewards[guided] - rewards[control];
    return {
      task,
      checksum: checksums.size === 1 ? [...checksums][0] : null,
      rewards,
      delta,
      classification: delta > 0 ? "helped" : delta < 0 ? "hurt" : "unchanged",
    };
  });

  const byCondition = Object.fromEntries(conditions.map((condition) => [
    condition,
    metricSummary(trials.filter((trial) => trial.condition === condition)),
  ]));
  const passRate = Object.fromEntries(conditions.map((condition) => [
    condition,
    byCondition[condition].passRate,
  ]));
  const pairedDelta = mean(taskResults.map((task) => task.delta)) ?? 0;
  const interval95 = clusteredInterval(taskResults.map((task) => task.delta), runManifest.bootstrap);
  const classification = { helped: 0, hurt: 0, unchanged: 0 };
  for (const task of taskResults) classification[task.classification] += 1;

  const byType = {};
  for (const trial of trials.filter((item) => item.error)) {
    byType[trial.error] = (byType[trial.error] ?? 0) + 1;
  }
  const errors = { count: Object.values(byType).reduce((sum, count) => sum + count, 0), byType };
  if (errors.count) issues.push(`${errors.count} errored trial(s) remain in the denominator as zero.`);

  const hasCompletionGain = pairedDelta > 0;
  const efficiency = {
    inputTokens: efficiencyMetric(
      byCondition[control].medianInputTokens,
      byCondition[guided].medianInputTokens,
      hasCompletionGain,
    ),
    costUsd: efficiencyMetric(
      byCondition[control].medianCostUsd,
      byCondition[guided].medianCostUsd,
      hasCompletionGain,
    ),
  };
  efficiency.hasRegression = efficiency.inputTokens.regression || efficiency.costUsd.regression;

  const valid = issues.length === 0;
  let status = "invalid";
  if (valid && interval95.lower > 0) status = "improvement";
  else if (valid && interval95.lower > -0.05) status = "non-inferior";
  else if (valid) status = "regression";

  return {
    schemaVersion: 1,
    label: runManifest.label,
    experiment: runManifest.experiment,
    valid,
    issues,
    conditions: { control, guided },
    summary: {
      tasks: taskResults.length,
      trials: trials.length,
      passRate,
      pairedDelta,
      interval95,
      classification,
    },
    conditionMetrics: byCondition,
    errors,
    efficiency,
    tasks: taskResults,
    verdict: {
      status,
      claimEligible: runManifest.experiment === "full" && valid,
      reason: !valid
        ? "Fix or rerun every invalid trial before interpreting the interval."
        : runManifest.experiment !== "full"
          ? "Smoke and pilot results are descriptive; only the full run supports a claim."
          : status === "improvement"
            ? "The lower 95% bound is above zero."
            : status === "non-inferior"
              ? "The lower 95% bound is above -5 percentage points."
              : "The lower 95% bound does not meet the non-inferiority threshold.",
    },
  };
}

function formatPercent(value) {
  return value === null ? "n/a" : `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value, digits = 2) {
  return value === null ? "n/a" : value.toFixed(digits);
}

export function renderComparisonMarkdown(comparison) {
  const { control, guided } = comparison.conditions;
  const lines = [
    `# Harbor A/B comparison: ${comparison.label}`,
    "",
    `- Verdict: **${comparison.verdict.status}**`,
    `- Valid: ${comparison.valid ? "yes" : "no"}`,
    `- ${control} pass rate: ${formatPercent(comparison.summary.passRate[control])}`,
    `- ${guided} pass rate: ${formatPercent(comparison.summary.passRate[guided])}`,
    `- Paired delta: ${formatPercent(comparison.summary.pairedDelta)}`,
    `- 95% task-clustered interval: ${formatPercent(comparison.summary.interval95.lower)} to ${formatPercent(comparison.summary.interval95.upper)}`,
    `- Helped / hurt / unchanged: ${comparison.summary.classification.helped} / ${comparison.summary.classification.hurt} / ${comparison.summary.classification.unchanged}`,
    `- Errors: ${comparison.errors.count}`,
    `- Efficiency regression: ${comparison.efficiency.hasRegression ? "yes" : "no"}`,
    "",
    comparison.verdict.reason,
  ];
  if (comparison.issues.length) {
    lines.push("", "## Invalid comparison", "", ...comparison.issues.map((issue) => `- ${issue}`));
  }
  lines.push(
    "",
    "## Secondary metrics",
    "",
    "| Condition | Median input tokens | Median cost (USD) | Median duration (s) |",
    "| --- | ---: | ---: | ---: |",
    ...[control, guided].map((condition) => {
      const metrics = comparison.conditionMetrics[condition];
      return `| ${condition} | ${formatNumber(metrics.medianInputTokens, 0)} | ${formatNumber(metrics.medianCostUsd, 4)} | ${formatNumber(metrics.medianDurationSeconds, 1)} |`;
    }),
    "",
    "## Per-task result",
    "",
    `| Task | ${control} | ${guided} | Delta | Result |`,
    "| --- | ---: | ---: | ---: | --- |",
    ...comparison.tasks.map((task) => (
      `| ${task.task} | ${formatPercent(task.rewards[control])} | ${formatPercent(task.rewards[guided])} | ${formatPercent(task.delta)} | ${task.classification} |`
    )),
    "",
  );
  return lines.join("\n");
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(`Invalid argument: ${key ?? "missing"}.`);
    options[key.slice(2)] = value;
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(options.run ?? "")) {
    throw new Error("--run must be a prepared run label.");
  }
  if (!options["job-dir"]) throw new Error("--job-dir is required.");
  return options;
}

export async function analyzeCli(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const runDirectory = path.join(root, "evals", "results", "harbor", options.run);
  const runManifest = JSON.parse(
    await readFile(path.join(runDirectory, "run-manifest.json"), "utf8"),
  );
  const trials = await loadHarborTrials(path.resolve(options["job-dir"]));
  const comparison = analyzeHarborRun({ runManifest, trials });
  await Promise.all([
    writeFile(path.join(runDirectory, "comparison.json"), `${JSON.stringify(comparison, null, 2)}\n`),
    writeFile(path.join(runDirectory, "comparison.md"), renderComparisonMarkdown(comparison)),
  ]);
  return { comparison, runDirectory };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  analyzeCli().then(({ comparison, runDirectory }) => {
    console.log(`Wrote Harbor comparison to ${runDirectory}`);
    console.log(`Verdict: ${comparison.verdict.status}`);
    if (!comparison.valid) process.exitCode = 2;
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
