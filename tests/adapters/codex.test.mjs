import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { normalizeCodexEvent, encodeCodexDecision } from "../../adapters/codex.mjs";
import { dispatchHook } from "../../hooks/dispatch.mjs";
import { bootstrap, pluginRoot } from "../helpers/runtime.mjs";

async function fixture(name) {
  return JSON.parse(await readFile(path.join(import.meta.dirname, `../fixtures/codex/${name}.json`), "utf8"));
}

test("normalizes current Codex fixtures without transcript or model content", async () => {
  const cases = [
    ["session-start", "session.start"],
    ["post-bash-output", "tool.after"],
  ];
  for (const [name, stage] of cases) {
    const event = normalizeCodexEvent(await fixture(name), { ULTRA_INSTINCT_PROFILE: "guided" });
    assert.equal(event.client, "codex");
    assert.equal(event.stage, stage);
    assert.doesNotMatch(JSON.stringify(event), /transcript|gpt-5\.6|private output/);
  }
});

test("never treats Codex model-facing Bash output as confirmed command success", async () => {
  const input = await fixture("post-bash-output");
  assert.equal(normalizeCodexEvent(input, {}).tool.success, false);
  assert.equal(normalizeCodexEvent({
    ...input,
    tool_response: { exit_code: 0, output: "unsupported invented shape" },
  }, {}).tool.success, false);
});

test("encodes Codex SessionStart additional context", () => {
  assert.equal(
    encodeCodexDecision("SessionStart", { allow: true, context: bootstrap.context, warning: null, continueSession: false })
      .hookSpecificOutput.additionalContext,
    bootstrap.context,
  );
});

test("generated Codex SessionStart entrypoint injects the canonical bootstrap", async () => {
  const env = {
    PLUGIN_ROOT: pluginRoot,
    CLAUDE_PLUGIN_ROOT: pluginRoot,
    ULTRA_INSTINCT_PROFILE: "guided",
  };
  const result = await dispatchHook({ stdin: JSON.stringify(await fixture("session-start")), env });
  assert.equal(result.exitCode, 0);
  assert.match(JSON.parse(result.stdout).hookSpecificOutput.additionalContext, /ultra-instinct:bootstrap:v2/);
});
