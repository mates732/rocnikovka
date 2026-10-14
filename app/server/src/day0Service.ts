import type {
  Day0Equipment,
  Day0MethodologyDecision,
  Day0PhysicalConfig,
  Day0PotAllocation,
} from "./types.js";
import { RepositoryError } from "./repositories/base.js";
import { nowIsoSeconds } from "./repositories/base.js";
import type {
  Day0EquipmentRepository,
  Day0MethodologyDecisionRepository,
  Day0PhysicalConfigRepository,
  Day0PotAllocationRepository,
} from "./repositories/interfaces.js";

export class Day0ServiceError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "Day0ServiceError";
    this.code = code;
    this.status = status;
  }
}

export class Day0EquipmentService {
  constructor(private readonly repo: Day0EquipmentRepository) {}

  list(): Day0Equipment[] {
    return this.repo.list();
  }

  getById(id: string): Day0Equipment {
    const row = this.repo.getById(id);
    if (!row) {
      throw new Day0ServiceError("Equipment not found", "equipment.not_found", 404);
    }
    return row;
  }

  create(input: Day0Equipment): Day0Equipment {
    try {
      this.repo.create(input);
    } catch (error) {
      throw this.mapError(error);
    }
    const created = this.repo.getById(input.equipment_id);
    if (!created) throw new Day0ServiceError("Persisted equipment not found", "persistence.error", 500);
    return created;
  }

  update(id: string, input: Partial<Day0Equipment>): Day0Equipment {
    try {
      const updated = this.repo.update(id, { ...input, updated_at: nowIsoSeconds() });
      if (!updated) throw new Day0ServiceError("Equipment not found", "equipment.not_found", 404);
      return updated;
    } catch (error) {
      throw this.mapError(error);
    }
  }

  private mapError(error: unknown): Error {
    if (error instanceof Day0ServiceError) return error;
    if (error instanceof RepositoryError) {
      if (error.code === "validation.failed") return new Day0ServiceError("Invalid input", "input.invalid", 400);
      if (error.code === "id.duplicate") return new Day0ServiceError("Duplicate identifier", "id.duplicate", 409);
      if (error.code === "reference.missing_parent") return new Day0ServiceError("Invalid reference", "reference.invalid", 409);
      return new Day0ServiceError("Persistence error", "persistence.error", 500);
    }
    return new Day0ServiceError("Internal server error", "internal.error", 500);
  }
}

export class Day0PhysicalConfigService {
  constructor(private readonly repo: Day0PhysicalConfigRepository) {}

  get(): Day0PhysicalConfig | undefined {
    return this.repo.get();
  }

  create(input: Day0PhysicalConfig): Day0PhysicalConfig {
    try {
      this.repo.create(input);
    } catch (error) {
      throw this.mapError(error);
    }
    const created = this.repo.get();
    if (!created) throw new Day0ServiceError("Persisted config not found", "persistence.error", 500);
    return created;
  }

  update(input: Partial<Day0PhysicalConfig>): Day0PhysicalConfig {
    try {
      const updated = this.repo.update({ ...input, updated_at: nowIsoSeconds() });
      if (!updated) throw new Day0ServiceError("Config not found", "config.not_found", 404);
      return updated;
    } catch (error) {
      throw this.mapError(error);
    }
  }

  private mapError(error: unknown): Error {
    if (error instanceof Day0ServiceError) return error;
    if (error instanceof RepositoryError) {
      if (error.code === "validation.failed") return new Day0ServiceError("Invalid input", "input.invalid", 400);
      if (error.code === "id.duplicate") return new Day0ServiceError("Duplicate identifier", "id.duplicate", 409);
      return new Day0ServiceError("Persistence error", "persistence.error", 500);
    }
    return new Day0ServiceError("Internal server error", "internal.error", 500);
  }
}

export class Day0PotAllocationService {
  constructor(private readonly repo: Day0PotAllocationRepository) {}

  list(): Day0PotAllocation[] {
    return this.repo.list();
  }

  getById(id: string): Day0PotAllocation {
    const row = this.repo.getById(id);
    if (!row) throw new Day0ServiceError("Allocation not found", "allocation.not_found", 404);
    return row;
  }

  getByPotId(potId: string): Day0PotAllocation | undefined {
    return this.repo.getByPotId(potId);
  }

  create(input: Day0PotAllocation): Day0PotAllocation {
    // The planned seed count follows the protocol plan (3 per pot). It is a
    // planned value, never a fabricated observation — actual sown/emerged/
    // retained counts are only ever entered by the user.
    const normalized: Day0PotAllocation = {
      ...input,
      substrate_mass_g: input.substrate_mass_g ?? 72,
      seed_count: input.seed_count ?? 3,
      mass_basis: input.mass_basis ?? "unknown",
      sowing_status: input.sowing_status ?? "pending",
      emergence_status: input.emergence_status ?? "not_sown",
    };

    try {
      this.repo.create(normalized);
    } catch (error) {
      throw this.mapError(error);
    }
    const created = this.repo.getById(normalized.allocation_id);
    if (!created) throw new Day0ServiceError("Persisted allocation not found", "persistence.error", 500);
    return created;
  }

  update(id: string, input: Partial<Day0PotAllocation>): Day0PotAllocation {
    try {
      const updated = this.repo.update(id, { ...input, updated_at: nowIsoSeconds() });
      if (!updated) throw new Day0ServiceError("Allocation not found", "allocation.not_found", 404);
      return updated;
    } catch (error) {
      throw this.mapError(error);
    }
  }

  private mapError(error: unknown): Error {
    if (error instanceof Day0ServiceError) return error;
    if (error instanceof RepositoryError) {
      if (error.code === "validation.failed") return new Day0ServiceError("Invalid input", "input.invalid", 400);
      if (error.code === "id.duplicate") return new Day0ServiceError("Duplicate identifier", "id.duplicate", 409);
      if (error.code === "reference.missing_parent") return new Day0ServiceError("Invalid reference", "reference.invalid", 409);
      return new Day0ServiceError("Persistence error", "persistence.error", 500);
    }
    return new Day0ServiceError("Internal server error", "internal.error", 500);
  }
}

export class Day0MethodologyDecisionService {
  constructor(private readonly repo: Day0MethodologyDecisionRepository) {}

  list(): Day0MethodologyDecision[] {
    return this.repo.list();
  }

  getById(id: string): Day0MethodologyDecision {
    const row = this.repo.getById(id);
    if (!row) throw new Day0ServiceError("Decision not found", "decision.not_found", 404);
    return row;
  }

  create(input: Day0MethodologyDecision): Day0MethodologyDecision {
    try {
      this.repo.create(input);
    } catch (error) {
      throw this.mapError(error);
    }
    const created = this.repo.getById(input.decision_id);
    if (!created) throw new Day0ServiceError("Persisted decision not found", "persistence.error", 500);
    return created;
  }

  update(id: string, input: Partial<Day0MethodologyDecision>): Day0MethodologyDecision {
    try {
      const updated = this.repo.update(id, { ...input, updated_at: nowIsoSeconds() });
      if (!updated) throw new Day0ServiceError("Decision not found", "decision.not_found", 404);
      return updated;
    } catch (error) {
      throw this.mapError(error);
    }
  }

  private mapError(error: unknown): Error {
    if (error instanceof Day0ServiceError) return error;
    if (error instanceof RepositoryError) {
      if (error.code === "validation.failed") return new Day0ServiceError("Invalid input", "input.invalid", 400);
      if (error.code === "id.duplicate") return new Day0ServiceError("Duplicate identifier", "id.duplicate", 409);
      return new Day0ServiceError("Persistence error", "persistence.error", 500);
    }
    return new Day0ServiceError("Internal server error", "internal.error", 500);
  }
}