import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EvidenceThumb } from "../components/EvidenceThumb";
import { ErrorSummary } from "../components/ErrorSummary";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { services } from "../data/adapters";
import { imageFileUrl } from "./ImagesPage";
import type { ImageService, MeasurementService, PlantService, PositionService, WaterService } from "../services/interfaces";
import type { AICVMeasurement, ImageRecord, ManualMeasurement, Plant, PositionEvent, WaterEvent } from "../types/entities";

type DiaryPageDeps = {
  plantService: Pick<PlantService, "listPlants">;
  imageService: Pick<ImageService, "listImages">;
  measurementService: Pick<MeasurementService, "listManualMeasurements" | "listAICVMeasurements">;
  waterService: Pick<WaterService, "listWaterEvents">;
  positionService: Pick<PositionService, "listPositionEvents">;
};

type DiaryPageProps = { services?: DiaryPageDeps };

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

const DAY_RANGE = { min: 0, max: 30 };

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

function formatDateCZ(date: Date): string {
  return date.toLocaleDateString("cs-CZ", { day: "numeric", month: "short", year: "numeric" });
}

function getSowingDate(plants: Plant[]): string | null {
  for (const plant of plants) {
    if (plant.sowing_date) return plant.sowing_date;
  }
  return null;
}

function getDateForExperimentDay(sowingDate: string | null, experimentDay: number): Date | null {
  if (!sowingDate) return null;
  const sow = new Date(sowingDate + "T00:00:00");
  if (isNaN(sow.getTime())) return null;
  const target = new Date(sow);
  target.setDate(sow.getDate() + experimentDay);
  return target;
}

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function DiaryPage({ services: deps = services }: DiaryPageProps = {}) {
  const [records, setRecords] = useState<RecordBundle>(emptyBundle);
  const [failures, setFailures] = useState<SourceFailure[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const [selectedDay, setSelectedDay] = useState<number>(() => {
    return 0;
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const tasks: Array<{ key: string; run: () => Promise<unknown> }> = [
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
          failed.push({ key: key as SourceKey, error: outcome.reason });
        }
      });

      if (!cancelled) {
        setRecords(bundle);
        setFailures(failed);
        setLoading(false);
        setLoaded(true);
      }
    })();

    return () => { cancelled = true; };
  }, [deps]);

  const failedKeys = useMemo(() => new Set(failures.map((failure) => failure.key)), [failures]);

  const sowingDate = useMemo(() => {
    for (const plant of records.plants) {
      if (plant.sowing_date) return plant.sowing_date;
    }
    return null;
  }, [records.plants]);

  const currentExperimentDay = useMemo(() => {
    if (!sowingDate) return null;
    const sow = new Date(sowingDate + "T00:00:00");
    if (isNaN(sow.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = today.getTime() - sow.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }, [sowingDate]);

  const [initializedDay, setInitializedDay] = useState(false);
  useEffect(() => {
    if (loaded && !initializedDay && currentExperimentDay !== null) {
      setSelectedDay(currentExperimentDay);
      setInitializedDay(true);
    }
  }, [loaded, initializedDay, currentExperimentDay]);

  const selectedDate = useMemo(() => {
    if (!sowingDate) return null;
    return getDateForExperimentDay(sowingDate, selectedDay);
  }, [sowingDate, selectedDay]);

  const dayRecords = useMemo(() => {
    if (!selectedDate) return { images: [], manual: [], water: [], aicv: [], positions: [] };

    const dateKey = formatDateKey(selectedDate);

    return {
      images: records.images.filter((img) => {
        const imgDate = new Date(img.timestamp).toISOString().slice(0, 10);
        return imgDate === dateKey;
      }),
      manual: records.manual.filter((m) => {
        const mDate = new Date(m.timestamp).toISOString().slice(0, 10);
        return mDate === dateKey;
      }),
      water: records.water.filter((w) => {
        const wDate = new Date(w.timestamp).toISOString().slice(0, 10);
        return wDate === dateKey;
      }),
      aicv: records.aicv.filter((a) => {
        const aDate = new Date(a.timestamp).toISOString().slice(0, 10);
        return aDate === dateKey;
      }),
      positions: records.positions.filter((p) => {
        const pDate = new Date(p.timestamp).toISOString().slice(0, 10);
        return pDate === dateKey;
      }),
    };
  }, [records, selectedDate]);

  const goToDay = (day: number) => {
    if (day >= DAY_RANGE.min && day <= DAY_RANGE.max) {
      setSelectedDay(day);
    }
  };

  const goToToday = () => {
    if (currentExperimentDay !== null) {
      setSelectedDay(currentExperimentDay);
    }
  };

  const isToday = currentExperimentDay !== null && selectedDay === currentExperimentDay;
  const isFuture = currentExperimentDay !== null && selectedDay > currentExperimentDay;

  if (loading) {
    return (
      <section className="page" aria-labelledby="diary-title">
        <PageHeader
          eyebrow="Experiment Diary"
          title="Experiment Diary"
          description="Browse historical days and observations."
          titleId="diary-title"
        />
        <div className="panel">
          <div className="loading-note" role="status">
            <span className="loading-dot" aria-hidden="true" />
            Loading experiment records…
          </div>
        </div>
      </section>
    );
  }

  const failedImages = failedKeys.has("images");
  const failedManual = failedKeys.has("manual");
  const failedWater = failedKeys.has("water");

  return (
    <section className="page diary" aria-labelledby="diary-title">
      <PageHeader
        eyebrow="Experiment Diary"
        title="Experiment Diary"
        description="Navigate experiment days and review historical observations."
        titleId="diary-title"
        actions={
          <div className="diary-header-actions">
            <button
              className="btn btn-ghost"
              onClick={goToToday}
              disabled={currentExperimentDay === null || isToday}
              aria-label="Go to today"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" />
                <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" />
              </svg>
              <span>Today (Day {currentExperimentDay ?? "—"})</span>
            </button>
          </div>
        }
      />

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
                <span className="source-failure-name">{SOURCE_LABELS[failure.key as SourceKey]}</span>
                <ErrorSummary
                  error={failure.error}
                  fallbackMessage={`Failed to read ${SOURCE_LABELS[failure.key as SourceKey].toLowerCase()} from the backend`}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="panel diary-nav" aria-labelledby="day-nav-heading">
        <div className="diary-nav-header">
          <h2 id="day-nav-heading" className="section-heading">Day {selectedDay}</h2>
          <div className="diary-nav-date">
            {selectedDate ? formatDateCZ(selectedDate) : "Sowing date not set"}
            {isToday && <StatusBadge status="PASS" />}
            {isFuture && <StatusBadge status="WARN" />}
            {!sowingDate && <StatusBadge status="WARN" />}
          </div>
        </div>

        <div className="diary-nav-controls">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => goToDay(selectedDay - 1)}
            disabled={selectedDay <= DAY_RANGE.min}
            aria-label="Previous day"
          >
            ← Day {selectedDay - 1}
          </button>
          <div className="day-picker" role="group" aria-label="Select experiment day">
            <label htmlFor="day-input" className="visually-hidden">Experiment day</label>
            <input
              id="day-input"
              type="number"
              min={DAY_RANGE.min}
              max={DAY_RANGE.max}
              value={selectedDay}
              onChange={(e) => goToDay(Number(e.target.value))}
              className="day-input"
              aria-label="Experiment day (0–30)"
            />
            <span className="day-range">/ 30</span>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => goToDay(selectedDay + 1)}
            disabled={selectedDay >= DAY_RANGE.max}
            aria-label="Next day"
          >
            Day {selectedDay + 1} →
          </button>
        </div>

        {!sowingDate && (
          <div className="diary-warning">
            <StatusBadge status="WARN" />
            <span>Sowing date not set in any plant record. Experiment day dates cannot be calculated.</span>
          </div>
        )}
      </section>

      <section className="panel diary-records" aria-labelledby="records-heading">
        <div className="diary-records-header">
          <h2 id="records-heading" className="section-heading">
            Observations for Day {selectedDay}
          </h2>
          <p className="section-heading-note">
            {isFuture
              ? "This day is in the future. No real observations may exist yet."
              : isToday
              ? "Today's observations (live)."
              : "Historical observations."}
          </p>
        </div>

        {failedImages && (
          <p className="muted-note warning">⚠ Image records could not be read — some photographs may be missing.</p>
        )}
        {failedManual && (
          <p className="muted-note warning">⚠ Manual measurements could not be read — some records may be missing.</p>
        )}
        {failedWater && (
          <p className="muted-note warning">⚠ Water events could not be read — some records may be missing.</p>
        )}

        <div className="diary-section" aria-labelledby="photos-heading">
          <h3 id="photos-heading" className="diary-section-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" />
              <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
              <path d="M21 15l-5-5L5 17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Photographs ({dayRecords.images.length})
          </h3>

          {failedImages ? (
            <p className="muted-note warning">Image records could not be read — see source alert above.</p>
          ) : dayRecords.images.length === 0 ? (
            <div className="diary-empty">
              <p>No photographs recorded for this day.</p>
              {!isFuture && !isToday && (
                <p className="muted-note">This does not mean plants failed — only that no record exists.</p>
              )}
              {!isFuture && (
                <Link className="btn btn-ghost btn-sm" to="/capture">
                  Add photograph for this day
                </Link>
              )}
            </div>
          ) : (
            <div className="diary-filmstrip">
              {dayRecords.images.map((image) => (
                <Link key={image.image_id} className="diary-item diary-item--image" to={`/images/${image.image_id}`}>
                  <EvidenceThumb src={imageFileUrl(image.image_id)} plantId={image.plant_id} />
                  <div className="diary-item-meta">
                    <span className="diary-item-id">{image.image_id}</span>
                    <span className="diary-item-plant">
                      <Link to={`/plants/${image.plant_id}`}>{image.plant_id}</Link>
                      · Day {image.experiment_day}
                    </span>
                    <span className="diary-item-quality">{image.image_quality_status}</span>
                    <span className="diary-item-calibration">{image.calibration_status}</span>
                    <span className="diary-item-time">{formatDateCZ(new Date(image.timestamp))}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="diary-section" aria-labelledby="manual-heading">
          <h3 id="manual-heading" className="diary-section-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 3v18M3 12h18" stroke="currentColor" strokeLinecap="round" />
              <path d="M18 6l-6 6-6-6" stroke="currentColor" strokeLinecap="round" />
            </svg>
            Manual measurements ({dayRecords.manual.length})
          </h3>

          {failedManual ? (
            <p className="muted-note warning">Manual measurements could not be read — see source alert above.</p>
          ) : dayRecords.manual.length === 0 ? (
            <div className="diary-empty">
              <p>No manual measurements recorded for this day.</p>
              {!isFuture && (
                <Link className="btn btn-ghost btn-sm" to="/measurements">
                  Add measurement for this day
                </Link>
              )}
            </div>
          ) : (
            <ul className="diary-list">
              {dayRecords.manual.map((m) => (
                <li key={m.measurement_id} className="diary-item diary-item--manual">
                  <div className="diary-item-main">
                    <Link className="id-link" to={`/measurements/${m.measurement_id}`}>
                      {m.measurement_id}
                    </Link>
                    <span className="diary-item-sub">
                      <Link to={`/plants/${m.plant_id}`}>{m.plant_id}</Link>
                      · rep {m.repetition} · attempt {m.attempt ?? 1}
                      {m.plant_height_cm != null ? ` · ${m.plant_height_cm} cm` : ""}
                    </span>
                  </div>
                  <span className={`verdict verdict-${m.measurement_status}`}>
                    {m.measurement_status.toUpperCase()}
                  </span>
                  <span className="diary-item-time mono-cell">{formatDateCZ(new Date(m.timestamp))}</span>
                  <Link className="diary-item-edit" to={`/measurements/${m.measurement_id}`} aria-label="Edit measurement">
                    Edit
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="diary-section" aria-labelledby="water-heading">
          <h3 id="water-heading" className="diary-section-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" stroke="currentColor" strokeLinecap="round" />
            </svg>
            Water events ({dayRecords.water.length})
          </h3>

          {failedWater ? (
            <p className="muted-note warning">Water events could not be read — see source alert above.</p>
          ) : dayRecords.water.length === 0 ? (
            <div className="diary-empty">
              <p>No water events recorded for this day.</p>
              {!isFuture && (
                <Link className="btn btn-ghost btn-sm" to="/experiment/water">
                  Add water event for this day
                </Link>
              )}
            </div>
          ) : (
            <ul className="diary-list">
              {dayRecords.water.map((w) => (
                <li key={w.water_event_id} className="diary-item diary-item--water">
                  <div className="diary-item-main">
                    <Link className="id-link" to={`/experiment/water/${w.water_event_id}`}>
                      {w.water_event_id}
                    </Link>
                    <span className="diary-item-sub">
                      <Link to={`/plants/${w.plant_id}`}>{w.plant_id}</Link>
                      · {w.water_added_ml} ml added
                    </span>
                  </div>
                  <span className={`verdict verdict-${w.watering_status}`}>
                    {w.watering_status.toUpperCase()}
                  </span>
                  <span className="diary-item-time mono-cell">{formatDateCZ(new Date(w.timestamp))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="diary-section" aria-labelledby="aicv-heading">
          <h3 id="aicv-heading" className="diary-section-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="2" y="2" width="20" height="20" rx="2" stroke="currentColor" />
              <path d="M12 8l4 4-4 4M8 12l4 4 4-4" stroke="currentColor" strokeLinecap="round" />
            </svg>
            AI/CV measurements ({dayRecords.aicv.length})
          </h3>

          {dayRecords.aicv.length === 0 ? (
            <div className="diary-empty">
              <p>No AI/CV measurements for this day.</p>
            </div>
          ) : (
            <ul className="diary-list">
              {dayRecords.aicv.map((a) => (
                <li key={a.measurement_id} className="diary-item diary-item--aicv">
                  <div className="diary-item-main">
                    <Link className="id-link" to={`/analysis/${a.measurement_id}`}>
                      {a.measurement_id}
                    </Link>
                    <span className="diary-item-sub">
                      <Link to={`/plants/${a.plant_id}`}>{a.plant_id}</Link>
                      · {a.model} v{a.model_version}
                      {a.plant_height_cm != null ? ` · ${a.plant_height_cm} cm` : ""}
                    </span>
                  </div>
                  <span className={`verdict verdict-${a.detection_status}`}>
                    {a.detection_status.toUpperCase()}
                  </span>
                  <span className="diary-item-time mono-cell">{formatDateCZ(new Date(a.timestamp))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="diary-section" aria-labelledby="positions-heading">
          <h3 id="positions-heading" className="diary-section-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" />
              <path d="M12 2v20M2 12h20" stroke="currentColor" strokeLinecap="round" />
            </svg>
            Position events ({dayRecords.positions.length})
          </h3>

          {dayRecords.positions.length === 0 ? (
            <div className="diary-empty">
              <p>No position events for this day.</p>
            </div>
          ) : (
            <ul className="diary-list">
              {dayRecords.positions.map((p) => (
                <li key={p.position_event_id} className="diary-item diary-item--position">
                  <div className="diary-item-main">
                    <Link className="id-link" to={`/experiment/positions/${p.position_event_id}`}>
                      {p.position_event_id}
                    </Link>
                    <span className="diary-item-sub">
                      <Link to={`/plants/${p.plant_id}`}>{p.plant_id}</Link>
                      · {p.location} ({p.reason})
                    </span>
                  </div>
                  <span className="diary-item-time mono-cell">{formatDateCZ(new Date(p.timestamp))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </section>
  );
}