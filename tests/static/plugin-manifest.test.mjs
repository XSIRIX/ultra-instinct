import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { validatePortablePlugin } from "../../validation/portable.mjs";

test("the repository manifest conforms to Agent Plugins 1.0", async () => {
  const root = path.resolve(import.meta.dirname, "../..");
  const result = await validatePortablePlugin(root);

  assert.deepEqual(result.errors, []);
  assert.equal(result.manifest.name, "ultra-instinct");
  assert.equal(result.manifest.version, "2.0.0-rc.2");
});

test("portable validation rejects closed manifest fields", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ultra-portable-"));
  await mkdir(path.join(root, "schemas/agent-plugins/1.0.0"), { recursive: true });
  await writeFile(
    path.join(root, "schemas/agent-plugins/1.0.0/plugin.schema.json"),
    await readFile(path.resolve(import.meta.dirname, "../../schemas/agent-plugins/1.0.0/plugin.schema.json"), "utf8"),
  );
  await writeFile(
    path.join(root, "plugin.json"),
    JSON.stringify({
      $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
      name: "test-plugin",
      unsupported: true,
    }),
  );

  const result = await validatePortablePlugin(root);

  assert.ok(result.errors.some((error) => error.includes("additional properties")));
});
