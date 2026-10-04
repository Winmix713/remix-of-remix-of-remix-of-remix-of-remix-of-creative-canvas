# Fordulószintű kényszer és rezsimváltás vizsgálata — Top 3 legbiztosabb mérkőzés

## Cél
A múltbeli és az aznapi lejátszott eredmények alapján megtalálni fordulónként a 16 mérkőzésből (8 angol + 8 spanyol) azt a 3-at, amelyik a legkiszámíthatóbb. Két megfigyelést ellenőrzünk:
1. Ligánként a 8 mérkőzésből általában 3–5 BTTS, és legfeljebb 1–2 meglepetés van.
2. Ha egy párosítás „szinte mindig BTTS”, és egyszer mégsem az, akkor a generátor aznap más üzemmódban működhet.

## Szemlélet
- Ha a generátor valóban véletlenszerű, egy-egy mérkőzés nem jósolható, de a **forduló egészére vonatkozó szabályok** igen (pl. hány BTTS és hány meglepetés jöhet még).
- Ezért nem egyesével „tippelünk”, hanem a forduló kereteiből számolunk vissza: mi maradt még a forduló „keretéből”.
- Minden állítást először igazolni kell a 24 720 mérkőzésen, és csak utána építhető be. Amíg nincs igazolva, csak tájékoztató.

## 1. lépés — A megfigyelések ellenőrzése (csak elemzés)
- **BTTS-sáv:** fordulónkénti BTTS-szám eloszlása ligánként, összevetve azzal, mi jönne ki, ha a mérkőzések függetlenek lennének. Ha a valós eloszlás szűkebb (sokkal gyakoribb a 3–5), akkor van fordulószintű kényszer.
- **Meglepetés-plafon:** meglepetés = az esélyes (rating alapján) kikap. Fordulónkénti darabszám eloszlása, ugyanígy a független modellhez mérve.
- **Párosítási BTTS-minta:** csapatpárok, ahol a korábbi egymás elleni BTTS-arány ≥ 80%. Ha egyszer megtörik, megnézzük: abban a fordulóban a többi mérkőzés is eltért-e a megszokottól (BTTS-szám, gólátlag, meglepetések). Ha igen, ez rezsimváltás jele.
- Eredmény: mindhárom szabályra COMPATIBLE / INCOMPATIBLE / INCONCLUSIVE, hatásmérettel és 95%-os intervallummal, angol és spanyol külön.

## 2. lépés — Fordulón belüli frissítés (csak ha az 1. lépés igazol valamit)
- Ahogy a forduló mérkőzései lezajlanak, a még hátralévők esélyét a keret alapján igazítjuk: pl. ha már 5 BTTS megvolt, a maradéknál csökken a BTTS esélye; ha már 2 meglepetés volt, a maradék esélyesek biztosabbak.
- Rezsimjelző: ha egy erős BTTS-párosítás megtörik, vagy a forduló eleje szokatlan, az aznapi frissítés óvatosabb lesz (kevesebb mérkőzés kerül a Top 3-ba).

## 3. lépés — Top 3 kiválasztás
- Pontszám = esélyes kimenet valószínűsége a keret-igazítás után, mínusz a rezsimbizonytalanság.
- Csak ott ajánl, ahol a visszamenőleges teszt szerint a Top 3 találati aránya érdemben jobb, mint a mostani rangsoré. Ha nem jobb, nem kapcsoljuk be.

## Mit nem csinálunk
- A jelenlegi előrejelző motor, rangsor és beállítások nem változnak automatikusan; minden új szabály előbb külön nézetben, tájékoztatóként jelenik meg.
- Nem használunk véletlenszimulációt a tippekhez.

## Technikai részletek
- Új modulok: `src/utils/generator/roundConstraints.ts` (BTTS-sáv, meglepetés-plafon, Monte Carlo független nullmodell seedelve `BOOTSTRAP_SEED`-del), `src/utils/generator/regimeShift.ts` (H2H BTTS-törés + fordulószintű eltérés, permutációs teszt), BH-FDR korrekció.
- Fordulóazonosítás: dátum + liga csoportosítás, 8 mérkőzéses blokkok.
- Walk-forward: a frissítés csak a forduló már lejátszott mérkőzéseit használhatja.
- Szintetikus generátorok Vitest-tel: kényszer nélküli és kényszeres változat; a tesztnek mindkettőt helyesen fel kell ismernie.
- Megjelenítés: a Pipeline Audit új „Fordulószerkezet” paneljén; Forduló Prediktorban csak tájékoztató jelvény.
