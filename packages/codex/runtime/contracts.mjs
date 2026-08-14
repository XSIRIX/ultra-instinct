export const RUNTIME_SCHEMA = "ultra.runtime-event.v1";

export const CLIENTS = Object.freeze({
  CLAUDE: "claude",
  CODEX: "codex",
  OPENCODE: "opencode",
});

export const STAGES = Object.freeze({
  SESSION_START: "session.start",
  CONTEXT_COMPACTING: "context.compacting",
  TOOL_BEFORE: "tool.before",
  TOOL_AFTER: "tool.after",
  SESSION_COMPLETING: "session.completing",
  SESSION_END: "session.end",
});

export const PROFILES = Object.freeze(["lite", "guided", "strict"]);

export function createInitialState() {
  return {
    schemaVersion: 1,
    mutationEpoch: 0,
    lastMutationAt: null,
    lastVerificationAt: null,
    verificationKind: null,
    firstMutationReminderSent: false,
    gateIssuedForEpoch: null,
  };
}

export function isRuntimeState(value) {
  const allowedKeys = new Set(Object.keys(createInitialState()));
  return Boolean(
    value &&
      typeof value === "object" &&
      Object.keys(value).length === allowedKeys.size &&
      Object.keys(value).every((key) => allowedKeys.has(key)) &&
      value.schemaVersion === 1 &&
      Number.isInteger(value.mutationEpoch) &&
      value.mutationEpoch >= 0 &&
      (value.lastMutationAt === null || typeof value.lastMutationAt === "number") &&
      (value.lastVerificationAt === null || typeof value.lastVerificationAt === "number") &&
      (value.verificationKind === null || typeof value.verificationKind === "string") &&
      typeof value.firstMutationReminderSent === "boolean" &&
      (value.gateIssuedForEpoch === null || Number.isInteger(value.gateIssuedForEpoch)),
  );
}

export function assertRuntimeEvent(event) {
  if (!event || typeof event !== "object") throw new TypeError("runtime event must be an object");
  if (event.schema !== RUNTIME_SCHEMA) throw new TypeError("unsupported runtime event schema");
  if (!Object.values(CLIENTS).includes(event.client)) throw new TypeError("unsupported runtime client");
  if (!Object.values(STAGES).includes(event.stage)) throw new TypeError("unsupported runtime stage");
  if (!PROFILES.includes(event.profile)) throw new TypeError("unsupported runtime profile");
  if (event.sessionId != null && typeof event.sessionId !== "string") throw new TypeError("invalid session identifier");
  if (event.workspace != null && typeof event.workspace !== "string") throw new TypeError("invalid workspace identity");
  return event;
}
