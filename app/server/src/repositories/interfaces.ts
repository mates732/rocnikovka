import type {
  AICVMeasurement,
  Day0Equipment,
  Day0MethodologyDecision,
  Day0PhysicalConfig,
  Day0PotAllocation,
  ImageRecord,
  ManualMeasurement,
  Plant,
  PositionEvent,
  ValidationIssue,
  WaterEvent,
} from "../types.js";

export type PlantSafeUpdateInput = {
  status?: Plant["status"];
  notes?: string;
  updated_at: string;
};

export type PlantDeactivateInput = {
  status: Extract<Plant["status"], "damaged" | "dead" | "excluded">;
  updated_at: string;
  notes?: string;
};

export interface PlantRepository {
  list(): Plant[];
  create(input: Plant): void;
  getById(plant_id: string): Plant | undefined;
  updateSafe(plant_id: string, input: PlantSafeUpdateInput): Plant | undefined;
  deactivate(plant_id: string, input: PlantDeactivateInput): Plant | undefined;
}

export interface WaterEventRepository {
  list(): WaterEvent[];
  create(input: WaterEvent): void;
  getById(water_event_id: string): WaterEvent | undefined;
}

export interface PositionEventRepository {
  list(): PositionEvent[];
  create(input: PositionEvent): void;
  getById(position_event_id: string): PositionEvent | undefined;
}

export interface ImageRecordRepository {
  list(): ImageRecord[];
  create(input: ImageRecord): void;
  getById(image_id: string): ImageRecord | undefined;
}

export interface ManualMeasurementRepository {
  list(): ManualMeasurement[];
  create(input: ManualMeasurement): void;
  getById(measurement_id: string): ManualMeasurement | undefined;
}

export interface AICVMeasurementRepository {
  list(): AICVMeasurement[];
  create(input: AICVMeasurement): void;
  getById(measurement_id: string): AICVMeasurement | undefined;
}

export interface ValidationIssueRepository {
  create(input: ValidationIssue): void;
  getById(issue_id: string): ValidationIssue | undefined;
}

export interface PotRepository {
  exists(pot_id: string): boolean;
}

// Day 0 Repositories
export interface Day0EquipmentRepository {
  list(): Day0Equipment[];
  create(input: Day0Equipment): void;
  getById(equipment_id: string): Day0Equipment | undefined;
  update(equipment_id: string, input: Partial<Day0Equipment>): Day0Equipment | undefined;
}

export interface Day0PhysicalConfigRepository {
  get(): Day0PhysicalConfig | undefined;
  create(input: Day0PhysicalConfig): void;
  update(input: Partial<Day0PhysicalConfig>): Day0PhysicalConfig | undefined;
}

export interface Day0PotAllocationRepository {
  list(): Day0PotAllocation[];
  create(input: Day0PotAllocation): void;
  getById(allocation_id: string): Day0PotAllocation | undefined;
  getByPotId(pot_id: string): Day0PotAllocation | undefined;
  update(allocation_id: string, input: Partial<Day0PotAllocation>): Day0PotAllocation | undefined;
}

export interface Day0MethodologyDecisionRepository {
  list(): Day0MethodologyDecision[];
  create(input: Day0MethodologyDecision): void;
  getById(decision_id: string): Day0MethodologyDecision | undefined;
  update(decision_id: string, input: Partial<Day0MethodologyDecision>): Day0MethodologyDecision | undefined;
}
