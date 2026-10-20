/**
 * Worker behaviour tests.
 *
 * These run the real router against a real SQLite engine bound through the same
 * `D1Like` interface the Cloudflare D1 binding satisfies, plus an in-memory R2
 * stand-in. That validates the SQL, the constraints, the routes, the response
 * shapes and the error mapping.
 *
 * NOT proven here: Cloudflare D1 persistence, Cloudflare R2 durability and the
 * live deployment. Those are manual verification steps.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { handleRequest, type Env } from "./router.js";
import { MemoryR2, SqliteD1 } from "./testHarness.js";
import type { R2BucketLike } from "./r2Images.js";

const ORIGIN = "https://rocnikovka-ashy.vercel.app";

function makeEnv(): Env {
  return {
    DB: SqliteD1.fromMigrations() as unknown as Env["DB"],
    IMAGES: new MemoryR2() as unknown as R2BucketLike,
    ALLOWED_ORIGIN: ORIGIN,
  } as unknown as Env;
}

function jsonRequest(method: string, path: string, body?: unknown, origin = ORIGIN): Request {
  return new Request(`https://phytometer-api.workers.dev${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      origin,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function multipartRequest(path: string, form: FormData, origin = ORIGIN): Request {
  return new Request(`https://phytometer-api.workers.dev${path}`, {
    method: "POST",
    headers: { origin },
    body: form,
  });
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

const PLANT = {
  plant_id: "PLT-001",
  pot_id: "POT-001",
  group_name: "G1",
  exemplar_id: "EX01",
  treatment_percentage: 100,
  emergence_date: "2026-02-01",
  status: "active",
  created_at: "2026-02-01T08:00:00",
};

// ---------------------------------------------------------------------------
// Schema and migrations
// ---------------------------------------------------------------------------

test("schema: the deployed migrations install the expected v8 tables", async () => {
  const db = SqliteD1.fromMigrations();
  const { results } = await db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)
    .all<{ name: string }>();
  const names = results.map((r) => r.name).sort();
  assert.deepEqual(names, [
    "aicv_measurements",
    "audit_log",
    "day0_equipment",
    "day0_methodology_decisions",
    "day0_physical_config",
    "day0_pot_allocation",
    "image_records",
    "manual_measurements",
    "plants",
    "position_events",
    "schema_migrations",
    "validation_issues",
    "water_events",
  ]);
});

test("schema: the recorded migration version is 8", async () => {
  const db = SqliteD1.fromMigrations();
  const { results } = await db.prepare(`SELECT MAX(version) AS version FROM schema_migrations`).all<{ version: number }>();
  assert.equal(results[0].version, 8);
});

// ---------------------------------------------------------------------------
// Plants — CRUD, immutability, duplicates
// ---------------------------------------------------------------------------

test("plants: create and read back with identical values", async () => {
  const env = makeEnv();
  const created = await handleRequest(jsonRequest("POST", "/api/plants", PLANT), env);
  assert.equal(created.status, 201);
  const createdBody = await readJson(created);
  assert.equal((createdBody.data as Record<string, unknown>).plant_id, "PLT-001");

  const list = await handleRequest(jsonRequest("GET", "/api/plants"), env);
  const listBody = await readJson(list);
  const rows = listBody.data as Array<Record<string, unknown>>;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].pot_id, "POT-001");
});

test("plants: duplicate plant_id is rejected with 409", async () => {
  const env = makeEnv();
  await handleRequest(jsonRequest("POST", "/api/plants", PLANT), env);
  const duplicate = await handleRequest(jsonRequest("POST", "/api/plants", PLANT), env);
  assert.equal(duplicate.status, 409);
  const body = await readJson(duplicate);
  assert.equal((body.error as Record<string, unknown>).code, "id.duplicate");
});

test("plants: duplicate pot_id is rejected with 409", async () => {
  const env = makeEnv();
  await handleRequest(jsonRequest("POST", "/api/plants", PLANT), env);
  const clash = await handleRequest(
    jsonRequest("POST", "/api/plants", { ...PLANT, plant_id: "PLT-002" }),
    env
  );
  assert.equal(clash.status, 409);
});

test("plants: invalid group is rejected with 400", async () => {
  const env = makeEnv();
  const res = await handleRequest(
    jsonRequest("POST", "/api/plants", { ...PLANT, group_name: "G9" }),
    env
  );
  assert.equal(res.status, 400);
});

test("plants: invalid plant_id format is rejected with 400", async () => {
  const env = makeEnv();
  const res = await handleRequest(
    jsonRequest("POST", "/api/plants", { ...PLANT, plant_id: "PLANT-1" }),
    env
  );
  assert.equal(res.status, 400);
});

test("plants: immutable fields cannot be patched", async () => {
  const env = makeEnv();
  await handleRequest(jsonRequest("POST", "/api/plants", PLANT), env);
  const res = await handleRequest(
    jsonRequest("PATCH", "/api/plants/PLT-001", {
      pot_id: "POT-099",
      updated_at: "2026-02-02T08:00:00",
    }),
    env
  );
  assert.equal(res.status, 409);
  const body = await readJson(res);
  assert.equal((body.error as Record<string, unknown>).code, "field.immutable");
});

test("plants: a safe patch updates status and notes only", async () => {
  const env = makeEnv();
  await handleRequest(jsonRequest("POST", "/api/plants", PLANT), env);
  const res = await handleRequest(
    jsonRequest("PATCH", "/api/plants/PLT-001", {
      status: "damaged",
      notes: "leaf punctured",
      updated_at: "2026-02-02T08:00:00",
    }),
    env
  );
  assert.equal(res.status, 200);
  const body = await readJson(res);
  const data = body.data as Record<string, unknown>;
  assert.equal(data.status, "damaged");
  assert.equal(data.notes, "leaf punctured");
  // Immutable fields are untouched.
  assert.equal(data.pot_id, "POT-001");
  assert.equal(data.emergence_date, "2026-02-01");
});

test("plants: an unknown plant read is 404, not an empty success", async () => {
  const env = makeEnv();
  const res = await handleRequest(jsonRequest("GET", "/api/plants/PLT-999"), env);
  assert.equal(res.status, 404);
});

// ---------------------------------------------------------------------------
// Day 0 — equipment
// ---------------------------------------------------------------------------

test("day0 equipment: prepopulated rows are not verified by default", async () => {
  const env = makeEnv();
  const res = await handleRequest(
    jsonRequest("POST", "/api/day0/equipment", {
      equipment_id: "EQ-1717234800-001",
      name: "Květináče",
      category: "Základní vybavení",
      quantity: 27,
      unit: "ks",
      is_prepopulated: true,
      created_at: "2026-02-01T08:00:00",
    }),
    env
  );
  assert.equal(res.status, 201);
  const body = await readJson(res);
  const data = body.data as Record<string, unknown>;
  assert.equal(data.verified, false, "prepopulated equipment must not be auto-verified");
  assert.equal(data.is_prepopulated, true);
});

test("day0 equipment: verification can be set explicitly", async () => {
  const env = makeEnv();
  await handleRequest(
    jsonRequest("POST", "/api/day0/equipment", {
      equipment_id: "EQ-1717234801-001",
      name: "Váha",
      category: "Měřicí přístroje",
      quantity: 1,
      created_at: "2026-02-01T08:00:00",
    }),
    env
  );
  const res = await handleRequest(
    jsonRequest("PATCH", "/api/day0/equipment/EQ-1717234801-001", { verified: true }),
    env
  );
  assert.equal(res.status, 200);
  const body = await readJson(res);
  assert.equal((body.data as Record<string, unknown>).verified, true);
});

test("day0 equipment: negative quantity is rejected", async () => {
  const env = makeEnv();
  const res = await handleRequest(
    jsonRequest("POST", "/api/day0/equipment", {
      equipment_id: "EQ-1717234802-001",
      name: "Bad",
      category: "Test",
      quantity: -5,
      created_at: "2026-02-01T08:00:00",
    }),
    env
  );
  assert.equal(res.status, 400);
});

// ---------------------------------------------------------------------------
// Day 0 — pot allocation: 3 seeds, 72 g substrate, plan vs actual
// ---------------------------------------------------------------------------

test("pot allocation: planned seed count defaults to 3 and substrate to 72 g", async () => {
  const env = makeEnv();
  const res = await handleRequest(
    jsonRequest("POST", "/api/day0/pot-allocation", {
      allocation_id: "ALLOC-1717234800-001",
      pot_id: "POT-028",
      group_name: "G1",
      created_at: "2026-02-01T08:00:00",
    }),
    env
  );
  assert.equal(res.status, 201);
  const body = await readJson(res);
  const data = body.data as Record<string, unknown>;
  assert.equal(data.seed_count, 3, "planned seeds default to 3 per pot");
  assert.equal(data.substrate_mass_g, 72, "substrate mass defaults to 72 g");
  assert.equal(data.mass_basis, "unknown");
  assert.equal(data.sowing_status, "pending");
  assert.equal(data.emergence_status, "not_sown");
  // Actual observations are never fabricated.
  assert.equal(data.seeds_sown, null);
  assert.equal(data.seedlings_emerged, null);
  assert.equal(data.plants_retained, null);
  assert.equal(data.sowing_date, null);
  assert.equal(data.emergence_date, null);
});

test("pot allocation: 27 pots x 3 planned seeds = 81, 9 per group", async () => {
  const env = makeEnv();
  for (let i = 0; i < 27; i++) {
    const n = i + 1;
    const group = n <= 9 ? "G0" : n <= 18 ? "G1" : "G2";
    const body = {
      allocation_id: `ALLOC-171723480${String(i % 10)}-${String(n).padStart(3, "0")}`,
      pot_id: `POT-${String(28 + i).padStart(3, "0")}`,
      group_name: group,
      created_at: "2026-02-01T08:00:00",
    };
    const res = await handleRequest(
      jsonRequest("POST", "/api/day0/pot-allocation", body),
      env
    );
    if (res.status !== 201) {
      const text = await res.text();
      console.error(`DEBUG: Iteration ${i}, group=${group}, body=`, JSON.stringify(body), `status=${res.status}, response=`, text);
      throw new Error(`Iteration ${i}: group=${group}, status=${res.status}, body=${text}`);
    }
    assert.equal(res.status, 201);
  }
  const list = await handleRequest(jsonRequest("GET", "/api/day0/pot-allocation"), env);
  const rows = (await readJson(list)).data as Array<Record<string, unknown>>;
  assert.equal(rows.length, 27);
  const g0 = rows.filter((r) => r.group_name === "G0").length;
  const g1 = rows.filter((r) => r.group_name === "G1").length;
  const g2 = rows.filter((r) => r.group_name === "G2").length;
  assert.equal(g0, 9);
  assert.equal(g1, 9);
  assert.equal(g2, 9);
  const seeds = rows.reduce((sum, r) => sum + (r.seed_count as number), 0);
  assert.equal(seeds, 81);
  const substrate = rows.reduce((sum, r) => sum + (r.substrate_mass_g as number), 0);
  assert.equal(substrate, 1944, "27 x 72 g substrate");
});

test("pot allocation: planned, sown, emerged and retained stay distinct", async () => {
  const env = makeEnv();
  await handleRequest(
    jsonRequest("POST", "/api/day0/pot-allocation", {
      allocation_id: "ALLOC-1717234900-001",
      pot_id: "POT-055",
      created_at: "2026-02-01T08:00:00",
    }),
    env
  );

  const sown = await handleRequest(
    jsonRequest("PATCH", "/api/day0/pot-allocation/ALLOC-1717234900-001", {
      sowing_date: "2026-03-01",
      sowing_status: "sown",
      emergence_status: "awaiting",
      seeds_sown: 3,
    }),
    env
  );
  assert.equal(sown.status, 200);
  let data = (await readJson(sown)).data as Record<string, unknown>;
  assert.equal(data.seed_count, 3, "planned count unchanged");
  assert.equal(data.seeds_sown, 3);
  assert.equal(data.seedlings_emerged, null);
  assert.equal(data.emergence_date, null, "emergence date is not derived from sowing");

  const emerged = await handleRequest(
    jsonRequest("PATCH", "/api/day0/pot-allocation/ALLOC-1717234900-001", {
      emergence_status: "emerged",
      emergence_date: "2026-03-06",
      seedlings_emerged: 2,
    }),
    env
  );
  assert.equal(emerged.status, 200);
  data = (await readJson(emerged)).data as Record<string, unknown>;
  assert.equal(data.seedlings_emerged, 2);
  assert.equal(data.plants_retained, null, "no automatic thinning");
  assert.equal(data.sowing_date, "2026-03-01", "sowing date preserved");
  assert.equal(data.emergence_date, "2026-03-06");

  const retained = await handleRequest(
    jsonRequest("PATCH", "/api/day0/pot-allocation/ALLOC-1717234900-001", { plants_retained: 1 }),
    env
  );
  data = (await readJson(retained)).data as Record<string, unknown>;
  assert.equal(data.plants_retained, 1);
  assert.equal(data.seed_count, 3);
  assert.equal(data.seeds_sown, 3);
});

test("pot allocation: duplicate pot_id is rejected with 409", async () => {
  const env = makeEnv();
  await handleRequest(
    jsonRequest("POST", "/api/day0/pot-allocation", {
      allocation_id: "ALLOC-1717235000-001",
      pot_id: "POT-056",
      created_at: "2026-02-01T08:00:00",
    }),
    env
  );
  const res = await handleRequest(
    jsonRequest("POST", "/api/day0/pot-allocation", {
      allocation_id: "ALLOC-1717235000-002",
      pot_id: "POT-056",
      created_at: "2026-02-01T08:00:00",
    }),
    env
  );
  assert.equal(res.status, 409);
});

test("pot allocation: negative observations are rejected", async () => {
  const env = makeEnv();
  const res = await handleRequest(
    jsonRequest("POST", "/api/day0/pot-allocation", {
      allocation_id: "ALLOC-1717235100-001",
      pot_id: "POT-057",
      seeds_sown: -1,
      created_at: "2026-02-01T08:00:00",
    }),
    env
  );
  assert.equal(res.status, 400);
});

test("pot allocation: substrate mass is never replaced by an assembled mass", async () => {
  const env = makeEnv();
  const res = await handleRequest(
    jsonRequest("POST", "/api/day0/pot-allocation", {
      allocation_id: "ALLOC-1717235200-001",
      pot_id: "POT-058",
      substrate_mass_g: 72,
      empty_pot_mass_g: 18,
      saucer_mass_g: 12,
      initial_assembled_mass_g: 92,
      mass_basis: "approximate",
      created_at: "2026-02-01T08:00:00",
    }),
    env
  );
  assert.equal(res.status, 201);
  const data = (await readJson(res)).data as Record<string, unknown>;
  assert.equal(data.substrate_mass_g, 72, "72 g remains substrate only");
  assert.equal(data.initial_assembled_mass_g, 92, "assembled mass is stored separately");
  assert.equal(data.mass_basis, "approximate");
});

// ---------------------------------------------------------------------------
// Day 0 — planned watering volumes
// ---------------------------------------------------------------------------

test("planned watering volumes persist and are editable, separately from events", async () => {
  const env = makeEnv();
  const created = await handleRequest(
    jsonRequest("POST", "/api/day0/physical-config", {
      config_id: "CFG-1717235300",
      planned_water_ml_g0: 75,
      planned_water_ml_g1: 64,
      planned_water_ml_g2: 53,
      created_at: "2026-02-01T08:00:00",
    }),
    env
  );
  assert.equal(created.status, 201);
  let data = (await readJson(created)).data as Record<string, unknown>;
  assert.equal(data.planned_water_ml_g0, 75);
  assert.equal(data.planned_water_ml_g1, 64);
  assert.equal(data.planned_water_ml_g2, 53);

  const edited = await handleRequest(
    jsonRequest("PATCH", "/api/day0/physical-config", { planned_water_ml_g1: 60 }),
    env
  );
  assert.equal(edited.status, 200);
  data = (await readJson(edited)).data as Record<string, unknown>;
  assert.equal(data.planned_water_ml_g1, 60);
  assert.equal(data.planned_water_ml_g0, 75, "other planned volumes untouched");
});

test("planned watering volumes never create a water event or a target mass", async () => {
  const env = makeEnv();
  await handleRequest(
    jsonRequest("POST", "/api/day0/physical-config", {
      config_id: "CFG-1717235400",
      planned_water_ml_g0: 75,
      planned_water_ml_g1: 64,
      planned_water_ml_g2: 53,
      created_at: "2026-02-01T08:00:00",
    }),
    env
  );

  // No watering event was produced by the plan.
  const events = await handleRequest(jsonRequest("GET", "/api/water-events"), env);
  const rows = (await readJson(events)).data as unknown[];
  assert.equal(rows.length, 0, "a plan must never create a watering event");

  // No pot carries a derived gravimetric target mass.
  const alloc = await handleRequest(
    jsonRequest("POST", "/api/day0/pot-allocation", {
      allocation_id: "ALLOC-1717235500-001",
      pot_id: "POT-059",
      group_name: "G1",
      created_at: "2026-02-01T08:00:00",
    }),
    env
  );
  const data = (await readJson(alloc)).data as Record<string, unknown>;
  assert.ok(!("target_mass_g" in data), "no target mass may be derived from a planned volume");
  assert.equal(data.initial_water_ml, null, "the plan is not written as an actual observation");
});

test("planned watering volumes reject negative values", async () => {
  const env = makeEnv();
  const res = await handleRequest(
    jsonRequest("POST", "/api/day0/physical-config", {
      config_id: "CFG-1717235600",
      planned_water_ml_g0: -1,
      created_at: "2026-02-01T08:00:00",
    }),
    env
  );
  assert.equal(res.status, 400);
});

// ---------------------------------------------------------------------------
// Day 0 — methodology decisions
// ---------------------------------------------------------------------------

test("methodology decisions are seeded unresolved and never approved", async () => {
  const env = makeEnv();
  const res = await handleRequest(
    jsonRequest("POST", "/api/day0/methodology-decisions", {
      decision_id: "DEC-1717235700-001",
      title: "Vzorová velikost experimentu",
      description: "Protokol v1: 45 rostlin. Praktický plán: 27 květináčů.",
      protocol_reference: "Protocol v1 §3",
      status: "unresolved",
      blocks_sowing: true,
      created_at: "2026-02-01T08:00:00",
    }),
    env
  );
  assert.equal(res.status, 201);
  const data = (await readJson(res)).data as Record<string, unknown>;
  assert.equal(data.status, "unresolved");
  assert.equal(data.decided_by, null, "no approver may be recorded for an unresolved decision");
  assert.equal(data.decided_at, null, "no approval date may be recorded");
  assert.equal(data.blocks_sowing, true, "boolean flags are exposed as booleans");
});

test("methodology decisions reject an approval without an approver", async () => {
  const env = makeEnv();
  const res = await handleRequest(
    jsonRequest("POST", "/api/day0/methodology-decisions", {
      decision_id: "DEC-1717235800-001",
      title: "Bad approval",
      description: "Marked approved with no decider.",
      status: "approved",
      created_at: "2026-02-01T08:00:00",
    }),
    env
  );
  assert.equal(res.status, 400, "an approval with no approver must be refused");
});

test("methodology decisions can be approved explicitly with an approver", async () => {
  const env = makeEnv();
  await handleRequest(
    jsonRequest("POST", "/api/day0/methodology-decisions", {
      decision_id: "DEC-1717235900-001",
      title: "Frekvence rotace",
      description: "Týdenní rotace.",
      status: "unresolved",
      created_at: "2026-02-01T08:00:00",
    }),
    env
  );
  const res = await handleRequest(
    jsonRequest("PATCH", "/api/day0/methodology-decisions/DEC-1717235900-001", {
      status: "approved",
      decided_by: "M. Vojan",
      decided_at: "2026-02-01T09:00:00",
      decision: "Týdenní rotace",
    }),
    env
  );
  assert.equal(res.status, 200);
  const data = (await readJson(res)).data as Record<string, unknown>;
  assert.equal(data.status, "approved");
  assert.equal(data.decided_by, "M. Vojan");
});

// ---------------------------------------------------------------------------
// Measurements — append-only, traceability
// ---------------------------------------------------------------------------

test("manual measurements: G2 traceability rejects a mismatched plant", async () => {
  const env = makeEnv();
  await handleRequest(jsonRequest("POST", "/api/plants", PLANT), env);
  await handleRequest(
    jsonRequest("POST", "/api/plants", {
      ...PLANT,
      plant_id: "PLT-002",
      pot_id: "POT-002",
    }),
    env
  );
  await handleRequest(
    jsonRequest("POST", "/api/images", {
      image_id: "IMG-20260201-080000-000",
      plant_id: "PLT-001",
      timestamp: "2026-02-01T08:00:00",
      experiment_day: 1,
      image_path: "images/IMG-20260201-080000-000.jpg",
      camera_id: "CAM-01",
      image_quality_status: "PASS",
      calibration_status: "pass",
      created_at: undefined,
    }),
    env
  );

  // Measurement claims the image belongs to PLT-002 — traceability violation.
  const res = await handleRequest(
    jsonRequest("POST", "/api/manual-measurements", {
      measurement_id: "MSR-MAN-20260201-080000-000",
      plant_id: "PLT-002",
      image_id: "IMG-20260201-080000-000",
      timestamp: "2026-02-01T08:00:00",
      experiment_day: 1,
      repetition: 1,
      observer: "M. Vojan",
      measurement_status: "pass",
      plant_height_cm: 12.4,
    }),
    env
  );
  assert.equal(res.status, 409, "a plant/image traceability mismatch is a reference conflict");
  const body = await readJson(res);
  assert.equal((body.error as Record<string, unknown>).code, "reference.invalid");
});

test("manual measurements: a valid measurement is accepted and traceable", async () => {
  const env = makeEnv();
  await handleRequest(jsonRequest("POST", "/api/plants", PLANT), env);
  await handleRequest(
    jsonRequest("POST", "/api/manual-measurements", {
      measurement_id: "MSR-MAN-20260201-080000-001",
      plant_id: "PLT-001",
      timestamp: "2026-02-01T08:00:00",
      experiment_day: 1,
      repetition: 2,
      observer: "M. Vojan",
      measurement_status: "pass",
      plant_height_cm: 12.4,
    }),
    env
  );
  assert.equal(
    (await handleRequest(jsonRequest("GET", "/api/manual-measurements"), env)).status,
    200
  );
});

test("measurements: no DELETE or PUT route exists (append-only)", async () => {
  const env = makeEnv();
  const del = await handleRequest(
    jsonRequest("DELETE", "/api/manual-measurements/MSR-MAN-20260201-080000-001"),
    env
  );
  assert.equal(del.status, 404);

  const put = await handleRequest(
    jsonRequest("PUT", "/api/water-events/WTR-20260201-080000-001", {}),
    env
  );
  assert.equal(put.status, 404);
});

test("measurements: a failed experiment_day is rejected by the CHECK constraint", async () => {
  const env = makeEnv();
  await handleRequest(jsonRequest("POST", "/api/plants", PLANT), env);
  const res = await handleRequest(
    jsonRequest("POST", "/api/manual-measurements", {
      measurement_id: "MSR-MAN-20260201-080000-002",
      plant_id: "PLT-001",
      timestamp: "2026-02-01T08:00:00",
      experiment_day: 0,
      repetition: 1,
      observer: "M. Vojan",
      measurement_status: "pass",
      plant_height_cm: 12,
    }),
    env
  );
  assert.equal(res.status, 400, "experiment_day must be >= 1");
});

// ---------------------------------------------------------------------------
// Water events — actual observations only
// ---------------------------------------------------------------------------

test("water events require an explicit target mass supplied by the user", async () => {
  const env = makeEnv();
  await handleRequest(jsonRequest("POST", "/api/plants", PLANT), env);
  const res = await handleRequest(
    jsonRequest("POST", "/api/water-events", {
      water_event_id: "WTR-20260201-080000-001",
      plant_id: "PLT-001",
      timestamp: "2026-02-01T08:00:00",
      experiment_day: 1,
      pot_mass_before_g: 250,
      target_mass_g: 300,
      water_added_ml: 50,
      pot_mass_after_g: 300,
      watering_status: "pass",
    }),
    env
  );
  assert.equal(res.status, 201);
  const data = (await readJson(res)).data as Record<string, unknown>;
  assert.equal(data.target_mass_g, 300, "the target mass is exactly what the user supplied");
});

test("water events: a missing plant reference is a 409", async () => {
  const env = makeEnv();
  const res = await handleRequest(
    jsonRequest("POST", "/api/water-events", {
      water_event_id: "WTR-20260201-080000-002",
      plant_id: "PLT-999",
      timestamp: "2026-02-01T08:00:00",
      experiment_day: 1,
      pot_mass_before_g: 250,
      target_mass_g: 300,
      water_added_ml: 50,
      pot_mass_after_g: 300,
      watering_status: "pass",
    }),
    env
  );
  assert.equal(res.status, 409);
});

// ---------------------------------------------------------------------------
// Images — R2 storage and controlled retrieval
// ---------------------------------------------------------------------------

test("images: upload stores bytes in R2 and metadata in D1", async () => {
  const env = makeEnv();
  await handleRequest(jsonRequest("POST", "/api/plants", PLANT), env);

  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const form = new FormData();
  form.append("file", new File([bytes], "frame.jpg", { type: "image/jpeg" }));
  form.append("plant_id", "PLT-001");
  form.append("timestamp", "2026-02-01T08:00:00");
  form.append("experiment_day", "1");
  form.append("camera_id", "CAM-01");
  form.append("image_quality_status", "PASS");
  form.append("calibration_status", "pass");

  const res = await handleRequest(multipartRequest("/api/images/upload", form), env);
  assert.equal(res.status, 201);
  const data = (await readJson(res)).data as Record<string, unknown>;
  const imageId = data.image_id as string;
  assert.match(imageId, /^IMG-\d{8}-\d{6}-\d{3}$/, "image id must follow the existing convention");

  const key = data.image_path as string;
  assert.equal(key, `images/${imageId}.jpg`);

  // Bytes are in R2 under the D1-recorded key.
  const r2 = env.IMAGES as unknown as MemoryR2;
  assert.equal(r2.objects.has(key), true, "image bytes must be stored in R2");
  assert.equal(r2.objects.get(key)!.bytes.byteLength, bytes.length);

  // Retrieval returns the exact bytes.
  const served = await handleRequest(jsonRequest("GET", `/api/images/${imageId}/file`), env);
  assert.equal(served.status, 200);
  const servedBytes = new Uint8Array(await served.arrayBuffer());
  assert.deepEqual(servedBytes, bytes);
  assert.equal(served.headers.get("content-type"), "image/jpeg");
});

test("images: a disallowed content type is rejected with 400", async () => {
  const env = makeEnv();
  await handleRequest(jsonRequest("POST", "/api/plants", PLANT), env);

  const form = new FormData();
  form.append("file", new File([new Uint8Array([1, 2, 3])], "payload.bin", { type: "application/octet-stream" }));
  form.append("plant_id", "PLT-001");
  form.append("timestamp", "2026-02-01T08:00:00");
  form.append("experiment_day", "1");
  form.append("camera_id", "CAM-01");
  form.append("image_quality_status", "PASS");
  form.append("calibration_status", "pass");

  const res = await handleRequest(multipartRequest("/api/images/upload", form), env);
  assert.equal(res.status, 400);
});

test("images: an oversized upload is rejected with 413", async () => {
  const env = makeEnv();
  await handleRequest(jsonRequest("POST", "/api/plants", PLANT), env);

  const big = new Uint8Array(21 * 1024 * 1024);
  const form = new FormData();
  form.append("file", new File([big], "huge.jpg", { type: "image/jpeg" }));
  form.append("plant_id", "PLT-001");
  form.append("timestamp", "2026-02-01T08:00:00");
  form.append("experiment_day", "1");
  form.append("camera_id", "CAM-01");
  form.append("image_quality_status", "PASS");
  form.append("calibration_status", "pass");

  const res = await handleRequest(multipartRequest("/api/images/upload", form), env);
  assert.equal(res.status, 413);
});

test("images: a missing image is 404, never an empty body", async () => {
  const env = makeEnv();
  const res = await handleRequest(jsonRequest("GET", "/api/images/IMG-20260201-080000-999/file"), env);
  assert.equal(res.status, 404);
});

test("images: a path traversal attempt cannot reach an arbitrary bucket key", async () => {
  const env = makeEnv();
  const res = await handleRequest(
    jsonRequest("GET", `/api/images/${encodeURIComponent("../../secrets")}/file`),
    env
  );
  assert.equal(res.status, 404);
});

test("images: an unknown image metadata read is 404", async () => {
  const env = makeEnv();
  const res = await handleRequest(jsonRequest("GET", "/api/images/IMG-20260201-080000-999"), env);
  assert.equal(res.status, 404);
});

test("images: duplicate image_id for the same second is resolved by an ordinal", async () => {
  const env = makeEnv();
  await handleRequest(jsonRequest("POST", "/api/plants", PLANT), env);

  const upload = async () => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array([1])], "f.jpg", { type: "image/jpeg" }));
    form.append("plant_id", "PLT-001");
    form.append("timestamp", "2026-02-01T08:00:00");
    form.append("experiment_day", "1");
    form.append("camera_id", "CAM-01");
    form.append("image_quality_status", "PASS");
    form.append("calibration_status", "pass");
    return handleRequest(multipartRequest("/api/images/upload", form), env);
  };

  const first = await upload();
  const second = await upload();
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  const id1 = ((await readJson(first)).data as Record<string, unknown>).image_id;
  const id2 = ((await readJson(second)).data as Record<string, unknown>).image_id;
  assert.notEqual(id1, id2, "ids must be distinct");
  assert.deepEqual([id1, id2].sort(), ["IMG-20260201-080000-000", "IMG-20260201-080000-001"]);
});

// ---------------------------------------------------------------------------
// Day context
// ---------------------------------------------------------------------------

test("day context is derived from persisted records, never a timestamp", async () => {
  const env = makeEnv();
  await handleRequest(jsonRequest("POST", "/api/plants", PLANT), env);
  await handleRequest(
    jsonRequest("POST", "/api/water-events", {
      water_event_id: "WTR-20260201-080000-010",
      plant_id: "PLT-001",
      timestamp: "2026-02-05T09:00:00",
      experiment_day: 4,
      pot_mass_before_g: 250,
      target_mass_g: 300,
      water_added_ml: 50,
      pot_mass_after_g: 300,
      watering_status: "pass",
    }),
    env
  );

  const res = await handleRequest(jsonRequest("GET", "/api/plants/PLT-001/day-context"), env);
  assert.equal(res.status, 200);
  const data = (await readJson(res)).data as Record<string, unknown>;
  assert.equal(data.last_recorded_day, 4);
  assert.equal(data.expected_next_day, 5);
});

test("day context for an unknown plant is 404", async () => {
  const env = makeEnv();
  const res = await handleRequest(jsonRequest("GET", "/api/plants/PLT-999/day-context"), env);
  assert.equal(res.status, 404);
});

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

test("CORS: the configured origin is echoed", async () => {
  const env = makeEnv();
  const res = await handleRequest(jsonRequest("GET", "/api/plants", undefined, ORIGIN), env);
  assert.equal(res.headers.get("access-control-allow-origin"), ORIGIN);
});

test("CORS: a disallowed origin is not granted access", async () => {
  const env = makeEnv();
  const res = await handleRequest(jsonRequest("GET", "/api/plants", undefined, "https://evil.example.com"), env);
  assert.notEqual(res.headers.get("access-control-allow-origin"), "https://evil.example.com");
  assert.equal(res.headers.get("access-control-allow-origin"), "");
});

test("CORS: preflight is answered with 204 and allowed methods", async () => {
  const env = makeEnv();
  const res = await handleRequest(
    new Request("https://phytometer-api.workers.dev/api/plants", {
      method: "OPTIONS",
      headers: { origin: ORIGIN },
    }),
    env
  );
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-allow-origin"), ORIGIN);
  assert.match(res.headers.get("access-control-allow-methods") ?? "", /GET/);
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

test("errors: malformed JSON is 400, never a false success", async () => {
  const env = makeEnv();
  const res = await handleRequest(
    new Request("https://phytometer-api.workers.dev/api/plants", {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: "{not json",
    }),
    env
  );
  assert.equal(res.status, 400);
});

test("errors: an unknown route is 404", async () => {
  const env = makeEnv();
  const res = await handleRequest(jsonRequest("GET", "/api/does-not-exist"), env);
  assert.equal(res.status, 404);
});

test("errors: a missing required field is 400", async () => {
  const env = makeEnv();
  const res = await handleRequest(
    jsonRequest("POST", "/api/plants", {
      pot_id: "POT-001",
      group_name: "G1",
      emergence_date: "2026-02-01",
      status: "active",
      created_at: "2026-02-01T08:00:00",
    }),
    env
  );
  assert.equal(res.status, 400);
});

test("health: the health probe reports ok", async () => {
  const env = makeEnv();
  const res = await handleRequest(jsonRequest("GET", "/api/health"), env);
  assert.equal(res.status, 200);
});

// ---------------------------------------------------------------------------
// Pagination of list endpoints (D1 row-read budget protection)
// ---------------------------------------------------------------------------

async function seedPlants(env: Env, count: number): Promise<void> {
  for (let i = 1; i <= count; i++) {
    const res = await handleRequest(
      jsonRequest("POST", "/api/plants", {
        plant_id: `PLT-${String(i).padStart(3, "0")}`,
        pot_id: `POT-${String(i).padStart(3, "0")}`,
        group_name: i <= 9 ? "G0" : i <= 18 ? "G1" : "G2",
        exemplar_id: "EX01",
        treatment_percentage: 100,
        emergence_date: "2026-02-01",
        status: "active",
        created_at: `2026-02-01T08:00:${String(i).padStart(2, "0")}`,
      }),
      env
    );
    assert.equal(res.status, 201);
  }
}

test("pagination: default limit is 50 and meta is returned alongside data", async () => {
  const env = makeEnv();
  await seedPlants(env, 7);

  const res = await handleRequest(jsonRequest("GET", "/api/plants"), env);
  assert.equal(res.status, 200);
  const body = await readJson(res);
  const rows = body.data as Array<Record<string, unknown>>;
  assert.equal(rows.length, 7, "fewer rows than the limit returns all of them");

  const meta = body.meta as Record<string, unknown>;
  assert.equal(meta.total, 7);
  assert.equal(meta.limit, 50, "default limit is 50");
  assert.equal(meta.offset, 0);
  assert.equal(meta.has_more, false);
  assert.equal(meta.returned, 7);
});

test("pagination: limit caps the returned page and reports has_more", async () => {
  const env = makeEnv();
  await seedPlants(env, 7);

  const res = await handleRequest(jsonRequest("GET", "/api/plants?limit=3"), env);
  const body = await readJson(res);
  assert.equal((body.data as unknown[]).length, 3);
  const meta = body.meta as Record<string, unknown>;
  assert.equal(meta.total, 7);
  assert.equal(meta.limit, 3);
  assert.equal(meta.has_more, true, "7 rows with a 3-row page means more pages");
  assert.equal(meta.returned, 3);
});

test("pagination: offset returns a later page", async () => {
  const env = makeEnv();
  await seedPlants(env, 7);

  const res = await handleRequest(jsonRequest("GET", "/api/plants?limit=3&offset=6"), env);
  const body = await readJson(res);
  const rows = body.data as Array<Record<string, unknown>>;
  assert.equal(rows.length, 1, "the last page holds the remaining row");
  const meta = body.meta as Record<string, unknown>;
  assert.equal(meta.has_more, false, "the final page has no more");
  assert.equal(meta.returned, 1);
});

test("pagination: offset past the end returns an empty page, not an error", async () => {
  const env = makeEnv();
  await seedPlants(env, 3);
  const res = await handleRequest(jsonRequest("GET", "/api/plants?limit=10&offset=50"), env);
  assert.equal(res.status, 200);
  const body = await readJson(res);
  assert.equal((body.data as unknown[]).length, 0);
  assert.equal((body.meta as Record<string, unknown>).has_more, false);
});

test("pagination: limit above the 200 maximum is rejected with 400", async () => {
  const env = makeEnv();
  const res = await handleRequest(jsonRequest("GET", "/api/plants?limit=201"), env);
  assert.equal(res.status, 400);
});

test("pagination: a non-numeric or negative limit is rejected with 400", async () => {
  const env = makeEnv();
  for (const query of ["limit=abc", "limit=0", "limit=-5", "offset=-1", "offset=abc"]) {
    const res = await handleRequest(jsonRequest("GET", `/api/plants?${query}`), env);
    assert.equal(res.status, 400, `${query} must be rejected`);
  }
});

test("pagination: every list endpoint accepts the same parameters", async () => {
  const env = makeEnv();
  const endpoints = [
    "/api/plants",
    "/api/water-events",
    "/api/position-events",
    "/api/images",
    "/api/manual-measurements",
    "/api/aicv-measurements",
    "/api/day0/equipment",
    "/api/day0/pot-allocation",
    "/api/day0/methodology-decisions",
  ];
  for (const endpoint of endpoints) {
    const res = await handleRequest(jsonRequest("GET", `${endpoint}?limit=10&offset=0`), env);
    assert.equal(res.status, 200, `${endpoint} must accept pagination`);
    const body = await readJson(res);
    assert.ok("data" in body, `${endpoint} must keep the data contract`);
    assert.ok("meta" in body, `${endpoint} must return meta`);
  }
});

test("pagination: an invalid limit is rejected on every list endpoint", async () => {
  const env = makeEnv();
  for (const endpoint of ["/api/plants", "/api/water-events", "/api/day0/pot-allocation"]) {
    const res = await handleRequest(jsonRequest("GET", `${endpoint}?limit=9999`), env);
    assert.equal(res.status, 400, `${endpoint} must validate the limit`);
  }
});

test("CORS: Access-Control-Allow-Credentials is present on a normal GET", async () => {
  const env = makeEnv();
  const res = await handleRequest(jsonRequest("GET", "/api/plants"), env);
  assert.equal(
    res.headers.get("access-control-allow-credentials"),
    "true",
    "without this header the browser drops the credentialed Access response"
  );
  // A specific origin is mandatory when credentials are allowed.
  assert.equal(res.headers.get("access-control-allow-origin"), ORIGIN);
  assert.notEqual(res.headers.get("access-control-allow-origin"), "*");
});

// ---------------------------------------------------------------------------
// Partial update regression: an absent field must not clobber a stored value
// ---------------------------------------------------------------------------

test("plants: a notes-only PATCH keeps the stored status", async () => {
  const env = makeEnv();
  await handleRequest(jsonRequest("POST", "/api/plants", PLANT), env);

  const res = await handleRequest(
    jsonRequest("PATCH", "/api/plants/PLT-001", { notes: "jen poznanka", updated_at: "2026-02-02T08:00:00" }),
    env
  );
  assert.equal(res.status, 200, "updating notes alone must not fail validation");
  const data = (await readJson(res)).data as Record<string, unknown>;
  assert.equal(data.status, "active", "the stored status must be preserved");
  assert.equal(data.notes, "jen poznanka");
  assert.equal(data.updated_at, "2026-02-02T08:00:00");
});

test("plants: a status-only PATCH keeps the stored notes", async () => {
  const env = makeEnv();
  await handleRequest(jsonRequest("POST", "/api/plants", PLANT), env);
  await handleRequest(
    jsonRequest("PATCH", "/api/plants/PLT-001", { notes: "puvodni", updated_at: "2026-02-02T08:00:00" }),
    env
  );

  const res = await handleRequest(
    jsonRequest("PATCH", "/api/plants/PLT-001", { status: "damaged", updated_at: "2026-02-03T08:00:00" }),
    env
  );
  assert.equal(res.status, 200);
  const data = (await readJson(res)).data as Record<string, unknown>;
  assert.equal(data.status, "damaged");
  assert.equal(data.notes, "puvodni", "the stored note must survive a status-only patch");
});

test("plants: immutable fields are still refused regardless of the other fields", async () => {
  const env = makeEnv();
  await handleRequest(jsonRequest("POST", "/api/plants", PLANT), env);
  const res = await handleRequest(
    jsonRequest("PATCH", "/api/plants/PLT-001", {
      group_name: "G2",
      notes: "pokus o zmenu skupiny",
      updated_at: "2026-02-02T08:00:00",
    }),
    env
  );
  assert.equal(res.status, 409);
  const body = await readJson(res);
  assert.equal((body.error as Record<string, unknown>).code, "field.immutable");
});

// ---------------------------------------------------------------------------
// SECURITY BOUNDARY — explicit contract
//
// Cloudflare Access enforces identity at Cloudflare's edge, BEFORE the Worker
// runs. Therefore the application layer deliberately does NOT authenticate:
// it validates, enforces referential integrity and stays append-only, but it
// does not decide who may write. That decision belongs to Access.
//
// These tests document that contract so it cannot change silently. If a future
// change makes the Worker itself authenticate, these tests fail and the
// deployment must then be re-verified against Access.
// ---------------------------------------------------------------------------

test("security boundary: the Worker does not authenticate — Access must be the gate", async () => {
  // A request with no Origin, no cookies and no credentials reaches the app
  // layer unchanged. Proving this makes the boundary explicit: if this ever
  // returns 401/403, the app has started enforcing identity itself and the
  // Access rollout must be re-planned.
  const env = makeEnv();
  const bare = new Request("https://phytometer-api.workers.dev/api/plants", { method: "GET" });
  const res = await handleRequest(bare, env);
  assert.equal(
    res.status,
    200,
    "the app layer must not enforce identity; Cloudflare Access is the gate"
  );
});

test("security boundary: an unauthenticated write is accepted at the app layer (Access must block it before)", async () => {
  // Verified live on the test Worker: unauthenticated POSTs create records when
  // Access is not enabled. This test locks in that the app layer does not
  // filter — which is exactly why Access is required before the frontend is
  // connected.
  const env = makeEnv();
  const bare = new Request("https://phytometer-api.workers.dev/api/plants", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(PLANT),
  });
  const res = await handleRequest(bare, env);
  assert.equal(
    res.status,
    201,
    "the app layer accepts writes; protection must come from Access, not here"
  );
});

test("security boundary: validation still rejects a payload that would corrupt data", async () => {
  // Whatever the auth layer does, the app layer must never accept a record that
  // violates the scientific data model.
  const env = makeEnv();
  const bare = new Request("https://phytometer-api.workers.dev/api/plants", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...PLANT, group_name: "G9" }),
  });
  const res = await handleRequest(bare, env);
  assert.equal(res.status, 400);
});

test("security boundary: append-only rules hold for anonymous requests too", async () => {
  const env = makeEnv();
  await handleRequest(jsonRequest("POST", "/api/plants", PLANT), env);
  const del = await handleRequest(jsonRequest("DELETE", "/api/plants/PLT-001"), env);
  const put = await handleRequest(jsonRequest("PUT", "/api/plants/PLT-001", {}), env);
  assert.equal(del.status, 404);
  assert.equal(put.status, 404);
});

// ---------------------------------------------------------------------------
// Day 0: pot physical constants (controlled variables)
// ---------------------------------------------------------------------------

test("day0 config: pot dimensions persist and are editable", async () => {
  const env = makeEnv();
  const created = await handleRequest(
    jsonRequest("POST", "/api/day0/physical-config", {
      config_id: "CFG-POT-1",
      pot_material: "plast",
      pot_diameter_cm: 9,
      pot_height_cm: 7,
      pot_volume_l: 0.4,
      pot_dimensions_basis: "measured",
      created_at: "2026-02-01T08:00:00",
    }),
    env
  );
  assert.equal(created.status, 201);
  let data = (await readJson(created)).data as Record<string, unknown>;
  assert.equal(data.pot_diameter_cm, 9);
  assert.equal(data.pot_height_cm, 7);
  assert.equal(data.pot_volume_l, 0.4);
  assert.equal(data.pot_dimensions_basis, "measured");

  const edited = await handleRequest(
    jsonRequest("PATCH", "/api/day0/physical-config", { pot_volume_l: 0.38 }),
    env
  );
  assert.equal(edited.status, 200);
  data = (await readJson(edited)).data as Record<string, unknown>;
  assert.equal(data.pot_volume_l, 0.38);
  assert.equal(data.pot_diameter_cm, 9, "other pot dimensions must be untouched");
});

test("day0 config: unknown pot dimensions stay NULL, never zero", async () => {
  const env = makeEnv();
  const created = await handleRequest(
    jsonRequest("POST", "/api/day0/physical-config", { config_id: "CFG-POT-2", created_at: "2026-02-01T08:00:00" }),
    env
  );
  assert.equal(created.status, 201);
  const data = (await readJson(created)).data as Record<string, unknown>;
  // NULL means "not recorded". It must never be coerced to 0, which would be a
  // measured zero.
  for (const field of ["pot_diameter_cm", "pot_height_cm", "pot_volume_l"]) {
    assert.ok(data[field] == null, `${field} must be null when unrecorded`);
  }
  assert.equal(data.pot_dimensions_basis, null, "basis is also unrecorded, not 'unknown' by default");
});

test("day0 config: a negative pot dimension is rejected", async () => {
  const env = makeEnv();
  const res = await handleRequest(
    jsonRequest("POST", "/api/day0/physical-config", {
      config_id: "CFG-POT-3",
      pot_diameter_cm: -1,
      created_at: "2026-02-01T08:00:00",
    }),
    env
  );
  assert.equal(res.status, 400);
});

test("day0 config: an invalid pot_dimensions_basis is rejected", async () => {
  const env = makeEnv();
  const res = await handleRequest(
    jsonRequest("POST", "/api/day0/physical-config", {
      config_id: "CFG-POT-4",
      pot_dimensions_basis: "guessed",
      created_at: "2026-02-01T08:00:00",
    }),
    env
  );
  assert.equal(res.status, 400);
});

// ---------------------------------------------------------------------------
// Day 0: planned vs actual seed counts must never collapse into each other
// ---------------------------------------------------------------------------

test("day0 pots: recording actual seeds sown does not change the planned count", async () => {
  const env = makeEnv();
  await handleRequest(
    jsonRequest("POST", "/api/day0/pot-allocation", {
      allocation_id: "ALLOC-SEEDS-1",
      pot_id: "POT-100",
      group_name: "G1",
      substrate_mass_g: 72,
      created_at: "2026-02-01T08:00:00",
    }),
    env
  );

  // Operator sows only 2 of the 3 planned seeds.
  const sown = await handleRequest(
    jsonRequest("PATCH", "/api/day0/pot-allocation/ALLOC-SEEDS-1", { seeds_sown: 2, sowing_status: "sown" }),
    env
  );
  assert.equal(sown.status, 200);
  const data = (await readJson(sown)).data as Record<string, unknown>;
  assert.equal(data.seed_count, 3, "the PLANNED count must stay 3");
  assert.equal(data.seeds_sown, 2, "the ACTUAL count is what the operator recorded");
  assert.equal(data.substrate_mass_g, 72, "substrate mass is unaffected");
});

test("day0 pots: repeated identical submission does not duplicate a pot", async () => {
  const env = makeEnv();
  const body = {
    allocation_id: "ALLOC-IDEM",
    pot_id: "POT-101",
    group_name: "G1",
    substrate_mass_g: 72,
    created_at: "2026-02-01T08:00:00",
  };
  const first = await handleRequest(jsonRequest("POST", "/api/day0/pot-allocation", body), env);
  assert.equal(first.status, 201);
  const second = await handleRequest(jsonRequest("POST", "/api/day0/pot-allocation", body), env);
  assert.equal(second.status, 409, "the same allocation_id must be refused, not duplicated");

  const samePotDifferentId = await handleRequest(
    jsonRequest("POST", "/api/day0/pot-allocation", { ...body, allocation_id: "ALLOC-IDEM-2" }),
    env
  );
  assert.equal(samePotDifferentId.status, 409, "the same pot_id must also be refused");
});

test("day0 pots: a partial setup is valid — sowing status may stay pending", async () => {
  const env = makeEnv();
  const res = await handleRequest(
    jsonRequest("POST", "/api/day0/pot-allocation", {
      allocation_id: "ALLOC-PARTIAL",
      pot_id: "POT-102",
      group_name: "G2",
      substrate_mass_g: 72,
      created_at: "2026-02-01T08:00:00",
    }),
    env
  );
  assert.equal(res.status, 201, "a partially recorded pot must be accepted");
  const data = (await readJson(res)).data as Record<string, unknown>;
  assert.equal(data.sowing_status, "pending", "unrecorded actions stay pending, not sown");
  assert.equal(data.emergence_status, "not_sown");
  assert.equal(data.sowing_date, null, "no date is invented");
  assert.equal(data.emergence_date, null);
  assert.equal(data.seeds_sown, null);
  assert.equal(data.mass_basis, "unknown");
});

// ---------------------------------------------------------------------------
// Regression: every route the frontend actually calls must be registered.
//
// The reported failure was "HTTP 404 for plant records / image records /
// manual measurements / AI-CV measurements / water events / position events",
// i.e. every data source. These tests pin down the exact path+method the
// frontend's adapters request and assert the router answers each one with a
// real response — 200 for an empty database, never a 404 for a registered
// route. A route that returns 404 on an empty DB is a missing route, not an
// empty database, and must fail loudly here.
// ---------------------------------------------------------------------------

const FRONTEND_ROUTES: Array<{ method: string; path: string }> = [
  // reads
  { method: "GET", path: "/api/plants" },
  { method: "GET", path: "/api/images" },
  { method: "GET", path: "/api/manual-measurements" },
  { method: "GET", path: "/api/aicv-measurements" },
  { method: "GET", path: "/api/water-events" },
  { method: "GET", path: "/api/position-events" },
{ method: "GET", path: "/api/day0/equipment" },
  { method: "GET", path: "/api/day0/pot-allocation" },
  { method: "GET", path: "/api/day0/methodology-decisions" },
  // writes
  { method: "POST", path: "/api/plants" },
  { method: "POST", path: "/api/water-events" },
  { method: "POST", path: "/api/position-events" },
  { method: "POST", path: "/api/images/upload" },
  { method: "POST", path: "/api/manual-measurements" },
  { method: "POST", path: "/api/aicv-measurements" },
  { method: "POST", path: "/api/day0/equipment" },
  { method: "POST", path: "/api/day0/physical-config" },
  { method: "POST", path: "/api/day0/pot-allocation" },
  { method: "POST", path: "/api/day0/methodology-decisions" },
];

test("regression: every route the frontend calls is registered (not a 404)", async () => {
  const env = makeEnv();
  for (const { method, path } of FRONTEND_ROUTES) {
    // POST/PATCH without a body is a 400 (validation), which proves the route
    // IS registered — a missing route would answer 404 instead. GET on an
    // empty DB is 200 with an empty data array.
    const res = await handleRequest(jsonRequest(method, path, undefined, ORIGIN), env);
    assert.notEqual(
      res.status,
      404,
      `${method} ${path} must not be 404 — a 404 here means the route is missing, not that the DB is empty`
    );
  }
});

test("regression: GET list endpoints return 200 with an empty data array on an empty DB", async () => {
  const env = makeEnv();
  // These are list endpoints: an empty database is a valid 200 with an empty
  // data array, never a 404. A 404 here would mean the route is missing.
  for (const path of [
    "/api/plants",
    "/api/images",
    "/api/manual-measurements",
    "/api/aicv-measurements",
    "/api/water-events",
    "/api/position-events",
    "/api/day0/equipment",
    "/api/day0/pot-allocation",
    "/api/day0/methodology-decisions",
  ]) {
    const res = await handleRequest(jsonRequest("GET", path, undefined, ORIGIN), env);
    assert.equal(res.status, 200, `${path} must be 200 on an empty DB`);
    const body = await readJson(res);
    assert.ok(Array.isArray(body.data), `${path} must return a data array`);
    assert.equal(body.data.length, 0, `${path} must be empty, not fabricated`);
  }
});

test("regression: the singleton physical-config GET is 404 before it is created", async () => {
  // /api/day0/physical-config is a SINGLETON, not a list. Before the config
  // exists the GET is a genuine 404 (config.not_found), which the frontend
  // maps to "no config yet" and renders as an empty form. This mirrors the
  // Node backend exactly, and must not be silently turned into a 200.
  const env = makeEnv();
  const res = await handleRequest(jsonRequest("GET", "/api/day0/physical-config", undefined, ORIGIN), env);
  assert.equal(res.status, 404, "an uncreated singleton config must be 404");
  const body = (await readJson(res)) as { error: { code: string } };
  assert.equal(body.error.code, "config.not_found");
});

test("regression: GET single-resource routes are 404 for unknown ids, not 200", async () => {
  const env = makeEnv();
  for (const path of [
    "/api/plants/PLT-999",
    "/api/plants/PLT-999/day-context",
    "/api/images/IMG-999",
    "/api/images/IMG-999/file",
    "/api/manual-measurements/MSR-999",
    "/api/aicv-measurements/MSR-999",
    "/api/day0/equipment/EQ-999",
    "/api/day0/pot-allocation/POT-999",
    "/api/day0/methodology-decisions/DEC-999",
  ]) {
    const res = await handleRequest(jsonRequest("GET", path, undefined, ORIGIN), env);
    assert.equal(
      res.status,
      404,
      `${path} for an unknown id must be 404, not a fabricated 200`
    );
  }
});

test("regression: an unknown API path is 404 and never served as an asset", async () => {
  const env = makeEnv();
  for (const path of [
    "/api/does-not-exist",
    "/api/plants/PLT-999/unknown-subroute",
    "/api/validation-issues",
  ]) {
    const res = await handleRequest(jsonRequest("GET", path, undefined, ORIGIN), env);
    assert.equal(res.status, 404, `${path} must be 404`);
    const body = (await readJson(res)) as { error: { code: string } };
    assert.equal(body.error.code, "route.not_found", `${path} must carry route.not_found`);
  }
});

test("regression: the singleton PATCH routes are 404 before the record exists, not 200", async () => {
  // PATCH /api/day0/physical-config is a singleton update: it returns 404
  // (config.not_found) when nothing has been created yet, exactly like the
  // Node backend. This is honest, not a missing route — the route is
  // registered and answers 404 for the absent record.
  const env = makeEnv();
  const res = await handleRequest(jsonRequest("PATCH", "/api/day0/physical-config", {}, ORIGIN), env);
  assert.equal(res.status, 404, "an uncreated singleton PATCH must be 404");
  const body = (await readJson(res)) as { error: { code: string } };
  assert.equal(body.error.code, "config.not_found");
});

test("regression: the singleton equipment PATCH is 404 before the record exists, not 200", async () => {
  // PATCH /api/day0/equipment/:id is a singleton update: it returns 404
  // (equipment.not_found) when nothing has been created yet, exactly like the
  // Node backend. This is honest, not a missing route — the route is
  // registered and answers 404 for the absent record.
  const env = makeEnv();
  const res = await handleRequest(jsonRequest("PATCH", "/api/day0/equipment/EQ-1", {}, ORIGIN), env);
  assert.equal(res.status, 404, "an uncreated singleton equipment PATCH must be 404");
  const body = (await readJson(res)) as { error: { code: string } };
  assert.equal(body.error.code, "equipment.not_found");
});

test("regression: the singleton pot-allocation PATCH is 404 before the record exists, not 200", async () => {
  // PATCH /api/day0/pot-allocation/:id is a singleton update: it returns 404
  // (allocation.not_found) when nothing has been created yet, exactly like the
  // Node backend. This is honest, not a missing route — the route is
  // registered and answers 404 for the absent record.
  const env = makeEnv();
  const res = await handleRequest(jsonRequest("PATCH", "/api/day0/pot-allocation/POT-01", {}, ORIGIN), env);
  assert.equal(res.status, 404, "an uncreated singleton pot-allocation PATCH must be 404");
  const body = (await readJson(res)) as { error: { code: string } };
  assert.equal(body.error.code, "allocation.not_found");
});

test("regression: the singleton methodology-decisions PATCH is 404 before the record exists, not 200", async () => {
  // PATCH /api/day0/methodology-decisions/:id is a singleton update: it returns 404
  // (decision.not_found) when nothing has been created yet, exactly like the
  // Node backend. This is honest, not a missing route — the route is
  // registered and answers 404 for the absent record.
  const env = makeEnv();
  const res = await handleRequest(jsonRequest("PATCH", "/api/day0/methodology-decisions/DEC-1", {}, ORIGIN), env);
  assert.equal(res.status, 404, "an uncreated singleton methodology-decisions PATCH must be 404");
  const body = (await readJson(res)) as { error: { code: string } };
  assert.equal(body.error.code, "decision.not_found");
});
