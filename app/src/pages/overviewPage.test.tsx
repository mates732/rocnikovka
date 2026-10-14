// Phase 4K.10 — Overview page regression tests.
//
// Guards the fix for the reported "Route not found / route.not_found" landing
// bug: the page must load cleanly with an empty database, and a failing record
// source must surface its error explicitly WITHOUT blanking the rest of the
// page (it must never degrade into a single route.not_found panel).
import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { act, create } from "react-test-renderer";
import { MemoryRouter } from "react-router-dom";
import { OverviewPage } from "./OverviewPage";
import type { Plant } from "../types/entities";

const plant: Plant = {
  plant_id: "PLT-001",
  pot_id: "POT-001",
  group_name: "G1",
  emergence_date: "2026-02-01",
  status: "active",
};

type Services = {
  plantService: { listPlants: () => Promise<Plant[]> };
  imageService: { listImages: () => Promise<never[] | unknown[]> };
  measurementService: {
    listManualMeasurements: () => Promise<unknown[]>;
    listAICVMeasurements: () => Promise<unknown[]>;
  };
  waterService: { listWaterEvents: () => Promise<unknown[]> };
  positionService: { listPositionEvents: () => Promise<unknown[]> };
};

function emptyServices(): Services {
  return {
    plantService: { listPlants: async () => [] },
    imageService: { listImages: async () => [] },
    measurementService: { listManualMeasurements: async () => [], listAICVMeasurements: async () => [] },
    waterService: { listWaterEvents: async () => [] },
    positionService: { listPositionEvents: async () => [] },
  };
}

type Renderer = ReturnType<typeof create>;

function textOf(renderer: Renderer): string {
  let out = "";
  const walk = (node: unknown) => {
    if (node === null || node === undefined) return;
    if (typeof node === "string" || typeof node === "number") {
      out += node;
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const anyNode = node as { children?: unknown };
    if (anyNode.children !== undefined) walk(anyNode.children);
  };
  walk(renderer.toJSON());
  return out;
}

function renderOverview(services: Services): Renderer {
  return create(
    <MemoryRouter>
      <OverviewPage services={services} />
    </MemoryRouter>
  );
}

test("A) an empty database renders the landing page cleanly — no route error", async () => {
  const renderer = renderOverview(emptyServices());
  await act(async () => {});
  await act(async () => {});
  const html = textOf(renderer);

  // The page itself loads with the scientific hero.
  assert.ok(html.includes("Measure what grows."), "hero heading renders");
  assert.ok(html.includes("Persisted records"), "record summary renders");

  // Honest empty states (never fake numbers).
  assert.ok(html.includes("No plants registered yet."), "empty register state");
  assert.ok(html.includes("No persisted raw image is available yet."), "evidence panel empty state");
  assert.ok(html.includes("No manual measurements recorded yet."), "manual journal empty state");

  // The reported regression must not appear in any form.
  assert.ok(!html.includes("Route not found"), "no route-not-found panel");
  assert.ok(!html.includes("route.not_found"), "no route.not_found code");
  assert.ok(!html.includes("Some record sources could not be read"), "no phantom source failure");
});

test("B) a failing record source is shown explicitly without blanking the page", async () => {
  const services = emptyServices();
  services.plantService = { listPlants: async () => [plant] };
  services.measurementService = {
    listManualMeasurements: async () => {
      throw new Error("boom");
    },
    listAICVMeasurements: async () => [],
  };
  const renderer = renderOverview(services);
  await act(async () => {});
  await act(async () => {});
  const html = textOf(renderer);

  // The error is surfaced and never hidden…
  assert.ok(html.includes("Some record sources could not be read"), "source alert is visible");
  assert.ok(html.includes("Manual measurements"), "affected source is named");

  // …but the rest of the page still renders from the sources that worked.
  assert.ok(html.includes("Measure what grows."), "hero still renders");
  assert.ok(html.includes("Registered plants"), "surviving sources still shown");
  assert.ok(html.includes("No persisted raw image is available yet."), "image evidence still renders");
  assert.ok(!html.includes("No plants registered yet."), "plant list actually loaded, not guessed");
});

test("C) the overview never performs direct fetch calls", () => {
  // Structural guarantee: services are injected by prop (default = adapters)
  // and every data read goes through them. The default export must not have
  // been swapped for raw fetch usage inside the page module.
  const source = OverviewPage.toString();
  assert.ok(!source.includes("fetch("), "no direct fetch inside the page");
});
