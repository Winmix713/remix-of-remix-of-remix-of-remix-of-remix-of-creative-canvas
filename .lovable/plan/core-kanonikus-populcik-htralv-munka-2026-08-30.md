# Core kanonikus populációk — hátralévő munka

A `evidenceTally.all → raw` átnevezés már megtörtént, és a TypeScript fordítás jelenleg hibamentes (ellenőrizve). Így a hátralévő munka a populáció-megjelenítés, a nevezők egységesítése, a szűrési sorrend és az új regressziós teszt-készlet.

## 1. CoreDecisionTracePanel — populáció-csík és összevont sorok
- Új, vízszintes összegző csík a három tally-kártya fölé: **nyers → kapun belüli → kanonikus → összevont**, a `trace.populations` meglévő mezőiből (`rawRecords`, `afterActiveProfileVetoRaw`, `canonicalEligible`, `mergedEligibleDuplicates`, `placed`). Minden szegmens felirata megnevezi a saját populációját, hogy a számok soha ne látszódjanak egymás ellentmondásának.
- A `trace.duplicates` csoportokban az összevont (nem nyertes) sorok dimmelt „összevonva → {nyertes id}” megjelölést kapnak, a `winnerId` alapján.

## 2. Fejlécek és nevezők
- `CoreCandidateTable.tsx`: a jelenlegi „Core-ra jogosult (kapun belül)” felirat pontosítása **„Core-ra jogosult (kanonikus, kapun belüli)”**-re, mellette külön sor: **„Nyers stratégia-piaci rekordok: N”**.
- `FixturePredictor.tsx` Core-fejléce a kanonikus jogosult számot használja nevezőként (nem a nyers rekordszámot).

## 3. buildPooledCore szűrési sorrend (`src/utils/slip.ts`, ~1247)
Jelenleg `canonicalCandidates(rawPool)` fut előbb, és az `isCoreEligible` csak utána. Ez azt jelenti, hogy egy kapun kívüli rekord kanonikus nyertes lehet, és így elnyomhat egy kapun belüli sort. A sorrend megfordul: **előbb `isCoreEligible` szűrés, aztán `canonicalCandidates`**. A `canonicalCandidateCount` számláló ezután a kanonikus, kapun belüli halmazt számolja.

## 4. Új regressziós készlet: `src/utils/coreCanonicalTests.ts`
`coreTierTests.ts` / `coreEvidenceTests.ts` mintájára, tiszta és szinkron, A–H esetekkel:
- A: nincs duplikátum → nyers = kanonikus
- B: két rekord egy fixture-re → egy nyertes, egy összevont
- C: kapun kívüli „erősebb” rekord nem nyomja el a kapun belülit
- D: minden rekord kapun kívül → 0 kanonikus jogosult
- E: fixture-ütközés a kártyák között (egy fixture csak egyszer)
- F: Secondary tier tölt üres kártyát, de nem szorít ki Primaryt
- G: feltételes evidencia beszámítása a helyes tally-be
- H: tally-invariáns: placed ⊆ eligible ⊆ raw

Ehhez `CoreCanonicalSuitePanel` komponens (a `CoreTierSuitePanel` mintájára), beépítve a `PipelineAudit` oldalba.

## 5. Ellenőrzés
Teljes TypeScript build, majd 16 fixture-ös futás a preview-ban: a Core-fejléc nevezője, a trace-csík számai és a duplikátum-sorok konzisztenciájának vizuális ellenőrzése, konzolhibák nélkül.

## Technikai megjegyzés
Új mező vagy új kapu nem kerül be; minden szám a meglévő `CoreTracePopulations` / `CoreTraceEvidenceTally` mezőkből származik, a verdiktek változatlanok maradnak. Az egyetlen viselkedésbeli változás a 3. pont szűrési sorrendje.
