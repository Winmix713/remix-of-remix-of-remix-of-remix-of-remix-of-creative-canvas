# WINMIX Phase 1 Audit — Metrikák vs. Kódbázis

**Dátum:** 2026-09-03
**Forrásdokumentumok:** `docs/WINMIX_METRICS_SPEC.md`, `docs/WinMix_Match_Intelligence_Layer.md`
**Cél:** A spec metrika-ID-i és a tényleges kódimplementáció összevetése — mi létezik, mi hiányzik, mi duplikált.

---

## Vezetői összefoglaló

| Státusz | Darab | Metrika-ID-k |
|---|---|---|
| **LÉTEZIK** (teljesen vagy funkcionálisan egyenértékű) | 8 | T1-01, T1-02, T1-03, T1-04, T1-13, T2-01*, T2-02*, T2-03*, T2-04*, HT→FT konverzió, H2H módosító |
| **RÉSZBEN LÉTEZIK** (létezik, de szűkebb vagy eltérő formában) | 9 | T1-05, T1-06, T1-07, T1-08, T1-11, T1-12, T2-05, T2-10, Collapse rate |
| **HIÁNYZIK** (nincs implementáció) | 10 | T1-09, T1-10, T2-07, T2-08, T2-09, T2-11, T2-12, Comeback rate, 2H Att/Def rating |
| **DUPLIKÁLT** (a spec redundáns ID-kat hoz létre) | 2 | T2-13/T2-14 = T2-01/T2-02 (azonos képlet, eltérő H/A granularitás) |

**Fő következtetés:** A javasolt ~25-35 metrikából 8 már létezik (gyakran kifinomultabb formában, decay + shrinkage segítségével), 9 részben létezik, 10 teljesen hiányzik, és 2 a specben magában duplikált. A legnagyobb strukturális hiány a **csapatszintű szezon-statisztikák** (BTTS%, Over%, clean sheet%, stb.) teljes hiánya — a kód ma match-szintű feature-öket számol a forecast pipeline számára, nem pedig egy teljes csapatprofilt.

---

## Architekturális kontextus

A WinMixben **két különálló metrika-rendszer** működik, amelyeket nem szabad összemosni:

1. **Forecast pipeline** (`forecastCore.ts`) — 20-dimenziós `FeatureVector`-t épít meccsenként, decay-jel + shrinkage-dzsel ellátott venue attack/defense, form, H2H PPG és HT dinamika értékekkel. Ez táplálja a B1 (Poisson) és M1 (logisztikus) modelleket.

2. **H2H pattern engine** (`patterns.ts`) — recency-súlyozott, Kish ESS alapú zsugorított arányokat számol direkt találkozókon, pattern matching céljából. Saját `LeagueBaselines` számítással.

A spec Tier 1/2 metrikái **csapatszintű szezon-statisztikák**, de a kód **meccsszintű, venue-szűrt feature-öket** számol a forecast számára. Ezek rokonok, de nem azonosak — a kód általában *kifinomultabb* (decay + shrinkage), de *szűkebb körű* (csak amit a modell fogyaszt, nem egy teljes csapatprofil).

---

## Tier 1 — Kötelező alapmutatók

| ID | Spec név | Státusz | Hol a kódban | Eltérés a spec-től | Kifinomultság |
|---|---|---|---|---|---|
| **T1-01** | Mérkőzésszám (M) | **LÉTEZIK** | `StandingRow.played`; `forecastCore.playedCount()`; `MatchPipeline.context.homePlayed/awayPlayed` | Kód követi a csapatonkénti összesített játszott meccseket. Nincs explicit L5/L10 változó, de a `formOf()` `slice(-window)`-ot használ, tehát a darabszám implicit. | Egyenértékű. |
| **T1-02** | GY-D-V profil | **LÉTEZIK** | `StandingRow.wins/draws/losses`; `H2HRecord.homeWins/draws/awayWins` (H2H scope) | A tabella nyers számlálókat ad (GY/D/V), nem arányokat. Az arányok származtathatóak: `wins/played`. Nincs L5/L10 bontás. Nincs shrinkage a tabella számlálókon. | Egyenértékű szezonra; hiányzik a szegmentált ablak. |
| **T1-03** | Pont / PPG | **LÉTEZIK** | `StandingRow.points` (nyers); `TeamForm.ppg` in `formOf()` (utolsó 5 PPG) | Szezon összpontszám létezik. PPG-utolsó-5 létezik mint `home_form_5`/`away_form_5` a FeatureVector-ban. Nincs L10 PPG. Nincs explicit shrinkage a PPG-n (a form sima átlag, nem `decayedShrunkAvg`). | Egyenértékű szezonra; a form sima ablak-átlag, nem decay-jel. |
| **T1-04** | GF / GA / GD | **LÉTEZIK** | `StandingRow.gf/ga` (szezon összesen); `TeamForm.gdAvg` (utolsó 5 GD átlag) | Szezon GF/GA létezik. GD = gf-ga származtatható. Utolsó-5 GD átlag létezik mint `home_gd_form_5`. Nincs L10. A tabellában nincs H/A GF/GA bontás (csak `homeAtt`/`awayAtt` = GF/meccs). Az `autoWeights.ts` belsőleg követi a `homeGf/homeGa/awayGf/awayGa`-t, de csak `netHome/netAway`-t ad ki. | Egyenértékű szezonra; a H/A bontás részben létezik az autoWeights-ben, de nincs kitéve. |
| **T1-05** | GF meccsenként | **RÉSZBEN LÉTEZIK** | `StandingRow.homeAtt` = homeGf/homeM; `StandingRow.awayAtt` = awayGf/awayM; `venueAttack()` (decayed) | H/A GF/meccs létezik a tabellában. Összes GF/meccs = gf/played származtatható. DE: a `venueAttack()` **decayed+shrunk** GPM-et ad, nem sima átlagot — ez táplálja a forecastot. Nincs L5/L10 GF/meccs önálló metrikaként. | **Kifinomultabb** venue-ra (decay+shrinkage); hiányzik a sima szezon/L5/L10. |
| **T1-06** | GA meccsenként | **RÉSZBEN LÉTEZIK** | A `StandingRow` NEM adja ki a GA/meccs-et vagy H/A GA bontást. A `venueDefense()` decayed+shrunk GA/meccs-et ad venue-ra. Az `autoWeights.ts` belsőleg követ `homeGa/awayGa`-t. | Összes GA/meccs = ga/played származtatható a tabellából. H/A GA/meccs csak decayed venue defense-ként létezik (`home_def_home`, `away_def_away`). Nincs sima (nem decayed) H/A GA/meccs. Nincs L5/L10. | **Kifinomultabb** venue-ra; hiányzik a sima H/A és az ablakozott változat. |
| **T1-07** | BTTS % | **RÉSZBEN LÉTEZIK** | `H2HGoalStats.bttsPct` (H2H scope, `computeGoalStats()`); `H2HGoalProfile.bttsRate/weightedBttsRate/shrunkBttsRate` (H2H); `LeagueBaselines.btts` (liga prior); `JointMarketDistribution.bttsYes` (modell szerinti) | A BTTS% CSAK a H2H pattern kontextusban létezik és modell szerinti valószínűségként a joint score matrixból. **Nincs csapatszintű szezon BTTS%** (hány meccsen szerzett mindkét csapat gólt / M). Nincs H/A BTTS% bontás. Nincs L5/L10 BTTS%. | A H2H verzió **kifinomultabb** (recency-súlyozott + ESS-shrunk); a csapatszintű szezon BTTS% **hiányzik**. |
| **T1-08** | Over 1.5/2.5/3.5 % | **RÉSZBEN LÉTEZIK** | `H2HGoalStats.over15Pct/over25Pct/over35Pct` (H2H); `LeagueBaselines.over15/over25/over35`; `JointMarketDistribution.over15/over25/over35` (modell szerinti) | Ugyanaz mint T1-07: az Over% csak H2H kontextusban és modell szerinti valószínűségként létezik. **Nincs csapatszintű szezon Over%**. Nincs H/A vagy L5/L10 Over%. | A H2H verzió kifinomultabb; a csapatszintű szezon Over% **hiányzik**. |
| **T1-09** | Clean sheet % | **HIÁNYZIK** (csapat metrikaként) | A `JointMarketDistribution.homeUnder05/awayUnder05` = P(csapat 0 gólt szerez) modell szerinti, nem történeti. A `cleanSheetBlowout` más fogalom (3+ gólos különbség + 0 gól az egyik oldalon). | Nincs olyan kód, amely a `count(GA=0)/M`-et csapatszintű történeti arányként számolná. A modell szerinti `homeUnder05` Poisson marginál, nem empirikus clean sheet arány. | **Hiányzik** empirikus csapatmetrikaként. A modell szerinti proxy létezik, de más dolog. |
| **T1-10** | Nem szerzett gólt % | **HIÁNYZIK** (csapat metrikaként) | Ugyanaz mint T1-09: a `homeUnder05`/`awayUnder05` modell szerinti. A `LeagueBaselines.homeScored05/awayScored05` liga-szintű, nem csapatszintű. | Nincs olyan kód, amely a `count(GF=0)/M`-et csapatszintű történeti arányként számolná. | **Hiányzik** empirikus csapatmetrikaként. |
| **T1-11** | HT eredmény profil | **RÉSZBEN LÉTEZIK** | `H2HHtStats.htHomeLeadRate/htDrawRate/htAwayLeadRate` (H2H scope csak); `LeagueBaselines.htHome/htDraw/htAway`; a `computeHtFeatures()` számol `htGoalRate5`-öt, DE NEM HT GY-D-V arányokat csapatonként | A HT eredmény arányok csak H2H találkozókon léteznek, nem csapatszintű szezon profilként. A `computeHtFeatures()` a forecastCore-ban HT gólarányt és vezetés-konverziót számol, de NEM a csapat HT GY-D-V profilját. | A H2H verzió létezik; a csapatszintű szezon HT eredmény profil **hiányzik**. |
| **T1-12** | 2. félidős GF/GA | **RÉSZBEN LÉTEZIK** | A `computeHtFeatures().secondHalfGoalRatio` = 2H gólok / összes gól (egy *arány*, mindkét csapat összevonva); nincs csapatonkénti 2H GF vagy 2H GA | A kód egyetlen `secondHalfGoalRatio`-t számol (az összes gól 2H-ra eső hányada) a kombinált fixture poolra. **Nincs csapatonkénti 2H GF, 2H GA vagy 2H attack/defense rating.** A spec irányonkénti (csapatonkénti) 2H gólokat kér. | **Kevesebb** mint a spec — csak egy kombinált arány, nem csapatonkénti irányonkénti. |
| **T1-13** | Kanonikus HT/FT match log | **LÉTEZIK** | A `MatchRow` hordozza: `ht_home_score`, `ht_away_score`, `home_score`, `away_score`, `total_goals`, `btts`, `outcome`. A `H2HMatch` tükörképezi ezeket. A `collectMeetings()` kronologikusan rendezi. | Teljesen létezik mint nyers adatréteg. A HT null-ok kezelése megtörténik (parse-nál törölve, számításnál szűrve). | **Egyenértékű** — ez a core input réteg. |

---

## Tier 2 — Származtatott, időbeli és H/A mutatók

| ID | Spec név | Státusz | Hol a kódban | Eltérés a spec-től | Kifinomultság |
|---|---|---|---|---|---|
| **T2-01** | Home Attack Rating | **LÉTEZIK** (eltérő formában) | `FeatureVector.home_att_home` = `venueAttack(homeVenue, true, gpm.home)` = `decayedShrunkAvg(home_goals, leagueHomeGpm, 0.88, k=5)` | Spec: `home_GF/home_M ÷ league_home_GF_avg`. A kód a **decayed+shrunk GPM**-et (gól/meccs) tárolja, NEM az arányt. Az arány *implicit* módon a Poisson lambdában képződik: `lambdaH = homeAttHome * (awayDefAway / gpm.home)`. A nyers érték a GPM (arány előtt), a shrinkage a liga-átlag felé húzza. | **Kifinomultabb** — exponenciális decay (λ=0.88) + Bayes-shrinkage (k=5). A spec képlet egy speciális eset decay és shrinkage nélkül. |
| **T2-02** | Home Defense Rating | **LÉTEZIK** (eltérő formában) | `FeatureVector.home_def_home` = `venueDefense(homeVenue, true, gpm.away)` = decayed+shrunk GA/meccs | Spec: `league_home_GA_avg ÷ home_GA/home_M` (inverz arány). A kód a **decayed+shrunk GA/meccs**-et (kapott gól) tárolja, nem az inverz arányt. Az inverz a lambdában képződik: `awayDefAway / gpm.home`. Megjegyzés: a kód `gpm.away`-t használ liga prior-ként a home defense-hez (helyes — a hazai vendég gólokat kap). | **Kifinomultabb** — ugyanaz a decay + shrinkage. Az orientáció helyes a dokumentált normaliser fix szerint. |
| **T2-03** | Away Attack Rating | **LÉTEZIK** (eltérő formában) | `FeatureVector.away_att_away` = `venueAttack(awayVenue, false, gpm.away)` | Ugyanaz mint T2-01, de vendég-szűrt. Liga prior = `gpm.away`. | **Kifinomultabb** — ugyanaz mint T2-01. |
| **T2-04** | Away Defense Rating | **LÉTEZIK** (eltérő formában) | `FeatureVector.away_def_away` = `venueDefense(awayVenue, false, gpm.home)` | Ugyanaz mint T2-02, de vendég-szűrt. Liga prior = `gpm.home`. | **Kifinomultabb** — ugyanaz mint T2-02. |
| **T2-05** | Last5 / Last10 GF-GA | **RÉSZBEN LÉTEZIK** | `FeatureVector.home_gd_form_5`/`away_gd_form_5` = `TeamForm.gdAvg` = sima GD átlag az utolsó 5 meccsen. Nincs Last10. Nincs külön GF/GA (csak kombinált GD). | A spec T1-05/06-ot (GF/meccs és GA/meccs) szűkített ablakokon kéri. A kód **csak GD átlagot** ad (nem külön GF/GA), **csak L5-re** (nem L10), és **sima átlagként** (nincs decay, nincs shrinkage). | **Kevesebb** mint a spec — nincs L10, nincs külön GF/GA, nincs decay/shrinkage a formán. |
| **T2-06** | Recency-súlyozott forma | **RÉSZBEN LÉTEZIK** | `FeatureVector.home_form_5`/`away_form_5` = `TeamForm.ppg` = sima PPG az utolsó 5 meccsen. **Nem** decay-súlyozott. A `decayedShrunkAvg()` létezik, de Nincs bekötve a formába — csak a venue attack/defense-be. | Spec: "exponenciális decay-súlyozott PPG vagy GD." A kód **sima ablak-átlagot** használ (utolsó 5, egyenlő súlyok). A decay engine (`decayedShrunkAvg` λ=0.88) létezik, de csak a venue rating-ekbe van bekötve, nem a formába. | **Kevesebb** mint a spec — a form sima ablak, nincs recency decay. Az infrastruktúra létezik, de nincs bekötve. |
| **T2-07** | BTTS% (H/A/L5/L10) | **HIÁNYZIK** | `H2HGoalProfile.weightedBttsRate` H2H-scope + recency-súlyozott. Nincs csapatszintű BTTS% H/A szegmensen vagy L5/L10 ablakon. | Sehol nincs csapatszintű szegmentált BTTS%. A H2H BTTS% létezik, de más dolog (pár-specifikus, nem csapat-szezon). | **Hiányzik** csapatszintű szegmentált metrikaként. |
| **T2-08** | Góleloszlási profil (hisztogram) | **HIÁNYZIK** | Nincs góleloszlási hisztogram (0/1/2/3/4+ szerzett és kapott) sehol a kódbázisban. A `computeTopModalScores()` pontos eredmény-gyakoriságokat számol H2H-ra, nem csapat gólhisztogramot. | Teljesen hiányzik. A score matrix (`JointMarketDistribution`) egy modell szerinti 2D eloszlás, nem empirikus csapatszintű hisztogram. | **Hiányzik**. |
| **T2-09** | 0–0 arány | **HIÁNYZIK** | Nincs kód, amely a `count(0-0)/M`-et számolná. A `JointMarketDistribution` le tudná vezetni P(0-0) = `matrix[0][0]`-t, de ez modell szerinti, nem empirikus. A `LeagueBaselines` nem követi a 0-0 gyakoriságot. | Teljesen hiányzik empirikus metrikaként. | **Hiányzik**. |
| **T2-10** | Kiütés (blowout) arány | **RÉSZBEN LÉTEZIK** (csak H2H) | `H2HGoalProfile.cleanSheetBlowoutRate` = count(\|GD\|≥3 ∧ egyik oldal 0 gól) / n. `isCleanSheetBlowout()` a patterns.ts-ben. De ez **clean-sheet blowout** (szűkebb mint a spec \|GD\|≥3), és **csak H2H scope**. | Spec: `count(|GD|≥3)/M` (bármilyen kiütés). Kód: `count(|GD|≥3 ∧ egyik oldal 0 gól)` (csak clean-sheet kiütés, ami részhalmaz). Csak H2H, nem csapatszintű szezon. | **Kevesebb** mint a spec (szűkebb feltétel); csak H2H. |
| **T2-11** | Gólvolatilitás (std) | **HIÁNYZIK** | Nincs standard deviáció számítás a szerzett gólokra. | Teljesen hiányzik. | **Hiányzik**. |
| **T2-12** | Eredmény-volatilitás (std) | **HIÁNYZIK** | Nincs PPM standard deviáció. | Teljesen hiányzik. | **Hiányzik**. |
| **T2-13** | Támadóindex (liga-normalizált) | **LÉTEZIK** (implicit) | A `home_att_home / gpm.home` megadná az arányt, de soha nincs önálló mezőként tárolva. Benne van a lambda képletben: `lambdaH = homeAttHome * (awayDefAway / gpm.home)`. Az arány `homeAttHome / gpm.home` a támadóindex, de nincs materializálva. | Spec: `team_GF/match ÷ league_avg_GF/match`. Kód: az arány *benne van* a Poisson lambda képletben, de soha nincs külön névvel ellátott feature-ként kinyerve. Decay + shrinkage alkalmazva (a spec sima arányával ellentétben). | **Kifinomultabb** (decay+shrinkage), de **nincs materializálva** önálló metrikaként. Kinyerés triviális. |
| **T2-14** | Védekezőindex (liga-normalizált) | **LÉTEZIK** (implicit) | A `gpm.away / home_def_home` megadná az inverz arányt, a lambdába ágyazva. Ugyanaz mint T2-13 — soha nincs önálló mezőként tárolva. | Ugyanaz mint T2-13. Az inverz arány `league_avg / team_GA` a lambda képletben van. | **Kifinomultabb**, de **nincs materializálva**. |

---

## Tier 3 — Kísérleti (Shadow)

| Metrika neve | Státusz | Hol a kódban | Eltérés a spec-től | Kifinomultság |
|---|---|---|---|---|
| **Comeback Rate** (HT hátrány → FT győzelem) | **HIÁNYZIK** | Nincs kód, amely ezt számolná. A `computeHtFeatures()` számol `htLeadConversionHome/Away`-t (HT vezetés → FT győzelem), ami az *ellentétes* irány. Nincs HT hátrány → FT győzelem arány. | Spec: arány, ahányiszor HT hátrányból győzelem jön. A kódnak van HT vezetés-megtartás, de nincs HT hátrány-fordítás. | **Hiányzik** — a meglévő inverze. |
| **Collapse / Lead-loss Rate** (HT vezetés → FT nem-győzelem) | **RÉSZBEN LÉTEZIK** | `htLeadConversionHome/Away` = arány, ahányiszor HT vezetést FT győzelemmé konvertál. Collapse rate = `1 - htLeadConversion`. Tehát **származtatható**, de nincs külön tárolva. | Spec: arány, ahányszor HT vezetés után nem győzelem. A kód a *komplementer*-t tárolja (megtartási arány). `shrink()` k=5 prior 0.72 alkalmazva. | **Kifinomultabb** (Bayes shrinkage); komplementerként tárolva, nem maga a vesztési arány. |
| **HT→FT konverzió** (HT vezetés megtartás) | **LÉTEZIK** | `FeatureVector.htLeadConversionHome`/`htLeadConversionAway` a `computeHtFeatures()`-ben. Bayes-shrunk `PRIOR_HT_LEAD_CONVERSION = 0.72` felé, k=5. Az utolsó 5 meccsenként számolva. | Spec: "valószínűség, hogy HT vezetést megőriz." Kód: pontosan ez, csapatonként, shrunk. Ablak = utolsó 5 (a spec min. minta 15-öt mond). | **Kifinomultabb** (shrinkage); **kevesebb** a min. minta (5 vs 15). |
| **2. félidős Attack/Defense Rating** | **HIÁNYZIK** | `secondHalfGoalRatio` = 2H gólok / összes gól (kombinált, mindkét csapat, arány). Nincs csapatonkénti 2H attack vagy 2H defense rating. Nincs 2H-specifikus venue rating. | Spec: külön Attack/Defense rating csak a 2. félidőre. Kód: csak egy kombinált gólhányad arány. | **Hiányzik** — sokkal kevesebb mint a spec. |
| **H2H módosító** (meglévő H2H shrinkage kimenet) | **LÉTEZIK** | `FeatureVector.h2h_home_ppg` = `h2hHomePpgOf()` — H2H PPG a hazai csapat szempontjából, min. minta fallback-el (`minH2HMeetings = 2`). Az M1 design vector-ban `h2h_home_ppg - fallback.h2hHomePpg`-ként használják. Ez **additív** (egy feature a logisztikusban), nem override. | Spec: "meglévő H2H-shrinkage logika kimenete, additív korrekció, nem override." Kód: pontosan ez — egy feature oszlop az M1-ben, min. minta fallback-el liga prior-ra (1.35). DE: **hard cutoff**-ot használ (ha találkozók < 2, return fallback), nem folytonos shrinkage-t. | **Egyenértékű** a spec szándékával. A shrinkage durvább (hard cutoff vs folytonos), de az additív-nem-override elv helyesen implementálva. |

---

## Duplikáció / Redundancia elemzés

| Potenciális duplikáció | Értékelés |
|---|---|
| T2-01…T2-04 vs T2-13/T2-14 | **DUPLIKÁLT fogalmilag.** A T2-01 (Home Attack Rating = `home_GF/home_M ÷ league_home_GF_avg`) és a T2-13 (Attack Index = `team_GF/match ÷ league_avg_GF/match`) **ugyanaz a képlet**. A T2-02/T2-14 szintén azonos. A spec 4 + 2 = 6 metrikát hoz létre, ami valójában 2 metrika (attack arány, defense inverz arány) eltérő H/A granularitással. A kódnak helyesen csak egy halmaza van (`home_att_home`, `home_def_home`, `away_att_away`, `away_def_away`). |
| T1-05/T1-06 vs T2-01…T2-04 | **Rokon, nem duplikált.** A T1-05/06 sima GF/meccs és GA/meccs (liga normalizálás nélkül, decay nélkül). A T2-01…T2-04 hozzáadják a liga normalizálást + decay-t. A kód `venueAttack()`/`venueDefense()` a T2 verziókat implementálja; a sima T1-05/06 verziók csak részben léteznek a `StandingRow`-ban. |
| T2-05 vs T2-06 | **Rokon, nem duplikált.** A T2-05 L5/L10 GF-GA (szűkített ablak). A T2-06 recency-súlyozott forma (exponenciális decay). A kódnak `home_form_5` (sima L5 PPG) és `home_gd_form_5` (sima L5 GD átlag) van — egyik sem decayed. Mind a T2-05, mind a T2-06 csak részben van kiszolgálva ugyanazokból a mezőkből. |
| `LeagueBaselines` (patterns.ts) vs `leagueGoalsPerMatch` (forecastCore.ts) | **Két különálló liga baseline rendszer.** A `LeagueBaselines` H2H párokból számol (összes meccs az összes páron). A `leagueGoalsPerMatch` az aktuális history slice-ból számol. Ezek különböző alrendszereket szolgálnak (pattern engine vs forecast engine) és nem redundánsak a kontextusukon belül, de egy egységes Team State rétegnek össze kellene egyeztetnie őket. |

---

## Strukturális hiányosságok

### 1. Csapatszintű szezon metrikák vs meccsszintű feature-ök

A spec **csapatszintű szezon-statisztikákat** ír le (pl. "X csapat szezon BTTS%-a = 54%"). A kódbázis elsősorban **meccsszintű feature-öket** számol a forecast pipeline számára (pl. "decay-súlyozott venue attack rating ehhez a konkrét meccshez").

A `StandingRow` a legközelebbi dolog a csapatszintű szezon profilhoz, de csak ezt hordozza: `played`, `wins`, `draws`, `losses`, `gf`, `ga`, `points`, `homeAtt`, `awayAtt`, `weight`. NEM hordozza: BTTS%, Over%, clean sheet%, failed-to-score%, HT eredmény profil, 2H gólok, volatilitás, blowout arány, 0-0 arány, semmilyen L5/L10 szegmentált metrikát.

**Ez a legnagyobb hiány:** a spec egy ~25-35 mezős Team State Vector-t feltételez; a kódnak egy 11 mezős `StandingRow`-a és egy 20 dimenziós meccs-specifikus `FeatureVector`-a van. Egyik sem a másik szuperhalmaza.

### 2. A decay engine alulhasznált

A `decayedShrunkAvg()` (exponenciális decay λ + Bayes shrinkage k) létezik a `stats.ts`-ben és CSAK a `venueAttack()`/`venueDefense()`-be van bekötve. A spec T2-06 (recency-súlyozott forma), T2-07 (szegmentált BTTS%), és potenciálisan T1-02/T1-03 (GY-D-V profil, PPG) mind decay-t vagy shrinkage-t kérnek, de a kód **sima ablak-átlagokat** használ a formára és egyáltalán nincs decay a BTTS%/Over%-on.

A H2H pattern engine saját külön recency rendszerrel rendelkezik (`recencyWeightsOf()` γ=0.18, Kish ESS, `shrinkRate()`), ami **kifinomultabb** mint a spec általános "exponenciális decay"-e — de csak H2H találkozókon működik, nem egy csapat teljes szezon history-ján.

### 3. Shrinkage paraméter különbségek

| Kontextus | Shrinkage k | Prior | Megjegyzés |
|---|---|---|---|
| Venue attack/defense (`venueAttack`/`venueDefense`) | k=5 | liga GPM | Folytonos Bayes shrinkage |
| HT feature-ök (`computeHtFeatures`) | k=5 (HT_SHRINK_K) | 0.65 / 0.72 / 0.52 | Folytonos Bayes shrinkage |
| H2H pattern-ek (`shrinkRate`) | k=4 (PATTERN_SHRINK_K) | `LeagueBaselines` arányok | ESS-tudatos (Kish effektív mintaméret) |
| H2H PPG (`h2hHomePpgOf`) | N/A — hard cutoff | 1.35 | Ha találkozók < 2, return fallback. Nincs folytonos shrinkage. |
| Forma (`formOf`) | **Nincs** | N/A | Sima ablak-átlag, nincs shrinkage |

A spec "liga prior felé" utasítást ad a legtöbb Tier 1/2 metrikára. A kód ezt implementálja a venue rating-ekre és H2H pattern-ekre, de NEM a formára, a tabella számlálókra, semmilyen csapatszintű arány metrikára.

---

## Javaslatok a Phase 2 implementációra

1. **Építs egy `TeamStateVector`-t**, ami egyesíti a `StandingRow`-t + decayed venue rating-eket + csapatszintű aránymetrikákat (BTTS%, Over%, CS%, FTS%, volatilitás) egyetlen csapatonkénti objektummá. Ez a spec fő kérése és a kód legnagyobb hiánya.
2. **Kérd ki a T2-13/T2-14-et** önálló mezőkként: `home_att_home / league_home_gpm` (és inverz a defense-hez). Jelenleg a lambdába van ágyazva — triviális kinyerni.
3. **Kösd be a `decayedShrunkAvg()`-t a form számításba** (`formOf()`) a T2-05/T2-06 sima ablakról recency-súlyozottra való frissítéséhez. Az engine már létezik.
4. **Adj L10 variánsokat** a formához (`formOf` `window=10` paraméterrel) — jelenleg csak L5 van.
5. **Adj csapatszintű empirikus BTTS%, Over%, Clean sheet%, Failed-to-score%-t** — ezek egyszerű `count(feltétel)/M` számítások egy csapat szezon-meccsein, és teljesen hiányoznak.
6. **Adj Comeback Rate-et** (HT hátrány → FT győzelem) — a meglévő `htLeadConversion` inverze. Ugyanazok az adatok, ellentétes feltétel.
7. **Adj volatilitási metrikákat** (std a szerzett gólokra, std a PPM-re) — egyszerű `std()` egy csapat meccslistáján.
8. **Olvaszd össze a T2-13-at T2-01-gyel és a T2-14-et T2-02-vel** a specben — ugyanaz a metrika eltérő H/A granularitási szinteken.
