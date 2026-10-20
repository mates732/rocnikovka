import { ApiError } from "./apiError.js";
import { apiErrorFromBody } from "./apiError.js";

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

export function ok(data: unknown, headers: Record<string, string> = {}): Response {
  return json({ data }, 200, headers);
}

export function created(data: unknown, headers: Record<string, string> = {}): Response {
  return json({ data }, 201, headers);
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

export function notFound(code = "route.not_found", message = "Route not found"): Response {
  return json({ error: { code, message } }, 404);
}

/** Builds an error response. `extra` is appended to the error object so the
 * frontend's `issues` array contract is preserved for validation failures. */
export function errorResponse(
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {}
): Response {
  return json({ error: { code, message, ...extra } }, status, headers);
}

/** Reads and parses a JSON body, rejecting malformed input rather than guessing. */
export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiError("Request body must be JSON", "input.invalid", 400);
  }
  const text = await request.text();
  if (text.trim() === "") return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError("Request body is not valid JSON", "input.invalid", 400);
  }
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

/**
 * Resolves the Access-Control-Allow-Origin value for a request.
 *
 * The allowed origin comes from the ALLOWED_ORIGIN variable. When it is unset —
 * as in a fresh local `wrangler dev` — the request Origin is echoed back, which
 * is required for browser preflight to succeed locally. In production
 * ALLOWED_ORIGIN is always set, so only that origin is accepted.
 */
export function resolveCorsOrigin(request: Request, env: { ALLOWED_ORIGIN?: string }): string {
  const configured = (env.ALLOWED_ORIGIN ?? "").trim();
  const origin = request.headers.get("Origin") ?? "";
  if (configured !== "") {
    return origin === configured ? origin : "";
  }
  return origin;
}

export function corsHeaders(request: Request, env: { ALLOWED_ORIGIN?: string }): Record<string, string> {
  return {
    "access-control-allow-origin": resolveCorsOrigin(request, env),
    // Required for the Cloudflare Access session cookie (CF_Authorization) to be
    // sent and read on a cross-origin request from the Vercel-hosted SPA to this
    // Worker. Without this header the browser discards the credentialed response.
    // The origin above is always a single explicit origin, never "*", which is a
    // prerequisite for allowing credentials at all.
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET, POST, PATCH, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

// ---------------------------------------------------------------------------
// Error → response mapping (mirrors the Node backend status codes)
// ---------------------------------------------------------------------------

export function mapErrorToResponse(error: unknown, headers: Record<string, string> = {}): Response {
  if (error instanceof ApiError) {
    return errorResponse(error.status, error.code, error.message, { issues: error.issues ?? [] }, headers);
  }
  const code = (error as { code?: string })?.code;
  // ServiceError carries an explicit HTTP status; honour it rather than
  // collapsing every service failure into a 500.
  const status = (error as { status?: unknown })?.status;
  if (typeof status === "number" && status >= 400 && status < 600) {
    const message = error instanceof Error ? error.message : "Request failed";
    return errorResponse(status, code ?? "request.failed", message, {}, headers);
  }
  if (code === "validation.failed") {
    const details = (error as { details?: string[] }).details ?? [];
    return errorResponse(400, "input.invalid", "Invalid input", { issues: details }, headers);
  }
  if (code === "id.duplicate") {
    return errorResponse(409, "id.duplicate", "Duplicate identifier", {}, headers);
  }
  if (code === "reference.missing_parent") {
    return errorResponse(409, "reference.invalid", "Invalid reference", {}, headers);
  }
  if (code === "input.invalid") {
    return errorResponse(400, "input.invalid", "Invalid input", {}, headers);
  }
  return errorResponse(500, "internal.error", "Internal server error", {}, headers);
}

/** Maps a thrown upload error for the image routes. */
export function mapImageUploadError(error: unknown, headers: Record<string, string> = {}): Response {
  const code = (error as { code?: string })?.code;
  const message = error instanceof Error ? error.message : "Image upload failed";
  if (code === "image.invalid_content_type" || code === "id.invalid_format" || code === "image.unsafe_key") {
    return errorResponse(400, code ?? "input.invalid", message, {}, headers);
  }
  if (code === "image.too_large") {
    return errorResponse(413, code, message, {}, headers);
  }
  if (code === "validation.failed") {
    const details = (error as { details?: string[] }).details ?? [];
    return errorResponse(400, "input.invalid", "Invalid input", { issues: details }, headers);
  }
  if (code === "id.duplicate") {
    return errorResponse(409, "id.duplicate", "Duplicate identifier", {}, headers);
  }
  if (code === "reference.missing_parent") {
    return errorResponse(409, "reference.invalid", "Invalid reference", {}, headers);
  }
  return errorResponse(500, "internal.error", "Internal server error", {}, headers);
}

export { apiErrorFromBody };
