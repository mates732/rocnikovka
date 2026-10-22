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
import { ApiError, apiErrorFromResponse } from "../services/apiError.ts";
import { apiUrl } from "./apiBase.ts";

/**
 * Error handling contract for every HTTP method below:
 * - any non-OK response throws ApiError (status/code/message/issues preserved,
 *   never raw server text)
 * - network failures (fetch rejects) propagate as ordinary Error/TypeError and
 *   are therefore distinguishable from backend errors (which are ApiError)
 * - 404 on detail reads is mapped to null (existing read behavior)
 * - an OK response whose body is not JSON becomes an ApiError, NOT an empty
 *   success. This is the Cloudflare Access login-page case: Access answers an
 *   unauthenticated request with a redirect to its login page, which a browser
 *   fetch() follows, so the app receives HTML with a 200 status. Silently
 *   parsing that as "no data" would hide the real problem (not signed in).
 */
async function parseData<T>(response: Response): Promise<T> {
  let body: { data: T };
  try {
    body = (await response.json()) as { data: T };
  } catch {
    throw new ApiError(
      response.status,
      "response.not_json",
      "The API answered with something that is not JSON. If Cloudflare Access is " +
        "enabled, you are probably not signed in — open the API URL directly in " +
        "a browser and sign in first."
    );
  }
  return body.data;
}

export class HttpPlantService implements PlantService {
  async listPlants(): Promise<Plant[]> {
    const response = await fetch(apiUrl("/api/plants"), { credentials: "include" });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Plant[]>(response);
  }

  async getPlantById(plantId: string): Promise<Plant | null> {
    const response = await fetch(apiUrl(`/api/plants/${encodeURIComponent(plantId)}`), { credentials: "include" });
    if (response.status === 404) return null;
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Plant>(response);
  }

  async getDayContext(plantId: string): Promise<PlantDayContext | null> {
    const response = await fetch(apiUrl(`/api/plants/${encodeURIComponent(plantId)}/day-context`), { credentials: "include" });
    if (response.status === 404) return null;
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<PlantDayContext>(response);
  }

  async createPlant(input: CreatePlantInput): Promise<Plant> {
    const response = await fetch(apiUrl("/api/plants"), {
      credentials: "include",
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
    const response = await fetch(apiUrl("/api/images"), { credentials: "include" });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<ImageRecord[]>(response);
  }

  async getImageById(imageId: string): Promise<ImageRecord | null> {
    const response = await fetch(apiUrl(`/api/images/${encodeURIComponent(imageId)}`), { credentials: "include" });
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
    if (input.camera_id) form.append("camera_id", input.camera_id);
    form.append("image_quality_status", input.image_quality_status);
    form.append("calibration_status", input.calibration_status);
    if (input.cal_ref_id) form.append("cal_ref_id", input.cal_ref_id);
    if (input.failure_code) form.append("failure_code", input.failure_code);
    if (input.notes) form.append("notes", input.notes);

    const response = await fetch(apiUrl("/api/images/upload"), {
      credentials: "include",
      method: "POST",
      body: form,
    });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<ImageRecord>(response);
  }

  /** True when the controlled serving route returns the stored file. */
  async verifyImageFile(imageId: string): Promise<boolean> {
    try {
      const response = await fetch(apiUrl(`/api/images/${encodeURIComponent(imageId)}/file`), { credentials: "include" });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export class HttpMeasurementService implements MeasurementService {
  async listManualMeasurements(): Promise<ManualMeasurement[]> {
    const response = await fetch(apiUrl("/api/manual-measurements"), { credentials: "include" });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<ManualMeasurement[]>(response);
  }

  async getManualMeasurementById(measurementId: string): Promise<ManualMeasurement | null> {
    const response = await fetch(apiUrl(`/api/manual-measurements/${encodeURIComponent(measurementId)}`), { credentials: "include" });
    if (response.status === 404) return null;
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<ManualMeasurement>(response);
  }

  async listAICVMeasurements(): Promise<AICVMeasurement[]> {
    const response = await fetch(apiUrl("/api/aicv-measurements"), { credentials: "include" });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<AICVMeasurement[]>(response);
  }

  async getAICVMeasurementById(measurementId: string): Promise<AICVMeasurement | null> {
    const response = await fetch(apiUrl(`/api/aicv-measurements/${encodeURIComponent(measurementId)}`), { credentials: "include" });
    if (response.status === 404) return null;
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<AICVMeasurement>(response);
  }

  /**
   * Append-only create. The body is the explicit Create*Input only — persisted
   * entity fields that are server-owned must never be spread into the request.
   */
  async createManualMeasurement(input: CreateManualMeasurementInput): Promise<ManualMeasurement> {
    const response = await fetch(apiUrl("/api/manual-measurements"), {
      credentials: "include",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<ManualMeasurement>(response);
  }

  async createAICVMeasurement(input: CreateAICVMeasurementInput): Promise<AICVMeasurement> {
    const response = await fetch(apiUrl("/api/aicv-measurements"), {
      credentials: "include",
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
    const response = await fetch(apiUrl("/api/water-events"), { credentials: "include" });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<WaterEvent[]>(response);
  }

  async createWaterEvent(input: CreateWaterEventInput): Promise<WaterEvent> {
    const response = await fetch(apiUrl("/api/water-events"), {
      credentials: "include",
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
    const response = await fetch(apiUrl("/api/position-events"), { credentials: "include" });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<PositionEvent[]>(response);
  }

  async createPositionEvent(input: CreatePositionEventInput): Promise<PositionEvent> {
    const response = await fetch(apiUrl("/api/position-events"), {
      credentials: "include",
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
    const response = await fetch(apiUrl("/api/day0/equipment"), { credentials: "include" });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Day0Equipment[]>(response);
  }

  async getById(id: string): Promise<Day0Equipment> {
    const response = await fetch(apiUrl(`/api/day0/equipment/${encodeURIComponent(id)}`), { credentials: "include" });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Day0Equipment>(response);
  }

  async create(input: Day0Equipment): Promise<Day0Equipment> {
    const response = await fetch(apiUrl("/api/day0/equipment"), {
      credentials: "include",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Day0Equipment>(response);
  }

  async update(id: string, input: Partial<Day0Equipment>): Promise<Day0Equipment> {
    const response = await fetch(apiUrl(`/api/day0/equipment/${encodeURIComponent(id)}`), {
      credentials: "include",
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
    const response = await fetch(apiUrl("/api/day0/physical-config"), { credentials: "include" });
    if (response.status === 404) return undefined;
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Day0PhysicalConfig>(response);
  }

  async create(input: Day0PhysicalConfig): Promise<Day0PhysicalConfig> {
    const response = await fetch(apiUrl("/api/day0/physical-config"), {
      credentials: "include",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Day0PhysicalConfig>(response);
  }

  async update(input: Partial<Day0PhysicalConfig>): Promise<Day0PhysicalConfig> {
    const response = await fetch(apiUrl("/api/day0/physical-config"), {
      credentials: "include",
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
    const response = await fetch(apiUrl("/api/day0/pot-allocation"), { credentials: "include" });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Day0PotAllocation[]>(response);
  }

  async getById(id: string): Promise<Day0PotAllocation> {
    const response = await fetch(apiUrl(`/api/day0/pot-allocation/${encodeURIComponent(id)}`), { credentials: "include" });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Day0PotAllocation>(response);
  }

  async getByPotId(potId: string): Promise<Day0PotAllocation | undefined> {
    const response = await fetch(apiUrl(`/api/day0/pot-allocation/${encodeURIComponent(potId)}`), { credentials: "include" });
    if (response.status === 404) return undefined;
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Day0PotAllocation>(response);
  }

  async create(input: Day0PotAllocation): Promise<Day0PotAllocation> {
    const response = await fetch(apiUrl("/api/day0/pot-allocation"), {
      credentials: "include",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Day0PotAllocation>(response);
  }

  async update(id: string, input: Partial<Day0PotAllocation>): Promise<Day0PotAllocation> {
    const response = await fetch(apiUrl(`/api/day0/pot-allocation/${encodeURIComponent(id)}`), {
      credentials: "include",
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
    const response = await fetch(apiUrl("/api/day0/methodology-decisions"), { credentials: "include" });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Day0MethodologyDecision[]>(response);
  }

  async getById(id: string): Promise<Day0MethodologyDecision> {
    const response = await fetch(apiUrl(`/api/day0/methodology-decisions/${encodeURIComponent(id)}`), { credentials: "include" });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Day0MethodologyDecision>(response);
  }

  async create(input: Day0MethodologyDecision): Promise<Day0MethodologyDecision> {
    const response = await fetch(apiUrl("/api/day0/methodology-decisions"), {
      credentials: "include",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return parseData<Day0MethodologyDecision>(response);
  }

  async update(id: string, input: Partial<Day0MethodologyDecision>): Promise<Day0MethodologyDecision> {
    const response = await fetch(apiUrl(`/api/day0/methodology-decisions/${encodeURIComponent(id)}`), {
      credentials: "include",
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
