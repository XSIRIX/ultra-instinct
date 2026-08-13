import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { readSkillFrontmatter, validateSkillLayout } from "../../validation/skills.mjs";

const MARKER = "<!-- ultra-instinct:bootstrap:v2 -->";
const root = path.resolve(import.meta.dirname, "../..");

test("the canonical router fits the injection budget and contains one stable marker", () => {
  const router = readSkillFrontmatter(path.join(root, "skills/using-ultra-instinct/SKILL.md"));
  assert.ok(Buffer.byteLength(router.body, "utf8") <= 2400);
  assert.equal(router.body.split(MARKER).length - 1, 1);
});

test("the canonical router names every skill and keeps user instructions first", () => {
  const router = readSkillFrontmatter(path.join(root, "skills/using-ultra-instinct/SKILL.md"));
  const { names } = validateSkillLayout(root);
  for (const name of names) assert.match(router.body, new RegExp(`\\b${name}\\b`));
  assert.match(router.body, /User and repository instructions (?:win|take priority)/i);
  assert.doesNotMatch(router.body, /nine skills|no session(?:-start)? injection/i);
});

test("the canonical router matches every coding task as the Desktop fallback", () => {
  const router = readSkillFrontmatter(path.join(root, "skills/using-ultra-instinct/SKILL.md"));
  assert.match(router.description, /start of any coding task/i);
});
