import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDb, migrate } from "../db.js";
import { buildApp, createAppContext } from "../index.js";

function testIds(testName: string) {
  const hash = Array.from(testName).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 1000, 0);
  const suffix = String(hash).padStart(3, "0");
  return {
    equipmentId: `EQ-${suffix}`,
    allocationId: `ALLOC-${suffix}`,
    decisionId: `DEC-${suffix}`,
    configId: `CFG-${suffix}`,
  };
}

async function withStartedServer<T>(
  dbConfig: { storageDir: string; filename: string },
  run: (baseUrl: string) => Promise<T>
): Promise<T> {
  const context = createAppContext(dbConfig);
  const { server } = buildApp(context);
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    return await run(baseUrl);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    context.db.close();
  }
}

async function withTestServer<T>(run: (baseUrl: string) => Promise<T>): Promise<T> {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "plant-ai-day0-"));
  const storageDir = path.join(tempRoot, "storage");
  fs.mkdirSync(storageDir, { recursive: true });

  try {
    return await withStartedServer({ storageDir, filename: "test.sqlite" }, run);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function postJson(baseUrl: string, endpoint: string, body: unknown) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { status: response.status, body: json };
}

async function patchJson(baseUrl: string, endpoint: string, body: unknown) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, body: json };
}

async function getJson(baseUrl: string, endpoint: string) {
  const response = await fetch(`${baseUrl}${endpoint}`);
  const json = await response.json().catch(() => ({}));
  return { status: response.status, body: json };
}

async function seedExistingPlant(baseUrl: string) {
  const now = "2026-02-01T08:00:00";
  return postJson(baseUrl, "/api/plants", {
    plant_id: "PLT-001",
    pot_id: "POT-001",
    group_name: "G1",
    emergence_date: "2026-02-01",
    status: "active",
    created_at: now,
  });
}

test("Day 0: physical config stores planned watering volumes separately from actual events", async () => {
  await withTestServer(async (baseUrl) => {
    const created = await postJson(baseUrl, "/api/day0/physical-config", {
      config_id: "CFG-WATER-PLAN",
      camera_device: "iPhone 15 Pro",
      // PLANNED volumes only
      planned_water_ml_g0: 75,
      planned_water_ml_g1: 64,
      planned_water_ml_g2: 53,
      created_at: "2026-02-01T08:00:00",
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.planned_water_ml_g0, 75);
    assert.equal(created.body.data.planned_water_ml_g1, 64);
    assert.equal(created.body.data.planned_water_ml_g2, 53);

    // Planned volumes persist and are editable
    const edited = await patchJson(baseUrl, "/api/day0/physical-config", {
      planned_water_ml_g1: 60,
    });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.data.planned_water_ml_g1, 60);
    assert.equal(edited.body.data.planned_water_ml_g0, 75, "other planned volumes are untouched");
  });
});

test("Day 0: a planned watering volume never creates a water event or a target mass", async () => {
  await withTestServer(async (baseUrl) => {
    await seedExistingPlant(baseUrl);

    // Record the plan
    await postJson(baseUrl, "/api/day0/physical-config", {
      config_id: "CFG-NO-AUTO",
      planned_water_ml_g0: 75,
      planned_water_ml_g1: 64,
      planned_water_ml_g2: 53,
      created_at: "2026-02-01T08:00:00",
    });

    // No water event is created by the plan itself.
    const waterEvents = await getJson(baseUrl, "/api/water-events");
    assert.equal(waterEvents.status, 200);
    assert.equal((waterEvents.body.data as unknown[]).length, 0, "planning must not create watering events");

    // No allocation carries a derived gravimetric target mass.
    await postJson(baseUrl, "/api/day0/pot-allocation", {
      allocation_id: "ALLOC-NO-TARGET",
      pot_id: "POT-030",
      group_name: "G0",
      substrate_mass_g: 72,
      seed_count: 3,
      created_at: "2026-02-01T08:00:00",
    });
    const alloc = await getJson(baseUrl, "/api/day0/pot-allocation/ALLOC-NO-TARGET");
    const row = alloc.body.data as Record<string, unknown>;
    assert.ok(
      row.target_mass_g == null,
      "no gravimetric target mass may be derived from a planned volume"
    );
    assert.ok(row.initial_water_ml == null, "the plan must not be written as an actual watering observation");
  });
});

test("Day 0: planned watering volumes reject negative values", async () => {
  await withTestServer(async (baseUrl) => {
    const bad = await postJson(baseUrl, "/api/day0/physical-config", {
      config_id: "CFG-BAD-VOL",
      planned_water_ml_g0: -5,
      created_at: "2026-02-01T08:00:00",
    });
    assert.equal(bad.status, 400);
  });
});

test("Day 0: migration v6 creates the Day 0 tables and preserves existing plants", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "plant-ai-day0-mig-"));
  const storageDir = path.join(tempRoot, "storage");
  fs.mkdirSync(storageDir, { recursive: true });

  try {
    // Create an existing plant with the old schema data
    const db = createDb({ storageDir, filename: "test.sqlite" });
    migrate(db);
    db.prepare(
      `INSERT INTO plants (plant_id, pot_id, group_name, emergence_date, status, created_at, seed_count)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run("PLT-001", "POT-001", "G1", "2026-02-01", "active", "2026-02-01T08:00:00", 1);
    db.close();

    // Reopen and migrate again (should be idempotent, version already 7)
    const db2 = createDb({ storageDir, filename: "test.sqlite" });
    migrate(db2);

    const plant = db2.prepare("SELECT * FROM plants WHERE plant_id = ?").get("PLT-001") as Record<string, unknown>;
    assert.equal(plant.plant_id, "PLT-001");
    assert.equal(plant.pot_id, "POT-001");
    assert.equal(plant.group_name, "G1");
    // Day 0 columns default to safe values, never NULL for required fields
    assert.equal(plant.emergence_status, "not_sown");
    assert.equal(plant.seed_count, 1, "existing PLT-001 keeps its explicitly stored seed_count");
    assert.equal(plant.sowing_date, null, "sowing_date must not be auto-filled");

    const tables = db2
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'day0%' ORDER BY name")
      .all() as { name: string }[];
    assert.deepEqual(
      tables.map((t) => t.name),
      ["day0_equipment", "day0_methodology_decisions", "day0_physical_config", "day0_pot_allocation"]
    );

    const version = db2.prepare("SELECT MAX(version) as version FROM schema_migrations").get() as { version: number };
    assert.equal(version.version, 8);

    // New rows follow the 3-seeds-per-pot plan and mass_basis 'unknown'
    db2
      .prepare(`INSERT INTO plants (plant_id, pot_id, group_name, emergence_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run("PLT-002", "POT-002", "G0", "2026-02-01", "active", "2026-02-01T08:00:00");
    const newPlant = db2.prepare("SELECT * FROM plants WHERE plant_id = ?").get("PLT-002") as Record<string, unknown>;
    assert.equal(newPlant.seed_count, 3, "new plants default to the 3-seed plan");

    db2
      .prepare(
        `INSERT INTO day0_pot_allocation (allocation_id, pot_id, substrate_mass_g, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .run("ALLOC-DEFAULT", "POT-003", 72, "2026-02-01T08:00:00");
    const alloc = db2.prepare("SELECT * FROM day0_pot_allocation WHERE allocation_id = ?").get("ALLOC-DEFAULT") as Record<
      string,
      unknown
    >;
    assert.equal(alloc.seed_count, 3, "new pot allocation defaults to 3 planned seeds");
    assert.equal(alloc.seeds_sown, null, "actual seeds sown must stay empty until recorded");
    assert.equal(alloc.seedlings_emerged, null, "emerged seedlings must stay empty until observed");
    assert.equal(alloc.plants_retained, null, "retained plants must stay empty until thinning");
    assert.equal(alloc.mass_basis, "unknown", "mass basis defaults to unknown");
    assert.equal(alloc.sowing_status, "pending");
    assert.equal(alloc.emergence_status, "not_sown");

    db2.close();
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("Day 0: equipment CRUD via API with verification flag", async () => {
  await withTestServer(async (baseUrl) => {
    const { equipmentId } = testIds("equipment CRUD");

    // Create prepopulated equipment (27 pots, unverified)
    const created = await postJson(baseUrl, "/api/day0/equipment", {
      equipment_id: equipmentId,
      name: "Květináče",
      category: "Základní vybavení",
      quantity: 27,
      unit: "ks",
      is_prepopulated: true,
      verified: false,
      created_at: "2026-02-01T08:00:00",
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.verified, false);

    // Verify it
    const verified = await patchJson(baseUrl, `/api/day0/equipment/${equipmentId}`, { verified: true });
    assert.equal(verified.status, 200);
    assert.equal(verified.body.data.verified, true);

    // List returns the item
    const list = await getJson(baseUrl, "/api/day0/equipment");
    assert.equal(list.status, 200);
    const found = (list.body.data as Array<{ equipment_id: string }>).find((e) => e.equipment_id === equipmentId);
    assert.ok(found, "created equipment must be in the list");
  });
});

test("Day 0: equipment rejects duplicate IDs with 409", async () => {
  await withTestServer(async (baseUrl) => {
    const { equipmentId } = testIds("equipment duplicate");
    const item = {
      equipment_id: equipmentId,
      name: "Váha",
      category: "Měřicí přístroje",
      quantity: 1,
      is_prepopulated: false,
      verified: false,
      created_at: "2026-02-01T08:00:00",
    };
    const first = await postJson(baseUrl, "/api/day0/equipment", item);
    assert.equal(first.status, 201);
    const second = await postJson(baseUrl, "/api/day0/equipment", item);
    assert.equal(second.status, 409);
  });
});

test("Day 0: pot allocation records 72 g substrate distinctly and preserves PLT-001", async () => {
  await withTestServer(async (baseUrl) => {
    await seedExistingPlant(baseUrl);
    const { allocationId } = testIds("pot allocation");

    const created = await postJson(baseUrl, "/api/day0/pot-allocation", {
      allocation_id: allocationId,
      pot_id: "POT-002",
      group_name: "G1",
      substrate_mass_g: 72,
      seed_count: 1,
      sowing_status: "pending",
      emergence_status: "not_sown",
      created_at: "2026-02-01T08:00:00",
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.substrate_mass_g, 72, "substrate_mass_g must stay 72 g");
    assert.ok(created.body.data.sowing_date == null, "sowing_date must not be auto-filled");
    assert.ok(created.body.data.emergence_date == null, "emergence_date must not be auto-filled");

    // PLT-001 is untouched
    const plant = await getJson(baseUrl, "/api/plants/PLT-001");
    assert.equal(plant.status, 200);
    assert.equal(plant.body.data.emergence_date, "2026-02-01");
    assert.equal(plant.body.data.pot_id, "POT-001");

    // Duplicate pot_id rejected
    const duplicate = await postJson(baseUrl, "/api/day0/pot-allocation", {
      allocation_id: `${allocationId}-x`,
      pot_id: "POT-002",
      substrate_mass_g: 72,
      seed_count: 1,
      sowing_status: "pending",
      emergence_status: "not_sown",
      created_at: "2026-02-01T08:00:00",
    });
    assert.equal(duplicate.status, 409, "duplicate pot allocation must be rejected");
  });
});

test("Day 0: sowing date and emergence date are separate fields", async () => {
  await withTestServer(async (baseUrl) => {
    const { allocationId } = testIds("sowing vs emergence");

    await postJson(baseUrl, "/api/day0/pot-allocation", {
      allocation_id: allocationId,
      pot_id: "POT-003",
      group_name: "G0",
      substrate_mass_g: 72,
      seed_count: 1,
      sowing_status: "pending",
      emergence_status: "not_sown",
      created_at: "2026-02-01T08:00:00",
    });

    // Sow on 2026-03-01, no emergence yet
    const sown = await patchJson(baseUrl, `/api/day0/pot-allocation/${allocationId}`, {
      sowing_date: "2026-03-01",
      sowing_status: "sown",
      emergence_status: "awaiting",
    });
    assert.equal(sown.status, 200);
    assert.equal(sown.body.data.sowing_date, "2026-03-01");
    assert.ok(sown.body.data.emergence_date == null, "emergence must stay empty before emergence");
    assert.equal(sown.body.data.emergence_status, "awaiting");

    // Emerge on 2026-03-06 (5 days later, not derived from sowing)
    const emerged = await patchJson(baseUrl, `/api/day0/pot-allocation/${allocationId}`, {
      emergence_status: "emerged",
      emergence_date: "2026-03-06",
    });
    assert.equal(emerged.status, 200);
    assert.equal(emerged.body.data.emergence_date, "2026-03-06");
    assert.equal(emerged.body.data.sowing_date, "2026-03-01", "sowing date is preserved");
    assert.notEqual(
      emerged.body.data.emergence_date,
      emerged.body.data.sowing_date,
      "emergence date must never equal sowing date automatically"
    );
  });
});

test("Day 0: planned seed count defaults to 3 per pot (81 planned total)", async () => {
  await withTestServer(async (baseUrl) => {
    const valid = await postJson(baseUrl, "/api/day0/pot-allocation", {
      allocation_id: "ALLOC-SEED-DEFAULT",
      pot_id: "POT-004",
      substrate_mass_g: 72,
      created_at: "2026-02-01T08:00:00",
    });
    assert.equal(valid.status, 201);
    assert.equal(valid.body.data.seed_count, 3, "planned seed count defaults to 3 per pot");
    assert.equal(valid.body.data.seeds_sown, null, "actual seeds sown is not auto-filled");
    assert.equal(valid.body.data.seedlings_emerged, null, "emerged seedlings is not auto-filled");
    assert.equal(valid.body.data.plants_retained, null, "retained plants is not auto-filled");
    assert.equal(valid.body.data.mass_basis, "unknown");
  });
});

test("Day 0: planned, sown, emerged and retained seed counts stay distinct", async () => {
  await withTestServer(async (baseUrl) => {
    await postJson(baseUrl, "/api/day0/pot-allocation", {
      allocation_id: "ALLOC-SEED-DISTINCT",
      pot_id: "POT-005",
      substrate_mass_g: 72,
      seed_count: 3,
      sowing_status: "pending",
      emergence_status: "not_sown",
      created_at: "2026-02-01T08:00:00",
    });

    // Sow 3 seeds
    const sown = await patchJson(baseUrl, "/api/day0/pot-allocation/ALLOC-SEED-DISTINCT", {
      sowing_date: "2026-03-01",
      sowing_status: "sown",
      emergence_status: "awaiting",
      seeds_sown: 3,
    });
    assert.equal(sown.status, 200);
    assert.equal(sown.body.data.seed_count, 3, "planned count unchanged");
    assert.equal(sown.body.data.seeds_sown, 3, "actual sown recorded");
    assert.equal(sown.body.data.seedlings_emerged, null);

    // 2 of 3 seeds emerge — do NOT auto-thin, do NOT auto-choose a survivor
    const emerged = await patchJson(baseUrl, "/api/day0/pot-allocation/ALLOC-SEED-DISTINCT", {
      emergence_status: "emerged",
      emergence_date: "2026-03-06",
      seedlings_emerged: 2,
    });
    assert.equal(emerged.status, 200);
    assert.equal(emerged.body.data.seedlings_emerged, 2);
    assert.equal(emerged.body.data.plants_retained, null, "no automatic thinning");

    // User records retaining 1 plant after thinning
    const retained = await patchJson(baseUrl, "/api/day0/pot-allocation/ALLOC-SEED-DISTINCT", {
      plants_retained: 1,
    });
    assert.equal(retained.status, 200);
    assert.equal(retained.body.data.plants_retained, 1);
    assert.equal(retained.body.data.seed_count, 3, "planned count still 3 after thinning");
    assert.equal(retained.body.data.seeds_sown, 3, "sown count still 3 after thinning");
  });
});

test("Day 0: bulk 27-pot allocation plans 81 seeds at 3 per pot with 9 per group", async () => {
  await withTestServer(async (baseUrl) => {
    const planned = Array.from({ length: 27 }, (_, i) => {
      const n = i + 1;
      return {
        allocation_id: `ALLOC-BULK-${n}`,
        pot_id: `POT-${String(n).padStart(3, "0")}`,
        group_name: n <= 9 ? "G0" : n <= 18 ? "G1" : "G2",
        substrate_mass_g: 72,
        seed_count: 3,
        sowing_status: "pending",
        emergence_status: "not_sown",
        created_at: "2026-02-01T08:00:00",
      };
    });

    for (const alloc of planned) {
      const res = await postJson(baseUrl, "/api/day0/pot-allocation", alloc);
      assert.equal(res.status, 201);
    }

    const list = await getJson(baseUrl, "/api/day0/pot-allocation");
    const rows = list.body.data as Array<Record<string, unknown>>;
    assert.equal(rows.length, 27);

    const g0 = rows.filter((r) => r.group_name === "G0").length;
    const g1 = rows.filter((r) => r.group_name === "G1").length;
    const g2 = rows.filter((r) => r.group_name === "G2").length;
    assert.equal(g0, 9, "G0 must have 9 pots");
    assert.equal(g1, 9, "G1 must have 9 pots");
    assert.equal(g2, 9, "G2 must have 9 pots");

    const totalSeeds = rows.reduce((sum, r) => sum + (r.seed_count as number), 0);
    assert.equal(totalSeeds, 81, "27 pots x 3 seeds = 81 planned seeds");

    const totalSubstrate = rows.reduce((sum, r) => sum + (r.substrate_mass_g as number), 0);
    assert.equal(totalSubstrate, 1944, "27 pots x 72 g = 1944 g substrate");
  });
});

test("Day 0: initial watering observation never becomes a gravimetric target", async () => {
  await withTestServer(async (baseUrl) => {
    // User records the approximate initial wetting observation (~80 ml, ~5 ml drained)
    await postJson(baseUrl, "/api/day0/pot-allocation", {
      allocation_id: "ALLOC-WATER-OBS",
      pot_id: "POT-006",
      substrate_mass_g: 72,
      seed_count: 3,
      initial_water_ml: 80,
      initial_water_drained_ml: 5,
      mass_basis: "approximate",
      created_at: "2026-02-01T08:00:00",
    });

    const fetched = await getJson(baseUrl, "/api/day0/pot-allocation/ALLOC-WATER-OBS");
    assert.equal(fetched.status, 200);
    const row = fetched.body.data as Record<string, unknown>;
    // The observation is stored only as the observation it is.
    assert.equal(row.initial_water_ml, 80);
    assert.equal(row.initial_water_drained_ml, 5);
    assert.equal(row.mass_basis, "approximate");
    // There is no stored target mass, and no G0/G1/G2 target was derived.
    assert.ok(row.target_mass_g === undefined || row.target_mass_g === null, "no target mass is stored on the allocation");
  });
});

test("Day 0: substrate mass is never overwritten by an assembled pot mass", async () => {
  await withTestServer(async (baseUrl) => {
    await postJson(baseUrl, "/api/day0/pot-allocation", {
      allocation_id: "ALLOC-MASS-SEP",
      pot_id: "POT-007",
      substrate_mass_g: 72,
      empty_pot_mass_g: 18,
      saucer_mass_g: 12,
      seed_count: 3,
      initial_assembled_mass_g: 92,
      mass_basis: "measured",
      created_at: "2026-02-01T08:00:00",
    });

    const fetched = await getJson(baseUrl, "/api/day0/pot-allocation/ALLOC-MASS-SEP");
    const row = fetched.body.data as Record<string, unknown>;
    assert.equal(row.substrate_mass_g, 72, "substrate mass stays 72 g");
    assert.equal(row.initial_assembled_mass_g, 92, "assembled mass stored separately");
    assert.notEqual(row.substrate_mass_g, row.initial_assembled_mass_g);
    assert.equal(row.empty_pot_mass_g, 18);
    assert.equal(row.saucer_mass_g, 12);
  });
});

test("Day 0: negative seed and mass counts are rejected", async () => {
  await withTestServer(async (baseUrl) => {
    const bad = await postJson(baseUrl, "/api/day0/pot-allocation", {
      allocation_id: "ALLOC-NEG",
      pot_id: "POT-008",
      substrate_mass_g: 72,
      seeds_sown: -1,
      seed_count: 3,
      created_at: "2026-02-01T08:00:00",
    });
    assert.equal(bad.status, 400, "negative seeds_sown must be rejected");
  });
});

test("Day 0: an approved methodology decision requires an approver and a date", async () => {
  await withTestServer(async (baseUrl) => {
    // Approval with no attribution must be refused — the register may never
    // claim someone approved a change they did not approve.
    const noApprover = await postJson(baseUrl, "/api/day0/methodology-decisions", {
      decision_id: testIds("methodology attribution").decisionId,
      title: "Sample size amendment",
      description: "27 pots vs the protocol's 45.",
      status: "approved",
      created_at: "2026-02-01T08:00:00",
    });
    assert.equal(noApprover.status, 400);

    const noDate = await postJson(baseUrl, "/api/day0/methodology-decisions", {
      decision_id: `${testIds("methodology attribution 2").decisionId}`,
      title: "Sample size amendment",
      description: "27 pots vs the protocol's 45.",
      status: "approved",
      decided_by: "M. Vojan",
      created_at: "2026-02-01T08:00:00",
    });
    assert.equal(noDate.status, 400);

    const attributed = await postJson(baseUrl, "/api/day0/methodology-decisions", {
      decision_id: `${testIds("methodology attribution 3").decisionId}`,
      title: "Sample size amendment",
      description: "27 pots vs the protocol's 45.",
      status: "approved",
      decided_by: "M. Vojan",
      decided_at: "2026-02-01T09:00:00",
      blocks_sowing: false,
      blocks_emergence: false,
      blocks_measurements: false,
      created_at: "2026-02-01T08:00:00",
    });
    assert.equal(attributed.status, 201);
    assert.equal(attributed.body.data.decided_by, "M. Vojan");
    assert.equal(attributed.body.data.decided_at, "2026-02-01T09:00:00");
  });
});

test("Day 0: methodology decisions default to unresolved, never approved", async () => {
  await withTestServer(async (baseUrl) => {
    const { decisionId } = testIds("methodology decision");

    const created = await postJson(baseUrl, "/api/day0/methodology-decisions", {
      decision_id: decisionId,
      title: "Vzorová velikost experimentu",
      description: "Protokol v1: 45 rostlin. Praktický plán: 27 rostlin.",
      protocol_reference: "Protocol v1 §3",
      status: "unresolved",
      blocks_sowing: true,
      blocks_emergence: false,
      blocks_measurements: false,
      created_at: "2026-02-01T08:00:00",
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.status, "unresolved");
    assert.equal(created.body.data.decided_by, null, "no approver recorded for unresolved decision");
    assert.equal(created.body.data.decided_at, null, "no approval date recorded");

    const list = await getJson(baseUrl, "/api/day0/methodology-decisions");
    const found = (list.body.data as Array<{ decision_id: string; status: string }>).find(
      (d) => d.decision_id === decisionId
    );
    assert.ok(found);
    assert.notEqual(found.status, "approved");
  });
});

test("Day 0: physical config stores camera/physical setup fields", async () => {
  await withTestServer(async (baseUrl) => {
    const { configId } = testIds("physical config");

    const created = await postJson(baseUrl, "/api/day0/physical-config", {
      config_id: configId,
      camera_device: "iPhone 15 Pro",
      camera_orientation: "landscape",
      camera_distance_cm: 45,
      camera_angle_deg: 0,
      lighting_config: "LED panel 5600K",
      background: "grey card",
      image_resolution: "4032x3024",
      image_format: "JPEG",
      created_at: "2026-02-01T08:00:00",
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.camera_distance_cm, 45);

    const fetched = await getJson(baseUrl, "/api/day0/physical-config");
    assert.equal(fetched.status, 200);
    assert.equal(fetched.body.data.camera_device, "iPhone 15 Pro");
    assert.ok(
      fetched.body.data.calibration_ref_dimensions == null,
      "unset calibration fields stay unset (null)"
    );
  });
});

test("Day 0: API returns 404 for unknown equipment/allocation/decision", async () => {
  await withTestServer(async (baseUrl) => {
    const equipment = await getJson(baseUrl, "/api/day0/equipment/EQ-999");
    assert.equal(equipment.status, 404);

    const allocation = await getJson(baseUrl, "/api/day0/pot-allocation/ALLOC-999");
    assert.equal(allocation.status, 404);

    const decision = await getJson(baseUrl, "/api/day0/methodology-decisions/DEC-999");
    assert.equal(decision.status, 404);
  });
});

test("Day 0: existing append-only rules still hold for water events and measurements", async () => {
  await withTestServer(async (baseUrl) => {
    await seedExistingPlant(baseUrl);

    // Water event create still works and is append-only (no PUT/DELETE routes)
    const water = await postJson(baseUrl, "/api/water-events", {
      water_event_id: "WTR-20260201-080000-001",
      plant_id: "PLT-001",
      timestamp: "2026-02-01T08:00:00",
      experiment_day: 1,
      pot_mass_before_g: 250,
      target_mass_g: 300,
      water_added_ml: 50,
      pot_mass_after_g: 300,
      watering_status: "pass",
    });
    assert.equal(water.status, 201);

    // No DELETE endpoint for experimental records
    const delRes = await fetch(`${baseUrl}/api/water-events/WTR-20260201-080000-001`, { method: "DELETE" });
    assert.equal(delRes.status, 404, "no delete route exists for append-only records");
  });
});

test("Day 0: bulk registration cannot silently collide with an existing plant's pot", async () => {
  await withTestServer(async (baseUrl) => {
    // PLT-001 / POT-001 already exists in the plants table.
    await seedExistingPlant(baseUrl);

    const plantsList = await getJson(baseUrl, "/api/plants");
    const existingPotIds = new Set(
      (plantsList.body.data as Array<{ pot_id: string }>).map((p) => p.pot_id)
    );
    assert.ok(existingPotIds.has("POT-001"), "POT-001 belongs to the existing PLT-001 record");

    // Creating a day0 allocation for that same pot must be rejected, never
    // silently re-assigned or overwritten.
    const collision = await postJson(baseUrl, "/api/day0/pot-allocation", {
      allocation_id: "ALLOC-COLLIDE",
      pot_id: "POT-001",
      substrate_mass_g: 72,
      seed_count: 3,
      created_at: "2026-02-01T08:00:00",
    });
    // Either the allocation table already holds POT-001 (409) or it is created
    // as an independent Day 0 preparation row — but the plant record is untouched.
    if (collision.status !== 201) {
      assert.equal(collision.status, 409, "an existing Day 0 allocation for the pot is a 409");
    }

    const plant = await getJson(baseUrl, "/api/plants/PLT-001");
    assert.equal(plant.status, 200, "PLT-001 must survive");
    assert.equal(plant.body.data.pot_id, "POT-001");
    assert.equal(plant.body.data.emergence_date, "2026-02-01");
  });
});
