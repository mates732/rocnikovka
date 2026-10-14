import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { buildApp, createAppContext } from "../index.js";
import { RepositoryError } from "../repositories/base.js";
import { SqliteAICVMeasurementRepository, SqliteImageRecordRepository, SqlitePlantRepository } from "../repositories/sqliteRepositories.js";
import type { AICVMeasurement, ImageRecord, Plant } from "../types.js";

async function withTestDb<T>(run: (args: { storageDir: string; filename: string }) => T | Promise<T>): Promise<T> {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "plant-ai-block4f2-"));
  const storageDir = path.join(tempRoot, "storage");
  const filename = "test.sqlite";
  fs.mkdirSync(storageDir, { recursive: true });

  try {
    return await run({ storageDir, filename });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

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

function seedPlantAndImage(db: Database.Database): void {
  const plants = new SqlitePlantRepository(db);
  plants.create(basePlant());
  const images = new SqliteImageRecordRepository(db);
  images.create(baseImageRecord());
}

test("A) aicv list empty", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    const context = createAppContext({ storageDir, filename });
    const aicv = new SqliteAICVMeasurementRepository(context.db);
    assert.deepEqual(aicv.list(), []);
    context.db.close();
  });
});

test("B) aicv list returns all records", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    const context = createAppContext({ storageDir, filename });
    seedPlantAndImage(context.db);
    const aicv = new SqliteAICVMeasurementRepository(context.db);
    aicv.create(baseAICVMeasurement());
    aicv.create(baseAICVMeasurement({ measurement_id: "MSR-AICV-20260101-091000-002", timestamp: "2026-01-01T09:11:00" }));
    aicv.create(
      baseAICVMeasurement({
        measurement_id: "MSR-AICV-20260102-091000-001",
        timestamp: "2026-01-02T09:10:00",
        detection_status: "fail",
        segmentation_status: "not_applicable",
        calibration_status: "fail",
        failure_code: "no_detection",
      })
    );

    const rows = aicv.list();
    assert.equal(rows.length, 3);
    const ids = rows.map((r) => r.measurement_id);
    assert.equal(new Set(ids).size, 3, "no duplicates");
    assert.ok(ids.includes("MSR-AICV-20260101-091000-001"));
    assert.ok(ids.includes("MSR-AICV-20260101-091000-002"));
    assert.ok(ids.includes("MSR-AICV-20260102-091000-001"));
    context.db.close();
  });
});

test("C) aicv list deterministic ordering timestamp ASC measurement_id ASC", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    const context = createAppContext({ storageDir, filename });
    seedPlantAndImage(context.db);
    const aicv = new SqliteAICVMeasurementRepository(context.db);
    aicv.create(baseAICVMeasurement({ measurement_id: "MSR-AICV-20260102-091000-001", timestamp: "2026-01-02T09:10:00" }));
    aicv.create(baseAICVMeasurement({ measurement_id: "MSR-AICV-20260101-091000-001", timestamp: "2026-01-01T09:10:00" }));
    aicv.create(baseAICVMeasurement({ measurement_id: "MSR-AICV-20260101-091000-002", timestamp: "2026-01-01T09:10:00" }));

    assert.deepEqual(
      aicv.list().map((r) => r.measurement_id),
      ["MSR-AICV-20260101-091000-001", "MSR-AICV-20260101-091000-002", "MSR-AICV-20260102-091000-001"]
    );
    context.db.close();
  });
});

test("D) aicv getById existing", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    const context = createAppContext({ storageDir, filename });
    seedPlantAndImage(context.db);
    const aicv = new SqliteAICVMeasurementRepository(context.db);
    aicv.create(baseAICVMeasurement({ plant_height_cm: 10.4, projected_area_cm2: 20.1, confidence: 0.93 }));

    const row = aicv.getById("MSR-AICV-20260101-091000-001");
    assert.ok(row);
    assert.equal(row.plant_height_cm, 10.4);
    assert.equal(row.projected_area_cm2, 20.1);
    assert.equal(row.confidence, 0.93);
    assert.equal(row.model_version, "v1");
    context.db.close();
  });
});

test("E) aicv getById missing returns undefined", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    const context = createAppContext({ storageDir, filename });
    const aicv = new SqliteAICVMeasurementRepository(context.db);
    assert.equal(aicv.getById("MSR-AICV-999999-000000-999"), undefined);
    context.db.close();
  });
});

test("F) aicv NULL optional fields preserved", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    const context = createAppContext({ storageDir, filename });
    seedPlantAndImage(context.db);
    const aicv = new SqliteAICVMeasurementRepository(context.db);
    aicv.create(baseAICVMeasurement());

    const row = aicv.list()[0];
    assert.equal(row.plant_height_cm, null);
    assert.equal(row.projected_area_cm2, null);
    assert.equal(row.confidence, null);
    assert.equal(row.notes, null);
    context.db.close();
  });
});

test("G) API GET list returns 200 with data array", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlantAndImage(db);
      const aicv = new SqliteAICVMeasurementRepository(db);
      aicv.create(baseAICVMeasurement());

      const res = await fetch(`${baseUrl}/api/aicv-measurements`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: AICVMeasurement[] };
      assert.equal(body.data.length, 1);
      assert.equal(body.data[0].measurement_id, "MSR-AICV-20260101-091000-001");
    });
  });
});

test("H) API GET detail existing returns 200 with full record", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlantAndImage(db);
      const aicv = new SqliteAICVMeasurementRepository(db);
      aicv.create(
        baseAICVMeasurement({
          plant_height_cm: 11.0,
          projected_area_cm2: 22.4,
          confidence: 0.9,
          notes: "clean frame",
        })
      );

      const res = await fetch(`${baseUrl}/api/aicv-measurements/MSR-AICV-20260101-091000-001`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: AICVMeasurement };
      assert.equal(body.data.plant_height_cm, 11.0);
      assert.equal(body.data.projected_area_cm2, 22.4);
      assert.equal(body.data.confidence, 0.9);
      assert.equal(body.data.notes, "clean frame");
      assert.equal(body.data.image_id, "IMG-20260101-080000-001");
      assert.equal(body.data.calibration_status, "pass");
    });
  });
});

test("I) API GET detail missing returns 404 aicv_measurement.not_found", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/aicv-measurements/MSR-AICV-999999-000000-999`);
      assert.equal(res.status, 404);
      const body = (await res.json()) as { error: { code: string; message: string } };
      assert.equal(body.error.code, "aicv_measurement.not_found");
      assert.equal(body.error.message, "AICV measurement not found");
    });
  });
});

test("J) write surface: POST implemented, no PATCH/PUT/DELETE; error handling preserved", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlantAndImage(db);

      const created = await fetch(`${baseUrl}/api/aicv-measurements`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(baseAICVMeasurement()),
      });
      assert.equal(created.status, 201, "append-only create must be implemented");

      for (const [method, url] of [
        ["PATCH", "/api/aicv-measurements/MSR-AICV-20260101-091000-001"],
        ["PUT", "/api/aicv-measurements/MSR-AICV-20260101-091000-001"],
        ["DELETE", "/api/aicv-measurements/MSR-AICV-20260101-091000-001"],
      ] as const) {
        const res = await fetch(`${baseUrl}${url}`, { method });
        assert.equal(res.status, 404, `${method} ${url} must not be implemented`);
        const body = (await res.json()) as { error: { code: string } };
        assert.equal(body.error.code, "route.not_found", `${method} ${url} must fall through to 404`);
      }

      const missing = await fetch(`${baseUrl}/api/aicv-measurements/MSR-AICV-999999-000000-999`);
      const body = (await missing.json()) as { error: { code: string } };
      assert.equal(body.error.code, "aicv_measurement.not_found");
    });
  });
});

test("K) repository FK and duplicate behavior preserved", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    const context = createAppContext({ storageDir, filename });
    const aicv = new SqliteAICVMeasurementRepository(context.db);

    assert.throws(
      () => aicv.create(baseAICVMeasurement({ plant_id: "PLT-999" })),
      (error: unknown) => error instanceof RepositoryError && error.code === "reference.missing_parent"
    );

    seedPlantAndImage(context.db);
    aicv.create(baseAICVMeasurement());

    assert.throws(
      () => aicv.create(baseAICVMeasurement({ timestamp: "2026-01-01T10:00:00" })),
      (error: unknown) => error instanceof RepositoryError && error.code === "id.duplicate"
    );

    context.db.close();
  });
});