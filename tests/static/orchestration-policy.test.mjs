import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

test("skills keep one primary owner and bound delegation", async () => {
  const [router, execution, review] = await Promise.all([
    readFile(path.join(root, "skills/using-ultra-instinct/SKILL.md"), "utf8"),
    readFile(path.join(root, "skills/execute-plan/SKILL.md"), "utf8"),
    readFile(path.join(root, "skills/request-review/SKILL.md"), "utf8"),
  ]);

  assert.match(router, /one primary agent/i);
  assert.match(router, /hooks never (?:spawn|dispatch) agents/i);
  assert.match(execution, /independent/i);
  assert.match(execution, /non-overlapping|read-only/i);
  assert.match(review, /explicit review/i);
});

test("completed plans verify, capture one durable artifact, then request review", async () => {
  const [execution, verification] = await Promise.all([
    readFile(path.join(root, "skills/execute-plan/SKILL.md"), "utf8"),
    readFile(path.join(root, "skills/verification-before-completion/SKILL.md"), "utf8"),
  ]);

  const verifyIndex = execution.lastIndexOf("verification-before-completion");
  const captureIndex = execution.lastIndexOf("capture-artifact");
  const reviewIndex = execution.lastIndexOf("request-review");

  assert.ok(verifyIndex >= 0);
  assert.ok(captureIndex > verifyIndex);
  assert.ok(reviewIndex > captureIndex);
  assert.match(verification, /capture-artifact.+before.+review/is);
});

test("whole-work review includes committed, tracked working-tree, and untracked changes", async () => {
  const review = await readFile(path.join(root, "skills/request-review/SKILL.md"), "utf8");

  assert.match(review, /git diff -U10 "\$BASE"(?!\.\.HEAD)/);
  assert.match(review, /git ls-files --others --exclude-standard -z/);
  assert.match(review, /untracked/i);
});
