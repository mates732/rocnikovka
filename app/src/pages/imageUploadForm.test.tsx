// Phase 4K.8 — Image acquisition UI tests (run with: npm test via tsx).
import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { act, create } from "react-test-renderer";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "../services/apiError";
import {
  buildUploadInput,
  emptyImageFormValues,
  ImageUploadForm,
  ImagesPage,
  imageFileUrl,
  validateImageForm,
} from "./ImagesPage";
import type { ImageRecord, Plant } from "../types/entities";
import type { UploadImageInput } from "../types/write";

const plants: Plant[] = [
  { plant_id: "PLT-001", pot_id: "POT-001", group_name: "G1", emergence_date: "2025-03-01", status: "active" },
  { plant_id: "PLT-002", pot_id: "POT-002", group_name: "G2", emergence_date: "2025-03-01", status: "active" },
];

const persisted: ImageRecord = {
  image_id: "IMG-20260301-080000-999", // deliberately different from any client-generated id
  plant_id: "PLT-001",
  timestamp: "2026-03-01T08:00:00",
  experiment_day: 1,
  image_path: "/tmp/fake/storage/images/IMG-20260301-080000-999.jpg",
  camera_id: "CAM-01",
  image_quality_status: "PASS",
  calibration_status: "pass",
};

function makeFile(name = "photo.jpg", type = "image/jpeg", size = 2048): File {
  return { name, type, size, lastModified: 0 } as File;
}

type Renderer = ReturnType<typeof create>;

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

async function pickFile(renderer: Renderer, file: File | null): Promise<void> {
  const node = fieldByName(renderer, "file");
  await act(async () => {
    node.props.onChange({ target: { name: "file", files: file ? [file] : [] } });
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
    ["experiment_day", "1"],
    ["timestamp", "2026-03-01T08:00"],
    ["camera_id", "CAM-01"],
    ["image_quality_status", "PASS"],
    ["calibration_status", "pass"],
    ["cal_ref_id", "CAL-001"],
    ["notes", "Side view"],
  ];
  for (const [name, value] of entries) {
    await change(renderer, name, value);
  }
  await pickFile(renderer, makeFile());
}

type FormHarness = {
  renderer: Renderer;
  captured: UploadImageInput[];
  createdIds: string[];
  verifiedIds: string[];
};

function renderForm(options?: {
  uploadImpl?: (input: UploadImageInput) => Promise<ImageRecord>;
  verifyImpl?: (imageId: string) => Promise<boolean>;
}): FormHarness {
  const captured: UploadImageInput[] = [];
  const createdIds: string[] = [];
  const verifiedIds: string[] = [];
  const renderer = create(
    <ImageUploadForm
      plants={plants}
      uploadImage={async (input) => {
        captured.push(input);
        if (options?.uploadImpl) return options.uploadImpl(input);
        const compact = input.timestamp.replace(/[-:T]/g, ""); // YYYYMMDDHHMMSS
        return { ...persisted, image_id: `IMG-${compact.slice(0, 8)}-${compact.slice(8, 14)}-001` };
      }}
      verifyImageFile={async (imageId) => {
        verifiedIds.push(imageId);
        if (options?.verifyImpl) return options.verifyImpl(imageId);
        return true;
      }}
      onCreated={(created) => createdIds.push(created.image_id)}
      getDayContext={async () => null}
    />
  );
  return { renderer, captured, createdIds, verifiedIds };
}

function validValues(overrides: Partial<Record<string, string>> = {}) {
  return {
    ...emptyImageFormValues(),
    plant_id: "PLT-001",
    experiment_day: "1",
    timestamp: "2026-03-01T08:00",
    camera_id: "CAM-01",
    image_quality_status: "PASS",
    calibration_status: "pass",
    ...overrides,
  };
}

// --- pure helpers -----------------------------------------------------------

test("H) experiment_day is never derived from the timestamp", () => {
  const issues = validateImageForm(validValues({ experiment_day: "" }), makeFile());
  assert.ok(issues.some((i) => i.field === "experiment_day" && i.code === "required"));
  const nonInteger = validateImageForm(validValues({ experiment_day: "1.5" }), makeFile()).find(
    (i) => i.field === "experiment_day"
  );
  assert.equal(nonInteger?.code, "number.out_of_range");
  const zero = validateImageForm(validValues({ experiment_day: "0" }), makeFile()).find((i) => i.field === "experiment_day");
  assert.equal(zero?.code, "number.out_of_range");
  assert.deepEqual(validateImageForm(validValues({ experiment_day: "7" }), makeFile()), [], "valid day passes");
});

test("I/J) timestamp normalizes to :00 with no timezone/UTC/Z conversion", () => {
  const input = buildUploadInput(validValues() as any, makeFile());
  assert.equal(input.timestamp, "2026-03-01T08:00:00");
  assert.ok(!input.timestamp.includes("Z") && !input.timestamp.includes("+"), "no timezone conversion");
});

test("K) camera_id is required and never defaulted", () => {
  const missing = validateImageForm(validValues({ camera_id: "" }), makeFile()).find((i) => i.field === "camera_id");
  assert.equal(missing?.code, "required");
  const whitespace = validateImageForm(validValues({ camera_id: "  " }), makeFile()).find((i) => i.field === "camera_id");
  assert.equal(whitespace?.code, "required");
});

test("L) image quality uses exactly the backend enum PASS/WARN/FAIL", () => {
  const missing = validateImageForm(validValues({ image_quality_status: "" }), makeFile()).find(
    (i) => i.field === "image_quality_status"
  );
  assert.equal(missing?.code, "required");
  const bad = validateImageForm(validValues({ image_quality_status: "ok" } as any), makeFile()).find(
    (i) => i.field === "image_quality_status"
  );
  assert.equal(bad?.code, "enum.invalid");
  assert.deepEqual(validateImageForm(validValues({ image_quality_status: "WARN" }), makeFile()), []);
});

test("M) calibration status uses exactly the backend enum pass/warn/fail", () => {
  const missing = validateImageForm(validValues({ calibration_status: "" }), makeFile()).find(
    (i) => i.field === "calibration_status"
  );
  assert.equal(missing?.code, "required");
  const bad = validateImageForm(validValues({ calibration_status: "perfect" } as any), makeFile()).find(
    (i) => i.field === "calibration_status"
  );
  assert.equal(bad?.code, "enum.invalid");
  assert.deepEqual(validateImageForm(validValues({ calibration_status: "warn" }), makeFile()), []);
});

test("N) a real file is required", () => {
  const issues = validateImageForm(validValues(), null);
  assert.ok(issues.some((i) => i.field === "file" && i.code === "required"));
});

test("O) unsupported file types and oversized files are rejected locally", () => {
  const gif = validateImageForm(validValues(), makeFile("photo.gif", "image/gif", 100)).find((i) => i.field === "file");
  assert.equal(gif?.code, "file.unsupported_type");
  const text = validateImageForm(validValues(), makeFile("notes.txt", "text/plain", 100)).find((i) => i.field === "file");
  assert.equal(text?.code, "file.unsupported_type");
  const huge = validateImageForm(validValues(), makeFile("huge.jpg", "image/jpeg", 15 * 1024 * 1024 + 1)).find(
    (i) => i.field === "file"
  );
  assert.equal(huge?.code, "file.too_large");
  const ok = validateImageForm(validValues(), makeFile("photo.jpg", "image/jpeg", 5 * 1024 * 1024));
  assert.ok(!ok.some((i) => i.field === "file"), "valid jpeg within limit passes");
});

test("P/Q) buildUploadInput contains exactly the supported fields and the RAW file", () => {
  const input = buildUploadInput(
    { ...validValues(), cal_ref_id: "CAL-001", failure_code: "poor_image_quality", notes: "blur" } as any,
    makeFile("photo.jpg")
  );
  assert.deepEqual(Object.keys(input).sort(), [
    "cal_ref_id",
    "calibration_status",
    "camera_id",
    "experiment_day",
    "failure_code",
    "file",
    "image_quality_status",
    "notes",
    "plant_id",
    "timestamp",
  ]);
  assert.equal(input.file.name, "photo.jpg", "the RAW file object is passed untouched");
  assert.equal(input.timestamp, "2026-03-01T08:00:00");
  // No UI-only or derived fields, no image_id (backend generates it), no path.
  const withoutOptionals = buildUploadInput(validValues() as any, makeFile());
  assert.deepEqual(Object.keys(withoutOptionals).sort(), [
    "calibration_status",
    "camera_id",
    "experiment_day",
    "file",
    "image_quality_status",
    "plant_id",
    "timestamp",
  ]);
});

test("AD/helper) imageFileUrl always uses the controlled serving route", () => {
  assert.equal(imageFileUrl("IMG-20260301-080000-999"), "/api/images/IMG-20260301-080000-999/file");
});

// --- component-level form behavior -----------------------------------------

test("D) no fake plants — every option maps to a real persisted plant", () => {
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

test("F) required-field validation blocks submission and shows local messages", async () => {
  const { renderer, captured } = renderForm();
  await submit(renderer);
  assert.equal(captured.length, 0, "empty form must not reach the backend");
  const html = rendered(renderer);
  for (const message of [
    "Select a plant.",
    "Experiment day is required.",
    "Timestamp is required.",
    "Camera ID is required.",
    "Select an image quality status.",
    "Select a calibration status.",
    "Select an image file.",
  ]) {
    assert.ok(html.includes(message), `expected local message "${message}"`);
  }
});

test("R/T) valid submission calls the injected uploadImage once and shows the backend-returned image_id", async () => {
  const { renderer, captured, createdIds, verifiedIds } = renderForm();
  await fillValid(renderer);
  await submit(renderer);
  await act(async () => {});
  assert.equal(captured.length, 1);
  const payload = captured[0];
  assert.equal(payload.plant_id, "PLT-001");
  assert.equal(payload.experiment_day, 1);
  assert.equal(payload.timestamp, "2026-03-01T08:00:00");
  assert.equal(payload.camera_id, "CAM-01");
  assert.equal(payload.image_quality_status, "PASS");
  assert.equal(payload.calibration_status, "pass");
  assert.equal(payload.cal_ref_id, "CAL-001");
  assert.equal(payload.notes, "Side view");
  assert.equal(payload.file.name, "photo.jpg");
  assert.equal(createdIds.length, 1);
  assert.equal(verifiedIds.length, 1, "verification runs against the persisted image id");
  const html = rendered(renderer);
  assert.ok(html.includes(`Image IMG-20260301-080000-001 uploaded and stored.`), "backend-returned id shown");
});

test("AD) server-backed image preview is displayed after successful upload and verification", async () => {
  const { renderer } = renderForm();
  await fillValid(renderer);
  await submit(renderer);
  await act(async () => {});
  const html = rendered(renderer);
  assert.ok(html.includes("Stored image verified — fetched back from the server."), "explicit verification claim");
  const imgs = renderer.root.findAll((n: any) => n.type === "img");
  assert.equal(imgs.length, 1);
  assert.equal(imgs[0].props.src, "/api/images/IMG-20260301-080000-001/file", "preview uses the server route");
  assert.ok(!imgs[0].props.src.startsWith("blob:"), "no local blob preview is used as verification");
});

test("AC) a failed verification never claims success and shows no server preview", async () => {
  const { renderer } = renderForm({ verifyImpl: async () => false });
  await fillValid(renderer);
  await submit(renderer);
  await act(async () => {});
  const html = rendered(renderer);
  assert.ok(html.includes("Image record created, but the stored file could not be verified."));
  assert.ok(!html.includes("Stored image verified"), "no verification claim when the fetch failed");
  assert.equal(renderer.root.findAll((n: any) => n.type === "img").length, 0, "no preview is shown");
});

test("V) form resets only after success (fields cleared, plant kept, file cleared)", async () => {
  const { renderer, captured } = renderForm();
  await fillValid(renderer);
  await submit(renderer);
  await act(async () => {});
  assert.equal(captured.length, 1);
  assert.equal(fieldByName(renderer, "plant_id").props.value, "PLT-001", "plant is kept for consecutive captures");
  assert.equal(fieldByName(renderer, "experiment_day").props.value, "", "day resets");
  assert.equal(fieldByName(renderer, "timestamp").props.value, "", "timestamp resets");
  assert.equal(fieldByName(renderer, "camera_id").props.value, "", "camera resets");
  assert.equal(fieldByName(renderer, "image_quality_status").props.value, "", "quality resets");
  assert.equal(fieldByName(renderer, "calibration_status").props.value, "", "calibration resets");
  assert.equal(fieldByName(renderer, "notes").props.value, "", "notes reset");
  // The file was cleared: submitting again without a file must not reach the backend.
  await submit(renderer);
  assert.equal(captured.length, 1, "no second submit without a file");
});

test("W) failed submission preserves every entered value and renders the ApiError", async () => {
  const apiError = new ApiError(400, "image.validation_failed", "Invalid image metadata", [
    { field: "camera_id", code: "required.missing", message: "camera_id is required" },
  ]);
  const { renderer } = renderForm({
    uploadImpl: async () => {
      throw apiError;
    },
  });
  await fillValid(renderer);
  await submit(renderer);
  const html = rendered(renderer);
  assert.equal(fieldByName(renderer, "experiment_day").props.value, "1", "entered value preserved");
  assert.equal(fieldByName(renderer, "timestamp").props.value, "2026-03-01T08:00", "entered value preserved");
  assert.equal(fieldByName(renderer, "notes").props.value, "Side view", "entered value preserved");
  assert.ok(html.includes("Invalid image metadata"), "backend message rendered");
  assert.ok(html.includes("image.validation_failed"), "error code rendered");
  assert.ok(!html.includes("uploaded and stored."), "no success message on failure");
});

test("X) a 400 validation ApiError renders structured field-level issues", async () => {
  const apiError = new ApiError(400, "image.validation_failed", "Invalid image metadata", [
    { field: "calibration_status", code: "enum.invalid", message: "calibration_status must be pass, warn or fail" },
  ]);
  const { renderer } = renderForm({
    uploadImpl: async () => {
      throw apiError;
    },
  });
  await fillValid(renderer);
  await submit(renderer);
  const html = rendered(renderer);
  assert.ok(html.includes("Validation failed"), "status-aware label");
  assert.ok(html.includes("calibration_status"), "issue field rendered");
  assert.ok(html.includes("enum.invalid"), "issue code rendered");
});

test("Y) a 409 duplicate/conflict is rendered correctly and stays retryable", async () => {
  const apiError = new ApiError(409, "image.duplicate", "image_id already exists; RAW images are immutable", []);
  const { renderer } = renderForm({
    uploadImpl: async () => {
      throw apiError;
    },
  });
  await fillValid(renderer);
  await submit(renderer);
  const html = rendered(renderer);
  assert.ok(html.includes("Conflict"), "conflict label");
  assert.ok(html.includes("image.duplicate"), "backend code preserved");
  assert.equal(fieldByName(renderer, "plant_id").props.value, "PLT-001", "form remains editable for retry");
});

test("Z/AA) submit is disabled while in flight and duplicate submissions are prevented", async () => {
  let resolveUpload!: (i: ImageRecord) => void;
  const uploadImpl = (_input: UploadImageInput) =>
    new Promise<ImageRecord>((resolve) => {
      resolveUpload = resolve;
    });
  const { renderer, captured } = renderForm({ uploadImpl });
  await fillValid(renderer);
  await submit(renderer);
  assert.equal(captured.length, 1);
  const findSubmit = () =>
    renderer.root.findAll((n: any) => n.type === "button").find((b: any) => b.props.type === "submit");
  assert.equal(findSubmit().props.disabled, true, "submit disabled during the request");
  assert.ok(JSON.stringify(findSubmit().props.children).includes("Uploading image"), "submitting state visible");
  // A second submit while in flight must be a no-op.
  await submit(renderer);
  assert.equal(captured.length, 1, "duplicate submission prevented");
  await act(async () => {
    resolveUpload({ ...persisted });
  });
  assert.equal(findSubmit().props.disabled, false, "submit re-enabled after completion");
});

test("AB) multiple legitimate images for the same plant and day are allowed", async () => {
  const { renderer, captured } = renderForm();
  await fillValid(renderer);
  await submit(renderer);
  await act(async () => {});
  assert.equal(captured.length, 1);
  assert.equal(captured[0].plant_id, "PLT-001");
  assert.equal(captured[0].experiment_day, 1);
  // Second capture for the same plant + experiment day (a retake or second
  // photo) must go through without any client-side uniqueness rejection.
  await fillValid(renderer);
  await pickFile(renderer, makeFile("second.jpg"));
  await submit(renderer);
  await act(async () => {});
  assert.equal(captured.length, 2, "second upload for same plant/day accepted");
  assert.equal(captured[1].plant_id, "PLT-001");
  assert.equal(captured[1].experiment_day, 1);
});

// --- page-level integration -------------------------------------------------

type ImagePageServices = {
  plantService: { listPlants: () => Promise<Plant[]>; getDayContext: () => Promise<null> };
  imageService: {
    listImages: () => Promise<ImageRecord[]>;
    uploadImage: (input: UploadImageInput) => Promise<ImageRecord>;
    verifyImageFile: (imageId: string) => Promise<boolean>;
  };
};

function renderPage(services: ImagePageServices): Renderer {
  return create(
    <MemoryRouter>
      <ImagesPage services={services} />
    </MemoryRouter>
  );
}

function openForm(renderer: Renderer): void {
  const openButton = renderer.root.findAll((n: any) => n.type === "button" && textContent(n).includes("Upload image"));
  assert.equal(openButton.length, 1, "header action button is present");
  act(() => {
    openButton[0].props.onClick();
  });
}

test("A/B) the upload button opens an accessible inline panel from ImagesPage", async () => {
  const renderer = renderPage({
    plantService: { listPlants: async () => plants, getDayContext: async () => null },
    imageService: { listImages: async () => [], uploadImage: async () => persisted, verifyImageFile: async () => true },
  });
  await act(async () => {});
  openForm(renderer);
  const html = rendered(renderer);
  assert.ok(html.includes("Upload image"), "form panel heading present");
  assert.equal(renderer.root.findAll((n: any) => n.type === "form").length, 1, "form is present once plants exist");
  const toggle = renderer.root.findAll((n: any) => n.type === "button" && textContent(n).includes("Close form"));
  assert.equal(toggle.length, 1);
  assert.equal(toggle[0].props["aria-expanded"], true, "toggle exposes expanded state");
  const panel = renderer.root.findAll((n: any) => n.props?.["aria-label"] === "Upload an image");
  assert.equal(panel.length, 1, "panel has an accessible name");
  for (const name of ["plant_id", "experiment_day", "timestamp", "camera_id", "image_quality_status", "calibration_status", "file"]) {
    const field = fieldByName(renderer, name);
    assert.ok(field.props.id, `field ${name} has an id for label association`);
  }
});

test("C/E) real plants come from PlantService; no plants makes upload impossible", async () => {
  const withPlants = renderPage({
    plantService: { listPlants: async () => plants, getDayContext: async () => null },
    imageService: { listImages: async () => [], uploadImage: async () => persisted, verifyImageFile: async () => true },
  });
  await act(async () => {});
  openForm(withPlants);
  const select = fieldByName(withPlants, "plant_id");
  const values = select.findAll((n: any) => n.type === "option").map((o: any) => o.props.value);
  assert.deepEqual(new Set(values), new Set(["", "PLT-001", "PLT-002"]));
  const html = rendered(withPlants);
  assert.ok(html.includes("PLT-001 · pot POT-001"), "plant id and pot context shown");

  const noPlants = renderPage({
    plantService: { listPlants: async () => [], getDayContext: async () => null },
    imageService: { listImages: async () => [], uploadImage: async () => persisted, verifyImageFile: async () => true },
  });
  await act(async () => {});
  openForm(noPlants);
  const noPlantsHtml = rendered(noPlants);
  assert.ok(noPlantsHtml.includes("Register a plant before uploading an image."), "explicit empty state");
  assert.equal(noPlants.root.findAll((n: any) => n.type === "form").length, 0, "no form without plants");
});

test("S/U) page uses injected services (no fetch) and refreshes the list after success", async () => {
  const imagesRef: ImageRecord[] = [];
  let listCalls = 0;
  const uploadedRef: UploadImageInput[] = [];
  const renderer = renderPage({
    plantService: { listPlants: async () => plants, getDayContext: async () => null },
    imageService: {
      listImages: async () => {
        listCalls += 1;
        return [...imagesRef];
      },
      uploadImage: async (input) => {
        uploadedRef.push(input);
        const compact = input.timestamp.replace(/[-:T]/g, ""); // YYYYMMDDHHMMSS
        const created: ImageRecord = {
          ...persisted,
          image_id: `IMG-${compact.slice(0, 8)}-${compact.slice(8, 14)}-001`,
          timestamp: input.timestamp,
          experiment_day: input.experiment_day,
        };
        imagesRef.push(created);
        return created;
      },
      verifyImageFile: async () => true,
    },
  });
  await act(async () => {});
  assert.equal(listCalls, 1, "initial list load");
  openForm(renderer);
  await fillValid(renderer);
  await submit(renderer);
  await act(async () => {});
  assert.equal(uploadedRef.length, 1, "exactly one upload went through the injected service (no fetch from the page)");
  assert.equal(listCalls, 2, "read-after-write refresh calls listImages again");
  const createdId = imagesRef[0].image_id;
  const rows = renderer.root.findAll((n: any) => n.type === "tr" && textContent(n).includes(createdId));
  assert.ok(rows.length >= 1, "created image appears in the refreshed list");
  const html = rendered(renderer);
  assert.ok(!html.includes("No images recorded."), "empty state replaced after refresh");
});