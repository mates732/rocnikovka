import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { ErrorSummary } from "../components/ErrorSummary";
import { services } from "../data/adapters";
import type { ImageService, MeasurementService, PlantService, WaterService } from "../services/interfaces";
import type { AICVMeasurement, ImageRecord, ManualMeasurement, Plant, WaterEvent } from "../types/entities";
import { computeCompleteness, type PlantDayCompleteness, type VerificationResult } from "./ExperimentVerificationPage";

type DailyLabLogDeps = {
  plantService: Pick<PlantService, "listPlants">;
  imageService: Pick<ImageService, "listImages">;
  measurementService: Pick<MeasurementService, "listManualMeasurements" | "listAICVMeasurements">;
  waterService: Pick<WaterService, "listWaterEvents">;
};

type DailyLabLogProps = { services?: DailyLabLogDeps };

const PROTOCOL_GROUPS = ["G1", "G2", "G3"] as const;

/** Renders a three-way presence state: recorded / genuinely missing / not applicable. */
function PresenceCell({ state, count }: { state: "present" | "missing" | "not_applicable"; count?: number }) {
  if (state === "present") {
    return (
      <span className="verdict verdict-pass">
        <span className="verdict-mark" aria-hidden="true">✓</span>
        {count !== undefined && count > 1 ? `Present (${count})` : "Present"}
      </span>
    );
  }
  if (state === "not_applicable") {
    return (
      <span className="verdict verdict-na" title="Není vyžadováno — rostlina dosud nevzešla nebo květináč neklíčil">
        <span className="verdict-mark" aria-hidden="true">–</span>
        Není vyžadováno
      </span>
    );
  }
  return (
    <span className="verdict verdict-missing">
      <span className="verdict-mark" aria-hidden="true">✗</span>
      Missing
    </span>
  );
}

export default function DailyLabLogPage({ services: deps = services }: DailyLabLogProps = {}) {
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

  const result = useMemo<VerificationResult | null>(
    () => (validDay ? computeCompleteness(plants, images, manual, water, aicv, dayNumber as number) : null),
    [validDay, dayNumber, plants, images, manual, water, aicv]
  );

  const groupedPlants = useMemo(() => {
    if (!result) return {};
    const groups: Record<string, PlantDayCompleteness[]> = {};
    for (const plant of result.plants) {
      const group = plants.find((p) => p.plant_id === plant.plant_id)?.group_name ?? "G0";
      if (!groups[group]) groups[group] = [];
      groups[group].push(plant);
    }
    return groups;
  }, [result, plants]);

  const handleDayChange = useCallback((newDay: string) => {
    if (newDay.trim() === "" || (Number.isInteger(Number(newDay)) && Number(newDay) >= 1)) {
      setDay(newDay);
    }
  }, []);

  const goToPreviousDay = useCallback(() => {
    if (dayNumber !== null && dayNumber > 1) {
      setDay(String(dayNumber - 1));
    }
  }, [dayNumber]);

  const goToNextDay = useCallback(() => {
    if (dayNumber !== null) {
      setDay(String(dayNumber + 1));
    }
  }, [dayNumber]);

  const getQuickActionLinks = (plantId: string, expDay: number) => {
    const hasImage = images.some((img) => img.plant_id === plantId && img.experiment_day === expDay);
    const hasManual = manual.some((m) => m.plant_id === plantId && m.experiment_day === expDay);
    const hasWater = water.some((w) => w.plant_id === plantId && w.experiment_day === expDay);
    return { hasImage, hasManual, hasWater };
  };

  if (loading) {
    return (
      <section className="page" aria-labelledby="daily-log-title">
        <PageHeader eyebrow="Daily records" title="Daily Lab Log" titleId="daily-log-title" />
        <div className="panel"><EmptyState title="Loading records" description="Fetching plants, images and measurements from the backend..." /></div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="page" aria-labelledby="daily-log-title">
        <PageHeader eyebrow="Daily records" title="Daily Lab Log" titleId="daily-log-title" />
        <div className="panel">
          <p className="empty-state-title">Unable to load daily log</p>
          <ErrorSummary error={error} fallbackMessage="Failed to load records for the daily log" />
        </div>
      </section>
    );
  }

  return (
    <section className="page" aria-labelledby="daily-log-title">
      <PageHeader
        eyebrow="Daily records"
        title="Daily Lab Log"
        description="Select an experiment day to see what needs recording. Quick actions link directly to the relevant forms."
        titleId="daily-log-title"
      />

      <section className="panel day-selector-panel" aria-label="Experiment day selection">
        <div className="day-selector">
          <label className="form-field day-selector-field" htmlFor="daily-log-day">
            <span className="overline">Experiment day</span>
            <div className="day-selector-input-with-nav">
              <button
                type="button"
                className="day-nav-btn"
                onClick={goToPreviousDay}
                disabled={dayNumber === null || dayNumber <= 1}
                aria-label="Previous day"
              >
                ←
              </button>
              <input
                id="daily-log-day"
                type="number"
                min={1}
                step={1}
                value={day}
                onChange={(e) => handleDayChange(e.target.value)}
                placeholder="7"
                aria-describedby="daily-log-day-hint"
              />
              <button
                type="button"
                className="day-nav-btn"
                onClick={goToNextDay}
                disabled={dayNumber === null}
                aria-label="Next day"
              >
                →
              </button>
            </div>
          </label>
          <div className="day-selector-guide">
            <p id="daily-log-day-hint" className="form-hint">
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
            description="Enter an experiment day above to see what needs recording for that day."
          />
        </div>
      ) : result.plants.length === 0 ? (
        <div className="panel">
          <EmptyState
            title="No plants registered yet."
            description="Register plants first, then select an experiment day to see the daily log."
          >
            <Link className="btn btn-primary" to="/plants">Register plants</Link>
          </EmptyState>
        </div>
      ) : (
        <>
          <section className="daily-log-summary" aria-label="Daily completeness summary">
            <div className="summary-header">
              <h2>Experiment day {dayNumber}</h2>
              <div className="summary-stats">
                <span className="summary-cell"><span className="summary-n">{result.plants.filter((p) => p.attention.length === 0).length}</span><span className="summary-label">complete</span></span>
                <span className="summary-cell"><span className="summary-n summary-n-attention">{result.plants.filter((p) => p.attention.length > 0).length}</span><span className="summary-label">need attention</span></span>
                <span className="summary-cell"><span className="summary-n">{result.plants.length}</span><span className="summary-label">plants</span></span>
              </div>
            </div>
          </section>

          {PROTOCOL_GROUPS.map((group) => {
            const groupPlants = groupedPlants[group] ?? [];
            if (groupPlants.length === 0) return null;

            const groupAttention = groupPlants.filter((p) => p.attention.length > 0).length;
            const groupComplete = groupPlants.length - groupAttention;

            return (
              <section key={group} className="panel daily-log-group" aria-labelledby={`group-${group}-heading`}>
                <div className="panel-heading">
                  <h2 id={`group-${group}-heading`}>
                    Group {group}
                    <StatusBadge status={groupAttention === 0 ? "PASS" : "WARN"} />
                  </h2>
                  <p>{groupComplete} complete · {groupAttention} need attention · {groupPlants.length} plants</p>
                </div>
                <div className="table-wrap">
                  <table className="data-table daily-log-table">
                    <thead>
                      <tr>
                        <th scope="col">Specimen</th>
                        <th scope="col">Image</th>
                        <th scope="col">Manual</th>
                        <th scope="col">Reps</th>
                        <th scope="col">Water</th>
                        <th scope="col">Attention</th>
                        <th scope="col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupPlants.map((row) => {
                        const quickActions = getQuickActionLinks(row.plant_id, dayNumber as number);
                        return (
                          <tr key={row.plant_id} className={row.attention.length > 0 ? "row-needs-attention" : undefined}>
                            <td className="cell-specimen">
                              <Link className="id-link" to={`/plants/${row.plant_id}`}>
                                {row.plant_id}
                              </Link>
                              <span className="cell-sub">pot {row.pot_id}</span>
                              {row.expectation !== "expected" && (
                                <span className={`expectation-badge expectation-${row.expectation}`}>
                                  {row.expectation === "not_emerged" && "dosud nevzešlo"}
                                  {row.expectation === "failed" && "neklíčilo"}
                                  {row.expectation === "unknown" && "stav emergence neznámý"}
                                </span>
                              )}
                            </td>
                            <td>
                              <PresenceCell state={row.image} count={row.image_count} />
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
                            <td>
                              <PresenceCell state={row.water} />
                            </td>
                            <td>
                              {row.attention.length === 0 ? (
                                <span className="status-ok verdict-pass-light">None</span>
                              ) : (
                                <ul className="attention-list">
                                  {row.attention.map((a, i) => (
                                    <li key={i}>
                                      <span className="attention-mark" aria-hidden="true">!</span>
                                      {a}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                            <td>
                              <div className="quick-actions">
                                <Link
                                  className={`quick-action-btn ${quickActions.hasImage ? "done" : ""}`}
                                  to={`/images?plant=${row.plant_id}&day=${dayNumber}`}
                                  title={quickActions.hasImage ? "Image recorded — view or add another" : "Register image for this plant and day"}
                                >
                                  📷
                                </Link>
                                <Link
                                  className={`quick-action-btn ${quickActions.hasManual ? "done" : ""}`}
                                  to={`/measurements?plant=${row.plant_id}&day=${dayNumber}`}
                                  title={quickActions.hasManual ? "Manual measurement recorded — view or add another" : "Log manual measurement for this plant and day"}
                                >
                                  📏
                                </Link>
                                <Link
                                  className={`quick-action-btn ${quickActions.hasWater ? "done" : ""}`}
                                  to={`/experiment/water?plant=${row.plant_id}&day=${dayNumber}`}
                                  title={quickActions.hasWater ? "Watering recorded — view or add another" : "Log watering for this plant and day"}
                                >
                                  💧
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}

          {result.traceabilityIssues.length > 0 && (
            <section className="panel traceability-panel" aria-label="Traceability checks">
              <div className="panel-heading">
                <h2>Traceability checks</h2>
                <p>Reference integrity across every persisted record — images, manual and AI/CV measurements.</p>
              </div>
              <ul className="attention-list">
                {result.traceabilityIssues.map((issue, i) => (
                  <li key={i}>
                    <span className="attention-mark" aria-hidden="true">!</span>
                    <span>
                      <strong>{issue.entity} {issue.entity_id}</strong> — {issue.issue}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </section>
  );
}