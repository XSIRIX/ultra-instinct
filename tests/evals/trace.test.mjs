import assert from "node:assert/strict";
import test from "node:test";

import { normalizeNativeEvent, sanitizeTrace } from "../../evals/trace.mjs";

test("bootstrap and user text cannot masquerade as an announced skill", () => {
  const events = [];
  normalizeNativeEvent({
    type: "system",
    hook: { output: "Use the brainstorm, tdd, and systematic-debugging skills." },
  }, { client: "claude", events });
  normalizeNativeEvent({
    type: "user",
    message: { content: [{ type: "text", text: "Please use tdd." }] },
  }, { client: "claude", events });

  assert.equal(events.some((event) => event.type === "skill"), false);
});

test("assistant announcements and explicit Skill calls are observed", () => {
  const announced = [];
  normalizeNativeEvent({
    type: "assistant",
    message: { content: [{ type: "text", text: "I am using the tdd skill first." }] },
  }, { client: "claude", events: announced });
  assert.equal(announced.find((event) => event.type === "skill")?.skill, "tdd");
  assert.equal(announced.find((event) => event.type === "skill")?.action, "announced");

  const loaded = [];
  normalizeNativeEvent({
    type: "assistant",
    message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "systematic-debugging" } }] },
  }, { client: "claude", events: loaded });
  assert.equal(loaded.find((event) => event.type === "skill")?.skill, "systematic-debugging");
  assert.equal(loaded.find((event) => event.type === "skill")?.action, "loaded");

  const grilling = [];
  normalizeNativeEvent({
    type: "assistant",
    message: { content: [{ type: "text", text: "I am using the grilling skill first." }] },
  }, { client: "codex", events: grilling });
  assert.equal(grilling.find((event) => event.type === "skill")?.skill, "grilling");
});

test("verification counts only after native completion and sanitizer drops private fields", () => {
  const events = [];
  normalizeNativeEvent({
    method: "item/started",
    params: { item: { id: "secret-id", type: "commandExecution", command: "npm test", status: "inProgress" } },
  }, { client: "codex", events });
  assert.equal(events.find((event) => event.type === "tool")?.success, false);

  normalizeNativeEvent({
    method: "item/completed",
    params: { item: { id: "secret-id", type: "commandExecution", command: "npm test", status: "completed", exitCode: 0 } },
  }, { client: "codex", events });
  assert.equal(events.filter((event) => event.type === "tool").length, 1);
  assert.equal(events.find((event) => event.type === "tool")?.success, true);

  const sanitized = sanitizeTrace(events.map((event) => ({ ...event, prompt: "private", output: "private" })));
  assert.doesNotMatch(JSON.stringify(sanitized), /private|secret-id/);
});
