import assert from "node:assert/strict";
import { mkdtempSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  applyOpenCodeDecision,
  normalizeOpenCodeEvent,
  registerOpenCodeConfig,
} from "../../adapters/opencode.mjs";
import { UltraInstinctPlugin } from "../../.opencode/index.mjs";
import { pluginRoot } from "../helpers/runtime.mjs";

async function fixture(name) {
  return JSON.parse(await readFile(path.join(import.meta.dirname, `../fixtures/opencode/${name}.json`), "utf8"));
}

function fakeClient({ failPrompt = false } = {}) {
  const prompts = [];
  const logs = [];
  return {
    prompts,
    logs,
    session: {
      async prompt(input) {
        prompts.push(input);
        if (failPrompt) throw new Error("private SDK failure");
        return { data: true };
      },
    },
    app: {
      async log(input) {
        logs.push(input);
        return { data: true };
      },
    },
  };
}

test("registers the canonical skill path, commands, and agents exactly once", () => {
  const config = { skills: { paths: ["/existing"] }, command: {}, agent: {} };
  registerOpenCodeConfig(config, pluginRoot);
  registerOpenCodeConfig(config, pluginRoot);

  assert.equal(config.skills.paths.filter((entry) => entry === path.join(pluginRoot, "skills")).length, 1);
  assert.deepEqual(Object.keys(config.command), ["brainstorm", "design-spec", "plan", "execute", "verify", "finish"]);
  assert.deepEqual(Object.keys(config.agent), ["reviewer", "debugger"]);
  assert.equal(config.agent.reviewer.mode, "subagent");
  assert.equal(config.agent.reviewer.permission.edit, "deny");
});

test("normalizes OpenCode direct hooks and general events without private paths or output", async () => {
  const cases = [
    ["tool-before", "tool.before"],
    ["tool-after", "tool.after"],
    ["file-edited", "tool.after"],
    ["session-idle", "session.completing"],
    ["session-deleted", "session.end"],
  ];
  for (const [name, stage] of cases) {
    const event = normalizeOpenCodeEvent(await fixture(name), {
      directory: "/tmp/opencode-project",
      profile: "guided",
      sessionID: "opencode-session",
    });
    assert.equal(event.client, "opencode");
    assert.equal(event.stage, stage);
    assert.doesNotMatch(JSON.stringify(event), /private output|private source|private\/edited/);
  }
});

test("trusts OpenCode shell verification only when metadata.exit is zero", async () => {
  const input = await fixture("tool-after");
  assert.equal(normalizeOpenCodeEvent(input, {}).tool.success, true);
  assert.equal(normalizeOpenCodeEvent({
    ...input,
    output: { ...input.output, metadata: { exit: 1 } },
  }, {}).tool.success, false);
  assert.equal(normalizeOpenCodeEvent({
    ...input,
    output: { ...input.output, metadata: {} },
  }, {}).tool.success, false);
});

test("applies strict continuation through the current flat SDK contract and fails open", async () => {
  const client = fakeClient();
  await applyOpenCodeDecision(
    { allow: false, context: "verify", warning: null, continueSession: true },
    { client, sessionID: "session", directory: "/tmp/project" },
  );
  assert.deepEqual(client.prompts, [{
    sessionID: "session",
    directory: "/tmp/project",
    parts: [{ type: "text", text: "verify" }],
  }]);

  const failing = fakeClient({ failPrompt: true });
  await assert.doesNotReject(applyOpenCodeDecision(
    { allow: false, context: "verify", warning: null, continueSession: true },
    { client: failing, sessionID: "session", directory: "/tmp/project" },
  ));
  assert.match(failing.logs[0].message, /failed open/i);
  assert.doesNotMatch(failing.logs[0].message, /private SDK failure/);
});

test("plugin injects once, restores compacted facts, continues strict once, and cleans state", async () => {
  const client = fakeClient();
  const stateDir = mkdtempSync(path.join(os.tmpdir(), "ultra-opencode-"));
  const hooks = await UltraInstinctPlugin({
    client,
    directory: "/tmp/opencode-project",
    ultra: { profile: "strict", stateDir },
  });
  const config = {};
  await hooks.config(config);

  const messages = [{
    info: { id: "message", sessionID: "opencode-session", role: "user" },
    parts: [{ id: "part", sessionID: "opencode-session", messageID: "message", type: "text", text: "Fix it" }],
  }];
  await hooks["experimental.chat.messages.transform"]({}, { messages });
  await hooks["experimental.chat.messages.transform"]({}, { messages });
  assert.equal(JSON.stringify(messages).split("ultra-instinct:bootstrap:v2").length - 1, 1);

  const beforeWrite = await fixture("tool-before");
  await hooks["tool.execute.after"](
    { ...beforeWrite.input, args: beforeWrite.output.args },
    { title: "Write", output: "private", metadata: {} },
  );

  const compacted = { context: [] };
  await hooks["experimental.session.compacting"]({ sessionID: "opencode-session" }, compacted);
  assert.match(compacted.context.join("\n"), /ultra-instinct:bootstrap:v2/);
  assert.match(compacted.context.join("\n"), /unverified mutation/i);

  await hooks.event({ event: await fixture("session-idle") });
  await hooks.event({ event: await fixture("session-idle") });
  assert.equal(client.prompts.length, 1);

  await hooks.event({ event: await fixture("session-deleted") });
  assert.equal(readdirSync(stateDir).filter((name) => name.endsWith(".json")).length, 0);
});

test("plugin does not register a before-tool hook", async () => {
  const hooks = await UltraInstinctPlugin({
    client: fakeClient(),
    directory: "/tmp/opencode-project",
    ultra: { profile: "guided" },
  });
  assert.equal(hooks["tool.execute.before"], undefined);
});
