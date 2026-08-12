import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { assertLivePermission, createRunPlan, parseArgs } from "../../evals/run.mjs";

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

  assert.equal(scenarios.length, 9);
  assert.equal(plan.length, scenarios.filter(({ profiles }) => profiles.includes("guided")).length * 2);
  assert.ok(plan.every(({ resultDirectory }) =>
    resultDirectory.startsWith(path.join(root, ".ultra-instinct/evals/guided/claude/guided")),
  ));
});
