/**
 * Maps a raw D1 error onto the same repository error vocabulary the Node
 * backend uses, so the API can return identical status codes and codes.
 *
 * D1 reports constraint failures in the thrown error message; D1 has no
 * `error.code` equivalent, so the message is matched deliberately rather than
 * swallowed. Anything unrecognised must propagate as an error — never a
 * successful response.
 */
export class RepositoryError extends Error {
  constructor(
    message: string,
    readonly code:
      | "validation.failed"
      | "id.duplicate"
      | "reference.missing_parent"
      | "repository.error"
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}

export function mapD1Error(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);

  if (/UNIQUE constraint failed/i.test(message)) {
    throw new RepositoryError(message, "id.duplicate");
  }
  if (/FOREIGN KEY constraint failed/i.test(message)) {
    throw new RepositoryError(message, "reference.missing_parent");
  }
  // CHECK constraint failures are domain validation problems; the input was
  // already validated in TypeScript, so an unexpected CHECK failure means the
  // write must fail loudly rather than be coerced into a success.
  if (/CHECK constraint failed/i.test(message)) {
    throw new RepositoryError(message, "validation.failed");
  }
  throw new RepositoryError(message, "repository.error");
}
