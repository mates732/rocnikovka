import type { AICVMeasurement } from "./types.js";
import { validateAICVMeasurement } from "./validation/schema.js";
import { RepositoryError } from "./repositories/base.js";
import type { AICVMeasurementRepository, ImageRecordRepository } from "./repositories/interfaces.js";
import { issue, persistedFieldsEqual, ServiceError } from "./serviceError.js";
import type { WriteIssue } from "./serviceError.js";

const PERSISTED_FIELDS = [
  "measurement_id",
  "image_id",
  "plant_id",
  "timestamp",
  "experiment_day",
  "model",
  "model_version",
  "pipeline_version",
  "detection_status",
  "segmentation_status",
  "calibration_status",
  "plant_height_cm",
  "projected_area_cm2",
  "confidence",
  "failure_code",
  "notes",
] as const;

export class AICVMeasurementsService {
  constructor(
    private readonly aicvMeasurements: AICVMeasurementRepository,
    /** Read access to image_records for AICV<->image traceability. */
    private readonly images: ImageRecordRepository
  ) {}

  listAICVMeasurements(): AICVMeasurement[] {
    return this.aicvMeasurements.list();
  }

  getAICVMeasurementById(measurementId: string): AICVMeasurement | null {
    return this.aicvMeasurements.getById(measurementId) ?? null;
  }

  /**
   * Controlled append-only creation. Every AICV write must satisfy
   * image traceability before the row is inserted:
   *   1. image_id must exist in image_records
   *   2. image_records.plant_id must equal the measurement plant_id
   *   3. image_records.experiment_day must equal the measurement experiment_day
   * Nothing is derived: the supplied values are stored only.
   */
  create(input: AICVMeasurement): AICVMeasurement {
    const issues: WriteIssue[] = [];

    const validation = validateAICVMeasurement(input);
    if (!validation.valid) {
      issues.push(...validation.issues.map((x) => issue(x.field, x.code, x.message)));
    }

    this.validateImageTraceability(input, issues);

    if (issues.length > 0) {
      throw this.validationError(issues);
    }

    const existing = this.aicvMeasurements.getById(input.measurement_id);
    if (existing) {
      if (persistedFieldsEqual(existing, input, PERSISTED_FIELDS)) {
        return existing;
      }
      throw new ServiceError(
        `measurement_id '${input.measurement_id}' already exists with different content; AICV measurements are append-only`,
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
      this.aicvMeasurements.create(input);
    } catch (error) {
      throw this.mapRepositoryError(error);
    }

    const created = this.aicvMeasurements.getById(input.measurement_id);
    if (!created) {
      throw new ServiceError("Persisted AICV measurement not found", "persistence.error", 500);
    }
    return created;
  }

  /**
   * Phase 4G.6 consistency: the stored image is the source of truth for the
   * plant and the experiment day. Mismatches reject the whole write before any
   * DB mutation.
   */
  private validateImageTraceability(input: AICVMeasurement, issues: WriteIssue[]): void {
    const image = this.images.getById(input.image_id);
    if (!image) {
      issues.push(
        issue(
          "image_id",
          "reference.missing_parent",
          `image_id '${input.image_id}' does not exist in image_records`
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

    if (input.experiment_day !== image.experiment_day) {
      issues.push(
        issue(
          "experiment_day",
          "validation.experiment_day_mismatch",
          `experiment_day ${input.experiment_day} does not match image_records.experiment_day ${image.experiment_day}`
        )
      );
    }
  }

  private validationError(issues: WriteIssue[]): ServiceError {
    return new ServiceError(
      "Invalid AICV measurement",
      "aicv_measurement.validation_failed",
      400,
      issues
    );
  }

  private mapRepositoryError(error: unknown): ServiceError {
    if (error instanceof RepositoryError) {
      if (error.code === "reference.missing_parent") {
        return new ServiceError(
          "Invalid reference: image_id or plant_id does not exist",
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
