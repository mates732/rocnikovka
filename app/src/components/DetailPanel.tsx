import { ReactNode } from "react";
import { BadgeStatus, StatusBadge } from "./StatusBadge";

type MetadataItem = {
  label: string;
  value: string;
};

type DetailPanelProps = {
  title: string;
  status: BadgeStatus;
  metadata: MetadataItem[];
  actions?: ReactNode;
  /** Small overline shown above the record title (e.g. record kind). */
  kicker?: string;
};

export function DetailPanel({ title, status, metadata, actions, kicker }: DetailPanelProps) {
  return (
    <section className="panel detail-panel" aria-labelledby="detail-title">
      <header className="detail-header">
        <div>
          {kicker ? <p className="overline">{kicker}</p> : null}
          <h2 id="detail-title" className="detail-title">
            {title}
          </h2>
        </div>
        <StatusBadge status={status} />
      </header>
      <dl className="metadata-grid">
        {metadata.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
      {actions ? <footer className="detail-actions">{actions}</footer> : null}
    </section>
  );
}
