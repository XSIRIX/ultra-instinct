import { fileURLToPath } from "node:url";

import { normalizeClaudeEvent, encodeClaudeDecision } from "../adapters/claude.mjs";
import { normalizeCodexEvent, encodeCodexDecision } from "../adapters/codex.mjs";
import { handleRuntimeEvent } from "../runtime/index.mjs";

function readStdin() {
  return new Promise((resolve, reject) => {
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { input += chunk; });
    process.stdin.on("end", () => resolve(input));
    process.stdin.on("error", reject);
  });
}

export async function dispatchHook({ stdin, env = process.env }) {
  try {
    const input = JSON.parse(stdin);
    const isCodex = Boolean(env.PLUGIN_ROOT && typeof input.model === "string");
    const event = isCodex ? normalizeCodexEvent(input, env) : normalizeClaudeEvent(input, env);
    const pluginRoot = env.CLAUDE_PLUGIN_ROOT || env.PLUGIN_ROOT;
    if (!pluginRoot) throw new Error("plugin root unavailable");
    const decision = await handleRuntimeEvent(event, {
      pluginRoot,
      stateDir: env.ULTRA_INSTINCT_STATE_DIR,
    });
    const output = isCodex
      ? encodeCodexDecision(input.hook_event_name, decision)
      : encodeClaudeDecision(input.hook_event_name, decision);
    return {
      stdout: output ? `${JSON.stringify(output)}\n` : "",
      stderr: decision.warning ? `${decision.warning}\n` : "",
      exitCode: 0,
    };
  } catch {
    return {
      stdout: "",
      stderr: "Ultra Instinct hook adapter failed open.\n",
      exitCode: 0,
    };
  }
}

async function main() {
  const result = await dispatchHook({ stdin: await readStdin(), env: process.env });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
