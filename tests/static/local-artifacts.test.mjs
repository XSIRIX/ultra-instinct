import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

async function text(file) {
  return readFile(path.join(root, file), "utf8");
}

test("generated artifacts default to one ignored local workspace", async () => {
  const [gitignore, design, plan, mockup, brainstorm, isolation, evalGuide, harborGuide, durableArtifact, ...evalClients] = await Promise.all([
    text(".gitignore"),
    text("skills/write-design-spec/SKILL.md"),
    text("skills/write-plan/SKILL.md"),
    text("skills/mockup/SKILL.md"),
    text("skills/brainstorm/SKILL.md"),
    text("skills/isolate-work/SKILL.md"),
    text("evals/README.md"),
    text("evals/harbor/README.md"),
    text("docs/features/capture-artifact.md"),
    text("evals/clients/claude.mjs"),
    text("evals/clients/codex.mjs"),
    text("evals/clients/opencode.mjs"),
  ]);

  assert.match(gitignore, /^\.ultra-instinct\/$/m);
  assert.match(design, /\.ultra-instinct\/design\/YYYY-MM-DD\/<topic>\.md/);
  assert.match(design, /explicitly asks to publish/i);
  assert.doesNotMatch(design, /first committed artifact/i);
  assert.match(plan, /\.ultra-instinct\/plans\/YYYY-MM-DD\/<feature>\.md/);
  assert.match(plan, /explicitly asks to publish/i);
  assert.match(mockup, /\.ultra-instinct\/mockups\/<topic>/);
  assert.match(brainstorm, /\.ultra-instinct\/mockups\/<topic>/);
  assert.doesNotMatch(brainstorm, /temp directory outside the repo/i);
  assert.match(isolation, /ignored specs and plans do not require isolation/i);
  assert.match(evalGuide, /\.ultra-instinct\/evals\/<label>/);
  assert.match(harborGuide, /\.ultra-instinct\/harbor\/smoke-001/);
  assert.match(durableArtifact, /tracked.+docs|docs.+tracked/is);
  for (const client of evalClients) {
    assert.match(client, /\.ultra-instinct["'], ["']runtime/);
    assert.doesNotMatch(client, /\.ultra-eval-state/);
  }
});
