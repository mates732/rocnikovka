# Measurements Schema (Phase 2)

## Účel
Definice tabulárního formátu pro měření a návazné validační kontroly.

## Fyzický formát uložení
- Primární formát: CSV (`UTF-8`, oddělovač `,`, hlavička v prvním řádku).
- Datum/čas: ISO 8601 (`YYYY-MM-DDTHH:MM:SS`).
- Desetinný oddělovač: tečka (`.`).
- Chybějící hodnota: prázdné pole nebo `NA` (konzistentně v celé tabulce).

Důvod volby:
- přímá kompatibilita s Python/pandas,
- snadný diff v Git,
- jednoduchý export do Excelu,
- nízká provozní složitost.

## Soubory a sloupce

## 1) plants.csv
- `plant_id` (string, PK)
- `pot_id` (string)
- `group` (G0|G1|G2)
- `emergence_date` (date)
- `status` (active|damaged|dead|excluded)
- `notes` (string, optional)
- `created_at` (datetime)
- `updated_at` (datetime, optional)

## 2) positions_log.csv
- `position_event_id` (string, PK)
- `position_id` (string)
- `timestamp` (datetime)
- `plant_id` (string, FK -> plants.plant_id)
- `location` (string)
- `previous_location` (string, optional)
- `operator` (string)
- `reason` (initial_assignment|rotation|manual_override)
- `notes` (string, optional)

## 3) water_log.csv
- `water_event_id` (string, PK)
- `plant_id` (string, FK -> plants.plant_id)
- `timestamp` (datetime)
- `experiment_day` (int >= 1)
- `pot_mass_before_g` (float >= 0)
- `target_mass_g` (float > 0)
- `water_added_ml` (float >= 0)
- `pot_mass_after_g` (float >= 0)
- `watering_status` (pass|warn|fail)
- `operator` (string, optional)
- `notes` (string, optional)

## 4) images_log.csv
- `image_id` (string, PK)
- `plant_id` (string, FK -> plants.plant_id)
- `timestamp` (datetime)
- `experiment_day` (int >= 1)
- `image_path` (string)
- `camera_id` (string)
- `image_quality_status` (PASS|WARN|FAIL)
- `calibration_status` (pass|warn|fail)
- `cal_ref_id` (string, optional)
- `failure_code` (no_detection|poor_image_quality|occlusion|plant_damaged|plant_dead|calibration_failed|none)
- `notes` (string, optional)

## 5) manual_measurements.csv
- `measurement_id` (string, PK)
- `plant_id` (string, FK -> plants.plant_id)
- `image_id` (string, FK -> images_log.image_id, optional)
- `timestamp` (datetime)
- `experiment_day` (int >= 1)
- `repetition` (1|2)
- `attempt` (int >= 1, plánováno Phase 4G.6; retake po selhání)
- `plant_height_cm` (float, konečné > 0, povinný při pass)
- `observer` (string)
- `measurement_status` (pass|warn|fail)
- `failure_code` (no_detection|poor_image_quality|occlusion|plant_damaged|plant_dead|calibration_failed|none)
- `notes` (string, optional)

## 6) ai_measurements.csv
- `measurement_id` (string, PK)
- `image_id` (string, FK -> images_log.image_id)
- `plant_id` (string, FK -> plants.plant_id)
- `timestamp` (datetime)
- `experiment_day` (int >= 1, plánováno Phase 4G.6; při vytvoření roven experiment_day příslušného snímku)
- `model` (string)
- `model_version` (string)
- `pipeline_version` (string)
- `detection_status` (pass|fail)
- `segmentation_status` (pass|fail|not_applicable)
- `calibration_status` (pass|warn|fail)
- `plant_height_cm` (float, optional při fail)
- `projected_area_cm2` (float, optional při fail)
- `confidence` (float 0..1, optional)
- `failure_code` (no_detection|poor_image_quality|occlusion|plant_damaged|plant_dead|calibration_failed|none)
- `notes` (string, optional)

AI/CV měření nemá `repetition` ani `attempt` (je vázáno na snímek).

## Propojení identifikátorů
Řetězec dohledatelnosti:
- `plant_id` -> `pot_id` v plants.csv
- `plant_id` -> `image_id` v images_log.csv
- `image_id` -> `measurement_id` v ai_measurements.csv
- `plant_id` -> `measurement_id` v manual_measurements.csv (volitelně přes `image_id`)
- `plant_id` -> `water_event_id` v water_log.csv

## Pravidla konzistence
- `plant_id` musí existovat v `plants.csv` před vložením do dalších tabulek.
- `image_id` musí existovat v `images_log.csv` před vložením do `ai_measurements.csv` i do `manual_measurements.csv`.
- Pokud měření (MANUAL nebo AI/CV) obsahuje `image_id`, pak `image_records.plant_id` musí být roven `plant_id` měření (pravidlo G2, invariant při vytvoření záznamu).
- `experiment_day` se nesmí vracet zpět pro stejnou rostlinu (platí pro images, water events, manual measurements; AI/CV po zavedení pole; position events nejsou zahrnuty, dokud pole neponesou). `experiment_day` je explicitně zapisovaná hodnota, nikdy se neodvozuje z timestampu. Den 1 = den emergence dané rostliny.
- `measurement_id` je unikátní napříč danou tabulkou a immutable.
- RAW soubory v `data/raw/` se nepřepisují.

## Sémantika stavů měření (MANUAL, pravidlo M2)
- `pass`: validní použitelné měření; `plant_height_cm` povinné (konečné > 0); `failure_code` NULL nebo `none`.
- `warn`: měření může zůstat použitelné; `plant_height_cm` může být NULL nebo konečné > 0; `failure_code` NULL/`none` nebo skutečný code; skutečný problém musí být vyjádřen skutečným `failure_code`.
- `fail`: měření není validním primárním měřením; `failure_code` povinný a NESMÍ být `none`; uložená výška (pokud existuje) je pouze RAW informace.
- `failure_code = none` znamená explicitní absenci selhání.

## Session / repetition / attempt (MANUAL, pravidlo M4)
- session = (`plant_id`, `experiment_day`).
- Normální session obsahuje repetition 1 a 2 (`repetition` ∈ {1,2}).
- Retake (opakované měření po selhání ve stejném experimentálním dni) je povoleno a rozlišuje se polem `attempt` (začíná na 1, roste s každým pokusem; plánováno Phase 4G.6).
- Každý pokus je samostatný immutable RAW záznam; selhaný záznam se nikdy nemaže ani nepřepisuje.
- UNIQUE(`plant_id`, `experiment_day`, `repetition`) se NEzavádí (kolidovalo by s retake workflow).

## Manual ↔ AI/CV srovnatelnost
- Primární párování validace výšky: `plant_id` + `experiment_day` + `image_id`.
- Párování na úrovni rostliny a experimentálního dne je zaručené (po zavedení `experiment_day` u AI/CV).
- Párování na úrovni image je podmíněné přítomností `image_id` v manuálním měření (volitelné).
- Párování na úrovni repetition není pro primární validaci vyžadováno.
