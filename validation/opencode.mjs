import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function validateOpenCodePackage(pluginRoot) {
  const errors = [];
  let packageJson;
  try {
    packageJson = JSON.parse(readFileSync(path.join(pluginRoot, "package.json"), "utf8"));
  } catch (error) {
    return { errors: [`OpenCode package: ${error.message}`] };
  }
  if (packageJson.main !== ".opencode/index.mjs") errors.push("OpenCode package main must be .opencode/index.mjs");
  if (packageJson.exports?.["."] !== "./.opencode/index.mjs") errors.push("OpenCode package export must resolve the plugin entry");
  if (Object.keys(packageJson.dependencies ?? {}).length !== 0) errors.push("OpenCode runtime dependencies must stay empty");
  const entryPath = path.join(pluginRoot, ".opencode/index.mjs");
  if (!existsSync(entryPath)) errors.push("OpenCode entrypoint is missing");
  else {
    try {
      const entry = await import(pathToFileURL(entryPath));
      if (typeof entry.UltraInstinctPlugin !== "function" || entry.default !== entry.UltraInstinctPlugin) {
        errors.push("OpenCode entrypoint must export UltraInstinctPlugin as named and default");
      }
    } catch (error) {
      errors.push(`OpenCode entrypoint could not load: ${error.message}`);
    }
  }
  return { errors };
}
