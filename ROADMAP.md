# ROADMAP

## Stav roadmapy
- Fáze 1: dokončeno (Protocol v1 LOCKED).
- Fáze 2: příprava realizace experimentu.
- Fáze 3A: dokumentace a validační infrastruktura dokončena.
- Fáze 3B.1: frontend scaffold dokončen.
- Fáze 3B.2: funkční UI/UX foundation dokončena (empty-state režim bez reálných dat).

## Fáze 1 - Dokončeno
- Uzamčení metodologie experimentu v dokumentu `experiment/protocol_v1_locked.md`.
- Zavedení politiky změn v `experiment/protocol_change_policy.md`.
- Konsolidace dokumentace a pravidel práce s RAW daty.
- Uzavření provozních otázek Phase 1B:
	- kalibrační reference (`experiment/calibration_reference.md`),
	- randomizace a rotace pozic (`experiment/randomization_protocol.md`),
	- kvalita snímků PASS/WARN/FAIL (`experiment/image_quality_protocol.md`).

## Fáze 2 - Příprava (aktuální)
1. Připravit pilotní experimentální běh (ověření položek označených jako `PILOT DECISION` bez metodologické změny).
2. Dokončit datový model (metadata + měřicí schémata + data dictionary).
3. Dokončit datovou strukturu (`raw/processed/annotations/templates`) a CSV šablony.
4. Zavést data quality checklist a definici pilotního datasetu.
5. Ověřit Phase 2 datovou připravenost dokumentem `PHASE_2_DATA_READINESS.md`.

## Fáze 2 - Stav deliverables
- Datová schémata: hotovo.
- CSV šablony: hotovo.
- ID a photo naming convention: hotovo.
- RAW immutable policy: hotovo.
- Pilot dataset definition: hotovo.
- Čeká: praktické pilotní naplnění dat.

## Fáze 3 - Pilot validace a realizace
### Fáze 3A - Dokumentace a validační infrastruktura (dokončeno)
1. Vytvořen pilotní protokol (`experiment/pilot_protocol.md`).
2. Vytvořen acceptance test plán (`experiment/PILOT_ACCEPTANCE_TEST.md`).
3. Vytvořen pilotní report template (`experiment/PILOT_REPORT.md`).
4. Vytvořen readiness gate (`experiment/PILOT_READINESS.md`).
5. Implementován dataset validátor (`data/validation/validate_pilot_dataset.py`) + README.

### Fáze 3B - Pilot execution (čeká)
1. Dodat reálná pilotní data a fotografie.
2. Spustit acceptance test execution na reálném vstupu.
3. Uzavřít readiness z `NOT_READY` na základě faktického běhu.

## Fáze 4 - Vyhodnocení (čeká)
1. Porovnání automatizovaných a manuálních měření.
2. Výpočet validačních metrik a analýza odchylek.
3. Závěrečné metodologické zhodnocení a návrh případného Protocol v2.
