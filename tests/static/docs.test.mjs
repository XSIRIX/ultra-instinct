import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

test("README and runtime guide document every client, profile, install mode, and removal path", async () => {
  const readme = await readFile(path.join(root, "README.md"), "utf8");
  const runtime = await readFile(path.join(root, "docs/runtime.md"), "utf8");
  const combined = `${readme}\n${runtime}`;

  for (const value of [
    "Claude Code", "Codex", "OpenCode", "lite", "guided", "strict",
    "skills-only", "native runtime", "uninstall", "ULTRA_INSTINCT_PROFILE",
  ]) {
    assert.match(combined, new RegExp(value, "i"), value);
  }
  assert.match(runtime, /paid live model/i);
  assert.match(runtime, /no prompt|never stores prompts/i);
  assert.match(runtime, /--allow-client-state/);
});

test("package exposes deterministic checks and all live evaluation commands", async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  assert.equal(packageJson.scripts.eval, "node evals/run.mjs");
  assert.equal(packageJson.scripts["eval:compare"], "node evals/compare.mjs");
  assert.equal(packageJson.scripts["eval:report"], "node evals/report.mjs");
});
