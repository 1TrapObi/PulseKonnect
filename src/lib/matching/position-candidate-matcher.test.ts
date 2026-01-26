import test from "node:test";
import assert from "node:assert/strict";

import { calculatePositionMatch } from "./position-candidate-matcher";

test("position match: license is a hard requirement", () => {
  const score = calculatePositionMatch(
    {
      id: "c1",
      license_type: "LPC",
      experience_years: 3,
      specializations: ["Trauma"],
      location: "Durham, NC",
    },
    {
      id: "p1",
      required_licenses: ["LCSW"],
      experience_level: "mid",
      required_specializations: ["Trauma"],
      preferred_specializations: [],
      work_locations: ["Durham"],
    }
  );

  assert.equal(score, 0);
});

test("position match: strong match scores high", () => {
  const score = calculatePositionMatch(
    {
      id: "c1",
      license_type: "LCSW",
      experience_years: 5,
      specializations: ["Substance Abuse", "Trauma", "Mental Health"],
      location: "Durham, NC",
    },
    {
      id: "p1",
      required_licenses: ["LCSW", "LPC"],
      experience_level: "senior",
      required_specializations: ["Trauma", "Mental Health"],
      preferred_specializations: ["Substance Abuse"],
      work_locations: ["Durham", "Remote"],
    }
  );

  assert.ok(score >= 80);
});
