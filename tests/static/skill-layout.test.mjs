import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { readSkillFrontmatter, validateSkillLayout } from "../../validation/skills.mjs";

test("reads required skill frontmatter and body", async () => {
  const file = path.resolve(import.meta.dirname, "../../skills/tdd/SKILL.md");
  const skill = readSkillFrontmatter(file);

  assert.equal(skill.name, "tdd");
  assert.match(skill.description, /behavior change/);
  assert.match(skill.body, /Test-Driven Development/);
  assert.deepEqual(skill.errors, []);
});

test("the skills directory keeps the Skills CLI layout", () => {
  const root = path.resolve(import.meta.dirname, "../..");
  const result = validateSkillLayout(root);

  assert.deepEqual(result.errors, []);
  assert.equal(result.names.length, 13);
});

test("skill validation rejects folder and frontmatter mismatches", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ultra-skills-"));
  await mkdir(path.join(root, "skills/right-name"), { recursive: true });
  await writeFile(
    path.join(root, "skills/right-name/SKILL.md"),
    "---\nname: wrong-name\ndescription:\n---\n\n# Test\n",
  );

  const result = validateSkillLayout(root);

  assert.ok(result.errors.some((error) => error.includes("right-name")));
  assert.ok(result.errors.some((error) => error.includes("description")));
});
