#!/usr/bin/env -S npx tsx
/**
 * Cloudflare Access verification for the Phytometer TEST Worker.
 *
 * Run this ONLY after enabling Access in the Cloudflare dashboard. It proves,
 * against the live endpoint, that unauthenticated requests can neither read nor
 * write, and that authenticated requests succeed.
 *
 *   npx tsx scripts/verify-access.ts
 *   npx tsx scripts/verify-access.ts --url https://phytometer-api-test.78thz568ph.workers.dev
 *
 * Exit code 0 means every check passed. Exit code 1 means Access is NOT
 * effective — do not connect the frontend.
 *
 * This script is read-only for the API except for the login-page probe, which
 * deliberately POSTs a valid plant payload to prove an unauthenticated write is
 * REFUSED. It targets the TEST Worker only, never production.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const TEST_URL = "https://phytometer-api-test.78thz568ph.workers.dev";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const base = arg("url", TEST_URL).replace(/\/+$/, "");

interface Check {
  name: string;
  passed: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(name: string, passed: boolean, detail: string): void {
  checks.push({ name, passed, detail });
}

/** Performs a request and returns status + a trimmed body. */
function probe(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {}
): { status: number; body: string; location: string } {
  const args = ["-s", "-o", "/tmp/.verify-body", "-w", "%{http_code}", "-X", method, `${base}${path}`];
  for (const [k, v] of Object.entries(extraHeaders)) args.push("-H", `${k}: ${v}`);
  if (body !== undefined) {
    args.push("-H", "content-type: application/json", "--data-binary", JSON.stringify(body));
  }
  let status = 0;
  let location = "";
  try {
    const out = execFileSync("curl", args, { encoding: "utf8" });
    status = Number(out.trim().split("\n").pop() ?? "0");
  } catch (error) {
    const e = error as { stdout?: string; status?: number };
    status = e.status ?? Number(String(e.stdout ?? "0").trim()) ?? 0;
  }
  try {
    // Separate call to capture the redirect target.
    const headers = execFileSync("curl", ["-s", "-D", "-", "-o", "/dev/null", "-X", method, `${base}${path}`], {
      encoding: "utf8",
    });
    const m = /^location:\s*(.+)$/im.exec(headers);
    location = m ? m[1].trim() : "";
  } catch {
    location = "";
  }
  let bodyText = "";
  try {
    bodyText = readFileSync("/tmp/.verify-body", "utf8").slice(0, 160);
  } catch {
    bodyText = "";
  }
  return { status, body: bodyText, location };
}

/** True when Access rejected the request. */
function isBlocked(res: { status: number; body: string; location: string }): boolean {
  if ([302, 401, 403].includes(res.status)) return true;
  // A login page served with 200 is still a rejection (Access redirects, curl
  // follows, so the app sees HTML rather than JSON).
  if (res.status === 200 && /cloudflare access|sign in|login/i.test(res.body)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// 1. Zero Trust / Access enabled at all?
// ---------------------------------------------------------------------------
const health = probe("GET", "/api/health");
if (health.status === 200 && health.body.includes('"api"')) {
  record(
    "Access is enabled",
    false,
    "GET /api/health returned 200 with the API JSON — requests reach the app. " +
      "Either Zero Trust is off or the Worker is not protected."
  );
} else if (isBlocked(health)) {
  record("Access is enabled", true, `GET /api/health was rejected (HTTP ${health.status})`);
} else {
  record("Access is enabled", true, `GET /api/health returned HTTP ${health.status} (not the API JSON)`);
}

// ---------------------------------------------------------------------------
// 2. Unauthenticated GET requests must be blocked
// ---------------------------------------------------------------------------
for (const path of ["/api/plants", "/api/images", "/api/water-events", "/api/day0/equipment"]) {
  const res = probe("GET", path);
  record(`Unauthenticated GET ${path} blocked`, isBlocked(res), `HTTP ${res.status}`);
}

// ---------------------------------------------------------------------------
// 3. Unauthenticated POST must be blocked — with a VALID payload
//    A malformed body returning 400 proves nothing about authentication.
// ---------------------------------------------------------------------------
const plantPost = probe("POST", "/api/plants", {
  plant_id: "PLT-997",
  pot_id: "POT-997",
  group_name: "G0",
  emergence_date: "2026-01-01",
  status: "active",
  created_at: "2026-01-01T00:00:00",
});
record(
  "Unauthenticated POST /api/plants blocked",
  isBlocked(plantPost),
  plantPost.status === 201
    ? "HTTP 201 — AN UNAUTHENTICATED WRITE CREATED A RECORD. Access is not working."
    : `HTTP ${plantPost.status}`
);

const otherPosts: Array<[string, string, unknown]> = [
  ["/api/water-events", "POST", {
    water_event_id: "WTR-20260101-080000-002",
    plant_id: "PLT-901",
    timestamp: "2026-01-01T08:00:00",
    experiment_day: 1,
    pot_mass_before_g: 100,
    target_mass_g: 200,
    water_added_ml: 100,
    pot_mass_after_g: 200,
    watering_status: "pass",
  }],
  ["/api/manual-measurements", "POST", {
    measurement_id: "MSR-MAN-20260101-090000-002",
    plant_id: "PLT-901",
    timestamp: "2026-01-01T08:00:00",
    experiment_day: 1,
    repetition: 1,
    observer: "probe",
    measurement_status: "pass",
    plant_height_cm: 12,
  }],
  ["/api/day0/methodology-decisions", "POST", {
    decision_id: "DEC-20260101-000002-002",
    title: "Access probe",
    description: "must be refused",
    status: "unresolved",
    blocks_sowing: false,
    blocks_emergence: false,
    blocks_measurements: false,
    created_at: "2026-01-01T00:00:00",
  }],
];
for (const [path, method, body] of otherPosts) {
  const res = probe(method, path, body);
  record(`Unauthenticated ${method} ${path} blocked`, isBlocked(res), `HTTP ${res.status}`);
}

// ---------------------------------------------------------------------------
// 4. Unauthenticated PATCH must be blocked (altering an existing record)
// ---------------------------------------------------------------------------
const plantPatch = probe("PATCH", "/api/plants/PLT-901", {
  notes: "probe",
  updated_at: "2026-01-02T00:00:00",
});
record(
  "Unauthenticated PATCH /api/plants blocked",
  isBlocked(plantPatch),
  plantPatch.status === 200
    ? "HTTP 200 — AN UNAUTHENTICATED WRITE ALTERED A RECORD."
    : `HTTP ${plantPatch.status}`
);

const decisionPatch = probe("PATCH", "/api/day0/methodology-decisions/DEC-20260101-000001-001", {
  status: "approved",
  decided_by: "probe@example.com",
  decided_at: "2026-01-01T00:00:00",
});
record(
  "Unauthenticated PATCH decision blocked",
  isBlocked(decisionPatch),
  decisionPatch.status === 200
    ? "HTTP 200 — AN UNAUTHENTICATED WRITE ALTERED A METHODOLOGY DECISION."
    : `HTTP ${decisionPatch.status}`
);

const deactivate = probe("POST", "/api/plants/PLT-902/deactivate", {
  status: "dead",
  updated_at: "2026-01-02T00:00:00",
});
record(
  "Unauthenticated POST deactivate blocked",
  isBlocked(deactivate),
  deactivate.status === 200 ? "HTTP 200 — A PLANT WAS MARKED DEAD UNAUTHENTICATED." : `HTTP ${deactivate.status}`
);

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
let failed = 0;
console.log("");
console.log("=== CLOUDFLARE ACCESS VERIFICATION ===");
console.log(`target: ${base}`);
console.log("");
for (const check of checks) {
  const mark = check.passed ? "PASS" : "FAIL";
  if (!check.passed) failed += 1;
  console.log(`[${mark}] ${check.name}`);
  if (!check.passed || !check.detail.startsWith("HTTP 2/3")) {
    console.log(`        ${check.detail}`);
  }
}
console.log("");
console.log(`summary: ${checks.length - failed} passed, ${failed} failed`);
console.log("");
if (failed > 0) {
  console.log("RESULT: Access is NOT effective. Do NOT connect the production frontend.");
  process.exit(1);
}
console.log("RESULT: Unauthenticated reads and writes are blocked.");
console.log("");
console.log("NEXT — verify an authenticated request (must be done in a browser):");
console.log(`  1. Open  ${base}/api/health  in your browser and sign in.`);
console.log(`  2. Confirm you see {"data":{"status":"ok","api":"phytometer"}}.`);
console.log(`  3. Re-run this script with the browser session is NOT used — it`);
console.log(`     probes without cookies on purpose.`);
console.log(`  4. Then load the frontend and confirm the same JSON flows through it.`);
process.exit(0);
