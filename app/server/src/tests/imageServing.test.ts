// Phase 4K.8 — image verification route (GET /api/images/:imageId/file) tests.
//
// All fixtures live in temporary directories and temporary SQLite databases;
// the production DB and production image storage are never touched.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { buildApp, createAppContext } from "../index.js";
import { SqliteImageRecordRepository, SqlitePlantRepository } from "../repositories/sqliteRepositories.js";
import type { ImageRecord, Plant } from "../types.js";

function basePlant(overrides: Partial<Plant> = {}): Plant {
  return {
    plant_id: "PLT-001",
    pot_id: "POT-001",
    group_name: "G1",
    emergence_date: "2026-02-01",
    status: "active",
    created_at: "2026-02-01T08:00:00",
    ...overrides,
  };
}

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

function buildMultipart(
  fields: Record<string, string>,
  file?: { filename?: string; contentType?: string; content: Buffer }
): { body: Buffer; contentType: string } {
  const boundary = `----plantAiServing${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const chunks: Buffer[] = [];
  const push = (text: string) => chunks.push(Buffer.from(text, "utf8"));

  for (const [name, value] of Object.entries(fields)) {
    push(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);
  }
  if (file) {
    push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.filename ?? "image.bin"}"\r\n`);
    if (file.contentType) push(`Content-Type: ${file.contentType}\r\n`);
    push("\r\n");
    chunks.push(file.content);
    push("\r\n");
  }
  push(`--${boundary}--\r\n`);

  return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

async function uploadJpeg(
  baseUrl: string,
  fields: Record<string, string>,
  content = jpegBytes()
): Promise<{ status: number; imageId?: string; errorCode?: string }> {
  const { body, contentType } = buildMultipart(fields, {
    filename: "photo.jpg",
    contentType: "image/jpeg",
    content,
  });
  const res = await fetch(`${baseUrl}/api/images/upload`, {
    method: "POST",
    headers: { "content-type": contentType },
    body: body as unknown as BodyInit,
  });
  const json = (await res.json()) as any;
  if (res.status === 201) return { status: res.status, imageId: json.data.image_id };
  return { status: res.status, errorCode: json.error?.code };
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

async function withTestDb<T>(run: (args: { storageDir: string; filename: string }) => T | Promise<T>): Promise<T> {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "plant-ai-image-serving-"));
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

// ---------------------------------------------------------------------------
// AE) valid image_id returns stored bytes
// ---------------------------------------------------------------------------

test("AE) GET /api/images/:imageId/file returns the exact stored bytes", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      new SqlitePlantRepository(db).create(basePlant());
      const content = jpegBytes(2048);
      const uploaded = await uploadJpeg(baseUrl, defaultFields(), content);
      assert.equal(uploaded.status, 201);
      assert.ok(uploaded.imageId);

      const res = await fetch(`${baseUrl}/api/images/${uploaded.imageId}/file`);
      assert.equal(res.status, 200);
      const bytes = Buffer.from(await res.arrayBuffer());
      assert.ok(bytes.equals(content), "served bytes must equal the uploaded RAW bytes");
      assert.equal(res.headers.get("content-length"), String(content.length));
    })
  );
});

// ---------------------------------------------------------------------------
// AF) correct content type
// ---------------------------------------------------------------------------

test("AF) content type follows the stored file (jpeg and png)", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      new SqlitePlantRepository(db).create(basePlant());

      const jpg = await uploadJpeg(baseUrl, defaultFields(), jpegBytes());
      assert.equal(jpg.status, 201);
      const jpgRes = await fetch(`${baseUrl}/api/images/${jpg.imageId}/file`);
      assert.equal(jpgRes.status, 200);
      assert.equal(jpgRes.headers.get("content-type"), "image/jpeg");

      const pngContent = pngBytes();
      const { body, contentType } = buildMultipart(defaultFields(), {
        filename: "photo.png",
        contentType: "image/png",
        content: pngContent,
      });
      const pngUpload = await fetch(`${baseUrl}/api/images/upload`, {
        method: "POST",
        headers: { "content-type": contentType },
        body: body as unknown as BodyInit,
      });
      assert.equal(pngUpload.status, 201);
      const pngJson = (await pngUpload.json()) as { data: ImageRecord };
      const pngRes = await fetch(`${baseUrl}/api/images/${pngJson.data.image_id}/file`);
      assert.equal(pngRes.status, 200);
      assert.equal(pngRes.headers.get("content-type"), "image/png");
    })
  );
});

// ---------------------------------------------------------------------------
// AG) unknown image_id -> 404
// ---------------------------------------------------------------------------

test("AG) unknown image_id returns 404 without leaking anything", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/images/IMG-20260101-000000-999/file`);
      assert.equal(res.status, 404);
      const json = (await res.json()) as { error: { code: string; message: string } };
      assert.equal(json.error.code, "image.not_found");
      const text = JSON.stringify(json);
      assert.ok(!text.includes(storageDir), "response must not leak the storage path");
      assert.ok(!text.includes("/"), "response must not contain paths");
    })
  );
});

// ---------------------------------------------------------------------------
// AH) invalid image_id -> 404
// ---------------------------------------------------------------------------

test("AH) malformed image_id is rejected (404, never treated as a path)", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl) => {
      // (Note: literal `..`/`.` segments are normalized away by the HTTP
      // client itself and never reach the server; they are covered via AJ.)
      for (const bad of ["IMG-not-an-id", "PLT-001", "image.jpg", "12345"]) {
        const res = await fetch(`${baseUrl}/api/images/${encodeURIComponent(bad)}/file`);
        assert.equal(res.status, 404, `id ${JSON.stringify(bad)} must yield 404`);
        const json = (await res.json()) as { error: { code: string } };
        assert.equal(json.error.code, "image.not_found");
      }
    })
  );
});

// ---------------------------------------------------------------------------
// AI) arbitrary filesystem path cannot be supplied
// ---------------------------------------------------------------------------

test("AI) absolute and relative filesystem paths are rejected", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl) => {
      const probes = [
        "/etc/passwd",
        "/etc/hostname",
        `${storageDir}/experiment.sqlite`,
        `${storageDir}/images/some.jpg`,
      ];
      for (const probe of probes) {
        const encoded = encodeURIComponent(probe);
        const res = await fetch(`${baseUrl}/api/images/${encoded}/file`);
        assert.equal(res.status, 404, `path ${probe} must be rejected`);
        const text = await res.text();
        assert.ok(!text.includes("passwd") && !text.includes("hostname"), "no file content may be leaked");
      }
    })
  );
});

// ---------------------------------------------------------------------------
// AJ) path traversal cannot escape the storage root
// ---------------------------------------------------------------------------

test("AJ) traversal sequences cannot escape the image storage root", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      new SqlitePlantRepository(db).create(basePlant());
      const uploaded = await uploadJpeg(baseUrl, defaultFields());
      assert.equal(uploaded.status, 201);

      // A well-formed-looking id followed by traversal segments decodes to an
      // invalid id and must 404; nothing outside the root is ever opened.
      const probes = [
        `${uploaded.imageId}/../../../../etc/passwd`,
        `${uploaded.imageId}/..%2f..%2fetc%2fpasswd`,
        `../../../../etc/passwd`,
        `%2e%2e%2f%2e%2e%2fetc%2fpasswd`,
      ];
      for (const probe of probes) {
        const res = await fetch(`${baseUrl}/api/images/${encodeURIComponent(probe)}/file`);
        assert.equal(res.status, 404, `probe ${probe} must not be served`);
      }
      // The legitimate file still works afterwards.
      const ok = await fetch(`${baseUrl}/api/images/${uploaded.imageId}/file`);
      assert.equal(ok.status, 200);
    })
  );
});

// ---------------------------------------------------------------------------
// AK) record pointing outside the storage root is rejected safely
// ---------------------------------------------------------------------------

test("AK) an ImageRecord whose image_path lies outside the storage root is never served", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      new SqlitePlantRepository(db).create(basePlant());
      const outsideProbe = path.join(os.tmpdir(), `plant-ai-serving-outside-${Date.now()}.jpg`);
      try {
        fs.writeFileSync(outsideProbe, jpegBytes(64));

        // Insert a record directly (bypassing the upload service) whose stored
        // path points outside the configured storage root.
        const repo = new SqliteImageRecordRepository(db);
        repo.create({
          image_id: "IMG-20260201-080000-111",
          plant_id: "PLT-001",
          timestamp: "2026-02-01T08:00:00",
          experiment_day: 1,
          image_path: outsideProbe,
          camera_id: "CAM-01",
          image_quality_status: "PASS",
          calibration_status: "pass",
        });

        const res = await fetch(`${baseUrl}/api/images/IMG-20260201-080000-111/file`);
        assert.equal(res.status, 404, "out-of-root record must not be served");
        const text = await res.text();
        assert.ok(!text.includes("plant-ai-serving-outside"), "outside file content must not leak");

        // A record pointing at the DB file itself (inside storage but not in
        // images/) is also rejected.
        repo.create({
          image_id: "IMG-20260201-080000-222",
          plant_id: "PLT-001",
          timestamp: "2026-02-01T08:00:00",
          experiment_day: 1,
          image_path: path.join(storageDir, filename),
          camera_id: "CAM-01",
          image_quality_status: "PASS",
          calibration_status: "pass",
        });
        const dbFileRes = await fetch(`${baseUrl}/api/images/IMG-20260201-080000-222/file`);
        assert.equal(dbFileRes.status, 404, "non-image files in storage must not be served");
      } finally {
        fs.rmSync(outsideProbe, { force: true });
      }
    })
  );
});

// ---------------------------------------------------------------------------
// AL) no filesystem path is leaked in the response
// ---------------------------------------------------------------------------

test("AL) responses never expose filesystem paths", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      new SqlitePlantRepository(db).create(basePlant());
      const uploaded = await uploadJpeg(baseUrl, defaultFields());
      assert.equal(uploaded.status, 201);

      const res = await fetch(`${baseUrl}/api/images/${uploaded.imageId}/file`);
      assert.equal(res.status, 200);
      const headersText = JSON.stringify(Object.fromEntries(res.headers.entries()));
      assert.ok(!headersText.includes(storageDir), "headers must not leak the storage path");
      assert.ok(!headersText.includes("image_path"), "no image_path field in headers");

      // Error responses are plain structured JSON with no paths.
      const missing = await fetch(`${baseUrl}/api/images/IMG-20260101-000000-001/file`);
      const missingText = await missing.text();
      assert.ok(!missingText.includes(storageDir), "404 body must not leak the storage path");
      assert.deepEqual(JSON.parse(missingText), {
        error: { code: "image.not_found", message: "Image file not found" },
      });
    })
  );
});

// ---------------------------------------------------------------------------
// AM) existing upload behavior remains intact (regression)
// ---------------------------------------------------------------------------

test("AM) upload, list and detail routes still work with the new serving route present", async () => {
  await withTestDb(({ storageDir, filename }) =>
    withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      new SqlitePlantRepository(db).create(basePlant());
      const content = jpegBytes(1024);
      const uploaded = await uploadJpeg(baseUrl, defaultFields(), content);
      assert.equal(uploaded.status, 201);
      assert.ok(uploaded.imageId);

      const list = await fetch(`${baseUrl}/api/images`);
      assert.equal(list.status, 200);
      const listJson = (await list.json()) as { data: ImageRecord[] };
      assert.equal(listJson.data.length, 1);

      const detail = await fetch(`${baseUrl}/api/images/${uploaded.imageId}`);
      assert.equal(detail.status, 200);
      const detailJson = (await detail.json()) as { data: ImageRecord };
      assert.equal(detailJson.data.image_id, uploaded.imageId);

      const file = await fetch(`${baseUrl}/api/images/${uploaded.imageId}/file`);
      assert.equal(file.status, 200);
      const bytes = Buffer.from(await file.arrayBuffer());
      assert.ok(bytes.equals(content));
    })
  );
});