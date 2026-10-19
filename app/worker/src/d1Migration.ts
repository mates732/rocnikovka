/**
 * Pure helpers for the SQLite → D1 migration, extracted from the CLI script so
 * they can be unit-tested without Cloudflare credentials.
 */

/** Shape of the Cloudflare D1 REST query response. */
export type D1QueryBody = {
  success?: boolean;
  errors?: unknown[];
  result?: Array<{
    results?: Array<Record<string, unknown>>;
    meta?: { changes?: number; changed_db?: boolean };
    success?: boolean;
  }>;
};

/**
 * Sums the rows a statement actually changed in D1.
 *
 * This is the number that matters: `INSERT OR IGNORE` silently skips a row that
 * violates any constraint (PRIMARY KEY *or* UNIQUE), so counting the rows we
 * *sent* would overstate what was written. `meta.changes` is the truth.
 */
export function d1ChangedRows(body: D1QueryBody): number {
  return (body.result ?? []).reduce((sum, part) => sum + (part.meta?.changes ?? 0), 0);
}

/**
 * Explains why a row produced zero changes in D1.
 *
 * @param pkPresent          true when a row with the same PRIMARY KEY already exists in D1
 * @param ownedUniqueColumns the UNIQUE columns whose value is already taken by a DIFFERENT row
 * @returns a human-readable reason, or null when the row is simply already present
 */
export function explainZeroChanges(
  pkPresent: boolean,
  ownedUniqueColumns: readonly string[]
): string | null {
  if (pkPresent) return null;
  if (ownedUniqueColumns.length > 0) {
    return `UNIQUE conflict on '${ownedUniqueColumns[0]}'`;
  }
  return "row was not written (reason not identified)";
}

/**
 * True when a column value is a real candidate for a UNIQUE conflict.
 * Blank and null values cannot collide with an existing owner.
 */
export function isConflictableValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

/**
 * Compares source and target row counts for a table.
 * A target count below the source count means rows did not arrive.
 */
export function compareCounts(
  sourceCount: number,
  targetCount: number
): { ok: boolean; missing: number } {
  return { ok: targetCount >= sourceCount, missing: Math.max(0, sourceCount - targetCount) };
}
