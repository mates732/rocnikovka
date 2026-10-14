# Experiment - README

## Účel složky
Složka `experiment/` obsahuje autoritativní experimentální metodiku, pravidla změn protokolu a provozní rámec pro reprodukovatelný sběr dat.

## Autoritativní dokumenty
- Hlavní uzamčená metodika: `experiment/protocol_v1_locked.md`
- Politika změn protokolu: `experiment/protocol_change_policy.md`
- Kalibrační reference (provozní specifikace): `experiment/calibration_reference.md`
- Randomizace a rotace pozic: `experiment/randomization_protocol.md`
- Kvalita snímků (PASS/WARN/FAIL): `experiment/image_quality_protocol.md`
- Řídicí přehled projektu: `PLANT_AI_PROJECT_MASTER.md`
- Plán fází: `ROADMAP.md`
- Historie změn: `CHANGELOG.md`

## Aktuální stav experimentu
- Protocol v1 je uzamčen (LOCKED).
- Experiment je ve stavu přípravy pilotního běhu.
- Nebyla provedena změna metodologie mimo uzamčené baseline rozhodnutí.
- Tři provozní otázky (kalibrace, randomizace, kvalita snímků) mají samostatné protokoly.

## Workflow overview
1. Denní akvizice obrazu podle standardizovaného postupu.
2. Denní gravimetrické vážení a doplnění vody na cíle skupiny.
3. Manuální referenční měření 3x týdně (2 opakování).
4. Záznam metadat, failure událostí a verzí pipeline/modelu.
5. Následné validační porovnání AI/CV výstupů s manuální referencí.

## Pravidla práce s RAW daty
- RAW data jsou neměnná (immutable).
- RAW záznamy se nepřepisují kvůli pozdějším metodickým nebo technickým změnám.
- Selhání (failure) se nezakrývají ani nemažou, pouze explicitně označují.

## Co následuje
1. Pilotně ověřit položky označené jako `PILOT DECISION` v nových provozních protokolech.
2. Finalizovat šablony metadat a datové struktury.
3. Spustit Fázi 2 dle `ROADMAP.md`.
