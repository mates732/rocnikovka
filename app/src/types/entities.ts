/**
 * Treatment percentage for each group — stored independently from the group ID.
 * Protocol v1: G1 = 100%, G2 = 85%, G3 = 70%.
 * Do not derive from the group label; the percentage is authoritative data.
 */
export type TreatmentPercentage = 100 | 85 | 70;

/** Experiment group identifiers — G1, G2, G3 per authoritative Protocol v1 (G1=100%, G2=85%, G3=70%). */
export type Group = "G1" | "G2" | "G3";

/** Exemplar identifier within a group: EX01..EX09 (9 pots per group). */
export type ExemplarId = `EX${"01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09"}`;

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

export type SowingStatus = "pending" | "sown" | "failed";
export type EmergenceStatus = "not_sown" | "sown" | "awaiting" | "emerged" | "uncertain" | "failed";
export type DecisionStatus = "unresolved" | "proposed" | "approved" | "rejected" | "not_applicable";

export interface Plant {
  plant_id: string;
  pot_id: string;
  group_name: Group;
  exemplar_id: ExemplarId;
  treatment_percentage: TreatmentPercentage;
  emergence_date?: string;
  status: PlantStatus;
  notes?: string;
  created_at?: string;
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

export interface Pot {
  pot_id: string;
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
  operator?: string | null;
  notes?: string | null;
}

export interface PositionEvent {
  position_event_id: string;
  position_id: string;
  timestamp: string;
  plant_id: string;
  location: string;
  previous_location?: string | null;
  operator: string;
  reason: "initial_assignment" | "rotation" | "manual_override";
  notes?: string | null;
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
  cal_ref_id?: string | null;
  failure_code?: FailureCode | null;
  notes?: string | null;
}

export interface ManualMeasurement {
  measurement_id: string;
  plant_id: string;
  image_id?: string | null;
  timestamp: string;
  experiment_day: number;
  repetition: 1 | 2;
  attempt?: number;
  plant_height_cm?: number | null;
  observer: string;
  measurement_status: MeasurementStatus;
  failure_code?: FailureCode | null;
  notes?: string | null;
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
  plant_height_cm?: number | null;
  projected_area_cm2?: number | null;
  confidence?: number | null;
  failure_code: FailureCode;
  notes?: string | null;
}

export interface ValidationIssue {
  id: string;
  type: string;
  entity: string;
  description: string;
  status: "PASS" | "WARN" | "FAIL" | "NOT_RUN";
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
   * NOTE: These dimensions are UNVERIFIED against physical measurements.
   * The original protocol specified ~9 cm diameter, 7 cm height, 0.4 L.
   * Current values (12 cm, 10 cm, 1.0 L) are placeholders and must be verified.
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
    * PLANNED watering volume per pot per group (ml). A plan value only — never
    * an actual watering event and never a gravimetric target mass.
    * Protocol v1 §6.1: G1 = 100% (75 ml), G2 = 85% (64 ml), G3 = 70% (53 ml).
    * G1 is also the drift-correction control group (Protocol v1 §8).
    */
  planned_water_ml_g1?: number;
  planned_water_ml_g2?: number;
  planned_water_ml_g3?: number;
  created_at: string;
  updated_at?: string;
}

// Day 0 Pot Allocation
/** Whether a recorded mass was directly measured, entered as an approximation, or is unknown. */
export type MassBasis = "measured" | "approximate" | "unknown";

export interface Day0PotAllocation {
  allocation_id: string;
  pot_id: string;
  plant_id?: string;
  group_name?: Group;
  exemplar_id?: ExemplarId;
  treatment_percentage?: TreatmentPercentage;
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
  /** Observation only — water used for initial wetting. Never a gravimetric target. */
  initial_water_ml?: number;
  /** Observation only — water drained through the bottom during initial wetting. */
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

export interface PlantDayContext {
  plant_id: string;
  last_recorded_day: number | null;
  expected_next_day: number | null;
}