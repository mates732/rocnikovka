/**
 * Phase 4K.2 — structured frontend error type for backend responses.
 *
 * Mirrors the backend error contract:
 *   { error: { code: string, message: string, issues?: [{ field, code, message }] } }
 *
 * Raw server text (stack traces, HTML, filesystem paths) is never surfaced:
 * if the response body is not a parseable JSON error object, a sanitized
 * fallback ApiError is produced instead.
 */

export type WriteIssue = {
  field: string;
  code: string;
  message: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues: WriteIssue[];

  constructor(status: number, code: string, message: string, issues: WriteIssue[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

const FALLBACK_CODE = "http.error";

function isWriteIssue(value: unknown): value is WriteIssue {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.field === "string" &&
    typeof record.code === "string" &&
    typeof record.message === "string"
  );
}

/** Builds a sanitized ApiError from a non-OK Response. */
export async function apiErrorFromResponse(response: Response): Promise<ApiError> {
  const status = response.status;
  let code = FALLBACK_CODE;
  let message = `Request failed with HTTP status ${status}`;
  let issues: WriteIssue[] = [];

  try {
    const body = (await response.json()) as unknown;
    const error = (body as { error?: unknown })?.error;
    if (error && typeof error === "object") {
      const record = error as Record<string, unknown>;
      if (typeof record.code === "string" && record.code.length > 0) {
        code = record.code;
      }
      if (typeof record.message === "string") {
        message = record.message;
      }
      if (Array.isArray(record.issues)) {
        issues = record.issues.filter(isWriteIssue);
      }
    }
  } catch {
    // Non-JSON / empty body: keep the sanitized fallback message.
  }

  return new ApiError(status, code, message, issues);
}
