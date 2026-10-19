-- Phytometer — Cloudflare D1 schema
--
-- This is the CONSOLIDATED final state of the SQLite schema, matching the
-- existing Node backend after migration v8. It is not a re-run of the eight
-- historical SQLite migrations (those rebuilt tables in place to add columns);
-- D1 applies this once, and the historical versions are preserved in
-- app/server/src/db.ts and reproduced in `0002_record_source_versions.sql`.
--
-- Design notes for D1 (SQLite-compatible engine):
--   * PRIMARY KEY / UNIQUE / CHECK / REFERENCES are supported by D1.
--   * `PRAGMA foreign_keys` is always ON in D1 and cannot be toggled, so
--     ordering does not matter for FK enforcement.
--   * BOOLEAN columns are stored as INTEGER 0/1, exactly as in better-sqlite3.
--   * No triggers or views are used, so nothing here depends on SQLite
--     extensions unavailable in D1.

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
  updated_at TEXT,
  sowing_date TEXT,
  seed_count INTEGER DEFAULT 3 CHECK (seed_count >= 0),
  substrate_mass_g REAL,
  empty_pot_mass_g REAL,
  saucer_mass_g REAL,
  seed_mass_g REAL,
  emergence_status TEXT CHECK (emergence_status IN ('not_sown','sown','awaiting','emerged','uncertain','failed')) DEFAULT 'not_sown'
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

CREATE TABLE IF NOT EXISTS image_records (
  image_id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  experiment_day INTEGER NOT NULL CHECK (experiment_day >= 1),
  -- R2 object key (or, for rows migrated from local storage, the recorded source path).
  image_path TEXT NOT NULL,
  camera_id TEXT NOT NULL,
  image_quality_status TEXT NOT NULL CHECK (image_quality_status IN ('PASS','WARN','FAIL')),
  calibration_status TEXT NOT NULL CHECK (calibration_status IN ('pass','warn','fail')),
  cal_ref_id TEXT,
  failure_code TEXT CHECK (failure_code IS NULL OR failure_code IN ('no_detection','poor_image_quality','occlusion','plant_damaged','plant_dead','calibration_failed','none')),
  notes TEXT,
  FOREIGN KEY (plant_id) REFERENCES plants (plant_id)
);

CREATE TABLE IF NOT EXISTS manual_measurements (
  measurement_id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL,
  image_id TEXT,
  timestamp TEXT NOT NULL,
  experiment_day INTEGER NOT NULL CHECK (experiment_day >= 1),
  repetition INTEGER NOT NULL CHECK (repetition IN (1,2)),
  attempt INTEGER NOT NULL DEFAULT 1 CHECK (attempt >= 1),
  plant_height_cm REAL,
  observer TEXT NOT NULL,
  measurement_status TEXT NOT NULL CHECK (measurement_status IN ('pass','warn','fail')),
  failure_code TEXT CHECK (failure_code IS NULL OR failure_code IN ('no_detection','poor_image_quality','occlusion','plant_damaged','plant_dead','calibration_failed','none')),
  notes TEXT,
  method TEXT NOT NULL CHECK (method = 'MANUAL'),
  FOREIGN KEY (plant_id) REFERENCES plants (plant_id),
  FOREIGN KEY (image_id) REFERENCES image_records (image_id)
);

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
  failure_code TEXT NOT NULL CHECK (failure_code IN ('no_detection','poor_image_quality','occlusion','plant_damaged','plant_dead','calibration_failed','none')),
  notes TEXT,
  FOREIGN KEY (plant_id) REFERENCES plants (plant_id),
  FOREIGN KEY (image_id) REFERENCES image_records (image_id)
);

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

-- ---------------------------------------------------------------------------
-- Day 0 (migration v6 / v7 / v8)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS day0_equipment (
  equipment_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit TEXT,
  model TEXT,
  resolution TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,
  verified_by TEXT,
  notes TEXT,
  is_prepopulated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

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
  -- PLANNED volumes only (v8). Never an actual watering event, never a target mass.
  planned_water_ml_g0 REAL,
  planned_water_ml_g1 REAL,
  planned_water_ml_g2 REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS day0_pot_allocation (
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

CREATE TABLE IF NOT EXISTS day0_methodology_decisions (
  decision_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  protocol_reference TEXT,
  status TEXT NOT NULL CHECK (status IN ('unresolved','proposed','approved','rejected','not_applicable')) DEFAULT 'unresolved',
  decision TEXT,
  decided_by TEXT,
  decided_at TEXT,
  blocks_sowing INTEGER NOT NULL DEFAULT 0,
  blocks_emergence INTEGER NOT NULL DEFAULT 0,
  blocks_measurements INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

-- ---------------------------------------------------------------------------
-- Indexes mirroring the access patterns of the SQLite implementation
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_position_events_plant ON position_events (plant_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_water_events_plant ON water_events (plant_id, experiment_day);
CREATE INDEX IF NOT EXISTS idx_image_records_plant ON image_records (plant_id, experiment_day);
CREATE INDEX IF NOT EXISTS idx_manual_plant_day ON manual_measurements (plant_id, experiment_day);
CREATE INDEX IF NOT EXISTS idx_aicv_image ON aicv_measurements (image_id);
