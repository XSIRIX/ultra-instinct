import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { validateOpenCodePackage } from "../../validation/opencode.mjs";
import { pluginRoot } from "../helpers/runtime.mjs";

test("OpenCode package main and zero-dependency plugin validate", async () => {
  assert.deepEqual((await validateOpenCodePackage(pluginRoot)).errors, []);
});

test("package entry resolves without a build step", async () => {
  const packageJson = await import(path.join(pluginRoot, "package.json"), { with: { type: "json" } });
  assert.equal(packageJson.default.main, ".opencode/index.mjs");
  const entry = await import(path.join(pluginRoot, packageJson.default.main));
  assert.equal(entry.default, entry.UltraInstinctPlugin);
});
