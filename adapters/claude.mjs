import { RUNTIME_SCHEMA } from "../runtime/contracts.mjs";

const STAGES = Object.freeze({
  SessionStart: "session.start",
  PreToolUse: "tool.before",
  PostToolUse: "tool.after",
  PostToolUseFailure: "tool.after",
  Stop: "session.completing",
  SessionEnd: "session.end",
});

export function normalizeClaudeEvent(input, env = {}) {
  const eventName = input?.hook_event_name;
  const stage = eventName === "SessionStart" && ["clear", "compact"].includes(input.source)
    ? "context.compacting"
    : STAGES[eventName];
  if (!stage) throw new TypeError("unsupported Claude hook event");

  const event = {
    schema: RUNTIME_SCHEMA,
    client: "claude",
    stage,
    sessionId: typeof input.session_id === "string" ? input.session_id : null,
    workspace: typeof input.cwd === "string" ? input.cwd : null,
    profile: env.ULTRA_INSTINCT_PROFILE || "guided",
    at: Date.now(),
  };

  if (["PreToolUse", "PostToolUse", "PostToolUseFailure"].includes(eventName)) {
    event.tool = {
      name: typeof input.tool_name === "string" ? input.tool_name : "unknown",
      input: input.tool_input,
      response: input.tool_response,
      success: eventName === "PostToolUse",
    };
  }
  if (eventName === "Stop") event.stopHookActive = input.stop_hook_active === true;
  return event;
}

export function encodeClaudeDecision(eventName, decision) {
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
