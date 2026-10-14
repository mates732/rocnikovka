# Pilot Dataset Definition

## Cíl pilotu
Pilotní dataset musí ověřit kompletní datový řetězec:
plant -> pot -> water event -> image -> calibration -> manual measurement -> AI/CV measurement.

## Minimální rozsah pilotu
Doporučené minimum (pro odhalení strukturálních problémů):
- 3 rostliny (alespoň 1 v každé skupině G0/G1/G2).
- 3 po sobě jdoucí experimentální dny.
- 1 denní snímek na rostlinu.
- Denní water event pro každou rostlinu.
- Manuální měření 2x během pilotu, vždy se 2 opakováními na rostlinu.
- AI/CV měření pro každý pilotní snímek.
- Alespoň 1 řízený záznam WARN nebo FAIL pro ověření failure workflow (bez manipulace se skutečným biologickým výsledkem).

## Minimální počty záznamů
- PLANT: 3
- POSITION: min. 3 initial_assignment + min. 3 rotation/manuální přesun (pokud pilot zahrnuje rotaci)
- WATER: min. 9 (3 rostliny x 3 dny)
- IMAGE: min. 9
- MANUAL MEASUREMENT: min. 12 (3 rostliny x 2 sezení x 2 opakování)
- AI/CV MEASUREMENT: min. 9

## Povinné ověření v pilotu
- Jednoznačné vazby ID mezi tabulkami.
- Konzistence `experiment_day` a `timestamp`.
- Funkční zápis `calibration_status` a `image_quality_status`.
- Funkční evidence `failure_code` při neúspěchu.
- Nepřepisování RAW vrstvy při opravách.

## Kritéria úspěšného pilotu
Pilot je datově úspěšný, pokud:
- všechny povinné tabulky jsou vyplnitelné bez ad hoc sloupců,
- nejsou porušena pravidla immutable RAW,
- lze rekonstruovat historii pro libovolné `plant_id`,
- je možné exportovat data do pandas bez ručních strukturálních oprav.

## Poznámka
Pilotní záznamy slouží k ověření datového modelu a workflow, nikoli jako finální biologický výsledek.
