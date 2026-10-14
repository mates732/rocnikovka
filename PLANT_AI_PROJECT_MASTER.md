# PLANT_AI_PROJECT_MASTER

## Přehled projektu
Projekt "Automatizované měření růstu rostlin pomocí umělé inteligence a počítačového vidění" buduje reprodukovatelný experimentální rámec pro srovnání manuálního a automatizovaného měření růstu rostlin.

## Aktuální fáze
Fáze 1 je uzavřena, Phase 2 příprava je dokončena, Phase 3A (pilotní dokumentace + validační infrastruktura) je dokončena, Phase 3B.1 (frontend workspace scaffold) je dokončena a Phase 3B.2 (functional UI/UX foundation) je dokončena. Pilotní execution je zatím NOT_RUN/BLOCKED, protože chybí reálná data a fotografie.

## Souhrn uzamčených rozhodnutí
- Druh rostliny: Phaseolus vulgaris (fazole).
- Jedna rostlina na květináč.
- 3 skupiny: G0/G1/G2.
- Vodní režim je definován relativními gravimetrickými cíli 100/85/70 (nejde o přímá fyziologická procenta dostupnosti vody).
- Denní individuální vážení květináčů a denní doplnění vody na cílovou hodnotu skupiny.
- Týdenní drift correction vůči kontrolní skupině.
- Cílový rozsah: 15 rostlin/skupina, minimum 12 rostlin/skupina.
- Délka: plán 28 dní, minimum 21 dní.
- Denní standardizovaná side-view fotografie, persistent plant_id, kalibrační reference v obrazu kdykoli prakticky možné.
- Manuální reference 3x týdně, 2 opakování na rostlinu/sezení, nezávislá na AI výstupu.
- Primární parametr: výška rostliny (cm), sekundární: projektovaná nadzemní plocha.
- RAW data jsou neměnná, selhání se zaznamenávají a nemažou.

## Otevřené provozní otázky
- Přesné numerické prahy pro automatické hodnocení kvality snímků (ostrost/expozice/okluze) po pilotu.
- Finální frekvence rotačního režimu pozic (pilot decision).
- Finální fyzická specifikace kalibrační karty (rozměr škály, poloha v obrazu) po pilotu.

## Uzavřené provozní otázky (Phase 1B)
- Kalibrační reference: doporučena kombinace ArUco + metrická škála (`experiment/calibration_reference.md`).
- Randomizace a rotace: auditovatelný manuální protokol bez speciálního software (`experiment/randomization_protocol.md`).
- Kvalita snímků: zavedeno rozhodování PASS/WARN/FAIL a vazba na failure kódy (`experiment/image_quality_protocol.md`).

## Další kroky
1. Dodat první reálný pilotní batch dat a fotografií podle šablon v `data/templates/`.
2. Spustit acceptance test execution (`experiment/PILOT_ACCEPTANCE_TEST.md`) na reálném vstupu.
3. Vyhodnotit readiness gate (`experiment/PILOT_READINESS.md`) po faktickém běhu.
4. Potvrdit položky označené jako `PILOT DECISION` bez metodologické změny v1.
