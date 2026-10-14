# Randomizační a rotační protokol

## Účel
Definovat jednoduchý a auditovatelný mechanismus:
- randomizace rostlin do skupin `G0/G1/G2`,
- evidence výchozích pozic,
- následná rotace pozic květináčů,
- úplná dohledatelnost změn v čase.

## Principy
- Bez speciálního software.
- Každá rostlina má persistentní `plant_id`.
- Každý přesun je zaznamenán s datem a důvodem.
- Historie se nepřepisuje, pouze doplňuje.

## Definice prostoru
- Pěstební prostor rozděl na mřížku pozic (např. `P01` až `P45` dle kapacity).
- Vytvoř fyzický plán pozic vytištěný a viditelný u experimentu.
- Každá pozice má jednoznačný `position_id`.

## Randomizace do skupin (den 0)
### Krok 1: Příprava seznamu
- Připrav seznam `plant_id` všech životaschopných rostlin určených do experimentu.
- Počet rostlin rozděl na 3 skupiny s cílem 15/15/15 (minimum 12/skupina).

### Krok 2: Jednoduchá auditovatelná metoda
Doporučená metoda bez software:
1. Vytiskni kartičky s `plant_id`.
2. Kartičky zamíchej v neprůhledné nádobě.
3. Postupně losuj a přiřazuj:
   - prvních N do `G0`,
   - dalších N do `G1`,
   - dalších N do `G2`,
   kde N je cílový počet na skupinu.
4. Losování prováděj za přítomnosti minimálně dvou osob (operátor + svědek).

Poznámka:
Použití jednoduchého scriptu nebo tabulky je možné, ale není vyžadováno. Pokud se použije, musí být uložen seed/postup.

### Krok 3: Zápis randomizace
Zapiš minimálně:
- `plant_id`
- `group`
- `randomization_date`
- `randomization_method`
- `operator`
- `witness`

## Přiřazení výchozí pozice
Po randomizaci přiřaď každé rostlině výchozí `position_id`.
Zapiš minimálně:
- `plant_id`
- `group`
- `position_id`
- `timestamp`
- `reason` = initial_assignment

## Rotace pozic během experimentu
## Cíl rotace
Snížit vliv mikrogradientů prostředí (světlo, proudění, lokální teplota) bez změny skupiny.

## Pravidla
- `plant_id` i `group` zůstávají beze změny.
- Mění se pouze `position_id`.
- Rotace se provádí v předem definovaném rytmu (např. 1x týdně), finální frekvence je PILOT DECISION.
- Rotace musí být deterministická a jednoduše popsatelná.

## Doporučený rotační mechanismus
- Pro každou skupinu používej samostatný seznam pozic.
- Při rotaci proveď cyklický posun o jedno místo v rámci seznamu pozic skupiny.
- Tento mechanismus je jednoduchý, reprodukovatelný a auditovatelný bez software.

## Log změn pozic (povinný)
Každý přesun musí mít vlastní záznam:
- `timestamp`
- `plant_id`
- `group`
- `position_from`
- `position_to`
- `change_type` (initial_assignment/rotation/manual_override)
- `reason`
- `operator`

## Audit trail
Musí být vždy možné zpětně doložit:
- původní `plant_id`,
- přidělenou skupinu,
- původní pozici,
- každou změnu pozice,
- datum změny.

## Výjimky a odchylky
- Při mimořádné změně (poškození květináče, bezpečnostní důvod) použij `change_type = manual_override`.
- Odchylka nesmí být mazána; musí mít textový důvod a podpis operátora.

## Pilot decisions
- Finální frekvence rotace (např. 1x týdně vs 2x týdně).
- Přesné mapování pozic na fyzické uspořádání místnosti.

## CHANGE REQUEST check
Tento dokument neprovádí metodologickou změnu Protocol v1. Specifikuje provozní provedení randomizace a evidence pozic.
