import type {
  AICVMeasurement,
  CalibrationStatus,
  Day0Equipment,
  Day0MethodologyDecision,
  Day0PhysicalConfig,
  Day0PotAllocation,
  DetectionStatus,
  FailureCode,
  Group,
  ImageQualityStatus,
  ManualMeasurement,
  MeasurementStatus,
  Plant,
  PlantStatus,
  PositionEvent,
  SegmentationStatus,
  ValidationIssue,
  WaterEvent,
  WateringStatus,
} from "../types.js";

export type ValidationSeverity = ValidationIssue["severity"];
export type EntityType = ValidationIssue["entity_type"];

export type ValidationResult = {
  valid: boolean;
  issues: StructuredValidationIssue[];
};

export type StructuredValidationIssue = {
  entity: EntityType;
  entity_id?: string;
  field: string;
  severity: ValidationSeverity;
  code: string;
  message: string;
};

const GROUPS: Group[] = ["G0", "G1", "G2"];
const PLANT_STATUSES: PlantStatus[] = ["active", "damaged", "dead", "excluded"];
const WATERING_STATUSES: WateringStatus[] = ["pass", "warn", "fail"];
const IMAGE_QUALITY_STATUSES: ImageQualityStatus[] = ["PASS", "WARN", "FAIL"];
const CALIBRATION_STATUSES: CalibrationStatus[] = ["pass", "warn", "fail"];
const MEASUREMENT_STATUSES: MeasurementStatus[] = ["pass", "warn", "fail"];
const DETECTION_STATUSES: DetectionStatus[] = ["pass", "fail"];
const SEGMENTATION_STATUSES: SegmentationStatus[] = ["pass", "fail", "not_applicable"];
export const FAILURE_CODES: FailureCode[] = [
  "no_detection",
  "poor_image_quality",
  "occlusion",
  "plant_damaged",
  "plant_dead",
  "calibration_failed",
  "none",
];

const ISO_TIMESTAMP_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const ID_PATTERNS = {
  plant_id: /^PLT-\d{3}$/,
  pot_id: /^POT-\d{3}$/,
  image_id: /^IMG-\d{8}-\d{6}-\d{3}$/,
  water_event_id: /^WTR-\d{8}-\d{6}-\d{3}$/,
  position_event_id: /^POS-\d{8}-\d{6}-\d{3}$/,
  issue_id: /^ISS-[A-Za-z0-9_-]+$/,
};

function issue(
  entity: EntityType,
  entity_id: string | undefined,
  field: string,
  code: string,
  message: string,
  severity: ValidationSeverity = "FAIL"
): StructuredValidationIssue {
  return { entity, entity_id, field, severity, code, message };
}

function parseDateLike(value: string): number {
  return Date.parse(value);
}

function validateEnum<T extends string>(
  entity: EntityType,
  entityId: string | undefined,
  field: string,
  value: string,
  options: readonly T[]
): StructuredValidationIssue[] {
  if (!options.includes(value as T)) {
    return [
      issue(
        entity,
        entityId,
        field,
        "enum.invalid",
        `Value '${value}' is not in allowed set: ${options.join(", ")}`
      ),
    ];
  }
  return [];
}

function validateRequired(
  entity: EntityType,
  entityId: string | undefined,
  field: string,
  value: unknown
): StructuredValidationIssue[] {
  if (value === undefined || value === null || value === "") {
    return [issue(entity, entityId, field, "required.missing", "Required field is missing")];
  }
  return [];
}

function validateTimestamp(
  entity: EntityType,
  entityId: string | undefined,
  field: string,
  value: string
): StructuredValidationIssue[] {
  const match = ISO_TIMESTAMP_RE.exec(value);
  if (!match) {
    return [
      issue(
        entity,
        entityId,
        field,
        "timestamp.invalid",
        "Timestamp must be ISO 8601 format YYYY-MM-DDTHH:MM:SS"
      ),
    ];
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);

  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  const isRealCalendarTime =
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth[month - 1] &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59 &&
    second >= 0 &&
    second <= 59;

  if (!isRealCalendarTime) {
    return [
      issue(
        entity,
        entityId,
        field,
        "timestamp.invalid",
        "Timestamp must be ISO 8601 format YYYY-MM-DDTHH:MM:SS"
      ),
    ];
  }

  return [];
}

function validateDate(
  entity: EntityType,
  entityId: string | undefined,
  field: string,
  value: string
): StructuredValidationIssue[] {
  if (!ISO_DATE_RE.test(value) || Number.isNaN(parseDateLike(value))) {
    return [issue(entity, entityId, field, "date.invalid", "Date must be ISO 8601 format YYYY-MM-DD")];
  }
  return [];
}

function validateId(
  entity: EntityType,
  entityId: string | undefined,
  field: keyof typeof ID_PATTERNS,
  value: string
): StructuredValidationIssue[] {
  const pattern = ID_PATTERNS[field];
  if (!pattern.test(value)) {
    return [
      issue(
        entity,
        entityId,
        field,
        "id.invalid_format",
        `ID '${value}' does not match required format for ${field}`
      ),
    ];
  }
  return [];
}

function validateMeasurementId(
  entity: EntityType,
  field: "measurement_id",
  value: string,
  prefixes: Array<"MSR-MAN-" | "MSR-AICV-">
): StructuredValidationIssue[] {
  if (!prefixes.some((prefix) => value.startsWith(prefix))) {
    return [
      issue(
        entity,
        value,
        field,
        "id.invalid_format",
        `ID '${value}' must start with ${prefixes.join(" or ")}`
      ),
    ];
  }

  return [];
}

export function validatePlant(input: Plant): ValidationResult {
  const issues: StructuredValidationIssue[] = [];

  issues.push(...validateRequired("plant", input.plant_id, "plant_id", input.plant_id));
  issues.push(...validateRequired("plant", input.plant_id, "pot_id", input.pot_id));
  issues.push(...validateRequired("plant", input.plant_id, "group_name", input.group_name));
  issues.push(...validateRequired("plant", input.plant_id, "emergence_date", input.emergence_date));
  issues.push(...validateRequired("plant", input.plant_id, "status", input.status));
  issues.push(...validateRequired("plant", input.plant_id, "created_at", input.created_at));

  if (input.plant_id) issues.push(...validateId("plant", input.plant_id, "plant_id", input.plant_id));
  if (input.pot_id) issues.push(...validateId("plant", input.plant_id, "pot_id", input.pot_id));
  if (input.group_name) issues.push(...validateEnum("plant", input.plant_id, "group_name", input.group_name, GROUPS));
  if (input.status) issues.push(...validateEnum("plant", input.plant_id, "status", input.status, PLANT_STATUSES));
  if (input.emergence_date) issues.push(...validateDate("plant", input.plant_id, "emergence_date", input.emergence_date));
  if (input.created_at) issues.push(...validateTimestamp("plant", input.plant_id, "created_at", input.created_at));
  if (input.updated_at) issues.push(...validateTimestamp("plant", input.plant_id, "updated_at", input.updated_at));

  return { valid: issues.length === 0, issues };
}

export function validateWaterEvent(input: WaterEvent): ValidationResult {
  const issues: StructuredValidationIssue[] = [];
  issues.push(...validateRequired("water_event", input.water_event_id, "water_event_id", input.water_event_id));
  issues.push(...validateRequired("water_event", input.water_event_id, "plant_id", input.plant_id));
  issues.push(...validateRequired("water_event", input.water_event_id, "timestamp", input.timestamp));
  issues.push(...validateRequired("water_event", input.water_event_id, "experiment_day", input.experiment_day));
  issues.push(...validateRequired("water_event", input.water_event_id, "watering_status", input.watering_status));

  if (input.water_event_id) {
    issues.push(...validateId("water_event", input.water_event_id, "water_event_id", input.water_event_id));
  }
  if (input.plant_id) issues.push(...validateId("water_event", input.water_event_id, "plant_id", input.plant_id));
  if (input.timestamp) issues.push(...validateTimestamp("water_event", input.water_event_id, "timestamp", input.timestamp));
  if (input.watering_status) {
    issues.push(
      ...validateEnum("water_event", input.water_event_id, "watering_status", input.watering_status, WATERING_STATUSES)
    );
  }

  if (!Number.isInteger(input.experiment_day) || input.experiment_day < 1) {
    issues.push(
      issue("water_event", input.water_event_id, "experiment_day", "number.out_of_range", "experiment_day must be >= 1")
    );
  }
  if (typeof input.pot_mass_before_g !== "number" || input.pot_mass_before_g < 0) {
    issues.push(
      issue("water_event", input.water_event_id, "pot_mass_before_g", "number.out_of_range", "Must be number >= 0")
    );
  }
  if (typeof input.target_mass_g !== "number" || input.target_mass_g <= 0) {
    issues.push(issue("water_event", input.water_event_id, "target_mass_g", "number.out_of_range", "Must be number > 0"));
  }
  if (typeof input.water_added_ml !== "number" || input.water_added_ml < 0) {
    issues.push(issue("water_event", input.water_event_id, "water_added_ml", "number.out_of_range", "Must be number >= 0"));
  }
  if (typeof input.pot_mass_after_g !== "number" || input.pot_mass_after_g < 0) {
    issues.push(
      issue("water_event", input.water_event_id, "pot_mass_after_g", "number.out_of_range", "Must be number >= 0")
    );
  }

  return { valid: issues.length === 0, issues };
}

export function validatePositionEvent(input: PositionEvent): ValidationResult {
  const issues: StructuredValidationIssue[] = [];
  issues.push(...validateRequired("position_event", input.position_event_id, "position_event_id", input.position_event_id));
  issues.push(...validateRequired("position_event", input.position_event_id, "position_id", input.position_id));
  issues.push(...validateRequired("position_event", input.position_event_id, "timestamp", input.timestamp));
  issues.push(...validateRequired("position_event", input.position_event_id, "plant_id", input.plant_id));
  issues.push(...validateRequired("position_event", input.position_event_id, "location", input.location));
  issues.push(...validateRequired("position_event", input.position_event_id, "operator", input.operator));
  issues.push(...validateRequired("position_event", input.position_event_id, "reason", input.reason));

  if (input.position_event_id) {
    issues.push(...validateId("position_event", input.position_event_id, "position_event_id", input.position_event_id));
  }
  if (input.plant_id) issues.push(...validateId("position_event", input.position_event_id, "plant_id", input.plant_id));
  if (input.timestamp) {
    issues.push(...validateTimestamp("position_event", input.position_event_id, "timestamp", input.timestamp));
  }
  if (input.reason) {
    issues.push(
      ...validateEnum("position_event", input.position_event_id, "reason", input.reason, [
        "initial_assignment",
        "rotation",
        "manual_override",
      ])
    );
  }

  return { valid: issues.length === 0, issues };
}

export function validateImageRecord(input: import("../types.js").ImageRecord): ValidationResult {
  const issues: StructuredValidationIssue[] = [];
  issues.push(...validateRequired("image_record", input.image_id, "image_id", input.image_id));
  issues.push(...validateRequired("image_record", input.image_id, "plant_id", input.plant_id));
  issues.push(...validateRequired("image_record", input.image_id, "timestamp", input.timestamp));
  issues.push(...validateRequired("image_record", input.image_id, "experiment_day", input.experiment_day));
  issues.push(...validateRequired("image_record", input.image_id, "image_path", input.image_path));
  issues.push(...validateRequired("image_record", input.image_id, "camera_id", input.camera_id));
  issues.push(...validateRequired("image_record", input.image_id, "image_quality_status", input.image_quality_status));
  issues.push(...validateRequired("image_record", input.image_id, "calibration_status", input.calibration_status));

  if (input.image_id) issues.push(...validateId("image_record", input.image_id, "image_id", input.image_id));
  if (input.plant_id) issues.push(...validateId("image_record", input.image_id, "plant_id", input.plant_id));
  if (input.timestamp) issues.push(...validateTimestamp("image_record", input.image_id, "timestamp", input.timestamp));
  if (!Number.isInteger(input.experiment_day) || input.experiment_day < 1) {
    issues.push(issue("image_record", input.image_id, "experiment_day", "number.out_of_range", "Must be integer >= 1"));
  }
  if (input.image_quality_status) {
    issues.push(
      ...validateEnum(
        "image_record",
        input.image_id,
        "image_quality_status",
        input.image_quality_status,
        IMAGE_QUALITY_STATUSES
      )
    );
  }
  if (input.calibration_status) {
    issues.push(
      ...validateEnum(
        "image_record",
        input.image_id,
        "calibration_status",
        input.calibration_status,
        CALIBRATION_STATUSES
      )
    );
  }
  if (input.failure_code) {
    issues.push(...validateEnum("image_record", input.image_id, "failure_code", input.failure_code, FAILURE_CODES));
  }

  return { valid: issues.length === 0, issues };
}

export function validateManualMeasurement(input: ManualMeasurement): ValidationResult {
  const issues: StructuredValidationIssue[] = [];
  issues.push(...validateRequired("manual_measurement", input.measurement_id, "measurement_id", input.measurement_id));
  issues.push(...validateRequired("manual_measurement", input.measurement_id, "plant_id", input.plant_id));
  issues.push(...validateRequired("manual_measurement", input.measurement_id, "timestamp", input.timestamp));
  issues.push(...validateRequired("manual_measurement", input.measurement_id, "experiment_day", input.experiment_day));
  issues.push(...validateRequired("manual_measurement", input.measurement_id, "repetition", input.repetition));
  issues.push(...validateRequired("manual_measurement", input.measurement_id, "observer", input.observer));
  issues.push(
    ...validateRequired("manual_measurement", input.measurement_id, "measurement_status", input.measurement_status)
  );
  issues.push(...validateRequired("manual_measurement", input.measurement_id, "method", input.method));

  if (input.measurement_id) {
    issues.push(...validateMeasurementId("manual_measurement", "measurement_id", input.measurement_id, ["MSR-MAN-"]));
  }
  if (input.plant_id) {
    issues.push(...validateId("manual_measurement", input.measurement_id, "plant_id", input.plant_id));
  }
  if (input.image_id) {
    issues.push(...validateId("manual_measurement", input.measurement_id, "image_id", input.image_id));
  }
  if (input.timestamp) {
    issues.push(...validateTimestamp("manual_measurement", input.measurement_id, "timestamp", input.timestamp));
  }
  if (!Number.isInteger(input.experiment_day) || input.experiment_day < 1) {
    issues.push(
      issue("manual_measurement", input.measurement_id, "experiment_day", "number.out_of_range", "Must be integer >= 1")
    );
  }
  if (![1, 2].includes(input.repetition)) {
    issues.push(issue("manual_measurement", input.measurement_id, "repetition", "enum.invalid", "Must be 1 or 2"));
  }
  if (
    input.plant_height_cm !== undefined &&
    (typeof input.plant_height_cm !== "number" || !Number.isFinite(input.plant_height_cm) || input.plant_height_cm <= 0)
  ) {
    issues.push(
      issue(
        "manual_measurement",
        input.measurement_id,
        "plant_height_cm",
        "number.out_of_range",
        "Must be a finite number > 0"
      )
    );
  }
  if (input.measurement_status) {
    issues.push(
      ...validateEnum(
        "manual_measurement",
        input.measurement_id,
        "measurement_status",
        input.measurement_status,
        MEASUREMENT_STATUSES
      )
    );
  }
  if (input.failure_code) {
    issues.push(...validateEnum("manual_measurement", input.measurement_id, "failure_code", input.failure_code, FAILURE_CODES));
  }
  if (input.method !== "MANUAL") {
    issues.push(issue("manual_measurement", input.measurement_id, "method", "enum.invalid", "Must be MANUAL"));
  }

  return { valid: issues.length === 0, issues };
}

export function validateAICVMeasurement(input: AICVMeasurement): ValidationResult {
  const issues: StructuredValidationIssue[] = [];
  issues.push(...validateRequired("aicv_measurement", input.measurement_id, "measurement_id", input.measurement_id));
  issues.push(...validateRequired("aicv_measurement", input.measurement_id, "image_id", input.image_id));
  issues.push(...validateRequired("aicv_measurement", input.measurement_id, "plant_id", input.plant_id));
  issues.push(...validateRequired("aicv_measurement", input.measurement_id, "timestamp", input.timestamp));
  issues.push(...validateRequired("aicv_measurement", input.measurement_id, "model", input.model));
  issues.push(...validateRequired("aicv_measurement", input.measurement_id, "model_version", input.model_version));
  issues.push(...validateRequired("aicv_measurement", input.measurement_id, "pipeline_version", input.pipeline_version));
  issues.push(...validateRequired("aicv_measurement", input.measurement_id, "detection_status", input.detection_status));
  issues.push(
    ...validateRequired("aicv_measurement", input.measurement_id, "segmentation_status", input.segmentation_status)
  );
  issues.push(
    ...validateRequired("aicv_measurement", input.measurement_id, "calibration_status", input.calibration_status)
  );
  issues.push(...validateRequired("aicv_measurement", input.measurement_id, "failure_code", input.failure_code));

  if (input.measurement_id) {
    issues.push(...validateMeasurementId("aicv_measurement", "measurement_id", input.measurement_id, ["MSR-AICV-"]));
  }
  if (input.image_id) issues.push(...validateId("aicv_measurement", input.measurement_id, "image_id", input.image_id));
  if (input.plant_id) issues.push(...validateId("aicv_measurement", input.measurement_id, "plant_id", input.plant_id));
  if (input.timestamp) issues.push(...validateTimestamp("aicv_measurement", input.measurement_id, "timestamp", input.timestamp));
  if (input.detection_status) {
    issues.push(
      ...validateEnum(
        "aicv_measurement",
        input.measurement_id,
        "detection_status",
        input.detection_status,
        DETECTION_STATUSES
      )
    );
  }
  if (input.segmentation_status) {
    issues.push(
      ...validateEnum(
        "aicv_measurement",
        input.measurement_id,
        "segmentation_status",
        input.segmentation_status,
        SEGMENTATION_STATUSES
      )
    );
  }
  if (input.calibration_status) {
    issues.push(
      ...validateEnum(
        "aicv_measurement",
        input.measurement_id,
        "calibration_status",
        input.calibration_status,
        CALIBRATION_STATUSES
      )
    );
  }
  if (input.failure_code) {
    issues.push(...validateEnum("aicv_measurement", input.measurement_id, "failure_code", input.failure_code, FAILURE_CODES));
  }
  if (
    input.plant_height_cm !== undefined &&
    (typeof input.plant_height_cm !== "number" || !Number.isFinite(input.plant_height_cm) || input.plant_height_cm <= 0)
  ) {
    issues.push(issue("aicv_measurement", input.measurement_id, "plant_height_cm", "number.out_of_range", "Must be a finite number > 0"));
  }
  if (
    input.projected_area_cm2 !== undefined &&
    (typeof input.projected_area_cm2 !== "number" ||
      !Number.isFinite(input.projected_area_cm2) ||
      input.projected_area_cm2 <= 0)
  ) {
    issues.push(
      issue("aicv_measurement", input.measurement_id, "projected_area_cm2", "number.out_of_range", "Must be a finite number > 0")
    );
  }
  if (
    input.confidence !== undefined &&
    (typeof input.confidence !== "number" ||
      !Number.isFinite(input.confidence) ||
      input.confidence < 0 ||
      input.confidence > 1)
  ) {
    issues.push(
      issue("aicv_measurement", input.measurement_id, "confidence", "number.out_of_range", "Must be a finite number in range 0..1")
    );
  }

  return { valid: issues.length === 0, issues };
}

export function validateValidationIssue(input: ValidationIssue): ValidationResult {
  const issues: StructuredValidationIssue[] = [];
  issues.push(...validateRequired("validation_issue", input.issue_id, "issue_id", input.issue_id));
  issues.push(...validateRequired("validation_issue", input.issue_id, "issue_type", input.issue_type));
  issues.push(...validateRequired("validation_issue", input.issue_id, "entity_type", input.entity_type));
  issues.push(...validateRequired("validation_issue", input.issue_id, "description", input.description));
  issues.push(...validateRequired("validation_issue", input.issue_id, "severity", input.severity));
  issues.push(...validateRequired("validation_issue", input.issue_id, "created_at", input.created_at));

  if (input.issue_id) issues.push(...validateId("validation_issue", input.issue_id, "issue_id", input.issue_id));
  if (input.created_at) issues.push(...validateTimestamp("validation_issue", input.issue_id, "created_at", input.created_at));
  if (input.severity) {
    issues.push(
      ...validateEnum("validation_issue", input.issue_id, "severity", input.severity, ["PASS", "WARN", "FAIL", "NOT_RUN"])
    );
  }

  return { valid: issues.length === 0, issues };
}

// Day 0 Equipment validation
export function validateDay0Equipment(input: Day0Equipment): ValidationResult {
  const issues: StructuredValidationIssue[] = [];
  issues.push(...validateRequired("day0_equipment", input.equipment_id, "equipment_id", input.equipment_id));
  issues.push(...validateRequired("day0_equipment", input.equipment_id, "name", input.name));
  issues.push(...validateRequired("day0_equipment", input.equipment_id, "category", input.category));
  issues.push(...validateRequired("day0_equipment", input.equipment_id, "quantity", input.quantity));

  if (input.created_at) issues.push(...validateTimestamp("day0_equipment", input.equipment_id, "created_at", input.created_at));
  if (input.updated_at) issues.push(...validateTimestamp("day0_equipment", input.equipment_id, "updated_at", input.updated_at));
  if (typeof input.quantity !== "number" || input.quantity < 0) {
    issues.push(issue("day0_equipment", input.equipment_id, "quantity", "number.out_of_range", "Must be number >= 0"));
  }
  if (typeof input.verified !== "boolean") {
    issues.push(issue("day0_equipment", input.equipment_id, "verified", "type.mismatch", "Must be boolean"));
  }

  return { valid: issues.length === 0, issues };
}

// Day 0 Physical Config validation
export function validateDay0PhysicalConfig(input: Day0PhysicalConfig): ValidationResult {
  const issues: StructuredValidationIssue[] = [];
  issues.push(...validateRequired("day0_physical_config", input.config_id, "config_id", input.config_id));

  if (input.created_at) issues.push(...validateTimestamp("day0_physical_config", input.config_id, "created_at", input.created_at));
  if (input.updated_at) issues.push(...validateTimestamp("day0_physical_config", input.config_id, "updated_at", input.updated_at));
  if (input.camera_distance_cm != null && (typeof input.camera_distance_cm !== "number" || input.camera_distance_cm < 0)) {
    issues.push(issue("day0_physical_config", input.config_id, "camera_distance_cm", "number.out_of_range", "Must be number >= 0"));
  }
  if (input.camera_angle_deg != null && (typeof input.camera_angle_deg !== "number" || input.camera_angle_deg < 0 || input.camera_angle_deg > 360)) {
    issues.push(issue("day0_physical_config", input.config_id, "camera_angle_deg", "number.out_of_range", "Must be number 0..360"));
  }
  // Planned watering volumes: plan values only, must be >= 0 when present.
  for (const field of ["planned_water_ml_g0", "planned_water_ml_g1", "planned_water_ml_g2"] as const) {
    const value = input[field];
    if (value != null && (typeof value !== "number" || value < 0)) {
      issues.push(issue("day0_physical_config", input.config_id, field, "number.out_of_range", "Must be number >= 0"));
    }
  }

  return { valid: issues.length === 0, issues };
}

// Day 0 Pot Allocation validation
export function validateDay0PotAllocation(input: Day0PotAllocation): ValidationResult {
  const issues: StructuredValidationIssue[] = [];
  issues.push(...validateRequired("day0_pot_allocation", input.allocation_id, "allocation_id", input.allocation_id));
  issues.push(...validateRequired("day0_pot_allocation", input.allocation_id, "pot_id", input.pot_id));
  issues.push(...validateRequired("day0_pot_allocation", input.allocation_id, "substrate_mass_g", input.substrate_mass_g));
  issues.push(...validateRequired("day0_pot_allocation", input.allocation_id, "seed_count", input.seed_count));
  issues.push(...validateRequired("day0_pot_allocation", input.allocation_id, "sowing_status", input.sowing_status));
  issues.push(...validateRequired("day0_pot_allocation", input.allocation_id, "emergence_status", input.emergence_status));

  if (input.pot_id) issues.push(...validateId("day0_pot_allocation", input.allocation_id, "pot_id", input.pot_id));
  if (input.plant_id) issues.push(...validateId("day0_pot_allocation", input.allocation_id, "plant_id", input.plant_id));
  if (input.group_name) issues.push(...validateEnum("day0_pot_allocation", input.allocation_id, "group_name", input.group_name, ["G0", "G1", "G2"]));
  if (input.created_at) issues.push(...validateTimestamp("day0_pot_allocation", input.allocation_id, "created_at", input.created_at));
  if (input.updated_at) issues.push(...validateTimestamp("day0_pot_allocation", input.allocation_id, "updated_at", input.updated_at));
  if (input.sowing_date) issues.push(...validateDate("day0_pot_allocation", input.allocation_id, "sowing_date", input.sowing_date));
  if (input.emergence_date) issues.push(...validateDate("day0_pot_allocation", input.allocation_id, "emergence_date", input.emergence_date));
  if (typeof input.substrate_mass_g !== "number" || input.substrate_mass_g < 0) {
    issues.push(issue("day0_pot_allocation", input.allocation_id, "substrate_mass_g", "number.out_of_range", "Must be number >= 0"));
  }
  if (input.empty_pot_mass_g != null && (typeof input.empty_pot_mass_g !== "number" || input.empty_pot_mass_g < 0)) {
    issues.push(issue("day0_pot_allocation", input.allocation_id, "empty_pot_mass_g", "number.out_of_range", "Must be number >= 0"));
  }
  if (input.saucer_mass_g != null && (typeof input.saucer_mass_g !== "number" || input.saucer_mass_g < 0)) {
    issues.push(issue("day0_pot_allocation", input.allocation_id, "saucer_mass_g", "number.out_of_range", "Must be number >= 0"));
  }
  if (input.seed_count != null && (typeof input.seed_count !== "number" || input.seed_count < 0)) {
    issues.push(issue("day0_pot_allocation", input.allocation_id, "seed_count", "number.out_of_range", "Must be number >= 0"));
  }
  if (input.seeds_sown != null && (typeof input.seeds_sown !== "number" || input.seeds_sown < 0)) {
    issues.push(issue("day0_pot_allocation", input.allocation_id, "seeds_sown", "number.out_of_range", "Must be number >= 0"));
  }
  if (input.seedlings_emerged != null && (typeof input.seedlings_emerged !== "number" || input.seedlings_emerged < 0)) {
    issues.push(issue("day0_pot_allocation", input.allocation_id, "seedlings_emerged", "number.out_of_range", "Must be number >= 0"));
  }
  if (input.plants_retained != null && (typeof input.plants_retained !== "number" || input.plants_retained < 0)) {
    issues.push(issue("day0_pot_allocation", input.allocation_id, "plants_retained", "number.out_of_range", "Must be number >= 0"));
  }
  if (input.seed_mass_g != null && (typeof input.seed_mass_g !== "number" || input.seed_mass_g < 0)) {
    issues.push(issue("day0_pot_allocation", input.allocation_id, "seed_mass_g", "number.out_of_range", "Must be number >= 0"));
  }
  if (input.initial_water_ml != null && (typeof input.initial_water_ml !== "number" || input.initial_water_ml < 0)) {
    issues.push(issue("day0_pot_allocation", input.allocation_id, "initial_water_ml", "number.out_of_range", "Must be number >= 0"));
  }
  if (input.initial_water_drained_ml != null && (typeof input.initial_water_drained_ml !== "number" || input.initial_water_drained_ml < 0)) {
    issues.push(issue("day0_pot_allocation", input.allocation_id, "initial_water_drained_ml", "number.out_of_range", "Must be number >= 0"));
  }
  if (input.initial_assembled_mass_g != null && (typeof input.initial_assembled_mass_g !== "number" || input.initial_assembled_mass_g < 0)) {
    issues.push(issue("day0_pot_allocation", input.allocation_id, "initial_assembled_mass_g", "number.out_of_range", "Must be number >= 0"));
  }
  if (input.mass_basis) {
    issues.push(...validateEnum("day0_pot_allocation", input.allocation_id, "mass_basis", input.mass_basis, ["measured", "approximate", "unknown"]));
  }
  if (input.sowing_status) {
    issues.push(...validateEnum("day0_pot_allocation", input.allocation_id, "sowing_status", input.sowing_status, ["pending", "sown", "failed"]));
  }
  if (input.emergence_status) {
    issues.push(...validateEnum("day0_pot_allocation", input.allocation_id, "emergence_status", input.emergence_status, ["not_sown", "sown", "awaiting", "emerged", "uncertain", "failed"]));
  }

  return { valid: issues.length === 0, issues };
}

// Day 0 Methodology Decision validation
export function validateDay0MethodologyDecision(input: Day0MethodologyDecision): ValidationResult {
  const issues: StructuredValidationIssue[] = [];
  issues.push(...validateRequired("day0_methodology_decision", input.decision_id, "decision_id", input.decision_id));
  issues.push(...validateRequired("day0_methodology_decision", input.decision_id, "title", input.title));
  issues.push(...validateRequired("day0_methodology_decision", input.decision_id, "description", input.description));
  issues.push(...validateRequired("day0_methodology_decision", input.decision_id, "status", input.status));

  if (input.created_at) issues.push(...validateTimestamp("day0_methodology_decision", input.decision_id, "created_at", input.created_at));
  if (input.updated_at) issues.push(...validateTimestamp("day0_methodology_decision", input.decision_id, "updated_at", input.updated_at));
  if (input.decided_at) issues.push(...validateTimestamp("day0_methodology_decision", input.decision_id, "decided_at", input.decided_at));
  if (input.status) {
    issues.push(...validateEnum("day0_methodology_decision", input.decision_id, "status", input.status, ["unresolved", "proposed", "approved", "rejected", "not_applicable"]));
  }
  if (typeof input.blocks_sowing !== "boolean") {
    issues.push(issue("day0_methodology_decision", input.decision_id, "blocks_sowing", "type.mismatch", "Must be boolean"));
  }
  if (typeof input.blocks_emergence !== "boolean") {
    issues.push(issue("day0_methodology_decision", input.decision_id, "blocks_emergence", "type.mismatch", "Must be boolean"));
  }
  if (typeof input.blocks_measurements !== "boolean") {
    issues.push(issue("day0_methodology_decision", input.decision_id, "blocks_measurements", "type.mismatch", "Must be boolean"));
  }

  return { valid: issues.length === 0, issues };
}

// Extended Plant validation (includes Day 0 fields)
export function validatePlantWithDay0(input: Plant): ValidationResult {
  const issues: StructuredValidationIssue[] = [];
  issues.push(...validateRequired("plant", input.plant_id, "plant_id", input.plant_id));
  issues.push(...validateRequired("plant", input.plant_id, "pot_id", input.pot_id));
  issues.push(...validateRequired("plant", input.plant_id, "group_name", input.group_name));
  issues.push(...validateRequired("plant", input.plant_id, "emergence_date", input.emergence_date));
  issues.push(...validateRequired("plant", input.plant_id, "status", input.status));
  issues.push(...validateRequired("plant", input.plant_id, "created_at", input.created_at));

  if (input.plant_id) issues.push(...validateId("plant", input.plant_id, "plant_id", input.plant_id));
  if (input.pot_id) issues.push(...validateId("plant", input.plant_id, "pot_id", input.pot_id));
  if (input.group_name) issues.push(...validateEnum("plant", input.plant_id, "group_name", input.group_name, ["G0", "G1", "G2"]));
  if (input.status) issues.push(...validateEnum("plant", input.plant_id, "status", input.status, ["active", "damaged", "dead", "excluded"]));
  if (input.emergence_date) issues.push(...validateDate("plant", input.plant_id, "emergence_date", input.emergence_date));
  if (input.created_at) issues.push(...validateTimestamp("plant", input.plant_id, "created_at", input.created_at));
  if (input.updated_at) issues.push(...validateTimestamp("plant", input.plant_id, "updated_at", input.updated_at));
  if (input.sowing_date) issues.push(...validateDate("plant", input.plant_id, "sowing_date", input.sowing_date));
  if (input.seed_count != null && (typeof input.seed_count !== "number" || input.seed_count < 0)) {
    issues.push(issue("plant", input.plant_id, "seed_count", "number.out_of_range", "Must be number >= 0"));
  }
  if (input.substrate_mass_g != null && (typeof input.substrate_mass_g !== "number" || input.substrate_mass_g < 0)) {
    issues.push(issue("plant", input.plant_id, "substrate_mass_g", "number.out_of_range", "Must be number >= 0"));
  }
  if (input.empty_pot_mass_g != null && (typeof input.empty_pot_mass_g !== "number" || input.empty_pot_mass_g < 0)) {
    issues.push(issue("plant", input.plant_id, "empty_pot_mass_g", "number.out_of_range", "Must be number >= 0"));
  }
  if (input.saucer_mass_g != null && (typeof input.saucer_mass_g !== "number" || input.saucer_mass_g < 0)) {
    issues.push(issue("plant", input.plant_id, "saucer_mass_g", "number.out_of_range", "Must be number >= 0"));
  }
  if (input.seed_mass_g != null && (typeof input.seed_mass_g !== "number" || input.seed_mass_g < 0)) {
    issues.push(issue("plant", input.plant_id, "seed_mass_g", "number.out_of_range", "Must be number >= 0"));
  }
  if (input.emergence_status) {
    issues.push(...validateEnum("plant", input.plant_id, "emergence_status", input.emergence_status, ["not_sown", "sown", "awaiting", "emerged", "uncertain", "failed"]));
  }

  return { valid: issues.length === 0, issues };
}
