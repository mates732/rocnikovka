import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { ErrorSummary } from "../components/ErrorSummary";
import { ExperimentDayContext } from "../components/ExperimentDayContext";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { useDayContext } from "../hooks/useDayContext";
import { services } from "../data/adapters";
import type { PlantService, PositionService, WaterService } from "../services/interfaces";
import type { Plant, PlantDayContext, PositionEvent, WaterEvent, WateringStatus } from "../types/entities";
import type { CreatePositionEventInput, CreateWaterEventInput } from "../types/write";

// ============================================================================
// Water event creation (Phase 4K.4)
// ----------------------------------------------------------------------------
// The form is intentionally thin: it only shapes user input into the Phase 4J
// CreateWaterEventInput contract and submits through WaterService. The backend
// remains the authoritative business-rule layer; everything validated here is
// local UX only (required fields, plausibility ranges) and never re-implements
// backend semantics. No experimental value is ever invented or derived here.
// ============================================================================

const TIMESTAMP_MINUTE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const TIMESTAMP_SECOND_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
const DECIMAL_RE = /^-?\d+(\.\d+)?$/;
const INTEGER_RE = /^\d+$/;
const WATERING_STATUSES: WateringStatus[] = ["pass", "warn", "fail"];

export type WaterFormValues = {
  plant_id: string;
  timestamp: string; // datetime-local value YYYY-MM-DDTHH:MM
  experiment_day: string;
  pot_mass_before_g: string;
  target_mass_g: string;
  water_added_ml: string;
  pot_mass_after_g: string;
  watering_status: "" | WateringStatus;
  operator: string;
  notes: string;
};

export type FormIssue = { field: string; code: string; message: string };

export function emptyWaterFormValues(): WaterFormValues {
  return {
    plant_id: "",
    timestamp: "",
    experiment_day: "",
    pot_mass_before_g: "",
    target_mass_g: "",
    water_added_ml: "",
    pot_mass_after_g: "",
    watering_status: "",
    operator: "",
    notes: "",
  };
}

/**
 * The backend timestamp contract is YYYY-MM-DDTHH:MM:SS. A datetime-local
 * input yields YYYY-MM-DDTHH:MM, so seconds are appended. No timezone
 * conversion and no experiment_day derivation ever happens here.
 */
export function normalizeTimestampToSeconds(value: string): string {
  return TIMESTAMP_MINUTE_RE.test(value) ? `${value}:00` : value;
}

/**
 * Deterministic session-only suffix counter for WTR ids. The backend remains
 * the source of truth for persisted ids; this only reduces the chance of two
 * events logged in the same second colliding inside one UI session. It never
 * queries or mutates the database.
 */
let waterIdSuffix = 0;
function nextWaterIdSuffix(): string {
  waterIdSuffix = (waterIdSuffix + 1) % 1000;
  return String(waterIdSuffix).padStart(3, "0");
}

/** Generate WTR-YYYYMMDD-HHMMSS-XXX from a normalized (second-resolution) timestamp. */
export function generateWaterEventId(timestampWithSeconds: string): string {
  const compact = timestampWithSeconds.replace(/[-:T]/g, ""); // YYYYMMDDHHMMSS
  return `WTR-${compact.slice(0, 8)}-${compact.slice(8, 14)}-${nextWaterIdSuffix()}`;
}

function decimalFieldIssue(value: string, options: { min: number; minExclusive?: boolean }): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return "required";
  if (!DECIMAL_RE.test(trimmed)) return "number.invalid_format";
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return "number.invalid_format";
  const inRange = options.minExclusive ? parsed > options.min : parsed >= options.min;
  return inRange ? null : "number.out_of_range";
}

/** Local UX validation. Backend validation remains authoritative on submit. */
export function validateWaterForm(values: WaterFormValues): FormIssue[] {
  const issues: FormIssue[] = [];
  const add = (field: string, code: string, message: string) => issues.push({ field, code, message });

  if (!values.plant_id) {
    add("plant_id", "required", "Select a plant.");
  }

  if (values.timestamp.trim() === "") {
    add("timestamp", "required", "Timestamp is required.");
  } else if (!TIMESTAMP_SECOND_RE.test(normalizeTimestampToSeconds(values.timestamp.trim()))) {
    add("timestamp", "timestamp.invalid_format", "Timestamp must look like YYYY-MM-DDTHH:MM.");
  }

  const day = values.experiment_day.trim();
  if (day === "") {
    add("experiment_day", "required", "Experiment day is required.");
  } else if (!INTEGER_RE.test(day) || !Number.isInteger(Number(day)) || Number(day) < 1) {
    add("experiment_day", "number.out_of_range", "Experiment day must be an integer of at least 1.");
  }

  const numericFields: Array<{
    field: keyof WaterFormValues;
    message: string;
    constraint: { min: number; minExclusive?: boolean };
  }> = [
    { field: "pot_mass_before_g", message: "Pot mass before must be a number of at least 0.", constraint: { min: 0 } },
    { field: "target_mass_g", message: "Target mass must be a number greater than 0.", constraint: { min: 0, minExclusive: true } },
    { field: "water_added_ml", message: "Added water must be a number of at least 0.", constraint: { min: 0 } },
    { field: "pot_mass_after_g", message: "Pot mass after must be a number of at least 0.", constraint: { min: 0 } },
  ];
  for (const { field, message, constraint } of numericFields) {
    const code = decimalFieldIssue(values[field], constraint);
    if (code) add(field, code, message);
  }

  if (!values.watering_status) {
    add("watering_status", "required", "Select a watering status.");
  } else if (!WATERING_STATUSES.includes(values.watering_status)) {
    add("watering_status", "enum.invalid", "Watering status must be pass, warn or fail.");
  }

  return issues;
}

/** Build the exact Phase 4J request payload — only known API fields, never a persisted entity spread. */
export function buildWaterEventInput(values: WaterFormValues, water_event_id: string): CreateWaterEventInput {
  const timestamp = normalizeTimestampToSeconds(values.timestamp.trim());
  const input: CreateWaterEventInput = {
    water_event_id,
    plant_id: values.plant_id,
    timestamp,
    experiment_day: Number(values.experiment_day),
    pot_mass_before_g: Number(values.pot_mass_before_g),
    target_mass_g: Number(values.target_mass_g),
    water_added_ml: Number(values.water_added_ml),
    pot_mass_after_g: Number(values.pot_mass_after_g),
    watering_status: values.watering_status as WateringStatus,
  };
  const operator = values.operator.trim();
  const notes = values.notes.trim();
  if (operator) input.operator = operator;
  if (notes) input.notes = notes;
  return input;
}

type WaterEventFormProps = {
  plants: Plant[];
  createWaterEvent: (input: CreateWaterEventInput) => Promise<WaterEvent>;
  onCreated: (created: WaterEvent) => void;
  /** Read-only day context used for the non-blocking rollback hint. */
  getDayContext: (plantId: string) => Promise<PlantDayContext | null>;
};

export function WaterEventForm({ plants, createWaterEvent, onCreated, getDayContext }: WaterEventFormProps) {
  const [values, setValues] = useState<WaterFormValues>(emptyWaterFormValues);
  const [localIssues, setLocalIssues] = useState<FormIssue[]>([]);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const dayContext = useDayContext(getDayContext, values.plant_id);

  const handleFieldChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }) as WaterFormValues);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const local = validateWaterForm(values);
    setLocalIssues(local);
    if (local.length > 0) return;

    const timestamp = normalizeTimestampToSeconds(values.timestamp.trim());
    const input = buildWaterEventInput(values, generateWaterEventId(timestamp));

    setSubmitting(true);
    setSubmitError(null);
    setSuccessId(null);
    try {
      // The backend response is the source of truth for what was persisted.
      const created = await createWaterEvent(input);
      setSuccessId(created.water_event_id);
      // Reset measured/temporal fields after confirmed success; keep the plant
      // selection so consecutive events for the same plant are easy to log.
      setValues({ ...emptyWaterFormValues(), plant_id: values.plant_id });
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
        <label className="form-field" htmlFor="water-plant">
          <span className="form-label">
            Plant <span className="form-required" aria-hidden="true">*</span>
          </span>
          <select id="water-plant" name="plant_id" value={values.plant_id} onChange={handleFieldChange} disabled={submitting}>
            <option value="">Select a plant</option>
            {plants.map((plant) => (
              <option key={plant.plant_id} value={plant.plant_id}>
                {plant.plant_id} · pot {plant.pot_id}
              </option>
            ))}
          </select>
          {renderIssues("plant_id")}
        </label>

        <label className="form-field" htmlFor="water-timestamp">
          <span className="form-label">
            Timestamp <span className="form-required" aria-hidden="true">*</span>
          </span>
          <input id="water-timestamp" type="datetime-local" name="timestamp" value={values.timestamp} onChange={handleFieldChange} disabled={submitting} />
          {renderIssues("timestamp")}
        </label>

        <label className="form-field" htmlFor="water-experiment-day">
          <span className="form-label">
            Experiment day <span className="form-required" aria-hidden="true">*</span>
          </span>
          <input
            id="water-experiment-day"
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

        <label className="form-field" htmlFor="water-mass-before">
          <span className="form-label">
            Pot mass before [g] <span className="form-required" aria-hidden="true">*</span>
          </span>
          <input
            id="water-mass-before"
            type="number"
            min={0}
            step="any"
            name="pot_mass_before_g"
            value={values.pot_mass_before_g}
            onChange={handleFieldChange}
            disabled={submitting}
          />
          {renderIssues("pot_mass_before_g")}
        </label>

        <label className="form-field" htmlFor="water-target-mass">
          <span className="form-label">
            Target mass [g] <span className="form-required" aria-hidden="true">*</span>
          </span>
          <input
            id="water-target-mass"
            type="number"
            min={0}
            step="any"
            name="target_mass_g"
            value={values.target_mass_g}
            onChange={handleFieldChange}
            disabled={submitting}
          />
          {renderIssues("target_mass_g")}
        </label>

        <label className="form-field" htmlFor="water-added">
          <span className="form-label">
            Water added [ml] <span className="form-required" aria-hidden="true">*</span>
          </span>
          <input
            id="water-added"
            type="number"
            min={0}
            step="any"
            name="water_added_ml"
            value={values.water_added_ml}
            onChange={handleFieldChange}
            disabled={submitting}
          />
          {renderIssues("water_added_ml")}
        </label>

        <label className="form-field" htmlFor="water-mass-after">
          <span className="form-label">
            Pot mass after [g] <span className="form-required" aria-hidden="true">*</span>
          </span>
          <input
            id="water-mass-after"
            type="number"
            min={0}
            step="any"
            name="pot_mass_after_g"
            value={values.pot_mass_after_g}
            onChange={handleFieldChange}
            disabled={submitting}
          />
          {renderIssues("pot_mass_after_g")}
        </label>

        <label className="form-field" htmlFor="water-status">
          <span className="form-label">
            Watering status <span className="form-required" aria-hidden="true">*</span>
          </span>
          <select id="water-status" name="watering_status" value={values.watering_status} onChange={handleFieldChange} disabled={submitting}>
            <option value="">Select a status</option>
            {WATERING_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
          {renderIssues("watering_status")}
        </label>

        <label className="form-field" htmlFor="water-operator">
          <span className="form-label">Operator</span>
          <input id="water-operator" type="text" name="operator" value={values.operator} onChange={handleFieldChange} disabled={submitting} />
          {renderIssues("operator")}
        </label>

        <label className="form-field span-2" htmlFor="water-notes">
          <span className="form-label">Notes</span>
          <textarea id="water-notes" name="notes" value={values.notes} onChange={handleFieldChange} disabled={submitting} />
          {renderIssues("notes")}
        </label>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Saving water event…" : "Log water event"}
        </button>
        <span className="form-hint">Required fields are marked with *.</span>
      </div>
      {successId ? (
        <p className="form-success" role="status">
          Water event {successId} recorded.
        </p>
      ) : null}
      <ErrorSummary error={submitError} fallbackMessage="The water event could not be recorded." />
    </form>
  );
}

// ============================================================================
// Position event creation (Phase 4K.5)
// ----------------------------------------------------------------------------
// Thin, backend-authoritative form analogous to the water event flow.
// NOTE ON `reason`: the Phase 4J contract requires it (initial_assignment |
// rotation | manual_override) — the backend validator rejects a missing
// reason. It is therefore a required select here, never invented.
// ============================================================================

const POSITION_REASONS: PositionEvent["reason"][] = ["initial_assignment", "rotation", "manual_override"];

const POSITION_REASON_LABELS: Record<PositionEvent["reason"], string> = {
  initial_assignment: "Initial assignment",
  rotation: "Rotation",
  manual_override: "Manual override",
};

export type PositionFormValues = {
  plant_id: string;
  position_id: string;
  timestamp: string; // datetime-local value YYYY-MM-DDTHH:MM
  location: string;
  previous_location: string;
  operator: string;
  reason: "" | PositionEvent["reason"];
  notes: string;
};

export function emptyPositionFormValues(): PositionFormValues {
  return {
    plant_id: "",
    position_id: "",
    timestamp: "",
    location: "",
    previous_location: "",
    operator: "",
    reason: "",
    notes: "",
  };
}

/**
 * Deterministic session-only suffix counter for POS ids (analogous to the WTR
 * counter). The backend remains the source of truth for persisted ids; this
 * only reduces same-second collisions inside one UI session and never queries
 * or mutates the database.
 */
let positionIdSuffix = 0;
function nextPositionIdSuffix(): string {
  positionIdSuffix = (positionIdSuffix + 1) % 1000;
  return String(positionIdSuffix).padStart(3, "0");
}

/** Generate POS-YYYYMMDD-HHMMSS-XXX from a normalized (second-resolution) timestamp. */
export function generatePositionEventId(timestampWithSeconds: string): string {
  const compact = timestampWithSeconds.replace(/[-:T]/g, ""); // YYYYMMDDHHMMSS
  return `POS-${compact.slice(0, 8)}-${compact.slice(8, 14)}-${nextPositionIdSuffix()}`;
}

function requiredNonWhitespace(value: string): string | null {
  return value.trim() === "" ? "required" : null;
}

/** Local UX validation. Backend validation remains authoritative on submit. */
export function validatePositionForm(values: PositionFormValues): FormIssue[] {
  const issues: FormIssue[] = [];
  const add = (field: string, code: string, message: string) => issues.push({ field, code, message });

  if (!values.plant_id) {
    add("plant_id", "required", "Select a plant.");
  }

  if (requiredNonWhitespace(values.position_id)) {
    add("position_id", "required", "Position ID is required.");
  }

  if (values.timestamp.trim() === "") {
    add("timestamp", "required", "Timestamp is required.");
  } else if (!TIMESTAMP_SECOND_RE.test(normalizeTimestampToSeconds(values.timestamp.trim()))) {
    add("timestamp", "timestamp.invalid_format", "Timestamp must look like YYYY-MM-DDTHH:MM.");
  }

  if (requiredNonWhitespace(values.location)) {
    add("location", "required", "Location is required.");
  }

  if (requiredNonWhitespace(values.operator)) {
    add("operator", "required", "Operator is required.");
  }

  if (!values.reason) {
    add("reason", "required", "Select a reason.");
  } else if (!POSITION_REASONS.includes(values.reason)) {
    add("reason", "enum.invalid", "Reason must be initial_assignment, rotation or manual_override.");
  }

  return issues;
}

/** Build the exact Phase 4J request payload — only known API fields, never a persisted entity spread. */
export function buildPositionEventInput(
  values: PositionFormValues,
  position_event_id: string
): CreatePositionEventInput {
  const timestamp = normalizeTimestampToSeconds(values.timestamp.trim());
  const input: CreatePositionEventInput = {
    position_event_id,
    position_id: values.position_id.trim(),
    timestamp,
    plant_id: values.plant_id,
    location: values.location.trim(),
    operator: values.operator.trim(),
    reason: values.reason as PositionEvent["reason"],
  };
  const previousLocation = values.previous_location.trim();
  const notes = values.notes.trim();
  if (previousLocation) input.previous_location = previousLocation;
  if (notes) input.notes = notes;
  return input;
}

type PositionEventFormProps = {
  plants: Plant[];
  createPositionEvent: (input: CreatePositionEventInput) => Promise<PositionEvent>;
  onCreated: (created: PositionEvent) => void;
};

export function PositionEventForm({ plants, createPositionEvent, onCreated }: PositionEventFormProps) {
  const [values, setValues] = useState<PositionFormValues>(emptyPositionFormValues);
  const [localIssues, setLocalIssues] = useState<FormIssue[]>([]);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleFieldChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }) as PositionFormValues);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const local = validatePositionForm(values);
    setLocalIssues(local);
    if (local.length > 0) return;

    const timestamp = normalizeTimestampToSeconds(values.timestamp.trim());
    const input = buildPositionEventInput(values, generatePositionEventId(timestamp));

    setSubmitting(true);
    setSubmitError(null);
    setSuccessId(null);
    try {
      // The backend response is the source of truth for what was persisted.
      const created = await createPositionEvent(input);
      setSuccessId(created.position_event_id);
      // Reset entered values after confirmed success; keep the plant selection
      // so consecutive events for the same plant are easy to log.
      setValues({ ...emptyPositionFormValues(), plant_id: values.plant_id });
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
        <label className="form-field" htmlFor="pos-plant">
          <span className="form-label">
            Plant <span className="form-required" aria-hidden="true">*</span>
          </span>
          <select id="pos-plant" name="plant_id" value={values.plant_id} onChange={handleFieldChange} disabled={submitting}>
            <option value="">Select a plant</option>
            {plants.map((plant) => (
              <option key={plant.plant_id} value={plant.plant_id}>
                {plant.plant_id} · pot {plant.pot_id}
              </option>
            ))}
          </select>
          {renderIssues("plant_id")}
        </label>

        <label className="form-field" htmlFor="pos-position-id">
          <span className="form-label">
            Position ID <span className="form-required" aria-hidden="true">*</span>
          </span>
          <input id="pos-position-id" type="text" name="position_id" value={values.position_id} onChange={handleFieldChange} disabled={submitting} />
          {renderIssues("position_id")}
        </label>

        <label className="form-field" htmlFor="pos-timestamp">
          <span className="form-label">
            Timestamp <span className="form-required" aria-hidden="true">*</span>
          </span>
          <input id="pos-timestamp" type="datetime-local" name="timestamp" value={values.timestamp} onChange={handleFieldChange} disabled={submitting} />
          {renderIssues("timestamp")}
        </label>

        <label className="form-field" htmlFor="pos-location">
          <span className="form-label">
            Location <span className="form-required" aria-hidden="true">*</span>
          </span>
          <input id="pos-location" type="text" name="location" value={values.location} onChange={handleFieldChange} disabled={submitting} />
          {renderIssues("location")}
        </label>

        <label className="form-field" htmlFor="pos-previous-location">
          <span className="form-label">Previous location</span>
          <input id="pos-previous-location" type="text" name="previous_location" value={values.previous_location} onChange={handleFieldChange} disabled={submitting} />
          {renderIssues("previous_location")}
        </label>

        <label className="form-field" htmlFor="pos-operator">
          <span className="form-label">
            Operator <span className="form-required" aria-hidden="true">*</span>
          </span>
          <input id="pos-operator" type="text" name="operator" value={values.operator} onChange={handleFieldChange} disabled={submitting} />
          {renderIssues("operator")}
        </label>

        <label className="form-field" htmlFor="pos-reason">
          <span className="form-label">
            Reason <span className="form-required" aria-hidden="true">*</span>
          </span>
          <select id="pos-reason" name="reason" value={values.reason} onChange={handleFieldChange} disabled={submitting}>
            <option value="">Select a reason</option>
            {POSITION_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {POSITION_REASON_LABELS[reason]}
              </option>
            ))}
          </select>
          {renderIssues("reason")}
        </label>

        <label className="form-field span-2" htmlFor="pos-notes">
          <span className="form-label">Notes</span>
          <textarea id="pos-notes" name="notes" value={values.notes} onChange={handleFieldChange} disabled={submitting} />
          {renderIssues("notes")}
        </label>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Saving position event…" : "Log position event"}
        </button>
        <span className="form-hint">Required fields are marked with *.</span>
      </div>
      {successId ? (
        <p className="form-success" role="status">
          Position event {successId} recorded.
        </p>
      ) : null}
      <ErrorSummary error={submitError} fallbackMessage="The position event could not be recorded." />
    </form>
  );
}

type PositionPageDeps = {
  plantService: Pick<PlantService, "listPlants">;
  positionService: Pick<PositionService, "listPositionEvents" | "createPositionEvent">;
};

type PositionPageProps = { services?: PositionPageDeps };

type WaterPageDeps = {
  plantService: Pick<PlantService, "listPlants" | "getDayContext">;
  waterService: Pick<WaterService, "listWaterEvents" | "createWaterEvent">;
};

type WaterPageProps = { services?: WaterPageDeps };

const waterHeaders = [
  "Water Event ID",
  "Plant ID",
  "Timestamp",
  "Experiment day",
  "Mass before [g]",
  "Target mass [g]",
  "Added water [ml]",
  "Mass after [g]",
  "Status",
];

const positionHeaders = [
  "Position Event ID",
  "Position ID",
  "Plant ID",
  "Timestamp",
  "Location",
  "Previous location",
  "Reason",
  "Operator",
];

const experimentSteps = [
  {
    n: "01",
    title: "Register specimens",
    copy: "Create the persistent identity (plant, pot, group) that every later record must reference.",
    to: "/plants",
    label: "Open plant collection",
  },
  {
    n: "02",
    title: "Capture photographic evidence",
    copy: "One standardized side-view image per plant and experiment day, entered day by day by the operator.",
    to: "/images",
    label: "Image evidence",
  },
  {
    n: "03",
    title: "Record the manual reference",
    copy: "Observer measurement with two repetitions per plant and session. Failed attempts stay visible as history.",
    to: "/measurements",
    label: "Manual measurements",
  },
  {
    n: "04",
    title: "Log water and position context",
    copy: "Daily gravimetric watering against the group target, plus rotation events as contextual history.",
    to: "/experiment/water",
    label: "Water events",
  },
  {
    n: "05",
    title: "Verify the recorded day",
    copy: "Read-only completeness per experiment day: images, repetitions, attempts, water and attention items.",
    to: "/experiment/verification",
    label: "Open verification",
  },
  {
    n: "06",
    title: "Review the specimen timeline",
    copy: "Every plant carries a day-by-day record linking its images and measurements back to the source.",
    to: "/plants",
    label: "Open a specimen",
  },
];

export function ExperimentPage() {
  return (
    <section className="page" aria-labelledby="experiment-title">
      <PageHeader
        eyebrow="Experiment"
        title="Experiment"
        description="The operator workflow of a controlled Phaseolus vulgaris measurement run — manual reference recorded first, AI/CV compared later."
        titleId="experiment-title"
      />

      <ol className="flow-grid flow-grid-compact">
        {experimentSteps.map((step) => (
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
  );
}

export function ProtocolPage() {
  return (
    <section className="page" aria-labelledby="protocol-title">
      <PageHeader
        eyebrow="Review"
        title="Protocol"
        description="The locked methodology behind every record in this application. Protocol v1 cannot change without the change policy."
        titleId="protocol-title"
      />
      <section className="panel">
        <div className="panel-heading">
          <h2>Protocol metadata</h2>
          <p>Source of truth: <code>experiment/protocol_v1_locked.md</code></p>
        </div>
        <dl className="metadata-grid">
          <div>
            <dt>Version</dt>
            <dd>1.0</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <StatusBadge status="LOCKED" />
            </dd>
          </div>
          <div>
            <dt>Species</dt>
            <dd>Phaseolus vulgaris</dd>
          </div>
          <div>
            <dt>Groups</dt>
            <dd>G0 · G1 · G2</dd>
          </div>
          <div>
            <dt>Purpose</dt>
            <dd>Reproducible plant growth measurement with manual and AI/CV comparison.</dd>
          </div>
        </dl>
        <p className="form-hint">
          Rules encoded in the UI: explicit operator-entered experiment day, two manual repetitions,
          PASS/WARN/FAIL semantics, failed attempts preserved, RAW records append-only.
        </p>
      </section>
    </section>
  );
}

export function WaterPage({ services: deps = services }: WaterPageProps = {}) {
  const [events, setEvents] = useState<WaterEvent[]>([]);
  const [plants, setPlants] = useState<Plant[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [plantsError, setPlantsError] = useState<unknown>(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await deps.waterService.listWaterEvents();
        if (!cancelled) setEvents(data);
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

  const handleCreated = (created: WaterEvent) => {
    // Read-after-write: refresh from the backend so the list reflects the
    // persisted row (the backend response is the only truth used elsewhere).
    void deps.waterService
      .listWaterEvents()
      .then((data) => setEvents(data))
      .catch((err) => setError(err));
  };

  return (
    <section className="page" aria-labelledby="water-title">
      <PageHeader
        eyebrow="Daily records"
        title="Water"
        description="Gravimetric watering log — pots are weighed daily and topped up to the group's relative target (G0 100 · G1 85 · G2 70)."
        titleId="water-title"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setFormOpen((open) => !open)}
            aria-expanded={formOpen}
          >
            {formOpen ? "Close form" : "Log water event"}
          </button>
        }
      />
      {formOpen ? (
        <section className="panel form-panel" aria-label="Log a water event">
          <div className="panel-heading">
            <h2>Log water event</h2>
            <p>Each event is append-only and tied to an explicitly entered experiment day.</p>
          </div>
          {plants === null ? (
            <p className="empty-state-description">Loading registered plants...</p>
          ) : plantsError ? (
            <ErrorSummary error={plantsError} fallbackMessage="Failed to load plants for the water event form" />
          ) : plants.length === 0 ? (
            <p className="empty-state-description">
              No plants are registered yet. Register a plant before logging a water event.
            </p>
          ) : (
            <WaterEventForm
              plants={plants}
              createWaterEvent={(input) => deps.waterService.createWaterEvent(input)}
              onCreated={handleCreated}
              getDayContext={(plantId) => deps.plantService.getDayContext(plantId)}
            />
          )}
        </section>
      ) : null}
      {loading ? (
        <div className="panel">
          <p className="empty-state-title">Loading water events</p>
          <p className="empty-state-description">Fetching water event records from the backend...</p>
        </div>
      ) : error ? (
        <div className="panel">
          <p className="empty-state-title">Unable to load water events</p>
          <ErrorSummary error={error} fallbackMessage="Failed to load water events from the backend" />
        </div>
      ) : (
        <DataTable
          caption="Water events"
          headers={waterHeaders}
          empty={events.length === 0}
          emptyMessage="No water events recorded."
        >
          {events.map((event) => (
            <tr key={event.water_event_id}>
              <td>{event.water_event_id}</td>
              <td>
                <Link to={`/plants/${event.plant_id}`}>{event.plant_id}</Link>
              </td>
              <td>{event.timestamp}</td>
              <td>{event.experiment_day}</td>
              <td>{`${event.pot_mass_before_g} g`}</td>
              <td>{`${event.target_mass_g} g`}</td>
              <td>{`${event.water_added_ml} ml`}</td>
              <td>{`${event.pot_mass_after_g} g`}</td>
              <td>
                <span className={`verdict verdict-${event.watering_status}`}>
                  {event.watering_status.toUpperCase()}
                </span>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </section>
  );
}

export function PositionsPage({ services: deps = services }: PositionPageProps = {}) {
  const [events, setEvents] = useState<PositionEvent[]>([]);
  const [plants, setPlants] = useState<Plant[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [plantsError, setPlantsError] = useState<unknown>(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await deps.positionService.listPositionEvents();
        if (!cancelled) setEvents(data);
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

  const handleCreated = (created: PositionEvent) => {
    // Read-after-write: refresh from the backend so the list reflects the
    // persisted row (the backend response is the only truth used elsewhere).
    void deps.positionService
      .listPositionEvents()
      .then((data) => setEvents(data))
      .catch((err) => setError(err));
  };

  return (
    <section className="page" aria-labelledby="positions-title">
      <PageHeader
        eyebrow="Daily records"
        title="Positions"
        description="Position events document where a plant stood and why it moved. They are contextual history — they never define an experiment day."
        titleId="positions-title"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setFormOpen((open) => !open)}
            aria-expanded={formOpen}
          >
            {formOpen ? "Close form" : "Log position event"}
          </button>
        }
      />
      {formOpen ? (
        <section className="panel form-panel" aria-label="Log a position event">
          <div className="panel-heading">
            <h2>Log position event</h2>
            <p>Reason is recorded explicitly (initial assignment, rotation or manual override).</p>
          </div>
          {plants === null ? (
            <p className="empty-state-description">Loading registered plants...</p>
          ) : plantsError ? (
            <ErrorSummary error={plantsError} fallbackMessage="Failed to load plants for the position event form" />
          ) : plants.length === 0 ? (
            <p className="empty-state-description">
              No plants are registered yet. Register a plant before logging a position event.
            </p>
          ) : (
            <PositionEventForm
              plants={plants}
              createPositionEvent={(input) => deps.positionService.createPositionEvent(input)}
              onCreated={handleCreated}
            />
          )}
        </section>
      ) : null}
      {loading ? (
        <div className="panel">
          <p className="empty-state-title">Loading position events</p>
          <p className="empty-state-description">Fetching position event records from the backend...</p>
        </div>
      ) : error ? (
        <div className="panel">
          <p className="empty-state-title">Unable to load position events</p>
          <ErrorSummary error={error} fallbackMessage="Failed to load position events from the backend" />
        </div>
      ) : (
        <DataTable
          caption="Position events"
          headers={positionHeaders}
          empty={events.length === 0}
          emptyMessage="No position events recorded."
        >
          {events.map((event) => (
            <tr key={event.position_event_id}>
              <td>{event.position_event_id}</td>
              <td>{event.position_id}</td>
              <td>
                <Link to={`/plants/${event.plant_id}`}>{event.plant_id}</Link>
              </td>
              <td>{event.timestamp}</td>
              <td>{event.location}</td>
              <td>{event.previous_location ?? "—"}</td>
              <td>{event.reason}</td>
              <td>{event.operator}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </section>
  );
}

export function QualityControlPage() {
  return (
    <section className="page" aria-labelledby="quality-title">
      <PageHeader
        eyebrow="Review"
        title="Quality control"
        description="Legend of the statuses used for image quality and calibration across every record — text and symbol, never color alone."
        titleId="quality-title"
      />
      <section className="panel">
        <div className="panel-heading">
          <h2>Status reference</h2>
          <p>How PASS/WARN/FAIL read on photographic evidence and measurements.</p>
        </div>
        <ul className="quality-list">
          <li>
            <StatusBadge status="PASS" /> <span>Image quality pass — evidence usable</span>
          </li>
          <li>
            <StatusBadge status="WARN" /> <span>Image quality warning — flag before use</span>
          </li>
          <li>
            <StatusBadge status="FAIL" /> <span>Image quality failure — recorded, never deleted</span>
          </li>
          <li>
            <StatusBadge status="NOT_RUN" /> <span>No quality checks recorded yet</span>
          </li>
        </ul>
      </section>
    </section>
  );
}
