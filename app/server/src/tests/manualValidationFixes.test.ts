import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDb, migrate } from "../db.js";
import { RepositoryError } from "../repositories/base.js";
import { SqliteManualMeasurementRepository, SqlitePlantRepository } from "../repositories/sqliteRepositories.js";
import { FAILURE_CODES, validateManualMeasurement } from "../validation/schema.js";
import type { ManualMeasurement, Plant } from "../types.js";

function withTestDb<T>(run: (args: { storageDir: string; filename: string }) => T): T {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "plant-ai-block4g2-"));
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

function seedParentPlant(db: import("better-sqlite3").Database): void {
  const plants = new SqlitePlantRepository(db);
  plants.create(basePlant());
}

test("M1) manual plant_height_cm finite validation", () => {
  const valid = validateManualMeasurement(baseManualMeasurement({ plant_height_cm: 10.5 }));
  assert.equal(valid.valid, true, "finite positive accepted");

  for (const value of [0, -1, NaN, Infinity, -Infinity]) {
    const result = validateManualMeasurement(baseManualMeasurement({ plant_height_cm: value }));
    assert.equal(result.valid, false, `plant_height_cm=${String(value)} must be rejected`);
    assert.ok(result.issues.some((i) => i.code === "number.out_of_range" && i.field === "plant_height_cm"));
  }
});

test("M1) optional semantics preserved (undefined -> SQL NULL)", () => {
  withTestDb(({ storageDir, filename }) => {
    const db = createDb({ storageDir, filename });
    migrate(db);
    seedParentPlant(db);

    const valid = validateManualMeasurement(baseManualMeasurement());
    assert.equal(valid.valid, true, "omitted plant_height_cm accepted");

    const measurements = new SqliteManualMeasurementRepository(db);
    measurements.create(baseManualMeasurement());
    assert.equal(measurements.getById("MSR-MAN-20260101-090000-001")?.plant_height_cm, null);

    db.close();
  });
});

test("M5) all current failure codes accepted (app + DB)", () => {
  withTestDb(({ storageDir, filename }) => {
    const db = createDb({ storageDir, filename });
    migrate(db);
    seedParentPlant(db);
    const measurements = new SqliteManualMeasurementRepository(db);

    FAILURE_CODES.forEach((code, index) => {
      measurements.create(
        baseManualMeasurement({
          measurement_id: `MSR-MAN-20260101-09000${index}-00${index}`,
          timestamp: `2026-01-01T09:0${index}:00`,
          failure_code: code,
        })
      );
      assert.equal(
        measurements.getById(`MSR-MAN-20260101-09000${index}-00${index}`)?.failure_code,
        code
      );
    });

    db.close();
  });
});

test("M5) NULL failure_code accepted (app + DB)", () => {
  withTestDb(({ storageDir, filename }) => {
    const db = createDb({ storageDir, filename });
    migrate(db);
    seedParentPlant(db);
    const measurements = new SqliteManualMeasurementRepository(db);
    measurements.create(baseManualMeasurement());

    assert.equal(measurements.getById("MSR-MAN-20260101-090000-001")?.failure_code, null);

    db.close();
  });
});

test("M5) invalid failure_code rejected by DB CHECK", () => {
  withTestDb(({ storageDir, filename }) => {
    const db = createDb({ storageDir, filename });
    migrate(db);
    seedParentPlant(db);

    assert.throws(
      () =>
        db
          .prepare(
            `
          INSERT INTO manual_measurements (
            measurement_id, plant_id, image_id, timestamp,
            experiment_day, repetition, attempt, plant_height_cm,
            observer, measurement_status, failure_code, notes, method
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run(
            "MSR-MAN-20260102-090000-999",
            "PLT-001",
            null,
            "2026-01-02T09:00:00",
            2,
            1,
            1,
            null,
            "observer_1",
            "pass",
            "invalid_code",
            null,
            "MANUAL"
          ),
      (error: unknown) => error instanceof Error && /CHECK constraint failed/.test(error.message)
    );

    db.close();
  });
});

test("M5) migration v4 preserves all legacy fields and adds CHECK", () => {
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
      CREATE TABLE manual_measurements (
        measurement_id TEXT PRIMARY KEY,
        plant_id TEXT NOT NULL,
        image_id TEXT,
        timestamp TEXT NOT NULL,
        experiment_day INTEGER NOT NULL CHECK (experiment_day >= 1),
        repetition INTEGER NOT NULL CHECK (repetition IN (1,2)),
        plant_height_cm REAL,
        observer TEXT NOT NULL,
        measurement_status TEXT NOT NULL CHECK (measurement_status IN ('pass','warn','fail')),
        failure_code TEXT,
        notes TEXT,
        method TEXT NOT NULL CHECK (method = 'MANUAL'),
        FOREIGN KEY (plant_id) REFERENCES plants (plant_id),
        FOREIGN KEY (image_id) REFERENCES image_records (image_id)
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
    db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (3, ?)").run("2026-01-01T00:00:00");
    db.prepare(
      "INSERT INTO plants (plant_id, pot_id, group_name, emergence_date, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run("PLT-001", "POT-001", "G1", "2026-02-01", "active", null, "2026-02-01T08:00:00");
    db.prepare(
      "INSERT INTO image_records (image_id, plant_id, timestamp, experiment_day, image_path, camera_id, image_quality_status, calibration_status, failure_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run("IMG-20260101-080000-001", "PLT-001", "2026-01-01T08:00:00", 1, "p.jpg", "CAM-01", "PASS", "pass", null);
    db.prepare(
      `
        INSERT INTO manual_measurements (
          measurement_id, plant_id, image_id, timestamp,
          experiment_day, repetition, plant_height_cm,
          observer, measurement_status, failure_code, notes, method
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      "MSR-MAN-20260101-090000-001",
      "PLT-001",
      "IMG-20260101-080000-001",
      "2026-01-01T09:00:00",
      1,
      1,
      10.5,
      "observer_1",
      "pass",
      "none",
      "legacy",
      "MANUAL"
    );
    db.prepare(
      `
        INSERT INTO manual_measurements (
          measurement_id, plant_id, timestamp,
          experiment_day, repetition,
          observer, measurement_status, failure_code, method
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run("MSR-MAN-20260101-090000-002", "PLT-001", "2026-01-01T09:05:00", 1, 2, "observer_1", "warn", null, "MANUAL");

    migrate(db);

    const first = db
      .prepare("SELECT * FROM manual_measurements WHERE measurement_id = ?")
      .get("MSR-MAN-20260101-090000-001") as ManualMeasurement;
    assert.equal(first.measurement_id, "MSR-MAN-20260101-090000-001");
    assert.equal(first.plant_id, "PLT-001");
    assert.equal(first.image_id, "IMG-20260101-080000-001");
    assert.equal(first.timestamp, "2026-01-01T09:00:00");
    assert.equal(first.experiment_day, 1);
    assert.equal(first.repetition, 1);
    assert.equal(first.plant_height_cm, 10.5);
    assert.equal(first.observer, "observer_1");
    assert.equal(first.measurement_status, "pass");
    assert.equal(first.failure_code, "none");
    assert.equal(first.notes, "legacy");
    assert.equal(first.method, "MANUAL");

    const second = db
      .prepare("SELECT * FROM manual_measurements WHERE measurement_id = ?")
      .get("MSR-MAN-20260101-090000-002") as ManualMeasurement;
    assert.equal(second.failure_code, null, "NULL failure_code must survive migration");

    const version = db
      .prepare("SELECT MAX(version) AS version FROM schema_migrations")
      .get() as { version: number | null };
    assert.equal(version.version, 8);

    const table = db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'manual_measurements'")
      .get() as { sql: string };
    assert.match(table.sql, /failure_code IS NULL OR failure_code IN/);

    assert.throws(
      () =>
        db
          .prepare(
            `
          INSERT INTO manual_measurements (
            measurement_id, plant_id, image_id, timestamp,
            experiment_day, repetition, attempt,
            observer, measurement_status, failure_code, method
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .run("MSR-MAN-20260102-090000-998", "PLT-001", null, "2026-01-02T09:00:00", 2, 1, 1, "observer_1", "pass", "invalid_code", "MANUAL"),
      (error: unknown) => error instanceof Error && /CHECK constraint failed/.test(error.message)
    );

    db.close();
  });
});

test("M5) invalid legacy failure_code blocks migration", () => {
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
      CREATE TABLE manual_measurements (
        measurement_id TEXT PRIMARY KEY,
        plant_id TEXT NOT NULL,
        image_id TEXT,
        timestamp TEXT NOT NULL,
        experiment_day INTEGER NOT NULL CHECK (experiment_day >= 1),
        repetition INTEGER NOT NULL CHECK (repetition IN (1,2)),
        plant_height_cm REAL,
        observer TEXT NOT NULL,
        measurement_status TEXT NOT NULL CHECK (measurement_status IN ('pass','warn','fail')),
        failure_code TEXT,
        notes TEXT,
        method TEXT NOT NULL CHECK (method = 'MANUAL'),
        FOREIGN KEY (plant_id) REFERENCES plants (plant_id),
        FOREIGN KEY (image_id) REFERENCES image_records (image_id)
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
    db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (3, ?)").run("2026-01-01T00:00:00");
    db.prepare(
      "INSERT INTO plants (plant_id, pot_id, group_name, emergence_date, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run("PLT-001", "POT-001", "G1", "2026-02-01", "active", null, "2026-02-01T08:00:00");
    db.prepare(
      "INSERT INTO image_records (image_id, plant_id, timestamp, experiment_day, image_path, camera_id, image_quality_status, calibration_status, failure_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run("IMG-20260101-080000-001", "PLT-001", "2026-01-01T08:00:00", 1, "p.jpg", "CAM-01", "PASS", "pass", null);
    db.prepare(
      `
        INSERT INTO manual_measurements (
          measurement_id, plant_id, timestamp,
          experiment_day, repetition,
          observer, measurement_status, failure_code, method
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run("MSR-MAN-20260101-090000-001", "PLT-001", "2026-01-01T09:00:00", 1, 1, "observer_1", "pass", "evil_code", "MANUAL");
    db.close();

    const migrated = createDb({ storageDir, filename });
    assert.throws(
      () => migrate(migrated),
      (error: unknown) => error instanceof Error && /Migration v4 blocked/.test(error.message)
    );
    migrated.close();
  });
});

test("M5) duplicate measurement_id and FK behavior unchanged", () => {
  withTestDb(({ storageDir, filename }) => {
    const db = createDb({ storageDir, filename });
    migrate(db);
    const measurements = new SqliteManualMeasurementRepository(db);

    assert.throws(
      () => measurements.create(baseManualMeasurement({ plant_id: "PLT-999" })),
      (error: unknown) => error instanceof RepositoryError && error.code === "reference.missing_parent"
    );

    seedParentPlant(db);
    measurements.create(baseManualMeasurement());

    assert.throws(
      () => measurements.create(baseManualMeasurement({ timestamp: "2026-01-01T10:00:00" })),
      (error: unknown) => error instanceof RepositoryError && error.code === "id.duplicate"
    );

    db.close();
  });
});

test("M5) application and DB accepted failure codes are identical", () => {
  const distinct = FAILURE_CODES.filter((code, index) => FAILURE_CODES.indexOf(code) === index);
  assert.equal(distinct.length, FAILURE_CODES.length, "no duplicates in application enum");

  withTestDb(({ storageDir, filename }) => {
    const db = createDb({ storageDir, filename });
    migrate(db);

    const table = db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'manual_measurements'")
      .get() as { sql: string };
    const dbList = table.sql.match(/'([a-z_]+)'/g) ?? [];
    const dbCodes = dbList.map((s) => s.slice(1, -1)).filter((c) => FAILURE_CODES.includes(c as (typeof FAILURE_CODES)[number]));
    assert.equal(new Set(dbCodes).size, FAILURE_CODES.length, "DB CHECK list must contain exactly the application codes");

    db.close();
  });
});