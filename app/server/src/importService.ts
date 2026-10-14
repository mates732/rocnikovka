import type Database from "better-sqlite3";
import type {
  AICVMeasurement,
  ImageRecord,
  ManualMeasurement,
  Plant,
  PositionEvent,
  WaterEvent,
} from "./types.js";
import {
  validateAICVMeasurement,
  validateImageRecord,
  validateManualMeasurement,
  validatePlant,
  validatePositionEvent,
  validateWaterEvent,
} from "./validation/schema.js";
import {
  SqliteAICVMeasurementRepository,
  SqliteImageRecordRepository,
  SqliteManualMeasurementRepository,
  SqlitePlantRepository,
  SqlitePositionEventRepository,
  SqliteWaterEventRepository,
} from "./repositories/sqliteRepositories.js";
import type {
  AICVMeasurementRepository,
  ImageRecordRepository,
  ManualMeasurementRepository,
  PlantRepository,
  PositionEventRepository,
  WaterEventRepository,
} from "./repositories/interfaces.js";

export type ImportEntity =
  | "plants"
  | "water_events"
  | "position_events"
  | "image_records"
  | "manual_measurements"
  | "aicv_measurements";

export const IMPORT_ENTITIES: readonly ImportEntity[] = [
  "plants",
  "water_events",
  "position_events",
  "image_records",
  "manual_measurements",
  "aicv_measurements",
];

export type ImportFormat = "current" | "legacy";

export type ImportResult = {
  entity: ImportEntity;
  rows_read: number;
  rows_inserted: number;
  rows_skipped_idempotent: number;
};

export type ImportIssue = {
  file: string;
  /** Physical 1-based CSV line where the record starts; 0 = file-level issue. */
  row: number;
  entity: ImportEntity;
  field: string;
  code: string;
  message: string;
};

export type ImportError = {
  code: string;
  message: string;
  issues: ImportIssue[];
};

export type ImportOptions = {
  entity: ImportEntity;
  filename: string;
  content: string;
  formatVersion?: ImportFormat;
};

function createIssue(
  file: string,
  row: number,
  entity: ImportEntity,
  field: string,
  code: string,
  message: string
): ImportIssue {
  return { file, row, entity, field, code, message };
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

type RawRecord = { line: number; cells: string[] };

type ParseIssue = { line: number; code: "csv.structure" | "csv.empty"; message: string };

type ParseResult = {
  headers: string[];
  rows: RawRecord[];
  issues: ParseIssue[];
};

const DECIMAL_NUMBER_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

function isEmptyValue(value: string): boolean {
  return value === "" || value === "NA";
}

/**
 * RFC 4180-style parser: comma delimiter, double-quoted fields, "" escapes,
 * quoted fields may span lines. Returns physical line numbers for records.
 */
function parseCsv(content: string): ParseResult {
  const source = content.replace(/^\uFEFF/, "");
  const headers: string[] = [];
  const rows: RawRecord[] = [];
  const issues: ParseIssue[] = [];

  if (source.trim() === "") {
    return { headers, rows, issues: [{ line: 0, code: "csv.empty", message: "CSV file is empty" }] };
  }

  const records: RawRecord[] = [];
  let currentField = "";
  let currentRecord: string[] = [];
  let inQuotes = false;
  let fieldStarted = false;
  let line = 1;
  let recordStartLine = 1;
  let unterminatedAt: number | null = null;

  const pushField = () => {
    currentRecord.push(currentField);
    currentField = "";
    fieldStarted = false;
  };
  const pushRecord = () => {
    pushField();
    records.push({ line: recordStartLine, cells: currentRecord });
    currentRecord = [];
    fieldStarted = false;
  };

  for (let i = 0; i < source.length; i++) {
    const char = source[i];

    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
        if (char === "\n") line++;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      fieldStarted = true;
      continue;
    }
    if (char === ",") {
      pushField();
      continue;
    }
    if (char === "\n") {
      if (fieldStarted || currentField !== "" || currentRecord.length > 0) {
        pushRecord();
      }
      recordStartLine = line + 1;
      line++;
      continue;
    }
    if (char === "\r") {
      continue;
    }
    currentField += char;
    fieldStarted = true;
  }

  if (inQuotes) {
    unterminatedAt = recordStartLine;
  } else if (fieldStarted || currentField !== "" || currentRecord.length > 0) {
    pushRecord();
  }

  if (records.length === 0) {
    return {
      headers,
      rows,
      issues: [{ line: 0, code: "csv.empty", message: "CSV file has no header row" }],
    };
  }

  headers.push(...records[0].cells);

  if (unterminatedAt !== null) {
    issues.push({
      line: unterminatedAt,
      code: "csv.structure",
      message: "Unterminated quoted field (missing closing quote before end of file)",
    });
  }

  for (let i = 1; i < records.length; i++) {
    const record = records[i];
    const isEmptyRecord = record.cells.length === 1 && record.cells[0] === "";
    if (isEmptyRecord) continue;
    if (record.cells.length !== headers.length) {
      issues.push({
        line: record.line,
        code: "csv.structure",
        message: `Row has ${record.cells.length} field(s); header defines ${headers.length}`,
      });
      continue;
    }
    rows.push(record);
  }

  return { headers, rows, issues };
}

// ---------------------------------------------------------------------------
// Field-level parsing helpers
// ---------------------------------------------------------------------------

type RowParseResult<T> = { value: T } | { issues: ImportIssue[] };

function readTextValue(
  row: Record<string, string>,
  headerName: string,
  headersPresent: Set<string>,
  aliasNames: string[]
): string | undefined {
  const names = [headerName, ...aliasNames];
  for (const name of names) {
    if (headersPresent.has(name)) {
      const raw = row[name];
      if (raw === undefined) return undefined;
      const trimmed = raw.trim();
      return isEmptyValue(trimmed) ? undefined : trimmed;
    }
  }
  return undefined;
}

function readNumberValue(
  row: Record<string, string>,
  headerName: string,
  headersPresent: Set<string>,
  file: string,
  rowNum: number,
  entity: ImportEntity,
  issues: ImportIssue[]
): number | undefined {
  const raw = readTextValue(row, headerName, headersPresent, []);
  if (raw === undefined) return undefined;
  if (!DECIMAL_NUMBER_RE.test(raw)) {
    issues.push(
      createIssue(file, rowNum, entity, headerName, "number.invalid_format", `Value '${raw}' is not a valid number`)
    );
    return undefined;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    issues.push(
      createIssue(file, rowNum, entity, headerName, "number.invalid_format", `Value '${raw}' is not a valid number`)
    );
    return undefined;
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Per-entity column definitions
// ---------------------------------------------------------------------------

type EntityMeta = {
  entity: ImportEntity;
  /** DB field name -> accepted CSV header names (first is canonical). */
  columns: Record<string, string[]>;
  /** DB field names that must be present in the CSV header (aliases accepted). */
  requiredFields: string[];
};

const ENTITY_META: Record<ImportEntity, EntityMeta> = {
  plants: {
    entity: "plants",
    columns: {
      plant_id: ["plant_id"],
      pot_id: ["pot_id"],
      group_name: ["group", "group_name"],
      emergence_date: ["emergence_date"],
      status: ["status"],
      notes: ["notes"],
      created_at: ["created_at"],
      updated_at: ["updated_at"],
    },
    requiredFields: ["plant_id", "pot_id", "group_name", "emergence_date", "status", "created_at"],
  },
  water_events: {
    entity: "water_events",
    columns: {
      water_event_id: ["water_event_id"],
      plant_id: ["plant_id"],
      timestamp: ["timestamp"],
      experiment_day: ["experiment_day"],
      pot_mass_before_g: ["pot_mass_before_g"],
      target_mass_g: ["target_mass_g"],
      water_added_ml: ["water_added_ml"],
      pot_mass_after_g: ["pot_mass_after_g"],
      watering_status: ["watering_status"],
      operator: ["operator"],
      notes: ["notes"],
    },
    requiredFields: [
      "water_event_id",
      "plant_id",
      "timestamp",
      "experiment_day",
      "pot_mass_before_g",
      "target_mass_g",
      "water_added_ml",
      "pot_mass_after_g",
      "watering_status",
    ],
  },
  position_events: {
    entity: "position_events",
    columns: {
      position_event_id: ["position_event_id"],
      position_id: ["position_id"],
      timestamp: ["timestamp"],
      plant_id: ["plant_id"],
      location: ["location"],
      previous_location: ["previous_location"],
      operator: ["operator"],
      reason: ["reason"],
      notes: ["notes"],
    },
    requiredFields: [
      "position_event_id",
      "position_id",
      "timestamp",
      "plant_id",
      "location",
      "operator",
      "reason",
    ],
  },
  image_records: {
    entity: "image_records",
    columns: {
      image_id: ["image_id"],
      plant_id: ["plant_id"],
      timestamp: ["timestamp"],
      experiment_day: ["experiment_day"],
      image_path: ["image_path"],
      camera_id: ["camera_id"],
      image_quality_status: ["image_quality_status"],
      calibration_status: ["calibration_status"],
      cal_ref_id: ["cal_ref_id"],
      failure_code: ["failure_code"],
      notes: ["notes"],
    },
    requiredFields: [
      "image_id",
      "plant_id",
      "timestamp",
      "experiment_day",
      "image_path",
      "camera_id",
      "image_quality_status",
      "calibration_status",
    ],
  },
  manual_measurements: {
    entity: "manual_measurements",
    columns: {
      measurement_id: ["measurement_id"],
      plant_id: ["plant_id"],
      image_id: ["image_id"],
      timestamp: ["timestamp"],
      experiment_day: ["experiment_day"],
      repetition: ["repetition"],
      attempt: ["attempt"],
      plant_height_cm: ["plant_height_cm"],
      observer: ["observer"],
      measurement_status: ["measurement_status"],
      failure_code: ["failure_code"],
      notes: ["notes"],
    },
    requiredFields: [
      "measurement_id",
      "plant_id",
      "timestamp",
      "experiment_day",
      "repetition",
      "attempt",
      "observer",
      "measurement_status",
    ],
  },
  aicv_measurements: {
    entity: "aicv_measurements",
    columns: {
      measurement_id: ["measurement_id"],
      image_id: ["image_id"],
      plant_id: ["plant_id"],
      timestamp: ["timestamp"],
      experiment_day: ["experiment_day"],
      model: ["model"],
      model_version: ["model_version"],
      pipeline_version: ["pipeline_version"],
      detection_status: ["detection_status"],
      segmentation_status: ["segmentation_status"],
      calibration_status: ["calibration_status"],
      plant_height_cm: ["plant_height_cm"],
      projected_area_cm2: ["projected_area_cm2"],
      confidence: ["confidence"],
      failure_code: ["failure_code"],
      notes: ["notes"],
    },
    requiredFields: [
      "measurement_id",
      "image_id",
      "plant_id",
      "timestamp",
      "experiment_day",
      "model",
      "model_version",
      "pipeline_version",
      "detection_status",
      "segmentation_status",
      "calibration_status",
      "failure_code",
    ],
  },
};

type RowData = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Row parsers (CSV row -> typed entity + parse-level issues)
// ---------------------------------------------------------------------------

function textField(row: RowData, field: string): string | undefined {
  const value = row[field];
  return typeof value === "string" ? value : undefined;
}

function numberField(row: RowData, field: string): number | undefined {
  const value = row[field];
  return typeof value === "number" ? value : undefined;
}

function parsePlantRow(
  raw: Record<string, string>,
  headersPresent: Set<string>,
  file: string,
  rowNum: number
): RowParseResult<Plant> {
  const issues: ImportIssue[] = [];
  const getText = (field: string, canonical: string) =>
    readTextValue(raw, canonical, headersPresent, ENTITY_META.plants.columns[field].slice(1));

  const plant: Plant = {
    plant_id: getText("plant_id", "plant_id") as string,
    pot_id: getText("pot_id", "pot_id") as string,
    group_name: getText("group_name", "group") as Plant["group_name"],
    emergence_date: getText("emergence_date", "emergence_date") as string,
    status: getText("status", "status") as Plant["status"],
    notes: getText("notes", "notes"),
    created_at: getText("created_at", "created_at") as string,
    updated_at: getText("updated_at", "updated_at"),
  };
  return issues.length > 0 ? { issues } : { value: plant };
}

function parseWaterRow(
  raw: Record<string, string>,
  headersPresent: Set<string>,
  file: string,
  rowNum: number
): RowParseResult<WaterEvent> {
  const issues: ImportIssue[] = [];
  const entity = "water_events";
  const getText = (canonical: string) =>
    readTextValue(raw, canonical, headersPresent, ENTITY_META.water_events.columns[canonical].slice(1));

  const water: WaterEvent = {
    water_event_id: getText("water_event_id") as string,
    plant_id: getText("plant_id") as string,
    timestamp: getText("timestamp") as string,
    experiment_day: readNumberValue(raw, "experiment_day", headersPresent, file, rowNum, entity, issues) as number,
    pot_mass_before_g: readNumberValue(raw, "pot_mass_before_g", headersPresent, file, rowNum, entity, issues) as number,
    target_mass_g: readNumberValue(raw, "target_mass_g", headersPresent, file, rowNum, entity, issues) as number,
    water_added_ml: readNumberValue(raw, "water_added_ml", headersPresent, file, rowNum, entity, issues) as number,
    pot_mass_after_g: readNumberValue(raw, "pot_mass_after_g", headersPresent, file, rowNum, entity, issues) as number,
    watering_status: getText("watering_status") as WaterEvent["watering_status"],
    operator: getText("operator"),
    notes: getText("notes"),
  };
  return issues.length > 0 ? { issues } : { value: water };
}

function parsePositionRow(
  raw: Record<string, string>,
  headersPresent: Set<string>,
  file: string,
  rowNum: number
): RowParseResult<PositionEvent> {
  const issues: ImportIssue[] = [];
  const getText = (canonical: string) =>
    readTextValue(raw, canonical, headersPresent, ENTITY_META.position_events.columns[canonical].slice(1));

  const position: PositionEvent = {
    position_event_id: getText("position_event_id") as string,
    position_id: getText("position_id") as string,
    timestamp: getText("timestamp") as string,
    plant_id: getText("plant_id") as string,
    location: getText("location") as string,
    previous_location: getText("previous_location"),
    operator: getText("operator") as string,
    reason: getText("reason") as PositionEvent["reason"],
    notes: getText("notes"),
  };
  return issues.length > 0 ? { issues } : { value: position };
}

function parseImageRow(
  raw: Record<string, string>,
  headersPresent: Set<string>,
  file: string,
  rowNum: number
): RowParseResult<ImageRecord> {
  const issues: ImportIssue[] = [];
  const entity = "image_records";
  const getText = (canonical: string) =>
    readTextValue(raw, canonical, headersPresent, ENTITY_META.image_records.columns[canonical].slice(1));

  const image: ImageRecord = {
    image_id: getText("image_id") as string,
    plant_id: getText("plant_id") as string,
    timestamp: getText("timestamp") as string,
    experiment_day: readNumberValue(raw, "experiment_day", headersPresent, file, rowNum, entity, issues) as number,
    image_path: getText("image_path") as string,
    camera_id: getText("camera_id") as string,
    image_quality_status: getText("image_quality_status") as ImageRecord["image_quality_status"],
    calibration_status: getText("calibration_status") as ImageRecord["calibration_status"],
    cal_ref_id: getText("cal_ref_id"),
    failure_code: getText("failure_code") as ImageRecord["failure_code"],
    notes: getText("notes"),
  };
  return issues.length > 0 ? { issues } : { value: image };
}

function parseManualRow(
  raw: Record<string, string>,
  headersPresent: Set<string>,
  file: string,
  rowNum: number,
  legacyAttemptDefault: boolean
): RowParseResult<ManualMeasurement> {
  const issues: ImportIssue[] = [];
  const entity = "manual_measurements";
  const getText = (canonical: string) =>
    readTextValue(raw, canonical, headersPresent, ENTITY_META.manual_measurements.columns[canonical].slice(1));

  const hasAttemptColumn = ENTITY_META.manual_measurements.columns.attempt.some((name) =>
    headersPresent.has(name)
  );
  let attempt: number | undefined;
  if (hasAttemptColumn) {
    attempt = readNumberValue(raw, "attempt", headersPresent, file, rowNum, entity, issues);
    if (attempt === undefined && !issues.some((x) => x.field === "attempt")) {
      issues.push(
        createIssue(file, rowNum, entity, "attempt", "required.missing", "Required field is missing")
      );
    } else if (attempt !== undefined && (!Number.isInteger(attempt) || attempt < 1)) {
      issues.push(
        createIssue(file, rowNum, entity, "attempt", "number.out_of_range", "attempt must be an integer >= 1")
      );
    }
  } else if (legacyAttemptDefault) {
    attempt = 1;
  }

  const manual: ManualMeasurement = {
    measurement_id: getText("measurement_id") as string,
    plant_id: getText("plant_id") as string,
    image_id: getText("image_id"),
    timestamp: getText("timestamp") as string,
    experiment_day: readNumberValue(raw, "experiment_day", headersPresent, file, rowNum, entity, issues) as number,
    repetition: readNumberValue(raw, "repetition", headersPresent, file, rowNum, entity, issues) as 1 | 2,
    attempt: attempt as number,
    plant_height_cm: readNumberValue(raw, "plant_height_cm", headersPresent, file, rowNum, entity, issues),
    observer: getText("observer") as string,
    measurement_status: getText("measurement_status") as ManualMeasurement["measurement_status"],
    failure_code: getText("failure_code") as ManualMeasurement["failure_code"],
    notes: getText("notes"),
    method: "MANUAL",
  };
  return issues.length > 0 ? { issues } : { value: manual };
}

function parseAicvRow(
  raw: Record<string, string>,
  headersPresent: Set<string>,
  file: string,
  rowNum: number
): RowParseResult<AICVMeasurement> {
  const issues: ImportIssue[] = [];
  const entity = "aicv_measurements";
  const getText = (canonical: string) =>
    readTextValue(raw, canonical, headersPresent, ENTITY_META.aicv_measurements.columns[canonical].slice(1));

  const aicv: AICVMeasurement = {
    measurement_id: getText("measurement_id") as string,
    image_id: getText("image_id") as string,
    plant_id: getText("plant_id") as string,
    timestamp: getText("timestamp") as string,
    experiment_day: readNumberValue(raw, "experiment_day", headersPresent, file, rowNum, entity, issues) as number,
    model: getText("model") as string,
    model_version: getText("model_version") as string,
    pipeline_version: getText("pipeline_version") as string,
    detection_status: getText("detection_status") as AICVMeasurement["detection_status"],
    segmentation_status: getText("segmentation_status") as AICVMeasurement["segmentation_status"],
    calibration_status: getText("calibration_status") as AICVMeasurement["calibration_status"],
    plant_height_cm: readNumberValue(raw, "plant_height_cm", headersPresent, file, rowNum, entity, issues),
    projected_area_cm2: readNumberValue(raw, "projected_area_cm2", headersPresent, file, rowNum, entity, issues),
    confidence: readNumberValue(raw, "confidence", headersPresent, file, rowNum, entity, issues),
    failure_code: getText("failure_code") as AICVMeasurement["failure_code"],
    notes: getText("notes"),
  };
  return issues.length > 0 ? { issues } : { value: aicv };
}

// ---------------------------------------------------------------------------
// Import service
// ---------------------------------------------------------------------------

export function createImportService(db: Database.Database) {
  const plantsRepo: PlantRepository = new SqlitePlantRepository(db);
  const waterRepo: WaterEventRepository = new SqliteWaterEventRepository(db);
  const positionRepo: PositionEventRepository = new SqlitePositionEventRepository(db);
  const imageRepo: ImageRecordRepository = new SqliteImageRecordRepository(db);
  const manualRepo: ManualMeasurementRepository = new SqliteManualMeasurementRepository(db);
  const aicvRepo: AICVMeasurementRepository = new SqliteAICVMeasurementRepository(db);

  const plantExists = (plantId: string): boolean => plantsRepo.getById(plantId) !== undefined;
  const imageExists = (imageId: string): boolean => imageRepo.getById(imageId) !== undefined;

  const PERSISTED_FIELDS: Record<ImportEntity, string[]> = {
    plants: ["plant_id", "pot_id", "group_name", "emergence_date", "status", "notes", "created_at", "updated_at"],
    water_events: [
      "water_event_id",
      "plant_id",
      "timestamp",
      "experiment_day",
      "pot_mass_before_g",
      "target_mass_g",
      "water_added_ml",
      "pot_mass_after_g",
      "watering_status",
      "operator",
      "notes",
    ],
    position_events: [
      "position_event_id",
      "position_id",
      "timestamp",
      "plant_id",
      "location",
      "previous_location",
      "operator",
      "reason",
      "notes",
    ],
    image_records: [
      "image_id",
      "plant_id",
      "timestamp",
      "experiment_day",
      "image_path",
      "camera_id",
      "image_quality_status",
      "calibration_status",
      "cal_ref_id",
      "failure_code",
      "notes",
    ],
    manual_measurements: [
      "measurement_id",
      "plant_id",
      "image_id",
      "timestamp",
      "experiment_day",
      "repetition",
      "attempt",
      "plant_height_cm",
      "observer",
      "measurement_status",
      "failure_code",
      "notes",
      "method",
    ],
    aicv_measurements: [
      "measurement_id",
      "image_id",
      "plant_id",
      "timestamp",
      "experiment_day",
      "model",
      "model_version",
      "pipeline_version",
      "detection_status",
      "segmentation_status",
      "calibration_status",
      "plant_height_cm",
      "projected_area_cm2",
      "confidence",
      "failure_code",
      "notes",
    ],
  };

  /** Normalizes undefined and empty strings to null so CSV values compare with DB rows. */
  function canonicalCompare(record: Record<string, unknown>, fields: string[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const field of fields) {
      const value = record[field];
      out[field] = value === undefined || value === "" ? null : value;
    }
    return out;
  }

  function recordsEqual(
    a: Record<string, unknown>,
    b: Record<string, unknown>,
    fields: string[]
  ): boolean {
    const ca = canonicalCompare(a, fields);
    const cb = canonicalCompare(b, fields);
    for (const field of fields) {
      if (ca[field] !== cb[field]) return false;
    }
    return true;
  }

  function mapValidationIssues(
    entity: ImportEntity,
    issues: { field: string; code: string; message: string }[],
    file: string,
    rowNum: number
  ): ImportIssue[] {
    return issues.map((issue) => createIssue(file, rowNum, entity, issue.field, issue.code, issue.message));
  }

  function validateReferences(
    entity: ImportEntity,
    parsed: RowData,
    file: string,
    rowNum: number,
    issues: ImportIssue[]
  ): void {
    // plants rows ARE the parents; never FK-check them against themselves.
    if (entity === "plants") return;

    const plantId = textField(parsed, "plant_id");
    if (plantId !== undefined && !plantExists(plantId)) {
      issues.push(
        createIssue(
          file,
          rowNum,
          entity,
          "plant_id",
          "reference.missing_parent",
          `plant_id '${plantId}' does not exist in plants (import plants first)`
        )
      );
    }

    // image_id is only a parent reference for measurements; in image_records it is the row's own PK.
    const imageId = textField(parsed, "image_id");
    const imageIsReference = entity === "manual_measurements" || entity === "aicv_measurements";
    if (imageIsReference && imageId !== undefined && !imageExists(imageId)) {
      issues.push(
        createIssue(
          file,
          rowNum,
          entity,
          "image_id",
          "reference.missing_parent",
          `image_id '${imageId}' does not exist in image_records (import images first)`
        )
      );
    }
  }

  function validateAicvConsistency(
    parsed: RowData,
    file: string,
    rowNum: number,
    issues: ImportIssue[]
  ): void {
    const imageId = textField(parsed, "image_id");
    if (imageId === undefined) return;
    const image = imageRepo.getById(imageId);
    if (!image) return; // already reported as reference.missing_parent

    const plantId = textField(parsed, "plant_id");
    if (plantId !== undefined && plantId !== image.plant_id) {
      issues.push(
        createIssue(
          file,
          rowNum,
          "aicv_measurements",
          "plant_id",
          "validation.plant_id_mismatch",
          `plant_id '${plantId}' does not match image_records.plant_id '${image.plant_id}'`
        )
      );
    }

    const experimentDay = numberField(parsed, "experiment_day");
    if (experimentDay !== undefined && experimentDay !== image.experiment_day) {
      issues.push(
        createIssue(
          file,
          rowNum,
          "aicv_measurements",
          "experiment_day",
          "validation.experiment_day_mismatch",
          `experiment_day ${experimentDay} does not match image_records.experiment_day ${image.experiment_day}`
        )
      );
    }
  }

  function formatIssue(
    options: ImportOptions,
    field: string,
    message: string,
    row = 0
  ): ImportIssue {
    return createIssue(options.filename, row, options.entity, field, "format.missing_column", message);
  }

  function importEntity(options: ImportOptions): ImportResult {
    const { entity, filename, content } = options;
    const formatVersion: ImportFormat = options.formatVersion ?? "current";
    const meta = ENTITY_META[entity];
    const parsedCsv = parseCsv(content);
    const allIssues: ImportIssue[] = [];

    for (const parseIssue of parsedCsv.issues) {
      allIssues.push(createIssue(filename, parseIssue.line, entity, "", parseIssue.code, parseIssue.message));
    }
    if (parsedCsv.headers.length === 0) {
      throw { code: "import.validation_failed", message: "CSV import failed", issues: allIssues };
    }

    const headersPresent = new Set(parsedCsv.headers);
    const rows = parsedCsv.rows;

    // File-level format validation: required fields must be present in the header.
    for (const required of meta.requiredFields) {
      const accepted = meta.columns[required];
      const present = accepted.some((name) => headersPresent.has(name));
      if (!present) {
        if (entity === "manual_measurements" && required === "attempt" && formatVersion === "legacy") {
          // Legacy manual CSV without attempt is allowed; rows default attempt=1.
        } else if (entity === "manual_measurements" && required === "attempt") {
          allIssues.push(
            formatIssue(
              options,
              "attempt",
              "Column 'attempt' is required for manual_measurements in current format; import a legacy CSV (without attempt) by sending format_version=legacy (attempt will be set to 1)"
            )
          );
        } else if (entity === "aicv_measurements" && required === "experiment_day") {
          allIssues.push(
            formatIssue(
              options,
              "experiment_day",
              "Column 'experiment_day' is required for aicv_measurements; legacy ai_measurements CSVs without experiment_day cannot be imported"
            )
          );
        } else {
          const canonical = accepted[0];
          allIssues.push(
            formatIssue(
              options,
              canonical,
              `Required column '${canonical}' is missing from the CSV header`
            )
          );
        }
      }
    }

    if (allIssues.length > 0) {
      throw {
        code: "import.validation_failed",
        message: "CSV import failed",
        issues: allIssues,
      };
    }

    const rowValueFactory: (raw: Record<string, string>, rowNum: number) => RowParseResult<unknown> =
      entity === "plants"
        ? (raw, rowNum) => parsePlantRow(raw, headersPresent, filename, rowNum)
        : entity === "water_events"
          ? (raw, rowNum) => parseWaterRow(raw, headersPresent, filename, rowNum)
          : entity === "position_events"
            ? (raw, rowNum) => parsePositionRow(raw, headersPresent, filename, rowNum)
            : entity === "image_records"
              ? (raw, rowNum) => parseImageRow(raw, headersPresent, filename, rowNum)
              : entity === "manual_measurements"
                ? (raw, rowNum) =>
                    parseManualRow(
                      raw,
                      headersPresent,
                      filename,
                      rowNum,
                      formatVersion === "legacy"
                    )
                : (raw, rowNum) => parseAicvRow(raw, headersPresent, filename, rowNum);

    const sharedValidator =
      entity === "plants"
        ? validatePlant
        : entity === "water_events"
          ? validateWaterEvent
          : entity === "position_events"
            ? validatePositionEvent
            : entity === "image_records"
              ? validateImageRecord
              : entity === "manual_measurements"
                ? validateManualMeasurement
                : validateAICVMeasurement;

    const getter = (id: string): unknown =>
      entity === "plants"
        ? plantsRepo.getById(id)
        : entity === "water_events"
          ? waterRepo.getById(id)
          : entity === "position_events"
            ? positionRepo.getById(id)
            : entity === "image_records"
              ? imageRepo.getById(id)
              : entity === "manual_measurements"
                ? manualRepo.getById(id)
                : aicvRepo.getById(id);

    const creator = (row: unknown): void => {
      if (entity === "plants") plantsRepo.create(row as Plant);
      else if (entity === "water_events") waterRepo.create(row as WaterEvent);
      else if (entity === "position_events") positionRepo.create(row as PositionEvent);
      else if (entity === "image_records") imageRepo.create(row as ImageRecord);
      else if (entity === "manual_measurements") manualRepo.create(row as ManualMeasurement);
      else aicvRepo.create(row as AICVMeasurement);
    };

    const fields = PERSISTED_FIELDS[entity];
    let rowsInserted = 0;
    let rowsSkippedIdempotent = 0;
    const pending: unknown[] = [];
    const pendingIds = new Set<string>();
    const pendingById = new Map<string, unknown>();

    const idFieldName = fields[0];
    const idOf = (row: unknown): string => textField(row as RowData, idFieldName) ?? "";

    for (let i = 0; i < rows.length; i++) {
      const rawCells = rows[i];
      const rowNum = rawCells.line;
      const raw: Record<string, string> = {};
      for (let j = 0; j < parsedCsv.headers.length; j++) {
        raw[parsedCsv.headers[j]] = rawCells.cells[j];
      }

      const parsedResult = rowValueFactory(raw, rowNum) as RowParseResult<unknown>;
      if ("issues" in parsedResult) {
        allIssues.push(...parsedResult.issues);
        continue;
      }
      const rowEntity = parsedResult.value as RowData;

      // Shared validators (enums, IDs, timestamps, numbers, required fields).
      const validation = (sharedValidator as (input: unknown) => { valid: boolean; issues: { field: string; code: string; message: string }[] })(
        rowEntity
      );
      if (!validation.valid) {
        allIssues.push(...mapValidationIssues(entity, validation.issues, filename, rowNum));
        continue;
      }

      // Entity-specific import rules and DB reference checks (row-attributed).
      const rowIssues: ImportIssue[] = [];
      if (entity === "aicv_measurements") {
        validateAicvConsistency(rowEntity, filename, rowNum, rowIssues);
      }
      validateReferences(entity, rowEntity, filename, rowNum, rowIssues);

      if (entity === "plants") {
        const plantId = textField(rowEntity, "plant_id");
        const potId = textField(rowEntity, "pot_id");
        if (plantId && potId) {
          const other = db
            .prepare("SELECT plant_id FROM plants WHERE pot_id = ? AND plant_id <> ?")
            .get(potId, plantId) as { plant_id: string } | undefined;
          if (other) {
            rowIssues.push(
              createIssue(
                filename,
                rowNum,
                entity,
                "pot_id",
                "id.conflict",
                `pot_id '${potId}' is already assigned to plant '${other.plant_id}'`
              )
            );
          }
        }
      }

      if (rowIssues.length > 0) {
        allIssues.push(...rowIssues);
        continue;
      }

      const id = idOf(rowEntity);

      const existing = getter(id) as RowData | undefined;
      const duplicateInFile = pendingIds.has(id) ? (pendingById.get(id) as RowData) : undefined;

      if (duplicateInFile !== undefined) {
        if (recordsEqual(duplicateInFile, rowEntity, fields)) {
          rowsSkippedIdempotent++;
        } else {
          allIssues.push(
            createIssue(
              filename,
              rowNum,
              entity,
              idFieldName,
              "id.conflict",
              `Duplicate ID '${id}' with different data within the same file`
            )
          );
        }
        continue;
      }

      if (existing !== undefined) {
        if (recordsEqual(existing, rowEntity, fields)) {
          rowsSkippedIdempotent++;
        } else {
          allIssues.push(
            createIssue(
              filename,
              rowNum,
              entity,
              idFieldName,
              "id.conflict",
              `Duplicate ID '${id}' with different data already exists in the database`
            )
          );
        }
        continue;
      }

      pending.push(rowEntity);
      pendingIds.add(id);
      pendingById.set(id, rowEntity);
    }

    if (allIssues.length > 0) {
      throw {
        code: "import.validation_failed",
        message: `CSV import failed with ${allIssues.length} issue(s); no rows were committed`,
        issues: allIssues,
      };
    }

    if (pending.length > 0) {
      const insertAll = db.transaction(() => {
        for (const row of pending) {
          creator(row);
        }
      });
      try {
        insertAll();
      } catch {
        throw {
          code: "import.failed",
          message: "Import failed while writing rows; no rows were committed",
          issues: [],
        };
      }
      rowsInserted = pending.length;
    }

    return {
      entity,
      rows_read: rows.length,
      rows_inserted: rowsInserted,
      rows_skipped_idempotent: rowsSkippedIdempotent,
    };
  }

  return { importEntity };
}

export type ImportService = ReturnType<typeof createImportService>;
