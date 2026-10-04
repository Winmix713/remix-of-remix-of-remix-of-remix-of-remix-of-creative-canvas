import { computeH2HPairs } from './h2h';
import {
  buildLeagueHistory,
  predictFixture,
  resetColdStartWarnings } from
'./fixtures';
import {
  buildPatterns,
  collectMeetings,
  computeH2HGoalProfile,
  computeHtStats,
  computeLeagueBaselines,
  htCoverageOf } from
'./patterns';
import { computeReliabilityBands } from './decision';
import { computeMarketCalibration } from './marketEval';
import { underdogOf } from './underdog';
import { assessBttsPairRisk } from './bttsProfile';
import { assessMarqueeRisk, marqueeKeyOf } from './marqueePairs';
import { yieldToMain } from './pipeline';
import { HT_COVERAGE_MIN } from './constants';
import type {
  Fixture,
  FixtureAnalysis,
  H2HPair,
  League,
  M1Fit,
  MarketCalibrationState,
  PatternWeightMap,
  ReliabilityBand,
  Season,
  AliasMap } from
'../types/winmix';

/** Hány feldolgozott mérkőzés után adjuk vissza a szálat a böngészőnek. */
const YIELD_EVERY = 2;

export interface LeagueContext {
  pairIndex: Map<string, H2HPair>;
  baselines: ReturnType<typeof computeLeagueBaselines>;
  history: ReturnType<typeof buildLeagueHistory>;
  /**
   * P4 kalibrációs kapu: a szelvény csak olyan konfidencia-sávokra
   * támaszkodhat, amelyek jelzett valószínűségét az audit-bejárás
   * tényszerűen visszaigazolta.
   */
  bands: ReliabilityBand[];
  /**
   * RELEASE C — piacspecifikus, out-of-sample kalibráció ugyanabból az
   * audit-bejárásból. A regisztrált piacok (BTTS, O2.5 és a négy csapatgól-kód)
   * ezt kapják a globális 1X2 sávok HELYETT; ahol nincs mérés, a sor
   * `bandCalibrated: false`-ként viselkedik, tehát nem juthat Core slotba.
   */
  marketCalibration: MarketCalibrationState;
  /**
   * Kontextus-szintű figyelmeztetések (pl. üres kalibrációs sávok).
   * Az `analyzeFixture` ezeket a jegyzetek közé emeli, hogy a felhasználó
   * lássa, ha a slip mag slotjai miért maradnak üresek.
   */
  warnings: string[];
}

export interface AnalyzeRoundParams {
  fixtures: readonly Fixture[];
  seasons: readonly Season[];
  teamAliasMap: AliasMap;
  teamWeights: Partial<Record<League, Record<string, number>>>;
  calibration: Partial<Record<League, {T?: number;}>>;
  patternWeights: PatternWeightMap;
  /**
   * C1 — a modell-paraméterek átvezetése. A `predictFixture` és a `forecastCore`
   * mindhármat elsőrangú paraméterként fogadja, az `analyzeFixture` viszont
   * korábban egyiket sem adta át: minden előretekintő tipp cold-start M1
   * logitokkal és `rho = 0`-val futott, miközben az audit-bejárás illesztett
   * M1 modellel és validált Dixon-Coles rho-val mérte a pontosságot. A tipp és
   * a mért pontosság így két KÜLÖNBÖZŐ modellt írt le — pontosan az a szakadás,
   * amit a PHASE 0 megszüntetni hivatott.
   *
   * FIGYELEM: a csővezeték most már végig kész, a FORRÁS viszont még nem: a
   * pipeline az illesztett értékeket nem publikálja ki az app állapotába (a
   * `dixonColesRho` egyáltalán nem is perzisztálódik). Amíg ez nincs meg, ezek
   * a mezők `undefined`-ok, és a viselkedés bitre azonos a korábbival.
   */
  m1Fits?: Partial<Record<League, M1Fit | null>>;
  ensembleWM1?: Partial<Record<League, number>>;
  dixonColesRho?: Partial<Record<League, number | null>>;
  /**
   * Ligánként cache-elt kontextus — futások között újrahasznosítható.
   *
   * H3 — CACHE SZERZŐDÉS: a cache KIZÁRÓLAG adat-eredetű állapotot tárolhat
   * (párok, baseline-ok, history, megbízhatósági sávok), amit csak a nyers adat
   * és az alias térkép határoz meg. Súly- vagy kalibrációs állapotot
   * (`teamWeights`, `calibration.T`, `patternWeights`) SOHA nem tartalmazhat:
   * azokat az `analyzeFixture` minden futásnál közvetlenül kapja meg. Ezért
   * elég a cache-t a `seasons` / `teamAliasMap` változására érvényteleníteni.
   * Ha a `buildLeagueContext` egyszer mégis súly- vagy kalibráció-függő értéket
   * építene a kontextusba, az az érték NEM ide tartozik — vagy kimarad a
   * cache-ből, vagy a `useRoundAnalysis` érvénytelenítése is bővül vele.
   */
  /**
   * RANGADÓ — az operátor által megjelölt IRÁNYÍTOTT párosítás-kulcsok
   * (`homeKey___awayKey`) az aktuális ligából. Csak rangsor-korrekciót
   * eredményezhet, kaput soha; hiányában minden verdikt `none`.
   */
  marqueePairKeys?: ReadonlySet<string>;
  contextCache?: Map<League, LeagueContext>;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

/**
 * H3 — cache-elhető, mert MINDEN visszaadott mező kizárólag a nyers adatból és
 * az alias térképből származik. Szándékosan nem kap sem csapatsúlyt, sem
 * kalibrációs hőmérsékletet: azok futásonként változhatnak, és a
 * `predictFixture` közvetlenül kapja meg őket. Ne vezess be ide súly- vagy
 * kalibráció-függő számítást — az érvénytelenítené a cache szerződését
 * (lásd `AnalyzeRoundParams.contextCache`).
 */
export function buildLeagueContext(
seasons: readonly Season[],
league: League,
aliases: Record<string, string>)
: LeagueContext {
  const leagueSeasons = seasons.filter((s) => s.league === league);
  const pairs = computeH2HPairs(leagueSeasons, aliases);

  const audited = leagueSeasons.
  flatMap((s) => s.matches).
  filter((m) => m.pipeline);

  const bands = computeReliabilityBands(
    audited.map((m) => ({
      confidence: m.pipeline!.confidence,
      probs: m.pipeline!.calibrated,
      outcome: m.outcome
    }))
  );

  // Explicit check: ha egyetlen mérkőzés sem került audit-bejárásra, vagy
  // a bejárt adatból nem képezhető sáv, a bands tömb üres marad. Ilyenkor
  // minden minta „insufficient" sávdiagnózist kap, és a kalibrációs kapu
  // kizárja az összes mag slotot — csendes degradáció helyett a felhasználó
  // kap egy figyelmeztetést.
  const warnings: string[] = [];
  if (audited.length === 0) {
    warnings.push(
      'Még egy mérkőzés sem került audit-bejárásra ebben a ligában — ' +
      'a kalibrációs sávok üresek, minden minta „insufficient" sávdiagnózist kap. ' +
      'A szelvény mag slotjai addig üresek maradnak, amíg az audit le nem fut.'
    );
  } else if (bands.length === 0) {
    warnings.push(
      `Az audit ${audited.length} mérkőzést talált, de egyetlen megbízhatósági ` +
      'sáv sem képezhető — valószínűleg túl kevés az adat. A kalibrációs kapu ' +
      'addig kizárja az összes mag slotot.'
    );
  }

  if (warnings.length > 0) {
    console.warn(`[roundAnalysis] ${league}: ${warnings.join(' ')}`);
  }

  return {
    pairIndex: new Map(pairs.map((p) => [p.id, p])),
    baselines: computeLeagueBaselines(pairs),
    history: buildLeagueHistory(seasons, league),
    bands,
    // Ugyanaz az akkumulátor, mint a pipeline-bejárásban, ugyanazokra az as-of
    // predikciókra — azonos bemenet, azonos szám, egyetlen implementáció.
    marketCalibration: computeMarketCalibration(audited),
    warnings
  };
}

function notesFor(
meetingCount: number,
usedReverse: boolean,
htCoverage: number,
caveat?: string | null)
: string[] {
  const notes: string[] = [];

  if (meetingCount === 0) {
    notes.push(
      'Első ismert találkozó — csak a Pipeline-becslés áll rendelkezésre, ' +
      'minta nem képezhető.'
    );
  } else if (usedReverse) {
    notes.push(
      'Kevés direkt találkozó — a fordított pályán játszott meccsek is ' +
      'beszámítva.'
    );
  }

  if (meetingCount > 0 && htCoverage < HT_COVERAGE_MIN) {
    notes.push('HT adat hiányos — a félidő- és fordulat-minták kihagyva.');
  }

  if (caveat) notes.push(caveat);
  return notes;
}

/**
 * Egyetlen kitöltött párosítás elemzése. Szinkron és mellékhatásmentes,
 * így önállóan is unit-tesztelhető.
 */
export function analyzeFixture(
fixture: Fixture,
ctx: LeagueContext,
params: Pick<
  AnalyzeRoundParams,
  'teamAliasMap' |
  'teamWeights' |
  'calibration' |
  'patternWeights' |
  'm1Fits' |
  'ensembleWM1' |
  'dixonColesRho' |
  'marqueePairKeys'>)

: FixtureAnalysis {
  const { league } = fixture;
  const homeKey = fixture.homeKey!;
  const awayKey = fixture.awayKey!;

  // A megjelenített név a feltöltött pontos írásmód; a kulcs csak belső.
  const aliases = params.teamAliasMap[league] ?? {};
  const homeDisplay = aliases[homeKey] ?? homeKey;
  const awayDisplay = aliases[awayKey] ?? awayKey;
  const label = `${homeDisplay} – ${awayDisplay}`;

  const forecast = predictFixture({
    history: ctx.history,
    homeKey,
    awayKey,
    weights: params.teamWeights[league] ?? {},
    T: params.calibration[league]?.T ?? 1,
    // C1 — az audit és a tipp csak a history szeletben térhet el, semmi másban:
    // a modell-paraméterek innen jutnak el változatlanul a `forecastCore`-ig.
    m1Fit: params.m1Fits?.[league] ?? null,
    ensembleWM1: params.ensembleWM1?.[league],
    dixonColesRho: params.dixonColesRho?.[league] ?? null,
    league
  });

  const { meetings, direct, reverse, usedReverse } = collectMeetings(
    ctx.pairIndex,
    homeKey,
    awayKey
  );
  const htCoverage = htCoverageOf(meetings);

  // RELEASE B — az underdog szerep KIZÁRÓLAG a meglévő weight_diff-ből jön;
  // nincs új adat és nincs új modell. A küszöb alatt nincs underdog, a
  // csapatgól-valószínűségek viszont ilyenkor is látszanak.
  const underdog = underdogOf({
    weightDiff: forecast.features.weight_diff,
    homeDisplay,
    awayDisplay,
    homeGoalProb: forecast.homeOver05,
    awayGoalProb: forecast.awayOver05
  });

  /* --- BTTS CORE PROFILE ------------------------------------------------- *
   * The pair's goal SHAPE, computed once here so the fixture card, the pattern
   * list and the slip builder can never diverge on it. The historical side is
   * directed (home → away only), recency-weighted and shrunk; the model side is
   * a marginal of the SAME joint matrix that produced `btts` — no second
   * classifier and no parallel estimate.
   * -------------------------------------------------------------------- */
  const htStats =
  htCoverage >= HT_COVERAGE_MIN ? computeHtStats(meetings) : null;
  const goalProfile = computeH2HGoalProfile(meetings, ctx.baselines, usedReverse);
  const bttsRisk = assessBttsPairRisk({
    profile: goalProfile,
    modelBtts: forecast.btts,
    modelCleanSheetBlowout: forecast.cleanSheetBlowout,
    modelHighGoalNoBtts: forecast.highGoalNoBtts,
    htBttsRate: htStats?.htBttsRate ?? null
  });

  /* RANGADÓ — a címke csak vizsgálatot rendel el; a levonást a párosítás
   * SAJÁT H2H evidenciája szüli, és kizárólag a BTTS rangsort érinti. */
  const marqueeRisk = assessMarqueeRisk({
    registered: params.marqueePairKeys?.has(marqueeKeyOf(homeKey, awayKey)) ?? false,
    profile: goalProfile,
    risk: bttsRisk,
    weightDiff: forecast.features.weight_diff
  });

  const patterns = buildPatterns({
    fixture,
    fixtureLabel: label,
    league,
    meetings,
    usedReverse,
    baselines: ctx.baselines,
    forecast,
    weights: params.patternWeights,
    bands: ctx.bands,
    marketCalibration: ctx.marketCalibration,
    goalProfile,
    bttsRisk,
    marqueeRisk,
    underdog
  });

  return {
    fixtureId: fixture.id,
    league,
    slot: fixture.slot,
    homeKey,
    awayKey,
    homeDisplay,
    awayDisplay,
    label,
    directMeetings: direct,
    reverseMeetings: reverse,
    htCoverage,
    probs: forecast.probs,
    confidence: forecast.confidence,
    confidenceLabel: forecast.confidenceLabel,
    decision: forecast.decision,
    recommendation: forecast.recommendation,
    mostLikelyScore: forecast.mostLikelyScore,
    over25: forecast.over25,
    homeOver05: forecast.homeOver05,
    homeUnder05: forecast.homeUnder05,
    awayOver05: forecast.awayOver05,
    awayUnder05: forecast.awayUnder05,
    underdog,
    btts: forecast.btts,
    highGoalNoBtts: forecast.highGoalNoBtts,
    cleanSheetBlowout: forecast.cleanSheetBlowout,
    goalProfile,
    bttsRisk,
    htStats,
    sufficiency: forecast.sufficiency,
    patterns,
    notes: [
    ...ctx.warnings,
    ...notesFor(
      meetings.length,
      usedReverse,
      htCoverage,
      forecast.caveat
    )]

  };
}

/**
 * A teljes forduló elemzése. Megszakítható (`AbortSignal`) és a UI-szálat
 * rendszeresen visszaadja, így nagy adatbázison sem fagy be a felület.
 *
 * Csak azokhoz a ligákhoz épít kontextust, amelyek valóban szerepelnek a
 * fordulóban — a cache pedig futások között is megtart mindent.
 */
export async function analyzeRound({
  fixtures,
  seasons,
  teamAliasMap,
  teamWeights,
  calibration,
  patternWeights,
  m1Fits,
  ensembleWM1,
  dixonColesRho,
  marqueePairKeys,
  contextCache = new Map(),
  signal,
  onProgress
}: AnalyzeRoundParams): Promise<FixtureAnalysis[]> {
  const total = fixtures.length;
  const out: FixtureAnalysis[] = [];

  // H4 — futásonként ligánként egyszer jelezzük, ha cold-start modellel megy a
  // tipp; fixture-önként ez egy teljes fordulón olvashatatlanul zajos lenne.
  resetColdStartWarnings();

  for (let i = 0; i < total; i++) {
    signal?.throwIfAborted();

    const fixture = fixtures[i];
    let ctx = contextCache.get(fixture.league);

    if (!ctx) {
      ctx = buildLeagueContext(
        seasons,
        fixture.league,
        teamAliasMap[fixture.league] ?? {}
      );
      contextCache.set(fixture.league, ctx);
      await yieldToMain();
      signal?.throwIfAborted();
    }

    out.push(
      analyzeFixture(fixture, ctx, {
        teamAliasMap,
        teamWeights,
        calibration,
        patternWeights,
        m1Fits,
        ensembleWM1,
        dixonColesRho,
        marqueePairKeys
      })
    );

    onProgress?.(i + 1, total);
    if ((i + 1) % YIELD_EVERY === 0) await yieldToMain();
  }

  return out;
}