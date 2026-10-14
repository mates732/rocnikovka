# PILOT ACCEPTANCE TEST (Phase 3A)

## Stav provedení
- Execution status: NOT_RUN
- Duvod: chybi realna pilotni data a fotografie.

## Status legenda
- PASS: test uspel na realnem vstupu.
- FAIL: test selhal na realnem vstupu.
- WARN: test bez kriticke chyby, ale s odchylkou.
- NOT_RUN: test nebyl spusten (zadny realny vstup).

## Test Cases

### TEST-001
- ID: TEST-001
- ucel: Oveit, ze vsechny povinne pilotni CSV soubory existuji ve spravnem umisteni.
- input: `plants.csv`, `positions_log.csv`, `water_log.csv`, `images_log.csv`, `manual_measurements.csv`, `ai_measurements.csv`.
- expected result: vsechny soubory jsou dostupne a citelne.
- actual result: NOT_RUN (realne pilotni CSV nejsou k dispozici).
- status: NOT_RUN
- notes: validator je pripraven, chybi realny vstup.

### TEST-002
- ID: TEST-002
- ucel: Oveit, ze headers v CSV odpovidaji schumatu a data dictionary.
- input: hlavicky vsech pilotnich CSV.
- expected result: zadny chybejici ani nadbytecny povinny sloupec.
- actual result: NOT_RUN
- status: NOT_RUN
- notes: kontrola bude provedena pri prvnim realnem importu.

### TEST-003
- ID: TEST-003
- ucel: Oveit unikatnost primarnich ID (`plant_id`, `position_event_id`, `water_event_id`, `image_id`, `measurement_id`).
- input: vsechny pilotni CSV zaznamy.
- expected result: bez duplicitnich ID.
- actual result: NOT_RUN
- status: NOT_RUN
- notes: pokryto pravidly ve validatoru.

### TEST-004
- ID: TEST-004
- ucel: Oveit pritomnost vsech povinnych poli.
- input: vsechny radky pilotnich CSV.
- expected result: zadne prazdne povinne pole.
- actual result: NOT_RUN
- status: NOT_RUN
- notes: mapovano na `MISSING_REQUIRED`.

### TEST-005
- ID: TEST-005
- ucel: Oveit format a validitu `timestamp`.
- input: `timestamp` ve vsech log tabulkach.
- expected result: format `YYYY-MM-DDTHH:MM:SS`, validni datum/cas.
- actual result: NOT_RUN
- status: NOT_RUN
- notes: mapovano na `INVALID_TIMESTAMP`.

### TEST-006
- ID: TEST-006
- ucel: Oveit `experiment_day` (`>= 1`) v mericich tabulkach.
- input: `experiment_day` ve `water_log.csv`, `images_log.csv`, `manual_measurements.csv`, `ai_measurements.csv`.
- expected result: vsechny hodnoty jsou cela cisla >= 1.
- actual result: NOT_RUN
- status: NOT_RUN
- notes: mapovano na `INVALID_EXPERIMENT_DAY`.

### TEST-007
- ID: TEST-007
- ucel: Oveit vazbu `plant_id` napric tabulkami (zadne orphan zaznamy).
- input: `plant_id` v positions/water/images/manual/ai vs `plants.csv`.
- expected result: vsechny odkazy vedou na existujici `plant_id`.
- actual result: NOT_RUN
- status: NOT_RUN
- notes: mapovano na `ORPHAN_PLANT`.

### TEST-008
- ID: TEST-008
- ucel: Oveit vazbu `ai_measurements.image_id -> images_log.image_id` a konzistenci `plant_id`.
- input: `ai_measurements.csv` + `images_log.csv`.
- expected result: kazdy `image_id` existuje a `plant_id` souhlasi.
- actual result: NOT_RUN
- status: NOT_RUN
- notes: mapovano na `ORPHAN_IMAGE` a `BROKEN_LINK`.

### TEST-009
- ID: TEST-009
- ucel: Oveit fyzikalni hodnoty ve water logu.
- input: `pot_mass_before_g`, `target_mass_g`, `water_added_ml`, `pot_mass_after_g`.
- expected result: numeric; `target_mass_g > 0`; ostatni `>= 0`.
- actual result: NOT_RUN
- status: NOT_RUN
- notes: mapovano na `INVALID_NUMBER`, `NEGATIVE_VALUE`, `INVALID_TARGET_MASS`.

### TEST-010
- ID: TEST-010
- ucel: Oveit enum hodnoty podle data dictionary.
- input: `group`, `watering_status`, `image_quality_status`, `calibration_status`, `measurement_status`, `detection_status`, `segmentation_status`, `failure_code`.
- expected result: pouze povolene hodnoty.
- actual result: NOT_RUN
- status: NOT_RUN
- notes: mapovano na `INVALID_*` chyby.

### TEST-011
- ID: TEST-011
- ucel: Oveit pravidla manualnich mereni (`repetition`, `plant_height_cm`).
- input: `manual_measurements.csv`.
- expected result: `repetition` je 1 nebo 2; pri `measurement_status=pass` je `plant_height_cm > 0`.
- actual result: NOT_RUN
- status: NOT_RUN
- notes: mapovano na `INVALID_REPETITION` a `INVALID_HEIGHT`.

### TEST-012
- ID: TEST-012
- ucel: Oveit kalibracni workflow a failure handling.
- input: `images_log.csv`, `ai_measurements.csv` (`calibration_status`, `failure_code`).
- expected result: pri neuspechu je vyplnen relevantni `failure_code`; hodnoty jsou z povoleneho seznamu.
- actual result: NOT_RUN
- status: NOT_RUN
- notes: mapovano na `INVALID_CALIBRATION_STATUS` a `INVALID_FAILURE_CODE`.

### TEST-013
- ID: TEST-013
- ucel: Oveit image quality workflow.
- input: `images_log.csv` (`image_quality_status`, doprovodna metadata).
- expected result: kazdy snimek ma status PASS/WARN/FAIL a auditovatelny kontext.
- actual result: NOT_RUN
- status: NOT_RUN
- notes: navazuje na `experiment/image_quality_protocol.md`.

### TEST-014
- ID: TEST-014
- ucel: Oveit vystupni chovani validatoru a exit codes.
- input: beh `validate_pilot_dataset.py` nad realnymi pilotnimi CSV.
- expected result: bez FAIL => exit code 0; s FAIL => exit code 1; report obsahuje souhrn PASS/WARN/FAIL.
- actual result: NOT_RUN
- status: NOT_RUN
- notes: neni spousteno jako PASS bez realneho vstupu.

### TEST-015
- ID: TEST-015
- ucel: Oveit end-to-end traceability retezce plant -> pot -> water -> image -> calibration -> manual -> AI/CV.
- input: konzistentni pilotni dataset pres vsechny tabulky.
- expected result: pro libovolne `plant_id` lze rekonstruovat historii bez poruseni vazeb.
- actual result: NOT_RUN
- status: NOT_RUN
- notes: finalni gate pred prechodem na plny pilot run.
