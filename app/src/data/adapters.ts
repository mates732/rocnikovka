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
  AIService,
  CalibrationService,
  Day0EquipmentService,
  Day0MethodologyDecisionService,
  Day0PhysicalConfigService,
  Day0PotAllocationService,
  ImageService,
  MeasurementService,
  PlantService,
  PositionService,
  ValidationService,
  WaterService,
} from "../services/interfaces";
import type {
  CreateAICVMeasurementInput,
  CreateManualMeasurementInput,
  CreatePlantInput,
  CreatePositionEventInput,
  CreateWaterEventInput,
  UploadImageInput,
} from "../types/write";
import { apiErrorFromResponse } from "../services/apiError.ts";

/**
 * Error handling contract for every HTTP method below:
 * - any non-OK response throws ApiError (status/code/message/issues preserved,
 *   never raw server text)
 * - network failures (fetch rejects) propagate as ordinary Error/TypeError and
 *   are therefore distinguishable from backend errors (which are ApiError)
 * - 404 on detail reads is mapped to null (existing read behavior)
 */

async function parseData<T>(response: Response): Promise<T> {
  const body = (await response.json()) as { data: T };
  return body.data;
}

export class HttpPlantService implements PlantService {
  async listPlants(): Promise<Plant[]> {
    const response = await fetch("/api/plants");
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Plant[]>(response);
  }

  async getPlantById(plantId: string): Promise<Plant | null> {
    const response = await fetch(`/api/plants/${encodeURIComponent(plantId)}`);
    if (response.status === 404) return null;
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Plant>(response);
  }

  async getDayContext(plantId: string): Promise<PlantDayContext | null> {
    const response = await fetch(`/api/plants/${encodeURIComponent(plantId)}/day-context`);
    if (response.status === 404) return null;
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<PlantDayContext>(response);
  }

  async createPlant(input: CreatePlantInput): Promise<Plant> {
    const response = await fetch("/api/plants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Plant>(response);
  }
}

export class HttpImageService implements ImageService {
  async listImages(): Promise<ImageRecord[]> {
    const response = await fetch("/api/images");
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<ImageRecord[]>(response);
  }

  async getImageById(imageId: string): Promise<ImageRecord | null> {
    const response = await fetch(`/api/images/${encodeURIComponent(imageId)}`);
    if (response.status === 404) return null;
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<ImageRecord>(response);
  }

  /**
   * Multipart upload through POST /api/images/upload. The FormData uses only
   * the exact backend-supported field names; the browser sets the multipart
   * boundary. The file bytes are passed through untouched.
   */
  async uploadImage(input: UploadImageInput): Promise<ImageRecord> {
    const form = new FormData();
    form.append("file", input.file);
    form.append("plant_id", input.plant_id);
    form.append("timestamp", input.timestamp);
    form.append("experiment_day", String(input.experiment_day));
    form.append("camera_id", input.camera_id);
    form.append("image_quality_status", input.image_quality_status);
    form.append("calibration_status", input.calibration_status);
    if (input.cal_ref_id) form.append("cal_ref_id", input.cal_ref_id);
    if (input.failure_code) form.append("failure_code", input.failure_code);
    if (input.notes) form.append("notes", input.notes);

    const response = await fetch("/api/images/upload", {
      method: "POST",
      body: form,
    });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<ImageRecord>(response);
  }

  /** True when the controlled serving route returns the stored file. */
  async verifyImageFile(imageId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/images/${encodeURIComponent(imageId)}/file`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export class HttpMeasurementService implements MeasurementService {
  async listManualMeasurements(): Promise<ManualMeasurement[]> {
    const response = await fetch("/api/manual-measurements");
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<ManualMeasurement[]>(response);
  }

  async getManualMeasurementById(measurementId: string): Promise<ManualMeasurement | null> {
    const response = await fetch(`/api/manual-measurements/${encodeURIComponent(measurementId)}`);
    if (response.status === 404) return null;
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<ManualMeasurement>(response);
  }

  async listAICVMeasurements(): Promise<AICVMeasurement[]> {
    const response = await fetch("/api/aicv-measurements");
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<AICVMeasurement[]>(response);
  }

  async getAICVMeasurementById(measurementId: string): Promise<AICVMeasurement | null> {
    const response = await fetch(`/api/aicv-measurements/${encodeURIComponent(measurementId)}`);
    if (response.status === 404) return null;
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<AICVMeasurement>(response);
  }

  /**
   * Append-only create. The body is the explicit Create*Input only — persisted
   * entity fields that are server-owned must never be spread into the request.
   */
  async createManualMeasurement(input: CreateManualMeasurementInput): Promise<ManualMeasurement> {
    const response = await fetch("/api/manual-measurements", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<ManualMeasurement>(response);
  }

  async createAICVMeasurement(input: CreateAICVMeasurementInput): Promise<AICVMeasurement> {
    const response = await fetch("/api/aicv-measurements", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<AICVMeasurement>(response);
  }
}

export class EmptyValidationService implements ValidationService {
  async listValidationIssues(): Promise<ValidationIssue[]> {
    return [];
  }
}

export class EmptyCalibrationService implements CalibrationService {
  async getCalibrationStatusByImageId(_imageId: string): Promise<"pass" | "warn" | "fail" | "not_available"> {
    return "not_available";
  }
}

export class EmptyAIService implements AIService {
  async getModelConfiguration(): Promise<{ model: string; modelVersion: string; pipelineVersion: string } | null> {
    return null;
  }
}

export class HttpWaterService implements WaterService {
  async listWaterEvents(): Promise<WaterEvent[]> {
    const response = await fetch("/api/water-events");
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<WaterEvent[]>(response);
  }

  async createWaterEvent(input: CreateWaterEventInput): Promise<WaterEvent> {
    const response = await fetch("/api/water-events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<WaterEvent>(response);
  }
}

export class HttpPositionService implements PositionService {
  async listPositionEvents(): Promise<PositionEvent[]> {
    const response = await fetch("/api/position-events");
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<PositionEvent[]>(response);
  }

  async createPositionEvent(input: CreatePositionEventInput): Promise<PositionEvent> {
    const response = await fetch("/api/position-events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<PositionEvent>(response);
  }
}

// Day 0 HTTP service adapters
export class HttpDay0EquipmentService implements Day0EquipmentService {
  async list(): Promise<Day0Equipment[]> {
    const response = await fetch("/api/day0/equipment");
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Day0Equipment[]>(response);
  }

  async getById(id: string): Promise<Day0Equipment> {
    const response = await fetch(`/api/day0/equipment/${encodeURIComponent(id)}`);
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Day0Equipment>(response);
  }

  async create(input: Day0Equipment): Promise<Day0Equipment> {
    const response = await fetch("/api/day0/equipment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Day0Equipment>(response);
  }

  async update(id: string, input: Partial<Day0Equipment>): Promise<Day0Equipment> {
    const response = await fetch(`/api/day0/equipment/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Day0Equipment>(response);
  }
}

export class HttpDay0PhysicalConfigService implements Day0PhysicalConfigService {
  async get(): Promise<Day0PhysicalConfig | undefined> {
    const response = await fetch("/api/day0/physical-config");
    if (response.status === 404) return undefined;
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Day0PhysicalConfig>(response);
  }

  async create(input: Day0PhysicalConfig): Promise<Day0PhysicalConfig> {
    const response = await fetch("/api/day0/physical-config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Day0PhysicalConfig>(response);
  }

  async update(input: Partial<Day0PhysicalConfig>): Promise<Day0PhysicalConfig> {
    const response = await fetch("/api/day0/physical-config", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Day0PhysicalConfig>(response);
  }
}

export class HttpDay0PotAllocationService implements Day0PotAllocationService {
  async list(): Promise<Day0PotAllocation[]> {
    const response = await fetch("/api/day0/pot-allocation");
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Day0PotAllocation[]>(response);
  }

  async getById(id: string): Promise<Day0PotAllocation> {
    const response = await fetch(`/api/day0/pot-allocation/${encodeURIComponent(id)}`);
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Day0PotAllocation>(response);
  }

  async getByPotId(potId: string): Promise<Day0PotAllocation | undefined> {
    const response = await fetch(`/api/day0/pot-allocation/${encodeURIComponent(potId)}`);
    if (response.status === 404) return undefined;
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Day0PotAllocation>(response);
  }

  async create(input: Day0PotAllocation): Promise<Day0PotAllocation> {
    const response = await fetch("/api/day0/pot-allocation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Day0PotAllocation>(response);
  }

  async update(id: string, input: Partial<Day0PotAllocation>): Promise<Day0PotAllocation> {
    const response = await fetch(`/api/day0/pot-allocation/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Day0PotAllocation>(response);
  }
}

export class HttpDay0MethodologyDecisionService implements Day0MethodologyDecisionService {
  async list(): Promise<Day0MethodologyDecision[]> {
    const response = await fetch("/api/day0/methodology-decisions");
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Day0MethodologyDecision[]>(response);
  }

  async getById(id: string): Promise<Day0MethodologyDecision> {
    const response = await fetch(`/api/day0/methodology-decisions/${encodeURIComponent(id)}`);
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Day0MethodologyDecision>(response);
  }

  async create(input: Day0MethodologyDecision): Promise<Day0MethodologyDecision> {
    const response = await fetch("/api/day0/methodology-decisions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Day0MethodologyDecision>(response);
  }

  async update(id: string, input: Partial<Day0MethodologyDecision>): Promise<Day0MethodologyDecision> {
    const response = await fetch(`/api/day0/methodology-decisions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Day0MethodologyDecision>(response);
  }
}

export const services = {
  plantService: new HttpPlantService(),
  imageService: new HttpImageService(),
  measurementService: new HttpMeasurementService(),
  validationService: new EmptyValidationService(),
  calibrationService: new EmptyCalibrationService(),
  aiService: new EmptyAIService(),
  waterService: new HttpWaterService(),
  positionService: new HttpPositionService(),
  day0EquipmentService: new HttpDay0EquipmentService(),
  day0PhysicalConfigService: new HttpDay0PhysicalConfigService(),
  day0PotAllocationService: new HttpDay0PotAllocationService(),
  day0MethodologyDecisionService: new HttpDay0MethodologyDecisionService(),
};
