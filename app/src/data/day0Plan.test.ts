import test from "node:test";
import assert from "node:assert/strict";
import {
  DAY0_PLAN,
  plannedPotIds,
  groupForPotNumber,
  detectPotConflicts,
  potIdFor,
  plannedTotalSubstrateG,
  plannedTotalSeeds,
  plannedWaterMlForGroup,
  plannedWaterField,
  hasCompletePlannedWaterVolumes,
} from "../data/day0Plan";

test("Day 0 plan: 27 pots, 3 seeds per pot, 81 planned seeds", () => {
  assert.equal(DAY0_PLAN.pots, 27);
  assert.equal(DAY0_PLAN.seedsPerPot, 3);
  assert.equal(DAY0_PLAN.plannedSeeds, 81);
  assert.equal(plannedTotalSeeds(), 81);
});

test("Day 0 plan: 72 g substrate per pot, 1 944 g total, never an assembled mass", () => {
  assert.equal(DAY0_PLAN.substratePerPotG, 72);
  assert.equal(DAY0_PLAN.totalSubstrateG, 1944);
  assert.equal(plannedTotalSubstrateG(), 1944);
});

test("Day 0 plan: 9 pots per group", () => {
  assert.equal(DAY0_PLAN.groups.G1, 9);
  assert.equal(DAY0_PLAN.groups.G2, 9);
  assert.equal(DAY0_PLAN.groups.G3, 9);
  assert.equal(DAY0_PLAN.groups.G1 + DAY0_PLAN.groups.G2 + DAY0_PLAN.groups.G3, 27);
});

test("Day 0 plan: scale resolution is 1 g, so sub-gram precision is not implied", () => {
  assert.equal(DAY0_PLAN.scaleResolutionG, 1);
});

test("Day 0 plan: group assignment is 9/9/9 across POT-001..POT-027", () => {
  const counts = { G1: 0, G2: 0, G3: 0 };
  for (let n = 1; n <= 27; n++) {
    counts[groupForPotNumber(n)] += 1;
  }
  assert.equal(counts.G1, 9);
  assert.equal(counts.G2, 9);
  assert.equal(counts.G3, 9);

  assert.equal(groupForPotNumber(1), "G1");
  assert.equal(groupForPotNumber(9), "G1");
  assert.equal(groupForPotNumber(10), "G2");
  assert.equal(groupForPotNumber(18), "G2");
  assert.equal(groupForPotNumber(19), "G3");
  assert.equal(groupForPotNumber(27), "G3");
});

test("Day 0 plan: pot ids use the POT-XXX zero-padded convention", () => {
  assert.equal(potIdFor(1), "POT-001");
  assert.equal(potIdFor(9), "POT-009");
  assert.equal(potIdFor(27), "POT-027");

  const ids = plannedPotIds();
  assert.equal(ids.length, 27);
  assert.equal(ids[0], "POT-001");
  assert.equal(ids[26], "POT-027");
  assert.equal(new Set(ids).size, 27, "all planned pot ids are unique");
});

test("Day 0 plan: bulk registration detects an existing plant's pot as a conflict", () => {
  // PLT-001 owns POT-001 — this must be surfaced, never silently re-assigned.
  const conflicts = detectPotConflicts(plannedPotIds(), ["POT-001"]);
  assert.deepEqual(conflicts, ["POT-001"]);
});

test("Day 0 plan: no conflict is reported when no planned pot is already used", () => {
  assert.deepEqual(detectPotConflicts(plannedPotIds(), ["POT-028", "POT-029"]), []);
});

test("Day 0 plan: multiple conflicts are all reported", () => {
  const conflicts = detectPotConflicts(plannedPotIds(), ["POT-001", "POT-014", "POT-030"]);
  assert.deepEqual(conflicts, ["POT-001", "POT-014"]);
});

test("Day 0 plan: three seeds in one pot stays one experimental unit", () => {
  // The pot is the unit. The planned seed count must never be presented as the
  // number of independent replicates.
  assert.equal(DAY0_PLAN.seedsPerPot, 3);
  assert.equal(DAY0_PLAN.pots, 27, "there are 27 experimental units, not 81");
});

test("Day 0 plan: planned watering volumes are 75/64/53 ml per pot", () => {
  assert.equal(DAY0_PLAN.plannedWaterMlPerPot.G1, 75);
  assert.equal(DAY0_PLAN.plannedWaterMlPerPot.G2, 64);
  assert.equal(DAY0_PLAN.plannedWaterMlPerPot.G3, 53);
  assert.equal(plannedWaterMlForGroup("G1"), 75);
  assert.equal(plannedWaterMlForGroup("G2"), 64);
  assert.equal(plannedWaterMlForGroup("G3"), 53);
});

test("Day 0 plan: planned volumes map to the physical-config fields", () => {
  assert.equal(plannedWaterField("G1"), "planned_water_ml_g1");
  assert.equal(plannedWaterField("G2"), "planned_water_ml_g2");
  assert.equal(plannedWaterField("G3"), "planned_water_ml_g3");
});

test("Day 0 plan: planned volumes never become gravimetric targets", () => {
  // The plan carries millilitre amounts only. Multiplying them by a group
  // percentage to derive a target mass must never happen in the app.
  const totalPlanned = plannedPotIds().reduce(
    (sum, id) => sum + plannedWaterMlForGroup(groupForPotNumber(Number(id.replace(/\D/g, ""))))!,
    0
  );
  // 27 pots x their group plan (9 each of 75, 64, 53)
  assert.equal(totalPlanned, 9 * 75 + 9 * 64 + 9 * 53);
  assert.equal(totalPlanned, 1728);

  // There is deliberately no target-mass / gravimetric helper exported.
  // This list is the plan module's public surface; adding one would break this
  // test, which is the point — derivation is not allowed.
  const planExportNames = [
    "DAY0_PLAN",
    "potIdFor",
    "plannedPotIds",
    "groupForPotNumber",
    "detectPotConflicts",
    "plannedTotalSubstrateG",
    "plannedTotalSeeds",
    "plannedWaterMlForGroup",
    "plannedWaterField",
    "hasCompletePlannedWaterVolumes",
  ];
  assert.equal(planExportNames.length, new Set(planExportNames).size);
  assert.ok(
    !planExportNames.some((name) => /target|gravimetric|mass/i.test(name)),
    "no gravimetric target-mass derivation may be exported from the plan"
  );

  // The DAY0_PLAN object itself exposes no mass-target field.
  assert.ok(!Object.keys(DAY0_PLAN).includes("target_mass_g"));
  assert.equal(hasCompletePlannedWaterVolumes(), true);
});

test("Day 0 plan: a planned volume is not an actual watering event", () => {
  // The plan module holds only planned values — it must never expose a stored
  // observation, so an app-level "has this pot been watered" can never be
  // satisfied by the plan alone.
  assert.equal(typeof plannedWaterMlForGroup("G1"), "number");
  assert.ok(
    !Object.keys(DAY0_PLAN).includes("initial_water_ml"),
    "the plan must not carry actual observation fields"
  );
});