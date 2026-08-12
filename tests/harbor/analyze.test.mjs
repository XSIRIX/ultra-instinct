import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  analyzeHarborRun,
  loadHarborTrials,
} from "../../evals/harbor/analyze.mjs";

const conditions = ["codex-vanilla", "codex-ultra-guided"];

function runManifest(overrides = {}) {
  return {
    schemaVersion: 1,
    label: "test-run",
    experiment: "smoke",
    conditions,
    attempts: 1,
    expectedTaskCount: 3,
    expectedTrials: 6,
    taskNames: ["task-a", "task-b", "task-c"],
    bootstrap: { seed: 4242, iterations: 10_000 },
    model: "openai/gpt-5.4-2026-04-15",
    codexVersion: "0.147.0",
    ...overrides,
  };
}

function trial(condition, task, reward, overrides = {}) {
  return {
    condition,
    task,
    reward,
    error: null,
    checksum: `sha-${task}`,
    model: "openai/gpt-5.4-2026-04-15",
    codexVersion: "0.147.0",
    inputTokens: 100,
    cacheTokens: 20,
    outputTokens: 10,
    costUsd: 0.1,
    durationSeconds: 60,
    toolCalls: 4,
    verificationCalls: 1,
    ...overrides,
  };
}

function completeTrials(deltas = [1, 0, -1]) {
  return deltas.flatMap((delta, index) => {
    const taskName = `task-${String.fromCharCode(97 + index)}`;
    const control = delta < 0 ? 1 : 0;
    return [
      trial(conditions[0], taskName, control),
      trial(conditions[1], taskName, control + delta),
    ];
  });
}

test("loads Harbor result files and normalizes metrics, errors, and trajectory calls", async () => {
  const jobDir = await mkdtemp(path.join(os.tmpdir(), "ultra-harbor-results-"));
  const goodDir = path.join(jobDir, "trial-good");
  const errorDir = path.join(jobDir, "trial-error");
  await Promise.all([
    mkdir(path.join(goodDir, "agent"), { recursive: true }),
    mkdir(errorDir, { recursive: true }),
  ]);
  await writeFile(path.join(goodDir, "result.json"), JSON.stringify({
    task_name: "terminal-bench/task-a",
    task_checksum: "sha-task-a",
    agent_info: {
      name: conditions[0],
      version: "0.147.0",
      model_info: { provider: "openai", name: "gpt-5.4-2026-04-15" },
    },
    agent_result: {
      n_input_tokens: 120,
      n_cache_tokens: 40,
      n_output_tokens: 30,
      cost_usd: 0.25,
    },
    verifier_result: { rewards: { reward: 1 } },
    agent_execution: {
      started_at: "2026-08-12T10:00:00.000Z",
      finished_at: "2026-08-12T10:02:00.000Z",
    },
  }));
  await writeFile(path.join(goodDir, "agent", "trajectory.json"), JSON.stringify({
    steps: [{
      tool_calls: [
        { function: { name: "exec_command", arguments: "npm test" } },
        { function: { name: "apply_patch", arguments: "{}" } },
      ],
    }],
  }));
  await writeFile(path.join(errorDir, "result.json"), JSON.stringify({
    task_name: "task-b",
    task_checksum: "sha-task-b",
    agent_info: {
      name: conditions[1],
      version: "0.147.0",
      model_info: { name: "openai/gpt-5.4-2026-04-15" },
    },
    step_results: [
      { agent_result: { n_input_tokens: 10, cost_usd: 0.01 } },
      { agent_result: { n_input_tokens: 15, cost_usd: 0.02 } },
    ],
    verifier_result: { rewards: { reward: 1 } },
    exception_info: { exception_type: "TimeoutError" },
  }));

  const loaded = await loadHarborTrials(jobDir);
  assert.equal(loaded.length, 2);
  assert.deepEqual(loaded[0], {
    condition: conditions[1],
    task: "task-b",
    reward: 0,
    error: "TimeoutError",
    checksum: "sha-task-b",
    model: "openai/gpt-5.4-2026-04-15",
    codexVersion: "0.147.0",
    inputTokens: 25,
    cacheTokens: null,
    outputTokens: null,
    costUsd: 0.03,
    durationSeconds: null,
    toolCalls: null,
    verificationCalls: null,
  });
  assert.equal(loaded[1].task, "task-a");
  assert.equal(loaded[1].reward, 1);
  assert.equal(loaded[1].durationSeconds, 120);
  assert.equal(loaded[1].toolCalls, 2);
  assert.equal(loaded[1].verificationCalls, 1);
});

test("pairs tasks, classifies deltas, and produces a deterministic clustered interval", () => {
  const first = analyzeHarborRun({ runManifest: runManifest(), trials: completeTrials() });
  const second = analyzeHarborRun({ runManifest: runManifest(), trials: completeTrials() });

  assert.equal(first.valid, true);
  assert.deepEqual(first.summary.classification, { helped: 1, hurt: 1, unchanged: 1 });
  assert.equal(first.summary.passRate[conditions[0]], 1 / 3);
  assert.equal(first.summary.passRate[conditions[1]], 1 / 3);
  assert.equal(first.summary.pairedDelta, 0);
  assert.deepEqual(first.summary.interval95, second.summary.interval95);
  assert.equal(first.verdict.status, "regression");
  assert.equal(first.verdict.claimEligible, false);
});

test("withholds a verdict when the experiment grid or pinned inputs drift", () => {
  const trials = completeTrials();
  trials.pop();
  trials[0].model = "openai/wrong-model";
  trials[1].codexVersion = "0.148.0";
  trials[2].checksum = "different-checksum";

  const result = analyzeHarborRun({ runManifest: runManifest(), trials });

  assert.equal(result.valid, false);
  assert.equal(result.verdict.status, "invalid");
  assert.match(result.issues.join("\n"), /model/i);
  assert.match(result.issues.join("\n"), /Codex version/i);
  assert.match(result.issues.join("\n"), /checksum/i);
  assert.match(result.issues.join("\n"), /attempt/i);
});

test("keeps errored trials as zero and invalidates inference", () => {
  const trials = completeTrials([0, 0, 0]);
  trials[1] = trial(conditions[1], "task-a", 1, {
    error: "AgentTimeoutError",
  });

  const result = analyzeHarborRun({ runManifest: runManifest(), trials });

  assert.equal(result.conditionMetrics[conditions[1]].passRate, 0);
  assert.deepEqual(result.errors, { count: 1, byType: { AgentTimeoutError: 1 } });
  assert.equal(result.verdict.status, "invalid");
});

test("applies improvement, non-inferiority, and regression thresholds to full runs", () => {
  const full = runManifest({ experiment: "full" });
  const improved = analyzeHarborRun({ runManifest: full, trials: completeTrials([1, 1, 1]) });
  const tied = analyzeHarborRun({ runManifest: full, trials: completeTrials([0, 0, 0]) });
  const regressed = analyzeHarborRun({ runManifest: full, trials: completeTrials([-1, -1, -1]) });

  assert.equal(improved.verdict.status, "improvement");
  assert.equal(improved.verdict.claimEligible, true);
  assert.equal(tied.verdict.status, "non-inferior");
  assert.equal(regressed.verdict.status, "regression");
});

test("flags token and cost regressions above 15 percent without a completion gain", () => {
  const trials = completeTrials([0, 0, 0]).map((item) => item.condition === conditions[1]
    ? { ...item, inputTokens: 116, costUsd: 0.116 }
    : item);

  const result = analyzeHarborRun({ runManifest: runManifest(), trials });

  assert.equal(result.efficiency.inputTokens.regression, true);
  assert.equal(result.efficiency.costUsd.regression, true);
  assert.equal(result.efficiency.hasRegression, true);
});
