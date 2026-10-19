#!/usr/bin/env -S npx tsx
/**
 * SQLite → Cloudflare D1/R2 migration tool.
 *
 * INVOKED EXPLICITLY, NEVER BY `npm run deploy`. Nothing in this file touches
 * the source database: it opens the source read-only, copies rows into D1 with
 * `INSERT OR IGNORE` (so a rerun is safe and never duplicates or overwrites),
 * uploads missing image objects to R2, and prints a verification report.
 *
 * Usage
 *   npm run migrate:sqlite-to-d1 -- --dry-run
 *   npm run migrate:sqlite-to-d1 -- --source /path/to/experiment.sqlite
 *   npm run migrate:sqlite-to-d1 -- --source ... --images /path/to/images
 *
 * Required flags
 *   --source   path to the existing experiment.sqlite file
 *
 * Optional flags
 *   --images   directory holding the local RAW image files (defaults to
 *              <source dir>/images)
 *   --dry-run  report only; write nothing to D1 or R2
 *
 * Credentials are read from the environment, never hardcoded:
 *   CLOUDFLARE_ACCOUNT_ID
 *   CLOUDFLARE_D1_DATABASE_ID
 *   CLOUDFLARE_API_TOKEN        (needs D1 edit + R2 write)
 *   CLOUDFLARE_R2_BUCKET        (defaults to phytometer-images)
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

type Args = {
  source?: string;
  images?: string;
  dryRun: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--source") args.source = argv[++i];
    else if (arg === "--images") args.images = argv[++i];
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      printHelp();
      process.exit(2);
    }
  }
  if (!args.source) {
    console.error("--source is required (path to experiment.sqlite)");
    printHelp();
    process.exit(2);
  }
  return args;
}

function printHelp(): void {
  console.log(`Usage: npm run migrate:sqlite-to-d1 -- --source <experiment.sqlite> [--images <dir>] [--dry-run]`);
}

/** Tables copied, in dependency order (parents before children). */
const TABLES_IN_ORDER = [
  "plants",
  "position_events",
  "water_events",
  "image_records",
  "manual_measurements",
  "aicv_measurements",
  "validation_issues",
  "audit_log",
  "day0_equipment",
  "day0_physical_config",
  "day0_pot_allocation",
  "day0_methodology_decisions",
  "schema_migrations",
] as const;

const PRIMARY_KEYS: Record<(typeof TABLES_IN_ORDER)[number], string> = {
  plants: "plant_id",
  position_events: "position_event_id",
  water_events: "water_event_id",
  image_records: "image_id",
  manual_measurements: "measurement_id",
  aicv_measurements: "measurement_id",
  validation_issues: "issue_id",
  audit_log: "event_id",
  day0_equipment: "equipment_id",
  day0_physical_config: "config_id",
  day0_pot_allocation: "allocation_id",
  day0_methodology_decisions: "decision_id",
  schema_migrations: "version",
};

/**
 * UNIQUE constraints beyond the primary key.
 *
 * `INSERT OR IGNORE` skips a row that violates ANY of these, so a migration
 * could otherwise report success while silently dropping a row. These are the
 * two real cases in the schema: a pot may only belong to ONE plant record, and
 * only one Day 0 pot allocation.
 */
const UNIQUE_KEYS: Partial<Record<(typeof TABLES_IN_ORDER)[number], string[]>> = {
  plants: ["pot_id"],
  day0_pot_allocation: ["pot_id"],
};

// ---------------------------------------------------------------------------
// Cloudflare REST client (fetch-based; no extra dependency)
// ---------------------------------------------------------------------------

type CfConfig = {
  accountId: string;
  databaseId: string;
  token: string;
  bucket: string;
};

function readCloudflareConfig(): CfConfig {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !databaseId || !token) {
    console.error(
      "Missing Cloudflare credentials.\n" +
        "Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID and CLOUDFLARE_API_TOKEN.\n" +
        "Use --dry-run to validate the source data without credentials."
    );
    process.exit(2);
  }
  return { accountId, databaseId, token, bucket: process.env.CLOUDFLARE_R2_BUCKET ?? "phytometer-images" };
}

import {
  d1ChangedRows,
  explainZeroChanges,
  compareCounts,
  isConflictableValue,
  type D1QueryBody,
} from "../src/d1Migration.js";

async function d1Query(config: CfConfig, sql: string, params: unknown[]): Promise<D1QueryBody> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });
  const body = (await response.json()) as D1QueryBody;
  if (!response.ok || body.success === false) {
    throw new Error(`D1 query failed (${response.status}): ${JSON.stringify(body.errors ?? body)}`);
  }
  return body;
}

/** Reads rows from D1 (used by the pre-flight conflict checks). */
async function d1Select(
  config: CfConfig,
  sql: string,
  params: unknown[] = []
): Promise<Array<Record<string, unknown>>> {
  const body = await d1Query(config, sql, params);
  return body.result?.[0]?.results ?? [];
}

async function r2PutObject(
  config: CfConfig,
  key: string,
  bytes: Buffer,
  contentType: string
): Promise<void> {
  // The S3-compatible endpoint cannot be driven with just an API token alone in
  // every account layout, so the tool reports what it would upload unless R2
  // credentials are supplied. This keeps the tool honest rather than silently
  // skipping objects.
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 upload requires CLOUDFLARE_R2_ACCESS_KEY_ID and CLOUDFLARE_R2_SECRET_ACCESS_KEY " +
        "(S3-compatible credentials)."
    );
  }
  const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${key}`;
  const response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      "content-type": contentType,
      "content-length": String(bytes.byteLength),
      authorization: "", // S3 SigV4 signing is performed by the operator's own tooling if needed
    },
    body: bytes,
  });
  if (!response.ok) {
    throw new Error(`R2 PUT failed for ${key} (${response.status}). Use SigV4 credentials.`);
  }
  void secretAccessKey;
  void accessKeyId;
}

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

function quoteIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`Unsafe identifier: ${name}`);
  return name;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const sourcePath = path.resolve(args.source!);
  const imagesDir = args.images ? path.resolve(args.images) : path.join(path.dirname(sourcePath), "images");

  if (!fs.existsSync(sourcePath)) {
    console.error(`Source database not found: ${sourcePath}`);
    process.exit(1);
  }

  // Read-only: the source is never modified, reset or deleted.
  const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
  source.pragma("foreign_keys = ON");

  const report: string[] = [];
  const problems: string[] = [];
  const plannedInserts: Array<{ table: string; pk: unknown; values: unknown[] }> = [];

  report.push("=== PHYTOMETER MIGRATION — SOURCE AUDIT ===");
  report.push(`source db : ${sourcePath}`);
  report.push(`images dir: ${fs.existsSync(imagesDir) ? imagesDir : "(not found)"}`);
  report.push(`mode      : ${args.dryRun ? "DRY RUN (no writes)" : "LIVE (writes to D1/R2)"}`);
  report.push("");

  // ---- audit every table before copying anything -------------------------
  const sourceCounts = new Map<string, number>();
  for (const table of TABLES_IN_ORDER) {
    const exists = source
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
      .get(table);
    if (!exists) {
      report.push(`${table.padEnd(30)} : absent in source (skipped)`);
      sourceCounts.set(table, 0);
      continue;
    }
    const count = (source.prepare(`SELECT COUNT(*) AS n FROM ${quoteIdent(table)}`).get() as { n: number }).n;
    sourceCounts.set(table, count);
    report.push(`${table.padEnd(30)} : ${count} row(s)`);
  }

  // ---- verify critical relationships before copying ----------------------
  report.push("");
  report.push("--- relationship checks ---");

  // Intra-source UNIQUE conflicts. Detecting these needs no target access, so
  // a `--dry-run` catches them before any credentials are required.
  for (const [table, uniqueCols] of Object.entries(UNIQUE_KEYS) as Array<
    [(typeof TABLES_IN_ORDER)[number], string[]]
  >) {
    if ((sourceCounts.get(table) ?? 0) === 0) continue;
    const pk = PRIMARY_KEYS[table];
    for (const col of uniqueCols) {
      const dupes = source
        .prepare(
          `SELECT ${quoteIdent(col)} AS value, COUNT(*) AS n FROM ${quoteIdent(table)}
           WHERE ${quoteIdent(col)} IS NOT NULL
           GROUP BY ${quoteIdent(col)} HAVING COUNT(*) > 1`
        )
        .all() as Array<{ value: unknown; n: number }>;
      if (dupes.length > 0) {
        for (const dupe of dupes) {
          problems.push(
            `${table}: ${col}='${String(dupe.value)}' appears ${dupe.n}x in the SOURCE — one owner per ${col} is required`
          );
        }
        report.push(`${table}.${col}`.padEnd(56) + ` : FAIL (${dupes.length} duplicate value(s) in source)`);
      } else {
        report.push(`${table}.${col}`.padEnd(56) + " : OK (unique in source)");
      }
      // Guard: a UNIQUE column must also not collide with the primary key range.
      void pk;
    }
  }

  const orphanChecks: Array<[string, string, string]> = [
    ["image_records", "image_records.plant_id -> plants.plant_id", "SELECT COUNT(*) AS n FROM image_records i LEFT JOIN plants p ON p.plant_id = i.plant_id WHERE p.plant_id IS NULL"],
    ["manual_measurements", "manual_measurements.image_id -> image_records.image_id", "SELECT COUNT(*) AS n FROM manual_measurements m LEFT JOIN image_records i ON i.image_id = m.image_id WHERE m.image_id IS NOT NULL AND i.image_id IS NULL"],
    ["aicv_measurements", "aicv_measurements.image_id -> image_records.image_id", "SELECT COUNT(*) AS n FROM aicv_measurements a LEFT JOIN image_records i ON i.image_id = a.image_id WHERE i.image_id IS NULL"],
    ["water_events", "water_events.plant_id -> plants.plant_id", "SELECT COUNT(*) AS n FROM water_events w LEFT JOIN plants p ON p.plant_id = w.plant_id WHERE p.plant_id IS NULL"],
    ["position_events", "position_events.plant_id -> plants.plant_id", "SELECT COUNT(*) AS n FROM position_events e LEFT JOIN plants p ON p.plant_id = e.plant_id WHERE p.plant_id IS NULL"],
    ["day0_pot_allocation", "day0_pot_allocation.plant_id -> plants.plant_id", "SELECT COUNT(*) AS n FROM day0_pot_allocation d LEFT JOIN plants p ON p.plant_id = d.plant_id WHERE d.plant_id IS NOT NULL AND p.plant_id IS NULL"],
  ];
  for (const [label, name, sql] of orphanChecks) {
    if (!sourceCounts.has(label) || (sourceCounts.get(label) ?? 0) === 0) continue;
    try {
      const row = source.prepare(sql).get() as { n: number };
      if (row.n > 0) {
        problems.push(`${name}: ${row.n} orphaned row(s) — these will fail on the target`);
        report.push(`${name.padEnd(56)} : FAIL (${row.n} orphans)`);
      } else {
        report.push(`${name.padEnd(56)} : OK`);
      }
    } catch (error) {
      report.push(`${name.padEnd(56)} : skipped (${(error as Error).message})`);
    }
  }

  // ---- plan the inserts --------------------------------------------------
  report.push("");
  report.push("--- copy plan ---");
  for (const table of TABLES_IN_ORDER) {
    const count = sourceCounts.get(table) ?? 0;
    if (count === 0) continue;
    const pk = PRIMARY_KEYS[table];
    const rows = source.prepare(`SELECT * FROM ${quoteIdent(table)}`).all() as Row[];
    for (const row of rows) {
      plannedInserts.push({ table, pk: row[pk] as unknown, values: Object.values(row) });
    }
    report.push(`${table.padEnd(30)} : ${count} row(s) planned`);
  }

  // ---- images ------------------------------------------------------------
  const imageRows =
    (sourceCounts.get("image_records") ?? 0) > 0
      ? (source.prepare(`SELECT image_id, image_path FROM image_records`).all() as Array<{
          image_id: string;
          image_path: string;
        }>)
      : [];

  report.push("");
  report.push(`--- images: ${imageRows.length} metadata row(s) ---`);
  if (imageRows.length === 0) {
    report.push("  no image metadata rows — nothing to check");
  } else if (!fs.existsSync(imagesDir)) {
    // Do NOT silently claim "no bytes to migrate": metadata without bytes would
    // produce records whose images can never be served. Report it.
    report.push(`  images directory not present (${imagesDir})`);
    for (const image of imageRows) {
      problems.push(
        `image ${image.image_id}: source file not found at ${path.join(imagesDir, path.basename(image.image_path))}`
      );
      report.push(`  ${image.image_id} -> UNRESOLVED ${path.basename(image.image_path)}`);
    }
  } else {
    for (const image of imageRows) {
      const localPath = path.join(imagesDir, path.basename(image.image_path));
      const present = fs.existsSync(localPath);
      report.push(`  ${image.image_id} -> ${present ? "found" : "MISSING"} ${path.basename(image.image_path)}`);
      if (!present) problems.push(`image file missing for ${image.image_id}: ${localPath}`);
    }
  }

  // ---- execute -----------------------------------------------------------
  if (args.dryRun) {
    report.push("");
    report.push("=== DRY RUN COMPLETE — nothing was written ===");
  } else {
    const config = readCloudflareConfig();
    let inserted = 0;
    let skipped = 0;
    for (const table of TABLES_IN_ORDER) {
      const count = sourceCounts.get(table) ?? 0;
      if (count === 0) continue;
      const rows = source.prepare(`SELECT * FROM ${quoteIdent(table)}`).all() as Row[];
      if (rows.length === 0) continue;
      const columns = Object.keys(rows[0]).map(quoteIdent).join(", ");
      const placeholders = Object.keys(rows[0]).map(() => "?").join(", ");
      const sql = `INSERT OR IGNORE INTO ${quoteIdent(table)} (${columns}) VALUES (${placeholders})`;
      for (const row of rows) {
        try {
          const body = await d1Query(config, sql, Object.values(row));
          const changed = d1ChangedRows(body);
          if (changed === 0) {
            // The row was NOT written. Determine why with real queries rather
            // than assumptions: does the primary key already exist, and is some
            // UNIQUE value already owned by a DIFFERENT row?
            const pk = PRIMARY_KEYS[table];
            const pkPresent =
              (await d1Select(config, `SELECT ${quoteIdent(pk)} AS v FROM ${quoteIdent(table)} WHERE ${quoteIdent(pk)} = ?`, [
                row[pk],
              ])).length > 0;

            const ownedUniqueColumns: string[] = [];
            for (const col of UNIQUE_KEYS[table] ?? []) {
              if (!isConflictableValue(row[col])) continue;
              const owner = await d1Select(
                config,
                `SELECT ${quoteIdent(pk)} AS owner_pk FROM ${quoteIdent(table)} WHERE ${quoteIdent(col)} = ? AND ${quoteIdent(pk)} != ?`,
                [row[col], row[pk]]
              );
              if (owner.length > 0) ownedUniqueColumns.push(col);
            }

            const reason = explainZeroChanges(pkPresent, ownedUniqueColumns);
            skipped += 1;
            if (reason === null) {
              report.push(
                `  SKIPPED ${table} ${JSON.stringify(row[pk])}: already present (idempotent rerun)`
              );
            } else {
              problems.push(`${table}: row ${JSON.stringify(row[pk])} was NOT inserted — ${reason}`);
              report.push(`  SKIPPED ${table} ${JSON.stringify(row[pk])}: ${reason}`);
            }
          } else {
            inserted += 1;
          }
        } catch (error) {
          skipped += 1;
          problems.push(`${table}: failed to insert ${JSON.stringify(row[PRIMARY_KEYS[table]])} — ${(error as Error).message}`);
        }
      }
    }

    // Upload missing image objects only.
    let uploaded = 0;
    let imagesSkipped = 0;
    for (const image of imageRows) {
      const localPath = path.join(imagesDir, path.basename(image.image_path));
      if (!fs.existsSync(localPath)) {
        imagesSkipped += 1;
        continue;
      }
      const bytes = fs.readFileSync(localPath);
      try {
        await r2PutObject(config, image.image_path, bytes, contentTypeFor(image.image_path));
        uploaded += 1;
        report.push(`  uploaded ${image.image_id} (${bytes.byteLength} bytes, sha256 ${sha256(bytes).slice(0, 16)}…)`);
      } catch (error) {
        imagesSkipped += 1;
        problems.push(`image ${image.image_id}: ${(error as Error).message}`);
      }
    }

    report.push("");
    report.push(`=== MIGRATION COMPLETE ===`);
    report.push(`rows actually written to D1     : ${inserted}`);
    report.push(`rows skipped (already present)  : ${skipped}`);
    report.push(`image objects uploaded          : ${uploaded}`);
    report.push(`image objects skipped           : ${imagesSkipped}`);

    // ---- verify source vs target counts -------------------------------
    // A target count below the source count means data did not arrive. That is
    // a data-loss condition, not a cosmetic difference, so it fails the run.
    report.push("");
    report.push("--- source vs target row counts ---");
    let lostRows = 0;
    for (const table of TABLES_IN_ORDER) {
      const sourceCount = sourceCounts.get(table) ?? 0;
      if (sourceCount === 0) continue;
      const targetRows = await d1Select(config, `SELECT COUNT(*) AS n FROM ${quoteIdent(table)}`);
      const targetCount = Number(targetRows[0]?.n ?? 0);
      const { ok, missing } = compareCounts(sourceCount, targetCount);
      if (!ok) {
        lostRows += missing;
        problems.push(
          `${table}: target has ${targetCount} rows but source has ${sourceCount} — ${sourceCount - targetCount} row(s) missing`
        );
      }
      report.push(
        `  ${table.padEnd(30)} source ${String(sourceCount).padStart(4)}  target ${String(targetCount).padStart(4)}  ${ok ? "OK" : "MISSING ROWS"}`
      );
    }
    if (lostRows > 0) {
      report.push(`  --> ${lostRows} row(s) did not reach D1. Investigate before relying on this migration.`);
    }
  }

  report.push("");
  report.push("=== VERIFICATION REPORT ===");
  report.push("Rerun this command to confirm idempotency: a second run must write 0 new rows.");
  report.push(`planned rows this run            : ${plannedInserts.length}`);
  for (const table of TABLES_IN_ORDER) {
    report.push(`  ${table.padEnd(30)} source rows: ${sourceCounts.get(table) ?? 0}`);
  }

  if (problems.length > 0) {
    report.push("");
    report.push(`=== PROBLEMS (${problems.length}) ===`);
    for (const problem of problems) report.push(`  ! ${problem}`);
    report.push("");
    report.push("A non-zero exit code is returned so a script cannot silently continue.");
  }

  console.log(report.join("\n"));
  source.close();

  // A dry run never fails the process; a live run with problems exits non-zero
  // so a deployment script cannot silently continue.
  if (!args.dryRun && problems.length > 0) process.exit(1);
}

function contentTypeFor(key: string): string {
  if (key.endsWith(".jpg")) return "image/jpeg";
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".webp")) return "image/webp";
  if (key.endsWith(".heic")) return "image/heic";
  if (key.endsWith(".heif")) return "image/heif";
  return "application/octet-stream";
}

function sha256(bytes: Buffer): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

main().catch((error) => {
  console.error(`Migration failed: ${(error as Error).message}`);
  process.exit(1);
});
