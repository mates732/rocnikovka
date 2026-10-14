// Phase 4K.3 — ErrorSummary rendering tests (run with: npm test via tsx).
import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ErrorSummary } from "./ErrorSummary";
import { ApiError } from "../services/apiError";

function render(error: unknown, fallbackMessage?: string): string {
  return renderToStaticMarkup(<ErrorSummary error={error} fallbackMessage={fallbackMessage} />);
}

test("A) ApiError message is rendered", () => {
  const error = new ApiError(400, "water_event.validation_failed", "Invalid water event", []);
  const html = render(error);
  assert.ok(html.includes("Invalid water event"), "message must be visible");
});

test("B) ApiError code is rendered", () => {
  const error = new ApiError(400, "water_event.validation_failed", "Invalid water event", []);
  const html = render(error);
  assert.ok(html.includes("water_event.validation_failed"), "code must be visible");
});

test("C) a single issue is rendered with its message", () => {
  const error = new ApiError(400, "manual_measurement.validation_failed", "Invalid manual measurement", [
    { field: "plant_height_cm", code: "number.out_of_range", message: "Must be a finite number > 0" },
  ]);
  const html = render(error);
  assert.ok(html.includes("Must be a finite number"), "issue message must be visible");
  assert.ok(html.includes("&gt; 0"), "comparison characters are rendered safely escaped");
});

test("D) multiple issues are all rendered", () => {
  const error = new ApiError(400, "manual_measurement.validation_failed", "Invalid", [
    { field: "repetition", code: "enum.invalid", message: "Must be 1 or 2" },
    { field: "attempt", code: "number.out_of_range", message: "attempt must be >= 1" },
  ]);
  const html = render(error);
  assert.ok(html.includes("Must be 1 or 2"));
  assert.ok(html.includes("attempt must be"));
  assert.ok(html.includes("&gt;= 1"), "comparison characters are rendered safely escaped");
  const occurrences = html.split("error-issue-field").length - 1;
  assert.equal(occurrences, 2, "two issue rows must be present");
});

test("E) issue field is rendered", () => {
  const error = new ApiError(400, "x.validation_failed", "Invalid", [
    { field: "watering_status", code: "enum.invalid", message: "bad value" },
  ]);
  const html = render(error);
  assert.ok(html.includes("watering_status"), "issue field must be visible");
});

test("F) issue code is rendered", () => {
  const error = new ApiError(409, "id.duplicate", "Duplicate", [
    { field: "water_event_id", code: "id.conflict", message: "conflicting content" },
  ]);
  const html = render(error);
  assert.ok(html.includes("id.conflict"), "issue code must be visible");
});

test("G) issue message is rendered (validation field detail)", () => {
  const error = new ApiError(400, "aicv_measurement.validation_failed", "Invalid AICV", [
    { field: "experiment_day", code: "validation.experiment_day_mismatch", message: "does not match the image" },
  ]);
  const html = render(error);
  assert.ok(html.includes("does not match the image"));
});

test("H) empty issues renders no issue section", () => {
  const error = new ApiError(400, "water_event.validation_failed", "Invalid water event", []);
  const html = render(error);
  assert.ok(!html.includes("error-summary-issues"), "no issue list may be rendered");
});

test("I) network failure (TypeError) renders a safe connection message", () => {
  const html = render(new TypeError("fetch failed"));
  assert.ok(html.includes("Could not reach the server"), "network copy must be shown");
  assert.ok(!html.includes("fetch failed"), "raw error text must not be shown");
  assert.ok(html.includes("Connection problem"));
});

test("I2) generic unknown error is rendered safely via fallback", () => {
  const html = render(new Error("boom"), "Failed to load plants from the backend");
  assert.ok(html.includes("boom"));
  assert.ok(!html.includes("error-summary-issues"));
});

test("J) raw stack traces are never rendered", () => {
  const error = new Error("boom");
  error.stack = "Error: boom\n    at secret/file.ts:1:1 (internal-secret-stack)";
  const html = render(error);
  assert.ok(!html.includes("internal-secret-stack"), "stack must never surface");
  assert.ok(!html.includes("secret/file.ts"), "file paths must never surface");
  assert.ok(html.includes("boom"));
});

test("K) 404 / not-found behavior stays unchanged: null errors render nothing", () => {
  assert.equal(render(null), "");
  assert.equal(render(undefined), "");
  // A not-found response on detail reads is mapped to null in the adapters,
  // so the not-found UI path never passes an ApiError to ErrorSummary.
});
