import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { validateCodexPackage } from "../../validation/codex.mjs";
import { pluginRoot } from "../helpers/runtime.mjs";

test("Codex compatibility package and repository marketplace validate", () => {
  assert.deepEqual(validateCodexPackage(pluginRoot).errors, []);
});

test("Codex manifest explicitly exposes hooks to Desktop and CLI", () => {
  const manifest = JSON.parse(readFileSync(path.join(pluginRoot, ".codex-plugin/plugin.json"), "utf8"));
  assert.equal(manifest.skills, "./skills/");
  assert.equal(manifest.hooks, "./hooks/hooks.json");
});

test("Codex marketplace exposes explicit install and authentication policies", () => {
  const marketplace = JSON.parse(readFileSync(path.join(pluginRoot, ".agents/plugins/marketplace.json"), "utf8"));
  const [entry] = marketplace.plugins;
  assert.equal(entry.name, "ultra-instinct");
  assert.equal(entry.version, "2.0.0-rc.2");
  assert.deepEqual(entry.source, { source: "local", path: "./" });
  assert.deepEqual(entry.policy, { installation: "AVAILABLE", authentication: "ON_INSTALL" });
  assert.equal(entry.category, "Productivity");
});
