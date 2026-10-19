# Phytometer API — Cloudflare Workers deployment

Free-tier backend for the existing Vercel frontend:
- **API**: Cloudflare Worker (`app/worker`)
- **Database**: Cloudflare D1 (SQLite-compatible, same schema as the Node backend)
- **Images**: Cloudflare R2 (private bucket, served through the Worker)

Local development still works exactly as before — the Node backend in `app/server`
is unchanged and remains the reference implementation for rollback.

## 1. Create the Cloudflare resources (dashboard or CLI)

Log in once, then create the database and bucket:

```bash
cd app/worker
npm install

npx wrangler login
npx wrangler d1 create phytometer-db
npx wrangler r2 bucket create phytometer-images
```

`wrangler d1 create` prints a `database_id`. Put it in `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "phytometer-db"
database_id = "<paste the id here>"
```

No R2 credentials are needed for the Worker itself: the bucket is reached
through the `IMAGES` binding, never through an access key.

## 2. Apply the schema

```bash
npm run db:migrate:local    # applies migrations/0001, 0002 to the local D1
npm run db:migrate:remote   # applies them to the real D1 database
```

The schema is the consolidated v8 state of `app/server/src/db.ts`; it preserves
primary keys, unique constraints, CHECK constraints, foreign keys and the Day 0
columns.

## 3. Configure the allowed origin

In `wrangler.toml`:

```toml
[vars]
ALLOWED_ORIGIN = "https://<your-project>.vercel.app"
```

Only this origin is echoed in CORS headers. Other origins receive the
configured origin instead, so a random site cannot read the API from a browser.

## 4. Test locally before deploying

```bash
npm run dev      # wrangler dev — local D1 + local R2 simulator
```

Then verify the deployed-equivalent behaviour:

```bash
curl -i http://localhost:8787/api/health
curl -i http://localhost:8787/api/plants
```

To exercise an end-to-end local stack with real data, migrate the existing
SQLite file into the local D1 first (see step 6), then run the frontend with
`VITE_API_BASE_URL=http://localhost:8787`.

## 5. Deploy

```bash
npm run deploy
```

Wrangler prints the Worker URL, e.g.
`https://phytometer-api.<your-subdomain>.workers.dev`.

Verify it before touching Vercel:

```bash
curl -i https://phytometer-api.<your-subdomain>.workers.dev/api/health
curl -i https://phytometer-api.<your-subdomain>.workers.dev/api/plants
```

`/api/health` returns HTTP 200 with JSON — that alone does **not** prove
persistence. See step 8 for the real persistence check.

## 6. Migrate the existing SQLite data and images

The migration is **explicit and separate** from deployment. It never resets or
modifies the source database, and it is safe to rerun.

Back up first (see step 9), then:

```bash
# Audit only — read nothing, write nothing
npm run migrate:sqlite-to-d1 -- --dry-run \
  --source ../server/server/storage/experiment.sqlite

# Real copy (requires Cloudflare credentials in the environment)
export CLOUDFLARE_ACCOUNT_ID=...
export CLOUDFLARE_D1_DATABASE_ID=...
export CLOUDFLARE_API_TOKEN=...          # needs D1 edit + R2 write

npm run migrate:sqlite-to-d1 -- \
  --source ../server/server/storage/experiment.sqlite
```

The tool:
- opens the source **read-only**,
- copies every table with `INSERT OR IGNORE` (parents before children),
- reports row counts per table and a relationship check before writing,
- reports missing image files as problems instead of silently skipping them,
- prints a verification report and exits non-zero on any problem.

Rerun the same command to confirm idempotency: a second run must insert nothing
new.

### R2 credentials for the image copy

The D1 copy needs only the API token. Uploading image bytes to R2 uses the
S3-compatible endpoint, which needs its own credentials:

```bash
export CLOUDFLARE_R2_ACCESS_KEY_ID=...
export CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
export CLOUDFLARE_R2_BUCKET=phytometer-images
```

If those are absent the tool reports each image as unresolved and exits
non-zero, rather than pretending the bytes were migrated.

## 7. Point the Vercel frontend at the Worker

In the Vercel project settings, set the **build-time** environment variable:

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://phytometer-api.<your-subdomain>.workers.dev` |

No trailing slash, no `/api` suffix. Because the value is inlined at build time,
the frontend must be **redeployed** after setting it. See
`app/DEPLOYMENT.md` for how the frontend resolves this and what the unconfigured
state looks like.

## 6a. Isolated test environment (D1 + R2)

Production D1 and R2 must never receive test data. `wrangler.toml` defines a
separate `[env.test]` with its own bindings and `ALLOWED_ORIGIN=http://localhost:5173`.

Create it once (both are Free-tier):

```bash
npx wrangler d1 create phytometer-db-test
npx wrangler r2 bucket create phytometer-images-test
```

Paste the printed `database_id` into `[env.test.d1_databases]` in `wrangler.toml`,
then:

```bash
# Apply the schema to the test database
npx wrangler d1 migrations apply phytometer-db-test --env test

# Run the Worker against the test D1 + test R2
npm run dev -- --env test          # -> http://localhost:8787
```

Until the `database_id` is filled in, `--env test` cannot be deployed, but local
`wrangler dev --env test` still works because it uses the local D1 simulator.

Test writes go to `phytometer-db-test` / `phytometer-images-test` only.
Production (`phytometer-db` / `phytometer-images`) is untouched.

## 6b. Cloudflare Access (free, protects the workers.dev URL)

> **Verified status on this account (2026-10-14): Access is NOT enabled.**
> `POST/GET /accounts/{id}/access/*` returns
> `access.api.error.not_enabled: Access is not enabled. Visit the Access
> dashboard at https://dash.cloudflare.com/ and click the 'Enable Access' button.`
> and the Wrangler OAuth token carries no Access scope (403 on every Access
> endpoint). **Enabling Access is therefore a manual dashboard action** — it
> cannot be scripted with the credentials available here. Everything below the
> code already supports; only the toggle is missing.

### Live security probe (test Worker, 2026-10-14)

With Access disabled, the following were **verified against the deployed test
Worker** — not inferred:

| Probe | Result |
|---|---|
| `GET /api/health` with no credentials | **200** |
| `GET /api/plants` with no credentials | **200** |
| `POST /api/plants` with a valid body, no credentials | **201 — a record was created** (row count 4 → 5) |
| `POST /api/water-events` valid body | **201** |
| `POST /api/position-events` valid body | **201** |
| `POST /api/manual-measurements` valid body | **201** |
| `POST /api/day0/methodology-decisions` valid body | **201** |
| `PATCH` a decision to `approved` with a fabricated `decided_by` | **200 — the approval was accepted** |
| `POST /api/plants/:id/deactivate` to mark a plant `dead` | **200 — the plant was marked dead** |

A malformed `POST` returning 400 is **not** evidence of authentication; it is
input validation. The probes above use valid payloads and prove the application
layer accepts anyone.

### Where the boundary must sit

The Worker contains **no** authentication logic — by design, because Cloudflare
Access enforces identity at the edge *before* the Worker executes. Four tests in
`src/worker.test.ts` under "SECURITY BOUNDARY" lock this contract in place, so
any future change that moves authentication into or out of the app layer fails
the suite and forces a deliberate re-verification.

**Until Access is enabled and verified, the production frontend must not be
connected to any Worker.**

Cloudflare Access protects `*.workers.dev` hostnames and costs nothing on the
Cloudflare One **Free** plan (up to 50 users). Dashboard path:

**Workers & Pages** → select `phytometer-api` → **Access** tab →
**Protect this Worker behind Access** → **All traffic** → choose a policy
(*Cloudflare account* members, or *Email domain*) → **Apply Access**.

Prerequisite: **Zero Trust** must be enabled on the account (one-time setup).

What the code already does to make Access work:

| Piece | File | Purpose |
|---|---|---|
| `access-control-allow-credentials: true` | `src/http.ts` | Lets the browser send/read the `CF_Authorization` cookie cross-origin. Without it the credentialed response is discarded. |
| `credentials: "include"` on every fetch | `app/src/data/adapters.ts`, `app/src/pages/Day0*.tsx` | Sends the cookie. Without it the browser never transmits it. |
| Single explicit origin (never `*`) | `src/http.ts` | A wildcard origin is illegal when credentials are allowed. |

Verify after enabling:

```bash
# Must be refused, NOT 201
curl -i -X POST https://phytometer-api.<subdomain>.workers.dev/api/plants \
  -H 'content-type: application/json' -d '{}'
```

### Known limitation: third-party cookies

The frontend runs on `rocnikovka-ashy.vercel.app` and the API on
`78thz568ph.workers.dev`, so the Access cookie is a **third-party cookie**.
Cloudflare's own documentation notes that some browsers block third-party cookies
in private windows, which can break XHR requests to the API. If this affects your
browsers, the robust fix is a custom domain so both first-party share a site.

### Local simulation of Access

`wrangler.toml` contains an `[access.dev]` block so `wrangler dev` can simulate an
authenticated identity without a real login:

```toml
[access.dev]
aud = "phytometer-api"
  [access.dev.identity]
  email = "student@example.com"
```

Change `email` and restart to test as a different user. Removing the block makes
`ctx.access` undefined, as it would be for a genuinely unauthenticated request.

## 6c. Pagination (protects the D1 free-tier read budget)

D1 on the Free plan enforces **5,000,000 rows read/day**. Every list endpoint was
an unbounded full scan, so all of them are now paginated:

| Parameter | Default | Maximum |
|---|---|---|
| `limit` | 50 | 200 |
| `offset` | 0 | — |

```bash
curl "https://<worker>/api/plants?limit=50&offset=100"
```

A prior out-of-range value is a **400**, never a silent clamp — a caller must not
receive a wrong page without knowing. Responses stay backward compatible:

```json
{ "data": [ … ], "meta": { "total": 27, "limit": 50, "offset": 0, "has_more": false, "returned": 27 } }
```

## 8. Verify real persistence (not just HTTP 200)

Unit tests prove the SQL and the routes against real SQLite; they do **not**
prove D1 durability. Verify on the live deployment:

```bash
API=https://phytometer-api.<your-subdomain>.workers.dev

# 1. Write
curl -i -X POST "$API/api/plants" \
  -H 'content-type: application/json' \
  -d '{"plant_id":"PLT-001","pot_id":"POT-001","group_name":"G1",
       "emergence_date":"2026-01-01","status":"active",
       "created_at":"2026-01-01T00:00:00"}'

# 2. Read back — must return the row you just wrote
curl -i "$API/api/plants/PLT-001"

# 3. Restart check: write, then read again from a second request. If the row is
#    gone, the write never reached D1 and the deployment is not usable.

# 4. Image round-trip
curl -i -X POST "$API/api/images/upload" \
  -F "file=@frame.jpg;type=image/jpeg" \
  -F "plant_id=PLT-001" \
  -F "timestamp=2026-01-01T00:00:00" \
  -F "experiment_day=1" \
  -F "camera_id=CAM-01" \
  -F "image_quality_status=PASS" \
  -F "calibration_status=pass"
```

Then open the frontend and confirm the Overview and Day 0 pages show real counts
instead of the source-error state.

## 9. Back up and roll back

### Back up D1

```bash
# Full logical export (SQL)
npx wrangler d1 export phytometer-db --remote --output backup-$(date +%F).sql

# Or query-based export of every table
npm run migrate:sqlite-to-d1 -- --dry-run --source <any sqlite copy>
```

### Back up R2

```bash
npx wrangler r2 object get phytometer-images/... > backup/...
# Or list every object and download it:
npx wrangler r2 object list phytometer-images
```

### Roll back

Rolling back means pointing the frontend back at the Node backend — the source
SQLite file and local images are never deleted by the migration, so the Node
implementation keeps working unchanged:

```bash
# Vercel: remove/clear VITE_API_BASE_URL and redeploy (the frontend then uses
# the same-origin /api path, which the Node backend serves).
cd app/server && npm run db:init
```

No data is destroyed by a rollback: the migration only ever **adds** to D1/R2
and never deletes from the source.

## 10. Current limits to be aware of

Cloudflare's free tiers change over time; verify the current limits at
<https://developers.cloudflare.com/workers/platform/limits/> before relying on
them for the full 28-day experiment. At the time of writing the relevant free
tiers are ample for 27 pots of metadata plus ~756 daily photographs.

## 11. Test suite and what each part proves

```bash
npm test            # 80 tests — no Cloudflare account needed
npm run typecheck
```

| Area | How it is tested | What it proves | What it does NOT prove |
|---|---|---|---|
| Routes, response shapes, status codes | Real router against **real SQLite** bound through the `D1Like` interface | SQL is valid SQLite, constraints are genuinely enforced, API contract holds | — |
| Validation, duplicates, traceability | Same harness, real CHECK/UNIQUE/FK constraints | 400/409/404 codes match the Node backend | — |
| Append-only (no DELETE/PUT) | Request against the real router | 404 for every mutating method | — |
| R2 upload / retrieval | `MemoryR2` store | Bytes stored and returned intact; 400/413/404 paths; path traversal rejected | R2 durability |
| Missing image | Real router + empty store | 404, never an empty 200 | — |
| CORS | Real router | Correct origin echoed; disallowed origin not granted; `allow-credentials` present | Browser behaviour |
| Pagination | Pure module + router | default 50, max 200, `meta` correct, 400 on invalid | — |
| Migration | `--dry-run` against a real SQLite file | Real counts reported; source never modified; UNIQUE conflicts detected | Live D1 writes |
| Credentialed requests | Stubbed `fetch` in the frontend suite | Every call carries `credentials: "include"` | Real Access login flow |

The full stack suite:

```bash
cd ../server && npm test     # 227 tests — the Node backend (unchanged reference)
cd ../       && npm test     # 219 tests — frontend, incl. apiUrl + credentials
```

## 12. Migration tool: accurate counts and conflict detection

The migration tool never reports a number it did not verify. For every row it:

1. reads the **actual** `meta.changes` from the D1 response — `INSERT OR IGNORE`
   silently skips a row that violates any constraint, so counting sent rows would
   overstate what was written;
2. if a row produced zero changes, queries D1 for the primary key **and** for
   every UNIQUE column to find the real reason (already present vs. owned by
   another row);
3. verifies source-vs-target row counts for every table and fails when the target
   has fewer rows than the source;
4. also detects a duplicate UNIQUE value **inside the source** (a legacy database
   may predate the constraint), which works with `--dry-run` and no credentials;
5. exits with a **non-zero code** on any problem so a script cannot continue
   silently.

```bash
npm run migrate:sqlite-to-d1 -- --dry-run --source ../server/server/storage/experiment.sqlite
```

A second run must report `rows actually written to D1 : 0`.
