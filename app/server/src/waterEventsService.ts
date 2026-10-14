import type { WaterEvent } from "./types.js";
import { validateWaterEvent } from "./validation/schema.js";
import { RepositoryError } from "./repositories/base.js";
import type { WaterEventRepository } from "./repositories/interfaces.js";
import { issue, persistedFieldsEqual, ServiceError } from "./serviceError.js";
import type { WriteIssue } from "./serviceError.js";

const PERSISTED_FIELDS = [
  "water_event_id",
  "plant_id",
  "timestamp",
  "experiment_day",
  "pot_mass_before_g",
  "target_mass_g",
  "water_added_ml",
  "pot_mass_after_g",
  "watering_status",
  "operator",
  "notes",
] as const;

export class WaterEventsService {
  constructor(private readonly waterEvents: WaterEventRepository) {}

  listWaterEvents(): WaterEvent[] {
    return this.waterEvents.list();
  }

  /**
   * Controlled append-only creation. Water events can never be updated or
   * deleted; re-submitting an identical row is an idempotent no-op and a
   * conflicting duplicate ID is rejected.
   */
  create(input: WaterEvent): WaterEvent {
    const validation = validateWaterEvent(input);
    if (!validation.valid) {
      throw this.validationError(validation.issues.map((x) => issue(x.field, x.code, x.message)));
    }

    const existing = this.waterEvents.getById(input.water_event_id);
    if (existing) {
      if (persistedFieldsEqual(existing, input, PERSISTED_FIELDS)) {
        return existing;
      }
      throw new ServiceError(
        `water_event_id '${input.water_event_id}' already exists with different content; water events are append-only`,
        "id.duplicate",
        409,
        [
          issue(
            "water_event_id",
            "id.conflict",
            `Duplicate water_event_id '${input.water_event_id}' with conflicting content`
          ),
        ]
      );
    }

    try {
      this.waterEvents.create(input);
    } catch (error) {
      throw this.mapRepositoryError(error);
    }

    const created = this.waterEvents.getById(input.water_event_id);
    if (!created) {
      throw new ServiceError("Persisted water event not found", "persistence.error", 500);
    }
    return created;
  }

  private validationError(issues: WriteIssue[]): ServiceError {
    return new ServiceError(
      "Invalid water event",
      "water_event.validation_failed",
      400,
      issues
    );
  }

  private mapRepositoryError(error: unknown): ServiceError {
    if (error instanceof RepositoryError) {
      if (error.code === "reference.missing_parent") {
        return new ServiceError(
          "Invalid reference: plant_id does not exist in plants",
          "reference.invalid",
          409
        );
      }
      if (error.code === "id.duplicate") {
        return new ServiceError("Duplicate water_event_id", "id.duplicate", 409);
      }
      if (error.code === "validation.failed") {
        return this.validationError([]);
      }
    }
    return new ServiceError("Internal server error", "internal.error", 500);
  }
}
