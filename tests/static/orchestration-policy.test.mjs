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
