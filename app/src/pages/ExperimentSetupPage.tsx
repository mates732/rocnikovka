import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { ErrorSummary } from "../components/ErrorSummary";
import { services } from "../data/adapters";
import type { PlantService } from "../services/interfaces";
import type { Plant, Group } from "../types/entities";

const PROTOCOL_GROUPS: Group[] = ["G1", "G2", "G3"];
const PLANNED_PER_GROUP = 15;
const MINIMUM_PER_GROUP = 12;
const PRACTICAL_PER_GROUP = 9;
const PLANNED_DURATION_DAYS = 28;
const MINIMUM_DURATION_DAYS = 21;

type GroupStatus = {
  group: Group;
  registered: number;
  planned: number;
  minimum: number;
  practical: number;
  status: "complete" | "practical" | "below_minimum" | "empty";
};

type SetupDeps = {
  plantService: Pick<PlantService, "listPlants">;
};

type SetupProps = { services?: SetupDeps };

export default function ExperimentSetupPage({ services: deps = services }: SetupProps = {}) {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    deps.plantService
      .listPlants()
      .then((data) => {
        if (!cancelled) setPlants(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [deps]);

  const groupStatus = useMemo<GroupStatus[]>(() => {
    return PROTOCOL_GROUPS.map((group) => {
      const registered = plants.filter((p) => p.group_name === group).length;
      let status: GroupStatus["status"] = "empty";
      if (registered >= PLANNED_PER_GROUP) status = "complete";
      else if (registered >= PRACTICAL_PER_GROUP) status = "practical";
      else if (registered >= MINIMUM_PER_GROUP) status = "below_minimum";
      return { group, registered, planned: PLANNED_PER_GROUP, minimum: MINIMUM_PER_GROUP, practical: PRACTICAL_PER_GROUP, status };
    });
  }, [plants]);

  const totalRegistered = plants.length;
  const totalPlanned = PLANNED_PER_GROUP * PROTOCOL_GROUPS.length;
  const totalPractical = PRACTICAL_PER_GROUP * PROTOCOL_GROUPS.length;
  const sampleSizeDecision = totalRegistered === 0 ? "not_started" : totalRegistered >= totalPlanned ? "protocol" : totalRegistered >= totalPractical ? "practical" : "below_minimum";

  const readinessChecks = [
    {
      id: "camera",
      label: "Camera & image acquisition",
      description: "Side-view camera positioned, consistent distance/angle/lighting verified",
      status: "NOT_READY" as const,
    },
    {
      id: "calibration",
      label: "Calibration reference",
      description: "ArUco + metric scale cards printed, laminated, positioned in scene",
      status: "NOT_READY" as const,
    },
    {
      id: "scale",
      label: "Weighing scale",
      description: "0.1 g resolution scale available, tared, accessible at watering station",
      status: "NOT_READY" as const,
    },
    {
      id: "substrate",
      label: "Substrate & pots prepared",
      description: "Uniform pots, substrate batch, initial pot masses recorded",
      status: "NOT_READY" as const,
    },
    {
      id: "randomization",
      label: "Randomization protocol",
      description: "Plant-to-group assignment method documented, witness identified",
      status: "NOT_READY" as const,
    },
    {
      id: "data_backup",
      label: "Data backup strategy",
      description: "SQLite backup procedure defined, image storage redundancy planned",
      status: "NOT_READY" as const,
    },
  ];

  const unresolvedDecisions = [
    {
      title: "Final sample size",
      detail: `Protocol v1 specifies ${PLANNED_PER_GROUP} plants/group (${totalPlanned} total). Practical pilot uses ${PRACTICAL_PER_GROUP}/group (${totalPractical} total). Current registration: ${totalRegistered}. Decision required before full experiment.`,
      reference: "Protocol v1 §3, randomization_protocol.md",
    },
    {
      title: "Calibration card specification",
      detail: "Exact metric scale length on ArUco card, final card position in frame, lamination material. Set during pilot.",
      reference: "calibration_reference.md §95–99 (PILOT DECISION)",
    },
    {
      title: "Rotation frequency",
      detail: "Weekly vs bi-weekly position rotation within groups. Determines micro-gradient mitigation.",
      reference: "randomization_protocol.md §96–98 (PILOT DECISION)",
    },
    {
      title: "Image quality thresholds",
      detail: "Numeric sharpness (Laplacian variance), exposure, occlusion thresholds for automated PASS/WARN/FAIL.",
      reference: "image_quality_protocol.md §56–57, §69–70, §117–118 (PILOT DECISION)",
    },
  ];

  if (loading) {
    return (
      <section className="page" aria-labelledby="setup-title">
        <PageHeader eyebrow="Experiment" title="Experiment Setup" titleId="setup-title" />
        <div className="panel"><EmptyState title="Loading" description="Fetching plant records..." /></div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="page" aria-labelledby="setup-title">
        <PageHeader eyebrow="Experiment" title="Experiment Setup" titleId="setup-title" />
        <div className="panel">
          <p className="empty-state-title">Unable to load setup data</p>
          <ErrorSummary error={error} fallbackMessage="Failed to load plant records" />
        </div>
      </section>
    );
  }

  return (
    <section className="page" aria-labelledby="setup-title">
      <PageHeader
        eyebrow="Experiment"
        title="Experiment Setup"
        description="Review the experiment configuration before recording real data. Unresolved decisions are flagged explicitly."
        titleId="setup-title"
      />

      <section className="panel" aria-labelledby="meta-heading">
        <div className="panel-heading">
          <h2 id="meta-heading">Experiment metadata</h2>
        </div>
        <dl className="metadata-grid">
          <div><dt>Experiment name</dt><dd>Phytometer — Phaseolus vulgaris growth measurement</dd></div>
          <div><dt>Research question</dt><dd>Can computer vision and AI reliably automate plant growth measurements?</dd></div>
          <div><dt>Species</dt><dd>Phaseolus vulgaris (common bean)</dd></div>
          <div><dt>Cultivar</dt><dd>Aidagold (to be confirmed at sowing)</dd></div>
          <div><dt>Experimental groups</dt><dd>G1 (100%), G2 (85%), G3 (70%) — relative gravimetric targets</dd></div>
          <div><dt>Watering protocol</dt><dd>Daily gravimetric weighing, top-up to group target, weekly drift correction vs G0</dd></div>
          <div><dt>Primary endpoint</dt><dd>Plant height (cm) — vertical distance from soil reference to apex</dd></div>
          <div><dt>Secondary endpoint</dt><dd>Projected shoot area (cm²)</dd></div>
          <div><dt>Planned duration</dt><dd>{PLANNED_DURATION_DAYS} days (minimum {MINIMUM_DURATION_DAYS} days)</dd></div>
          <div><dt>Daily imaging</dt><dd>One standardized side-view photograph per plant per experiment day</dd></div>
          <div><dt>Manual reference</dt><dd>3× per week, 2 repetitions per plant per session, independent of AI output</dd></div>
        </dl>
      </section>

      <section className="panel" aria-labelledby="sample-heading">
        <div className="panel-heading">
          <h2 id="sample-heading">Sample size configuration</h2>
          <p>Protocol v1: {PLANNED_PER_GROUP}/group. Practical pilot: {PRACTICAL_PER_GROUP}/group. Current registration reflects neither — decision pending.</p>
        </div>
        <div className="sample-size-grid">
          {groupStatus.map((g) => (
            <div key={g.group} className={`sample-group-card sample-group-${g.status}`}>
              <div className="sample-group-header">
                <span className="sample-group-label">Group {g.group}</span>
                <StatusBadge status={g.status === "complete" ? "PASS" : g.status === "practical" ? "WARN" : g.status === "below_minimum" ? "FAIL" : "NOT_RUN"} />
              </div>
              <div className="sample-group-counts">
                <span className="sample-group-registered">{g.registered}</span>
                <span className="sample-group-separator">/</span>
                <span className="sample-group-planned">{g.planned} (protocol)</span>
              </div>
              <div className="sample-group-notes">
                {g.status === "complete" && "Meets protocol target"}
                {g.status === "practical" && `Meets practical pilot target (${PRACTICAL_PER_GROUP}/group)`}
                {g.status === "below_minimum" && `Below minimum (${MINIMUM_PER_GROUP}/group)`}
                {g.status === "empty" && "No plants registered"}
              </div>
            </div>
          ))}
        </div>
        <div className="sample-size-summary">
          <strong>Total registered: {totalRegistered}</strong> — Protocol: {totalPlanned} | Practical: {totalPractical} | Minimum: {MINIMUM_PER_GROUP * PROTOCOL_GROUPS.length}
          {sampleSizeDecision !== "not_started" && (
            <StatusBadge status={sampleSizeDecision === "protocol" ? "PASS" : sampleSizeDecision === "practical" ? "WARN" : "FAIL"} />
          )}
        </div>
        {totalRegistered > 0 && totalRegistered < totalPlanned && (
          <p className="form-hint" style={{ marginTop: "0.5rem" }}>
            Sample size ({totalRegistered}) does not match protocol ({totalPlanned}) or practical ({totalPractical}) target.
            This must be explicitly approved and documented in the protocol change log before full experiment.
          </p>
        )}
      </section>

      <section className="panel" aria-labelledby="readiness-heading">
        <div className="panel-heading">
          <h2 id="readiness-heading">Physical setup readiness</h2>
          <p>Mark each item as ready when verified. These are not persisted — they are a pre-flight checklist.</p>
        </div>
        <ul className="readiness-list">
          {readinessChecks.map((check) => (
            <li key={check.id} className="readiness-item">
              <div className="readiness-info">
                <strong>{check.label}</strong>
                <span className="readiness-desc">{check.description}</span>
              </div>
              <StatusBadge status={check.status} />
            </li>
          ))}
        </ul>
      </section>

      <section className="panel" aria-labelledby="unresolved-heading">
        <div className="panel-heading">
          <h2 id="unresolved-heading">Unresolved methodology decisions</h2>
          <p>These items are documented as <code>PILOT DECISION</code> in the protocol. They must be resolved before the main experiment.</p>
        </div>
        <ul className="unresolved-list">
          {unresolvedDecisions.map((item, i) => (
            <li key={i} className="unresolved-item">
              <div className="unresolved-title">{item.title}</div>
              <div className="unresolved-detail">{item.detail}</div>
              <div className="unresolved-ref"><code>{item.reference}</code></div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel" aria-labelledby="actions-heading">
        <div className="panel-heading">
          <h2 id="actions-heading">Next actions</h2>
        </div>
        <div className="action-links">
          <Link className="btn btn-primary" to="/plants">Register plants</Link>
          <Link className="btn btn-ghost" to="/experiment/daily-log">Open daily lab log</Link>
          <Link className="btn btn-ghost" to="/experiment/verification">Open verification board</Link>
          <Link className="btn btn-ghost" to="/experiment/protocol">View locked protocol</Link>
        </div>
      </section>
    </section>
  );
}