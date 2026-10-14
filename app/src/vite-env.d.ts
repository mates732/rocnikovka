/// <reference types="vite/client" />

/**
 * Typed Vite environment variables.
 *
 * `VITE_API_BASE_URL` is the origin of the deployed Node backend. In local
 * development it is intentionally UNSET: an empty base makes every API call
 * relative to the frontend origin, and the Vite dev server proxies `/api` to
 * `http://localhost:3001` (see `vite.config.ts`).
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
