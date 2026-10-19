import test from "node:test";
import assert from "node:assert/strict";
import {
  parsePagination,
  pageMeta,
  paginatedSql,
  countSql,
  PaginationError,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from "./pagination.js";

function params(query: string): URLSearchParams {
  return new URLSearchParams(query);
}

test("pagination: defaults to limit 50 and offset 0 when no parameters are given", () => {
  assert.deepEqual(parsePagination(params("")), { limit: DEFAULT_PAGE_LIMIT, offset: 0 });
  assert.equal(DEFAULT_PAGE_LIMIT, 50);
  assert.equal(MAX_PAGE_LIMIT, 200);
});

test("pagination: accepts an explicit limit and offset", () => {
  assert.deepEqual(parsePagination(params("limit=25&offset=100")), { limit: 25, offset: 100 });
  assert.deepEqual(parsePagination(params("limit=200&offset=0")), { limit: 200, offset: 0 });
});

test("pagination: rejects a limit above the maximum instead of silently clamping", () => {
  assert.throws(() => parsePagination(params("limit=201")), PaginationError);
  assert.throws(() => parsePagination(params("limit=100000")), PaginationError);
});

test("pagination: rejects non-numeric, zero and negative values", () => {
  for (const q of ["limit=abc", "limit=0", "limit=-1", "limit=1.5", "offset=-1", "offset=abc", "offset=1.5"]) {
    assert.throws(() => parsePagination(params(q)), PaginationError, `${q} must be rejected`);
  }
});

test("pagination: an empty parameter value falls back to the default", () => {
  assert.deepEqual(parsePagination(params("limit=&offset=")), { limit: 50, offset: 0 });
});

test("pageMeta: reports has_more and the exact returned count", () => {
  assert.deepEqual(pageMeta(100, { limit: 50, offset: 0 }), {
    total: 100,
    limit: 50,
    offset: 0,
    has_more: true,
    returned: 50,
  });

  const last = pageMeta(100, { limit: 50, offset: 50 });
  assert.equal(last.has_more, false, "the final page has no more");
  assert.equal(last.returned, 50);

  const partial = pageMeta(7, { limit: 3, offset: 6 });
  assert.equal(partial.has_more, false);
  assert.equal(partial.returned, 1);

  const beyond = pageMeta(3, { limit: 10, offset: 50 });
  assert.equal(beyond.returned, 0, "an offset past the end returns 0 rows");
  assert.equal(beyond.has_more, false);
});

test("pageMeta: never returns a negative returned count", () => {
  assert.equal(pageMeta(0, { limit: 50, offset: 0 }).returned, 0);
});

test("paginatedSql: appends LIMIT/OFFSET as integers, never interpolated strings", () => {
  const base = "SELECT * FROM plants ORDER BY plant_id";
  assert.equal(
    paginatedSql(base, { limit: 50, offset: 0 }),
    "SELECT * FROM plants ORDER BY plant_id LIMIT 50 OFFSET 0"
  );
});

test("countSql: wraps the base query so the count matches the page", () => {
  assert.equal(countSql("SELECT * FROM plants"), "SELECT COUNT(*) AS n FROM (SELECT * FROM plants)");
});
