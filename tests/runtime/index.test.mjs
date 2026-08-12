import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { handleRuntimeEvent } from "../../runtime/index.mjs";
import { createInitialState } from "../../runtime/contracts.mjs";
import { createStateStore } from "../../runtime/state.mjs";
import { pluginRoot, runtimeEvent } from "../helpers/runtime.mjs";

test("runtime persists mutation facts and recognizes later verification", async () => {
  const stateDir = mkdtempSync(path.join(os.tmpdir(), "ultra-runtime-"));
  const stateStore = createStateStore({ stateDir });

  const mutation = await handleRuntimeEvent(
    runtimeEvent({ stage: "tool.after", tool: { name: "apply_patch", input: { command: "private" }, success: true } }),
    { pluginRoot, stateStore },
  );
  const verification = await handleRuntimeEvent(
    runtimeEvent({ stage: "tool.after", at: 2_000, tool: { name: "Bash", input: { command: "npm test" }, success: true } }),
    { pluginRoot, stateStore },
  );
  const completion = await handleRuntimeEvent(runtimeEvent({ stage: "session.completing", at: 3_000 }), {
    pluginRoot,
    stateStore,
  });

  assert.match(mutation.context, /TDD/i);
  assert.equal(verification.allow, true);
  assert.equal(completion.context, null);
});

test("lite profile writes no state", async () => {
  const stateDir = mkdtempSync(path.join(os.tmpdir(), "ultra-runtime-"));
  const stateStore = createStateStore({ stateDir });
  const decision = await handleRuntimeEvent(runtimeEvent({ profile: "lite" }), { pluginRoot, stateStore });
  assert.equal(readdirSync(stateDir).length, 0);
  assert.deepEqual(decision, { allow: true, context: null, warning: null, continueSession: false });
});

test("runtime exceptions fail open without exposing raw input", async () => {
  const decision = await handleRuntimeEvent(
    runtimeEvent({ stage: "tool.after", tool: { name: "Bash", input: { command: "SECRET_TOKEN=raw" }, success: true } }),
    {
      pluginRoot,
      stateStore: {
        read() { throw new Error("state unavailable"); },
        write() { throw new Error("must not write"); },
        delete() {},
        cleanup() {},
      },
    },
  );
  assert.equal(decision.allow, true);
  assert.doesNotMatch(decision.warning, /SECRET_TOKEN|raw/);
});

test("ordinary tool events neither load the bootstrap nor rewrite unchanged state", async () => {
  let state = createInitialState();
  let writes = 0;
  let cleanups = 0;
  const stateStore = {
    read() { return state; },
    write(_key, nextState) { writes += 1; state = nextState; },
    delete() {},
    cleanup() { cleanups += 1; },
  };

  const decision = await handleRuntimeEvent(runtimeEvent({
    stage: "tool.after",
    tool: { name: "read", input: null, success: true },
  }), {
    pluginRoot: "/tmp/ultra-instinct-missing",
    stateStore,
  });

  assert.equal(decision.warning, null);
  assert.equal(writes, 0);
  assert.equal(cleanups, 0);
});

test("state cleanup runs once at session start rather than on every event", async () => {
  let state = createInitialState();
  let cleanups = 0;
  const stateStore = {
    read() { return state; },
    write(_key, nextState) { state = nextState; },
    delete() {},
    cleanup() { cleanups += 1; },
  };

  const bootstrap = { context: "router" };
  await handleRuntimeEvent(runtimeEvent(), { bootstrap, stateStore });
  await handleRuntimeEvent(runtimeEvent({
    stage: "tool.after",
    tool: { name: "apply_patch", input: null, success: true },
  }), { bootstrap, stateStore });

  assert.equal(cleanups, 1);
});

test("repeated mutations write state only when a dirty cycle opens", async () => {
  let state = createInitialState();
  let writes = 0;
  const stateStore = {
    read() { return state; },
    write(_key, nextState) { writes += 1; state = nextState; },
    delete() {},
    cleanup() {},
  };
  const mutation = runtimeEvent({
    stage: "tool.after",
    tool: { name: "apply_patch", input: null, success: true },
  });

  await handleRuntimeEvent(mutation, { pluginRoot, stateStore });
  await handleRuntimeEvent({ ...mutation, at: 2_000 }, { pluginRoot, stateStore });

  assert.equal(writes, 1);
  assert.equal(state.mutationEpoch, 1);
});

test("default runtime state stays inside the ignored workspace artifact directory", async () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "ultra-workspace-"));
  try {
    await handleRuntimeEvent(runtimeEvent({
      workspace,
      stage: "tool.after",
      tool: { name: "apply_patch", input: null, success: true },
    }), { pluginRoot });

    const artifactRoot = path.join(workspace, ".ultra-instinct");
    assert.equal(existsSync(path.join(artifactRoot, "runtime")), true);
    assert.equal(readFileSync(path.join(artifactRoot, ".gitignore"), "utf8"), "*\n");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
