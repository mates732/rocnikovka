/**
 * Deployment-configuration regression tests.
 *
 * The production incident this guards against: the Vercel deployment hosted only
 * the static frontend, so every `/api/*` request returned a genuine 404 while
 * the UI (correctly) reported it as an error instead of empty data.
 *
 * Two things are asserted here:
 *   1. a SPA deep-link rewrite exists so routes like /experiment/day0 load;
 *   2. that rewrite must EXCLUDE `/api/*`, otherwise an API miss would silently
 *      receive index.html with HTTP 200 and the real error would be hidden.
 */
import test from "node:test";
import assert from "node:assert/strict";
import vercelConfig from "../../vercel.json";

type Rewrite = { source: string; destination: string };

function getRewrites(): Rewrite[] {
  const rewrites = (vercelConfig as { rewrites?: unknown }).rewrites;
  assert.ok(Array.isArray(rewrites), "vercel.json must define a rewrites array");
  return rewrites as Rewrite[];
}

test("vercel: a SPA deep-link rewrite to index.html is configured", () => {
  const rewrites = getRewrites();
  const spa = rewrites.find((r) => r.destination === "/index.html");
  assert.ok(spa, "a rewrite targeting /index.html must exist");
  assert.equal(spa.source.length > 0, true);
});

test("vercel: the SPA rewrite must exclude /api so API 404s stay genuine", () => {
  const spa = getRewrites().find((r) => r.destination === "/index.html");
  assert.ok(spa);
  // The source is a regex string; compile it exactly as Vercel would.
  const matcher = new RegExp(`^${spa.source}$`);

  const mustRewrite = [
    "/",
    "/experiment/day0",
    "/plants",
    "/plants/PLT-001",
    "/measurements",
    "/settings",
    "/experiment/verification",
  ];
  const mustPassThrough = [
    "/api",
    "/api/plants",
    "/api/day0/equipment",
    "/api/water-events",
    "/api/day0/methodology-decisions",
  ];

  for (const path of mustRewrite) {
    assert.equal(matcher.test(path), true, `${path} must load the SPA`);
  }
  for (const path of mustPassThrough) {
    assert.equal(
      matcher.test(path),
      false,
      `${path} must NOT be rewritten to HTML — the API 404 must stay visible`
    );
  }
});

test("vercel: the SPA rewrite must never mask a 404 as a 200 HTML response", () => {
  // Structural guard: the source must contain the /api negative lookahead.
  // Without it a missing API route would return index.html with HTTP 200 and
  // the frontend would surface a JSON parse error instead of the true status.
  const spa = getRewrites().find((r) => r.destination === "/index.html");
  assert.ok(spa);
  assert.match(spa.source, /\(\?!/, "source must use a negative lookahead");
  assert.match(spa.source, /api/, "the lookahead must reference /api");
});
