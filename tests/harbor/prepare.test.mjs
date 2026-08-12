import assert from "node:assert/strict";
import { access, mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createRunFiles,
  loadExperimentManifest,
  prepareRun,
} from "../../evals/harbor/contracts.mjs";

const sourceCommit = "fa04e78e4353f62ad89f23de066fc59a97727dd1";

function validOptions(manifest, overrides = {}) {
  return {
    manifest,
    label: "codex-smoke-1",
    model: "openai/gpt-5.4-2026-04-15",
    codexVersion: "0.147.0",
    reasoning: "high",
    environment: "docker",
    concurrency: 1,
    createdAt: "2026-08-12T16:00:00.000Z",
    outputDirectory: "/tmp/ultra-benchmark/codex-smoke-1",
    ...overrides,
  };
}

test("reviewed manifests freeze smoke, pilot, and full trial counts", async () => {
  const smoke = await loadExperimentManifest("smoke");
  const pilot = await loadExperimentManifest("pilot");
  const full = await loadExperimentManifest("full");

  assert.equal(smoke.expectedTaskCount, 3);
  assert.equal(smoke.attempts, 1);
  assert.equal(smoke.expectedTrials, 6);
  assert.deepEqual(smoke.taskNames, ["cancel-async-tasks", "git-multibranch", "regex-log"]);

  assert.equal(pilot.expectedTaskCount, 15);
  assert.equal(pilot.attempts, 3);
  assert.equal(pilot.expectedTrials, 90);
  assert.equal(new Set(pilot.taskNames).size, 15);
  assert.ok(smoke.taskNames.every((task) => pilot.taskNames.includes(task)));

  assert.equal(full.expectedTaskCount, 89);
  assert.equal(full.attempts, 5);
  assert.equal(full.expectedTrials, 890);
  assert.equal(full.taskNames, null);

  for (const manifest of [smoke, pilot, full]) {
    assert.equal(manifest.sourceCommit, sourceCommit);
    assert.equal(manifest.harborVersion, "0.16.1");
    assert.deepEqual(manifest.dataset, {
      name: "terminal-bench/terminal-bench-2-1",
      ref: "6",
    });
    assert.deepEqual(manifest.conditions, ["codex-vanilla", "codex-ultra-guided"]);
    assert.equal(manifest.bootstrap.iterations, 10_000);
    assert.ok(Number.isSafeInteger(manifest.bootstrap.seed));
  }
});

test("run generation changes only the agent import path between conditions", async () => {
  const manifest = await loadExperimentManifest("pilot");
  const { job, runManifest } = createRunFiles(validOptions(manifest));

  assert.equal(job.n_attempts, 3);
  assert.equal(job.n_concurrent_trials, 1);
  assert.deepEqual(job.datasets, [{
    name: manifest.dataset.name,
    ref: manifest.dataset.ref,
    task_names: manifest.taskNames,
  }]);
  assert.equal(job.agents.length, 2);

  const [vanilla, guided] = job.agents;
  assert.equal(vanilla.import_path, "evals.harbor.agents.codex_ab:CodexVanilla");
  assert.equal(guided.import_path, "evals.harbor.agents.codex_ab:CodexUltraGuided");

  const withoutImport = ({ import_path: _ignored, ...agent }) => agent;
  assert.deepEqual(withoutImport(vanilla), withoutImport(guided));
  assert.equal(vanilla.model_name, "openai/gpt-5.4-2026-04-15");
  assert.equal(vanilla.kwargs.version, "0.147.0");
  assert.equal(vanilla.kwargs.reasoning_effort, "high");
  assert.equal(vanilla.kwargs.web_search, "disabled");
  assert.equal(vanilla.kwargs.source_commit, sourceCommit);
  assert.equal(vanilla.env.ULTRA_INSTINCT_PROFILE, "guided");
  assert.equal(vanilla.env.ULTRA_INSTINCT_STATE_DIR, "/tmp/ultra-instinct-state");
  assert.equal(vanilla.env.OPENAI_API_KEY, "${OPENAI_API_KEY}");
  assert.equal(vanilla.concurrency_group, "ultra-codex-ab");

  assert.equal(runManifest.expectedTrials, 90);
  assert.equal(runManifest.model, vanilla.model_name);
  assert.equal(runManifest.codexVersion, vanilla.kwargs.version);
  assert.equal(runManifest.reasoning, vanilla.kwargs.reasoning_effort);
  assert.equal(runManifest.sourceCommit, sourceCommit);
});

test("full jobs select the pinned dataset without duplicating 89 task names", async () => {
  const manifest = await loadExperimentManifest("full");
  const { job } = createRunFiles(validOptions(manifest));

  assert.deepEqual(job.datasets, [{
    name: manifest.dataset.name,
    ref: manifest.dataset.ref,
  }]);
});

test("preparation rejects floating or ambiguous run inputs", async () => {
  const manifest = await loadExperimentManifest("smoke");

  for (const model of ["gpt-5.4", "openai/latest", "openai/default", "openai/gpt *"] ) {
    assert.throws(() => createRunFiles(validOptions(manifest, { model })), /exact model/i);
  }
  for (const codexVersion of ["latest", "0.147", "*", "0.147.0 beta"] ) {
    assert.throws(
      () => createRunFiles(validOptions(manifest, { codexVersion })),
      /Codex version/i,
    );
  }
  assert.throws(
    () => createRunFiles(validOptions(manifest, { concurrency: 33 })),
    /concurrency/i,
  );
  assert.throws(
    () => createRunFiles(validOptions(manifest, { label: "../escape" })),
    /label/i,
  );
});

test("preparation writes only the two reviewed files and refuses label reuse", async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "ultra-harbor-prepare-"));
  const manifest = await loadExperimentManifest("smoke");
  const outputDirectory = path.join(outputRoot, "first-smoke");

  const prepared = await prepareRun(validOptions(manifest, {
    label: "first-smoke",
    outputDirectory,
  }));

  assert.equal(prepared.outputDirectory, outputDirectory);
  await access(path.join(outputDirectory, "job.json"));
  await access(path.join(outputDirectory, "run-manifest.json"));

  const job = JSON.parse(await readFile(path.join(outputDirectory, "job.json"), "utf8"));
  const runManifest = JSON.parse(
    await readFile(path.join(outputDirectory, "run-manifest.json"), "utf8"),
  );
  assert.equal(job.n_attempts, 1);
  assert.equal(runManifest.expectedTrials, 6);

  await assert.rejects(
    prepareRun(validOptions(manifest, { label: "first-smoke", outputDirectory })),
    /already exists/i,
  );
});
