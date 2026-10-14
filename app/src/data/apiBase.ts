/**
 * Central API origin resolution.
 *
 * Every backend call in the app goes through `apiUrl()` so the requested URL is
 * constructed in exactly one place. There is no fallback, no mock response and
 * no error suppression here: a call that the backend cannot answer still
 * produces the real HTTP status (typically 404) and is surfaced to the UI as an
 * error.
 *
 * Resolution rules:
 * - `VITE_API_BASE_URL` unset or empty  -> ""  (relative, same origin)
 * - otherwise the value is used verbatim with trailing slashes removed
 *
 * Local development:
 *   An empty base produces `/api/plants`, which the Vite dev server proxies to
 *   `http://localhost:3001` (see `vite.config.ts`). This keeps `npm run dev`
 *   working with no configuration at all.
 *
 * Production:
 *   The Vercel deployment hosts the static Vite frontend only. The Node backend
 *   in `app/server/` must be hosted separately and its origin assigned to
 *   `VITE_API_BASE_URL` at build time. Until that is done every `/api/*` request
 *   resolves to the frontend origin and returns 404 — which is reported as an
 *   error, never as an empty successful response.
 */

/**
 * Build-time API origin.
 *
 * `import.meta.env` is replaced by Vite with the resolved environment object at
 * build time, so `VITE_API_BASE_URL` is inlined into the bundle. Under plain
 * Node (used by the test runner) `import.meta.env` is undefined, so the
 * short-circuit yields "" — which is exactly the local-development behaviour of
 * a relative, same-origin API. This access must stay a direct
 * `import.meta.env.VITE_API_BASE_URL` read: Vite replaces it textually.
 */
const rawBase: string =
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) || "";

/**
 * Normalizes a raw base value: trims surrounding whitespace and removes
 * trailing slashes so `normalizeApiBase("https://x.dev/")` and
 * `normalizeApiBase("https://x.dev")` join paths identically. Undefined and
 * blank values normalize to "", meaning "same origin as the frontend".
 */
export function normalizeApiBase(raw: string | undefined | null): string {
  return (raw ?? "").trim().replace(/\/+$/, "");
}

/** Prefix a path with an arbitrary API base. Mirrors `apiUrl`. */
export function joinApiUrl(base: string, path: string): string {
  if (!path.startsWith("/")) {
    throw new Error(`joinApiUrl expects an absolute path starting with "/", received: ${path}`);
  }
  return `${base}${path}`;
}

/** Normalized API origin. Empty string means "same origin as the frontend". */
export const API_BASE_URL: string = normalizeApiBase(rawBase);

/** True when the app is configured to call a separately hosted backend. */
export const hasExternalApiBase: boolean = API_BASE_URL !== "";

/**
 * Human-readable description of where API requests are sent. Used by the error
 * UI to make an unconfigured production deployment diagnosable: the 404 status
 * is still reported, but the user can see that no backend origin was set.
 */
export function describeApiOrigin(): string {
  if (API_BASE_URL === "") {
    return "stejný základ jako aplikace (VITE_API_BASE_URL není nastaveno)";
  }
  return API_BASE_URL;
}

/**
 * Builds the absolute URL for an API path.
 * @param path an absolute path beginning with "/", e.g. "/api/plants"
 */
export function apiUrl(path: string): string {
  return joinApiUrl(API_BASE_URL, path);
}
