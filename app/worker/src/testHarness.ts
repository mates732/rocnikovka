/**
 * Test harness: binds a real in-memory SQLite database to the `D1Like`
 * interface used by the repositories.
 *
 * This is deliberately honest rather than mocked. Cloudflare D1 is SQLite at its
 * core, so exercising the same SQL statements against real SQLite validates:
 *   - the SQL is valid SQLite (not something D1 would reject)
 *   - CHECK / UNIQUE / PRIMARY KEY / FOREIGN KEY constraints are genuinely
 *     enforced, which is what the duplicate-detection and append-only tests need
 *
 * What it does NOT prove: D1 itself, R2 itself, or production persistence. Those
 * require a live deployment and are documented as manual steps.
 */
import Database from "better-sqlite3";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { D1Like, D1PreparedStatement } from "./d1Repos.js";
import type { R2BucketLike } from "./r2Images.js";

class SqliteStatement implements D1PreparedStatement {
  private params: unknown[] = [];

  constructor(private readonly db: Database.Database, private readonly sql: string) {}

  bind(...values: unknown[]): D1PreparedStatement {
    this.params = values;
    return this;
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...this.params);
    return (row as T | undefined) ?? null;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    const rows = this.db.prepare(this.sql).all(...this.params) as T[];
    return { results: rows };
  }

  async run(): Promise<{ success: boolean; meta?: Record<string, unknown> }> {
    const result = this.db.prepare(this.sql).run(...this.params);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}

/**
 * The real D1 migration directory used at deploy time, resolved from the package
 * root so the tests run against exactly the schema `wrangler d1 migrations
 * apply` installs (`npm test` always runs with cwd = this package).
 */
const MIGRATIONS_DIR = join(process.cwd(), "migrations");

/** Loads the deployed migration files in filename order. */
export function loadMigrations(): string[] {
  const names = readdirSync(MIGRATIONS_DIR).filter((n) => n.endsWith(".sql")).sort();
  return names.map((name) => readFileSync(join(MIGRATIONS_DIR, name), "utf8"));
}

export class SqliteD1 implements D1Like {
  constructor(private readonly db: Database.Database) {}

  prepare(query: string): D1PreparedStatement {
    return new SqliteStatement(this.db, query);
  }

  /** Executes raw SQL (used by the migration tests). */
  exec(sql: string): void {
    this.db.exec(sql);
  }

  /** Applies the real deployment migrations, in order. */
  static fromMigrations(): SqliteD1 {
    const db = new Database(":memory:");
    // Disable foreign keys during migration to allow DROP/CREATE of tables with constraints
    db.pragma("foreign_keys = OFF");
    for (const migration of loadMigrations()) {
      db.exec(migration);
    }
    // Re-enable foreign keys for test execution
    db.pragma("foreign_keys = ON");
    return new SqliteD1(db);
  }
}

/** In-memory R2 stand-in. Enforces nothing except the object-store contract. */
export class MemoryR2 implements R2BucketLike {
  readonly objects = new Map<string, { bytes: ArrayBuffer; contentType: string }>();

  async put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | string,
    options?: { httpMetadata?: { contentType?: string } }
  ): Promise<unknown> {
    let bytes: ArrayBuffer;
    if (typeof value === "string") bytes = new TextEncoder().encode(value).buffer as ArrayBuffer;
    else if (value instanceof ArrayBuffer) bytes = value;
    else bytes = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
    this.objects.set(key, { bytes, contentType: options?.httpMetadata?.contentType ?? "application/octet-stream" });
    return null;
  }

  async get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; httpMetadata?: { contentType?: string } } | null> {
    const object = this.objects.get(key);
    if (!object) return null;
    return {
      arrayBuffer: async () => object.bytes,
      httpMetadata: { contentType: object.contentType },
    };
  }

  async head(key: string): Promise<{ size: number } | null> {
    const object = this.objects.get(key);
    return object ? { size: object.bytes.byteLength } : null;
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
}
