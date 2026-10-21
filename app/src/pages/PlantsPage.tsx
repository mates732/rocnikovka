import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { DetailPanel } from "../components/DetailPanel";
import { EmptyState } from "../components/EmptyState";
import { ErrorSummary } from "../components/ErrorSummary";
import { PageHeader } from "../components/PageHeader";
import { services } from "../data/adapters";
import { normalizeTimestampToSeconds } from "./ExperimentPages";
import type { ImageService, MeasurementService, PlantService, PositionService, WaterService } from "../services/interfaces";
import type { AICVMeasurement, Group, ImageRecord, ManualMeasurement, Plant, PlantStatus, PositionEvent, WaterEvent } from "../types/entities";
import type { CreatePlantInput } from "../types/write";

const headers = ["Specimen", "Group", "Exemplar", "Pot", "Status", "Emergence date"];

/** Plant status is rendered as text + mark (never color alone). */
const PLANT_STATUS_LABELS: Record<PlantStatus, string> = {
  active: "Active",
  damaged: "Damaged",
  dead: "Dead",
  excluded: "Excluded",
};

const PLANT_STATUS_MARKS: Record<PlantStatus, string> = {
  active: "●",
  damaged: "!",
  dead: "×",
  excluded: "–",
};

function registrationDate(plant: Plant): string {
  return plant.created_at ? plant.created_at.slice(0, 10) : "—";
}

function scientificLabel(plant: Plant): string {
  return `${plant.group_name} · ${plant.exemplar_id}`;
}

export async function loadPlants() {
  return services.plantService.listPlants();
}

// ============================================================================
// Plant registration (Phase 4K.7)
// ----------------------------------------------------------------------------
// The smallest production-quality plant registration workflow. Plant identity
// is foundational for traceability, so the form mirrors the exact backend
// contract (PLT-XXX / POT-XXX / G0|G1|G2 / status enum / ISO date / explicit
// created_at). Nothing is invented or derived — emergence date and created_at
// are explicitly entered, and no randomization is performed here (group
// assignment belongs to the existing experimental workflow).
// ============================================================================

const TIMESTAMP_SECOND_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PLANT_ID_RE = /^PLT-\d{3}$/;
const POT_ID_RE = /^POT-\d{3}$/;
const GROUPS: Group[] = ["G1", "G2", "G3"];
const PLANT_STATUSES: PlantStatus[] = ["active", "damaged", "dead", "excluded"];

export type PlantFormValues = {
  plant_id: string;
  pot_id: string;
  group_name: "" | Group;
  exemplar_id: string;
  treatment_percentage: number;
  emergence_date: string; // YYYY-MM-DD
  status: "" | PlantStatus;
  created_at: string; // datetime-local value YYYY-MM-DDTHH:MM
  notes: string;
};

export type PlantFormIssue = { field: string; code: string; message: string };

export function emptyPlantFormValues(): PlantFormValues {
  return {
    plant_id: "",
    pot_id: "",
    group_name: "",
    exemplar_id: "",
    treatment_percentage: 0,
    emergence_date: "",
    status: "",
    created_at: "",
    notes: "",
  };
}

const EXEMPLAR_ID_RE = /^EX(0[1-9])$/;
const TREATMENT_PERCENTAGES = [100, 85, 70] as const;

export function validatePlantForm(values: PlantFormValues, usedPotIds?: Set<string>): PlantFormIssue[] {
  const issues: PlantFormIssue[] = [];
  const add = (field: string, code: string, message: string) => issues.push({ field, code, message });

  const plantId = values.plant_id.trim();
  if (plantId === "") {
    add("plant_id", "required", "Plant ID is required.");
  } else if (!PLANT_ID_RE.test(plantId)) {
    add("plant_id", "id.invalid_format", "Plant ID must match PLT-XXX (three digits).");
  }

  const potId = values.pot_id.trim();
  if (potId === "") {
    add("pot_id", "required", "Pot ID is required.");
  } else if (!POT_ID_RE.test(potId)) {
    add("pot_id", "id.invalid_format", "Pot ID must match POT-XXX (three digits).");
  } else if (usedPotIds && usedPotIds.has(potId)) {
    add("pot_id", "id.duplicate", "This pot ID is already assigned to another plant.");
  }

  if (!values.group_name) {
    add("group_name", "required", "Select a group.");
  } else if (!GROUPS.includes(values.group_name)) {
    add("group_name", "enum.invalid", "Group must be G1, G2 or G3.");
  }

  const exemplarId = values.exemplar_id.trim();
  if (exemplarId === "") {
    add("exemplar_id", "required", "Exemplar ID is required.");
  } else if (!EXEMPLAR_ID_RE.test(exemplarId)) {
    add("exemplar_id", "id.invalid_format", "Exemplar ID must match EX01..EX09.");
  }

  const treatmentPct = Number(values.treatment_percentage);
  if (Number.isNaN(treatmentPct) || treatmentPct === 0) {
    add("treatment_percentage", "required", "Treatment percentage is required.");
  } else if (!TREATMENT_PERCENTAGES.includes(treatmentPct as 100 | 85 | 70)) {
    add("treatment_percentage", "enum.invalid", "Treatment percentage must be 100, 85, or 70.");
  }

  const emergenceDate = values.emergence_date.trim();
  if (emergenceDate === "") {
    add("emergence_date", "required", "Emergence date is required.");
  } else if (!ISO_DATE_RE.test(emergenceDate) || Number.isNaN(Date.parse(emergenceDate))) {
    add("emergence_date", "date.invalid", "Emergence date must be a real calendar date (YYYY-MM-DD).");
  }

  if (!values.status) {
    add("status", "required", "Select a status.");
  } else if (!PLANT_STATUSES.includes(values.status)) {
    add("status", "enum.invalid", "Status must be active, damaged, dead or excluded.");
  }

  if (values.created_at.trim() === "") {
    add("created_at", "required", "Registration time is required.");
  } else if (!TIMESTAMP_SECOND_RE.test(normalizeTimestampToSeconds(values.created_at.trim()))) {
    add("created_at", "timestamp.invalid_format", "Registration time must look like YYYY-MM-DDTHH:MM.");
  }

  return issues;
}

/** Build the exact POST /api/plants payload — only supported CreatePlantInput fields. */
export function buildPlantInput(values: PlantFormValues): CreatePlantInput {
  const input: CreatePlantInput = {
    plant_id: values.plant_id.trim(),
    pot_id: values.pot_id.trim(),
    group_name: values.group_name as Group,
    exemplar_id: values.exemplar_id.trim(),
    treatment_percentage: values.treatment_percentage as 100 | 85 | 70,
    emergence_date: values.emergence_date.trim(),
    status: values.status as PlantStatus,
    created_at: normalizeTimestampToSeconds(values.created_at.trim()),
  };
  const notes = values.notes.trim();
  if (notes) input.notes = notes;
  return input;
}

type PlantRegistrationFormProps = {
  createPlant: (input: CreatePlantInput) => Promise<Plant>;
  onCreated: (created: Plant) => void;
  existingPlants: Plant[];
};

export function PlantRegistrationForm({ createPlant, onCreated, existingPlants }: PlantRegistrationFormProps) {
  const [values, setValues] = useState<PlantFormValues>(emptyPlantFormValues);
  const [localIssues, setLocalIssues] = useState<PlantFormIssue[]>([]);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const groupCounts = useMemo(() => {
    const counts: Record<Group, number> = { G1: 0, G2: 0, G3: 0 };
    for (const p of existingPlants) {
      if (counts[p.group_name] !== undefined) counts[p.group_name]++;
    }
    return counts;
  }, [existingPlants]);

  const usedPotIds = useMemo(() => new Set(existingPlants.map((p) => p.pot_id)), [existingPlants]);

  const handleFieldChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }) as PlantFormValues);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const local = validatePlantForm(values, usedPotIds);
    setLocalIssues(local);
    if (local.length > 0) return;

    const input = buildPlantInput(values);

    setSubmitting(true);
    setSubmitError(null);
    setSuccessId(null);
    try {
      const created = await createPlant(input);
      setSuccessId(created.plant_id);
      setValues(emptyPlantFormValues());
      onCreated(created);
    } catch (err) {
      setSubmitError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const issuesFor = (field: string) => localIssues.filter((issue) => issue.field === field);
  const renderIssues = (field: string) =>
    issuesFor(field).length > 0 ? (
      <ul className="field-issues">
        {issuesFor(field).map((issue, index) => (
          <li key={`${field}-${index}`}>{issue.message}</li>
        ))}
      </ul>
    ) : null;

  return (
    <form className="record-form" onSubmit={handleSubmit} noValidate>
      <div className="form-grid">
        <label className="form-field" htmlFor="plant-plant-id">
          <span className="form-label">
            Plant ID <span className="form-required" aria-hidden="true">*</span>
          </span>
          <input
            id="plant-plant-id"
            type="text"
            name="plant_id"
            placeholder="PLT-001"
            value={values.plant_id}
            onChange={handleFieldChange}
            disabled={submitting}
          />
          <span className="form-hint">Immutable after creation; format PLT-XXX.</span>
          {renderIssues("plant_id")}
        </label>

        <label className="form-field" htmlFor="plant-pot-id">
          <span className="form-label">
            Pot ID <span className="form-required" aria-hidden="true">*</span>
          </span>
          <input
            id="plant-pot-id"
            type="text"
            name="pot_id"
            placeholder="POT-001"
            value={values.pot_id}
            onChange={handleFieldChange}
            disabled={submitting}
          />
          <span className="form-hint">Immutable after creation; format POT-XXX.</span>
          {renderIssues("pot_id")}
        </label>

        <label className="form-field" htmlFor="plant-group">
          <span className="form-label">
            Group <span className="form-required" aria-hidden="true">*</span>
          </span>
          <select id="plant-group" name="group_name" value={values.group_name} onChange={handleFieldChange} disabled={submitting}>
            <option value="">Select a group</option>
            {GROUPS.map((group) => (
              <option key={group} value={group}>
                {group} ({groupCounts[group] ?? 0} registered)
              </option>
            ))}
          </select>
          <span className="form-hint">G1 = 100% water target, G2 = 85%, G3 = 70%. Assignment follows randomization protocol.</span>
          {renderIssues("group_name")}
        </label>

        <label className="form-field" htmlFor="plant-exemplar-id">
          <span className="form-label">
            Exemplar ID <span className="form-required" aria-hidden="true">*</span>
          </span>
          <input
            id="plant-exemplar-id"
            type="text"
            name="exemplar_id"
            placeholder="EX01"
            value={values.exemplar_id}
            onChange={handleFieldChange}
            disabled={submitting}
          />
          <span className="form-hint">Immutable after creation; format EX01..EX09.</span>
          {renderIssues("exemplar_id")}
        </label>

        <label className="form-field" htmlFor="plant-treatment-percentage">
          <span className="form-label">
            Treatment % <span className="form-required" aria-hidden="true">*</span>
          </span>
          <select id="plant-treatment-percentage" name="treatment_percentage" value={values.treatment_percentage} onChange={handleFieldChange} disabled={submitting}>
            <option value={0}>Select treatment percentage</option>
            <option value={100}>100% (G1)</option>
            <option value={85}>85% (G2)</option>
            <option value={70}>70% (G3)</option>
          </select>
          <span className="form-hint">Protocol v1: G1=100%, G2=85%, G3=70%.</span>
          {renderIssues("treatment_percentage")}
        </label>

        <label className="form-field" htmlFor="plant-emergence-date">
          <span className="form-label">
            Emergence date <span className="form-required" aria-hidden="true">*</span>
          </span>
          <input
            id="plant-emergence-date"
            type="date"
            name="emergence_date"
            value={values.emergence_date}
            onChange={handleFieldChange}
            disabled={submitting}
          />
          <span className="form-hint">Day 1 of this plant's experiment timeline. Explicitly entered; never derived from today's date or registration time.</span>
          {renderIssues("emergence_date")}
        </label>

        <label className="form-field" htmlFor="plant-status">
          <span className="form-label">
            Status <span className="form-required" aria-hidden="true">*</span>
          </span>
          <select id="plant-status" name="status" value={values.status} onChange={handleFieldChange} disabled={submitting}>
            <option value="">Select a status</option>
            {PLANT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
          {renderIssues("status")}
        </label>

        <label className="form-field" htmlFor="plant-created-at">
          <span className="form-label">
            Registration time <span className="form-required" aria-hidden="true">*</span>
          </span>
          <input
            id="plant-created-at"
            type="datetime-local"
            name="created_at"
            value={values.created_at}
            onChange={handleFieldChange}
            disabled={submitting}
          />
          <span className="form-hint">Explicitly entered; required by the backend contract.</span>
          {renderIssues("created_at")}
        </label>

        <label className="form-field span-2" htmlFor="plant-notes">
          <span className="form-label">Notes</span>
          <textarea id="plant-notes" name="notes" value={values.notes} onChange={handleFieldChange} disabled={submitting} />
          {renderIssues("notes")}
        </label>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Saving plant…" : "Register plant"}
        </button>
        <span className="form-hint">Required fields are marked with *.</span>
      </div>
      {successId ? (
        <p className="form-success" role="status">
          Plant {successId} registered.
        </p>
      ) : null}
      <ErrorSummary error={submitError} fallbackMessage="The plant could not be registered." />
    </form>
  );
}

type PlantsPageDeps = {
  plantService: Pick<PlantService, "listPlants" | "createPlant">;
};

type PlantsPageProps = { services?: PlantsPageDeps };

export function PlantsPage({ services: deps = services }: PlantsPageProps = {}) {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await deps.plantService.listPlants();
        if (!cancelled) setPlants(data);
      } catch (err) {
        if (!cancelled) {
          setError(err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deps]);

  const handleCreated = (created: Plant) => {
    // Read-after-write: refresh from the backend so the list reflects the
    // persisted row (the backend response is the only truth used elsewhere).
    void deps.plantService
      .listPlants()
      .then((data) => setPlants(data))
      .catch((err) => setError(err));
  };

  return (
    <section className="page" aria-labelledby="plants-title">
      <PageHeader
        eyebrow="Collection"
        title="Plants"
        description="Registered specimens of the experiment — each plant has a persistent identity, a pot and an assigned group."
        titleId="plants-title"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setFormOpen((open) => !open)}
            aria-expanded={formOpen}
          >
            {formOpen ? "Close form" : "Register plant"}
          </button>
        }
      />
      {formOpen ? (
        <section className="panel form-panel" aria-label="Register a plant">
          <div className="panel-heading">
            <h2>Register plant</h2>
            <p>Identity is created before any measurement is recorded.</p>
          </div>
          <PlantRegistrationForm
            createPlant={(input) => deps.plantService.createPlant(input)}
            onCreated={handleCreated}
            existingPlants={plants}
          />
        </section>
      ) : null}

      {loading ? (
        <div className="panel">
          <EmptyState title="Loading plants" description="Fetching plant records from the backend..." />
        </div>
      ) : error ? (
        <div className="panel">
          <p className="empty-state-title">Unable to load plants</p>
          <ErrorSummary error={error} fallbackMessage="Failed to load plants from the backend" />
        </div>
      ) : (
        <DataTable
          caption="Specimen register"
          headers={headers}
          empty={plants.length === 0}
          emptyMessage="No plants registered yet. Use 'Register plant' to add the first plant."
        >
          {plants.map((plant) => (
            <tr key={plant.plant_id}>
              <td className="cell-specimen">
                <Link className="id-link" to={`/plants/${plant.plant_id}`}>
                  {plant.plant_id}
                </Link>
                <span className="cell-sub">registered {registrationDate(plant)}</span>
              </td>
              <td>
                <span className={`chip chip-group chip-group-${plant.group_name}`}>{plant.group_name}</span>
              </td>
              <td className="mono-cell">{plant.exemplar_id}</td>
              <td className="mono-cell">{plant.pot_id}</td>
              <td>
                <span className={`plant-status plant-status-${plant.status}`}>
                  <span className="plant-status-mark" aria-hidden="true">
                    {PLANT_STATUS_MARKS[plant.status]}
                  </span>
                  {plant.status}
                </span>
              </td>
              <td>{plant.emergence_date}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </section>
  );
}

type PlantTimelineEntry = {
  day: number;
  images: ImageRecord[];
  manual: ManualMeasurement[];
  water: WaterEvent[];
  position: PositionEvent[];
  aicv: AICVMeasurement[];
};

export function buildPlantTimeline(records: {
  images: ImageRecord[];
  manual: ManualMeasurement[];
  water: WaterEvent[];
  position: PositionEvent[];
  aicv: AICVMeasurement[];
  plantId: string;
}): PlantTimelineEntry[] {
  const byDay = new Map<number, PlantTimelineEntry>();
  const getDay = (day: number): PlantTimelineEntry => {
    let entry = byDay.get(day);
    if (!entry) {
      entry = { day, images: [], manual: [], water: [], position: [], aicv: [] };
      byDay.set(day, entry);
    }
    return entry;
  };

  for (const img of records.images) {
    if (img.plant_id === records.plantId) getDay(img.experiment_day).images.push(img);
  }
  for (const m of records.manual) {
    if (m.plant_id === records.plantId) getDay(m.experiment_day).manual.push(m);
  }
  for (const w of records.water) {
    if (w.plant_id === records.plantId) getDay(w.experiment_day).water.push(w);
  }
  // Position events intentionally carry no experiment_day. They are shown in
  // the timeline as contextual history only: a position event is attached to
  // the day bucket whose recorded records share its calendar date, falling
  // back to the latest bucket (or a contextual bucket 0 when the plant has no
  // day-carrying records at all). They are never treated as a day source.
  for (const p of records.position) {
    if (p.plant_id !== records.plantId) continue;
    const date = p.timestamp.slice(0, 10);
    const entries = [...byDay.values()].sort((a, b) => a.day - b.day);
    const sameDate = entries.find(
      (e) =>
        e.images.some((i) => i.timestamp.slice(0, 10) === date) ||
        e.manual.some((m) => m.timestamp.slice(0, 10) === date) ||
        e.water.some((w) => w.timestamp.slice(0, 10) === date)
    );
    const target = sameDate ?? entries[entries.length - 1];
    if (target) {
      target.position.push(p);
    } else {
      getDay(0).position.push(p);
    }
  }
  for (const a of records.aicv) {
    if (a.plant_id === records.plantId) getDay(a.experiment_day).aicv.push(a);
  }

  return [...byDay.values()].sort((a, b) => a.day - b.day);
}

type PlantDetailPageDeps = {
  plantService: Pick<PlantService, "getPlantById">;
  imageService: Pick<ImageService, "listImages">;
  measurementService: Pick<MeasurementService, "listManualMeasurements" | "listAICVMeasurements">;
  waterService: Pick<WaterService, "listWaterEvents">;
  positionService: Pick<PositionService, "listPositionEvents">;
};

type PlantDetailPageProps = { services?: PlantDetailPageDeps };

export function PlantDetailPage({ services: deps = services }: PlantDetailPageProps = {}) {
  const { plantId } = useParams();
  const [plant, setPlant] = useState<Plant | null>(null);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [manual, setManual] = useState<ManualMeasurement[]>([]);
  const [water, setWater] = useState<WaterEvent[]>([]);
  const [position, setPosition] = useState<PositionEvent[]>([]);
  const [aicv, setAicv] = useState<AICVMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [recordsError, setRecordsError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    setRecordsError(null);

    (async () => {
      if (!plantId) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const data = await deps.plantService.getPlantById(plantId);
        if (!cancelled) setPlant(data);
      } catch (err) {
        if (!cancelled) {
          setError(err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }

      try {
        const [imgData, manData, watData, posData, aicvData] = await Promise.all([
          deps.imageService.listImages(),
          deps.measurementService.listManualMeasurements(),
          deps.waterService.listWaterEvents(),
          deps.positionService.listPositionEvents(),
          deps.measurementService.listAICVMeasurements(),
        ]);
        if (!cancelled) {
          setImages(imgData);
          setManual(manData);
          setWater(watData);
          setPosition(posData);
          setAicv(aicvData);
        }
      } catch (err) {
        if (!cancelled) setRecordsError(err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deps, plantId]);

  const timeline = useMemo(
    () =>
      plantId
        ? buildPlantTimeline({ images, manual, water, position, aicv, plantId })
        : [],
    [images, manual, water, position, aicv, plantId]
  );

  const totals = useMemo(() => {
    let imageCount = 0;
    let manualCount = 0;
    let waterCount = 0;
    let positionCount = 0;
    let aicvCount = 0;
    for (const entry of timeline) {
      imageCount += entry.images.length;
      manualCount += entry.manual.length;
      waterCount += entry.water.length;
      positionCount += entry.position.length;
      aicvCount += entry.aicv.length;
    }
    return { imageCount, manualCount, waterCount, positionCount, aicvCount };
  }, [timeline]);

  const subtitle = plant
    ? `${PLANT_STATUS_LABELS[plant.status]} specimen · ${scientificLabel(plant)} · pot ${plant.pot_id}`
    : "Specimen record";

  return (
    <section className="page" aria-labelledby="plant-detail-title">
      {loading ? (
        <div className="panel">
          <EmptyState title="Loading plant" description="Fetching plant record from the backend..." />
        </div>
      ) : error ? (
        <div className="panel">
          <p className="empty-state-title">Unable to load plant</p>
          <ErrorSummary error={error} fallbackMessage="Failed to load plant from the backend" />
        </div>
      ) : plant ? (
        <>
          <PageHeader
            eyebrow="Specimen"
            title={scientificLabel(plant)}
            description={subtitle}
            titleId="plant-detail-title"
            actions={
              <Link className="btn btn-ghost" to="/plants">
                ← All plants
              </Link>
            }
          />

          <div className="specimen-plate" aria-label={`Registered metadata for ${plant.plant_id}`}>
            <span className="specimen-plate-item">
              <span className="specimen-plate-label">Scientific ID</span>
              <span className="mono-cell">{scientificLabel(plant)}</span>
            </span>
            <span className="specimen-plate-item">
              <span className="specimen-plate-label">Treatment</span>
              <span>{plant.treatment_percentage}%</span>
            </span>
            <span className="specimen-plate-item">
              <span className="specimen-plate-label">Group</span>
              <span className={`chip chip-group chip-group-${plant.group_name}`}>{plant.group_name}</span>
            </span>
            <span className="specimen-plate-item">
              <span className="specimen-plate-label">Exemplar</span>
              <span className="mono-cell">{plant.exemplar_id}</span>
            </span>
            <span className="specimen-plate-item">
              <span className="specimen-plate-label">Pot</span>
              <span className="mono-cell">{plant.pot_id}</span>
            </span>
            <span className="specimen-plate-item">
              <span className="specimen-plate-label">Internal ID</span>
              <span className="mono-cell">{plant.plant_id}</span>
            </span>
            <span className="specimen-plate-item">
              <span className="specimen-plate-label">Emerged</span>
              <span>{plant.emergence_date}</span>
            </span>
            <span className="specimen-plate-item">
              <span className="specimen-plate-label">Registered</span>
              <span>{registrationDate(plant)}</span>
            </span>
          </div>

          <div className="record-tally" aria-label={`Persisted records for ${plant.plant_id}`}>
            <span className="record-tally-item">
              <span className="record-tally-n">{totals.imageCount}</span>
              <span className="record-tally-label">photographs</span>
            </span>
            <span className="record-tally-item">
              <span className="record-tally-n">{totals.manualCount}</span>
              <span className="record-tally-label">manual reference</span>
            </span>
            <span className="record-tally-item">
              <span className="record-tally-n">{totals.waterCount}</span>
              <span className="record-tally-label">water events</span>
            </span>
            <span className="record-tally-item">
              <span className="record-tally-n">{totals.positionCount}</span>
              <span className="record-tally-label">position events</span>
            </span>
            <span className="record-tally-item">
              <span className="record-tally-n">{totals.aicvCount}</span>
              <span className="record-tally-label">AI/CV</span>
            </span>
          </div>

          {plant.notes ? (
            <div className="specimen-notes">
              <span className="overline">Notes</span>
              <p>{plant.notes}</p>
            </div>
          ) : null}

          <section className="timeline-section" aria-label={`Timeline for ${plant.plant_id}`}>
            <div className="section-heading-row">
              <h2 className="section-heading">Timeline</h2>
              <p className="section-heading-note">Persisted observations grouped by experiment day.</p>
            </div>
            {recordsError ? (
              <div className="panel">
                <ErrorSummary
                  error={recordsError}
                  fallbackMessage="Failed to load the plant's historical records (timeline unavailable)"
                />
              </div>
            ) : timeline.length === 0 ? (
              <div className="panel">
                <EmptyState
                  title="No recorded observations for this plant yet."
                  description="Images, manual measurements, water events and AI/CV records will appear here as they are recorded."
                />
              </div>
            ) : (
              <ol className="timeline" aria-label={`Experiment days for ${plant.plant_id}`}>
                {timeline.map((entry) => (
                  <PlantDayTimeline key={entry.day} entry={entry} />
                ))}
              </ol>
            )}
          </section>
        </>
      ) : (
        <DetailPanel
          title="Plant not found."
          status="NOT_RUN"
          metadata={[
            { label: "Requested plant", value: plantId ?? "Unknown" },
            { label: "Data source", value: "Backend returned 404 plant.not_found" },
          ]}
          actions={<Link to="/plants">Back to Plants</Link>}
        />
      )}
    </section>
  );
}

/**
 * One experiment day inside the specimen timeline. Renders only what exists in
 * the persisted records — missing record types stay absent rather than being
 * fabricated. Position events are displayed as context only (no experiment_day).
 */
function PlantDayTimeline({ entry }: { entry: PlantTimelineEntry }) {
  const contextual = entry.day === 0;
  const dateOf =
    entry.images[0]?.timestamp ??
    entry.manual[0]?.timestamp ??
    entry.water[0]?.timestamp ??
    entry.aicv[0]?.timestamp ??
    entry.position[0]?.timestamp;
  const date = dateOf ? dateOf.slice(0, 10) : null;

  const dayCounts = [
    { label: "photos", n: entry.images.length },
    { label: "manual", n: entry.manual.length },
    { label: "water", n: entry.water.length },
    { label: "aicv", n: entry.aicv.length },
    { label: "positions", n: entry.position.length },
  ].filter((count) => count.n > 0);

  return (
    <li className="timeline-day">
      <header className="timeline-day-head">
        <div className="timeline-day-label">
          <p className="overline">{contextual ? "Context" : "Experiment day"}</p>
          <p className="timeline-day-num">{contextual ? "—" : `Day ${entry.day}`}</p>
        </div>
        <div className="timeline-day-aside">
          {date ? <span className="timeline-day-date">{date}</span> : null}
          {contextual ? (
            <span className="timeline-day-note">position events carry no experiment day</span>
          ) : null}
          {dayCounts.length > 0 ? (
            <span className="timeline-day-counts">
              {dayCounts.map((count, index) => (
                <span key={count.label}>
                  {index > 0 ? <span aria-hidden="true">·</span> : null} {count.n} {count.label}
                </span>
              ))}
            </span>
          ) : null}
        </div>
      </header>

      <div className="timeline-day-records">
        {entry.images.length > 0 ? (
          <section className="tl-block" aria-label={`Images on day ${entry.day}`}>
            <h3 className="tl-heading">
              Photographic evidence <span className="tl-count">{entry.images.length}</span>
            </h3>
            <ul className="tl-list">
              {entry.images.map((img) => (
                <li key={img.image_id} className="tl-entry">
                  <Link className="id-link" to={`/images/${img.image_id}`}>
                    {img.image_id}
                  </Link>
                  <span className="tl-meta">
                    <span className={`verdict verdict-${img.image_quality_status.toLowerCase()}`}>
                      {img.image_quality_status}
                    </span>
                    <span>camera {img.camera_id}</span>
                    <span>{img.timestamp}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {entry.manual.length > 0 ? (
          <section className="tl-block" aria-label={`Manual reference on day ${entry.day}`}>
            <h3 className="tl-heading">
              Manual reference <span className="tl-count">{entry.manual.length}</span>
            </h3>
            <ul className="tl-list">
              {entry.manual.map((m) => (
                <li key={m.measurement_id} className="tl-entry">
                  <Link className="id-link" to={`/measurements/${m.measurement_id}`}>
                    {m.measurement_id}
                  </Link>
                  <span className="tl-meta">
                    <span className={`verdict verdict-${m.measurement_status}`}>
                      {m.measurement_status.toUpperCase()}
                    </span>
                    <span>rep {m.repetition}</span>
                    <span>attempt {m.attempt ?? 1}</span>
                    {m.plant_height_cm != null ? <span>{m.plant_height_cm} cm</span> : null}
                    <span>observer {m.observer}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {entry.aicv.length > 0 ? (
          <section className="tl-block" aria-label={`AI/CV measurements on day ${entry.day}`}>
            <h3 className="tl-heading">
              AI/CV measurement <span className="tl-count">{entry.aicv.length}</span>
            </h3>
            <ul className="tl-list">
              {entry.aicv.map((a) => (
                <li key={a.measurement_id} className="tl-entry">
                  <Link className="id-link" to={`/measurements/${a.measurement_id}`}>
                    {a.measurement_id}
                  </Link>
                  <span className="tl-meta">
                    <span>detection {a.detection_status}</span>
                    <span>{a.model} {a.model_version}</span>
                    {a.plant_height_cm != null ? <span>{a.plant_height_cm} cm</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {entry.water.length > 0 ? (
          <section className="tl-block" aria-label={`Water events on day ${entry.day}`}>
            <h3 className="tl-heading">
              Water <span className="tl-count">{entry.water.length}</span>
            </h3>
            <ul className="tl-list">
              {entry.water.map((w) => (
                <li key={w.water_event_id} className="tl-entry">
                  <span className="id-link id-plain">{w.water_event_id}</span>
                  <span className="tl-meta">
                    <span className={`verdict verdict-${w.watering_status}`}>
                      {w.watering_status.toUpperCase()}
                    </span>
                    <span>{w.water_added_ml} ml added</span>
                    <span>{w.timestamp}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {entry.position.length > 0 ? (
          <section className="tl-block" aria-label={`Position context on day ${entry.day}`}>
            <h3 className="tl-heading">
              Position context <span className="tl-count">{entry.position.length}</span>
            </h3>
            <ul className="tl-list">
              {entry.position.map((p) => (
                <li key={p.position_event_id} className="tl-entry">
                  <span className="id-link id-plain">{p.position_event_id}</span>
                  <span className="tl-meta">
                    <span>location {p.location}</span>
                    <span>{p.reason.replace(/_/g, " ")}</span>
                    <span>{p.timestamp}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </li>
  );
}
