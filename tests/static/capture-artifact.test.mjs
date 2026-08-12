import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { readSkillFrontmatter } from "../../validation/skills.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const skillFile = path.join(root, "skills/capture-artifact/SKILL.md");

test("capture-artifact has a narrow completion trigger", async () => {
  const skill = readSkillFrontmatter(skillFile);
  const body = await readFile(skillFile, "utf8");

  assert.match(skill.description, /after fresh verification/i);
  assert.match(skill.description, /completed meaningful/i);
  assert.match(skill.description, /before (?:whole-branch )?review/i);
  assert.match(skill.description, /skip/i);
  assert.match(body, /one artifact per (?:completed )?(?:meaningful )?work item/i);
  assert.match(body, /not (?:once )?per (?:nested )?skill/i);
  assert.match(body, /do nothing|skip/i);
});

test("capture-artifact follows project docs conventions and updates topics", async () => {
  const body = await readFile(skillFile, "utf8");

  assert.match(body, /existing (?:repository|project) docs convention/i);
  assert.match(body, /search.+existing/i);
  assert.match(body, /update.+existing/i);
  assert.match(body, /docs\/features\/<slug>\.md/);
  assert.match(body, /docs\/architecture\/<slug>\.md/);
  assert.match(body, /docs\/operations\/<slug>\.md/);
  assert.match(body, /docs\/decisions\/<slug>\.md/);
  assert.match(body, /docs\/<slug>\.md/);
});

test("capture-artifact records durable facts without becoming a log", async () => {
  const body = await readFile(skillFile, "utf8");

  for (const heading of ["Summary", "What changed", "Decisions", "Verification", "Limitations", "Related"]) {
    assert.match(body, new RegExp(heading, "i"));
  }

  for (const excluded of ["prompts", "transcripts", "private reasoning", "secrets", "raw tool output", "chronological", "exhaustive file list"]) {
    assert.match(body, new RegExp(excluded, "i"));
  }

  assert.match(body, /after fresh verification/i);
  assert.match(body, /before.+request-review/i);
  assert.match(body, /(?:never|do not).+hook/i);
});
