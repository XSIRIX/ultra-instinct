import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { SURFACES } from "../../runtime/surfaces.mjs";
import { pluginRoot } from "../helpers/runtime.mjs";

test("canonical surfaces expose six commands and two specialist agents", () => {
  assert.deepEqual(SURFACES.commands.map(({ name }) => name), [
    "brainstorm", "design-spec", "plan", "execute", "verify", "finish",
  ]);
  assert.deepEqual(SURFACES.agents.map(({ name }) => name), ["reviewer", "debugger"]);
});

test("every surface resolves a canonical skill", () => {
  for (const surface of [...SURFACES.commands, ...SURFACES.agents]) {
    assert.ok(existsSync(path.join(pluginRoot, "skills", surface.skill, "SKILL.md")), surface.skill);
  }
});
