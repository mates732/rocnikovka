// Phase 4K.5 — Position Event write UI tests (run with: npm test via tsx).
import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { act, create } from "react-test-renderer";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "../services/apiError";
import {
  buildPositionEventInput,
  emptyPositionFormValues,
  generatePositionEventId,
  normalizeTimestampToSeconds,
  PositionEventForm,
  PositionsPage,
  validatePositionForm,
} from "./ExperimentPages";
import type { Plant, PositionEvent } from "../types/entities";
import type { CreatePositionEventInput } from "../types/write";

const plants: Plant[] = [
  { plant_id: "PLT-001", pot_id: "P1", group_name: "G1", emergence_date: "2025-01-02", status: "active" },
  { plant_id: "PLT-002", pot_id: "P2", group_name: "G2", emergence_date: "2025-01-02", status: "active" },
];

const persisted: PositionEvent = {
  position_event_id: "POS-20250304-050607-099", // deliberately different from the client-generated id
  position_id: "A1",
  timestamp: "2025-03-04T05:06:07",
  plant_id: "PLT-001",
  location: "Shelf 1",
  previous_location: "Storage",
  operator: "Ada",
  reason: "rotation",
};

type Renderer = ReturnType<typeof create>;

/** Find an input/select/textarea by its name attribute (returns null when absent). */
function fieldByName(renderer: Renderer, name: string): any {
  const matches = renderer.root.findAll(
    (n) => n.props?.name === name && (n.type === "input" || n.type === "select" || n.type === "textarea")
  );
  assert.equal(matches.length, 1, `expected exactly one field named "${name}"`);
  return matches[0];
}

async function change(renderer: Renderer, name: string, value: string): Promise<void> {
  const node = fieldByName(renderer, name);
  await act(async () => {
    node.props.onChange({ target: { name, value } });
  });
}

async function submit(renderer: Renderer): Promise<void> {
  const forms = renderer.root.findAll((n) => n.type === "form");
  assert.equal(forms.length, 1, "expected exactly one form");
  await act(async () => {
    forms[0].props.onSubmit({ preventDefault() {} });
  });
}

function textContent(node: any): string {
  if (node === null || node === undefined) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(textContent).join("");
  return textContent(node.children);
}

function rendered(renderer: Renderer): string {
  return textContent(renderer.toJSON());
}

async function fillValid(renderer: Renderer): Promise<void> {
  const entries: Array<[string, string]> = [
    ["plant_id", "PLT-001"],
    ["position_id", "A1"],
    ["timestamp", "2025-03-04T05:06"],
    ["location", "Shelf 1"],
    ["previous_location", "Storage"],
    ["operator", "Ada"],
    ["reason", "rotation"],
    ["notes", "Moved for even light exposure"],
  ];
  for (const [name, value] of entries) {
    await change(renderer, name, value);
  }
}

type FormHarness = {
  renderer: Renderer;
  captured: CreatePositionEventInput[];
  createdIds: string[];
};

function renderForm(createImpl?: (input: CreatePositionEventInput) => Promise<PositionEvent>): FormHarness {
  const captured: CreatePositionEventInput[] = [];
  const createdIds: string[] = [];
  const renderer = create(
    <PositionEventForm
      plants={plants}
      createPositionEvent={async (input) => {
        captured.push(input);
        if (createImpl) return createImpl(input);
        return { ...persisted, position_event_id: input.position_event_id, timestamp: input.timestamp };
      }}
      onCreated={(created) => createdIds.push(created.position_event_id)}
    />
  );
  return { renderer, captured, createdIds };
}

// --- pure helpers -----------------------------------------------------------

test("J/Z) normalizeTimestampToSeconds appends :00 to a datetime-local value, is pure, and never touches timezones", () => {
  assert.equal(normalizeTimestampToSeconds("2025-03-04T05:06"), "2025-03-04T05:06:00");
  assert.equal(normalizeTimestampToSeconds("2025-03-04T05:06:07"), "2025-03-04T05:06:07");
  assert.equal(normalizeTimestampToSeconds(""), "");
  const a = normalizeTimestampToSeconds("2025-03-04T05:06");
  const b = normalizeTimestampToSeconds("2025-03-04T05:06");
  assert.equal(a, b, "pure: same input always yields the same output");
  assert.ok(!a.includes("Z"), "no timezone conversion");
  assert.ok(!a.includes("+"), "no offset conversion");
});

test("Z/ID) generatePositionEventId keeps the exact backend POS-YYYYMMDD-HHMMSS-XXX format with a deterministic session suffix", () => {
  const first = generatePositionEventId("2025-03-04T05:06:07");
  assert.match(first, /^POS-\d{8}-\d{6}-\d{3}$/);
  assert.equal(first, "POS-20250304-050607-001", "deterministic first suffix");
  const second = generatePositionEventId("2025-03-04T05:06:07");
  const suffixA = Number(first.slice(-3));
  const suffixB = Number(second.slice(-3));
  assert.equal(suffixB, (suffixA + 1) % 1000, "session suffix advances deterministically");
});

test("E/F/G/H/M) validatePositionForm rejects missing required fields and reason is required per the Phase 4J contract", () => {
  const base = emptyPositionFormValues();
  const valid = {
    ...base,
    plant_id: "PLT-001",
    position_id: "A1",
    timestamp: "2025-03-04T05:06",
    location: "Shelf 1",
    operator: "Ada",
    reason: "rotation",
  } as const;

  assert.deepEqual(validatePositionForm({ ...valid }), [], "fully valid form has no local issues");

  const empty = validatePositionForm(base);
  for (const field of ["plant_id", "position_id", "timestamp", "location", "operator", "reason"]) {
    const hit = empty.find((i) => i.field === field);
    assert.ok(hit, `field ${field} must be required`);
    assert.equal(hit.code, "required");
  }

  // whitespace-only required text fields are rejected too
  const whitespace = validatePositionForm({
    ...valid,
    location: "   ",
    operator: "  ",
    position_id: " ",
  });
  assert.ok(whitespace.some((i) => i.field === "location" && i.code === "required"));
  assert.ok(whitespace.some((i) => i.field === "operator" && i.code === "required"));
  assert.ok(whitespace.some((i) => i.field === "position_id" && i.code === "required"));

  // reason must be one of the three wire enums
  const badReason = validatePositionForm({ ...valid, reason: "moved" } as any).find((i) => i.field === "reason");
  assert.equal(badReason?.code, "enum.invalid");
});

test("L/N/pure) buildPositionEventInput omits empty optional fields and includes filled ones", () => {
  const values = {
    ...emptyPositionFormValues(),
    plant_id: "PLT-001",
    position_id: "A1",
    timestamp: "2025-03-04T05:06",
    location: "Shelf 1",
    previous_location: "",
    operator: "Ada",
    reason: "initial_assignment",
    notes: "",
  };
  const withoutOptionals = buildPositionEventInput(values as any, "POS-20250304-050600-001");
  assert.deepEqual(Object.keys(withoutOptionals).sort(), [
    "location",
    "operator",
    "plant_id",
    "position_event_id",
    "position_id",
    "reason",
    "timestamp",
  ]);
  assert.equal("previous_location" in withoutOptionals, false, "empty previous_location is omitted");
  assert.equal("notes" in withoutOptionals, false, "empty notes are omitted");

  const withOptionals = buildPositionEventInput(
    { ...(values as any), previous_location: "Storage", notes: "Rotated" },
    "POS-20250304-050600-001"
  );
  assert.equal(withOptionals.previous_location, "Storage");
  assert.equal(withOptionals.notes, "Rotated");
});

// --- component-level form behavior -----------------------------------------

test("A/form) PositionEventForm renders with all fields and visible labels", () => {
  const { renderer } = renderForm();
  const html = rendered(renderer);
  for (const label of [
    "Plant",
    "Position ID",
    "Timestamp",
    "Location",
    "Previous location",
    "Operator",
    "Reason",
    "Notes",
    "Log position event",
  ]) {
    assert.ok(html.includes(label), `expected label/text "${label}"`);
  }
  for (const name of [
    "plant_id",
    "position_id",
    "timestamp",
    "location",
    "previous_location",
    "operator",
    "reason",
    "notes",
  ]) {
    assert.ok(fieldByName(renderer, name), `field "${name}" must exist`);
  }
});

test("B) real plant options are used and their exact ids are selectable", () => {
  const { renderer } = renderForm();
  const select = fieldByName(renderer, "plant_id");
  const values = select.findAll((n: any) => n.type === "option").map((o: any) => o.props.value);
  assert.deepEqual(new Set(values), new Set(["", "PLT-001", "PLT-002"]));
  const html = rendered(renderer);
  assert.ok(html.includes("PLT-001 · pot P1"), "plant id and pot context shown in options");
});

test("C) no fake plant options exist (only the real persisted plants)", () => {
  const { renderer } = renderForm();
  const select = fieldByName(renderer, "plant_id");
  const values = select.findAll((n: any) => n.type === "option").map((o: any) => o.props.value);
  const realValues = values.filter(Boolean);
  assert.ok(
    realValues.every((v: string) => plants.some((p) => p.plant_id === v)),
    "every option maps to a real persisted plant"
  );
  assert.ok(!realValues.some((v: string) => v.startsWith("FAKE")), "no invented plants");
});

test("D-local) empty form cannot reach the backend and shows local required messages", async () => {
  const { renderer, captured } = renderForm();
  await submit(renderer);
  assert.equal(captured.length, 0, "empty form must not reach the backend");
  const html = rendered(renderer);
  for (const message of [
    "Select a plant.",
    "Position ID is required.",
    "Timestamp is required.",
    "Location is required.",
    "Operator is required.",
    "Select a reason.",
  ]) {
    assert.ok(html.includes(message), `expected local message "${message}"`);
  }
});

test("M/UI) reason select offers exactly the three wire enum values (plus placeholder)", () => {
  const { renderer } = renderForm();
  const select = fieldByName(renderer, "reason");
  const values = select.findAll((n: any) => n.type === "option").map((o: any) => o.props.value);
  assert.deepEqual(values, ["", "initial_assignment", "rotation", "manual_override"], "exact backend enum values");
  const html = rendered(renderer);
  assert.ok(html.includes("Initial assignment") && html.includes("Rotation") && html.includes("Manual override"));
});

test("I/O/P) valid submission calls createPositionEvent once with the exact explicit payload", async () => {
  const { renderer, captured } = renderForm();
  await fillValid(renderer);
  await submit(renderer);
  assert.equal(captured.length, 1);
  const payload = captured[0];
  assert.equal(payload.timestamp, "2025-03-04T05:06:00", "seconds are appended before sending");
  assert.match(payload.position_event_id, /^POS-20250304-050600-\d{3}$/);
  assert.deepEqual(payload, {
    position_event_id: payload.position_event_id,
    position_id: "A1",
    timestamp: "2025-03-04T05:06:00",
    plant_id: "PLT-001",
    location: "Shelf 1",
    previous_location: "Storage",
    operator: "Ada",
    reason: "rotation",
    notes: "Moved for even light exposure",
  });
  // P) no server-owned or unrelated persisted-entity fields are ever sent.
  assert.deepEqual(Object.keys(payload).sort(), [
    "location",
    "notes",
    "operator",
    "plant_id",
    "position_event_id",
    "position_id",
    "previous_location",
    "reason",
    "timestamp",
  ]);
});

test("R) success uses the persisted object returned by the backend", async () => {
  const { renderer, captured } = renderForm(async () => ({ ...persisted })); // returns POS-...-099
  await fillValid(renderer);
  await submit(renderer);
  assert.equal(captured.length, 1);
  const html = rendered(renderer);
  assert.ok(
    html.includes("Position event POS-20250304-050607-099 recorded."),
    "success message shows the backend-returned id"
  );
  assert.ok(!html.includes("POS-20250304-050607-001"), "the client-generated id is not claimed as persisted");
});

test("T) successful creation resets the form (entered fields cleared, plant kept)", async () => {
  const { renderer } = renderForm();
  await fillValid(renderer);
  await submit(renderer);
  const html = rendered(renderer);
  assert.ok(html.includes("Position event ") && html.includes(" recorded."), "success confirmation shown");
  assert.equal(fieldByName(renderer, "position_id").props.value, "", "position id must reset");
  assert.equal(fieldByName(renderer, "timestamp").props.value, "", "timestamp must reset");
  assert.equal(fieldByName(renderer, "location").props.value, "", "location must reset");
  assert.equal(fieldByName(renderer, "previous_location").props.value, "", "previous location must reset");
  assert.equal(fieldByName(renderer, "operator").props.value, "", "operator must reset");
  assert.equal(fieldByName(renderer, "reason").props.value, "", "reason must reset");
  assert.equal(fieldByName(renderer, "plant_id").props.value, "PLT-001", "plant selection is kept for consecutive logging");
});

test("U) failed submission preserves the entered form values and shows the ApiError via ErrorSummary", async () => {
  const apiError = new ApiError(400, "position_event.validation_failed", "Invalid position event", [
    { field: "reason", code: "enum.invalid", message: "reason must be initial_assignment, rotation or manual_override" },
  ]);
  const { renderer } = renderForm(async () => {
    throw apiError;
  });
  await fillValid(renderer);
  await submit(renderer);
  const html = rendered(renderer);
  assert.equal(fieldByName(renderer, "position_id").props.value, "A1", "entered value preserved");
  assert.equal(fieldByName(renderer, "location").props.value, "Shelf 1", "entered value preserved");
  assert.equal(fieldByName(renderer, "notes").props.value, "Moved for even light exposure", "entered value preserved");
  assert.ok(html.includes("Invalid position event"), "backend message rendered");
  assert.ok(html.includes("position_event.validation_failed"), "error code rendered");
  assert.ok(!html.includes("recorded."), "no success message on failure");
});

test("V) a 400 validation ApiError renders structured field-level issues", async () => {
  const apiError = new ApiError(400, "position_event.validation_failed", "Invalid position event", [
    { field: "position_id", code: "required.missing", message: "position_id is required" },
  ]);
  const { renderer } = renderForm(async () => {
    throw apiError;
  });
  await fillValid(renderer);
  await submit(renderer);
  const html = rendered(renderer);
  assert.ok(html.includes("Validation failed"), "status-aware label");
  assert.ok(html.includes("position_id"), "issue field rendered");
  assert.ok(html.includes("required.missing"), "issue code rendered");
  assert.ok(html.includes("position_id is required"), "issue message rendered");
});

test("W) a 409 id.duplicate conflict is rendered correctly and stays retryable", async () => {
  const apiError = new ApiError(409, "id.duplicate", "Duplicate position_event_id with conflicting content", [
    { field: "position_event_id", code: "id.conflict", message: "an identical or conflicting row is already persisted" },
  ]);
  const { renderer } = renderForm(async () => {
    throw apiError;
  });
  await fillValid(renderer);
  await submit(renderer);
  const html = rendered(renderer);
  assert.ok(html.includes("Conflict"), "conflict label");
  assert.ok(html.includes("id.duplicate"), "backend code preserved");
  assert.ok(html.includes("id.conflict"), "issue code preserved");
  assert.ok(html.includes("position_event_id"), "issue field preserved");
  assert.equal(fieldByName(renderer, "plant_id").props.value, "PLT-001", "form remains editable for retry");
});

test("X) submit is disabled while the request is in flight", async () => {
  let resolveCreate!: (e: PositionEvent) => void;
  const createImpl = (_input: CreatePositionEventInput) =>
    new Promise<PositionEvent>((resolve) => {
      resolveCreate = resolve;
    });
  const { renderer, captured } = renderForm(createImpl);
  await fillValid(renderer);
  await submit(renderer);
  assert.equal(captured.length, 1);
  const findSubmit = () =>
    renderer.root.findAll((n: any) => n.type === "button").find((b: any) => b.props.type === "submit");
  assert.equal(findSubmit().props.disabled, true, "submit must be disabled during the request");
  assert.ok(JSON.stringify(findSubmit().props.children).includes("Saving position event"), "submitting state visible");
  await act(async () => {
    resolveCreate({ ...persisted });
  });
  assert.equal(findSubmit().props.disabled, false, "submit re-enabled after completion");
});

// --- page-level integration -------------------------------------------------

type PositionPageServices = {
  plantService: { listPlants: () => Promise<Plant[]> };
  positionService: {
    listPositionEvents: () => Promise<PositionEvent[]>;
    createPositionEvent: (input: CreatePositionEventInput) => Promise<PositionEvent>;
  };
};

function renderPage(services: PositionPageServices): Renderer {
  return create(
    <MemoryRouter>
      <PositionsPage services={services} />
    </MemoryRouter>
  );
}

function openForm(renderer: Renderer): void {
  const openButton = renderer.root.findAll(
    (n: any) => n.type === "button" && textContent(n).includes("Log position event")
  );
  assert.equal(openButton.length, 1, "header action button is present");
  // synchronous state toggle; flush effects afterwards if any
  act(() => {
    openButton[0].props.onClick();
  });
}

test("A) the form opens from PositionsPage via the header action", async () => {
  const renderer = renderPage({
    plantService: { listPlants: async () => plants },
    positionService: { listPositionEvents: async () => [], createPositionEvent: async () => persisted },
  });
  await act(async () => {});
  openForm(renderer);
  const html = rendered(renderer);
  assert.ok(html.includes("Log position event"), "form panel heading present");
  assert.equal(renderer.root.findAll((n: any) => n.type === "form").length, 1, "form is present once plants exist");
  assert.ok(fieldByName(renderer, "position_id"), "position fields are rendered");
});

test("D) no plants → explicit empty state and form submission is impossible", async () => {
  const renderer = renderPage({
    plantService: { listPlants: async () => [] },
    positionService: { listPositionEvents: async () => [], createPositionEvent: async () => persisted },
  });
  await act(async () => {});
  openForm(renderer);
  const html = rendered(renderer);
  assert.ok(html.includes("No plants are registered yet"), "explicit empty state");
  assert.equal(
    renderer.root.findAll((n: any) => n.type === "select" && n.props.name === "plant_id").length,
    0,
    "no plant select and no submission possible"
  );
  assert.equal(renderer.root.findAll((n: any) => n.type === "form").length, 0, "no form rendered without plants");
});

test("S) page-level: successful create refreshes the position event list from the backend", async () => {
  const eventsRef: PositionEvent[] = [];
  let listCalls = 0;
  const renderer = renderPage({
    plantService: { listPlants: async () => plants },
    positionService: {
      listPositionEvents: async () => {
        listCalls += 1;
        return [...eventsRef]; // fresh array per call like the real HTTP adapter
      },
      createPositionEvent: async (input) => {
        const created: PositionEvent = { ...persisted, position_event_id: input.position_event_id, timestamp: input.timestamp };
        eventsRef.push(created);
        return created;
      },
    },
  });
  await act(async () => {});
  assert.equal(listCalls, 1, "initial list load");
  openForm(renderer);
  await fillValid(renderer);
  await submit(renderer);
  await act(async () => {});
  assert.equal(listCalls, 2, "read-after-write refresh must call listPositionEvents again");
  assert.equal(eventsRef.length, 1);
  const createdId = eventsRef[0].position_event_id;
  const rows = renderer.root.findAll((n: any) => n.type === "tr" && textContent(n).includes(createdId));
  assert.ok(rows.length >= 1, "a table row for the created event exists");
  const html = rendered(renderer);
  assert.ok(html.includes("Shelf 1"), "location of the created row is rendered");
  assert.ok(!html.includes("No position events recorded."), "empty state replaced after refresh");
});

test("Q/Y) the position flow uses the service abstraction and never touches manual/AICV/water creates", async () => {
  const eventsRef: PositionEvent[] = [];
  const createdRef: CreatePositionEventInput[] = [];
  const renderer = renderPage({
    plantService: { listPlants: async () => plants },
    positionService: {
      listPositionEvents: async () => eventsRef,
      createPositionEvent: async (input) => {
        createdRef.push(input);
        const created: PositionEvent = { ...persisted, position_event_id: input.position_event_id, timestamp: input.timestamp };
        eventsRef.push(created);
        return created;
      },
    },
  });
  await act(async () => {});
  openForm(renderer);
  await fillValid(renderer);
  await submit(renderer);
  await act(async () => {});
  assert.equal(createdRef.length, 1, "exactly one create went through the injected position service");
  assert.equal(eventsRef.length, 1, "only the position create path ran");
  // The page dependency surface exposes only plant + position services, so
  // manual/AICV/water creates are structurally unreachable from this flow.
  const html = rendered(renderer);
  assert.ok(
    !html.includes("manual-measurements") && !html.includes("aicv-measurements") && !html.includes("water-events"),
    "no unrelated write surfaces are referenced"
  );
});