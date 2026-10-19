# Deployment — why `/api/*` returns 404 and how to fix it

## Symptom

On the deployed app (`https://<project>.vercel.app`), every data source shows an
error such as:

- "Nelze načíst data" (Day 0 dashboard)
- "Some record sources could not be read" (Overview)

Every backend request returns **HTTP 404**.

## Verified root cause

The Vercel deployment hosts the **static Vite frontend only**. The Node/TypeScript
backend in `app/server/` (SQLite + local filesystem image storage) is **not
deployed anywhere**.

All frontend requests are built by `src/data/apiBase.ts`:

```ts
const rawBase = (import.meta.env && import.meta.env.VITE_API_BASE_URL) || "";
export const API_BASE_URL = normalizeApiBase(rawBase); // "" when unset
export function apiUrl(path) { return joinApiUrl(API_BASE_URL, path); }
```

With `VITE_API_BASE_URL` unset, `API_BASE_URL` is `""`, so a call becomes:

| Requested URL (incorrect, unconfigured) |
|-----------------------------------------|
| `https://<project>.vercel.app/api/plants` |
| `https://<project>.vercel.app/api/day0/equipment` |
| `https://<project>.vercel.app/api/water-events` |

Vercel has no route for `/api/*` and no serverless function handling it, so it
returns 404.

**This is Vercel routing returning the 404 (there is no backend to reach).** It
is not an empty database, and the app reports it as an error rather than
pretending the lists are empty.

## The fix in this repository

Two things are now in place:

1. **A Cloudflare Worker backend** in `app/worker` (D1 + R2), implementing the
   same API with the same validation and append-only rules. See
   `app/worker/README.md` for how to create the resources, apply the schema,
   deploy, verify persistence, migrate the existing SQLite data, and roll back.
2. **A configurable API base** so the frontend can point at it, plus a
   `vercel.json` SPA rewrite so deep links load.

## The two parts of the fix applied in this repository

### 1. Centralized, configurable API base (code)

`src/data/apiBase.ts` is now the single place where every API URL is built.
Confirmed by `src/data/apiBase.test.ts` and the adapter tests in
`src/data/adapters.test.ts`.

### 2. SPA deep-link rewrite (deployment config)

`app/vercel.json` adds a client-side rewrite so direct links such as
`/experiment/day0` load the SPA instead of 404:

```json
{
  "rewrites": [
    { "source": "/((?!api(?:/|$)).*)", "destination": "/index.html" }
  ]
}
```

The `(?!api...)` lookahead is deliberate: `/api/*` is **excluded** from the SPA
rewrite, so an API miss keeps returning a genuine 404 rather than HTML with a
200. API errors stay visible; they are never masked.

## What is still required (external action)

1. **Create the Cloudflare resources** (D1 database + R2 bucket) — see
   `app/worker/README.md` step 1.
2. **Deploy the Worker** — `app/worker` step 5. This is an action only you can
   perform; it cannot be done from this repository.
3. **Migrate the existing SQLite data and images** into D1/R2 with the explicit
   command in `app/worker/README.md` step 6. It is never run by a deploy.
4. **Set `VITE_API_BASE_URL`** to the deployed Worker origin in the Vercel
   project. The value is **inlined at build time**, so the frontend must be
   **redeployed** after changing it.

| Variable | Example |
|---|---|
| `VITE_API_BASE_URL` | `https://phytometer-api.your-subdomain.workers.dev` |

No trailing slash and no `/api` path prefix — the app appends `/api/...` itself.

5. **Verify** the Worker first, independent of the frontend:

   ```bash
   curl -i https://phytometer-api.your-subdomain.workers.dev/api/plants
   # expect HTTP 200 and {"data":[...]}
   ```

   A 200 from `/api/health` only proves the Worker runs; follow the persistence
   check in `app/worker/README.md` step 8 before treating it as trustworthy.

Then open the frontend and confirm the Overview and Day 0 pages show real
counts instead of the error state.

## Fallback: keep the Node backend

The Node backend in `app/server` is unchanged and still works locally with

```bash
cd app/server && npm run db:init
```

If you prefer to host it on a persistent VPS instead of using Cloudflare,
set `VITE_API_BASE_URL` to that origin and redeploy the frontend. The Worker
exists so that free, durable hosting is possible without a paid VPS.

## Local development (unchanged)

Leave `VITE_API_BASE_URL` unset. Requested URLs stay relative (`/api/plants`) and
the Vite dev server proxies them to `http://localhost:3001` — see
`vite.config.ts`.

```bash
# terminal 1 — backend
cd app/server && npm run db:init

# terminal 2 — frontend
cd app && npm run dev
```

## Verifying the deployed app

1. `curl -i https://<backend>/api/plants` → must be `200` with JSON.
2. `curl -i https://<project>.vercel.app/api/plants` → still `404`; this is
   expected and correct, because the API lives on the backend origin.
3. Open `https://<project>.vercel.app/` → Overview shows counts, no source alert.
4. Open `https://<project>.vercel.app/experiment/day0` → loads directly (SPA
   rewrite) and shows persisted Day 0 data.
5. If the alert still appears, the page now prints the configured API origin so
   you can tell an unset variable from a dead backend at a glance.
