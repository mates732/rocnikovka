import type { Group } from "../types/entities";

/**
 * Confirmed Day 0 experiment plan — the single source of truth for defaults,
 * bulk registration and summaries. Sourced from the user's physical setup:
 *
 * - 27 pots, 9 per group (G0 / G1 / G2)
 * - 3 seeds per pot = 81 planned seeds
 * - 72 g of SUBSTRATE ONLY per pot = 1 944 g total (never assembled pot mass)
 * - scale resolution 1 g (sub-gram precision must never be implied)
 *
 * The G0/G1/G2 labels carry a relative gravimetric treatment. The planned
 * volumes below are PLANNED millilitre amounts per pot — they are never
 * multiplied by a percentage to derive a gravimetric target mass, and never
 * imply that watering already happened.
 */
export const DAY0_PLAN = {
  pots: 27,
  groups: { G0: 9, G1: 9, G2: 9 } as const,
  /** Planned seeds per pot. A pot with 3 seeds is still ONE experimental unit. */
  seedsPerPot: 3,
  /** 27 pots x 3 seeds. */
  plannedSeeds: 81,
  /** Substrate only, per pot — never the assembled pot mass. */
  substratePerPotG: 72,
  /** 27 pots x 72 g. */
  totalSubstrateG: 1944,
  /** Scale resolution: sub-gram precision must not be implied. */
  scaleResolutionG: 1,
  /**
   * PLANNED watering volume per pot per group (ml). Plan only — the app never
   * records these as actual watering events and never derives a gravimetric
   * target mass from them.
   */
  plannedWaterMlPerPot: { G0: 75, G1: 64, G2: 53 } as const,
} as const;

/** Zero-pads a pot number into the POT-XXX convention. */
export function potIdFor(n: number): string {
  return `POT-${String(n).padStart(3, "0")}`;
}

/** The POT-XXX ids the 27-pot plan occupies, in ascending order. */
export function plannedPotIds(): string[] {
  return Array.from({ length: DAY0_PLAN.pots }, (_, i) => potIdFor(i + 1));
}

/** Assigns the protocol group for a 1-based pot index in the plan (1..27). */
export function groupForPotNumber(n: number): Group {
  if (n <= DAY0_PLAN.groups.G0) return "G0";
  if (n <= DAY0_PLAN.groups.G0 + DAY0_PLAN.groups.G1) return "G1";
  return "G2";
}

/**
 * Returns the planned pot ids that already belong to an existing plant record.
 * These are conflicts the user must resolve manually — a bulk registration must
 * never silently re-assign or overwrite an existing plant's pot.
 */
export function detectPotConflicts(
  potIds: readonly string[],
  existingPots: readonly string[]
): string[] {
  const used = new Set(existingPots);
  return potIds.filter((id) => used.has(id));
}

/** 27 x 72 g, used by summaries to show the plan beside the recorded total. */
export function plannedTotalSubstrateG(): number {
  return DAY0_PLAN.pots * DAY0_PLAN.substratePerPotG;
}

/** 27 x 3, used by summaries to show the planned seed total. */
export function plannedTotalSeeds(): number {
  return DAY0_PLAN.pots * DAY0_PLAN.seedsPerPot;
}

/** PLANNED volume per pot for a group, or undefined when unplanned. */
export function plannedWaterMlForGroup(group: Group): number | undefined {
  return DAY0_PLAN.plannedWaterMlPerPot[group];
}

/** True when every group has a planned volume recorded. */
export function hasCompletePlannedWaterVolumes(): boolean {
  return DAY0_PLAN.groups.G0 > 0 && DAY0_PLAN.groups.G1 > 0 && DAY0_PLAN.groups.G2 > 0;
}

/** The field on Day0PhysicalConfig that holds a group's PLANNED volume. */
export function plannedWaterField(
  group: Group
): "planned_water_ml_g0" | "planned_water_ml_g1" | "planned_water_ml_g2" {
  if (group === "G0") return "planned_water_ml_g0";
  if (group === "G1") return "planned_water_ml_g1";
  return "planned_water_ml_g2";
}
