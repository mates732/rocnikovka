// Phase 4K.2 — ApiError parsing tests (run with: npm test)
// Node.js native test runner + native TypeScript type stripping (Node >= 23.6).
import test from "node:test";
import assert from "node:assert/strict";
import { ApiError, apiErrorFromResponse } from "./apiError.ts";

function jsonResponse(body: unknown, status = 400): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("A) ApiError preserves status/code/message/issues", async () => {
  const response = jsonResponse({
    error: {
      code: "water_event.validation_failed",
      message: "Invalid water event",
      issues: [
        { field: "watering_status", code: "enum.invalid", message: "Value 'good' is not allowed" },
      ],
    },
  });

  const err = await apiErrorFromResponse(response);
  assert.ok(err instanceof ApiError);
  assert.equal(err.status, 400);
  assert.equal(err.code, "water_event.validation_failed");
  assert.equal(err.message, "Invalid water event");
  assert.equal(err.issues.length, 1);
  assert.deepEqual(err.issues[0], {
    field: "watering_status",
    code: "enum.invalid",
    message: "Value 'good' is not allowed",
  });
});

test("B) malformed issues do not crash parsing and are dropped", async () => {
  const response = jsonResponse({
    error: {
      code: "x",
      message: "m",
      issues: [
        null,
        {},
        { field: 1, code: 2 },
        { field: "a", code: "b" }, // missing message
        { field: "ok", code: "c", message: "d" },
        "string issue",
      ],
    },
  });
  const err = await apiErrorFromResponse(response);
  assert.equal(err.issues.length, 1, "only well-formed issues survive");
  assert.deepEqual(err.issues[0], { field: "ok", code: "c", message: "d" });
  assert.equal(err.code, "x");
  assert.equal(err.message, "m");

  // issues present but not an array -> tolerated as empty
  const nonArray = jsonResponse({ error: { code: "x", message: "m", issues: "oops" } });
  const err2 = await apiErrorFromResponse(nonArray);
  assert.deepEqual(err2.issues, []);
  assert.equal(err2.status, 400);

  // error object missing code/message entirely -> sanitized fallbacks
  const bare = jsonResponse({ error: {} }, 409);
  const err3 = await apiErrorFromResponse(bare);
  assert.equal(err3.code, "http.error");
  assert.ok(err3.message.length > 0);
});

test("C) non-JSON HTTP error becomes a sanitized ApiError", async () => {
  const response = new Response(
    "<html><body>Server Error<br/>TypeError: Cannot read properties at /api/water-events</body></html>",
    { status: 500 }
  );
  const err = await apiErrorFromResponse(response);
  assert.ok(err instanceof ApiError);
  assert.equal(err.status, 500);
  assert.equal(err.code, "http.error");
  assert.ok(!err.message.includes("<html>"), "raw server text must never surface");
  assert.ok(!err.message.includes("TypeError"), "raw server text must never surface");
  assert.deepEqual(err.issues, []);
});

test("D) empty non-OK body becomes a sanitized ApiError", async () => {
  const response = new Response(null, { status: 503 });
  const err = await apiErrorFromResponse(response);
  assert.ok(err instanceof ApiError);
  assert.equal(err.status, 503);
  assert.equal(err.code, "http.error");
  assert.deepEqual(err.issues, []);
});
