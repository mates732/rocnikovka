// Phase 4K.6 — Manual Measurement write UI tests (run with: npm test via tsx).
import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { act, create } from "react-test-renderer";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "../services/apiError";
import {
  buildManualMeasurementInput,
  emptyManualFormValues,
  generateManualMeasurementId,
  ManualMeasurementForm,
  MeasurementsPage,
  validateManualForm,
} from "./MeasurementsPage";
import type { AICVMeasurement, ImageRecord, ManualMeasurement, Plant } from "../types/entities";
import type { CreateManualMeasurementInput } from "../types/write";

const plants: Plant[] = [
  { plant_id: "PLT-001", pot_id: "P1", group_name: "G1", emergence_date: "2025-01-02", status: "active" },
  { plant_id: "PLT-002", pot_id: "P2", group_name: "G2", emergence_date: "2025-01-02", status: "active" },
];

const images: ImageRecord[] = [
  {
    image_id: "IMG-20250304-050000-001",
    plant_id: "PLT-001",
    timestamp: "2025-03-04T05:00:00",
    experiment_day: 14,
    image_path: "/app/server/server/storage/images/IMG-20250304-050000-001.jpg",
    camera_id: "CAM-1",
    image_quality_status: "PASS",
    calibration_status: "pass",
  },
  {
    image_id: "IMG-20250304-060000-001",
    plant_id: "PLT-001",
    timestamp: "2025-03-04T06:00:00",
    experiment_day: 14,
    image_path: "/app/server/server/storage/images/IMG-20250304-060000-001.jpg",
    camera_id: "CAM-1",
    image_quality_status: "PASS",
    calibration_status: "pass",
  },
  {
    image_id: "IMG-20250305-050000-001",
    plant_id: "PLT-002",
    timestamp: "2025-03-05T05:00:00",
    experiment_day: 15,
    image_path: "/app/server/server/storage/images/IMG-20250305-050000-001.jpg",
    camera_id: "CAM-1",
    image_quality_status: "PASS",
    calibration_status: "pass",
  },
  {
    // PLT-001 image on a different experiment day — used for the day-mismatch case.
    image_id: "IMG-20250306-050000-001",
    plant_id: "PLT-001",
    timestamp: "2025-03-06T05:00:00",
    experiment_day: 15,
    image_path: "/app/server/server/storage/images/IMG-20250306-050000-001.jpg",
    camera_id: "CAM-1",
    image_quality_status: "PASS",
    calibration_status: "pass",
  },
];

const persisted: ManualMeasurement = {
  measurement_id: "MSR-MAN-20250304-050607-099", // deliberately different from the client-generated id
  plant_id: "PLT-001",
  image_id: "IMG-20250304-050000-001",
  timestamp: "2025-03-04T05:06:07",
  experiment_day: 14,
  repetition: 1,
  attempt: 1,
  plant_height_cm: 12.5,
  observer: "Ada",
  measurement_status: "pass",
  method: "MANUAL",
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

/** Fill a valid PASS measurement (plant PLT-001, image on day 14, height present). */
async function fillValidPass(renderer: Renderer): Promise<void> {
  const entries: Array<[string, string]> = [
    ["plant_id", "PLT-001"],
    ["image_id", "IMG-20250304-050000-001"],
    ["timestamp", "2025-03-04T05:06"],
    ["experiment_day", "14"],
    ["repetition", "1"],
    ["attempt", "1"],
    ["plant_height_cm", "12.5"],
    ["observer", "Ada"],
    ["measurement_status", "pass"],
    ["failure_code", ""],
    ["notes", "Morning measurement"],
  ];
  for (const [name, value] of entries) {
    await change(renderer, name, value);
  }
}

type FormHarness = {
  renderer: Renderer;
  captured: CreateManualMeasurementInput[];
  createdIds: string[];
};

function renderForm(createImpl?: (input: CreateManualMeasurementInput) => Promise<ManualMeasurement>): FormHarness {
  const captured: CreateManualMeasurementInput[] = [];
  const createdIds: string[] = [];
  const renderer = create(
    <ManualMeasurementForm
      plants={plants}
      images={images}
      createManualMeasurement={async (input) => {
        captured.push(input);
        if (createImpl) return createImpl(input);
        return { ...persisted, measurement_id: input.measurement_id, timestamp: input.timestamp };
      }}
      onCreated={(created) => createdIds.push(created.measurement_id)}
      getDayContext={async () => null}
    />
  );
  return { renderer, captured, createdIds };
}

function validValues(overrides: Partial<Record<string, string>> = {}) {
  return {
    ...emptyManualFormValues(),
    plant_id: "PLT-001",
    image_id: "IMG-20250304-050000-001",
    timestamp: "2025-03-04T05:06",
    experiment_day: "14",
    repetition: "1",
    attempt: "1",
    plant_height_cm: "12.5",
    observer: "Ada",
    measurement_status: "pass",
    failure_code: "",
    notes: "Morning measurement",
    ...overrides,
  };
}

const selectedImage = images[0]; // PLT-001, day 14

// --- pure helpers -----------------------------------------------------------

test("AF) generateManualMeasurementId keeps the exact MSR-MAN-YYYYMMDD-HHMMSS-XXX backend format", () => {
  const first = generateManualMeasurementId("2025-03-04T05:06:07");
  assert.match(first, /^MSR-MAN-\d{8}-\d{6}-\d{3}$/);
  assert.equal(first, "MSR-MAN-20250304-050607-001", "deterministic first suffix");
  const second = generateManualMeasurementId("2025-03-04T05:06:07");
  const suffixA = Number(first.slice(-3));
  const suffixB = Number(second.slice(-3));
  assert.equal(suffixB, (suffixA + 1) % 1000, "session suffix advances deterministically");
});

test("AR) buildManualMeasurementInput is pure, sends the exact payload, and sets method MANUAL (AG/AH/AE/L)", () => {
  const first = buildManualMeasurementInput(validValues() as any, "MSR-MAN-20250304-050600-001");
  const second = buildManualMeasurementInput(validValues() as any, "MSR-MAN-20250304-050600-001");
  assert.deepEqual(first, second, "pure: identical inputs produce identical outputs");
  assert.deepEqual(first, {
    measurement_id: "MSR-MAN-20250304-050600-001",
    plant_id: "PLT-001",
    image_id: "IMG-20250304-050000-001",
    timestamp: "2025-03-04T05:06:00",
    experiment_day: 14,
    repetition: 1,
    attempt: 1,
    plant_height_cm: 12.5,
    observer: "Ada",
    measurement_status: "pass",
    method: "MANUAL",
    notes: "Morning measurement",
  });
  // L) timestamp normalized to :00; M) no timezone/Z conversion.
  assert.equal(first.timestamp, "2025-03-04T05:06:00");
  assert.ok(!first.timestamp.includes("Z") && !first.timestamp.includes("+"));
  // AH) only supported API fields — failure_code omitted (empty means none).
  assert.deepEqual(Object.keys(first).sort(), [
    "attempt",
    "experiment_day",
    "image_id",
    "measurement_id",
    "measurement_status",
    "method",
    "notes",
    "observer",
    "plant_height_cm",
    "plant_id",
    "repetition",
    "timestamp",
  ]);
  // AE) method is always MANUAL and never user-controlled.
  assert.equal(first.method, "MANUAL");
});

test("AD) notes are optional and omitted from the payload when empty", () => {
  const withNotes = buildManualMeasurementInput(validValues() as any, "MSR-MAN-20250304-050600-001");
  assert.equal(withNotes.notes, "Morning measurement");
  const withoutNotes = buildManualMeasurementInput(validValues({ notes: "  " }) as any, "MSR-MAN-20250304-050600-001");
  assert.equal("notes" in withoutNotes, false, "empty notes are omitted");
});

test("Q) repetition only accepts 1 or 2", () => {
  assert.deepEqual(validateManualForm(validValues(), selectedImage), [], "valid repetition passes");
  const empty = validateManualForm(validValues({ repetition: "" }), selectedImage).find((i) => i.field === "repetition");
  assert.equal(empty?.code, "required");
  const three = validateManualForm(validValues({ repetition: "3" } as any), selectedImage).find((i) => i.field === "repetition");
  assert.equal(three?.code, "enum.invalid");
});

test("R) attempt is required, defaults to 1 in the form, and accepts integers >= 1", async () => {
  const { renderer } = renderForm();
  assert.equal(fieldByName(renderer, "attempt").props.value, "1", "default UI value is 1");
  const empty = validateManualForm(validValues({ attempt: "" }), selectedImage).find((i) => i.field === "attempt");
  assert.equal(empty?.code, "required");
  const zero = validateManualForm(validValues({ attempt: "0" }), selectedImage).find((i) => i.field === "attempt");
  assert.equal(zero?.code, "number.out_of_range");
  const decimal = validateManualForm(validValues({ attempt: "1.5" }), selectedImage).find((i) => i.field === "attempt");
  assert.equal(decimal?.code, "number.out_of_range");
  const two = validateManualForm(validValues({ attempt: "2" }), selectedImage);
  assert.ok(!two.some((i) => i.field === "attempt"), "attempt 2 is accepted (retakes allowed)");
});

test("S/AT) attempt is never auto-derived and retakes face no client-side uniqueness rejection", async () => {
  const { renderer, captured } = renderForm();
  await fillValidPass(renderer);
  await submit(renderer);
  assert.equal(captured.length, 1);
  assert.equal(captured[0].attempt, 1);
  // After success the form resets to attempt 1 — it is not incremented from
  // the previous measurement (no derivation from existing data).
  assert.equal(fieldByName(renderer, "attempt").props.value, "1", "attempt resets to 1, not derived");
  // Same plant + experiment_day + repetition, higher attempt: second submit
  // must go through without any client-side uniqueness rejection.
  await fillValidPass(renderer);
  await change(renderer, "attempt", "2");
  await submit(renderer);
  assert.equal(captured.length, 2, "retake with attempt 2 is accepted");
  assert.equal(captured[1].attempt, 2);
  assert.equal(captured[1].plant_id, captured[0].plant_id);
  assert.equal(captured[1].experiment_day, captured[0].experiment_day);
  assert.equal(captured[1].repetition, captured[0].repetition);
});

test("T) a valid positive finite height is accepted and passed exactly", () => {
  assert.deepEqual(validateManualForm(validValues({ plant_height_cm: "12.50" }), selectedImage), []);
  const input = buildManualMeasurementInput(validValues({ plant_height_cm: "12.50" }) as any, "X");
  assert.equal(input.plant_height_cm, 12.5, "precision is not altered");
});

test("U) invalid height values are rejected", () => {
  for (const bad of ["abc", "12.3.4", "Infinity", "-1", "0"]) {
    const hit = validateManualForm(validValues({ plant_height_cm: bad, measurement_status: "warn" }), selectedImage).find(
      (i) => i.field === "plant_height_cm"
    );
    assert.ok(hit, `height ${JSON.stringify(bad)} must be rejected`);
  }
});

test("V) PASS requires a plant height", () => {
  const hit = validateManualForm(validValues({ plant_height_cm: "", measurement_status: "pass" }), selectedImage).find(
    (i) => i.field === "plant_height_cm"
  );
  assert.equal(hit?.code, "validation.height_required_for_pass");
});

test("W) PASS rejects a real failure code", () => {
  const hit = validateManualForm(validValues({ measurement_status: "pass", failure_code: "occlusion" }), selectedImage).find(
    (i) => i.field === "failure_code"
  );
  assert.equal(hit?.code, "validation.failure_code_invalid_for_pass");
});

test("X) WARN permits a missing height", () => {
  const issues = validateManualForm(
    validValues({ plant_height_cm: "", measurement_status: "warn", failure_code: "" }),
    selectedImage
  );
  assert.ok(!issues.some((i) => i.field === "plant_height_cm"), "WARN without height is valid");
});

test("Y) WARN permits a real failure code", () => {
  const issues = validateManualForm(
    validValues({ plant_height_cm: "12.5", measurement_status: "warn", failure_code: "occlusion" }),
    selectedImage
  );
  assert.ok(!issues.some((i) => i.field === "failure_code"), "WARN with a real failure code is valid");
  const input = buildManualMeasurementInput(
    validValues({ plant_height_cm: "12.5", measurement_status: "warn", failure_code: "occlusion" }) as any,
    "X"
  );
  assert.equal(input.failure_code, "occlusion");
});

test("Z) FAIL requires a real failure code and rejects 'none'", () => {
  const missing = validateManualForm(
    validValues({ measurement_status: "fail", failure_code: "" }),
    selectedImage
  ).find((i) => i.field === "failure_code");
  assert.equal(missing?.code, "validation.failure_code_required_for_fail");
  const none = validateManualForm(
    validValues({ measurement_status: "fail", failure_code: "none" }),
    selectedImage
  ).find((i) => i.field === "failure_code");
  assert.equal(none?.code, "validation.failure_code_none_invalid_for_fail");
});

test("AA) FAIL may omit height", () => {
  const issues = validateManualForm(
    validValues({ plant_height_cm: "", measurement_status: "fail", failure_code: "plant_damaged" }),
    selectedImage
  );
  assert.ok(!issues.some((i) => i.field === "plant_height_cm"), "FAIL without height is valid");
});

test("AB) failure-code options use exactly the backend enum values", () => {
  const { renderer } = renderForm();
  const select = fieldByName(renderer, "failure_code");
  const values = select.findAll((n: any) => n.type === "option").map((o: any) => o.props.value);
  const expectedWhenUnset = [
    "",
    "no_detection",
    "poor_image_quality",
    "occlusion",
    "plant_damaged",
    "plant_dead",
    "calibration_failed",
  ];
  assert.deepEqual(values, expectedWhenUnset, "None + the six real codes when status is unset");
  // FAIL status: only real codes, never "none".
  act(() => {
    fieldByName(renderer, "measurement_status").props.onChange({ target: { name: "measurement_status", value: "fail" } });
  });
  const failValues = fieldByName(renderer, "failure_code")
    .findAll((n: any) => n.type === "option")
    .map((o: any) => o.props.value);
  assert.deepEqual(failValues, expectedWhenUnset.slice(1), "FAIL offers only real codes");
  // PASS status: only None.
  act(() => {
    fieldByName(renderer, "measurement_status").props.onChange({ target: { name: "measurement_status", value: "pass" } });
  });
  const passValues = fieldByName(renderer, "failure_code")
    .findAll((n: any) => n.type === "option")
    .map((o: any) => o.props.value);
  assert.deepEqual(passValues, [""], "PASS offers only None");
});

test("AC) observer is required and whitespace-only is rejected", () => {
  const missing = validateManualForm(validValues({ observer: "" }), selectedImage).find((i) => i.field === "observer");
  assert.equal(missing?.code, "required");
  const whitespace = validateManualForm(validValues({ observer: "   " }), selectedImage).find((i) => i.field === "observer");
  assert.equal(whitespace?.code, "required");
});

test("N/O/AS) experiment_day is required and never derived from the timestamp", () => {
  // A fully valid timestamp alone never supplies experiment_day.
  const issues = validateManualForm(validValues({ experiment_day: "" }), selectedImage);
  assert.ok(issues.some((i) => i.field === "experiment_day" && i.code === "required"));
  const nonInteger = validateManualForm(validValues({ experiment_day: "14.5" }), selectedImage).find(
    (i) => i.field === "experiment_day"
  );
  assert.equal(nonInteger?.code, "number.out_of_range");
});

test("I) an image belonging to another plant is rejected locally", () => {
  const issues = validateManualForm(
    validValues({ plant_id: "PLT-002", image_id: "IMG-20250304-050000-001" }),
    selectedImage
  );
  const hit = issues.find((i) => i.field === "plant_id");
  assert.ok(hit, "plant mismatch must be reported");
  assert.equal(hit.code, "validation.plant_id_mismatch");
});

test("J/P) experiment_day must match the selected image's experiment day", () => {
  const day15Image = images[3]; // PLT-001 image on day 15
  const issues = validateManualForm(validValues({ image_id: "IMG-20250306-050000-001", experiment_day: "14" }), day15Image);
  const hit = issues.find((i) => i.field === "experiment_day");
  assert.ok(hit, "day mismatch must be reported");
  assert.equal(hit.code, "validation.experiment_day_mismatch");
  assert.ok(hit.message.includes("15"), "message names the image's actual experiment day");
});

test("G) image selector contains only real persisted image ids (no fake ids)", () => {
  const { renderer } = renderForm();
  const select = fieldByName(renderer, "image_id");
  const values = select.findAll((n: any) => n.type === "option").map((o: any) => o.props.value);
  const realValues = values.filter(Boolean);
  assert.ok(
    realValues.every((v: string) => images.some((img) => img.image_id === v)),
    "every image option maps to a real persisted image"
  );
  assert.ok(!realValues.some((v: string) => v.startsWith("FAKE")), "no invented image ids");
});

test("F) image selector uses real persisted images, filtered to the selected plant, with distinguishing info", async () => {
  const { renderer } = renderForm();
  // Before a plant is selected no image options exist (filter needs a plant).
  const select = fieldByName(renderer, "image_id");
  assert.deepEqual(select.findAll((n: any) => n.type === "option").map((o: any) => o.props.value), [""]);
  await change(renderer, "plant_id", "PLT-001");
  const values = fieldByName(renderer, "image_id")
    .findAll((n: any) => n.type === "option")
    .map((o: any) => o.props.value);
  assert.deepEqual(new Set(values), new Set(["", "IMG-20250304-050000-001", "IMG-20250304-060000-001", "IMG-20250306-050000-001"]));
  const html = rendered(renderer);
  assert.ok(html.includes("IMG-20250304-050000-001 · day 14 · 2025-03-04T05:00:00"), "options distinguish images");
});

test("H) changing the plant clears an incompatible image selection", async () => {
  const { renderer } = renderForm();
  await change(renderer, "plant_id", "PLT-001");
  await change(renderer, "image_id", "IMG-20250304-050000-001");
  assert.equal(fieldByName(renderer, "image_id").props.value, "IMG-20250304-050000-001");
  await change(renderer, "plant_id", "PLT-002");
  assert.equal(fieldByName(renderer, "image_id").props.value, "", "incompatible image is cleared, never substituted");
});

test("D-local) an empty form cannot reach the backend and shows local required messages", async () => {
  const { renderer, captured } = renderForm();
  await submit(renderer);
  assert.equal(captured.length, 0, "empty form must not reach the backend");
  const html = rendered(renderer);
  for (const message of [
    "Select a plant.",
    "Timestamp is required.",
    "Experiment day is required.",
    "Select a repetition (1 or 2).",
    "Observer is required.",
    "Select a measurement status.",
  ]) {
    assert.ok(html.includes(message), `expected local message "${message}"`);
  }
  // attempt defaults to 1 (never derived), so it is not a required-error here;
  // attempt validation itself is covered by test R.
  assert.ok(html.includes("Retake counter; never derived from existing measurements."), "attempt hint is visible");
});

test("E/AI) valid submission calls createManualMeasurement once with the exact explicit payload", async () => {
  const { renderer, captured } = renderForm();
  await fillValidPass(renderer);
  await submit(renderer);
  assert.equal(captured.length, 1);
  const payload = captured[0];
  assert.match(payload.measurement_id, /^MSR-MAN-20250304-050600-\d{3}$/);
  // E) plant_id is exactly the persisted selected plant id.
  assert.equal(payload.plant_id, "PLT-001");
  assert.deepEqual(payload, {
    measurement_id: payload.measurement_id,
    plant_id: "PLT-001",
    image_id: "IMG-20250304-050000-001",
    timestamp: "2025-03-04T05:06:00",
    experiment_day: 14,
    repetition: 1,
    attempt: 1,
    plant_height_cm: 12.5,
    observer: "Ada",
    measurement_status: "pass",
    method: "MANUAL",
    notes: "Morning measurement",
  });
});

test("AJ) success uses the persisted object returned by the backend", async () => {
  const { renderer, captured } = renderForm(async () => ({ ...persisted })); // returns MSR-MAN-...-099
  await fillValidPass(renderer);
  await submit(renderer);
  assert.equal(captured.length, 1);
  const html = rendered(renderer);
  assert.ok(
    html.includes("Manual measurement MSR-MAN-20250304-050607-099 recorded."),
    "success message shows the backend-returned id"
  );
  assert.ok(!html.includes("MSR-MAN-20250304-050600-001"), "the client-generated id is not claimed as persisted");
});

test("AL) successful creation resets the form while preserving the plant selection", async () => {
  const { renderer } = renderForm();
  await fillValidPass(renderer);
  await submit(renderer);
  const html = rendered(renderer);
  assert.ok(html.includes("Manual measurement ") && html.includes(" recorded."), "success confirmation shown");
  assert.equal(fieldByName(renderer, "plant_id").props.value, "PLT-001", "plant selection is kept");
  assert.equal(fieldByName(renderer, "image_id").props.value, "", "image selection resets");
  assert.equal(fieldByName(renderer, "timestamp").props.value, "", "timestamp resets");
  assert.equal(fieldByName(renderer, "experiment_day").props.value, "", "experiment day resets");
  assert.equal(fieldByName(renderer, "repetition").props.value, "", "repetition resets");
  assert.equal(fieldByName(renderer, "attempt").props.value, "1", "attempt resets to the default");
  assert.equal(fieldByName(renderer, "plant_height_cm").props.value, "", "height resets");
  assert.equal(fieldByName(renderer, "observer").props.value, "", "observer resets");
  assert.equal(fieldByName(renderer, "measurement_status").props.value, "", "status resets");
});

test("AM) failed submission preserves every entered value and renders the ApiError via ErrorSummary", async () => {
  const apiError = new ApiError(400, "manual_measurement.validation_failed", "Invalid manual measurement", [
    { field: "plant_height_cm", code: "number.out_of_range", message: "height must be finite and positive" },
  ]);
  const { renderer } = renderForm(async () => {
    throw apiError;
  });
  await fillValidPass(renderer);
  await submit(renderer);
  const html = rendered(renderer);
  assert.equal(fieldByName(renderer, "plant_height_cm").props.value, "12.5", "entered value preserved");
  assert.equal(fieldByName(renderer, "timestamp").props.value, "2025-03-04T05:06", "entered value preserved");
  assert.equal(fieldByName(renderer, "notes").props.value, "Morning measurement", "entered value preserved");
  assert.ok(html.includes("Invalid manual measurement"), "backend message rendered");
  assert.ok(html.includes("manual_measurement.validation_failed"), "error code rendered");
  assert.ok(!html.includes("recorded."), "no success message on failure");
});

test("AN) a 400 validation ApiError renders structured field-level issues", async () => {
  const apiError = new ApiError(400, "manual_measurement.validation_failed", "Invalid manual measurement", [
    { field: "failure_code", code: "validation.failure_code_required_for_fail", message: "a 'fail' measurement needs a failure code" },
  ]);
  const { renderer } = renderForm(async () => {
    throw apiError;
  });
  await fillValidPass(renderer);
  await submit(renderer);
  const html = rendered(renderer);
  assert.ok(html.includes("Validation failed"), "status-aware label");
  assert.ok(html.includes("failure_code"), "issue field rendered");
  assert.ok(html.includes("validation.failure_code_required_for_fail"), "issue code rendered");
});

test("AO) a 409 id.duplicate conflict is rendered correctly and stays retryable", async () => {
  const apiError = new ApiError(409, "id.duplicate", "Duplicate measurement_id with conflicting content", [
    { field: "measurement_id", code: "id.conflict", message: "an identical or conflicting row is already persisted" },
  ]);
  const { renderer } = renderForm(async () => {
    throw apiError;
  });
  await fillValidPass(renderer);
  await submit(renderer);
  const html = rendered(renderer);
  assert.ok(html.includes("Conflict"), "conflict label");
  assert.ok(html.includes("id.duplicate"), "backend code preserved");
  assert.ok(html.includes("id.conflict"), "issue code preserved");
  assert.equal(fieldByName(renderer, "plant_id").props.value, "PLT-001", "form remains editable for retry");
});

test("AP) submit is disabled while the request is in flight", async () => {
  let resolveCreate!: (m: ManualMeasurement) => void;
  const createImpl = (_input: CreateManualMeasurementInput) =>
    new Promise<ManualMeasurement>((resolve) => {
      resolveCreate = resolve;
    });
  const { renderer, captured } = renderForm(createImpl);
  await fillValidPass(renderer);
  await submit(renderer);
  assert.equal(captured.length, 1);
  const findSubmit = () =>
    renderer.root.findAll((n: any) => n.type === "button").find((b: any) => b.props.type === "submit");
  assert.equal(findSubmit().props.disabled, true, "submit must be disabled during the request");
  assert.ok(JSON.stringify(findSubmit().props.children).includes("Saving manual measurement"), "submitting state visible");
  await act(async () => {
    resolveCreate({ ...persisted });
  });
  assert.equal(findSubmit().props.disabled, false, "submit re-enabled after completion");
});

// --- page-level integration -------------------------------------------------

type MeasurementPageServices = {
  plantService: { listPlants: () => Promise<Plant[]>; getDayContext: () => Promise<null> };
  imageService: { listImages: () => Promise<ImageRecord[]> };
  measurementService: {
    listManualMeasurements: () => Promise<ManualMeasurement[]>;
    listAICVMeasurements: () => Promise<AICVMeasurement[]>;
    createManualMeasurement: (input: CreateManualMeasurementInput) => Promise<ManualMeasurement>;
  };
};

function renderPage(services: MeasurementPageServices): Renderer {
  return create(
    <MemoryRouter>
      <MeasurementsPage services={services} />
    </MemoryRouter>
  );
}

function openForm(renderer: Renderer): void {
  const openButton = renderer.root.findAll(
    (n: any) => n.type === "button" && textContent(n).includes("Log manual measurement")
  );
  assert.equal(openButton.length, 1, "header action button is present");
  act(() => {
    openButton[0].props.onClick();
  });
}

test("A) the form opens from MeasurementsPage via the header action", async () => {
  const renderer = renderPage({
    plantService: { listPlants: async () => plants, getDayContext: async () => null },
    imageService: { listImages: async () => images },
    measurementService: {
      listManualMeasurements: async () => [],
      listAICVMeasurements: async () => [],
      createManualMeasurement: async () => persisted,
    },
  });
  await act(async () => {});
  openForm(renderer);
  const html = rendered(renderer);
  assert.ok(html.includes("Log manual measurement"), "form panel heading present");
  assert.equal(renderer.root.findAll((n: any) => n.type === "form").length, 1, "form is present once plants exist");
  assert.ok(fieldByName(renderer, "observer"), "manual fields are rendered");
});

test("B) real plants are loaded through PlantService and their exact ids are selectable", async () => {
  const renderer = renderPage({
    plantService: { listPlants: async () => plants, getDayContext: async () => null },
    imageService: { listImages: async () => images },
    measurementService: {
      listManualMeasurements: async () => [],
      listAICVMeasurements: async () => [],
      createManualMeasurement: async () => persisted,
    },
  });
  await act(async () => {});
  openForm(renderer);
  const select = fieldByName(renderer, "plant_id");
  const values = select.findAll((n: any) => n.type === "option").map((o: any) => o.props.value);
  assert.deepEqual(new Set(values), new Set(["", "PLT-001", "PLT-002"]));
  const html = rendered(renderer);
  assert.ok(html.includes("PLT-001 · pot P1"), "plant id and pot context shown in options");
});

test("C) no fake plants exist (every option maps to a real persisted plant)", () => {
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

test("D) no plants → explicit empty state and form submission is impossible", async () => {
  const renderer = renderPage({
    plantService: { listPlants: async () => [], getDayContext: async () => null },
    imageService: { listImages: async () => images },
    measurementService: {
      listManualMeasurements: async () => [],
      listAICVMeasurements: async () => [],
      createManualMeasurement: async () => persisted,
    },
  });
  await act(async () => {});
  openForm(renderer);
  const html = rendered(renderer);
  assert.ok(html.includes("No plants are registered yet"), "explicit empty state");
  assert.equal(renderer.root.findAll((n: any) => n.type === "form").length, 0, "no form rendered without plants");
});

test("AK) page-level: successful create refreshes the manual measurement list from the backend", async () => {
  const measurementsRef: ManualMeasurement[] = [];
  let listCalls = 0;
  const renderer = renderPage({
    plantService: { listPlants: async () => plants, getDayContext: async () => null },
    imageService: { listImages: async () => images },
    measurementService: {
      listManualMeasurements: async () => {
        listCalls += 1;
        return [...measurementsRef]; // fresh array per call like the real HTTP adapter
      },
      listAICVMeasurements: async () => [],
      createManualMeasurement: async (input) => {
        const created: ManualMeasurement = {
          ...persisted,
          measurement_id: input.measurement_id,
          timestamp: input.timestamp,
          image_id: input.image_id,
          plant_height_cm: input.plant_height_cm,
          measurement_status: input.measurement_status,
        };
        measurementsRef.push(created);
        return created;
      },
    },
  });
  await act(async () => {});
  assert.equal(listCalls, 1, "initial list load");
  openForm(renderer);
  await fillValidPass(renderer);
  await submit(renderer);
  await act(async () => {});
  assert.equal(listCalls, 2, "read-after-write refresh must call listManualMeasurements again");
  assert.equal(measurementsRef.length, 1);
  const createdId = measurementsRef[0].measurement_id;
  const rows = renderer.root.findAll((n: any) => n.type === "tr" && textContent(n).includes(createdId));
  assert.ok(rows.length >= 1, "a table row for the created measurement exists");
  const html = rendered(renderer);
  assert.ok(html.includes("12.5"), "height of the created row is rendered");
  assert.ok(!html.includes("No manual measurements recorded."), "empty state replaced after refresh");
});

test("AQ) the manual flow never calls water/position/AICV create methods", async () => {
  const measurementsRef: ManualMeasurement[] = [];
  const createdRef: CreateManualMeasurementInput[] = [];
  const renderer = renderPage({
    plantService: { listPlants: async () => plants, getDayContext: async () => null },
    imageService: { listImages: async () => images },
    measurementService: {
      listManualMeasurements: async () => measurementsRef,
      listAICVMeasurements: async () => [],
      createManualMeasurement: async (input) => {
        createdRef.push(input);
        const created: ManualMeasurement = { ...persisted, measurement_id: input.measurement_id, timestamp: input.timestamp };
        measurementsRef.push(created);
        return created;
      },
    },
  });
  await act(async () => {});
  openForm(renderer);
  await fillValidPass(renderer);
  await submit(renderer);
  await act(async () => {});
  assert.equal(createdRef.length, 1, "exactly one create went through the injected measurement service");
  // The page dependency surface exposes only plant/image/measurement services,
  // so water/position/AICV creates are structurally unreachable from this flow.
  const html = rendered(renderer);
  assert.ok(
    !html.includes("water-events") && !html.includes("position-events") && !html.includes("aicv-measurements"),
    "no unrelated write surfaces are referenced"
  );
});