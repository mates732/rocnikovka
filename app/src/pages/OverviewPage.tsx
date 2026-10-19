import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorSummary } from "../components/ErrorSummary";
import { EvidenceThumb } from "../components/EvidenceThumb";
import { services } from "../data/adapters";
import { describeApiOrigin, hasExternalApiBase } from "../data/apiBase";
import { imageFileUrl } from "./ImagesPage";
import type { ImageService, MeasurementService, PlantService, PositionService, WaterService } from "../services/interfaces";
import type { AICVMeasurement, ImageRecord, ManualMeasurement, Plant, PositionEvent, WaterEvent } from "../types/entities";

type OverviewPageDeps = {
  plantService: Pick<PlantService, "listPlants">;
  imageService: Pick<ImageService, "listImages">;
  measurementService: Pick<MeasurementService, "listManualMeasurements" | "listAICVMeasurements">;
  waterService: Pick<WaterService, "listWaterEvents">;
  positionService: Pick<PositionService, "listPositionEvents">;
};

type OverviewPageProps = { services?: OverviewPageDeps };

type RecordBundle = {
  plants: Plant[];
  images: ImageRecord[];
  manual: ManualMeasurement[];
  aicv: AICVMeasurement[];
  water: WaterEvent[];
  positions: PositionEvent[];
};

type SourceKey = "plants" | "images" | "manual" | "aicv" | "water" | "positions";

type SourceFailure = {
  key: SourceKey;
  error: unknown;
};

const SOURCE_LABELS: Record<SourceKey, string> = {
  plants: "Plant records",
  images: "Image records",
  manual: "Manual measurements",
  aicv: "AI/CV measurements",
  water: "Water events",
  positions: "Position events",
};

const emptyBundle: RecordBundle = {
  plants: [],
  images: [],
  manual: [],
  aicv: [],
  water: [],
  positions: [],
};

/** Daily operator workflow — mirrors the real record journey of the protocol. */
const flowSteps = [
  {
    n: "01",
    title: "Plant",
    copy: "Register a specimen identity, group and pot before any record exists.",
    to: "/plants",
    label: "Specimen register",
  },
  {
    n: "02",
    title: "Image",
    copy: "Capture standardized photographic evidence per specimen and experiment day.",
    to: "/images",
    label: "Evidence register",
  },
  {
    n: "03",
    title: "Manual reference",
    copy: "Record two independent manual repetitions as the day reference.",
    to: "/measurements",
    label: "Manual records",
  },
  {
    n: "04",
    title: "Water / position",
    copy: "Log irrigation and relocation context tied to specimen history.",
    to: "/experiment/water",
    label: "Water events",
  },
  {
    n: "05",
    title: "AI / CV",
    copy: "Compare automated extraction records against manually curated reference.",
    to: "/analysis",
    label: "Analysis",
  },
  {
    n: "06",
    title: "Verification",
    copy: "Inspect daily completeness, repetitions and exceptions before review closure.",
    to: "/experiment/verification",
    label: "Inspection board",
  },
];

const protocolFacts = [
  { label: "Species", value: "Phaseolus vulgaris" },
  { label: "Groups", value: "G1 100 · G2 85 · G3 70 (rel. gravimetric target)" },
  { label: "Planned length", value: "up to 28 days" },
  { label: "Manual reference", value: "3× per week · 2 repetitions" },
  { label: "Primary parameter", value: "plant height (cm)" },
  { label: "Experiment day", value: "always operator-entered" },
];

export function OverviewPage({ services: deps = services }: OverviewPageProps = {}) {
  const [records, setRecords] = useState<RecordBundle>(emptyBundle);
  const [failures, setFailures] = useState<SourceFailure[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Per-source loading on purpose: one unreachable source must never blank
      // the whole experiment landing page. Failures stay visible below — each
      // is rendered explicitly, never hidden or replaced by fake data.
      const tasks: Array<{ key: SourceKey; run: () => Promise<unknown> }> = [
        { key: "plants", run: () => deps.plantService.listPlants() },
        { key: "images", run: () => deps.imageService.listImages() },
        { key: "manual", run: () => deps.measurementService.listManualMeasurements() },
        { key: "aicv", run: () => deps.measurementService.listAICVMeasurements() },
        { key: "water", run: () => deps.waterService.listWaterEvents() },
        { key: "positions", run: () => deps.positionService.listPositionEvents() },
      ];

      const settled = await Promise.allSettled(tasks.map((task) => task.run()));

      const bundle: RecordBundle = { ...emptyBundle };
      const failed: SourceFailure[] = [];

      settled.forEach((outcome, index) => {
        const key = tasks[index].key;
        if (outcome.status === "fulfilled") {
          const value = outcome.value;
          if (key === "plants") bundle.plants = value as Plant[];
          else if (key === "images") bundle.images = value as ImageRecord[];
          else if (key === "manual") bundle.manual = value as ManualMeasurement[];
          else if (key === "aicv") bundle.aicv = value as AICVMeasurement[];
          else if (key === "water") bundle.water = value as WaterEvent[];
          else bundle.positions = value as PositionEvent[];
        } else {
          failed.push({ key, error: outcome.reason });
        }
      });

      if (!cancelled) {
        setRecords(bundle);
        setFailures(failed);
        setLoading(false);
        setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deps]);

  const failedKeys = useMemo(() => new Set(failures.map((failure) => failure.key)), [failures]);

  const stats: Array<{ key: SourceKey; label: string; to: string }> = [
    { key: "plants", label: "Registered plants", to: "/plants" },
    { key: "images", label: "Images recorded", to: "/images" },
    { key: "manual", label: "Manual measurements", to: "/measurements" },
    { key: "aicv", label: "AI/CV measurements", to: "/measurements" },
    { key: "water", label: "Water events", to: "/experiment/water" },
    { key: "positions", label: "Position events", to: "/experiment/positions" },
  ];

  const statValue = (key: SourceKey): number | null => {
    if (!loaded || failedKeys.has(key)) return null;
    return records[key].length;
  };

  // Newest persisted image only — real records, never fabricated.
  const evidenceImage = useMemo(
    () =>
      loaded && !failedKeys.has("images") && records.images.length > 0
        ? [...records.images].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
        : null,
    [loaded, failedKeys, records.images]
  );

  return (
    <section className="page home" aria-labelledby="home-title">
      <header className="home-hero">
        <div className="home-hero-copy">
          <p className="page-eyebrow">EXPERIMENT / MANUAL REFERENCE × AI/CV</p>
          <h1 id="home-title" className="page-title">
            Measure what grows.
          </h1>
          <p className="page-description">
            A controlled <em>Phaseolus vulgaris</em> experiment where manual measurements become the
            reference for computer-vision analysis.
          </p>
          <dl className="hero-tech-meta" aria-label="Protocol metadata">
            <div>
              <dt>Protocol</dt>
              <dd>v1 · locked</dd>
            </div>
            <div>
              <dt>Method</dt>
              <dd>manual reference + AI/CV</dd>
            </div>
            <div>
              <dt>Species</dt>
              <dd>Phaseolus vulgaris</dd>
            </div>
          </dl>
        </div>
        <HeroEvidenceCard
          key={evidenceImage?.image_id ?? "empty"}
          image={evidenceImage}
          sourceUnavailable={loaded && failedKeys.has("images")}
        />
      </header>

      {failures.length > 0 ? (
        <div className="panel panel-alert" role="alert">
          <p className="empty-state-title">Some record sources could not be read</p>
          <p className="empty-state-description">
            Each affected source is listed below with the backend response. Its counts stay
            unavailable rather than being guessed — the error is not hidden.
          </p>
          <ul className="source-failures">
            {failures.map((failure) => (
              <li key={failure.key}>
                <span className="source-failure-name">{SOURCE_LABELS[failure.key]}</span>
                <ErrorSummary
                  error={failure.error}
                  fallbackMessage={`Failed to read ${SOURCE_LABELS[failure.key].toLowerCase()} from the backend`}
                />
              </li>
            ))}
          </ul>
          <p className="muted-note">
            API origin: <code>{describeApiOrigin()}</code>
            {hasExternalApiBase
              ? ""
              : " — no backend is deployed on this origin, so every /api/* request returns HTTP 404."}
          </p>
        </div>
      ) : null}

      <section className="record-summary" aria-labelledby="records-heading">
        <div className="section-heading-row">
          <h2 id="records-heading" className="section-heading">
            Persisted records
          </h2>
          <p className="section-heading-note">Read live from the backend — no estimated values.</p>
        </div>

        {loading ? (
          <div className="loading-note" role="status">
            <span className="loading-dot" aria-hidden="true" />
            Reading records from the backend…
          </div>
        ) : (
          <div className="stat-grid">
            {stats.map((stat) => {
              const value = statValue(stat.key);
              const unavailable = value === null;
              return (
                <Link
                  key={stat.key}
                  className="stat-block"
                  to={stat.to}
                  title={unavailable ? `${stat.label} — unavailable (source could not be read)` : undefined}
                >
                  <span className="stat-value">{unavailable ? "—" : value}</span>
                  <span className="stat-label">{stat.label}</span>
                </Link>
              );
            })}
          </div>
        )}

        {loaded && !failedKeys.has("plants") && records.plants.length === 0 ? (
          <div className="panel">
            <div className="empty-state">
              <p className="empty-state-mark" aria-hidden="true">
                —
              </p>
              <div>
                <p className="empty-state-title">No plants registered yet.</p>
                <p className="empty-state-description">
                  Registration gives every plant a persistent identity before any image or measurement
                  is recorded. The experiment cannot start without it.
                </p>
                <div className="empty-state-actions">
                  <Link className="btn btn-primary" to="/plants">
                    Register the first plant
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {loaded ? <LatestEvidence records={records} failures={failures} /> : null}

      <section aria-labelledby="workflow-heading" className="flow-section">
        <div className="section-heading-row">
          <h2 id="workflow-heading" className="section-heading">
            Daily operator flow
          </h2>
          <p className="section-heading-note">The order in which a plant/day becomes fully recorded.</p>
        </div>
        <ol className="flow-grid">
          {flowSteps.map((step) => (
            <li key={step.n} className="flow-step">
              <span className="flow-step-n" aria-hidden="true">
                {step.n}
              </span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
                <Link className="flow-step-link" to={step.to}>
                  {step.label} →
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel protocol-card" aria-labelledby="context-heading">
        <div className="panel-heading">
          <h2 id="context-heading">Experiment context</h2>
          <p>
            Protocol v1 — locked. See <code>experiment/protocol_v1_locked.md</code>.
          </p>
        </div>
        <dl className="metadata-grid">
          {protocolFacts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </section>
  );
}

/**
 * Hero evidence tile. Shows the newest persisted RAW image when one exists;
 * otherwise an intentional empty state — never a fake preview.
 */
function HeroEvidenceCard({
  image,
  sourceUnavailable,
}: {
  image: ImageRecord | null;
  sourceUnavailable: boolean;
}) {
  const [broken, setBroken] = useState(false);

  const decor = (
    <>
      <span className="crop-mark crop-tl" aria-hidden="true" />
      <span className="crop-mark crop-tr" aria-hidden="true" />
      <span className="crop-mark crop-bl" aria-hidden="true" />
      <span className="crop-mark crop-br" aria-hidden="true" />
      <span className="crosshair crosshair-h" aria-hidden="true" />
      <span className="crosshair crosshair-v" aria-hidden="true" />
    </>
  );

  if (sourceUnavailable) {
    return (
      <div className="home-hero-side">
        <figure className="hero-frame" role="status">
          {decor}
          <div className="frame-empty">
            <svg className="frame-empty-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" stroke="#7B8076" strokeWidth="1.1" />
              <circle cx="9" cy="11" r="2" stroke="#7B8076" strokeWidth="1.1" />
              <path d="M3 16L8 12L13 16L17 13L21 16" stroke="#7B8076" strokeWidth="1.1" />
            </svg>
            <p className="overline">Scientific evidence panel</p>
            <p className="frame-empty-title">Image records could not be read from the backend.</p>
            <p className="frame-empty-note">Details are listed above in the source alert.</p>
          </div>
          <span className="frame-tag frame-tag-tl">
            <span>SPECIMEN</span>
            <b>—</b>
          </span>
          <span className="frame-tag frame-tag-tr">
            <span>EXPERIMENT DAY</span>
            <b>—</b>
          </span>
          <span className="frame-tag frame-tag-bl">RAW IMAGE</span>
        </figure>
      </div>
    );
  }

  if (image === null || broken) {
    return (
      <div className="home-hero-side">
        <figure className="hero-frame" role="status">
          {decor}
          <div className="frame-empty">
            <svg className="frame-empty-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" stroke="#7B8076" strokeWidth="1.1" />
              <circle cx="9" cy="11" r="2" stroke="#7B8076" strokeWidth="1.1" />
              <path d="M3 16L8 12L13 16L17 13L21 16" stroke="#7B8076" strokeWidth="1.1" />
            </svg>
            <p className="overline">Scientific evidence panel</p>
            <p className="frame-empty-title">No persisted raw image is available yet.</p>
            <p className="frame-empty-note">Capture an image in the evidence register.</p>
          </div>
          <span className="frame-tag frame-tag-tl">
            <span>SPECIMEN</span>
            <b>—</b>
          </span>
          <span className="frame-tag frame-tag-tr">
            <span>EXPERIMENT DAY</span>
            <b>—</b>
          </span>
          <span className="frame-tag frame-tag-bl">RAW IMAGE</span>
        </figure>
      </div>
    );
  }

  return (
    <div className="home-hero-side">
      <figure className="hero-frame">
        {decor}
        <Link
          className="hero-frame-link"
          to={`/images/${image.image_id}`}
          aria-label={`Open image evidence ${image.image_id} for ${image.plant_id}`}
        >
          <img
            src={imageFileUrl(image.image_id)}
            alt={`Latest RAW evidence — ${image.image_id} for ${image.plant_id}`}
            onError={() => setBroken(true)}
          />
        </Link>
        <span className="frame-tag frame-tag-tl">
          <span>SPECIMEN</span>
          <b>{image.plant_id}</b>
        </span>
        <span className="frame-tag frame-tag-tr">
          <span>EXPERIMENT DAY</span>
          <b>{image.experiment_day}</b>
        </span>
        <span className="frame-tag frame-tag-bl">RAW IMAGE</span>
        <span className="frame-tag frame-tag-br">{image.image_id}</span>
      </figure>
    </div>
  );
}

/**
 * Real latest evidence straight from the persisted records. Sorted by
 * timestamp, newest first; only genuine records are ever displayed. A source
 * that failed to load is shown as unavailable — never as "empty".
 */
function LatestEvidence({ records, failures }: { records: RecordBundle; failures: SourceFailure[] }) {
  const failedKeys = useMemo(() => new Set(failures.map((failure) => failure.key)), [failures]);
  const imagesFailed = failedKeys.has("images");
  const manualFailed = failedKeys.has("manual");

  const latestImages = useMemo(
    () =>
      [...records.images]
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, 5),
    [records.images]
  );

  const latestManual = useMemo(
    () =>
      [...records.manual]
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, 5),
    [records.manual]
  );

  return (
    <section className="overview-evidence" aria-labelledby="evidence-heading">
      <div className="section-heading-row">
        <h2 id="evidence-heading" className="section-heading">
          Latest evidence
        </h2>
        <p className="section-heading-note">Newest records by timestamp — read from the backend.</p>
      </div>

      <div className="evidence-grid">
        <div className="evidence-column">
          <h3 className="overline evidence-column-title">Photographic evidence</h3>
          {imagesFailed ? (
            <p className="muted-note">Image records could not be read — see the source alert above.</p>
          ) : latestImages.length === 0 ? (
            <p className="muted-note">No persisted raw image is available yet.</p>
          ) : (
            <ul className="filmstrip">
              {latestImages.map((image) => (
                <li key={image.image_id}>
                  <Link className="filmstrip-item" to={`/images/${image.image_id}`}>
                    <EvidenceThumb src={imageFileUrl(image.image_id)} />
                    <span className="filmstrip-id">{image.image_id}</span>
                    <span className="filmstrip-meta">
                      {image.plant_id} · day {image.experiment_day}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="evidence-column">
          <h3 className="overline evidence-column-title">Recent manual reference</h3>
          {manualFailed ? (
            <p className="muted-note">Manual measurements could not be read — see the source alert above.</p>
          ) : latestManual.length === 0 ? (
            <p className="muted-note">No manual measurements recorded yet.</p>
          ) : (
            <ul className="journal">
              {latestManual.map((m) => (
                <li key={m.measurement_id} className="journal-row">
                  <span className="journal-main">
                    <Link className="id-link" to={`/measurements/${m.measurement_id}`}>
                      {m.measurement_id}
                    </Link>
                    <span className="cell-sub">
                      <Link to={`/plants/${m.plant_id}`}>{m.plant_id}</Link> · rep {m.repetition} ·
                      attempt {m.attempt ?? 1}
                      {m.plant_height_cm != null ? ` · ${m.plant_height_cm} cm` : ""}
                    </span>
                  </span>
                  <span className={`verdict verdict-${m.measurement_status}`}>
                    {m.measurement_status.toUpperCase()}
                  </span>
                  <span className="journal-date mono-cell">{m.timestamp}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
