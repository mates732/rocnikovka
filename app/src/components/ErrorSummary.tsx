import { ApiError } from "../services/apiError";
import type { WriteIssue } from "../services/apiError";

/**
 * Phase 4K.3 — structured error presentation.
 *
 * Renders the backend ApiError contract consistently across pages:
 * - human-readable message (backend-authored where available)
 * - error code
 * - structured issues[] (field + code + message), any number of them
 *
 * Only safe values are ever displayed: no stack traces, no raw response
 * bodies, no SQL, no filesystem paths. Network failures (TypeError from a
 * rejected fetch) are presented as a connection problem and remain
 * distinguishable from backend ApiErrors.
 *
 * This component is presentation-only: it contains NO backend business rules.
 */

type ErrorSummaryProps = {
  error: unknown;
  /** Used when the error carries no readable message (non-Error values). */
  fallbackMessage?: string;
};

type Summary = {
  kind: string | null;
  message: string;
  code: string | null;
  issues: WriteIssue[];
};

function summarize(error: unknown, fallbackMessage?: string): Summary {
  if (error instanceof ApiError) {
    const isInternal = error.status >= 500 || error.code === "internal.error";
    const kind =
      error.status === 400
        ? "Validation failed"
        : error.status === 409
          ? error.code === "reference.invalid"
            ? "Invalid reference"
            : "Conflict"
          : isInternal
            ? "Server error"
            : null;
    const message = isInternal
      ? "The server could not complete the request. No changes were made."
      : error.message || fallbackMessage || "The request was rejected by the server.";
    return { kind, message, code: error.code, issues: error.issues };
  }

  if (error instanceof TypeError) {
    // A rejected fetch (network failure) surfaces as TypeError.
    return {
      kind: "Connection problem",
      message: "Could not reach the server. Check that the backend is running and try again.",
      code: null,
      issues: [],
    };
  }

  if (error instanceof Error) {
    return {
      kind: null,
      message: error.message || fallbackMessage || "An unexpected error occurred.",
      code: null,
      issues: [],
    };
  }

  if (typeof error === "string") {
    return { kind: null, message: error, code: null, issues: [] };
  }

  return {
    kind: null,
    message: fallbackMessage || "An unexpected error occurred.",
    code: null,
    issues: [],
  };
}

export function ErrorSummary({ error, fallbackMessage }: ErrorSummaryProps) {
  if (error === null || error === undefined) return null;

  const summary = summarize(error, fallbackMessage);

  return (
    <div className="error-summary" role="alert">
      {summary.kind ? <p className="error-summary-kind">{summary.kind}</p> : null}
      <p className="empty-state-description">{summary.message}</p>
      {summary.code ? (
        <p className="error-summary-code">
          Error code: <code>{summary.code}</code>
        </p>
      ) : null}
      {summary.issues.length > 0 ? (
        <ul className="error-summary-issues">
          {summary.issues.map((entry, index) => (
            <li key={`${entry.field}-${entry.code}-${index}`}>
              <span className="error-issue-field">{entry.field}</span>
              <code>{entry.code}</code>
              <span>{entry.message}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
