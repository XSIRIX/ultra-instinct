export const EVAL_CLIENTS = Object.freeze(["claude", "codex", "opencode"]);
export const EVAL_PROFILES = Object.freeze(["lite", "guided", "strict"]);
export const EVAL_FIXTURES = Object.freeze(["node-package", "failing-test", "typo"]);
export const TRACE_EVENT_TYPES = Object.freeze([
  "client",
  "skill",
  "tool",
  "hook",
  "continuation",
  "compaction",
  "result",
]);

const SCENARIO_KEYS = Object.freeze([
  "id",
  "prompt",
  "fixture",
  "expectedSkill",
  "forbiddenSkills",
  "mutationExpected",
  "verificationExpected",
  "profiles",
]);

/**
 * @typedef {object} EvalScenario
 * @property {string} id
 * @property {string} prompt
 * @property {"node-package"|"failing-test"|"typo"} fixture
 * @property {string|null} expectedSkill
 * @property {string[]} forbiddenSkills
 * @property {boolean} mutationExpected
 * @property {boolean} verificationExpected
 * @property {(typeof EVAL_PROFILES)[number][]} profiles
 */

/**
 * A sanitized, ordered client fact. Event-specific fields are defined by `type`.
 * @typedef {object} EvalTraceEvent
 * @property {(typeof TRACE_EVENT_TYPES)[number]} type
 * @property {number} sequence
 */

export function validateScenario(scenario) {
  const errors = [];
  if (!scenario || typeof scenario !== "object" || Array.isArray(scenario)) {
    return ["scenario must be an object"];
  }
  const unknown = Object.keys(scenario).filter((key) => !SCENARIO_KEYS.includes(key));
  if (unknown.length) errors.push(`unknown scenario fields: ${unknown.join(", ")}`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(scenario.id ?? "")) errors.push("id must be kebab-case");
  if (typeof scenario.prompt !== "string" || !scenario.prompt.trim()) errors.push("prompt is required");
  if (!EVAL_FIXTURES.includes(scenario.fixture)) errors.push("fixture is unsupported");
  if (scenario.expectedSkill !== null && typeof scenario.expectedSkill !== "string") {
    errors.push("expectedSkill must be a string or null");
  }
  if (!Array.isArray(scenario.forbiddenSkills) || scenario.forbiddenSkills.some((value) => typeof value !== "string")) {
    errors.push("forbiddenSkills must be a string array");
  }
  if (typeof scenario.mutationExpected !== "boolean") errors.push("mutationExpected must be boolean");
  if (typeof scenario.verificationExpected !== "boolean") errors.push("verificationExpected must be boolean");
  if (!Array.isArray(scenario.profiles) || !scenario.profiles.length ||
      scenario.profiles.some((profile) => !EVAL_PROFILES.includes(profile))) {
    errors.push("profiles must contain supported profiles");
  }
  return errors;
}

export function validateTraceEvent(event) {
  const errors = [];
  if (!event || typeof event !== "object" || Array.isArray(event)) return ["trace event must be an object"];
  if (!TRACE_EVENT_TYPES.includes(event.type)) errors.push("unsupported trace event type");
  if (!Number.isInteger(event.sequence) || event.sequence < 0) errors.push("sequence must be a non-negative integer");
  return errors;
}

export function assertScenarioSet(scenarios) {
  if (!Array.isArray(scenarios) || !scenarios.length) throw new Error("Scenario set is empty.");
  const ids = new Set();
  for (const scenario of scenarios) {
    const errors = validateScenario(scenario);
    if (errors.length) throw new Error(`${scenario?.id ?? "unknown"}: ${errors.join("; ")}`);
    if (ids.has(scenario.id)) throw new Error(`Duplicate scenario id: ${scenario.id}`);
    ids.add(scenario.id);
  }
  return scenarios;
}
