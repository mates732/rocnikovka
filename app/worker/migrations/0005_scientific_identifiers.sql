-- Migration: Add exemplar_id and treatment_percentage to plants table
-- Update group names from G0/G1/G2 to G1/G2/G3 (per protocol v1)
-- Map existing PLT-001..PLT-027 to scientific identifiers
-- NOTE: Child tables (image_records, water_events, etc.) reference plants.plant_id
-- which does NOT change. Their foreign keys remain valid.

-- ============================================================
-- STEP 1: ADD NEW COLUMNS TO PLANTS TABLE
-- ============================================================

ALTER TABLE plants ADD COLUMN exemplar_id TEXT;
ALTER TABLE plants ADD COLUMN treatment_percentage INTEGER;

-- ============================================================
-- STEP 2: UPDATE PLANTS DATA WITH NEW SCIENTIFIC IDENTIFIERS
-- ============================================================

-- G1 (100%): PLT-001..PLT-009 -> EX01..EX09
UPDATE plants 
SET group_name = 'G1',
    exemplar_id = 'EX' || printf('%02d', CAST(SUBSTR(plant_id, 5) AS INTEGER)),
    treatment_percentage = 100
WHERE group_name = 'G0';

-- G2 (85%): PLT-010..PLT-018 -> EX01..EX09
UPDATE plants 
SET group_name = 'G2',
    exemplar_id = 'EX' || printf('%02d', CAST(SUBSTR(plant_id, 5) AS INTEGER) - 9),
    treatment_percentage = 85
WHERE group_name = 'G1';

-- G3 (70%): PLT-019..PLT-027 -> EX01..EX09
UPDATE plants 
SET group_name = 'G3',
    exemplar_id = 'EX' || printf('%02d', CAST(SUBSTR(plant_id, 5) AS INTEGER) - 18),
    treatment_percentage = 70
WHERE group_name = 'G2';

-- ============================================================
-- STEP 3: ADD NEW COLUMNS TO DAY0_POT_ALLOCATION
-- ============================================================

ALTER TABLE day0_pot_allocation ADD COLUMN exemplar_id TEXT;
ALTER TABLE day0_pot_allocation ADD COLUMN treatment_percentage INTEGER;

-- ============================================================
-- STEP 4: UPDATE DAY0_POT_ALLOCATION WITH NEW SCIENTIFIC IDENTIFIERS
-- ============================================================

UPDATE day0_pot_allocation 
SET exemplar_id = 'EX' || printf('%02d', CAST(SUBSTR(pot_id, 5) AS INTEGER)),
    treatment_percentage = CASE 
      WHEN group_name = 'G0' THEN 100
      WHEN group_name = 'G1' THEN 85
      WHEN group_name = 'G2' THEN 70
    END,
    group_name = CASE 
      WHEN group_name = 'G0' THEN 'G1'
      WHEN group_name = 'G1' THEN 'G2'
      WHEN group_name = 'G2' THEN 'G3'
    END;

-- ============================================================
-- STEP 5: ADD CHECK CONSTRAINTS (SQLite requires table recreation for CHECK)
-- For test environment, we skip CHECK constraints to avoid table recreation.
-- Production migration handled this via direct SQL commands.
-- ============================================================