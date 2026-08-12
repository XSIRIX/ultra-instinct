import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const SEMVER = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export function validateCodexPackage(pluginRoot) {
  const errors = [];
  let root;
  let manifest;
  let marketplace;
  try {
    root = JSON.parse(readFileSync(path.join(pluginRoot, "plugin.json"), "utf8"));
    manifest = JSON.parse(readFileSync(path.join(pluginRoot, ".codex-plugin/plugin.json"), "utf8"));
    marketplace = JSON.parse(readFileSync(path.join(pluginRoot, ".agents/plugins/marketplace.json"), "utf8"));
  } catch (error) {
    return { errors: [`Codex package: ${error.message}`] };
  }

  for (const field of ["name", "version", "repository", "license"]) {
    if (manifest[field] !== root[field]) errors.push(`Codex manifest ${field} must match plugin.json`);
  }
  if (manifest.author?.name !== root.author?.name) errors.push("Codex manifest author must match plugin.json");
  if (!SEMVER.test(manifest.version ?? "")) errors.push("Codex manifest version must be strict semver");
  if (manifest.skills !== "./skills/") errors.push("Codex skills path must be ./skills/");
  if (Object.hasOwn(manifest, "hooks")) errors.push("Codex manifest must use default hook discovery");
  if (!existsSync(path.join(pluginRoot, "hooks/hooks.json"))) errors.push("Codex default hooks/hooks.json is missing");

  const requiredInterface = ["displayName", "shortDescription", "longDescription", "developerName", "category", "capabilities", "defaultPrompt"];
  for (const field of requiredInterface) {
    if (manifest.interface?.[field] == null) errors.push(`Codex interface missing ${field}`);
  }
  const entry = marketplace.plugins?.find((plugin) => plugin.name === root.name);
  if (!entry) errors.push("Codex marketplace is missing ultra-instinct");
  if (entry?.version !== root.version) errors.push("Codex marketplace version must match plugin.json");
  if (entry?.source?.source !== "local" || entry?.source?.path !== "./") {
    errors.push("Codex marketplace must point to the repository plugin root");
  }
  if (!entry?.policy?.installation || !entry?.policy?.authentication || !entry?.category) {
    errors.push("Codex marketplace entry is missing policy or category");
  }
  return { errors };
}
