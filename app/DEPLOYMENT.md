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

## Why the backend is not deployed here

The backend needs a **persistent writable filesystem**:

- `better-sqlite3` opens a single SQLite file at
  `app/server/server/storage/experiment.sqlite`
- uploaded photographs are written to `app/server/server/storage/images/`

Vercel serverless functions have an ephemeral, read-only filesystem. Running
SQLite or storing images there would silently lose experiment data (records and
photographs would disappear between invocations). Therefore this repository
deliberately does **not** fake a serverless backend, does **not** switch to
Supabase, and does **not** mock the API. The honest failure is a 404 that the UI
reports.

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

1. **Deploy the backend** somewhere with a persistent disk, for example a small
   VPS, or Railway / Render / Fly.io with a mounted volume. Run from `app/server`:

   ```bash
   npm install
   npm run build      # tsc -p tsconfig.json
   npm run db:init    # starts the server, applies migrations, seeds nothing
   ```

   The port comes from the server's own configuration (`PORT`, default 3001).

2. **Point the frontend at it** by setting the build-time environment variable
   in the Vercel project:

   | Variable | Example |
   |---|---|
   | `VITE_API_BASE_URL` | `https://api.your-domain.com` |

   No trailing slash and no `/api` suffix — the app appends `/api/...` itself.
   Because the value is **inlined at build time**, the frontend must be
   **redeployed** after changing it.

3. **Verify** the backend first, independent of the frontend:

   ```bash
   curl -i https://api.your-domain.com/api/plants
   # expect HTTP 200 and {"data":[...]}
   ```

   Then open the frontend and confirm the Overview and Day 0 pages show real
   counts instead of the error state.

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
