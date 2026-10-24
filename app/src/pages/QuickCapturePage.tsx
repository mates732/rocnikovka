import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { EvidenceThumb } from "../components/EvidenceThumb";
import { ErrorSummary } from "../components/ErrorSummary";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";
import { services } from "../data/adapters";
import { imageFileUrl } from "./ImagesPage";
import { normalizeTimestampToSeconds } from "./ExperimentPages";
import type { ImageService, PlantService } from "../services/interfaces";
import type { ImageRecord, Plant } from "../types/entities";
import type { UploadImageInput } from "../types/write";

type QuickCapturePageDeps = {
  plantService: Pick<PlantService, "listPlants">;
  imageService: Pick<ImageService, "uploadImage" | "verifyImageFile">;
};

type QuickCapturePageProps = { services?: QuickCapturePageDeps };

type PlantOption = {
  plant_id: string;
  group_name: string;
  exemplar_id: string;
  treatment_percentage: number;
  pot_id: string;
  sowing_date: string | null;
};

type FormValues = {
  plant_id: string;
  experiment_day: string;
  timestamp: string;
  camera_id?: string;
  notes: string;
  file: File | null;
};

function emptyFormValues(): FormValues {
  return {
    plant_id: "",
    experiment_day: "",
    timestamp: "",
    camera_id: "",
    notes: "",
    file: null,
  };
}

const PLANT_ID_RE = /^PLT-\d{3}$/;
const EXEMPLAR_ID_RE = /^EX0[1-9]$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIMESTAMP_SECOND_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

type FormIssue = { field: string; code: string; message: string };

function validateForm(values: FormValues): FormIssue[] {
  const issues: FormIssue[] = [];
  const add = (field: string, code: string, message: string) => issues.push({ field, code, message });

  if (!values.plant_id) add("plant_id", "required", "Select a plant.");
  if (!values.experiment_day) add("experiment_day", "required", "Experiment day is required.");
  else if (!ISO_DATE_RE.test(values.experiment_day) || Number.isNaN(Date.parse(values.experiment_day))) {
    add("experiment_day", "date.invalid", "Experiment day must be a real calendar date (YYYY-MM-DD).");
  }
  if (!values.timestamp) add("timestamp", "required", "Timestamp is required.");
  else if (!TIMESTAMP_SECOND_RE.test(values.timestamp)) {
    add("timestamp", "timestamp.invalid", "Timestamp must look like YYYY-MM-DDTHH:MM:SS.");
  }
  if (!values.file) add("file", "required", "Select an image file.");

  return issues;
}

/**
 * Calculate experiment day from sowing date and observation date.
 * Day 0 = sowing date. Day 1 = following calendar day.
 * Uses local date comparison to avoid timezone issues.
 */
function calculateExperimentDay(sowingDate: string | null, observationDate: string): number {
  if (!sowingDate) return 0;
  const sow = new Date(sowingDate + "T00:00:00");
  const obs = new Date(observationDate + "T00:00:00");
  if (isNaN(sow.getTime()) || isNaN(obs.getTime())) return 0;
  const diff = obs.getTime() - sow.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

function buildUploadInput(values: FormValues, sowingDate: string | null): UploadImageInput {
  const experimentDay = calculateExperimentDay(sowingDate, values.experiment_day);

  const input: UploadImageInput = {
    plant_id: values.plant_id,
    experiment_day: experimentDay,
    timestamp: values.timestamp,
    camera_id: values.camera_id,
    image_quality_status: "PASS",
    calibration_status: "pass",
    file: values.file!,
  };
  if (values.notes.trim()) input.notes = values.notes.trim();
  return input;
}

export function QuickCapturePage({ services: deps = services }: QuickCapturePageProps = {}) {
  const [plants, setPlants] = useState<PlantOption[]>([]);
  const [plantsLoading, setPlantsLoading] = useState(true);
  const [plantsError, setPlantsError] = useState<unknown>(null);

  const [values, setValues] = useState<FormValues>(emptyFormValues());
  const [issues, setIssues] = useState<FormIssue[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<{ imageId: string; plantId: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load plants
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const allPlants = await deps.plantService.listPlants();
        if (!cancelled) {
          const options: PlantOption[] = allPlants.map((p) => ({
            plant_id: p.plant_id,
            group_name: p.group_name,
            exemplar_id: p.exemplar_id,
            treatment_percentage: p.treatment_percentage,
            pot_id: p.pot_id,
            sowing_date: p.sowing_date ?? null,
          }));
          options.sort((a, b) => {
            const groupOrder = { G1: 1, G2: 2, G3: 3 };
            const gDiff = groupOrder[a.group_name as keyof typeof groupOrder] - groupOrder[b.group_name as keyof typeof groupOrder];
            if (gDiff !== 0) return gDiff;
            return a.exemplar_id.localeCompare(b.exemplar_id);
          });
          setPlants(options);
        }
      } catch (err) {
        if (!cancelled) setPlantsError(err);
      } finally {
        if (!cancelled) setPlantsLoading(false);
      }
      return () => { cancelled = true; };
    })();
  }, [deps]);

  // Group plants by group
  const groups = useMemo(() => {
    const map: Record<string, PlantOption[]> = { G1: [], G2: [], G3: [] };
    for (const p of plants) map[p.group_name].push(p);
    return map;
  }, [plants]);

  const selectedPlant = useMemo(() => plants.find((p) => p.plant_id === values.plant_id), [plants, values.plant_id]);

  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setValues((prev) => ({ ...prev, file }));
    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setIssues((prev) => prev.filter((i) => i.field !== "file"));
  };

  const handleFieldChange = (field: string, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setIssues((prev) => prev.filter((i) => i.field !== field));
  };

  const handleTimestampNow = () => {
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace("T", "T");
    setValues((prev) => ({ ...prev, timestamp }));
    setIssues((prev) => prev.filter((i) => i.field !== "timestamp"));
  };

  const handleExperimentDayNow = () => {
    const today = new Date().toISOString().slice(0, 10);
    setValues((prev) => ({ ...prev, experiment_day: today }));
    setIssues((prev) => prev.filter((i) => i.field !== "experiment_day"));
  };

  const handleTriggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const validationIssues = validateForm(values);
    if (validationIssues.length > 0) {
      setIssues(validationIssues);
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);
    setError(null);
    setSuccess(null);

    try {
      const sowingDate = selectedPlant?.sowing_date ?? null;
      const input = buildUploadInput(values, sowingDate);
      setUploadProgress(30);

      // Upload image
      const uploaded = await deps.imageService.uploadImage(input);
      setUploadProgress(70);

      // Verify image
      const verified = await deps.imageService.verifyImageFile(uploaded.image_id);
      setUploadProgress(100);

      if (!verified) {
        throw new Error("Image upload succeeded but file could not be verified on the server.");
      }

      setSuccess({ imageId: uploaded.image_id, plantId: input.plant_id });
      setValues(emptyFormValues());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  const handleNextPlant = () => {
    setSuccess(null);
    setValues(emptyFormValues());
  };

  const handleRetry = () => {
    setError(null);
  };

  if (plantsLoading) {
    return (
      <section className="page" aria-labelledby="capture-title">
        <PageHeader
          eyebrow="Quick Capture"
          title="Capture photograph"
          description="Select a plant, open camera, save evidence."
          titleId="capture-title"
        />
        <div className="panel">
          <div className="loading-note" role="status">
            <span className="loading-dot" aria-hidden="true" />
            Loading plant register…
          </div>
        </div>
      </section>
    );
  }

  if (plantsError) {
    return (
      <section className="page" aria-labelledby="capture-title">
        <PageHeader
          eyebrow="Quick Capture"
          title="Capture photograph"
          titleId="capture-title"
        />
        <div className="panel panel-alert">
          <p className="empty-state-title">Could not load plant register</p>
          <ErrorSummary error={plantsError} fallbackMessage="Failed to load plants from the backend" />
        </div>
      </section>
    );
  }

  const totalPlants = plants.length;
  const groupNames = ["G1", "G2", "G3"] as const;

  return (
    <section className="page capture" aria-labelledby="capture-title">
      <PageHeader
        eyebrow="Quick Capture"
        title="Capture photograph"
        description="Select a plant, open camera, save evidence. Minimal interaction — the app fills in the rest."
        titleId="capture-title"
      />

      {/* Plant Selector */}
      <section className="panel capture-plant-selector" aria-labelledby="plant-selector-heading">
        <h2 id="plant-selector-heading" className="section-heading">Plant</h2>
        <p className="section-heading-note">
          {totalPlants} plants registered across G1, G2, G3. Choose group, then exemplar.
        </p>

        <div className="capture-group-tabs" role="tablist" aria-label="Treatment groups">
          {(["G1", "G2", "G3"] as const).map((group) => {
            const groupPlants = groups[group] ?? [];
            const treatment = groupPlants[0]?.treatment_percentage ?? (group === "G1" ? 100 : group === "G2" ? 85 : 70);
            const isActive = Boolean(values.plant_id && selectedPlant?.group_name === group);
            return (
              <button
                key={group}
                role="tab"
                aria-selected={isActive}
                className={`capture-group-tab ${isActive ? "active" : ""}`}
                onClick={() => {
                  if (groupPlants.length > 0) {
                    setValues((prev) => ({ ...prev, plant_id: groupPlants[0].plant_id }));
                    setIssues((prev) => prev.filter((i) => i.field !== "plant_id"));
                  }
                }}
                disabled={groupPlants.length === 0}
              >
                <span className="tab-group">{group}</span>
                <span className="tab-treatment">{treatment}%</span>
                <span className="tab-count">{groupPlants.length} plants</span>
              </button>
            );
          })}
        </div>

        {values.plant_id && selectedPlant && (
          <div className="capture-selected-plant">
            <span className="plant-badge">
              <span className={`badge-group badge-group-${selectedPlant.group_name}`}>{selectedPlant.group_name}</span>
              <span className="badge-exemplar">{selectedPlant.exemplar_id}</span>
            </span>
            <span className="plant-meta">POT {selectedPlant.pot_id} · {selectedPlant.treatment_percentage}% target</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setValues((prev) => ({ ...prev, plant_id: "" }))}>
              Change plant
            </button>
          </div>
        )}

        <div className="capture-exemplar-grid" role="listbox" aria-label="Select exemplar">
          {groups.G1.map((p) => (
            <button
              key={p.plant_id}
              role="option"
              aria-selected={values.plant_id === p.plant_id}
              className={`capture-exemplar-btn ${values.plant_id === p.plant_id ? "selected" : ""} badge-group-G1`}
              onClick={() => {
                setValues((prev) => ({ ...prev, plant_id: p.plant_id }));
                setIssues((prev) => prev.filter((i) => i.field !== "plant_id"));
              }}
            >
              {p.exemplar_id}
            </button>
          ))}
          {groups.G2.map((p) => (
            <button
              key={p.plant_id}
              role="option"
              aria-selected={values.plant_id === p.plant_id}
              className={`capture-exemplar-btn ${values.plant_id === p.plant_id ? "selected" : ""} badge-group-G2`}
              onClick={() => {
                setValues((prev) => ({ ...prev, plant_id: p.plant_id }));
                setIssues((prev) => prev.filter((i) => i.field !== "plant_id"));
              }}
            >
              {p.exemplar_id}
            </button>
          ))}
          {groups.G3.map((p) => (
            <button
              key={p.plant_id}
              role="option"
              aria-selected={values.plant_id === p.plant_id}
              className={`capture-exemplar-btn ${values.plant_id === p.plant_id ? "selected" : ""} badge-group-G3`}
              onClick={() => {
                setValues((prev) => ({ ...prev, plant_id: p.plant_id }));
                setIssues((prev) => prev.filter((i) => i.field !== "plant_id"));
              }}
            >
              {p.exemplar_id}
            </button>
          ))}
        </div>

        {issues.some((i) => i.field === "plant_id") && (
          <p className="form-error">{issues.find((i) => i.field === "plant_id")!.message}</p>
        )}
      </section>

      {/* Capture Form */}
      <form className="panel capture-form" onSubmit={handleSubmit} noValidate>
        <div className="capture-preview" aria-label="Image preview" role="button" tabIndex={0} onClick={handleTriggerFileInput} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTriggerFileInput(); } }}>
          {previewUrl ? (
            <>
              <img src={previewUrl} alt="Image preview" />
              <div className="capture-preview__overlay">
                <span className="capture-preview__overlay-label">Změnit fotku</span>
                <button
                  type="button"
                  className="capture-preview__overlay-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTriggerFileInput();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleTriggerFileInput();
                    }
                  }}
                >
                  Vybrat jinou
                </button>
              </div>
            </>
          ) : (
            <div className="capture-placeholder" role="button" tabIndex={0} onClick={handleTriggerFileInput} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTriggerFileInput(); } }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" />
                <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                <path d="M21 15l-5-5L5 17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="capture-placeholder__label">Přidat fotku</p>
              <p className="capture-placeholder__hint">Vyfotit nebo vybrat ze zařízení</p>
            </div>
          )}
        </div>

        <div className="capture-form-grid">
          <div className="form-field">
            <label htmlFor="capture-experiment-day" className="form-label">
              Experiment day <span className="form-required" aria-hidden="true">*</span>
            </label>
            <div className="input-with-action">
              <input
                id="capture-experiment-day"
                type="date"
                value={values.experiment_day}
                onChange={(e) => handleFieldChange("experiment_day", e.target.value)}
                disabled={submitting}
                required
              />
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleExperimentDayNow} disabled={submitting}>
                Today
              </button>
            </div>
            {issues.some((i) => i.field === "experiment_day") && (
              <p className="form-error">{issues.find((i) => i.field === "experiment_day")!.message}</p>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="capture-timestamp" className="form-label">
              Timestamp <span className="form-required" aria-hidden="true">*</span>
            </label>
            <div className="input-with-action">
              <input
                id="capture-timestamp"
                type="datetime-local"
                value={values.timestamp}
                onChange={(e) => handleFieldChange("timestamp", e.target.value)}
                disabled={submitting}
                required
              />
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleTimestampNow} disabled={submitting}>
                Now
              </button>
            </div>
            {issues.some((i) => i.field === "timestamp") && (
              <p className="form-error">{issues.find((i) => i.field === "timestamp")!.message}</p>
            )}
          </div>

<div className="form-field">
            <label htmlFor="capture-file" className="form-label">
              Image file <span className="form-required" aria-hidden="true">*</span>
            </label>
            <input
              ref={fileInputRef}
              id="capture-file"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              disabled={submitting}
              required
              style={{ display: "none" }}
            />
            {issues.some((i) => i.field === "file") && (
              <p className="form-error">{issues.find((i) => i.field === "file")!.message}</p>
            )}
            {values.file && (
              <p className="form-hint">Selected: {values.file.name} ({(values.file.size / 1024).toFixed(1)} KB)</p>
            )}
          </div>

          <div className="form-field span-2">
            <label htmlFor="capture-notes" className="form-label">Notes (optional)</label>
            <textarea
              id="capture-notes"
              value={values.notes}
              onChange={(e) => handleFieldChange("notes", e.target.value)}
              placeholder="Optional observation notes…"
              rows={3}
              disabled={submitting}
            />
          </div>
        </div>

        {/* Upload progress */}
        {uploadProgress !== null && (
          <div className="capture-progress" role="progressbar" aria-valuenow={uploadProgress} aria-valuemin={0} aria-valuemax={100}>
            <div className="capture-progress-bar" style={{ width: `${uploadProgress}%` }} />
            <span className="capture-progress-text">{uploadProgress}%</span>
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary btn-lg" disabled={submitting || !values.file || !values.plant_id}>
            {submitting ? "Saving…" : "Save observation"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={handleNextPlant} disabled={submitting || !success}>
            Next plant
          </button>
        </div>

        {success ? (
          <div className="capture-success">
            <StatusBadge status="PASS" />
            <strong>Observation saved.</strong>
            Image <Link to={`/images/${success.imageId}`}>{success.imageId}</Link> recorded for {success.plantId}.
          </div>
        ) : null}

        {error ? (
          <div className="capture-error">
            <StatusBadge status="FAIL" />
            <ErrorSummary error={error} fallbackMessage="Observation could not be saved" />
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleRetry}>
              Retry
            </button>
          </div>
        ) : null}

        {issues.some((i) => i.field !== "plant_id") ? (
          <ErrorSummary error={issues} fallbackMessage="Please fix the validation errors above" />
        ) : null}
      </form>

      {/* Recent captures for this plant */}
      {values.plant_id && (
        <section className="panel capture-recent" aria-labelledby="recent-heading">
          <h2 id="recent-heading" className="section-heading">Recent captures for {selectedPlant?.group_name} · {selectedPlant?.exemplar_id}</h2>
          {/* This would load recent images for the selected plant */}
          <p className="muted-note">Recent captures will appear here after saving.</p>
        </section>
      )}
    </section>
  );
}