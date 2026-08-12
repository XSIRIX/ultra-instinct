import os from "node:os";
import path from "node:path";

import { commandVersion, runJsonCommand } from "./_process.mjs";

export async function runScenario({ scenario, profile, pluginRoot, workspace, model }) {
  const args = [
    "-p",
    scenario.prompt,
    "--plugin-dir",
    pluginRoot,
    "--output-format",
    "stream-json",
    "--include-hook-events",
    "--verbose",
    "--no-session-persistence",
    "--permission-mode",
    "acceptEdits",
    "--allowedTools",
    "Read,Glob,Grep,Edit,Write,Skill,Bash(npm test:*),Bash(node --test:*)",
    "--disallowedTools",
    "WebSearch,WebFetch",
    "--max-turns",
    "24",
    "--max-budget-usd",
    "2",
  ];
  if (model) args.push("--model", model);
  const trace = await runJsonCommand("claude", args, {
    client: "claude",
    cwd: workspace,
    env: {
      ULTRA_INSTINCT_PROFILE: profile,
      ULTRA_INSTINCT_STATE_DIR: path.join(workspace, ".ultra-eval-state"),
    },
  });
  const metadata = trace.find((event) => event.type === "client");
  Object.assign(metadata, {
    version: commandVersion("claude"),
    os: `${os.platform()}-${os.arch()}`,
    profile,
  });
  return trace;
}
