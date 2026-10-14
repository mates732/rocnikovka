# CHANGELOG

## 2026-09-03 (Phase 3B.2 - Functional UI/UX Implementation)

### Added
- Implementovány reusable komponenty: `PageHeader`, `StatusBadge`, `DataTable`, `DetailPanel`, `ImageViewer`.
- Implementovány funkční stránky včetně detail routes:
  - `/plants/:plantId`
  - `/images/:imageId`
  - `/measurements/:measurementId`
- Přidána vrstva empty data adapterů: `app/src/data/adapters.ts`.
- Přidána dokumentace:
  - `app/architecture.md`
  - `app/ui_design.md`

### Changed
- Propojeny všechny požadované routes v `app/src/App.tsx`.
- Aktualizována navigace v Sidebar s podporou active stavu i pro detail routes.
- Sjednocen design systém a globální styly pro scientific software vzhled.
- Aktualizován `app/README.md` dle skutečné implementace 3B.2.
- Aktualizován `ROADMAP.md` a `PLANT_AI_PROJECT_MASTER.md` na stav dokončené 3B.2.

### Experimental
- Bez fake dat, bez fake measurements, bez fake charts.
- Empty states explicitně indikují `NOT_RUN` / `Not available`.

## 2026-09-03 (Phase 3B.1 - Frontend Workspace Scaffold)

### Added
- Vytvořen frontend workspace `app/` (React + TypeScript + Vite).
- Přidán základní routing skeleton s route placeholders.
- Přidán `AppShell` (`Sidebar`, `TopBar`, `Main content`).
- Přidány základní design tokens a globální styly.
- Přidány TypeScript interfaces dle data schema (`src/types/entities.ts`).
- Přidány service interfaces a `NOT IMPLEMENTED` adaptéry (`src/services/`).
- Přidán `app/README.md` s architekturou, routes a data boundary.

### Changed
- Aktualizován `ROADMAP.md` o stav Phase 3B.1.
- Aktualizován `PLANT_AI_PROJECT_MASTER.md` o stav frontend scaffoldingu.

### Experimental
- Žádná fake experimentální data nebyla přidána.
- Feature implementace zůstává odložena na další fázi.

## 2026-09-03 (Phase 3A - Pilot Validation Documentation)

### Added
- Přidán pilotní protokol: `experiment/pilot_protocol.md`.
- Přidán acceptance test plán: `experiment/PILOT_ACCEPTANCE_TEST.md`.
- Přidán pilotní report: `experiment/PILOT_REPORT.md`.
- Přidán pilot readiness gate: `experiment/PILOT_READINESS.md`.
- Přidán datový validátor: `data/validation/validate_pilot_dataset.py`.
- Přidána dokumentace validátoru: `data/validation/README.md`.

### Changed
- Aktualizována `ROADMAP.md` o stav Phase 3A (dokumentace/validace dokončena, execution čeká na reálná data).
- Aktualizován `PLANT_AI_PROJECT_MASTER.md` o explicitní stav `NOT_RUN/BLOCKED` pro pilot execution.
- Drobně zpřesněn validátor o kontrolu `plants.status` dle Data Dictionary.

### Experimental
- Pilot execution zůstává `NOT_RUN/BLOCKED`; nebyla vytvořena ani použita syntetická experimentální data.

## 2026-09-03

### Added
- Vytvořen nový základ dokumentace projektu od nuly (PROJECT RESET MODE).
- Přidán `PLANT_AI_PROJECT_MASTER.md` jako řídicí souhrn stavu projektu.
- Přidána experimentální dokumentace:
  - `experiment/README.md`
  - `experiment/protocol_v1_locked.md`
  - `experiment/protocol_change_policy.md`
- Přidán placeholder `data/README.md` pro pravidla práce s datovou složkou.

### Changed
- Metodologie experimentu je oficiálně uzamčena jako Protocol v1 (STATUS: LOCKED, VERSION: 1.0).
- Roadmapa synchronizována se stavem po uzamčení protokolu (Fáze 1 dokončena, Fáze 2 příprava).

### Fixed
- Odstraněna nejednoznačnost v popisu vodního režimu: 100/85/70 jsou relativní gravimetrické cíle protokolu, nikoli přímá fyziologická procenta dostupnosti vody.
- Explicitně doplněna pravidla nezávislosti manuální reference vůči AI výstupu.

### Experimental
- Pro pilotní běh ponechány otevřené pouze provozní detaily bez změny metodologického základu v1.

## 2026-09-03 (Phase 1B)

### Added
- Přidán provozní dokument ke kalibrační referenci: `experiment/calibration_reference.md`.
- Přidán provozní dokument k randomizaci a rotaci pozic: `experiment/randomization_protocol.md`.
- Přidán provozní dokument kvality snímků PASS/WARN/FAIL: `experiment/image_quality_protocol.md`.

### Changed
- Aktualizován `experiment/README.md` o odkazy na nové provozní protokoly.
- Aktualizován `PLANT_AI_PROJECT_MASTER.md` (uzavřené provozní otázky + pilotní rozhodnutí).
- Aktualizován `ROADMAP.md` (Phase 1B dokončeno, pilotní ověření položek `PILOT DECISION`).

### Fixed
- Uzavřeny tři otevřené provozní otázky bez změny metodologických rozhodnutí Protocol v1.

### Experimental
- Numerické quality prahy a finální parametry kalibrační/rotační rutiny zůstávají označeny jako `PILOT DECISION`.

## 2026-09-03 (Phase 2 - Data & Image Acquisition Preparation)

### Added
- Vytvořena datová schémata: `data/metadata_schema.md`, `data/measurements_schema.md`.
- Vytvořen datový slovník: `data/DATA_DICTIONARY.md`.
- Vytvořen checklist kvality dat: `data/DATA_QUALITY_CHECKLIST.md`.
- Vytvořena definice pilotního datasetu: `data/templates/pilot_dataset_definition.md`.
- Vytvořeny CSV šablony:
  - `data/templates/plants_template.csv`
  - `data/templates/water_log_template.csv`
  - `data/templates/positions_template.csv`
  - `data/templates/images_template.csv`
  - `data/templates/manual_measurements_template.csv`
  - `data/templates/ai_measurements_template.csv`
- Vytvořena datová adresářová struktura:
  - `data/raw/.gitkeep`
  - `data/processed/.gitkeep`
  - `data/annotations/.gitkeep`
  - `data/templates/`
- Vytvořen přehled připravenosti: `PHASE_2_DATA_READINESS.md`.

### Changed
- Aktualizován `data/README.md` (schema odkazy, ID convention, photo naming, RAW policy).
- Aktualizován `PLANT_AI_PROJECT_MASTER.md` o stav Phase 2 přípravy.
- Aktualizován `ROADMAP.md` o stav deliverables pro Phase 2.

### Fixed
- Sjednoceny názvy klíčových polí napříč schématy a šablonami (ASCII snake_case, jednotky v názvu).

### Experimental
- Hlavní biologický experiment nebyl spuštěn; fáze pokrývá pouze přípravu datového systému.
