import type { PositionEvent } from "./types.js";
import { validatePositionEvent } from "./validation/schema.js";
import { RepositoryError } from "./repositories/base.js";
import type { PositionEventRepository } from "./repositories/interfaces.js";
import { issue, persistedFieldsEqual, ServiceError } from "./serviceError.js";
import type { WriteIssue } from "./serviceError.js";

const PERSISTED_FIELDS = [
  "position_event_id",
  "position_id",
  "timestamp",
  "plant_id",
  "location",
  "previous_location",
  "operator",
  "reason",
  "notes",
] as const;

export class PositionEventsService {
  constructor(private readonly positionEvents: PositionEventRepository) {}

  listPositionEvents(): PositionEvent[] {
    return this.positionEvents.list();
  }

  /**
   * Controlled append-only creation. Position events can never be updated or
   * deleted; re-submitting an identical row is an idempotent no-op and a
   * conflicting duplicate ID is rejected.
   */
  create(input: PositionEvent): PositionEvent {
    const validation = validatePositionEvent(input);
    if (!validation.valid) {
      throw this.validationError(validation.issues.map((x) => issue(x.field, x.code, x.message)));
    }

    const existing = this.positionEvents.getById(input.position_event_id);
    if (existing) {
      if (persistedFieldsEqual(existing, input, PERSISTED_FIELDS)) {
        return existing;
      }
      throw new ServiceError(
        `position_event_id '${input.position_event_id}' already exists with different content; position events are append-only`,
        "id.duplicate",
        409,
        [
          issue(
            "position_event_id",
            "id.conflict",
            `Duplicate position_event_id '${input.position_event_id}' with conflicting content`
          ),
        ]
      );
    }

    try {
      this.positionEvents.create(input);
    } catch (error) {
      throw this.mapRepositoryError(error);
    }

    const created = this.positionEvents.getById(input.position_event_id);
    if (!created) {
      throw new ServiceError("Persisted position event not found", "persistence.error", 500);
    }
    return created;
  }

  private validationError(issues: WriteIssue[]): ServiceError {
    return new ServiceError(
      "Invalid position event",
      "position_event.validation_failed",
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
        return new ServiceError("Duplicate position_event_id", "id.duplicate", 409);
      }
      if (error.code === "validation.failed") {
        return this.validationError([]);
      }
    }
    return new ServiceError("Internal server error", "internal.error", 500);
  }
}
