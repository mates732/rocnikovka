import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { ErrorSummary } from "../components/ErrorSummary";
import { PageHeader } from "../components/PageHeader";
import { services } from "../data/adapters";
import type { ImageService, MeasurementService, PlantService, WaterService } from "../services/interfaces";
import type { AICVMeasurement, ImageRecord, ManualMeasurement, Plant, WaterEvent } from "../types/entities";

// ============================================================================
// Experiment verification (Phase 4K.9)
// ----------------------------------------------------------------------------
// READ-ONLY. Completeness is derived entirely from persisted records; nothing
// is written, mutated, invented or persisted here. experiment_day is always
// explicitly selected by the operator — never derived from timestamps or the
// current date. The backend remains the authoritative data layer; this view
// only answers "what exists and what is still missing for this day?".
//
// The expected experiment size is small (10–20 plants), so the page composes
// the existing GET services directly instead of adding backend infrastructure.
// ============================================================================

export type ManualStatus = "pass" | "warn" | "fail" | "missing";
export type Presence = "present" | "missing";

export type PlantDayCompleteness = {
  plant_id: string;
  pot_id: string;
  image: Presence;
  image_count: number;
  manual: ManualStatus;
  manual_repetition_1: boolean;
  manual_repetition_2: boolean;
  manual_attempts: number;
  water: Presence;
  /** Human-readable reasons why this plant/day needs attention. */
  attention: string[];
};

export type TraceabilityIssue = {
  entity: string;
  entity_id: string;
  plant_id: string;
  issue: string;
};

export type VerificationResult = {
  plants: PlantDayCompleteness[];
  traceabilityIssues: TraceabilityIssue[];
};

/**
 * Pure read-only completeness computation for one experiment day. This is the
 * single source of the derived model; the UI renders it without further logic.
 *
 * Rules (no invented scientific requirements):
 * - image presence = zero / one / multiple (multiple is legitimate, never a
 *   canonical image is chosen)
 * - manual = PASS/WARN/FAIL if any measurement with that status exists for the
 *   day, MISSING otherwise; repetitions 1 and 2 are tracked separately;
 *   failed attempts stay visible as historical information
 * - water = present if any water event exists for the day
 * - traceability checks: image with unknown plant, manual measurement whose
 *   image belongs to another plant, manual image/day mismatch, AICV image
 *   plant/day mismatch
 */
export function computeCompleteness(
  plants: Plant[],
  images: ImageRecord[],
  manual: ManualMeasurement[],
  water: WaterEvent[],
  aicv: AICVMeasurement[],
  day: number
): VerificationResult {
  const plantSet = new Set(plants.map((p) => p.plant_id));

  const plantRows = plants.map((plant) => {
    const plantImages = images.filter((img) => img.plant_id === plant.plant_id && img.experiment_day === day);
    const plantManual = manual.filter((m) => m.plant_id === plant.plant_id && m.experiment_day === day);
    const plantWater = water.filter((w) => w.plant_id === plant.plant_id && w.experiment_day === day);

    const statuses = plantManual.map((m) => m.measurement_status);
    let manualStatus: ManualStatus = "missing";
    if (statuses.includes("pass")) manualStatus = "pass";
    else if (statuses.includes("warn")) manualStatus = "warn";
    else if (statuses.includes("fail")) manualStatus = "fail";

    const attention: string[] = [];
    if (plantImages.length === 0) attention.push("No image recorded for this day.");
    if (plantManual.length === 0) attention.push("No manual reference measurement recorded for this day.");
    if (manualStatus === "fail") attention.push("Manual measurement exists but FAILED (failure preserved as historical record).");
    if (manualStatus === "warn") attention.push("Manual measurement exists with WARN status.");
    if (!plantManual.some((m) => m.repetition === 1)) attention.push("Manual repetition 1 is missing.");
    if (!plantManual.some((m) => m.repetition === 2)) attention.push("Manual repetition 2 is missing.");

    return {
      plant_id: plant.plant_id,
      pot_id: plant.pot_id,
      image: plantImages.length > 0 ? ("present" as const) : ("missing" as const),
      image_count: plantImages.length,
      manual: manualStatus,
      manual_repetition_1: plantManual.some((m) => m.repetition === 1),
      manual_repetition_2: plantManual.some((m) => m.repetition === 2),
      manual_attempts: plantManual.length,
      water: plantWater.length > 0 ? ("present" as const) : ("missing" as const),
      attention,
    };
  });

  const traceabilityIssues: TraceabilityIssue[] = [];

  for (const img of images) {
    if (!plantSet.has(img.plant_id)) {
      traceabilityIssues.push({
        entity: "image",
        entity_id: img.image_id,
        plant_id: img.plant_id,
        issue: `Image references unknown plant '${img.plant_id}'.`,
      });
    }
  }

  for (const m of manual) {
    if (!m.image_id) continue;
    const img = images.find((i) => i.image_id === m.image_id);
    if (!img) {
      traceabilityIssues.push({
        entity: "manual_measurement",
        entity_id: m.measurement_id,
        plant_id: m.plant_id,
        issue: `Manual measurement references unknown image '${m.image_id}'.`,
      });
    } else {
      if (img.plant_id !== m.plant_id) {
        traceabilityIssues.push({
          entity: "manual_measurement",
          entity_id: m.measurement_id,
          plant_id: m.plant_id,
          issue: `Manual measurement image '${m.image_id}' belongs to plant '${img.plant_id}', not '${m.plant_id}'.`,
        });
      }
      if (img.experiment_day !== m.experiment_day) {
        traceabilityIssues.push({
          entity: "manual_measurement",
          entity_id: m.measurement_id,
          plant_id: m.plant_id,
          issue: `Manual measurement day ${m.experiment_day} does not match its image day ${img.experiment_day}.`,
        });
      }
    }
  }

  for (const a of aicv) {
    const img = images.find((i) => i.image_id === a.image_id);
    if (!img) {
      traceabilityIssues.push({
        entity: "aicv_measurement",
        entity_id: a.measurement_id,
        plant_id: a.plant_id,
        issue: `AICV measurement references unknown image '${a.image_id}'.`,
      });
    } else if (img.plant_id !== a.plant_id || img.experiment_day !== a.experiment_day) {
      traceabilityIssues.push({
        entity: "aicv_measurement",
        entity_id: a.measurement_id,
        plant_id: a.plant_id,
        issue: `AICV measurement image '${a.image_id}' plant/day does not match (image ${img.plant_id}/day ${img.experiment_day}, AICV ${a.plant_id}/day ${a.experiment_day}).`,
      });
    }
  }

  return { plants: plantRows, traceabilityIssues };
}

export type VerificationPageDeps = {
  plantService: Pick<PlantService, "listPlants">;
  imageService: Pick<ImageService, "listImages">;
  measurementService: Pick<MeasurementService, "listManualMeasurements" | "listAICVMeasurements">;
  waterService: Pick<WaterService, "listWaterEvents">;
};

export type VerificationPageProps = { services?: VerificationPageDeps };

export function ExperimentVerificationPage({ services: deps = services }: VerificationPageProps = {}) {
  // The experiment day is always EXPLICITLY operator-selected. It is never
  // derived from timestamps, image metadata, emergence dates or the current
  // date. No default day is invented either — the view starts empty and asks
  // the operator which day to inspect.
  const [day, setDay] = useState("");
  const [plants, setPlants] = useState<Plant[]>([]);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [manual, setManual] = useState<ManualMeasurement[]>([]);
  const [water, setWater] = useState<WaterEvent[]>([]);
  const [aicv, setAicv] = useState<AICVMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [plantData, imageData, manualData, waterData, aicvData] = await Promise.all([
          deps.plantService.listPlants(),
          deps.imageService.listImages(),
          deps.measurementService.listManualMeasurements(),
          deps.waterService.listWaterEvents(),
          deps.measurementService.listAICVMeasurements(),
        ]);
        if (!cancelled) {
          setPlants(plantData);
          setImages(imageData);
          setManual(manualData);
          setWater(waterData);
          setAicv(aicvData);
        }
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deps]);

  const dayNumber = day.trim() === "" ? null : Number(day);
  const validDay = dayNumber !== null && Number.isInteger(dayNumber) && dayNumber >= 1;

  const result = useMemo(
    () => (validDay ? computeCompleteness(plants, images, manual, water, aicv, dayNumber as number) : null),
    [validDay, dayNumber, plants, images, manual, water, aicv]
  );

  const attentionCount = result ? result.plants.reduce((acc, p) => acc + (p.attention.length > 0 ? 1 : 0), 0) : 0;
  const completeCount = result ? result.plants.length - attentionCount : 0;

  return (
    <section className="page" aria-labelledby="verification-title">
      <PageHeader
        eyebrow="Review"
        title="Experiment Verification"
        description="Read-only completeness view: what was recorded for the selected experiment day and what still needs attention."
        titleId="verification-title"
      />

      {loading ? (
        <div className="panel">
          <EmptyState title="Loading records" description="Fetching plants, images and measurements from the backend..." />
        </div>
      ) : error ? (
        <div className="panel">
          <p className="empty-state-title">Unable to load verification data</p>
          <ErrorSummary error={error} fallbackMessage="Failed to load records for the verification view" />
        </div>
      ) : (
        <>
          <section className="panel day-selector-panel" aria-label="Experiment day selection">
            <div className="day-selector">
              <label className="form-field day-selector-field" htmlFor="verification-day">
                <span className="overline">Experiment day</span>
                <div className="day-selector-input">
                  <input
                    id="verification-day"
                    type="number"
                    min={1}
                    step={1}
                    value={day}
                    onChange={(e) => setDay(e.target.value)}
                    placeholder="7"
                    aria-describedby="verification-day-hint"
                  />
                </div>
              </label>
              <div className="day-selector-guide">
                <p id="verification-day-hint" className="form-hint">
                  The day is explicitly entered by the operator — never derived from timestamps or the current date.
                </p>
                <p className="form-hint">Completeness is computed read-only from persisted records.</p>
              </div>
            </div>
          </section>

          {result === null ? (
            <div className="panel">
              <EmptyState
                title="No experiment day selected"
                description="Enter an experiment day above to inspect that day's completeness. No data is shown until a day is explicitly chosen."
              />
            </div>
          ) : (
            <>
              <section
                className="verification-board"
                aria-label={`Completeness for experiment day ${dayNumber}`}
              >
                <header className="verification-board-head">
                  <div>
                    <p className="overline">Completeness</p>
                    <h2 className="verification-day-title">Experiment day {dayNumber}</h2>
                  </div>
                  <div className="verification-board-summary" aria-label="Completeness summary">
                    <span className="summary-cell">
                      <span className="summary-n">{completeCount}</span>
                      <span className="summary-label">complete</span>
                    </span>
                    <span className="summary-cell">
                      <span className="summary-n summary-n-attention">{attentionCount}</span>
                      <span className="summary-label">need attention</span>
                    </span>
                    <span className="summary-cell">
                      <span className="summary-n">{result.plants.length}</span>
                      <span className="summary-label">plants</span>
                    </span>
                  </div>
                  <div className="legend-row" aria-label="Status legend">
                    <span className="legend-label">Legend</span>
                    <ul className="legend">
                      <li>
                        <span className="legend-key legend-key-pass" aria-hidden="true">✓</span>
                        pass
                      </li>
                      <li>
                        <span className="legend-key legend-key-warn" aria-hidden="true">!</span>
                        warn
                      </li>
                      <li>
                        <span className="legend-key legend-key-fail" aria-hidden="true">✗</span>
                        fail — record kept
                      </li>
                      <li>
                        <span className="legend-key legend-key-missing" aria-hidden="true">✗</span>
                        missing
                      </li>
                    </ul>
                  </div>
                </header>

                {result.plants.length === 0 ? (
                  <EmptyState
                    title="No plants are registered yet."
                    description="Completeness is evaluated per registered plant, so the register must be populated first."
                  />
                ) : (
                  <div className="table-wrap">
                    <table className="data-table verification-table">
                      <thead>
                        <tr>
                          <th scope="col">Specimen</th>
                          <th scope="col">Image evidence</th>
                          <th scope="col">Manual reference</th>
                          <th scope="col">Repetitions</th>
                          <th scope="col">Attempts</th>
                          <th scope="col">Water</th>
                          <th scope="col">Attention</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.plants.map((row) => (
                          <tr key={row.plant_id} className={row.attention.length > 0 ? "row-needs-attention" : undefined}>
                            <td className="cell-specimen">
                              <Link className="id-link" to={`/plants/${row.plant_id}`}>
                                {row.plant_id}
                              </Link>
                              <span className="cell-sub">pot {row.pot_id}</span>
                            </td>
                            <td>
                              {row.image === "present" ? (
                                <span className="verdict verdict-pass">
                                  <span className="verdict-mark" aria-hidden="true">✓</span>
                                  {row.image_count > 1 ? `Present (${row.image_count})` : "Present"}
                                </span>
                              ) : (
                                <span className="verdict verdict-missing">
                                  <span className="verdict-mark" aria-hidden="true">✗</span>
                                  Missing
                                </span>
                              )}
                            </td>
                            <td>
                              {row.manual === "missing" ? (
                                <span className="verdict verdict-missing">
                                  <span className="verdict-mark" aria-hidden="true">✗</span>
                                  Missing
                                </span>
                              ) : (
                                <span className={`verdict verdict-${row.manual}`}>
                                  <span className="verdict-mark" aria-hidden="true">
                                    {row.manual === "pass" ? "✓" : "!"}
                                  </span>
                                  {row.manual.toUpperCase()}
                                </span>
                              )}
                            </td>
                            <td>
                              <span className="repetition-line">
                                <span className={row.manual_repetition_1 ? "rep rep-ok" : "rep rep-missing"}>
                                  <span aria-hidden="true">R1</span>
                                  {row.manual_repetition_1 ? " recorded" : " missing"}
                                </span>
                                <span className={row.manual_repetition_2 ? "rep rep-ok" : "rep rep-missing"}>
                                  <span aria-hidden="true">R2</span>
                                  {row.manual_repetition_2 ? " recorded" : " missing"}
                                </span>
                              </span>
                            </td>
                            <td className="mono-cell">{row.manual_attempts > 0 ? row.manual_attempts : "—"}</td>
                            <td>
                              {row.water === "present" ? (
                                <span className="verdict verdict-pass">
                                  <span className="verdict-mark" aria-hidden="true">✓</span>
                                  Watered
                                </span>
                              ) : (
                                <span className="verdict verdict-missing">
                                  <span className="verdict-mark" aria-hidden="true">✗</span>
                                  Missing
                                </span>
                              )}
                            </td>
                            <td>
                              {row.attention.length === 0 ? (
                                <span className="status-ok verdict-pass-light">None</span>
                              ) : (
                                <ul className="attention-list">
                                  {row.attention.map((a, i) => (
                                    <li key={i}>
                                      <span className="attention-mark" aria-hidden="true">
                                        !
                                      </span>
                                      {a}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="panel traceability-panel" aria-label="Traceability checks">
                <div className="panel-heading">
                  <h2>Traceability checks</h2>
                  <p>Reference integrity across every persisted record — images, manual and AI/CV measurements.</p>
                </div>
                {result.traceabilityIssues.length === 0 ? (
                  <p className="empty-state-description status-ok">
                    No traceability problems detected across all persisted records (images, manual and AICV measurements).
                  </p>
                ) : (
                  <ul className="attention-list">
                    {result.traceabilityIssues.map((issue, i) => (
                      <li key={i}>
                        <span className="attention-mark" aria-hidden="true">
                          !
                        </span>
                        <span>
                          <strong>
                            {issue.entity} {issue.entity_id}
                          </strong>{" "}
                          — {issue.issue}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </>
      )}
    </section>
  );
}