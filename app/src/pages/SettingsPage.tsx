import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";

export function SettingsPage() {
  return (
    <section className="page" aria-labelledby="settings-title">
      <PageHeader
        eyebrow="System"
        title="Settings"
        description="Application configuration and integration readiness."
        titleId="settings-title"
      />

      <section className="panel">
        <div className="panel-heading">
          <h2>AI/CV configuration</h2>
          <p>The automated measurement pipeline is not part of this phase.</p>
        </div>
        <div className="settings-row">
          <p className="empty-state-description">AI model not configured.</p>
          <StatusBadge status="NOT_READY" />
        </div>
      </section>
    </section>
  );
}
