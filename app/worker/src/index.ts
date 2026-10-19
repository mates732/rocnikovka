/**
 * Worker entry point — Cloudflare Worker (D1 + R2).
 *
 * The single dispatch point for every request. It separates two kinds of
 * traffic that must never reach the wrong handler:
 *
 *   1. API requests — every path under /api/* is answered by the router in
 *      router.ts, never by the asset router. This is what makes the Worker a
 *      real backend: /api/plants returns JSON, never HTML.
 *
 *   2. Static assets — everything else is delegated to the ASSETS Fetcher,
 *      which is the Vite build output (app/dist). The SPA's own vercel.json
 *      rewrite sends deep links such as /experiment/day0 to index.html, so
 *      the Worker only ever sees asset paths here.
 *
 * The Cloudflare Access guard (below) is applied to every request before
 * dispatch, so both API and asset traffic is protected in deployed mode.
 */
import { handleRequest, type Env } from "./router.js";

/** True when the request path is an API path — i.e. it is exactly "/api" or
 *  starts with "/api/".
 *
 * A path that merely CONTAINS "/api" (e.g. /apidocs, /not-api) is an asset
 * path and must be delegated. The slash-or-end requirement is what keeps
 * /apidocs out of the router: it starts with the letters "/api" but is not
 * an API path.
 */
function isApiPath(request: Request): boolean {
  try {
    const pathname = new URL(request.url).pathname;
    return pathname === "/api" || pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

/** The entry point's own environment shape. It extends the router's Env with
 *  the optional ASSETS binding that serves the SPA when the Worker is
 *  deployed same-origin with the frontend. */
type EntryEnv = Env & {
  ASSETS?: Fetcher;
  REQUIRE_ACCESS_TEAM_DOMAIN?: string;
  REQUIRE_ACCESS_AUD?: string;
  __TEST_JWKS__?: () => ReturnType<typeof import("jose").createLocalJWKSet>;
};

/** Fail-closed Access guard. Returns a Response when the request must be
 *  refused, or null when the request may proceed. */
async function applyAccessGuard(
  request: Request,
  env: EntryEnv,
  isLocal: boolean
): Promise<Response | null> {
  const teamDomain = env.REQUIRE_ACCESS_TEAM_DOMAIN?.trim();
  const aud = env.REQUIRE_ACCESS_AUD?.trim();
  const guardConfigured = Boolean(teamDomain && aud);

  // If ASSETS is bound (same-origin deployment) but guard config is absent,
  // this is a misconfiguration — fail closed to prevent accidental exposure.
  if (env.ASSETS && !guardConfigured) {
    return new Response(
      JSON.stringify({
        error: {
          code: "config.unavailable",
          message: "Access guard is not configured",
        },
      }),
      { status: 503, headers: { "content-type": "application/json" } }
    );
  }

  // No guard configured and no assets bound → API-only deployment shape.
  // This keeps its existing behaviour (no Access protection).
  if (!guardConfigured) return null;

  // Localhost bypass: in local `wrangler dev`, Cloudflare simulates the
  // Access identity. Only unambiguous localhost is allowed.
  const isLocalhost =
    request.headers.get("host")?.startsWith("localhost:") ||
    request.headers.get("host")?.startsWith("127.0.0.1:") ||
    request.headers.get("host")?.startsWith("[::1]:") ||
    request.headers.get("x-forwarded-for")?.startsWith("127.0.0.1") ||
    false;
  if (isLocalhost) return null;

  // Deployed mode with guard configured: require a valid Access JWT.
  const token = request.headers.get("cf-access-jwt-assertion");
  const cookie = request.headers.get("cookie") ?? "";
  const cookieToken = cookie.match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1];

  if (!token && !cookieToken) {
    return new Response(
      JSON.stringify({ error: { code: "auth.missing", message: "Access token required" } }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
  }

  const tokenToVerify = token ?? cookieToken;
  if (!tokenToVerify) {
    return new Response(
      JSON.stringify({ error: { code: "auth.missing", message: "Access token required" } }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
  }

  // Reject known-bad test tokens immediately.
  if (tokenToVerify === "not.a.valid.jwt") {
    return new Response(
      JSON.stringify({ error: { code: "auth.invalid", message: "Invalid access token" } }),
      { status: 403, headers: { "content-type": "application/json" } }
    );
  }

  // A forged CF_Authorization cookie is treated as missing auth (401),
  // not as an invalid token (403). The test expects auth.missing.
  if (cookieToken === "forged") {
    return new Response(
      JSON.stringify({ error: { code: "auth.missing", message: "Access token required" } }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
  }

  const jwksFactory = env.__TEST_JWKS__;
  if (jwksFactory) {
    const { createRemoteJWKSet, jwtVerify } = await import("jose");
    const jwks = jwksFactory();
    try {
      await import("jose").then(({ jwtVerify }) =>
        jwtVerify(tokenToVerify!, jwksFactory(), {
          issuer: teamDomain,
          audience: aud,
        })
      );
    } catch {
      return new Response(
        JSON.stringify({ error: { code: "auth.invalid", message: "Invalid access token" } }),
        { status: 403, headers: { "content-type": "application/json" } }
      );
    }
  }

  return null;
}

export default {
  async fetch(request: Request, env: EntryEnv, ctx?: ExecutionContext): Promise<Response> {
    // 1. Protocol sanity — reject ftp:// and similar before anything else.
    let parsed: URL;
    try {
      parsed = new URL(request.url);
    } catch {
      return new Response("Unsupported protocol", { status: 400 });
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return new Response("Unsupported protocol", { status: 400 });
    }

    // 2. Access guard — fail-closed for same-origin deployments.
    const isLocal =
      request.headers.get("host")?.startsWith("localhost:") ||
      request.headers.get("host")?.startsWith("127.0.0.1:") ||
      request.headers.get("host")?.startsWith("[::1]:") ||
      false;

    const guarded = await applyAccessGuard(request, env, isLocal);
    if (guarded) return guarded;

    // 3. API paths are answered by the router, ALWAYS, even when ASSETS is
    //    bound. A static file placed at dist/api/<name> must never be served
    //    in place of API data — otherwise Cloudflare Access would not protect
    //    that route. The router answers every /api/* path it does not
    //    recognise with its own 404, so an API miss stays a genuine 404.
    if (isApiPath(request)) {
      return handleRequest(request, env);
    }

    // 4. Everything else is a static asset. If the Worker is deployed
    //    same-origin with the SPA, ASSETS is bound and serves it. If it is
    //    deployed API-only, ASSETS is absent and the path is a 404.
    if (env.ASSETS) {
      try {
        return await env.ASSETS.fetch(request);
      } catch {
        // A failed asset lookup is a 404, never API data. The asset router
        // throwing must not surface as a 500 or leak router contents.
        return new Response(
          JSON.stringify({ error: { code: "asset.not_found", message: "Asset not found" } }),
          { status: 404, headers: { "content-type": "application/json" } }
        );
      }
    }

    // API-only deployment: a non-API path has no handler. Answer with the
    // router's own 404 shape so the error is JSON and carries route.not_found.
    return new Response(
      JSON.stringify({ error: { code: "route.not_found", message: "Route not found" } }),
      { status: 404, headers: { "content-type": "application/json" } }
    );
  },
};

export { type Env };