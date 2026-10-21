import type { Group, ExemplarId, TreatmentPercentage } from "../types/entities";

/**
 * Confirmed Day 0 experiment plan — the single source of truth for defaults,
 * bulk registration and summaries. Sourced from the user's physical setup:
 *
 * - 27 pots, 9 per group (G1 / G2 / G3)
 * - 3 seeds per pot = 81 planned seeds
 * - 72 g of SUBSTRATE ONLY per pot = 1 944 g total (never assembled pot mass)
 * - scale resolution 1 g (sub-gram precision must never be implied)
 *
 * Treatment percentages are authoritative and stored independently:
 * - G1 = 100% (planned 75 ml per pot)
 * - G2 = 85% (planned 64 ml per pot)
 * - G3 = 70% (planned 53 ml per pot)
 *
 * The planned volumes below are PLANNED millilitre amounts per pot — they are never
 * multiplied by a percentage to derive a gravimetric target mass, and never
 * imply that watering already happened.
 *
 * PROTOCOL DISCREPANCY: Protocol v1 specifies 15 pots per group (minimum 12).
 * Current experiment uses 9 per group. This is documented as an unresolved
 * protocol amendment and must not be silently corrected.
 */
export const DAY0_PLAN = {
  pots: 27,
  groups: { G1: 9, G2: 9, G3: 9 } as const,
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
   * Treatment percentages: G1=100%, G2=85%, G3=70%.
   */
  plannedWaterMlPerPot: { G1: 75, G2: 64, G3: 53 } as const,
  /** Treatment percentage per group — authoritative, not derived from label. */
  treatmentPercentage: { G1: 100, G2: 85, G3: 70 } as const,
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
  if (n <= DAY0_PLAN.groups.G1) return "G1";
  if (n <= DAY0_PLAN.groups.G1 + DAY0_PLAN.groups.G2) return "G2";
  return "G3";
}

/** Assigns the exemplar ID for a 1-based pot index within its group. */
export function exemplarIdForPotNumber(n: number): ExemplarId {
  const group = groupForPotNumber(n);
  let indexInGroup: number;
  if (group === "G1") {
    indexInGroup = n;
  } else if (group === "G2") {
    indexInGroup = n - DAY0_PLAN.groups.G1;
  } else {
    indexInGroup = n - DAY0_PLAN.groups.G1 - DAY0_PLAN.groups.G2;
  }
  return `EX${String(indexInGroup).padStart(2, "0")}` as ExemplarId;
}

/** Returns the treatment percentage for a group. */
export function treatmentPercentageForGroup(group: Group): TreatmentPercentage {
  return DAY0_PLAN.treatmentPercentage[group];
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

/** Treatment percentage for a group. */
export function treatmentPercentageForGroupPlan(group: Group): TreatmentPercentage {
  return DAY0_PLAN.treatmentPercentage[group];
}

/** True when every group has a planned volume recorded. */
export function hasCompletePlannedWaterVolumes(): boolean {
  return DAY0_PLAN.groups.G1 > 0 && DAY0_PLAN.groups.G2 > 0 && DAY0_PLAN.groups.G3 > 0;
}

/** The field on Day0PhysicalConfig that holds a group's PLANNED volume. */
export function plannedWaterField(
  group: Group
): "planned_water_ml_g1" | "planned_water_ml_g2" | "planned_water_ml_g3" {
  if (group === "G1") return "planned_water_ml_g1";
  if (group === "G2") return "planned_water_ml_g2";
  return "planned_water_ml_g3";
}