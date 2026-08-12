import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { SURFACES } from "../runtime/surfaces.mjs";

export function validateClaudePackage(pluginRoot) {
  const errors = [];
  let root;
  let manifest;
  let marketplace;
  let hooks;
  try {
    root = JSON.parse(readFileSync(path.join(pluginRoot, "plugin.json"), "utf8"));
    manifest = JSON.parse(readFileSync(path.join(pluginRoot, ".claude-plugin/plugin.json"), "utf8"));
    marketplace = JSON.parse(readFileSync(path.join(pluginRoot, ".claude-plugin/marketplace.json"), "utf8"));
    hooks = JSON.parse(readFileSync(path.join(pluginRoot, "hooks/hooks.json"), "utf8"));
  } catch (error) {
    return { errors: [`Claude package: ${error.message}`] };
  }

  for (const field of ["name", "version", "repository", "license"]) {
    if (manifest[field] !== root[field]) errors.push(`Claude manifest ${field} must match plugin.json`);
  }
  const entry = marketplace.plugins?.find((plugin) => plugin.name === root.name);
  if (!entry || entry.source !== "./") errors.push("Claude marketplace must contain the local plugin");

  for (const event of ["SessionStart", "PreToolUse", "PostToolUse", "Stop", "SessionEnd"]) {
    if (!Array.isArray(hooks.hooks?.[event])) errors.push(`Claude hooks missing ${event}`);
  }
  for (const command of SURFACES.commands) {
    if (!existsSync(path.join(pluginRoot, "commands", `${command.name}.md`))) errors.push(`missing command ${command.name}`);
  }
  for (const agent of SURFACES.agents) {
    if (!existsSync(path.join(pluginRoot, "agents", `${agent.name}.md`))) errors.push(`missing agent ${agent.name}`);
  }
  return { errors };
}
