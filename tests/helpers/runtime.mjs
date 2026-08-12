import path from "node:path";

export const pluginRoot = path.resolve(import.meta.dirname, "../..");

export function runtimeEvent(overrides = {}) {
  return {
    schema: "ultra.runtime-event.v1",
    client: "claude",
    stage: "session.start",
    sessionId: "session-1",
    workspace: "/tmp/project",
    profile: "guided",
    at: 1_000,
    ...overrides,
  };
}

export const bootstrap = {
  marker: "<!-- ultra-instinct:bootstrap:v2 -->",
  context: "<!-- ultra-instinct:bootstrap:v2 -->\nUse the matching skill.",
};
