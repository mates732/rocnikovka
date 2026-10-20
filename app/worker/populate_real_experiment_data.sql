-- Phytometer — Real Experiment Data Population for Test Environment
-- This script populates the test D1 database with actual experiment records
-- based on Protocol v1 and verified observations.
--
-- Run with: npx wrangler d1 execute phytometer-db-test --file=populate_real_experiment_data.sql --env test --remote

-- ============================================================================
-- CLEAR SYNTHETIC TEST DATA (keep schema)
-- ============================================================================
DELETE FROM plants;
DELETE FROM position_events;
DELETE FROM water_events;
DELETE FROM image_records;
DELETE FROM manual_measurements;
DELETE FROM aicv_measurements;
DELETE FROM validation_issues;
DELETE FROM audit_log;
DELETE FROM day0_equipment;
DELETE FROM day0_methodology_decisions;
DELETE FROM day0_pot_allocation;
DELETE FROM day0_physical_config;

-- ============================================================================
-- DAY 0: EQUIPMENT (verified/prepopulated items)
-- ============================================================================
INSERT INTO day0_equipment (equipment_id, name, category, quantity, unit, model, resolution, verified, verified_at, verified_by, notes, is_prepopulated, created_at, updated_at) VALUES
('EQ-001', 'Plastic pot ~9 cm', 'container', 27, 'pcs', NULL, NULL, 1, '2026-10-18T10:00:00Z', 'lab_tech', 'Approximate 9 cm diameter, 7 cm height, ~0.4 L nominal volume. Not verified with ruler.', 1, '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('EQ-002', 'Saucer', 'container', 27, 'pcs', NULL, NULL, 1, '2026-10-18T10:00:00Z', 'lab_tech', 'Approximate 12 g empty mass. Not verified.', 1, '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('EQ-003', 'Potting substrate', 'substrate', 1, 'batch', NULL, NULL, 1, '2026-10-18T10:00:00Z', 'lab_tech', 'Single batch used for all 27 pots. Target 72 g dry substrate per pot.', 1, '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('EQ-004', 'Phaseolus vulgaris cv. Aidagold seeds', 'seed', 81, 'pcs', 'Aidagold', NULL, 1, '2026-10-18T10:00:00Z', 'lab_tech', '3 seeds per pot × 27 pots = 81 seeds planned.', 1, '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('EQ-005', 'Digital scale 1 g resolution', 'measurement', 1, 'pcs', NULL, '1 g', 1, '2026-10-18T10:00:00Z', 'lab_tech', 'Used for all gravimetric measurements.', 1, '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('EQ-006', 'Camera/phone for daily photos', 'imaging', 1, 'pcs', NULL, NULL, 0, NULL, NULL, 'Side-view, consistent positioning. Calibration reference card used.', 0, '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('EQ-007', 'ArUco + scale calibration reference card', 'calibration', 1, 'pcs', NULL, '50 mm scale', 1, '2026-10-18T10:00:00Z', 'lab_tech', 'CAL-REF-001. Laminated card with ArUco marker and 50 mm metric scale.', 1, '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z');

-- ============================================================================
-- DAY 0: PHYSICAL CONFIG (approximate/unverified dimensions)
-- ============================================================================
INSERT INTO day0_physical_config (
    config_id, camera_device, camera_orientation, camera_distance_cm, camera_angle_deg,
    lighting_config, background, image_resolution, image_format, capture_procedure,
    calibration_ref_dimensions, calibration_ref_placement, pot_positioning, rotation_procedure,
    environmental_observations, additional_notes,
    planned_water_ml_g0, planned_water_ml_g1, planned_water_ml_g2,
    pot_material, pot_diameter_cm, pot_height_cm, pot_volume_l, pot_dimensions_basis,
    created_at, updated_at
) VALUES (
    'PHYS-CONFIG-001',
    'Smartphone camera (model not recorded)',  -- camera_device
    'side-view',                                -- camera_orientation
    NULL,                                       -- camera_distance_cm (not measured)
    NULL,                                       -- camera_angle_deg (not measured)
    'Ambient indoor lighting, no controlled light source', -- lighting_config
    'Plain wall/background',                    -- background
    'Native camera resolution',                 -- image_resolution
    'JPEG/HEIC',                                -- image_format
    'Daily side-view photo per pot, calibration reference in frame, consistent time window preferred but not enforced', -- capture_procedure
    'ArUco marker + 50 mm metric scale on laminated card (CAL-REF-001)', -- calibration_ref_dimensions
    'Bottom-right corner of frame, outside expected plant growth zone', -- calibration_ref_placement
    '27 pots arranged in 3 groups of 9 on bench. Position grid not formally mapped.', -- pot_positioning
    'Weekly cyclic rotation within group (Pilot Decision: frequency TBD)', -- rotation_procedure
    'Indoor lab/classroom environment. Temperature and humidity not logged.', -- environmental_observations
    'All physical dimensions are APPROXIMATE / UNVERIFIED. Actual pot measurements needed. No graduated cylinder or syringe confirmed available. Sowing date not confirmed - database reset lost exact date.',
    75,  -- planned_water_ml_g0
    64,  -- planned_water_ml_g1
    53,  -- planned_water_ml_g2
    'plastic',      -- pot_material
    9.0,            -- pot_diameter_cm (approximate)
    7.0,            -- pot_height_cm (approximate)
    0.4,            -- pot_volume_l (approximate nominal)
    'unknown',  -- pot_dimensions_basis
    '2026-10-18T10:00:00Z',
    '2026-10-18T10:00:00Z'
);

-- ============================================================================
-- DAY 0: POT ALLOCATION — 27 pots, 9 per group (G0, G1, G2)
-- Protocol target: 15/group (45 total). Minimum: 12/group (36 total).
-- Current: 9/group (27 total). DEVIATION from protocol minimum.
-- ============================================================================
-- G0 pots: POT-001 through POT-009
-- G1 pots: POT-010 through POT-018
-- G2 pots: POT-019 through POT-027
--
-- Notes:
-- - pot_id follows POT-XXX format (verified physical labels)
-- - substrate_mass_g: 72 g target per protocol (approximate, not individually weighed)
-- - seed_count: 3 per pot (81 seeds total planned)
-- - sowing_date: NULL (exact date lost in DB reset; do not invent)
-- - emergence_status: 'awaiting' for all initially, updated for emerged pots
-- - mass_basis: 'approximate' (not individually measured)
-- - initial_water_ml: planned volumes per group (not actual measured)

-- G0 (9 pots)
INSERT INTO day0_pot_allocation (allocation_id, pot_id, plant_id, group_name, substrate_mass_g, empty_pot_mass_g, saucer_mass_g, seed_count, seeds_sown, seedlings_emerged, plants_retained, seed_mass_g, initial_water_ml, initial_water_drained_ml, initial_assembled_mass_g, mass_basis, sowing_date, sowing_status, emergence_status, emergence_date, notes, created_at, updated_at) VALUES
('ALLOC-001', 'POT-001', NULL, 'G0', 72, NULL, NULL, 3, 3, 0, 0, NULL, 75, NULL, NULL, 'approximate', NULL, 'sown', 'awaiting', NULL, 'Sowing date not confirmed (DB reset). Emergence not observed as of 2026-10-18.', '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('ALLOC-002', 'POT-002', NULL, 'G0', 72, NULL, NULL, 3, 3, 0, 0, NULL, 75, NULL, NULL, 'approximate', NULL, 'sown', 'awaiting', NULL, 'Sowing date not confirmed (DB reset). Emergence not observed as of 2026-10-18.', '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('ALLOC-003', 'POT-003', NULL, 'G0', 72, NULL, NULL, 3, 3, 0, 0, NULL, 75, NULL, NULL, 'approximate', NULL, 'sown', 'awaiting', NULL, 'Sowing date not confirmed (DB reset). Emergence not observed as of 2026-10-18.', '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('ALLOC-004', 'POT-004', NULL, 'G0', 72, NULL, NULL, 3, 3, 0, 0, NULL, 75, NULL, NULL, 'approximate', NULL, 'sown', 'awaiting', NULL, 'Sowing date not confirmed (DB reset). Emergence not observed as of 2026-10-18.', '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('ALLOC-005', 'POT-005', NULL, 'G0', 72, NULL, NULL, 3, 3, 0, 0, NULL, 75, NULL, NULL, 'approximate', NULL, 'sown', 'awaiting', NULL, 'Sowing date not confirmed (DB reset). Emergence not observed as of 2026-10-18.', '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('ALLOC-006', 'POT-006', NULL, 'G0', 72, NULL, NULL, 3, 3, 0, 0, NULL, 75, NULL, NULL, 'approximate', NULL, 'sown', 'awaiting', NULL, 'Sowing date not confirmed (DB reset). Emergence not observed as of 2026-10-18.', '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('ALLOC-007', 'POT-007', NULL, 'G0', 72, NULL, NULL, 3, 3, 0, 0, NULL, 75, NULL, NULL, 'approximate', NULL, 'sown', 'awaiting', NULL, 'Sowing date not confirmed (DB reset). Emergence not observed as of 2026-10-18.', '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('ALLOC-008', 'POT-008', NULL, 'G0', 72, NULL, NULL, 3, 3, 0, 0, NULL, 75, NULL, NULL, 'approximate', NULL, 'sown', 'awaiting', NULL, 'Sowing date not confirmed (DB reset). Emergence not observed as of 2026-10-18.', '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('ALLOC-009', 'POT-009', NULL, 'G0', 72, NULL, NULL, 3, 3, 0, 0, NULL, 75, NULL, NULL, 'approximate', NULL, 'sown', 'awaiting', NULL, 'Sowing date not confirmed (DB reset). Emergence not observed as of 2026-10-18.', '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z');

-- G1 (9 pots) - 3 emerged observed 2026-10-18
INSERT INTO day0_pot_allocation (allocation_id, pot_id, plant_id, group_name, substrate_mass_g, empty_pot_mass_g, saucer_mass_g, seed_count, seeds_sown, seedlings_emerged, plants_retained, seed_mass_g, initial_water_ml, initial_water_drained_ml, initial_assembled_mass_g, mass_basis, sowing_date, sowing_status, emergence_status, emergence_date, notes, created_at, updated_at) VALUES
('ALLOC-010', 'POT-010', NULL, 'G1', 72, NULL, NULL, 3, 3, 0, 0, NULL, 64, NULL, NULL, 'approximate', NULL, 'sown', 'awaiting', NULL, 'Sowing date not confirmed (DB reset). Emergence not observed as of 2026-10-18.', '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('ALLOC-011', 'POT-011', NULL, 'G1', 72, NULL, NULL, 3, 3, 0, 0, NULL, 64, NULL, NULL, 'approximate', NULL, 'sown', 'awaiting', NULL, 'Sowing date not confirmed (DB reset). Emergence not observed as of 2026-10-18.', '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('ALLOC-012', 'POT-012', NULL, 'G1', 72, NULL, NULL, 3, 3, 0, 0, NULL, 64, NULL, NULL, 'approximate', NULL, 'sown', 'awaiting', NULL, 'Sowing date not confirmed (DB reset). Emergence not observed as of 2026-10-18.', '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('ALLOC-013', 'POT-013', NULL, 'G1', 72, NULL, NULL, 3, 3, 0, 0, NULL, 64, NULL, NULL, 'approximate', NULL, 'sown', 'awaiting', NULL, 'Sowing date not confirmed (DB reset). Emergence not observed as of 2026-10-18.', '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('ALLOC-014', 'POT-014', NULL, 'G1', 72, NULL, NULL, 3, 3, 0, 0, NULL, 64, NULL, NULL, 'approximate', NULL, 'sown', 'awaiting', NULL, 'Sowing date not confirmed (DB reset). Emergence not observed as of 2026-10-18.', '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('ALLOC-015', 'POT-015', NULL, 'G1', 72, NULL, NULL, 3, 3, 0, 0, NULL, 64, NULL, NULL, 'approximate', NULL, 'sown', 'awaiting', NULL, 'Sowing date not confirmed (DB reset). Emergence not observed as of 2026-10-18.', '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('ALLOC-016', 'POT-016', NULL, 'G1', 72, NULL, NULL, 3, 3, 1, 1, NULL, 64, NULL, NULL, 'approximate', NULL, 'sown', 'emerged', '2026-10-18', 'Emergence observed 2026-10-18. Pot-to-plant mapping NOT confirmed - photo-to-pot identity pending verification. Plant ID to be assigned upon confirmation.', '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('ALLOC-017', 'POT-017', NULL, 'G1', 72, NULL, NULL, 3, 3, 1, 1, NULL, 64, NULL, NULL, 'approximate', NULL, 'sown', 'emerged', '2026-10-18', 'Emergence observed 2026-10-18. Pot-to-plant mapping NOT confirmed - photo-to-pot identity pending verification. Plant ID to be assigned upon confirmation.', '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('ALLOC-018', 'POT-018', NULL, 'G1', 72, NULL, NULL, 3, 3, 1, 1, NULL, 64, NULL, NULL, 'approximate', NULL, 'sown', 'emerged', '2026-10-18', 'Emergence observed 2026-10-18. Pot-to-pot mapping NOT confirmed - photo-to-pot identity pending verification. Plant ID to be assigned upon confirmation.', '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z');

-- G2 (9 pots) - 3 emerged observed 2026-10-18
INSERT INTO day0_pot_allocation (allocation_id, pot_id, plant_id, group_name, substrate_mass_g, empty_pot_mass_g, saucer_mass_g, seed_count, seeds_sown, seedlings_emerged, plants_retained, seed_mass_g, initial_water_ml, initial_water_drained_ml, initial_assembled_mass_g, mass_basis, sowing_date, sowing_status, emergence_status, emergence_date, notes, created_at, updated_at) VALUES
('ALLOC-019', 'POT-019', NULL, 'G2', 72, NULL, NULL, 3, 3, 0, 0, NULL, 53, NULL, NULL, 'approximate', NULL, 'sown', 'awaiting', NULL, 'Sowing date not confirmed (DB reset). Emergence not observed as of 2026-10-18.', '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('ALLOC-020', 'POT-020', NULL, 'G2', 72, NULL, NULL, 3, 3, 0, 0, NULL, 53, NULL, NULL, 'approximate', NULL, 'sown', 'awaiting', NULL, 'Sowing date not confirmed (DB reset). Emergence not observed as of 2026-10-18.', '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('ALLOC-021', 'POT-021', NULL, 'G2', 72, NULL, NULL, 3, 3, 0, 0, NULL, 53, NULL, NULL, 'approximate', NULL, 'sown', 'awaiting', NULL, 'Sowing date not confirmed (DB reset). Emergence not observed as of 2026-10-18.', '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('ALLOC-022', 'POT-022', NULL, 'G2', 72, NULL, NULL, 3, 3, 0, 0, NULL, 53, NULL, NULL, 'approximate', NULL, 'sown', 'awaiting', NULL, 'Sowing date not confirmed (DB reset). Emergence not observed as of 2026-10-18.', '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('ALLOC-023', 'POT-023', NULL, 'G2', 72, NULL, NULL, 3, 3, 0, 0, NULL, 53, NULL, NULL, 'approximate', NULL, 'sown', 'awaiting', NULL, 'Sowing date not confirmed (DB reset). Emergence not observed as of 2026-10-18.', '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('ALLOC-024', 'POT-024', NULL, 'G2', 72, NULL, NULL, 3, 3, 0, 0, NULL, 53, NULL, NULL, 'approximate', NULL, 'sown', 'awaiting', NULL, 'Sowing date not confirmed (DB reset). Emergence not observed as of 2026-10-18.', '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('ALLOC-025', 'POT-025', NULL, 'G2', 72, NULL, NULL, 3, 3, 1, 1, NULL, 53, NULL, NULL, 'approximate', NULL, 'sown', 'emerged', '2026-10-18', 'Emergence observed 2026-10-18. Pot-to-plant mapping NOT confirmed - photo-to-pot identity pending verification. Plant ID to be assigned upon confirmation.', '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('ALLOC-026', 'POT-026', NULL, 'G2', 72, NULL, NULL, 3, 3, 1, 1, NULL, 53, NULL, NULL, 'approximate', NULL, 'sown', 'emerged', '2026-10-18', 'Emergence observed 2026-10-18. Pot-to-plant mapping NOT confirmed - photo-to-pot identity pending verification. Plant ID to be assigned upon confirmation.', '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),
('ALLOC-027', 'POT-027', NULL, 'G2', 72, NULL, NULL, 3, 3, 1, 1, NULL, 53, NULL, NULL, 'approximate', NULL, 'sown', 'emerged', '2026-10-18', 'Emergence observed 2026-10-18. Pot-to-plant mapping NOT confirmed - photo-to-pot identity pending verification. Plant ID to be assigned upon confirmation.', '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z');

-- ============================================================================
-- DAY 0: METHODOLOGY DECISIONS
-- ============================================================================
-- Decision 1: Sample size deviation (27 vs minimum 36 per protocol)
INSERT INTO day0_methodology_decisions (decision_id, title, description, protocol_reference, status, decision, decided_by, decided_at, blocks_sowing, blocks_emergence, blocks_measurements, notes, created_at, updated_at) VALUES
('DEC-001', 'Sample size below protocol minimum',
 'Protocol v1 §3 specifies minimum 12 plants per group (36 total). Current physical setup has 9 per group (27 total). This is a known methodological deviation requiring explicit acknowledgment. The experiment proceeds with reduced statistical power. No protocol change - deviation is documented per §18 (pilot requirement) and change policy.',
 'Protocol v1 §3, §18',
 'approved',
 'Proceed with 27 pots (9/group). Statistical limitations acknowledged in analysis plan. Document deviation in all reports.',
 'lab_lead', '2026-10-18T10:00:00Z', 0, 0, 0,
 'Deviation from protocol minimum sample size. Does not change protocol definitions (G0/G1/G2 remain 100/85/70).',
 '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),

-- Decision 2: Unverified pot dimensions
('DEC-002', 'Pot dimensions and volume unverified',
 'Pot diameter (~9 cm), height (~7 cm), volume (~0.4 L) and empty masses (~18 g pot, ~12 g saucer) are reported values, not verified measurements. Physical measurement of actual equipment needed. These are recorded as "approximate" basis in day0_physical_config.',
 'Protocol v1 §5, §15',
 'proposed',
 NULL,
 NULL, NULL,
 0, 0, 0,
 'Measure actual pots with ruler and scale. Update day0_physical_config with measured values and change basis to "measured".',
 '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),

-- Decision 3: Sowing date unknown
('DEC-003', 'Exact sowing date not recovered',
 'Database reset lost the exact sowing date. Do not invent a date. Record as NULL in all tables. Display "date not confirmed" in UI. Experiment day counting begins at first emergence per protocol, not sowing.',
 'Protocol v1 §9, §55',
 'approved',
 'Keep sowing_date NULL. Experiment day 1 = first emergence day for each plant (or cohort per protocol).',
 'lab_lead', '2026-10-18T10:00:00Z', 0, 0, 0,
 'Previous reset script inserted 2026-10-19 as sowing date - this was synthetic. Do not use.',
 '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),

-- Decision 4: Emergence pot mapping unconfirmed
('DEC-004', 'Emergence observations lack confirmed pot-to-plant mapping',
 'On 2026-10-18, 6 emerged seedlings observed (3 in G1, 3 in G2). Photographs exist but physical mapping from photo to pot_id is unconfirmed. Earlier test IDs (PLT-010, PLT-011, PLT-012, PLT-019, PLT-020, PLT-021) were script-assigned and must NOT be assumed correct. Plant records will be created only after physical verification.',
 'Protocol v1 §11, §64-67',
 'unresolved',
 NULL,
 NULL, NULL,
 0, 1, 0,  -- blocks_emergence = 1 (plant records blocked until mapping confirmed)
 'Match photos to physical pots. Assign plant_id (PLT-XXX format) only after confirmation. Update day0_pot_allocation.plant_id and create plants records.',
 '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z'),

-- Decision 5: No graduated cylinder/syringe confirmed
('DEC-005', 'Volumetric measurement tool not confirmed',
 'No graduated cylinder or syringe has been confirmed available. Initial watering volumes (75/64/53 ml) are planned values only. Actual water added must be measured gravimetrically (mass difference) or with verified volumetric tool when available.',
 'Protocol v1 §7',
 'unresolved',
 NULL,
 NULL, NULL,
 0, 0, 0,
 'Obtain graduated cylinder or syringe. Record actual water_added_ml in water_events as measured, not planned.',
 '2026-10-18T10:00:00Z', '2026-10-10:00:00Z'),

-- Decision 6: Drift correction procedure
('DEC-006', 'Weekly drift correction against G0',
 'Protocol v1 §8 requires weekly drift correction against G0 (control). Procedure: compare G0 mean pot mass trajectory to expected; adjust G1/G2 targets if systematic offset detected. Must be documented with reason, method, operator, timestamp.',
 'Protocol v1 §8, §45-49',
 'proposed',
 NULL,
 NULL, NULL,
 0, 0, 0,
 'Define exact calculation method. First correction due after 7 experiment days.',
 '2026-10-18T10:00:00Z', '2026-10-18T10:00:00Z');

-- ============================================================================
-- AUDIT LOG ENTRIES for the above decisions
-- ============================================================================
INSERT INTO audit_log (event_id, event_type, entity_type, entity_id, details_json, created_at) VALUES
('AUDIT-001', 'methodology_decision_created', 'day0_methodology_decisions', 'DEC-001', '{"title": "Sample size below protocol minimum", "deviation": "27 pots vs 36 minimum"}', '2026-10-18T10:00:00Z'),
('AUDIT-002', 'methodology_decision_created', 'day0_methodology_decisions', 'DEC-002', '{"title": "Pot dimensions and volume unverified"}', '2026-10-18T10:00:00Z'),
('AUDIT-003', 'methodology_decision_created', 'day0_methodology_decisions', 'DEC-003', '{"title": "Exact sowing date not recovered"}', '2026-10-18T10:00:00Z'),
('AUDIT-004', 'methodology_decision_created', 'day0_methodology_decisions', 'DEC-004', '{"title": "Emergence observations lack confirmed pot-to-plant mapping", "emerged_count": 6, "groups": ["G1", "G2"]}', '2026-10-18T10:00:00Z'),
('AUDIT-005', 'methodology_decision_created', 'day0_methodology_decisions', 'DEC-005', '{"title": "Volumetric measurement tool not confirmed"}', '2026-10-18T10:00:00Z'),
('AUDIT-006', 'methodology_decision_created', 'day0_methodology_decisions', 'DEC-006', '{"title": "Weekly drift correction against G0"}', '2026-10-18T10:00:00Z'),
('AUDIT-007', 'day0_setup_completed', 'day0_pot_allocation', 'ALL', '{"total_pots": 27, "groups": {"G0": 9, "G1": 9, "G2": 9}, "seeds_planned": 81, "emerged_observed_2026-10-18": 6}', '2026-10-18T10:00:00Z');

-- ============================================================================
-- VALIDATION ISSUES (data quality flags)
-- ============================================================================
INSERT INTO validation_issues (issue_id, issue_type, entity_type, entity_id, description, severity, created_at) VALUES
('VAL-001', 'protocol_deviation', 'experiment_design', NULL, 'Sample size 27 (9/group) below protocol minimum 36 (12/group). Statistical power reduced.', 'WARN', '2026-10-18T10:00:00Z'),
('VAL-002', 'missing_data', 'day0_physical_config', 'PHYS-CONFIG-001', 'Pot diameter, height, volume, empty masses are approximate/unverified. Need measured values.', 'WARN', '2026-10-18T10:00:00Z'),
('VAL-003', 'missing_data', 'plants', NULL, 'Sowing date unknown for all 27 pots (DB reset). Experiment day calculation affected.', 'WARN', '2026-10-18T10:00:00Z'),
('VAL-004', 'traceability_gap', 'day0_pot_allocation', 'POT-016,POT-017,POT-018,POT-025,POT-026,POT-027', '6 emerged seedlings observed 2026-10-18 but pot-to-plant mapping unconfirmed. Plant IDs not assigned.', 'FAIL', '2026-10-18T10:00:00Z'),
('VAL-005', 'missing_equipment', 'day0_equipment', NULL, 'Graduated cylinder or syringe not confirmed available. Volumetric water measurement not possible.', 'WARN', '2026-10-18T10:00:00Z');