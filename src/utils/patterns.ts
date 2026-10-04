import {
  HT_COVERAGE_MIN,
  PATTERN_HOT_SAMPLE,
  PATTERN_MIN_RATE,
  PATTERN_SHRINK_K,
  PATTERN_WARM_SAMPLE } from
'./constants';
import {
  SECONDARY_MARKET_THRESHOLDS,
  bandOfConfidence,
  decisionQuadrantOf,
  marketBandForProbability } from
'./decision';
import { isTeamGoalCode, teamGoalCodeOf } from './marketCatalog';
import { marketEvalSpecOf } from './marketEval';
import { resolveCoreEvidence } from './coreEvidence';
import type {
  BandDiagnosis,
  BttsBlowoutRiskAssessment,
  ConfidenceBandKey,
  DataSufficiency,
  Fixture,
  MarketCalibrationState,
  UnderdogInfo,
  H2HGoalProfile,
  MarqueeRiskVerdict,
  H2HGoalStats,
  H2HHtStats,
  H2HModalScore,
  H2HPair,
  H2HRecord,
  H2HReversalStats,
  League,
  PatternAgreement,
  PatternHit,
  PatternType,
  PatternWeightMap,
  Recommendation,
  ReliabilityBand } from
'../types/winmix';
import type { FixtureForecast } from './fixtures';

export const PATTERN_LABEL: Record<PatternType, string> = {
  safety_trend: 'Biztonsági trend',
  goal_market: 'Gólpiac',
  exact_score: 'Pontos eredmény',
  htft_reversal: 'HT/FT fordulat',
  ht_market: 'Félidő piac',
  streak: 'Sorozat',
  model_agreement: 'Modell-egyetértés'
};

export const PATTERN_ORDER: PatternType[] = [
'safety_trend',
'goal_market',
'exact_score',
'htft_reversal',
'ht_market',
'streak',
'model_agreement'];


export function defaultPatternWeights(): PatternWeightMap {
  return {
    safety_trend: 1,
    goal_market: 1,
    exact_score: 1,
    htft_reversal: 1,
    ht_market: 1,
    streak: 1,
    model_agreement: 1
  };
}

/** One historical meeting, always oriented so `homeScore` is the fixture's home team. */
export interface Meeting {
  seasonName: string;
  date: string;
  homeScore: number;
  awayScore: number;
  htHome: number | null;
  htAway: number | null;
  flipped: boolean;
}

export interface LeagueBaselines {
  n: number;
  htN: number;
  home: number;
  draw: number;
  away: number;
  over15: number;
  over25: number;
  over35: number;
  btts: number;
  /**
   * RELEASE A — league-wide share of matches where the HOME side scored at
   * least one goal, and the same for the away side. Shrinkage priors for the
   * team-goal markets: with a thin H2H sample the rate is pulled toward the
   * league's real home/away scoring base, not toward an unrealistic 50%.
   */
  homeScored05: number;
  awayScored05: number;
  /**
   * BTTS CORE PROFILE — league-wide share of matches that were a high-scoring
   * no-BTTS result (4+ goals, one side scoreless) and of matches that were a
   * clean-sheet blowout (3+ goal margin, one side scoreless).
   *
   * These are the shrinkage priors of the blowout-risk evidence: a 1-in-2
   * directed history is pulled toward the league's real blowout frequency, so
   * it can never become a hard 50% Core veto.
   */
  highGoalNoBtts: number;
  cleanSheetBlowout: number;
  htHome: number;
  htDraw: number;
  htAway: number;
  reversal: number;
  exactScore: number;
}

export function emptyBaselines(): LeagueBaselines {
  return {
    n: 0,
    htN: 0,
    home: 0.44,
    draw: 0.26,
    away: 0.3,
    over15: 0.74,
    over25: 0.52,
    over35: 0.3,
    btts: 0.5,
    homeScored05: 0.72,
    awayScored05: 0.63,
    highGoalNoBtts: 0.06,
    cleanSheetBlowout: 0.09,
    htHome: 0.36,
    htDraw: 0.4,
    htAway: 0.24,
    reversal: 0.16,
    exactScore: 0.12
  };
}

/** League-wide market frequencies, used as shrinkage priors for every pattern. */
export function computeLeagueBaselines(pairs: H2HPair[]): LeagueBaselines {
  const base = emptyBaselines();
  let n = 0;
  let htN = 0;
  let home = 0;
  let draw = 0;
  let away = 0;
  let o15 = 0;
  let o25 = 0;
  let o35 = 0;
  let btts = 0;
  let homeScored = 0;
  let awayScored = 0;
  let highGoalNoBtts = 0;
  let cleanSheetBlowout = 0;
  let htHome = 0;
  let htDraw = 0;
  let htAway = 0;
  let reversal = 0;
  const scoreCounts = new Map<string, number>();

  pairs.forEach((pair) =>
  pair.matches.forEach((m) => {
    n++;
    if (m.home_score > m.away_score) home++;else
    if (m.home_score === m.away_score) draw++;else
    away++;
    if (m.total_goals > 1.5) o15++;
    if (m.total_goals > 2.5) o25++;
    if (m.total_goals > 3.5) o35++;
    if (m.btts) btts++;
    if (m.home_score > 0) homeScored++;
    if (m.away_score > 0) awayScored++;
    const noBtts = m.home_score === 0 || m.away_score === 0;
    if (noBtts && m.home_score + m.away_score >= 4) highGoalNoBtts++;
    if (noBtts && Math.abs(m.home_score - m.away_score) >= 3) cleanSheetBlowout++;
    scoreCounts.set(
      `${m.home_score}-${m.away_score}`,
      (scoreCounts.get(`${m.home_score}-${m.away_score}`) ?? 0) + 1
    );
    if (m.ht_home_score !== null && m.ht_away_score !== null) {
      htN++;
      const htSign = Math.sign(m.ht_home_score - m.ht_away_score);
      const ftSign = Math.sign(m.home_score - m.away_score);
      if (htSign > 0) htHome++;else
      if (htSign === 0) htDraw++;else
      htAway++;
      if (htSign !== 0 && ftSign !== htSign) reversal++;
    }
  })
  );

  if (n === 0) return base;
  const topScore = Array.from(scoreCounts.values()).sort((a, b) => b - a)[0] ?? 0;

  return {
    n,
    htN,
    home: home / n,
    draw: draw / n,
    away: away / n,
    over15: o15 / n,
    over25: o25 / n,
    over35: o35 / n,
    btts: btts / n,
    homeScored05: homeScored / n,
    awayScored05: awayScored / n,
    highGoalNoBtts: highGoalNoBtts / n,
    cleanSheetBlowout: cleanSheetBlowout / n,
    htHome: htN > 0 ? htHome / htN : base.htHome,
    htDraw: htN > 0 ? htDraw / htN : base.htDraw,
    htAway: htN > 0 ? htAway / htN : base.htAway,
    reversal: htN > 0 ? reversal / htN : base.reversal,
    exactScore: topScore / n
  };
}

/* ------------------------------------------------------------------ *
 * PHASE 8 — CHRONOLOGICAL AND DIRECTIONAL INTEGRITY
 *
 * Downstream computations assume meetings are ordered OLDEST → NEWEST. They
 * also operate on exactly one venue orientation: selected home → selected
 * away. `collectMeetings` is the single choke point that enforces both rules.
 * ------------------------------------------------------------------ */

function chronoKey(m: Meeting): number {
  const t = Date.parse(m.date);
  return Number.isFinite(t) ? t : 0;
}

/** Oldest first. Stable: meetings sharing a date keep their original relative order. */
function sortMeetingsChronologically(meetings: Meeting[]): Meeting[] {
  return [...meetings].sort((a, b) => chronoKey(a) - chronoKey(b));
}

/**
 * Meetings for exactly the selected home → away orientation.
 *
 * Reverse fixtures are a different venue setup and must never supplement a
 * thin direct sample. The legacy return fields remain for stored-analysis
 * compatibility, but new analyses always report zero reverse meetings.
 */
export function collectMeetings(
pairIndex: Map<string, H2HPair>,
homeKey: string,
awayKey: string)
: {meetings: Meeting[];direct: number;reverse: number;usedReverse: boolean;} {
  const direct = pairIndex.get(`${homeKey}___${awayKey}`);

  const directMeetings: Meeting[] = (direct?.matches ?? []).map((m) => ({
    seasonName: m.seasonName,
    date: m.date,
    homeScore: m.home_score,
    awayScore: m.away_score,
    htHome: m.ht_home_score,
    htAway: m.ht_away_score,
    flipped: false
  }));

  return {
    // Sorted unconditionally — the source `H2HPair.matches` is not
    // contractually guaranteed to be date-ordered.
    meetings: sortMeetingsChronologically(directMeetings),
    direct: directMeetings.length,
    reverse: 0,
    usedReverse: false
  };
}

export function htCoverageOf(meetings: Meeting[]): number {
  if (meetings.length === 0) return 0;
  const withHt = meetings.filter((m) => m.htHome !== null && m.htAway !== null).length;
  return withHt / meetings.length;
}

/* ------------------------------------------------------------------ *
 * PHASE 5 — recency-weighted H2H with Kish effective sample size
 *
 * A meeting from two seasons ago used to carry exactly the same influence as
 * last week's, which dilutes the only signal that matters in a league whose
 * generator drifts. Weights are therefore exponentially decayed.
 *
 * But a decayed sample is no longer as informative as its nominal count
 * suggests, so every gate downstream consumes the KISH EFFECTIVE SAMPLE SIZE
 *   ESS = (Σw)² / Σw²  =  1 / Σw²   (on normalized weights)
 * instead. That is the mechanism which stops "the last 3 meetings all hit
 * BTTS, therefore 100% confidence" from ever reaching the slip builder.
 * ------------------------------------------------------------------ */

/**
 * Exponential decay rate of the H2H weights.
 *
 * TUNED, not guessed: the Phase 5 requirement is that the last 5 meetings hold
 * at least {@link H2H_RECENT_WEIGHT_FLOOR} of the total weight across typical
 * 8–20 meeting histories. 0.18 is the gentlest decay that still satisfies it at
 * n = 20 (61%), which matters because a harsher decay (0.35 caps ESS below 6)
 * would collapse every goal-market line into `volatile` regardless of evidence.
 *
 * WHAT THIS COSTS IN EFFECTIVE OBSERVATIONS. At γ = 0.18 the Kish ESS of 18
 * nominal meetings is ≈ 10.3 — roughly 8–11 across realistic fixture counts and
 * weight concentrations, converging on ≈ 11 as the history grows. A raw "12/18"
 * is therefore an EXPLANATION, while the decision runs on the shrunk rate, this
 * ESS and the market-specific confidence built from them.
 */
export const H2H_RECENCY_GAMMA = 0.18;
/** The last 5 meetings must carry at least this share of the total weight. */
export const H2H_RECENT_WEIGHT_FLOOR = 0.6;
/** How many trailing meetings the floor above is measured over. */
export const H2H_RECENT_WINDOW = 5;

/**
 * ESS cut-points for data sufficiency.
 *
 * An exponentially decayed pool converges to (1 + r)/(1 − r) ≈ 11 effective
 * meetings, so the NOMINAL {@link PATTERN_HOT_SAMPLE} of 15 is unreachable by
 * construction. Expressing the gates in ESS units keeps them meaningful.
 */
export const H2H_ESS_HOT = Math.min(8, PATTERN_HOT_SAMPLE);
export const H2H_ESS_WARM = Math.min(4, PATTERN_WARM_SAMPLE);

/**
 * Ceiling on the effective sample size a 5-of-5 `streak` candidate is allowed
 * to claim.
 *
 * A streak is, by construction, exactly 5 raw observations — but capping its
 * ESS at `Math.min(STREAK_ESS_CAP, pool.ess)` rather than a flat 5 matters
 * when the pool itself is thinner than that: a streak drawn from a
 * recency-heavy pool of ESS 3 is judged on 3, not on a borrowed 5.
 *
 * This is intentionally conservative for a virtual league whose generator can
 * behave near-deterministically over short windows, where a "5-of-5" carries
 * less information than the same run against a genuinely random process.
 * Treat this as a TUNED PRIOR, not a derived constant: if an ablation against
 * realized outcomes shows 5-of-5 streaks are being systematically
 * under-weighted relative to their true hit rate, raise this value — the gate
 * logic that consumes it needs no change either way.
 */
const STREAK_ESS_CAP = 5;

/** Sufficiency of a pattern, ALWAYS judged on ESS — never on a raw count. */
export function sufficiencyOf(effectiveSampleSize: number): DataSufficiency {
  if (effectiveSampleSize >= H2H_ESS_HOT) return 'hot';
  if (effectiveSampleSize >= H2H_ESS_WARM) return 'warm';
  return 'cold';
}

export interface RecencyWeights {
  /** Normalized weights, aligned 1:1 with the meetings, oldest first. */
  weights: number[];
  /** Kish ESS. Uniform weights ⇒ n; weight on 2 meetings ⇒ ≈ 2. */
  effectiveSampleSize: number;
  /** Combined weight of the last {@link H2H_RECENT_WINDOW} meetings. */
  recentShare: number;
}

export function recencyWeightsOf(
count: number,
gamma: number = H2H_RECENCY_GAMMA)
: RecencyWeights {
  if (count <= 0) return { weights: [], effectiveSampleSize: 0, recentShare: 0 };

  const raw = Array.from({ length: count }, (_, i) =>
  Math.exp(-gamma * (count - 1 - i))
  );
  const total = raw.reduce((s, w) => s + w, 0);
  const weights = raw.map((w) => w / total);
  const sumWSq = weights.reduce((s, w) => s + w * w, 0);

  return {
    weights,
    effectiveSampleSize: sumWSq > 0 ? 1 / sumWSq : 0,
    recentShare: weights.slice(-H2H_RECENT_WINDOW).reduce((s, w) => s + w, 0)
  };
}

/** A meeting list with its recency weights and ESS resolved once. */
interface WeightedPool {
  meetings: Meeting[];
  weights: number[];
  ess: number;
  /** Nominal count, for display only. */
  n: number;
}

function poolOf(meetings: Meeting[], gamma: number = H2H_RECENCY_GAMMA): WeightedPool {
  const { weights, effectiveSampleSize } = recencyWeightsOf(meetings.length, gamma);
  return { meetings, weights, ess: effectiveSampleSize, n: meetings.length };
}

/** Recency-weighted share of the pool satisfying `test`, in [0, 1]. */
function shareOf(pool: WeightedPool, test: (m: Meeting) => boolean): number {
  let acc = 0;
  pool.meetings.forEach((m, i) => {
    if (test(m)) acc += pool.weights[i];
  });
  return acc;
}

/* ------------------------------------------------------------------ *
 * Deep H2H statistics — computed once per buildPatterns call and
 * attached to every PatternHit in the fixture.
 * ------------------------------------------------------------------ */

/** Compute H/D/A breakdown with unbeaten streak detection. */
function computeH2HRecord(meetings: Meeting[]): H2HRecord {
  const n = meetings.length;
  if (n === 0) {
    return {
      homeWins: 0,
      draws: 0,
      awayWins: 0,
      total: 0,
      homeWinPct: 0,
      drawPct: 0,
      awayWinPct: 0,
      homeUnbeatenStreak: 0,
      awayUnbeatenStreak: 0
    };
  }

  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;

  meetings.forEach((m) => {
    if (m.homeScore > m.awayScore) homeWins++;else
    if (m.homeScore === m.awayScore) draws++;else
    awayWins++;
  });

  // Unbeaten streaks — walk backwards through chronologically ordered
  // meetings. This requires `meetings` to be oldest-first, which
  // `collectMeetings` now guarantees at the single point every meeting list
  // is assembled (see the PHASE 8 block above `collectMeetings`).
  let homeUnbeatenStreak = 0;
  let awayUnbeatenStreak = 0;

  for (let i = meetings.length - 1; i >= 0; i--) {
    const m = meetings[i];
    if (m.awayScore > m.homeScore) break; // home lost
    homeUnbeatenStreak++;
  }

  for (let i = meetings.length - 1; i >= 0; i--) {
    const m = meetings[i];
    if (m.homeScore > m.awayScore) break; // away lost
    awayUnbeatenStreak++;
  }

  return {
    homeWins,
    draws,
    awayWins,
    total: n,
    homeWinPct: homeWins / n,
    drawPct: draws / n,
    awayWinPct: awayWins / n,
    homeUnbeatenStreak,
    awayUnbeatenStreak
  };
}

/** Compute goal market frequencies over the full meeting pool. */
function computeGoalStats(meetings: Meeting[]): H2HGoalStats {
  const n = meetings.length;
  if (n === 0) {
    return { avgGoals: 0, bttsPct: 0, over25Pct: 0, over15Pct: 0, over35Pct: 0 };
  }

  let totalGoals = 0;
  let bttsCount = 0;
  let over15Count = 0;
  let over25Count = 0;
  let over35Count = 0;

  meetings.forEach((m) => {
    const goals = m.homeScore + m.awayScore;
    totalGoals += goals;
    if (m.homeScore > 0 && m.awayScore > 0) bttsCount++;
    if (goals > 1.5) over15Count++;
    if (goals > 2.5) over25Count++;
    if (goals > 3.5) over35Count++;
  });

  return {
    avgGoals: totalGoals / n,
    bttsPct: bttsCount / n,
    over25Pct: over25Count / n,
    over15Pct: over15Count / n,
    over35Pct: over35Count / n
  };
}

/** Compute half-time dominance rates. Returns null when HT data is absent. */
export function computeHtStats(meetings: Meeting[]): H2HHtStats | null {
  const withHt = meetings.filter((m) => m.htHome !== null && m.htAway !== null);
  const htN = withHt.length;
  if (htN === 0) return null;

  let htGoalCount = 0;
  let htHomeLeadCount = 0;
  let htDrawCount = 0;
  let htAwayLeadCount = 0;
  let htBttsCount = 0;

  withHt.forEach((m) => {
    const htTotal = (m.htHome as number) + (m.htAway as number);
    if (htTotal > 0) htGoalCount++;
    const sign = Math.sign((m.htHome as number) - (m.htAway as number));
    if (sign > 0) htHomeLeadCount++;else
    if (sign === 0) htDrawCount++;else
    htAwayLeadCount++;
    // BTTS CORE PROFILE — both sides already on the scoresheet at half time.
    if (m.htHome as number > 0 && m.htAway as number > 0) htBttsCount++;
  });

  return {
    htGoalRate: htGoalCount / htN,
    htHomeLeadRate: htHomeLeadCount / htN,
    htDrawRate: htDrawCount / htN,
    htAwayLeadRate: htAwayLeadCount / htN,
    htSampleSize: htN,
    htBttsRate: htBttsCount / htN
  };
}

/* ------------------------------------------------------------------ *
 * BTTS CORE PROFILE — directed goal-shape evidence.
 *
 * Every "weighted" field runs on the SAME recency-weighted pool and the SAME
 * Kish ESS as every other pattern in this file; every "shrunk" field additionally
 * goes through `shrinkRate` toward the league baseline. The plain rates exist so
 * the surface can show `3 / 18` as an EXPLANATION — no gate ever reads them.
 * ------------------------------------------------------------------ */

/** Is this meeting a high-scoring result in which one side failed to score? */
export function isHighGoalNoBtts(m: Meeting): boolean {
  return (
    (m.homeScore === 0 || m.awayScore === 0) && m.homeScore + m.awayScore >= 4);

}

/** Is this meeting a clean-sheet blowout — a 3+ goal margin against a zero? */
export function isCleanSheetBlowout(m: Meeting): boolean {
  return (
    (m.homeScore === 0 || m.awayScore === 0) &&
    Math.abs(m.homeScore - m.awayScore) >= 3);

}

export function computeH2HGoalProfile(
meetings: Meeting[],
baselines: LeagueBaselines,
usedReverse: boolean)
: H2HGoalProfile | null {
  const n = meetings.length;
  if (n === 0) return null;

  const pool = poolOf(meetings);
  const isBtts = (m: Meeting) => m.homeScore > 0 && m.awayScore > 0;
  const isOver25 = (m: Meeting) => m.homeScore + m.awayScore > 2.5;

  let totalGoals = 0;
  let homeGoals = 0;
  let awayGoals = 0;
  let bttsCount = 0;
  let over25Count = 0;
  let highGoalCount = 0;
  let blowoutCount = 0;
  let weightedGoals = 0;

  meetings.forEach((m, i) => {
    totalGoals += m.homeScore + m.awayScore;
    homeGoals += m.homeScore;
    awayGoals += m.awayScore;
    if (isBtts(m)) bttsCount++;
    if (isOver25(m)) over25Count++;
    if (isHighGoalNoBtts(m)) highGoalCount++;
    if (isCleanSheetBlowout(m)) blowoutCount++;
    weightedGoals += (m.homeScore + m.awayScore) * pool.weights[i];
  });

  const weightedBtts = shareOf(pool, isBtts);
  const weightedOver25 = shareOf(pool, isOver25);
  const weightedHighGoal = shareOf(pool, isHighGoalNoBtts);
  const weightedBlowout = shareOf(pool, isCleanSheetBlowout);

  return {
    avgGoals: totalGoals / n,
    homeGoalsAvg: homeGoals / n,
    awayGoalsAvg: awayGoals / n,
    bttsRate: bttsCount / n,
    over25Rate: over25Count / n,
    noBttsRate: 1 - bttsCount / n,
    highGoalNoBttsRate: highGoalCount / n,
    cleanSheetBlowoutRate: blowoutCount / n,

    weightedAvgGoals: weightedGoals,
    weightedBttsRate: weightedBtts,
    weightedOver25Rate: weightedOver25,
    weightedHighGoalNoBttsRate: weightedHighGoal,
    weightedCleanSheetBlowoutRate: weightedBlowout,

    shrunkBttsRate: shrinkRate(weightedBtts, pool.ess, baselines.btts),
    shrunkHighGoalNoBttsRate: shrinkRate(
      weightedHighGoal,
      pool.ess,
      baselines.highGoalNoBtts
    ),
    shrunkCleanSheetBlowoutRate: shrinkRate(
      weightedBlowout,
      pool.ess,
      baselines.cleanSheetBlowout
    ),

    effectiveSampleSize: pool.ess,
    directSampleSize: n,
    usedReverse,

    bttsCount,
    highGoalNoBttsCount: highGoalCount,
    cleanSheetBlowoutCount: blowoutCount,
    blowoutScores: meetings.
    filter(isCleanSheetBlowout).
    slice().
    reverse().
    map((m) => `${m.homeScore}-${m.awayScore}`)
  };
}

/** Top-N most frequent exact scores, descending by count. */
function computeTopModalScores(meetings: Meeting[], topN = 3): H2HModalScore[] {
  const n = meetings.length;
  if (n === 0) return [];

  const counts = new Map<string, number>();
  meetings.forEach((m) => {
    const key = `${m.homeScore}-${m.awayScore}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return Array.from(counts.entries()).
  sort((a, b) => b[1] - a[1]).
  slice(0, topN).
  map(([score, count]) => ({ score, count, pct: count / n }));
}

/** HT/FT reversal stats. Returns null when HT data is absent. */
function computeReversalStats(meetings: Meeting[]): H2HReversalStats | null {
  const withHt = meetings.filter((m) => m.htHome !== null && m.htAway !== null);
  const htN = withHt.length;
  if (htN === 0) return null;

  let turnaroundCount = 0;
  withHt.forEach((m) => {
    const htSign = Math.sign((m.htHome as number) - (m.htAway as number));
    const ftSign = Math.sign(m.homeScore - m.awayScore);
    if (htSign !== 0 && ftSign !== htSign) turnaroundCount++;
  });

  return {
    turnaroundCount,
    turnaroundRate: turnaroundCount / htN,
    htSampleSize: htN
  };
}

interface Candidate {
  type: PatternType;
  code: string;
  label: string;
  /** Recency-weighted share of the pool that hit, in [0, 1]. */
  share: number;
  /** Kish ESS of the pool the share was measured on. */
  ess: number;
  /** Nominal meeting count behind the share. Display only. */
  n: number;
  prior: number;
}

const RESULT_SETS: Record<string, Recommendation[]> = {
  '1': ['HOME_WIN'],
  X: ['DRAW'],
  '2': ['AWAY_WIN'],
  '1X': ['HOME_WIN', 'DRAW'],
  X2: ['DRAW', 'AWAY_WIN'],
  '12': ['HOME_WIN', 'AWAY_WIN']
};

/**
 * Shrinks a recency-weighted share toward the league baseline.
 *
 * The sample size in the denominator is the EFFECTIVE one, so a rate built
 * from two heavily-weighted meetings is pulled far harder toward the baseline
 * than one built from a broad, evenly-weighted history.
 */
function shrinkRate(share: number, effectiveSample: number, prior: number): number {
  const value =
  (share * effectiveSample + PATTERN_SHRINK_K * prior) / (
  effectiveSample + PATTERN_SHRINK_K);
  return Number.isFinite(value) ? value : prior;
}

function agreementOf(code: string, forecast: FixtureForecast): PatternAgreement {
  const covered = RESULT_SETS[code];
  if (covered) {
    if (forecast.recommendation === 'NO_CLEAR_EDGE') return 'neutral';
    return covered.includes(forecast.recommendation) ? 'agree' : 'conflict';
  }
  if (code === 'BTTS' || code === 'NOBTTS') {
    const p = code === 'BTTS' ? forecast.btts : 1 - forecast.btts;
    if (p >= 0.55) return 'agree';
    if (p <= 0.45) return 'conflict';
    return 'neutral';
  }
  /**
   * RELEASE A — team-goal codes, on the BTTS branch's 0.55 / 0.45 pattern.
   * These codes do not fall into the generic `startsWith('O'|'U')` branch below
   * (they start with `HOME_` / `AWAY_`), but the intent is spelled out
   * explicitly so a later rename cannot silently reroute them to the TOTAL
   * goals line, which is a different market entirely.
   */
  if (isTeamGoalCode(code)) {
    const scoresProb = code.startsWith('HOME_') ? forecast.homeOver05 : forecast.awayOver05;
    const p = code.endsWith('O0.5') ? scoresProb : 1 - scoresProb;
    if (p >= 0.55) return 'agree';
    if (p <= 0.45) return 'conflict';
    return 'neutral';
  }
  if (code.startsWith('O') || code.startsWith('U')) {
    const over = forecast.over25;
    const wantsGoals = code.startsWith('O');
    if (wantsGoals) {
      if (over >= 0.55) return 'agree';
      if (over <= 0.45) return 'conflict';
      return 'neutral';
    }
    if (over <= 0.45) return 'agree';
    if (over >= 0.55) return 'conflict';
    return 'neutral';
  }
  if (code.startsWith('CS:')) {
    return code.slice(3) === forecast.mostLikelyScore ? 'agree' : 'neutral';
  }
  return 'neutral';
}

const AGREEMENT_FACTOR: Record<PatternAgreement, number> = {
  agree: 1.08,
  neutral: 1,
  conflict: 0.88
};

function evidenceOf(meetings: Meeting[]): string[] {
  return meetings.
  slice(-5).
  reverse().
  map((m) => {
    const ht =
    m.htHome !== null && m.htAway !== null ? ` (HT ${m.htHome}-${m.htAway})` : ' (HT n/a)';
    return `${m.seasonName} · ${m.homeScore}-${m.awayScore}${ht}${m.flipped ? ' · fordított pálya' : ''}`;
  });
}

function best(candidates: Candidate[]): Candidate | null {
  let winner: Candidate | null = null;
  let winnerRate = -1;
  candidates.forEach((c) => {
    if (c.n === 0) return;
    const rate = shrinkRate(c.share, c.ess, c.prior);
    if (rate > winnerRate) {
      winnerRate = rate;
      winner = c;
    }
  });
  return winner;
}

function safetyTrend(pool: WeightedPool, b: LeagueBaselines): Candidate | null {
  if (pool.n === 0) return null;
  const h = shareOf(pool, (m) => m.homeScore > m.awayScore);
  const d = shareOf(pool, (m) => m.homeScore === m.awayScore);
  const a = shareOf(pool, (m) => m.awayScore > m.homeScore);
  const base = { ess: pool.ess, n: pool.n } as const;
  return best([
  { type: 'safety_trend', code: '1', label: 'Hazai győzelem', share: h, ...base, prior: b.home },
  { type: 'safety_trend', code: '2', label: 'Vendég győzelem', share: a, ...base, prior: b.away },
  {
    type: 'safety_trend',
    code: '1X',
    label: 'Hazai nem kap ki (1X)',
    share: h + d,
    ...base,
    prior: b.home + b.draw
  },
  {
    type: 'safety_trend',
    code: 'X2',
    label: 'Vendég nem kap ki (X2)',
    share: d + a,
    ...base,
    prior: b.draw + b.away
  },
  {
    type: 'safety_trend',
    code: '12',
    label: 'Nincs döntetlen (12)',
    share: h + a,
    ...base,
    prior: b.home + b.away
  }]
  );
}

/**
 * The goal market is not ONE market — it is three independent questions.
 *
 * This used to return a single winner across all eight goal codes. That contest
 * is decided by the shrinkage priors, and `O1.5` (league prior 0.74) wins it
 * almost by construction against `BTTS` (0.50) and `O2.5` (0.52). The
 * consequence was structural, not statistical: the slip's three core slots ask
 * for the codes `BTTS` and `O2.5` BY NAME, so on a fully filled round they
 * stayed permanently empty with "no BTTS pattern in this round", even on pairs
 * with a rich, strongly one-sided head-to-head history.
 *
 * Each market now answers for itself:
 *   1. the strongest total-goals line (the old behaviour, unchanged),
 *   2. the 2.5 line — Over or Under, on its own merits,
 *   3. the BTTS question — Yes or No, on its own merits.
 *
 * Duplicates are dropped when one market's winner is already the totals winner.
 * Everything downstream is untouched: each candidate still faces the same
 * shrinkage, the same `PATTERN_MIN_RATE` floor and the same ESS-aware
 * market confidence gate. This widens the candidate set; it does not weaken a
 * single threshold.
 */
function goalMarket(pool: WeightedPool, b: LeagueBaselines): Candidate[] {
  if (pool.n === 0) return [];
  const over = (line: number) => shareOf(pool, (m) => m.homeScore + m.awayScore > line);
  const btts = shareOf(pool, (m) => m.homeScore > 0 && m.awayScore > 0);
  const base = { ess: pool.ess, n: pool.n } as const;

  const o15: Candidate = {
    type: 'goal_market',
    code: 'O1.5',
    label: 'Over 1.5 gól',
    share: over(1.5),
    ...base,
    prior: b.over15
  };
  const u15: Candidate = {
    type: 'goal_market',
    code: 'U1.5',
    label: 'Under 1.5 gól',
    share: 1 - over(1.5),
    ...base,
    prior: 1 - b.over15
  };
  const o25: Candidate = {
    type: 'goal_market',
    code: 'O2.5',
    label: 'Over 2.5 gól',
    share: over(2.5),
    ...base,
    prior: b.over25
  };
  const u25: Candidate = {
    type: 'goal_market',
    code: 'U2.5',
    label: 'Under 2.5 gól',
    share: 1 - over(2.5),
    ...base,
    prior: 1 - b.over25
  };
  const o35: Candidate = {
    type: 'goal_market',
    code: 'O3.5',
    label: 'Over 3.5 gól',
    share: over(3.5),
    ...base,
    prior: b.over35
  };
  const u35: Candidate = {
    type: 'goal_market',
    code: 'U3.5',
    label: 'Under 3.5 gól',
    share: 1 - over(3.5),
    ...base,
    prior: 1 - b.over35
  };
  const bttsYes: Candidate = {
    type: 'goal_market',
    code: 'BTTS',
    label: 'Mindkét csapat szerez gólt',
    share: btts,
    ...base,
    prior: b.btts
  };
  const bttsNo: Candidate = {
    type: 'goal_market',
    code: 'NOBTTS',
    label: 'Nem szerez gólt mindkét csapat',
    share: 1 - btts,
    ...base,
    prior: 1 - b.btts
  };

  /* --- RELEASE A/B — team-goal markets, same structure as every line above --
   * `homeScore > 0` on the orientation-correct pool: the selected home team's
   * own scoring, never mixed with its away form (`collectMeetings` reads only
   * the direct `home___away` pair). Each side answers for itself, exactly like
   * the 2.5 line and the BTTS question do.
   * ---------------------------------------------------------------------- */
  const homeScores = shareOf(pool, (m) => m.homeScore > 0);
  const awayScores = shareOf(pool, (m) => m.awayScore > 0);

  const homeO05: Candidate = {
    type: 'goal_market',
    code: 'HOME_O0.5',
    label: 'Hazai csapat gólt szerez',
    share: homeScores,
    ...base,
    prior: b.homeScored05
  };
  const homeU05: Candidate = {
    type: 'goal_market',
    code: 'HOME_U0.5',
    label: 'Hazai csapat nem szerez gólt',
    share: 1 - homeScores,
    ...base,
    prior: 1 - b.homeScored05
  };
  const awayO05: Candidate = {
    type: 'goal_market',
    code: 'AWAY_O0.5',
    label: 'Vendég csapat gólt szerez',
    share: awayScores,
    ...base,
    prior: b.awayScored05
  };
  const awayU05: Candidate = {
    type: 'goal_market',
    code: 'AWAY_U0.5',
    label: 'Vendég csapat nem szerez gólt',
    share: 1 - awayScores,
    ...base,
    prior: 1 - b.awayScored05
  };

  const picks = [
  best([o15, u15, o25, u25, o35, u35]),
  best([o25, u25]),
  best([bttsYes, bttsNo]),
  best([homeO05, homeU05]),
  best([awayO05, awayU05])];


  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const candidate of picks) {
    if (!candidate || seen.has(candidate.code)) continue;
    seen.add(candidate.code);
    out.push(candidate);
  }
  return out;
}

function exactScore(pool: WeightedPool, b: LeagueBaselines): Candidate | null {
  if (pool.n === 0) return null;
  // The modal score is chosen on WEIGHTED share, so a repeat from two seasons
  // ago cannot outrank a fresher, equally frequent one.
  const shares = new Map<string, number>();
  pool.meetings.forEach((m, i) => {
    const key = `${m.homeScore}-${m.awayScore}`;
    shares.set(key, (shares.get(key) ?? 0) + pool.weights[i]);
  });
  const top = Array.from(shares.entries()).sort((x, y) => y[1] - x[1])[0];
  if (!top) return null;
  return {
    type: 'exact_score',
    code: `CS:${top[0]}`,
    label: `Pontos eredmény ${top[0]}`,
    share: top[1],
    ess: pool.ess,
    n: pool.n,
    prior: b.exactScore
  };
}

function reversal(htPool: WeightedPool, b: LeagueBaselines): Candidate | null {
  if (htPool.n === 0) return null;
  const rev = shareOf(htPool, (m) => {
    const htSign = Math.sign((m.htHome as number) - (m.htAway as number));
    const ftSign = Math.sign(m.homeScore - m.awayScore);
    return htSign !== 0 && ftSign !== htSign;
  });
  const base = { ess: htPool.ess, n: htPool.n } as const;
  return best([
  {
    type: 'htft_reversal',
    code: 'HTFT:REV',
    label: 'HT/FT fordulat (a félidei vezető nem nyer)',
    share: rev,
    ...base,
    prior: b.reversal
  },
  {
    type: 'htft_reversal',
    code: 'HTFT:NOREV',
    label: 'Nincs fordulat félidő után',
    share: 1 - rev,
    ...base,
    prior: 1 - b.reversal
  }]
  );
}

function htMarket(htPool: WeightedPool, b: LeagueBaselines): Candidate | null {
  if (htPool.n === 0) return null;
  const htSign = (m: Meeting) => Math.sign((m.htHome as number) - (m.htAway as number));
  const base = { ess: htPool.ess, n: htPool.n } as const;
  return best([
  {
    type: 'ht_market',
    code: 'HT:1',
    label: 'Félidő: hazai vezet',
    share: shareOf(htPool, (m) => htSign(m) > 0),
    ...base,
    prior: b.htHome
  },
  {
    type: 'ht_market',
    code: 'HT:X',
    label: 'Félidő: döntetlen',
    share: shareOf(htPool, (m) => htSign(m) === 0),
    ...base,
    prior: b.htDraw
  },
  {
    type: 'ht_market',
    code: 'HT:2',
    label: 'Félidő: vendég vezet',
    share: shareOf(htPool, (m) => htSign(m) < 0),
    ...base,
    prior: b.htAway
  }]
  );
}

function streak(pool: WeightedPool, b: LeagueBaselines): Candidate | null {
  const last = pool.meetings.slice(-5);
  if (last.length < 5) return null;
  const checks: {code: string;label: string;prior: number;test: (m: Meeting) => boolean;}[] = [
  { code: '1X', label: 'Sorozat: a hazai 5-ből 5-szer nem kapott ki', prior: b.home + b.draw, test: (m) => m.homeScore >= m.awayScore },
  { code: 'X2', label: 'Sorozat: a vendég 5-ből 5-szer nem kapott ki', prior: b.draw + b.away, test: (m) => m.awayScore >= m.homeScore },
  { code: '1', label: 'Sorozat: 5-ből 5 hazai győzelem', prior: b.home, test: (m) => m.homeScore > m.awayScore },
  { code: '2', label: 'Sorozat: 5-ből 5 vendég győzelem', prior: b.away, test: (m) => m.awayScore > m.homeScore },
  { code: 'BTTS', label: 'Sorozat: 5-ből 5 BTTS', prior: b.btts, test: (m) => m.homeScore > 0 && m.awayScore > 0 },
  { code: 'O2.5', label: 'Sorozat: 5-ből 5 Over 2.5', prior: b.over25, test: (m) => m.homeScore + m.awayScore > 2.5 },
  { code: 'U2.5', label: 'Sorozat: 5-ből 5 Under 2.5', prior: 1 - b.over25, test: (m) => m.homeScore + m.awayScore < 2.5 }];

  const found = checks.find((c) => last.every(c.test));
  if (!found) return null;
  return {
    type: 'streak',
    code: found.code,
    label: found.label,
    share: 1,
    // A 5-of-5 run is 5 observations at most, and never more than the pool's
    // own effective size. See STREAK_ESS_CAP above for why this is a named,
    // documented constant rather than an inline literal.
    ess: Math.min(STREAK_ESS_CAP, pool.ess),
    n: 5,
    prior: found.prior
  };
}

function modelAgreement(
pool: WeightedPool,
b: LeagueBaselines,
forecast: FixtureForecast)
: Candidate | null {
  if (forecast.recommendation === 'NO_CLEAR_EDGE') return null;
  if (pool.n === 0) return null;
  const code =
  forecast.recommendation === 'HOME_WIN' ? '1' : forecast.recommendation === 'DRAW' ? 'X' : '2';
  const share = shareOf(pool, (m) => {
    if (code === '1') return m.homeScore > m.awayScore;
    if (code === '2') return m.awayScore > m.homeScore;
    return m.homeScore === m.awayScore;
  });
  const prior = code === '1' ? b.home : code === '2' ? b.away : b.draw;
  // Only meaningful when the (recency-weighted) H2H history backs the pick.
  if (share < 0.5) return null;
  return {
    type: 'model_agreement',
    code,
    label: `Modell + H2H egyetért: ${code === '1' ? 'hazai' : code === '2' ? 'vendég' : 'döntetlen'}`,
    share,
    ess: pool.ess,
    n: pool.n,
    prior
  };
}

/* ------------------------------------------------------------------ *
 * PHASE 7 — market-specific confidence
 *
 * BTTS and Over/Under used to inherit the 1X2 confidence as a proxy. They now
 * get their own, and — critically — the sufficiency term consumes the Kish ESS
 * rather than the nominal meeting count. A pattern whose weight sits on 2–3
 * recent meetings scores a materially lower sufficiency than one built from a
 * broad history WITH THE SAME NOMINAL COUNT. This is the single most important
 * defence against overconfidence in a drifting virtual league.
 * ------------------------------------------------------------------ */
/** ESS at which the sufficiency term saturates at 1. */
export const MARKET_CONFIDENCE_SATURATION = 15;
/** |H2H − modell| distance at which the agreement term reaches 0. */
export const MARKET_CONFIDENCE_TOLERANCE = 0.3;
/** The three exponents of the geometric blend. */
export const MARKET_CONFIDENCE_EXPONENTS = {
  sharpness: 0.5,
  sufficiency: 0.3,
  agreement: 0.2
} as const;
/** Output clamp of the market confidence score. */
export const MARKET_CONFIDENCE_CLAMP = { min: 12, max: 99 } as const;

/**
 * The three terms of the market confidence, exposed so the surface can show
 * WHICH one crushed a line instead of only the blended score. Same arithmetic
 * as the score itself — `marketConfidenceOf` delegates here, so the trace can
 * never drift from the gate.
 */
export interface MarketConfidenceTerms {
  /** |rate − 50%| × 2 — how far the H2H rate is from a coin flip. */
  sharpness: number;
  /** min(1, ESS / saturation) — how much weighted history stands behind it. */
  sufficiency: number;
  /** max(0, 1 − |H2H − modell| / tolerance) — H2H versus model coherence. */
  agreement: number;
  /** |H2H − modell|, the raw distance behind the agreement term. */
  spread: number;
  /** The geometric blend, before scaling and clamping. */
  raw: number;
  /** The clamped 12–99 score the quadrant is judged on. */
  score: number;
  saturation: number;
  tolerance: number;
}

export function marketConfidenceTerms(
hitRate: number,
modelProb: number,
/** Kish ESS. NEVER the raw meeting count. */
effectiveSample: number,
saturation = MARKET_CONFIDENCE_SATURATION)
: MarketConfidenceTerms {
  const sharpness = Math.abs(hitRate - 0.5) * 2;
  const sufficiency = Math.min(1, Math.max(0, effectiveSample) / saturation);
  const spread = Math.abs(hitRate - modelProb);
  const agreement = Math.max(0, 1 - spread / MARKET_CONFIDENCE_TOLERANCE);
  const blended =
  Math.pow(sharpness, MARKET_CONFIDENCE_EXPONENTS.sharpness) *
  Math.pow(sufficiency, MARKET_CONFIDENCE_EXPONENTS.sufficiency) *
  Math.pow(agreement, MARKET_CONFIDENCE_EXPONENTS.agreement);
  const raw = Number.isFinite(blended) ? blended : 0;
  const scaled = Math.round(raw * 100);
  return {
    sharpness,
    sufficiency,
    agreement,
    spread,
    raw,
    score: Math.min(
      MARKET_CONFIDENCE_CLAMP.max,
      Math.max(MARKET_CONFIDENCE_CLAMP.min, scaled)
    ),
    saturation,
    tolerance: MARKET_CONFIDENCE_TOLERANCE
  };
}

function marketConfidenceOf(
hitRate: number,
modelProb: number,
/** Kish ESS. NEVER the raw meeting count. */
effectiveSample: number,
saturation = MARKET_CONFIDENCE_SATURATION)
: number {
  return marketConfidenceTerms(hitRate, modelProb, effectiveSample, saturation).score;
}

/**
 * The model probability a goal / HT-FT pattern is scored against.
 *
 * Every value comes from the SAME joint score matrix as the 1X2 forecast, so
 * `agreement` compares like with like. HT/FT reversal has no joint-matrix
 * counterpart, so it is measured against the league's empirical reversal rate.
 */
function marketReferenceProb(
code: string,
forecast: FixtureForecast,
baselines: LeagueBaselines)
: number | null {
  switch (code) {
    case 'BTTS':
      return forecast.btts;
    case 'NOBTTS':
      return 1 - forecast.btts;
    case 'O1.5':
      return forecast.over15;
    case 'U1.5':
      return 1 - forecast.over15;
    case 'O2.5':
      return forecast.over25;
    case 'U2.5':
      return 1 - forecast.over25;
    case 'O3.5':
      return forecast.over35;
    case 'U3.5':
      return 1 - forecast.over35;
    /* RELEASE A — straight from the shared joint matrix, so the `agreement`
     * term of `marketConfidenceOf()` really compares like with like. */
    case 'HOME_O0.5':
      return forecast.homeOver05;
    case 'HOME_U0.5':
      return forecast.homeUnder05;
    case 'AWAY_O0.5':
      return forecast.awayOver05;
    case 'AWAY_U0.5':
      return forecast.awayUnder05;
    case 'HTFT:REV':
      return baselines.reversal;
    case 'HTFT:NOREV':
      return 1 - baselines.reversal;
    default:
      return null;
  }
}

export interface BuildPatternsParams {
  fixture: Fixture;
  fixtureLabel: string;
  league: League;
  meetings: Meeting[];
  usedReverse: boolean;
  baselines: LeagueBaselines;
  forecast: FixtureForecast;
  weights: PatternWeightMap;
  /**
   * Empirical reliability bands from the audit walk. Without them a line's
   * confidence band cannot be judged, and every band is treated as
   * NOT calibrated — which keeps unverified lines out of the slip's core slots.
   */
  bands?: readonly ReliabilityBand[];
  /**
   * RELEASE C — per-market, out-of-sample probability calibration.
   *
   * Where a market-specific report exists it TAKES PRECEDENCE over the global
   * 1X2 bands above. Where a registered market has no measurement yet, the
   * global band still supplies the display label but the line behaves as
   * `bandCalibrated: false` — which is what keeps un-measured markets out of
   * the core slots instead of letting them ride an unrelated 1X2 signal.
   */
  marketCalibration?: MarketCalibrationState | null;
  /**
   * RELEASE B — the fixture's underdog, so team-goal lines can carry the
   * annotation the "weaker team scores" catalogue filter matches on.
   */
  underdog?: UnderdogInfo | null;
  /**
   * BTTS CORE PROFILE — the pair's directed goal-shape evidence and its shadow
   * risk assessment, computed ONCE per fixture by `analyzeFixture` and attached
   * here so the slip builder and the surface read exactly the same object.
   */
  goalProfile?: H2HGoalProfile | null;
  bttsRisk?: BttsBlowoutRiskAssessment | null;
  /**
   * RANGADÓ — the directed pair's marquee ranking verdict, computed ONCE by
   * `analyzeFixture` and attached to every pattern of the fixture. Ranking
   * only: no rate, band or gate on this object is consumed by a gate.
   */
  marqueeRisk?: MarqueeRiskVerdict | null;
}

export function buildPatterns({
  fixture,
  fixtureLabel,
  league,
  meetings,
  usedReverse,
  baselines,
  forecast,
  weights,
  bands,
  marketCalibration,
  underdog,
  goalProfile,
  bttsRisk,
  marqueeRisk
}: BuildPatternsParams): PatternHit[] {
  if (meetings.length === 0) return [];
  const htOk = htCoverageOf(meetings) >= HT_COVERAGE_MIN;

  // Compute deep H2H stats once — shared across all PatternHit objects for this fixture.
  const headToHeadRecord = computeH2HRecord(meetings);
  const goalStats = computeGoalStats(meetings);
  const htStats = htOk ? computeHtStats(meetings) : null;
  const topModalScores = computeTopModalScores(meetings);
  const reversalStats = htOk ? computeReversalStats(meetings) : null;

  // PHASE 5 — every rate below is measured on these recency-weighted pools.
  // The HT pool is weighted and ESS-scored SEPARATELY, because dropping the
  // meetings without half-time data changes both the weights and the ESS.
  const pool = poolOf(meetings);
  const htPool = poolOf(meetings.filter((m) => m.htHome !== null && m.htAway !== null));

  const candidates: (Candidate | null)[] = [
  safetyTrend(pool, baselines),
  // One entry per goal market, not one winner for all of them.
  ...goalMarket(pool, baselines),
  exactScore(pool, baselines),
  htOk ? reversal(htPool, baselines) : null,
  htOk ? htMarket(htPool, baselines) : null,
  streak(pool, baselines),
  modelAgreement(pool, baselines, forecast)];


  const evidence = evidenceOf(meetings);
  const bandIndex = new Map<ConfidenceBandKey, ReliabilityBand>(
    (bands ?? []).map((b) => [b.key, b])
  );

  return candidates.
  filter((c): c is Candidate => c !== null).
  map<PatternHit>((c) => {
    const rawRate = c.share;
    const hitRate = shrinkRate(c.share, c.ess, c.prior);
    const agreement = agreementOf(c.code, forecast);
    const weightApplied = weights[c.type] ?? 1;
    const stability = Math.min(
      99,
      Math.max(1, Math.round(hitRate * 100 * AGREEMENT_FACTOR[agreement] * weightApplied))
    );
    // P = hitRate, C = stability. They stay separate: the pair selects a
    // quadrant, they are never multiplied into a single score.
    const band = bandOfConfidence(stability);
    const bandInfo = bandIndex.get(band);
    const bandDiagnosis: BandDiagnosis = bandInfo?.diagnosis ?? 'insufficient';

    // PHASE 7 — goal and HT/FT families are judged on their OWN confidence
    // and their own (stricter) quadrant thresholds. Every other family
    // mirrors the stability-based decision, so the field is always readable.
    const isSecondaryMarket = c.type === 'goal_market' || c.type === 'htft_reversal';
    const modelProb = marketReferenceProb(c.code, forecast, baselines);
    const marketConfidence =
    isSecondaryMarket && modelProb !== null ?
    marketConfidenceOf(hitRate, modelProb, c.ess) :
    stability;
    const decision = decisionQuadrantOf(hitRate, stability);
    const marketDecision = isSecondaryMarket ?
    decisionQuadrantOf(hitRate, marketConfidence, SECONDARY_MARKET_THRESHOLDS) :
    decision;

    /* --- RELEASE C — the band that may judge THIS line -------------------
     * Resolved from the line's OWN model-implied probability, never from the
     * market's global average, the H2H hit rate, `stability` or
     * `marketConfidence`. A market can be acceptable on average while being
     * overconfident at 75–100% and calibrated at 55–65%, so a 0.68
     * `HOME_O0.5` prediction is answerable only by the `p65_75` band.
     * ------------------------------------------------------------------- */
    const evalSpec = marketEvalSpecOf(c.code);
    const marketReport = evalSpec ? marketCalibration?.[c.code] ?? null : null;
    const marketBandInfo =
    marketReport && modelProb !== null ?
    marketBandForProbability(marketReport.bands, modelProb) :
    null;
    const marketCalibrationStatus: PatternHit['marketCalibrationStatus'] = !evalSpec ?
    'unregistered' :
    !marketBandInfo || !marketBandInfo.evaluable ?
    'unevaluated' :
    marketBandInfo.calibrated ?
    'calibrated' :
    'uncalibrated';

    // Registered markets are judged ONLY by their own probability band; the
    // legacy global-band path survives untouched for everything else.
    const bandCalibrated = evalSpec ?
    marketCalibrationStatus === 'calibrated' :
    bandInfo?.calibrated ?? false;

    /* --- CORE CALIBRATION BOOTSTRAP -------------------------------------
     * The same inputs, resolved into a three-state lifecycle instead of one
     * boolean: verified, not-yet-measured, or measured-and-refused. Nothing
     * above changes — `bandCalibrated` keeps meaning "verified" — but the
     * core gate can finally tell a missing measurement apart from a failed
     * one instead of refusing both.
     * ------------------------------------------------------------------ */
    const coreEvidence = resolveCoreEvidence({
      registered: !!evalSpec,
      modelProb,
      marketBands: marketReport?.bands ?? null,
      globalBand: bandInfo ?? null
    });

    const underdogMarketCode = underdog ? teamGoalCodeOf(underdog.side) : null;

    return {
      id: `${fixture.id}::${c.type}::${c.code}`,
      fixtureId: fixture.id,
      fixtureLabel,
      league,
      type: c.type,
      code: c.code,
      label: c.label,
      rawRate,
      hitRate,
      sample: c.n,
      effectiveSampleSize: c.ess,
      usedReverse,
      sufficiency: sufficiencyOf(c.ess),
      agreement,
      stability,
      impliedOdds: hitRate > 0 ? 1 / hitRate : 0,
      weightApplied,
      decision,
      marketConfidence,
      marketDecision,
      band,
      bandHitRate: bandInfo?.evaluable ? bandInfo.hitRate : null,
      bandCalibrated,
      bandDiagnosis,
      modelProb,
      marketBand: marketBandInfo?.key ?? null,
      marketBandHitRate: marketBandInfo?.evaluable ? marketBandInfo.hitRate : null,
      marketBandCalibrated: marketBandInfo?.calibrated ?? false,
      marketBandDiagnosis: marketBandInfo?.diagnosis ?? 'insufficient',
      marketCalibrationStatus,
      coreEvidence,
      underdogSide: underdog?.side ?? null,
      underdogMarketCode: isTeamGoalCode(c.code) ? underdogMarketCode : null,
      evidence,
      headToHeadRecord,
      goalStats,
      htStats,
      topModalScores,
      reversalStats,
      goalProfile: goalProfile ?? null,
      bttsRisk: bttsRisk ?? null,
      marqueeRisk: marqueeRisk ?? null
    };
  }).
  filter((p) => p.type === 'exact_score' || p.hitRate >= PATTERN_MIN_RATE).
  sort((a, z) => z.stability - a.stability);
}