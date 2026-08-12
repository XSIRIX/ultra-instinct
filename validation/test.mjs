import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function collect(target) {
  const resolved = path.resolve(pluginRoot, target);
  if (!statSync(resolved).isDirectory()) return resolved.endsWith(".test.mjs") ? [resolved] : [];
  return readdirSync(resolved, { withFileTypes: true }).flatMap((entry) =>
    collect(path.join(resolved, entry.name)),
  );
}

const targets = process.argv.slice(2);
const files = [...new Set((targets.length ? targets : ["tests"]).flatMap(collect))].sort();
if (!files.length) {
  console.error("No test files matched.");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", ...files], { cwd: pluginRoot, stdio: "inherit" });
process.exit(result.status ?? 1);
