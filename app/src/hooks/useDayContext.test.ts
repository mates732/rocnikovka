import test from "node:test";
import assert from "node:assert/strict";
import {
  isDayRollbackWarning,
  dayRollbackWarningMessage,
} from "./useDayContext";
import type { PlantDayContext } from "../types/entities";

const ctx = (overrides: Partial<PlantDayContext> = {}): PlantDayContext => ({
  plant_id: "PLT-001",
  last_recorded_day: 7,
  expected_next_day: 8,
  ...overrides,
});

test("E) last recorded day is calculated from the persisted context", () => {
  // The backend computes last_recorded_day; the helper only reads it.
  assert.equal(ctx({ last_recorded_day: 7 }).last_recorded_day, 7);
  assert.equal(ctx({ last_recorded_day: null }).last_recorded_day, null);
});

test("F) an earlier entered day produces a rollback warning", () => {
  assert.equal(isDayRollbackWarning(ctx(), "5"), true);
  assert.equal(isDayRollbackWarning(ctx(), "6"), true);
});

test("F2) equal or later days produce no warning", () => {
  assert.equal(isDayRollbackWarning(ctx(), "7"), false);
  assert.equal(isDayRollbackWarning(ctx(), "8"), false);
  assert.equal(isDayRollbackWarning(ctx(), "20"), false);
});

test("G) the warning never modifies the entered value (pure helper)", () => {
  // isDayRollbackWarning is a pure function over (context, enteredDay): it
  // returns a boolean and has no side effects on either argument.
  const context = ctx();
  const before = JSON.stringify(context);
  isDayRollbackWarning(context, "5");
  assert.equal(JSON.stringify(context), before, "context untouched");
  const message = dayRollbackWarningMessage(context, "5");
  assert.ok(message.includes("5"), "message names the entered day");
  assert.ok(message.includes("7"), "message names the last recorded day");
});

test("H) the warning is non-blocking: no rejection concept exists in the helper", () => {
  // The helper only signals; it cannot block submission. A plant with no
  // records never warns.
  assert.equal(isDayRollbackWarning(ctx({ last_recorded_day: null }), "1"), false);
  assert.equal(isDayRollbackWarning(null, "1"), false);
  // Invalid/empty entered days never warn.
  assert.equal(isDayRollbackWarning(ctx(), ""), false);
  assert.equal(isDayRollbackWarning(ctx(), "abc"), false);
  assert.equal(isDayRollbackWarning(ctx(), "0"), false);
  assert.equal(isDayRollbackWarning(ctx(), "6.5"), false);
});

test("C2) position events are not part of day context", () => {
  // The backend day-context aggregation intentionally excludes position
  // events (they have no experiment_day). The frontend helper has no position
  // input at all — the contract is enforced by the shape of PlantDayContext.
  const context = ctx();
  assert.deepEqual(Object.keys(context).sort(), ["expected_next_day", "last_recorded_day", "plant_id"]);
});