# Validation README (Phase 3A)

## Ucel validatoru
`validate_pilot_dataset.py` provadi deterministickou kontrolu pilotnich CSV dat bez zmeny vstupu.
Cilem je odhalit strukturani, hodnotove a relacni chyby pred vyhodnocenim pilotu.

## Vstupni CSV
Validator ocekava soubory ve slozce `data/`:
- `plants.csv`
- `positions_log.csv`
- `water_log.csv`
- `images_log.csv`
- `manual_measurements.csv`
- `ai_measurements.csv`

Pokud zadny soubor neobsahuje realna data, vraci se `WARN/NO_DATA`.

## Kontrolovane vazby
- `plant_id` v provoznich tabulkach musi existovat v `plants.csv`.
- `ai_measurements.image_id` musi existovat v `images_log.csv`.
- `ai_measurements.plant_id` musi souhlasit s `images_log.plant_id` pro dany `image_id`.
- Kontrola unikátnosti ID napric tabulkami dle role primarnich klicu.

## Kontrolovane hodnoty
- `timestamp`: format `YYYY-MM-DDTHH:MM:SS`.
- `experiment_day`: cele cislo >= 1.
- Numeric/fyzikalni pole: bez zapornych hodnot dle pravidel dictionary.
- Enum pole: pouze povolene hodnoty (`group`, statusy, `failure_code`).
- Manual measurement pravidla: `repetition` v {1,2}, `plant_height_cm > 0` pri `measurement_status=pass`.
- AI confidence: 0..1 nebo prazdne/`NA`.

## Exit codes
- `0`: zadny FAIL (muze obsahovat PASS nebo WARN).
- `1`: alespon jeden FAIL.

## PASS/FAIL logika
- PASS: bez nalezene kriticke chyby.
- WARN: nekriticky stav (napr. `NO_DATA`).
- FAIL: poruseni integrity dat, schema nebo vazeb.

## Pouziti v pilotu
1. Po nahrani realnych pilotnich CSV spustit validaci.
2. Vysledek ulozit jako artefakt pilotu (log/report).
3. FAIL chyby resit opravou vstupu novym auditovatelnym zaznamem (bez prepisu RAW).
4. Teprve po uspesne validaci pokracovat do acceptance test execution.

## Priklad spusteni
```bash
python3 data/validation/validate_pilot_dataset.py --data-dir data --output data/validation/last_validation_report.md
```
