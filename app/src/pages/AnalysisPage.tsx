import { PageHeader } from "../components/PageHeader";

export function AnalysisPage() {
  return (
    <section className="page" aria-labelledby="analysis-title">
      <PageHeader
        eyebrow="System"
        title="Analysis"
        description="Growth-over-time workspace for comparing manual reference and AI/CV measurements. It becomes available once real measurements exist."
        titleId="analysis-title"
      />

      <section className="panel" aria-labelledby="analysis-filters">
        <div className="panel-heading">
          <h2 id="analysis-filters">Analysis filters</h2>
          <p>Selectors are disabled because there is nothing to analyze yet.</p>
        </div>
        <div className="filter-row">
          <label>
            Plant
            <select disabled aria-label="Select plant">
              <option>Not available</option>
            </select>
          </label>
          <label>
            Group
            <select disabled aria-label="Select group">
              <option>Not available</option>
            </select>
          </label>
          <label>
            Source
            <select disabled aria-label="Select source">
              <option>MANUAL</option>
              <option>AI_CV</option>
            </select>
          </label>
        </div>
      </section>

      <section className="panel" role="status" aria-label="Analysis empty state">
        <div className="empty-state">
          <p className="empty-state-mark" aria-hidden="true">
            —
          </p>
          <div>
            <p className="empty-state-title">Growth over time</p>
            <p className="empty-state-description">
              No measurements available for analysis. Once manual reference (and later AI/CV)
              measurements are recorded, they can be compared here per plant and experiment day.
            </p>
          </div>
        </div>
      </section>
    </section>
  );
}
