export type Group = "G0" | "G1" | "G2";
export type PlantStatus = "active" | "damaged" | "dead" | "excluded";
export type WateringStatus = "pass" | "warn" | "fail";
export type ImageQualityStatus = "PASS" | "WARN" | "FAIL";
export type CalibrationStatus = "pass" | "warn" | "fail";
export type MeasurementStatus = "pass" | "warn" | "fail";
export type DetectionStatus = "pass" | "fail";
export type SegmentationStatus = "pass" | "fail" | "not_applicable";
export type FailureCode =
  | "no_detection"
  | "poor_image_quality"
  | "occlusion"
  | "plant_damaged"
  | "plant_dead"
  | "calibration_failed"
  | "none";

export interface Plant {
  plant_id: string;
  pot_id: string;
  group_name: Group;
  emergence_date: string;
  status: PlantStatus;
  notes?: string;
  created_at: string;
  updated_at?: string;
  // Day 0 fields
  sowing_date?: string;
  seed_count?: number;
  substrate_mass_g?: number;
  empty_pot_mass_g?: number;
  saucer_mass_g?: number;
  seed_mass_g?: number;
  emergence_status?: EmergenceStatus;
}

export interface WaterEvent {
  water_event_id: string;
  plant_id: string;
  timestamp: string;
  experiment_day: number;
  pot_mass_before_g: number;
  target_mass_g: number;
  water_added_ml: number;
  pot_mass_after_g: number;
  watering_status: WateringStatus;
  operator?: string;
  notes?: string;
}

export interface PositionEvent {
  position_event_id: string;
  position_id: string;
  timestamp: string;
  plant_id: string;
  location: string;
  previous_location?: string;
  operator: string;
  reason: "initial_assignment" | "rotation" | "manual_override";
  notes?: string;
}

export interface ImageRecord {
  image_id: string;
  plant_id: string;
  timestamp: string;
  experiment_day: number;
  image_path: string;
  camera_id: string;
  image_quality_status: ImageQualityStatus;
  calibration_status: CalibrationStatus;
  cal_ref_id?: string;
  failure_code?: FailureCode;
  notes?: string;
}

export interface ManualMeasurement {
  measurement_id: string;
  plant_id: string;
  image_id?: string;
  timestamp: string;
  experiment_day: number;
  repetition: 1 | 2;
  attempt: number;
  plant_height_cm?: number;
  observer: string;
  measurement_status: MeasurementStatus;
  failure_code?: FailureCode;
  notes?: string;
  method: "MANUAL";
}

export interface AICVMeasurement {
  measurement_id: string;
  image_id: string;
  plant_id: string;
  timestamp: string;
  experiment_day: number;
  model: string;
  model_version: string;
  pipeline_version: string;
  detection_status: DetectionStatus;
  segmentation_status: SegmentationStatus;
  calibration_status: CalibrationStatus;
  plant_height_cm?: number;
  projected_area_cm2?: number;
  confidence?: number;
  failure_code: FailureCode;
  notes?: string;
}

export interface ValidationIssue {
  issue_id: string;
  issue_type: string;
  entity_type: string;
  entity_id?: string;
  description: string;
  severity: "PASS" | "WARN" | "FAIL" | "NOT_RUN";
  created_at: string;
}

// Day 0 Equipment Inventory
export interface Day0Equipment {
  equipment_id: string;
  name: string;
  category: string;
  quantity: number;
  unit?: string;
  model?: string;
  resolution?: string;
  verified: boolean;
  verified_at?: string;
  verified_by?: string;
  notes?: string;
  is_prepopulated: boolean;
  created_at: string;
  updated_at?: string;
}

// Day 0 Physical Configuration
export interface Day0PhysicalConfig {
  config_id: string;
  camera_device?: string;
  /**
   * Pot physical constants — controlled variables, not measurements taken
   * during the experiment. Nullable: nothing is pre-filled.
   */
  pot_material?: string;
  pot_diameter_cm?: number;
  pot_height_cm?: number;
  pot_volume_l?: number;
  pot_dimensions_basis?: "measured" | "manufacturer" | "unknown";
  camera_orientation?: string;
  camera_distance_cm?: number;
  camera_angle_deg?: number;
  lighting_config?: string;
  background?: string;
  image_resolution?: string;
  image_format?: string;
  capture_procedure?: string;
  calibration_ref_dimensions?: string;
  calibration_ref_placement?: string;
  pot_positioning?: string;
  rotation_procedure?: string;
  environmental_observations?: string;
  additional_notes?: string;
  /**
   * PLANNED watering volume per pot per group (ml). A plan value only — it is
   * never an actual watering event and never a gravimetric target mass.
   */
  planned_water_ml_g0?: number;
  planned_water_ml_g1?: number;
  planned_water_ml_g2?: number;
  created_at: string;
  updated_at?: string;
}

// Day 0 Pot Allocation
export type SowingStatus = "pending" | "sown" | "failed";
export type EmergenceStatus = "not_sown" | "sown" | "awaiting" | "emerged" | "uncertain" | "failed";
/** Whether a recorded mass was directly measured, entered as an approximation, or is unknown. */
export type MassBasis = "measured" | "approximate" | "unknown";

export interface Day0PotAllocation {
  allocation_id: string;
  pot_id: string;
  plant_id?: string;
  group_name?: Group;
  substrate_mass_g: number;
  empty_pot_mass_g?: number;
  saucer_mass_g?: number;
  /** Planned number of seeds for this pot (protocol plan: 3 per pot). */
  seed_count: number;
  /** Actual number of seeds the user sowed (entered when sowing happens). */
  seeds_sown?: number;
  /** Number of seedlings actually observed above the substrate. */
  seedlings_emerged?: number;
  /** Number of plants retained after any thinning (the pot stays one unit). */
  plants_retained?: number;
  seed_mass_g?: number;
  /** Observation only — the quantity of water used for initial wetting. Never a gravimetric target. */
  initial_water_ml?: number;
  /** Observation only — water that drained through the bottom during initial wetting. */
  initial_water_drained_ml?: number;
  initial_assembled_mass_g?: number;
  mass_basis: MassBasis;
  sowing_date?: string;
  sowing_status: SowingStatus;
  emergence_status: EmergenceStatus;
  emergence_date?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

// Day 0 Methodology Decisions
export type DecisionStatus = "unresolved" | "proposed" | "approved" | "rejected" | "not_applicable";

export interface Day0MethodologyDecision {
  decision_id: string;
  title: string;
  description: string;
  protocol_reference?: string;
  status: DecisionStatus;
  decision?: string;
  decided_by?: string;
  decided_at?: string;
  blocks_sowing: boolean;
  blocks_emergence: boolean;
  blocks_measurements: boolean;
  notes?: string;
  created_at: string;
  updated_at?: string;
}