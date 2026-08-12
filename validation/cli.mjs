import path from "node:path";
import { fileURLToPath } from "node:url";

import { validatePortablePlugin } from "./portable.mjs";
import { validateSkillLayout } from "./skills.mjs";
import { validateClaudePackage } from "./claude.mjs";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function runValidation(target = "all", root = pluginRoot) {
  const errors = [];
  if (target === "all" || target === "portable") {
    errors.push(...(await validatePortablePlugin(root)).errors);
    errors.push(...validateSkillLayout(root).errors);
  }
  if (target === "all" || target === "claude") errors.push(...validateClaudePackage(root).errors);
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = await runValidation(process.argv[2] ?? "all");
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("validation passed");
  }
}
