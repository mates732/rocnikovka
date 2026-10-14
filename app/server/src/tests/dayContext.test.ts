import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { buildApp, createAppContext } from "../index.js";
import { SqliteAICVMeasurementRepository, SqliteImageRecordRepository, SqliteManualMeasurementRepository, SqlitePlantRepository, SqlitePositionEventRepository, SqliteWaterEventRepository } from "../repositories/sqliteRepositories.js";
import type { Plant } from "../types.js";

async function withTestDb<T>(run: (args: { storageDir: string; filename: string }) => T | Promise<T>): Promise<T> {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "plant-ai-dayctx-"));
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

function seedFullHistory(db: Database.Database) {
  const plants = new SqlitePlantRepository(db);
  const positions = new SqlitePositionEventRepository(db);
  const water = new SqliteWaterEventRepository(db);
  const images = new SqliteImageRecordRepository(db);
  const manual = new SqliteManualMeasurementRepository(db);
  const aicv = new SqliteAICVMeasurementRepository(db);

  plants.create(basePlant());
  plants.create(basePlant({ plant_id: "PLT-002", pot_id: "POT-002" }));

  // Position events carry no experiment_day and must not affect day context.
  positions.create({
    position_event_id: "POS-20260207-080000-001",
    position_id: "P01",
    timestamp: "2026-02-07T08:00:00",
    plant_id: "PLT-001",
    location: "RACK_A_ROW1_COL1",
    operator: "operator_a",
    reason: "initial_assignment",
  });

  water.create({
    water_event_id: "WTR-20260203-080000-001",
    plant_id: "PLT-001",
    timestamp: "2026-02-03T08:00:00",
    experiment_day: 3,
    pot_mass_before_g: 500,
    target_mass_g: 550,
    water_added_ml: 50,
    pot_mass_after_g: 550,
    watering_status: "pass",
  });
  water.create({
    water_event_id: "WTR-20260207-080000-001",
    plant_id: "PLT-001",
    timestamp: "2026-02-07T08:00:00",
    experiment_day: 7,
    pot_mass_before_g: 500,
    target_mass_g: 550,
    water_added_ml: 50,
    pot_mass_after_g: 550,
    watering_status: "pass",
  });

  images.create({
    image_id: "IMG-20260205-081500-001",
    plant_id: "PLT-001",
    timestamp: "2026-02-05T08:15:00",
    experiment_day: 5,
    image_path: "data/raw/images/IMG-20260205-081500-001.jpg",
    camera_id: "CAM-01",
    image_quality_status: "PASS",
    calibration_status: "pass",
    failure_code: "none",
  });
  images.create({
    image_id: "IMG-20260207-081500-001",
    plant_id: "PLT-001",
    timestamp: "2026-02-07T08:15:00",
    experiment_day: 7,
    image_path: "data/raw/images/IMG-20260207-081500-001.jpg",
    camera_id: "CAM-01",
    image_quality_status: "PASS",
    calibration_status: "pass",
    failure_code: "none",
  });

  manual.create({
    measurement_id: "MSR-MAN-20260205-090000-001",
    plant_id: "PLT-001",
    image_id: "IMG-20260205-081500-001",
    timestamp: "2026-02-05T09:00:00",
    experiment_day: 5,
    repetition: 1,
    attempt: 1,
    plant_height_cm: 10.5,
    observer: "observer_1",
    measurement_status: "pass",
    failure_code: "none",
    method: "MANUAL",
  });

  aicv.create({
    measurement_id: "MSR-AICV-20260207-091000-001",
    image_id: "IMG-20260207-081500-001",
    plant_id: "PLT-001",
    timestamp: "2026-02-07T09:10:00",
    experiment_day: 7,
    model: "baseline",
    model_version: "v1",
    pipeline_version: "pipeline-v1",
    detection_status: "pass",
    segmentation_status: "pass",
    calibration_status: "pass",
    plant_height_cm: 10.4,
    projected_area_cm2: 20.1,
    confidence: 0.93,
    failure_code: "none",
  });

  return { plants, positions, water, images, manual, aicv };
}

test("A) day context aggregates max day across image/manual/water/aicv", async () => {
  await withTestDb((dbConfig) =>
    withStartedServer(dbConfig, async (baseUrl, db) => {
      seedFullHistory(db);

      const res = await fetch(`${baseUrl}/api/plants/PLT-001/day-context`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as {
        data: { plant_id: string; last_recorded_day: number | null; expected_next_day: number | null };
      };
      assert.equal(body.data.plant_id, "PLT-001");
      assert.equal(body.data.last_recorded_day, 7);
      assert.equal(body.data.expected_next_day, 8);
    })
  );
});

test("B) plant with no records returns null last day", async () => {
  await withTestDb((dbConfig) =>
    withStartedServer(dbConfig, async (baseUrl, db) => {
      seedFullHistory(db);

      const res = await fetch(`${baseUrl}/api/plants/PLT-002/day-context`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as {
        data: { plant_id: string; last_recorded_day: number | null; expected_next_day: number | null };
      };
      assert.equal(body.data.plant_id, "PLT-002");
      assert.equal(body.data.last_recorded_day, null);
      assert.equal(body.data.expected_next_day, null);
    })
  );
});

test("C) position events do not influence day context", async () => {
  await withTestDb((dbConfig) =>
    withStartedServer(dbConfig, async (baseUrl, db) => {
      seedFullHistory(db);

      // PLT-002 has no day-carrying records; a position event alone must not
      // produce a last_recorded_day.
      const res = await fetch(`${baseUrl}/api/plants/PLT-002/day-context`);
      const body = (await res.json()) as { data: { last_recorded_day: number | null } };
      assert.equal(body.data.last_recorded_day, null);
    })
  );
});

test("D) unknown plant returns 404 plant.not_found", async () => {
  await withTestDb((dbConfig) =>
    withStartedServer(dbConfig, async (baseUrl, db) => {
      seedFullHistory(db);

      const res = await fetch(`${baseUrl}/api/plants/PLT-404/day-context`);
      assert.equal(res.status, 404);
      const body = (await res.json()) as { error: { code: string } };
      assert.equal(body.error.code, "plant.not_found");
    })
  );
});

test("E) GET day-context mutates nothing", async () => {
  await withTestDb((dbConfig) =>
    withStartedServer(dbConfig, async (baseUrl, db) => {
      seedFullHistory(db);

      const count = (table: string): number =>
        (db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number }).count;

      const before = {
        plants: count("plants"),
        images: count("image_records"),
        manual: count("manual_measurements"),
        water: count("water_events"),
        aicv: count("aicv_measurements"),
        audit: count("audit_log"),
      };

      await fetch(`${baseUrl}/api/plants/PLT-001/day-context`);
      await fetch(`${baseUrl}/api/plants/PLT-002/day-context`);
      await fetch(`${baseUrl}/api/plants/PLT-404/day-context`);

      assert.deepEqual(
        {
          plants: count("plants"),
          images: count("image_records"),
          manual: count("manual_measurements"),
          water: count("water_events"),
          aicv: count("aicv_measurements"),
          audit: count("audit_log"),
        },
        before
      );

      db.close();
    })
  );
});

test("F) response exposes no filesystem paths or internals", async () => {
  await withTestDb((dbConfig) =>
    withStartedServer(dbConfig, async (baseUrl, db) => {
      seedFullHistory(db);

      const res = await fetch(`${baseUrl}/api/plants/PLT-001/day-context`);
      const raw = await res.text();
      assert.ok(!raw.includes("image_path"));
      assert.ok(!raw.includes("/tmp/"));
      assert.ok(!raw.includes("storageDir"));
      const body = JSON.parse(raw) as { data: Record<string, unknown> };
      assert.deepEqual(Object.keys(body.data).sort(), [
        "expected_next_day",
        "last_recorded_day",
        "plant_id",
      ]);
    })
  );
});