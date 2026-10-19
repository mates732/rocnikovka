/**
 * Pagination for list endpoints.
 *
 * Motivation: D1 on the Workers Free plan enforces a daily row-read limit
 * (5,000,000 rows/day as of the current Cloudflare limits). Every `list()`
 * endpoint is a `SELECT * FROM …` full scan, so an unbounded response spends
 * that budget quickly. A capped page keeps one request bounded, and `LIMIT/OFFSET`
 * lets D1 stop reading early.
 *
 * Backward compatibility: the response is still `{ data: [...] }`; `meta` is
 * ADDED alongside it, so existing frontend code that reads `data` is unaffected.
 */

export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 200;

export class PaginationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "PaginationError";
  }
}

export type Pagination = {
  limit: number;
  offset: number;
};

/**
 * Parses `limit` / `offset` query parameters.
 * Throws a 400 PaginationError for anything outside the accepted range, rather
 * than silently clamping — a caller must not get a wrong page without knowing.
 */
export function parsePagination(params: URLSearchParams): Pagination {
  const rawLimit = params.get("limit");
  const rawOffset = params.get("offset");

  let limit = DEFAULT_PAGE_LIMIT;
  if (rawLimit !== null && rawLimit !== "") {
    const parsed = Number(rawLimit);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new PaginationError("Query parameter 'limit' must be an integer >= 1");
    }
    if (parsed > MAX_PAGE_LIMIT) {
      throw new PaginationError(`Query parameter 'limit' must not exceed ${MAX_PAGE_LIMIT}`);
    }
    limit = parsed;
  }

  let offset = 0;
  if (rawOffset !== null && rawOffset !== "") {
    const parsed = Number(rawOffset);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new PaginationError("Query parameter 'offset' must be an integer >= 0");
    }
    offset = parsed;
  }

  return { limit, offset };
}

/** Metadata describing the page that was returned. */
export function pageMeta(
  total: number,
  pagination: Pagination
): { total: number; limit: number; offset: number; has_more: boolean; returned: number } {
  return {
    total,
    limit: pagination.limit,
    offset: pagination.offset,
    has_more: pagination.offset + pagination.limit < total,
    returned: Math.max(0, Math.min(pagination.limit, total - pagination.offset)),
  };
}

/** Assumes a query that counts the whole table, then builds the page SQL. */
export function paginatedSql(baseSql: string, pagination: Pagination): string {
  return `${baseSql} LIMIT ${Number(pagination.limit)} OFFSET ${Number(pagination.offset)}`;
}

/** The `COUNT(*)` companion for a given base query. */
export function countSql(baseSql: string): string {
  return `SELECT COUNT(*) AS n FROM (${baseSql})`;
}
