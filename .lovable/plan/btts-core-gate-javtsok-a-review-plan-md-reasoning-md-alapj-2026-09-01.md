# BTTS Core-gate javítások a review (plan.md + Reasoning.md) alapján

## Cél
A FixturePredictor core-útja (16 meccs → Top 3+3) jelenleg a BTTS-jelölteket — beleértve a legerősebbet is — szisztematikusan kiszűri. A review két strukturális hibát azonosított, amiket a kódellenőrzés megerősített. A terv a két kritikus fixet tartalmazza, verifikációval és regressziós tesztekkel.

## 0. lépés — Verifikáció javítás előtt
- Az alkalmazás futtatása, egy kör elemzése, és a **Core decision trace** panel "Elsődleges ok" oszlopának leolvasása:
  - `Cáfolt sáv` → H1 (sáv-kizárás) üt
  - `Modell–H2H konfliktus` → H2 (model_conflict) üt
  - `Stabilitás` / `Hideg minta` / `Kvadráns` → H3/H4/H5
- Ez adja meg, hogy a saját adatainkon melyik kill-path dominál (adatfüggő: a sávok tele vannak-e ≥20 megfigyeléssel).

## 1. lépés — H1: Phase 6 sáv-kizárás aktiválási flag mögé
- `src/utils/slip.ts`: új exportált konstans `PHASE6_MARKET_GATING_ACTIVE = false` (a Release D-ig).
- `gateFailuresForKind()` core ágában: `level === 'excluded'` esetén a `'band'` hiba csak akkor pusholódjon, ha a flag aktív; egyébként a jelölt `conditional`-ként viselkedik (látható figyelmeztetés, nem terminális kizárás).
- A joker ágon (laza kapu) a kizárás maradhat, de konzisztens flagelés itt is.
- **Nem változik**: `coreEvidence.ts` — a snapshot továbbra is rögzíti a mért verdiktet (a trace és az audit becsületes marad).

## 2. lépés — H2: model_conflict per-market + leminősítés
- `hasMaterialModelConflict()` helyett per-pattern ellenőrzés: `|pattern.hitRate − pattern.modelProb| ≥ BTTS_CONFLICT_SPREAD`, ahol `modelProb` létezik.
- Ezzel megszűnik a cross-market leak: BTTS-alapú konfliktus többé nem vet ki O2.5/1X2 jelöltet.
- A gate hard kizárásból rangsor-büntetéssé minősül (a rangsorban hátrébb kerül, de nem esik ki), VAGY hard gate marad csak szigorú feltétellel (pl. spread ≥ 0.25 ÉS alacsony ESS) — a pontos formát a 0. lépés trace-eredménye dönti el.

## 3. lépés — Regressziós tesztek (vitest)
- `gateFailuresForKind`: excluded-evidence jelölt flag=false mellett átmegy; flag=true mellett kiesik.
- Per-market konfliktus: BTTS-spreades fixture O2.5 jelölte nem esik ki; a BTTS jelölt rangsor-büntetést kap.
- A meglévő suite-ok (`coreTierTests`, `coreCanonicalTests`, `coreEvidenceTests`) zölden maradnak.

## 4. lépés — Verifikáció javítás után
- Ugyanaz a kör újra: a trace panelen a korábban kiesett jelölteknél az ok eltűnik, a Core kártyák feltöltődnek.
- Build + teljes tesztfuttatás.

## Kimarad ebből a körből (későbbi lépésként, külön jóváhagyással)
- Display/gate szerződés: a gated (shrunk) érték megjelenítése a nyers mellett (PatternList / kártyák), a három BTTS-szám annotálása — review 4. ajánlása.
- Tuning: `marketConfidence` szaturáció igazítása az elérhető ESS-tartományhoz (15 → ~11) VAGY `cMin` 56 lejjebb vétele — a Primary tier ma elérhetetlen gól-piacokon. Eligibility-t nem érint.
- `useWinmixEngine` god-hook szétbontása (review 3. ajánlása) — a core path stabilizálása után.
- Felhő-konfiguráció tisztázása: a gyökér `.env` (Lovable Cloud) vs. `src/.env` + `cloudConfig.ts` fallback (külső projekt) jelenleg eltérő backendet jelöl; a kanonikus felhő-tier kijelölése külön feladat.

## Technikai részletek
- Érintett fájlok: `src/utils/slip.ts` (flag + gate + rangsor), esetleg `src/utils/bttsProfile.ts` (konstans újrahasznosítás), új tesztfájl.
- Küszöbök nem változnak: `CORE_STABILITY_MIN=55`, `BAND_MIN_SAMPLE=20`, `SECONDARY_MARKET_P_MIN=0.58`, `BTTS_CONFLICT_SPREAD=0.18` — csak a kapuk aktiválási logikája és a konfliktus hatóköre.
- A trace panel és az audit felületek továbbra is a mért (becsületes) verdikteket mutatják; a flag csak a kizárás terminálisságát kapcsolja.
