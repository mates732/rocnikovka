import type Database from "better-sqlite3";
import type {
  AICVMeasurement,
  Day0Equipment,
  Day0MethodologyDecision,
  Day0PhysicalConfig,
  Day0PotAllocation,
  ImageRecord,
  ManualMeasurement,
  Plant,
  PositionEvent,
  ValidationIssue,
  WaterEvent,
} from "../types.js";
import {
  validateAICVMeasurement,
  validateDay0Equipment,
  validateDay0MethodologyDecision,
  validateDay0PhysicalConfig,
  validateDay0PotAllocation,
  validateImageRecord,
  validateManualMeasurement,
  validatePlant,
  validatePositionEvent,
  validateValidationIssue,
  validateWaterEvent,
} from "../validation/schema.js";
import { mapSqliteError, throwValidation, nowIsoSeconds } from "./base.js";
import type {
  AICVMeasurementRepository,
  Day0EquipmentRepository,
  Day0MethodologyDecisionRepository,
  Day0PhysicalConfigRepository,
  Day0PotAllocationRepository,
  ImageRecordRepository,
  ManualMeasurementRepository,
  PlantDeactivateInput,
  PlantRepository,
  PlantSafeUpdateInput,
  PositionEventRepository,
  PotRepository,
  ValidationIssueRepository,
  WaterEventRepository,
} from "./interfaces.js";

export class SqlitePlantRepository implements PlantRepository {
  constructor(private readonly db: Database.Database) {}

  list(): Plant[] {
    return this.db.prepare(`SELECT * FROM plants ORDER BY plant_id ASC`).all() as Plant[];
  }

  create(input: Plant): void {
    const validation = validatePlant(input);
    if (!validation.valid) {
      throwValidation(validation.issues.map((x) => `${x.field}:${x.code}`));
    }

    try {
      const row = {
        ...input,
        notes: input.notes ?? null,
        updated_at: input.updated_at ?? null,
      };
      this.db
        .prepare(
          `
        INSERT INTO plants (plant_id, pot_id, group_name, emergence_date, status, notes, created_at, updated_at)
        VALUES (@plant_id, @pot_id, @group_name, @emergence_date, @status, @notes, @created_at, @updated_at)
      `
        )
        .run(row);
    } catch (error) {
      mapSqliteError(error);
    }
  }

  getById(plant_id: string): Plant | undefined {
    return this.db.prepare(`SELECT * FROM plants WHERE plant_id = ?`).get(plant_id) as Plant | undefined;
  }

  updateSafe(plant_id: string, input: PlantSafeUpdateInput): Plant | undefined {
    const current = this.getById(plant_id);
    if (!current) {
      return undefined;
    }

    const next: Plant = {
      ...current,
      status: input.status ?? current.status,
      notes: input.notes ?? current.notes,
      updated_at: input.updated_at,
    };

    const validation = validatePlant(next);
    if (!validation.valid) {
      throwValidation(validation.issues.map((x) => `${x.field}:${x.code}`));
    }

    try {
      this.db
        .prepare(
          `
        UPDATE plants
        SET status = @status,
            notes = @notes,
            updated_at = @updated_at
        WHERE plant_id = @plant_id
      `
        )
        .run({
          plant_id,
          status: next.status,
          notes: next.notes ?? null,
          updated_at: next.updated_at ?? null,
        });

      this.db
        .prepare(
          `
        INSERT INTO audit_log (event_id, event_type, entity_type, entity_id, details_json, created_at)
        VALUES (@event_id, @event_type, @entity_type, @entity_id, @details_json, @created_at)
      `
        )
        .run({
          event_id: `EVT-PLANT-UPD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          event_type: "plant.safe_update",
          entity_type: "plant",
          entity_id: plant_id,
          details_json: JSON.stringify({
            changed_fields: {
              status: next.status !== current.status,
              notes: (next.notes ?? null) !== (current.notes ?? null),
            },
            previous: {
              status: current.status,
              notes: current.notes ?? null,
              updated_at: current.updated_at ?? null,
            },
            next: {
              status: next.status,
              notes: next.notes ?? null,
              updated_at: next.updated_at ?? null,
            },
          }),
          created_at: input.updated_at,
        });
    } catch (error) {
      mapSqliteError(error);
    }

    return this.getById(plant_id);
  }

  deactivate(plant_id: string, input: PlantDeactivateInput): Plant | undefined {
    const current = this.getById(plant_id);
    if (!current) {
      return undefined;
    }

    const next = this.updateSafe(plant_id, {
      status: input.status,
      notes: input.notes,
      updated_at: input.updated_at,
    });

    try {
      this.db
        .prepare(
          `
        INSERT INTO audit_log (event_id, event_type, entity_type, entity_id, details_json, created_at)
        VALUES (@event_id, @event_type, @entity_type, @entity_id, @details_json, @created_at)
      `
        )
        .run({
          event_id: `EVT-PLANT-DEA-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          event_type: "plant.deactivate",
          entity_type: "plant",
          entity_id: plant_id,
          details_json: JSON.stringify({
            previous_status: current.status,
            deactivated_status: input.status,
            notes: input.notes ?? null,
          }),
          created_at: input.updated_at,
        });
    } catch (error) {
      mapSqliteError(error);
    }

    return next;
  }
}

export class SqlitePotRepository implements PotRepository {
  constructor(private readonly db: Database.Database) {}

  exists(pot_id: string): boolean {
    const row = this.db.prepare(`SELECT 1 as found FROM plants WHERE pot_id = ?`).get(pot_id) as { found: number } | undefined;
    return row?.found === 1;
  }
}

export class SqliteWaterEventRepository implements WaterEventRepository {
  constructor(private readonly db: Database.Database) {}

  list(): WaterEvent[] {
    return this.db
      .prepare(`SELECT * FROM water_events ORDER BY timestamp ASC, water_event_id ASC`)
      .all() as WaterEvent[];
  }

  create(input: WaterEvent): void {
    const validation = validateWaterEvent(input);
    if (!validation.valid) {
      throwValidation(validation.issues.map((x) => `${x.field}:${x.code}`));
    }

    try {
      const row = {
        ...input,
        operator: input.operator ?? null,
        notes: input.notes ?? null,
      };
      this.db
        .prepare(
          `
        INSERT INTO water_events (
          water_event_id, plant_id, timestamp, experiment_day,
          pot_mass_before_g, target_mass_g, water_added_ml,
          pot_mass_after_g, watering_status, operator, notes
        )
        VALUES (
          @water_event_id, @plant_id, @timestamp, @experiment_day,
          @pot_mass_before_g, @target_mass_g, @water_added_ml,
          @pot_mass_after_g, @watering_status, @operator, @notes
        )
      `
        )
        .run(row);
    } catch (error) {
      mapSqliteError(error);
    }
  }

  getById(water_event_id: string): WaterEvent | undefined {
    return this.db.prepare(`SELECT * FROM water_events WHERE water_event_id = ?`).get(water_event_id) as
      | WaterEvent
      | undefined;
  }
}

export class SqlitePositionEventRepository implements PositionEventRepository {
  constructor(private readonly db: Database.Database) {}

  list(): PositionEvent[] {
    return this.db
      .prepare(`SELECT * FROM position_events ORDER BY timestamp ASC, position_event_id ASC`)
      .all() as PositionEvent[];
  }

  create(input: PositionEvent): void {
    const validation = validatePositionEvent(input);
    if (!validation.valid) {
      throwValidation(validation.issues.map((x) => `${x.field}:${x.code}`));
    }

    try {
      const row = {
        ...input,
        previous_location: input.previous_location ?? null,
        notes: input.notes ?? null,
      };
      this.db
        .prepare(
          `
        INSERT INTO position_events (
          position_event_id, position_id, timestamp, plant_id,
          location, previous_location, operator, reason, notes
        )
        VALUES (
          @position_event_id, @position_id, @timestamp, @plant_id,
          @location, @previous_location, @operator, @reason, @notes
        )
      `
        )
        .run(row);
    } catch (error) {
      mapSqliteError(error);
    }
  }

  getById(position_event_id: string): PositionEvent | undefined {
    return this.db.prepare(`SELECT * FROM position_events WHERE position_event_id = ?`).get(position_event_id) as
      | PositionEvent
      | undefined;
  }
}

export class SqliteImageRecordRepository implements ImageRecordRepository {
  constructor(private readonly db: Database.Database) {}

  list(): ImageRecord[] {
    return this.db
      .prepare(`SELECT * FROM image_records ORDER BY timestamp ASC, image_id ASC`)
      .all() as ImageRecord[];
  }

  create(input: ImageRecord): void {
    const validation = validateImageRecord(input);
    if (!validation.valid) {
      throwValidation(validation.issues.map((x) => `${x.field}:${x.code}`));
    }

    try {
      const row = {
        ...input,
        cal_ref_id: input.cal_ref_id ?? null,
        failure_code: input.failure_code ?? null,
        notes: input.notes ?? null,
      };
      this.db
        .prepare(
          `
        INSERT INTO image_records (
          image_id, plant_id, timestamp, experiment_day,
          image_path, camera_id, image_quality_status,
          calibration_status, cal_ref_id, failure_code, notes
        )
        VALUES (
          @image_id, @plant_id, @timestamp, @experiment_day,
          @image_path, @camera_id, @image_quality_status,
          @calibration_status, @cal_ref_id, @failure_code, @notes
        )
      `
        )
        .run(row);
    } catch (error) {
      mapSqliteError(error);
    }
  }

  getById(image_id: string): ImageRecord | undefined {
    return this.db.prepare(`SELECT * FROM image_records WHERE image_id = ?`).get(image_id) as ImageRecord | undefined;
  }
}

export class SqliteManualMeasurementRepository implements ManualMeasurementRepository {
  constructor(private readonly db: Database.Database) {}

  list(): ManualMeasurement[] {
    return this.db
      .prepare(`SELECT * FROM manual_measurements ORDER BY timestamp ASC, measurement_id ASC`)
      .all() as ManualMeasurement[];
  }

  create(input: ManualMeasurement): void {
    const validation = validateManualMeasurement(input);
    if (!validation.valid) {
      throwValidation(validation.issues.map((x) => `${x.field}:${x.code}`));
    }

    try {
      const row = {
        ...input,
        attempt: input.attempt ?? 1,
        image_id: input.image_id ?? null,
        plant_height_cm: input.plant_height_cm ?? null,
        failure_code: input.failure_code ?? null,
        notes: input.notes ?? null,
      };
      this.db
        .prepare(
          `
        INSERT INTO manual_measurements (
          measurement_id, plant_id, image_id, timestamp,
          experiment_day, repetition, attempt, plant_height_cm,
          observer, measurement_status, failure_code,
          notes, method
        )
        VALUES (
          @measurement_id, @plant_id, @image_id, @timestamp,
          @experiment_day, @repetition, @attempt, @plant_height_cm,
          @observer, @measurement_status, @failure_code,
          @notes, @method
        )
      `
        )
        .run(row);
    } catch (error) {
      mapSqliteError(error);
    }
  }

  getById(measurement_id: string): ManualMeasurement | undefined {
    return this.db.prepare(`SELECT * FROM manual_measurements WHERE measurement_id = ?`).get(measurement_id) as
      | ManualMeasurement
      | undefined;
  }
}

export class SqliteAICVMeasurementRepository implements AICVMeasurementRepository {
  constructor(private readonly db: Database.Database) {}

  list(): AICVMeasurement[] {
    return this.db
      .prepare(`SELECT * FROM aicv_measurements ORDER BY timestamp ASC, measurement_id ASC`)
      .all() as AICVMeasurement[];
  }

  create(input: AICVMeasurement): void {
    const validation = validateAICVMeasurement(input);
    if (!validation.valid) {
      throwValidation(validation.issues.map((x) => `${x.field}:${x.code}`));
    }

    try {
      const row = {
        ...input,
        plant_height_cm: input.plant_height_cm ?? null,
        projected_area_cm2: input.projected_area_cm2 ?? null,
        confidence: input.confidence ?? null,
        notes: input.notes ?? null,
      };
      this.db
        .prepare(
          `
        INSERT INTO aicv_measurements (
          measurement_id, image_id, plant_id, timestamp,
          experiment_day, model, model_version, pipeline_version, detection_status,
          segmentation_status, calibration_status, plant_height_cm,
          projected_area_cm2, confidence, failure_code, notes
        )
        VALUES (
          @measurement_id, @image_id, @plant_id, @timestamp,
          @experiment_day, @model, @model_version, @pipeline_version, @detection_status,
          @segmentation_status, @calibration_status, @plant_height_cm,
          @projected_area_cm2, @confidence, @failure_code, @notes
        )
      `
        )
        .run(row);
    } catch (error) {
      mapSqliteError(error);
    }
  }

  getById(measurement_id: string): AICVMeasurement | undefined {
    return this.db.prepare(`SELECT * FROM aicv_measurements WHERE measurement_id = ?`).get(measurement_id) as
      | AICVMeasurement
      | undefined;
  }
}

export class SqliteValidationIssueRepository implements ValidationIssueRepository {
  constructor(private readonly db: Database.Database) {}

  create(input: ValidationIssue): void {
    const validation = validateValidationIssue(input);
    if (!validation.valid) {
      throwValidation(validation.issues.map((x) => `${x.field}:${x.code}`));
    }

    try {
      const row = {
        ...input,
        entity_id: input.entity_id ?? null,
      };
      this.db
        .prepare(
          `
        INSERT INTO validation_issues (
          issue_id, issue_type, entity_type, entity_id,
          description, severity, created_at
        )
        VALUES (
          @issue_id, @issue_type, @entity_type, @entity_id,
          @description, @severity, @created_at
        )
      `
        )
        .run(row);
    } catch (error) {
      mapSqliteError(error);
    }
  }

  getById(issue_id: string): ValidationIssue | undefined {
    return this.db.prepare(`SELECT * FROM validation_issues WHERE issue_id = ?`).get(issue_id) as
      | ValidationIssue
      | undefined;
  }
}

// Day 0 Equipment Repository
function boolFromInt(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  return false;
}

function toDay0Equipment(row: Record<string, unknown>): Day0Equipment {
  return {
    ...(row as unknown as Day0Equipment),
    verified: boolFromInt(row.verified),
    is_prepopulated: boolFromInt(row.is_prepopulated),
  };
}

function toDay0PotAllocation(row: Record<string, unknown>): Day0PotAllocation {
  return {
    ...(row as unknown as Day0PotAllocation),
    mass_basis: (row.mass_basis as Day0PotAllocation["mass_basis"]) ?? "unknown",
  };
}

function toDay0MethodologyDecision(row: Record<string, unknown>): Day0MethodologyDecision {
  return {
    ...(row as unknown as Day0MethodologyDecision),
    blocks_sowing: boolFromInt(row.blocks_sowing),
    blocks_emergence: boolFromInt(row.blocks_emergence),
    blocks_measurements: boolFromInt(row.blocks_measurements),
  };
}

export class SqliteDay0EquipmentRepository implements Day0EquipmentRepository {
  constructor(private readonly db: Database.Database) {}

  list(): Day0Equipment[] {
    return (this.db.prepare(`SELECT * FROM day0_equipment ORDER BY created_at ASC, equipment_id ASC`).all() as Record<string, unknown>[]).map(toDay0Equipment);
  }

  create(input: Day0Equipment): void {
    const validation = validateDay0Equipment(input);
    if (!validation.valid) {
      throwValidation(validation.issues.map((x) => `${x.field}:${x.code}`));
    }

    try {
      const row = {
        equipment_id: input.equipment_id,
        name: input.name,
        category: input.category,
        quantity: input.quantity,
        unit: input.unit ?? null,
        model: input.model ?? null,
        resolution: input.resolution ?? null,
        verified: input.verified ? 1 : 0,
        verified_at: input.verified_at ?? null,
        verified_by: input.verified_by ?? null,
        notes: input.notes ?? null,
        is_prepopulated: input.is_prepopulated ? 1 : 0,
        created_at: input.created_at,
        updated_at: input.updated_at ?? null,
      };
      this.db
        .prepare(
          `
        INSERT INTO day0_equipment (
          equipment_id, name, category, quantity, unit, model, resolution,
          verified, verified_at, verified_by, notes, is_prepopulated, created_at, updated_at
        )
        VALUES (
          @equipment_id, @name, @category, @quantity, @unit, @model, @resolution,
          @verified, @verified_at, @verified_by, @notes, @is_prepopulated, @created_at, @updated_at
        )
      `
        )
        .run(row);
    } catch (error) {
      mapSqliteError(error);
    }
  }

  getById(equipment_id: string): Day0Equipment | undefined {
    const row = this.db.prepare(`SELECT * FROM day0_equipment WHERE equipment_id = ?`).get(equipment_id) as
      | Record<string, unknown>
      | undefined;
    return row ? toDay0Equipment(row) : undefined;
  }

  update(equipment_id: string, input: Partial<Day0Equipment>): Day0Equipment | undefined {
    const current = this.getById(equipment_id);
    if (!current) return undefined;

    const next: Day0Equipment = {
      ...current,
      ...input,
      verified: input.verified ?? current.verified,
      is_prepopulated: input.is_prepopulated ?? current.is_prepopulated,
      updated_at: input.updated_at ?? nowIsoSeconds(),
    };

    const validation = validateDay0Equipment(next);
    if (!validation.valid) {
      throwValidation(validation.issues.map((x) => `${x.field}:${x.code}`));
    }

    try {
      this.db
        .prepare(
          `
        UPDATE day0_equipment
        SET name = @name,
            category = @category,
            quantity = @quantity,
            unit = @unit,
            model = @model,
            resolution = @resolution,
            verified = @verified,
            verified_at = @verified_at,
            verified_by = @verified_by,
            notes = @notes,
            is_prepopulated = @is_prepopulated,
            updated_at = @updated_at
        WHERE equipment_id = @equipment_id
      `
        )
        .run({
          equipment_id: next.equipment_id,
          name: next.name,
          category: next.category,
          quantity: next.quantity,
          unit: next.unit ?? null,
          model: next.model ?? null,
          resolution: next.resolution ?? null,
          verified: next.verified ? 1 : 0,
          verified_at: next.verified_at ?? null,
          verified_by: next.verified_by ?? null,
          notes: next.notes ?? null,
          is_prepopulated: next.is_prepopulated ? 1 : 0,
          updated_at: next.updated_at ?? null,
        });
    } catch (error) {
      mapSqliteError(error);
    }

    return this.getById(equipment_id);
  }
}

// Day 0 Physical Config Repository
export class SqliteDay0PhysicalConfigRepository implements Day0PhysicalConfigRepository {
  constructor(private readonly db: Database.Database) {}

  get(): Day0PhysicalConfig | undefined {
    return this.db.prepare(`SELECT * FROM day0_physical_config ORDER BY created_at DESC LIMIT 1`).get() as Day0PhysicalConfig | undefined;
  }

  create(input: Day0PhysicalConfig): void {
    const validation = validateDay0PhysicalConfig(input);
    if (!validation.valid) {
      throwValidation(validation.issues.map((x) => `${x.field}:${x.code}`));
    }

    try {
      const row = {
        config_id: input.config_id,
        camera_device: input.camera_device ?? null,
        camera_orientation: input.camera_orientation ?? null,
        camera_distance_cm: input.camera_distance_cm ?? null,
        camera_angle_deg: input.camera_angle_deg ?? null,
        lighting_config: input.lighting_config ?? null,
        background: input.background ?? null,
        image_resolution: input.image_resolution ?? null,
        image_format: input.image_format ?? null,
        capture_procedure: input.capture_procedure ?? null,
        calibration_ref_dimensions: input.calibration_ref_dimensions ?? null,
        calibration_ref_placement: input.calibration_ref_placement ?? null,
        pot_positioning: input.pot_positioning ?? null,
        rotation_procedure: input.rotation_procedure ?? null,
        environmental_observations: input.environmental_observations ?? null,
        additional_notes: input.additional_notes ?? null,
        planned_water_ml_g0: input.planned_water_ml_g0 ?? null,
        planned_water_ml_g1: input.planned_water_ml_g1 ?? null,
        planned_water_ml_g2: input.planned_water_ml_g2 ?? null,
        created_at: input.created_at,
        updated_at: input.updated_at ?? null,
      };
      this.db
        .prepare(
          `
        INSERT INTO day0_physical_config (
          config_id, camera_device, camera_orientation, camera_distance_cm, camera_angle_deg,
          lighting_config, background, image_resolution, image_format, capture_procedure,
          calibration_ref_dimensions, calibration_ref_placement, pot_positioning, rotation_procedure,
          environmental_observations, additional_notes,
          planned_water_ml_g0, planned_water_ml_g1, planned_water_ml_g2,
          created_at, updated_at
        )
        VALUES (
          @config_id, @camera_device, @camera_orientation, @camera_distance_cm, @camera_angle_deg,
          @lighting_config, @background, @image_resolution, @image_format, @capture_procedure,
          @calibration_ref_dimensions, @calibration_ref_placement, @pot_positioning, @rotation_procedure,
          @environmental_observations, @additional_notes,
          @planned_water_ml_g0, @planned_water_ml_g1, @planned_water_ml_g2,
          @created_at, @updated_at
        )
      `
        )
        .run(row);
    } catch (error) {
      mapSqliteError(error);
    }
  }

  update(input: Partial<Day0PhysicalConfig>): Day0PhysicalConfig | undefined {
    const current = this.get();
    if (!current) return undefined;

    const config_id = current.config_id;
    const next: Day0PhysicalConfig = {
      ...current,
      ...input,
      config_id,
      updated_at: input.updated_at ?? nowIsoSeconds(),
    };

    const validation = validateDay0PhysicalConfig(next);
    if (!validation.valid) {
      throwValidation(validation.issues.map((x) => `${x.field}:${x.code}`));
    }

    try {
      this.db
        .prepare(
          `
        UPDATE day0_physical_config
        SET camera_device = @camera_device,
            camera_orientation = @camera_orientation,
            camera_distance_cm = @camera_distance_cm,
            camera_angle_deg = @camera_angle_deg,
            lighting_config = @lighting_config,
            background = @background,
            image_resolution = @image_resolution,
            image_format = @image_format,
            capture_procedure = @capture_procedure,
            calibration_ref_dimensions = @calibration_ref_dimensions,
            calibration_ref_placement = @calibration_ref_placement,
            pot_positioning = @pot_positioning,
            rotation_procedure = @rotation_procedure,
            environmental_observations = @environmental_observations,
            additional_notes = @additional_notes,
            planned_water_ml_g0 = @planned_water_ml_g0,
            planned_water_ml_g1 = @planned_water_ml_g1,
            planned_water_ml_g2 = @planned_water_ml_g2,
            updated_at = @updated_at
        WHERE config_id = @config_id
      `
        )
        .run({
          config_id: next.config_id,
          camera_device: next.camera_device ?? null,
          camera_orientation: next.camera_orientation ?? null,
          camera_distance_cm: next.camera_distance_cm ?? null,
          camera_angle_deg: next.camera_angle_deg ?? null,
          lighting_config: next.lighting_config ?? null,
          background: next.background ?? null,
          image_resolution: next.image_resolution ?? null,
          image_format: next.image_format ?? null,
          capture_procedure: next.capture_procedure ?? null,
          calibration_ref_dimensions: next.calibration_ref_dimensions ?? null,
          calibration_ref_placement: next.calibration_ref_placement ?? null,
          pot_positioning: next.pot_positioning ?? null,
          rotation_procedure: next.rotation_procedure ?? null,
          environmental_observations: next.environmental_observations ?? null,
          additional_notes: next.additional_notes ?? null,
          planned_water_ml_g0: next.planned_water_ml_g0 ?? null,
          planned_water_ml_g1: next.planned_water_ml_g1 ?? null,
          planned_water_ml_g2: next.planned_water_ml_g2 ?? null,
          updated_at: next.updated_at ?? null,
        });
    } catch (error) {
      mapSqliteError(error);
    }

    return this.get();
  }
}

// Day 0 Pot Allocation Repository
export class SqliteDay0PotAllocationRepository implements Day0PotAllocationRepository {
  constructor(private readonly db: Database.Database) {}

  list(): Day0PotAllocation[] {
    return this.db.prepare(`SELECT * FROM day0_pot_allocation ORDER BY pot_id ASC`).all() as Day0PotAllocation[];
  }

  create(input: Day0PotAllocation): void {
    const validation = validateDay0PotAllocation(input);
    if (!validation.valid) {
      throwValidation(validation.issues.map((x) => `${x.field}:${x.code}`));
    }

    try {
      const row = {
        allocation_id: input.allocation_id,
        pot_id: input.pot_id,
        plant_id: input.plant_id ?? null,
        group_name: input.group_name ?? null,
        substrate_mass_g: input.substrate_mass_g,
        empty_pot_mass_g: input.empty_pot_mass_g ?? null,
        saucer_mass_g: input.saucer_mass_g ?? null,
        seed_count: input.seed_count,
        seeds_sown: input.seeds_sown ?? null,
        seedlings_emerged: input.seedlings_emerged ?? null,
        plants_retained: input.plants_retained ?? null,
        seed_mass_g: input.seed_mass_g ?? null,
        initial_water_ml: input.initial_water_ml ?? null,
        initial_water_drained_ml: input.initial_water_drained_ml ?? null,
        initial_assembled_mass_g: input.initial_assembled_mass_g ?? null,
        mass_basis: input.mass_basis ?? "unknown",
        sowing_date: input.sowing_date ?? null,
        sowing_status: input.sowing_status,
        emergence_status: input.emergence_status,
        emergence_date: input.emergence_date ?? null,
        notes: input.notes ?? null,
        created_at: input.created_at,
        updated_at: input.updated_at ?? null,
      };
      this.db
        .prepare(
          `
        INSERT INTO day0_pot_allocation (
          allocation_id, pot_id, plant_id, group_name, substrate_mass_g,
          empty_pot_mass_g, saucer_mass_g, seed_count, seeds_sown,
          seedlings_emerged, plants_retained, seed_mass_g,
          initial_water_ml, initial_water_drained_ml, initial_assembled_mass_g, mass_basis, sowing_date,
          sowing_status, emergence_status, emergence_date, notes, created_at, updated_at
        )
        VALUES (
          @allocation_id, @pot_id, @plant_id, @group_name, @substrate_mass_g,
          @empty_pot_mass_g, @saucer_mass_g, @seed_count, @seeds_sown,
          @seedlings_emerged, @plants_retained, @seed_mass_g,
          @initial_water_ml, @initial_water_drained_ml, @initial_assembled_mass_g, @mass_basis, @sowing_date,
          @sowing_status, @emergence_status, @emergence_date, @notes, @created_at, @updated_at
        )
      `
        )
        .run(row);
    } catch (error) {
      mapSqliteError(error);
    }
  }

  getById(allocation_id: string): Day0PotAllocation | undefined {
    const row = this.db.prepare(`SELECT * FROM day0_pot_allocation WHERE allocation_id = ?`).get(allocation_id) as
      | Record<string, unknown>
      | undefined;
    return row ? toDay0PotAllocation(row) : undefined;
  }

  getByPotId(pot_id: string): Day0PotAllocation | undefined {
    const row = this.db.prepare(`SELECT * FROM day0_pot_allocation WHERE pot_id = ?`).get(pot_id) as
      | Record<string, unknown>
      | undefined;
    return row ? toDay0PotAllocation(row) : undefined;
  }

  update(allocation_id: string, input: Partial<Day0PotAllocation>): Day0PotAllocation | undefined {
    const current = this.getById(allocation_id);
    if (!current) return undefined;

    const next: Day0PotAllocation = {
      ...current,
      ...input,
      allocation_id,
      updated_at: input.updated_at ?? nowIsoSeconds(),
    };

    const validation = validateDay0PotAllocation(next);
    if (!validation.valid) {
      throwValidation(validation.issues.map((x) => `${x.field}:${x.code}`));
    }

    try {
      this.db
        .prepare(
          `
        UPDATE day0_pot_allocation
        SET pot_id = @pot_id,
            plant_id = @plant_id,
            group_name = @group_name,
            substrate_mass_g = @substrate_mass_g,
            empty_pot_mass_g = @empty_pot_mass_g,
            saucer_mass_g = @saucer_mass_g,
            seed_count = @seed_count,
            seeds_sown = @seeds_sown,
            seedlings_emerged = @seedlings_emerged,
            plants_retained = @plants_retained,
            seed_mass_g = @seed_mass_g,
            initial_water_ml = @initial_water_ml,
            initial_water_drained_ml = @initial_water_drained_ml,
            initial_assembled_mass_g = @initial_assembled_mass_g,
            mass_basis = @mass_basis,
            sowing_date = @sowing_date,
            sowing_status = @sowing_status,
            emergence_status = @emergence_status,
            emergence_date = @emergence_date,
            notes = @notes,
            updated_at = @updated_at
        WHERE allocation_id = @allocation_id
      `
        )
        .run({
          allocation_id: next.allocation_id,
          pot_id: next.pot_id,
          plant_id: next.plant_id ?? null,
          group_name: next.group_name ?? null,
          substrate_mass_g: next.substrate_mass_g,
          empty_pot_mass_g: next.empty_pot_mass_g ?? null,
          saucer_mass_g: next.saucer_mass_g ?? null,
          seed_count: next.seed_count,
          seeds_sown: next.seeds_sown ?? null,
          seedlings_emerged: next.seedlings_emerged ?? null,
          plants_retained: next.plants_retained ?? null,
          seed_mass_g: next.seed_mass_g ?? null,
          initial_water_ml: next.initial_water_ml ?? null,
          initial_water_drained_ml: next.initial_water_drained_ml ?? null,
          initial_assembled_mass_g: next.initial_assembled_mass_g ?? null,
          mass_basis: next.mass_basis ?? "unknown",
          sowing_date: next.sowing_date ?? null,
          sowing_status: next.sowing_status,
          emergence_status: next.emergence_status,
          emergence_date: next.emergence_date ?? null,
          notes: next.notes ?? null,
          updated_at: next.updated_at ?? null,
        });
    } catch (error) {
      mapSqliteError(error);
    }

    return this.getById(allocation_id);
  }
}

// Day 0 Methodology Decision Repository
export class SqliteDay0MethodologyDecisionRepository implements Day0MethodologyDecisionRepository {
  constructor(private readonly db: Database.Database) {}

  list(): Day0MethodologyDecision[] {
    return (this.db.prepare(`SELECT * FROM day0_methodology_decisions ORDER BY created_at ASC, decision_id ASC`).all() as Record<string, unknown>[]).map(toDay0MethodologyDecision);
  }

  create(input: Day0MethodologyDecision): void {
    const validation = validateDay0MethodologyDecision(input);
    if (!validation.valid) {
      throwValidation(validation.issues.map((x) => `${x.field}:${x.code}`));
    }

    try {
      const row = {
        ...input,
        blocks_sowing: input.blocks_sowing ? 1 : 0,
        blocks_emergence: input.blocks_emergence ? 1 : 0,
        blocks_measurements: input.blocks_measurements ? 1 : 0,
        protocol_reference: input.protocol_reference ?? null,
        decision: input.decision ?? null,
        decided_by: input.decided_by ?? null,
        decided_at: input.decided_at ?? null,
        notes: input.notes ?? null,
        updated_at: input.updated_at ?? null,
      };
      this.db
        .prepare(
          `
        INSERT INTO day0_methodology_decisions (
          decision_id, title, description, protocol_reference, status,
          decision, decided_by, decided_at, blocks_sowing, blocks_emergence, blocks_measurements,
          notes, created_at, updated_at
        )
        VALUES (
          @decision_id, @title, @description, @protocol_reference, @status,
          @decision, @decided_by, @decided_at, @blocks_sowing, @blocks_emergence, @blocks_measurements,
          @notes, @created_at, @updated_at
        )
      `
        )
        .run(row);
    } catch (error) {
      mapSqliteError(error);
    }
  }

  getById(decision_id: string): Day0MethodologyDecision | undefined {
    const row = this.db.prepare(`SELECT * FROM day0_methodology_decisions WHERE decision_id = ?`).get(decision_id) as
      | Record<string, unknown>
      | undefined;
    return row ? toDay0MethodologyDecision(row) : undefined;
  }

  update(decision_id: string, input: Partial<Day0MethodologyDecision>): Day0MethodologyDecision | undefined {
    const current = this.getById(decision_id);
    if (!current) return undefined;

    const next: Day0MethodologyDecision = {
      ...current,
      ...input,
      decision_id,
      blocks_sowing: input.blocks_sowing ?? current.blocks_sowing,
      blocks_emergence: input.blocks_emergence ?? current.blocks_emergence,
      blocks_measurements: input.blocks_measurements ?? current.blocks_measurements,
      updated_at: input.updated_at ?? nowIsoSeconds(),
    };

    const validation = validateDay0MethodologyDecision(next);
    if (!validation.valid) {
      throwValidation(validation.issues.map((x) => `${x.field}:${x.code}`));
    }

    try {
      this.db
        .prepare(
          `
        UPDATE day0_methodology_decisions
        SET title = @title,
            description = @description,
            protocol_reference = @protocol_reference,
            status = @status,
            decision = @decision,
            decided_by = @decided_by,
            decided_at = @decided_at,
            blocks_sowing = @blocks_sowing,
            blocks_emergence = @blocks_emergence,
            blocks_measurements = @blocks_measurements,
            notes = @notes,
            updated_at = @updated_at
        WHERE decision_id = @decision_id
      `
        )
        .run({
          decision_id: next.decision_id,
          title: next.title,
          description: next.description,
          protocol_reference: next.protocol_reference ?? null,
          status: next.status,
          decision: next.decision ?? null,
          decided_by: next.decided_by ?? null,
          decided_at: next.decided_at ?? null,
          blocks_sowing: next.blocks_sowing ? 1 : 0,
          blocks_emergence: next.blocks_emergence ? 1 : 0,
          blocks_measurements: next.blocks_measurements ? 1 : 0,
          notes: next.notes ?? null,
          updated_at: next.updated_at ?? null,
        });
    } catch (error) {
      mapSqliteError(error);
    }

    return this.getById(decision_id);
  }
}
