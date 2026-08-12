import assert from "node:assert/strict";
import { mkdtempSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { handleRuntimeEvent } from "../../runtime/index.mjs";
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
