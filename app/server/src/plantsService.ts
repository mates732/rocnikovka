import type { Plant } from "./types.js";
import { RepositoryError } from "./repositories/base.js";
import type {
  AICVMeasurementRepository,
  ImageRecordRepository,
  ManualMeasurementRepository,
  PlantDeactivateInput,
  PlantRepository,
  PlantSafeUpdateInput,
  WaterEventRepository,
} from "./repositories/interfaces.js";

export class PlantsServiceError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "PlantsServiceError";
    this.code = code;
    this.status = status;
  }
}

type CreatePlantInput = Plant;

type PatchPlantBody = {
  status?: Plant["status"];
  notes?: string;
  updated_at?: string;
  plant_id?: unknown;
  pot_id?: unknown;
  group_name?: unknown;
  emergence_date?: unknown;
  created_at?: unknown;
};

export type PlantDayContext = {
  plant_id: string;
  /** Maximum experiment_day across images/manual/water/AICV for the plant (null when none exist). */
  last_recorded_day: number | null;
  /** last_recorded_day + 1 (null when no records exist). */
  expected_next_day: number | null;
};

export class PlantsService {
  constructor(
    private readonly plants: PlantRepository,
    private readonly images: ImageRecordRepository,
    private readonly manualMeasurements: ManualMeasurementRepository,
    private readonly waterEvents: WaterEventRepository,
    private readonly aicvMeasurements: AICVMeasurementRepository
  ) {}

  listPlants(): Plant[] {
    return this.plants.list();
  }

  /**
   * Read-only day context for a plant: the maximum persisted experiment_day
   * across every record that carries the field (position events intentionally
   * have no experiment_day and are excluded). Used as a human-error guard for
   * data entry — it never validates, rejects or modifies anything.
   */
  getDayContext(plantId: string): PlantDayContext | null {
    if (!this.plants.getById(plantId)) return null;

    const days: number[] = [
      ...this.images
        .list()
        .filter((r) => r.plant_id === plantId)
        .map((r) => r.experiment_day),
      ...this.manualMeasurements
        .list()
        .filter((r) => r.plant_id === plantId)
        .map((r) => r.experiment_day),
      ...this.waterEvents
        .list()
        .filter((r) => r.plant_id === plantId)
        .map((r) => r.experiment_day),
      ...this.aicvMeasurements
        .list()
        .filter((r) => r.plant_id === plantId)
        .map((r) => r.experiment_day),
    ];

    const last = days.length > 0 ? Math.max(...days) : null;
    return {
      plant_id: plantId,
      last_recorded_day: last,
      expected_next_day: last === null ? null : last + 1,
    };
  }

  getPlantById(plantId: string): Plant {
    const row = this.plants.getById(plantId);
    if (!row) {
      throw new PlantsServiceError("Plant not found", "plant.not_found", 404);
    }
    return row;
  }

  createPlant(input: CreatePlantInput): Plant {
    try {
      this.plants.create(input);
    } catch (error) {
      throw this.mapRepositoryError(error);
    }

    const created = this.plants.getById(input.plant_id);
    if (!created) {
      throw new PlantsServiceError("Persisted plant not found", "persistence.error", 500);
    }
    return created;
  }

  patchPlant(plantId: string, body: PatchPlantBody): Plant {
    this.rejectImmutableFieldMutation(body);

    const updatedAt = body.updated_at;
    if (!updatedAt) {
      throw new PlantsServiceError("Field 'updated_at' is required", "input.invalid", 400);
    }

    const updateInput: PlantSafeUpdateInput = {
      status: body.status,
      notes: body.notes,
      updated_at: updatedAt,
    };

    try {
      const updated = this.plants.updateSafe(plantId, updateInput);
      if (!updated) {
        throw new PlantsServiceError("Plant not found", "plant.not_found", 404);
      }
      return updated;
    } catch (error) {
      throw this.mapRepositoryError(error);
    }
  }

  deactivatePlant(plantId: string, input: PlantDeactivateInput): Plant {
    try {
      const updated = this.plants.deactivate(plantId, input);
      if (!updated) {
        throw new PlantsServiceError("Plant not found", "plant.not_found", 404);
      }
      return updated;
    } catch (error) {
      throw this.mapRepositoryError(error);
    }
  }

  private rejectImmutableFieldMutation(body: PatchPlantBody) {
    const immutableFields: Array<keyof PatchPlantBody> = ["plant_id", "pot_id", "group_name", "emergence_date", "created_at"];
    const attempted = immutableFields.find((field) => body[field] !== undefined);
    if (attempted) {
      throw new PlantsServiceError(`Field '${attempted}' is immutable`, "field.immutable", 409);
    }
  }

  private mapRepositoryError(error: unknown): Error {
    if (error instanceof PlantsServiceError) {
      return error;
    }
    if (error instanceof RepositoryError) {
      if (error.code === "validation.failed") {
        return new PlantsServiceError("Invalid input", "input.invalid", 400);
      }
      if (error.code === "id.duplicate") {
        return new PlantsServiceError("Duplicate identifier", "id.duplicate", 409);
      }
      if (error.code === "reference.missing_parent") {
        return new PlantsServiceError("Invalid reference", "reference.invalid", 409);
      }
      return new PlantsServiceError("Persistence error", "persistence.error", 500);
    }

    return new PlantsServiceError("Internal server error", "internal.error", 500);
  }
}
