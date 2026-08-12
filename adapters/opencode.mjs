import path from "node:path";

import { RUNTIME_SCHEMA } from "../runtime/contracts.mjs";
import { SURFACES } from "../runtime/surfaces.mjs";

function sessionIdFrom(native, context) {
  return (
    native.input?.sessionID ||
    native.properties?.sessionID ||
    native.properties?.info?.id ||
    native.sessionID ||
    context.sessionID ||
    null
  );
}

function shellInput(toolName, args) {
  return ["bash", "shell", "sh", "powershell"].includes(String(toolName).toLowerCase())
    ? { command: args?.command }
    : null;
}

export function registerOpenCodeConfig(config, pluginRoot) {
  const skillsPath = path.resolve(pluginRoot, "skills");
  config.skills ??= {};
  config.skills.paths ??= [];
  if (!config.skills.paths.includes(skillsPath)) config.skills.paths.push(skillsPath);

  config.command ??= {};
  for (const command of SURFACES.commands) {
    config.command[command.name] ??= {
      template: `Load and follow the \`${command.skill}\` skill for this request.`,
      description: command.description,
    };
  }

  config.agent ??= {};
  for (const agent of SURFACES.agents) {
    config.agent[agent.name] ??= {
      description: agent.description,
      mode: "subagent",
      prompt: `Load and follow the \`${agent.skill}\` skill. Return evidence, not duplicated methodology.`,
      permission: { edit: "deny" },
    };
  }
}

export function normalizeOpenCodeEvent(native, context = {}) {
  const type = native?.type;
  let stage;
  let tool;
  if (type === "session.start") stage = "session.start";
  else if (type === "context.compacting") stage = "context.compacting";
  else if (type === "tool.execute.before") {
    stage = "tool.before";
    tool = {
      name: native.input?.tool ?? "unknown",
      input: shellInput(native.input?.tool, native.output?.args),
      success: false,
    };
  } else if (type === "tool.execute.after") {
    stage = "tool.after";
    tool = {
      name: native.input?.tool ?? "unknown",
      input: shellInput(native.input?.tool, native.input?.args),
      success: true,
    };
  } else if (type === "file.edited") {
    stage = "tool.after";
    tool = { name: "file.edited", input: null, success: true };
  } else if (type === "session.idle") stage = "session.completing";
  else if (type === "session.deleted") stage = "session.end";
  else throw new TypeError("unsupported OpenCode event");

  return {
    schema: RUNTIME_SCHEMA,
    client: "opencode",
    stage,
    sessionId: sessionIdFrom(native, context),
    workspace: context.directory ?? null,
    profile: context.profile || "guided",
    at: context.clock?.() ?? Date.now(),
    ...(tool ? { tool } : {}),
  };
}

async function logWarning(client, directory, message) {
  if (!client?.app?.log) return;
  await client.app.log({
    directory,
    service: "ultra-instinct",
    level: "warn",
    message,
  });
}

export async function applyOpenCodeDecision(decision, context) {
  try {
    if (decision.continueSession && !decision.allow) {
      const result = await context.client.session.prompt({
        sessionID: context.sessionID,
        directory: context.directory,
        parts: [{ type: "text", text: decision.context || "Continue with fresh verification." }],
      });
      if (result?.error) throw new Error("prompt rejected");
      return;
    }
    const message = decision.warning || decision.context;
    if (message) await logWarning(context.client, context.directory, message);
  } catch {
    try {
      await logWarning(context.client, context.directory, "Ultra Instinct OpenCode adapter failed open.");
    } catch {}
  }
}
