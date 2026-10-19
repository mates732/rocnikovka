/**
 * Day 0 D1 repositories.
 *
 * The normalisation rules from the Node backend (`day0Service.ts`) are
 * reproduced exactly:
 *   - substrate_mass_g defaults to 72 g (substrate only, never an assembled mass)
 *   - seed_count defaults to the PLANNED value of 3 per pot
 *   - mass_basis defaults to 'unknown'
 *   - sowing_status defaults to 'pending', emergence_status to 'not_sown'
 *
 * Actual observations (seeds_sown, seedlings_emerged, plants_retained, dates)
 * are only ever what the user supplied — nothing is fabricated, and no thinning
 * is performed automatically.
 */
import type { D1Like } from "./d1Repos.js";
import { D1ReferenceError, D1ValidationError, runWrite } from "./d1Repos.js";
import type {
  Day0Equipment,
  Day0MethodologyDecision,
  Day0PhysicalConfig,
  Day0PotAllocation,
} from "./domain.js";
import {
  validateDay0Equipment,
  validateDay0MethodologyDecision,
  validateDay0PhysicalConfig,
  validateDay0PotAllocation,
} from "./domain.js";

function orNull(value: unknown): unknown {
  return value === undefined ? null : value;
}

function boolFromInt(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  return false;
}

function toEquipment(row: Record<string, unknown>): Day0Equipment {
  return {
    ...(row as unknown as Day0Equipment),
    verified: boolFromInt(row.verified),
    is_prepopulated: boolFromInt(row.is_prepopulated),
  };
}

function toDecision(row: Record<string, unknown>): Day0MethodologyDecision {
  return {
    ...(row as unknown as Day0MethodologyDecision),
    blocks_sowing: boolFromInt(row.blocks_sowing),
    blocks_emergence: boolFromInt(row.blocks_emergence),
    blocks_measurements: boolFromInt(row.blocks_measurements),
  };
}

function toAllocation(row: Record<string, unknown>): Day0PotAllocation {
  return {
    ...(row as unknown as Day0PotAllocation),
    mass_basis: (row.mass_basis as Day0PotAllocation["mass_basis"]) ?? "unknown",
  };
}

function issuesOf(validation: { valid: boolean; issues: Array<{ field: string; code: string }> }): string[] {
  return validation.issues.map((x) => `${x.field}:${x.code}`);
}

// ---------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------
export class D1Day0EquipmentRepository {
  constructor(private readonly db: D1Like) {}

  async list(): Promise<Day0Equipment[]> {
    const { results } = await this.db
      .prepare(`SELECT * FROM day0_equipment ORDER BY created_at ASC, equipment_id ASC`)
      .all<Record<string, unknown>>();
    return results.map(toEquipment);
  }

  async getById(equipment_id: string): Promise<Day0Equipment | undefined> {
    const row = await this.db.prepare(`SELECT * FROM day0_equipment WHERE equipment_id = ?`).bind(equipment_id).first<Record<string, unknown>>();
    return row ? toEquipment(row) : undefined;
  }

  async create(input: Day0Equipment): Promise<void> {
    const validation = validateDay0Equipment(input);
    if (!validation.valid) throw new D1ValidationError(issuesOf(validation));

    await await runWrite(
          this.db.prepare(
              `INSERT INTO day0_equipment (equipment_id, name, category, quantity, unit, model, resolution,
                                     verified, verified_at, verified_by, notes, is_prepopulated, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ),
          input.equipment_id,
          input.name,
          input.category,
          input.quantity,
          orNull(input.unit),
          orNull(input.model),
          orNull(input.resolution),
          input.verified ? 1 : 0,
          orNull(input.verified_at),
          orNull(input.verified_by),
          orNull(input.notes),
          input.is_prepopulated ? 1 : 0,
          input.created_at,
          orNull(input.updated_at)
        );
  }

  async update(equipment_id: string, patch: Partial<Day0Equipment>): Promise<Day0Equipment | undefined> {
    const current = await this.getById(equipment_id);
    if (!current) return undefined;

    const next: Day0Equipment = {
      ...current,
      ...patch,
      equipment_id,
    };
    const validation = validateDay0Equipment(next);
    if (!validation.valid) throw new D1ValidationError(issuesOf(validation));

    await await runWrite(
          this.db.prepare(
              `UPDATE day0_equipment SET name = ?, category = ?, quantity = ?, unit = ?, model = ?, resolution = ?,
                verified = ?, verified_at = ?, verified_by = ?, notes = ?, is_prepopulated = ?, updated_at = ?
         WHERE equipment_id = ?`
      ),
          next.name,
          next.category,
          next.quantity,
          orNull(next.unit),
          orNull(next.model),
          orNull(next.resolution),
          next.verified ? 1 : 0,
          orNull(next.verified_at),
          orNull(next.verified_by),
          orNull(next.notes),
          next.is_prepopulated ? 1 : 0,
          next.updated_at ?? null,
          equipment_id
        );

    return this.getById(equipment_id);
  }
}

// ---------------------------------------------------------------------------
// Physical configuration (singleton)
// ---------------------------------------------------------------------------
export class D1Day0PhysicalConfigRepository {
  constructor(private readonly db: D1Like) {}

  async get(): Promise<Day0PhysicalConfig | undefined> {
    const row = await this.db
      .prepare(`SELECT * FROM day0_physical_config ORDER BY created_at DESC LIMIT 1`)
      .first<Record<string, unknown>>();
    return row ? (row as unknown as Day0PhysicalConfig) : undefined;
  }

  async create(input: Day0PhysicalConfig): Promise<void> {
    const validation = validateDay0PhysicalConfig(input);
    if (!validation.valid) throw new D1ValidationError(issuesOf(validation));

    await await runWrite(
          this.db.prepare(
              `INSERT INTO day0_physical_config (config_id, camera_device, camera_orientation, camera_distance_cm, camera_angle_deg,
                lighting_config, background, image_resolution, image_format, capture_procedure,
                calibration_ref_dimensions, calibration_ref_placement, pot_positioning, rotation_procedure,
                environmental_observations, additional_notes,
                pot_material, pot_diameter_cm, pot_height_cm, pot_volume_l, pot_dimensions_basis,
                planned_water_ml_g0, planned_water_ml_g1, planned_water_ml_g2,
                created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ),
          input.config_id,
          orNull(input.camera_device),
          orNull(input.camera_orientation),
          orNull(input.camera_distance_cm),
          orNull(input.camera_angle_deg),
          orNull(input.lighting_config),
          orNull(input.background),
          orNull(input.image_resolution),
          orNull(input.image_format),
          orNull(input.capture_procedure),
          orNull(input.calibration_ref_dimensions),
          orNull(input.calibration_ref_placement),
          orNull(input.pot_positioning),
          orNull(input.rotation_procedure),
          orNull(input.environmental_observations),
          orNull(input.additional_notes),
          orNull(input.pot_material),
          orNull(input.pot_diameter_cm),
          orNull(input.pot_height_cm),
          orNull(input.pot_volume_l),
          orNull(input.pot_dimensions_basis),
          orNull(input.planned_water_ml_g0),
          orNull(input.planned_water_ml_g1),
          orNull(input.planned_water_ml_g2),
          input.created_at,
          orNull(input.updated_at)
        );
  }

  async update(patch: Partial<Day0PhysicalConfig>): Promise<Day0PhysicalConfig | undefined> {
    const current = await this.get();
    if (!current) return undefined;

    const next: Day0PhysicalConfig = { ...current, ...patch, config_id: current.config_id };
    const validation = validateDay0PhysicalConfig(next);
    if (!validation.valid) throw new D1ValidationError(issuesOf(validation));

    await await runWrite(
          this.db.prepare(
              `UPDATE day0_physical_config SET camera_device = ?, camera_orientation = ?, camera_distance_cm = ?, camera_angle_deg = ?,
                lighting_config = ?, background = ?, image_resolution = ?, image_format = ?, capture_procedure = ?,
                calibration_ref_dimensions = ?, calibration_ref_placement = ?, pot_positioning = ?, rotation_procedure = ?,
                environmental_observations = ?, additional_notes = ?,
                pot_material = ?, pot_diameter_cm = ?, pot_height_cm = ?, pot_volume_l = ?, pot_dimensions_basis = ?,
                planned_water_ml_g0 = ?, planned_water_ml_g1 = ?, planned_water_ml_g2 = ?,
                updated_at = ?
         WHERE config_id = ?`
      ),
          orNull(next.camera_device),
          orNull(next.camera_orientation),
          orNull(next.camera_distance_cm),
          orNull(next.camera_angle_deg),
          orNull(next.lighting_config),
          orNull(next.background),
          orNull(next.image_resolution),
          orNull(next.image_format),
          orNull(next.capture_procedure),
          orNull(next.calibration_ref_dimensions),
          orNull(next.calibration_ref_placement),
          orNull(next.pot_positioning),
          orNull(next.rotation_procedure),
          orNull(next.environmental_observations),
          orNull(next.additional_notes),
          orNull(next.pot_material),
          orNull(next.pot_diameter_cm),
          orNull(next.pot_height_cm),
          orNull(next.pot_volume_l),
          orNull(next.pot_dimensions_basis),
          orNull(next.planned_water_ml_g0),
          orNull(next.planned_water_ml_g1),
          orNull(next.planned_water_ml_g2),
          orNull(next.updated_at),
          next.config_id
        );

    return this.get();
  }
}

// ---------------------------------------------------------------------------
// Pot allocation
// ---------------------------------------------------------------------------
export class D1Day0PotAllocationRepository {
  constructor(private readonly db: D1Like) {}

  async list(): Promise<Day0PotAllocation[]> {
    const { results } = await this.db
      .prepare(`SELECT * FROM day0_pot_allocation ORDER BY pot_id ASC`)
      .all<Record<string, unknown>>();
    return results.map(toAllocation);
  }

  async getById(allocation_id: string): Promise<Day0PotAllocation | undefined> {
    const row = await this.db.prepare(`SELECT * FROM day0_pot_allocation WHERE allocation_id = ?`).bind(allocation_id).first<Record<string, unknown>>();
    return row ? toAllocation(row) : undefined;
  }

  async getByPotId(pot_id: string): Promise<Day0PotAllocation | undefined> {
    const row = await this.db.prepare(`SELECT * FROM day0_pot_allocation WHERE pot_id = ?`).bind(pot_id).first<Record<string, unknown>>();
    return row ? toAllocation(row) : undefined;
  }

  async create(input: Day0PotAllocation): Promise<void> {
    const validation = validateDay0PotAllocation(input);
    if (!validation.valid) throw new D1ValidationError(issuesOf(validation));

    if (input.plant_id) {
      const plant = await this.db.prepare(`SELECT 1 AS present FROM plants WHERE plant_id = ?`).bind(input.plant_id).first<{ present: number }>();
      if (!plant) throw new D1ReferenceError([`plant_id:reference.missing_parent`]);
    }

    await await runWrite(
          this.db.prepare(
              `INSERT INTO day0_pot_allocation (allocation_id, pot_id, plant_id, group_name, substrate_mass_g, empty_pot_mass_g,
                saucer_mass_g, seed_count, seeds_sown, seedlings_emerged, plants_retained, seed_mass_g,
                initial_water_ml, initial_water_drained_ml, initial_assembled_mass_g, mass_basis, sowing_date,
                sowing_status, emergence_status, emergence_date, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ),
          input.allocation_id,
          input.pot_id,
          orNull(input.plant_id),
          orNull(input.group_name),
          input.substrate_mass_g,
          orNull(input.empty_pot_mass_g),
          orNull(input.saucer_mass_g),
          input.seed_count,
          orNull(input.seeds_sown),
          orNull(input.seedlings_emerged),
          orNull(input.plants_retained),
          orNull(input.seed_mass_g),
          orNull(input.initial_water_ml),
          orNull(input.initial_water_drained_ml),
          orNull(input.initial_assembled_mass_g),
          input.mass_basis,
          orNull(input.sowing_date),
          input.sowing_status,
          input.emergence_status,
          orNull(input.emergence_date),
          orNull(input.notes),
          input.created_at,
          orNull(input.updated_at)
        );
  }

  async update(allocation_id: string, patch: Partial<Day0PotAllocation>): Promise<Day0PotAllocation | undefined> {
    const current = await this.getById(allocation_id);
    if (!current) return undefined;

    const next: Day0PotAllocation = { ...current, ...patch, allocation_id };
    const validation = validateDay0PotAllocation(next);
    if (!validation.valid) throw new D1ValidationError(issuesOf(validation));

    await await runWrite(
          this.db.prepare(
              `UPDATE day0_pot_allocation SET pot_id = ?, plant_id = ?, group_name = ?, substrate_mass_g = ?, empty_pot_mass_g = ?,
                saucer_mass_g = ?, seed_count = ?, seeds_sown = ?, seedlings_emerged = ?, plants_retained = ?, seed_mass_g = ?,
                initial_water_ml = ?, initial_water_drained_ml = ?, initial_assembled_mass_g = ?, mass_basis = ?, sowing_date = ?,
                sowing_status = ?, emergence_status = ?, emergence_date = ?, notes = ?, updated_at = ?
         WHERE allocation_id = ?`
      ),
          next.pot_id,
          orNull(next.plant_id),
          orNull(next.group_name),
          next.substrate_mass_g,
          orNull(next.empty_pot_mass_g),
          orNull(next.saucer_mass_g),
          next.seed_count,
          orNull(next.seeds_sown),
          orNull(next.seedlings_emerged),
          orNull(next.plants_retained),
          orNull(next.seed_mass_g),
          orNull(next.initial_water_ml),
          orNull(next.initial_water_drained_ml),
          orNull(next.initial_assembled_mass_g),
          next.mass_basis,
          orNull(next.sowing_date),
          next.sowing_status,
          next.emergence_status,
          orNull(next.emergence_date),
          orNull(next.notes),
          orNull(next.updated_at),
          allocation_id
        );

    return this.getById(allocation_id);
  }
}

// ---------------------------------------------------------------------------
// Methodology decisions
// ---------------------------------------------------------------------------
export class D1Day0MethodologyDecisionRepository {
  constructor(private readonly db: D1Like) {}

  async list(): Promise<Day0MethodologyDecision[]> {
    const { results } = await this.db
      .prepare(`SELECT * FROM day0_methodology_decisions ORDER BY created_at ASC, decision_id ASC`)
      .all<Record<string, unknown>>();
    return results.map(toDecision);
  }

  async getById(decision_id: string): Promise<Day0MethodologyDecision | undefined> {
    const row = await this.db.prepare(`SELECT * FROM day0_methodology_decisions WHERE decision_id = ?`).bind(decision_id).first<Record<string, unknown>>();
    return row ? toDecision(row) : undefined;
  }

  async create(input: Day0MethodologyDecision): Promise<void> {
    const validation = validateDay0MethodologyDecision(input);
    if (!validation.valid) throw new D1ValidationError(issuesOf(validation));

    await await runWrite(
          this.db.prepare(
              `INSERT INTO day0_methodology_decisions (decision_id, title, description, protocol_reference, status, decision,
                decided_by, decided_at, blocks_sowing, blocks_emergence, blocks_measurements, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ),
          input.decision_id,
          input.title,
          input.description,
          orNull(input.protocol_reference),
          input.status,
          orNull(input.decision),
          orNull(input.decided_by),
          orNull(input.decided_at),
          input.blocks_sowing ? 1 : 0,
          input.blocks_emergence ? 1 : 0,
          input.blocks_measurements ? 1 : 0,
          orNull(input.notes),
          input.created_at,
          orNull(input.updated_at)
        );
  }

  async update(decision_id: string, patch: Partial<Day0MethodologyDecision>): Promise<Day0MethodologyDecision | undefined> {
    const current = await this.getById(decision_id);
    if (!current) return undefined;

    const next: Day0MethodologyDecision = {
      ...current,
      ...patch,
      decision_id,
    };
    const validation = validateDay0MethodologyDecision(next);
    if (!validation.valid) throw new D1ValidationError(issuesOf(validation));

    await await runWrite(
          this.db.prepare(
              `UPDATE day0_methodology_decisions SET title = ?, description = ?, protocol_reference = ?, status = ?, decision = ?,
                decided_by = ?, decided_at = ?, blocks_sowing = ?, blocks_emergence = ?, blocks_measurements = ?, notes = ?, updated_at = ?
         WHERE decision_id = ?`
      ),
          next.title,
          next.description,
          orNull(next.protocol_reference),
          next.status,
          orNull(next.decision),
          orNull(next.decided_by),
          orNull(next.decided_at),
          next.blocks_sowing ? 1 : 0,
          next.blocks_emergence ? 1 : 0,
          next.blocks_measurements ? 1 : 0,
          orNull(next.notes),
          orNull(next.updated_at),
          decision_id
        );

    return this.getById(decision_id);
  }
}
