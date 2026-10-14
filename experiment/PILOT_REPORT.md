# PILOT REPORT (Phase 3A)

## 1) Planned pilot
- Ucel: technicke overeni end-to-end datoveho a mericiho retezce.
- Scope: data capture, image capture, kalibrace, manualni reference, AI/CV interface, validace dat.
- Vstup: realna pilotni data a fotografie dle `data/templates/` a `experiment/pilot_protocol.md`.
- Metodicky zaklad: `experiment/protocol_v1_locked.md` (beze zmen).

## 2) Actual execution
- Pilot execution status: NOT_RUN
- Acquisition status: BLOCKED
- Duvod: v repozitari nejsou dostupna realna pilotni data ani fotografie.
- Co bylo provedeno:
  - pripraven pilot protocol,
  - pripraven acceptance test plan (TEST-001..TEST-015),
  - pripraven deterministicky validator dat,
  - pripravena dokumentace k validacnimu workflow.

## 3) Findings
- Dokumentacni a validacni infrastruktura je pripravena pro okamzite pouziti pri fyzickem sberu.
- Nelze reportovat biologicke vysledky.
- Nelze reportovat AI/CV vykonnostni vysledky.
- Nelze uzavrit acceptance testy jako PASS bez realneho vstupu.

## 4) Risks and constraints
- Hlavni blokator: absence realnych pilotnich CSV a obrazovych dat.
- Riziko: predcasne vyhodnoceni bez realne akvizice by porusilo metodiku a auditovatelnost.

## 5) Decision status
- Protocol v1: zachovan, bez metodickych zmen.
- Pilot readiness: castecne pripravena (infrastruktura), celkove NOT_READY bez realnych dat.

## 6) Next required input
- Dodat prvni realny pilotni batch dat a fotografii podle existujicich sablon a naming pravidel.
