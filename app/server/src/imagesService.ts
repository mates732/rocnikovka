import fs from "node:fs";
import path from "node:path";
import type { ImageRecord } from "./types.js";
import type { ImageRecordRepository } from "./repositories/interfaces.js";
import { isValidImageId } from "./imageUploadService.js";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

/** True when `candidate` resolves strictly inside `root` (never equal, never outside). */
function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export class ImagesService {
  constructor(
    private readonly images: ImageRecordRepository,
    /** Application-controlled RAW image storage root (from resolveDbConfig). */
    private readonly imagesDir: string
  ) {}

  listImages(): ImageRecord[] {
    return this.images.list();
  }

  getImageById(imageId: string): ImageRecord | null {
    return this.images.getById(imageId) ?? null;
  }

  /**
   * Resolves a persisted ImageRecord to its stored RAW bytes for the minimal
   * verification route (image_id -> ImageRecord -> stored file, never
   * client-input -> filesystem path).
   *
   * Security invariants:
   * - only well-formed IMG-YYYYMMDD-HHMMSS-XXX ids are accepted
   * - the path comes exclusively from the persisted record
   * - the resolved path must lie strictly inside the configured storage root
   * - unknown ids, malformed records, missing files and out-of-root records
   *   all yield null (the caller responds 404) — nothing is ever leaked
   */
  getImageFile(imageId: string): { content: Buffer; contentType: string } | null {
    if (!isValidImageId(imageId)) return null;

    const record = this.images.getById(imageId);
    if (!record) return null;

    const resolved = path.resolve(record.image_path);
    if (!isWithin(this.imagesDir, resolved)) return null;

    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return null;

    const contentType = CONTENT_TYPES[path.extname(resolved).toLowerCase()] ?? "application/octet-stream";
    return { content: fs.readFileSync(resolved), contentType };
  }
}