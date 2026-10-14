# Protocol Change Policy

## Účel dokumentu
Tento dokument definuje pravidla změn experimentálního protokolu po uzamčení Protocol v1.

## Co znamená LOCKED
- Stav `LOCKED` znamená metodologicky schválený baseline, který se během běžné realizace nemění.
- LOCKED protokol je autoritativní zdroj pro biologický design, endpointy, definice měření a pravidla integrity dat.

## Co je metodologická změna
Za metodologickou změnu se považuje zejména:
- změna biologického materiálu nebo počtu rostlin/skupin,
- změna definice skupin nebo vodního režimu,
- změna primárního/sekundárního endpointu,
- změna definice výšky rostliny,
- změna frekvence či nezávislosti manuální reference,
- změna pravidel kalibrace, která mění interpretaci fyzikálních výsledků,
- změna pravidel integrity dat, která by umožnila přepis RAW dat.

## Co je technická nebo dokumentační změna
Za technickou/dokumentační změnu se považuje zejména:
- upřesnění názvosloví bez změny významu,
- doplnění pracovních checklistů,
- úprava formátu souborových názvů,
- doplnění instrukcí obsluhy bez dopadu na metodologii,
- opravy překlepů a stylistiky.

## Verzování
- `v1.1`, `v1.2`, ...: drobné technické/dokumentační revize beze změny metodologie.
- `v2.0`: nutné při metodologické změně.
- Každá verze musí mít jasné datum účinnosti a odkaz na schválení.

## Kdy je nutné Protocol v2
Protocol v2 je povinný, pokud se mění alespoň jedna metodologická položka definovaná výše, nebo pokud pilot odhalí nutnost změny, která mění interpretaci výsledků.

## Povinný zápis změn do CHANGELOG
- Každá změna musí být zapsána do `CHANGELOG.md`.
- Zápis obsahuje minimálně: datum, typ změny, dotčené dokumenty, stručné zdůvodnění, schvalující roli.

## Schvalovací role
- Metodologické změny (`v2.0`) vyžadují schválení role: Scientific Supervisor / Vedoucí metodiky.
- Technické/dokumentační změny (`v1.x`) vyžadují schválení role: Project Maintainer.

## Zákaz zpětné úpravy RAW dat
- RAW data se nikdy zpětně neupravují kvůli nové metodice nebo technické revizi.
- Při změně metodiky se historická RAW data zachovávají v původní podobě a interpretují se s odpovídajícím kontextem verze protokolu.
- Opravy se řeší pouze odvozenými vrstvami dat nebo novým během experimentu, nikoli přepisem RAW.
