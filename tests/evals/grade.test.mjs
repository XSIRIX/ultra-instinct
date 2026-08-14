import assert from "node:assert/strict";
import test from "node:test";

import { gradeTrace } from "../../evals/grade.mjs";

const scenario = {
  id: "small-change-tdd",
  prompt: "Add a small feature.",
  fixture: "node-package",
  expectedSkill: "tdd",
  forbiddenSkills: ["brainstorm"],
  mutationExpected: true,
  verificationExpected: true,
  profiles: ["lite", "guided", "strict"],
};

test("routing passes only when the expected skill appears before the first mutation", () => {
  const passing = gradeTrace(scenario, [
    { type: "skill", skill: "tdd", action: "loaded", sequence: 1 },
    { type: "tool", category: "mutation", tool: "write", success: true, sequence: 2 },
    { type: "tool", category: "verification", tool: "test", success: true, sequence: 3 },
  ]);
  const late = gradeTrace(scenario, [
    { type: "tool", category: "mutation", tool: "write", success: true, sequence: 1 },
    { type: "skill", skill: "tdd", action: "loaded", sequence: 2 },
    { type: "tool", category: "verification", tool: "test", success: true, sequence: 3 },
  ]);

  assert.equal(passing.routingPassed, true);
  assert.equal(passing.passed, true);
  assert.equal(late.routingPassed, false);
  assert.equal(late.passed, false);
  assert.ok(late.failureSignatures.includes("expected-skill-after-mutation"));
});

test("self-caused failures require repository grounding before another edit", () => {
  const debugging = {
    ...scenario,
    id: "self-caused-failure",
    expectedSkill: "systematic-debugging",
    groundingExpected: true,
  };
  const grounded = gradeTrace(debugging, [
    { type: "skill", skill: "systematic-debugging", action: "loaded", sequence: 1 },
    { type: "tool", category: "read", tool: "grep", success: true, sequence: 2 },
    { type: "tool", category: "mutation", tool: "edit", success: true, sequence: 3 },
    { type: "tool", category: "verification", tool: "test", success: true, sequence: 4 },
  ]);
  const blindPatch = gradeTrace(debugging, [
    { type: "skill", skill: "systematic-debugging", action: "loaded", sequence: 1 },
    { type: "tool", category: "mutation", tool: "edit", success: true, sequence: 2 },
    { type: "tool", category: "read", tool: "grep", success: true, sequence: 3 },
    { type: "tool", category: "verification", tool: "test", success: true, sequence: 4 },
  ]);

  assert.equal(grounded.groundingPassed, true);
  assert.equal(grounded.passed, true);
  assert.equal(blindPatch.groundingPassed, false);
  assert.ok(blindPatch.failureSignatures.includes("grounding-read-before-mutation-not-observed"));
});

test("negative scenarios fail on forbidden routing without requiring a mutation", () => {
  const negative = {
    ...scenario,
    id: "read-only",
    expectedSkill: null,
    forbiddenSkills: ["tdd", "execute-plan"],
    mutationExpected: false,
    verificationExpected: false,
  };

  assert.equal(gradeTrace(negative, [{ type: "result", success: true, sequence: 1 }]).passed, true);
  const failed = gradeTrace(negative, [
    { type: "skill", skill: "tdd", action: "announced", sequence: 1 },
    { type: "result", success: true, sequence: 2 },
  ]);
  assert.equal(failed.falsePositive, true);
  assert.ok(failed.failureSignatures.includes("forbidden-skill-routed"));
});

test("strict completion is bounded and accepts fresh verification", () => {
  const strict = { ...scenario, id: "strict-verification", profiles: ["strict"] };
  const passed = gradeTrace(strict, [
    { type: "skill", skill: "tdd", action: "loaded", sequence: 1 },
    { type: "tool", category: "mutation", tool: "edit", success: true, sequence: 2 },
    { type: "continuation", reason: "verification", sequence: 3 },
    { type: "tool", category: "verification", tool: "test", success: true, sequence: 4 },
    { type: "result", success: true, sequence: 5 },
  ]);
  const looping = gradeTrace(strict, [
    { type: "skill", skill: "tdd", action: "loaded", sequence: 1 },
    { type: "tool", category: "mutation", tool: "edit", success: true, sequence: 2 },
    { type: "continuation", reason: "verification", sequence: 3 },
    { type: "continuation", reason: "verification", sequence: 4 },
    { type: "tool", category: "verification", tool: "test", success: true, sequence: 5 },
  ]);

  assert.equal(passed.strictBounded, true);
  assert.equal(passed.passed, true);
  assert.equal(looping.strictBounded, false);
});

test("compaction scenarios require a compact event and restored bootstrap", () => {
  const compact = {
    ...scenario,
    id: "compaction-state",
    verificationExpected: false,
  };
  const grade = gradeTrace(compact, [
    { type: "skill", skill: "tdd", action: "loaded", sequence: 1 },
    { type: "tool", category: "mutation", tool: "write", success: true, sequence: 2 },
    { type: "compaction", bootstrapRestored: true, sequence: 3 },
  ]);
  assert.equal(grade.compactionPassed, true);
  assert.equal(grade.passed, true);
});

test("artifact scenarios require an in-place update without duplication or leakage", () => {
  const capture = {
    ...scenario,
    id: "capture-update-existing",
    expectedSkill: "capture-artifact",
    verificationExpected: false,
    artifactExpectation: {
      mode: "update-existing",
      path: "docs/features/request-retries.md",
      forbiddenText: "FAKE_PRIVATE_PROMPT_DO_NOT_COPY",
      expectedDocsFileCount: 1,
    },
  };
  const trace = [
    { type: "skill", skill: "capture-artifact", action: "loaded", sequence: 1 },
    { type: "tool", category: "mutation", tool: "edit", success: true, sequence: 2 },
  ];

  const passing = gradeTrace(capture, trace, {
    expectedPathExists: true,
    expectedPathChanged: true,
    docsFileCount: 1,
    forbiddenTextFound: false,
  });
  assert.equal(passing.artifactPassed, true);
  assert.equal(passing.passed, true);

  for (const evidence of [
    { expectedPathExists: true, expectedPathChanged: false, docsFileCount: 1, forbiddenTextFound: false },
    { expectedPathExists: true, expectedPathChanged: true, docsFileCount: 2, forbiddenTextFound: false },
    { expectedPathExists: true, expectedPathChanged: true, docsFileCount: 1, forbiddenTextFound: true },
  ]) {
    const failed = gradeTrace(capture, trace, evidence);
    assert.equal(failed.artifactPassed, false);
    assert.ok(failed.failureSignatures.includes("durable-artifact-invalid"));
  }
});
