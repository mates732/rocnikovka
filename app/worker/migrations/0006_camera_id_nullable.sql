-- Migration: Make camera_id nullable in image_records
-- Camera ID is optional per the scientific protocol and API contract.
-- The NOT NULL constraint was incorrectly applied in the initial schema (0001_initial_schema.sql).

-- SQLite requires table recreation to drop a NOT NULL constraint.
-- We create a new table with the correct schema, copy data, drop old, rename new.
-- Foreign keys must be disabled during this operation.

PRAGMA foreign_keys = OFF;

CREATE TABLE image_records_new (
  image_id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  experiment_day INTEGER NOT NULL CHECK (experiment_day >= 1),
  -- R2 object key (or, for rows migrated from local storage, the recorded source path).
  image_path TEXT NOT NULL,
  camera_id TEXT,
  image_quality_status TEXT NOT NULL CHECK (image_quality_status IN ('PASS','WARN','FAIL')),
  calibration_status TEXT NOT NULL CHECK (calibration_status IN ('pass','warn','fail')),
  cal_ref_id TEXT,
  failure_code TEXT CHECK (failure_code IS NULL OR failure_code IN ('no_detection','poor_image_quality','occlusion','plant_damaged','plant_dead','calibration_failed','none')),
  notes TEXT,
  FOREIGN KEY (plant_id) REFERENCES plants (plant_id)
);

INSERT INTO image_records_new (image_id, plant_id, timestamp, experiment_day, image_path, camera_id, image_quality_status, calibration_status, cal_ref_id, failure_code, notes)
SELECT image_id, plant_id, timestamp, experiment_day, image_path, camera_id, image_quality_status, calibration_status, cal_ref_id, failure_code, notes
FROM image_records;

DROP TABLE image_records;

ALTER TABLE image_records_new RENAME TO image_records;

CREATE INDEX IF NOT EXISTS idx_image_records_plant ON image_records (plant_id, experiment_day);

PRAGMA foreign_keys = ON;