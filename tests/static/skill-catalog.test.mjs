import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { readSkillFrontmatter, validateSkillLayout } from "../../validation/skills.mjs";

const EXPECTED = [
  "brainstorm",
  "execute-plan",
  "finish-branch",
  "isolate-work",
  "mockup",
  "receiving-code-review",
  "request-review",
  "systematic-debugging",
  "tdd",
  "using-ultra-instinct",
  "verification-before-completion",
  "write-design-spec",
  "write-plan",
];

const root = path.resolve(import.meta.dirname, "../..");

test("the canonical catalog contains exactly thirteen skills", () => {
  const result = validateSkillLayout(root);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.names.sort(), EXPECTED);
});

for (const name of ["systematic-debugging", "verification-before-completion", "receiving-code-review"]) {
  test(`${name} defines positive and negative trigger boundaries`, () => {
    const skill = readSkillFrontmatter(path.join(root, "skills", name, "SKILL.md"));
    assert.match(skill.description, /Use when/);
    assert.match(skill.description, /Do not/);
  });
}
