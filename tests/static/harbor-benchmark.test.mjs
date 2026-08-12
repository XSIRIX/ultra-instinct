import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

async function text(file) {
  return readFile(path.join(root, file), "utf8");
}

test("Harbor workflow is pinned, ignored, and cannot launch from an npm check", async () => {
  const [packageSource, pyproject, lock, gitignore] = await Promise.all([
    text("package.json"),
    text("evals/harbor/pyproject.toml"),
    text("evals/harbor/uv.lock"),
    text(".gitignore"),
  ]);
  const packageJson = JSON.parse(packageSource);

  assert.equal(
    packageJson.scripts["eval:harbor:node-check"],
    "node validation/test.mjs tests/harbor tests/static/harbor-benchmark.test.mjs",
  );
  assert.match(packageJson.scripts["eval:harbor:python-check"], /--locked/);
  assert.match(packageJson.scripts["eval:harbor:python-check"], /pytest evals\/harbor\/tests/);
  assert.match(packageJson.scripts["eval:harbor:check"], /eval:harbor:node-check/);
  assert.match(packageJson.scripts["eval:harbor:check"], /eval:harbor:python-check/);
  assert.doesNotMatch(
    Object.values(packageJson.scripts).join("\n"),
    /harbor run|jobs start/,
    "No package script may cross the paid-run boundary.",
  );
  assert.match(pyproject, /"harbor==0\.16\.1"/);
  assert.match(lock, /name = "harbor"\s+version = "0\.16\.1"/);
  assert.match(gitignore, /^\.ultra-instinct\/$/m);
});

test("operator guide separates free setup from paid smoke, pilot, and full runs", async () => {
  const [rootReadme, guide] = await Promise.all([
    text("README.md"),
    text("evals/harbor/README.md"),
  ]);

  assert.match(rootReadme, /Harbor A\/B benchmark/i);
  assert.match(rootReadme, /evals\/harbor\/README\.md/);
  assert.match(guide, /free setup/i);
  assert.match(guide, /paid run/i);
  assert.match(guide, /OPENAI_API_KEY/);
  assert.match(guide, /DAYTONA_API_KEY/);
  assert.match(guide, /6 trials/);
  assert.match(guide, /90 trials/);
  assert.match(guide, /890 trials/);
  assert.match(guide, /harbor run -c/);
  assert.match(guide, /eval:harbor:analyze/);
  assert.match(guide, /15%/);
  assert.match(guide, /does not upload/i);
});
