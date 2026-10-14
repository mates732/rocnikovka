import type { ManualMeasurement } from "./types.js";
import { validateManualMeasurement } from "./validation/schema.js";
import { RepositoryError } from "./repositories/base.js";
import type { ImageRecordRepository, ManualMeasurementRepository } from "./repositories/interfaces.js";
import { issue, persistedFieldsEqual, ServiceError } from "./serviceError.js";
import type { WriteIssue } from "./serviceError.js";

const PERSISTED_FIELDS = [
  "measurement_id",
  "plant_id",
  "image_id",
  "timestamp",
  "experiment_day",
  "repetition",
  "attempt",
  "plant_height_cm",
  "observer",
  "measurement_status",
  "failure_code",
  "notes",
  "method",
] as const;

export class ManualMeasurementsService {
  constructor(
    private readonly manualMeasurements: ManualMeasurementRepository,
    /** Read access to image_records for the G2 image<->plant consistency rule. */
    private readonly images: ImageRecordRepository
  ) {}

  listManualMeasurements(): ManualMeasurement[] {
    return this.manualMeasurements.list();
  }

  getManualMeasurementById(measurementId: string): ManualMeasurement | null {
    return this.manualMeasurements.getById(measurementId) ?? null;
  }

  /**
   * Controlled append-only creation.
   *
   * Enforces the approved Phase 4G status semantics:
   *   PASS: plant_height_cm required (finite > 0); failure_code NULL or "none".
   *   WARN: plant_height_cm optional; failure_code may be NULL/"none" or a real code.
   *   FAIL: failure_code required and NOT "none"; height optional/retained.
   *
   * And the G2 rule: when image_id is supplied, image_records.plant_id must
   * equal the measurement's plant_id.
   *
   * Retakes are allowed (attempt >= 1); no repetition/attempt uniqueness is
   * enforced.
   */
  create(input: ManualMeasurement): ManualMeasurement {
    const issues: WriteIssue[] = [];

    const validation = validateManualMeasurement(input);
    if (!validation.valid) {
      issues.push(...validation.issues.map((x) => issue(x.field, x.code, x.message)));
    }

    this.validateAttempt(input, issues);
    this.validateMeasurementStatusSemantics(input, issues);
    this.validateImagePlantConsistency(input, issues);

    if (issues.length > 0) {
      throw this.validationError(issues);
    }

    const existing = this.manualMeasurements.getById(input.measurement_id);
    if (existing) {
      const normalizedInput = { ...input, attempt: input.attempt ?? 1 };
      if (persistedFieldsEqual(existing, normalizedInput, PERSISTED_FIELDS)) {
        return existing;
      }
      throw new ServiceError(
        `measurement_id '${input.measurement_id}' already exists with different content; manual measurements are append-only`,
        "id.duplicate",
        409,
        [
          issue(
            "measurement_id",
            "id.conflict",
            `Duplicate measurement_id '${input.measurement_id}' with conflicting content`
          ),
        ]
      );
    }

    try {
      this.manualMeasurements.create(input);
    } catch (error) {
      throw this.mapRepositoryError(error);
    }

    const created = this.manualMeasurements.getById(input.measurement_id);
    if (!created) {
      throw new ServiceError("Persisted manual measurement not found", "persistence.error", 500);
    }
    return created;
  }

  /** attempt is optional for the write API; when provided it must be an integer >= 1. */
  private validateAttempt(input: ManualMeasurement, issues: WriteIssue[]): void {
    const attempt = input.attempt;
    if (attempt !== undefined && attempt !== null) {
      if (typeof attempt !== "number" || !Number.isInteger(attempt) || attempt < 1) {
        issues.push(issue("attempt", "number.out_of_range", "attempt must be an integer >= 1"));
      }
    }
  }

  /** Phase 4G decision table for measurement_status / failure_code / plant_height_cm. */
  private validateMeasurementStatusSemantics(input: ManualMeasurement, issues: WriteIssue[]): void {
    const status = input.measurement_status;
    const failureCode = input.failure_code;

    if (status === "pass") {
      const height = input.plant_height_cm;
      if (height === undefined || height === null) {
        issues.push(
          issue(
            "plant_height_cm",
            "validation.height_required_for_pass",
            "measurement_status 'pass' requires plant_height_cm > 0"
          )
        );
      }
      if (failureCode !== undefined && failureCode !== null && failureCode !== "none") {
        issues.push(
          issue(
            "failure_code",
            "validation.failure_code_invalid_for_pass",
            "measurement_status 'pass' requires failure_code to be NULL or 'none'"
          )
        );
      }
    }

    if (status === "fail") {
      if (failureCode === undefined || failureCode === null) {
        issues.push(
          issue(
            "failure_code",
            "validation.failure_code_required_for_fail",
            "measurement_status 'fail' requires a failure_code"
          )
        );
      } else if (failureCode === "none") {
        issues.push(
          issue(
            "failure_code",
            "validation.failure_code_none_invalid_for_fail",
            "measurement_status 'fail' requires a real failure_code, not 'none'"
          )
        );
      }
    }
    // WARN imposes no cross-field restriction.
  }

  /** G2: image_records.plant_id must equal manual_measurements.plant_id. */
  private validateImagePlantConsistency(input: ManualMeasurement, issues: WriteIssue[]): void {
    const imageId = input.image_id;
    if (imageId === undefined || imageId === null) return;

    const image = this.images.getById(imageId);
    if (!image) {
      issues.push(
        issue(
          "image_id",
          "reference.missing_parent",
          `image_id '${imageId}' does not exist in image_records`
        )
      );
      return;
    }

    if (input.plant_id !== image.plant_id) {
      issues.push(
        issue(
          "plant_id",
          "validation.plant_id_mismatch",
          `plant_id '${input.plant_id}' does not match image_records.plant_id '${image.plant_id}'`
        )
      );
    }
  }

  private validationError(issues: WriteIssue[]): ServiceError {
    return new ServiceError(
      "Invalid manual measurement",
      "manual_measurement.validation_failed",
      400,
      issues
    );
  }

  private mapRepositoryError(error: unknown): ServiceError {
    if (error instanceof RepositoryError) {
      if (error.code === "reference.missing_parent") {
        return new ServiceError(
          "Invalid reference: plant_id or image_id does not exist",
          "reference.invalid",
          409
        );
      }
      if (error.code === "id.duplicate") {
        return new ServiceError("Duplicate measurement_id", "id.duplicate", 409);
      }
      if (error.code === "validation.failed") {
        return this.validationError([]);
      }
    }
    return new ServiceError("Internal server error", "internal.error", 500);
  }
}
