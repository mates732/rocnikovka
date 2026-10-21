import type { Plant } from "../types/entities";

/**
 * Formats a plant's scientific identifier for user-facing display.
 * Examples: "G1 · EX01", "G2 · EX05", "G3 · EX09"
 */
export function formatScientificLabel(plant: Plant): string {
  return `${plant.group_name} · ${plant.exemplar_id}`;
}

/**
 * Formats a plant's full identifier including internal ID and pot.
 * Used for detailed views where traceability is needed.
 * Example: "G1 · EX01 (PLT-001, pot POT-001)"
 */
export function formatPlantFullLabel(plant: Plant): string {
  return `${formatScientificLabel(plant)} (${plant.plant_id}, pot ${plant.pot_id})`;
}

/**
 * Formats a plant's short label for selectors and tables.
 * Uses scientific identifier as primary, with internal ID as secondary.
 * Example: "G1 · EX01 · PLT-001"
 */
export function formatPlantShortLabel(plant: Plant): string {
  return `${formatScientificLabel(plant)} · ${plant.plant_id}`;
}