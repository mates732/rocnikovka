import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { buildApp, createAppContext } from "../index.js";
import { SqlitePlantRepository, SqlitePositionEventRepository, SqliteWaterEventRepository } from "../repositories/sqliteRepositories.js";
import type { Plant, PositionEvent, WaterEvent } from "../types.js";

async function withTestDb<T>(run: (args: { storageDir: string; filename: string }) => T | Promise<T>): Promise<T> {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "plant-ai-block4c2-"));
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

function baseWaterEvent(overrides: Partial<WaterEvent> = {}): WaterEvent {
  return {
    water_event_id: "WTR-20260101-080000-001",
    plant_id: "PLT-001",
    timestamp: "2026-01-01T08:00:00",
    experiment_day: 1,
    pot_mass_before_g: 500,
    target_mass_g: 550,
    water_added_ml: 50,
    pot_mass_after_g: 550,
    watering_status: "pass",
    ...overrides,
  };
}

function basePositionEvent(overrides: Partial<PositionEvent> = {}): PositionEvent {
  return {
    position_event_id: "POS-20260101-080000-001",
    position_id: "P01",
    timestamp: "2026-01-01T08:00:00",
    plant_id: "PLT-001",
    location: "RACK_A_ROW1_COL1",
    operator: "operator_a",
    reason: "initial_assignment",
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

test("A) water events empty list", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/water-events`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: WaterEvent[] };
      assert.deepEqual(body.data, []);
    });
  });
});

test("B) water events populated list with deterministic ordering", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedParentPlant(db);
      const water = new SqliteWaterEventRepository(db);

      water.create(
        baseWaterEvent({
          water_event_id: "WTR-20260102-080000-001",
          timestamp: "2026-01-02T08:00:00",
        })
      );
      water.create(
        baseWaterEvent({
          water_event_id: "WTR-20260101-080000-002",
          timestamp: "2026-01-01T08:00:00",
        })
      );
      water.create(
        baseWaterEvent({
          water_event_id: "WTR-20260101-080000-001",
          timestamp: "2026-01-01T08:00:00",
        })
      );

      const res = await fetch(`${baseUrl}/api/water-events`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: WaterEvent[] };
      assert.equal(body.data.length, 3);

      assert.deepEqual(
        body.data.map((e) => e.water_event_id),
        ["WTR-20260101-080000-001", "WTR-20260101-080000-002", "WTR-20260102-080000-001"]
      );

      const first = body.data[0];
      assert.equal(first.plant_id, "PLT-001");
      assert.equal(first.experiment_day, 1);
      assert.equal(first.pot_mass_before_g, 500);
      assert.equal(first.target_mass_g, 550);
      assert.equal(first.water_added_ml, 50);
      assert.equal(first.pot_mass_after_g, 550);
      assert.equal(first.watering_status, "pass");
    });
  });
});

test("C) water list does not mutate data", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedParentPlant(db);
      const water = new SqliteWaterEventRepository(db);
      water.create(baseWaterEvent());
      water.create(
        baseWaterEvent({
          water_event_id: "WTR-20260101-090000-002",
          timestamp: "2026-01-01T09:00:00",
        })
      );

      const before = water.list().length;
      const res = await fetch(`${baseUrl}/api/water-events`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: WaterEvent[] };
      assert.equal(body.data.length, before);
      assert.equal(water.list().length, before);
    });
  });
});

test("D) position events empty list", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/position-events`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: PositionEvent[] };
      assert.deepEqual(body.data, []);
    });
  });
});

test("E) position events populated list with deterministic ordering", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedParentPlant(db);
      const positions = new SqlitePositionEventRepository(db);

      positions.create(
        basePositionEvent({
          position_event_id: "POS-20260102-080000-001",
          timestamp: "2026-01-02T08:00:00",
        })
      );
      positions.create(
        basePositionEvent({
          position_event_id: "POS-20260101-080000-002",
          timestamp: "2026-01-01T08:00:00",
          location: "RACK_A_ROW1_COL2",
        })
      );
      positions.create(
        basePositionEvent({
          position_event_id: "POS-20260101-080000-001",
          timestamp: "2026-01-01T08:00:00",
          reason: "rotation",
          previous_location: "RACK_A_ROW1_COL1",
        })
      );

      const res = await fetch(`${baseUrl}/api/position-events`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: PositionEvent[] };
      assert.equal(body.data.length, 3);

      assert.deepEqual(
        body.data.map((e) => e.position_event_id),
        ["POS-20260101-080000-001", "POS-20260101-080000-002", "POS-20260102-080000-001"]
      );

      const first = body.data[0];
      assert.equal(first.plant_id, "PLT-001");
      assert.equal(first.position_id, "P01");
      assert.equal(first.reason, "rotation");
      assert.equal(first.previous_location, "RACK_A_ROW1_COL1");
      assert.equal(first.operator, "operator_a");

      const second = body.data[1];
      assert.equal(second.location, "RACK_A_ROW1_COL2");
    });
  });
});

test("F) position list does not mutate data", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      seedParentPlant(db);
      const positions = new SqlitePositionEventRepository(db);
      positions.create(basePositionEvent());
      positions.create(
        basePositionEvent({
          position_event_id: "POS-20260102-080000-002",
          timestamp: "2026-01-02T08:00:00",
        })
      );

      const before = positions.list().length;
      const res = await fetch(`${baseUrl}/api/position-events`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: PositionEvent[] };
      assert.equal(body.data.length, before);
      assert.equal(positions.list().length, before);
    });
  });
});