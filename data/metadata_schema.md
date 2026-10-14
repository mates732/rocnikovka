# Metadata Schema (Phase 2)

## Účel
Tento dokument definuje metadata entity a jejich vazby pro sběr dat v pilotní a následné realizační fázi.

## Zásady návrhu
- Jednoznačná dohledatelnost napříč entitami.
- Stabilní a neměnitelná ID po vytvoření.
- RAW data jsou immutable.
- Pole jsou volena pro kompatibilitu s CSV, pandas, Git a následným exportem do Excelu.

## Entity a pole

## 1) PLANT
Popis: Stabilní registr rostlin v experimentu.

Povinná pole:
- `plant_id` (string, unikátní, immutable)
- `pot_id` (string, unikátní v čase, immutable)
- `group` (enum: G0, G1, G2)
- `emergence_date` (date, ISO 8601: YYYY-MM-DD)
- `status` (enum: active, damaged, dead, excluded)

Volitelná pole:
- `notes` (string)
- `created_at` (datetime, ISO 8601)
- `updated_at` (datetime, ISO 8601)

## 2) POSITION
Popis: Auditní log umístění květináče/rostliny v čase.

Povinná pole:
- `position_event_id` (string, unikátní)
- `position_id` (string, identifikátor fyzické pozice, např. P01)
- `timestamp` (datetime, ISO 8601)
- `plant_id` (string, FK -> PLANT.plant_id)
- `location` (string, cílová lokace)
- `previous_location` (string nebo NULL)
- `operator` (string)
- `reason` (enum: initial_assignment, rotation, manual_override)

Volitelná pole:
- `notes` (string)

## 3) WATER
Popis: Denní gravimetrické vážení a zálivka.

Povinná pole:
- `water_event_id` (string, unikátní)
- `plant_id` (string, FK -> PLANT.plant_id)
- `timestamp` (datetime, ISO 8601)
- `experiment_day` (integer, >= 1)
- `pot_mass_before_g` (float, >= 0)
- `target_mass_g` (float, > 0)
- `water_added_ml` (float, >= 0)
- `pot_mass_after_g` (float, >= 0)
- `watering_status` (enum: pass, warn, fail)

Volitelná pole:
- `notes` (string)
- `operator` (string)

## 4) IMAGE
Popis: Registr pořízených snímků.

Povinná pole:
- `image_id` (string, unikátní, immutable)
- `plant_id` (string, FK -> PLANT.plant_id)
- `timestamp` (datetime, ISO 8601)
- `experiment_day` (integer, >= 1)
- `image_path` (string, relativní cesta v repozitáři/datovém úložišti)
- `camera_id` (string)
- `image_quality_status` (enum: PASS, WARN, FAIL)
- `calibration_status` (enum: pass, warn, fail)

Volitelná pole:
- `cal_ref_id` (string)
- `failure_code` (enum dle Protocol v1)
- `notes` (string)

## 5) MANUAL MEASUREMENT
Popis: Nezávislá manuální reference 3x týdně, 2 opakování.

Povinná pole:
- `measurement_id` (string, unikátní)
- `plant_id` (string, FK -> PLANT.plant_id)
- `timestamp` (datetime, ISO 8601)
- `experiment_day` (integer, >= 1)
- `repetition` (integer, povoleno: 1, 2)
- `plant_height_cm` (float, > 0 při pass)
- `observer` (string)
- `measurement_status` (enum: pass, warn, fail)

Volitelná pole:
- `notes` (string)
- `failure_code` (enum: poor_image_quality, occlusion, plant_damaged, plant_dead, no_detection, calibration_failed)

## 6) AI/CV MEASUREMENT
Popis: Výstup automatizovaného měření nad konkrétním snímkem.

Povinná pole:
- `measurement_id` (string, unikátní)
- `image_id` (string, FK -> IMAGE.image_id)
- `plant_id` (string, FK -> PLANT.plant_id)
- `timestamp` (datetime, ISO 8601)
- `model` (string)
- `model_version` (string)
- `pipeline_version` (string)
- `detection_status` (enum: pass, fail)
- `segmentation_status` (enum: pass, fail, not_applicable)
- `calibration_status` (enum: pass, warn, fail)
- `plant_height_cm` (float nebo NULL při fail)
- `projected_area_cm2` (float nebo NULL při fail)
- `confidence` (float v intervalu 0-1 nebo NULL)
- `failure_code` (enum: no_detection, poor_image_quality, occlusion, plant_damaged, plant_dead, calibration_failed, none)

Volitelná pole:
- `notes` (string)

## Vazby mezi entitami
- PLANT 1:N WATER
- PLANT 1:N IMAGE
- PLANT 1:N MANUAL MEASUREMENT
- IMAGE 1:N AI/CV MEASUREMENT
- PLANT 1:N POSITION

## Identifikátory a stabilita
- `plant_id`, `pot_id`, `image_id`, `measurement_id`, `water_event_id`, `position_event_id` jsou po vytvoření immutable.
- ID nesmí obsahovat pole, která se mohou měnit během experimentu (např. group, location).

## Poznámka ke kompatibilitě
Názvy sloupců používají ASCII, snake_case a explicitní jednotky v názvu (`_g`, `_ml`, `_cm`, `_cm2`) kvůli jednoznačnosti při importu do pandas a statistikách.
