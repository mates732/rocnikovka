/**
 * API error type and body parser, mirroring the frontend's ApiError contract
 * (app/src/services/apiError.ts) so the two sides stay wire-compatible.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues?: string[];

  constructor(message: string, code: string, status: number, issues?: string[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

/** Builds an ApiError from an error response body, never from raw server text. */
export async function apiErrorFromBody(response: Response): Promise<ApiError> {
  let code = "http.error";
  let message = `Request failed with status ${response.status}`;
  let issues: string[] | undefined;
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string; issues?: string[] } };
    if (body.error?.code) code = body.error.code;
    if (body.error?.message) message = body.error.message;
    if (Array.isArray(body.error?.issues)) issues = body.error.issues;
  } catch {
    // A non-JSON error body must not become a fake success.
  }
  return new ApiError(message, code, response.status, issues);
}
