-- Day 0: physical constants of the pot itself (controlled variables).
--
-- These describe the pot used in the experiment, not a measurement taken
-- during it. They are nullable on purpose: nothing is pre-filled, and an
-- unknown value stays NULL rather than being guessed.
--
-- `pot_dimensions_basis` records HOW these values were obtained ("measured",
-- "manufacturer" or "unknown"), because an approximate label value and a
-- value measured with a ruler are not the same evidence.
ALTER TABLE day0_physical_config ADD COLUMN pot_material TEXT;
ALTER TABLE day0_physical_config ADD COLUMN pot_diameter_cm REAL;
ALTER TABLE day0_physical_config ADD COLUMN pot_height_cm REAL;
ALTER TABLE day0_physical_config ADD COLUMN pot_volume_l REAL;
ALTER TABLE day0_physical_config ADD COLUMN pot_dimensions_basis TEXT
  CHECK (pot_dimensions_basis IS NULL OR pot_dimensions_basis IN ('measured','manufacturer','unknown'));
