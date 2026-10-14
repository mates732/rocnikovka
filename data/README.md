# Data - README

## Účel složky
Složka `data/` obsahuje datový model, šablony pro sběr dat, pravidla kvality dat a strukturu pro budoucí ukládání experimentálních záznamů.

## Struktura složek
- `data/raw/` - immutable RAW vrstva (původní snímky a původní záznamy bez přepisu)
- `data/processed/` - odvozené a čištěné datové výstupy
- `data/annotations/` - anotace a pomocné značky
- `data/templates/` - CSV šablony a definice pilotního datasetu

## Autoritativní dokumenty v data/
- `data/metadata_schema.md`
- `data/measurements_schema.md`
- `data/DATA_DICTIONARY.md`
- `data/DATA_QUALITY_CHECKLIST.md`
- `data/templates/pilot_dataset_definition.md`

## RAW data policy
- RAW data jsou neměnná (immutable).
- RAW záznamy se nesmí přepisovat kvůli pozdějším změnám pipeline nebo metodiky.
- Opravy se řeší pouze odvozenou vrstvou (`processed`) nebo novým záznamem, ne editací RAW.

## Tabulární formát
- Primární formát je CSV (UTF-8, čárka, hlavička).
- Datum/čas je ISO 8601 (`YYYY-MM-DDTHH:MM:SS`).
- Číselná pole používají desetinnou tečku.

## Identifikátory (naming convention)
ID jsou unikátní, stabilní, čitelné a immutable. ID neobsahují proměnné údaje jako skupinu nebo pozici.

- `plant_id`: `PLT-XXX` (např. `PLT-001`)
- `pot_id`: `POT-XXX` (např. `POT-001`)
- `image_id`: `IMG-YYYYMMDD-HHMMSS-XXX` (např. `IMG-20260903-091530-001`)
- `measurement_id`: `MSR-{SRC}-YYYYMMDD-HHMMSS-XXX`, kde `{SRC}` je `MAN` nebo `AICV`
- `water_event_id`: `WTR-YYYYMMDD-HHMMSS-XXX`
- `position_event_id`: `POS-YYYYMMDD-HHMMSS-XXX`

## Photo naming convention
Název fotografie musí umožnit mapování na `plant_id`, čas a `image_id` bez vazby na skupinu/pozici.

Doporučený formát souboru:
- `{image_id}__{plant_id}__{timestamp}.jpg`

Příklad formátu:
- `IMG-20260903-091530-001__PLT-001__2026-09-03T09-15-30.jpg`

Poznámka:
- Skupina ani pozice nejsou součástí názvu souboru, aby změna pozice/operativního uspořádání nerozbila identifikaci.

## Bezpečnost a soukromí
- Do repozitáře se nevkládají skutečné experimentální fotografie ani citlivá osobní data.
- Vzorová data v šablonách jsou pouze ilustrační a musí být jasně označená.
