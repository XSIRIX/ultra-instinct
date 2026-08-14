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

test("current-source research is mandatory, bounded, and reused", async () => {
  const [debugging, tdd, execution, receivingReview, requestReview] = await Promise.all([
    readFile(path.join(root, "skills/systematic-debugging/SKILL.md"), "utf8"),
    readFile(path.join(root, "skills/tdd/SKILL.md"), "utf8"),
    readFile(path.join(root, "skills/execute-plan/SKILL.md"), "utf8"),
    readFile(path.join(root, "skills/receiving-code-review/SKILL.md"), "utf8"),
    readFile(path.join(root, "skills/request-review/SKILL.md"), "utf8"),
  ]);

  assert.match(debugging, /before any edit/i);
  assert.match(debugging, /web search or Exa/i);
  assert.match(debugging, /one to three authoritative sources/i);
  assert.match(debugging, /search again only if the hypothesis changes or a fix fails/i);
  assert.match(debugging, /purely internal logic/i);

  for (const skill of [tdd, execution, receivingReview, requestReview]) {
    assert.match(skill, /reuse/i);
    assert.match(skill, /web search or Exa/i);
    assert.match(skill, /pinned version/i);
  }
});
