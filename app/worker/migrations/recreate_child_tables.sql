-- Recreate child tables with correct foreign key references
CREATE TABLE image_records (
  image_id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  experiment_day INTEGER NOT NULL CHECK (experiment_day >= 1),
  image_path TEXT NOT NULL,
  camera_id TEXT,
  image_quality_status TEXT NOT NULL CHECK (image_quality_status IN ('PASS','WARN','FAIL')),
  calibration_status TEXT NOT NULL CHECK (calibration_status IN ('pass','warn','fail')),
  cal_ref_id TEXT,
  failure_code TEXT CHECK (failure_code IS NULL OR failure_code IN ('no_detection','poor_image_quality','occlusion','plant_damaged','plant_dead','calibration_failed','none')),
  notes TEXT,
  FOREIGN KEY (plant_id) REFERENCES plants (plant_id)
);

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