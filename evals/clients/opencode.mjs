import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { commandVersion, runJsonCommand } from "./_process.mjs";
import { sanitizeTrace } from "../trace.mjs";

export async function runScenario({ scenario, profile, pluginRoot, workspace, model }) {
  const plugins = path.join(workspace, ".opencode/plugins");
  await mkdir(plugins, { recursive: true });
  const entry = pathToFileURL(path.join(pluginRoot, ".opencode/index.mjs")).href;
  await writeFile(
    path.join(plugins, "ultra-instinct.mjs"),
    `export { default } from ${JSON.stringify(entry)};\n`,
    { mode: 0o600 },
  );
  await writeFile(path.join(workspace, "opencode.json"), `${JSON.stringify({
    $schema: "https://opencode.ai/config.json",
    permission: {
      "*": "deny",
      read: "allow",
      glob: "allow",
      grep: "allow",
      list: "allow",
      edit: "allow",
      skill: "allow",
      lsp: "allow",
      bash: {
        "*": "deny",
        "npm test": "allow",
        "npm test *": "allow",
        "node --test": "allow",
        "node --test *": "allow"
      },
      external_directory: "deny",
      task: "deny",
      webfetch: "deny",
      websearch: "deny"
    }
  }, null, 2)}\n`, { mode: 0o600 });

  const args = ["run", "--format", "json", "--dir", workspace];
  if (model) args.push("--model", model);
  args.push(scenario.prompt);
  let sessionID = null;
  const trace = await runJsonCommand("opencode", args, {
    client: "opencode",
    cwd: workspace,
    env: {
      ULTRA_INSTINCT_PROFILE: profile,
      ULTRA_INSTINCT_STATE_DIR: path.join(workspace, ".ultra-instinct", "runtime"),
    },
    onValue(value) {
      sessionID ??= value.sessionID ?? value.session_id ?? value.part?.sessionID ?? value.properties?.sessionID ?? null;
    },
  });

  if (scenario.id === "compaction-state" && sessionID) {
    const compactTrace = await runJsonCommand("opencode", [
      "run", "--format", "json", "--dir", workspace, "--session", sessionID, "/compact",
    ], {
      client: "opencode",
      cwd: workspace,
      env: {
        ULTRA_INSTINCT_PROFILE: profile,
        ULTRA_INSTINCT_STATE_DIR: path.join(workspace, ".ultra-instinct", "runtime"),
      },
    });
    trace.push(...compactTrace.filter((event) => event.type !== "client"));
  }

  const normalized = sanitizeTrace(trace);
  const metadata = normalized.find((event) => event.type === "client");
  Object.assign(metadata, {
    version: commandVersion("opencode"),
    os: `${os.platform()}-${os.arch()}`,
    profile,
  });
  return normalized;
}
