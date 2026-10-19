/**
 * D1 persistence layer.
 *
 * Every write goes through a prepared statement with bound parameters — no SQL
 * string interpolation of user data anywhere. Every write is checked: a failed
 * `run()` throws, and the caller returns an error response instead of a false
 * success.
 *
 * Repository interfaces are the same ones the Node/better-sqlite3 backend
 * implements, but the methods are async because D1 is a remote, promise-based
 * API.
 */
import { mapD1Error } from "./d1Errors.js";
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
} from "./domain.js";
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
} from "./domain.js";

/**
 * A prepared D1 statement. `bind()` returns the statement itself, matching the
 * real D1 binding, so both `.bind(...).all()` and `.all()` are valid.
 */
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean; meta?: Record<string, unknown> }>;
}

/** Minimal shape of the D1 binding, so the layer is testable without a Worker. */
export interface D1Like {
  prepare(query: string): D1PreparedStatement;
}

export class D1ValidationError extends Error {
  readonly code = "validation.failed";
  readonly details: string[];
  constructor(details: string[]) {
    super(`Validation failed: ${details.join("; ")}`);
    this.name = "D1ValidationError";
    this.details = details;
  }
}

/**
 * A referenced parent row is missing or does not match. Kept distinct from a
 * validation error because the correct API status is 409, not 400.
 */
export class D1ReferenceError extends Error {
  readonly code = "reference.missing_parent";
  readonly details: string[];
  constructor(details: string[]) {
    super(`Reference failed: ${details.join("; ")}`);
    this.name = "D1ReferenceError";
    this.details = details;
  }
}

function boolFromInt(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  return false;
}

function orNull(value: unknown): unknown {
  return value === undefined ? null : value;
}

/** Strips D1 server-owned values from a row before re-validating on update. */
function rowToPlant(row: Record<string, unknown>): Plant {
  return row as unknown as Plant;
}

/**
 * Runs a write and maps any storage-level failure onto the repository error
 * vocabulary. Without this a UNIQUE/CHECK/FK failure would surface as an
 * unmapped error and become a 500 instead of an accurate 409/400.
 */
export async function runWrite(stmt: D1PreparedStatement, ...params: unknown[]): Promise<void> {
  try {
    await stmt.bind(...params).run();
  } catch (error) {
    mapD1Error(error);
  }
}

// ---------------------------------------------------------------------------
// Plants
// ---------------------------------------------------------------------------
export class D1PlantRepository {
  constructor(private readonly db: D1Like) {}

  async list(): Promise<Plant[]> {
    const { results } = await this.db
      .prepare(`SELECT * FROM plants ORDER BY created_at ASC, plant_id ASC`)
      .all<Record<string, unknown>>();
    return results.map(rowToPlant);
  }

  async getById(plant_id: string): Promise<Plant | undefined> {
    const row = await this.db.prepare(`SELECT * FROM plants WHERE plant_id = ?`).bind(plant_id).first<Record<string, unknown>>();
    return row ? rowToPlant(row) : undefined;
  }

  async potExists(pot_id: string): Promise<boolean> {
    const row = await this.db.prepare(`SELECT 1 AS present FROM plants WHERE pot_id = ?`).bind(pot_id).first<{ present: number }>();
    return row !== null;
  }

  async create(input: Plant): Promise<void> {
    const validation = validatePlant(input);
    if (!validation.valid) {
      throw new D1ValidationError(validation.issues.map((x) => `${x.field}:${x.code}`));
    }
    await await runWrite(
          this.db.prepare(
              `INSERT INTO plants (plant_id, pot_id, group_name, emergence_date, status, notes, created_at, updated_at,
                             sowing_date, seed_count, substrate_mass_g, empty_pot_mass_g, saucer_mass_g, seed_mass_g, emergence_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ),
          input.plant_id,
          input.pot_id,
          input.group_name,
          input.emergence_date,
          input.status,
          orNull(input.notes),
          input.created_at,
          orNull(input.updated_at),
          orNull(input.sowing_date),
          input.seed_count ?? null,
          orNull(input.substrate_mass_g),
          orNull(input.empty_pot_mass_g),
          orNull(input.saucer_mass_g),
          orNull(input.seed_mass_g),
          orNull(input.emergence_status)
        );
  }

  /** Safe (non-destructive) update: status, notes and updated_at only. */
  async updateSafe(
    plant_id: string,
    input: { status?: Plant["status"]; notes?: string; updated_at: string }
  ): Promise<Plant | undefined> {
    const current = await this.getById(plant_id);
    if (!current) return undefined;

    const next: Plant = { ...current, ...input, plant_id, pot_id: current.pot_id };
    const validation = validatePlant(next);
    if (!validation.valid) {
      throw new D1ValidationError(validation.issues.map((x) => `${x.field}:${x.code}`));
    }

    await this.db
      .prepare(`UPDATE plants SET status = ?, notes = ?, updated_at = ? WHERE plant_id = ?`)
      .bind(next.status, orNull(next.notes), next.updated_at, plant_id)
      .run();

    return this.getById(plant_id);
  }

  async deactivate(
    plant_id: string,
    input: { status: Extract<Plant["status"], "damaged" | "dead" | "excluded">; updated_at: string; notes?: string }
  ): Promise<Plant | undefined> {
    return this.updateSafe(plant_id, input);
  }
}

// ---------------------------------------------------------------------------
// Water events (append-only)
// ---------------------------------------------------------------------------
export class D1WaterEventRepository {
  constructor(private readonly db: D1Like) {}

  async list(): Promise<WaterEvent[]> {
    const { results } = await this.db
      .prepare(`SELECT * FROM water_events ORDER BY timestamp ASC, water_event_id ASC`)
      .all<Record<string, unknown>>();
    return results as unknown as WaterEvent[];
  }

  async getById(water_event_id: string): Promise<WaterEvent | undefined> {
    const row = await this.db.prepare(`SELECT * FROM water_events WHERE water_event_id = ?`).bind(water_event_id).first<Record<string, unknown>>();
    return row ? (row as unknown as WaterEvent) : undefined;
  }

  async create(input: WaterEvent): Promise<void> {
    const validation = validateWaterEvent(input);
    if (!validation.valid) throw new D1ValidationError(validation.issues.map((x) => `${x.field}:${x.code}`));

    // Referential integrity is enforced by the FK, but check explicitly so the
    // API can return 409 reference.invalid rather than a raw D1 constraint error.
    if (!(await this.db.prepare(`SELECT 1 AS present FROM plants WHERE plant_id = ?`).bind(input.plant_id).first<{ present: number }>())) {
      throw new D1ReferenceError([`plant_id:reference.missing_parent`]);
    }

    await await runWrite(
          this.db.prepare(
              `INSERT INTO water_events (water_event_id, plant_id, timestamp, experiment_day, pot_mass_before_g,
                                   target_mass_g, water_added_ml, pot_mass_after_g, watering_status, operator, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ),
          input.water_event_id,
          input.plant_id,
          input.timestamp,
          input.experiment_day,
          input.pot_mass_before_g,
          input.target_mass_g,
          input.water_added_ml,
          input.pot_mass_after_g,
          input.watering_status,
          orNull(input.operator),
          orNull(input.notes)
        );
  }
}

// ---------------------------------------------------------------------------
// Position events (append-only)
// ---------------------------------------------------------------------------
export class D1PositionEventRepository {
  constructor(private readonly db: D1Like) {}

  async list(): Promise<PositionEvent[]> {
    const { results } = await this.db
      .prepare(`SELECT * FROM position_events ORDER BY timestamp ASC, position_event_id ASC`)
      .all<Record<string, unknown>>();
    return results as unknown as PositionEvent[];
  }

  async getById(position_event_id: string): Promise<PositionEvent | undefined> {
    const row = await this.db.prepare(`SELECT * FROM position_events WHERE position_event_id = ?`).bind(position_event_id).first<Record<string, unknown>>();
    return row ? (row as unknown as PositionEvent) : undefined;
  }

  async create(input: PositionEvent): Promise<void> {
    const validation = validatePositionEvent(input);
    if (!validation.valid) throw new D1ValidationError(validation.issues.map((x) => `${x.field}:${x.code}`));

    if (!(await this.db.prepare(`SELECT 1 AS present FROM plants WHERE plant_id = ?`).bind(input.plant_id).first<{ present: number }>())) {
      throw new D1ReferenceError([`plant_id:reference.missing_parent`]);
    }

    await await runWrite(
          this.db.prepare(
              `INSERT INTO position_events (position_event_id, position_id, timestamp, plant_id, location,
                                      previous_location, operator, reason, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ),
          input.position_event_id,
          input.position_id,
          input.timestamp,
          input.plant_id,
          input.location,
          orNull(input.previous_location),
          input.operator,
          input.reason,
          orNull(input.notes)
        );
  }
}

// ---------------------------------------------------------------------------
// Image records (append-only)
// ---------------------------------------------------------------------------
export class D1ImageRecordRepository {
  constructor(private readonly db: D1Like) {}

  async list(): Promise<ImageRecord[]> {
    const { results } = await this.db
      .prepare(`SELECT * FROM image_records ORDER BY timestamp ASC, image_id ASC`)
      .all<Record<string, unknown>>();
    return results as unknown as ImageRecord[];
  }

  async getById(image_id: string): Promise<ImageRecord | undefined> {
    const row = await this.db.prepare(`SELECT * FROM image_records WHERE image_id = ?`).bind(image_id).first<Record<string, unknown>>();
    return row ? (row as unknown as ImageRecord) : undefined;
  }

  async create(input: ImageRecord): Promise<void> {
    const validation = validateImageRecord(input);
    if (!validation.valid) throw new D1ValidationError(validation.issues.map((x) => `${x.field}:${x.code}`));

    if (!(await this.db.prepare(`SELECT 1 AS present FROM plants WHERE plant_id = ?`).bind(input.plant_id).first<{ present: number }>())) {
      throw new D1ReferenceError([`plant_id:reference.missing_parent`]);
    }

    await await runWrite(
          this.db.prepare(
              `INSERT INTO image_records (image_id, plant_id, timestamp, experiment_day, image_path, camera_id,
                                    image_quality_status, calibration_status, cal_ref_id, failure_code, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ),
          input.image_id,
          input.plant_id,
          input.timestamp,
          input.experiment_day,
          input.image_path,
          input.camera_id,
          input.image_quality_status,
          input.calibration_status,
          orNull(input.cal_ref_id),
          orNull(input.failure_code),
          orNull(input.notes)
        );
  }
}

// ---------------------------------------------------------------------------
// Manual measurements (append-only) — traceability to image + plant enforced
// ---------------------------------------------------------------------------
export class D1ManualMeasurementRepository {
  constructor(private readonly db: D1Like) {}

  async list(): Promise<ManualMeasurement[]> {
    const { results } = await this.db
      .prepare(`SELECT * FROM manual_measurements ORDER BY timestamp ASC, measurement_id ASC`)
      .all<Record<string, unknown>>();
    return results as unknown as ManualMeasurement[];
  }

  async getById(measurement_id: string): Promise<ManualMeasurement | undefined> {
    const row = await this.db.prepare(`SELECT * FROM manual_measurements WHERE measurement_id = ?`).bind(measurement_id).first<Record<string, unknown>>();
    return row ? (row as unknown as ManualMeasurement) : undefined;
  }

  async create(input: ManualMeasurement): Promise<void> {
    const validation = validateManualMeasurement(input);
    if (!validation.valid) throw new D1ValidationError(validation.issues.map((x) => `${x.field}:${x.code}`));

    if (!(await this.db.prepare(`SELECT 1 AS present FROM plants WHERE plant_id = ?`).bind(input.plant_id).first<{ present: number }>())) {
      throw new D1ReferenceError([`plant_id:reference.missing_parent`]);
    }

    // G2 traceability: an image reference must belong to the same plant.
    if (input.image_id !== undefined && input.image_id !== null) {
      const image = await this.db
        .prepare(`SELECT plant_id FROM image_records WHERE image_id = ?`)
        .bind(input.image_id)
        .first<{ plant_id: string }>();
      if (!image) throw new D1ReferenceError([`image_id:reference.missing_parent`]);
      if (image.plant_id !== input.plant_id) {
        throw new D1ReferenceError([`image_id:reference.plant_mismatch`]);
      }
    }

    await await runWrite(
          this.db.prepare(
              `INSERT INTO manual_measurements (measurement_id, plant_id, image_id, timestamp, experiment_day, repetition,
                                          attempt, plant_height_cm, observer, measurement_status, failure_code, notes, method)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ),
          input.measurement_id,
          input.plant_id,
          orNull(input.image_id),
          input.timestamp,
          input.experiment_day,
          input.repetition,
          input.attempt ?? 1,
          orNull(input.plant_height_cm),
          input.observer,
          input.measurement_status,
          orNull(input.failure_code),
          orNull(input.notes),
          input.method
        );
  }
}

// ---------------------------------------------------------------------------
// AI/CV measurements (append-only)
// ---------------------------------------------------------------------------
export class D1AICVMeasurementRepository {
  constructor(private readonly db: D1Like) {}

  async list(): Promise<AICVMeasurement[]> {
    const { results } = await this.db
      .prepare(`SELECT * FROM aicv_measurements ORDER BY timestamp ASC, measurement_id ASC`)
      .all<Record<string, unknown>>();
    return results as unknown as AICVMeasurement[];
  }

  async getById(measurement_id: string): Promise<AICVMeasurement | undefined> {
    const row = await this.db.prepare(`SELECT * FROM aicv_measurements WHERE measurement_id = ?`).bind(measurement_id).first<Record<string, unknown>>();
    return row ? (row as unknown as AICVMeasurement) : undefined;
  }

  async create(input: AICVMeasurement): Promise<void> {
    const validation = validateAICVMeasurement(input);
    if (!validation.valid) throw new D1ValidationError(validation.issues.map((x) => `${x.field}:${x.code}`));

    const image = await this.db
      .prepare(`SELECT plant_id, experiment_day FROM image_records WHERE image_id = ?`)
      .bind(input.image_id)
      .first<{ plant_id: string; experiment_day: number }>();
    if (!image) throw new D1ReferenceError([`image_id:reference.missing_parent`]);
    if (image.plant_id !== input.plant_id) {
      throw new D1ReferenceError([`image_id:reference.plant_mismatch`]);
    }
    if (image.experiment_day !== input.experiment_day) {
      throw new D1ReferenceError([`experiment_day:reference.day_mismatch`]);
    }

    await await runWrite(
          this.db.prepare(
              `INSERT INTO aicv_measurements (measurement_id, image_id, plant_id, timestamp, experiment_day, model, model_version,
                                         pipeline_version, detection_status, segmentation_status, calibration_status,
                                         plant_height_cm, projected_area_cm2, confidence, failure_code, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ),
          input.measurement_id,
          input.image_id,
          input.plant_id,
          input.timestamp,
          input.experiment_day,
          input.model,
          input.model_version,
          input.pipeline_version,
          input.detection_status,
          input.segmentation_status,
          input.calibration_status,
          orNull(input.plant_height_cm),
          orNull(input.projected_area_cm2),
          orNull(input.confidence),
          input.failure_code,
          orNull(input.notes)
        );
  }
}

// ---------------------------------------------------------------------------
// Validation issues / audit log
// ---------------------------------------------------------------------------
export class D1ValidationIssueRepository {
  constructor(private readonly db: D1Like) {}

  async create(input: ValidationIssue): Promise<void> {
    const validation = validateValidationIssue(input);
    if (!validation.valid) throw new D1ValidationError(validation.issues.map((x) => `${x.field}:${x.code}`));

    await await runWrite(
          this.db.prepare(
              `INSERT OR IGNORE INTO validation_issues (issue_id, issue_type, entity_type, entity_id, description, severity, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ),
          input.issue_id,
          input.issue_type,
          input.entity_type,
          orNull(input.entity_id),
          input.description,
          input.severity,
          input.created_at
        );
  }
}

export { mapD1Error };
