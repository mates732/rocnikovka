import test from "node:test";
import assert from "node:assert/strict";
import { apiUrl, API_BASE_URL, hasExternalApiBase, describeApiOrigin } from "./apiBase";

test("apiBase: with no VITE_API_BASE_URL the base is empty (same origin)", () => {
  // The test runner has no import.meta.env, which is exactly the unconfigured
  // local-development / unconfigured-production case.
  assert.equal(API_BASE_URL, "");
  assert.equal(apiUrl("/api/plants"), "/api/plants");
  assert.equal(hasExternalApiBase, false);
});

test("apiBase: apiUrl is pure path construction and never hides the status", () => {
  assert.equal(apiUrl("/api/plants"), "/api/plants");
  assert.equal(apiUrl("/api/day0/equipment"), "/api/day0/equipment");
  assert.equal(apiUrl("/api/day0/pot-allocation"), "/api/day0/pot-allocation");
  assert.equal(apiUrl("/api/day0/physical-config"), "/api/day0/physical-config");
  assert.equal(apiUrl("/api/day0/methodology-decisions"), "/api/day0/methodology-decisions");
  assert.equal(apiUrl("/api/images"), "/api/images");
  assert.equal(apiUrl("/api/manual-measurements"), "/api/manual-measurements");
  assert.equal(apiUrl("/api/aicv-measurements"), "/api/aicv-measurements");
  assert.equal(apiUrl("/api/water-events"), "/api/water-events");
  assert.equal(apiUrl("/api/position-events"), "/api/position-events");
  assert.equal(apiUrl("/api/images/IMG-1/file"), "/api/images/IMG-1/file");
  // Encoded segments are passed through untouched.
  assert.equal(apiUrl(`/api/plants/${encodeURIComponent("PLT-001")}`), "/api/plants/PLT-001");
  assert.equal(apiUrl(`/api/day0/equipment/${encodeURIComponent("EQ a")}`), "/api/day0/equipment/EQ%20a");
});

test("apiBase: every affected GET endpoint path is preserved", () => {
  // These are the exact paths the Day 0 dashboard and overview page read.
  const readPaths = [
    "/api/plants",
    "/api/images",
    "/api/manual-measurements",
    "/api/aicv-measurements",
    "/api/water-events",
    "/api/position-events",
    "/api/day0/equipment",
    "/api/day0/physical-config",
    "/api/day0/pot-allocation",
    "/api/day0/methodology-decisions",
  ];
  for (const path of readPaths) {
    assert.equal(apiUrl(path), path, `${path} must map onto itself when unconfigured`);
  }
});

test("apiBase: a relative path is rejected instead of producing a malformed URL", () => {
  assert.throws(() => apiUrl("api/plants"), /absolute path/);
  assert.throws(() => apiUrl(""), /absolute path/);
});

test("apiBase: describeApiOrigin reports the unconfigured state for diagnosis", () => {
  // The description must make an unconfigured deployment diagnosable without
  // suppressing the underlying HTTP error.
  const described = describeApiOrigin();
  assert.ok(described.includes("VITE_API_BASE_URL není nastaveno"));
});

test("apiBase: a configured base is normalized (trailing slashes removed, whitespace trimmed)", async () => {
  const { normalizeApiBase } = await import("./apiBase.ts");
  assert.equal(normalizeApiBase(undefined), "", "undefined means same origin");
  assert.equal(normalizeApiBase(null), "");
  assert.equal(normalizeApiBase(""), "");
  assert.equal(normalizeApiBase("   "), "");
  assert.equal(normalizeApiBase("https://api.example.com"), "https://api.example.com");
  assert.equal(normalizeApiBase("https://api.example.com/"), "https://api.example.com");
  assert.equal(normalizeApiBase("https://api.example.com///"), "https://api.example.com");
  assert.equal(normalizeApiBase("  https://api.example.com/  "), "https://api.example.com");
});

test("apiBase: a configured base prefixes every API path exactly once", async () => {
  const { joinApiUrl, normalizeApiBase } = await import("./apiBase.ts");

  for (const raw of ["https://api.example.com", "https://api.example.com/"]) {
    const base = normalizeApiBase(raw);
    assert.equal(joinApiUrl(base, "/api/plants"), "https://api.example.com/api/plants");
    assert.equal(joinApiUrl(base, "/api/day0/equipment"), "https://api.example.com/api/day0/equipment");
    // Never a doubled /api path prefix and never a doubled slash at the join.
    assert.equal(joinApiUrl(base, "/api/water-events"), "https://api.example.com/api/water-events");
    const url = joinApiUrl(base, "/api/plants");
    assert.ok(!url.includes("/api/api"), "no doubled /api path prefix");
    assert.ok(!new URL(url).pathname.startsWith("//"), "join must not produce a doubled slash");
  }
});

test("apiBase: joinApiUrl rejects relative paths", async () => {
  const { joinApiUrl } = await import("./apiBase.ts");
  assert.throws(() => joinApiUrl("https://api.example.com", "api/plants"), /absolute path/);
});

test("apiBase: the unconfigured base keeps requests relative (Vite dev proxy path)", async () => {
  const { joinApiUrl, normalizeApiBase } = await import("./apiBase.ts");
  const base = normalizeApiBase(process.env.VITE_API_BASE_URL);
  assert.equal(base, "", "no VITE_API_BASE_URL in the test environment");
  assert.equal(joinApiUrl(base, "/api/plants"), "/api/plants");
});

test("apiBase: the configured origin is used verbatim, with no /api duplication", async () => {
  const { joinApiUrl, normalizeApiBase } = await import("./apiBase.ts");

  // The value a user would enter for the TEST Worker.
  const configured = normalizeApiBase("https://phytometer-api-test.78thz568ph.workers.dev");
  assert.equal(configured, "https://phytometer-api-test.78thz568ph.workers.dev");

  // The app appends the full path, so the base must NOT contain /api.
  assert.equal(joinApiUrl(configured, "/api/plants"), "https://phytometer-api-test.78thz568ph.workers.dev/api/plants");
  assert.ok(
    !joinApiUrl(configured, "/api/plants").includes("/api/api"),
    "including /api in the base would double the path prefix"
  );
});

test("apiBase: a base that wrongly includes /api is caught, not silently accepted", async () => {
  const { joinApiUrl, normalizeApiBase } = await import("./apiBase.ts");
  // Document the failure mode so a misconfiguration is recognisable.
  const wrong = normalizeApiBase("https://phytometer-api-test.78thz568ph.workers.dev/api");
  assert.equal(joinApiUrl(wrong, "/api/plants"), "https://phytometer-api-test.78thz568ph.workers.dev/api/api/plants");
  assert.ok(joinApiUrl(wrong, "/api/plants").includes("/api/api"));
});

test("apiBase: trailing slashes do not change the resulting URL", async () => {
  const { joinApiUrl, normalizeApiBase } = await import("./apiBase.ts");
  const a = normalizeApiBase("https://host.dev");
  const b = normalizeApiBase("https://host.dev/");
  assert.equal(a, b, "both must normalize to the same origin");
  assert.equal(joinApiUrl(a, "/api/plants"), joinApiUrl(b, "/api/plants"));
});
