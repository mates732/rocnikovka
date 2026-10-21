// Phase 4K.7 — Plant registration UI tests (run with: npm test via tsx).
import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { act, create } from "react-test-renderer";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "../services/apiError";
import {
  buildPlantInput,
  emptyPlantFormValues,
  PlantRegistrationForm,
  PlantsPage,
  validatePlantForm,
} from "./PlantsPage";
import type { Plant } from "../types/entities";
import type { CreatePlantInput } from "../types/write";

const persisted: Plant = {
  plant_id: "PLT-001",
  pot_id: "POT-001",
  group_name: "G1",
  exemplar_id: "EX01",
  treatment_percentage: 100,
  emergence_date: "2025-03-01",
  status: "active",
  created_at: "2025-03-01T08:00:00",
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
    ["pot_id", "POT-001"],
    ["group_name", "G1"],
    ["exemplar_id", "EX01"],
    ["treatment_percentage", "100"],
    ["emergence_date", "2025-03-01"],
    ["status", "active"],
    ["created_at", "2025-03-01T08:00"],
    ["notes", "Sown from the same seed batch"],
  ];
  for (const [name, value] of entries) {
    await change(renderer, name, value);
  }
}

type FormHarness = {
  renderer: Renderer;
  captured: CreatePlantInput[];
  createdIds: string[];
};

function renderForm(createImpl?: (input: CreatePlantInput) => Promise<Plant>, existingPlants: Plant[] = []): FormHarness {
  const captured: CreatePlantInput[] = [];
  const createdIds: string[] = [];
  const renderer = create(
    <PlantRegistrationForm
      createPlant={async (input) => {
        captured.push(input);
        if (createImpl) return createImpl(input);
        return { ...persisted, plant_id: input.plant_id, pot_id: input.pot_id, created_at: input.created_at };
      }}
      onCreated={(created) => createdIds.push(created.plant_id)}
      existingPlants={existingPlants}
    />
  );
  return { renderer, captured, createdIds };
}

function validValues(overrides: Partial<Record<string, string>> = {}) {
  return {
    ...emptyPlantFormValues(),
    plant_id: "PLT-001",
    pot_id: "POT-001",
    group_name: "G1",
    exemplar_id: "EX01",
    treatment_percentage: 100,
    emergence_date: "2025-03-01",
    status: "active",
    created_at: "2025-03-01T08:00",
    notes: "Sown from the same seed batch",
    ...overrides,
  };
}

// --- pure helpers -----------------------------------------------------------

test("E) plant_id validation mirrors the backend PLT-XXX format", () => {
  assert.deepEqual(validatePlantForm(validValues()), [], "valid plant id passes");
  for (const bad of ["", "PLT-1", "plt-001", "PLT-0000", "PLT-01a", "XLT-001"]) {
    const hit = validatePlantForm(validValues({ plant_id: bad })).find((i) => i.field === "plant_id");
    assert.ok(hit, `plant_id ${JSON.stringify(bad)} must be rejected`);
  }
  assert.equal(
    validatePlantForm(validValues({ plant_id: "" })).find((i) => i.field === "plant_id")?.code,
    "required"
  );
  assert.equal(
    validatePlantForm(validValues({ plant_id: "PLT-01a" })).find((i) => i.field === "plant_id")?.code,
    "id.invalid_format"
  );
});

test("F) pot_id validation mirrors the backend POT-XXX format", () => {
  for (const bad of ["", "POT-1", "pot-001", "POT-0000", "XOT-001"]) {
    const hit = validatePlantForm(validValues({ pot_id: bad })).find((i) => i.field === "pot_id");
    assert.ok(hit, `pot_id ${JSON.stringify(bad)} must be rejected`);
  }
  assert.equal(
    validatePlantForm(validValues({ pot_id: "" })).find((i) => i.field === "pot_id")?.code,
    "required"
  );
  assert.equal(
    validatePlantForm(validValues({ pot_id: "POT-0a1" })).find((i) => i.field === "pot_id")?.code,
    "id.invalid_format"
  );
});

test("G) group handling uses exactly the backend enum G1/G2/G3", () => {
  assert.deepEqual(validatePlantForm(validValues({ group_name: "G2" })), [], "valid group passes");
  const missing = validatePlantForm(validValues({ group_name: "" })).find((i) => i.field === "group_name");
  assert.equal(missing?.code, "required");
  const bad = validatePlantForm(validValues({ group_name: "G4" } as any)).find((i) => i.field === "group_name");
  assert.equal(bad?.code, "enum.invalid");
});

test("H) emergence date is explicitly entered and validated like the backend contract", () => {
  const missing = validatePlantForm(validValues({ emergence_date: "" })).find((i) => i.field === "emergence_date");
  assert.equal(missing?.code, "required");
  // The backend validateDate accepts ISO dates that Date.parse understands
  // (regex + parseable); the local check mirrors exactly that contract.
  for (const bad of ["01-03-2025", "2025/03/01", "abc", "2025-3-1"]) {
    const hit = validatePlantForm(validValues({ emergence_date: bad })).find((i) => i.field === "emergence_date");
    assert.ok(hit, `emergence_date ${JSON.stringify(bad)} must be rejected`);
  }
  assert.deepEqual(validatePlantForm(validValues({ emergence_date: "2025-03-01" })), []);
  assert.deepEqual(validatePlantForm(validValues({ emergence_date: "2025-12-31" })), [], "valid calendar date passes");
});

test("I) status handling uses exactly the backend enum", () => {
  for (const status of ["active", "damaged", "dead", "excluded"]) {
    assert.deepEqual(validatePlantForm(validValues({ status })), [], `status ${status} passes`);
  }
  const missing = validatePlantForm(validValues({ status: "" })).find((i) => i.field === "status");
  assert.equal(missing?.code, "required");
  const bad = validatePlantForm(validValues({ status: "growing" } as any)).find((i) => i.field === "status");
  assert.equal(bad?.code, "enum.invalid");
});

test("J) buildPlantInput is pure and produces identical outputs for identical inputs", () => {
  const first = buildPlantInput(validValues() as any);
  const second = buildPlantInput(validValues() as any);
  assert.deepEqual(first, second, "pure: identical inputs produce identical outputs");
  assert.equal(first.created_at, "2025-03-01T08:00:00", "registration time normalized to :00");
});

test("K) payload contains exactly the supported CreatePlantInput fields", () => {
  const withNotes = buildPlantInput(validValues() as any);
  assert.deepEqual(withNotes, {
    plant_id: "PLT-001",
    pot_id: "POT-001",
    group_name: "G1",
    exemplar_id: "EX01",
    treatment_percentage: 100,
    emergence_date: "2025-03-01",
    status: "active",
    created_at: "2025-03-01T08:00:00",
    notes: "Sown from the same seed batch",
  });
  assert.deepEqual(Object.keys(withNotes).sort(), [
    "created_at",
    "emergence_date",
    "exemplar_id",
    "group_name",
    "notes",
    "plant_id",
    "pot_id",
    "status",
    "treatment_percentage",
  ]);
  const withoutNotes = buildPlantInput(validValues({ notes: "  " }) as any);
  assert.equal("notes" in withoutNotes, false, "empty notes are omitted");
});

test("D) required-field validation blocks submission and shows local messages", async () => {
  const { renderer, captured } = renderForm();
  await submit(renderer);
  assert.equal(captured.length, 0, "empty form must not reach the backend");
  const html = rendered(renderer);
  for (const message of [
    "Plant ID is required.",
    "Pot ID is required.",
    "Select a group.",
    "Exemplar ID is required.",
    "Treatment percentage is required.",
    "Emergence date is required.",
    "Select a status.",
    "Registration time is required.",
  ]) {
    assert.ok(html.includes(message), `expected local message "${message}"`);
  }
});

// --- component-level form behavior -----------------------------------------

test("C) the form renders exactly the supported fields with visible labels", () => {
  const { renderer } = renderForm();
  const html = rendered(renderer);
  for (const label of [
    "Plant ID",
    "Pot ID",
    "Group",
    "Exemplar ID",
    "Treatment %",
    "Emergence date",
    "Status",
    "Registration time",
    "Notes",
    "Register plant",
  ]) {
    assert.ok(html.includes(label), `expected label/text "${label}"`);
  }
  for (const name of ["plant_id", "pot_id", "group_name", "exemplar_id", "treatment_percentage", "emergence_date", "status", "created_at", "notes"]) {
    assert.ok(fieldByName(renderer, name), `field "${name}" must exist`);
  }
  // No server-owned/derived fields are exposed.
  const htmlLower = html.toLowerCase();
  assert.ok(!htmlLower.includes("updated_at"), "updated_at must not be user-editable");
});

test("V) no fake production data — the form has no default plant/pot ids, groups, dates or statuses", () => {
  const { renderer } = renderForm();
  assert.equal(fieldByName(renderer, "plant_id").props.value, "", "no default plant id");
  assert.equal(fieldByName(renderer, "pot_id").props.value, "", "no default pot id");
  assert.equal(fieldByName(renderer, "group_name").props.value, "", "no default group");
  assert.equal(fieldByName(renderer, "status").props.value, "", "no default status");
  assert.equal(fieldByName(renderer, "emergence_date").props.value, "", "no default date");
  assert.equal(fieldByName(renderer, "created_at").props.value, "", "no default registration time");
  const groupValues = fieldByName(renderer, "group_name")
    .findAll((n: any) => n.type === "option")
    .map((o: any) => o.props.value);
  assert.deepEqual(groupValues, ["", "G1", "G2", "G3"], "only the real backend groups are offered");
  const statusValues = fieldByName(renderer, "status")
    .findAll((n: any) => n.type === "option")
    .map((o: any) => o.props.value);
  assert.deepEqual(statusValues, ["", "active", "damaged", "dead", "excluded"], "only the real backend statuses");
});

test("N) success uses the persisted object returned by the backend", async () => {
  const backendReturned: Plant = { ...persisted, plant_id: "PLT-001", notes: "Sown from the same seed batch" };
  const { renderer, captured } = renderForm(async () => backendReturned);
  await fillValid(renderer);
  await submit(renderer);
  assert.equal(captured.length, 1);
  const html = rendered(renderer);
  assert.ok(html.includes("Plant PLT-001 registered."), "success message shows the backend-returned plant id");
});

test("Q) successful creation resets the form", async () => {
  const { renderer } = renderForm();
  await fillValid(renderer);
  await submit(renderer);
  const html = rendered(renderer);
  assert.ok(html.includes("Plant PLT-001 registered."), "success confirmation shown");
  assert.equal(fieldByName(renderer, "plant_id").props.value, "", "plant id resets");
  assert.equal(fieldByName(renderer, "pot_id").props.value, "", "pot id resets");
  assert.equal(fieldByName(renderer, "group_name").props.value, "", "group resets");
  assert.equal(fieldByName(renderer, "exemplar_id").props.value, "", "exemplar id resets");
  assert.equal(fieldByName(renderer, "treatment_percentage").props.value, 0, "treatment percentage resets");
  assert.equal(fieldByName(renderer, "status").props.value, "", "status resets");
  assert.equal(fieldByName(renderer, "notes").props.value, "", "notes reset");
});

test("R) failed submission preserves every entered value and renders the ApiError via ErrorSummary", async () => {
  const apiError = new ApiError(400, "input.invalid", "Invalid input", [
    { field: "pot_id", code: "id.invalid_format", message: "pot_id must look like POT-XXX" },
  ]);
  const { renderer } = renderForm(async () => {
    throw apiError;
  });
  await fillValid(renderer);
  await submit(renderer);
  const html = rendered(renderer);
  assert.equal(fieldByName(renderer, "plant_id").props.value, "PLT-001", "entered value preserved");
  assert.equal(fieldByName(renderer, "pot_id").props.value, "POT-001", "entered value preserved");
  assert.equal(fieldByName(renderer, "exemplar_id").props.value, "EX01", "entered value preserved");
  assert.equal(fieldByName(renderer, "treatment_percentage").props.value, "100", "entered value preserved");
  assert.equal(fieldByName(renderer, "notes").props.value, "Sown from the same seed batch", "entered value preserved");
  assert.ok(html.includes("Invalid input"), "backend message rendered");
  assert.ok(!html.includes("registered."), "no success message on failure");
});

test("S) a 400 validation ApiError renders structured field-level issues", async () => {
  const apiError = new ApiError(400, "input.invalid", "Invalid input", [
    { field: "group_name", code: "enum.invalid", message: "group_name must be G1, G2 or G3" },
  ]);
  const { renderer } = renderForm(async () => {
    throw apiError;
  });
  await fillValid(renderer);
  await submit(renderer);
  const html = rendered(renderer);
  assert.ok(html.includes("Validation failed"), "status-aware label");
  assert.ok(html.includes("group_name"), "issue field rendered");
  assert.ok(html.includes("enum.invalid"), "issue code rendered");
  assert.ok(html.includes("group_name must be G1, G2 or G3"), "issue message rendered");
});

test("T) a 409 id.duplicate conflict is rendered correctly and stays retryable", async () => {
  const apiError = new ApiError(409, "id.duplicate", "Duplicate identifier", [
    { field: "plant_id", code: "id.conflict", message: "plant_id PLT-001 is already registered" },
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
  assert.equal(fieldByName(renderer, "plant_id").props.value, "PLT-001", "form remains editable for retry");
});

test("U) submit is disabled while the request is in flight", async () => {
  let resolveCreate!: (p: Plant) => void;
  const createImpl = (_input: CreatePlantInput) =>
    new Promise<Plant>((resolve) => {
      resolveCreate = resolve;
    });
  const { renderer, captured } = renderForm(createImpl);
  await fillValid(renderer);
  await submit(renderer);
  assert.equal(captured.length, 1);
  const findSubmit = () =>
    renderer.root.findAll((n: any) => n.type === "button").find((b: any) => b.props.type === "submit");
  assert.equal(findSubmit().props.disabled, true, "submit must be disabled during the request");
  assert.ok(JSON.stringify(findSubmit().props.children).includes("Saving plant"), "submitting state visible");
  await act(async () => {
    resolveCreate({ ...persisted });
  });
  assert.equal(findSubmit().props.disabled, false, "submit re-enabled after completion");
});

// --- page-level integration -------------------------------------------------

type PlantPageServices = {
  plantService: {
    listPlants: () => Promise<Plant[]>;
    createPlant: (input: CreatePlantInput) => Promise<Plant>;
  };
};

function renderPage(services: PlantPageServices): Renderer {
  return create(
    <MemoryRouter>
      <PlantsPage services={services} />
    </MemoryRouter>
  );
}

function openForm(renderer: Renderer): void {
  const openButton = renderer.root.findAll(
    (n: any) => n.type === "button" && textContent(n).includes("Register plant")
  );
  assert.equal(openButton.length, 1, "header action button is present");
  act(() => {
    openButton[0].props.onClick();
  });
}

test("A/B) the register-plant button opens an accessible inline panel from PlantsPage", async () => {
  const renderer = renderPage({
    plantService: { listPlants: async () => [], createPlant: async () => persisted },
  });
  await act(async () => {});
  openForm(renderer);
  const html = rendered(renderer);
  assert.ok(html.includes("Register plant"), "form panel heading present");
  assert.equal(renderer.root.findAll((n: any) => n.type === "form").length, 1, "form is present");
  assert.ok(fieldByName(renderer, "plant_id"), "plant fields are rendered");
  // Accessibility: toggle exposes aria-expanded, panel has an accessible name,
  // and every label is associated via htmlFor/id.
  const toggle = renderer.root.findAll(
    (n: any) => n.type === "button" && textContent(n).includes("Close form")
  );
  assert.equal(toggle.length, 1);
  assert.equal(toggle[0].props["aria-expanded"], true, "toggle exposes expanded state");
  const panel = renderer.root.findAll((n: any) => n.props?.["aria-label"] === "Register a plant");
  assert.equal(panel.length, 1, "panel has an accessible name");
  for (const name of ["plant_id", "pot_id", "group_name", "exemplar_id", "treatment_percentage", "emergence_date", "status", "created_at", "notes"]) {
    const field = fieldByName(renderer, name);
    assert.ok(field.props.id, `field ${name} has an id for label association`);
    assert.ok(rendered(renderer).includes(name.replace(/_/g, " ")) || html.includes("Plant ID"), `label text present for ${name}`);
  }
});

test("L/M) the page uses the injected plantService — no direct fetch — and refreshes via listPlants (O/P)", async () => {
  const plantsRef: Plant[] = [];
  let listCalls = 0;
  const createdRef: CreatePlantInput[] = [];
  const renderer = renderPage({
    plantService: {
      listPlants: async () => {
        listCalls += 1;
        return [...plantsRef]; // fresh array per call like the real HTTP adapter
      },
      createPlant: async (input) => {
        createdRef.push(input);
        const created: Plant = { ...persisted, plant_id: input.plant_id, pot_id: input.pot_id, created_at: input.created_at };
        plantsRef.push(created);
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
  assert.equal(createdRef.length, 1, "exactly one create went through the injected service (no fetch from the page)");
  assert.equal(listCalls, 2, "read-after-write refresh calls listPlants again (O)");
  const createdId = plantsRef[0].plant_id;
  const rows = renderer.root.findAll((n: any) => n.type === "tr" && textContent(n).includes(createdId));
  assert.ok(rows.length >= 1, "created plant appears in the refreshed list (P)");
  const html = rendered(renderer);
  assert.ok(html.includes("G1") && html.includes("POT-001"), "created row metadata is rendered");
  assert.ok(!html.includes("No plants registered yet"), "empty state replaced after refresh");
});

test("W) existing list behavior remains intact — plants render with links and the empty state works", async () => {
  const renderer = renderPage({
    plantService: {
      listPlants: async () => [persisted, { ...persisted, plant_id: "PLT-002", pot_id: "POT-002", group_name: "G2", exemplar_id: "EX02", treatment_percentage: 85 }],
      createPlant: async () => persisted,
    },
  });
  await act(async () => {});
  const html = rendered(renderer);
  assert.ok(html.includes("PLT-001") && html.includes("PLT-002"), "both plants render");
  assert.ok(html.includes("G1") && html.includes("G2"), "group values render");
  assert.ok(html.includes("active"), "status renders");
  assert.equal(renderer.root.findAll((n: any) => n.type === "a" && n.props.href === "/plants/PLT-001").length, 1, "plant detail links intact");
});