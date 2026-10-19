// Phase 4K.2 — HTTP adapter write-layer tests (run with: npm test)
// Node.js native test runner + native TypeScript type stripping (Node >= 23.6).
import test from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "../services/apiError.ts";
import {
  HttpDay0EquipmentService,
  HttpImageService,
  HttpMeasurementService,
  HttpPlantService,
  HttpPositionService,
  HttpWaterService,
} from "./adapters.ts";

const originalFetch = globalThis.fetch;

function stubFetch(handler: (url: string, init: RequestInit | undefined) => Response | Promise<Response>): void {
  globalThis.fetch = (async (input: unknown, init?: RequestInit) =>
    handler(String(input), init)) as typeof fetch;
}

function restoreFetch(): void {
  globalThis.fetch = originalFetch;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Fixtures (synthetic; service-layer only — no UI ever constructs these yet)
// ---------------------------------------------------------------------------

const waterInput = {
  water_event_id: "WTR-20260101-080000-001",
  plant_id: "PLT-001",
  timestamp: "2026-01-01T08:00:00",
  experiment_day: 1,
  pot_mass_before_g: 500,
  target_mass_g: 550,
  water_added_ml: 50,
  pot_mass_after_g: 550,
  watering_status: "pass" as const,
};

const positionInput = {
  position_event_id: "POS-20260101-080000-001",
  position_id: "P01",
  timestamp: "2026-01-01T08:00:00",
  plant_id: "PLT-001",
  location: "RACK_A_ROW1_COL1",
  operator: "operator_a",
  reason: "initial_assignment" as const,
};

const manualInput = {
  measurement_id: "MSR-MAN-20260101-090000-001",
  plant_id: "PLT-001",
  timestamp: "2026-01-01T09:00:00",
  experiment_day: 1,
  repetition: 1 as const,
  observer: "observer_1",
  measurement_status: "pass" as const,
  plant_height_cm: 12.4,
  method: "MANUAL" as const,
};

const aicvInput = {
  measurement_id: "MSR-AICV-20260101-091000-001",
  image_id: "IMG-20260101-080000-001",
  plant_id: "PLT-001",
  timestamp: "2026-01-01T09:10:00",
  experiment_day: 1,
  model: "baseline",
  model_version: "v1",
  pipeline_version: "pipeline-v1",
  detection_status: "pass" as const,
  segmentation_status: "pass" as const,
  calibration_status: "pass" as const,
  failure_code: "none" as const,
};

// ---------------------------------------------------------------------------
// E) createWaterEvent
// ---------------------------------------------------------------------------

test("E) createWaterEvent POSTs to /api/water-events and returns persisted data", async () => {
  const persisted = { ...waterInput, operator: null, notes: null };
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  stubFetch((url, init) => {
    capturedUrl = url;
    capturedInit = init;
    return jsonResponse({ data: persisted }, 201);
  });
  try {
    const result = await new HttpWaterService().createWaterEvent(waterInput);
    assert.equal(capturedUrl, "/api/water-events");
    assert.equal(capturedInit?.method, "POST");
    const headers = capturedInit?.headers as Record<string, string> | undefined;
    assert.equal(headers?.["content-type"], "application/json");
    assert.deepEqual(result, persisted);
  } finally {
    restoreFetch();
  }
});

// ---------------------------------------------------------------------------
// F) createPositionEvent
// ---------------------------------------------------------------------------

test("F) createPositionEvent POSTs to /api/position-events and returns persisted data", async () => {
  let capturedUrl = "";
  stubFetch((url) => {
    capturedUrl = url;
    return jsonResponse({ data: positionInput }, 201);
  });
  try {
    const result = await new HttpPositionService().createPositionEvent(positionInput);
    assert.equal(capturedUrl, "/api/position-events");
    assert.deepEqual(result, positionInput);
  } finally {
    restoreFetch();
  }
});

// ---------------------------------------------------------------------------
// G) createManualMeasurement
// ---------------------------------------------------------------------------

test("G) createManualMeasurement POSTs to /api/manual-measurements", async () => {
  let capturedUrl = "";
  stubFetch((url) => {
    capturedUrl = url;
    return jsonResponse({ data: manualInput }, 201);
  });
  try {
    const result = await new HttpMeasurementService().createManualMeasurement(manualInput);
    assert.equal(capturedUrl, "/api/manual-measurements");
    assert.equal(result.measurement_id, manualInput.measurement_id);
  } finally {
    restoreFetch();
  }
});

// ---------------------------------------------------------------------------
// H) createAICVMeasurement
// ---------------------------------------------------------------------------

test("H) createAICVMeasurement POSTs to /api/aicv-measurements", async () => {
  let capturedUrl = "";
  stubFetch((url) => {
    capturedUrl = url;
    return jsonResponse({ data: aicvInput }, 201);
  });
  try {
    const result = await new HttpMeasurementService().createAICVMeasurement(aicvInput);
    assert.equal(capturedUrl, "/api/aicv-measurements");
    assert.equal(result.experiment_day, 1);
  } finally {
    restoreFetch();
  }
});

// ---------------------------------------------------------------------------
// I) backend 201 data is returned unchanged
// ---------------------------------------------------------------------------

test("I) POST returns the persisted row unchanged (incl. idempotent identical re-POST)", async () => {
  const persisted = { ...waterInput, operator: null };
  stubFetch(() => jsonResponse({ data: persisted }, 201));
  try {
    const first = await new HttpWaterService().createWaterEvent(waterInput);
    const second = await new HttpWaterService().createWaterEvent(waterInput);
    assert.deepEqual(first, persisted);
    assert.deepEqual(second, persisted, "idempotent success is indistinguishable from fresh create");
  } finally {
    restoreFetch();
  }
});

// ---------------------------------------------------------------------------
// J) backend 400 issues[] are preserved
// ---------------------------------------------------------------------------

test("J) 400 validation failure preserves code and issues[]", async () => {
  stubFetch(() =>
    jsonResponse(
      {
        error: {
          code: "water_event.validation_failed",
          message: "Invalid water event",
          issues: [
            { field: "watering_status", code: "enum.invalid", message: "Value 'good' is not in allowed set" },
          ],
        },
      },
      400
    )
  );
  try {
    await assert.rejects(
      () => new HttpWaterService().createWaterEvent({ ...waterInput, watering_status: "good" }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError, "must be an ApiError");
        assert.equal(error.status, 400);
        assert.equal(error.code, "water_event.validation_failed");
        assert.equal(error.issues.length, 1);
        assert.equal(error.issues[0].field, "watering_status");
        assert.equal(error.issues[0].code, "enum.invalid");
        return true;
      }
    );
  } finally {
    restoreFetch();
  }
});

// ---------------------------------------------------------------------------
// K) backend 409 id.duplicate is preserved
// ---------------------------------------------------------------------------

test("K) 409 id.duplicate is preserved as ApiError", async () => {
  stubFetch(() =>
    jsonResponse(
      {
        error: {
          code: "id.duplicate",
          message: "conflict",
          issues: [{ field: "water_event_id", code: "id.conflict", message: "duplicate with conflicting content" }],
        },
      },
      409
    )
  );
  try {
    await assert.rejects(
      () => new HttpWaterService().createWaterEvent(waterInput),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 409);
        assert.equal(error.code, "id.duplicate");
        assert.equal(error.issues[0].code, "id.conflict");
        return true;
      }
    );
  } finally {
    restoreFetch();
  }
});

// ---------------------------------------------------------------------------
// L) request body contains only explicitly supported fields
// ---------------------------------------------------------------------------

test("L) POST body is exactly the typed input (no extra/unknown fields)", async () => {
  let sentBody = "";
  stubFetch((_url, init) => {
    sentBody = String(init?.body ?? "");
    return jsonResponse({ data: manualInput }, 201);
  });
  try {
    await new HttpMeasurementService().createManualMeasurement(manualInput);
    const parsed = JSON.parse(sentBody) as Record<string, unknown>;
    assert.deepEqual(parsed, manualInput, "body must equal the supported fields");
    assert.deepEqual(
      Object.keys(parsed).sort(),
      Object.keys(manualInput).sort(),
      "no unsupported keys may be sent"
    );
  } finally {
    restoreFetch();
  }
});

// ---------------------------------------------------------------------------
// M) GET behavior does not regress
// ---------------------------------------------------------------------------

test("M) GET list parses data; detail 404 -> null; non-OK GET throws ApiError", async () => {
  // list success
  stubFetch(() => jsonResponse({ data: [{}] }));
  try {
    const plants = await new HttpPlantService().listPlants();
    assert.equal(plants.length, 1);
  } finally {
    restoreFetch();
  }

  // detail 404 -> null (unchanged read semantics)
  stubFetch(() => jsonResponse({ error: { code: "plant.not_found", message: "Plant not found" } }, 404));
  try {
    const missing = await new HttpPlantService().getPlantById("PLT-999");
    assert.equal(missing, null);
  } finally {
    restoreFetch();
  }

  // non-OK GET error preserves code via ApiError
  stubFetch(() => jsonResponse({ error: { code: "internal.error", message: "Internal server error" } }, 500));
  try {
    await assert.rejects(
      () => new HttpPlantService().listPlants(),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 500);
        assert.equal(error.code, "internal.error");
        return true;
      }
    );
  } finally {
    restoreFetch();
  }
});

// ---------------------------------------------------------------------------
// P/Q) uploadImage builds a multipart body with exactly the backend fields
// ---------------------------------------------------------------------------

test("P) uploadImage POSTs to /api/images/upload with exactly the backend multipart fields", async () => {
  const file = new File(["fake-jpeg-bytes"], "photo.jpg", { type: "image/jpeg" });
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  stubFetch((url, init) => {
    capturedUrl = url;
    capturedInit = init;
    return jsonResponse(
      {
        data: {
          image_id: "IMG-20260301-080000-001",
          plant_id: "PLT-001",
          timestamp: "2026-03-01T08:00:00",
          experiment_day: 1,
          image_path: "/tmp/storage/images/IMG-20260301-080000-001.jpg",
          camera_id: "CAM-01",
          image_quality_status: "PASS",
          calibration_status: "pass",
        },
      },
      201
    );
  });
  try {
    const result = await new HttpImageService().uploadImage({
      file,
      plant_id: "PLT-001",
      timestamp: "2026-03-01T08:00:00",
      experiment_day: 1,
      camera_id: "CAM-01",
      image_quality_status: "PASS",
      calibration_status: "pass",
      cal_ref_id: "CAL-001",
      failure_code: "none",
      notes: "side view",
    });
    assert.equal(capturedUrl, "/api/images/upload");
    assert.equal(capturedInit?.method, "POST");
    const form = capturedInit?.body as FormData;
    assert.ok(form instanceof FormData, "multipart body must be FormData");
    assert.deepEqual([...form.keys()].sort(), [
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
    assert.equal(form.get("plant_id"), "PLT-001");
    assert.equal(form.get("timestamp"), "2026-03-01T08:00:00");
    assert.equal(form.get("experiment_day"), "1");
    assert.equal(form.get("camera_id"), "CAM-01");
    assert.equal(form.get("image_quality_status"), "PASS");
    assert.equal(form.get("calibration_status"), "pass");
    assert.equal(form.get("cal_ref_id"), "CAL-001");
    assert.equal(form.get("failure_code"), "none");
    assert.equal(form.get("notes"), "side view");
    const sentFile = form.get("file") as File;
    assert.equal(sentFile.name, "photo.jpg", "the RAW file is passed through untouched");
    assert.equal(result.image_id, "IMG-20260301-080000-001");
  } finally {
    restoreFetch();
  }
});

test("Q) empty optional fields are omitted from the multipart body (no invented values)", async () => {
  const file = new File(["fake-jpeg-bytes"], "photo.jpg", { type: "image/jpeg" });
  let capturedInit: RequestInit | undefined;
  stubFetch((_url, init) => {
    capturedInit = init;
    return jsonResponse({ data: {} }, 201);
  });
  try {
    await new HttpImageService().uploadImage({
      file,
      plant_id: "PLT-001",
      timestamp: "2026-03-01T08:00:00",
      experiment_day: 1,
      camera_id: "CAM-01",
      image_quality_status: "PASS",
      calibration_status: "pass",
    });
    const form = capturedInit?.body as FormData;
    const keys = [...form.keys()];
    assert.ok(!keys.includes("cal_ref_id"), "empty cal_ref_id is omitted");
    assert.ok(!keys.includes("failure_code"), "empty failure_code is omitted");
    assert.ok(!keys.includes("notes"), "empty notes are omitted");
    assert.ok(!keys.includes("image_id"), "image_id is never client-supplied here (backend generates it)");
  } finally {
    restoreFetch();
  }
});

test("R/S) verifyImageFile reports retrieval success/failure without throwing", async () => {
  let capturedUrl = "";
  stubFetch((url) => {
    capturedUrl = url;
    return new Response(new Uint8Array([0xff, 0xd8, 0xff]), {
      status: 200,
      headers: { "content-type": "image/jpeg" },
    });
  });
  try {
    const ok = await new HttpImageService().verifyImageFile("IMG-20260301-080000-001");
    assert.equal(capturedUrl, "/api/images/IMG-20260301-080000-001/file");
    assert.equal(ok, true);
  } finally {
    restoreFetch();
  }

  stubFetch(() => jsonResponse({ error: { code: "image.not_found", message: "Image file not found" } }, 404));
  try {
    assert.equal(await new HttpImageService().verifyImageFile("IMG-20260301-080000-999"), false);
  } finally {
    restoreFetch();
  }

  stubFetch(() => {
    throw new TypeError("fetch failed");
  });
  try {
    assert.equal(await new HttpImageService().verifyImageFile("IMG-20260301-080000-001"), false, "network failure -> false");
  } finally {
    restoreFetch();
  }
});

// ---------------------------------------------------------------------------
// D) network failure is distinguishable from backend errors
// ---------------------------------------------------------------------------

test("D) network failures propagate as plain errors, not ApiError", async () => {
  stubFetch(() => {
    throw new TypeError("fetch failed");
  });
  try {
    await assert.rejects(
      () => new HttpWaterService().createWaterEvent(waterInput),
      (error: unknown) => {
        assert.ok(error instanceof TypeError, "network failure must stay a plain Error");
        assert.ok(!(error instanceof ApiError), "network failure must not look like a backend error");
        assert.equal((error as ApiError).status, undefined);
        return true;
      }
    );
  } finally {
    restoreFetch();
  }
});

// ---------------------------------------------------------------------------
// API connectivity / URL construction (Phase: production 404 diagnosis)
// ---------------------------------------------------------------------------

test("E) every HTTP service reads through the resolved apiUrl()", async () => {
  const calls: string[] = [];
  stubFetch((url) => {
    calls.push(url);
    return jsonResponse({ data: [] });
  });
  try {
    await new HttpPlantService().listPlants();
    await new HttpPlantService().getPlantById("PLT-001");
    await new HttpPlantService().getDayContext("PLT-001");
    await new HttpImageService().listImages();
    await new HttpImageService().getImageById("IMG-1");
    await new HttpMeasurementService().listManualMeasurements();
    await new HttpMeasurementService().listAICVMeasurements();
    await new HttpWaterService().listWaterEvents();
    await new HttpPositionService().listPositionEvents();
  } finally {
    restoreFetch();
  }

  assert.deepEqual(calls, [
    "/api/plants",
    "/api/plants/PLT-001",
    "/api/plants/PLT-001/day-context",
    "/api/images",
    "/api/images/IMG-1",
    "/api/manual-measurements",
    "/api/aicv-measurements",
    "/api/water-events",
    "/api/position-events",
  ]);
});

test("F) every HTTP service writes through the resolved apiUrl()", async () => {
  const calls: Array<{ url: string; method: string }> = [];
  stubFetch((url, init) => {
    calls.push({ url, method: String(init?.method ?? "GET") });
    return jsonResponse({ data: waterInput });
  });
  try {
    await new HttpPlantService().createPlant({
      plant_id: "PLT-001",
      pot_id: "POT-001",
      group_name: "G1",
      emergence_date: "2026-01-01",
      status: "active",
      created_at: "2026-01-01T08:00:00",
    });
    await new HttpWaterService().createWaterEvent(waterInput);
    await new HttpPositionService().createPositionEvent(positionInput);
  } finally {
    restoreFetch();
  }

  assert.deepEqual(calls, [
    { url: "/api/plants", method: "POST" },
    { url: "/api/water-events", method: "POST" },
    { url: "/api/position-events", method: "POST" },
  ]);
});

test("G) a 404 from the API surfaces as ApiError and is never treated as empty success", async () => {
  stubFetch(() => jsonResponse({ error: { code: "route.not_found", message: "Not found" } }, 404));
  try {
    await assert.rejects(
      () => new HttpPlantService().listPlants(),
      (error: unknown) => {
        assert.ok(error instanceof ApiError, "404 must become an ApiError");
        assert.equal((error as ApiError).status, 404);
        return true;
      }
    );
  } finally {
    restoreFetch();
  }
});

test("I) image upload targets the multipart endpoint via apiUrl()", async () => {
  const calls: string[] = [];
  stubFetch((url, init) => {
    calls.push(url);
    assert.ok(init?.body instanceof FormData, "upload must send multipart FormData");
    return jsonResponse({ data: {} });
  });
  try {
    await new HttpImageService().uploadImage({
      file: new File([new Uint8Array([1, 2, 3])], "frame.jpg", { type: "image/jpeg" }),
      plant_id: "PLT-001",
      timestamp: "2026-01-01T08:00:00",
      experiment_day: 1,
      camera_id: "CAM-01",
      image_quality_status: "PASS",
      calibration_status: "pass",
    });
  } finally {
    restoreFetch();
  }

  assert.deepEqual(calls, ["/api/images/upload"]);
});

test("H+J) Day 0 calls resolve through apiUrl and every call carries credentials", { concurrency: false }, async () => {
  const seen: Array<{ url: string; credentials: string }> = [];
  stubFetch((url, init) => {
    seen.push({ url, credentials: String(init?.credentials ?? "omit") });
    return jsonResponse({ data: [] });
  });
  try {
    const p = new HttpPlantService();
    await p.listPlants();
    await p.getPlantById("PLT-001");
    await p.getDayContext("PLT-001");
    await p.createPlant({
      plant_id: "PLT-001",
      pot_id: "POT-001",
      group_name: "G1",
      emergence_date: "2026-01-01",
      status: "active",
      created_at: "2026-01-01T00:00:00",
    });
    await new HttpWaterService().listWaterEvents();
    await new HttpWaterService().createWaterEvent(waterInput);
    await new HttpPositionService().listPositionEvents();
    await new HttpPositionService().createPositionEvent(positionInput);
    await new HttpImageService().listImages();
    await new HttpImageService().getImageById("IMG-1");
    await new HttpMeasurementService().listManualMeasurements();
    await new HttpMeasurementService().listAICVMeasurements();

    const weekday = new HttpDay0EquipmentService();
    await weekday.list();
    // A PATCH — the credentialed write most easily missed.
    await weekday.update("EQ-1", { verified: true });
  } finally {
    restoreFetch();
  }

  // URLs are built by apiUrl() with no base, i.e. unchanged relative paths.
  const day0Urls = seen.filter((c) => c.url.startsWith("/api/day0/")).map((c) => c.url);
  assert.deepEqual(day0Urls, ["/api/day0/equipment", "/api/day0/equipment/EQ-1"]);

  // No call may omit credentials — the Access cookie would be dropped.
  const omitting = seen.filter((c) => c.credentials !== "include");
  assert.deepEqual(
    omitting.map((c) => c.url),
    [],
    "no HTTP call may omit credentials"
  );
  assert.ok(seen.length >= 14, `expected many calls, got ${seen.length}`);
});

// ---------------------------------------------------------------------------
// Cloudflare Access interaction: an unauthenticated request must fail loudly.
//
// When Access is enabled and no CF_Authorization cookie is present, Cloudflare
// answers the request with a redirect to its login page. A browser fetch()
// follows that redirect and receives HTML with a 200 status. The API layer must
// therefore NOT treat that as a successful empty response — it has to surface an
// error, otherwise the UI would silently show "no data" while the real problem
// is "not signed in".
// ---------------------------------------------------------------------------


test("Access: a login-page redirect is an error, never an empty success", async () => {
  // Cloudflare Access answers an unauthenticated request with a redirect to its
  // login page. fetch() follows it, so the app receives HTML with status 200.
  const loginPage = "<!DOCTYPE html><title>Cloudflare Access</title><form>login</form>";
  stubFetch(() =>
    new Response(loginPage, { status: 200, headers: { "content-type": "text/html" } })
  );
  try {
    let caught: unknown;
    try {
      await new HttpPlantService().listPlants();
    } catch (error) {
      caught = error;
    }
    // It must be an ApiError, and it must say something actionable. A bare
    // SyntaxError would leave the user unable to tell "not signed in" apart
    // from "the API is broken".
    assert.ok(caught instanceof ApiError, "a login page must become an ApiError");
    assert.equal((caught as ApiError).code, "response.not_json");
    assert.match((caught as ApiError).message, /not signed in/, "the message must point at sign-in");
  } finally {
    restoreFetch();
  }
});

test("Access: a 401/302 from Access is surfaced with its status", async () => {
  for (const status of [302, 401, 403]) {
    stubFetch(() =>
      new Response("{}", { status, headers: { "content-type": "application/json" } })
    );
    try {
      await assert.rejects(
        () => new HttpPlantService().listPlants(),
        (error: unknown) => error instanceof ApiError && (error as ApiError).status === status
      );
    } finally {
      restoreFetch();
    }
  }
});
