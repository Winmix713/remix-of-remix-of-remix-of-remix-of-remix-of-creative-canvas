# Termelési felkészültség — hátralévő munka a hat főoldalon

A javasolt lista nagyrészt egyezik a kóddal, két pontosítással:

- `evaluateBttsBandHealth` **már nincs duplikálva**: a kanonikus változat a `coreEligibility.ts`-ben él, a `coreEvidence.ts` csak újraexportálja. Itt nincs teendő, legfeljebb a `lastinfo.md` P1 pontjának lezárása.
- A `candidateState` mező **létezik és számolódik** a jelöltekre, csak sehol nem jelenik meg a felületen. A három termelési kapu (`BTTS_DEATHZONE_GATE_ACTIVE`, `PHASE6_MARKET_GATING_ACTIVE`, `MARQUEE_RANKING_ACTIVE`) valóban kikapcsolt (shadow) állapotban van, és ez sem látszik a felhasználónak.

A munkát három fázisra bontom, mert a backtest nélkül a többi jelzés csak "validálatlan" címkét tudna mutatni.

## 1. fázis — Döntési állapot láthatóvá tétele (kód nélküli kockázat, gyors érték)

- **Forduló Prediktor**: minden jelölt sor mellé színkódolt állapotjelvény (blokkolt / megjelölt / jogosult / publikált), a döntési trace panelben az állapotátmenet-lánc kiírása.
- **Forduló Prediktor**: a "0 core jelölt" eset pozitív, magyarázó üres állapotként jelenik meg (nem hibaként), a kizárás okainak felsorolásával.
- **Forduló Prediktor / kapustátusz panel**: a három termelési kapu aktuális állása (aktív / árnyékmód) és annak jelentése.
- **Tipp Napló**: a mentett szelvénysorok mellett a mentéskori végállapot megjelenítése; a "0 core" fordulók külön, értékes mérési sorként jelennek meg a kohorsz-táblában.

## 2. fázis — Backtest infrastruktúra

- Új számítási modul, amely a betöltött történelmi szezonokból idő szerint rendezett tanító/teszt vágást készít, out-of-sample előrejelzést futtat, majd a jelöltgenerálás → evidencia → kockázat → érték → core kiválasztás láncot végigviszi, és a valós BTTS kimenetekhez méri.
- Metrikák: Brier, LogLoss, kalibrációs hiba, találati arány, hozam, maximális visszaesés, kiválasztási stabilitás, core publikációs gyakoriság. Jövőbeli információ nem szivároghat vissza.
- Küszöbérték-sweep: 0.48, 0.58, 40–55% halálzóna, +25 / −50 / −100 evidencia-büntetések.
- Rangsúly-összehasonlítás: jelenlegi 60/25/15, csak modell, kalibrált + evidencia, kalibrált + evidencia + kockázat, alternatív optimalizált súlyozás.
- A futtatás a háttérszálon (worker) fut, hogy a felület ne fagyjon; az eredmény a helyi tárolóba kerül.

## 3. fázis — Eredmények megjelenítése és felkészültségi kapu

- **Pipeline üzemeltetés**: új "Validáció / Backtest" fül a futtatás indítására, előrehaladással és utolsó futás időbélyegével; a beállítások fülön a validálatlan küszöbök megjelölése; a súlyozás fülön az alternatív súlyozások összehasonlító nézete.
- **Pipeline audit**: "Küszöbérték validáció" és "Rangsúly összehasonlítás" panelek; "Állapotgép lefedettség" panel arról, hogy a lánc melyik átmenetére van teszt; a kalibrációs ítéletsáv csak akkor zöld, ha a küszöbök validáltak.
- **Taktikai Stúdió**: "Termelési felkészültség" összegzés a `lastinfo.md` elfogadási kritériumai szerint (tud-e 0 core-t kiadni, tud-e blokkolni elégtelen evidenciánál, rekonstruálható-e minden döntés a trace-ből), plusz a backtest adatforrás állapota.
- A kapuk élesítése (`false → true`) csak akkor javasolt a felületen, ha a backtest az adott küszöbre pozitív out-of-sample eredményt ad.

## Technikai megjegyzések

- Új fájlok várhatóan: `src/utils/backtest.ts` (motor), `src/utils/backtestMetrics.ts` (mérőszámok), worker-bővítés a `pipeline.worker.ts` mellé, illetve új panelek a `src/components/winmix/` alatt.
- A `candidateState` badge egy közös komponensként készül, hogy a Prediktor és a Napló ugyanazt a vizuális nyelvet használja.
- A `lastinfo.md` P0 ellentmondása (refuted evidencia + 58% modell) külön döntést igényel: jelenleg a kód szerinti viselkedést a backtest fogja alátámasztani vagy cáfolni; a policy-választást (hard vétó vagy szabályozott felülbírálás) a 2. fázis eredménye alapján rögzítjük.
- Az összes új mérés a helyi adatokból dolgozik; a felhő tier továbbra is csak olvasó keresztellenőrzés marad.
