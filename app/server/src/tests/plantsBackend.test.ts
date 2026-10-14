import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { createDb, migrate } from "../db.js";
import { buildApp, createAppContext } from "../index.js";
import { SqlitePlantRepository } from "../repositories/sqliteRepositories.js";
import type { Plant } from "../types.js";

function testIds(testName: string) {
  const hash = Array.from(testName).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 1000, 0);
  const suffix = String(hash).padStart(3, "0");
  return {
    plantId: `PLT-${suffix}`,
    potId: `POT-${suffix}`,
  };
}

async function withTestDb<T>(run: (args: { storageDir: string; filename: string }) => T | Promise<T>): Promise<T> {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "plant-ai-block4a-"));
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
    plant_id: "PLT-BASE",
    pot_id: "POT-BASE",
    group_name: "G1",
    emergence_date: "2026-02-01",
    status: "active",
    notes: "baseline",
    created_at: "2026-02-01T08:00:00",
    ...overrides,
  };
}

function queryAuditLogCount(db: Database.Database, eventType?: string) {
  if (!eventType) {
    return (db.prepare("SELECT COUNT(*) as count FROM audit_log").get() as { count: number }).count;
  }
  return (
    db.prepare("SELECT COUNT(*) as count FROM audit_log WHERE event_type = ?").get(eventType) as { count: number }
  ).count;
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

test("A) list plants", async () => {
  const ids = testIds("A list plants");
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl) => {
      await fetch(`${baseUrl}/api/plants`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(basePlant({ plant_id: ids.plantId, pot_id: ids.potId })),
      });

      const res = await fetch(`${baseUrl}/api/plants`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: Array<{ plant_id: string }> };
      assert.equal(body.data.length, 1);
      assert.equal(body.data[0].plant_id, ids.plantId);
    });
  });
});

test("B) get plant by ID", async () => {
  const ids = testIds("B get plant by ID");
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl) => {
      await fetch(`${baseUrl}/api/plants`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(basePlant({ plant_id: ids.plantId, pot_id: ids.potId })),
      });

      const res = await fetch(`${baseUrl}/api/plants/${ids.plantId}`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: { pot_id: string } };
      assert.equal(body.data.pot_id, ids.potId);
    });
  });
});

test("C) create plant", async () => {
  const ids = testIds("C create plant");
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/plants`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(basePlant({ plant_id: ids.plantId, pot_id: ids.potId })),
      });
      assert.equal(res.status, 201);
      const body = (await res.json()) as { data: { plant_id: string } };
      assert.equal(body.data.plant_id, ids.plantId);
    });
  });
});

test("D) duplicate plant rejected", async () => {
  const ids = testIds("D duplicate plant rejected");
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl) => {
      const payload = basePlant({ plant_id: ids.plantId, pot_id: ids.potId });
      await fetch(`${baseUrl}/api/plants`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await fetch(`${baseUrl}/api/plants`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      assert.equal(res.status, 409);
      const body = (await res.json()) as { error: { code: string } };
      assert.equal(body.error.code, "id.duplicate");
    });
  });
});

test("E) invalid plant rejected", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/plants`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(basePlant({ plant_id: "BAD" })),
      });
      assert.equal(res.status, 400);
      const body = (await res.json()) as { error: { code: string } };
      assert.equal(body.error.code, "input.invalid");
    });
  });
});

test("F) update safe metadata", async () => {
  const ids = testIds("F update safe metadata");
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl) => {
      await fetch(`${baseUrl}/api/plants`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(basePlant({ plant_id: ids.plantId, pot_id: ids.potId })),
      });

      const res = await fetch(`${baseUrl}/api/plants/${ids.plantId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          notes: "updated notes",
          status: "damaged",
          updated_at: "2026-02-02T10:00:00",
        }),
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: { notes: string; status: string } };
      assert.equal(body.data.notes, "updated notes");
      assert.equal(body.data.status, "damaged");
    });
  });
});

test("G) immutable field modification rejected", async () => {
  const ids = testIds("G immutable field modification rejected");
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl) => {
      await fetch(`${baseUrl}/api/plants`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(basePlant({ plant_id: ids.plantId, pot_id: ids.potId })),
      });

      const res = await fetch(`${baseUrl}/api/plants/${ids.plantId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pot_id: "POT-999",
          updated_at: "2026-02-02T10:00:00",
        }),
      });

      assert.equal(res.status, 409);
      const body = (await res.json()) as { error: { code: string } };
      assert.equal(body.error.code, "field.immutable");
    });
  });
});

test("H) deactivate plant", async () => {
  const ids = testIds("H deactivate plant");
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl) => {
      await fetch(`${baseUrl}/api/plants`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(basePlant({ plant_id: ids.plantId, pot_id: ids.potId })),
      });

      const res = await fetch(`${baseUrl}/api/plants/${ids.plantId}/deactivate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: "excluded",
          updated_at: "2026-02-03T10:00:00",
          notes: "deactivated",
        }),
      });

      assert.equal(res.status, 200);
      const body = (await res.json()) as { data: { status: string } };
      assert.equal(body.data.status, "excluded");
    });
  });
});

test("I) physical DELETE not available", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/plants/PLT-101`, { method: "DELETE" });
      assert.equal(res.status, 405);
      const body = (await res.json()) as { error: { code: string } };
      assert.equal(body.error.code, "method.not_allowed");
    });
  });
});

test("J) missing plant returns correct error", async () => {
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/plants/PLT-404`);
      assert.equal(res.status, 404);
      const body = (await res.json()) as { error: { code: string } };
      assert.equal(body.error.code, "plant.not_found");
    });
  });
});

test("K) persistence after DB close/reopen", () => {
  const ids = testIds("K persistence after DB close reopen");
  withTestDb(({ storageDir, filename }) => {
    {
      const db = createDb({ storageDir, filename });
      migrate(db);
      const repo = new SqlitePlantRepository(db);
      repo.create(basePlant({ plant_id: ids.plantId, pot_id: ids.potId }));
      db.close();
    }

    {
      const db = createDb({ storageDir, filename });
      migrate(db);
      const repo = new SqlitePlantRepository(db);
      const row = repo.getById(ids.plantId);
      assert.equal(row?.plant_id, ids.plantId);
      db.close();
    }
  });
});

test("L) audit events for safe update and deactivation", async () => {
  const ids = testIds("L audit events for safe update and deactivation");
  await withTestDb(async ({ storageDir, filename }) => {
    await withStartedServer({ storageDir, filename }, async (baseUrl, db) => {
      await fetch(`${baseUrl}/api/plants`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(basePlant({ plant_id: ids.plantId, pot_id: ids.potId })),
      });

      await fetch(`${baseUrl}/api/plants/${ids.plantId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: "damaged",
          updated_at: "2026-02-02T12:00:00",
        }),
      });

      await fetch(`${baseUrl}/api/plants/${ids.plantId}/deactivate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: "excluded",
          updated_at: "2026-02-03T12:00:00",
        }),
      });

      assert.equal(queryAuditLogCount(db) >= 2, true);
      assert.equal(queryAuditLogCount(db, "plant.safe_update") >= 1, true);
      assert.equal(queryAuditLogCount(db, "plant.deactivate") >= 1, true);
    });
  });
});
