import { cpSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const codexRoot = path.join(pluginRoot, "packages/codex");

for (const directory of ["adapters", "hooks", "runtime", "skills"]) {
  rmSync(path.join(codexRoot, directory), { force: true, recursive: true });
}

mkdirSync(path.join(codexRoot, "adapters"), { recursive: true });
for (const adapter of ["claude.mjs", "codex.mjs"]) {
  cpSync(path.join(pluginRoot, "adapters", adapter), path.join(codexRoot, "adapters", adapter));
}
for (const directory of ["hooks", "runtime", "skills"]) {
  cpSync(path.join(pluginRoot, directory), path.join(codexRoot, directory), { recursive: true });
}

process.stdout.write(`Synced Codex package at ${codexRoot}\n`);
