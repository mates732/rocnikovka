import { isDayRollbackWarning, dayRollbackWarningMessage } from "../hooks/useDayContext";
import type { DayContextState } from "../hooks/useDayContext";

type Props = {
  /** Hook state for the currently selected plant. */
  dayContext: DayContextState;
  /** The operator-entered experiment day as a string (unmodified). */
  enteredDay: string;
};

/**
 * Non-blocking human-error guard shown inside data-entry forms.
 *
 * It only warns when the entered experiment day is EARLIER than the plant's
 * last recorded day. It never modifies the entered value, never blocks
 * submission, and never derives experiment_day from the timestamp — the
 * backend remains the authoritative validation layer.
 *
 * Renders nothing for unknown plants, absent records, loading/error states,
 * or days that are not a rollback.
 */
export function ExperimentDayContext({ dayContext, enteredDay }: Props) {
  if (dayContext.status !== "loaded" || !dayContext.context) return null;
  const context = dayContext.context;
  if (!isDayRollbackWarning(context, enteredDay)) return null;

  return (
    <p className="day-context-warning" role="note">
      {dayRollbackWarningMessage(context, enteredDay)}
    </p>
  );
}