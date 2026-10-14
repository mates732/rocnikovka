# Data Quality Checklist (Phase 2)

## Účel
Checklist pro kontrolu dat před uložením záznamu do tabulek nebo úložiště.

## Povinné kontroly před uložením

## 1) Validní `plant_id`
- `plant_id` existuje v registru PLANT.
- Formát odpovídá naming convention.

## 2) Validní `experiment_day`
- `experiment_day` je celé číslo >= 1.
- Odpovídá harmonogramu a timestampu.

## 3) Validní `timestamp`
- ISO 8601 formát.
- Není v budoucnosti vůči času záznamu.

## 4) Správná skupina
- `group` je jedna z hodnot `G0`, `G1`, `G2`.
- Odpovídá randomizačnímu záznamu daného `plant_id`.

## 5) Validní hmotnost
- `pot_mass_before_g` >= 0.
- `target_mass_g` > 0.
- `pot_mass_after_g` >= 0.
- `water_added_ml` >= 0.

## 6) Validní fotografie
- `image_path` existuje v očekávané vrstvě.
- `image_id` je unikátní.
- `image_quality_status` je vyplněn (`PASS|WARN|FAIL`).

## 7) Validní kalibrace
- `calibration_status` je vyplněn (`pass|warn|fail`).
- Při `fail` musí být `failure_code = calibration_failed` nebo jiný relevantní kód.

## 8) Validní manuální měření
- `repetition` je 1 nebo 2.
- `plant_height_cm` je > 0 při `measurement_status=pass`.
- Při neúspěchu je vyplněn relevantní `failure_code`.

## 9) Správné propojení `image_id` <-> `plant_id`
- `ai_measurements.image_id` existuje v `images_log`.
- `ai_measurements.plant_id` odpovídá `images_log.plant_id` pro dané `image_id`.

## 10) Žádná změna RAW dat
- RAW záznamy se neupravují ani nepřepisují.
- Opravy pouze novým záznamem nebo v processed vrstvě.

## 11) Failure code při neúspěchu
- Každý `fail` stav musí mít vyplněný `failure_code` z povoleného seznamu.
- Neúspěch se nezakrývá, záznam zůstává v datasetu.

## 12) Kontrola unikátnosti ID
- `image_id`, `measurement_id`, `water_event_id`, `position_event_id` nejsou duplicitní.

## 13) Kontrola povinných polí
- Žádné povinné pole není prázdné.
- Volitelná pole mohou být prázdná pouze dle schématu.

## Výsledek checklistu
Každá dávka záznamů má status:
- `PASS`: bez kritických chyb
- `WARN`: drobné problémy, záznam je použitelný
- `FAIL`: kritická chyba, nutná oprava vstupu (záznam se nemaže)
