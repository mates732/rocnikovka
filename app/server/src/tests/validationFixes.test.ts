import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDb, migrate } from "../db.js";
import { RepositoryError } from "../repositories/base.js";
import { SqliteImageRecordRepository, SqlitePlantRepository } from "../repositories/sqliteRepositories.js";
import { validateImageRecord, validateWaterEvent } from "../validation/schema.js";
import type { ImageRecord, Plant, WaterEvent } from "../types.js";

function withTestDb<T>(run: (args: { storageDir: string; filename: string }) => T): T {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "plant-ai-block4d42-"));
  const storageDir = path.join(tempRoot, "storage");
  const filename = "test.sqlite";

  try {
    return run({ storageDir, filename });
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

test("A) invalid calendar timestamps are rejected", () => {
  for (const timestamp of ["2026-02-30T10:00:00", "2026-04-31T10:00:00", "2026-13-01T10:00:00", "2026-00-10T10:00:00", "2026-02-29T10:00:00"]) {
    const result = validateImageRecord(baseImageRecord({ timestamp }));
    assert.equal(result.valid, false, `timestamp ${timestamp} must be rejected`);
    assert.ok(result.issues.some((i) => i.code === "timestamp.invalid" && i.field === "timestamp"));
  }
});

test("A2) invalid calendar timestamp rejected by repository", () => {
  withTestDb(({ storageDir, filename }) => {
    const db = createDb({ storageDir, filename });
    migrate(db);
    const plants = new SqlitePlantRepository(db);
    plants.create(basePlant());

    const images = new SqliteImageRecordRepository(db);
    assert.throws(
      () => images.create(baseImageRecord({ timestamp: "2026-02-30T10:00:00" })),
      (error: unknown) => error instanceof RepositoryError && error.code === "validation.failed"
    );

    db.close();
  });
});

test("B) leap-year timestamp accepted, non-leap rejected", () => {
  const leap = validateImageRecord(baseImageRecord({ timestamp: "2028-02-29T10:00:00" }));
  assert.equal(leap.valid, true, "2028-02-29 is a valid leap-year date");

  const nonLeap = validateImageRecord(baseImageRecord({ timestamp: "2026-02-29T10:00:00" }));
  assert.equal(nonLeap.valid, false, "2026-02-29 is not a leap-year date");
});

test("C) invalid times are rejected", () => {
  for (const timestamp of ["2026-01-01T25:00:00", "2026-01-01T10:61:00", "2026-01-01T10:00:61"]) {
    const result = validateImageRecord(baseImageRecord({ timestamp }));
    assert.equal(result.valid, false, `timestamp ${timestamp} must be rejected`);
  }
});

test("D) valid timestamps preserved incl. shared validator", () => {
  const valid = validateImageRecord(baseImageRecord({ timestamp: "2026-01-01T08:00:00" }));
  assert.equal(valid.valid, true);

  const shared = validateWaterEvent(baseWaterEvent({ timestamp: "2026-04-31T08:00:00" }));
  assert.equal(shared.valid, false, "shared validator must reject impossible calendar date for other entities");

  const sharedValid = validateWaterEvent(baseWaterEvent({ timestamp: "2026-01-01T08:00:00" }));
  assert.equal(sharedValid.valid, true);
});

test("E) valid failure_code values accepted", () => {
  withTestDb(({ storageDir, filename }) => {
    const db = createDb({ storageDir, filename });
    migrate(db);
    const plants = new SqlitePlantRepository(db);
    plants.create(basePlant());

    const images = new SqliteImageRecordRepository(db);
    images.create(baseImageRecord({ failure_code: "occlusion" }));
    assert.equal(images.getById("IMG-20260101-080000-001")?.failure_code, "occlusion");

    db.close();
  });
});

test("F) NULL failure_code accepted", () => {
  withTestDb(({ storageDir, filename }) => {
    const db = createDb({ storageDir, filename });
    migrate(db);
    const plants = new SqlitePlantRepository(db);
    plants.create(basePlant());

    const images = new SqliteImageRecordRepository(db);
    images.create(baseImageRecord());
    assert.equal(images.getById("IMG-20260101-080000-001")?.failure_code, null);

    db.close();
  });
});

test("G) invalid failure_code rejected by DB CHECK", () => {
  withTestDb(({ storageDir, filename }) => {
    const db = createDb({ storageDir, filename });
    migrate(db);
    const plants = new SqlitePlantRepository(db);
    plants.create(basePlant());

    assert.throws(
      () =>
        db
          .prepare(
            `
          INSERT INTO image_records (
            image_id, plant_id, timestamp, experiment_day,
            image_path, camera_id, image_quality_status,
            calibration_status, cal_ref_id, failure_code, notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            "IMG-20260102-080000-999",
            "PLT-001",
            "2026-01-02T08:00:00",
            2,
            "data/raw/images/x.jpg",
            "CAM-01",
            "PASS",
            "pass",
            null,
            "invalid_code",
            null
          ),
      (error: unknown) => error instanceof Error && /CHECK constraint failed/.test(error.message)
    );

    db.close();
  });
});

test("H) existing repository validation behavior still works", () => {
  withTestDb(({ storageDir, filename }) => {
    const db = createDb({ storageDir, filename });
    migrate(db);
    const plants = new SqlitePlantRepository(db);
    plants.create(basePlant());
    const images = new SqliteImageRecordRepository(db);

    images.create(baseImageRecord());

    assert.equal(images.getById("IMG-20260101-080000-001")?.camera_id, "CAM-01");

    assert.throws(
      () => images.create(baseImageRecord({ timestamp: "2026-01-01T10:00:00" })),
      (error: unknown) => error instanceof RepositoryError && error.code === "id.duplicate"
    );

    assert.throws(
      () => images.create(baseImageRecord({ image_id: "IMG-20260102-080000-999", plant_id: "PLT-999" })),
      (error: unknown) => error instanceof RepositoryError && error.code === "reference.missing_parent"
    );

    db.close();
  });
});

test("M) migration from v1 schema state preserves data and adds CHECK", () => {
  withTestDb(({ storageDir, filename }) => {
    const db = createDb({ storageDir, filename });
    db.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
      CREATE TABLE plants (
        plant_id TEXT PRIMARY KEY,
        pot_id TEXT NOT NULL UNIQUE,
        group_name TEXT NOT NULL CHECK (group_name IN ('G0','G1','G2')),
        emergence_date TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active','damaged','dead','excluded')),
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT
      );
      CREATE TABLE image_records (
        image_id TEXT PRIMARY KEY,
        plant_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        experiment_day INTEGER NOT NULL CHECK (experiment_day >= 1),
        image_path TEXT NOT NULL,
        camera_id TEXT NOT NULL,
        image_quality_status TEXT NOT NULL CHECK (image_quality_status IN ('PASS','WARN','FAIL')),
        calibration_status TEXT NOT NULL CHECK (calibration_status IN ('pass','warn','fail')),
        cal_ref_id TEXT,
        failure_code TEXT,
        notes TEXT,
        FOREIGN KEY (plant_id) REFERENCES plants (plant_id)
      );
    `);
    db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?)").run("2026-01-01T00:00:00");
    db.prepare(
      "INSERT INTO plants (plant_id, pot_id, group_name, emergence_date, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run("PLT-001", "POT-001", "G1", "2026-02-01", "active", null, "2026-02-01T08:00:00");
    db.prepare(
      `
        INSERT INTO image_records (
          image_id, plant_id, timestamp, experiment_day,
          image_path, camera_id, image_quality_status,
          calibration_status, cal_ref_id, failure_code, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      "IMG-20260101-080000-001",
      "PLT-001",
      "2026-01-01T08:00:00",
      1,
      "data/raw/images/IMG-20260101-080000-001.jpg",
      "CAM-01",
      "PASS",
      "pass",
      null,
      "none",
      "legacy"
    );

    migrate(db);

    const migrated = db
      .prepare("SELECT * FROM image_records WHERE image_id = ?")
      .get("IMG-20260101-080000-001") as ImageRecord;
    assert.equal(migrated.image_id, "IMG-20260101-080000-001");
    assert.equal(migrated.failure_code, "none");
    assert.equal(migrated.notes, "legacy");
    assert.equal(migrated.cal_ref_id, null);

    const version = db
      .prepare("SELECT MAX(version) AS version FROM schema_migrations")
      .get() as { version: number | null };
    assert.equal(version.version, 8, "migrations v2, v3, v4, v5, v6, v7, v8 must be recorded");

    assert.throws(
      () =>
        db
          .prepare(
            `
          INSERT INTO image_records (
            image_id, plant_id, timestamp, experiment_day,
            image_path, camera_id, image_quality_status,
            calibration_status, cal_ref_id, failure_code, notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run("IMG-20260102-080000-999", "PLT-001", "2026-01-02T08:00:00", 2, "data/raw/images/y.jpg", "CAM-01", "PASS", "pass", null, "invalid_code", null),
      (error: unknown) => error instanceof Error && /CHECK constraint failed/.test(error.message)
    );

    db.close();
  });
});