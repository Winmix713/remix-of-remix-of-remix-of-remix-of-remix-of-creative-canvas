# WINMIX_METRICS_SPEC.md

**Fázis:** 2 (metrika-specifikáció) — a Phase 1 audit (meglévő pipeline leltára) még nyitott, ld. lent.
**Cél:** A WinMix Match Intelligence Layer / Team State Vector számára szükséges core-metrikák egységes, implementálható definíciója. Nem új, konkurens modell — a meglévő kronologikus pipeline, recency-súlyozás, H2H-shrinkage és score-matrix alapú piaci valószínűség-számítás bővítése.

---

## ⚠️ Előfeltétel — nyitott pont

Ez a dokumentum a megosztott elemzésben szereplő Tier 1/2/3 listákból épül fel, **a jelenlegi WinMix kódbázis ismerete nélkül**. Mielőtt implementációra megy:

1. Reconcile az alábbi ID-ket a ténylegesen már létező metrikákkal (kerülni a duplikációt — pl. ha `Attack Rating` már létezik Glicko-2 vagy Poisson formában).
2. A **Teszt státusz** oszlop minden sornál `TODO — Phase 1 audit szükséges`-ként kezelendő, amíg nincs megerősítve a tényleges kódból.

Ha megosztod a jelenlegi metrics/model engine kódot, ezt a táblát tudom véglegesíteni ellenőrzött státuszokkal.

---

## Séma (minden metrikára érvényes mezők)

| Mező | Jelentés |
|---|---|
| ID | Egyedi technikai azonosító |
| Formula | Számítási képlet |
| Időablak | Season / Last5 / Last10 / Decayed |
| H/A bontás | Van-e hazai/vendég szűrés |
| Min. minta | Ettől a mintaszámtól tekinthető megbízhatónak |
| Shrinkage | League prior felé húzás kis mintánál |
| Modellhasználat | Display only / Diagnostic / Shadow / Active feature / Core ranking |
| Teszt státusz | Proposed / Shadow / Validated / Rejected |

---

## Tier 1 — Kötelező alapmutatók (Raw / Team profil)

| ID | Név | Formula | Időablak | H/A | Min. minta | Shrinkage | Modellhasználat |
|---|---|---|---|---|---|---|---|
| T1-01 | Mérkőzésszám (M) | `count(matches)` | Season/L5/L10 | igen | — | nincs | Diagnostic |
| T1-02 | W-D-L profil | `count(outcome)/M` | Season/L5/L10 | igen | 5 | league prior felé | Active |
| T1-03 | Pont / PPG | `(3W+D)/M` | Season/L5/L10 | igen | 5 | league prior felé | Active |
| T1-04 | GF / GA / GD | `sum(goals_for)`, `sum(goals_against)`, `GF-GA` | Season/L5/L10 | igen | 5 | league prior felé | Active |
| T1-05 | GF per match | `GF/M` | Season/L5/L10 | igen | 5 | league prior felé | Active |
| T1-06 | GA per match | `GA/M` | Season/L5/L10 | igen | 5 | league prior felé | Active |
| T1-07 | BTTS % | `count(both_scored)/M` | Season/L5/L10 | igen | 8 | league prior felé | Active |
| T1-08 | Over 1.5 / 2.5 / 3.5 % | `count(total_goals>x)/M` | Season/L5/L10 | igen | 8 | league prior felé | Active |
| T1-09 | Clean sheet % | `count(GA=0)/M` | Season/L5/L10 | igen | 8 | league prior felé | Diagnostic |
| T1-10 | Nem szerzett gólt % | `count(GF=0)/M` | Season/L5/L10 | igen | 8 | league prior felé | Diagnostic |
| T1-11 | HT eredmény profil | `count(HT_outcome)/M` | Season/L10 | igen | 8 | league prior felé | Shadow |
| T1-12 | 2. félidős GF/GA | `FT_goals - HT_goals` (irányonként) | Season/L10 | igen | 8 | league prior felé | Shadow |
| T1-13 | Kanonikus HT/FT match log | forrásmező, nem számított | — | igen | — | — | Core input |

---

## Tier 2 — Származtatott, időbeli és H/A mutatók (WinMix-specifikus érték)

| ID | Név | Formula | Időablak | H/A | Min. minta | Shrinkage | Modellhasználat |
|---|---|---|---|---|---|---|---|
| T2-01 | Home Attack Rating | `home_GF/home_M ÷ league_home_GF_avg` | Season, decayed | csak H | 8 | league avg felé | Active feature |
| T2-02 | Home Defense Rating | `league_home_GA_avg ÷ home_GA/home_M` | Season, decayed | csak H | 8 | league avg felé | Active feature |
| T2-03 | Away Attack Rating | ua., away szűréssel | Season, decayed | csak A | 8 | league avg felé | Active feature |
| T2-04 | Away Defense Rating | ua., away szűréssel | Season, decayed | csak A | 8 | league avg felé | Active feature |
| T2-05 | Last5 / Last10 GF-GA | T1-05/06 szűkített ablakon | L5/L10 | igen | 5/10 | season átlag felé | Active feature |
| T2-06 | Recency-súlyozott forma | exponenciális decay-súlyozott PPG vagy GD | decayed | igen | 8 | league prior felé | Core ranking |
| T2-07 | BTTS% (Home / Away / L5 / L10) | T1-07 szűkített szegmensen | szegmens szerint | igen | 8 | league prior felé | Active feature |
| T2-08 | Góleloszlási profil | hisztogram: 0/1/2/3/4+ szerzett és kapott gól aránya | Season | igen | 15 | league eloszlás felé | Shadow |
| T2-09 | 0–0 arány | `count(0-0)/M` | Season | igen | 15 | league prior felé | Diagnostic |
| T2-10 | Kiütés (blowout) arány | `count(|GD|≥3)/M` | Season | igen | 15 | league prior felé | Diagnostic |
| T2-11 | Gólvolatilitás | `std(goals_for)` | Season | igen | 10 | league std felé | Shadow |
| T2-12 | Eredmény-volatilitás | `std(points_per_match)` | Season | igen | 10 | league std felé | Shadow |
| T2-13 | Támadóindex (liga-normalizált) | `team_GF/match ÷ league_avg_GF/match` | Season, decayed | opcionális H/A | 8 | 1.0 felé (liga-átlag) | Core ranking |
| T2-14 | Védekezőindex (liga-normalizált) | `league_avg_GA/match ÷ team_GA/match` | Season, decayed | opcionális H/A | 8 | 1.0 felé (liga-átlag) | Core ranking |

---

## Tier 3 — Kísérleti (csak shadow, aktiválás előtt validáció kötelező)

Ezek **nem** kerülhetnek Core ranking-be validált backtest nélkül, és mindegyikhez kötelező a `sample_size` + `confidence` pár megjelenítése:

- **Comeback Rate** — félidei hátrányból fordítás aránya. Min. minta: 20. Shadow.
- **Collapse / Lead-loss Rate** — félidei előny elvesztésének aránya. Min. minta: 20. Shadow.
- **HT→FT konverzió** — félidei vezetés megtartásának valószínűsége. Min. minta: 15. Shadow.
- **2. félidős támadó/védekező index** — külön Attack/Defense Rating csak a 2. félidőre. Min. minta: 15. Shadow.
- **H2H-módosító** — a meglévő H2H-shrinkage logika kimenete, **nem override**, csak additív korrekció a Matchup State-en. Már létező komponensként kezelendő — Phase 1 auditban ellenőrizendő, nem újraépítendő.

---

## Pipeline minden Tier 2/3 feature-höz aktiválás előtt

```
NEW METRIC → SHADOW → WALK-FORWARD TEST → CALIBRATION TEST
→ CORRELATION / REDUNDANCY TEST → VALUE TEST → ACTIVE
```

Egy metrika csak akkor kerülhet Core ranking-be, ha ezen a láncon bizonyítottan javít, és nincs erős korrelációja (redundancia) egy már aktív feature-rel.

---

## Következő lépés

1. Phase 1 audit: a fenti ID-k reconcile-olása a tényleges WinMix kóddal (mi létezik már, mi hiányzik, mi duplikált).
2. A `Teszt státusz` oszlop feltöltése a valós állapottal.
3. Matchup Engine specifikáció (Home Attack vs Away Defense párosítás-modellezés) — külön dokumentum, erre a táblára épül.
