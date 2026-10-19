/**
 * Worker services.
 *
 * These reproduce the rules enforced by the Node backend so the API behaves
 * identically on D1:
 *   - plants: immutability of plant_id/pot_id/group_name/emergence_date/created_at,
 *     uppercase ID normalisation, duplicate detection, FK + pot-uniqueness checks
 *   - day0 pot allocation: planned seed_count default 3, substrate 72 g,
 *     mass_basis 'unknown' — actual observations only ever what the user sent
 *   - manual/AICV: image→plant and experiment_day traceability
 */
import type { D1PlantRepository } from "./d1Repos.js";
import type { D1Day0PotAllocationRepository } from "./day0Repos.js";
import type { Plant, Day0PotAllocation } from "./domain.js";
import { D1ReferenceError, D1ValidationError } from "./d1Repos.js";

/**
 * ID patterns, matching app/server/src/validation/schema.ts (ID_PATTERNS).
 * They are restated here rather than exported from the server module, to avoid
 * widening that module's public surface. Any change here must be mirrored there
 * — the server test suite is the guard.
 */
const PLANT_ID_RE = /^PLT-\d{3}$/;
const POT_ID_RE = /^POT-\d{3}$/;

export class ServiceError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

function requireTimestampSecondPrecision(value: string | undefined): boolean {
  if (!value) return false;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value);
}

// ---------------------------------------------------------------------------
// Plants
// ---------------------------------------------------------------------------
export class WorkerPlantsService {
  constructor(private readonly plants: D1PlantRepository) {}

  async list(): Promise<Plant[]> {
    return this.plants.list();
  }

  async getById(plantId: string): Promise<Plant> {
    const row = await this.plants.getById(plantId);
    if (!row) throw new ServiceError("Plant not found", "plant.not_found", 404);
    return row;
  }

  async dayContext(plantId: string): Promise<{ plant_id: string; last_recorded_day: number | null; expected_next_day: number | null } | null> {
    const row = await this.plants.getById(plantId);
    if (!row) return null;
    // Read-only day context is intentionally computed by the caller (the route)
    // from persisted records; see router.ts getDayContext.
    return { plant_id: plantId, last_recorded_day: null, expected_next_day: null };
  }

  async create(input: Plant): Promise<Plant> {
    if (!PLANT_ID_RE.test(input.plant_id)) {
      throw new ServiceError("Plant ID must match PLT-XXX (three digits)", "input.invalid", 400);
    }
    if (!POT_ID_RE.test(input.pot_id)) {
      throw new ServiceError("Pot ID must match POT-XXX (three digits)", "input.invalid", 400);
    }
    if (!requireTimestampSecondPrecision(input.created_at)) {
      throw new ServiceError("Field 'created_at' must look like YYYY-MM-DDTHH:MM:SS", "input.invalid", 400);
    }
    if (await this.plants.getById(input.plant_id)) {
      throw new ServiceError("Duplicate identifier", "id.duplicate", 409);
    }
    if (await this.plants.potExists(input.pot_id)) {
      throw new ServiceError("Duplicate identifier", "id.duplicate", 409);
    }

    try {
      await this.plants.create(input);
    } catch (error) {
      throw this.mapRepoError(error);
    }

    const created = await this.plants.getById(input.plant_id);
    if (!created) throw new ServiceError("Persisted plant not found", "persistence.error", 500);
    return created;
  }

  async patch(plantId: string, body: Record<string, unknown>): Promise<Plant> {
    const immutable = ["plant_id", "pot_id", "group_name", "emergence_date", "created_at"];
    const attempted = immutable.find((field) => body[field] !== undefined);
    if (attempted) {
      throw new ServiceError(`Field '${attempted}' is immutable`, "field.immutable", 409);
    }
    if (!body.updated_at) {
      throw new ServiceError("Field 'updated_at' is required", "input.invalid", 400);
    }
    try {
      // Build the patch explicitly. Spreading an object that contains
      // `status: undefined` would OVERWRITE the stored value with undefined and
      // fail validation, so an absent field must not be a key at all.
      const safePatch: { status?: Plant["status"]; notes?: string; updated_at: string } = {
        updated_at: String(body.updated_at),
      };
      if (body.status !== undefined) safePatch.status = body.status as Plant["status"];
      if (typeof body.notes === "string") safePatch.notes = body.notes;

      const updated = await this.plants.updateSafe(plantId, safePatch);
      if (!updated) throw new ServiceError("Plant not found", "plant.not_found", 404);
      return updated;
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw this.mapRepoError(error);
    }
  }

  async deactivate(
    plantId: string,
    input: { status: Extract<Plant["status"], "damaged" | "dead" | "excluded">; updated_at: string; notes?: string }
  ): Promise<Plant> {
    try {
      const updated = await this.plants.updateSafe(plantId, input);
      if (!updated) throw new ServiceError("Plant not found", "plant.not_found", 404);
      return updated;
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw this.mapRepoError(error);
    }
  }

  private mapRepoError(error: unknown): Error {
    if (error instanceof ServiceError) return error;
    if (error instanceof D1ValidationError) return new ServiceError("Invalid input", "input.invalid", 400);
    const code = (error as { code?: string })?.code;
    if (code === "id.duplicate") return new ServiceError("Duplicate identifier", "id.duplicate", 409);
    if (code === "reference.missing_parent") return new ServiceError("Invalid reference", "reference.invalid", 409);
    return new ServiceError("Internal server error", "internal.error", 500);
  }
}

// ---------------------------------------------------------------------------
// Day 0 pot allocation
// ---------------------------------------------------------------------------
export class WorkerDay0PotAllocationService {
  constructor(private readonly repo: D1Day0PotAllocationRepository) {}

  async list(): Promise<Day0PotAllocation[]> {
    return this.repo.list();
  }

  async getById(id: string): Promise<Day0PotAllocation> {
    const row = await this.repo.getById(id);
    if (!row) throw new ServiceError("Allocation not found", "allocation.not_found", 404);
    return row;
  }

  async getByPotId(potId: string): Promise<Day0PotAllocation | undefined> {
    return this.repo.getByPotId(potId);
  }

  async create(input: Day0PotAllocation): Promise<Day0PotAllocation> {
    // Planned values, exactly as in the Node backend. Actual observations are
    // never defaulted, never copied and never fabricated.
    const normalized: Day0PotAllocation = {
      ...input,
      substrate_mass_g: input.substrate_mass_g ?? 72,
      seed_count: input.seed_count ?? 3,
      mass_basis: input.mass_basis ?? "unknown",
      sowing_status: input.sowing_status ?? "pending",
      emergence_status: input.emergence_status ?? "not_sown",
    };

    try {
      await this.repo.create(normalized);
    } catch (error) {
      throw this.mapRepoError(error);
    }
    const created = await this.repo.getById(normalized.allocation_id);
    if (!created) throw new ServiceError("Persisted allocation not found", "persistence.error", 500);
    return created;
  }

  async update(id: string, patch: Partial<Day0PotAllocation>): Promise<Day0PotAllocation> {
    try {
      const updated = await this.repo.update(id, patch);
      if (!updated) throw new ServiceError("Allocation not found", "allocation.not_found", 404);
      return updated;
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw this.mapRepoError(error);
    }
  }

  private mapRepoError(error: unknown): Error {
    if (error instanceof ServiceError) return error;
    if (error instanceof D1ValidationError) return new ServiceError("Invalid input", "input.invalid", 400);
    const code = (error as { code?: string })?.code;
    if (code === "id.duplicate") return new ServiceError("Duplicate identifier", "id.duplicate", 409);
    if (code === "reference.missing_parent") return new ServiceError("Invalid reference", "reference.invalid", 409);
    return new ServiceError("Internal server error", "internal.error", 500);
  }
}
