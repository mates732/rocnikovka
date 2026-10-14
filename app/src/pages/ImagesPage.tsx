import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { DetailPanel } from "../components/DetailPanel";
import { ErrorSummary } from "../components/ErrorSummary";
import { EvidenceThumb } from "../components/EvidenceThumb";
import { ExperimentDayContext } from "../components/ExperimentDayContext";
import { ImageViewer } from "../components/ImageViewer";
import { PageHeader } from "../components/PageHeader";
import { useDayContext } from "../hooks/useDayContext";
import { services } from "../data/adapters";
import { normalizeTimestampToSeconds } from "./ExperimentPages";
import type { ImageService, PlantService } from "../services/interfaces";
import type {
  CalibrationStatus,
  FailureCode,
  ImageQualityStatus,
  ImageRecord,
  Plant,
  PlantDayContext,
} from "../types/entities";
import type { UploadImageInput } from "../types/write";

const headers = [
  "Image ID",
  "Plant ID",
  "Timestamp",
  "Experiment day",
  "Quality status",
  "Calibration status",
  "Camera ID",
];

// ============================================================================
// Image acquisition (Phase 4K.8)
// ----------------------------------------------------------------------------
// The photograph is the primary input to the future AI/CV experiment, so the
// form mirrors the exact POST /api/images/upload contract. The file is passed
// through untouched (RAW — no resizing/cropping/recompression), experiment_day
// and timestamp are explicitly entered (never derived), and verification after
// upload fetches the stored file back through the controlled serving route —
// a local browser preview is never treated as proof of storage.
// ============================================================================

const TIMESTAMP_SECOND_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
const INTEGER_RE = /^\d+$/;
const QUALITY_STATUSES: ImageQualityStatus[] = ["PASS", "WARN", "FAIL"];
const CALIBRATION_STATUSES: CalibrationStatus[] = ["pass", "warn", "fail"];
const IMAGE_FAILURE_CODES: FailureCode[] = [
  "no_detection",
  "poor_image_quality",
  "occlusion",
  "plant_damaged",
  "plant_dead",
  "calibration_failed",
  "none",
];
/** Mirrors MAX_IMAGE_UPLOAD_BYTES in the backend image upload service. */
const MAX_IMAGE_UPLOAD_BYTES = 15 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = new Set(["image/jpeg", "image/png"]);

/** The server-backed URL for a stored RAW image (controlled route only). */
export function imageFileUrl(imageId: string): string {
  return `/api/images/${encodeURIComponent(imageId)}/file`;
}

export type ImageFormValues = {
  plant_id: string;
  experiment_day: string;
  timestamp: string; // datetime-local value YYYY-MM-DDTHH:MM
  camera_id: string;
  image_quality_status: "" | ImageQualityStatus;
  calibration_status: "" | CalibrationStatus;
  cal_ref_id: string;
  failure_code: "" | FailureCode;
  notes: string;
};

export type ImageFormIssue = { field: string; code: string; message: string };

export function emptyImageFormValues(): ImageFormValues {
  return {
    plant_id: "",
    experiment_day: "",
    timestamp: "",
    camera_id: "",
    image_quality_status: "",
    calibration_status: "",
    cal_ref_id: "",
    failure_code: "",
    notes: "",
  };
}

/** Local UX validation mirroring the backend upload contract (backend remains authoritative). */
export function validateImageForm(values: ImageFormValues, file: File | null): ImageFormIssue[] {
  const issues: ImageFormIssue[] = [];
  const add = (field: string, code: string, message: string) => issues.push({ field, code, message });

  if (!values.plant_id) {
    add("plant_id", "required", "Select a plant.");
  }

  const day = values.experiment_day.trim();
  if (day === "") {
    add("experiment_day", "required", "Experiment day is required.");
  } else if (!INTEGER_RE.test(day) || Number(day) < 1) {
    add("experiment_day", "number.out_of_range", "Experiment day must be an integer of at least 1.");
  }

  if (values.timestamp.trim() === "") {
    add("timestamp", "required", "Timestamp is required.");
  } else if (!TIMESTAMP_SECOND_RE.test(normalizeTimestampToSeconds(values.timestamp.trim()))) {
    add("timestamp", "timestamp.invalid_format", "Timestamp must look like YYYY-MM-DDTHH:MM.");
  }

  if (values.camera_id.trim() === "") {
    add("camera_id", "required", "Camera ID is required.");
  }

  if (!values.image_quality_status) {
    add("image_quality_status", "required", "Select an image quality status.");
  } else if (!QUALITY_STATUSES.includes(values.image_quality_status)) {
    add("image_quality_status", "enum.invalid", "Image quality must be PASS, WARN or FAIL.");
  }

  if (!values.calibration_status) {
    add("calibration_status", "required", "Select a calibration status.");
  } else if (!CALIBRATION_STATUSES.includes(values.calibration_status)) {
    add("calibration_status", "enum.invalid", "Calibration status must be pass, warn or fail.");
  }

  if (values.failure_code && !IMAGE_FAILURE_CODES.includes(values.failure_code)) {
    add("failure_code", "enum.invalid", "Unknown failure code.");
  }

  if (!file) {
    add("file", "required", "Select an image file.");
  } else {
    if (file.type !== "" && !ACCEPTED_FILE_TYPES.has(file.type)) {
      add("file", "file.unsupported_type", "Only JPEG and PNG images are supported.");
    }
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      add("file", "file.too_large", `The image must be at most ${Math.floor(MAX_IMAGE_UPLOAD_BYTES / (1024 * 1024))} MB.`);
    }
  }

  return issues;
}

/** Build the exact UploadImageInput — only supported fields, RAW file untouched. */
export function buildUploadInput(values: ImageFormValues, file: File): UploadImageInput {
  const input: UploadImageInput = {
    file,
    plant_id: values.plant_id,
    timestamp: normalizeTimestampToSeconds(values.timestamp.trim()),
    experiment_day: Number(values.experiment_day),
    camera_id: values.camera_id.trim(),
    image_quality_status: values.image_quality_status as ImageQualityStatus,
    calibration_status: values.calibration_status as CalibrationStatus,
  };
  const calRefId = values.cal_ref_id.trim();
  if (calRefId) input.cal_ref_id = calRefId;
  const failureCode = values.failure_code;
  if (failureCode) input.failure_code = failureCode as FailureCode;
  const notes = values.notes.trim();
  if (notes) input.notes = notes;
  return input;
}

type VerificationState = "idle" | "checking" | "verified" | "failed";

type ImageUploadFormProps = {
  plants: Plant[];
  uploadImage: (input: UploadImageInput) => Promise<ImageRecord>;
  verifyImageFile: (imageId: string) => Promise<boolean>;
  onCreated: (created: ImageRecord) => void;
  /** Read-only day context used for the non-blocking rollback hint. */
  getDayContext: (plantId: string) => Promise<PlantDayContext | null>;
};

export function ImageUploadForm({ plants, uploadImage, verifyImageFile, onCreated, getDayContext }: ImageUploadFormProps) {
  const [values, setValues] = useState<ImageFormValues>(emptyImageFormValues);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [localIssues, setLocalIssues] = useState<ImageFormIssue[]>([]);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [createdRecord, setCreatedRecord] = useState<ImageRecord | null>(null);
  const [verification, setVerification] = useState<VerificationState>("idle");
  const [submitting, setSubmitting] = useState(false);
  const dayContext = useDayContext(getDayContext, values.plant_id);

  const handleFieldChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }) as ImageFormValues);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return; // also prevents duplicate submissions while in flight
    const local = validateImageForm(values, file);
    setLocalIssues(local);
    if (local.length > 0) return;
    if (!file) return;

    const input = buildUploadInput(values, file);

    setSubmitting(true);
    setSubmitError(null);
    setCreatedRecord(null);
    setVerification("idle");
    try {
      // The backend response is the source of truth for what was persisted.
      const created = await uploadImage(input);
      setCreatedRecord(created);
      // Keep the plant for consecutive captures; clear the rest only after the
      // POST succeeded.
      setValues({ ...emptyImageFormValues(), plant_id: values.plant_id });
      setFile(null);
      setFileKey((key) => key + 1); // force-remount the file input (clears it)
      onCreated(created);

      // Verification: fetch the stored file back through the controlled route.
      // A local browser preview is never treated as proof of storage.
      setVerification("checking");
      const verified = await verifyImageFile(created.image_id);
      setVerification(verified ? "verified" : "failed");
    } catch (err) {
      // Preserve every entered value on failure; ApiError is rendered by
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
        <label className="form-field" htmlFor="img-plant">
          <span className="form-label">
            Plant <span className="form-required" aria-hidden="true">*</span>
          </span>
          <select id="img-plant" name="plant_id" value={values.plant_id} onChange={handleFieldChange} disabled={submitting}>
            <option value="">Select a plant</option>
            {plants.map((plant) => (
              <option key={plant.plant_id} value={plant.plant_id}>
                {plant.plant_id} · pot {plant.pot_id}
              </option>
            ))}
          </select>
          {renderIssues("plant_id")}
        </label>

        <label className="form-field" htmlFor="img-experiment-day">
          <span className="form-label">
            Experiment day <span className="form-required" aria-hidden="true">*</span>
          </span>
          <input
            id="img-experiment-day"
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

        <label className="form-field" htmlFor="img-timestamp">
          <span className="form-label">
            Timestamp <span className="form-required" aria-hidden="true">*</span>
          </span>
          <input id="img-timestamp" type="datetime-local" name="timestamp" value={values.timestamp} onChange={handleFieldChange} disabled={submitting} />
          {renderIssues("timestamp")}
        </label>

        <label className="form-field" htmlFor="img-camera">
          <span className="form-label">
            Camera ID <span className="form-required" aria-hidden="true">*</span>
          </span>
          <input id="img-camera" type="text" name="camera_id" value={values.camera_id} onChange={handleFieldChange} disabled={submitting} />
          <span className="form-hint">Explicitly entered; never defaulted.</span>
          {renderIssues("camera_id")}
        </label>

        <label className="form-field" htmlFor="img-quality">
          <span className="form-label">
            Image quality <span className="form-required" aria-hidden="true">*</span>
          </span>
          <select id="img-quality" name="image_quality_status" value={values.image_quality_status} onChange={handleFieldChange} disabled={submitting}>
            <option value="">Select a quality status</option>
            {QUALITY_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          {renderIssues("image_quality_status")}
        </label>

        <label className="form-field" htmlFor="img-calibration">
          <span className="form-label">
            Calibration status <span className="form-required" aria-hidden="true">*</span>
          </span>
          <select id="img-calibration" name="calibration_status" value={values.calibration_status} onChange={handleFieldChange} disabled={submitting}>
            <option value="">Select a calibration status</option>
            {CALIBRATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          {renderIssues("calibration_status")}
        </label>

        <label className="form-field" htmlFor="img-cal-ref">
          <span className="form-label">Calibration reference ID</span>
          <input id="img-cal-ref" type="text" name="cal_ref_id" value={values.cal_ref_id} onChange={handleFieldChange} disabled={submitting} />
          {renderIssues("cal_ref_id")}
        </label>

        <label className="form-field" htmlFor="img-failure-code">
          <span className="form-label">Failure code</span>
          <select id="img-failure-code" name="failure_code" value={values.failure_code} onChange={handleFieldChange} disabled={submitting}>
            <option value="">None</option>
            {IMAGE_FAILURE_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
          {renderIssues("failure_code")}
        </label>

        <label className="form-field span-2" htmlFor="img-file">
          <span className="form-label">
            Image file <span className="form-required" aria-hidden="true">*</span>
          </span>
          <input
            key={fileKey}
            id="img-file"
            type="file"
            name="file"
            accept="image/jpeg,image/png"
            onChange={handleFileChange}
            disabled={submitting}
          />
          <span className="form-hint">RAW image (JPEG/PNG); never resized, cropped or recompressed in the browser.</span>
          {renderIssues("file")}
        </label>

        <label className="form-field span-2" htmlFor="img-notes">
          <span className="form-label">Notes</span>
          <textarea id="img-notes" name="notes" value={values.notes} onChange={handleFieldChange} disabled={submitting} />
          {renderIssues("notes")}
        </label>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Uploading image…" : "Upload image"}
        </button>
        <span className="form-hint">Required fields are marked with *.</span>
      </div>

      {createdRecord ? (
        <div className="upload-verification">
          <p className="form-success" role="status">
            Image {createdRecord.image_id} uploaded and stored.
          </p>
          <dl className="metadata-grid">
            <div>
              <dt>Image ID</dt>
              <dd>{createdRecord.image_id}</dd>
            </div>
            <div>
              <dt>Plant ID</dt>
              <dd>{createdRecord.plant_id}</dd>
            </div>
            <div>
              <dt>Experiment day</dt>
              <dd>{createdRecord.experiment_day}</dd>
            </div>
            <div>
              <dt>Timestamp</dt>
              <dd>{createdRecord.timestamp}</dd>
            </div>
            <div>
              <dt>Image quality</dt>
              <dd>{createdRecord.image_quality_status}</dd>
            </div>
            <div>
              <dt>Calibration status</dt>
              <dd>{createdRecord.calibration_status}</dd>
            </div>
            <div>
              <dt>Camera ID</dt>
              <dd>{createdRecord.camera_id}</dd>
            </div>
          </dl>
          {verification === "checking" ? (
            <p className="empty-state-description">Verifying stored image…</p>
          ) : verification === "verified" ? (
            <>
              <p className="form-success">Stored image verified — fetched back from the server.</p>
              <ImageViewer imageUrl={imageFileUrl(createdRecord.image_id)} alt={`Stored image ${createdRecord.image_id}`} />
            </>
          ) : verification === "failed" ? (
            <p className="empty-state-description">
              Image record created, but the stored file could not be verified.
            </p>
          ) : null}
        </div>
      ) : null}

      <ErrorSummary error={submitError} fallbackMessage="The image could not be uploaded." />
    </form>
  );
}

type ImagesPageDeps = {
  plantService: Pick<PlantService, "listPlants" | "getDayContext">;
  imageService: Pick<ImageService, "listImages" | "uploadImage" | "verifyImageFile">;
};

type ImagesPageProps = { services?: ImagesPageDeps };

export function ImagesPage({ services: deps = services }: ImagesPageProps = {}) {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [plants, setPlants] = useState<Plant[] | null>(null);
  const [plantsError, setPlantsError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await deps.imageService.listImages();
        if (!cancelled) setImages(data);
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

  const handleCreated = (created: ImageRecord) => {
    // Read-after-write: refresh from the backend so the list reflects the
    // persisted row (the backend response is the only truth used elsewhere).
    void deps.imageService
      .listImages()
      .then((data) => setImages(data))
      .catch((err) => setError(err));
  };

  return (
    <section className="page" aria-labelledby="images-title">
      <PageHeader
        eyebrow="Daily records"
        title="Images"
        description="Photographic evidence for each plant and experiment day — RAW files, never recompressed in the browser."
        titleId="images-title"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setFormOpen((open) => !open)}
            aria-expanded={formOpen}
          >
            {formOpen ? "Close form" : "Upload image"}
          </button>
        }
      />
      {formOpen ? (
        <section className="panel form-panel" aria-label="Upload an image">
          <div className="panel-heading">
            <h2>Upload image</h2>
            <p>Evidence acquisition — experiment day and timestamp are always entered explicitly.</p>
          </div>
          {plants === null ? (
            <p className="empty-state-description">Loading registered plants...</p>
          ) : plantsError ? (
            <ErrorSummary error={plantsError} fallbackMessage="Failed to load plants for the image upload form" />
          ) : plants.length === 0 ? (
            <p className="empty-state-description">
              No plants are registered yet. Register a plant before uploading an image.
            </p>
          ) : (
            <ImageUploadForm
              plants={plants}
              uploadImage={(input) => deps.imageService.uploadImage(input)}
              verifyImageFile={(imageId) => deps.imageService.verifyImageFile(imageId)}
              onCreated={handleCreated}
              getDayContext={(plantId) => deps.plantService.getDayContext(plantId)}
            />
          )}
        </section>
      ) : null}

      {loading ? (
        <div className="panel">
          <p className="empty-state-title">Loading images</p>
          <p className="empty-state-description">Fetching image records from the backend...</p>
        </div>
      ) : error ? (
        <div className="panel">
          <p className="empty-state-title">Unable to load images</p>
          <ErrorSummary error={error} fallbackMessage="Failed to load images from the backend" />
        </div>
      ) : (
        <DataTable
          caption="Image evidence"
          headers={headers}
          empty={images.length === 0}
          emptyMessage="No images recorded. Evidence for the first plant/day will appear here after the first upload."
        >
          {images.map((image) => (
            <tr key={image.image_id}>
              <td className="cell-evidence">
                <EvidenceThumb src={imageFileUrl(image.image_id)} />
                <div className="cell-evidence-main">
                  <Link className="id-link" to={`/images/${image.image_id}`}>
                    {image.image_id}
                  </Link>
                  <span className="cell-sub">RAW stored file</span>
                </div>
              </td>
              <td>
                <Link to={`/plants/${image.plant_id}`}>{image.plant_id}</Link>
              </td>
              <td className="nowrap">{image.timestamp}</td>
              <td>
                <span className="day-chip">Day {image.experiment_day}</span>
              </td>
              <td>
                <span className={`verdict verdict-${image.image_quality_status.toLowerCase()}`}>
                  {image.image_quality_status}
                </span>
              </td>
              <td>
                <span className={`verdict verdict-${image.calibration_status}`}>
                  {image.calibration_status === "pass" ? "PASS" : image.calibration_status === "warn" ? "WARN" : "FAIL"}
                </span>
              </td>
              <td className="mono-cell">{image.camera_id}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </section>
  );
}

export function ImageWorkspacePage() {
  const { imageId } = useParams();
  const [image, setImage] = useState<ImageRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    (async () => {
      if (!imageId) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const data = await services.imageService.getImageById(imageId);
        if (!cancelled) setImage(data);
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
  }, [imageId]);

  const metadata = image
    ? [
        { label: "Image ID", value: image.image_id },
        { label: "Plant ID", value: image.plant_id },
        { label: "Timestamp", value: image.timestamp },
        { label: "Experiment day", value: String(image.experiment_day) },
        { label: "Camera ID", value: image.camera_id },
        { label: "Image quality status", value: image.image_quality_status },
        { label: "Calibration status", value: image.calibration_status },
        { label: "Calibration reference ID", value: image.cal_ref_id ?? "—" },
        { label: "Failure code", value: image.failure_code ?? "—" },
        { label: "Notes", value: image.notes ?? "—" },
      ]
    : [];

  return (
    <section className="page" aria-labelledby="image-workspace-title">
      <PageHeader
        eyebrow="Evidence"
        title="Image record"
        description="A single photographic record: metadata, quality state and readiness for future AI/CV measurement."
        titleId="image-workspace-title"
      />

      {loading ? (
        <div className="panel">
          <p className="empty-state-title">Loading image</p>
          <p className="empty-state-description">Fetching image record from the backend...</p>
        </div>
      ) : error ? (
        <div className="panel">
          <p className="empty-state-title">Unable to load image</p>
          <ErrorSummary error={error} fallbackMessage="Failed to load image from the backend" />
        </div>
      ) : image ? (          <div className="workspace-grid">
          <section className="panel evidence-stage" aria-label="Image preview">
            <div className="panel-heading">
              <h2>Image preview</h2>
              <p>RAW file served from the controlled route.</p>
            </div>
            <ImageViewer imageUrl={imageFileUrl(image.image_id)} alt={`Stored image ${image.image_id}`} />
          </section>
          <DetailPanel
            kicker="Photographic record"
            title={image.image_id}
            status={image.image_quality_status}
            metadata={metadata}
            actions={
              <>
                <Link to={`/plants/${image.plant_id}`}>View plant</Link>
                <Link to="/images">Back to Images</Link>
              </>
            }
          />
        </div>
      ) : (
        <DetailPanel
          title="Image not found."
          status="NOT_RUN"
          metadata={[
            { label: "Requested image", value: imageId ?? "Unknown" },
            { label: "Data source", value: "Backend returned 404 image.not_found" },
          ]}
          actions={<Link to="/images">Back to Images</Link>}
        />
      )}
    </section>
  );
}