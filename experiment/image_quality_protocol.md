# Protokol kvality snímků (PASS/WARN/FAIL)

## Účel
Definovat objektivní minimum kvality fotografií pro denní záznamy tak, aby byla zachována použitelnost pro AI/CV a auditovatelnost dat.

## Zásady hodnocení
- Snímek se nikdy nemaže kvůli kvalitě.
- Každý snímek musí dostat status `PASS`, `WARN` nebo `FAIL`.
- Při `FAIL` se záznam ponechá a označí se odpovídajícím `failure_code`.
- Číselné prahy se stanovují pouze tam, kde je jasné fyzikální odůvodnění; ostatní prahy jsou `PILOT DECISION`.

## 1. Geometrické požadavky
### PASS
- Side-view je zřetelně zachován.
- Kamera, vzdálenost a úhel odpovídají standardní scéně.
- Rostlina je celá v záběru od půdní referenční úrovně po nejvyšší nadzemní bod.

### WARN
- Menší odchylka úhlu nebo kompozice, ale stále je možné určit referenční půdní bod i nejvyšší bod rostliny.

### FAIL
- Zásadní odchylka perspektivy nebo ořez, který znemožňuje určit výšku dle definice protokolu.

## 2. Viditelnost rostliny
### PASS
- Hlavní stonek a vrcholová část jsou viditelné.

### WARN
- Část listové plochy je překryta, ale výšková definice je stále vyhodnotitelná.

### FAIL
- Klíčové body pro výšku nejsou viditelné (silná okluze, mimo záběr).

## 3. Viditelnost kalibrace
### PASS
- Kalibrační reference je viditelná a čitelná.

### WARN
- Reference je viditelná, ale s dílčí degradací (např. slabý odlesk), stále použitelná.

### FAIL
- Reference chybí nebo je nečitelná tak, že nelze spolehlivě provést kalibraci.

Doporučený failure kód při FAIL: `calibration_failed`.

## 4. Ostrost
### PASS
- Hrany rostliny i reference jsou vizuálně ostré bez dominantního pohybového rozmazání.

### WARN
- Mírná neostrost, ale body potřebné pro výšku a kalibraci lze určit.

### FAIL
- Neostrost znemožňuje spolehlivou detekci rostliny nebo reference.

PILOT DECISION:
- Konkrétní numerický práh ostrosti (např. metrika založená na Laplace varianci) pro automatické PASS/WARN/FAIL.

## 5. Osvětlení
### PASS
- Scéna je rovnoměrně osvětlená, bez výrazných přepalů a bez hlubokých stínů přes klíčové body.

### WARN
- Lokální stíny nebo menší přepal nezasahují klíčové měřené body.

### FAIL
- Osvětlení znemožňuje rozlišení klíčových bodů rostliny nebo kalibrace.

PILOT DECISION:
- Numerická hranice expoziční přijatelnosti pro automatizovaný screening.

## 6. Pozadí
### PASS
- Pozadí je konzistentní, kontrastní vůči rostlině a bez rušivých objektů.

### WARN
- Mírné rušení pozadí, které nebrání segmentaci.

### FAIL
- Rušivé pozadí zásadně snižuje oddělitelnost rostliny.

## 7. Okluze
### PASS
- Bez významné okluze.

### WARN
- Částečná okluze, ale měření výšky je stále možné.

### FAIL
- Okluze znemožňuje určení výšky nebo segmentaci pro sekundární parametr.

Doporučený failure kód při FAIL: `occlusion`.

## 8. Výsledné rozhodnutí
- `PASS`: snímek lze použít bez omezení.
- `WARN`: snímek lze použít, ale musí být označen pro zvýšenou kontrolu při analýze.
- `FAIL`: snímek zůstává v RAW datech, je explicitně označen failure statusem a kódem.

## 9. Vazba na failure kódy
Použitelné kódy podle typu selhání:
- `poor_image_quality`
- `occlusion`
- `calibration_failed`
- `no_detection` (pokud pipeline rostlinu nedetekuje navzdory dostupnému obrazu)

## 10. Metadata kvality
Pro každý snímek evidovat minimálně:
- `image_id`
- `plant_id`
- `timestamp`
- `quality_status` (PASS/WARN/FAIL)
- `quality_reason`
- `failure_code` (je-li relevantní)
- `reviewer` (člověk nebo automatizovaný checker)

## Pilot decisions
- Numerické prahy automatického quality scoringu (ostrost, expozice, případně okluze).
- Rozsah opakovaného pořízení snímku po FAIL v denním režimu.

## CHANGE REQUEST check
Tento dokument neprovádí metodologickou změnu Protocol v1. Zavádí provozní kritéria hodnocení kvality snímků.
