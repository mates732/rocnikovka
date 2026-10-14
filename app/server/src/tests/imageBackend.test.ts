import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { buildApp, createAppContext } from "../index.js";
import { RepositoryError } from "../repositories/base.js";
import { SqliteImageRecordRepository, SqlitePlantRepository } from "../repositories/sqliteRepositories.js";
import type { ImageRecord, Plant } from "../types.js";

async function withTestDb<T>(run: (args: { storageDir: string; filename: string }) => T | Promise<T>): Promise<T> {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "plant-ai-block4d2-"));
  const storageDir = path.join(tempRoot, "storage");
  const filename = "test.sqlite";
  fs.mkdirSync(storageDir, { recursive: true });

  try {
    return await run({ storageDir, filename });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

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

function baseImageRecord(overrides: Partial<ImageRecord> = {}): ImageRecord {
  return {
    image_id: "IMG-20260101-080000-001",
    plant_id: "PLT-001",
    timestamp: "2026-01-01T08:00:00",
    experiment_day: 1,
    image_path: "data/raw/images/IMG-20260101-080000-001.jpg",
    camera_id: "CAM-01",
    image_quality_status: "PASS",
    calibration_status: "pass",
    ...overrides,
  };
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

function seedParentPlant(db: Database.Database): void {
  const plants = new SqlitePlantRepository(db);
  plants.create(basePlant());
}

test("A) images empty list", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/images`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: ImageRecord[] };
      assert.deepEqual(body.data, []);
    });
  });
});

test("B) images populated list preserves all fields and NULLs", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedParentPlant(db);
      const images = new SqliteImageRecordRepository(db);

      images.create(
        baseImageRecord({
          image_id: "IMG-20260102-080000-003",
          timestamp: "2026-01-02T08:00:00",
          experiment_day: 2,
          image_path: "data/raw/images/IMG-20260102-080000-003.jpg",
          camera_id: "CAM-02",
          image_quality_status: "WARN",
          calibration_status: "warn",
          cal_ref_id: "CAL-20260102-001",
          failure_code: "poor_image_quality",
          notes: "slight blur",
        })
      );
      images.create(
        baseImageRecord({
          image_id: "IMG-20260101-080000-002",
          timestamp: "2026-01-01T08:00:00",
          image_path: "data/raw/images/IMG-20260101-080000-002.jpg",
        })
      );
      images.create(
        baseImageRecord({
          image_id: "IMG-20260101-080000-001",
          timestamp: "2026-01-01T08:00:00",
          image_path: "data/raw/images/IMG-20260101-080000-001.jpg",
        })
      );

      const res = await fetch(`${baseUrl}/api/images`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: ImageRecord[] };
      assert.equal(body.data.length, 3);

      const ids = body.data.map((r) => r.image_id);
      assert.equal(new Set(ids).size, ids.length, "no duplicated records");
      assert.ok(ids.includes("IMG-20260101-080000-001"), "no lost records");
      assert.ok(ids.includes("IMG-20260101-080000-002"), "no lost records");
      assert.ok(ids.includes("IMG-20260102-080000-003"), "no lost records");

      const full = body.data.find((r) => r.image_id === "IMG-20260102-080000-003");
      assert.ok(full);
      assert.equal(full.plant_id, "PLT-001");
      assert.equal(full.timestamp, "2026-01-02T08:00:00");
      assert.equal(full.experiment_day, 2);
      assert.equal(full.image_path, "data/raw/images/IMG-20260102-080000-003.jpg");
      assert.equal(full.camera_id, "CAM-02");
      assert.equal(full.image_quality_status, "WARN");
      assert.equal(full.calibration_status, "warn");
      assert.equal(full.cal_ref_id, "CAL-20260102-001");
      assert.equal(full.failure_code, "poor_image_quality");
      assert.equal(full.notes, "slight blur");

      const noOptionals = body.data.find((r) => r.image_id === "IMG-20260101-080000-001");
      assert.ok(noOptionals);
      assert.equal(noOptionals.cal_ref_id, null, "NULL cal_ref_id must stay null");
      assert.equal(noOptionals.failure_code, null, "NULL failure_code must stay null");
      assert.equal(noOptionals.notes, null, "NULL notes must stay null");
    });
  });
});

test("C) images deterministic ordering: timestamp ASC then image_id ASC", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedParentPlant(db);
      const images = new SqliteImageRecordRepository(db);

      images.create(
        baseImageRecord({
          image_id: "IMG-20260101-080000-001",
          timestamp: "2026-01-01T08:00:00",
        })
      );
      images.create(
        baseImageRecord({
          image_id: "IMG-20260102-080000-003",
          timestamp: "2026-01-02T08:00:00",
          experiment_day: 2,
        })
      );
      images.create(
        baseImageRecord({
          image_id: "IMG-20260101-080000-002",
          timestamp: "2026-01-01T08:00:00",
        })
      );

      const res = await fetch(`${baseUrl}/api/images`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: ImageRecord[] };

      assert.deepEqual(
        body.data.map((r) => r.image_id),
        ["IMG-20260101-080000-001", "IMG-20260101-080000-002", "IMG-20260102-080000-003"]
      );
      assert.deepEqual(
        body.data.map((r) => r.timestamp),
        ["2026-01-01T08:00:00", "2026-01-01T08:00:00", "2026-01-02T08:00:00"]
      );
    });
  });
});

test("D) images list does not mutate data", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedParentPlant(db);
      const images = new SqliteImageRecordRepository(db);
      images.create(
        baseImageRecord({
          image_id: "IMG-20260101-080000-001",
          timestamp: "2026-01-01T08:00:00",
        })
      );
      images.create(
        baseImageRecord({
          image_id: "IMG-20260101-090000-002",
          timestamp: "2026-01-01T09:00:00",
          image_path: "data/raw/images/IMG-20260101-090000-002.jpg",
          cal_ref_id: "CAL-001",
        })
      );

      const before = images.list();
      const countBefore = before.length;

      const res = await fetch(`${baseUrl}/api/images`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: ImageRecord[] };
      assert.equal(body.data.length, countBefore);

      const after = images.list();
      assert.equal(after.length, countBefore);
      assert.deepEqual(after, before, "GET /api/images must not mutate stored records");
    });
  });
});

test("E) existing image repository behavior: create/getById/duplicate ID/FK unchanged", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    const context = createAppContext({ storageDir, filename });
    const images = new SqliteImageRecordRepository(context.db);

    assert.throws(
      () =>
        images.create(
          baseImageRecord({
            image_id: "IMG-20260101-080000-001",
            plant_id: "PLT-999",
          })
        ),
      (error: unknown) => error instanceof RepositoryError && error.code === "reference.missing_parent"
    );

    const plants = new SqlitePlantRepository(context.db);
    plants.create(basePlant());
    images.create(
      baseImageRecord({
        image_id: "IMG-20260101-080000-001",
        timestamp: "2026-01-01T08:00:00",
      })
    );

    const created = images.getById("IMG-20260101-080000-001");
    assert.ok(created);
    assert.equal(created.camera_id, "CAM-01");
    assert.equal(created.image_quality_status, "PASS");
    assert.equal(created.calibration_status, "pass");
    assert.equal(created.cal_ref_id, null);

    assert.throws(
      () =>
        images.create(
          baseImageRecord({
            image_id: "IMG-20260101-080000-001",
            timestamp: "2026-01-01T10:00:00",
          })
        ),
      (error: unknown) => error instanceof RepositoryError && error.code === "id.duplicate"
    );

    context.db.close();
  });
});

test("F) image detail existing record returns 200 with all fields", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedParentPlant(db);
      const images = new SqliteImageRecordRepository(db);
      images.create(
        baseImageRecord({
          image_id: "IMG-20260101-080000-001",
          timestamp: "2026-01-01T08:00:00",
          experiment_day: 3,
          image_path: "data/raw/images/IMG-20260101-080000-001.jpg",
          camera_id: "CAM-05",
          image_quality_status: "FAIL",
          calibration_status: "fail",
          cal_ref_id: "CAL-20260101-001",
          failure_code: "calibration_failed",
          notes: "blurry frame",
        })
      );

      const res = await fetch(`${baseUrl}/api/images/IMG-20260101-080000-001`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: ImageRecord };
      assert.deepEqual(body.data, {
        image_id: "IMG-20260101-080000-001",
        plant_id: "PLT-001",
        timestamp: "2026-01-01T08:00:00",
        experiment_day: 3,
        image_path: "data/raw/images/IMG-20260101-080000-001.jpg",
        camera_id: "CAM-05",
        image_quality_status: "FAIL",
        calibration_status: "fail",
        cal_ref_id: "CAL-20260101-001",
        failure_code: "calibration_failed",
        notes: "blurry frame",
      });
    });
  });
});

test("G) image detail NULL preservation", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedParentPlant(db);
      const images = new SqliteImageRecordRepository(db);
      images.create(
        baseImageRecord({
          image_id: "IMG-20260101-090000-002",
          timestamp: "2026-01-01T09:00:00",
          image_path: "data/raw/images/IMG-20260101-090000-002.jpg",
        })
      );

      const res = await fetch(`${baseUrl}/api/images/IMG-20260101-090000-002`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: ImageRecord };
      assert.equal(body.data.cal_ref_id, null);
      assert.equal(body.data.failure_code, null);
      assert.equal(body.data.notes, null);
    });
  });
});

test("H) image detail missing record returns 404 image.not_found", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/images/IMG-999999-999999-999`);
      assert.equal(res.status, 404);
      const body = (await res.json()) as { error: { code: string; message: string } };
      assert.equal(body.error.code, "image.not_found");
      assert.equal(body.error.message, "Image not found");
    });
  });
});

test("I) image detail GET does not mutate data", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedParentPlant(db);
      const images = new SqliteImageRecordRepository(db);
      images.create(baseImageRecord());
      images.create(
        baseImageRecord({
          image_id: "IMG-20260101-100000-003",
          timestamp: "2026-01-01T10:00:00",
          image_path: "data/raw/images/IMG-20260101-100000-003.jpg",
        })
      );

      const before = images.list();
      const countBefore = before.length;

      const res = await fetch(`${baseUrl}/api/images/IMG-20260101-080000-001`);
      assert.equal(res.status, 200);

      const after = images.list();
      assert.equal(after.length, countBefore);
      assert.deepEqual(after, before, "GET /api/images/:imageId must not mutate stored records");
    });
  });
});