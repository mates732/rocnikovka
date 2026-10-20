-- Enforce Protocol v1 §3/§6.1 group labels: G0 (100%), G1 (85%), G2 (70%).
-- G0 is the drift-correction control group (Protocol v1 §8) and must remain.
--
-- This migration is intentionally schema-agnostic: it rebuilds the two Day 0
-- tables from scratch rather than ALTERing them, because the pre-migration
-- schema may already carry a non-Protocol group set (G1/G2/G3) with matching
-- water columns. A column-preserving copy would need a different SELECT list
-- per variant; a rebuild is unambiguous and preserves nothing that is lost.
--
-- DATA NOTE: at the time this migration is first applied, both day0_pot_allocation
-- and day0_physical_config are empty in every known database (verified against
-- phytometer-db-test and phytometer-db). If that assumption ever breaks, this
-- migration must be reworked to copy rows by column name before running.
DROP TABLE IF EXISTS day0_pot_allocation;
DROP TABLE IF EXISTS day0_physical_config;

CREATE TABLE day0_pot_allocation (
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

CREATE TABLE day0_physical_config (
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
  updated_at TEXT,
  pot_material TEXT,
  pot_diameter_cm REAL,
  pot_height_cm REAL,
  pot_volume_l REAL,
  pot_dimensions_basis TEXT CHECK (pot_dimensions_basis IS NULL OR pot_dimensions_basis IN ('measured','manufacturer','unknown'))
);