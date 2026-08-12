import assert from "node:assert/strict";
import test from "node:test";

import { compareRuns } from "../../evals/compare.mjs";

function grade({
  client,
  scenarioId,
  profile,
  passed,
  falsePositive = false,
  model = "same-model",
  isPositive = scenarioId === "positive",
}) {
  return {
    client,
    scenarioId,
    profile,
    passed,
    routingPassed: passed,
    falsePositive,
    isPositive,
    model,
  };
}

test("comparison enforces model matching and the approved routing thresholds", () => {
  const baseline = [];
  const candidate = [];
  for (const client of ["claude", "codex", "opencode"]) {
    for (let index = 0; index < 5; index += 1) {
      baseline.push(grade({ client, scenarioId: "positive", profile: "lite", passed: index < 3 }));
      candidate.push(grade({ client, scenarioId: "positive", profile: "guided", passed: index < 5 }));
      baseline.push(grade({ client, scenarioId: "negative", profile: "lite", passed: true }));
      candidate.push(grade({ client, scenarioId: "negative", profile: "guided", passed: true }));
    }
  }

  const report = compareRuns(baseline, candidate);
  assert.equal(report.passed, true);
  assert.equal(report.metrics.candidatePositiveRate, 1);
  assert.equal(report.metrics.improvement, 0.4);
  assert.deepEqual(report.failures, []);
});

test("comparison reports per-case, false-positive, improvement, and model failures", () => {
  const baseline = Array.from({ length: 5 }, (_, index) =>
    grade({ client: "claude", scenarioId: "positive", profile: "lite", passed: index < 3 }),
  );
  const candidate = Array.from({ length: 5 }, (_, index) =>
    grade({
      client: "claude",
      scenarioId: "positive",
      profile: "guided",
      passed: index < 3,
      model: "different-model",
    }),
  );
  candidate.push(grade({
    client: "claude",
    scenarioId: "negative",
    profile: "guided",
    passed: false,
    falsePositive: true,
    model: "different-model",
  }));

  const report = compareRuns(baseline, candidate);
  assert.equal(report.passed, false);
  assert.ok(report.failures.some((failure) => failure.code === "model-mismatch"));
  assert.ok(report.failures.some((failure) => failure.code === "per-case-below-four-of-five"));
  assert.ok(report.failures.some((failure) => failure.code === "false-positive-rate"));
  assert.ok(report.failures.some((failure) => failure.code === "insufficient-improvement"));
});

test("improvement compares only scenarios present in both runs", () => {
  const baseline = Array.from({ length: 5 }, (_, index) =>
    grade({ client: "claude", scenarioId: "positive", profile: "lite", passed: index < 3 }),
  );
  const candidate = [
    ...Array.from({ length: 5 }, () =>
      grade({ client: "claude", scenarioId: "positive", profile: "guided", passed: true })),
    ...Array.from({ length: 5 }, () =>
      grade({
        client: "claude",
        scenarioId: "guided-only",
        profile: "guided",
        passed: false,
        isPositive: true,
      })),
  ];

  const report = compareRuns(baseline, candidate);
  assert.equal(report.metrics.improvement, 0.4);
  assert.equal(report.metrics.candidatePositiveRate, 0.5);
});
