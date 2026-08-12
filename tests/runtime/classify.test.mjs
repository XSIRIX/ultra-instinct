import assert from "node:assert/strict";
import test from "node:test";

import { classifyTool } from "../../runtime/classify.mjs";

test("classifies successful native writes as mutations", () => {
  assert.deepEqual(classifyTool({ name: "apply_patch", input: { command: "secret" }, response: {}, success: true }), {
    mutation: true,
    verificationKind: null,
  });
});

test("classifies OpenCode patch tools as mutations", () => {
  assert.deepEqual(classifyTool({ name: "patch", input: null, success: true }), {
    mutation: true,
    verificationKind: null,
  });
});

test("does not count failed writes", () => {
  assert.deepEqual(classifyTool({ name: "Write", input: {}, response: {}, success: false }), {
    mutation: false,
    verificationKind: null,
  });
});

test("recognizes common verification commands without retaining the command", () => {
  const cases = [
    ["npm run typecheck", "typecheck"],
    ["bun test", "test"],
    ["pytest -q", "pytest"],
    ["cargo test", "cargo-test"],
    ["git diff --check", "diff-check"],
    ["xcodebuild test -scheme App", "xcodebuild-test"],
  ];
  for (const [command, verificationKind] of cases) {
    assert.deepEqual(classifyTool({ name: "Bash", input: { command }, response: "private", success: true }), {
      mutation: false,
      verificationKind,
    });
  }
});

test("recognizes verification commands executed through PowerShell", () => {
  assert.deepEqual(classifyTool({
    name: "PowerShell",
    input: { command: "npm test" },
    success: true,
  }), {
    mutation: false,
    verificationKind: "test",
  });
});

test("leaves uncertain shell commands unclassified", () => {
  assert.deepEqual(classifyTool({ name: "Bash", input: { command: "node script.mjs" }, success: true }), {
    mutation: false,
    verificationKind: null,
  });
});
