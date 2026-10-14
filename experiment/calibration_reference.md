# Kalibrační reference pro fotografický snímek

## Účel
Definovat praktickou, levnou a dlouhodobě reprodukovatelnou referenci pro převod pixelových měření na fyzikální jednotky (cm) v rámci Protocol v1.

## Porovnání variant

### Varianta A: Běžné pravítko (mm stupnice)
Výhody:
- velmi levné a dostupné,
- intuitivní pro obsluhu.

Nevýhody:
- ruční odečty hran mohou být nestabilní při odlescích,
- při horším kontrastu je CV detekce méně robustní,
- delší stupnice může být částečně zakrytá listy.

Hodnocení:
- přesnost: střední až dobrá (závislá na snímku),
- stabilita: střední,
- jednoduchost: velmi dobrá,
- opakovatelnost: střední,
- CV zpracování: střední,
- studentské použití: velmi dobré.

### Varianta B: ArUco marker (černobílý fiducial)
Výhody:
- robustní automatická detekce v CV,
- odolnost vůči menším změnám úhlu a perspektivy,
- jednoznačná identifikace markeru.

Nevýhody:
- samotný marker bez známé fyzické velikosti nestačí pro metrický převod,
- tisk na běžný papír může degradovat vlhkostí,
- vyžaduje základní disciplínu při kvalitním tisku.

Hodnocení:
- přesnost: dobrá,
- stabilita: dobrá,
- jednoduchost: dobrá,
- opakovatelnost: dobrá,
- CV zpracování: velmi dobré,
- studentské použití: dobré.

### Varianta C: Kombinace ArUco + krátká metrická škála (doporučeno)
Popis:
- Jedna rigidní kartička obsahuje:
  - ArUco marker pro robustní lokalizaci,
  - vedle něj krátkou metrickou škálu (např. 50 mm) pro přímý fyzikální převod a kontrolu rozměru.
- Kartička je zalaminovaná nebo vytištěná na pevný voděodolnější materiál.

Výhody:
- kombinuje robustní CV detekci (ArUco) s explicitní metrickou referencí,
- vyšší odolnost proti provozním chybám než samotné pravítko,
- snadná auditovatelnost a reprodukovatelnost.

Nevýhody:
- vyžaduje jednorázovou přípravu kartičky,
- při nekvalitním tisku může být potřeba opakování tisku.

Hodnocení:
- přesnost: dobrá až velmi dobrá,
- stabilita: velmi dobrá,
- jednoduchost: dobrá,
- opakovatelnost: velmi dobrá,
- CV zpracování: velmi dobré,
- studentské použití: dobré.

## Doporučená varianta
Doporučuje se Varianta C: kombinace ArUco markeru a krátké metrické škály na jedné rigidní referenční kartě.

Zdůvodnění:
- Přesnost: fyzická škála poskytuje přímé metrické ukotvení.
- Stabilita: ArUco je robustní vůči běžným změnám scény a pomáhá konzistentně lokalizovat referenci.
- Jednoduchost: obsluha pouze umisťuje stejnou kartičku do definované pozice.
- Opakovatelnost: stejný fyzický artefakt napříč dny i skupinami.
- CV: marker umožňuje automatizovanou kontrolu přítomnosti a orientace reference.
- Student: nákladově nízké, jednorázově připravitelné, provozně nenáročné.

## Provozní SOP (bez metodologické změny)
1. Každému stanovišti přiřadit jednu referenční kartu se stabilním identifikátorem `cal_ref_id`.
2. Referenci umisťovat do stejné oblasti snímku (např. spodní roh scény), mimo očekávaný růstový objem rostliny.
3. Referenční rovina má být co nejblíže rovině stonku, aby se minimalizovala perspektivní chyba.
4. Pokud reference na snímku chybí nebo je nečitelná, záznam se neodstraňuje, ale označí relevantním `failure_code`.
5. Každý den krátce vizuálně ověřit nepoškozenost a čitelnost referenční karty.

## Minimální metadata
- `cal_ref_id`
- `calibration_status` (pass/warn/fail)
- `calibration_method` (aruco_plus_scale)
- `timestamp`
- `image_id`
- `plant_id`

## Pilot decisions
Následující hodnoty se stanoví pilotem a nejsou metodologickou změnou:
- přesný fyzický rozměr metrické škály na kartě,
- minimální velikost reference v obrazu pro spolehlivou detekci,
- konečná poloha reference ve scéně.

## CHANGE REQUEST check
Tento dokument neprovádí metodologickou změnu Protocol v1. Jde o provozní specifikaci otevřené otázky kalibrační reference.
