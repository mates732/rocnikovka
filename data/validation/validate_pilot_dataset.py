#!/usr/bin/env python3
"""Deterministic validator for pilot CSV datasets.

The script checks schema-level and relational consistency for Phase 3 pilot data.
It does not modify input files.
"""

from __future__ import annotations

import argparse
import csv
import os
import re
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Set

ALLOWED_GROUPS = {"G0", "G1", "G2"}
ALLOWED_PLANT_STATUS = {"active", "damaged", "dead", "excluded"}
ALLOWED_WATER_STATUS = {"pass", "warn", "fail"}
ALLOWED_QUALITY_STATUS = {"PASS", "WARN", "FAIL"}
ALLOWED_CALIBRATION_STATUS = {"pass", "warn", "fail"}
ALLOWED_MEASUREMENT_STATUS = {"pass", "warn", "fail"}
ALLOWED_DETECTION_STATUS = {"pass", "fail"}
ALLOWED_SEGMENTATION_STATUS = {"pass", "fail", "not_applicable"}
ALLOWED_FAILURE_CODES = {
    "none",
    "no_detection",
    "poor_image_quality",
    "occlusion",
    "plant_damaged",
    "plant_dead",
    "calibration_failed",
}

TS_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$")


@dataclass
class CheckResult:
    level: str
    code: str
    message: str


def read_csv(path: str) -> List[Dict[str, str]]:
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        return list(reader)


def is_valid_iso_ts(value: str) -> bool:
    if not value or not TS_PATTERN.match(value):
        return False
    try:
        datetime.strptime(value, "%Y-%m-%dT%H:%M:%S")
        return True
    except ValueError:
        return False


def safe_float(value: str):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def safe_int(value: str):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def check_duplicates(rows: List[Dict[str, str]], key: str, table: str) -> List[CheckResult]:
    out: List[CheckResult] = []
    values = [r.get(key, "") for r in rows if r.get(key, "")]
    dup = [k for k, c in Counter(values).items() if c > 1]
    for item in dup:
        out.append(CheckResult("FAIL", "DUPLICATE_ID", f"{table}: duplicate {key}={item}"))
    return out


def check_required(rows: List[Dict[str, str]], required: List[str], table: str) -> List[CheckResult]:
    out: List[CheckResult] = []
    for idx, row in enumerate(rows, start=2):
        for field in required:
            if row.get(field, "") == "":
                out.append(CheckResult("FAIL", "MISSING_REQUIRED", f"{table}: row {idx} missing {field}"))
    return out


def validate(data_dir: str) -> List[CheckResult]:
    res: List[CheckResult] = []

    plants = read_csv(os.path.join(data_dir, "plants.csv"))
    positions = read_csv(os.path.join(data_dir, "positions_log.csv"))
    water = read_csv(os.path.join(data_dir, "water_log.csv"))
    images = read_csv(os.path.join(data_dir, "images_log.csv"))
    manual = read_csv(os.path.join(data_dir, "manual_measurements.csv"))
    ai = read_csv(os.path.join(data_dir, "ai_measurements.csv"))

    if not any([plants, positions, water, images, manual, ai]):
        res.append(CheckResult("WARN", "NO_DATA", "No pilot CSV files found or files are empty."))
        return res

    res.extend(check_duplicates(plants, "plant_id", "plants.csv"))
    res.extend(check_duplicates(positions, "position_event_id", "positions_log.csv"))
    res.extend(check_duplicates(water, "water_event_id", "water_log.csv"))
    res.extend(check_duplicates(images, "image_id", "images_log.csv"))
    res.extend(check_duplicates(manual, "measurement_id", "manual_measurements.csv"))
    res.extend(check_duplicates(ai, "measurement_id", "ai_measurements.csv"))

    res.extend(check_required(plants, ["plant_id", "pot_id", "group", "emergence_date", "status"], "plants.csv"))
    res.extend(check_required(positions, ["position_event_id", "position_id", "timestamp", "plant_id", "location", "operator", "reason"], "positions_log.csv"))
    res.extend(check_required(water, ["water_event_id", "plant_id", "timestamp", "experiment_day", "pot_mass_before_g", "target_mass_g", "water_added_ml", "pot_mass_after_g", "watering_status"], "water_log.csv"))
    res.extend(check_required(images, ["image_id", "plant_id", "timestamp", "experiment_day", "image_path", "camera_id", "image_quality_status", "calibration_status"], "images_log.csv"))
    res.extend(check_required(manual, ["measurement_id", "plant_id", "timestamp", "experiment_day", "repetition", "observer", "measurement_status"], "manual_measurements.csv"))
    res.extend(check_required(ai, ["measurement_id", "image_id", "plant_id", "timestamp", "model", "model_version", "pipeline_version", "detection_status", "segmentation_status", "calibration_status", "failure_code"], "ai_measurements.csv"))

    plant_ids: Set[str] = {r["plant_id"] for r in plants if r.get("plant_id")}
    image_to_plant: Dict[str, str] = {r["image_id"]: r["plant_id"] for r in images if r.get("image_id") and r.get("plant_id")}

    for row in plants:
        if row.get("group") and row["group"] not in ALLOWED_GROUPS:
            res.append(CheckResult("FAIL", "INVALID_GROUP", f"plants.csv: invalid group {row['group']}"))
        if row.get("status") and row["status"] not in ALLOWED_PLANT_STATUS:
            res.append(CheckResult("FAIL", "INVALID_PLANT_STATUS", f"plants.csv: invalid status {row['status']}"))

    for table_name, rows in [
        ("positions_log.csv", positions),
        ("water_log.csv", water),
        ("images_log.csv", images),
        ("manual_measurements.csv", manual),
        ("ai_measurements.csv", ai),
    ]:
        for idx, row in enumerate(rows, start=2):
            pid = row.get("plant_id", "")
            if pid and pid not in plant_ids:
                res.append(CheckResult("FAIL", "ORPHAN_PLANT", f"{table_name}: row {idx} unknown plant_id={pid}"))
            ts = row.get("timestamp", "")
            if ts and not is_valid_iso_ts(ts):
                res.append(CheckResult("FAIL", "INVALID_TIMESTAMP", f"{table_name}: row {idx} invalid timestamp={ts}"))

    for idx, row in enumerate(water, start=2):
        for field in ["pot_mass_before_g", "target_mass_g", "water_added_ml", "pot_mass_after_g"]:
            v = safe_float(row.get(field, ""))
            if v is None:
                res.append(CheckResult("FAIL", "INVALID_NUMBER", f"water_log.csv: row {idx} {field} not numeric"))
        for field in ["pot_mass_before_g", "water_added_ml", "pot_mass_after_g"]:
            v = safe_float(row.get(field, ""))
            if v is not None and v < 0:
                res.append(CheckResult("FAIL", "NEGATIVE_VALUE", f"water_log.csv: row {idx} negative {field}"))
        t = safe_float(row.get("target_mass_g", ""))
        if t is not None and t <= 0:
            res.append(CheckResult("FAIL", "INVALID_TARGET_MASS", f"water_log.csv: row {idx} target_mass_g must be > 0"))
        ed = safe_int(row.get("experiment_day", ""))
        if ed is None or ed < 1:
            res.append(CheckResult("FAIL", "INVALID_EXPERIMENT_DAY", f"water_log.csv: row {idx} invalid experiment_day"))
        status = row.get("watering_status", "")
        if status and status not in ALLOWED_WATER_STATUS:
            res.append(CheckResult("FAIL", "INVALID_STATUS", f"water_log.csv: row {idx} invalid watering_status={status}"))

    for idx, row in enumerate(images, start=2):
        ed = safe_int(row.get("experiment_day", ""))
        if ed is None or ed < 1:
            res.append(CheckResult("FAIL", "INVALID_EXPERIMENT_DAY", f"images_log.csv: row {idx} invalid experiment_day"))
        if row.get("image_quality_status", "") not in ALLOWED_QUALITY_STATUS:
            res.append(CheckResult("FAIL", "INVALID_QUALITY_STATUS", f"images_log.csv: row {idx} invalid image_quality_status"))
        if row.get("calibration_status", "") not in ALLOWED_CALIBRATION_STATUS:
            res.append(CheckResult("FAIL", "INVALID_CALIBRATION_STATUS", f"images_log.csv: row {idx} invalid calibration_status"))
        failure_code = row.get("failure_code", "") or "none"
        if failure_code not in ALLOWED_FAILURE_CODES:
            res.append(CheckResult("FAIL", "INVALID_FAILURE_CODE", f"images_log.csv: row {idx} invalid failure_code={failure_code}"))

    for idx, row in enumerate(manual, start=2):
        ed = safe_int(row.get("experiment_day", ""))
        rep = safe_int(row.get("repetition", ""))
        if ed is None or ed < 1:
            res.append(CheckResult("FAIL", "INVALID_EXPERIMENT_DAY", f"manual_measurements.csv: row {idx} invalid experiment_day"))
        if rep not in (1, 2):
            res.append(CheckResult("FAIL", "INVALID_REPETITION", f"manual_measurements.csv: row {idx} repetition must be 1 or 2"))
        status = row.get("measurement_status", "")
        if status not in ALLOWED_MEASUREMENT_STATUS:
            res.append(CheckResult("FAIL", "INVALID_STATUS", f"manual_measurements.csv: row {idx} invalid measurement_status={status}"))
        h = safe_float(row.get("plant_height_cm", ""))
        if status == "pass":
            if h is None or h <= 0:
                res.append(CheckResult("FAIL", "INVALID_HEIGHT", f"manual_measurements.csv: row {idx} pass requires plant_height_cm > 0"))
        failure_code = row.get("failure_code", "") or "none"
        if failure_code not in ALLOWED_FAILURE_CODES:
            res.append(CheckResult("FAIL", "INVALID_FAILURE_CODE", f"manual_measurements.csv: row {idx} invalid failure_code={failure_code}"))

    for idx, row in enumerate(ai, start=2):
        ed = safe_int(row.get("experiment_day", "0"))
        if row.get("detection_status", "") not in ALLOWED_DETECTION_STATUS:
            res.append(CheckResult("FAIL", "INVALID_DETECTION_STATUS", f"ai_measurements.csv: row {idx} invalid detection_status"))
        if row.get("segmentation_status", "") not in ALLOWED_SEGMENTATION_STATUS:
            res.append(CheckResult("FAIL", "INVALID_SEGMENTATION_STATUS", f"ai_measurements.csv: row {idx} invalid segmentation_status"))
        if row.get("calibration_status", "") not in ALLOWED_CALIBRATION_STATUS:
            res.append(CheckResult("FAIL", "INVALID_CALIBRATION_STATUS", f"ai_measurements.csv: row {idx} invalid calibration_status"))
        image_id = row.get("image_id", "")
        if image_id and image_id not in image_to_plant:
            res.append(CheckResult("FAIL", "ORPHAN_IMAGE", f"ai_measurements.csv: row {idx} unknown image_id={image_id}"))
        if image_id in image_to_plant:
            expected_plant = image_to_plant[image_id]
            if row.get("plant_id", "") != expected_plant:
                res.append(CheckResult("FAIL", "BROKEN_LINK", f"ai_measurements.csv: row {idx} plant_id does not match images_log for image_id={image_id}"))
        conf = row.get("confidence", "")
        if conf not in ("", "NA"):
            fv = safe_float(conf)
            if fv is None or fv < 0 or fv > 1:
                res.append(CheckResult("FAIL", "INVALID_CONFIDENCE", f"ai_measurements.csv: row {idx} confidence outside 0..1"))
        failure_code = row.get("failure_code", "") or "none"
        if failure_code not in ALLOWED_FAILURE_CODES:
            res.append(CheckResult("FAIL", "INVALID_FAILURE_CODE", f"ai_measurements.csv: row {idx} invalid failure_code={failure_code}"))

    if not res:
        res.append(CheckResult("PASS", "VALIDATION_OK", "No issues found."))
    return res


def summarize(results: List[CheckResult]) -> str:
    counts = Counter([r.level for r in results])
    return f"PASS={counts.get('PASS', 0)} WARN={counts.get('WARN', 0)} FAIL={counts.get('FAIL', 0)}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate pilot dataset CSV files.")
    parser.add_argument("--data-dir", default="data", help="Directory with CSV files (default: data)")
    parser.add_argument("--output", default="", help="Optional path to write validation report")
    args = parser.parse_args()

    results = validate(args.data_dir)
    lines = ["# Pilot Dataset Validation Report", "", summarize(results), ""]
    for item in results:
        lines.append(f"- [{item.level}] {item.code}: {item.message}")
    content = "\n".join(lines) + "\n"

    print(content)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(content)

    has_fail = any(r.level == "FAIL" for r in results)
    return 1 if has_fail else 0


if __name__ == "__main__":
    raise SystemExit(main())
