import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { SURFACES } from "../../runtime/surfaces.mjs";
import { pluginRoot } from "../helpers/runtime.mjs";

test("canonical surfaces expose seven commands and two specialist agents", () => {
  assert.deepEqual(SURFACES.commands.map(({ name }) => name), [
    "brainstorm", "grilling", "design-spec", "plan", "execute", "verify", "finish",
  ]);
  assert.deepEqual(SURFACES.agents.map(({ name }) => name), ["reviewer", "debugger"]);
});

test("every surface resolves a canonical skill", () => {
  for (const surface of [...SURFACES.commands, ...SURFACES.agents]) {
    assert.ok(existsSync(path.join(pluginRoot, "skills", surface.skill, "SKILL.md")), surface.skill);
  }
});

test("the reviewer skill does not recursively dispatch from a reviewer subagent", () => {
  const skill = readFileSync(path.join(pluginRoot, "skills/request-review/SKILL.md"), "utf8");
  assert.match(skill, /reviewer subagent[\s\S]*review directly/i);
});
