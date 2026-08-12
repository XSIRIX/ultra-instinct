import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, statSync, utimesSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createInitialState } from "../../runtime/contracts.mjs";
import { createStateStore } from "../../runtime/state.mjs";

test("state store persists fact-only state under a hashed owner-only file", () => {
  const stateDir = mkdtempSync(path.join(os.tmpdir(), "ultra-state-"));
  const store = createStateStore({ stateDir, clock: () => 10_000 });
  const state = { ...createInitialState(), mutationEpoch: 2, lastMutationAt: 9_000 };

  assert.equal(store.write("claude|private-session|/secret/project", state), true);
  assert.deepEqual(store.read("claude|private-session|/secret/project"), state);

  const [file] = readdirSync(stateDir).filter((name) => name.endsWith(".json"));
  assert.ok(file);
  assert.doesNotMatch(file, /private|secret|project/);
  assert.ok(Buffer.byteLength(readFileSync(path.join(stateDir, file))) <= 4096);
  assert.equal(statSync(stateDir).mode & 0o077, 0);
  assert.equal(statSync(path.join(stateDir, file)).mode & 0o077, 0);
});

test("state store replaces corrupt state and emits one warning", () => {
  const warnings = [];
  const stateDir = mkdtempSync(path.join(os.tmpdir(), "ultra-state-"));
  const store = createStateStore({ stateDir, warningSink: (warning) => warnings.push(warning) });
  store.write("key", createInitialState());
  const [file] = readdirSync(stateDir).filter((name) => name.endsWith(".json"));
  writeFileSync(path.join(stateDir, file), "not json");

  assert.deepEqual(store.read("key"), createInitialState());
  assert.equal(warnings.length, 1);
});

test("state store refuses state larger than four KiB", () => {
  const warnings = [];
  const stateDir = mkdtempSync(path.join(os.tmpdir(), "ultra-state-"));
  const store = createStateStore({ stateDir, warningSink: (warning) => warnings.push(warning) });

  assert.equal(store.write("key", { ...createInitialState(), verificationKind: "x".repeat(5000) }), false);
  assert.equal(warnings.length, 1);
});

test("state store rejects fields outside the fact-only contract", () => {
  const warnings = [];
  const stateDir = mkdtempSync(path.join(os.tmpdir(), "ultra-state-"));
  const store = createStateStore({ stateDir, warningSink: (warning) => warnings.push(warning) });

  assert.equal(store.write("key", { ...createInitialState(), prompt: "private" }), false);
  assert.equal(warnings.length, 1);
  assert.equal(readdirSync(stateDir).length, 0);
});

test("state cleanup removes entries older than seven days", () => {
  const now = 10 * 24 * 60 * 60 * 1000;
  const stateDir = mkdtempSync(path.join(os.tmpdir(), "ultra-state-"));
  const store = createStateStore({ stateDir, clock: () => now });
  store.write("old", createInitialState());
  const [file] = readdirSync(stateDir).filter((name) => name.endsWith(".json"));
  utimesSync(path.join(stateDir, file), 0, 0);

  store.cleanup();

  assert.equal(readdirSync(stateDir).filter((name) => name.endsWith(".json")).length, 0);
});
