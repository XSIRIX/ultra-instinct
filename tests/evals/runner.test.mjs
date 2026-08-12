import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  assertLivePermission,
  collectArtifactEvidence,
  createFixture,
  createRunPlan,
  parseArgs,
} from "../../evals/run.mjs";

test("runner parses a reproducible matrix and refuses stateful live clients by default", () => {
  const options = parseArgs([
    "--client", "all", "--profile", "guided", "--repeat", "5", "--label", "guided",
    "--models-from", "baseline",
  ]);
  assert.equal(options.repeat, 5);
  assert.deepEqual(options.clients, ["claude", "codex", "opencode"]);
  assert.throws(() => assertLivePermission(options), /--allow-client-state/);
  assert.doesNotThrow(() => assertLivePermission({ ...options, dryRun: true }));
  assert.doesNotThrow(() => assertLivePermission({ ...options, allowClientState: true }));
});

test("run plans use one canonical scenario set and stable result paths", async () => {
  const root = path.resolve(import.meta.dirname, "../..");
  const scenarios = JSON.parse(await readFile(path.join(root, "evals/scenarios.json"), "utf8"));
  const plan = createRunPlan({
    clients: ["claude"],
    profile: "guided",
    repeat: 2,
    label: "guided",
    modelsFrom: null,
    model: null,
    dryRun: true,
    allowClientState: false,
  }, scenarios, root);

  assert.equal(scenarios.length, 10);
  assert.equal(plan.length, scenarios.filter(({ profiles }) => profiles.includes("guided")).length * 2);
  assert.ok(plan.every(({ resultDirectory }) =>
    resultDirectory.startsWith(path.join(root, ".ultra-instinct/evals/guided/claude/guided")),
  ));

  const capture = scenarios.find(({ id }) => id === "capture-update-existing");
  assert.equal(capture.expectedSkill, "capture-artifact");
  assert.equal(capture.artifactExpectation.mode, "update-existing");
  assert.equal(capture.artifactExpectation.path, "docs/features/request-retries.md");

  for (const id of ["typo-only", "read-only"]) {
    assert.ok(scenarios.find((scenario) => scenario.id === id).forbiddenSkills.includes("capture-artifact"));
  }
});

test("capture fixture evidence detects updates, duplicates, and leaked working text", async () => {
  const scenario = {
    artifactExpectation: {
      mode: "update-existing",
      path: "docs/features/request-retries.md",
      forbiddenText: "FAKE_PRIVATE_PROMPT_DO_NOT_COPY",
      expectedDocsFileCount: 1,
    },
  };
  const fixture = await createFixture("capture-existing");

  try {
    const unchanged = await collectArtifactEvidence(scenario, fixture.workspace, fixture.files);
    assert.equal(unchanged.expectedPathChanged, false);

    const artifact = path.join(fixture.workspace, scenario.artifactExpectation.path);
    await writeFile(artifact, "# Request Retries\n\n## Summary\n\nRetries are durable.\n");
    const updated = await collectArtifactEvidence(scenario, fixture.workspace, fixture.files);
    assert.deepEqual(updated, {
      expectedPathExists: true,
      expectedPathChanged: true,
      docsFileCount: 1,
      forbiddenTextFound: false,
    });

    await mkdir(path.join(fixture.workspace, "docs/decisions"), { recursive: true });
    await writeFile(path.join(fixture.workspace, "docs/decisions/duplicate.md"), "duplicate\n");
    const duplicated = await collectArtifactEvidence(scenario, fixture.workspace, fixture.files);
    assert.equal(duplicated.docsFileCount, 2);

    await writeFile(artifact, `# Request Retries\n\n${scenario.artifactExpectation.forbiddenText}\n`);
    const leaked = await collectArtifactEvidence(scenario, fixture.workspace, fixture.files);
    assert.equal(leaked.forbiddenTextFound, true);
  } finally {
    await rm(fixture.workspace, { recursive: true, force: true });
  }
});
