import assert from "node:assert/strict";
import test from "node:test";

import { resolveProfile } from "../../runtime/profile.mjs";

test("profile defaults to guided", () => {
  assert.deepEqual(resolveProfile(undefined), { profile: "guided", warning: null });
});

test("profile accepts every supported value", () => {
  for (const profile of ["lite", "guided", "strict"]) {
    assert.deepEqual(resolveProfile(profile), { profile, warning: null });
  }
});

test("invalid profile warns once and falls back to guided", () => {
  const result = resolveProfile("turbo");
  assert.equal(result.profile, "guided");
  assert.match(result.warning, /unknown profile/i);
  assert.doesNotMatch(result.warning, /turbo/);
});
