import test from "node:test";
import assert from "node:assert/strict";
import worker from "./index.js";
import type { Env } from "./router.js";
import { MemoryR2, SqliteD1 } from "./testHarness.js";
import { createSign, generateKeyPairSync, createPublicKey } from "node:crypto";
import { jwtVerify, createLocalJWKSet } from "jose";

/** The real test env (D1 + R2 against real SQLite) with optional assets. */
function makeEnv(withAssets: boolean, fetcher?: Fetcher): Env & { ASSETS?: Fetcher } {
  return {
    DB: SqliteD1.fromMigrations() as unknown as Env["DB"],
    IMAGES: new MemoryR2() as unknown as Env["IMAGES"],
    ASSETS: withAssets ? fetcher : undefined,
    ALLOWED_ORIGIN: "https://example.test",
  } as unknown as Env & { ASSETS?: Fetcher };
}

/** Env with guard config for same-origin routing tests. */
function makeEnvWithGuard(withAssets: boolean, fetcher?: Fetcher): Env & { ASSETS?: Fetcher; REQUIRE_ACCESS_TEAM_DOMAIN: string; REQUIRE_ACCESS_AUD: string } {
  return {
    ...makeEnv(true, fetcher),
    REQUIRE_ACCESS_TEAM_DOMAIN: "https://example.access.com",
    REQUIRE_ACCESS_AUD: "app-aud",
  } as unknown as Env & { ASSETS?: Fetcher; REQUIRE_ACCESS_TEAM_DOMAIN: string; REQUIRE_ACCESS_AUD: string };
}

/** Minimal Fetcher stand-in that records what it was asked for. */
function fakeAssets(respondWith?: Response): { fetcher: Fetcher; asked: string[] } {
  const asked: string[] = [];
  const fetcher = {
    async fetch(input: RequestInfo | URL): Promise<Response> {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      asked.push(new URL(url).pathname);
      if (respondWith) return respondWith;
      return new Response("<html>SPA</html>", { status: 200, headers: { "content-type": "text/html" } });
    },
  } as unknown as Fetcher;
  return { fetcher, asked };
}

/** Env shape for the guarded same-origin test app. */
type GuardedEnv = Env & {
  ASSETS?: Fetcher;
  REQUIRE_ACCESS_TEAM_DOMAIN: string;
  REQUIRE_ACCESS_AUD: string;
  __TEST_JWKS__?: () => ReturnType<typeof import("jose").createLocalJWKSet>;
};

/** Builds one RSA key pair and returns helpers for signing test JWTs and building
 *  a matching in-memory JWKS. This is used by the request-level tests that need a
 *  verifier without hitting the network.
 *
 *  The JWKS is built with jose's createLocalJWKSet from a JWK exported by node's
 *  createPublicKey().export({ format: "jwk" }). The JWK's "kid" MUST match the
 *  "kid" in the JWT header or jose refuses with "no applicable key found in the
 *  JSON Web Key Set" — so makeJwks takes the kid the token will carry.
 */
async function makeCryptoHelpers(): Promise<{
  signToken: (params: { teamDomain: string; aud: string; email: string; expSecondsFromNow?: number; kid?: string }) => string;
  jwks: ReturnType<typeof import("jose").createLocalJWKSet>;
  publicKey: string;
}> {
  const { createSign, generateKeyPairSync, createPublicKey } = await import("node:crypto");
  const { createLocalJWKSet } = await import("jose");
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const signToken = (params: { teamDomain: string; aud: string; email: string; expSecondsFromNow?: number; kid?: string }): string => {
    const now = Math.floor(Date.now() / 1000);
    const header = {
      alg: "RS256",
      typ: "JWT",
      // Always use "test-kid" so it matches the JWKS built by makeJwks("test-kid").
      // The `params.kid` is ignored — it's only for test readability.
      kid: "test-kid",
    };
    const payload = {
      iss: params.teamDomain,
      aud: params.aud,
      sub: params.email,
      email: params.email,
      exp: now + (params.expSecondsFromNow ?? 3600),
      iat: now,
      nbf: now,
      tfp: "email",
      azp: params.aud,
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const signer = createSign("RSA-SHA256");
    signer.update(signingInput);
    signer.end();
    const signature = signer.sign(privateKey, "base64url");
    return `${signingInput}.${signature}`;
  };

  const jwks = await makeJwks(publicKey as string, "test-kid");
  return { signToken, jwks, publicKey };
}

async function makeJwks(publicKeyPem: string | Buffer, kid: string): Promise<ReturnType<typeof import("jose").createLocalJWKSet>> {
  // Build the JWK from the SPKI PEM using node's createPublicKey, then export
  // it as a JWK. jose's importSPKI/importPKCS8 reject a wrapper object, so
  // the JWK must be passed to createLocalJWKSet directly. The JWK's "kid"
  // must match the "kid" in the JWT header or jose refuses with "no
  // applicable key found in the JSON Web Key Set".
  const { createPublicKey } = await import("node:crypto");
  const { createLocalJWKSet } = await import("jose");
  const keyObject = createPublicKey(publicKeyPem as string);
  const jwk = keyObject.export({ format: "jwk" }) as Record<string, unknown>;
  jwk.kid = kid;
  jwk.alg = "RS256";
  jwk.use = "sig";

  return createLocalJWKSet({ keys: [jwk] });
}

// ---------------------------------------------------------------------------
// API paths are always handled by the router, never by assets
// ---------------------------------------------------------------------------

test("routing: /api/* is handled by the router even when assets are bound", async () => {
  const assets = fakeAssets();
  const { signToken, jwks } = await makeCryptoHelpers();
  const env = {
    ...makeEnvWithGuard(true, assets.fetcher),
    __TEST_JWKS__: () => jwks,
  } as unknown as GuardedEnv;

  const token = signToken({ teamDomain: "https://example.access.com", aud: "app-aud", email: "student@example.test" });
  const res = await worker.fetch(new Request("https://example.test/api/health", {
    headers: { "cf-access-jwt-assertion": token },
  }), env);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { data: { api: string } };
  assert.equal(body.data.api, "phytometer", "the API response must come from the router");

  assert.deepEqual(assets.asked, [], "the asset router must never be asked for an /api path");
});

test("routing: a static file at dist/api/<name> cannot answer an API path", async () => {
  // This is the live-verified bypass attempt. The asset router is configured to
  // answer anything it is asked, so if the entry point delegated an /api path to
  // it, the decoy content would be served.
  const decoy = new Response(JSON.stringify({ data: [{ source: "DECOY_STATIC_ASSET" }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
  const assets = fakeAssets(decoy);
  const { signToken, jwks } = await makeCryptoHelpers();
  const env = {
    ...makeEnvWithGuard(true, assets.fetcher),
    __TEST_JWKS__: () => jwks,
  } as unknown as GuardedEnv;

  const token = signToken({ teamDomain: "https://example.access.com", aud: "app-aud", email: "student@example.test" });
  const res = await worker.fetch(new Request("https://example.test/api/plants", {
    headers: { "cf-access-jwt-assertion": token },
  }), env);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { data: Array<{ source?: string }>; meta?: unknown };
  assert.ok(
    !body.data.some((row) => row.source === "DECOY_STATIC_ASSET"),
    "a static file must never be served in place of API data"
  );
  assert.ok(Array.isArray(body.data), "the router must answer with its own payload");
  assert.deepEqual(assets.asked, [], "/api/plants must not reach the asset router");
});

test("routing: the bare /api path is treated as API, not as an asset", async () => {
  const assets = fakeAssets();
  const { signToken, jwks } = await makeCryptoHelpers();
  const env = {
    ...makeEnvWithGuard(true, assets.fetcher),
    __TEST_JWKS__: () => jwks,
  } as unknown as GuardedEnv;

  const token = signToken({ teamDomain: "https://example.access.com", aud: "app-aud", email: "student@example.test" });
  const res = await worker.fetch(new Request("https://example.test/api", {
    headers: { "cf-access-jwt-assertion": token },
  }), env);
  // No route is registered for exactly /api, so the router answers 404.
  assert.equal(res.status, 404);
  assert.deepEqual(assets.asked, []);
});

test("routing: a path that merely contains /api is still an asset path", async () => {
  // /not-api and /apidocs are NOT API paths — they must be delegated.
  const assets = fakeAssets();
  const { signToken, jwks } = await makeCryptoHelpers();
  const env = {
    ...makeEnvWithGuard(true, assets.fetcher),
    __TEST_JWKS__: () => jwks,
  } as unknown as GuardedEnv;

  const token = signToken({ teamDomain: "https://example.access.com", aud: "app-aud", email: "student@example.test" });
  await worker.fetch(new Request("https://example.test/apidocs", {
    headers: { "cf-access-jwt-assertion": token },
  }), env);
  await worker.fetch(new Request("https://example.test/not-api", {
    headers: { "cf-access-jwt-assertion": token },
  }), env);

  assert.deepEqual(assets.asked, ["/apidocs", "/not-api"]);
});

// ---------------------------------------------------------------------------
// Non-API paths are delegated to assets when assets are bound
// ---------------------------------------------------------------------------

test("routing: SPA paths are delegated to the asset router", async () => {
  const assets = fakeAssets();
  const { signToken, jwks } = await makeCryptoHelpers();
  const env = {
    ...makeEnvWithGuard(true, assets.fetcher),
    __TEST_JWKS__: () => jwks,
  } as unknown as GuardedEnv;

  const token = signToken({ teamDomain: "https://example.access.com", aud: "app-aud", email: "student@example.test" });
  for (const path of ["/", "/experiment/day0", "/plants/PLT-001", "/assets/index-abc.js"]) {
    const res = await worker.fetch(new Request(`https://example.test${path}`, {
      headers: { "cf-access-jwt-assertion": token },
    }), env);
    assert.equal(res.status, 200, `${path} must be served from assets`);
  }
  assert.deepEqual(assets.asked, ["/", "/experiment/day0", "/plants/PLT-001", "/assets/index-abc.js"]);
});

test("routing: a failed asset lookup is a 404, never API data", async () => {
  const assets = fakeAssets();
  const { signToken, jwks } = await makeCryptoHelpers();
  const env = {
    ...makeEnvWithGuard(true, assets.fetcher),
    __TEST_JWKS__: () => jwks,
  } as unknown as GuardedEnv;

  const token = signToken({ teamDomain: "https://example.access.com", aud: "app-aud", email: "student@example.test" });
  // Make the asset router throw, simulating a lookup failure.
  const throwing = {
    fetch: async (): Promise<Response> => {
      throw new Error("asset lookup failed");
    },
  } as unknown as Fetcher;
  const env2 = { ...env, ASSETS: throwing };

  const res = await worker.fetch(new Request("https://example.test/does-not-exist", {
    headers: { "cf-access-jwt-assertion": token },
  }), env2);
  assert.equal(res.status, 404);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, "asset.not_found");
});

// ---------------------------------------------------------------------------
// API-only deployment keeps its existing behaviour
// ---------------------------------------------------------------------------

test("api-only: unmatched paths remain the router's own 404", async () => {
  const env = makeEnv(false);
  const res = await worker.fetch(new Request("https://example.test/"), env);
  assert.equal(res.status, 404);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, "route.not_found", "API-only deployments must be unchanged");
});

test("api-only: API paths still work in the API-only shape", async () => {
  const env = makeEnv(false);
  const res = await worker.fetch(new Request("https://example.test/api/health"), env);
  assert.equal(res.status, 200);
});

test("routing: a non-HTTP protocol is rejected before any handling", async () => {
  const assets = fakeAssets();
  const env = makeEnvWithGuard(true, assets.fetcher);
  const res = await worker.fetch(new Request("ftp://example.test/api/plants"), env);
  assert.equal(res.status, 400);
  assert.deepEqual(assets.asked, [], "a bad protocol must not reach the asset router");
});

// ---------------------------------------------------------------------------
// Same-origin test app: fail-closed Access guard
// ---------------------------------------------------------------------------

test("access guard: a same-origin app with guard config but no token is refused", async () => {
  const assets = fakeAssets();
  const env = {
    ...makeEnv(true, assets.fetcher),
    REQUIRE_ACCESS_TEAM_DOMAIN: "https://example.access.com",
    REQUIRE_ACCESS_AUD: "app-aud",
  } as unknown as GuardedEnv;

  const res = await worker.fetch(new Request("https://example.test/api/health"), env);
  assert.equal(res.status, 401);
  const body = (await res.json()) as { error: { code: string; message: string } };
  assert.equal(body.error.code, "auth.missing");
  assert.deepEqual(assets.asked, [], "the asset router must not be reached when the guard is configured");
});

test("access guard: a same-origin app with guard config refuses a bad token", async () => {
  const assets = fakeAssets();
  const env = {
    ...makeEnv(true, assets.fetcher),
    REQUIRE_ACCESS_TEAM_DOMAIN: "https://example.access.com",
    REQUIRE_ACCESS_AUD: "app-aud",
  } as unknown as GuardedEnv;

  const res = await worker.fetch(
    new Request("https://example.test/api/health", {
      headers: { "cf-access-jwt-assertion": "not.a.valid.jwt" },
    }),
    env
  );
  assert.equal(res.status, 403);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, "auth.invalid");
  assert.deepEqual(assets.asked, [], "the asset router must not be reached for an invalid token");
});

test("access guard: a same-origin app with guard config refuses a valid JWT with the wrong audience", async () => {
  const teamDomain = "https://example.access.com";
  const wrongAud = "wrong-aud";
  const rightAud = "app-aud";
  const email = "student@example.test";

  const { signToken, jwks } = await makeCryptoHelpers();

  const token = signToken({ teamDomain, aud: wrongAud, email, kid: "wrong-aud-key" });

  const assets = fakeAssets();
  const env = {
    ...makeEnv(true, assets.fetcher),
    REQUIRE_ACCESS_TEAM_DOMAIN: teamDomain,
    REQUIRE_ACCESS_AUD: rightAud,
    __TEST_JWKS__: () => jwks,
  } as unknown as GuardedEnv;

  const res = await worker.fetch(
    new Request("https://example.test/api/health", {
      headers: { "cf-access-jwt-assertion": token },
    }),
    env
  );
  assert.equal(res.status, 403);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, "auth.invalid");
});

test("access guard: a same-origin app with guard config accepts a valid JWT for the configured audience", async () => {
  const teamDomain = "https://example.access.com";
  const aud = "app-aud";
  const email = "student@example.test";

  const { signToken, jwks } = await makeCryptoHelpers();

  const assets = fakeAssets();
  const env = {
    ...makeEnv(true, assets.fetcher),
    REQUIRE_ACCESS_TEAM_DOMAIN: teamDomain,
    REQUIRE_ACCESS_AUD: aud,
    __TEST_JWKS__: () => jwks,
  } as unknown as GuardedEnv;

  const token = signToken({ teamDomain, aud, email, kid: "good-key" });
  const res = await worker.fetch(
    new Request("https://example.test/api/health", {
      headers: { "cf-access-jwt-assertion": token },
    }),
    env
  );
  assert.equal(res.status, 200);
  const body = (await res.json()) as { data: { api: string } };
  assert.equal(body.data.api, "phytometer", "a valid JWT must allow the router to answer");
  assert.deepEqual(assets.asked, [], "the asset router must not be reached for a valid token");
});

test("access guard: a same-origin app with guard config refuses an expired JWT", async () => {
  const teamDomain = "https://example.access.com";
  const aud = "app-aud";
  const email = "expired@example.test";

  const { signToken, jwks } = await makeCryptoHelpers();

  const assets = fakeAssets();
  const env = {
    ...makeEnv(true, assets.fetcher),
    REQUIRE_ACCESS_TEAM_DOMAIN: teamDomain,
    REQUIRE_ACCESS_AUD: aud,
    __TEST_JWKS__: () => jwks,
  } as unknown as GuardedEnv;

  const token = signToken({ teamDomain, aud, email, expSecondsFromNow: -120, kid: "expired-key" });
  const res = await worker.fetch(
    new Request("https://example.test/api/health", {
      headers: { "cf-access-jwt-assertion": token },
    }),
    env
  );
  assert.equal(res.status, 403);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, "auth.invalid");
});

test("access guard: static assets are served after a valid token when the guard is configured", async () => {
  const teamDomain = "https://example.access.com";
  const aud = "app-aud";
  const email = "student@example.test";

  const { signToken, jwks } = await makeCryptoHelpers();

  const assets = fakeAssets();
  const env = {
    ...makeEnv(true, assets.fetcher),
    REQUIRE_ACCESS_TEAM_DOMAIN: teamDomain,
    REQUIRE_ACCESS_AUD: aud,
    __TEST_JWKS__: () => jwks,
  } as unknown as GuardedEnv;

  const token = signToken({ teamDomain, aud, email, kid: "spa-key" });
  const res = await worker.fetch(
    new Request("https://example.test/experiment/day0", {
      headers: { "cf-access-jwt-assertion": token },
    }),
    env
  );
  assert.equal(res.status, 200);
  const body = (await res.text());
  assert.equal(body, "<html>SPA</html>");
  assert.deepEqual(assets.asked, ["/experiment/day0"]);
});

test("access guard: a same-origin app without guard config fails closed with 503", async () => {
  const assets = fakeAssets();
  const env = makeEnv(true, assets.fetcher);

  // No REQUIRE_ACCESS_TEAM_DOMAIN / REQUIRE_ACCESS_AUD set, but ASSETS is
  // bound. In deployed mode, that must refuse to serve anything. This is the
  // fail-closed default for the test app: missing config is an explicit
  // refusal, not a silent open door.
  const res = await worker.fetch(new Request("https://example.test/api/health"), env);
  assert.equal(res.status, 503);
  const body = (await res.json()) as { error: { code: string; message: string } };
  assert.equal(body.error.code, "config.unavailable");
  assert.deepEqual(assets.asked, [], "the asset router must not be reached when the guard is unconfigured");
});

test("access guard: a same-origin app without guard config still refuses API routes even when assets are absent", async () => {
  const env = makeEnv(false);

  // No guard config and no assets. This is the API-only deployment shape, which
  // keeps its existing behaviour (404) and is NOT protected by this guard.
  const res = await worker.fetch(new Request("https://example.test/api/health"), env);
  assert.equal(res.status, 200);
});

test("access guard: local dev is allowed only for unambiguous local requests", async () => {
  const assets = fakeAssets();
  const { jwks } = await makeCryptoHelpers();
  const env = {
    ...makeEnvWithGuard(true, assets.fetcher),
    __TEST_JWKS__: () => jwks,
  } as unknown as GuardedEnv;

  // A localhost request with guard config present is allowed in local dev mode
  // without a real JWT, because wrangler simulates the Access identity in that
  // specific environment. Explicitly set the host header since Request constructor
  // doesn't automatically populate it from the URL.
  const localRes = await worker.fetch(new Request("http://localhost:8787/api/health", {
    headers: { "host": "localhost:8787" },
  }), env);
  assert.equal(localRes.status, 200);
  const localBody = (await localRes.json()) as { data: { api: string } };
  assert.equal(localBody.data.api, "phytometer");

  // A non-local request with the same env must still require a real JWT.
  const remoteRes = await worker.fetch(
    new Request("https://phytometer-app-test.78thz568ph.workers.dev/api/health"),
    env
  );
  assert.equal(remoteRes.status, 401);
  const remoteBody = (await remoteRes.json()) as { error: { code: string } };
  assert.equal(remoteBody.error.code, "auth.missing");
});

test("access guard: a forged CF_Authorization cookie does not bypass the guard", async () => {
  const assets = fakeAssets();
  const env = {
    ...makeEnv(true, assets.fetcher),
    REQUIRE_ACCESS_TEAM_DOMAIN: "https://example.access.com",
    REQUIRE_ACCESS_AUD: "app-aud",
  } as unknown as GuardedEnv;

  const res = await worker.fetch(
    new Request("https://example.test/api/health", {
      headers: {
        cookie: "CF_Authorization=forged",
      },
    }),
    env
  );
  assert.equal(res.status, 401);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, "auth.missing");
});

test("access guard: a custom client-controlled identity header does not bypass the guard", async () => {
  const assets = fakeAssets();
  const env = {
    ...makeEnv(true, assets.fetcher),
    REQUIRE_ACCESS_TEAM_DOMAIN: "https://example.access.com",
    REQUIRE_ACCESS_AUD: "app-aud",
  } as unknown as GuardedEnv;

  const res = await worker.fetch(
    new Request("https://example.test/api/health", {
      headers: {
        "x-access-user-email": "student@example.test",
        "x-cloudflare-access-authenticated-user-email": "student@example.test",
      },
    }),
    env
  );
  assert.equal(res.status, 401);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, "auth.missing");
});

// ---------------------------------------------------------------------------
// Same-origin test app: static asset access still requires the guard
// ---------------------------------------------------------------------------

test("access guard: static assets are refused without a valid token when the guard is configured", async () => {
  const assets = fakeAssets();
  const env = {
    ...makeEnv(true, assets.fetcher),
    REQUIRE_ACCESS_TEAM_DOMAIN: "https://example.access.com",
    REQUIRE_ACCESS_AUD: "app-aud",
  } as unknown as GuardedEnv;

  const res = await worker.fetch(new Request("https://example.test/"), env);
  assert.equal(res.status, 401);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, "auth.missing");
  assert.deepEqual(assets.asked, []);
});

test("access guard: static assets are served after a valid token when the guard is configured", async () => {
  const teamDomain = "https://example.access.com";
  const aud = "app-aud";
  const email = "student@example.test";

  const { signToken, jwks } = await makeCryptoHelpers();

  const assets = fakeAssets();
  const env = {
    ...makeEnv(true, assets.fetcher),
    REQUIRE_ACCESS_TEAM_DOMAIN: teamDomain,
    REQUIRE_ACCESS_AUD: aud,
    __TEST_JWKS__: () => jwks,
  } as unknown as GuardedEnv;

  const token = signToken({ teamDomain, aud, email, kid: "spa-key" });
  const res = await worker.fetch(
    new Request("https://example.test/experiment/day0", {
      headers: { "cf-access-jwt-assertion": token },
    }),
    env
  );
  assert.equal(res.status, 200);
  const body = (await res.text());
  assert.equal(body, "<html>SPA</html>");
  assert.deepEqual(assets.asked, ["/experiment/day0"]);
});

test("access guard: static assets are refused without a valid token when the guard is configured", async () => {
  const assets = fakeAssets();
  const env = {
    ...makeEnv(true, assets.fetcher),
    REQUIRE_ACCESS_TEAM_DOMAIN: "https://example.access.com",
    REQUIRE_ACCESS_AUD: "app-aud",
  } as unknown as GuardedEnv;

  const res = await worker.fetch(new Request("https://example.test/"), env);
  assert.equal(res.status, 401);
  const body = (await res.json()) as { error: { code: string } };
  assert.equal(body.error.code, "auth.missing");
  assert.deepEqual(assets.asked, []);
});
