import assert from "node:assert/strict";
import test from "node:test";

import { createInitialState } from "../../runtime/contracts.mjs";
import { reduceRuntimeEvent } from "../../runtime/policy.mjs";
import { bootstrap, runtimeEvent } from "../helpers/runtime.mjs";

test("guided session start injects the canonical bootstrap", () => {
  const { decision } = reduceRuntimeEvent(createInitialState(), runtimeEvent(), bootstrap);
  assert.equal(decision.allow, true);
  assert.equal(decision.context, bootstrap.context);
});

test("lite profile performs no guidance or state transition", () => {
  const state = createInitialState();
  const result = reduceRuntimeEvent(state, runtimeEvent({ profile: "lite", stage: "tool.after", tool: { mutation: true } }), bootstrap);
  assert.deepEqual(result.nextState, state);
  assert.equal(result.decision.context, null);
});

test("repeated mutations coalesce into one dirty cycle and remind once", () => {
  const first = reduceRuntimeEvent(
    createInitialState(),
    runtimeEvent({ stage: "tool.after", tool: { mutation: true, verificationKind: null, success: true } }),
    bootstrap,
  );
  const second = reduceRuntimeEvent(
    first.nextState,
    runtimeEvent({ stage: "tool.after", at: 2_000, tool: { mutation: true, verificationKind: null, success: true } }),
    bootstrap,
  );
  assert.equal(first.nextState.mutationEpoch, 1);
  assert.match(first.decision.context, /TDD/i);
  assert.equal(second.nextState.mutationEpoch, 1);
  assert.equal(second.nextState.lastMutationAt, first.nextState.lastMutationAt);
  assert.equal(second.decision.context, null);
});

test("fresh verification closes a dirty cycle so the next mutation opens another", () => {
  const first = reduceRuntimeEvent(
    createInitialState(),
    runtimeEvent({ stage: "tool.after", tool: { mutation: true, verificationKind: null, success: true } }),
    bootstrap,
  );
  const verified = reduceRuntimeEvent(
    first.nextState,
    runtimeEvent({ stage: "tool.after", at: 2_000, tool: { mutation: false, verificationKind: "test", success: true } }),
    bootstrap,
  );
  const second = reduceRuntimeEvent(
    verified.nextState,
    runtimeEvent({ stage: "tool.after", at: 3_000, tool: { mutation: true, verificationKind: null, success: true } }),
    bootstrap,
  );

  assert.equal(second.nextState.mutationEpoch, 2);
  assert.equal(second.nextState.lastMutationAt, 3_000);
  assert.equal(second.nextState.lastVerificationAt, null);
});

test("fresh verification records only family and time", () => {
  const state = { ...createInitialState(), mutationEpoch: 1, lastMutationAt: 1_000 };
  const result = reduceRuntimeEvent(
    state,
    runtimeEvent({ stage: "tool.after", at: 2_000, tool: { mutation: false, verificationKind: "test", success: true } }),
    bootstrap,
  );
  assert.equal(result.nextState.lastVerificationAt, 2_000);
  assert.equal(result.nextState.verificationKind, "test");
});

test("guided completion warns but never blocks", () => {
  const state = { ...createInitialState(), mutationEpoch: 1, lastMutationAt: 1_000 };
  const { decision } = reduceRuntimeEvent(state, runtimeEvent({ stage: "session.completing" }), bootstrap);
  assert.equal(decision.allow, true);
  assert.equal(decision.continueSession, false);
  assert.match(decision.context, /verification/i);
});

test("strict completion intervenes once per unverified mutation epoch", () => {
  const state = { ...createInitialState(), mutationEpoch: 1, lastMutationAt: 1_000 };
  const first = reduceRuntimeEvent(state, runtimeEvent({ profile: "strict", stage: "session.completing" }), bootstrap);
  const second = reduceRuntimeEvent(first.nextState, runtimeEvent({ profile: "strict", stage: "session.completing" }), bootstrap);
  assert.equal(first.decision.allow, false);
  assert.equal(first.decision.continueSession, true);
  assert.equal(first.nextState.gateIssuedForEpoch, 1);
  assert.equal(second.decision.allow, true);
  assert.equal(second.decision.continueSession, false);
});

test("later edits do not rearm strict completion within the same dirty cycle", () => {
  const dirty = { ...createInitialState(), mutationEpoch: 1, lastMutationAt: 1_000 };
  const gated = reduceRuntimeEvent(
    dirty,
    runtimeEvent({ profile: "strict", stage: "session.completing" }),
    bootstrap,
  );
  const edited = reduceRuntimeEvent(
    gated.nextState,
    runtimeEvent({ profile: "strict", stage: "tool.after", at: 2_000, tool: { mutation: true, success: true } }),
    bootstrap,
  );
  const completion = reduceRuntimeEvent(
    edited.nextState,
    runtimeEvent({ profile: "strict", stage: "session.completing" }),
    bootstrap,
  );

  assert.equal(edited.nextState.mutationEpoch, 1);
  assert.equal(edited.nextState.gateIssuedForEpoch, 1);
  assert.equal(completion.decision.allow, true);
  assert.equal(completion.decision.continueSession, false);
});

test("strict mode respects recursion and explicit user workflow overrides", () => {
  const state = { ...createInitialState(), mutationEpoch: 1, lastMutationAt: 1_000 };
  for (const override of [{ stopHookActive: true }, { userOverride: true }]) {
    const { decision } = reduceRuntimeEvent(
      state,
      runtimeEvent({ profile: "strict", stage: "session.completing", ...override }),
      bootstrap,
    );
    assert.equal(decision.allow, true);
  }
});

test("in-memory reductions stay below the 50ms p95 budget", () => {
  const samples = [];
  const event = runtimeEvent({ stage: "tool.after", tool: { mutation: true, verificationKind: null, success: true } });
  for (let index = 0; index < 1_000; index += 1) {
    const started = performance.now();
    reduceRuntimeEvent(createInitialState(), event, bootstrap);
    samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  assert.ok(samples[Math.floor(samples.length * 0.95)] < 50);
});
