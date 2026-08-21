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
  assert.match(combined, /Codex Desktop/i);
  assert.match(combined, /\/hooks/);
  assert.match(combined, /fifteen skills/i);
  assert.match(combined, /grilling/i);
  assert.match(runtime, /Codex.+SessionStart.+only/is);
  assert.match(runtime, /Codex.+does not track.+mutation.+verification/is);
});

test("package exposes deterministic checks and all live evaluation commands", async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  assert.equal(packageJson.scripts.eval, "node evals/run.mjs");
  assert.equal(packageJson.scripts["eval:compare"], "node evals/compare.mjs");
  assert.equal(packageJson.scripts["eval:report"], "node evals/report.mjs");
});

test("published v2 runtime design preserves its original post-tool-only contract", async () => {
  const design = await readFile(path.join(root, "docs/design/2026-08-12/ultra-instinct-v2-runtime.md"), "utf8");
  assert.doesNotMatch(design, /PreToolUse|tool\.execute\.before/);
  assert.match(design, /\.ultra-instinct/);
  assert.match(design, /dirty cycle/i);
  assert.match(design, /exactly fourteen canonical skills/i);
  assert.match(design, /capture-artifact/);
});
