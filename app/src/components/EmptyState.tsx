import { ReactNode } from "react";

type EmptyStateProps = {
  /** Primary empty-state message (kept truthful — never replaced by fake data). */
  title: string;
  description?: string;
  /** Optional hint/action rendered under the description. */
  children?: ReactNode;
};

/**
 * Shared intentional empty/absence state. It never fabricates content: when a
 * section has no records the UI says exactly that, and optional actions guide
 * the operator toward the real next step.
 */
export function EmptyState({ title, description, children }: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      <p className="empty-state-mark" aria-hidden="true">
        —
      </p>
      <div>
        <p className="empty-state-title">{title}</p>
        {description ? <p className="empty-state-description">{description}</p> : null}
        {children ? <div className="empty-state-actions">{children}</div> : null}
      </div>
    </div>
  );
}
