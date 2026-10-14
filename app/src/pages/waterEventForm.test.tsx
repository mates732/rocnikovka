// Phase 4K.4 — Water Event write UI tests (run with: npm test via tsx).
import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { act, create } from "react-test-renderer";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "../services/apiError";
import {
  buildWaterEventInput,
  emptyWaterFormValues,
  generateWaterEventId,
  normalizeTimestampToSeconds,
  validateWaterForm,
  WaterEventForm,
  WaterPage,
} from "./ExperimentPages";
import type { Plant, WaterEvent } from "../types/entities";
import type { CreateWaterEventInput } from "../types/write";

const plants: Plant[] = [
  { plant_id: "PLT-001", pot_id: "P1", group_name: "G1", emergence_date: "2025-01-02", status: "active" },
  { plant_id: "PLT-002", pot_id: "P2", group_name: "G2", emergence_date: "2025-01-02", status: "active" },
];

const persisted: WaterEvent = {
  water_event_id: "WTR-20250304-050607-099", // deliberately different from the client-generated id
  plant_id: "PLT-001",
  timestamp: "2025-03-04T05:06:07",
  experiment_day: 14,
  pot_mass_before_g: 998.2,
  target_mass_g: 1000,
  water_added_ml: 32.5,
  pot_mass_after_g: 1030.7,
  watering_status: "pass",
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
    ["timestamp", "2025-03-04T05:06"],
    ["experiment_day", "14"],
    ["pot_mass_before_g", "998.2"],
    ["target_mass_g", "1000"],
    ["water_added_ml", "32.5"],
    ["pot_mass_after_g", "1030.7"],
    ["watering_status", "pass"],
    ["operator", "Ada"],
    ["notes", "Regular watering"],
  ];
  for (const [name, value] of entries) {
    await change(renderer, name, value);
  }
}

type FormHarness = {
  renderer: Renderer;
  captured: CreateWaterEventInput[];
  createdIds: string[];
};

function renderForm(createImpl?: (input: CreateWaterEventInput) => Promise<WaterEvent>): FormHarness {
  const captured: CreateWaterEventInput[] = [];
  const createdIds: string[] = [];
  const renderer = create(
    <WaterEventForm
      plants={plants}
      createWaterEvent={async (input) => {
        captured.push(input);
        if (createImpl) return createImpl(input);
        return { ...persisted, water_event_id: input.water_event_id, timestamp: input.timestamp };
      }}
      onCreated={(created) => createdIds.push(created.water_event_id)}
      getDayContext={async () => null}
    />
  );
  return { renderer, captured, createdIds };
}

// --- pure helpers -----------------------------------------------------------

test("F) normalizeTimestampToSeconds appends :00 to a datetime-local value and never touches seconds/timezones", () => {
  assert.equal(normalizeTimestampToSeconds("2025-03-04T05:06"), "2025-03-04T05:06:00");
  assert.equal(normalizeTimestampToSeconds("2025-03-04T05:06:07"), "2025-03-04T05:06:07");
  assert.equal(normalizeTimestampToSeconds(""), "");
  assert.ok(!normalizeTimestampToSeconds("2025-03-04T05:06").includes("Z"), "no timezone conversion");
});

test("ID) generateWaterEventId keeps the exact backend format and gives same-second events distinct session suffixes", () => {
  const first = generateWaterEventId("2025-03-04T05:06:07");
  assert.match(first, /^WTR-\d{8}-\d{6}-\d{3}$/);
  assert.equal(first, "WTR-20250304-050607-001", "deterministic first suffix");
  const second = generateWaterEventId("2025-03-04T05:06:07");
  assert.match(second, /^WTR-\d{8}-\d{6}-\d{3}$/);
  const suffixA = Number(first.slice(-3));
  const suffixB = Number(second.slice(-3));
  assert.equal(suffixB, (suffixA + 1) % 1000, "session suffix advances deterministically");
});

test("E/H) validateWaterForm requires an explicit experiment_day (never derived) and validates numerics", () => {
  const base = emptyWaterFormValues();
  const valid = {
    ...base,
    plant_id: "PLT-001",
    timestamp: "2025-03-04T05:06",
    experiment_day: "14",
    pot_mass_before_g: "998.2",
    target_mass_g: "1000",
    water_added_ml: "32.5",
    pot_mass_after_g: "1030.7",
    watering_status: "pass",
  } as const;

  assert.deepEqual(validateWaterForm({ ...valid }), [], "fully valid form has no local issues");

  // experiment_day is explicit — an empty day fails even though the timestamp is present.
  const dayIssues = validateWaterForm({ ...valid, experiment_day: "" });
  assert.ok(dayIssues.some((i) => i.field === "experiment_day" && i.code === "required"));

  // Numeric rejections: empty required, invalid format, out-of-range, Infinity.
  const cases: Array<[string, string, string]> = [
    ["pot_mass_before_g", "", "required"],
    ["pot_mass_before_g", "abc", "number.invalid_format"],
    ["pot_mass_before_g", "12.3.4", "number.invalid_format"],
    ["pot_mass_before_g", "-1", "number.out_of_range"],
    ["target_mass_g", "0", "number.out_of_range"],
    ["target_mass_g", "Infinity", "number.invalid_format"],
    ["pot_mass_after_g", "", "required"],
  ];
  for (const [field, value, expectedCode] of cases) {
    const issues = validateWaterForm({ ...valid, [field]: value } as any);
    const hit = issues.find((i) => i.field === field);
    assert.ok(hit, `field ${field} must produce an issue for ${JSON.stringify(value)}`);
    assert.equal(hit.code, expectedCode, `field ${field} value ${JSON.stringify(value)}`);
  }
});

test("G/pure) watering_status accepts only pass/warn/fail locally", () => {
  const base = emptyWaterFormValues();
  const valid = {
    ...base,
    plant_id: "PLT-001",
    timestamp: "2025-03-04T05:06",
    experiment_day: "14",
    pot_mass_before_g: "998.2",
    target_mass_g: "1000",
    water_added_ml: "32.5",
    pot_mass_after_g: "1030.7",
    watering_status: "pass",
  } as const;
  assert.ok(
    validateWaterForm({ ...valid, watering_status: "" }).some((i) => i.field === "watering_status" && i.code === "required")
  );
  const bad = validateWaterForm({ ...valid, watering_status: "ok" } as any).find((i) => i.field === "watering_status");
  assert.equal(bad?.code, "enum.invalid");
});

test("R/pure) buildWaterEventInput contains only the explicitly supported API fields", () => {
  const values = {
    ...emptyWaterFormValues(),
    plant_id: "PLT-001",
    timestamp: "2025-03-04T05:06",
    experiment_day: "14",
    pot_mass_before_g: "1",
    target_mass_g: "2",
    water_added_ml: "3",
    pot_mass_after_g: "4",
    watering_status: "pass",
  };
  const input = buildWaterEventInput(values as any, "WTR-20250304-050600-001");
  assert.deepEqual(Object.keys(input).sort(), [
    "experiment_day",
    "plant_id",
    "pot_mass_after_g",
    "pot_mass_before_g",
    "target_mass_g",
    "timestamp",
    "water_added_ml",
    "water_event_id",
    "watering_status",
  ]);
  assert.equal(input.timestamp, "2025-03-04T05:06:00", "seconds are appended before sending");
});

// --- component-level form behavior -----------------------------------------

test("A) form renders with all fields and visible labels", () => {
  const { renderer } = renderForm();
  const html = rendered(renderer);
  for (const label of [
    "Plant",
    "Timestamp",
    "Experiment day",
    "Pot mass before",
    "Target mass",
    "Water added",
    "Pot mass after",
    "Watering status",
    "Operator",
    "Notes",
    "Log water event",
  ]) {
    assert.ok(html.includes(label), `expected label/text "${label}"`);
  }
  for (const name of [
    "plant_id",
    "timestamp",
    "experiment_day",
    "pot_mass_before_g",
    "target_mass_g",
    "water_added_ml",
    "pot_mass_after_g",
    "watering_status",
    "operator",
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

test("D) required fields are enforced locally before any backend call", async () => {
  const { renderer, captured } = renderForm();
  await submit(renderer);
  assert.equal(captured.length, 0, "empty form must not reach the backend");
  const html = rendered(renderer);
  for (const message of [
    "Select a plant.",
    "Timestamp is required.",
    "Experiment day is required.",
    "Pot mass before must be a number",
    "Target mass must be a number greater than 0.",
    "Added water must be a number",
    "Pot mass after must be a number",
    "Select a watering status.",
  ]) {
    assert.ok(html.includes(message), `expected local message "${message}"`);
  }
});

test("E) empty experiment_day is rejected even when a timestamp is present (never derived)", async () => {
  const { renderer, captured } = renderForm();
  await fillValid(renderer);
  await change(renderer, "experiment_day", "");
  await submit(renderer);
  assert.equal(captured.length, 0, "must not submit without an explicit experiment_day");
  assert.ok(rendered(renderer).includes("Experiment day is required."));
});

test("H) invalid numeric input is rejected locally", async () => {
  const { renderer, captured } = renderForm();
  await fillValid(renderer);
  await change(renderer, "pot_mass_before_g", "abc");
  await submit(renderer);
  assert.equal(captured.length, 0);
  assert.ok(rendered(renderer).includes("Pot mass before must be a number"));
});

test("G/UI) status select offers exactly pass/warn/fail (plus placeholder)", () => {
  const { renderer } = renderForm();
  const select = fieldByName(renderer, "watering_status");
  const values = select.findAll((n: any) => n.type === "option").map((o: any) => o.props.value);
  assert.deepEqual(values, ["", "pass", "warn", "fail"], "wire values must be the exact backend enum");
});

test("I/J) valid submission calls createWaterEvent once with the exact explicit payload", async () => {
  const { renderer, captured } = renderForm();
  await fillValid(renderer);
  await submit(renderer);
  assert.equal(captured.length, 1);
  const payload = captured[0];
  // F) timestamp carries :00 seconds
  assert.equal(payload.timestamp, "2025-03-04T05:06:00");
  assert.match(payload.water_event_id, /^WTR-20250304-050600-\d{3}$/);
  assert.deepEqual(payload, {
    water_event_id: payload.water_event_id,
    plant_id: "PLT-001",
    timestamp: "2025-03-04T05:06:00",
    experiment_day: 14,
    pot_mass_before_g: 998.2,
    target_mass_g: 1000,
    water_added_ml: 32.5,
    pot_mass_after_g: 1030.7,
    watering_status: "pass",
    operator: "Ada",
    notes: "Regular watering",
  });
  // J) no server-owned or unrelated persisted-entity fields are ever sent.
  assert.deepEqual(Object.keys(payload).sort(), [
    "experiment_day",
    "notes",
    "operator",
    "plant_id",
    "pot_mass_after_g",
    "pot_mass_before_g",
    "target_mass_g",
    "timestamp",
    "water_added_ml",
    "water_event_id",
    "watering_status",
  ]);
});

test("K) success uses the persisted object returned by the backend", async () => {
  const { renderer, captured } = renderForm(async () => ({ ...persisted })); // returns WTR-...-099
  await fillValid(renderer);
  await submit(renderer);
  assert.equal(captured.length, 1);
  const html = rendered(renderer);
  assert.ok(html.includes("Water event WTR-20250304-050607-099 recorded."), "success message shows the backend-returned id");
  assert.ok(!html.includes("WTR-20250304-050607-001"), "the client-generated id is not claimed as persisted");
});

test("M) successful creation resets the form (measured fields cleared, plant kept)", async () => {
  const { renderer } = renderForm();
  await fillValid(renderer);
  await submit(renderer);
  const html = rendered(renderer);
  assert.ok(html.includes("Water event ") && html.includes(" recorded."), "success confirmation shown");
  assert.equal(fieldByName(renderer, "pot_mass_before_g").props.value, "", "mass must reset");
  assert.equal(fieldByName(renderer, "timestamp").props.value, "", "timestamp must reset");
  assert.equal(fieldByName(renderer, "experiment_day").props.value, "", "experiment day must reset");
  assert.equal(fieldByName(renderer, "operator").props.value, "", "operator must reset");
  assert.equal(fieldByName(renderer, "plant_id").props.value, "PLT-001", "plant selection is kept for consecutive logging");
  assert.equal(fieldByName(renderer, "watering_status").props.value, "", "status must reset");
});

test("N) failed submission preserves the entered form values and shows the ApiError via ErrorSummary", async () => {
  const apiError = new ApiError(400, "water_event.validation_failed", "Invalid water event", [
    { field: "pot_mass_after_g", code: "number.out_of_range", message: "must not be negative" },
  ]);
  const { renderer } = renderForm(async () => {
    throw apiError;
  });
  await fillValid(renderer);
  await submit(renderer);
  const html = rendered(renderer);
  assert.equal(fieldByName(renderer, "pot_mass_before_g").props.value, "998.2", "entered value preserved");
  assert.equal(fieldByName(renderer, "timestamp").props.value, "2025-03-04T05:06", "entered value preserved");
  assert.equal(fieldByName(renderer, "notes").props.value, "Regular watering", "entered value preserved");
  assert.ok(html.includes("Invalid water event"), "backend message rendered");
  assert.ok(html.includes("water_event.validation_failed"), "error code rendered");
  assert.ok(html.includes("must not be negative"), "structured issue message rendered");
  assert.ok(!html.includes("recorded."), "no success message on failure");
});

test("O) a 400 validation ApiError renders structured field-level issues", async () => {
  const apiError = new ApiError(400, "water_event.validation_failed", "Invalid water event", [
    { field: "target_mass_g", code: "number.out_of_range", message: "target mass must be above 0" },
  ]);
  const { renderer } = renderForm(async () => {
    throw apiError;
  });
  await fillValid(renderer);
  await submit(renderer);
  const html = rendered(renderer);
  assert.ok(html.includes("Validation failed"), "status-aware label");
  assert.ok(html.includes("target_mass_g"), "issue field rendered");
  assert.ok(html.includes("number.out_of_range"), "issue code rendered");
});

test("P) a 409 id.duplicate conflict is rendered correctly and stays retryable", async () => {
  const apiError = new ApiError(409, "id.duplicate", "A water event with this id already exists", [
    { field: "water_event_id", code: "id.conflict", message: "an identical or conflicting row is already persisted" },
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
  assert.ok(html.includes("water_event_id"), "issue field preserved");
  assert.equal(fieldByName(renderer, "plant_id").props.value, "PLT-001", "form remains editable for retry");
});

test("Q) submit is disabled while the request is in flight", async () => {
  let resolveCreate!: (w: WaterEvent) => void;
  const createImpl = (_input: CreateWaterEventInput) =>
    new Promise<WaterEvent>((resolve) => {
      resolveCreate = resolve;
    });
  const { renderer, captured } = renderForm(createImpl);
  await fillValid(renderer);
  await submit(renderer);
  assert.equal(captured.length, 1);
  const findSubmit = () =>
    renderer.root.findAll((n: any) => n.type === "button").find((b: any) => b.props.type === "submit");
  assert.equal(findSubmit().props.disabled, true, "submit must be disabled during the request");
  assert.ok(JSON.stringify(findSubmit().props.children).includes("Saving water event"), "submitting state visible");
  await act(async () => {
    resolveCreate({ ...persisted });
  });
  assert.equal(findSubmit().props.disabled, false, "submit re-enabled after completion");
});

// --- page-level integration -------------------------------------------------

test("A/C) page shows an explicit empty state instead of a form when no plants exist", async () => {
  const renderer = create(
    <MemoryRouter>
      <WaterPage
        services={{
          plantService: { listPlants: async () => [], getDayContext: async () => null },
          waterService: { listWaterEvents: async () => [], createWaterEvent: async () => persisted },
        }}
      />
    </MemoryRouter>
  );
  await act(async () => {});
  const openButton = renderer.root.findAll(
    (n: any) => n.type === "button" && textContent(n).includes("Log water event")
  );
  assert.equal(openButton.length, 1, "header action button is present");
  await act(async () => {
    openButton[0].props.onClick();
  });
  const html = rendered(renderer);
  assert.ok(html.includes("No plants are registered yet"), "explicit empty state");
  assert.equal(renderer.root.findAll((n: any) => n.type === "select" && n.props.name === "plant_id").length, 0, "no plant select and no submission possible");
});

test("I/L) page-level: successful create refreshes the water event list from the backend", async () => {
  const eventsRef: WaterEvent[] = [];
  let listCalls = 0;
  const renderer = create(
    <MemoryRouter>
      <WaterPage
        services={{
          plantService: { listPlants: async () => plants, getDayContext: async () => null },
          waterService: {
            // A fresh array per call mirrors the real HTTP adapter (which
            // parses a new JSON body every fetch).
            listWaterEvents: async () => {
              listCalls += 1;
              return [...eventsRef];
            },
            createWaterEvent: async (input) => {
              const created: WaterEvent = { ...persisted, water_event_id: input.water_event_id, timestamp: input.timestamp };
              eventsRef.push(created);
              return created;
            },
          },
        }}
      />
    </MemoryRouter>
  );
  await act(async () => {});
  assert.equal(listCalls, 1, "initial list load");
  const openButton = renderer.root.findAll(
    (n: any) => n.type === "button" && textContent(n).includes("Log water event")
  );
  await act(async () => {
    openButton[0].props.onClick();
  });
  assert.equal(renderer.root.findAll((n: any) => n.type === "form").length, 1, "form is present once plants exist");
  await fillValid(renderer);
  await submit(renderer);
  await act(async () => {});
  assert.equal(listCalls, 2, "read-after-write refresh must call listWaterEvents again");
  assert.equal(eventsRef.length, 1);
  const createdId = eventsRef[0].water_event_id;
  const html = rendered(renderer);
  const rows = renderer.root.findAll((n: any) => n.type === "tr" && textContent(n).includes(createdId));
  assert.ok(rows.length >= 1, "a table row for the created event exists");
  assert.ok(html.includes("998.2 g"), "measured values of the created row are rendered");
  assert.ok(!html.includes("No water events recorded."), "empty state replaced after refresh");
});

test("R) the water flow never calls AICV/manual/position create methods", async () => {
  const eventsRef: WaterEvent[] = [];
  const renderer = create(
    <MemoryRouter>
      <WaterPage
        services={{
          plantService: { listPlants: async () => plants, getDayContext: async () => null },
          waterService: {
            listWaterEvents: async () => eventsRef,
            createWaterEvent: async (input) => {
              const created: WaterEvent = { ...persisted, water_event_id: input.water_event_id, timestamp: input.timestamp };
              eventsRef.push(created);
              return created;
            },
          },
        }}
      />
    </MemoryRouter>
  );
  await act(async () => {});
  const openButton = renderer.root.findAll(
    (n: any) => n.type === "button" && textContent(n).includes("Log water event")
  );
  await act(async () => {
    openButton[0].props.onClick();
  });
  await fillValid(renderer);
  await submit(renderer);
  await act(async () => {});
  assert.equal(eventsRef.length, 1, "only the water create path ran");
  // The WaterPage dependency surface exposes only plant + water services, so
  // manual/AICV/position creates are structurally unreachable from this flow.
  assert.ok(
    !rendered(renderer).includes("manual-measurements") && !rendered(renderer).includes("aicv-measurements"),
    "no unrelated write surfaces are referenced"
  );
});
