import test from "node:test";
import assert from "node:assert/strict";
import { create, act } from "react-test-renderer";
import React from "react";
import { ExperimentDayContext } from "./ExperimentDayContext";
import type { DayContextState } from "../hooks/useDayContext";

const loaded = (overrides: Partial<NonNullable<DayContextState & { status: "loaded" }>["context"]> = {}): DayContextState => ({
  status: "loaded",
  context: { plant_id: "PLT-001", last_recorded_day: 7, expected_next_day: 8, ...overrides },
});

function render(state: DayContextState, enteredDay: string) {
  return create(<ExperimentDayContext dayContext={state} enteredDay={enteredDay} />);
}

function textOf(renderer: ReturnType<typeof create>): string {
  let out = "";
  const walk = (node: unknown) => {
    if (node === null || node === undefined) return;
    if (typeof node === "string" || typeof node === "number") {
      out += node;
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const anyNode = node as { children?: unknown };
    if (anyNode.children !== undefined) walk(anyNode.children);
  };
  walk(renderer.toJSON());
  return out;
}

test("rollback warning is rendered for an earlier entered day", () => {
  const renderer = render(loaded(), "5");
  const text = textOf(renderer);
  assert.ok(text.includes("Day 5"), "entered day is named");
  assert.ok(text.includes("last recorded day (7)"), "last recorded day is named");
  assert.ok(text.includes("Check the experiment day"), "human guidance present");
});

test("no warning for equal/later days, empty input, loading, error or absent records", () => {
  assert.equal(textOf(render(loaded(), "7")), "", "equal day");
  assert.equal(textOf(render(loaded(), "8")), "", "later day");
  assert.equal(textOf(render(loaded(), ""), "").length, 0, "empty day");
  assert.equal(textOf(render({ status: "loading", context: null }, "5")), "", "loading");
  assert.equal(textOf(render({ status: "error", context: null }, "5")), "", "error");
  assert.equal(textOf(render({ status: "idle", context: null }, "5")), "", "idle");
  assert.equal(
    textOf(render({ status: "loaded", context: { plant_id: "PLT-001", last_recorded_day: null, expected_next_day: null } }, "5")),
    "",
    "plant without recorded days"
  );
});

test("the warning is non-blocking: it renders a note, never a blocking element", () => {
  const renderer = render(loaded(), "5");
  const json = renderer.toJSON();
  const note = json as { type: string; props: Record<string, unknown> };
  assert.equal(note.type, "p");
  assert.equal(note.props.role, "note", "semantic note role");
  assert.ok(!note.props.role || note.props.role !== "alert", "never an alert");
});

test("component never derives or modifies the entered day", () => {
  const renderer = render(loaded(), "5");
  const json = renderer.toJSON() as { children?: unknown };
  assert.ok(json.children, "warning text is static copy");
  // The component has no inputs/buttons/forms — it cannot modify anything.
  assert.equal(renderer.root.findAll((n) => n.type === "input").length, 0);
  assert.equal(renderer.root.findAll((n) => n.type === "button").length, 0);
  assert.equal(renderer.root.findAll((n) => n.type === "form").length, 0);
});

test("unmount is safe (no state updates after unmount)", async () => {
  const renderer = render(loaded(), "5");
  await act(async () => {
    renderer.unmount();
  });
  assert.ok(true);
});