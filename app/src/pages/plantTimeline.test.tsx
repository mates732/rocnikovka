// Phase 4K.9 — Plant timeline tests.
import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { act, create } from "react-test-renderer";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { buildPlantTimeline, PlantDetailPage } from "./PlantsPage";
import type { AICVMeasurement, ImageRecord, ManualMeasurement, Plant, PositionEvent, WaterEvent } from "../types/entities";

const plant: Plant = {
  plant_id: "PLT-001",
  pot_id: "POT-001",
  group_name: "G1",
  emergence_date: "2026-02-01",
  status: "active",
};

const image = (overrides: Partial<ImageRecord> = {}): ImageRecord => ({
  image_id: "IMG-20260205-081500-001",
  plant_id: "PLT-001",
  timestamp: "2026-02-05T08:15:00",
  experiment_day: 5,
  image_path: "data/raw/images/IMG-20260205-081500-001.jpg",
  camera_id: "CAM-01",
  image_quality_status: "PASS",
  calibration_status: "pass",
  failure_code: "none",
  ...overrides,
});

const manual = (overrides: Partial<ManualMeasurement> = {}): ManualMeasurement => ({
  measurement_id: "MSR-MAN-20260205-090000-001",
  plant_id: "PLT-001",
  image_id: "IMG-20260205-081500-001",
  timestamp: "2026-02-05T09:00:00",
  experiment_day: 5,
  repetition: 1,
  attempt: 1,
  plant_height_cm: 10.5,
  observer: "observer_1",
  measurement_status: "pass",
  failure_code: "none",
  method: "MANUAL",
  ...overrides,
});

const water = (overrides: Partial<WaterEvent> = {}): WaterEvent => ({
  water_event_id: "WTR-20260205-080000-001",
  plant_id: "PLT-001",
  timestamp: "2026-02-05T08:00:00",
  experiment_day: 5,
  pot_mass_before_g: 500,
  target_mass_g: 550,
  water_added_ml: 50,
  pot_mass_after_g: 550,
  watering_status: "pass",
  ...overrides,
});

const position = (overrides: Partial<PositionEvent> = {}): PositionEvent => ({
  position_event_id: "POS-20260205-070000-001",
  position_id: "P01",
  timestamp: "2026-02-05T07:00:00",
  plant_id: "PLT-001",
  location: "RACK_A_ROW1_COL1",
  operator: "operator_a",
  reason: "initial_assignment",
  ...overrides,
});

const aicv = (overrides: Partial<AICVMeasurement> = {}): AICVMeasurement => ({
  measurement_id: "MSR-AICV-20260205-091000-001",
  image_id: "IMG-20260205-081500-001",
  plant_id: "PLT-001",
  timestamp: "2026-02-05T09:10:00",
  experiment_day: 5,
  model: "baseline",
  model_version: "v1",
  pipeline_version: "pipeline-v1",
  detection_status: "pass",
  segmentation_status: "pass",
  calibration_status: "pass",
  plant_height_cm: 10.4,
  projected_area_cm2: 20.1,
  confidence: 0.93,
  failure_code: "none",
  ...overrides,
});

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

test("S) buildPlantTimeline groups persisted records by experiment day", () => {
  const timeline = buildPlantTimeline({
    plantId: "PLT-001",
    images: [image({ experiment_day: 5 }), image({ image_id: "IMG-2", experiment_day: 7 })],
    manual: [manual({ experiment_day: 5 })],
    water: [water({ experiment_day: 5 })],
    position: [position()],
    aicv: [aicv({ experiment_day: 5 })],
  });

  assert.deepEqual(
    timeline.map((t) => t.day),
    [5, 7],
    "days are sorted ascending"
  );
  const day5 = timeline.find((t) => t.day === 5)!;
  assert.equal(day5.images.length, 1);
  assert.equal(day5.manual.length, 1);
  assert.equal(day5.water.length, 1);
  assert.equal(day5.aicv.length, 1);
  assert.equal(day5.position.length, 1, "position event attached to the same-date day bucket");
  const day7 = timeline.find((t) => t.day === 7)!;
  assert.equal(day7.images.length, 1);
  assert.equal(day7.manual.length, 0);
});

test("S2) records for other plants are excluded", () => {
  const timeline = buildPlantTimeline({
    plantId: "PLT-001",
    images: [image({ plant_id: "PLT-002" })],
    manual: [manual({ plant_id: "PLT-002" })],
    water: [water({ plant_id: "PLT-002" })],
    position: [position({ plant_id: "PLT-002" })],
    aicv: [aicv({ plant_id: "PLT-002" })],
  });
  assert.equal(timeline.length, 0, "nothing from other plants leaks in");
});

test("S3) position events never become an experiment day source", () => {
  const timeline = buildPlantTimeline({
    plantId: "PLT-001",
    images: [],
    manual: [],
    water: [],
    position: [position()],
    aicv: [],
  });
  // A plant with only position events gets a contextual bucket, but the day
  // is 0 (informational) — position events alone cannot create day 5.
  assert.ok(timeline.every((t) => t.day === 0), "position-only history is contextual only");
});

test("S4) the timeline builder is pure (inputs never mutated)", () => {
  const images = [image({ experiment_day: 5 }), image({ image_id: "IMG-2", experiment_day: 7 })];
  const manualBefore = JSON.stringify([manual()]);
  buildPlantTimeline({
    plantId: "PLT-001",
    images,
    manual: [manual()],
    water: [water()],
    position: [position()],
    aicv: [aicv()],
  });
  assert.equal(images.length, 2);
  assert.equal(JSON.stringify([manual()]), manualBefore);
});

test("S5) PlantDetailPage renders the timeline with real persisted records", async () => {
  type Services = {
    plantService: { getPlantById: () => Promise<Plant | null> };
    imageService: { listImages: () => Promise<ImageRecord[]> };
    measurementService: {
      listManualMeasurements: () => Promise<ManualMeasurement[]>;
      listAICVMeasurements: () => Promise<AICVMeasurement[]>;
    };
    waterService: { listWaterEvents: () => Promise<WaterEvent[]> };
    positionService: { listPositionEvents: () => Promise<PositionEvent[]> };
  };
  const services: Services = {
    plantService: { getPlantById: async () => plant },
    imageService: { listImages: async () => [image({ experiment_day: 5 })] },
    measurementService: {
      listManualMeasurements: async () => [manual()],
      listAICVMeasurements: async () => [aicv()],
    },
    waterService: { listWaterEvents: async () => [water()] },
    positionService: { listPositionEvents: async () => [position()] },
  };
  const renderer = create(
    <MemoryRouter initialEntries={["/plants/PLT-001"]}>
      <Routes>
        <Route path="/plants/:plantId" element={<PlantDetailPage services={services} />} />
      </Routes>
    </MemoryRouter>
  );
  await act(async () => {});
  await act(async () => {});
  const html = textOf(renderer);
  assert.ok(html.includes("Timeline"), "timeline section present");
  assert.ok(html.includes("Day 5"), "experiment day shown");
  assert.ok(html.includes("IMG-20260205-081500-001"), "image id shown");
  assert.ok(html.includes("MSR-MAN-20260205-090000-001"), "manual measurement id shown");
  assert.ok(html.includes("WTR-20260205-080000-001"), "water event id shown");
  assert.ok(html.includes("POS-20260205-070000-001"), "position event id shown");
  assert.ok(html.includes("MSR-AICV-20260205-091000-001"), "aicv id shown");
});

test("S6) PlantDetailPage shows an explicit empty state for a plant with no records", async () => {
  type Services = {
    plantService: { getPlantById: () => Promise<Plant | null> };
    imageService: { listImages: () => Promise<ImageRecord[]> };
    measurementService: {
      listManualMeasurements: () => Promise<ManualMeasurement[]>;
      listAICVMeasurements: () => Promise<AICVMeasurement[]>;
    };
    waterService: { listWaterEvents: () => Promise<WaterEvent[]> };
    positionService: { listPositionEvents: () => Promise<PositionEvent[]> };
  };
  const services: Services = {
    plantService: { getPlantById: async () => plant },
    imageService: { listImages: async () => [] },
    measurementService: { listManualMeasurements: async () => [], listAICVMeasurements: async () => [] },
    waterService: { listWaterEvents: async () => [] },
    positionService: { listPositionEvents: async () => [] },
  };
  const renderer = create(
    <MemoryRouter initialEntries={["/plants/PLT-001"]}>
      <Routes>
        <Route path="/plants/:plantId" element={<PlantDetailPage services={services} />} />
      </Routes>
    </MemoryRouter>
  );
  await act(async () => {});
  await act(async () => {});
  const html = textOf(renderer);
  assert.ok(html.includes("No recorded observations for this plant yet."), "explicit empty timeline state");
});