# Data Dictionary (Phase 2)

## Účel
Tento slovník definuje význam klíčových datových polí, jejich typ, jednotku, povolené hodnoty, povinnost vyplnění, zdroj a možnost změny.

## Klíčová pravidla
- Pole s ID jsou immutable po vytvoření.
- RAW hodnoty se zpětně nepřepisují.
- Failure události se evidují, nemažou.

## Pole

## `plant_id`
- význam: Trvalý identifikátor rostliny.
- datový typ: string
- jednotka: N/A
- povolené hodnoty: formát `PLT-XXX`
- povinný: ano
- zdroj hodnoty: založení rostliny (registr PLANT)
- může se měnit: ne

## `pot_id`
- význam: Identifikátor květináče přiřazeného rostlině.
- datový typ: string
- jednotka: N/A
- povolené hodnoty: formát `POT-XXX`
- povinný: ano (v PLANT)
- zdroj hodnoty: založení rostliny
- může se měnit: ne (změna jen novým záznamem a explicitní poznámkou)

## `image_id`
- význam: Jedinečný identifikátor snímku.
- datový typ: string
- jednotka: N/A
- povolené hodnoty: formát `IMG-YYYYMMDD-HHMMSS-XXX`
- povinný: ano (v IMAGE); volitelný v MANUAL MEASUREMENT
- zdroj hodnoty: akvizice obrazu
- může se měnit: ne
- konzistence: pokud měření (MANUAL nebo AI/CV) obsahuje `image_id`, pak `image_records.plant_id` musí být roven `plant_id` měření (pravidlo G2, invariant při vytvoření záznamu)

## `measurement_id`
- význam: Jedinečný identifikátor měření (MAN/AICV).
- datový typ: string
- jednotka: N/A
- povolené hodnoty: `MSR-MAN-*` nebo `MSR-AICV-*`
- povinný: ano
- zdroj hodnoty: zápis měření
- může se měnit: ne

## `water_event_id`
- význam: Jedinečný identifikátor zálivkového eventu.
- datový typ: string
- jednotka: N/A
- povolené hodnoty: formát `WTR-YYYYMMDD-HHMMSS-XXX`
- povinný: ano
- zdroj hodnoty: denní vážení/zálivka
- může se měnit: ne

## `position_event_id`
- význam: Jedinečný identifikátor záznamu změny pozice.
- datový typ: string
- jednotka: N/A
- povolené hodnoty: formát `POS-YYYYMMDD-HHMMSS-XXX`
- povinný: ano
- zdroj hodnoty: randomizace/rotace/manuální zásah
- může se měnit: ne

## `timestamp`
- význam: Čas vytvoření konkrétního záznamu.
- datový typ: datetime (ISO 8601)
- jednotka: čas
- povolené hodnoty: `YYYY-MM-DDTHH:MM:SS`
- povinný: ano
- zdroj hodnoty: zařízení/operátor při zápisu
- může se měnit: ne v RAW; korekce pouze odvozenou vrstvou s auditní stopou

## `experiment_day`
- význam: Biologický den experimentu konkrétní rostliny. Den 1 = den emergence dané rostliny.
- datový typ: integer
- jednotka: den
- povolené hodnoty: >= 1
- povinný: ano v měřicích tabulkách (IMAGE, WATER, MANUAL); u AI/CV plánováno (Phase 4G.6)
- zdroj hodnoty: explicitně zapisovaná experimentální hodnota; NIKDY se neodvozuje z timestampu
- může se měnit: ne v RAW
- monotonicita: pro jednu rostlinu se `experiment_day` nesmí vracet zpět napříč chronologickými experimentálními záznamy (images, water events, manual measurements; AI/CV po zavedení pole). Position events momentálně `experiment_day` neobsahují a nejsou do pravidla zahrnuty.

## `group`
- význam: Experimentální skupina rostliny.
- datový typ: enum
- jednotka: N/A
- povolené hodnoty: `G0`, `G1`, `G2`
- povinný: ano
- zdroj hodnoty: randomizační protokol
- může se měnit: ne (změna by byla metodologický zásah)

## `pot_mass_before_g`
- význam: Hmotnost květináče před zálivkou.
- datový typ: float
- jednotka: g
- povolené hodnoty: >= 0
- povinný: ano (WATER)
- zdroj hodnoty: vážení
- může se měnit: ne v RAW

## `target_mass_g`
- význam: Cílová hmotnost květináče podle skupiny.
- datový typ: float
- jednotka: g
- povolené hodnoty: > 0
- povinný: ano (WATER)
- zdroj hodnoty: gravimetrický protokol
- může se měnit: ano pouze mezi dny dle drift correction logu, ne zpětně

## `water_added_ml`
- význam: Přidané množství vody.
- datový typ: float
- jednotka: ml
- povolené hodnoty: >= 0
- povinný: ano (WATER)
- zdroj hodnoty: operátor při zálivce
- může se měnit: ne v RAW

## `plant_height_cm`
- význam: Výška rostliny dle definice Protocol v1.
- datový typ: float
- jednotka: cm
- povolené hodnoty: konečné číslo > 0, jinak NULL
- povinný: ano při úspěšném měření (status PASS); u WARN/FAIL volitelný
- zdroj hodnoty: manuální měření nebo AI/CV pipeline
- může se měnit: ne v RAW
- poznámka: u FAIL je uložená hodnota (pokud existuje) pouze RAW informace a NESMÍ být považována za validní primární měření

## `repetition`
- význam: Pořadí opakovaného manuálního měření v rámci session.
- datový typ: integer
- jednotka: N/A
- povolené hodnoty: 1, 2
- povinný: ano (MANUAL)
- zdroj hodnoty: operátor při zápisu
- může se měnit: ne v RAW
- sémantika session: session = (`plant_id`, `experiment_day`). Normální session obsahuje repetition 1 a 2. Opakované měření (retake) po selhání ve stejném experimentálním dni je povoleno a rozlišuje se polem `attempt` (plánováno, Phase 4G.6).

## `attempt`
- význam: Pořadí pokusu měření v rámci repetition a session (pro retake po selhání).
- datový typ: integer
- jednotka: N/A
- povolené hodnoty: >= 1; začíná na 1 u prvního pokusu repetition v rámci session a roste u dalších pokusů
- povinný: plánováno (Phase 4G.6); v aktuální DB zatím neexistuje
- zdroj hodnoty: operátor při zápisu
- může se měnit: ne v RAW
- poznámka: každý pokus je samostatný immutable RAW záznam; původní selhaný záznam se nikdy nemaže ani nepřepisuje

## `measurement_status`
- význam: Status manuálního měření (MANUAL MEASUREMENT).
- datový typ: enum
- jednotka: N/A
- povolené hodnoty: `pass`, `warn`, `fail`
- povinný: ano (MANUAL)
- zdroj hodnoty: operátor při zápisu
- může se měnit: ne v RAW
- sémantika:
  - `pass`: měření je validní a použitelné; vyžaduje `plant_height_cm` (konečné > 0); `failure_code` musí být NULL nebo `none`
  - `warn`: měření může zůstat použitelné; `plant_height_cm` může být NULL nebo konečné > 0; `failure_code` může být NULL/`none` nebo skutečný failure code; pokud existuje skutečný problém, musí být vyjádřen skutečným `failure_code`
  - `fail`: měření není použitelné jako validní primární měření; `failure_code` je povinný a NESMÍ být `none`; `plant_height_cm` může být NULL nebo konečné > 0 (RAW informace)

## `projected_area_cm2`
- význam: Projektovaná nadzemní plocha.
- datový typ: float
- jednotka: cm2
- povolené hodnoty: > 0 při pass, jinak NULL + failure
- povinný: ne (sekundární parametr, AI/CV)
- zdroj hodnoty: AI/CV pipeline + kalibrace
- může se měnit: ne v RAW

## `calibration_status`
- význam: Stav kalibrace pro daný záznam.
- datový typ: enum
- jednotka: N/A
- povolené hodnoty: `pass`, `warn`, `fail`
- povinný: ano (IMAGE, AI/CV)
- zdroj hodnoty: kalibrační kontrola
- může se měnit: ne v RAW

## `image_quality_status`
- význam: Výsledek hodnocení kvality snímku.
- datový typ: enum
- jednotka: N/A
- povolené hodnoty: `PASS`, `WARN`, `FAIL`
- povinný: ano (IMAGE)
- zdroj hodnoty: image quality protocol
- může se měnit: ne v RAW

## `failure_code`
- význam: Důvod selhání záznamu či pipeline.
- datový typ: enum
- jednotka: N/A
- povolené hodnoty:
  - `no_detection`
  - `poor_image_quality`
  - `occlusion`
  - `plant_damaged`
  - `plant_dead`
  - `calibration_failed`
  - `none`
- povinný: ano při fail/warn podle kontextu; u MANUAL dle `measurement_status` (viz výše), u AI/CV vždy
- zdroj hodnoty: operátor nebo pipeline
- může se měnit: ne v RAW
- poznámka: `none` znamená explicitní absenci selhání (technický sentinel); NESMÍ být použit u statusu `fail`

## `confidence`
- význam: Míra jistoty AI/CV výstupu.
- datový typ: float
- jednotka: relativní (0-1)
- povolené hodnoty: 0 <= x <= 1 nebo NULL
- povinný: ne
- zdroj hodnoty: AI/CV pipeline
- může se měnit: ne v RAW

## `status` (PLANT)
- význam: Stav rostliny během experimentu.
- datový typ: enum
- jednotka: N/A
- povolené hodnoty: `active`, `damaged`, `dead`, `excluded`
- povinný: ano
- zdroj hodnoty: obsluha experimentu
- může se měnit: ano, změny musí být auditovatelné

## AI/CV MEASUREMENT (sémantika)
- AI/CV měření je vázáno na snímek (`image_id`, povinné) a rostlinu (`plant_id`).
- AI/CV měření NEMÁ `repetition` ani `attempt`.
- `experiment_day` je pro AI/CV schváleno jako plánované pole (Phase 4G.6): při vytvoření AI/CV měření musí být `experiment_day` roven `experiment_day` příslušného ImageRecord. Neodvozuje se dynamicky při čtení.
- Primární párování Manual ↔ AI/CV validace: `plant_id` + `experiment_day` + `image_id`. Párování na úrovni image je podmíněné přítomností `image_id` v manuálním měření (zůstává volitelné).
