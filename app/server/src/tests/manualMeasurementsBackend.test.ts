import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { buildApp, createAppContext } from "../index.js";
import { RepositoryError } from "../repositories/base.js";
import { SqliteManualMeasurementRepository, SqlitePlantRepository } from "../repositories/sqliteRepositories.js";
import type { ManualMeasurement, Plant } from "../types.js";

async function withTestDb<T>(run: (args: { storageDir: string; filename: string }) => T | Promise<T>): Promise<T> {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "plant-ai-block4e2-"));
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

function baseManualMeasurement(overrides: Partial<ManualMeasurement> = {}): ManualMeasurement {
  return {
    measurement_id: "MSR-MAN-20260101-090000-001",
    plant_id: "PLT-001",
    timestamp: "2026-01-01T09:00:00",
    experiment_day: 1,
    repetition: 1,
    attempt: 1,
    observer: "observer_1",
    measurement_status: "pass",
    method: "MANUAL",
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

function seedParentPlant(db: Database.Database): void {
  const plants = new SqlitePlantRepository(db);
  plants.create(basePlant());
}

test("A) manual measurements empty list", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/manual-measurements`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: ManualMeasurement[] };
      assert.deepEqual(body.data, []);
    });
  });
});

test("B) manual measurements populated list returns all records", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedParentPlant(db);
      const measurements = new SqliteManualMeasurementRepository(db);
      measurements.create(baseManualMeasurement());
      measurements.create(
        baseManualMeasurement({
          measurement_id: "MSR-MAN-20260101-090000-002",
          repetition: 2,
          plant_height_cm: 11.2,
        })
      );
      measurements.create(
        baseManualMeasurement({
          measurement_id: "MSR-MAN-20260103-090000-001",
          timestamp: "2026-01-03T09:00:00",
          experiment_day: 3,
          plant_height_cm: 12.0,
          observer: "observer_2",
        })
      );

      const res = await fetch(`${baseUrl}/api/manual-measurements`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: ManualMeasurement[] };
      assert.equal(body.data.length, 3);
      const ids = body.data.map((m) => m.measurement_id);
      assert.equal(new Set(ids).size, 3, "no duplicates");
      assert.ok(ids.includes("MSR-MAN-20260101-090000-001"));
      assert.ok(ids.includes("MSR-MAN-20260101-090000-002"));
      assert.ok(ids.includes("MSR-MAN-20260103-090000-001"));
    });
  });
});

test("C) manual measurements deterministic ordering timestamp ASC measurement_id ASC", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedParentPlant(db);
      const measurements = new SqliteManualMeasurementRepository(db);
      measurements.create(
        baseManualMeasurement({
          measurement_id: "MSR-MAN-20260102-090000-001",
          timestamp: "2026-01-02T09:00:00",
          experiment_day: 2,
        })
      );
      measurements.create(
        baseManualMeasurement({
          measurement_id: "MSR-MAN-20260101-090000-001",
          timestamp: "2026-01-01T09:00:00",
        })
      );
      measurements.create(
        baseManualMeasurement({
          measurement_id: "MSR-MAN-20260101-090000-002",
          timestamp: "2026-01-01T09:00:00",
          repetition: 2,
        })
      );

      const res = await fetch(`${baseUrl}/api/manual-measurements`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: ManualMeasurement[] };
      assert.deepEqual(
        body.data.map((m) => m.measurement_id),
        ["MSR-MAN-20260101-090000-001", "MSR-MAN-20260101-090000-002", "MSR-MAN-20260102-090000-001"]
      );
    });
  });
});

test("D) full data integrity: all fields preserved", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedParentPlant(db);
      const measurements = new SqliteManualMeasurementRepository(db);
      measurements.create(
        baseManualMeasurement({
          measurement_id: "MSR-MAN-20260101-090000-001",
          plant_height_cm: 10.5,
          failure_code: "none",
          notes: "clean capture",
        })
      );

      const res = await fetch(`${baseUrl}/api/manual-measurements`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: ManualMeasurement[] };
      const first = body.data[0];
      assert.deepEqual(first, {
        measurement_id: "MSR-MAN-20260101-090000-001",
        plant_id: "PLT-001",
        image_id: null,
        timestamp: "2026-01-01T09:00:00",
        experiment_day: 1,
        repetition: 1,
        attempt: 1,
        plant_height_cm: 10.5,
        observer: "observer_1",
        measurement_status: "pass",
        failure_code: "none",
        notes: "clean capture",
        method: "MANUAL",
      });
    });
  });
});

test("E) NULL preservation for optional fields", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedParentPlant(db);
      const measurements = new SqliteManualMeasurementRepository(db);
      measurements.create(
        baseManualMeasurement({
          measurement_id: "MSR-MAN-20260101-090000-002",
          repetition: 2,
        })
      );

      const res = await fetch(`${baseUrl}/api/manual-measurements`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: ManualMeasurement[] };
      const row = body.data[0];
      assert.equal(row.image_id, null);
      assert.equal(row.plant_height_cm, null);
      assert.equal(row.failure_code, null);
      assert.equal(row.notes, null);
    });
  });
});

test("F) GET existing detail returns full record", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedParentPlant(db);
      const measurements = new SqliteManualMeasurementRepository(db);
      measurements.create(
        baseManualMeasurement({
          measurement_id: "MSR-MAN-20260101-090000-001",
          plant_height_cm: 9.8,
          repetition: 1,
        })
      );

      const res = await fetch(`${baseUrl}/api/manual-measurements/MSR-MAN-20260101-090000-001`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: ManualMeasurement };
      assert.equal(body.data.measurement_id, "MSR-MAN-20260101-090000-001");
      assert.equal(body.data.plant_height_cm, 9.8);
      assert.equal(body.data.repetition, 1);
      assert.equal(body.data.observer, "observer_1");
      assert.equal(body.data.measurement_status, "pass");
      assert.equal(body.data.method, "MANUAL");
    });
  });
});

test("G) GET missing detail returns 404 manual_measurement.not_found", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/manual-measurements/MSR-MAN-999999-000000-999`);
      assert.equal(res.status, 404);
      const body = (await res.json()) as { error: { code: string; message: string } };
      assert.equal(body.error.code, "manual_measurement.not_found");
      assert.equal(body.error.message, "Manual measurement not found");
    });
  });
});

test("H) repository duplicate behavior preserved", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    const context = createAppContext({ storageDir, filename });
    const plants = new SqlitePlantRepository(context.db);
    plants.create(basePlant());
    const measurements = new SqliteManualMeasurementRepository(context.db);
    measurements.create(baseManualMeasurement());

    assert.throws(
      () => measurements.create(baseManualMeasurement({ timestamp: "2026-01-01T10:00:00" })),
      (error: unknown) => error instanceof RepositoryError && error.code === "id.duplicate"
    );

    context.db.close();
  });
});

test("I) FK behavior: unknown plant produces reference.missing_parent", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    const context = createAppContext({ storageDir, filename });
    const measurements = new SqliteManualMeasurementRepository(context.db);

    assert.throws(
      () => measurements.create(baseManualMeasurement({ plant_id: "PLT-999" })),
      (error: unknown) => error instanceof RepositoryError && error.code === "reference.missing_parent"
    );

    context.db.close();
  });
});

test("J) write surface: POST implemented, no PATCH/PUT/DELETE routes", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedParentPlant(db);

      const created = await fetch(`${baseUrl}/api/manual-measurements`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(baseManualMeasurement({ plant_height_cm: 10.5 })),
      });
      assert.equal(created.status, 201, "append-only create must be implemented");

      for (const [method, url] of [
        ["PATCH", "/api/manual-measurements/MSR-MAN-20260101-090000-001"],
        ["PUT", "/api/manual-measurements/MSR-MAN-20260101-090000-001"],
        ["DELETE", "/api/manual-measurements/MSR-MAN-20260101-090000-001"],
      ] as const) {
        const res = await fetch(`${baseUrl}${url}`, { method });
        assert.equal(res.status, 404, `${method} ${url} must not be implemented`);
        const body = (await res.json()) as { error: { code: string } };
        assert.equal(body.error.code, "route.not_found", `${method} ${url} must fall through to 404`);
      }
    });
  });
});