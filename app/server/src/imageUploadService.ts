import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import type { ImageRecord } from "./types.js";
import { validateImageRecord } from "./validation/schema.js";
import { SqliteImageRecordRepository, SqlitePlantRepository } from "./repositories/sqliteRepositories.js";
import { RepositoryError } from "./repositories/base.js";
import type { ImageRecordRepository, PlantRepository } from "./repositories/interfaces.js";

/**
 * Phase 4I — controlled RAW image ingestion.
 *
 * Invariants:
 * - stored RAW image files are immutable: no UPDATE, no DELETE, no overwrite
 * - the storage path is always application-controlled (never client-provided)
 * - a DB row is only created after the file is safely in place
 * - any failure cleans up every file this service created
 */

export class ImageUploadError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ImageUploadError";
    this.code = code;
    this.status = status;
  }
}

/** Conservative implementation-level cap for research side-view photographs. */
export const MAX_IMAGE_UPLOAD_BYTES = 15 * 1024 * 1024;

/**
 * Declared multipart content-types we accept. application/octet-stream is
 * accepted because many upload clients send it for binary files; the file
 * signature is always authoritative.
 */
const ALLOWED_DECLARED_TYPES = new Set(["image/jpeg", "image/png", "application/octet-stream"]);

const IMAGE_ID_RE = /^IMG-\d{8}-\d{6}-\d{3}$/;

/** Placeholder that satisfies the shared ImageRecord validator until the final ID is resolved. */
const PLACEHOLDER_IMAGE_ID = "IMG-00000000-000000-000";

export type DetectedImageType = "jpeg" | "png";

function detectImageType(content: Buffer): DetectedImageType | null {
  if (content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff) {
    return "jpeg";
  }
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (content.length >= pngSignature.length && content.subarray(0, 8).equals(pngSignature)) {
    return "png";
  }
  return null;
}

const EXTENSION: Record<DetectedImageType, string> = {
  jpeg: ".jpg",
  png: ".png",
};

export type ImageUploadMetadata = {
  /** Optional stable image_id (IMG-YYYYMMDD-HHMMSS-XXX); generated when omitted. */
  image_id?: string;
  plant_id?: string;
  timestamp?: string;
  experiment_day?: string;
  camera_id?: string;
  image_quality_status?: string;
  calibration_status?: string;
  cal_ref_id?: string;
  failure_code?: string;
  notes?: string;
};

export type ImageUploadInput = {
  content: Buffer;
  declaredContentType?: string;
  /** Used only for diagnostics; never for storage naming. */
  originalFilename?: string;
  metadata: ImageUploadMetadata;
};

function cleanOptional(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "NA") return undefined;
  return trimmed;
}

export class ImageUploadService {
  private readonly images: ImageRecordRepository;
  private readonly plants: PlantRepository;

  constructor(
    private readonly db: Database.Database,
    private readonly imagesDir: string
  ) {
    this.images = new SqliteImageRecordRepository(db);
    this.plants = new SqlitePlantRepository(db);
  }

  upload(input: ImageUploadInput): ImageRecord {
    const { content, metadata } = input;
    const fileLabel = input.originalFilename ? path.basename(input.originalFilename) : "upload";

    // 1) Size limit first — before any parsing/processing of the payload.
    if (content.length > MAX_IMAGE_UPLOAD_BYTES) {
      throw new ImageUploadError(
        `Image exceeds the maximum allowed size of ${Math.floor(MAX_IMAGE_UPLOAD_BYTES / (1024 * 1024))} MB`,
        "image.too_large",
        413
      );
    }

    // 2) Declared MIME type allowlist.
    const declared = cleanOptional(input.declaredContentType ?? undefined)?.toLowerCase();
    if (declared !== undefined && !ALLOWED_DECLARED_TYPES.has(declared)) {
      throw new ImageUploadError(
        `Unsupported content type '${declared}'; only image/jpeg and image/png are accepted`,
        "image.invalid_type",
        400
      );
    }

    // 3) File signature / magic bytes (authoritative; never trust the extension).
    const detected = detectImageType(content);
    if (detected === null) {
      throw new ImageUploadError(
        `File '${fileLabel}' is not a recognized JPEG or PNG image (signature check failed)`,
        "image.invalid_signature",
        400
      );
    }

    // 4) Metadata validation — reuse existing ImageRecord validators.
    const record = this.buildImageRecord(metadata);

    // 5) Plant FK traceability plant_id -> image_id -> file.
    if (!this.plants.getById(record.plant_id)) {
      throw new ImageUploadError(
        `plant_id '${record.plant_id}' does not exist in plants`,
        "image.plant_not_found",
        400
      );
    }

    // 6) image_id: client-supplied stable ID when provided (validated),
    //    otherwise deterministic application-controlled generation.
    const imageId =
      record.image_id !== PLACEHOLDER_IMAGE_ID ? record.image_id : this.resolveImageId(record.timestamp);
    const extension = EXTENSION[detected];
    const finalPath = path.join(this.imagesDir, `${imageId}${extension}`);

    // 7) Immutability: never overwrite an existing record or existing file.
    if (this.images.getById(imageId)) {
      throw new ImageUploadError(
        `image_id '${imageId}' already exists; RAW images are immutable and cannot be overwritten`,
        "image.duplicate",
        409
      );
    }
    if (fs.existsSync(finalPath)) {
      throw new ImageUploadError(
        `Storage target for image_id '${imageId}' already exists; refusing to overwrite`,
        "image.duplicate",
        409
      );
    }

    // 8) Write to a temporary controlled location first.
    this.ensureImagesDir();
    const tempPath = path.join(this.imagesDir, `.${imageId}${extension}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    let tempWritten = false;
    let finalPromoted = false;
    try {
      const fd = fs.openSync(tempPath, "wx");
      try {
        fs.writeSync(fd, content);
      } finally {
        fs.closeSync(fd);
      }
      tempWritten = true;

      // Verify the write before promotion.
      const written = fs.statSync(tempPath);
      if (written.size !== content.length) {
        throw new ImageUploadError("Image write verification failed", "image.storage_error", 500);
      }

      // 9) Promote to the final immutable RAW path (never overwrite).
      try {
        fs.renameSync(tempPath, finalPath);
      } catch (error) {
        if (fs.existsSync(finalPath)) {
          throw new ImageUploadError(
            `Storage target for image_id '${imageId}' already exists; refusing to overwrite`,
            "image.duplicate",
            409
          );
        }
        throw error;
      }
      tempWritten = false;
      finalPromoted = true;

      // 10) Create the ImageRecord only after the RAW file is safely in place.
      const imageRecord: ImageRecord = { ...record, image_id: imageId, image_path: finalPath };
      try {
        this.images.create(imageRecord);
      } catch (error) {
        if (error instanceof RepositoryError && error.code === "id.duplicate") {
          throw new ImageUploadError(
            `image_id '${imageId}' already exists; RAW images are immutable and cannot be overwritten`,
            "image.duplicate",
            409
          );
        }
        if (error instanceof RepositoryError && error.code === "reference.missing_parent") {
          throw new ImageUploadError(
            `plant_id '${record.plant_id}' does not exist in plants`,
            "image.plant_not_found",
            400
          );
        }
        throw new ImageUploadError(
          "Image record could not be created; no changes were made",
          "image.db_error",
          500
        );
      }

      const created = this.images.getById(imageId);
      if (!created) {
        throw new ImageUploadError("Persisted image record not found", "image.db_error", 500);
      }
      return created;
    } catch (error) {
      // 11) Cleanup: never leave orphaned files behind after a rejected upload.
      if (tempWritten) {
        try {
          fs.unlinkSync(tempPath);
        } catch {
          // best-effort cleanup
        }
      }
      if (finalPromoted) {
        try {
          fs.unlinkSync(finalPath);
        } catch {
          // best-effort cleanup
        }
      }
      if (error instanceof ImageUploadError) throw error;
      throw new ImageUploadError(
        "Image could not be stored; no changes were made",
        "image.storage_error",
        500
      );
    }
  }

  private ensureImagesDir(): void {
    try {
      fs.mkdirSync(this.imagesDir, { recursive: true });
    } catch {
      throw new ImageUploadError("Image storage directory is not available", "image.storage_error", 500);
    }
  }

  private buildImageRecord(metadata: ImageUploadMetadata): ImageRecord {
    const plantId = cleanOptional(metadata.plant_id);
    const timestamp = cleanOptional(metadata.timestamp);
    const cameraId = cleanOptional(metadata.camera_id);
    const quality = cleanOptional(metadata.image_quality_status);
    const calibration = cleanOptional(metadata.calibration_status);

    const suppliedImageId = cleanOptional(metadata.image_id);
    // image_id and image_path are resolved by the service; placeholders keep
    // the shared ImageRecord validator fully exercised on client-supplied fields.
    const candidate: ImageRecord = {
      image_id: suppliedImageId ?? PLACEHOLDER_IMAGE_ID,
      plant_id: plantId ?? "",
      timestamp: timestamp ?? "",
      experiment_day: this.parseExperimentDay(metadata.experiment_day),
      image_path: "placeholder",
      camera_id: cameraId ?? "",
      image_quality_status: (quality ?? "") as ImageRecord["image_quality_status"],
      calibration_status: (calibration ?? "") as ImageRecord["calibration_status"],
      cal_ref_id: cleanOptional(metadata.cal_ref_id),
      failure_code: cleanOptional(metadata.failure_code) as ImageRecord["failure_code"],
      notes: cleanOptional(metadata.notes),
    };

    const validation = validateImageRecord(candidate);
    if (!validation.valid) {
      const detail = validation.issues.map((issue) => `${issue.field}: ${issue.message}`).join("; ");
      throw new ImageUploadError(detail || "Invalid image metadata", "image.validation_failed", 400);
    }
    return candidate;
  }

  private parseExperimentDay(raw: string | undefined): number {
    const trimmed = raw?.trim();
    if (trimmed === undefined || trimmed === "") return NaN;
    return /^[0-9]+$/.test(trimmed) ? Number(trimmed) : NaN;
  }

  /**
   * Deterministic generation consistent with the existing convention
   * IMG-YYYYMMDD-HHMMSS-XXX (timestamp of capture; XXX = per-second ordinal).
   */
  private resolveImageId(timestamp: string): string {
    const compact = timestamp.replace(/[-:T]/g, "").replace(/Z$/, "");
    const prefix = `IMG-${compact.slice(0, 8)}-${compact.slice(8, 14)}-`;
    const pattern = `${prefix}%`;
    const existing = (this.db.prepare("SELECT image_id FROM image_records WHERE image_id LIKE ?").all(pattern) as {
      image_id: string;
    }[]).map((row) => row.image_id);

    for (let suffix = 0; suffix <= 999; suffix++) {
      const candidate = `${prefix}${String(suffix).padStart(3, "0")}`;
      if (!existing.includes(candidate)) return candidate;
    }
    throw new ImageUploadError(
      `No free image_id available for timestamp '${timestamp}' (more than 1000 images in one second)`,
      "image.id_exhausted",
      409
    );
  }
}

export function isValidImageId(imageId: string): boolean {
  return IMAGE_ID_RE.test(imageId);
}
