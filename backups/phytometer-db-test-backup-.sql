PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE IF NOT EXISTS "d1_migrations"(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(1,'0001_initial_schema.sql','2026-10-14 09:28:49');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(2,'0002_record_source_versions.sql','2026-10-14 09:28:50');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(3,'0003_pot_dimensions.sql','2026-10-14 14:23:38');
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);
INSERT INTO "schema_migrations" ("version","applied_at") VALUES(8,'2026-10-14T09:28:50Z');
CREATE TABLE plants (
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
INSERT INTO "plants" ("plant_id","pot_id","group_name","emergence_date","status","notes","created_at","updated_at","sowing_date","seed_count","substrate_mass_g","empty_pot_mass_g","saucer_mass_g","seed_mass_g","emergence_status") VALUES('PLT-901','POT-901','G1','2026-01-01','active',NULL,'2026-01-01T00:00:01',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
INSERT INTO "plants" ("plant_id","pot_id","group_name","emergence_date","status","notes","created_at","updated_at","sowing_date","seed_count","substrate_mass_g","empty_pot_mass_g","saucer_mass_g","seed_mass_g","emergence_status") VALUES('PLT-902','POT-902','G2','2026-01-01','dead',NULL,'2026-01-01T00:00:02','2026-01-02T00:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL);
INSERT INTO "plants" ("plant_id","pot_id","group_name","emergence_date","status","notes","created_at","updated_at","sowing_date","seed_count","substrate_mass_g","empty_pot_mass_g","saucer_mass_g","seed_mass_g","emergence_status") VALUES('PLT-903','POT-903','G0','2026-01-01','dead','oznacena za mrtvou neprihlasenym klientem','2026-01-01T00:00:03','2026-01-02T00:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL);
INSERT INTO "plants" ("plant_id","pot_id","group_name","emergence_date","status","notes","created_at","updated_at","sowing_date","seed_count","substrate_mass_g","empty_pot_mass_g","saucer_mass_g","seed_mass_g","emergence_status") VALUES('PLT-905','POT-905','G0','2026-01-01','active',NULL,'2026-01-01T00:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
INSERT INTO "plants" ("plant_id","pot_id","group_name","emergence_date","status","notes","created_at","updated_at","sowing_date","seed_count","substrate_mass_g","empty_pot_mass_g","saucer_mass_g","seed_mass_g","emergence_status") VALUES('PLT-911','POT-911','G0','2026-01-01','active',NULL,'2026-01-01T00:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
INSERT INTO "plants" ("plant_id","pot_id","group_name","emergence_date","status","notes","created_at","updated_at","sowing_date","seed_count","substrate_mass_g","empty_pot_mass_g","saucer_mass_g","seed_mass_g","emergence_status") VALUES('PLT-997','POT-997','G0','2026-01-01','active',NULL,'2026-01-01T00:00:00',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
CREATE TABLE position_events (
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
INSERT INTO "position_events" ("position_event_id","position_id","timestamp","plant_id","location","previous_location","operator","reason","notes") VALUES('POS-20260101-080000-001','T01','2026-01-01T08:00:00','PLT-901','RACK_T_1',NULL,'x','initial_assignment',NULL);
CREATE TABLE water_events (
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
INSERT INTO "water_events" ("water_event_id","plant_id","timestamp","experiment_day","pot_mass_before_g","target_mass_g","water_added_ml","pot_mass_after_g","watering_status","operator","notes") VALUES('WTR-20260101-080000-001','PLT-901','2026-01-01T08:00:00',1,100,200,100,200,'pass',NULL,NULL);
INSERT INTO "water_events" ("water_event_id","plant_id","timestamp","experiment_day","pot_mass_before_g","target_mass_g","water_added_ml","pot_mass_after_g","watering_status","operator","notes") VALUES('WTR-20260101-080000-002','PLT-901','2026-01-01T08:00:00',1,100,200,100,200,'pass',NULL,NULL);
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
  failure_code TEXT CHECK (failure_code IS NULL OR failure_code IN ('no_detection','poor_image_quality','occlusion','plant_damaged','plant_dead','calibration_failed','none')),
  notes TEXT,
  FOREIGN KEY (plant_id) REFERENCES plants (plant_id)
);
INSERT INTO "image_records" ("image_id","plant_id","timestamp","experiment_day","image_path","camera_id","image_quality_status","calibration_status","cal_ref_id","failure_code","notes") VALUES('IMG-20260101-080000-000','PLT-901','2026-01-01T08:00:00',1,'images/IMG-20260101-080000-000.jpg','CAM-TEST','PASS','pass',NULL,NULL,NULL);
CREATE TABLE manual_measurements (
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
INSERT INTO "manual_measurements" ("measurement_id","plant_id","image_id","timestamp","experiment_day","repetition","attempt","plant_height_cm","observer","measurement_status","failure_code","notes","method") VALUES('MSR-MAN-T911-001','PLT-901',NULL,'2026-01-01T08:00:00',1,1,1,12,'x','pass',NULL,NULL,'MANUAL');
INSERT INTO "manual_measurements" ("measurement_id","plant_id","image_id","timestamp","experiment_day","repetition","attempt","plant_height_cm","observer","measurement_status","failure_code","notes","method") VALUES('MSR-MAN-20260101-090000-002','PLT-901',NULL,'2026-01-01T08:00:00',1,1,1,12,'probe','pass',NULL,NULL,'MANUAL');
CREATE TABLE aicv_measurements (
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
CREATE TABLE validation_issues (
  issue_id TEXT PRIMARY KEY,
  issue_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('PASS','WARN','FAIL','NOT_RUN')),
  created_at TEXT NOT NULL
);
CREATE TABLE audit_log (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details_json TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE day0_equipment (
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
CREATE TABLE day0_methodology_decisions (
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
INSERT INTO "day0_methodology_decisions" ("decision_id","title","description","protocol_reference","status","decision","decided_by","decided_at","blocks_sowing","blocks_emergence","blocks_measurements","notes","created_at","updated_at") VALUES('DEC-T911-001','T','D',NULL,'unresolved',NULL,NULL,NULL,0,0,0,NULL,'2026-01-01T00:00:00',NULL);
INSERT INTO "day0_methodology_decisions" ("decision_id","title","description","protocol_reference","status","decision","decided_by","decided_at","blocks_sowing","blocks_emergence","blocks_measurements","notes","created_at","updated_at") VALUES('DEC-20260101-000000-001','Neautentizovany zapis','Tento zaznam vytvoril neprihlaseny klient',NULL,'unresolved',NULL,NULL,NULL,0,0,0,NULL,'2026-01-01T00:00:00',NULL);
INSERT INTO "day0_methodology_decisions" ("decision_id","title","description","protocol_reference","status","decision","decided_by","decided_at","blocks_sowing","blocks_emergence","blocks_measurements","notes","created_at","updated_at") VALUES('DEC-20260101-000001-001','Falzovany approval test','zadny',NULL,'approved','zadny nikdo neschvalil','probe@example.com','2026-01-01T00:00:00',0,0,0,NULL,'2026-01-01T00:00:00',NULL);
INSERT INTO "day0_methodology_decisions" ("decision_id","title","description","protocol_reference","status","decision","decided_by","decided_at","blocks_sowing","blocks_emergence","blocks_measurements","notes","created_at","updated_at") VALUES('DEC-20260101-000002-002','Access probe','must be refused',NULL,'unresolved',NULL,NULL,NULL,0,0,0,NULL,'2026-01-01T00:00:00',NULL);
CREATE TABLE IF NOT EXISTS "day0_pot_allocation" (
  allocation_id TEXT PRIMARY KEY,
  pot_id TEXT NOT NULL UNIQUE,
  plant_id TEXT,
  group_name TEXT CHECK (group_name IN ('G1','G2','G3')),
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
CREATE TABLE IF NOT EXISTS "day0_physical_config" (
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
  planned_water_ml_g1 REAL,
  planned_water_ml_g2 REAL,
  planned_water_ml_g3 REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  pot_material TEXT,
  pot_diameter_cm REAL,
  pot_height_cm REAL,
  pot_volume_l REAL,
  pot_dimensions_basis TEXT CHECK (pot_dimensions_basis IS NULL OR pot_dimensions_basis IN ('measured','manufacturer','unknown'))
);
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('d1_migrations',3);
CREATE INDEX idx_position_events_plant ON position_events (plant_id, timestamp);
CREATE INDEX idx_water_events_plant ON water_events (plant_id, experiment_day);
CREATE INDEX idx_image_records_plant ON image_records (plant_id, experiment_day);
CREATE INDEX idx_manual_plant_day ON manual_measurements (plant_id, experiment_day);
CREATE INDEX idx_aicv_image ON aicv_measurements (image_id);
