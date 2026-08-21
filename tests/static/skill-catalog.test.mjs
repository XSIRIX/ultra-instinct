import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { readSkillFrontmatter, validateSkillLayout } from "../../validation/skills.mjs";

const EXPECTED = [
  "brainstorm",
  "capture-artifact",
  "execute-plan",
  "finish-branch",
  "grilling",
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

test("the canonical catalog contains exactly fifteen skills", () => {
  const result = validateSkillLayout(root);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.names.sort(), EXPECTED);
});

test("grilling defines when to enter and when to skip the workflow", () => {
  const skill = readSkillFrontmatter(path.join(root, "skills/grilling/SKILL.md"));
  assert.match(skill.description, /Use when/);
  assert.match(skill.description, /Do not/);
});

for (const name of ["systematic-debugging", "verification-before-completion", "receiving-code-review"]) {
  test(`${name} defines positive and negative trigger boundaries`, () => {
    const skill = readSkillFrontmatter(path.join(root, "skills", name, "SKILL.md"));
    assert.match(skill.description, /Use when/);
    assert.match(skill.description, /Do not/);
  });
}
