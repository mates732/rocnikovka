# Pilot Protocol (Phase 3)

## Účel pilotu
Technicky ověřit end-to-end datový a měřicí řetězec bez biologických závěrů a bez spuštění hlavního experimentu.

## Scope
Pilot ověřuje:
- identifikaci rostlin a květináčů,
- naming fotografií a timestamping,
- metadata a vazby ID,
- logování pozic a vody,
- image quality workflow,
- kalibrační workflow (ArUco + metrická škála),
- manuální referenci,
- AI/CV measurement interface,
- traceability,
- failure handling,
- CSV import/export a datovou validaci.

## Co se netestuje
- biologická reprezentativnost a statistické závěry,
- finální výběr AI modelu,
- produkční aplikace, deployment a produkční automatizace.

## Pilot sample
- Cílový technický rozsah: 2-3 rostliny na skupinu.
- V aktuálním stavu repozitáře: pilotní acquisition je NOT_RUN (reálná data nejsou v repozitáři k dispozici).

## Plant IDs a Pot IDs
- `plant_id`: `PLT-XXX`
- `pot_id`: `POT-XXX`
- ID jsou immutable a nesmí obsahovat group/position.

## Postup fotografování
1. Pořídit side-view snímek dle Protocol v1.
2. Zajistit konzistentní kameru, úhel, vzdálenost, osvětlení a pozadí.
3. Zajistit viditelnost kalibrační reference a identifikace rostliny.
4. Vytvořit `image_id` a uložit metadata do `images_log.csv`.

## Postup manuálního měření
1. Měřit podle definice výšky z Protocol v1.
2. Uložit 2 opakování (`repetition=1`, `repetition=2`) jako oddělené záznamy.
3. AI/CV výstup nesmí ovlivnit manuální hodnotu.

## Postup kalibrace
1. Ověřit přítomnost a čitelnost ArUco + metrické škály.
2. Získat pixelový rozměr reference.
3. Spočítat scale factor a převod `pixels -> cm` pro konkrétní snímek.
4. Při chybě reference vyplnit `calibration_status=fail` + `failure_code=calibration_failed`.

## Postup zápisu vody
1. Zvážit květináč před zálivkou (`pot_mass_before_g`).
2. Stanovit `target_mass_g` dle skupiny.
3. Doplnit vodu (`water_added_ml`) a zapsat `pot_mass_after_g`.
4. Vyplnit `watering_status` a případné poznámky/failure.

## Postup zápisu pozice
1. Každé přiřazení/změnu pozice zapisovat do `positions_log.csv`.
2. Povinně vyplnit `position_event_id`, `plant_id`, `timestamp`, `location`, `reason`, `operator`.
3. Historii nikdy nepřepisovat.

## Naming convention
- IDs a naming podle `data/README.md`.
- Foto soubor: `{image_id}__{plant_id}__{timestamp}.jpg`

## Image quality workflow
IMAGE CAPTURE -> NAMING -> METADATA -> QUALITY CHECK -> CALIBRATION CHECK -> READY/WARN/FAIL

## Failure codes
- `no_detection`
- `poor_image_quality`
- `occlusion`
- `plant_damaged`
- `plant_dead`
- `calibration_failed`

Každý FAIL musí mít:
- `failure_code`
- `failure_reason`
- `resolution_status`

## Očekávaný datový tok
PLANT -> POT -> POSITION -> WATER EVENT -> IMAGE -> IMAGE QUALITY -> CALIBRATION -> MANUAL MEASUREMENT -> AI/CV MEASUREMENT -> VALIDATION REPORT

## Acceptance criteria
- Všechny povinné CSV tabulky jsou vyplnitelné bez změny schématu.
- Pro každý záznam je dohledatelná vazba na `plant_id` a `timestamp`.
- Validátor v `data/validation/validate_pilot_dataset.py` běží deterministicky.
- Failure scénáře jsou explicitně logované.
- RAW vrstva zůstává immutable.

## Stav provedení
- Acquisition: NOT_RUN (v repozitáři nejsou dostupná reálná pilotní data/fotografie).
- Protokol je připraven pro okamžité nasazení při fyzickém sběru.
