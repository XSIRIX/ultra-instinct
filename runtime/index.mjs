import { loadBootstrap } from "./bootstrap.mjs";
import { assertRuntimeEvent, createInitialState, STAGES } from "./contracts.mjs";
import { classifyTool } from "./classify.mjs";
import { reduceRuntimeEvent } from "./policy.mjs";
import { resolveProfile } from "./profile.mjs";
import { createStateStore } from "./state.mjs";

const memoryState = new Map();

function failOpen(client, warning = null) {
  return {
    allow: true,
    context: null,
    warning: warning ?? `Ultra Instinct runtime failed open (${client || "unknown client"}).`,
    continueSession: false,
  };
}

function stateKey(event) {
  return `${event.client}|${event.sessionId}|${event.workspace}`;
}

export async function handleRuntimeEvent(event, options = {}) {
  const { profile, warning: profileWarning } = resolveProfile(event?.profile);
  const normalized = { ...event, profile };
  try {
    assertRuntimeEvent(normalized);
    if (profile === "lite") {
      return { allow: true, context: null, warning: profileWarning, continueSession: false };
    }

    const bootstrap = options.bootstrap ?? (await loadBootstrap(options.pluginRoot));
    const persistent = Boolean(normalized.sessionId && normalized.workspace);
    const store = options.stateStore ?? createStateStore({
      stateDir: options.stateDir,
      clock: options.clock,
      warningSink: options.warningSink,
    });
    if (persistent) store.cleanup();
    const key = persistent ? stateKey(normalized) : `${normalized.client}|memory`;
    const state = persistent ? store.read(key) : (memoryState.get(key) ?? createInitialState());

    if (normalized.tool && typeof normalized.tool.mutation !== "boolean") {
      normalized.tool = { ...normalized.tool, ...classifyTool(normalized.tool) };
    }

    const result = reduceRuntimeEvent(state, normalized, bootstrap);
    if (normalized.stage === STAGES.SESSION_END) {
      if (persistent) store.delete(key);
      else memoryState.delete(key);
    } else if (persistent) {
      store.write(key, result.nextState);
    } else {
      memoryState.set(key, result.nextState);
    }

    return profileWarning && !result.decision.warning
      ? { ...result.decision, warning: profileWarning }
      : result.decision;
  } catch {
    return failOpen(event?.client);
  }
}
