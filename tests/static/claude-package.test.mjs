import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { validateClaudePackage } from "../../validation/claude.mjs";
import { pluginRoot } from "../helpers/runtime.mjs";

test("Claude package metadata, hooks, commands, and agents validate", () => {
  assert.deepEqual(validateClaudePackage(pluginRoot).errors, []);
});

test("shared hooks use the plugin root, two-second timeouts, and required lifecycle events", () => {
  const config = JSON.parse(readFileSync(path.join(pluginRoot, "hooks/hooks.json"), "utf8"));
  assert.equal(config.hooks.PreToolUse, undefined);
  for (const event of ["SessionStart", "PostToolUse", "Stop", "SessionEnd"]) {
    assert.ok(config.hooks[event]);
    for (const group of config.hooks[event]) {
      for (const hook of group.hooks) {
        assert.match(hook.command, /\$\{CLAUDE_PLUGIN_ROOT\}/);
        assert.equal(hook.timeout, 2);
      }
    }
  }
});
