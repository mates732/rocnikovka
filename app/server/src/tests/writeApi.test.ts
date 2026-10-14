// Phase 4J — controlled JSON write endpoints (water_events, position_events,
// manual_measurements, aicv_measurements).
//
// All fixtures are synthetic and live only in temporary SQLite databases /
// temporary storage directories. The production DB is never opened for
// writing by any test (see AG/AH).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { buildApp, createAppContext } from "../index.js";
import {
  SqliteImageRecordRepository,
  SqlitePlantRepository,
} from "../repositories/sqliteRepositories.js";
import type { AICVMeasurement, ImageRecord, ManualMeasurement, Plant, PositionEvent, WaterEvent } from "../types.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function basePlant(overrides: Partial<Plant> = {}): Plant {
  return {
    plant_id: "PLT-001",
    pot_id: "POT-001",
    group_name: "G1",
    emergence_date: "2026-02-01",
    status: "active",
    notes: "baseline",
    created_at: "2026-02-01T08:00:00",
    ...overrides,
  };
}

function baseWaterEvent(overrides: Partial<WaterEvent> = {}): WaterEvent {
  return {
    water_event_id: "WTR-20260101-080000-001",
    plant_id: "PLT-001",
    timestamp: "2026-01-01T08:00:00",
    experiment_day: 1,
    pot_mass_before_g: 500,
    target_mass_g: 550,
    water_added_ml: 50,
    pot_mass_after_g: 550,
    watering_status: "pass",
    ...overrides,
  };
}

function basePositionEvent(overrides: Partial<PositionEvent> = {}): PositionEvent {
  return {
    position_event_id: "POS-20260101-080000-001",
    position_id: "P01",
    timestamp: "2026-01-01T08:00:00",
    plant_id: "PLT-001",
    location: "RACK_A_ROW1_COL1",
    operator: "operator_a",
    reason: "initial_assignment",
    ...overrides,
  };
}

function baseImageRecord(overrides: Partial<ImageRecord> = {}): ImageRecord {
  return {
    image_id: "IMG-20260101-080000-001",
    plant_id: "PLT-001",
    timestamp: "2026-01-01T08:00:00",
    experiment_day: 1,
    image_path: "data/raw/images/IMG-20260101-080000-001.jpg",
    camera_id: "CAM-01",
    image_quality_status: "PASS",
    calibration_status: "pass",
    ...overrides,
  };
}

/**
 * Default manual measurement is WARN without a height so that a bare payload
 * is accepted by the Phase 4G status rules; PASS/FAIL cases override status.
 */
function baseManualMeasurement(overrides: Partial<ManualMeasurement> = {}): ManualMeasurement {
  return {
    measurement_id: "MSR-MAN-20260101-090000-001",
    plant_id: "PLT-001",
    timestamp: "2026-01-01T09:00:00",
    experiment_day: 1,
    repetition: 1,
    attempt: 1,
    observer: "observer_1",
    measurement_status: "warn",
    method: "MANUAL",
    ...overrides,
  };
}

function baseAICVMeasurement(overrides: Partial<AICVMeasurement> = {}): AICVMeasurement {
  return {
    measurement_id: "MSR-AICV-20260101-091000-001",
    image_id: "IMG-20260101-080000-001",
    plant_id: "PLT-001",
    timestamp: "2026-01-01T09:10:00",
    experiment_day: 1,
    model: "baseline",
    model_version: "v1",
    pipeline_version: "pipeline-v1",
    detection_status: "pass",
    segmentation_status: "pass",
    calibration_status: "pass",
    failure_code: "none",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

async function withTestDb<T>(run: (args: { storageDir: string; filename: string }) => T | Promise<T>): Promise<T> {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "plant-ai-block4j-"));
  const storageDir = path.join(tempRoot, "storage");
  const filename = "test.sqlite";
  fs.mkdirSync(storageDir, { recursive: true });

  try {
    return await run({ storageDir, filename });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function withStartedServer<T>(
  dbConfig: { storageDir: string; filename: string },
  run: (baseUrl: string, db: Database.Database) => Promise<T>
): Promise<T> {
  const context = createAppContext(dbConfig);
  const { server, db } = buildApp(context);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    return await run(baseUrl, db);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  }
}

async function postJson(
  baseUrl: string,
  endpoint: string,
  body: unknown
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as any;
  return { status: res.status, body: json };
}

function seedPlant(db: Database.Database, plant: Plant = basePlant()): void {
  new SqlitePlantRepository(db).create(plant);
}

function seedImage(db: Database.Database, image: ImageRecord = baseImageRecord()): void {
  new SqliteImageRecordRepository(db).create(image);
}

function countRows(db: Database.Database, table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
}

// ---------------------------------------------------------------------------
// Multipart helper for the image-upload regression tests (I, J)
// ---------------------------------------------------------------------------

function jpegBytes(length = 512): Buffer {
  const bytes = Buffer.alloc(length, 0x5a);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  bytes[3] = 0xe0;
  return bytes;
}

function buildMultipart(
  fields: Record<string, string>,
  file: { filename?: string; contentType?: string; content: Buffer }
): { body: Buffer; contentType: string } {
  const boundary = `----plantAi4j${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const chunks: Buffer[] = [];
  const push = (text: string) => chunks.push(Buffer.from(text, "utf8"));

  for (const [name, value] of Object.entries(fields)) {
    push(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);
  }
  push(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.filename ?? "image.jpg"}"\r\n`
  );
  if (file.contentType) push(`Content-Type: ${file.contentType}\r\n`);
  push("\r\n");
  chunks.push(file.content);
  push("\r\n");
  push(`--${boundary}--\r\n`);
  return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

async function postImage(
  baseUrl: string,
  fields: Record<string, string>,
  file: { filename?: string; contentType?: string; content: Buffer }
): Promise<{ status: number; body: any }> {
  const { body, contentType } = buildMultipart(fields, file);
  const res = await fetch(`${baseUrl}/api/images/upload`, {
    method: "POST",
    headers: { "content-type": contentType },
    body: body as unknown as BodyInit,
  });
  const json = (await res.json()) as any;
  return { status: res.status, body: json };
}

function imageFields(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    plant_id: "PLT-001",
    timestamp: "2026-02-01T08:00:00",
    experiment_day: "1",
    camera_id: "CAM-01",
    image_quality_status: "PASS",
    calibration_status: "pass",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// A) POST water event success
// ---------------------------------------------------------------------------

test("A) POST /api/water-events success returns 201 with persisted row", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postJson(baseUrl, "/api/water-events", baseWaterEvent());
      assert.equal(status, 201);
      assert.equal(body.data.water_event_id, "WTR-20260101-080000-001");
      assert.equal(body.data.watering_status, "pass");
      assert.equal(body.data.experiment_day, 1);
      assert.equal(body.data.operator, null);
      assert.equal(countRows(db, "water_events"), 1);
    })
  );
});

// ---------------------------------------------------------------------------
// B) water event validation failure
// ---------------------------------------------------------------------------

test("B) POST water event invalid enum rejected with structured issues", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postJson(baseUrl, "/api/water-events", {
        ...baseWaterEvent(),
        watering_status: "good",
      });
      assert.equal(status, 400);
      assert.equal(body.error.code, "water_event.validation_failed");
      assert.ok(
        body.error.issues.some(
          (i: { field: string; code: string }) => i.field === "watering_status" && i.code === "enum.invalid"
        ),
        "expected an enum.invalid issue on watering_status"
      );
      assert.equal(countRows(db, "water_events"), 0, "no row may be inserted");
    })
  );
});

// ---------------------------------------------------------------------------
// C) water event FK failure
// ---------------------------------------------------------------------------

test("C) POST water event with missing plant rejected; nothing persisted", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      const { status, body } = await postJson(baseUrl, "/api/water-events", {
        ...baseWaterEvent(),
        plant_id: "PLT-999",
      });
      assert.equal(status, 409);
      assert.equal(body.error.code, "reference.invalid");
      assert.equal(countRows(db, "water_events"), 0);
    })
  );
});

// ---------------------------------------------------------------------------
// D) water event append-only behavior
// ---------------------------------------------------------------------------

test("D) water events are append-only: INSERT-only writes, no mutating endpoints", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const first = await postJson(baseUrl, "/api/water-events", baseWaterEvent());
      assert.equal(first.status, 201);

      db.exec(`
        CREATE TRIGGER trg_4j_water_no_update BEFORE UPDATE ON water_events
        BEGIN SELECT RAISE(ABORT, 'water UPDATE attempted'); END;
        CREATE TRIGGER trg_4j_water_no_delete BEFORE DELETE ON water_events
        BEGIN SELECT RAISE(ABORT, 'water DELETE attempted'); END;
      `);
      try {
        const second = await postJson(baseUrl, "/api/water-events", {
          ...baseWaterEvent(),
          water_event_id: "WTR-20260101-080000-002",
          timestamp: "2026-01-01T08:05:00",
          water_added_ml: 60,
          pot_mass_after_g: 560,
        });
        assert.equal(second.status, 201, "append must use INSERT only");
        assert.equal(countRows(db, "water_events"), 2);
      } finally {
        db.exec("DROP TRIGGER trg_4j_water_no_update; DROP TRIGGER trg_4j_water_no_delete;");
      }

      for (const method of ["PATCH", "PUT", "DELETE"] as const) {
        const res = await fetch(`${baseUrl}/api/water-events/WTR-20260101-080000-001`, { method });
        assert.equal(res.status, 404, `${method} must not exist for water events`);
      }
      assert.equal(countRows(db, "water_events"), 2);
    })
  );
});

// ---------------------------------------------------------------------------
// E) POST position event success
// ---------------------------------------------------------------------------

test("E) POST /api/position-events success returns 201 with persisted row", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postJson(baseUrl, "/api/position-events", basePositionEvent());
      assert.equal(status, 201);
      assert.equal(body.data.position_event_id, "POS-20260101-080000-001");
      assert.equal(body.data.reason, "initial_assignment");
      assert.equal(body.data.previous_location, null);
      assert.equal(countRows(db, "position_events"), 1);
    })
  );
});

// ---------------------------------------------------------------------------
// F) position event validation failure
// ---------------------------------------------------------------------------

test("F) POST position event invalid reason rejected with structured issues", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postJson(baseUrl, "/api/position-events", {
        ...basePositionEvent(),
        reason: "why_not",
      });
      assert.equal(status, 400);
      assert.equal(body.error.code, "position_event.validation_failed");
      assert.ok(
        body.error.issues.some(
          (i: { field: string; code: string }) => i.field === "reason" && i.code === "enum.invalid"
        )
      );
      assert.equal(countRows(db, "position_events"), 0);
    })
  );
});

// ---------------------------------------------------------------------------
// G) position event FK failure
// ---------------------------------------------------------------------------

test("G) POST position event with missing plant rejected; nothing persisted", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      const { status, body } = await postJson(baseUrl, "/api/position-events", {
        ...basePositionEvent(),
        plant_id: "PLT-999",
      });
      assert.equal(status, 409);
      assert.equal(body.error.code, "reference.invalid");
      assert.equal(countRows(db, "position_events"), 0);
    })
  );
});

// ---------------------------------------------------------------------------
// H) position event append-only behavior
// ---------------------------------------------------------------------------

test("H) position events are append-only: INSERT-only writes, no mutating endpoints", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const first = await postJson(baseUrl, "/api/position-events", basePositionEvent());
      assert.equal(first.status, 201);

      db.exec(`
        CREATE TRIGGER trg_4j_pos_no_update BEFORE UPDATE ON position_events
        BEGIN SELECT RAISE(ABORT, 'position UPDATE attempted'); END;
        CREATE TRIGGER trg_4j_pos_no_delete BEFORE DELETE ON position_events
        BEGIN SELECT RAISE(ABORT, 'position DELETE attempted'); END;
      `);
      try {
        const second = await postJson(baseUrl, "/api/position-events", {
          ...basePositionEvent(),
          position_event_id: "POS-20260101-080000-002",
          timestamp: "2026-01-01T08:10:00",
          location: "RACK_A_ROW1_COL2",
          previous_location: "RACK_A_ROW1_COL1",
          reason: "rotation",
        });
        assert.equal(second.status, 201, "append must use INSERT only");
        assert.equal(countRows(db, "position_events"), 2);
      } finally {
        db.exec("DROP TRIGGER trg_4j_pos_no_update; DROP TRIGGER trg_4j_pos_no_delete;");
      }

      for (const method of ["PATCH", "PUT", "DELETE"] as const) {
        const res = await fetch(`${baseUrl}/api/position-events/POS-20260101-080000-001`, { method });
        assert.equal(res.status, 404, `${method} must not exist for position events`);
      }
      assert.equal(countRows(db, "position_events"), 2);
    })
  );
});

// ---------------------------------------------------------------------------
// I) image upload remains functional (Phase 4I regression)
// ---------------------------------------------------------------------------

test("I) POST /api/images/upload still works", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postImage(
        baseUrl,
        imageFields({ image_id: "IMG-20260201-080000-555" }),
        { filename: "photo.jpg", contentType: "image/jpeg", content: jpegBytes() }
      );
      assert.equal(status, 201);
      assert.equal(body.data.image_id, "IMG-20260201-080000-555");
      assert.equal(countRows(db, "image_records"), 1);
    })
  );
});

// ---------------------------------------------------------------------------
// J) image upload creates a visible ImageRecord
// ---------------------------------------------------------------------------

test("J) uploaded image is visible through GET /api/images and /api/images/:id", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postImage(
        baseUrl,
        imageFields({ image_id: "IMG-20260201-080000-556" }),
        { filename: "photo.jpg", contentType: "image/jpeg", content: jpegBytes() }
      );
      assert.equal(status, 201);

      const list = (await (await fetch(`${baseUrl}/api/images`)).json()) as { data: ImageRecord[] };
      assert.equal(list.data.length, 1);
      assert.equal(list.data[0].image_id, "IMG-20260201-080000-556");

      const detail = (await (await fetch(`${baseUrl}/api/images/IMG-20260201-080000-556`)).json()) as {
        data: ImageRecord;
      };
      assert.equal(detail.data.image_id, "IMG-20260201-080000-556");
    })
  );
});

// ---------------------------------------------------------------------------
// K) POST manual measurement success
// ---------------------------------------------------------------------------

test("K) POST /api/manual-measurements success returns 201 with persisted row", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postJson(baseUrl, "/api/manual-measurements", {
        ...baseManualMeasurement(),
        measurement_status: "pass",
        plant_height_cm: 12.4,
      });
      assert.equal(status, 201);
      assert.equal(body.data.measurement_id, "MSR-MAN-20260101-090000-001");
      assert.equal(body.data.measurement_status, "pass");
      assert.equal(body.data.plant_height_cm, 12.4);
      assert.equal(body.data.method, "MANUAL");
      assert.equal(countRows(db, "manual_measurements"), 1);
    })
  );
});

// ---------------------------------------------------------------------------
// L) manual measurement validation failure
// ---------------------------------------------------------------------------

test("L) POST manual measurement invalid repetition rejected", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postJson(baseUrl, "/api/manual-measurements", {
        ...baseManualMeasurement(),
        repetition: 3,
      });
      assert.equal(status, 400);
      assert.equal(body.error.code, "manual_measurement.validation_failed");
      assert.ok(
        body.error.issues.some(
          (i: { field: string; code: string }) => i.field === "repetition" && i.code === "enum.invalid"
        )
      );
      assert.equal(countRows(db, "manual_measurements"), 0);
    })
  );
});

// ---------------------------------------------------------------------------
// M) PASS without height rejected
// ---------------------------------------------------------------------------

test("M) manual PASS without plant_height_cm rejected", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postJson(baseUrl, "/api/manual-measurements", {
        ...baseManualMeasurement(),
        measurement_status: "pass",
      });
      assert.equal(status, 400);
      assert.ok(
        body.error.issues.some(
          (i: { field: string; code: string }) =>
            i.field === "plant_height_cm" && i.code === "validation.height_required_for_pass"
        )
      );
      assert.equal(countRows(db, "manual_measurements"), 0);
    })
  );
});

// ---------------------------------------------------------------------------
// N) PASS with real failure code rejected
// ---------------------------------------------------------------------------

test("N) manual PASS with a real failure code rejected", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postJson(baseUrl, "/api/manual-measurements", {
        ...baseManualMeasurement(),
        measurement_status: "pass",
        plant_height_cm: 10.0,
        failure_code: "occlusion",
      });
      assert.equal(status, 400);
      assert.ok(
        body.error.issues.some(
          (i: { field: string; code: string }) =>
            i.field === "failure_code" && i.code === "validation.failure_code_invalid_for_pass"
        )
      );
      assert.equal(countRows(db, "manual_measurements"), 0);
    })
  );
});

// ---------------------------------------------------------------------------
// O) WARN without height accepted
// ---------------------------------------------------------------------------

test("O) manual WARN without plant_height_cm accepted", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postJson(baseUrl, "/api/manual-measurements", {
        ...baseManualMeasurement(),
        measurement_status: "warn",
      });
      assert.equal(status, 201);
      assert.equal(body.data.plant_height_cm, null);
      assert.equal(countRows(db, "manual_measurements"), 1);
    })
  );
});

// ---------------------------------------------------------------------------
// P) WARN with real failure + valid height accepted
// ---------------------------------------------------------------------------

test("P) manual WARN with real failure code and retained height accepted", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postJson(baseUrl, "/api/manual-measurements", {
        ...baseManualMeasurement(),
        measurement_status: "warn",
        plant_height_cm: 11.1,
        failure_code: "poor_image_quality",
      });
      assert.equal(status, 201);
      assert.equal(body.data.failure_code, "poor_image_quality");
      assert.equal(body.data.plant_height_cm, 11.1);
    })
  );
});

// ---------------------------------------------------------------------------
// Q) FAIL without failure code rejected
// ---------------------------------------------------------------------------

test("Q) manual FAIL without failure_code rejected", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postJson(baseUrl, "/api/manual-measurements", {
        ...baseManualMeasurement(),
        measurement_status: "fail",
      });
      assert.equal(status, 400);
      assert.ok(
        body.error.issues.some(
          (i: { field: string; code: string }) =>
            i.field === "failure_code" && i.code === "validation.failure_code_required_for_fail"
        )
      );
      assert.equal(countRows(db, "manual_measurements"), 0);
    })
  );
});

// ---------------------------------------------------------------------------
// R) FAIL with failure_code=none rejected
// ---------------------------------------------------------------------------

test("R) manual FAIL with failure_code 'none' rejected", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postJson(baseUrl, "/api/manual-measurements", {
        ...baseManualMeasurement(),
        measurement_status: "fail",
        failure_code: "none",
      });
      assert.equal(status, 400);
      assert.ok(
        body.error.issues.some(
          (i: { field: string; code: string }) =>
            i.field === "failure_code" && i.code === "validation.failure_code_none_invalid_for_fail"
        )
      );
      assert.equal(countRows(db, "manual_measurements"), 0);
    })
  );
});

// ---------------------------------------------------------------------------
// S) manual image/plant mismatch rejected (G2)
// ---------------------------------------------------------------------------

test("S) manual measurement image/plant mismatch rejected (G2)", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db, basePlant());
      seedPlant(db, basePlant({ plant_id: "PLT-002", pot_id: "POT-002" }));
      seedImage(db); // IMG-20260101-080000-001 belongs to PLT-001

      const { status, body } = await postJson(baseUrl, "/api/manual-measurements", {
        ...baseManualMeasurement(),
        plant_id: "PLT-002",
        image_id: "IMG-20260101-080000-001",
      });
      assert.equal(status, 400);
      assert.ok(
        body.error.issues.some(
          (i: { field: string; code: string }) =>
            i.field === "plant_id" && i.code === "validation.plant_id_mismatch"
        )
      );
      assert.equal(countRows(db, "manual_measurements"), 0);
    })
  );
});

test("S2) manual measurement with unknown image_id rejected", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postJson(baseUrl, "/api/manual-measurements", {
        ...baseManualMeasurement(),
        image_id: "IMG-99999999-999999-999",
      });
      assert.equal(status, 400);
      assert.ok(
        body.error.issues.some(
          (i: { field: string; code: string }) =>
            i.field === "image_id" && i.code === "reference.missing_parent"
        )
      );
      assert.equal(countRows(db, "manual_measurements"), 0);
    })
  );
});

test("S3) manual measurement with matching image accepted (G2 pass)", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      seedImage(db);
      const { status, body } = await postJson(baseUrl, "/api/manual-measurements", {
        ...baseManualMeasurement(),
        image_id: "IMG-20260101-080000-001",
      });
      assert.equal(status, 201);
      assert.equal(body.data.image_id, "IMG-20260101-080000-001");
    })
  );
});

// ---------------------------------------------------------------------------
// T) manual retake/attempt accepted
// ---------------------------------------------------------------------------

test("T) manual retake with attempt=2 accepted for the same session", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const first = await postJson(baseUrl, "/api/manual-measurements", {
        ...baseManualMeasurement(),
        measurement_id: "MSR-MAN-20260101-090000-001",
        repetition: 1,
        attempt: 1,
        plant_height_cm: 10.0,
        measurement_status: "pass",
      });
      assert.equal(first.status, 201);

      const retake = await postJson(baseUrl, "/api/manual-measurements", {
        ...baseManualMeasurement(),
        measurement_id: "MSR-MAN-20260101-090000-002",
        repetition: 1,
        attempt: 2,
        plant_height_cm: 10.4,
        measurement_status: "pass",
      });
      assert.equal(retake.status, 201, "retake with attempt=2 must be accepted");
      assert.equal(retake.body.data.attempt, 2);
      assert.equal(countRows(db, "manual_measurements"), 2);
    })
  );
});

test("T2) manual attempt below 1 rejected", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postJson(baseUrl, "/api/manual-measurements", {
        ...baseManualMeasurement(),
        attempt: 0,
      });
      assert.equal(status, 400);
      assert.ok(
        body.error.issues.some(
          (i: { field: string; code: string }) => i.field === "attempt" && i.code === "number.out_of_range"
        )
      );
      assert.equal(countRows(db, "manual_measurements"), 0);
    })
  );
});

// ---------------------------------------------------------------------------
// U) no uniqueness constraint on repetition/attempt
// ---------------------------------------------------------------------------

test("U) no uniqueness constraint: same session/repetition/attempt allowed twice", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const a = await postJson(baseUrl, "/api/manual-measurements", {
        ...baseManualMeasurement(),
        measurement_id: "MSR-MAN-20260101-090000-001",
        plant_height_cm: 10.0,
        measurement_status: "pass",
      });
      assert.equal(a.status, 201);
      const b = await postJson(baseUrl, "/api/manual-measurements", {
        ...baseManualMeasurement(),
        measurement_id: "MSR-MAN-20260101-090000-002",
        plant_height_cm: 10.2,
        measurement_status: "pass",
      });
      assert.equal(b.status, 201, "identical plant/day/repetition/attempt with a new ID must be allowed");
      assert.equal(countRows(db, "manual_measurements"), 2);
    })
  );
});

// ---------------------------------------------------------------------------
// V) POST AICV success
// ---------------------------------------------------------------------------

test("V) POST /api/aicv-measurements success returns 201 with persisted row", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      seedImage(db);
      const { status, body } = await postJson(baseUrl, "/api/aicv-measurements", baseAICVMeasurement());
      assert.equal(status, 201);
      assert.equal(body.data.measurement_id, "MSR-AICV-20260101-091000-001");
      assert.equal(body.data.image_id, "IMG-20260101-080000-001");
      assert.equal(body.data.experiment_day, 1);
      assert.equal(countRows(db, "aicv_measurements"), 1);
    })
  );
});

// ---------------------------------------------------------------------------
// W) AICV image missing rejected
// ---------------------------------------------------------------------------

test("W) POST AICV with missing image rejected; nothing persisted", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postJson(baseUrl, "/api/aicv-measurements", {
        ...baseAICVMeasurement(),
        image_id: "IMG-99999999-999999-999",
      });
      assert.equal(status, 400);
      assert.ok(
        body.error.issues.some(
          (i: { field: string; code: string }) =>
            i.field === "image_id" && i.code === "reference.missing_parent"
        )
      );
      assert.equal(countRows(db, "aicv_measurements"), 0);
    })
  );
});

// ---------------------------------------------------------------------------
// X) AICV plant/image mismatch rejected
// ---------------------------------------------------------------------------

test("X) POST AICV with plant/image mismatch rejected", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db, basePlant());
      seedPlant(db, basePlant({ plant_id: "PLT-002", pot_id: "POT-002" }));
      seedImage(db); // belongs to PLT-001

      const { status, body } = await postJson(baseUrl, "/api/aicv-measurements", {
        ...baseAICVMeasurement(),
        plant_id: "PLT-002",
      });
      assert.equal(status, 400);
      assert.ok(
        body.error.issues.some(
          (i: { field: string; code: string }) =>
            i.field === "plant_id" && i.code === "validation.plant_id_mismatch"
        )
      );
      assert.equal(countRows(db, "aicv_measurements"), 0);
    })
  );
});

// ---------------------------------------------------------------------------
// Y) AICV experiment_day/image mismatch rejected
// ---------------------------------------------------------------------------

test("Y) POST AICV with experiment_day/image mismatch rejected", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      seedImage(db); // image experiment_day = 1
      const { status, body } = await postJson(baseUrl, "/api/aicv-measurements", {
        ...baseAICVMeasurement(),
        experiment_day: 5,
      });
      assert.equal(status, 400);
      assert.ok(
        body.error.issues.some(
          (i: { field: string; code: string }) =>
            i.field === "experiment_day" && i.code === "validation.experiment_day_mismatch"
        )
      );
      assert.equal(countRows(db, "aicv_measurements"), 0);
    })
  );
});

// ---------------------------------------------------------------------------
// Z) AICV append-only behavior
// ---------------------------------------------------------------------------

test("Z) AICV measurements are append-only: INSERT-only writes, no mutating endpoints", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      seedImage(db);
      const first = await postJson(baseUrl, "/api/aicv-measurements", baseAICVMeasurement());
      assert.equal(first.status, 201);

      db.exec(`
        CREATE TRIGGER trg_4j_aicv_no_update BEFORE UPDATE ON aicv_measurements
        BEGIN SELECT RAISE(ABORT, 'aicv UPDATE attempted'); END;
        CREATE TRIGGER trg_4j_aicv_no_delete BEFORE DELETE ON aicv_measurements
        BEGIN SELECT RAISE(ABORT, 'aicv DELETE attempted'); END;
      `);
      try {
        const second = await postJson(baseUrl, "/api/aicv-measurements", {
          ...baseAICVMeasurement(),
          measurement_id: "MSR-AICV-20260101-091000-002",
          timestamp: "2026-01-01T09:15:00",
        });
        assert.equal(second.status, 201, "append must use INSERT only");
        assert.equal(countRows(db, "aicv_measurements"), 2);
      } finally {
        db.exec("DROP TRIGGER trg_4j_aicv_no_update; DROP TRIGGER trg_4j_aicv_no_delete;");
      }

      for (const method of ["PATCH", "PUT", "DELETE"] as const) {
        const res = await fetch(`${baseUrl}/api/aicv-measurements/MSR-AICV-20260101-091000-001`, {
          method,
        });
        assert.equal(res.status, 404, `${method} must not exist for AICV measurements`);
      }
      assert.equal(countRows(db, "aicv_measurements"), 2);
    })
  );
});

// ---------------------------------------------------------------------------
// AA) duplicate IDs cannot overwrite existing records
// ---------------------------------------------------------------------------

test("AA) identical re-submission is an idempotent no-op (no overwrite)", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const first = await postJson(baseUrl, "/api/water-events", baseWaterEvent());
      assert.equal(first.status, 201);

      const again = await postJson(baseUrl, "/api/water-events", baseWaterEvent());
      assert.equal(again.status, 201, "identical duplicate must be accepted as idempotent");
      assert.equal(again.body.data.water_event_id, first.body.data.water_event_id);
      assert.equal(countRows(db, "water_events"), 1, "no second row may be created");
      const stored = db
        .prepare("SELECT * FROM water_events WHERE water_event_id = ?")
        .get("WTR-20260101-080000-001") as WaterEvent;
      assert.equal(stored.water_added_ml, 50, "original content must be untouched");
    })
  );
});

// ---------------------------------------------------------------------------
// AB) conflicting duplicate fails
// ---------------------------------------------------------------------------

test("AB) conflicting duplicate ID rejected with 409 and original untouched", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const first = await postJson(baseUrl, "/api/manual-measurements", {
        ...baseManualMeasurement(),
        measurement_status: "pass",
        plant_height_cm: 10.0,
      });
      assert.equal(first.status, 201);

      const conflicting = await postJson(baseUrl, "/api/manual-measurements", {
        ...baseManualMeasurement(),
        measurement_status: "pass",
        plant_height_cm: 99.9,
      });
      assert.equal(conflicting.status, 409);
      assert.equal(conflicting.body.error.code, "id.duplicate");

      assert.equal(countRows(db, "manual_measurements"), 1, "no overwrite may happen");
      const stored = db
        .prepare("SELECT * FROM manual_measurements WHERE measurement_id = ?")
        .get("MSR-MAN-20260101-090000-001") as ManualMeasurement;
      assert.equal(stored.plant_height_cm, 10.0, "original content must be untouched");
    })
  );
});

test("AB2) conflicting duplicate AICV rejected; original intact", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      seedImage(db);
      const first = await postJson(baseUrl, "/api/aicv-measurements", {
        ...baseAICVMeasurement(),
        confidence: 0.9,
      });
      assert.equal(first.status, 201);

      const conflicting = await postJson(baseUrl, "/api/aicv-measurements", {
        ...baseAICVMeasurement(),
        confidence: 0.4,
      });
      assert.equal(conflicting.status, 409);
      assert.equal(conflicting.body.error.code, "id.duplicate");
      assert.equal(countRows(db, "aicv_measurements"), 1);
      const stored = db
        .prepare("SELECT confidence AS confidence FROM aicv_measurements WHERE measurement_id = ?")
        .get("MSR-AICV-20260101-091000-001") as { confidence: number | null };
      assert.equal(stored.confidence, 0.9, "original content must be untouched");
    })
  );
});

// ---------------------------------------------------------------------------
// AC) no UPDATE
// AD) no DELETE
// ---------------------------------------------------------------------------

test("AC/AD) writes never execute UPDATE or DELETE (armed-trigger guard)", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      seedImage(db);

      db.exec(`
        CREATE TRIGGER trg_4j_no_update_water BEFORE UPDATE ON water_events
        BEGIN SELECT RAISE(ABORT, 'water UPDATE'); END;
        CREATE TRIGGER trg_4j_no_update_pos BEFORE UPDATE ON position_events
        BEGIN SELECT RAISE(ABORT, 'position UPDATE'); END;
        CREATE TRIGGER trg_4j_no_update_manual BEFORE UPDATE ON manual_measurements
        BEGIN SELECT RAISE(ABORT, 'manual UPDATE'); END;
        CREATE TRIGGER trg_4j_no_update_aicv BEFORE UPDATE ON aicv_measurements
        BEGIN SELECT RAISE(ABORT, 'aicv UPDATE'); END;
        CREATE TRIGGER trg_4j_no_delete_water BEFORE DELETE ON water_events
        BEGIN SELECT RAISE(ABORT, 'water DELETE'); END;
        CREATE TRIGGER trg_4j_no_delete_pos BEFORE DELETE ON position_events
        BEGIN SELECT RAISE(ABORT, 'position DELETE'); END;
        CREATE TRIGGER trg_4j_no_delete_manual BEFORE DELETE ON manual_measurements
        BEGIN SELECT RAISE(ABORT, 'manual DELETE'); END;
        CREATE TRIGGER trg_4j_no_delete_aicv BEFORE DELETE ON aicv_measurements
        BEGIN SELECT RAISE(ABORT, 'aicv DELETE'); END;
      `);
      try {
        const water = await postJson(baseUrl, "/api/water-events", baseWaterEvent());
        assert.equal(water.status, 201);
        const pos = await postJson(baseUrl, "/api/position-events", basePositionEvent());
        assert.equal(pos.status, 201);
        const manual = await postJson(baseUrl, "/api/manual-measurements", {
          ...baseManualMeasurement(),
          measurement_status: "pass",
          plant_height_cm: 10.0,
        });
        assert.equal(manual.status, 201);
        const aicv = await postJson(baseUrl, "/api/aicv-measurements", baseAICVMeasurement());
        assert.equal(aicv.status, 201);

        assert.equal(countRows(db, "water_events"), 1);
        assert.equal(countRows(db, "position_events"), 1);
        assert.equal(countRows(db, "manual_measurements"), 1);
        assert.equal(countRows(db, "aicv_measurements"), 1);
      } finally {
        db.exec(`
          DROP TRIGGER trg_4j_no_update_water; DROP TRIGGER trg_4j_no_delete_water;
          DROP TRIGGER trg_4j_no_update_pos; DROP TRIGGER trg_4j_no_delete_pos;
          DROP TRIGGER trg_4j_no_update_manual; DROP TRIGGER trg_4j_no_delete_manual;
          DROP TRIGGER trg_4j_no_update_aicv; DROP TRIGGER trg_4j_no_delete_aicv;
        `);
      }
    })
  );
});

// ---------------------------------------------------------------------------
// AE) no INSERT OR REPLACE
// ---------------------------------------------------------------------------

test("AE) conflicting duplicate never replaces (BEFORE DELETE armed)", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const first = await postJson(baseUrl, "/api/water-events", baseWaterEvent());
      assert.equal(first.status, 201);

      // INSERT OR REPLACE would delete the old row first, firing this trigger
      // and aborting; the endpoint must reject the conflict before any write.
      db.exec(`
        CREATE TRIGGER trg_4j_no_replace BEFORE DELETE ON water_events
        BEGIN SELECT RAISE(ABORT, 'REPLACE delete attempted'); END;
      `);
      try {
        const conflicting = await postJson(baseUrl, "/api/water-events", {
          ...baseWaterEvent(),
          water_added_ml: 999,
        });
        assert.equal(conflicting.status, 409, "conflict must be rejected, never replaced");
        assert.equal(conflicting.body.error.code, "id.duplicate");
      } finally {
        db.exec("DROP TRIGGER trg_4j_no_replace;");
      }
      assert.equal(countRows(db, "water_events"), 1);
      const stored = db
        .prepare("SELECT water_added_ml AS water_added_ml FROM water_events WHERE water_event_id = ?")
        .get("WTR-20260101-080000-001") as { water_added_ml: number };
      assert.equal(stored.water_added_ml, 50, "original must be untouched");
    })
  );
});

// ---------------------------------------------------------------------------
// AF) raw SQL errors are sanitized
// ---------------------------------------------------------------------------

test("AF) raw SQL errors never leak to the client", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      db.exec(`
        CREATE TRIGGER trg_4j_sanitize BEFORE INSERT ON water_events
        BEGIN SELECT RAISE(ABORT, 'injected sqlite failure detail'); END;
      `);
      try {
        const { status, body } = await postJson(baseUrl, "/api/water-events", baseWaterEvent());
        assert.equal(status, 500);
        assert.equal(body.error.code, "internal.error");
        assert.ok(
          !JSON.stringify(body).includes("injected"),
          "raw SQLite error text must not be exposed"
        );
        assert.ok(!JSON.stringify(body).includes("RAISE"), "raw SQLite error text must not be exposed");
        assert.equal(countRows(db, "water_events"), 0);
      } finally {
        db.exec("DROP TRIGGER trg_4j_sanitize;");
      }
    })
  );
});

// ---------------------------------------------------------------------------
// AG) production DB untouched
// AH) no fake production data
// ---------------------------------------------------------------------------

test("AG) production database remains untouched by write-API tests", async () => {
  const prodDbPath = path.resolve(process.cwd(), "server", "storage", "experiment.sqlite");
  const existedBefore = fs.existsSync(prodDbPath);
  const statBefore = existedBefore ? fs.statSync(prodDbPath) : null;

  // Run a representative mix of endpoint activity against a temp DB only.
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      seedImage(db);
      assert.equal((await postJson(baseUrl, "/api/water-events", baseWaterEvent())).status, 201);
      assert.equal((await postJson(baseUrl, "/api/position-events", basePositionEvent())).status, 201);
      assert.equal(
        (
          await postJson(baseUrl, "/api/manual-measurements", {
            ...baseManualMeasurement(),
            measurement_status: "pass",
            plant_height_cm: 10.0,
          })
        ).status,
        201
      );
      assert.equal((await postJson(baseUrl, "/api/aicv-measurements", baseAICVMeasurement())).status, 201);
      assert.equal(countRows(db, "water_events"), 1);
      assert.equal(countRows(db, "position_events"), 1);
      assert.equal(countRows(db, "manual_measurements"), 1);
      assert.equal(countRows(db, "aicv_measurements"), 1);
    })
  );

  if (existedBefore) {
    const statAfter = fs.statSync(prodDbPath);
    assert.equal(statAfter.size, statBefore?.size, "production DB size must not change");
    assert.equal(statAfter.mtimeMs, statBefore?.mtimeMs, "production DB mtime must not change");
  } else {
    assert.equal(fs.existsSync(prodDbPath), false, "production DB must not be created by tests");
  }

  // No new storage/images directories may appear next to a real DB location.
  assert.equal(
    fs.existsSync(path.resolve(process.cwd(), "server", "storage", "images")),
    false,
    "production image storage directory must not be created by tests"
  );
});

test("AH) no fixture data ever reaches the production database", async () => {
  const prodDbPath = path.resolve(process.cwd(), "server", "storage", "experiment.sqlite");
  const existedBefore = fs.existsSync(prodDbPath);

  // All fixtures used in this file live in mkdtemp directories; assert none of
  // the fixture IDs can be found in the production DB if one exists.
  if (existedBefore) {
    const db = new (await import("better-sqlite3")).default(prodDbPath, { readonly: true });
    try {
      // Phase 4J fixtures only; plants uses the phase-agnostic baseline PLT-001
      // that predates this phase, so it is intentionally not asserted here.
      const fixtureIds = [
        "WTR-20260101-080000-001",
        "POS-20260101-080000-001",
        "MSR-MAN-20260101-090000-001",
        "MSR-AICV-20260101-091000-001",
        "IMG-20260201-080000-555",
      ];
      const tables: Array<[string, string]> = [
        ["water_events", "water_event_id"],
        ["position_events", "position_event_id"],
        ["manual_measurements", "measurement_id"],
        ["aicv_measurements", "measurement_id"],
        ["image_records", "image_id"],
      ];
      for (const [table, column] of tables) {
        const exists = db
          .prepare(
            `SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?`
          )
          .get(table);
        if (!exists) continue;
        for (const id of fixtureIds) {
          const row = db.prepare(`SELECT 1 AS found FROM ${table} WHERE ${column} = ?`).get(id);
          assert.equal(row, undefined, `fixture '${id}' must not exist in production ${table}`);
        }
      }
    } finally {
      db.close();
    }
  }
});
