/**
 * Shared error contract for the controlled JSON write endpoints (Phase 4J).
 *
 * Structured, sanitized errors only: raw SQL errors, stack traces and
 * filesystem details are never surfaced. Validation/reference failures carry
 * an optional `issues` array in the same shape used by the CSV import API.
 */

export type WriteIssue = {
  field: string;
  code: string;
  message: string;
};

export class ServiceError extends Error {
  readonly code: string;
  readonly status: number;
  readonly issues?: WriteIssue[];

  constructor(message: string, code: string, status: number, issues?: WriteIssue[]) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.status = status;
    this.issues = issues;
  }
}

export function issue(field: string, code: string, message: string): WriteIssue {
  return { field, code, message };
}

/**
 * Compares two records field-by-field after normalizing undefined and empty
 * strings to null (mirroring how repositories persist optional fields as SQL
 * NULL). Used to decide whether a duplicate ID carries identical content.
 */
export function persistedFieldsEqual(
  a: object,
  b: object,
  fields: readonly string[]
): boolean {
  const leftRecord = a as Record<string, unknown>;
  const rightRecord = b as Record<string, unknown>;
  for (const field of fields) {
    const left = leftRecord[field] === undefined || leftRecord[field] === "" ? null : leftRecord[field];
    const right = rightRecord[field] === undefined || rightRecord[field] === "" ? null : rightRecord[field];
    if (left !== right) return false;
  }
  return true;
}
