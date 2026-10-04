Csapatgól-piacok (HOME/AWAY Over-Under 0.5) beépítése a WinMix motorba
Mit érünk el
A WinMix ma egyetlen közös bivariáns pontmátrixból vezeti le az 1X2-t, a BTTS-t, az Over/Under vonalakat és a pontos eredményt. Ehhez a mátrixhoz kötjük hozzá a csapatonkénti gólpiacokat is: „hazai csapat szerez gólt”, „vendég csapat szerez gólt”, és a két tagadásuk. Nem épül új modell, nem születik konkurens becslés — négy új mező jön ugyanabból a normalizált mátrixból.

Erre kerül rá egy irányhelyes, recency-súlyozott H2H minta (hazai → vendég, ahogy a predictWinner és a collectMeetings ma is szigorúan csak a kiválasztott irányt vizsgálja), Kish ESS, ligaprior felé zsugorítás és saját piacspecifikus konfidencia. A „gyengébb csapat gólt szerez” kizárólag címke és rangsorolási nézet, nem önálló minta.

A rendszer így fog beszélni: „Nottingham (hazai underdog, súly 2,8 vs 7,8) legalább 1 gól — modell szerinti 0.5+ esély 66%, irányhelyes H2H 12/18, recency + shrinkage 61%, Kish ESS 4,8. Piaci minősítés: Volatile. Javasolt szerep: Joker, nem Core. Modellből számított elméleti szorzó: 1,52.”
Fogalmi keret — mit nevezhetünk kalibráltnak
Ez a terv legkényesebb pontja, és a felület minden feliratát ez határozza meg. A mai pipeline az 1X2 eloszlásra fittel hőmérsékletet (B1 Poisson + M1 logisztikus ensemble, majd temperature scaling), a másodlagos piacok pedig a joint Poisson / Dixon–Coles mátrix marginálisai. Az 1X2 kalibráció nem garantálja, hogy a csapatgól-piac külön-külön kalibrált.

1–5. fázis után — engedélyezett szóhasználat
„modell szerinti 0.5+ esély”, „model-implied team-goal probability”, „joint-matrix valószínűség”. Elméleti szorzó felirata: „Modellből számított elméleti szorzó”.
Csak a 6. fázis után — engedélyezett szóhasználat
„piacspecifikusan kalibrált 0.5+ esély”, „market-calibrated team-goal probability”, és ligánként + piaconként igazolt esetben „kalibrált modell szerinti elméleti szorzó”.
Soha, odds-adat nélkül
„value”, „pozitív EV”, „edge”, „ajánlott odds”, „mispriced”, „fogadj most”. Ehhez mérkőzés előtti, időbélyeggel tárolt külső odds és margin-kezelés kellene — az külön modul.
Három réteg, amit nem szabad összecsúsztatni. A marketConfidence és a Kish ESS a H2H-jel megbízhatósági és kiválasztási rétege — nem helyettesíti a modell valószínűségkalibrációját. A kettő együtt adja a Core-jogosultságot.
Réteg
Kérdése
Mérési egység
Modell-kalibráció
A jelzett 66% valóban kb. 66%-ban teljesül?
p = homeOver05 / awayOver05, és a tényleges hit
Minta-megbízhatóság
Elég friss és elég sok információ van a H2H jel mögött?
marketConfidence, Kish ESS, H2H–modell egyezés
Core-jogosultság
Bekerülhet a Top 3 Core kártyák egyikére?
A kettő együtt, plusz a meglévő slip-kapuk
A modell-kalibráció és a minta-megbízhatóság két külön mérés. Egyik sem elég önmagában, és egyik sem helyettesíti a másikat.
Alapelv: nem BTTS-helyettesítő
A BTTS csak azoknak a celláknak az összege, ahol mindkét csapat betalál. A csapatgólpiac ennél bővebb halmaz, ezért matematikai kényszer:

V 0
V 1
V 2
V 3+
 BTTS Igen
 Hazai 0.5+ (BTTS-en kívül)
 Vendég 0.5+ (BTTS-en kívül)
 0–0
A pontmátrix cellái piac szerint. A hazai 0.5+ = a teljes mátrix mínusz az első sor; a vendég 0.5+ = a teljes mátrix mínusz az első oszlop.
Kötelező invariánsok: homeOver05 + homeUnder05 ≈ 1, awayOver05 + awayUnder05 ≈ 1, bttsYes ≤ homeOver05, bttsYes ≤ awayOver05, homeUnder05 ≥ P("0-0"), awayUnder05 ≥ P("0-0"). Mivel minden érték ugyanabból az egyszeri, normalizált akkumulációs ciklusból származik, ezek konstrukció szerint teljesülnek — de automatizált tesztként is rögzítjük őket, nem csak fejlesztői figyelmeztetésként. A teszt több lambda-párra és több rho értékre lefut (alacsony és magas gólvárakozás, pozitív és negatív Dixon-Coles korrekció, nullához tartó lambda), így egy későbbi refaktor nem tudja észrevétlenül megbontani a mátrix integritását.
0. fázis — Típusos, központi market registry
Fájl: utils/marketCatalog.ts · Kockázat: alacsony · Előfeltétel minden továbbihoz

Ma a piackódok mindenhol sima string-ek: a PatternHit.code, a SlipMarketPreferences id-tömbjei, a marketReferenceProb() switch-ágai. Rövid távon ez kompatibilis, de a projekt bővül, és semmi nem akadályozza meg, hogy később egymás mellett éljen a HOME_O0.5, a HOME_O05, a HOME_OVER_05 és a HOME_TEAM_GOAL.

TEAM_GOAL_MARKETS mint as const tömb, és a belőle levezetett TeamGoalMarketCode unió típus. A négy kód: HOME_O0.5, HOME_U0.5, AWAY_O0.5, AWAY_U0.5.
MARKET_FAMILIES as const objektummá alakítása (goal, teamGoal, safety, halftime, other) és a belőle levezetett MarketFamily típus, a mai string-literál családkulcsok helyett.
A marketCatalog.ts lesz az egyetlen forrás. Innen olvassa a kódokat a patterns.ts, a slip.ts, a FixtureCard és a TeamGoalBlock, a MarketCalibrationPanel, a PredictionLedger és a 6. fázis piac-értékelő regisztere. Elírás így fordítási hiba, nem csendben üres mintalista.
A meglévő kódok (BTTS, O2.5, és a többi) nem változnak és nem migrálódnak, csak típusosan is deklarálásra kerülnek, hogy az új család ne szigetként éljen.
1. fázis — Score-mátrix bővítése
Fájl: utils/forecastCore.ts · Kockázat: alacsony

JointMarketDistribution (426–441) négy új readonly mezővel: homeOver05, homeUnder05, awayOver05, awayUnder05.
computeJointScoreDistribution() (453–524) meglévő, egyszeri akkumulációs ciklusában (491–508) — ott, ahol ma az over15/over25/over35/bttsYes gyűlik — két új összeg: h === 0 → homeUnder05 += p, a === 0 → awayUnder05 += p. Utána homeOver05 = 1 - homeUnder05, awayOver05 = 1 - awayUnder05. Nincs második bejárás, nincs új becslés.
A maxGoals ma adaptív (adaptiveMaxGoals, 773) — a csonkolásból eredő maradék valószínűséget a meglévő norm osztás már elnyeli, tehát az új mezők ugyanolyan konzisztensek, mint a BTTS.
ForecastResult.secondary (678–687) és a feltöltése (903–912): a négy új mező átvezetése. A bttsNo mintáját követve.
Automatizált invariáns-teszt a mátrix előállítására (a fenti hat feltétel, 1e-9 toleranciával), több lambda- és rho-kombinációra. Emellé fejlesztői módban futásidejű ellenőrzés is bekerül, de a szerződést a teszt rögzíti.
Elnevezés. A mezők doc-kommentje kimondja, hogy ezek model-implied valószínűségek, a joint mátrix marginálisai, nem piacspecifikusan kalibrált értékek. Ez a nevezéktan érvényes az 1-5. fázisban mindenhol: kódban, kommentben és felületen egyaránt.
2. fázis — Adatút a Fixture Predictor felé
Fájlok: utils/fixtures.ts, utils/roundAnalysis.ts, types/winmix.ts · Kockázat: alacsony

FixtureForecast (fixtures.ts 40–66): homeOver05, homeUnder05, awayOver05, awayUnder05. A predictFixture() return mappingje (286–305) a result.secondary-ból tölti, pontosan úgy, ahogy ma az over25-öt.
Underdog azonosítás — új adat nem kell. A features.weight_diff (= wHome - wAway, forecastCore 729) már a FixtureForecast-on van. Ebből egy tisztán levezetett segédfüggvény adja az underdog oldalt, UNDERDOG_MIN_WEIGHT_GAP = 1.0 küszöbbel: a küszöb alatt nincs underdog (null), és a címke nem jelenik meg. A csapatgól-piacok ilyenkor is látszanak.
FixtureAnalysis (types/winmix.ts 748–772) és az analyzeFixture() return objektum (roundAnalysis.ts 241–272): homeOver05, awayOver05, valamint az underdog leíró (side, display, weightGap, goalProb, marketCode) — hogy a kártya, a mintalista és a szelvényépítő ugyanazt az egy értéket lássa.
A buildPatterns() már a teljes forecast objektumot kapja (roundAnalysis.ts 236), így a 3. fázis további adatút-változtatás nélkül hozzájut a modellvalószínűségekhez.
A MatchPipeline.secondary (types/winmix.ts 82–134) opcionális mezőkkel bővül ugyanezekkel a valószínűségekkel — erre a 6. fázis piacspecifikus visszamérése épül. Opcionálisként, hogy a régi, lementett checkpointok és ledger-rekordok visszafelé kompatibilisek maradjanak.
3. fázis — Irányhelyes H2H csapatgól-minta
Fájl: utils/patterns.ts · Kockázat: közepes

A collectMeetings (203–228) ma is csak a direkt home___away párt olvassa, reverse: 0 — tehát a Nottingham hazai gólszerzése nem mosódik össze az idegenbeli teljesítményével. Ez az egyirányú szemlélet változatlanul marad; a fordított pálya csak a meglévő, vékony-minta-esetre szóló kiegészítő logikán keresztül kerülhet be, és a mintán a usedReverse jelző továbbra is látszik.

Ligabázis: LeagueBaselines (77) két új mezővel — homeScored05, awayScored05. A computeLeagueBaselines() (114–176) meglévő egyszeri bejárásában számoljuk (homeScore > 0, illetve awayScore > 0 aránya), és az emptyBaselines() (94–111) is kap realisztikus fallbacket. Így vékony H2H-nál a zsugorítás nem egy irreális 50%-ra húz, hanem a liga tényleges hazai/vendég gólszerzési bázisához.
Új kandidátusok a goalMarket() (704–789) mintájára, ugyanazzal a base = { ess, n } és best() szerkezettel: HOME_O0.5 / HOME_U0.5 a shareOf(pool, m => m.homeScore > 0) alapján, prior b.homeScored05; AWAY_O0.5 / AWAY_U0.5 a shareOf(pool, m => m.awayScore > 0) alapján, prior b.awayScored05. Két új best() pár kerül a picks tömbbe, a meglévő kódduplikáció-szűrő (781–787) érintetlen.
Típus: a kandidátusok type: 'goal_market' maradnak. Ezzel ingyen megkapják a szigorúbb SECONDARY_MARKET_THRESHOLDS kvadránst (patterns.ts 1066–1082) és a slip.ts effectiveDecisionOf routingját (205–209) — nem születik új, lazább szabályágy.
Modell-referencia: marketReferenceProb() (962–991) négy új case-t kap, amelyek a közös mátrixból jövő forecast.homeOver05 / awayOver05 értékeket adják vissza. Így a marketConfidenceOf() (939–953) agreement tagja tényleg összemérhetőt hasonlít össze.
Egyezés-jelzés: agreementOf() (585–620) explicit ága az új kódokra — a BTTS-ág mintájára, 0,55 / 0,45 sávval. Az új kódok nem esnek bele a generikus startsWith('O'|'U') ágba, de a szándékot kifejezetten kiírjuk, hogy egy későbbi átnevezés ne csússzon el.
Nyers arány nem ajánlás: a felületen látszó „12/18” a rawRate/sample; a döntést a hitRate (shrinkRate, 578–583) és az ESS-alapú marketConfidence hozza. 18 nominális meccs a H2H_RECENCY_GAMMA = 0.18 csillapítás mellett tipikusan 6–8 közötti effektív mintát jelent — ez helyesen fogja vissza a magabiztosságot.
4. fázis — Katalógus, „gyengébb csapat” címke és Core/Joker kapu
Fájlok: utils/marketCatalog.ts, utils/slip.ts, components/winmix/marketPool/* · Kockázat: közepes

Új katalógus-család: MARKET_FAMILIES új kulcsa ('teamGoal', felirat „Csapatgól piacok”). A MarketCardEditor (113–122) családonként rendereli a csoportsorokat, tehát a UI külön munkája nélkül megjelenik egy új blokk a Top 3+3 market poolban.
Négy sima opció: „Hazai csapat gólt szerez”, „Hazai csapat nem szerez gólt”, „Vendég csapat gólt szerez”, „Vendég csapat nem szerez gólt” — a meglévő goal() regisztrációs helper mintájára, p.type === 'goal_market' && p.code === … illesztéssel.
Ötödik opció — „Gyengébb csapat gólt szerez”: nem külön minta, hanem dinamikus szűrő-címke. A MarketOption.match ma csak a PatternHit-et látja, ezért a mintán megjelenik egy underdogSide annotáció (a fixture weight_diff-jéből), és az opció akkor illeszkedik, ha a minta kódja épp a gyengébb fél csapatgól-piaca. Nincs duplikált valószínűség, nincs második modellág. Ha a súlykülönbség a küszöb alatt van, ez az opció egyszerűen nem illeszkedik semmire.
coreRisk: az UNDERDOG opció és első körben a négy csapatgól-opció is coreRisk: true — a MarketChip (45–50) figyelmeztető ikonja jelzi, hogy ez a piaccsalád még nincs visszamérve.
Core kapu: az isCoreEligible() (211–218) meglévő négy feltétele (actionable, bandCalibrated, sufficiency !== 'cold', stability ≥ CORE_STABILITY_MIN) automatikusan érvényes. Emellé egy szigorítás: a csapatgól-család addig nem kerülhet Core slotba, amíg a 6. fázis piacspecifikus kalibrációja nem mondja kalibráltnak — ezt egy explicit, család-szintű kapu adja, nem egy elrejtett kivétel.
Joker kapu: isJokerEligible() (221–224) változatlan — actionable és volatile beléphet, flat/ignore nem. Az egy-meccs-egy-sor szabály (usedFixtures, 359/425/615–619) magától érvényes, tehát a hazai és a vendég csapatgól nem kerülhet egyszerre ugyanarról a meccsről a szelvényre.
gateFailuresForKind() (229–237) új market_uncalibrated okkal, hogy a felület meg tudja mondani, miért nem Core.
5. fázis — Felület: csapatgól-blokk a meccskártyán
Fájlok: components/winmix/FixtureCard.tsx, új components/winmix/TeamGoalBlock.tsx, pages/FixturePredictor.tsx · Kockázat: alacsony

A FixtureCard fix, három cellás <dl> rácsa (50–71) marad. Alá, a PatternList (86) fölé kerül egy önálló, összecsukható blokk. A PatternList az új goal_market kódokat változtatás nélkül rendereli.

CSAPATGÓL ELEMZÉS
Hazai csapat 0.5+
71%
Vendég csapat 0.5+
64%
Gyengébb csapat
Nottingham (hazai)
Súlyeltérés
−5,0
Modell 0.5+
64%
H2H (irányhelyes)
12/18
Recency + shrinkage
61%
Kish ESS
6,2
Modellből számított szorzó
1,64
Piaci minősítés
Volatile
Javasolt szerep
Joker
A blokk szétválasztja a meccs gólkarakterét, a két csapat saját gólesélyét, a favorit–underdog szerepet, a H2H mintát és az adat tényleges megbízhatóságát.
Underdog Goal Index (0–10) a blokk fejlécében, kizárólag rangsorolási és magyarázó szerepben — nem predikciós forrás. Súlyozás: modell szerinti csapatgól-valószínűség 45%, zsugorított irányhelyes H2H arány 30%, modell–H2H egyezés 15%, ESS-adatelégség 10%. A csapatsúly-különbség nem kap közvetlen pozitív súlyt: az csak azt dönti el, ki az underdog, nem azt, hogy betalál-e.
Az index megjelenítésének öt feltétele — mindnek teljesülnie kell: van egyértelmű underdog; a súlykülönbség legalább 1,0; van legalább egy releváns direkt H2H mérkőzés; a piac modellvalószínűsége véges és értelmezhető; a piackód nem flat és nem ignore. Ha bármelyik hiányzik, index helyett ez a szöveg jelenik meg: „Underdog-gól index még nem értékelhető: nincs irányhelyes H2H minta.” A modell szerinti 0.5+ esély ilyenkor is látható marad — csak az index ne adjon hamis pontosságérzetet.
Elméleti szorzó 1 / p, halványabb tipográfiával. A felirat a 6. fázisig „Modellből számított elméleti szorzó”; a „kalibrált modell szerinti elméleti szorzó” megnevezés csak azon a ligán és azon a piacon jelenhet meg, ahol a piacspecifikus visszamérés kalibráltnak minősítette. Sehol nem jelenik meg „value”, „pozitív EV”, „edge”, „mispriced” vagy „ajánlott odds” állítás.
Ha a súlykülönbség a küszöb alatt van: a két felső sor és az elméleti szorzó látszik, az underdog-szekció és az index nem.
Ha nincs H2H minta: a modell szerinti esély és az elméleti szorzó látszik, a H2H sorok „nincs minta” állapotot mutatnak, minősítés nélkül. Hideg (cold) minta esetén explicit figyelmeztetés.
6. fázis — Piacspecifikus out-of-sample kalibráció
Fájlok: utils/decision.ts, utils/pipeline.ts, types/winmix.ts, hooks/useLeagueForecastStats.ts, utils/evalWindows.ts, pages/PipelineAudit.tsx, új components/winmix/MarketCalibrationPanel.tsx · Kockázat: magas, de a Core-használat előfeltétele

Feltárt hiányosság. Ma a reliability sávok kizárólag az 1X2 kimenetre épülnek: a BandObservation (decision.ts 176–180) { confidence, probs, outcome }, a computeReliabilityBands() (211–249) argmax-szal H/D/A találatot számol, a useLeagueForecastStats (43–53) pedig minden meccsre egyetlen 1X2 megfigyelést ad. Minden PatternHit — a BTTS és az Over vonalak is — ugyanezt a négy sávot használja a bandOfConfidence(stability) hívásban (patterns.ts 1066). Vagyis a mai bandCalibrated jelzés a gólpiacokra sem piacspecifikus. Ez a fázis ezt zárja be, és a haszna jóval túlmutat a csapatgól-piacon.
A mérés elsődleges egysége a modellvalószínűség és a tényleges találat — nem a stability és nem a marketConfidence. Új típus a decision.ts-ben: MarketProbObservation { p: number; hit: boolean }, ahol p a mérkőzés előtti modellállapotból származó csapatgól-valószínűség, a hit pedig a tény. Példa: { market: 'HOME_O0.5', p: secondary.homeOver05, hit: homeScore > 0 } és { market: 'AWAY_O0.5', p: secondary.awayOver05, hit: awayScore > 0 }.
Valószínűségi sávok, nem konfidencia-sávok. A kalibrációt a becsült p szerinti hat sávban mérjük: 0–20%, 20–40%, 40–55%, 55–65%, 65–75%, 75–100%. Ez válaszolja meg a valódi kérdést: „a 65–75%-ra becsült hazai csapatgól események a valóságban milyen gyakran teljesültek?” A mai konfidencia-sávos (CONFIDENCE_BANDS) 1X2 útvonal érintetlen marad; a két sávrendszer külön él, mert két külön dolgot mér.
Sávstatisztika újrahasznált matematikával. A sávonkénti n, átlagos p, tényleges arány, Wilson 95%-os intervallum, gap és diagnózis a meglévő wilsonInterval, BAND_MIN_SAMPLE és diagnose() építőelemekből áll össze. Kimenete a már létező ReliabilityBand alakú rekord, hogy a ReliabilityBandTable lényegében változtatás nélkül rendereljen — csak a sávfelirat lesz valószínűségi, nem konfidencia szerinti.
Piac-regiszter. Egy MARKET_EVAL_SPECS tábla — a 0. fázis típusos kódjaira kulcsolva — piackódonként két függvényt ad: a modellvalószínűséget egy lezárt meccs pipeline.secondary-jából, és a tényleges kimenetet a meccs eredményéből. Regisztrálva: BTTS, O2.5, HOME_O0.5, AWAY_O0.5 — a többi vonal ugyanezen a felületen később bekapcsolható.
Walk-forward akkumulátor. A computeLeaguePipeline() (218–584) egyetlen kronologikus ciklusában, közvetlenül a scored előállítása után (451), a meglévő BranchAccumulator (159–200) mintájára egy piaconkénti akkumulátor gyűlik. Kritikus: a valószínűség a meccs előtti modellállapotból származik (a ciklus prequential jellege ezt magától biztosítja), tehát valódi out-of-sample mérés. Az összegzés a CalibrationState-be kerül új, opcionális markets mezőként (types/winmix.ts 190–203), és a PipelineCheckpoint-ba (451–482) a folytatáshoz. A worker-kontraktus (WorkerRequest/WorkerResponse) nem igényel módosítást: a teljes result objektum structured-clone-nal megy át.
Metrikák piaconként: darabszám, átlagos becsült valószínűség, tényleges találati arány, Brier, log-loss, ECE, négy reliability sáv Wilson-intervallummal és diagnózissal, valamint egy calibrated összegzés.
Sávok visszacsatolása. A buildPatterns() bands paramétere (patterns.ts 1007) opcionálisan piackód szerinti sávtáblát is kap. Ahol van piacspecifikus sáv, az élvez elsőbbséget; ahol nincs, a mai globális sáv marad a fallback, és a minta bandCalibrated: false-ként viselkedik — ez tartja ki a visszamérés nélküli sorokat a Core slotokból.
Audit felület. A PipelineAudit oldalon a ReliabilityBandTable alá (149) egy új panel piacválasztóval: a kiválasztott piac sávtáblája, találati aránya, Brier/ECE értéke és egy egymondatos verdikt („kalibrált” / „túl magabiztos” / „nem értékelhető, minta < küszöb”). Az EvalWindowTable és a CalibrationVerdictBar 1X2 marad — nem keverjük össze a két értékelési szintet.
Élesítés. Csak akkor és csak arra a ligára engedjük Core-szintre a csapatgól-családot, ahol a piacspecifikus sávok evaluable és calibrated állapotot mutatnak. Addig Joker-only, a katalógusban jelzett kockázattal.
Kiadási lépések — mikor mit lát a felhasználó
A fázisok fejlesztési egységek; a felhasználó felé négy kiadásban jelennek meg. Így a csapatgól-adat már korán használható elemzésre, de nem kerül a Top 3 Core mechanizmusba, amíg nincs rá empirikus bizonyíték.

Kiadás
Tartalom
A csapatgól-piac státusza
Release A
0–3. fázis
Modell és H2H adat elkészül; a felületen még nem jelenik meg dedikált blokk.
Release B
4–5. fázis
Látható a Fixture Predictorban, választható a market poolban — kizárólag Joker és megfigyelés.
Release C
6. fázis
Out-of-sample piacértékelés és külön auditpanel. A státusz még mindig Joker-only.
Release D
Core engedélyezés
Egyenként, ligánként és piaconként, kizárólag ha az audit igazolja.
A Core engedélyezés nem egy globális kapcsoló, hanem liga + piac szintű, audit által igazolt döntés.
Első kiadás: Joker-only. Mind az öt katalógus-opció — HOME_O0.5, HOME_U0.5, AWAY_O0.5, AWAY_U0.5 és a „Gyengébb csapat gólt szerez” címke — választható, naplózható és visszamérhető, de nem tölthet ki Top 3 Core kártyát.
Core belépés a 6. fázis után — mind a hat feltétel kötelező: 1. a piacspecifikus out-of-sample minta eléri a minimumot; 2. a modellvalószínűség a saját piacán kalibráltnak minősül; 3. a Wilson 95%-os intervallum támogatja ezt a minősítést; 4. a H2H mintához tartozó Kish ESS nem cold; 5. a marketDecision értéke actionable; 6. nincs ugyanarról a fixture-ről már kiválasztott másik szelvénysor.
Fázisrend és kockázat
0
Market registry — alacsony
Típusos piackódok és családkulcsok egyetlen forrásból. Előfeltétel, hogy a kódnevek ne szóródjanak szét.
1
Score-mátrix — alacsony
Négy új valószínűség a meglévő ciklusból + automatizált invariáns-teszt. Önmagában semmit nem változtat a mai kimeneten.
2
Adatút — alacsony
Átvezetés a FixtureForecast → FixtureAnalysis láncon, underdog-levezetés a meglévő weight_diff-ből.
3
H2H minta — közepes
Új kandidátusok, két új ligabázis, modell-referencia. Itt jelenik meg először új sor a mintalistában.
4
Katalógus és kapu — közepes
Új market-család, underdog szűrő-címke, család-szintű Core-tiltás a visszamérésig.
5
Felület — alacsony
Csapatgól-blokk, index a feltételeivel, modellből számított elméleti szorzó, üres és hideg állapotok.
6
Piacspecifikus kalibráció — magas
Valószínűségi sávok a becsült p és a tényleges találat alapján, walk-forward piac-akkumulátor, audit panel. Ez oldja fel a Core-tiltást.
Amit szándékosan nem építünk
Nincs önálló underdog-modell. A „gyengébb csapat gólt szerez” egyetlen forrása a közös pontmátrix; a címke csak azt dönti el, melyik meglévő sort emeljük ki.
Nincs odds, EV, Kelly vagy value-állítás. Az 1 / p szorzó kizárólag diagnosztika, és a 6. fázisig „modellből számított”, nem „fair”. Value-hoz mérkőzés előtti időbélyeggel tárolt külső odds és margin-kezelés kellene — az külön modul, külön terv.
A marketConfidence nem kalibráció. A H2H-jel élességét, ESS-ét és modell-egyezését méri; a modell valószínűségkalibrációját nem helyettesíti és nem is próbálja.
Nyers arány nem kerül döntési útra. A „12/18” magyarázat; a döntés a zsugorított arány, az ESS és a piacspecifikus konfidencia hármasán áll.
A csapatsúly nem bizonyíték. A 0–10 súly csak a favorit/underdog szerepet és a figyelem-priorizálást határozza meg, közvetlen pozitív súlyt nem kap az indexben.
Az irányítottság nem lazul. A hazai → vendég egyirányú szemlélet marad; a fordított pálya csak a meglévő, jelzett kiegészítő szabály szerint kerülhet a poolba.