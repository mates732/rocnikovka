import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { DetailPanel } from "../components/DetailPanel";
import type { BadgeStatus } from "../components/StatusBadge";
import { ErrorSummary } from "../components/ErrorSummary";
import { ExperimentDayContext } from "../components/ExperimentDayContext";
import { PageHeader } from "../components/PageHeader";
import { useDayContext } from "../hooks/useDayContext";
import { services } from "../data/adapters";
import { normalizeTimestampToSeconds } from "./ExperimentPages";
import type { ImageService, MeasurementService, PlantService } from "../services/interfaces";
import type {
  AICVMeasurement,
  FailureCode,
  ImageRecord,
  ManualMeasurement,
  MeasurementStatus,
  Plant,
  PlantDayContext,
} from "../types/entities";
import type { CreateManualMeasurementInput } from "../types/write";

const manualHeaders = [
  "Measurement ID",
  "Plant ID",
  "Image ID",
  "Timestamp",
  "Experiment day",
  "Repetition",
  "Attempt",
  "Height [cm]",
  "Observer",
  "Status",
  "Failure code",
  "Method",
];

const aicvHeaders = [
  "Measurement ID",
  "Plant ID",
  "Image ID",
  "Timestamp",
  "Model",
  "Model version",
  "Pipeline version",
  "Detection",
  "Segmentation",
  "Calibration",
  "Height [cm]",
  "Projected area [cm²]",
  "Confidence",
  "Failure code",
  "Notes",
];

function renderOptionalLink(value: string | null | undefined, to: (value: string) => string) {
  if (value === null || value === undefined) return "—";
  return <Link to={to(value)}>{value}</Link>;
}

function renderNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return String(value);
}

type MeasurementDetailState =
  | { kind: "manual"; measurement: ManualMeasurement }
  | { kind: "aicv"; measurement: AICVMeasurement };

// ============================================================================
// Manual measurement creation (Phase 4K.6)
// ----------------------------------------------------------------------------
// Thin, backend-authoritative form. Manual measurements are the human
// ground-truth layer, so traceability rules are mirrored locally (G2
// image<->plant, image experiment_day equality, Phase 4G status semantics)
// but the backend remains the authoritative validator. No experimental value
// is ever invented or derived here — experiment_day is explicit, attempt is
// user-entered (retakes allowed, no uniqueness), method is always MANUAL.
// ============================================================================

const TIMESTAMP_SECOND_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
const DECIMAL_RE = /^-?\d+(\.\d+)?$/;
const INTEGER_RE = /^\d+$/;
const MEASUREMENT_STATUSES: MeasurementStatus[] = ["pass", "warn", "fail"];

/** Exactly the backend FAILURE_CODES minus "none" (None is represented by the empty value). */
const REAL_FAILURE_CODES: FailureCode[] = [
  "no_detection",
  "poor_image_quality",
  "occlusion",
  "plant_damaged",
  "plant_dead",
  "calibration_failed",
];
const ALL_FAILURE_CODES: FailureCode[] = [...REAL_FAILURE_CODES, "none"];

export type ManualFormValues = {
  plant_id: string;
  image_id: string; // "" = no image
  timestamp: string; // datetime-local value YYYY-MM-DDTHH:MM
  experiment_day: string;
  repetition: "" | "1" | "2";
  attempt: string;
  plant_height_cm: string;
  observer: string;
  measurement_status: "" | MeasurementStatus;
  failure_code: "" | FailureCode;
  notes: string;
};

export type ManualFormIssue = { field: string; code: string; message: string };

export function emptyManualFormValues(): ManualFormValues {
  return {
    plant_id: "",
    image_id: "",
    timestamp: "",
    experiment_day: "",
    repetition: "",
    attempt: "1",
    plant_height_cm: "",
    observer: "",
    measurement_status: "",
    failure_code: "",
    notes: "",
  };
}

/**
 * Deterministic session-only suffix counter for MSR-MAN ids (analogous to the
 * WTR/POS counters). The backend remains the source of truth for persisted
 * ids; this only reduces same-second collisions inside one UI session and
 * never queries or mutates the database.
 */
let manualIdSuffix = 0;
function nextManualIdSuffix(): string {
  manualIdSuffix = (manualIdSuffix + 1) % 1000;
  return String(manualIdSuffix).padStart(3, "0");
}

/** Generate MSR-MAN-YYYYMMDD-HHMMSS-XXX from a normalized (second-resolution) timestamp. */
export function generateManualMeasurementId(timestampWithSeconds: string): string {
  const compact = timestampWithSeconds.replace(/[-:T]/g, ""); // YYYYMMDDHHMMSS
  return `MSR-MAN-${compact.slice(0, 8)}-${compact.slice(8, 14)}-${nextManualIdSuffix()}`;
}

/**
 * Local UX validation (mirrors Phase 4G semantics + G2 traceability). The
 * backend remains authoritative — these checks only reject obvious errors
 * before POST. `selectedImage` is the ImageRecord the form's image_id resolves
 * to (undefined when no image is selected or the record is unavailable).
 */
export function validateManualForm(values: ManualFormValues, selectedImage?: ImageRecord): ManualFormIssue[] {
  const issues: ManualFormIssue[] = [];
  const add = (field: string, code: string, message: string) => issues.push({ field, code, message });

  if (!values.plant_id) {
    add("plant_id", "required", "Select a plant.");
  }

  const imageId = values.image_id.trim();
  if (imageId) {
    if (!selectedImage) {
      add("image_id", "reference.missing", "The selected image is no longer available; please select it again.");
    } else if (values.plant_id && selectedImage.plant_id !== values.plant_id) {
      add(
        "plant_id",
        "validation.plant_id_mismatch",
        `The selected image belongs to ${selectedImage.plant_id}, not ${values.plant_id}.`
      );
    }
  }

  if (values.timestamp.trim() === "") {
    add("timestamp", "required", "Timestamp is required.");
  } else if (!TIMESTAMP_SECOND_RE.test(normalizeTimestampToSeconds(values.timestamp.trim()))) {
    add("timestamp", "timestamp.invalid_format", "Timestamp must look like YYYY-MM-DDTHH:MM.");
  }

  const day = values.experiment_day.trim();
  if (day === "") {
    add("experiment_day", "required", "Experiment day is required.");
  } else if (!INTEGER_RE.test(day) || Number(day) < 1) {
    add("experiment_day", "number.out_of_range", "Experiment day must be an integer of at least 1.");
  } else if (selectedImage && Number(day) !== selectedImage.experiment_day) {
    add(
      "experiment_day",
      "validation.experiment_day_mismatch",
      `Experiment day ${Number(day)} does not match the selected image's experiment day ${selectedImage.experiment_day}.`
    );
  }

  if (!values.repetition) {
    add("repetition", "required", "Select a repetition (1 or 2).");
  } else if (!["1", "2"].includes(values.repetition)) {
    add("repetition", "enum.invalid", "Repetition must be 1 or 2.");
  }

  const attempt = values.attempt.trim();
  if (attempt === "") {
    add("attempt", "required", "Attempt is required (defaults to 1).");
  } else if (!INTEGER_RE.test(attempt) || Number(attempt) < 1) {
    add("attempt", "number.out_of_range", "Attempt must be an integer of at least 1.");
  }

  const status = values.measurement_status;
  if (!status) {
    add("measurement_status", "required", "Select a measurement status.");
  } else if (!MEASUREMENT_STATUSES.includes(status)) {
    add("measurement_status", "enum.invalid", "Measurement status must be pass, warn or fail.");
  }

  const height = values.plant_height_cm.trim();
  if (status === "pass" && height === "") {
    add("plant_height_cm", "validation.height_required_for_pass", "A 'pass' measurement requires a plant height greater than 0.");
  } else if (height !== "") {
    const heightCode = (() => {
      if (!DECIMAL_RE.test(height)) return "number.invalid_format";
      const parsed = Number(height);
      if (!Number.isFinite(parsed) || parsed <= 0) return "number.out_of_range";
      return null;
    })();
    if (heightCode) add("plant_height_cm", heightCode, "Plant height must be a finite number greater than 0.");
  }

  if (values.observer.trim() === "") {
    add("observer", "required", "Observer is required.");
  }

  const failureCode = values.failure_code;
  if (status === "pass" && failureCode && failureCode !== "none") {
    add("failure_code", "validation.failure_code_invalid_for_pass", "A 'pass' measurement cannot carry a real failure code.");
  }
  if (status === "fail") {
    if (!failureCode) {
      add("failure_code", "validation.failure_code_required_for_fail", "A 'fail' measurement requires a real failure code.");
    } else if (failureCode === "none") {
      add(
        "failure_code",
        "validation.failure_code_none_invalid_for_fail",
        "A 'fail' measurement requires a real failure code, not 'none'."
      );
    }
  }
  if (failureCode && !ALL_FAILURE_CODES.includes(failureCode)) {
    add("failure_code", "enum.invalid", "Unknown failure code.");
  }

  return issues;
}

/** Build the exact Phase 4J request payload — only known API fields, never a persisted entity spread. */
export function buildManualMeasurementInput(
  values: ManualFormValues,
  measurement_id: string
): CreateManualMeasurementInput {
  const timestamp = normalizeTimestampToSeconds(values.timestamp.trim());
  const input: CreateManualMeasurementInput = {
    measurement_id,
    plant_id: values.plant_id,
    timestamp,
    experiment_day: Number(values.experiment_day),
    repetition: Number(values.repetition) as 1 | 2,
    attempt: Number(values.attempt),
    observer: values.observer.trim(),
    measurement_status: values.measurement_status as MeasurementStatus,
    method: "MANUAL",
  };
  const imageId = values.image_id.trim();
  if (imageId) input.image_id = imageId;
  const height = values.plant_height_cm.trim();
  if (height) input.plant_height_cm = Number(height);
  const failureCode = values.failure_code;
  if (failureCode) input.failure_code = failureCode as FailureCode;
  const notes = values.notes.trim();
  if (notes) input.notes = notes;
  return input;
}

/** Failure-code options depend on the measurement status (Phase 4G semantics). */
function failureCodeOptions(status: "" | MeasurementStatus): Array<{ value: "" | FailureCode; label: string }> {
  if (status === "pass") {
    return [{ value: "", label: "None" }];
  }
  if (status === "fail") {
    return REAL_FAILURE_CODES.map((code) => ({ value: code, label: code }));
  }
  return [{ value: "", label: "None" }, ...REAL_FAILURE_CODES.map((code) => ({ value: code, label: code }))];
}

type ManualMeasurementFormProps = {
  plants: Plant[];
  images: ImageRecord[];
  createManualMeasurement: (input: CreateManualMeasurementInput) => Promise<ManualMeasurement>;
  onCreated: (created: ManualMeasurement) => void;
  /** Read-only day context used for the non-blocking rollback hint. */
  getDayContext: (plantId: string) => Promise<PlantDayContext | null>;
};

export function ManualMeasurementForm({ plants, images, createManualMeasurement, onCreated, getDayContext }: ManualMeasurementFormProps) {
  const [values, setValues] = useState<ManualFormValues>(emptyManualFormValues);
  const [localIssues, setLocalIssues] = useState<ManualFormIssue[]>([]);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleFieldChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setValues((current) => {
      let next = { ...current, [name]: value } as ManualFormValues;
      // Changing the plant must never silently keep an image that belongs to
      // another plant: clear the selection when it becomes incompatible.
      if (name === "plant_id") {
        const compatible =
          next.image_id === "" || images.some((img) => img.image_id === next.image_id && img.plant_id === value);
        if (!compatible) next = { ...next, image_id: "" };
      }
      // Keep the failure-code state valid when the status changes (Phase 4G).
      if (name === "measurement_status") {
        if (value === "pass" && next.failure_code && next.failure_code !== "none") {
          next = { ...next, failure_code: "" };
        } else if (value === "fail" && next.failure_code === "none") {
          next = { ...next, failure_code: "" };
        }
      }
      return next;
    });
  };

  const selectedImage = values.image_id ? images.find((img) => img.image_id === values.image_id) : undefined;
  const plantImages = values.plant_id ? images.filter((img) => img.plant_id === values.plant_id) : [];
  const dayContext = useDayContext(getDayContext, values.plant_id);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const local = validateManualForm(values, selectedImage);
    setLocalIssues(local);
    if (local.length > 0) return;

    const timestamp = normalizeTimestampToSeconds(values.timestamp.trim());
    const input = buildManualMeasurementInput(values, generateManualMeasurementId(timestamp));

    setSubmitting(true);
    setSubmitError(null);
    setSuccessId(null);
    try {
      // The backend response is the source of truth for what was persisted.
      const created = await createManualMeasurement(input);
      setSuccessId(created.measurement_id);
      // Reset entered values after confirmed success; keep the plant selection
      // and default attempt (never auto-derived from existing measurements).
      setValues({ ...emptyManualFormValues(), plant_id: values.plant_id });
      onCreated(created);
    } catch (err) {
      // Preserve the entered values on failure; ApiError is rendered by
      // ErrorSummary with its structured issues intact.
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
        <label className="form-field" htmlFor="mm-plant">
          <span className="form-label">
            Plant <span className="form-required" aria-hidden="true">*</span>
          </span>
          <select id="mm-plant" name="plant_id" value={values.plant_id} onChange={handleFieldChange} disabled={submitting}>
            <option value="">Select a plant</option>
            {plants.map((plant) => (
              <option key={plant.plant_id} value={plant.plant_id}>
                {plant.plant_id} · pot {plant.pot_id}
              </option>
            ))}
          </select>
          {renderIssues("plant_id")}
        </label>

        <label className="form-field" htmlFor="mm-image">
          <span className="form-label">Image</span>
          <select id="mm-image" name="image_id" value={values.image_id} onChange={handleFieldChange} disabled={submitting}>
            <option value="">No image</option>
            {plantImages.map((image) => (
              <option key={image.image_id} value={image.image_id}>
                {image.image_id} · day {image.experiment_day} · {image.timestamp}
              </option>
            ))}
          </select>
          <span className="form-hint">Optional; must belong to the selected plant.</span>
          {renderIssues("image_id")}
        </label>

        <label className="form-field" htmlFor="mm-timestamp">
          <span className="form-label">
            Timestamp <span className="form-required" aria-hidden="true">*</span>
          </span>
          <input id="mm-timestamp" type="datetime-local" name="timestamp" value={values.timestamp} onChange={handleFieldChange} disabled={submitting} />
          {renderIssues("timestamp")}
        </label>

        <label className="form-field" htmlFor="mm-experiment-day">
          <span className="form-label">
            Experiment day <span className="form-required" aria-hidden="true">*</span>
          </span>
          <input
            id="mm-experiment-day"
            type="number"
            min={1}
            step={1}
            name="experiment_day"
            value={values.experiment_day}
            onChange={handleFieldChange}
            disabled={submitting}
          />
          <span className="form-hint">Explicitly entered; never derived from the timestamp.</span>
          <ExperimentDayContext dayContext={dayContext} enteredDay={values.experiment_day} />
          {renderIssues("experiment_day")}
        </label>

        <label className="form-field" htmlFor="mm-repetition">
          <span className="form-label">
            Repetition <span className="form-required" aria-hidden="true">*</span>
          </span>
          <select id="mm-repetition" name="repetition" value={values.repetition} onChange={handleFieldChange} disabled={submitting}>
            <option value="">Select repetition</option>
            <option value="1">1</option>
            <option value="2">2</option>
          </select>
          <span className="form-hint">Retakes are allowed for the same plant, day and repetition.</span>
          {renderIssues("repetition")}
        </label>

        <label className="form-field" htmlFor="mm-attempt">
          <span className="form-label">
            Attempt <span className="form-required" aria-hidden="true">*</span>
          </span>
          <input
            id="mm-attempt"
            type="number"
            min={1}
            step={1}
            name="attempt"
            value={values.attempt}
            onChange={handleFieldChange}
            disabled={submitting}
          />
          <span className="form-hint">Retake counter; never derived from existing measurements.</span>
          {renderIssues("attempt")}
        </label>

        <label className="form-field" htmlFor="mm-height">
          <span className="form-label">Plant height [cm]</span>
          <input
            id="mm-height"
            type="number"
            min={0}
            step="any"
            name="plant_height_cm"
            value={values.plant_height_cm}
            onChange={handleFieldChange}
            disabled={submitting}
          />
          <span className="form-hint">Required for 'pass'; optional otherwise.</span>
          {renderIssues("plant_height_cm")}
        </label>

        <label className="form-field" htmlFor="mm-observer">
          <span className="form-label">
            Observer <span className="form-required" aria-hidden="true">*</span>
          </span>
          <input id="mm-observer" type="text" name="observer" value={values.observer} onChange={handleFieldChange} disabled={submitting} />
          {renderIssues("observer")}
        </label>

        <label className="form-field" htmlFor="mm-status">
          <span className="form-label">
            Measurement status <span className="form-required" aria-hidden="true">*</span>
          </span>
          <select id="mm-status" name="measurement_status" value={values.measurement_status} onChange={handleFieldChange} disabled={submitting}>
            <option value="">Select a status</option>
            {MEASUREMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
          {renderIssues("measurement_status")}
        </label>

        <label className="form-field" htmlFor="mm-failure-code">
          <span className="form-label">Failure code</span>
          <select id="mm-failure-code" name="failure_code" value={values.failure_code} onChange={handleFieldChange} disabled={submitting}>
            {failureCodeOptions(values.measurement_status).map((option) => (
              <option key={option.value || "none"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="form-hint">Required for 'fail'; only 'None' is valid for 'pass'.</span>
          {renderIssues("failure_code")}
        </label>

        <label className="form-field span-2" htmlFor="mm-notes">
          <span className="form-label">Notes</span>
          <textarea id="mm-notes" name="notes" value={values.notes} onChange={handleFieldChange} disabled={submitting} />
          {renderIssues("notes")}
        </label>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Saving manual measurement…" : "Log manual measurement"}
        </button>
        <span className="form-hint">Required fields are marked with *.</span>
      </div>
      {successId ? (
        <p className="form-success" role="status">
          Manual measurement {successId} recorded.
        </p>
      ) : null}
      <ErrorSummary error={submitError} fallbackMessage="The manual measurement could not be recorded." />
    </form>
  );
}

type MeasurementsPageDeps = {
  plantService: Pick<PlantService, "listPlants" | "getDayContext">;
  imageService: Pick<ImageService, "listImages">;
  measurementService: Pick<
    MeasurementService,
    "listManualMeasurements" | "listAICVMeasurements" | "createManualMeasurement"
  >;
};

type MeasurementsPageProps = { services?: MeasurementsPageDeps };

export function MeasurementsPage({ services: deps = services }: MeasurementsPageProps = {}) {
  const [measurements, setMeasurements] = useState<ManualMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [aicvMeasurements, setAicvMeasurements] = useState<AICVMeasurement[]>([]);
  const [aicvLoading, setAicvLoading] = useState(true);
  const [aicvError, setAicvError] = useState<unknown>(null);
  const [plants, setPlants] = useState<Plant[] | null>(null);
  const [plantsError, setPlantsError] = useState<unknown>(null);
  const [images, setImages] = useState<ImageRecord[] | null>(null);
  const [imagesError, setImagesError] = useState<unknown>(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await deps.measurementService.listManualMeasurements();
        if (!cancelled) setMeasurements(data);
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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await deps.measurementService.listAICVMeasurements();
        if (!cancelled) setAicvMeasurements(data);
      } catch (err) {
        if (!cancelled) {
          setAicvError(err);
        }
      } finally {
        if (!cancelled) setAicvLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deps]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await deps.plantService.listPlants();
        if (!cancelled) setPlants(data);
      } catch (err) {
        if (!cancelled) {
          setPlantsError(err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deps]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await deps.imageService.listImages();
        if (!cancelled) setImages(data);
      } catch (err) {
        if (!cancelled) {
          setImagesError(err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deps]);

  const handleCreated = (created: ManualMeasurement) => {
    // Read-after-write: refresh from the backend so the list reflects the
    // persisted row (the backend response is the only truth used elsewhere).
    void deps.measurementService
      .listManualMeasurements()
      .then((data) => setMeasurements(data))
      .catch((err) => setError(err));
  };

  return (
    <section className="page" aria-labelledby="measurements-title">
      <PageHeader
        eyebrow="Daily records"
        title="Measurements"
        description="Manual reference measurements recorded by an observer, and AI/CV measurements to be compared against them."
        titleId="measurements-title"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setFormOpen((open) => !open)}
            aria-expanded={formOpen}
          >
            {formOpen ? "Close form" : "Log manual measurement"}
          </button>
        }
      />
      {formOpen ? (
        <section className="panel form-panel" aria-label="Log a manual measurement">
          <div className="panel-heading">
            <h2>Log manual measurement</h2>
            <p>The human reference is recorded independently — never influenced by any automated output.</p>
          </div>
          {plants === null ? (
            <p className="empty-state-description">Loading registered plants...</p>
          ) : plantsError ? (
            <ErrorSummary error={plantsError} fallbackMessage="Failed to load plants for the manual measurement form" />
          ) : plants.length === 0 ? (
            <p className="empty-state-description">
              No plants are registered yet. Register a plant before logging a manual measurement.
            </p>
          ) : (
            <>
              {imagesError ? (
                <ErrorSummary
                  error={imagesError}
                  fallbackMessage="Failed to load images for the manual measurement form (image selection is disabled)"
                />
              ) : null}
              <ManualMeasurementForm
                plants={plants}
                images={images ?? []}
                createManualMeasurement={(input) => deps.measurementService.createManualMeasurement(input)}
                onCreated={handleCreated}
                getDayContext={(plantId) => deps.plantService.getDayContext(plantId)}
              />
            </>
          )}
        </section>
      ) : null}

      {loading ? (
        <div className="panel">
          <p className="empty-state-title">Loading manual measurements</p>
          <p className="empty-state-description">Fetching manual measurement records from the backend...</p>
        </div>
      ) : error ? (
        <div className="panel">
          <p className="empty-state-title">Unable to load manual measurements</p>
          <ErrorSummary error={error} fallbackMessage="Failed to load manual measurements from the backend" />
        </div>
      ) : (
        <DataTable
          caption="Manual measurements table"
          headers={manualHeaders}
          empty={measurements.length === 0}
          emptyMessage="No manual measurements recorded."
        >
          {measurements.map((measurement) => (
            <tr key={measurement.measurement_id}>
              <td>
                <Link to={`/measurements/${measurement.measurement_id}`}>{measurement.measurement_id}</Link>
              </td>
              <td>
                <Link to={`/plants/${measurement.plant_id}`}>{measurement.plant_id}</Link>
              </td>
              <td>{renderOptionalLink(measurement.image_id, (id) => `/images/${id}`)}</td>
              <td>{measurement.timestamp}</td>
              <td>{measurement.experiment_day}</td>
              <td>{measurement.repetition}</td>
              <td>{measurement.attempt ?? 1}</td>
              <td>{renderNumber(measurement.plant_height_cm)}</td>
              <td>{measurement.observer}</td>
              <td>
                <span className={`verdict verdict-${measurement.measurement_status}`}>
                  {measurement.measurement_status.toUpperCase()}
                </span>
              </td>
              <td>{measurement.failure_code ?? "—"}</td>
              <td>
                <span className="method-chip">MANUAL</span>
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      <div className="section-heading-row">
        <h2 className="section-heading">AI/CV measurements</h2>
        <p className="section-heading-note">
          Automated measurements will be recorded beside the manual reference once the AI/CV pipeline runs — this section stays empty until then.
        </p>
      </div>

      {aicvLoading ? (
        <div className="panel">
          <p className="empty-state-title">Loading AI/CV measurements</p>
          <p className="empty-state-description">Fetching AI/CV measurement records from the backend...</p>
        </div>
      ) : aicvError ? (
        <div className="panel">
          <p className="empty-state-title">Unable to load AI/CV measurements</p>
          <ErrorSummary error={aicvError} fallbackMessage="Failed to load AI/CV measurements from the backend" />
        </div>
      ) : (
        <DataTable
          caption="AI/CV measurements table"
          headers={aicvHeaders}
          empty={aicvMeasurements.length === 0}
          emptyMessage="No AI/CV measurements recorded."
        >
          {aicvMeasurements.map((measurement) => (
            <tr key={measurement.measurement_id}>
              <td>
                <Link to={`/measurements/${measurement.measurement_id}`}>{measurement.measurement_id}</Link>
              </td>
              <td>
                <Link to={`/plants/${measurement.plant_id}`}>{measurement.plant_id}</Link>
              </td>
              <td>{renderOptionalLink(measurement.image_id, (id) => `/images/${id}`)}</td>
              <td>{measurement.timestamp}</td>
              <td>{measurement.model}</td>
              <td>{measurement.model_version}</td>
              <td>{measurement.pipeline_version}</td>
              <td>
                <span className={`verdict verdict-${measurement.detection_status}`}>
                  {measurement.detection_status.toUpperCase()}
                </span>
              </td>
              <td>{measurement.segmentation_status}</td>
              <td>{measurement.calibration_status}</td>
              <td>{renderNumber(measurement.plant_height_cm)}</td>
              <td>{renderNumber(measurement.projected_area_cm2)}</td>
              <td>{renderNumber(measurement.confidence)}</td>
              <td>{measurement.failure_code ?? "—"}</td>
              <td>{measurement.notes ?? "—"}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </section>
  );
}

export function MeasurementDetailPage() {
  const { measurementId } = useParams();
  const isAicv = measurementId?.startsWith("MSR-AICV-") ?? false;
  const [record, setRecord] = useState<MeasurementDetailState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    setRecord(null);

    (async () => {
      if (!measurementId) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        if (isAicv) {
          const data = await services.measurementService.getAICVMeasurementById(measurementId);
          if (!cancelled) setRecord(data ? { kind: "aicv", measurement: data } : null);
        } else {
          const data = await services.measurementService.getManualMeasurementById(measurementId);
          if (!cancelled) setRecord(data ? { kind: "manual", measurement: data } : null);
        }
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
  }, [measurementId, isAicv]);

  const manualMetadata = (measurement: ManualMeasurement) => [
    { label: "Measurement ID", value: measurement.measurement_id },
    { label: "Plant ID", value: measurement.plant_id },
    { label: "Image ID", value: measurement.image_id ?? "—" },
    { label: "Timestamp", value: measurement.timestamp },
    { label: "Experiment day", value: String(measurement.experiment_day) },
    { label: "Repetition", value: String(measurement.repetition) },
    { label: "Attempt", value: String(measurement.attempt ?? 1) },
    { label: "Plant height [cm]", value: renderNumber(measurement.plant_height_cm) },
    { label: "Observer", value: measurement.observer },
    { label: "Measurement status", value: measurement.measurement_status },
    { label: "Failure code", value: measurement.failure_code ?? "—" },
    { label: "Notes", value: measurement.notes ?? "—" },
    { label: "Method", value: measurement.method },
  ];

  const aicvMetadata = (measurement: AICVMeasurement) => [
    { label: "Measurement ID", value: measurement.measurement_id },
    { label: "Plant ID", value: measurement.plant_id },
    { label: "Image ID", value: measurement.image_id },
    { label: "Timestamp", value: measurement.timestamp },
    { label: "Model", value: measurement.model },
    { label: "Model version", value: measurement.model_version },
    { label: "Pipeline version", value: measurement.pipeline_version },
    { label: "Detection status", value: measurement.detection_status },
    { label: "Segmentation status", value: measurement.segmentation_status },
    { label: "Calibration status", value: measurement.calibration_status },
    { label: "Plant height [cm]", value: renderNumber(measurement.plant_height_cm) },
    { label: "Projected area [cm²]", value: renderNumber(measurement.projected_area_cm2) },
    { label: "Confidence", value: renderNumber(measurement.confidence) },
    { label: "Failure code", value: measurement.failure_code ?? "—" },
    { label: "Notes", value: measurement.notes ?? "—" },
  ];

  const actions = record ? (
    <>
      <Link to={`/plants/${record.measurement.plant_id}`}>View plant</Link>
      {"image_id" in record.measurement && record.measurement.image_id ? (
        <Link to={`/images/${record.measurement.image_id}`}>View image</Link>
      ) : null}
      <Link to="/measurements">Back to Measurements</Link>
    </>
  ) : (
    <Link to="/measurements">Back to Measurements</Link>
  );

  const dataSource = isAicv ? "Backend returned 404 aicv_measurement.not_found" : "Backend returned 404 manual_measurement.not_found";

  return (
    <section className="page" aria-labelledby="measurement-detail-title">
      <PageHeader
        eyebrow="Record"
        title="Measurement detail"
        description="A single measurement with its full provenance: plant, image, day, repetition, attempt and status."
        titleId="measurement-detail-title"
      />

      {loading ? (
        <div className="panel">
          <p className="empty-state-title">Loading measurement</p>
          <p className="empty-state-description">Fetching measurement record from the backend...</p>
        </div>
      ) : error ? (
        <div className="panel">
          <p className="empty-state-title">Unable to load measurement</p>
          <ErrorSummary error={error} fallbackMessage="Failed to load measurement from the backend" />
        </div>
      ) : record ? (
        <DetailPanel
          kicker={record.kind === "aicv" ? "AI/CV measurement" : "Manual reference"}
          title={record.measurement.measurement_id}
          status={
            record.kind === "aicv"
              ? record.measurement.detection_status === "pass"
                ? "PASS"
                : "FAIL"
              : (record.measurement.measurement_status.toUpperCase() as BadgeStatus)
          }
          metadata={record.kind === "aicv" ? aicvMetadata(record.measurement) : manualMetadata(record.measurement)}
          actions={actions}
        />
      ) : (
        <DetailPanel
          title="Measurement not found."
          status="NOT_RUN"
          metadata={[
            { label: "Requested measurement", value: measurementId ?? "Unknown" },
            { label: "Data source", value: dataSource },
          ]}
          actions={<Link to="/measurements">Back to Measurements</Link>}
        />
      )}
    </section>
  );
}