# Protocol v1 - LOCKED

STATUS: LOCKED  
VERSION: 1.0

## 1. Cíl experimentu
Cílem je reprodukovatelně měřit růst rostlin (Phaseolus vulgaris) a porovnat automatizované měření (AI/CV + deterministická geometrie + kalibrace) s nezávislou manuální referencí.

## 2. Biologický materiál
- Druh: Phaseolus vulgaris (fazole).
- Jedna rostlina na jeden květináč.
- Každá rostlina má trvalý identifikátor `plant_id`.

## 3. Počet rostlin a experimentální skupiny
- Počet skupin: 3.
- Skupiny: `G0`, `G1`, `G2`.
- Cílový počet: 15 rostlin na skupinu.
- Minimální akceptovatelný počet: 12 rostlin na skupinu.

## 4. Randomizace
- Rostliny se po založení experimentu náhodně přiřadí do skupin `G0/G1/G2`.
- Randomizační postup se zaznamená do metadat (metoda, datum, osoba).
- Případné přesuny pozic květináčů během experimentu musí být logovány s časem a důvodem.

## 5. Květináče a substrát
- Typ květináče a substrátu musí být jednotný napříč skupinami.
- Počáteční stav (typ, objem, šarže substrátu) se eviduje v metadatech.
- Jakákoli provozní odchylka (např. výměna květináče) se explicitně zaznamená.

## 6. Vodní režim
### 6.1 Definice skupin
- `G0` = 100 % referenční cílové hodnoty.
- `G1` = 85 % relativní cílové hodnoty.
- `G2` = 70 % relativní cílové hodnoty.

### 6.2 Důležité metodologické upřesnění
Hodnoty 100/85/70 jsou protokolem definované relativní gravimetrické cíle. Nejsou to přímá fyziologická procenta dostupnosti vody pro rostlinu.

## 7. Gravimetrické vážení a doplňování vody
- Denně se váží každý květináč individuálně.
- Denně se doplňuje voda na cílovou hodnotu příslušné skupiny.
- Vážení i zálivka se provádějí v konzistentním denním časovém okně, pokud je to prakticky možné.
- Každý záznam obsahuje minimálně: `plant_id`, datum/čas, skupinu, naměřenou hmotnost před zálivkou, cílovou hmotnost, doplněné množství vody.

## 8. Drift correction (týdenní korekce)
- Jednou týdně se provede drift correction vůči kontrolní skupině (`G0`).
- Cílem je korigovat systematické provozní odchylky v referenční gravimetrické úrovni.
- Korekce musí být zdokumentována (důvod, metoda, odpovědná osoba, timestamp).
- Drift correction nesmí měnit metodologický význam skupin 100/85/70.

## 9. Délka experimentu
- Plánovaná délka: 28 dní.
- Minimální akceptovatelná délka: 21 dní.
- Každý den experimentu má evidovaný `experiment_day`.

## 10. Fotografování (standardizace)
- Jedna standardizovaná fotografie denně na rostlinu.
- Preferováno stejné denní časové okno.
- Side-view snímání.
- Konzistentní kamera, vzdálenost, úhel, osvětlení, pozadí a orientace.
- Kalibrační reference má být v každém snímku, kdykoli je to prakticky možné.
- Každý snímek má jedinečné `image_id` propojitelné na `plant_id`.

## 11. Pravidla `plant_id` a dohledatelnosti
- `plant_id` je persistentní po celou dobu experimentu.
- Každý záznam (obraz, vážení, manuální měření, failure) musí být mapovatelný na `plant_id`.
- Pro každý snímek je vyžadována vazba `plant_id` + `image_id` + `timestamp`.

## 12. Manuální reference
- Frekvence: 3x týdně.
- Na každou rostlinu a sezení 2 opakování měření.
- Manuální reference je nezávislý referenční zdroj.
- AI/CV výstup nesmí ovlivnit manuální odečet ani zápis referenčních hodnot.

## 13. Parametry a endpointy
- Primární parametr: výška rostliny v cm.
- Sekundární parametr: projektovaná nadzemní plocha.

## 14. Přesná definice výšky
Výška rostliny je vertikální vzdálenost mezi referenčním bodem na úrovni půdy v místě emergentního bodu stonku a nejvyšším nadzemním bodem rostliny, měřená podél definované obrazové vertikály a převedená kalibrací na fyzikální jednotku (cm). Stejná definice platí pro manuální i automatizované měření.

## 15. Kontrolované proměnné
- Kamera a nastavení snímání.
- Vzdálenost a úhel kamery.
- Osvětlení a pozadí.
- Orientace rostliny vůči kameře.
- Typ květináče a substrátu.
- Denní časové okno pro vážení/zálivku/fotografování (pokud prakticky možné).

## 16. Minimum metadat
Každý relevantní záznam má obsahovat alespoň:
- `plant_id`
- `image_id` (pro obrazová data)
- `timestamp`
- `group`
- `experiment_day`
- `model_version` (pokud je použit model)
- `pipeline_version`
- `calibration_status` a/nebo kalibrační parametr
- `failure_status` a `failure_code` (je-li relevantní)

## 17. Failure handling
Selhání se nikdy nemažou ani neschovávají, pouze explicitně evidují.
Povolené kódy selhání:
- `no_detection`
- `poor_image_quality`
- `occlusion`
- `plant_damaged`
- `plant_dead`
- `calibration_failed`

## 18. Pilot requirement
Před plným během je vyžadován pilot, jehož cílem je ověřit provozní proveditelnost:
- konzistenci denního režimu,
- stabilitu fotografického setupu,
- úplnost metadat,
- použitelnost kalibrační reference,
- kvalitu vazeb mezi `plant_id` a `image_id`.
Pilot nesmí měnit LOCKED metodologický základ v1; může pouze upřesnit provozní detaily.

## 19. Kvalita dat
- RAW data jsou immutable.
- Chybějící, neúplné nebo problematické záznamy se označují, nemažou.
- Musí být možné auditovat původ každé hodnoty.
- Korelace sama o sobě není důkaz přesnosti měření.

## 20. Reprodukovatelnost
- Postup musí být opakovatelný při stejném setupu a metodice.
- Výpočet fyzikálních veličin musí vycházet z deterministické geometrie a kalibrace, je-li to proveditelné.
- Princip AI/CV pipeline:
  image -> AI detekce/segmentace -> deterministická geometrie -> kalibrace -> fyzikální měření -> uložení -> statistická analýza.

## 21. Validace automatizovaného měření
Automatizované výsledky se porovnávají proti manuální referenci minimálně pomocí:
- absolutní chyby,
- relativní chyby,
- MAE,
- RMSE,
- bias,
- korelace.
Samotná korelace není dostatečný důkaz přesnosti.

## 22. OPERATIONAL DETAILS THAT MAY STILL BE SPECIFIED
Následující body lze doplnit bez metodologické změny v1:
- konkrétní model štítku pro `plant_id` (materiál, formát tisku),
- přesný standard názvů souborů,
- detailní rozpis denního časového slotu,
- fyzické uspořádání scény pro side-view snímání,
- konkrétní formulář/checklist pro obsluhu.

## 23. OPEN QUESTIONS / PILOT DECISIONS
- Jaký kalibrační referenční objekt bude nejstabilnější v dlouhém časovém horizontu (materiál, rozměr, pozice)?
- Jaký konkrétní randomizační mechanismus bude nejlépe auditovatelný v podmínkách laboratoře/třídy?
- Jaká minimální hranice přijatelné kvality snímku bude v pilotu prakticky dosažitelná bez zvýšení failure rate?
