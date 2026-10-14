// Phase 4H — CSV import / data ingestion tests.
//
// All fixtures are synthetic and live only inside temporary test databases.
// The production database (server/storage/experiment.sqlite) is never opened
// for writing by these tests (see test W).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import DatabaseValue from "better-sqlite3";
import { createDb, migrate } from "../db.js";
import { buildApp, createAppContext } from "../index.js";
import type { ImportIssue } from "../importService.js";

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

async function withTestDb<T>(
  run: (args: { storageDir: string; filename: string }) => T | Promise<T>
): Promise<T> {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "plant-ai-import-"));
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

function multipartBody(
  fields: Record<string, string>,
  filename: string,
  csvContent: string
): { body: string; contentType: string } {
  const boundary = `----plantAiImport${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const parts: string[] = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
    );
  }
  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: text/csv\r\n\r\n${csvContent}\r\n`
  );
  parts.push(`--${boundary}--\r\n`);
  return { body: parts.join(""), contentType: `multipart/form-data; boundary=${boundary}` };
}

async function postImport(
  baseUrl: string,
  entity: string,
  csvContent: string,
  filename = `${entity}.csv`,
  extraFields: Record<string, string> = {}
): Promise<{ status: number; body: any }> {
  const { body, contentType } = multipartBody({ entity, ...extraFields }, filename, csvContent);
  const res = await fetch(`${baseUrl}/api/import/csv`, {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });
  const json = (await res.json()) as any;
  return { status: res.status, body: json };
}

// ---------------------------------------------------------------------------
// CSV fixtures (all rows are synthetic test fixtures)
// ---------------------------------------------------------------------------

const PLANTS_HEADER = "plant_id,pot_id,group,emergence_date,status,notes,created_at,updated_at";
function plantsCsv(rows: string[]): string {
  return [PLANTS_HEADER, ...rows].join("\n") + "\n";
}

const WATER_HEADER =
  "water_event_id,plant_id,timestamp,experiment_day,pot_mass_before_g,target_mass_g,water_added_ml,pot_mass_after_g,watering_status,operator,notes";
function waterCsv(rows: string[]): string {
  return [WATER_HEADER, ...rows].join("\n") + "\n";
}

const POSITION_HEADER =
  "position_event_id,position_id,timestamp,plant_id,location,previous_location,operator,reason,notes";
function positionCsv(rows: string[]): string {
  return [POSITION_HEADER, ...rows].join("\n") + "\n";
}

const IMAGE_HEADER =
  "image_id,plant_id,timestamp,experiment_day,image_path,camera_id,image_quality_status,calibration_status,cal_ref_id,failure_code,notes";
function imageCsv(rows: string[]): string {
  return [IMAGE_HEADER, ...rows].join("\n") + "\n";
}

const MANUAL_HEADER =
  "measurement_id,plant_id,image_id,timestamp,experiment_day,repetition,attempt,plant_height_cm,observer,measurement_status,failure_code,notes";
function manualCsv(rows: string[]): string {
  return [MANUAL_HEADER, ...rows].join("\n") + "\n";
}

const AICV_HEADER =
  "measurement_id,image_id,plant_id,timestamp,experiment_day,model,model_version,pipeline_version,detection_status,segmentation_status,calibration_status,plant_height_cm,projected_area_cm2,confidence,failure_code,notes";
function aicvCsv(rows: string[]): string {
  return [AICV_HEADER, ...rows].join("\n") + "\n";
}

function seedPlant(db: Database.Database, plantId: string, potId: string): void {
  db.prepare(
    `INSERT INTO plants (plant_id, pot_id, group_name, emergence_date, status, notes, created_at)
     VALUES (?, ?, 'G1', '2026-02-01', 'active', NULL, '2026-02-01T08:00:00')`
  ).run(plantId, potId);
}

function seedImage(db: Database.Database, imageId: string, plantId: string, experimentDay = 1): void {
  db.prepare(
    `INSERT INTO image_records (image_id, plant_id, timestamp, experiment_day, image_path, camera_id, image_quality_status, calibration_status, failure_code)
     VALUES (?, ?, '2026-02-01T08:00:00', ?, 'data/raw/images/x.jpg', 'CAM-01', 'PASS', 'pass', 'none')`
  ).run(imageId, plantId, experimentDay);
}

function count(db: Database.Database, table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
}

function createWriteDenialTriggers(db: Database.Database): void {
  const tables = [
    "plants",
    "water_events",
    "position_events",
    "image_records",
    "manual_measurements",
    "aicv_measurements",
  ];
  for (const table of tables) {
    db.exec(`
      CREATE TRIGGER trg_import_no_update_${table} BEFORE UPDATE ON ${table}
      BEGIN SELECT RAISE(ABORT, 'import used UPDATE'); END;
      CREATE TRIGGER trg_import_no_delete_${table} BEFORE DELETE ON ${table}
      BEGIN SELECT RAISE(ABORT, 'import used DELETE'); END;
    `);
  }
}

// ---------------------------------------------------------------------------
// A) valid plants CSV import
// ---------------------------------------------------------------------------

test("A) valid plants CSV import", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      const csv = plantsCsv([
        "PLT-101,POT-101,G0,2026-02-01,active,row one,2026-02-01T08:00:00,",
        "PLT-102,POT-102,G1,2026-02-02,active,,2026-02-02T08:00:00,2026-02-03T09:00:00",
        "PLT-103,POT-103,G2,2026-02-03,damaged,third,2026-02-03T08:00:00,",
      ]);
      const { status, body } = await postImport(baseUrl, "plants", csv);
      assert.equal(status, 200);
      assert.equal(body.data.entity, "plants");
      assert.equal(body.data.rows_read, 3);
      assert.equal(body.data.rows_inserted, 3);
      assert.equal(body.data.rows_skipped_idempotent, 0);
      assert.equal(count(db, "plants"), 3);
      const row = db.prepare("SELECT * FROM plants WHERE plant_id = 'PLT-102'").get() as any;
      assert.equal(row.group_name, "G1");
      assert.equal(row.updated_at, "2026-02-03T09:00:00");
    })
  );
});

// ---------------------------------------------------------------------------
// B) valid water CSV import
// ---------------------------------------------------------------------------

test("B) valid water CSV import", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db, "PLT-110", "POT-110");
      const csv = waterCsv([
        "WTR-20260201-080000-110,PLT-110,2026-02-01T08:00:00,1,500.0,550.0,50.0,550.0,pass,observer_a,",
        "WTR-20260202-080000-110,PLT-110,2026-02-02T08:00:00,2,550.0,550.0,0.0,550.0,pass,observer_a,fine",
      ]);
      const { status, body } = await postImport(baseUrl, "water_events", csv, "water_log.csv");
      assert.equal(status, 200);
      assert.equal(body.data.rows_inserted, 2);
      assert.equal(count(db, "water_events"), 2);
      const row = db.prepare("SELECT * FROM water_events WHERE water_event_id = 'WTR-20260201-080000-110'").get() as any;
      assert.equal(row.pot_mass_before_g, 500);
      assert.equal(row.watering_status, "pass");
    })
  );
});

// ---------------------------------------------------------------------------
// C) valid position CSV import
// ---------------------------------------------------------------------------

test("C) valid position CSV import", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db, "PLT-120", "POT-120");
      const csv = positionCsv([
        "POS-20260201-080000-120,P01,2026-02-01T08:00:00,PLT-120,RACK_A_ROW1_COL1,,observer_a,initial_assignment,",
        "POS-20260203-080000-120,P02,2026-02-03T08:00:00,PLT-120,RACK_A_ROW1_COL2,RACK_A_ROW1_COL1,observer_a,rotation,moved",
      ]);
      const { status, body } = await postImport(baseUrl, "position_events", csv, "positions_log.csv");
      assert.equal(status, 200);
      assert.equal(body.data.rows_inserted, 2);
      assert.equal(count(db, "position_events"), 2);
      const row = db.prepare("SELECT * FROM position_events WHERE position_event_id = 'POS-20260203-080000-120'").get() as any;
      assert.equal(row.previous_location, "RACK_A_ROW1_COL1");
      assert.equal(row.reason, "rotation");
    })
  );
});

// ---------------------------------------------------------------------------
// D) valid image CSV import
// ---------------------------------------------------------------------------

test("D) valid image CSV import", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db, "PLT-130", "POT-130");
      const csv = imageCsv([
        "IMG-20260201-080000-130,PLT-130,2026-02-01T08:00:00,1,data/raw/images/IMG-20260201-080000-130.jpg,CAM-01,PASS,pass,CAL-REF-01,none,",
        "IMG-20260202-080000-130,PLT-130,2026-02-02T08:00:00,2,data/raw/images/IMG-20260202-080000-130.jpg,CAM-01,WARN,pass,,poor_image_quality,blurry",
      ]);
      const { status, body } = await postImport(baseUrl, "image_records", csv, "images_log.csv");
      assert.equal(status, 200);
      assert.equal(body.data.rows_inserted, 2);
      assert.equal(count(db, "image_records"), 2);
      const row = db.prepare("SELECT * FROM image_records WHERE image_id = 'IMG-20260202-080000-130'").get() as any;
      assert.equal(row.experiment_day, 2);
      assert.equal(row.failure_code, "poor_image_quality");
      assert.equal(row.image_quality_status, "WARN");
    })
  );
});

// ---------------------------------------------------------------------------
// E) valid manual measurement CSV import (current format with attempt)
// ---------------------------------------------------------------------------

test("E) valid manual measurement CSV import", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db, "PLT-140", "POT-140");
      const csv = manualCsv([
        "MSR-MAN-20260201-090000-140,PLT-140,,2026-02-01T09:00:00,1,1,1,12.5,observer_a,pass,none,",
        "MSR-MAN-20260201-090500-140,PLT-140,,2026-02-01T09:05:00,1,2,2,12.6,observer_a,fail,occlusion,retake",
      ]);
      const { status, body } = await postImport(baseUrl, "manual_measurements", csv, "manual_measurements.csv");
      assert.equal(status, 200);
      assert.equal(body.data.rows_inserted, 2);
      assert.equal(count(db, "manual_measurements"), 2);
      const row = db.prepare("SELECT * FROM manual_measurements WHERE measurement_id = 'MSR-MAN-20260201-090500-140'").get() as any;
      assert.equal(row.attempt, 2);
      assert.equal(row.repetition, 2);
      assert.equal(row.method, "MANUAL");
    })
  );
});

// ---------------------------------------------------------------------------
// F) valid AICV CSV import
// ---------------------------------------------------------------------------

test("F) valid AICV CSV import", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db, "PLT-150", "POT-150");
      seedImage(db, "IMG-20260201-080000-150", "PLT-150", 3);
      const csv = aicvCsv([
        "MSR-AICV-20260201-091000-150,IMG-20260201-080000-150,PLT-150,2026-02-01T09:10:00,3,model-a,v1.0,pipeline-v1,pass,pass,pass,12.1,35.6,0.95,none,",
        "MSR-AICV-20260201-091100-150,IMG-20260201-080000-150,PLT-150,2026-02-01T09:11:00,3,model-a,v1.0,pipeline-v1,pass,not_applicable,warn,,,0.91,poor_image_quality,low conf",
      ]);
      const { status, body } = await postImport(baseUrl, "aicv_measurements", csv, "ai_measurements.csv");
      assert.equal(status, 200);
      assert.equal(body.data.rows_inserted, 2);
      assert.equal(count(db, "aicv_measurements"), 2);
      const row = db.prepare("SELECT * FROM aicv_measurements WHERE measurement_id = 'MSR-AICV-20260201-091000-150'").get() as any;
      assert.equal(row.experiment_day, 3);
      assert.equal(row.plant_id, "PLT-150");
      assert.equal(row.confidence, 0.95);
    })
  );
});

// ---------------------------------------------------------------------------
// G) invalid required field
// ---------------------------------------------------------------------------

test("G) invalid required field rejected with structured issue and no insert", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      const csv = plantsCsv(["PLT-160,POT-160,G0,2026-02-01,,notes,2026-02-01T08:00:00,"]);
      const { status, body } = await postImport(baseUrl, "plants", csv);
      assert.equal(status, 400);
      assert.equal(body.error.code, "import.validation_failed");
      assert.ok(body.error.issues.length >= 1);
      const issue = body.error.issues.find((x: ImportIssue) => x.field === "status") as ImportIssue;
      assert.ok(issue, "expected a status issue");
      assert.equal(issue.row, 2);
      assert.equal(issue.entity, "plants");
      assert.equal(issue.code, "required.missing");
      assert.equal(count(db, "plants"), 0);
    })
  );
});

// ---------------------------------------------------------------------------
// H) invalid enum
// ---------------------------------------------------------------------------

test("H) invalid enum rejected with structured issue and no insert", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db, "PLT-170", "POT-170");
      const csv = waterCsv([
        "WTR-20260201-080000-170,PLT-170,2026-02-01T08:00:00,1,500.0,550.0,50.0,550.0,overflow,,notes",
      ]);
      const { status, body } = await postImport(baseUrl, "water_events", csv);
      assert.equal(status, 400);
      assert.equal(body.error.code, "import.validation_failed");
      const issue = body.error.issues.find((x: ImportIssue) => x.field === "watering_status") as ImportIssue;
      assert.ok(issue, "expected a watering_status issue");
      assert.equal(issue.code, "enum.invalid");
      assert.equal(issue.row, 2);
      assert.match(issue.message, /allowed set/);
      assert.equal(count(db, "water_events"), 0);
    })
  );
});

// ---------------------------------------------------------------------------
// I) invalid numeric value
// ---------------------------------------------------------------------------

test("I) invalid numeric value rejected and no insert", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db, "PLT-180", "POT-180");
      const csv = waterCsv([
        "WTR-20260201-080000-180,PLT-180,2026-02-01T08:00:00,1,500.0,abc,50.0,550.0,pass,,notes",
      ]);
      const { status, body } = await postImport(baseUrl, "water_events", csv);
      assert.equal(status, 400);
      assert.equal(body.error.code, "import.validation_failed");
      const issue = body.error.issues.find((x: ImportIssue) => x.field === "target_mass_g") as ImportIssue;
      assert.ok(issue, "expected a target_mass_g issue");
      assert.equal(issue.code, "number.invalid_format");
      assert.match(issue.message, /not a valid number/);
      assert.equal(count(db, "water_events"), 0);
    })
  );
});

// ---------------------------------------------------------------------------
// J) invalid timestamp
// ---------------------------------------------------------------------------

test("J) invalid timestamp rejected and no insert", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db, "PLT-190", "POT-190");
      const csv = waterCsv([
        "WTR-20260201-080000-190,PLT-190,2026-13-45T99:00:00,1,500.0,550.0,50.0,550.0,pass,,notes",
      ]);
      const { status, body } = await postImport(baseUrl, "water_events", csv);
      assert.equal(status, 400);
      assert.equal(body.error.code, "import.validation_failed");
      const issue = body.error.issues.find((x: ImportIssue) => x.field === "timestamp") as ImportIssue;
      assert.ok(issue, "expected a timestamp issue");
      assert.equal(issue.code, "timestamp.invalid");
      assert.equal(count(db, "water_events"), 0);
    })
  );
});

// ---------------------------------------------------------------------------
// K) invalid experiment_day
// ---------------------------------------------------------------------------

test("K) invalid experiment_day rejected and no insert", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db, "PLT-200", "POT-200");
      const csv = imageCsv([
        "IMG-20260201-080000-200,PLT-200,2026-02-01T08:00:00,0,data/raw/images/x.jpg,CAM-01,PASS,pass,,none,",
      ]);
      const { status, body } = await postImport(baseUrl, "image_records", csv);
      assert.equal(status, 400);
      assert.equal(body.error.code, "import.validation_failed");
      const issue = body.error.issues.find((x: ImportIssue) => x.field === "experiment_day") as ImportIssue;
      assert.ok(issue, "expected an experiment_day issue");
      assert.equal(issue.code, "number.out_of_range");
      assert.equal(count(db, "image_records"), 0);
    })
  );
});

// ---------------------------------------------------------------------------
// L) FK failure
// ---------------------------------------------------------------------------

test("L) FK failure produces structured issue and no insert", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      const csv = waterCsv([
        "WTR-20260201-080000-210,PLT-999,2026-02-01T08:00:00,1,500.0,550.0,50.0,550.0,pass,,notes",
      ]);
      const { status, body } = await postImport(baseUrl, "water_events", csv);
      assert.equal(status, 400);
      assert.equal(body.error.code, "import.validation_failed");
      const issue = body.error.issues.find((x: ImportIssue) => x.field === "plant_id") as ImportIssue;
      assert.ok(issue, "expected a plant_id issue");
      assert.equal(issue.code, "reference.missing_parent");
      assert.match(issue.message, /does not exist in plants/);
      assert.equal(count(db, "water_events"), 0);
    })
  );
});

// ---------------------------------------------------------------------------
// M) malformed CSV
// ---------------------------------------------------------------------------

test("M) malformed CSV (column count mismatch) rejected", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      const csv = plantsCsv(["PLT-220,POT-220"]);
      const { status, body } = await postImport(baseUrl, "plants", csv);
      assert.equal(status, 400);
      assert.equal(body.error.code, "import.validation_failed");
      const issue = body.error.issues.find((x: ImportIssue) => x.code === "csv.structure") as ImportIssue;
      assert.ok(issue, "expected a csv.structure issue");
      assert.equal(issue.row, 2);
      assert.match(issue.message, /header defines/);
      assert.equal(count(db, "plants"), 0);
    })
  );
});

test("M2) unterminated quoted field rejected", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      const csv = `plant_id,pot_id,group,emergence_date,status,notes,created_at,updated_at\nPLT-221,POT-221,G0,2026-02-01,active,"unterminated,2026-02-01T08:00:00,\n`;
      const { status, body } = await postImport(baseUrl, "plants", csv);
      assert.equal(status, 400);
      const issue = body.error.issues.find((x: ImportIssue) => x.code === "csv.structure") as ImportIssue;
      assert.ok(issue, "expected a csv.structure issue");
      assert.match(issue.message, /Unterminated quoted field/);
      assert.equal(count(db, "plants"), 0);
    })
  );
});

// ---------------------------------------------------------------------------
// N) duplicate identical ID = idempotent no-op
// ---------------------------------------------------------------------------

test("N) duplicate identical ID is an idempotent no-op", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      const csv = plantsCsv([
        "PLT-230,POT-230,G0,2026-02-01,active,notes,2026-02-01T08:00:00,",
        "PLT-231,POT-231,G1,2026-02-01,active,,2026-02-01T08:00:00,",
      ]);
      const first = await postImport(baseUrl, "plants", csv);
      assert.equal(first.status, 200);
      assert.equal(first.body.data.rows_inserted, 2);

      const second = await postImport(baseUrl, "plants", csv);
      assert.equal(second.status, 200);
      assert.equal(second.body.data.rows_read, 2);
      assert.equal(second.body.data.rows_inserted, 0);
      assert.equal(second.body.data.rows_skipped_idempotent, 2);
      assert.equal(count(db, "plants"), 2);
    })
  );
});

// ---------------------------------------------------------------------------
// O) duplicate conflicting ID = error + rollback
// ---------------------------------------------------------------------------

test("O) duplicate conflicting ID errors and rolls back the whole file", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db, "PLT-240", "POT-240");
      db.prepare("UPDATE plants SET notes = 'original' WHERE plant_id = 'PLT-240'").run();

      const csv = plantsCsv([
        "PLT-241,POT-241,G1,2026-02-01,active,new row,2026-02-01T08:00:00,", // would be new
        "PLT-240,POT-240,G0,2026-02-01,active,CHANGED NOTES,2026-02-01T08:00:00,", // conflicts
      ]);
      const { status, body } = await postImport(baseUrl, "plants", csv);
      assert.equal(status, 400);
      assert.equal(body.error.code, "import.validation_failed");
      const issue = body.error.issues.find((x: ImportIssue) => x.code === "id.conflict") as ImportIssue;
      assert.ok(issue, "expected an id.conflict issue");
      assert.equal(issue.row, 3);
      assert.match(issue.message, /different data/);
      // Complete rollback: the valid new row (PLT-241) must NOT be present.
      assert.equal(count(db, "plants"), 1);
      const existing = db.prepare("SELECT notes FROM plants WHERE plant_id = 'PLT-240'").get() as { notes: string };
      assert.equal(existing.notes, "original", "existing row must not be modified");
    })
  );
});

test("O2) conflicting duplicate inside one file is rejected", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      const csv = plantsCsv([
        "PLT-242,POT-242,G0,2026-02-01,active,first,2026-02-01T08:00:00,",
        "PLT-242,POT-242,G0,2026-02-01,active,second,2026-02-01T08:00:00,",
      ]);
      const { status, body } = await postImport(baseUrl, "plants", csv);
      assert.equal(status, 400);
      const issue = body.error.issues.find((x: ImportIssue) => x.code === "id.conflict") as ImportIssue;
      assert.ok(issue, "expected an id.conflict issue");
      assert.equal(issue.row, 3);
      assert.match(issue.message, /same file/);
      assert.equal(count(db, "plants"), 0, "entire import must roll back");
    })
  );
});

test("O3) identical duplicate inside one file is an idempotent skip", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      const csv = plantsCsv([
        "PLT-243,POT-243,G0,2026-02-01,active,same,2026-02-01T08:00:00,",
        "PLT-243,POT-243,G0,2026-02-01,active,same,2026-02-01T08:00:00,",
      ]);
      const { status, body } = await postImport(baseUrl, "plants", csv);
      assert.equal(status, 200);
      assert.equal(body.data.rows_inserted, 1);
      assert.equal(body.data.rows_skipped_idempotent, 1);
      assert.equal(count(db, "plants"), 1);
    })
  );
});

// ---------------------------------------------------------------------------
// P) partial failure = complete rollback (100 valid + 1 invalid -> 0 rows)
// ---------------------------------------------------------------------------

test("P) partial failure rolls back the entire import", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      const rows: string[] = [];
      for (let i = 0; i < 100; i++) {
        const num = String(300 + i);
        rows.push(`PLT-${num},POT-${num},G0,2026-02-01,active,row,2026-02-01T08:00:00,`);
      }
      rows.push("PLT-400,BADPOT,G0,2026-02-01,bogus_status,row,2026-02-01T08:00:00,");
      const { status, body } = await postImport(baseUrl, "plants", plantsCsv(rows));
      assert.equal(status, 400);
      assert.equal(body.error.code, "import.validation_failed");
      assert.equal(count(db, "plants"), 0, "no rows may be committed on partial failure");
    })
  );
});

// ---------------------------------------------------------------------------
// Q) manual attempt validation
// ---------------------------------------------------------------------------

test("Q1) attempt below 1 rejected", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db, "PLT-410", "POT-410");
      const csv = manualCsv([
        "MSR-MAN-20260201-090000-410,PLT-410,,2026-02-01T09:00:00,1,1,0,12.5,observer_a,pass,none,",
      ]);
      const { status, body } = await postImport(baseUrl, "manual_measurements", csv);
      assert.equal(status, 400);
      const issue = body.error.issues.find((x: ImportIssue) => x.field === "attempt") as ImportIssue;
      assert.ok(issue, "expected an attempt issue");
      assert.equal(issue.code, "number.out_of_range");
      assert.match(issue.message, /attempt must be an integer >= 1/);
      assert.equal(count(db, "manual_measurements"), 0);
    })
  );
});

test("Q2) current-format CSV without attempt column rejected", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db, "PLT-411", "POT-411");
      const csv =
        "measurement_id,plant_id,timestamp,experiment_day,repetition,plant_height_cm,observer,measurement_status,failure_code,notes\n" +
        "MSR-MAN-20260201-090000-411,PLT-411,2026-02-01T09:00:00,1,1,12.5,observer_a,pass,none,\n";
      const { status, body } = await postImport(baseUrl, "manual_measurements", csv);
      assert.equal(status, 400);
      const issue = body.error.issues.find((x: ImportIssue) => x.code === "format.missing_column") as ImportIssue;
      assert.ok(issue, "expected a format.missing_column issue");
      assert.equal(issue.field, "attempt");
      assert.equal(issue.row, 0);
      assert.match(issue.message, /format_version=legacy/);
      assert.equal(count(db, "manual_measurements"), 0);
    })
  );
});

test("Q3) legacy manual CSV (declared) defaults attempt to 1", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db, "PLT-412", "POT-412");
      const csv =
        "measurement_id,plant_id,timestamp,experiment_day,repetition,plant_height_cm,observer,measurement_status,failure_code,notes\n" +
        "MSR-MAN-20260201-090000-412,PLT-412,2026-02-01T09:00:00,1,1,12.5,observer_a,pass,none,\n";
      const { status, body } = await postImport(
        baseUrl,
        "manual_measurements",
        csv,
        "manual_measurements_template.csv",
        { format_version: "legacy" }
      );
      assert.equal(status, 200);
      assert.equal(body.data.rows_inserted, 1);
      const row = db.prepare("SELECT attempt FROM manual_measurements WHERE measurement_id = 'MSR-MAN-20260201-090000-412'").get() as { attempt: number };
      assert.equal(row.attempt, 1);
    })
  );
});

test("Q4) repetition outside {1,2} rejected", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db, "PLT-413", "POT-413");
      const csv = manualCsv([
        "MSR-MAN-20260201-090000-413,PLT-413,,2026-02-01T09:00:00,1,3,1,12.5,observer_a,pass,none,",
      ]);
      const { status, body } = await postImport(baseUrl, "manual_measurements", csv);
      assert.equal(status, 400);
      const issue = body.error.issues.find((x: ImportIssue) => x.field === "repetition") as ImportIssue;
      assert.ok(issue, "expected a repetition issue");
      assert.equal(issue.code, "enum.invalid");
      assert.match(issue.message, /1 or 2/);
      assert.equal(count(db, "manual_measurements"), 0);
    })
  );
});

test("Q5) format_version=legacy rejected for non-manual entities", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      const csv = plantsCsv(["PLT-414,POT-414,G0,2026-02-01,active,,2026-02-01T08:00:00,"]);
      const { status, body } = await postImport(baseUrl, "plants", csv, "plants.csv", {
        format_version: "legacy",
      });
      assert.equal(status, 400);
      assert.equal(body.error.code, "import.invalid_format");
      assert.equal(count(db, "plants"), 0);
    })
  );
});

// ---------------------------------------------------------------------------
// R) AICV experiment_day mismatch = reject + rollback
// ---------------------------------------------------------------------------

test("R) AICV experiment_day mismatch rejected with full rollback", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db, "PLT-420", "POT-420");
      seedImage(db, "IMG-20260201-080000-420", "PLT-420", 5);
      const csv = aicvCsv([
        "MSR-AICV-20260201-091000-420,IMG-20260201-080000-420,PLT-420,2026-02-01T09:10:00,6,model-a,v1.0,pipeline-v1,pass,pass,pass,12.1,35.6,0.95,none,",
        "MSR-AICV-20260201-091100-420,IMG-20260201-080000-420,PLT-420,2026-02-01T09:11:00,5,model-a,v1.0,pipeline-v1,pass,pass,pass,12.2,36.0,0.94,none,",
      ]);
      const { status, body } = await postImport(baseUrl, "aicv_measurements", csv);
      assert.equal(status, 400);
      const issue = body.error.issues.find((x: ImportIssue) => x.code === "validation.experiment_day_mismatch") as ImportIssue;
      assert.ok(issue, "expected an experiment_day mismatch issue");
      assert.equal(issue.row, 2);
      assert.match(issue.message, /does not match image_records.experiment_day/);
      assert.equal(count(db, "aicv_measurements"), 0, "no AICV rows may be committed");
      const image = db.prepare("SELECT experiment_day FROM image_records WHERE image_id = 'IMG-20260201-080000-420'").get() as { experiment_day: number };
      assert.equal(image.experiment_day, 5, "image record must not be modified");
    })
  );
});

// ---------------------------------------------------------------------------
// S) AICV plant/image mismatch = reject + rollback
// ---------------------------------------------------------------------------

test("S) AICV plant_id / image plant mismatch rejected with full rollback", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db, "PLT-430", "POT-430");
      seedPlant(db, "PLT-431", "POT-431");
      seedImage(db, "IMG-20260201-080000-430", "PLT-430", 2);
      const csv = aicvCsv([
        "MSR-AICV-20260201-091000-430,IMG-20260201-080000-430,PLT-431,2026-02-01T09:10:00,2,model-a,v1.0,pipeline-v1,pass,pass,pass,12.1,35.6,0.95,none,",
      ]);
      const { status, body } = await postImport(baseUrl, "aicv_measurements", csv);
      assert.equal(status, 400);
      const issue = body.error.issues.find((x: ImportIssue) => x.code === "validation.plant_id_mismatch") as ImportIssue;
      assert.ok(issue, "expected a plant_id mismatch issue");
      assert.match(issue.message, /does not match image_records.plant_id/);
      assert.equal(count(db, "aicv_measurements"), 0);
    })
  );
});

test("S2) AICV CSV without experiment_day column rejected (no invented values)", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db, "PLT-432", "POT-432");
      seedImage(db, "IMG-20260201-080000-432", "PLT-432", 2);
      // Legacy ai template layout: no experiment_day column.
      const csv =
        "measurement_id,image_id,plant_id,timestamp,model,model_version,pipeline_version,detection_status,segmentation_status,calibration_status,plant_height_cm,projected_area_cm2,confidence,failure_code,notes\n" +
        "MSR-AICV-20260201-091000-432,IMG-20260201-080000-432,PLT-432,2026-02-01T09:10:00,model-a,v1.0,pipeline-v1,pass,pass,pass,12.1,35.6,0.95,none,\n";
      const { status, body } = await postImport(baseUrl, "aicv_measurements", csv, "ai_measurements_template.csv");
      assert.equal(status, 400);
      const issue = body.error.issues.find((x: ImportIssue) => x.code === "format.missing_column") as ImportIssue;
      assert.ok(issue, "expected a format.missing_column issue");
      assert.equal(issue.field, "experiment_day");
      assert.equal(count(db, "aicv_measurements"), 0);
    })
  );
});

// ---------------------------------------------------------------------------
// T) UTF-8 content
// ---------------------------------------------------------------------------

test("T) UTF-8 content is preserved", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      const note = "Poznámka ěščřžýáíé: měření proběhlo úspěšně — řepa";
      const csv = plantsCsv([`PLT-440,POT-440,G0,2026-02-01,active,"${note}",2026-02-01T08:00:00,`]);
      const { status, body } = await postImport(baseUrl, "plants", csv);
      assert.equal(status, 200);
      assert.equal(body.data.rows_inserted, 1);
      const row = db.prepare("SELECT notes FROM plants WHERE plant_id = 'PLT-440'").get() as { notes: string };
      assert.equal(row.notes, note);
    })
  );
});

// ---------------------------------------------------------------------------
// U) quoted CSV field containing comma / escaped quotes
// ---------------------------------------------------------------------------

test("U) quoted CSV field containing comma and escaped quotes", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      const csv = plantsCsv([
        `PLT-450,POT-450,G0,2026-02-01,active,"note with, comma and ""quotes""",2026-02-01T08:00:00,`,
      ]);
      const { status, body } = await postImport(baseUrl, "plants", csv);
      assert.equal(status, 200);
      assert.equal(body.data.rows_inserted, 1);
      const row = db.prepare("SELECT notes FROM plants WHERE plant_id = 'PLT-450'").get() as { notes: string };
      assert.equal(row.notes, 'note with, comma and "quotes"');
    })
  );
});

// ---------------------------------------------------------------------------
// V) empty optional fields -> SQL NULL
// ---------------------------------------------------------------------------

test("V) empty optional fields stored as NULL", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db, "PLT-460", "POT-460");
      const csv = waterCsv([
        "WTR-20260201-080000-460,PLT-460,2026-02-01T08:00:00,1,500.0,550.0,50.0,550.0,pass,,",
      ]);
      const { status } = await postImport(baseUrl, "water_events", csv);
      assert.equal(status, 200);
      const row = db.prepare("SELECT operator, notes FROM water_events WHERE water_event_id = 'WTR-20260201-080000-460'").get() as { operator: string | null; notes: string | null };
      assert.equal(row.operator, null);
      assert.equal(row.notes, null);
    })
  );
});

// ---------------------------------------------------------------------------
// W) production DB remains untouched by tests
// ---------------------------------------------------------------------------

test("W) production database is untouched by import tests", async () => {
  const prodDbPath = path.resolve(process.cwd(), "server", "storage", "experiment.sqlite");
  const prodDir = path.dirname(prodDbPath);
  const existedBefore = fs.existsSync(prodDbPath);
  const statBefore = existedBefore ? fs.statSync(prodDbPath) : null;

  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      const csv = plantsCsv([
        "PLT-871,POT-871,G0,2026-02-01,active,synthetic fixture,2026-02-01T08:00:00,",
        "PLT-872,POT-872,G1,2026-02-01,active,synthetic fixture,2026-02-01T08:00:00,",
      ]);
      const { status } = await postImport(baseUrl, "plants", csv);
      assert.equal(status, 200);
      assert.equal(count(db, "plants"), 2);
    })
  );

  if (fs.existsSync(prodDbPath)) {
    const statAfter = fs.statSync(prodDbPath);
    assert.equal(statAfter.size, statBefore?.size, "production DB file size must not change");
    assert.equal(statAfter.mtimeMs, statBefore?.mtimeMs, "production DB file mtime must not change");
    const readOnly = new DatabaseValue(prodDbPath, { readonly: true });
    const rows = readOnly
      .prepare("SELECT COUNT(*) AS n FROM plants WHERE plant_id IN ('PLT-871', 'PLT-872')")
      .get() as { n: number };
    assert.equal(rows.n, 0, "fixture rows must not exist in the production DB");
    readOnly.close();
  } else {
    assert.equal(fs.existsSync(prodDbPath), false, "production DB must not be created by tests");
  }
});

// ---------------------------------------------------------------------------
// X) import does not perform UPDATE
// ---------------------------------------------------------------------------

test("X) import performs no UPDATE statements", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      createWriteDenialTriggers(db);
      const csv = plantsCsv(["PLT-480,POT-480,G0,2026-02-01,active,notes,2026-02-01T08:00:00,"]);
      const { status, body } = await postImport(baseUrl, "plants", csv);
      assert.equal(status, 200, "valid import must succeed under UPDATE/DELETE denial triggers");
      assert.equal(body.data.rows_inserted, 1);
      assert.equal(count(db, "plants"), 1);

      // Idempotent re-import also performs no writes at all.
      const again = await postImport(baseUrl, "plants", csv);
      assert.equal(again.status, 200);
      assert.equal(again.body.data.rows_skipped_idempotent, 1);
      assert.equal(count(db, "plants"), 1);
    })
  );
});

// ---------------------------------------------------------------------------
// Y) import does not perform DELETE
// ---------------------------------------------------------------------------

test("Y) import performs no DELETE statements", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db, "PLT-490", "POT-490");
      seedImage(db, "IMG-20260201-080000-490", "PLT-490", 1);
      createWriteDenialTriggers(db);
      const csv = manualCsv([
        "MSR-MAN-20260201-090000-490,PLT-490,,2026-02-01T09:00:00,1,1,1,12.5,observer_a,pass,none,",
      ]);
      const { status, body } = await postImport(baseUrl, "manual_measurements", csv);
      assert.equal(status, 200, "valid import must succeed under UPDATE/DELETE denial triggers");
      assert.equal(body.data.rows_inserted, 1);
      assert.equal(count(db, "manual_measurements"), 1);
    })
  );
});

// ---------------------------------------------------------------------------
// Z) import never uses INSERT OR REPLACE
// ---------------------------------------------------------------------------

test("Z) import never uses INSERT OR REPLACE", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db, "PLT-500", "POT-500");
      // INSERT OR REPLACE fires DELETE triggers; deny DELETE to prove it is not used.
      db.exec(`
        CREATE TRIGGER trg_z_no_delete_water BEFORE DELETE ON water_events
        BEGIN SELECT RAISE(ABORT, 'delete during import'); END;
      `);
      const csv = waterCsv([
        "WTR-20260201-080000-500,PLT-500,2026-02-01T08:00:00,1,500.0,550.0,50.0,550.0,pass,obs,",
      ]);
      const first = await postImport(baseUrl, "water_events", csv);
      assert.equal(first.status, 200);
      assert.equal(first.body.data.rows_inserted, 1);

      // Re-import of the identical row must be a no-op, not a REPLACE.
      const second = await postImport(baseUrl, "water_events", csv);
      assert.equal(second.status, 200);
      assert.equal(second.body.data.rows_inserted, 0);
      assert.equal(second.body.data.rows_skipped_idempotent, 1);
      assert.equal(count(db, "water_events"), 1);
      const row = db
        .prepare("SELECT operator, notes FROM water_events WHERE water_event_id = 'WTR-20260201-080000-500'")
        .get() as { operator: string | null; notes: string | null };
      assert.equal(row.operator, "obs");
      assert.equal(row.notes, null, "row must be byte-identical after idempotent re-import");
    })
  );
});

// ---------------------------------------------------------------------------
// Extra API-level behavior
// ---------------------------------------------------------------------------

test("AA) ambiguous filename without explicit entity is rejected (no guessing)", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      const csv = plantsCsv(["PLT-510,POT-510,G0,2026-02-01,active,,2026-02-01T08:00:00,"]);
      const { body, contentType } = multipartBody({}, "my_random_export.csv", csv);
      const res = await fetch(`${baseUrl}/api/import/csv`, {
        method: "POST",
        headers: { "content-type": contentType },
        body,
      });
      const json = (await res.json()) as any;
      assert.equal(res.status, 400);
      assert.equal(json.error.code, "import.unknown_entity");
      assert.equal(count(db, "plants"), 0);
    })
  );
});

test("AB) recognized canonical filename resolves the entity", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      const csv = plantsCsv(["PLT-520,POT-520,G0,2026-02-01,active,,2026-02-01T08:00:00,"]);
      const { body, contentType } = multipartBody({}, "plants_template.csv", csv);
      const res = await fetch(`${baseUrl}/api/import/csv`, {
        method: "POST",
        headers: { "content-type": contentType },
        body,
      });
      const json = (await res.json()) as any;
      assert.equal(res.status, 200);
      assert.equal(json.data.entity, "plants");
      assert.equal(count(db, "plants"), 1);
    })
  );
});

test("AC) CSV parsing never executes content and only reads the uploaded buffer", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      // A formula-like cell is stored as literal text, never evaluated.
      const csv = plantsCsv([
        "PLT-530,POT-530,G0,2026-02-01,active,=cmd|'/C calc'!A0;drop table plants;,2026-02-01T08:00:00,",
      ]);
      const { status, body } = await postImport(baseUrl, "plants", csv);
      assert.equal(status, 200);
      assert.equal(body.data.rows_inserted, 1);
      const row = db.prepare("SELECT notes FROM plants WHERE plant_id = 'PLT-530'").get() as { notes: string };
      assert.match(row.notes, /^=cmd/);
      assert.equal(count(db, "plants"), 1, "table must still exist");
    })
  );
});

test("AD) manual measurement FK to missing image is rejected", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db, "PLT-540", "POT-540");
      const csv = manualCsv([
        "MSR-MAN-20260201-090000-540,PLT-540,IMG-20260101-000000-999,2026-02-01T09:00:00,1,1,1,12.5,observer_a,pass,none,",
      ]);
      const { status, body } = await postImport(baseUrl, "manual_measurements", csv);
      assert.equal(status, 400);
      const issue = body.error.issues.find((x: ImportIssue) => x.code === "reference.missing_parent") as ImportIssue;
      assert.ok(issue, "expected a reference.missing_parent issue");
      assert.equal(issue.field, "image_id");
      assert.equal(count(db, "manual_measurements"), 0);
    })
  );
});
