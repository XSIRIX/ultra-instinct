import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const SEMVER = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export function validateCodexPackage(pluginRoot) {
  const errors = [];
  let root;
  let manifest;
  let marketplace;
  let codexRoot;
  try {
    root = JSON.parse(readFileSync(path.join(pluginRoot, "plugin.json"), "utf8"));
    marketplace = JSON.parse(readFileSync(path.join(pluginRoot, ".agents/plugins/marketplace.json"), "utf8"));
    const entry = marketplace.plugins?.find((plugin) => plugin.name === root.name);
    if (entry?.source?.source !== "local" || entry?.source?.path !== "./packages/codex") {
      throw new Error("marketplace must point to ./packages/codex");
    }
    codexRoot = path.join(pluginRoot, "packages/codex");
    manifest = JSON.parse(readFileSync(path.join(codexRoot, ".codex-plugin/plugin.json"), "utf8"));
  } catch (error) {
    return { errors: [`Codex package: ${error.message}`] };
  }

  for (const field of ["name", "version", "repository", "license"]) {
    if (manifest[field] !== root[field]) errors.push(`Codex manifest ${field} must match plugin.json`);
  }
  if (manifest.author?.name !== root.author?.name) errors.push("Codex manifest author must match plugin.json");
  if (!SEMVER.test(manifest.version ?? "")) errors.push("Codex manifest version must be strict semver");
  if (manifest.skills !== "./skills/") errors.push("Codex skills path must be ./skills/");
  if (manifest.hooks !== "./hooks/hooks.json") {
    errors.push("Codex hooks path must explicitly expose ./hooks/hooks.json");
  }
  if (existsSync(path.join(codexRoot, "plugin.json"))) {
    errors.push("Codex package root must not contain an Agent Plugins plugin.json");
  }
  if (!existsSync(path.join(codexRoot, "hooks/hooks.json"))) errors.push("Codex hooks/hooks.json is missing");
  if (!existsSync(path.join(codexRoot, "skills/using-ultra-instinct/SKILL.md"))) {
    errors.push("Codex canonical router skill is missing");
  }

  const requiredInterface = ["displayName", "shortDescription", "longDescription", "developerName", "category", "capabilities", "defaultPrompt"];
  for (const field of requiredInterface) {
    if (manifest.interface?.[field] == null) errors.push(`Codex interface missing ${field}`);
  }
  const entry = marketplace.plugins?.find((plugin) => plugin.name === root.name);
  if (!entry) errors.push("Codex marketplace is missing ultra-instinct");
  if (entry?.version !== root.version) errors.push("Codex marketplace version must match plugin.json");
  if (!entry?.policy?.installation || !entry?.policy?.authentication || !entry?.category) {
    errors.push("Codex marketplace entry is missing policy or category");
  }

  const mappings = [
    ["adapters/claude.mjs", "adapters/claude.mjs"],
    ["adapters/codex.mjs", "adapters/codex.mjs"],
    ["hooks/dispatch.mjs", "hooks/dispatch.mjs"],
    ["hooks/hooks.codex.json", "hooks/hooks.json"],
    ["runtime", "runtime"],
    ["skills", "skills"],
  ];
  for (const [source, target] of mappings) {
    if (!treesMatch(path.join(pluginRoot, source), path.join(codexRoot, target))) {
      errors.push(`Codex package copy is stale: ${target}`);
    }
  }
  if (existsSync(path.join(codexRoot, "hooks/hooks.codex.json"))) {
    errors.push("Codex package must expose its client config only as hooks/hooks.json");
  }
  return { errors };
}

function treesMatch(source, target) {
  if (!existsSync(source) || !existsSync(target)) return false;
  const sourceStat = statSync(source);
  const targetStat = statSync(target);
  if (sourceStat.isFile() !== targetStat.isFile() || sourceStat.isDirectory() !== targetStat.isDirectory()) return false;
  if (sourceStat.isFile()) return readFileSync(source).equals(readFileSync(target));
  const sourceEntries = readdirSync(source).sort();
  const targetEntries = readdirSync(target).sort();
  if (sourceEntries.length !== targetEntries.length) return false;
  return sourceEntries.every((entry, index) => (
    entry === targetEntries[index] && treesMatch(path.join(source, entry), path.join(target, entry))
  ));
}
