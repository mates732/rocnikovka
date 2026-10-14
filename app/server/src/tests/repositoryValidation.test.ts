import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDb, migrate } from "../db.js";
import { RepositoryError } from "../repositories/base.js";
import {
  SqliteAICVMeasurementRepository,
  SqliteImageRecordRepository,
  SqliteManualMeasurementRepository,
  SqlitePlantRepository,
  SqlitePositionEventRepository,
  SqliteValidationIssueRepository,
  SqliteWaterEventRepository,
} from "../repositories/sqliteRepositories.js";
import { validatePlant } from "../validation/schema.js";

function withTestDb<T>(run: (args: { storageDir: string; filename: string }) => T): T {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "plant-ai-block3-"));
  const storageDir = path.join(tempRoot, "storage");
  const filename = "test.sqlite";

  try {
    return run({ storageDir, filename });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function basePlant() {
  return {
    plant_id: "PLT-001",
    pot_id: "POT-001",
    group_name: "G1" as const,
    emergence_date: "2026-01-01",
    status: "active" as const,
    created_at: "2026-01-01T08:00:00",
    notes: "",
  };
}

test("A) ID generation/validation format checks", () => {
  const invalidPlant = {
    ...basePlant(),
    plant_id: "BAD-1",
  };

  const result = validatePlant(invalidPlant);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.code === "id.invalid_format" && i.field === "plant_id"));
});

test("B) required-field validation", () => {
  const missing = {
    ...basePlant(),
    pot_id: "",
  };

  const result = validatePlant(missing);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.code === "required.missing" && i.field === "pot_id"));
});

test("C) enum validation", () => {
  const invalidEnum = {
    ...basePlant(),
    group_name: "G5" as "G1",
  };

  const result = validatePlant(invalidEnum);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.code === "enum.invalid" && i.field === "group_name"));
});

test("D) duplicate ID rejection", () => {
  withTestDb(({ storageDir, filename }) => {
    const db = createDb({ storageDir, filename });
    migrate(db);

    const plants = new SqlitePlantRepository(db);
    const row = basePlant();
    plants.create(row);

    assert.throws(
      () => plants.create({ ...row, pot_id: "POT-002" }),
      (error: unknown) => error instanceof RepositoryError && error.code === "id.duplicate"
    );

    db.close();
  });
});

test("E) foreign/reference integrity", () => {
  withTestDb(({ storageDir, filename }) => {
    const db = createDb({ storageDir, filename });
    migrate(db);

    const water = new SqliteWaterEventRepository(db);

    assert.throws(
      () =>
        water.create({
          water_event_id: "WTR-20260101-080000-001",
          plant_id: "PLT-999",
          timestamp: "2026-01-01T08:00:00",
          experiment_day: 1,
          pot_mass_before_g: 500,
          target_mass_g: 550,
          water_added_ml: 50,
          pot_mass_after_g: 550,
          watering_status: "pass",
        }),
      (error: unknown) => error instanceof RepositoryError && error.code === "reference.missing_parent"
    );

    db.close();
  });
});

test("F) repository create/read for base entities", () => {
  withTestDb(({ storageDir, filename }) => {
    const db = createDb({ storageDir, filename });
    migrate(db);

    const plants = new SqlitePlantRepository(db);
    const positions = new SqlitePositionEventRepository(db);
    const water = new SqliteWaterEventRepository(db);
    const images = new SqliteImageRecordRepository(db);
    const manual = new SqliteManualMeasurementRepository(db);
    const aicv = new SqliteAICVMeasurementRepository(db);

    plants.create(basePlant());

    positions.create({
      position_event_id: "POS-20260101-080000-001",
      position_id: "P01",
      timestamp: "2026-01-01T08:01:00",
      plant_id: "PLT-001",
      location: "RACK_A_ROW1_COL1",
      operator: "operator_a",
      reason: "initial_assignment",
    });

    water.create({
      water_event_id: "WTR-20260101-080000-001",
      plant_id: "PLT-001",
      timestamp: "2026-01-01T08:02:00",
      experiment_day: 1,
      pot_mass_before_g: 500,
      target_mass_g: 550,
      water_added_ml: 50,
      pot_mass_after_g: 550,
      watering_status: "pass",
    });

    images.create({
      image_id: "IMG-20260101-081500-001",
      plant_id: "PLT-001",
      timestamp: "2026-01-01T08:15:00",
      experiment_day: 1,
      image_path: "data/raw/images/IMG-20260101-081500-001.jpg",
      camera_id: "CAM-01",
      image_quality_status: "PASS",
      calibration_status: "pass",
      failure_code: "none",
    });

    manual.create({
      measurement_id: "MSR-MAN-20260101-090000-001",
      plant_id: "PLT-001",
      image_id: "IMG-20260101-081500-001",
      timestamp: "2026-01-01T09:00:00",
      experiment_day: 1,
      repetition: 1,
      attempt: 1,
      plant_height_cm: 10.5,
      observer: "observer_1",
      measurement_status: "pass",
      failure_code: "none",
      method: "MANUAL",
    });

    aicv.create({
      measurement_id: "MSR-AICV-20260101-091000-001",
      image_id: "IMG-20260101-081500-001",
      plant_id: "PLT-001",
      timestamp: "2026-01-01T09:10:00",
      experiment_day: 1,
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

    assert.equal(plants.getById("PLT-001")?.pot_id, "POT-001");
    assert.equal(positions.getById("POS-20260101-080000-001")?.plant_id, "PLT-001");
    assert.equal(water.getById("WTR-20260101-080000-001")?.experiment_day, 1);
    assert.equal(images.getById("IMG-20260101-081500-001")?.camera_id, "CAM-01");
    assert.equal(manual.getById("MSR-MAN-20260101-090000-001")?.method, "MANUAL");
    assert.equal(aicv.getById("MSR-AICV-20260101-091000-001")?.failure_code, "none");

    db.close();
  });
});

test("G) validation issue output structure", () => {
  const result = validatePlant({
    ...basePlant(),
    plant_id: "BAD",
    created_at: "2026-01-01 08:00:00",
  });

  assert.equal(result.valid, false);
  const first = result.issues[0];
  assert.ok(first.entity);
  assert.ok("field" in first);
  assert.ok("code" in first);
  assert.ok("message" in first);
  assert.ok("severity" in first);
});

test("H) persistence across close/reopen", () => {
  withTestDb(({ storageDir, filename }) => {
    {
      const db = createDb({ storageDir, filename });
      migrate(db);
      const plants = new SqlitePlantRepository(db);
      plants.create(basePlant());
      db.close();
    }

    {
      const db = createDb({ storageDir, filename });
      migrate(db);
      const plants = new SqlitePlantRepository(db);
      const row = plants.getById("PLT-001");
      assert.equal(row?.plant_id, "PLT-001");
      db.close();
    }
  });
});

test("ValidationIssue repository create/read", () => {
  withTestDb(({ storageDir, filename }) => {
    const db = createDb({ storageDir, filename });
    migrate(db);

    const issues = new SqliteValidationIssueRepository(db);
    issues.create({
      issue_id: "ISS-001",
      issue_type: "schema",
      entity_type: "plant",
      entity_id: "PLT-001",
      description: "example",
      severity: "WARN",
      created_at: "2026-01-01T10:00:00",
    });

    assert.equal(issues.getById("ISS-001")?.severity, "WARN");
    db.close();
  });
});
