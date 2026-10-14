import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { FAILURE_CODES } from "./validation/schema.js";

export type DbConfig = {
  storageDir?: string;
  filename?: string;
};

const FAILURE_CODE_SQL = FAILURE_CODES.map((code) => `'${code}'`).join(", ");

const IMAGE_RECORDS_DDL = `
    CREATE TABLE IF NOT EXISTS image_records (
      image_id TEXT PRIMARY KEY,
      plant_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      experiment_day INTEGER NOT NULL CHECK (experiment_day >= 1),
      image_path TEXT NOT NULL,
      camera_id TEXT NOT NULL,
      image_quality_status TEXT NOT NULL CHECK (image_quality_status IN ('PASS','WARN','FAIL')),
      calibration_status TEXT NOT NULL CHECK (calibration_status IN ('pass','warn','fail')),
      cal_ref_id TEXT,
      failure_code TEXT CHECK (failure_code IS NULL OR failure_code IN (${FAILURE_CODE_SQL})),
      notes TEXT,
      FOREIGN KEY (plant_id) REFERENCES plants (plant_id)
    );
  `;

const MANUAL_MEASUREMENTS_DDL = `
    CREATE TABLE IF NOT EXISTS manual_measurements (
      measurement_id TEXT PRIMARY KEY,
      plant_id TEXT NOT NULL,
      image_id TEXT,
      timestamp TEXT NOT NULL,
      experiment_day INTEGER NOT NULL CHECK (experiment_day >= 1),
      repetition INTEGER NOT NULL CHECK (repetition IN (1,2)),
  attempt INTEGER NOT NULL CHECK (attempt >= 1),
      plant_height_cm REAL,
      observer TEXT NOT NULL,
      measurement_status TEXT NOT NULL CHECK (measurement_status IN ('pass','warn','fail')),
      failure_code TEXT CHECK (failure_code IS NULL OR failure_code IN (${FAILURE_CODE_SQL})),
      notes TEXT,
      method TEXT NOT NULL CHECK (method = 'MANUAL'),
      FOREIGN KEY (plant_id) REFERENCES plants (plant_id),
      FOREIGN KEY (image_id) REFERENCES image_records (image_id)
    );
  `;

const AICV_MEASUREMENTS_DDL = `
    CREATE TABLE IF NOT EXISTS aicv_measurements (
      measurement_id TEXT PRIMARY KEY,
      image_id TEXT NOT NULL,
      plant_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
  experiment_day INTEGER NOT NULL CHECK (experiment_day >= 1),
      model TEXT NOT NULL,
      model_version TEXT NOT NULL,
      pipeline_version TEXT NOT NULL,
      detection_status TEXT NOT NULL CHECK (detection_status IN ('pass','fail')),
      segmentation_status TEXT NOT NULL CHECK (segmentation_status IN ('pass','fail','not_applicable')),
      calibration_status TEXT NOT NULL CHECK (calibration_status IN ('pass','warn','fail')),
      plant_height_cm REAL,
      projected_area_cm2 REAL,
      confidence REAL,
      failure_code TEXT NOT NULL CHECK (failure_code IN (${FAILURE_CODE_SQL})),
      notes TEXT,
      FOREIGN KEY (plant_id) REFERENCES plants (plant_id),
      FOREIGN KEY (image_id) REFERENCES image_records (image_id)
    );
  `;

export function resolveDbConfig(config?: DbConfig) {
  const storageDir = config?.storageDir ?? path.resolve(process.cwd(), "server", "storage");
  const filename = config?.filename ?? "experiment.sqlite";
  return {
    storageDir,
    dbPath: path.join(storageDir, filename),
    /** Dedicated application-controlled directory for ingested RAW image files. */
    imagesDir: path.join(storageDir, "images"),
  };
}

export function ensureStorage(config?: DbConfig) {
  const { storageDir } = resolveDbConfig(config);
  fs.mkdirSync(storageDir, { recursive: true });
}

export function createDb(config?: DbConfig) {
  const { dbPath } = resolveDbConfig(config);
  ensureStorage(config);
  return new Database(dbPath);
}

export function migrate(db: Database.Database) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plants (
      plant_id TEXT PRIMARY KEY,
      pot_id TEXT NOT NULL UNIQUE,
      group_name TEXT NOT NULL CHECK (group_name IN ('G0','G1','G2')),
      emergence_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active','damaged','dead','excluded')),
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS position_events (
      position_event_id TEXT PRIMARY KEY,
      position_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      plant_id TEXT NOT NULL,
      location TEXT NOT NULL,
      previous_location TEXT,
      operator TEXT NOT NULL,
      reason TEXT NOT NULL CHECK (reason IN ('initial_assignment','rotation','manual_override')),
      notes TEXT,
      FOREIGN KEY (plant_id) REFERENCES plants (plant_id)
    );

    CREATE TABLE IF NOT EXISTS water_events (
      water_event_id TEXT PRIMARY KEY,
      plant_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      experiment_day INTEGER NOT NULL CHECK (experiment_day >= 1),
      pot_mass_before_g REAL NOT NULL CHECK (pot_mass_before_g >= 0),
      target_mass_g REAL NOT NULL CHECK (target_mass_g > 0),
      water_added_ml REAL NOT NULL CHECK (water_added_ml >= 0),
      pot_mass_after_g REAL NOT NULL CHECK (pot_mass_after_g >= 0),
      watering_status TEXT NOT NULL CHECK (watering_status IN ('pass','warn','fail')),
      operator TEXT,
      notes TEXT,
      FOREIGN KEY (plant_id) REFERENCES plants (plant_id)
    );

    ${IMAGE_RECORDS_DDL}

    ${MANUAL_MEASUREMENTS_DDL}

    ${AICV_MEASUREMENTS_DDL}

    CREATE TABLE IF NOT EXISTS validation_issues (
      issue_id TEXT PRIMARY KEY,
      issue_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      description TEXT NOT NULL,
      severity TEXT NOT NULL CHECK (severity IN ('PASS','WARN','FAIL','NOT_RUN')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details_json TEXT,
      created_at TEXT NOT NULL
    );
  `);

  const current = db
    .prepare("SELECT MAX(version) AS version FROM schema_migrations")
    .get() as { version: number | null };
  const currentVersion = current.version ?? 0;

  if (currentVersion < 1) {
    db.prepare(
      `
        INSERT OR IGNORE INTO schema_migrations (version, applied_at)
        VALUES (1, ?)
      `
    ).run(new Date().toISOString());
  }

  if (currentVersion < 2) {
    const table = db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'image_records'")
      .get() as { sql: string } | undefined;
    const hasFailureCodeCheck =
      table !== undefined && /failure_code IS NULL OR failure_code IN/.test(table.sql);

    if (!hasFailureCodeCheck) {
      db.exec("PRAGMA foreign_keys = OFF;");
      db.transaction(() => {
        db.exec(`
          CREATE TABLE image_records_new (
            image_id TEXT PRIMARY KEY,
            plant_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            experiment_day INTEGER NOT NULL CHECK (experiment_day >= 1),
            image_path TEXT NOT NULL,
            camera_id TEXT NOT NULL,
            image_quality_status TEXT NOT NULL CHECK (image_quality_status IN ('PASS','WARN','FAIL')),
            calibration_status TEXT NOT NULL CHECK (calibration_status IN ('pass','warn','fail')),
            cal_ref_id TEXT,
            failure_code TEXT CHECK (failure_code IS NULL OR failure_code IN (${FAILURE_CODE_SQL})),
            notes TEXT,
            FOREIGN KEY (plant_id) REFERENCES plants (plant_id)
          );
          INSERT INTO image_records_new SELECT * FROM image_records;
          DROP TABLE image_records;
          ALTER TABLE image_records_new RENAME TO image_records;
        `);
      })();
      db.exec("PRAGMA foreign_keys = ON;");
    }

    db.prepare(
      `
        INSERT OR IGNORE INTO schema_migrations (version, applied_at)
        VALUES (2, ?)
      `
    ).run(new Date().toISOString());
  }

  if (currentVersion < 3) {
    const table = db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'aicv_measurements'")
      .get() as { sql: string } | undefined;
    const hasFailureCodeCheck = table !== undefined && /failure_code TEXT NOT NULL CHECK/.test(table.sql);

    if (!hasFailureCodeCheck) {
      const existing = db
        .prepare("SELECT DISTINCT failure_code AS failure_code FROM aicv_measurements")
        .all() as { failure_code: string }[];
      for (const row of existing) {
        if (!FAILURE_CODES.includes(row.failure_code as (typeof FAILURE_CODES)[number])) {
          throw new Error(
            `Migration v3 blocked: invalid failure_code '${row.failure_code}' present in aicv_measurements`
          );
        }
      }

      db.exec("PRAGMA foreign_keys = OFF;");
      db.transaction(() => {
        db.exec(`
          CREATE TABLE aicv_measurements_new (
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
            failure_code TEXT NOT NULL CHECK (failure_code IN (${FAILURE_CODE_SQL})),
            notes TEXT,
            FOREIGN KEY (plant_id) REFERENCES plants (plant_id),
            FOREIGN KEY (image_id) REFERENCES image_records (image_id)
          );
          INSERT INTO aicv_measurements_new SELECT * FROM aicv_measurements;
          DROP TABLE aicv_measurements;
          ALTER TABLE aicv_measurements_new RENAME TO aicv_measurements;
        `);
      })();
      db.exec("PRAGMA foreign_keys = ON;");
    }

    db.prepare(
      `
        INSERT OR IGNORE INTO schema_migrations (version, applied_at)
        VALUES (3, ?)
      `
    ).run(new Date().toISOString());
  }

  if (currentVersion < 4) {
    const table = db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'manual_measurements'")
      .get() as { sql: string } | undefined;
    const hasFailureCodeCheck = table !== undefined && /failure_code IS NULL OR failure_code IN/.test(table.sql);

    if (!hasFailureCodeCheck) {
      const existing = db
        .prepare("SELECT DISTINCT failure_code AS failure_code FROM manual_measurements WHERE failure_code IS NOT NULL")
        .all() as { failure_code: string }[];
      for (const row of existing) {
        if (!FAILURE_CODES.includes(row.failure_code as (typeof FAILURE_CODES)[number])) {
          throw new Error(
            `Migration v4 blocked: invalid failure_code '${row.failure_code}' present in manual_measurements`
          );
        }
      }

      db.exec("PRAGMA foreign_keys = OFF;");
      db.transaction(() => {
        db.exec(`
          CREATE TABLE manual_measurements_new (
            measurement_id TEXT PRIMARY KEY,
            plant_id TEXT NOT NULL,
            image_id TEXT,
            timestamp TEXT NOT NULL,
            experiment_day INTEGER NOT NULL CHECK (experiment_day >= 1),
            repetition INTEGER NOT NULL CHECK (repetition IN (1,2)),
            plant_height_cm REAL,
            observer TEXT NOT NULL,
            measurement_status TEXT NOT NULL CHECK (measurement_status IN ('pass','warn','fail')),
            failure_code TEXT CHECK (failure_code IS NULL OR failure_code IN (${FAILURE_CODE_SQL})),
            notes TEXT,
            method TEXT NOT NULL CHECK (method = 'MANUAL'),
            FOREIGN KEY (plant_id) REFERENCES plants (plant_id),
            FOREIGN KEY (image_id) REFERENCES image_records (image_id)
          );
          INSERT INTO manual_measurements_new SELECT * FROM manual_measurements;
          DROP TABLE manual_measurements;
          ALTER TABLE manual_measurements_new RENAME TO manual_measurements;
        `);
      })();
      db.exec("PRAGMA foreign_keys = ON;");
    }

    db.prepare(
      `
        INSERT OR IGNORE INTO schema_migrations (version, applied_at)
        VALUES (4, ?)
      `
    ).run(new Date().toISOString());
  }

  if (currentVersion < 5) {
    const manualTable = db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'manual_measurements'")
      .get() as { sql: string } | undefined;
    const aicvTable = db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'aicv_measurements'")
      .get() as { sql: string } | undefined;

    const manualHasAttempt = manualTable !== undefined && /\battempt\b/.test(manualTable.sql);
    const aicvHasExperimentDay = aicvTable !== undefined && /\bexperiment_day\b/.test(aicvTable.sql);

    if (!manualHasAttempt || !aicvHasExperimentDay) {
      const aicvRows = db
        .prepare(
          `
            SELECT
              a.measurement_id,
              a.image_id,
              a.plant_id,
              i.plant_id AS image_plant_id,
              i.experiment_day AS image_experiment_day
            FROM aicv_measurements a
            LEFT JOIN image_records i ON i.image_id = a.image_id
          `
        )
        .all() as {
        measurement_id: string;
        image_id: string;
        plant_id: string;
        image_plant_id: string | null;
        image_experiment_day: number | null;
      }[];

      for (const row of aicvRows) {
        if (row.image_plant_id === null || row.image_experiment_day === null) {
          throw new Error(
            `Migration v5 blocked: missing referenced image or experiment_day for AICV measurement '${row.measurement_id}'`
          );
        }
        if (!Number.isInteger(row.image_experiment_day) || row.image_experiment_day < 1) {
          throw new Error(
            `Migration v5 blocked: invalid experiment_day '${String(row.image_experiment_day)}' for AICV measurement '${row.measurement_id}'`
          );
        }
        if (row.plant_id !== row.image_plant_id) {
          throw new Error(
            `Migration v5 blocked: plant mismatch for AICV measurement '${row.measurement_id}' (aicv.plant_id='${row.plant_id}', image.plant_id='${row.image_plant_id}')`
          );
        }
      }

      db.exec("PRAGMA foreign_keys = OFF;");
      db.transaction(() => {
        db.exec(`
          CREATE TABLE manual_measurements_new (
            measurement_id TEXT PRIMARY KEY,
            plant_id TEXT NOT NULL,
            image_id TEXT,
            timestamp TEXT NOT NULL,
            experiment_day INTEGER NOT NULL CHECK (experiment_day >= 1),
            repetition INTEGER NOT NULL CHECK (repetition IN (1,2)),
            attempt INTEGER NOT NULL CHECK (attempt >= 1),
            plant_height_cm REAL,
            observer TEXT NOT NULL,
            measurement_status TEXT NOT NULL CHECK (measurement_status IN ('pass','warn','fail')),
            failure_code TEXT CHECK (failure_code IS NULL OR failure_code IN (${FAILURE_CODE_SQL})),
            notes TEXT,
            method TEXT NOT NULL CHECK (method = 'MANUAL'),
            FOREIGN KEY (plant_id) REFERENCES plants (plant_id),
            FOREIGN KEY (image_id) REFERENCES image_records (image_id)
          );

          INSERT INTO manual_measurements_new (
            measurement_id, plant_id, image_id, timestamp,
            experiment_day, repetition, attempt, plant_height_cm,
            observer, measurement_status, failure_code,
            notes, method
          )
          SELECT
            measurement_id, plant_id, image_id, timestamp,
            experiment_day, repetition,
            1,
            plant_height_cm,
            observer, measurement_status, failure_code,
            notes, method
          FROM manual_measurements;

          DROP TABLE manual_measurements;
          ALTER TABLE manual_measurements_new RENAME TO manual_measurements;
        `);

        db.exec(`
          CREATE TABLE aicv_measurements_new (
            measurement_id TEXT PRIMARY KEY,
            image_id TEXT NOT NULL,
            plant_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            experiment_day INTEGER NOT NULL CHECK (experiment_day >= 1),
            model TEXT NOT NULL,
            model_version TEXT NOT NULL,
            pipeline_version TEXT NOT NULL,
            detection_status TEXT NOT NULL CHECK (detection_status IN ('pass','fail')),
            segmentation_status TEXT NOT NULL CHECK (segmentation_status IN ('pass','fail','not_applicable')),
            calibration_status TEXT NOT NULL CHECK (calibration_status IN ('pass','warn','fail')),
            plant_height_cm REAL,
            projected_area_cm2 REAL,
            confidence REAL,
            failure_code TEXT NOT NULL CHECK (failure_code IN (${FAILURE_CODE_SQL})),
            notes TEXT,
            FOREIGN KEY (plant_id) REFERENCES plants (plant_id),
            FOREIGN KEY (image_id) REFERENCES image_records (image_id)
          );

          INSERT INTO aicv_measurements_new (
            measurement_id, image_id, plant_id, timestamp,
            experiment_day, model, model_version, pipeline_version,
            detection_status, segmentation_status, calibration_status,
            plant_height_cm, projected_area_cm2, confidence,
            failure_code, notes
          )
          SELECT
            a.measurement_id, a.image_id, a.plant_id, a.timestamp,
            i.experiment_day, a.model, a.model_version, a.pipeline_version,
            a.detection_status, a.segmentation_status, a.calibration_status,
            a.plant_height_cm, a.projected_area_cm2, a.confidence,
            a.failure_code, a.notes
          FROM aicv_measurements a
          JOIN image_records i ON i.image_id = a.image_id;

          DROP TABLE aicv_measurements;
          ALTER TABLE aicv_measurements_new RENAME TO aicv_measurements;
        `);
      })();
      db.exec("PRAGMA foreign_keys = ON;");
    }

    db.prepare(
      `
        INSERT OR IGNORE INTO schema_migrations (version, applied_at)
        VALUES (5, ?)
      `
    ).run(new Date().toISOString());
  }

  if (currentVersion < 6) {
    db.exec(`
      PRAGMA foreign_keys = OFF;

      -- Extend plants table with Day 0 fields
      -- Add columns if they don't exist (SQLite doesn't support IF NOT EXISTS for columns)
      -- We'll use a transaction to recreate the table with new columns
      CREATE TABLE plants_new (
        plant_id TEXT PRIMARY KEY,
        pot_id TEXT NOT NULL UNIQUE,
        group_name TEXT NOT NULL CHECK (group_name IN ('G0','G1','G2')),
        emergence_date TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active','damaged','dead','excluded')),
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT,
        -- Day 0 fields
        sowing_date TEXT,
        seed_count INTEGER DEFAULT 1 CHECK (seed_count >= 0),
        substrate_mass_g REAL,
        empty_pot_mass_g REAL,
        saucer_mass_g REAL,
        seed_mass_g REAL,
        emergence_status TEXT CHECK (emergence_status IN ('not_sown','sown','awaiting','emerged','uncertain','failed')) DEFAULT 'not_sown'
      );

      INSERT INTO plants_new (
        plant_id, pot_id, group_name, emergence_date, status, notes, created_at, updated_at
      )
      SELECT plant_id, pot_id, group_name, emergence_date, status, notes, created_at, updated_at
      FROM plants;

      DROP TABLE plants;
      ALTER TABLE plants_new RENAME TO plants;

      -- Day 0 Equipment Inventory
      CREATE TABLE IF NOT EXISTS day0_equipment (
        equipment_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
        unit TEXT,
        model TEXT,
        resolution TEXT,
        verified BOOLEAN NOT NULL DEFAULT 0,
        verified_at TEXT,
        verified_by TEXT,
        notes TEXT,
        is_prepopulated BOOLEAN NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT
      );

      -- Day 0 Physical Configuration
      CREATE TABLE IF NOT EXISTS day0_physical_config (
        config_id TEXT PRIMARY KEY,
        camera_device TEXT,
        camera_orientation TEXT,
        camera_distance_cm REAL,
        camera_angle_deg REAL,
        lighting_config TEXT,
        background TEXT,
        image_resolution TEXT,
        image_format TEXT,
        capture_procedure TEXT,
        calibration_ref_dimensions TEXT,
        calibration_ref_placement TEXT,
        pot_positioning TEXT,
        rotation_procedure TEXT,
        environmental_observations TEXT,
        additional_notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT
      );

      -- Day 0 Pot Allocation (sowing records)
      CREATE TABLE IF NOT EXISTS day0_pot_allocation (
        allocation_id TEXT PRIMARY KEY,
        pot_id TEXT NOT NULL UNIQUE,
        plant_id TEXT,
        group_name TEXT CHECK (group_name IN ('G0','G1','G2')),
        substrate_mass_g REAL NOT NULL DEFAULT 72,
        empty_pot_mass_g REAL,
        saucer_mass_g REAL,
        seed_count INTEGER NOT NULL DEFAULT 1 CHECK (seed_count >= 0),
        seed_mass_g REAL,
        initial_water_ml REAL,
        initial_assembled_mass_g REAL,
        sowing_date TEXT,
        sowing_status TEXT CHECK (sowing_status IN ('pending','sown','failed')) DEFAULT 'pending',
        emergence_status TEXT CHECK (emergence_status IN ('not_sown','sown','awaiting','emerged','uncertain','failed')) DEFAULT 'not_sown',
        emergence_date TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT,
        FOREIGN KEY (plant_id) REFERENCES plants (plant_id)
      );

      -- Day 0 Methodology Decisions / Amendment Register
      CREATE TABLE IF NOT EXISTS day0_methodology_decisions (
        decision_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        protocol_reference TEXT,
        status TEXT NOT NULL CHECK (status IN ('unresolved','proposed','approved','rejected','not_applicable')) DEFAULT 'unresolved',
        decision TEXT,
        decided_by TEXT,
        decided_at TEXT,
        blocks_sowing BOOLEAN NOT NULL DEFAULT 0,
        blocks_emergence BOOLEAN NOT NULL DEFAULT 0,
        blocks_measurements BOOLEAN NOT NULL DEFAULT 0,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT
      );

      PRAGMA foreign_keys = ON;
    `);

    db.prepare(
      `
        INSERT OR IGNORE INTO schema_migrations (version, applied_at)
        VALUES (6, ?)
      `
    ).run(new Date().toISOString());
  }

  if (currentVersion < 7) {
    // Day 0 consistency: 3 seeds per pot (81 planned total). Distinguish
    // planned seeds from actually sown, emerged and retained counts; keep the
    // 72 g substrate mass distinct from assembled pot mass; record the initial
    // watering observation (water added + drained) without turning it into a
    // gravimetric target; and record whether masses are measured or approximate.
    db.exec(`
      PRAGMA foreign_keys = OFF;

      -- plants.seed_count now follows the 3-seeds-per-pot plan. Existing rows
      -- (e.g. PLT-001) keep their stored value; only the DEFAULT for new rows changes.
      CREATE TABLE plants_new (
        plant_id TEXT PRIMARY KEY,
        pot_id TEXT NOT NULL UNIQUE,
        group_name TEXT NOT NULL CHECK (group_name IN ('G0','G1','G2')),
        emergence_date TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active','damaged','dead','excluded')),
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT,
        sowing_date TEXT,
        seed_count INTEGER DEFAULT 3 CHECK (seed_count >= 0),
        substrate_mass_g REAL,
        empty_pot_mass_g REAL,
        saucer_mass_g REAL,
        seed_mass_g REAL,
        emergence_status TEXT CHECK (emergence_status IN ('not_sown','sown','awaiting','emerged','uncertain','failed')) DEFAULT 'not_sown'
      );

      INSERT INTO plants_new (
        plant_id, pot_id, group_name, emergence_date, status, notes, created_at, updated_at,
        sowing_date, seed_count, substrate_mass_g, empty_pot_mass_g, saucer_mass_g, seed_mass_g, emergence_status
      )
      SELECT
        plant_id, pot_id, group_name, emergence_date, status, notes, created_at, updated_at,
        sowing_date, seed_count, substrate_mass_g, empty_pot_mass_g, saucer_mass_g, seed_mass_g, emergence_status
      FROM plants;

      DROP TABLE plants;
      ALTER TABLE plants_new RENAME TO plants;

      CREATE TABLE day0_pot_allocation_new (
        allocation_id TEXT PRIMARY KEY,
        pot_id TEXT NOT NULL UNIQUE,
        plant_id TEXT,
        group_name TEXT CHECK (group_name IN ('G0','G1','G2')),
        substrate_mass_g REAL NOT NULL DEFAULT 72,
        empty_pot_mass_g REAL,
        saucer_mass_g REAL,
        seed_count INTEGER NOT NULL DEFAULT 3 CHECK (seed_count >= 0),
        seeds_sown INTEGER CHECK (seeds_sown >= 0),
        seedlings_emerged INTEGER CHECK (seedlings_emerged >= 0),
        plants_retained INTEGER CHECK (plants_retained >= 0),
        seed_mass_g REAL,
        initial_water_ml REAL,
        initial_water_drained_ml REAL,
        initial_assembled_mass_g REAL,
        mass_basis TEXT NOT NULL DEFAULT 'unknown' CHECK (mass_basis IN ('measured','approximate','unknown')),
        sowing_date TEXT,
        sowing_status TEXT CHECK (sowing_status IN ('pending','sown','failed')) DEFAULT 'pending',
        emergence_status TEXT CHECK (emergence_status IN ('not_sown','sown','awaiting','emerged','uncertain','failed')) DEFAULT 'not_sown',
        emergence_date TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT,
        FOREIGN KEY (plant_id) REFERENCES plants (plant_id)
      );

      INSERT INTO day0_pot_allocation_new (
        allocation_id, pot_id, plant_id, group_name, substrate_mass_g,
        empty_pot_mass_g, saucer_mass_g, seed_count,
        seed_mass_g, initial_water_ml, initial_assembled_mass_g,
        sowing_date, sowing_status, emergence_status, emergence_date, notes, created_at, updated_at
      )
      SELECT
        allocation_id, pot_id, plant_id, group_name, substrate_mass_g,
        empty_pot_mass_g, saucer_mass_g, seed_count,
        seed_mass_g, initial_water_ml, initial_assembled_mass_g,
        sowing_date, sowing_status, emergence_status, emergence_date, notes, created_at, updated_at
      FROM day0_pot_allocation;

      DROP TABLE day0_pot_allocation;
      ALTER TABLE day0_pot_allocation_new RENAME TO day0_pot_allocation;

      PRAGMA foreign_keys = ON;
    `);

    db.prepare(
      `
        INSERT OR IGNORE INTO schema_migrations (version, applied_at)
        VALUES (7, ?)
      `
    ).run(new Date().toISOString());
  }

  if (currentVersion < 8) {
    // Day 0: group-level PLANNED watering volumes (ml per pot). These are plan
    // values only. They are stored on the experiment configuration record and
    // are deliberately separate from water_events (actual observations). The
    // app never multiplies them by a group percentage and never derives a
    // gravimetric target mass from them — that baseline stays an open
    // methodological decision until verified against the locked protocol.
    db.exec(`
      PRAGMA foreign_keys = OFF;

      CREATE TABLE day0_physical_config_new (
        config_id TEXT PRIMARY KEY,
        camera_device TEXT,
        camera_orientation TEXT,
        camera_distance_cm REAL,
        camera_angle_deg REAL,
        lighting_config TEXT,
        background TEXT,
        image_resolution TEXT,
        image_format TEXT,
        capture_procedure TEXT,
        calibration_ref_dimensions TEXT,
        calibration_ref_placement TEXT,
        pot_positioning TEXT,
        rotation_procedure TEXT,
        environmental_observations TEXT,
        additional_notes TEXT,
        planned_water_ml_g0 REAL,
        planned_water_ml_g1 REAL,
        planned_water_ml_g2 REAL,
        created_at TEXT NOT NULL,
        updated_at TEXT
      );

      INSERT INTO day0_physical_config_new (
        config_id, camera_device, camera_orientation, camera_distance_cm, camera_angle_deg,
        lighting_config, background, image_resolution, image_format, capture_procedure,
        calibration_ref_dimensions, calibration_ref_placement, pot_positioning, rotation_procedure,
        environmental_observations, additional_notes, created_at, updated_at
      )
      SELECT
        config_id, camera_device, camera_orientation, camera_distance_cm, camera_angle_deg,
        lighting_config, background, image_resolution, image_format, capture_procedure,
        calibration_ref_dimensions, calibration_ref_placement, pot_positioning, rotation_procedure,
        environmental_observations, additional_notes, created_at, updated_at
      FROM day0_physical_config;

      DROP TABLE day0_physical_config;
      ALTER TABLE day0_physical_config_new RENAME TO day0_physical_config;

      PRAGMA foreign_keys = ON;
    `);

    db.prepare(
      `
        INSERT OR IGNORE INTO schema_migrations (version, applied_at)
        VALUES (8, ?)
      `
    ).run(new Date().toISOString());
  }
}
