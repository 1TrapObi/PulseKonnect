import test from "node:test";
import assert from "node:assert/strict";

import { isValidCandidateTransition } from "./workflow";

test("candidate workflow transitions", () => {
  assert.equal(isValidCandidateTransition("new", "screening"), true);
  assert.equal(isValidCandidateTransition("new", "offer"), false);
  assert.equal(isValidCandidateTransition("screening", "interview"), true);
  assert.equal(isValidCandidateTransition("interview", "offer"), true);
  assert.equal(isValidCandidateTransition("offer", "hired"), true);
  assert.equal(isValidCandidateTransition("offer", "rejected"), true);
  assert.equal(isValidCandidateTransition("hired", "screening"), false);
});
