import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyOpenCodeDecision,
  normalizeOpenCodeEvent,
  registerOpenCodeConfig,
} from "../adapters/opencode.mjs";
import { BOOTSTRAP_MARKER } from "../runtime/bootstrap.mjs";
import { handleRuntimeEvent } from "../runtime/index.mjs";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function UltraInstinctPlugin(ctx) {
  const profile = ctx.ultra?.profile ?? process.env.ULTRA_INSTINCT_PROFILE ?? "guided";
  const stateDir = ctx.ultra?.stateDir ?? process.env.ULTRA_INSTINCT_STATE_DIR;
  const clock = ctx.ultra?.clock;
  let lastSessionID = null;
  let lastToolMutationAt = 0;

  const run = async (native, sessionID = null) => {
    const event = normalizeOpenCodeEvent(native, {
      directory: ctx.directory,
      profile,
      sessionID,
      clock,
    });
    if (event.sessionId) lastSessionID = event.sessionId;
    return handleRuntimeEvent(event, { pluginRoot, stateDir, clock });
  };

  const apply = async (decision, sessionID) => applyOpenCodeDecision(decision, {
    client: ctx.client,
    directory: ctx.directory,
    sessionID,
  });

  return {
    config: async (config) => registerOpenCodeConfig(config, pluginRoot),

    "experimental.chat.messages.transform": async (_input, output) => {
      const firstUser = output.messages.find((message) => message.info?.role === "user");
      if (!firstUser) return;
      const sessionID = firstUser.info?.sessionID;
      if (sessionID) lastSessionID = sessionID;
      const hasMarker = firstUser.parts.some(
        (part) => part.type === "text" && typeof part.text === "string" && part.text.includes(BOOTSTRAP_MARKER),
      );
      if (hasMarker) return;

      const reference = firstUser.parts.find((part) => part.type === "text");
      if (!reference) return;
      const decision = await run({ type: "session.start", sessionID }, sessionID);
      if (decision.context) firstUser.parts.unshift({ ...reference, text: decision.context });
      if (decision.warning) await apply({ ...decision, context: null }, sessionID);
    },

    "experimental.session.compacting": async (input, output) => {
      const decision = await run({ type: "context.compacting", sessionID: input.sessionID }, input.sessionID);
      if (decision.context && !output.context.some((entry) => entry.includes(BOOTSTRAP_MARKER))) {
        output.context.push(decision.context);
      }
      if (decision.warning) await apply({ ...decision, context: null }, input.sessionID);
    },

    "tool.execute.before": async (input, output) => {
      const decision = await run({ type: "tool.execute.before", input, output }, input.sessionID);
      await apply(decision, input.sessionID);
    },

    "tool.execute.after": async (input, output) => {
      const decision = await run({ type: "tool.execute.after", input, output }, input.sessionID);
      if (["write", "edit", "patch", "apply_patch", "multiedit", "notebookedit"].includes(String(input.tool).toLowerCase())) {
        lastToolMutationAt = clock?.() ?? Date.now();
      }
      await apply(decision, input.sessionID);
    },

    event: async ({ event }) => {
      if (!["file.edited", "session.idle", "session.deleted"].includes(event.type)) return;
      if (event.type === "file.edited" && (clock?.() ?? Date.now()) - lastToolMutationAt < 1000) return;
      const sessionID = event.properties?.sessionID || event.properties?.info?.id || lastSessionID;
      if (!sessionID) return;
      const decision = await run(event, sessionID);
      await apply(decision, sessionID);
      if (event.type === "session.deleted" && sessionID === lastSessionID) lastSessionID = null;
    },
  };
}

export default UltraInstinctPlugin;
