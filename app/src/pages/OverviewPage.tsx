import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorSummary } from "../components/ErrorSummary";
import { EvidenceThumb } from "../components/EvidenceThumb";
import { StatusBadge } from "../components/StatusBadge";
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

/**
 * Calculates experiment day from sowing date.
 * Day 0 = sowing date. Day 1 = following calendar day.
 * Handles timezone correctly by using local date comparison.
 */
function calculateExperimentDay(sowingDate: string | null | undefined): number | null {
  if (!sowingDate) return null;
  const sow = new Date(sowingDate + "T00:00:00");
  if (isNaN(sow.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = today.getTime() - sow.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return days >= 0 ? days : null;
}

/** Format a date as "DD MMM YYYY" in Czech locale. */
function formatDateCZ(date: Date): string {
  return date.toLocaleDateString("cs-CZ", { day: "numeric", month: "short", year: "numeric" });
}

/** Get the sowing date from the first plant record, if available. */
function getSowingDate(plants: Plant[]): string | null {
  for (const plant of plants) {
    if (plant.sowing_date) return plant.sowing_date;
  }
  return null;
}

export function OverviewPage({ services: deps = services }: OverviewPageProps = {}) {
  const [records, setRecords] = useState<RecordBundle>(emptyBundle);
  const [failures, setFailures] = useState<SourceFailure[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
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

  // Experiment day calculation
  const sowingDate = useMemo(() => getSowingDate(records.plants), [records.plants]);
  const experimentDay = useMemo(() => calculateExperimentDay(sowingDate), [sowingDate]);
  const today = useMemo(() => formatDateCZ(new Date()), []);
  const tomorrow = useMemo(() => formatDateCZ(new Date(Date.now() + 24 * 60 * 60 * 1000)), []);

  // Germination count
  const germinatedCount = useMemo(
    () => records.plants.filter((p) => p.emergence_status === "emerged").length,
    [records.plants]
  );
  const totalPlants = records.plants.length;

  // Today's activity
  const todayImages = useMemo(
    () =>
      records.images.filter((img) => {
        const imgDate = new Date(img.timestamp).toLocaleDateString("cs-CZ");
        return imgDate === today;
      }),
    [records.images, today]
  );
  const todayManual = useMemo(
    () =>
      records.manual.filter((m) => {
        const mDate = new Date(m.timestamp).toLocaleDateString("cs-CZ");
        return mDate === today;
      }),
    [records.manual, today]
  );
  const todayWater = useMemo(
    () =>
      records.water.filter((w) => {
        const wDate = new Date(w.timestamp).toLocaleDateString("cs-CZ");
        return wDate === today;
      }),
    [records.water, today]
  );
  const todayActivityCount = todayImages.length + todayManual.length + todayWater.length;
  const lastActivity = useMemo(() => {
    const all = [
      ...records.images.map((i) => ({ time: i.timestamp, type: "image" as const })),
      ...records.manual.map((m) => ({ time: m.timestamp, type: "manual" as const })),
      ...records.water.map((w) => ({ time: w.timestamp, type: "water" as const })),
    ].sort((a, b) => b.time.localeCompare(a.time));
    return all[0] ?? null;
  }, [records.images, records.manual, records.water]);

  // Latest image
  const latestImage = useMemo(
    () =>
      loaded && !failedKeys.has("images") && records.images.length > 0
        ? [...records.images].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
        : null,
    [loaded, failedKeys, records.images]
  );

  return (
    <section className="page home" aria-labelledby="home-title">
      {/* Experiment Status Bar */}
      <header className="experiment-status-bar" aria-label="Experiment status">
        <div className="status-grid">
          <div className="status-item">
            <span className="status-label">Experiment day</span>
            <span className="status-value status-value--day">
              {experimentDay !== null ? `Day ${experimentDay}` : "—"}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">Today</span>
            <span className="status-value">{today}</span>
          </div>
          <div className="status-item">
            <span className="status-label">Sowing date</span>
            <span className="status-value">{sowingDate ? formatDateCZ(new Date(sowingDate + "T00:00:00")) : "Not set"}</span>
          </div>
          <div className="status-item">
            <span className="status-label">Germination</span>
            <span className="status-value status-value--germination">
              {germinatedCount} / {totalPlants} germinated
            </span>
          </div>
        </div>
        {experimentDay === null && (
          <div className="status-warning">
            <StatusBadge status="WARN" />
            <span>Sowing date not set — experiment day cannot be calculated.</span>
          </div>
        )}
      </header>

      {/* Source Failures */}
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

      {/* Main Content */}
      <main className="home-main">
        {/* Today's Activity */}
        <section className="panel panel-today" aria-labelledby="today-heading">
          <div className="panel-heading-row">
            <h2 id="today-heading" className="section-heading">
              Today's activity
            </h2>
            <p className="section-heading-note">
              Records created today ({today}). Tomorrow is {tomorrow} (Day {experimentDay !== null ? experimentDay + 1 : "—"}).
            </p>
          </div>

          <div className="today-grid">
            <Link className="today-card today-card--images" to="/images">
              <div className="today-card-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" />
                  <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                  <path d="M21 15l-5-5L5 17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="today-card-content">
                <span className="today-card-count">{todayImages.length}</span>
                <span className="today-card-label">Photographs today</span>
              </div>
            </Link>
            <Link className="today-card today-card--manual" to="/measurements">
              <div className="today-card-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 3v18M3 12h18" stroke="currentColor" strokeLinecap="round" />
                  <path d="M18 6l-6 6-6-6" stroke="currentColor" strokeLinecap="round" />
                </svg>
              </div>
              <div className="today-card-content">
                <span className="today-card-count">{todayManual.length}</span>
                <span className="today-card-label">Manual measurements today</span>
              </div>
            </Link>
            <Link className="today-card today-card--water" to="/experiment/water">
              <div className="today-card-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" stroke="currentColor" strokeLinecap="round" />
                </svg>
              </div>
              <div className="today-card-content">
                <span className="today-card-count">{todayWater.length}</span>
                <span className="today-card-label">Water events today</span>
              </div>
            </Link>
          </div>

          {lastActivity ? (
            <p className="today-last-activity">
              Last recorded: <Link to={lastActivity.type === "image" ? `/images` : lastActivity.type === "manual" ? `/measurements` : `/experiment/water`}>{formatDateCZ(new Date(lastActivity.time))}</Link>
            </p>
          ) : (
            <p className="today-last-activity empty">No activity recorded yet today.</p>
          )}
        </section>

        {/* Quick Actions */}
        <section className="panel panel-actions" aria-labelledby="actions-heading">
          <div className="panel-heading-row">
            <h2 id="actions-heading" className="section-heading">Quick actions</h2>
          </div>
          <div className="action-grid">
            <Link className="action-card action-card--primary" to="/capture">
              <div className="action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <h3>Capture photograph</h3>
                <p>Select a plant, open camera, save evidence.</p>
              </div>
            </Link>
            <Link className="action-card" to="/diary">
              <div className="action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" />
                  <path d="M16 2v4M8 2v4" stroke="currentColor" strokeWidth="2" />
                  <path d="M3 10h18" stroke="currentColor" strokeWidth="2" />
                </svg>
              </div>
              <div>
                <h3>Experiment Diary</h3>
                <p>Browse historical days, review observations.</p>
              </div>
            </Link>
            <Link className="action-card" to="/plants">
              <div className="action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" />
                  <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" />
                </svg>
              </div>
              <div>
                <h3>Specimen Register</h3>
                <p>Manage {totalPlants} registered plants across G1/G2/G3.</p>
              </div>
            </Link>
            <Link className="action-card" to="/experiment/verification">
              <div className="action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" strokeWidth="2" />
                  <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <h3>Inspection Board</h3>
                <p>Verify daily completeness and exceptions.</p>
              </div>
            </Link>
          </div>
        </section>

        {/* Latest Evidence */}
        <section className="panel panel-latest" aria-labelledby="latest-heading">
          <div className="panel-heading-row">
            <h2 id="latest-heading" className="section-heading">Latest photographic evidence</h2>
            <p className="section-heading-note">Newest records by timestamp — read from the backend.</p>
          </div>

          <div className="latest-filmstrip">
            {loaded && !failedKeys.has("images") && records.images.length > 0 ? (
              [...records.images]
                .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                .slice(0, 5)
                .map((image) => (
                  <Link key={image.image_id} className="latest-item" to={`/images/${image.image_id}`}>
                    <EvidenceThumb src={imageFileUrl(image.image_id)} plantId={image.plant_id} />
                    <div className="latest-item-meta">
                      <span className="latest-item-id">{image.image_id}</span>
                      <span className="latest-item-plant">{image.plant_id} · Day {image.experiment_day}</span>
                      <span className="latest-item-time">{formatDateCZ(new Date(image.timestamp))}</span>
                    </div>
                  </Link>
                ))
            ) : failedKeys.has("images") ? (
              <p className="muted-note">Image records could not be read — see the source alert above.</p>
            ) : (
              <p className="muted-note">No persisted raw image is available yet. <Link to="/capture">Capture the first photograph</Link>.</p>
            )}
          </div>
        </section>

        {/* Experiment Context */}
        <section className="panel panel-context" aria-labelledby="context-heading">
          <div className="panel-heading-row">
            <h2 id="context-heading" className="section-heading">Experiment context</h2>
            <p className="section-heading-note">Protocol v1 — locked. See <code>experiment/protocol_v1_locked.md</code>.</p>
          </div>
          <dl className="metadata-grid">
            <div><dt>Species</dt><dd>Phaseolus vulgaris</dd></div>
            <div><dt>Variety</dt><dd>Aidagold</dd></div>
            <div><dt>Groups</dt><dd>G1 (100%), G2 (85%), G3 (70%) — relative gravimetric targets</dd></div>
            <div><dt>Plants</dt><dd>{totalPlants} registered (9 per group)</dd></div>
            <div><dt>Seeds per pot</dt><dd>3</dd></div>
            <div><dt>Substrate per pot</dt><dd>72 g (dry)</dd></div>
            <div><dt>Planned length</dt><dd>Up to 28 experiment days</dd></div>
            <div><dt>Manual reference</dt><dd>3× per week · 2 repetitions</dd></div>
            <div><dt>Primary parameter</dt><dd>Plant height (cm)</dd></div>
            <div><dt>Experiment day</dt><dd>Always operator-entered</dd></div>
          </dl>
        </section>
      </main>
    </section>
  );
}