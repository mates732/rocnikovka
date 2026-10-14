import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDb, migrate } from "../db.js";
import { RepositoryError } from "../repositories/base.js";
import { SqliteAICVMeasurementRepository, SqliteImageRecordRepository, SqlitePlantRepository } from "../repositories/sqliteRepositories.js";
import { FAILURE_CODES, validateAICVMeasurement } from "../validation/schema.js";
import type { AICVMeasurement, ImageRecord, Plant } from "../types.js";

function withTestDb<T>(run: (args: { storageDir: string; filename: string }) => T): T {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "plant-ai-block4f4-"));
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

function seedPlantAndImage(db: import("better-sqlite3").Database): void {
  const plants = new SqlitePlantRepository(db);
  plants.create(basePlant());
  const images = new SqliteImageRecordRepository(db);
  images.create(baseImageRecord());
}

test("A1) plant_height_cm finite validation", () => {
  const valid = validateAICVMeasurement(baseAICVMeasurement({ plant_height_cm: 12.3 }));
  assert.equal(valid.valid, true, "finite positive accepted");

  for (const value of [0, -1, NaN, Infinity, -Infinity]) {
    const result = validateAICVMeasurement(baseAICVMeasurement({ plant_height_cm: value }));
    assert.equal(result.valid, false, `plant_height_cm=${String(value)} must be rejected`);
    assert.ok(result.issues.some((i) => i.code === "number.out_of_range" && i.field === "plant_height_cm"));
  }
});

test("A1) projected_area_cm2 finite validation", () => {
  const valid = validateAICVMeasurement(baseAICVMeasurement({ projected_area_cm2: 25.1 }));
  assert.equal(valid.valid, true, "finite positive accepted");

  for (const value of [0, -1, NaN, Infinity, -Infinity]) {
    const result = validateAICVMeasurement(baseAICVMeasurement({ projected_area_cm2: value }));
    assert.equal(result.valid, false, `projected_area_cm2=${String(value)} must be rejected`);
    assert.ok(result.issues.some((i) => i.code === "number.out_of_range" && i.field === "projected_area_cm2"));
  }
});

test("A1) confidence finite validation with 0..1 bounds", () => {
  for (const value of [0, 1, 0.5, 0.0001, 0.9999]) {
    const result = validateAICVMeasurement(baseAICVMeasurement({ confidence: value }));
    assert.equal(result.valid, true, `confidence=${value} accepted`);
  }

  for (const value of [-0.01, 1.01, NaN, Infinity, -Infinity]) {
    const result = validateAICVMeasurement(baseAICVMeasurement({ confidence: value }));
    assert.equal(result.valid, false, `confidence=${String(value)} must be rejected`);
    assert.ok(result.issues.some((i) => i.code === "number.out_of_range" && i.field === "confidence"));
  }
});

test("A1) undefined/null optional numeric behavior preserved", () => {
  const undefinedOptionals = validateAICVMeasurement(baseAICVMeasurement());
  assert.equal(undefinedOptionals.valid, true, "undefined optionals accepted");

  const repository = withTestDb(({ storageDir, filename }) => {
    const db = createDb({ storageDir, filename });
    migrate(db);
    seedPlantAndImage(db);
    const aicv = new SqliteAICVMeasurementRepository(db);
    aicv.create(baseAICVMeasurement());
    const row = aicv.getById("MSR-AICV-20260101-091000-001");
    db.close();
    return row;
  });
  assert.equal(repository?.plant_height_cm, null);
  assert.equal(repository?.projected_area_cm2, null);
  assert.equal(repository?.confidence, null);
  assert.equal(repository?.notes, null);
});

test("A2) all existing valid failure codes accepted (app + DB)", () => {
  withTestDb(({ storageDir, filename }) => {
    const db = createDb({ storageDir, filename });
    migrate(db);
    seedPlantAndImage(db);
    const aicv = new SqliteAICVMeasurementRepository(db);

    FAILURE_CODES.forEach((code, index) => {
      aicv.create(
        baseAICVMeasurement({
          measurement_id: `MSR-AICV-20260101-09100${String(index).padStart(2, "0")}-00${index}`,
          timestamp: `2026-01-01T09:1${index}:00`,
          failure_code: code,
        })
      );
      assert.equal(aicv.getById(`MSR-AICV-20260101-09100${String(index).padStart(2, "0")}-00${index}`)?.failure_code, code);
    });

    db.close();
  });
});

test("A2) invalid failure_code rejected by DB CHECK", () => {
  withTestDb(({ storageDir, filename }) => {
    const db = createDb({ storageDir, filename });
    migrate(db);
    seedPlantAndImage(db);

    assert.throws(
      () =>
        db
          .prepare(
            `
          INSERT INTO aicv_measurements (
            measurement_id, image_id, plant_id, timestamp,
            experiment_day, model, model_version, pipeline_version,
            detection_status, segmentation_status, calibration_status,
            plant_height_cm, projected_area_cm2, confidence,
            failure_code, notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            "MSR-AICV-20260102-091000-999",
            "IMG-20260101-080000-001",
            "PLT-001",
            "2026-01-02T09:10:00",
            1,
            "baseline",
            "v1",
            "pipeline-v1",
            "pass",
            "pass",
            "pass",
            null,
            null,
            null,
            "bogus_code",
            null
          ),
      (error: unknown) => error instanceof Error && /CHECK constraint failed/.test(error.message)
    );

    db.close();
  });
});

test("A2) NULL failure_code rejected (NOT NULL)", () => {
  withTestDb(({ storageDir, filename }) => {
    const db = createDb({ storageDir, filename });
    migrate(db);
    seedPlantAndImage(db);

    assert.throws(
      () =>
        db
          .prepare(
            `
          INSERT INTO aicv_measurements (
            measurement_id, image_id, plant_id, timestamp,
            experiment_day, model, model_version, pipeline_version,
            detection_status, segmentation_status, calibration_status,
            failure_code
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            "MSR-AICV-20260102-091000-998",
            "IMG-20260101-080000-001",
            "PLT-001",
            "2026-01-02T09:10:00",
            1,
            "baseline",
            "v1",
            "pipeline-v1",
            "pass",
            "pass",
            "pass",
            null
          ),
      (error: unknown) => error instanceof Error && /NOT NULL constraint failed/.test(error.message)
    );

    db.close();
  });
});

test("A2) migration v3 preserves existing valid records and adds CHECK", () => {
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
      CREATE TABLE aicv_measurements (
        measurement_id TEXT PRIMARY KEY,
        image_id TEXT NOT NULL,
        plant_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        model TEXT NOT NULL,
        model_version TEXT NOT NULL,
        pipeline_version TEXT NOT NULL,
        detection_status TEXT NOT NULL CHECK (detection_status IN ('pass','fail')),
        segmentation_status TEXT NOT NULL CHECK (segmentation_status IN ('pass','fail','not_applicable')),
        calibration_status TEXT NOT NULL CHECK (calibration_status IN ('pass','warn','fail')),
        plant_height_cm REAL,
        projected_area_cm2 REAL,
        confidence REAL,
        failure_code TEXT NOT NULL,
        notes TEXT,
        FOREIGN KEY (plant_id) REFERENCES plants (plant_id),
        FOREIGN KEY (image_id) REFERENCES image_records (image_id)
      );
    `);
    db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?)").run("2026-01-01T00:00:00");
    db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (2, ?)").run("2026-01-01T00:00:00");
    db.prepare(
      "INSERT INTO plants (plant_id, pot_id, group_name, emergence_date, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run("PLT-001", "POT-001", "G1", "2026-02-01", "active", null, "2026-02-01T08:00:00");
    db.prepare(
      `
        INSERT INTO image_records (
          image_id, plant_id, timestamp, experiment_day,
          image_path, camera_id, image_quality_status, calibration_status, failure_code
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run("IMG-20260101-080000-001", "PLT-001", "2026-01-01T08:00:00", 1, "data/raw/images/x.jpg", "CAM-01", "PASS", "pass", null);
    db.prepare(
      `
        INSERT INTO aicv_measurements (
          measurement_id, image_id, plant_id, timestamp,
          model, model_version, pipeline_version,
          detection_status, segmentation_status, calibration_status,
          plant_height_cm, projected_area_cm2, confidence,
          failure_code, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      "MSR-AICV-20260101-091000-001",
      "IMG-20260101-080000-001",
      "PLT-001",
      "2026-01-01T09:10:00",
      "baseline",
      "v1",
      "pipeline-v1",
      "pass",
      "pass",
      "pass",
      10.4,
      20.1,
      0.93,
      "none",
      "legacy"
    );

    migrate(db);

    const migrated = db
      .prepare("SELECT * FROM aicv_measurements WHERE measurement_id = ?")
      .get("MSR-AICV-20260101-091000-001") as AICVMeasurement;
    assert.equal(migrated.plant_height_cm, 10.4);
    assert.equal(migrated.confidence, 0.93);
    assert.equal(migrated.failure_code, "none");
    assert.equal(migrated.notes, "legacy");

    const version = db
      .prepare("SELECT MAX(version) AS version FROM schema_migrations")
      .get() as { version: number | null };
    assert.equal(version.version, 8, "migrations v2, v3, v4, v5, v6, v7, v8 must be recorded");

    const table = db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'aicv_measurements'")
      .get() as { sql: string };
    assert.match(table.sql, /failure_code TEXT NOT NULL CHECK/);

    assert.throws(
      () =>
        db
          .prepare(
            `
          INSERT INTO aicv_measurements (
            measurement_id, image_id, plant_id, timestamp,
            experiment_day, model, model_version, pipeline_version,
            detection_status, segmentation_status, calibration_status,
            failure_code
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            "MSR-AICV-20260102-091000-997",
            "IMG-20260101-080000-001",
            "PLT-001",
            "2026-01-02T09:10:00",
            1,
            "baseline",
            "v1",
            "pipeline-v1",
            "pass",
            "pass",
            "pass",
            "invalid_code"
          ),
      (error: unknown) => error instanceof Error && /CHECK constraint failed/.test(error.message)
    );

    db.close();
  });
});

test("A2) duplicate ID and FK behavior unchanged", () => {
  withTestDb(({ storageDir, filename }) => {
    const db = createDb({ storageDir, filename });
    migrate(db);
    const aicv = new SqliteAICVMeasurementRepository(db);

    assert.throws(
      () => aicv.create(baseAICVMeasurement({ plant_id: "PLT-999" })),
      (error: unknown) => error instanceof RepositoryError && error.code === "reference.missing_parent"
    );

    seedPlantAndImage(db);
    aicv.create(baseAICVMeasurement());

    assert.throws(
      () => aicv.create(baseAICVMeasurement({ timestamp: "2026-01-01T10:00:00" })),
      (error: unknown) => error instanceof RepositoryError && error.code === "id.duplicate"
    );

    db.close();
  });
});

test("A2) application and DB accepted failure codes are identical", () => {
  const distinct = FAILURE_CODES.filter((code, index) => FAILURE_CODES.indexOf(code) === index);
  assert.equal(distinct.length, FAILURE_CODES.length, "no duplicates in application enum");

  withTestDb(({ storageDir, filename }) => {
    const db = createDb({ storageDir, filename });
    migrate(db);
    seedPlantAndImage(db);

    const table = db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'aicv_measurements'")
      .get() as { sql: string };
    const dbList = table.sql.match(/'([a-z_]+)'/g) ?? [];
    const dbCodes = dbList.map((s) => s.slice(1, -1)).filter((c) => FAILURE_CODES.includes(c as (typeof FAILURE_CODES)[number]));
    assert.equal(new Set(dbCodes).size, FAILURE_CODES.length, "DB CHECK list must contain exactly the application codes");

    db.close();
  });
});