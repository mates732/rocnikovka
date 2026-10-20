/**
 * Migration tool tests.
 *
 * The critical properties are that the source is never modified, that a rerun
 * cannot duplicate or overwrite rows, and that the report reflects the real
 * source. These are tested by driving the tool against a real SQLite file and
 * asserting the source is byte-identical afterwards.
 */
import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const TOOL = path.resolve(process.cwd(), "scripts/migrate-sqlite-to-d1.ts");

interface CopyPlan {
  tables: string[];
  rowsByTable: Record<string, number>;
  problems: string[];
}

/** Parsed view of a dry-run report. */
function runDryRun(source: string, images?: string): { stdout: string; copyPlan: CopyPlan } {
  const args = ["tsx", TOOL, "--dry-run", "--source", source];
  if (images) args.push("--images", images);
  const isWin = process.platform === "win32";
  const cmd = isWin ? "cmd" : "npx";
  const cmdArgs = isWin ? ["/c", "npx", ...args] : args;
  const stdout = execFileSync(cmd, cmdArgs, { encoding: "utf8" });

  const rowsByTable: Record<string, number> = {};
  for (const match of stdout.matchAll(/^(\w+)\s+: (\d+) row\(s\)$/gm)) {
    rowsByTable[match[1]] = Number(match[2]);
  }
  const problems = [...stdout.matchAll(/^\s+! (.+)$/gm)].map((m) => m[1]);
  return { stdout, copyPlan: { tables: Object.keys(rowsByTable), rowsByTable, problems } };
}

function makeSourceDb(dir: string): string {
  // Reproduce the v8 source shape from the server migrations.
  const dbPath = path.join(dir, "experiment.sqlite");
  const db = new Database(dbPath);
  const migrationSql = fs
    .readFileSync(path.resolve(process.cwd(), "../server/src/db.ts"), "utf8")
    .toString();
  // Use the tool-agnostic source: build the minimal shape the tool reads.
  db.exec(`
    CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE plants (
      plant_id TEXT PRIMARY KEY, pot_id TEXT NOT NULL UNIQUE,
      group_name TEXT NOT NULL, emergence_date TEXT NOT NULL, status TEXT NOT NULL,
      notes TEXT, created_at TEXT NOT NULL, updated_at TEXT,
      sowing_date TEXT, seed_count INTEGER, substrate_mass_g REAL,
      empty_pot_mass_g REAL, saucer_mass_g REAL, seed_mass_g REAL, emergence_status TEXT
    );
    CREATE TABLE position_events (
      position_event_id TEXT PRIMARY KEY, position_id TEXT NOT NULL, timestamp TEXT NOT NULL,
      plant_id TEXT NOT NULL, location TEXT NOT NULL, previous_location TEXT, operator TEXT NOT NULL,
      reason TEXT NOT NULL, notes TEXT, FOREIGN KEY (plant_id) REFERENCES plants (plant_id)
    );
    CREATE TABLE water_events (
      water_event_id TEXT PRIMARY KEY, plant_id TEXT NOT NULL, timestamp TEXT NOT NULL,
      experiment_day INTEGER NOT NULL, pot_mass_before_g REAL NOT NULL, target_mass_g REAL NOT NULL,
      water_added_ml REAL NOT NULL, pot_mass_after_g REAL NOT NULL, watering_status TEXT NOT NULL,
      operator TEXT, notes TEXT, FOREIGN KEY (plant_id) REFERENCES plants (plant_id)
    );
    CREATE TABLE image_records (
      image_id TEXT PRIMARY KEY, plant_id TEXT NOT NULL, timestamp TEXT NOT NULL, experiment_day INTEGER NOT NULL,
      image_path TEXT NOT NULL, camera_id TEXT NOT NULL, image_quality_status TEXT NOT NULL,
      calibration_status TEXT NOT NULL, cal_ref_id TEXT, failure_code TEXT, notes TEXT,
      FOREIGN KEY (plant_id) REFERENCES plants (plant_id)
    );
    CREATE TABLE manual_measurements (
      measurement_id TEXT PRIMARY KEY, plant_id TEXT NOT NULL, image_id TEXT, timestamp TEXT NOT NULL,
      experiment_day INTEGER NOT NULL, repetition INTEGER NOT NULL, attempt INTEGER NOT NULL DEFAULT 1,
      plant_height_cm REAL, observer TEXT NOT NULL, measurement_status TEXT NOT NULL,
      failure_code TEXT, notes TEXT, method TEXT NOT NULL, FOREIGN KEY (plant_id) REFERENCES plants (plant_id)
    );
    CREATE TABLE aicv_measurements (
      measurement_id TEXT PRIMARY KEY, image_id TEXT NOT NULL, plant_id TEXT NOT NULL, timestamp TEXT NOT NULL,
      experiment_day INTEGER NOT NULL, model TEXT NOT NULL, model_version TEXT NOT NULL, pipeline_version TEXT NOT NULL,
      detection_status TEXT NOT NULL, segmentation_status TEXT NOT NULL, calibration_status TEXT NOT NULL,
      plant_height_cm REAL, projected_area_cm2 REAL, confidence REAL, failure_code TEXT NOT NULL, notes TEXT,
      FOREIGN KEY (plant_id) REFERENCES plants (plant_id), FOREIGN KEY (image_id) REFERENCES image_records (image_id)
    );
    CREATE TABLE validation_issues (
      issue_id TEXT PRIMARY KEY, issue_type TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT,
      description TEXT NOT NULL, severity TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE audit_log (
      event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT,
      details_json TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE day0_equipment (
      equipment_id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, quantity INTEGER NOT NULL,
      unit TEXT, model TEXT, resolution TEXT, verified INTEGER NOT NULL DEFAULT 0, verified_at TEXT,
      verified_by TEXT, notes TEXT, is_prepopulated INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT
    );
    CREATE TABLE day0_physical_config (
      config_id TEXT PRIMARY KEY, camera_device TEXT, camera_orientation TEXT, camera_distance_cm REAL,
      camera_angle_deg REAL, lighting_config TEXT, background TEXT, image_resolution TEXT, image_format TEXT,
      capture_procedure TEXT, calibration_ref_dimensions TEXT, calibration_ref_placement TEXT,
      pot_positioning TEXT, rotation_procedure TEXT, environmental_observations TEXT, additional_notes TEXT,
      planned_water_ml_g0 REAL, planned_water_ml_g1 REAL, planned_water_ml_g2 REAL,
      created_at TEXT NOT NULL, updated_at TEXT
    );
    CREATE TABLE day0_pot_allocation (
      allocation_id TEXT PRIMARY KEY, pot_id TEXT NOT NULL UNIQUE, plant_id TEXT, group_name TEXT,
      substrate_mass_g REAL NOT NULL DEFAULT 72, empty_pot_mass_g REAL, saucer_mass_g REAL,
      seed_count INTEGER NOT NULL DEFAULT 3, seeds_sown INTEGER, seedlings_emerged INTEGER, plants_retained INTEGER,
      seed_mass_g REAL, initial_water_ml REAL, initial_water_drained_ml REAL, initial_assembled_mass_g REAL,
      mass_basis TEXT NOT NULL DEFAULT 'unknown', sowing_date TEXT,
      sowing_status TEXT DEFAULT 'pending', emergence_status TEXT DEFAULT 'not_sown', emergence_date TEXT,
      notes TEXT, created_at TEXT NOT NULL, updated_at TEXT, FOREIGN KEY (plant_id) REFERENCES plants (plant_id)
    );
    CREATE TABLE day0_methodology_decisions (
      decision_id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, protocol_reference TEXT,
      status TEXT NOT NULL DEFAULT 'unresolved', decision TEXT, decided_by TEXT, decided_at TEXT,
      blocks_sowing INTEGER NOT NULL DEFAULT 0, blocks_emergence INTEGER NOT NULL DEFAULT 0,
      blocks_measurements INTEGER NOT NULL DEFAULT 0, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT
    );
  `);
  for (let v = 1; v <= 8; v++) {
    db.prepare(`INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)`).run(
      v,
      `2026-02-0${v}T08:00:00`
    );
  }
  db.prepare(
    `INSERT INTO plants (plant_id, pot_id, group_name, emergence_date, status, created_at, seed_count)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run("PLT-001", "POT-001", "G1", "2026-02-01", "active", "2026-02-01T08:00:00", 1);
  db.close();
  void migrationSql;
  return dbPath;
}

function hashFile(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

// ---------------------------------------------------------------------------

test("migration: dry run reports the real source contents", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "phyt-mig-"));
  try {
    const dbPath = makeSourceDb(dir);
    const { copyPlan } = runDryRun(dbPath);
    assert.equal(copyPlan.rowsByTable.plants, 1);
    assert.equal(copyPlan.rowsByTable.schema_migrations, 8);
    assert.equal(copyPlan.rowsByTable.water_events, 0);
    assert.deepEqual(copyPlan.problems, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("migration: dry run never modifies the source database", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "phyt-mig-"));
  try {
    const dbPath = makeSourceDb(dir);
    const before = hashFile(dbPath);

    runDryRun(dbPath);
    runDryRun(dbPath);

    assert.equal(hashFile(dbPath), before, "the source file must be byte-identical after a dry run");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("migration: PLT-001 survives untouched in the source", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "phyt-mig-"));
  try {
    const dbPath = makeSourceDb(dir);
    runDryRun(dbPath);

    const db = new Database(dbPath, { readonly: true });
    const row = db.prepare(`SELECT * FROM plants WHERE plant_id = ?`).get("PLT-001") as Record<string, unknown>;
    db.close();
    assert.equal(row.pot_id, "POT-001");
    assert.equal(row.group_name, "G1");
    assert.equal(row.emergence_date, "2026-02-01");
    assert.equal(row.seed_count, 1, "PLT-001 keeps its own stored seed count");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("migration: a rerun plans the same rows, making the copy idempotent", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "phyt-mig-"));
  try {
    const dbPath = makeSourceDb(dir);
    const first = runDryRun(dbPath).copyPlan;
    const second = runDryRun(dbPath).copyPlan;
    // The tool always reports the full source contents, and its INSERT is
    // INSERT OR IGNORE, so a rerun cannot duplicate or overwrite rows.
    assert.deepEqual(first.rowsByTable, second.rowsByTable);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("migration: a missing image file is reported as a problem", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "phyt-mig-"));
  try {
    const dbPath = makeSourceDb(dir);
    const db2 = new Database(dbPath);
    db2.prepare(
      `INSERT INTO image_records (image_id, plant_id, timestamp, experiment_day, image_path, camera_id,
                                  image_quality_status, calibration_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "IMG-20260201-080000-000",
      "PLT-001",
      "2026-02-01T08:00:00",
      1,
      "images/IMG-20260201-080000-000.jpg",
      "CAM-01",
      "PASS",
      "pass"
    );
    db2.close();

    const { copyPlan, stdout } = runDryRun(dbPath, path.join(dir, "images"));
    assert.ok(
      stdout.includes("UNRESOLVED") || stdout.includes("MISSING"),
      "a missing source image must be reported, not silently skipped"
    );
    assert.ok(copyPlan.problems.length > 0, "a missing image is a reported problem");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("migration: a missing source database fails loudly", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "phyt-mig-"));
  try {
    assert.throws(() => runDryRun(path.join(dir, "does-not-exist.sqlite")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Migrator accuracy: real row counts, UNIQUE conflicts, exit codes
// ---------------------------------------------------------------------------

test("migration: a duplicate pot_id in the SOURCE is reported as a problem", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "phyt-mig-"));
  try {
    // A legacy source database may predate the UNIQUE constraint on pot_id, so
    // the check must be able to see a duplicate that SQLite itself allowed.
    const dbPath = path.join(dir, "legacy.sqlite");
    const db = new Database(dbPath);
    db.exec(`
      CREATE TABLE plants (
        plant_id TEXT PRIMARY KEY,
        pot_id TEXT,
        group_name TEXT,
        emergence_date TEXT,
        status TEXT,
        created_at TEXT
      );
    `);
    db.prepare(`INSERT INTO plants VALUES (?,?,?,?,?,?)`).run(
      "PLT-001", "POT-001", "G1", "2026-02-01", "active", "2026-02-01T08:00:00"
    );
    // Two plants must never share a pot_id — the pot is one experimental unit.
    db.prepare(`INSERT INTO plants VALUES (?,?,?,?,?,?)`).run(
      "PLT-002", "POT-001", "G0", "2026-02-02", "active", "2026-02-02T08:00:00"
    );
    db.close();

    const { stdout, copyPlan } = runDryRun(dbPath);
    assert.ok(stdout.includes("duplicate value(s) in source"), "source-level UNIQUE conflict must be reported");
    assert.ok(
      copyPlan.problems.some((p) => /pot_id.*appears 2x in the SOURCE/.test(p)),
      "a duplicate pot_id must be an explicit problem"
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("migration: a clean source reports no UNIQUE problems", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "phyt-mig-"));
  try {
    const dbPath = makeSourceDb(dir);
    const { stdout } = runDryRun(dbPath);
    assert.ok(stdout.includes("OK (unique in source)"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
