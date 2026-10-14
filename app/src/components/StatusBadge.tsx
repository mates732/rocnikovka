export type BadgeStatus =
  | "PASS"
  | "WARN"
  | "FAIL"
  | "NOT_RUN"
  | "READY"
  | "NOT_READY"
  | "LOCKED";

type StatusBadgeProps = {
  status: BadgeStatus;
};

const symbols: Record<BadgeStatus, string> = {
  PASS: "OK",
  WARN: "!",
  FAIL: "X",
  NOT_RUN: "-",
  READY: "R",
  NOT_READY: "N",
  LOCKED: "L",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const label = status.replace("_", " ");
  return (
    <span className={`status-badge status-${status.toLowerCase()}`} aria-label={`Status ${label}`}>
      <span aria-hidden="true" className="status-symbol">
        {symbols[status]}
      </span>
      <span>{label}</span>
    </span>
  );
}
