import assert from "node:assert/strict";
import test from "node:test";

import { loadBootstrap } from "../../runtime/bootstrap.mjs";
import { pluginRoot } from "../helpers/runtime.mjs";

test("bootstrap loads the canonical router without frontmatter", async () => {
  const result = await loadBootstrap(pluginRoot);
  assert.equal(result.marker, "<!-- ultra-instinct:bootstrap:v2 -->");
  assert.doesNotMatch(result.context, /^---/);
  assert.equal(result.context.split(result.marker).length - 1, 1);
  assert.ok(Buffer.byteLength(result.context, "utf8") <= 2400);
});

test("bootstrap rejects a missing canonical skill", async () => {
  await assert.rejects(loadBootstrap("/tmp/ultra-instinct-missing"), /using-ultra-instinct/);
});
