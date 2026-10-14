import type {
  AICVMeasurement,
  Day0Equipment,
  Day0MethodologyDecision,
  Day0PhysicalConfig,
  Day0PotAllocation,
  ImageRecord,
  ManualMeasurement,
  Plant,
  PlantDayContext,
  PositionEvent,
  ValidationIssue,
  WaterEvent,
} from "../types/entities";
import type {
  CreateAICVMeasurementInput,
  CreateManualMeasurementInput,
  CreatePlantInput,
  CreatePositionEventInput,
  CreateWaterEventInput,
  UploadImageInput,
} from "../types/write";

export interface PlantService {
  listPlants(): Promise<Plant[]>;
  getPlantById(plantId: string): Promise<Plant | null>;
  createPlant(input: CreatePlantInput): Promise<Plant>;
  /**
   * Read-only day context (last recorded day / expected next day) for a
   * plant. Returns null for an unknown plant; never throws for 404.
   */
  getDayContext(plantId: string): Promise<PlantDayContext | null>;
}

export interface ImageService {
  listImages(): Promise<ImageRecord[]>;
  getImageById(imageId: string): Promise<ImageRecord | null>;
  /** Upload a RAW image with metadata through POST /api/images/upload. */
  uploadImage(input: UploadImageInput): Promise<ImageRecord>;
  /**
   * Verifies the stored RAW file is retrievable through the controlled
   * serving route. Returns false on any HTTP/network failure — never throws
   * and never exposes the file content.
   */
  verifyImageFile(imageId: string): Promise<boolean>;
}

export interface MeasurementService {
  listManualMeasurements(): Promise<ManualMeasurement[]>;
  getManualMeasurementById(measurementId: string): Promise<ManualMeasurement | null>;
  listAICVMeasurements(): Promise<AICVMeasurement[]>;
  getAICVMeasurementById(measurementId: string): Promise<AICVMeasurement | null>;
  createManualMeasurement(input: CreateManualMeasurementInput): Promise<ManualMeasurement>;
  createAICVMeasurement(input: CreateAICVMeasurementInput): Promise<AICVMeasurement>;
}

export interface ValidationService {
  listValidationIssues(): Promise<ValidationIssue[]>;
}

export interface CalibrationService {
  getCalibrationStatusByImageId(imageId: string): Promise<"pass" | "warn" | "fail" | "not_available">;
}

export interface AIService {
  getModelConfiguration(): Promise<{ model: string; modelVersion: string; pipelineVersion: string } | null>;
}

export interface WaterService {
  listWaterEvents(): Promise<WaterEvent[]>;
  createWaterEvent(input: CreateWaterEventInput): Promise<WaterEvent>;
}

export interface PositionService {
  listPositionEvents(): Promise<PositionEvent[]>;
  createPositionEvent(input: CreatePositionEventInput): Promise<PositionEvent>;
}

export interface Day0EquipmentService {
  list(): Promise<Day0Equipment[]>;
  getById(id: string): Promise<Day0Equipment>;
  create(input: Day0Equipment): Promise<Day0Equipment>;
  update(id: string, input: Partial<Day0Equipment>): Promise<Day0Equipment>;
}

export interface Day0PhysicalConfigService {
  get(): Promise<Day0PhysicalConfig | undefined>;
  create(input: Day0PhysicalConfig): Promise<Day0PhysicalConfig>;
  update(input: Partial<Day0PhysicalConfig>): Promise<Day0PhysicalConfig>;
}

export interface Day0PotAllocationService {
  list(): Promise<Day0PotAllocation[]>;
  getById(id: string): Promise<Day0PotAllocation>;
  getByPotId(potId: string): Promise<Day0PotAllocation | undefined>;
  create(input: Day0PotAllocation): Promise<Day0PotAllocation>;
  update(id: string, input: Partial<Day0PotAllocation>): Promise<Day0PotAllocation>;
}

export interface Day0MethodologyDecisionService {
  list(): Promise<Day0MethodologyDecision[]>;
  getById(id: string): Promise<Day0MethodologyDecision>;
  create(input: Day0MethodologyDecision): Promise<Day0MethodologyDecision>;
  update(id: string, input: Partial<Day0MethodologyDecision>): Promise<Day0MethodologyDecision>;
}
