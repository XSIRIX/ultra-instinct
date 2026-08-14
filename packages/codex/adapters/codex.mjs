import { RUNTIME_SCHEMA } from "../runtime/contracts.mjs";

const STAGES = Object.freeze({
  SessionStart: "session.start",
  PreToolUse: "tool.before",
  PostToolUse: "tool.after",
  Stop: "session.completing",
  SessionEnd: "session.end",
});

function shellExitCode(response) {
  for (const value of [response?.exit_code, response?.exitCode]) {
    if (Number.isInteger(value)) return value;
  }
  return null;
}

export function normalizeCodexEvent(input, env = {}) {
  const eventName = input?.hook_event_name;
  const stage = eventName === "SessionStart" && ["clear", "compact"].includes(input.source)
    ? "context.compacting"
    : STAGES[eventName];
  if (!stage) throw new TypeError("unsupported Codex hook event");

  const event = {
    schema: RUNTIME_SCHEMA,
    client: "codex",
    stage,
    sessionId: typeof input.session_id === "string" ? input.session_id : null,
    workspace: typeof input.cwd === "string" ? input.cwd : null,
    profile: env.ULTRA_INSTINCT_PROFILE || "guided",
    at: Date.now(),
  };
  if (["PreToolUse", "PostToolUse"].includes(eventName)) {
    const toolName = typeof input.tool_name === "string" ? input.tool_name : "unknown";
    const isShell = ["bash", "powershell", "shell", "sh"].includes(toolName.toLowerCase());
    event.tool = {
      name: toolName,
      input: isShell ? { command: input.tool_input?.command } : null,
      success: eventName === "PostToolUse"
        && (!isShell || shellExitCode(input.tool_response) === 0),
    };
  }
  if (eventName === "Stop") event.stopHookActive = input.stop_hook_active === true;
  return event;
}

export function encodeCodexDecision(eventName, decision) {
  if (eventName === "Stop" && decision.continueSession && !decision.allow) {
    return { decision: "block", reason: decision.context || "Continue with fresh verification." };
  }
  if (decision.context) {
    if (eventName === "Stop") return { systemMessage: decision.context };
    return {
      hookSpecificOutput: {
        hookEventName: eventName,
        additionalContext: decision.context,
      },
    };
  }
  if (decision.warning) return { systemMessage: decision.warning };
  return null;
}
