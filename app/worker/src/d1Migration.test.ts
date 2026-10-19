import test from "node:test";
import assert from "node:assert/strict";
import { d1ChangedRows, explainZeroChanges, compareCounts, isConflictableValue } from "./d1Migration.js";

test("d1ChangedRows: sums meta.changes across statement parts", () => {
  assert.equal(d1ChangedRows({ result: [{ meta: { changes: 1 } }] }), 1);
  assert.equal(
    d1ChangedRows({ result: [{ meta: { changes: 1 } }, { meta: { changes: 2 } }] }),
    3,
    "a batch contributes every part's changes"
  );
  assert.equal(d1ChangedRows({ result: [{ meta: { changes: 0 } }] }), 0);
  assert.equal(d1ChangedRows({ result: [{ meta: {} }] }), 0, "a missing changes field is 0, never undefined");
  assert.equal(d1ChangedRows({}), 0);
});

test("d1ChangedRows: a silently ignored row reports 0, not 1", () => {
  // This is the whole point: `INSERT OR IGNORE` that skipped a row writes 0.
  const body = { result: [{ meta: { changes: 0, changed_db: false } }] };
  assert.equal(d1ChangedRows(body), 0);
});

test("explainZeroChanges: idempotent rerun by primary key is not a conflict", () => {
  assert.equal(explainZeroChanges(true, []), null, "the row is simply already present");
});

test("explainZeroChanges: a UNIQUE value owned by another row is reported", () => {
  // PLT-002 tried to take POT-001, which already belongs to PLT-001.
  assert.equal(
    explainZeroChanges(false, ["pot_id"]),
    "UNIQUE conflict on 'pot_id'"
  );
  assert.equal(
    explainZeroChanges(false, ["pot_id", "other_col"]),
    "UNIQUE conflict on 'pot_id'",
    "the first owned column is reported"
  );
});

test("explainZeroChanges: an unexplained zero write is not silently OK", () => {
  assert.equal(
    explainZeroChanges(false, []),
    "row was not written (reason not identified)",
    "a zero write with no explanation must still be surfaced"
  );
});

test("isConflictableValue: blank and null values cannot collide", () => {
  assert.equal(isConflictableValue(undefined), false);
  assert.equal(isConflictableValue(null), false);
  assert.equal(isConflictableValue(""), false);
  assert.equal(isConflictableValue("POT-001"), true);
  assert.equal(isConflictableValue(0), true, "a real 0 value is still a value");
});

test("compareCounts: a target short of the source is a data-loss condition", () => {
  assert.deepEqual(compareCounts(5, 5), { ok: true, missing: 0 });
  assert.deepEqual(compareCounts(5, 7), { ok: true, missing: 0 }, "a larger target is fine (rerun)");
  assert.deepEqual(compareCounts(5, 3), { ok: false, missing: 2 }, "missing rows are counted");
  assert.deepEqual(compareCounts(0, 0), { ok: true, missing: 0 });
});
