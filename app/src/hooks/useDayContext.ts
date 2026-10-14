import { useEffect, useState } from "react";
import type { PlantDayContext } from "../types/entities";

export type DayContextState =
  | { status: "idle"; context: null }
  | { status: "loading"; context: null }
  | { status: "loaded"; context: PlantDayContext | null }
  | { status: "error"; context: null };

/**
 * Loads the read-only day context for a selected plant (max recorded
 * experiment_day across images/manual/water/AICV records). Purely a
 * human-error guard for data entry:
 *
 * - it never modifies the entered values
 * - it never rejects a submission (the backend remains authoritative)
 * - it never derives experiment_day from anything
 * - position events are intentionally excluded (they have no experiment_day)
 *
 * The hook is deliberately plant-scoped: changing the plant reloads the
 * context, and an empty plant id keeps the state idle.
 */
export function useDayContext(
  getDayContext: (plantId: string) => Promise<PlantDayContext | null>,
  plantId: string
): DayContextState {
  const [state, setState] = useState<DayContextState>({ status: "idle", context: null });

  useEffect(() => {
    if (!plantId) {
      setState({ status: "idle", context: null });
      return;
    }

    let cancelled = false;
    setState({ status: "loading", context: null });

    getDayContext(plantId)
      .then((context) => {
        if (!cancelled) {
          setState({ status: "loaded", context });
        }
      })
      .catch(() => {
        // A failed context load must never block data entry; the backend
        // remains the authority. The form simply proceeds without the hint.
        if (!cancelled) {
          setState({ status: "error", context: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [getDayContext, plantId]);

  return state;
}

/** True when the entered day is earlier than the plant's last recorded day. */
export function isDayRollbackWarning(
  context: PlantDayContext | null,
  enteredDay: string
): boolean {
  if (!context || context.last_recorded_day === null) return false;
  const day = Number(enteredDay);
  if (!Number.isInteger(day) || day < 1) return false;
  return day < context.last_recorded_day;
}

/** Human-readable non-blocking warning for entering a day earlier than the last recorded day. */
export function dayRollbackWarningMessage(context: PlantDayContext, enteredDay: string): string {
  return `Day ${enteredDay} is earlier than this plant's last recorded day (${context.last_recorded_day}). Check the experiment day.`;
}