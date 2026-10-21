import type {
  CalibrationStatus,
  DetectionStatus,
  FailureCode,
  Group,
  ImageQualityStatus,
  MeasurementStatus,
  PlantStatus,
  SegmentationStatus,
  WateringStatus,
} from "./entities";

/**
 * Explicit request payload types for the Phase 4J append-only write endpoints.
 *
 * These are intentionally NOT the persisted entity types:
 * - optional numeric/enum fields are omitted rather than sent as `null`
 *   (the backend validators reject explicit null for numeric optionals)
 * - only fields the backend accepts appear here, so a future form can never
 *   spread a persisted entity (with server-owned/nullable fields) into a POST
 *
 * The backend remains the authoritative validation layer.
 */

export type CreatePlantInput = {
  plant_id: string; // PLT-XXX, immutable after creation
  pot_id: string; // POT-XXX, immutable after creation
  group_name: "G1" | "G2" | "G3";
  exemplar_id: string; // EX01..EX09
  treatment_percentage: 100 | 85 | 70;
  emergence_date: string; // ISO date YYYY-MM-DD (day 1 of the plant's experiment)
  status: PlantStatus; // active | damaged | dead | excluded
  created_at: string; // ISO YYYY-MM-DDTHH:MM:SS — required by the backend contract
  notes?: string;
};

/**
 * Input for POST /api/images/upload (multipart). The file is passed through
 * untouched (RAW); metadata uses the exact backend field names. Optional
 * fields are omitted from the FormData when empty — never sent as invented
 * values.
 */
export type UploadImageInput = {
  file: File;
  plant_id: string; // PLT-XXX, must exist
  timestamp: string; // ISO YYYY-MM-DDTHH:MM:SS
  experiment_day: number; // integer >= 1, never derived from timestamp
  camera_id: string;
  image_quality_status: ImageQualityStatus; // PASS | WARN | FAIL
  calibration_status: CalibrationStatus; // pass | warn | fail
  cal_ref_id?: string;
  failure_code?: FailureCode;
  notes?: string;
};

export type CreateWaterEventInput = {
  water_event_id: string; // WTR-YYYYMMDD-HHMMSS-XXX
  plant_id: string; // PLT-XXX, must exist
  timestamp: string; // ISO YYYY-MM-DDTHH:MM:SS (seconds required)
  experiment_day: number; // integer >= 1, never derived from timestamp
  pot_mass_before_g: number; // >= 0
  target_mass_g: number; // > 0
  water_added_ml: number; // >= 0
  pot_mass_after_g: number; // >= 0
  watering_status: WateringStatus;
  operator?: string;
  notes?: string;
};

export type CreatePositionEventInput = {
  position_event_id: string; // POS-YYYYMMDD-HHMMSS-XXX
  position_id: string;
  timestamp: string; // ISO YYYY-MM-DDTHH:MM:SS
  plant_id: string; // PLT-XXX, must exist
  location: string;
  previous_location?: string;
  operator: string;
  reason: "initial_assignment" | "rotation" | "manual_override";
  notes?: string;
};

export type CreateManualMeasurementInput = {
  measurement_id: string; // MSR-MAN-YYYYMMDD-HHMMSS-XXX
  plant_id: string; // PLT-XXX, must exist
  image_id?: string; // optional; must exist and match plant_id (G2)
  timestamp: string; // ISO YYYY-MM-DDTHH:MM:SS
  experiment_day: number; // integer >= 1
  repetition: 1 | 2;
  /** Retake counter; optional on write — the backend defaults it to 1. */
  attempt?: number; // integer >= 1 when provided
  plant_height_cm?: number; // finite > 0 when provided
  observer: string;
  measurement_status: MeasurementStatus; // pass | warn | fail (backend enforces status rules)
  failure_code?: FailureCode;
  notes?: string;
  method: "MANUAL";
};

export type CreateAICVMeasurementInput = {
  measurement_id: string; // MSR-AICV-YYYYMMDD-HHMMSS-XXX
  image_id: string; // must exist in image_records
  plant_id: string; // must equal image_records.plant_id
  timestamp: string; // ISO YYYY-MM-DDTHH:MM:SS
  experiment_day: number; // must equal image_records.experiment_day
  model: string;
  model_version: string;
  pipeline_version: string;
  detection_status: DetectionStatus;
  segmentation_status: SegmentationStatus;
  calibration_status: CalibrationStatus;
  plant_height_cm?: number; // finite > 0 when provided
  projected_area_cm2?: number; // finite > 0 when provided
  confidence?: number; // 0..1 when provided
  failure_code: FailureCode;
  notes?: string;
};
