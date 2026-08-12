import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mkdtempSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { normalizeClaudeEvent, encodeClaudeDecision } from "../../adapters/claude.mjs";
import { dispatchHook } from "../../hooks/dispatch.mjs";
import { bootstrap, pluginRoot } from "../helpers/runtime.mjs";

async function fixture(name) {
  return JSON.parse(await readFile(path.join(import.meta.dirname, `../fixtures/claude/${name}.json`), "utf8"));
}

test("normalizes every recorded Claude lifecycle fixture without transcript data", async () => {
  const cases = [
    ["session-start", "session.start"],
    ["pre-write", "tool.before"],
    ["post-bash-success", "tool.after"],
    ["stop", "session.completing"],
    ["session-end", "session.end"],
  ];
  for (const [name, stage] of cases) {
    const event = normalizeClaudeEvent(await fixture(name), { ULTRA_INSTINCT_PROFILE: "guided" });
    assert.equal(event.stage, stage);
    assert.equal(event.client, "claude");
    assert.doesNotMatch(JSON.stringify(event), /transcript|private message/);
  }
});

test("maps compact SessionStart to context restoration", async () => {
  const input = { ...(await fixture("session-start")), source: "compact" };
  assert.equal(normalizeClaudeEvent(input, {}).stage, "context.compacting");
});

test("encodes Claude context and bounded Stop decisions", () => {
  const start = encodeClaudeDecision("SessionStart", {
    allow: true,
    context: bootstrap.context,
    warning: null,
    continueSession: false,
  });
  assert.equal(start.hookSpecificOutput.hookEventName, "SessionStart");
  assert.equal(start.hookSpecificOutput.additionalContext, bootstrap.context);

  const stop = encodeClaudeDecision("Stop", {
    allow: false,
    context: "verify first",
    warning: null,
    continueSession: true,
  });
  assert.deepEqual(stop, { decision: "block", reason: "verify first" });

  const guided = encodeClaudeDecision("Stop", {
    allow: true,
    context: "verification warning",
    warning: null,
    continueSession: false,
  });
  assert.deepEqual(guided, { systemMessage: "verification warning" });
});

test("dispatch returns valid fail-open output and never logs raw input", async () => {
  const start = await fixture("session-start");
  const result = await dispatchHook({
    stdin: JSON.stringify(start),
    env: { CLAUDE_PLUGIN_ROOT: pluginRoot, ULTRA_INSTINCT_PROFILE: "guided" },
  });
  assert.equal(result.exitCode, 0);
  assert.equal(JSON.parse(result.stdout).hookSpecificOutput.hookEventName, "SessionStart");

  const failed = await dispatchHook({ stdin: "SECRET raw invalid", env: { CLAUDE_PLUGIN_ROOT: pluginRoot } });
  assert.equal(failed.exitCode, 0);
  assert.doesNotMatch(failed.stderr, /SECRET|raw/);
});

test("dispatch warns once for an invalid profile without echoing its value", async () => {
  const result = await dispatchHook({
    stdin: JSON.stringify(await fixture("session-start")),
    env: { CLAUDE_PLUGIN_ROOT: pluginRoot, ULTRA_INSTINCT_PROFILE: "PRIVATE_PROFILE" },
  });
  assert.match(result.stderr, /unknown profile/i);
  assert.doesNotMatch(result.stderr, /PRIVATE_PROFILE/i);
});

test("strict dispatch continues once per unverified epoch and cleans up", async () => {
  const stateDir = mkdtempSync(path.join(os.tmpdir(), "ultra-claude-"));
  const env = {
    CLAUDE_PLUGIN_ROOT: pluginRoot,
    ULTRA_INSTINCT_PROFILE: "strict",
    ULTRA_INSTINCT_STATE_DIR: stateDir,
  };
  const mutation = {
    ...(await fixture("pre-write")),
    hook_event_name: "PostToolUse",
    tool_response: { success: true },
  };

  await dispatchHook({ stdin: JSON.stringify(mutation), env });
  const first = await dispatchHook({ stdin: JSON.stringify(await fixture("stop")), env });
  const second = await dispatchHook({ stdin: JSON.stringify(await fixture("stop")), env });
  await dispatchHook({ stdin: JSON.stringify(await fixture("session-end")), env });

  assert.equal(JSON.parse(first.stdout).decision, "block");
  assert.notEqual(JSON.parse(second.stdout).decision, "block");
  assert.equal(readdirSync(stateDir).filter((name) => name.endsWith(".json")).length, 0);
});
