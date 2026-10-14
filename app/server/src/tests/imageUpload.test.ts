// Phase 4I — controlled image ingestion tests.
//
// All fixtures (including image bytes) are synthetic and live only inside
// temporary directories and temporary SQLite databases. The production DB and
// the production image storage directory are never touched (see test Z).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { createDb, migrate, resolveDbConfig } from "../db.js";
import { buildApp, createAppContext } from "../index.js";
import { MAX_IMAGE_UPLOAD_BYTES } from "../imageUploadService.js";
import { SqliteImageRecordRepository, SqlitePlantRepository } from "../repositories/sqliteRepositories.js";
import type { ImageRecord, Plant } from "../types.js";

function basePlant(overrides: Partial<Plant> = {}): Plant {
  return {
    plant_id: "PLT-001",
    pot_id: "POT-001",
    group_name: "G1",
    emergence_date: "2026-02-01",
    status: "active",
    notes: "baseline",
    created_at: "2026-02-01T08:00:00",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Synthetic image fixtures (magic-byte-valid, clearly not real photographs)
// ---------------------------------------------------------------------------

function jpegBytes(length = 512): Buffer {
  const bytes = Buffer.alloc(length, 0x5a);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  bytes[3] = 0xe0;
  return bytes;
}

function pngBytes(length = 512): Buffer {
  const bytes = Buffer.alloc(length, 0x5a);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).forEach((b, i) => {
    bytes[i] = b;
  });
  return bytes;
}

function textBytes(): Buffer {
  return Buffer.from("this is definitely not a JPEG or PNG image", "utf8");
}

// ---------------------------------------------------------------------------
// Multipart helper (binary-safe)
// ---------------------------------------------------------------------------

function buildMultipart(
  fields: Record<string, string>,
  file?: { filename?: string; contentType?: string; content: Buffer }
): { body: Buffer; contentType: string } {
  const boundary = `----plantAiImage${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const chunks: Buffer[] = [];

  const push = (text: string) => chunks.push(Buffer.from(text, "utf8"));

  for (const [name, value] of Object.entries(fields)) {
    push(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);
  }
  if (file) {
    push(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.filename ?? "image.bin"}"\r\n`
    );
    if (file.contentType) push(`Content-Type: ${file.contentType}\r\n`);
    push("\r\n");
    chunks.push(file.content);
    push("\r\n");
  }
  push(`--${boundary}--\r\n`);

  return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

type UploadResponse = { status: number; body: any };

async function postUpload(
  baseUrl: string,
  fields: Record<string, string>,
  file?: { filename?: string; contentType?: string; content: Buffer }
): Promise<UploadResponse> {
  const { body, contentType } = buildMultipart(fields, file);
  const res = await fetch(`${baseUrl}/api/images/upload`, {
    method: "POST",
    headers: { "content-type": contentType },
    body: body as unknown as BodyInit,
  });
  const json = (await res.json()) as any;
  return { status: res.status, body: json };
}

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

async function withTestDb<T>(run: (args: { storageDir: string; filename: string }) => T | Promise<T>): Promise<T> {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "plant-ai-image-upload-"));
  const storageDir = path.join(tempRoot, "storage");
  const filename = "test.sqlite";
  fs.mkdirSync(storageDir, { recursive: true });

  try {
    return await run({ storageDir, filename });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function withStartedServer<T>(
  dbConfig: { storageDir: string; filename: string },
  run: (baseUrl: string, db: Database.Database) => Promise<T>
): Promise<T> {
  const context = createAppContext(dbConfig);
  const { server, db } = buildApp(context);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    return await run(baseUrl, db);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  }
}

function imagesDirOf(dbConfig: { storageDir: string; filename: string }): string {
  return resolveDbConfig(dbConfig).imagesDir;
}

function listStoredFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => !name.startsWith("."));
}

function seedPlant(db: Database.Database, plantId = "PLT-001", potId = "POT-001"): void {
  new SqlitePlantRepository(db).create(basePlant({ plant_id: plantId, pot_id: potId }));
}

function countImages(db: Database.Database): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM image_records").get() as { n: number }).n;
}

function defaultFields(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    plant_id: "PLT-001",
    timestamp: "2026-02-01T08:00:00",
    experiment_day: "1",
    camera_id: "CAM-01",
    image_quality_status: "PASS",
    calibration_status: "pass",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// A) valid JPEG upload
// ---------------------------------------------------------------------------

test("A) valid JPEG upload returns 201 with generated image_id", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const content = jpegBytes();
      const { status, body } = await postUpload(baseUrl, defaultFields(), {
        filename: "photo.jpg",
        contentType: "image/jpeg",
        content,
      });

      assert.equal(status, 201);
      assert.match(body.data.image_id, /^IMG-20260201-080000-000$/);
      assert.equal(body.data.plant_id, "PLT-001");
      assert.equal(body.data.experiment_day, 1);
      assert.equal(body.data.camera_id, "CAM-01");
      assert.equal(body.data.image_quality_status, "PASS");
      assert.equal(body.data.calibration_status, "pass");
      assert.ok(body.data.image_path.endsWith(`${body.data.image_id}.jpg`));
      assert.equal(body.data.cal_ref_id, null);
      assert.equal(body.data.failure_code, null);
      assert.equal(body.data.notes, null);
    })
  );
});

// ---------------------------------------------------------------------------
// B) valid PNG upload
// ---------------------------------------------------------------------------

test("B) valid PNG upload returns 201 and stores a .png file", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const content = pngBytes();
      const { status, body } = await postUpload(baseUrl, defaultFields(), {
        filename: "photo.png",
        contentType: "image/png",
        content,
      });

      assert.equal(status, 201);
      assert.match(body.data.image_id, /^IMG-20260201-080000-000$/);
      assert.ok(body.data.image_path.endsWith(`${body.data.image_id}.png`));
      const fileBytes = fs.readFileSync(body.data.image_path);
      assert.ok(fileBytes.equals(content), "stored bytes must match the upload");
    })
  );
});

// ---------------------------------------------------------------------------
// C) missing file
// ---------------------------------------------------------------------------

test("C) missing file rejected", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postUpload(baseUrl, defaultFields());
      assert.equal(status, 400);
      assert.equal(body.error.code, "image.missing_file");
      assert.equal(countImages(db), 0);
    })
  );
});

// ---------------------------------------------------------------------------
// D) unsupported MIME/type
// ---------------------------------------------------------------------------

test("D) unsupported declared MIME type rejected", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postUpload(baseUrl, defaultFields(), {
        filename: "photo.gif",
        contentType: "image/gif",
        content: jpegBytes(),
      });
      assert.equal(status, 400);
      assert.equal(body.error.code, "image.invalid_type");
      assert.match(body.error.message, /image\/gif/);
      assert.equal(countImages(db), 0);
      assert.deepEqual(listStoredFiles(imagesDirOf({ storageDir, filename })), []);
    })
  );
});

// ---------------------------------------------------------------------------
// E) invalid image signature
// ---------------------------------------------------------------------------

test("E) invalid file signature rejected", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postUpload(baseUrl, defaultFields(), {
        filename: "fake.jpg",
        contentType: "image/jpeg",
        content: textBytes(),
      });
      assert.equal(status, 400);
      assert.equal(body.error.code, "image.invalid_signature");
      assert.equal(countImages(db), 0);
      assert.deepEqual(listStoredFiles(imagesDirOf({ storageDir, filename })), []);
    })
  );
});

// ---------------------------------------------------------------------------
// F) oversized upload
// ---------------------------------------------------------------------------

test("F) oversized upload rejected with 413", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const oversized = Buffer.alloc(MAX_IMAGE_UPLOAD_BYTES + 1, 0x5a);
      oversized[0] = 0xff;
      oversized[1] = 0xd8;
      oversized[2] = 0xff;
      const { status, body } = await postUpload(baseUrl, defaultFields(), {
        filename: "huge.jpg",
        contentType: "image/jpeg",
        content: oversized,
      });
      assert.equal(status, 413);
      assert.equal(body.error.code, "image.too_large");
      assert.equal(countImages(db), 0);
      assert.deepEqual(listStoredFiles(imagesDirOf({ storageDir, filename })), []);
    })
  );
});

// ---------------------------------------------------------------------------
// G) missing plant
// ---------------------------------------------------------------------------

test("G) missing plant rejected without orphaned file", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      const { status, body } = await postUpload(baseUrl, defaultFields({ plant_id: "PLT-999" }), {
        filename: "x.jpg",
        contentType: "image/jpeg",
        content: jpegBytes(),
      });
      assert.equal(status, 400);
      assert.equal(body.error.code, "image.plant_not_found");
      assert.equal(countImages(db), 0);
      assert.deepEqual(listStoredFiles(imagesDirOf({ storageDir, filename })), []);
    })
  );
});

// ---------------------------------------------------------------------------
// H) invalid metadata
// ---------------------------------------------------------------------------

test("H) invalid metadata (missing required field) rejected", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postUpload(
        baseUrl,
        defaultFields({ camera_id: "" }),
        { filename: "x.jpg", contentType: "image/jpeg", content: jpegBytes() }
      );
      assert.equal(status, 400);
      assert.equal(body.error.code, "image.validation_failed");
      assert.match(body.error.message, /camera_id/);
      assert.equal(countImages(db), 0);
      assert.deepEqual(listStoredFiles(imagesDirOf({ storageDir, filename })), []);
    })
  );
});

// ---------------------------------------------------------------------------
// I) invalid experiment_day
// ---------------------------------------------------------------------------

test("I) invalid experiment_day rejected", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postUpload(baseUrl, defaultFields({ experiment_day: "abc" }), {
        filename: "x.jpg",
        contentType: "image/jpeg",
        content: jpegBytes(),
      });
      assert.equal(status, 400);
      assert.equal(body.error.code, "image.validation_failed");
      assert.match(body.error.message, /experiment_day/);
      assert.equal(countImages(db), 0);
    })
  );
});

// ---------------------------------------------------------------------------
// J) invalid timestamp
// ---------------------------------------------------------------------------

test("J) invalid timestamp rejected", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postUpload(baseUrl, defaultFields({ timestamp: "not-a-date" }), {
        filename: "x.jpg",
        contentType: "image/jpeg",
        content: jpegBytes(),
      });
      assert.equal(status, 400);
      assert.equal(body.error.code, "image.validation_failed");
      assert.match(body.error.message, /timestamp/);
      assert.equal(countImages(db), 0);
    })
  );
});

// ---------------------------------------------------------------------------
// K) invalid image quality status
// ---------------------------------------------------------------------------

test("K) invalid image_quality_status rejected", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postUpload(baseUrl, defaultFields({ image_quality_status: "ok" }), {
        filename: "x.jpg",
        contentType: "image/jpeg",
        content: jpegBytes(),
      });
      assert.equal(status, 400);
      assert.equal(body.error.code, "image.validation_failed");
      assert.match(body.error.message, /image_quality_status/);
      assert.match(body.error.message, /PASS/);
      assert.equal(countImages(db), 0);
    })
  );
});

// ---------------------------------------------------------------------------
// L) invalid calibration status
// ---------------------------------------------------------------------------

test("L) invalid calibration_status rejected", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postUpload(baseUrl, defaultFields({ calibration_status: "perfect" }), {
        filename: "x.jpg",
        contentType: "image/jpeg",
        content: jpegBytes(),
      });
      assert.equal(status, 400);
      assert.equal(body.error.code, "image.validation_failed");
      assert.match(body.error.message, /calibration_status/);
      assert.equal(countImages(db), 0);
    })
  );
});

// ---------------------------------------------------------------------------
// M) optional fields
// ---------------------------------------------------------------------------

test("M) optional fields are accepted and persisted", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postUpload(
        baseUrl,
        defaultFields({
          cal_ref_id: "CAL-20260201-001",
          failure_code: "poor_image_quality",
          notes: "slight blur at top edge",
        }),
        { filename: "x.jpg", contentType: "image/jpeg", content: jpegBytes() }
      );
      assert.equal(status, 201);
      assert.equal(body.data.cal_ref_id, "CAL-20260201-001");
      assert.equal(body.data.failure_code, "poor_image_quality");
      assert.equal(body.data.notes, "slight blur at top edge");
    })
  );
});

// ---------------------------------------------------------------------------
// N) successful ImageRecord creation (DB row)
// ---------------------------------------------------------------------------

test("N) successful upload creates exactly one matching DB row", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const content = jpegBytes();
      const { status, body } = await postUpload(baseUrl, defaultFields(), {
        filename: "x.jpg",
        contentType: "image/jpeg",
        content,
      });
      assert.equal(status, 201);
      assert.equal(countImages(db), 1);

      const stored = db
        .prepare("SELECT * FROM image_records WHERE image_id = ?")
        .get(body.data.image_id) as ImageRecord;
      assert.ok(stored);
      assert.equal(stored.image_id, body.data.image_id);
      assert.equal(stored.plant_id, "PLT-001");
      assert.equal(stored.timestamp, "2026-02-01T08:00:00");
      assert.equal(stored.experiment_day, 1);
      assert.equal(stored.camera_id, "CAM-01");
      assert.equal(stored.image_quality_status, "PASS");
      assert.equal(stored.calibration_status, "pass");
      assert.equal(stored.image_path, body.data.image_path);
      assert.equal(stored.cal_ref_id, null);
    })
  );
});

// ---------------------------------------------------------------------------
// O) stored RAW file exists
// ---------------------------------------------------------------------------

test("O) stored RAW file exists with exact uploaded bytes", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const content = jpegBytes(2048);
      const { status, body } = await postUpload(baseUrl, defaultFields(), {
        filename: "x.jpg",
        contentType: "image/jpeg",
        content,
      });
      assert.equal(status, 201);
      const target = imagesDirOf({ storageDir, filename });
      assert.equal(listStoredFiles(target).length, 1);
      assert.ok(fs.existsSync(body.data.image_path), "RAW file must exist on disk");
      assert.ok(fs.readFileSync(body.data.image_path).equals(content), "RAW file bytes must be identical");
      assert.equal(fs.statSync(body.data.image_path).size, content.length);
    })
  );
});

// ---------------------------------------------------------------------------
// P) returned ImageRecord matches DB
// ---------------------------------------------------------------------------

test("P) returned ImageRecord equals the persisted row", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postUpload(
        baseUrl,
        defaultFields({ notes: "match check", cal_ref_id: "CAL-X" }),
        { filename: "x.jpg", contentType: "image/jpeg", content: jpegBytes() }
      );
      assert.equal(status, 201);
      const stored = new SqliteImageRecordRepository(db).getById(body.data.image_id);
      assert.ok(stored);
      assert.deepEqual({ ...stored }, { ...body.data }, "returned record must equal DB row");
    })
  );
});

// ---------------------------------------------------------------------------
// Q) GET /api/images sees newly ingested image
// ---------------------------------------------------------------------------

test("Q) GET /api/images lists newly ingested image", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status } = await postUpload(baseUrl, defaultFields(), {
        filename: "x.jpg",
        contentType: "image/jpeg",
        content: jpegBytes(),
      });
      assert.equal(status, 201);

      const res = await fetch(`${baseUrl}/api/images`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: ImageRecord[] };
      assert.equal(body.data.length, 1);
      assert.match(body.data[0].image_id, /^IMG-20260201-080000-000$/);
    })
  );
});

// ---------------------------------------------------------------------------
// R) GET /api/images/:imageId sees newly ingested image
// ---------------------------------------------------------------------------

test("R) GET /api/images/:imageId returns newly ingested image", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postUpload(baseUrl, defaultFields(), {
        filename: "x.jpg",
        contentType: "image/jpeg",
        content: jpegBytes(),
      });
      assert.equal(status, 201);

      const res = await fetch(`${baseUrl}/api/images/${body.data.image_id}`);
      assert.equal(res.status, 200);
      const detail = (await res.json()) as { data: ImageRecord };
      assert.equal(detail.data.image_id, body.data.image_id);
      assert.equal(detail.data.image_path, body.data.image_path);
    })
  );
});

// ---------------------------------------------------------------------------
// S) no arbitrary filesystem path accepted
// ---------------------------------------------------------------------------

test("S) client-supplied paths are never used for storage", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      // Attempt to smuggle a path through metadata and the filename.
      const { status, body } = await postUpload(
        baseUrl,
        { ...defaultFields(), image_path: "../../etc/cron.d/evil" },
        { filename: "../../../tmp/sneaky.jpg", contentType: "image/jpeg", content: jpegBytes() }
      );
      assert.equal(status, 201);
      const stored = db
        .prepare("SELECT image_path FROM image_records WHERE image_id = ?")
        .get(body.data.image_id) as { image_path: string };
      const target = imagesDirOf({ storageDir, filename });
      assert.equal(stored.image_path, path.join(target, `${body.data.image_id}.jpg`));
      assert.ok(stored.image_path.startsWith(target), "stored path must be inside the app-controlled dir");
      assert.ok(!stored.image_path.includes("etc"), "client path must never be used");
    })
  );
});

// ---------------------------------------------------------------------------
// T) path traversal rejected
// ---------------------------------------------------------------------------

test("T) path traversal in filename cannot escape storage", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const escapeTarget = path.join(os.tmpdir(), "plant-ai-4i-escape-probe.jpg");
      try {
        fs.rmSync(escapeTarget, { force: true });
        const { status, body } = await postUpload(baseUrl, defaultFields(), {
          filename: `../../../../../../../../${escapeTarget}`,
          contentType: "image/jpeg",
          content: jpegBytes(),
        });
        assert.equal(status, 201);
        assert.equal(fs.existsSync(escapeTarget), false, "file must not be written outside storage");
        const target = imagesDirOf({ storageDir, filename });
        const files = listStoredFiles(target);
        assert.equal(files.length, 1);
        assert.equal(files[0], `${body.data.image_id}.jpg`);
      } finally {
        fs.rmSync(escapeTarget, { force: true });
      }
    })
  );
});

// ---------------------------------------------------------------------------
// U) duplicate/conflicting image_id cannot overwrite
// ---------------------------------------------------------------------------

test("U) duplicate/conflicting image_id can never overwrite the original", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const original = jpegBytes(1024);
      const fields = { ...defaultFields(), image_id: "IMG-20260201-080000-777" };
      const first = await postUpload(baseUrl, fields, {
        filename: "x.jpg",
        contentType: "image/jpeg",
        content: original,
      });
      assert.equal(first.status, 201);
      assert.equal(first.body.data.image_id, "IMG-20260201-080000-777");
      const firstPath = first.body.data.image_path;

      // Identical content submitted again with the same image_id -> must NOT overwrite.
      const identical = await postUpload(baseUrl, fields, {
        filename: "x.jpg",
        contentType: "image/jpeg",
        content: original,
      });
      assert.equal(identical.status, 409);
      assert.equal(identical.body.error.code, "image.duplicate");

      // Conflicting content with the same image_id -> must fail safely.
      const conflicting = await postUpload(baseUrl, fields, {
        filename: "x.jpg",
        contentType: "image/jpeg",
        content: jpegBytes(2048),
      });
      assert.equal(conflicting.status, 409);
      assert.equal(conflicting.body.error.code, "image.duplicate");

      assert.equal(countImages(db), 1, "only the original record may exist");
      assert.ok(fs.readFileSync(firstPath).equals(original), "original RAW file must be untouched");
      assert.equal(listStoredFiles(imagesDirOf({ storageDir, filename })).length, 1);
    })
  );
});

test("U2) invalid client-supplied image_id format rejected", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postUpload(
        baseUrl,
        defaultFields({ image_id: "../../etc/passwd" }),
        { filename: "x.jpg", contentType: "image/jpeg", content: jpegBytes() }
      );
      assert.equal(status, 400);
      assert.equal(body.error.code, "image.validation_failed");
      assert.match(body.error.message, /image_id/);
      assert.equal(countImages(db), 0);
      assert.deepEqual(listStoredFiles(imagesDirOf({ storageDir, filename })), []);
    })
  );
});

test("U3) pre-existing file at the target path is never overwritten", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const target = imagesDirOf({ storageDir, filename });
      fs.mkdirSync(target, { recursive: true });
      const occupied = path.join(target, "IMG-20260201-080000-778.jpg");
      fs.writeFileSync(occupied, "pre-existing bytes that must survive", "utf8");

      const { status, body } = await postUpload(
        baseUrl,
        defaultFields({ image_id: "IMG-20260201-080000-778" }),
        { filename: "x.jpg", contentType: "image/jpeg", content: jpegBytes() }
      );
      assert.equal(status, 409);
      assert.equal(body.error.code, "image.duplicate");
      assert.equal(
        fs.readFileSync(occupied, "utf8"),
        "pre-existing bytes that must survive",
        "pre-existing file must be untouched"
      );
      assert.equal(countImages(db), 0, "no DB row may be created for a storage collision");
    })
  );
});

// ---------------------------------------------------------------------------
// V) DB insertion failure does not leave an orphan file
// ---------------------------------------------------------------------------

test("V) DB insertion failure cleans up the promoted file", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db, "PLT-001", "POT-001");
      seedPlant(db, "PLT-002", "POT-002");

      const first = await postUpload(baseUrl, defaultFields(), {
        filename: "x.jpg",
        contentType: "image/jpeg",
        content: jpegBytes(),
      });
      assert.equal(first.status, 201);

      // Force the second INSERT to fail at the DB level (after the RAW file
      // has already been promoted) so the cleanup path is exercised.
      db.exec(`
        CREATE TRIGGER trg_4i_deny_insert BEFORE INSERT ON image_records
        BEGIN SELECT RAISE(ABORT, 'injected insert failure'); END;
      `);
      try {
        const second = await postUpload(
          baseUrl,
          defaultFields({ plant_id: "PLT-002", timestamp: "2026-02-02T08:00:00", image_id: "IMG-20260202-080000-556" }),
          { filename: "y.jpg", contentType: "image/jpeg", content: jpegBytes() }
        );
        assert.equal(second.status, 500);
        assert.equal(second.body.error.code, "image.db_error");
        assert.equal(countImages(db), 1, "no new DB row may exist");
        const files = listStoredFiles(imagesDirOf({ storageDir, filename }));
        assert.deepEqual(files, [`${first.body.data.image_id}.jpg`], "failed upload must leave no orphan file");
      } finally {
        db.exec("DROP TRIGGER trg_4i_deny_insert;");
      }
    })
  );
});

// ---------------------------------------------------------------------------
// W) filesystem failure does not create a DB row
// ---------------------------------------------------------------------------

test("W) filesystem failure leaves no DB row and no partial file", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    // Block the images directory by creating a regular file in its place.
    fs.writeFileSync(path.join(storageDir, "images"), "blocked", "utf8");
    await withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postUpload(baseUrl, defaultFields(), {
        filename: "x.jpg",
        contentType: "image/jpeg",
        content: jpegBytes(),
      });
      assert.equal(status, 500);
      assert.equal(body.error.code, "image.storage_error");
      assert.equal(countImages(db), 0, "no DB row may exist when storage fails");
      assert.equal(
        fs.readFileSync(path.join(storageDir, "images"), "utf8"),
        "blocked",
        "blocking file must remain untouched"
      );
    });
  });
});

// ---------------------------------------------------------------------------
// X) no UPDATE behavior
// ---------------------------------------------------------------------------

test("X) ingestion performs no UPDATE statements", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const first = await postUpload(baseUrl, defaultFields(), {
        filename: "x.jpg",
        contentType: "image/jpeg",
        content: jpegBytes(),
      });
      assert.equal(first.status, 201);

      db.exec(`
        CREATE TRIGGER trg_4i_no_update BEFORE UPDATE ON image_records
        BEGIN SELECT RAISE(ABORT, 'image UPDATE attempted'); END;
        CREATE TRIGGER trg_4i_no_delete BEFORE DELETE ON image_records
        BEGIN SELECT RAISE(ABORT, 'image DELETE attempted'); END;
      `);

      const second = await postUpload(baseUrl, defaultFields({ timestamp: "2026-02-02T08:00:00" }), {
        filename: "y.jpg",
        contentType: "image/jpeg",
        content: jpegBytes(),
      });
      assert.equal(second.status, 201, "new upload must succeed using INSERT only");
      assert.equal(countImages(db), 2);

      const original = db
        .prepare("SELECT * FROM image_records WHERE image_id = ?")
        .get(first.body.data.image_id) as ImageRecord;
      assert.equal(original.image_path, first.body.data.image_path, "first record must not be modified");
    })
  );
});

// ---------------------------------------------------------------------------
// Y) no DELETE behavior
// ---------------------------------------------------------------------------

test("Y) no image DELETE or UPDATE endpoints exist", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postUpload(baseUrl, defaultFields(), {
        filename: "x.jpg",
        contentType: "image/jpeg",
        content: jpegBytes(),
      });
      assert.equal(status, 201);
      assert.ok(fs.existsSync(body.data.image_path));

      for (const method of ["DELETE", "PATCH", "PUT"]) {
        const res = await fetch(`${baseUrl}/api/images/${body.data.image_id}`, { method });
        assert.equal(res.status, 404, `${method} /api/images/:id must not exist`);
        const json = (await res.json()) as { error: { code: string } };
        assert.equal(json.error.code, "route.not_found");
      }

      assert.equal(countImages(db), 1);
      assert.ok(fs.existsSync(body.data.image_path), "RAW file must still exist after endpoint checks");
    })
  );
});

// ---------------------------------------------------------------------------
// Z) production DB + production image storage untouched by tests
// ---------------------------------------------------------------------------

test("Z) production database and production image storage remain untouched", async () => {
  const prodDbPath = path.resolve(process.cwd(), "server", "storage", "experiment.sqlite");
  const prodImagesDir = path.resolve(process.cwd(), "server", "storage", "images");
  const existedBefore = fs.existsSync(prodDbPath);
  const statBefore = existedBefore ? fs.statSync(prodDbPath) : null;

  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status } = await postUpload(baseUrl, defaultFields(), {
        filename: "x.jpg",
        contentType: "image/jpeg",
        content: jpegBytes(),
      });
      assert.equal(status, 201);
      assert.equal(countImages(db), 1);
    })
  );

  if (existedBefore) {
    const statAfter = fs.statSync(prodDbPath);
    assert.equal(statAfter.size, statBefore?.size, "production DB size must not change");
    assert.equal(statAfter.mtimeMs, statBefore?.mtimeMs, "production DB mtime must not change");
  }
  assert.equal(
    fs.existsSync(prodImagesDir),
    false,
    "production image storage directory must not be created by tests"
  );
});

// ---------------------------------------------------------------------------
// Extra: extension spoofing is ignored; signature is authoritative
// ---------------------------------------------------------------------------

test("AA) extension spoofing does not change storage type decision", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      // A .png filename containing JPEG bytes, declared image/png.
      const { status, body } = await postUpload(baseUrl, defaultFields(), {
        filename: "actually_jpeg.png",
        contentType: "image/png",
        content: jpegBytes(),
      });
      assert.equal(status, 201);
      assert.equal(body.data.image_path.endsWith(".png"), false, "extension must follow detected signature");
      assert.ok(body.data.image_path.endsWith(`${body.data.image_id}.jpg`));
    })
  );
});

test("AB) octet-stream declared type accepted when signature is valid", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedPlant(db);
      const { status, body } = await postUpload(baseUrl, defaultFields(), {
        filename: "raw.bin",
        contentType: "application/octet-stream",
        content: pngBytes(),
      });
      assert.equal(status, 201);
      assert.ok(body.data.image_path.endsWith(`${body.data.image_id}.png`));
    })
  );
});

// ---------------------------------------------------------------------------
// Extra: import of resolveDbConfig/createDb/migrate helpers keeps module covered
// ---------------------------------------------------------------------------

test("AC) storage resolution helper agrees with the DB location", () => {
  withTestDb(({ storageDir, filename }) => {
    const resolved = resolveDbConfig({ storageDir, filename });
    assert.equal(resolved.dbPath, path.join(storageDir, filename));
    assert.equal(resolved.imagesDir, path.join(storageDir, "images"));
    const db = createDb({ storageDir, filename });
    migrate(db);
    db.close();
  });
});
