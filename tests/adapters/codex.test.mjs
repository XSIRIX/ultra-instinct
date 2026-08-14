import assert from "node:assert/strict";
import { mkdtempSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { normalizeCodexEvent, encodeCodexDecision } from "../../adapters/codex.mjs";
import { dispatchHook } from "../../hooks/dispatch.mjs";
import { bootstrap, pluginRoot } from "../helpers/runtime.mjs";

async function fixture(name) {
  return JSON.parse(await readFile(path.join(import.meta.dirname, `../fixtures/codex/${name}.json`), "utf8"));
}

test("normalizes recorded Codex lifecycle fixtures without transcript or model content", async () => {
  const cases = [
    ["session-start", "session.start"],
    ["pre-apply-patch", "tool.before"],
    ["post-bash-success", "tool.after"],
    ["stop", "session.completing"],
    ["session-end", "session.end"],
  ];
  for (const [name, stage] of cases) {
    const event = normalizeCodexEvent(await fixture(name), { ULTRA_INSTINCT_PROFILE: "guided" });
    assert.equal(event.client, "codex");
    assert.equal(event.stage, stage);
    assert.doesNotMatch(JSON.stringify(event), /transcript|gpt-5\.6|private output/);
  }
});

test("trusts shell verification only when Codex reports exit code zero", async () => {
  const input = await fixture("post-bash-success");
  assert.equal(normalizeCodexEvent(input, {}).tool.success, true);
  assert.equal(normalizeCodexEvent({
    ...input,
    tool_response: { exit_code: 2, output: "private failure" },
  }, {}).tool.success, false);
  assert.equal(normalizeCodexEvent({ ...input, tool_response: {} }, {}).tool.success, false);
});

test("encodes Codex additional context and strict Stop continuation", () => {
  assert.equal(
    encodeCodexDecision("SessionStart", { allow: true, context: bootstrap.context, warning: null, continueSession: false })
      .hookSpecificOutput.additionalContext,
    bootstrap.context,
  );
  assert.deepEqual(
    encodeCodexDecision("Stop", { allow: false, context: "verify", warning: null, continueSession: true }),
    { decision: "block", reason: "verify" },
  );
});

test("shared dispatcher selects Codex and bounds strict continuation", async () => {
  const env = {
    PLUGIN_ROOT: pluginRoot,
    CLAUDE_PLUGIN_ROOT: pluginRoot,
    ULTRA_INSTINCT_PROFILE: "strict",
    ULTRA_INSTINCT_STATE_DIR: mkdtempSync(path.join(os.tmpdir(), "ultra-codex-")),
  };
  const mutation = {
    ...(await fixture("pre-apply-patch")),
    hook_event_name: "PostToolUse",
    tool_response: { success: true },
  };
  await dispatchHook({ stdin: JSON.stringify(mutation), env });
  const first = await dispatchHook({ stdin: JSON.stringify(await fixture("stop")), env });
  const second = await dispatchHook({ stdin: JSON.stringify(await fixture("stop")), env });
  assert.equal(JSON.parse(first.stdout).decision, "block");
  assert.notEqual(JSON.parse(second.stdout).decision, "block");
});

test("shared dispatcher recognizes model-free Codex SessionEnd and removes state", async () => {
  const stateDir = mkdtempSync(path.join(os.tmpdir(), "ultra-codex-end-"));
  const env = {
    PLUGIN_ROOT: pluginRoot,
    CLAUDE_PLUGIN_ROOT: pluginRoot,
    ULTRA_INSTINCT_PROFILE: "strict",
    ULTRA_INSTINCT_STATE_DIR: stateDir,
  };
  const mutation = {
    ...(await fixture("pre-apply-patch")),
    hook_event_name: "PostToolUse",
    tool_response: { success: true },
  };

  await dispatchHook({ stdin: JSON.stringify(mutation), env });
  assert.equal(readdirSync(stateDir).filter((name) => name.endsWith(".json")).length, 1);

  await dispatchHook({ stdin: JSON.stringify(await fixture("session-end")), env });
  assert.equal(readdirSync(stateDir).filter((name) => name.endsWith(".json")).length, 0);
});
