import type Database from "better-sqlite3";

export class RepositoryError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "RepositoryError";
    this.code = code;
  }
}

export function throwValidation(issues: string[]): never {
  throw new RepositoryError(issues.join("; "), "validation.failed");
}

export function mapSqliteError(error: unknown): never {
  if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) {
    throw new RepositoryError(error.message, "id.duplicate");
  }
  if (error instanceof Error && /FOREIGN KEY constraint failed/.test(error.message)) {
    throw new RepositoryError(error.message, "reference.missing_parent");
  }
  if (error instanceof Error) {
    throw new RepositoryError(error.message, "repository.error");
  }
  throw new RepositoryError("Unknown repository error", "repository.error");
}

/** Current time as an ISO 8601 timestamp with second precision (no ms, no Z). */
export function nowIsoSeconds(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "");
}

export type DbHandle = Database.Database;
