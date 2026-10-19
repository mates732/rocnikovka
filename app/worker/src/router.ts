/**
 * Worker router.
 *
 * Route paths and response shapes mirror app/server/src/index.ts exactly, so the
 * existing frontend adapters work unchanged once VITE_API_BASE_URL points here.
 *
 * Every handler:
 *   - parses and validates input,
 *   - maps a failed write to an error response (never a false success),
 *   - never writes experiment data to the Worker filesystem,
 *   - never uses in-memory arrays as persistence.
 */
import {
  D1AICVMeasurementRepository,
  D1ImageRecordRepository,
  D1ManualMeasurementRepository,
  D1PlantRepository,
  D1PositionEventRepository,
  D1ValidationIssueRepository,
  D1WaterEventRepository,
} from "./d1Repos.js";
import {
  D1Day0EquipmentRepository,
  D1Day0MethodologyDecisionRepository,
  D1Day0PhysicalConfigRepository,
  D1Day0PotAllocationRepository,
} from "./day0Repos.js";
import {
  WorkerDay0PotAllocationService,
  WorkerPlantsService,
} from "./services.js";
import { R2ImageStore, buildImageObjectKey, isAllowedImageContentType, MAX_IMAGE_UPLOAD_BYTES } from "./r2Images.js";
import { ImageUploadError } from "./imageUploadErrors.js";
import { ApiError } from "./apiError.js";
import { parsePagination, pageMeta, paginatedSql, countSql, PaginationError } from "./pagination.js";
import {
  apiErrorFromBody,
  corsHeaders,
  created,
  errorResponse,
  json,
  mapErrorToResponse,
  mapImageUploadError,
  noContent,
  notFound,
  ok,
  readJsonBody,
} from "./http.js";
import type { AICVMeasurement, ImageRecord, ManualMeasurement, PositionEvent, WaterEvent } from "./domain.js";
import { FAILURE_CODES } from "./domain.js";

export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  ALLOWED_ORIGIN?: string;
  /**
   * Optional Fetcher for the SPA's static assets (the Vite build output,
   * app/dist). When the Worker is deployed same-origin with the frontend this
   * binding is present and serves every non-API path. When it is absent the
   * Worker is API-only and non-API paths are a 404.
   */
  ASSETS?: Fetcher;
}

/**
 * Generates a collision-resistant id in the existing project convention.
 *
 * The suffix is exactly 3 digits, matching the server's ID patterns
 * (`IMG-YYYYMMDD-HHMMSS-XXX`). For image ids a per-second ordinal is used so a
 * duplicate can never be produced when two uploads share a timestamp.
 */
function generateId(prefix: string): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toISOString().slice(11, 19).replace(/:/g, "");
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `${prefix}-${date}-${time}-${random}`;
}

/**
 * Resolves a free IMG id for the given timestamp: the same deterministic
 * scheme as app/server/src/imageUploadService.ts (per-second ordinal 000..999).
 */
async function resolveImageId(db: D1Database, timestamp: string): Promise<string> {
  const compact = timestamp.replace(/[-:T]/g, "").replace(/Z$/, "");
  const prefix = `IMG-${compact.slice(0, 8)}-${compact.slice(8, 14)}-`;
  const existing = await db
    .prepare(`SELECT image_id FROM image_records WHERE image_id LIKE ?`)
    .bind(`${prefix}%`)
    .all<{ image_id: string }>();
  const taken = new Set(existing.results.map((r) => r.image_id));
  for (let suffix = 0; suffix <= 999; suffix++) {
    const candidate = `${prefix}${String(suffix).padStart(3, "0")}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new ImageUploadError(
    `No free image_id available for timestamp '${timestamp}' (more than 1000 images in one second)`,
    "image.id_exhausted"
  );
}

function str(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    // A 400, not a 500: this is a client input problem, not a server failure.
    throw new ApiError(`Field '${field}' is required`, "input.invalid", 400);
  }
  return value.trim();
}

/** Parses a required enum value, rejecting anything outside the allowed set. */
function parseEnum<T extends string | number>(value: unknown, field: string, allowed: readonly T[]): T {
  const parsed = typeof value === "string" && typeof allowed[0] === "number" ? Number(value) : value;
  if (parsed === "" || parsed === undefined || parsed === null || Number.isNaN(parsed as number)) {
    throw new ApiError(`Field '${field}' is required`, "input.invalid", 400);
  }
  if (!allowed.includes(parsed as T)) {
    throw new ApiError(`Field '${field}' must be one of: ${allowed.join(", ")}`, "input.invalid", 400);
  }
  return parsed as T;
}

/** Parses an optional enum value; undefined when absent or blank. */
function parseOptionalEnum<T extends string | number>(value: unknown, field: string, allowed: readonly T[]): T | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return parseEnum(value, field, allowed);
}

const GROUPS = ["G1", "G2", "G3"] as const;
const EXEMPLAR_IDS = ["EX01", "EX02", "EX03", "EX04", "EX05", "EX06", "EX07", "EX08", "EX09"] as const;
const TREATMENT_PERCENTAGES = [100, 85, 70] as const;
const PLANT_STATUSES = ["active", "damaged", "dead", "excluded"] as const;
const WATERING_STATUSES = ["pass", "warn", "fail"] as const;
const POSITION_REASONS = ["initial_assignment", "rotation", "manual_override"] as const;
const IMAGE_QUALITY_STATUSES = ["PASS", "WARN", "FAIL"] as const;
const CALIBRATION_STATUSES = ["pass", "warn", "fail"] as const;
const MEASUREMENT_STATUSES = ["pass", "warn", "fail"] as const;
const DETECTION_STATUSES = ["pass", "fail"] as const;
const SEGMENTATION_STATUSES = ["pass", "fail", "not_applicable"] as const;
const SOWING_STATUSES = ["pending", "sown", "failed"] as const;
const EMERGENCE_STATUSES = ["not_sown", "sown", "awaiting", "emerged", "uncertain", "failed"] as const;

/** Parses pagination from the request URL, mapping errors to a 400 response. */
function paginationOr400(url: URL, headers: Record<string, string>): { limit: number; offset: number } | Response {
  try {
    return parsePagination(url.searchParams);
  } catch (error) {
    if (error instanceof PaginationError) {
      return errorResponse(400, "input.invalid", error.message, {}, headers);
    }
    throw error;
  }
}

/**
 * Runs the list query with pagination and returns `{ data, meta }`.
 * `baseSql` must be a SELECT without LIMIT/OFFSET.
 */
async function paginatedList(
  db: D1Database,
  baseSql: string,
  pagination: { limit: number; offset: number },
  headers: Record<string, string>
): Promise<Response> {
  const [totalRow, page] = await Promise.all([
    db.prepare(countSql(baseSql)).first<{ n: number }>(),
    db.prepare(paginatedSql(baseSql, pagination)).all<Record<string, unknown>>(),
  ]);
  const total = Number(totalRow?.n ?? 0);
  return json({ data: page.results, meta: pageMeta(total, pagination) }, 200, headers);
}

const MASS_BASES = ["measured", "approximate", "unknown"] as const;
const SEVERITIES = ["PASS", "WARN", "FAIL", "NOT_RUN"] as const;
const POT_DIMENSION_BASES = ["measured", "manufacturer", "unknown"] as const;

function num(value: unknown, field: string): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || Number.isNaN(parsed)) {
    throw new ApiError(`Field '${field}' must be a number`, "input.invalid", 400);
  }
  return parsed;
}

function optionalNum(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || Number.isNaN(parsed)) return undefined;
  return parsed;
}

function optionalStr(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  return value.trim();
}

/**
 * Structural shape of an uploaded file. `File` exists in the Workers runtime but
 * is not part of the ES lib, so the shape is described structurally.
 */
interface UploadedFile {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

function isUploadedFile(value: unknown): value is UploadedFile {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { arrayBuffer?: unknown }).arrayBuffer === "function" &&
    typeof (value as { size?: unknown }).size === "number"
  );
}

const DECISION_STATUSES = ["unresolved", "proposed", "approved", "rejected", "not_applicable"] as const;

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const path = url.pathname;
  const headers = corsHeaders(request, env);

  // Preflight — restrictive: only the configured origin is echoed.
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  // Health probe (also useful for verifying the deployment from a browser).
  if (method === "GET" && path === "/api/health") {
    return ok({ status: "ok", api: "phytometer" }, headers);
  }

  const plants = new D1PlantRepository(env.DB);
  const waterEvents = new D1WaterEventRepository(env.DB);
  const positionEvents = new D1PositionEventRepository(env.DB);
  const images = new D1ImageRecordRepository(env.DB);
  const manual = new D1ManualMeasurementRepository(env.DB);
  const aicv = new D1AICVMeasurementRepository(env.DB);
  const day0Equipment = new D1Day0EquipmentRepository(env.DB);
  const day0Config = new D1Day0PhysicalConfigRepository(env.DB);
  const day0Allocation = new D1Day0PotAllocationRepository(env.DB);
  const day0Decisions = new D1Day0MethodologyDecisionRepository(env.DB);

  const plantsService = new WorkerPlantsService(plants);
  const allocationService = new WorkerDay0PotAllocationService(day0Allocation);
  const imageStore = new R2ImageStore(env.IMAGES);

  try {
    return await route();
  } catch (error) {
    if (error instanceof ImageUploadError || (error as { name?: string })?.name === "ImageUploadError") {
      return mapImageUploadError(error, headers);
    }
    return mapErrorToResponse(error, headers);
  }

  async function route(): Promise<Response> {
    // -----------------------------------------------------------------------
    // Plants
    // -----------------------------------------------------------------------
    if (method === "GET" && path === "/api/plants") {
      const page = paginationOr400(url, headers);
      if (page instanceof Response) return page;
      return paginatedList(
        env.DB,
        `SELECT * FROM plants ORDER BY created_at ASC, plant_id ASC`,
        page,
        headers
      );
    }

    if (method === "POST" && path === "/api/plants") {
      const body = (await readJsonBody(request)) as Record<string, unknown>;
      const plant = {
        plant_id: str(body.plant_id, "plant_id"),
        pot_id: str(body.pot_id, "pot_id"),
        group_name: parseEnum(body.group_name, "group_name", GROUPS),
        exemplar_id: parseEnum(body.exemplar_id, "exemplar_id", EXEMPLAR_IDS),
        treatment_percentage: parseEnum(body.treatment_percentage, "treatment_percentage", TREATMENT_PERCENTAGES),
        emergence_date: optionalStr(body.emergence_date),
        status: parseEnum(body.status, "status", PLANT_STATUSES),
        notes: optionalStr(body.notes),
        created_at: str(body.created_at, "created_at"),
        updated_at: optionalStr(body.updated_at),
        // Day 0 fields are optional on create and never defaulted to a value the
        // user did not supply, except that seed_count follows the 3-seed plan.
        sowing_date: optionalStr(body.sowing_date),
        seed_count: optionalNum(body.seed_count),
        substrate_mass_g: optionalNum(body.substrate_mass_g),
        empty_pot_mass_g: optionalNum(body.empty_pot_mass_g),
        saucer_mass_g: optionalNum(body.saucer_mass_g),
        seed_mass_g: optionalNum(body.seed_mass_g),
        emergence_status: parseOptionalEnum(body.emergence_status, "emergence_status", EMERGENCE_STATUSES),
      };
      return created(await plantsService.create(plant), headers);
    }

    const plantMatch = path.match(/^\/api\/plants\/([^/]+)$/);
    if (plantMatch) {
      const plantId = decodeURIComponent(plantMatch[1]);
      if (method === "GET") {
        return ok(await plantsService.getById(plantId), headers);
      }
      if (method === "PATCH") {
        const body = (await readJsonBody(request)) as Record<string, unknown>;
        return ok(await plantsService.patch(plantId, body), headers);
      }
    }

    const deactivateMatch = path.match(/^\/api\/plants\/([^/]+)\/deactivate$/);
    if (deactivateMatch && (method === "POST" || method === "PATCH")) {
      const plantId = decodeURIComponent(deactivateMatch[1]);
      const body = (await readJsonBody(request)) as Record<string, unknown>;
      const status = str(body.status, "status");
      if (status !== "damaged" && status !== "dead" && status !== "excluded") {
        return errorResponse(400, "input.invalid", "Status must be damaged, dead or excluded", {}, headers);
      }
      const updated = await plantsService.deactivate(plantId, {
        status,
        updated_at: str(body.updated_at, "updated_at"),
        notes: optionalStr(body.notes),
      });
      return ok(updated, headers);
    }

    const dayContextMatch = path.match(/^\/api\/plants\/([^/]+)\/day-context$/);
    if (dayContextMatch && method === "GET") {
      const plantId = decodeURIComponent(dayContextMatch[1]);
      const plant = await plants.getById(plantId);
      if (!plant) return notFound("plant.not_found", "Plant not found");

      // Read-only guard: derived from persisted records only. Position events
      // carry no experiment_day and are intentionally excluded.
      const [imgRows, manRows, waterRows, aicvRows] = await Promise.all([
        env.DB.prepare(`SELECT experiment_day FROM image_records WHERE plant_id = ?`).bind(plantId).all<{ experiment_day: number }>(),
        env.DB.prepare(`SELECT experiment_day FROM manual_measurements WHERE plant_id = ?`).bind(plantId).all<{ experiment_day: number }>(),
        env.DB.prepare(`SELECT experiment_day FROM water_events WHERE plant_id = ?`).bind(plantId).all<{ experiment_day: number }>(),
        env.DB.prepare(`SELECT experiment_day FROM aicv_measurements WHERE plant_id = ?`).bind(plantId).all<{ experiment_day: number }>(),
      ]);
      const days = [
        ...imgRows.results.map((r) => r.experiment_day),
        ...manRows.results.map((r) => r.experiment_day),
        ...waterRows.results.map((r) => r.experiment_day),
        ...aicvRows.results.map((r) => r.experiment_day),
      ];
      const last = days.length > 0 ? Math.max(...days) : null;
      return ok(
        { plant_id: plantId, last_recorded_day: last, expected_next_day: last === null ? null : last + 1 },
        headers
      );
    }

    // -----------------------------------------------------------------------
    // Water events (append-only)
    // -----------------------------------------------------------------------
    if (method === "GET" && path === "/api/water-events") {
      const page = paginationOr400(url, headers);
      if (page instanceof Response) return page;
      return paginatedList(
        env.DB,
        `SELECT * FROM water_events ORDER BY timestamp ASC, water_event_id ASC`,
        page,
        headers
      );
    }
    if (method === "POST" && path === "/api/water-events") {
      const body = (await readJsonBody(request)) as Record<string, unknown>;
      const row: WaterEvent = {
        water_event_id: str(body.water_event_id, "water_event_id"),
        plant_id: str(body.plant_id, "plant_id"),
        timestamp: str(body.timestamp, "timestamp"),
        experiment_day: num(body.experiment_day, "experiment_day"),
        pot_mass_before_g: num(body.pot_mass_before_g, "pot_mass_before_g"),
        // target_mass_g is always user-supplied. The Worker never computes it
        // from a planned volume or from any group percentage.
        target_mass_g: num(body.target_mass_g, "target_mass_g"),
        water_added_ml: num(body.water_added_ml, "water_added_ml"),
        pot_mass_after_g: num(body.pot_mass_after_g, "pot_mass_after_g"),
        watering_status: parseEnum(body.watering_status, "watering_status", WATERING_STATUSES),
        operator: optionalStr(body.operator),
        notes: optionalStr(body.notes),
      };
      await waterEvents.create(row);
      return created(row, headers);
    }

    // -----------------------------------------------------------------------
    // Position events (append-only)
    // -----------------------------------------------------------------------
    if (method === "GET" && path === "/api/position-events") {
      const page = paginationOr400(url, headers);
      if (page instanceof Response) return page;
      return paginatedList(
        env.DB,
        `SELECT * FROM position_events ORDER BY timestamp ASC, position_event_id ASC`,
        page,
        headers
      );
    }
    if (method === "POST" && path === "/api/position-events") {
      const body = (await readJsonBody(request)) as Record<string, unknown>;
      const row: PositionEvent = {
        position_event_id: str(body.position_event_id, "position_event_id"),
        position_id: str(body.position_id, "position_id"),
        timestamp: str(body.timestamp, "timestamp"),
        plant_id: str(body.plant_id, "plant_id"),
        location: str(body.location, "location"),
        previous_location: optionalStr(body.previous_location),
        operator: str(body.operator, "operator"),
        reason: parseEnum(body.reason, "reason", POSITION_REASONS),
        notes: optionalStr(body.notes),
      };
      await positionEvents.create(row);
      return created(row, headers);
    }

    // -----------------------------------------------------------------------
    // Images — metadata in D1, bytes in R2
    // -----------------------------------------------------------------------
    if (method === "GET" && path === "/api/images") {
      const page = paginationOr400(url, headers);
      if (page instanceof Response) return page;
      return paginatedList(
        env.DB,
        `SELECT * FROM image_records ORDER BY timestamp ASC, image_id ASC`,
        page,
        headers
      );
    }

    if (method === "POST" && path === "/api/images/upload") {
      const form = await request.formData();
      const file = form.get("file");
      if (!isUploadedFile(file)) {
        return errorResponse(400, "input.invalid", "Multipart field 'file' is required", {}, headers);
      }
      const contentType = file.type || "";
      if (!isAllowedImageContentType(contentType)) {
        return errorResponse(400, "image.invalid_content_type", "Unsupported image content type", {}, headers);
      }
      if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
        return errorResponse(413, "image.too_large", "Image exceeds maximum allowed size", {}, headers);
      }

      const timestamp = str(form.get("timestamp"), "timestamp");
      // Image ids follow the existing convention: IMG-YYYYMMDD-HHMMSS-XXX,
      // where the timestamp is the CAPTURE timestamp, not the upload time.
      const imageId = await resolveImageId(env.DB, timestamp);
      const bytes = await file.arrayBuffer();
      const key = buildImageObjectKey(imageId, contentType);

      const record: ImageRecord = {
        image_id: imageId,
        plant_id: str(form.get("plant_id"), "plant_id"),
        timestamp,
        experiment_day: num(form.get("experiment_day"), "experiment_day"),
        image_path: key,
        camera_id: str(form.get("camera_id"), "camera_id"),
        image_quality_status: parseEnum(form.get("image_quality_status"), "image_quality_status", IMAGE_QUALITY_STATUSES),
        calibration_status: parseEnum(form.get("calibration_status"), "calibration_status", CALIBRATION_STATUSES),
        cal_ref_id: optionalStr(form.get("cal_ref_id")),
        failure_code: parseOptionalEnum(form.get("failure_code"), "failure_code", FAILURE_CODES),
        notes: optionalStr(form.get("notes")),
      };

      // Persist bytes only after the record validates, so a rejected upload
      // leaves no orphan object in R2 and no metadata row in D1.
      try {
        await images.create(record);
      } catch (error) {
        throw error;
      }
      await imageStore.put(key, bytes, contentType);
      return created(record, headers);
    }

    const imageFileMatch = path.match(/^\/api\/images\/([^/]+)\/file$/);
    if (imageFileMatch && method === "GET") {
      const imageId = decodeURIComponent(imageFileMatch[1]);
      const record = await images.getById(imageId);
      if (!record) return notFound("image.not_found", "Image not found");
      const stored = await imageStore.get(record.image_path);
      if (!stored) return notFound("image.not_found", "Image bytes not found");
      return new Response(stored.bytes, {
        status: 200,
        headers: {
          "content-type": stored.contentType,
          "content-length": String(stored.bytes.byteLength),
          "cache-control": "private, max-age=31536000, immutable",
          "content-disposition": `inline; filename="${record.image_id}"`,
          ...headers,
        },
      });
    }

    const imageMatch = path.match(/^\/api\/images\/([^/]+)$/);
    if (imageMatch && method === "GET") {
      const imageId = decodeURIComponent(imageMatch[1]);
      const record = await images.getById(imageId);
      if (!record) return notFound("image.not_found", "Image not found");
      return ok(record, headers);
    }

    // -----------------------------------------------------------------------
    // Manual measurements (append-only, image→plant traceability)
    // -----------------------------------------------------------------------
    if (method === "GET" && path === "/api/manual-measurements") {
      const page = paginationOr400(url, headers);
      if (page instanceof Response) return page;
      return paginatedList(
        env.DB,
        `SELECT * FROM manual_measurements ORDER BY timestamp ASC, measurement_id ASC`,
        page,
        headers
      );
    }
    if (method === "POST" && path === "/api/manual-measurements") {
      const body = (await readJsonBody(request)) as Record<string, unknown>;
      const row: ManualMeasurement = {
        measurement_id: str(body.measurement_id, "measurement_id"),
        plant_id: str(body.plant_id, "plant_id"),
        image_id: optionalStr(body.image_id) ?? undefined,
        timestamp: str(body.timestamp, "timestamp"),
        experiment_day: num(body.experiment_day, "experiment_day"),
        repetition: parseEnum(body.repetition, "repetition", [1, 2] as const),
        attempt: optionalNum(body.attempt) ?? 1,
        plant_height_cm: optionalNum(body.plant_height_cm),
        observer: str(body.observer, "observer"),
        measurement_status: parseEnum(body.measurement_status, "measurement_status", MEASUREMENT_STATUSES),
        failure_code: parseOptionalEnum(body.failure_code, "failure_code", FAILURE_CODES),
        notes: optionalStr(body.notes),
        method: "MANUAL",
      };
      await manual.create(row);
      return created(row, headers);
    }

    const manualMatch = path.match(/^\/api\/manual-measurements\/([^/]+)$/);
    if (manualMatch && method === "GET") {
      const id = decodeURIComponent(manualMatch[1]);
      const row = await manual.getById(id);
      if (!row) return notFound("measurement.not_found", "Measurement not found");
      return ok(row, headers);
    }

    // -----------------------------------------------------------------------
    // AI/CV measurements (append-only)
    // -----------------------------------------------------------------------
    if (method === "GET" && path === "/api/aicv-measurements") {
      const page = paginationOr400(url, headers);
      if (page instanceof Response) return page;
      return paginatedList(
        env.DB,
        `SELECT * FROM aicv_measurements ORDER BY timestamp ASC, measurement_id ASC`,
        page,
        headers
      );
    }
    if (method === "POST" && path === "/api/aicv-measurements") {
      const body = (await readJsonBody(request)) as Record<string, unknown>;
      const row: AICVMeasurement = {
        measurement_id: str(body.measurement_id, "measurement_id"),
        image_id: str(body.image_id, "image_id"),
        plant_id: str(body.plant_id, "plant_id"),
        timestamp: str(body.timestamp, "timestamp"),
        experiment_day: num(body.experiment_day, "experiment_day"),
        model: str(body.model, "model"),
        model_version: str(body.model_version, "model_version"),
        pipeline_version: str(body.pipeline_version, "pipeline_version"),
        detection_status: parseEnum(body.detection_status, "detection_status", DETECTION_STATUSES),
        segmentation_status: parseEnum(body.segmentation_status, "segmentation_status", SEGMENTATION_STATUSES),
        calibration_status: parseEnum(body.calibration_status, "calibration_status", CALIBRATION_STATUSES),
        plant_height_cm: optionalNum(body.plant_height_cm),
        projected_area_cm2: optionalNum(body.projected_area_cm2),
        confidence: optionalNum(body.confidence),
        failure_code: parseEnum(body.failure_code, "failure_code", FAILURE_CODES),
        notes: optionalStr(body.notes),
      };
      await aicv.create(row);
      return created(row, headers);
    }

    const aicvMatch = path.match(/^\/api\/aicv-measurements\/([^/]+)$/);
    if (aicvMatch && method === "GET") {
      const id = decodeURIComponent(aicvMatch[1]);
      const row = await aicv.getById(id);
      if (!row) return notFound("measurement.not_found", "Measurement not found");
      return ok(row, headers);
    }

    // -----------------------------------------------------------------------
    // Day 0 — equipment
    // -----------------------------------------------------------------------
    if (method === "GET" && path === "/api/day0/equipment") {
      const page = paginationOr400(url, headers);
      if (page instanceof Response) return page;
      return paginatedList(
        env.DB,
        `SELECT * FROM day0_equipment ORDER BY created_at ASC, equipment_id ASC`,
        page,
        headers
      );
    }
    if (method === "POST" && path === "/api/day0/equipment") {
      const body = (await readJsonBody(request)) as Record<string, unknown>;
      await day0Equipment.create({
        equipment_id: str(body.equipment_id, "equipment_id"),
        name: str(body.name, "name"),
        category: str(body.category, "category"),
        quantity: num(body.quantity, "quantity"),
        unit: optionalStr(body.unit),
        model: optionalStr(body.model),
        resolution: optionalStr(body.resolution),
        verified: body.verified === true,
        verified_at: optionalStr(body.verified_at),
        verified_by: optionalStr(body.verified_by),
        notes: optionalStr(body.notes),
        is_prepopulated: body.is_prepopulated === true,
        created_at: str(body.created_at, "created_at"),
        updated_at: optionalStr(body.updated_at),
      });
      const createdRow = await day0Equipment.getById(String(body.equipment_id));
      if (!createdRow) throw new Error("persistence.error");
      return created(createdRow, headers);
    }

    const equipmentMatch = path.match(/^\/api\/day0\/equipment\/([^/]+)$/);
    if (equipmentMatch) {
      const id = decodeURIComponent(equipmentMatch[1]);
      if (method === "GET") {
        const row = await day0Equipment.getById(id);
        if (!row) return notFound("equipment.not_found", "Equipment not found");
        return ok(row, headers);
      }
      if (method === "PATCH") {
        const body = (await readJsonBody(request)) as Record<string, unknown>;
        const updated = await day0Equipment.update(id, body as never);
        if (!updated) return notFound("equipment.not_found", "Equipment not found");
        return ok(updated, headers);
      }
    }

    // -----------------------------------------------------------------------
    // Day 0 — physical configuration (singleton)
    // -----------------------------------------------------------------------
    if (method === "GET" && path === "/api/day0/physical-config") {
      const config = await day0Config.get();
      if (!config) return notFound("config.not_found", "Physical config not found");
      return ok(config, headers);
    }
    if (method === "POST" && path === "/api/day0/physical-config") {
      const body = (await readJsonBody(request)) as Record<string, unknown>;
      await day0Config.create({
        config_id: str(body.config_id, "config_id"),
        camera_device: optionalStr(body.camera_device),
        camera_orientation: optionalStr(body.camera_orientation),
        camera_distance_cm: optionalNum(body.camera_distance_cm),
        camera_angle_deg: optionalNum(body.camera_angle_deg),
        lighting_config: optionalStr(body.lighting_config),
        background: optionalStr(body.background),
        image_resolution: optionalStr(body.image_resolution),
        image_format: optionalStr(body.image_format),
        capture_procedure: optionalStr(body.capture_procedure),
        calibration_ref_dimensions: optionalStr(body.calibration_ref_dimensions),
        calibration_ref_placement: optionalStr(body.calibration_ref_placement),
        pot_positioning: optionalStr(body.pot_positioning),
        rotation_procedure: optionalStr(body.rotation_procedure),
        environmental_observations: optionalStr(body.environmental_observations),
        additional_notes: optionalStr(body.additional_notes),
        pot_material: optionalStr(body.pot_material),
        pot_diameter_cm: optionalNum(body.pot_diameter_cm),
        pot_height_cm: optionalNum(body.pot_height_cm),
        pot_volume_l: optionalNum(body.pot_volume_l),
        pot_dimensions_basis: parseOptionalEnum(
          body.pot_dimensions_basis,
          "pot_dimensions_basis",
          POT_DIMENSION_BASES
        ),
        planned_water_ml_g1: optionalNum(body.planned_water_ml_g1),
        planned_water_ml_g2: optionalNum(body.planned_water_ml_g2),
        planned_water_ml_g3: optionalNum(body.planned_water_ml_g3),
        created_at: str(body.created_at, "created_at"),
        updated_at: optionalStr(body.updated_at),
      });
      const createdRow = await day0Config.get();
      if (!createdRow) throw new Error("persistence.error");
      return created(createdRow, headers);
    }
    if (method === "PATCH" && path === "/api/day0/physical-config") {
      const body = (await readJsonBody(request)) as Record<string, unknown>;
      const updated = await day0Config.update(body as never);
      if (!updated) return notFound("config.not_found", "Physical config not found");
      return ok(updated, headers);
    }

    // -----------------------------------------------------------------------
    // Day 0 — pot allocation & sowing
    // -----------------------------------------------------------------------
    if (method === "GET" && path === "/api/day0/pot-allocation") {
      const page = paginationOr400(url, headers);
      if (page instanceof Response) return page;
      return paginatedList(
        env.DB,
        `SELECT * FROM day0_pot_allocation ORDER BY pot_id ASC`,
        page,
        headers
      );
    }
    if (method === "POST" && path === "/api/day0/pot-allocation") {
      const body = (await readJsonBody(request)) as Record<string, unknown>;
      const row = await allocationService.create({
        allocation_id: str(body.allocation_id, "allocation_id"),
        pot_id: str(body.pot_id, "pot_id"),
        plant_id: optionalStr(body.plant_id),
        group_name: parseOptionalEnum(body.group_name, "group_name", GROUPS),
        exemplar_id: parseOptionalEnum(body.exemplar_id, "exemplar_id", EXEMPLAR_IDS),
        treatment_percentage: optionalNum(body.treatment_percentage),
        substrate_mass_g: optionalNum(body.substrate_mass_g) ?? 72,
        empty_pot_mass_g: optionalNum(body.empty_pot_mass_g),
        saucer_mass_g: optionalNum(body.saucer_mass_g),
        seed_count: optionalNum(body.seed_count) ?? 3,
        seeds_sown: optionalNum(body.seeds_sown),
        seedlings_emerged: optionalNum(body.seedlings_emerged),
        plants_retained: optionalNum(body.plants_retained),
        seed_mass_g: optionalNum(body.seed_mass_g),
        initial_water_ml: optionalNum(body.initial_water_ml),
        initial_water_drained_ml: optionalNum(body.initial_water_drained_ml),
        initial_assembled_mass_g: optionalNum(body.initial_assembled_mass_g),
        mass_basis: parseOptionalEnum(body.mass_basis, "mass_basis", MASS_BASES) ?? "unknown",
        sowing_date: optionalStr(body.sowing_date),
        sowing_status: parseOptionalEnum(body.sowing_status, "sowing_status", SOWING_STATUSES) ?? "pending",
        emergence_status: parseOptionalEnum(body.emergence_status, "emergence_status", EMERGENCE_STATUSES) ?? "not_sown",
        emergence_date: optionalStr(body.emergence_date),
        notes: optionalStr(body.notes),
        created_at: str(body.created_at, "created_at"),
        updated_at: optionalStr(body.updated_at),
      });
      return created(row, headers);
    }

    const allocationMatch = path.match(/^\/api\/day0\/pot-allocation\/([^/]+)$/);
    if (allocationMatch) {
      const id = decodeURIComponent(allocationMatch[1]);
      if (method === "GET") {
        return ok(await allocationService.getById(id), headers);
      }
      if (method === "PATCH") {
        const body = (await readJsonBody(request)) as Record<string, unknown>;
        return ok(await allocationService.update(id, body as never), headers);
      }
    }

    // -----------------------------------------------------------------------
    // Day 0 — methodology decisions
    // -----------------------------------------------------------------------
    if (method === "GET" && path === "/api/day0/methodology-decisions") {
      const page = paginationOr400(url, headers);
      if (page instanceof Response) return page;
      return paginatedList(
        env.DB,
        `SELECT * FROM day0_methodology_decisions ORDER BY created_at ASC, decision_id ASC`,
        page,
        headers
      );
    }
    if (method === "POST" && path === "/api/day0/methodology-decisions") {
      const body = (await readJsonBody(request)) as Record<string, unknown>;
      await day0Decisions.create({
        decision_id: str(body.decision_id, "decision_id"),
        title: str(body.title, "title"),
        description: str(body.description, "description"),
        protocol_reference: optionalStr(body.protocol_reference),
        status: parseEnum(body.status, "status", DECISION_STATUSES),
        decision: optionalStr(body.decision),
        decided_by: optionalStr(body.decided_by),
        decided_at: optionalStr(body.decided_at),
        blocks_sowing: body.blocks_sowing === true,
        blocks_emergence: body.blocks_emergence === true,
        blocks_measurements: body.blocks_measurements === true,
        notes: optionalStr(body.notes),
        created_at: str(body.created_at, "created_at"),
        updated_at: optionalStr(body.updated_at),
      });
      const createdRow = await day0Decisions.getById(String(body.decision_id));
      if (!createdRow) throw new Error("persistence.error");
      return created(createdRow, headers);
    }

    const decisionMatch = path.match(/^\/api\/day0\/methodology-decisions\/([^/]+)$/);
    if (decisionMatch) {
      const id = decodeURIComponent(decisionMatch[1]);
      if (method === "GET") {
        const row = await day0Decisions.getById(id);
        if (!row) return notFound("decision.not_found", "Decision not found");
        return ok(row, headers);
      }
      if (method === "PATCH") {
        const body = (await readJsonBody(request)) as Record<string, unknown>;
        const updated = await day0Decisions.update(id, body as never);
        if (!updated) return notFound("decision.not_found", "Decision not found");
        return ok(updated, headers);
      }
    }

    // -----------------------------------------------------------------------
    // Validation issues (append-only)
    // -----------------------------------------------------------------------
    if (method === "POST" && path === "/api/validation-issues") {
      const body = (await readJsonBody(request)) as Record<string, unknown>;
      const repo = new D1ValidationIssueRepository(env.DB);
      await repo.create({
        issue_id: str(body.issue_id, "issue_id"),
        issue_type: str(body.issue_type, "issue_type"),
        entity_type: str(body.entity_type, "entity_type"),
        entity_id: optionalStr(body.entity_id),
        description: str(body.description, "description"),
        severity: parseEnum(body.severity, "severity", SEVERITIES),
        created_at: str(body.created_at, "created_at"),
      });
      return created({ issue_id: String(body.issue_id) }, headers);
    }

    // No DELETE / PUT routes exist for any scientific record: append-only.
    if (method === "DELETE" || method === "PUT") {
      return notFound("route.not_found", `No ${method} route defined — experimental records are append-only`);
    }

    return notFound();
  }
}

// Re-exported for the Worker entry point and for tests.
export { apiErrorFromBody, noContent };
