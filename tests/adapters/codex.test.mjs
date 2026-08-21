import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { normalizeCodexEvent, encodeCodexDecision } from "../../adapters/codex.mjs";
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

test("generated Codex hook process injects bootstrap for every registered source", async () => {
  const generatedRoot = path.join(pluginRoot, "packages/codex");
  const entrypoint = path.join(generatedRoot, "hooks/dispatch.mjs");
  const input = await fixture("session-start");

  for (const source of ["startup", "resume", "clear", "compact"]) {
    const result = spawnSync(process.execPath, [entrypoint], {
      input: JSON.stringify({ ...input, source }),
      encoding: "utf8",
      env: {
        ...process.env,
        PLUGIN_ROOT: generatedRoot,
        CLAUDE_PLUGIN_ROOT: generatedRoot,
        ULTRA_INSTINCT_PROFILE: "guided",
      },
      timeout: 5_000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(JSON.parse(result.stdout).hookSpecificOutput.additionalContext, /ultra-instinct:bootstrap:v2/);
  }
});
