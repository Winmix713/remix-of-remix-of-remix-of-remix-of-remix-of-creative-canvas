/**
 * forecastCore — the SINGLE mathematical engine behind every WinMix number.
 *
 * ARCHITECTURE INVARIANTS
 * -----------------------
 * 1. Every tunable lives in {@link FORECAST_MODEL}. No second copy exists.
 * 2. The audit (pipeline.ts) and predictor (fixtures.ts) differ ONLY in the
 *    history slice they hand in. The math is identical.
 * 3. `m1DesignVector` is declared once. Fit and predict share the same column
 *    order by construction — a drift is a compile-time error, not a silent bug.
 * 4. The joint score matrix is the SINGLE source of market truth. 1X2, BTTS,
 *    every O/U line and correct score are all marginals of the same matrix.
 *    Contradictory market pairs (e.g. "Draw 0-0" AND "BTTS Yes") are
 *    arithmetically impossible, not merely discouraged.
 * 5. dixonColesRho is ABLATION-GATED: it is only non-zero once a ≥5-round
 *    walk-forward test has excluded zero from the bootstrap interval. The
 *    default path (`rho = 0`) is the independent-Poisson baseline exactly.
 *
 * PHASE CHANGELOG
 * ---------------
 * v1.0  Original 6-dim feature vector, hand-set M1 cold-start logits.
 * v2.0  Phase 2: half-time dynamics (3 dims appended).
 *        Phase 3: joint bivariate score distribution replaces scalar Poisson.
 *        Phase 4: momentum reversion (2 dims appended, ablation-gated).
 * v2.1  argmaxOutcome: float-equality replaced with deterministic tie-break.
 *        calibrateWithT: symmetric softmax with explicit sum normalisation.
 *        confidence: term floors raised, domain clamped before log().
 * v3.0  (this file)
 *        — ensembleBlend: narrow-band tunable wM1 via request param (unchanged).
 *        — confidenceOf: fully decomposed, every sub-term returned for audit UI.
 *        — reconcile: returns typed object, no silent `any`.
 *        — All intermediate results are immutable (Object.freeze on constants).
 *        — Guard against NaN in every arithmetic path; no silent propagation.
 *        — Full JSDoc on every exported symbol.
 */

import { DEFAULT_WEIGHT } from './constants';
import { DECISION_THRESHOLDS, decisionQuadrantOf } from './decision';
import { dcTau } from './experiments/dixonColes';
import { predictMultinomial, type ClassIndex, type LogisticSample } from './logistic';
import {
  adaptiveMaxGoals,
  calibrateWithT,
  poissonPmfArray,
  venueAttack,
  venueDefense } from
'./stats';
import type {
  ConfidenceLabel,
  DataSufficiency,
  DecisionQuadrant,
  FeatureVector,
  M1Fit,
  M1Source,
  MatchPipeline,
  MatchRow,
  Outcome,
  Probs,
  Recommendation } from
'../types/winmix';

// ─── Model version ────────────────────────────────────────────────────────────

/** Bump whenever the math changes, so audit records can be attributed to a model. */
export const FORECAST_MODEL_VERSION = 'winmix-forecast-3.1.0';

// ─── Tunable constants ────────────────────────────────────────────────────────

/**
 * Every tunable constant of the forecast in one place.
 *
 * COLD-START NOTE — the `m1` coefficients are the FALLBACK only, used until the
 * as-of logistic fit has enough prior matches (see `utils/logistic.ts`).
 * `ensemble.wM1` is the starting value; it is narrow-band tunable per-request.
 *
 * All values are frozen at module load so no call site can accidentally mutate
 * a constant that another branch is reading concurrently.
 */
export const FORECAST_MODEL = Object.freeze({
  version: FORECAST_MODEL_VERSION,

  /** B0 — flat league prior, retained for reconciliation display only. */
  prior: Object.freeze<Probs>({ home: 0.44, draw: 0.26, away: 0.30 }),

  /** Ensemble blend weights. wM1 + wB1 must sum to 1. */
  ensemble: Object.freeze({ wB1: 0.35, wM1: 0.65 }),

  /** 2×2 decision matrix cut-points — probability and confidence never multiply. */
  decision: DECISION_THRESHOLDS,

  /** M1 cold-start logit coefficients (fallback; fitted model takes over at warm). */
  m1: Object.freeze({
    weightDiff: 0.42,
    formDiff: 0.55,
    attDefDiff: 0.35,
    homeAdvantage: 0.25,
    drawBase: -0.20,
    drawSpread: -0.15
  }),

  /**
   * Confidence = sharpness^a · sufficiency^b · agreement^c · 100, clamped.
   * Each exponent controls how aggressively the corresponding signal degrades
   * the score when it is weak.
   */
  confidence: Object.freeze({
    sharpnessExp: 0.50,
    sufficiencyExp: 0.30,
    agreementExp: 0.20,
    /** Match count at which the sufficiency term saturates (reaches 1.0). */
    sufficiencySaturation: 12,
    /**
     * Mean |B1 − M1| divergence at which the agreement term reaches zero.
     * Kept deliberately narrow (0.30) so a persistent Poisson / logistic split
     * is penalised early, before it can inflate a slip's combined probability.
     */
    disagreementScale: 0.30,
    /** Floor applied to sufficiency and agreement before the power is taken. */
    termFloor: 0.10,
    floor: 12,
    ceiling: 99
  }),

  /** Min matches played for warm / hot data-sufficiency classification. */
  sufficiency: Object.freeze({ hot: 15, warm: 5 }),

  /** Minimum probability AND confidence required to issue a recommendation. */
  recommendation: Object.freeze({ minProbability: 0.40, minConfidence: 35 }),

  /** Confidence score → human-readable label thresholds. */
  labels: Object.freeze({ high: 76, good: 56, moderate: 36 }),

  /** Cold-start fallbacks used when a history slice is empty. */
  fallback: Object.freeze({
    formPpg: 1.35,
    formGdAvg: 0.00,
    h2hHomePpg: 1.35,
    leagueHomeGpm: 1.50,
    leagueAwayGpm: 1.15,
    minH2HMeetings: 2,
    formWindow: 5
  }),

  /** Caveat trigger thresholds. */
  caveats: Object.freeze({ lowAgreement: 0.60, flatMaxProb: 0.42 })
} as const);

// ─── History slice primitives ─────────────────────────────────────────────────

/**
 * A single history entry. `homeKey` / `awayKey` are canonical team keys;
 * `match` is the raw row from the database.
 */
export interface ForecastHistoryEntry {
  readonly homeKey: string;
  readonly awayKey: string;
  readonly match: MatchRow;
}

/** Points-per-game + goal-difference average over a form window. */
export interface TeamForm {
  readonly ppg: number;
  readonly gdAvg: number;
}

/** League-wide average goals per match, split by venue role. */
export interface LeagueGoalsPerMatch {
  readonly home: number;
  readonly away: number;
}

/** Fallback form when a team has no history in the current slice. */
export function emptyForm(): TeamForm {
  return {
    ppg: FORECAST_MODEL.fallback.formPpg,
    gdAvg: FORECAST_MODEL.fallback.formGdAvg
  };
}

/** How many matches in `entries` involve `key` (home OR away). */
export function playedCount(
entries: readonly ForecastHistoryEntry[],
key: string)
: number {
  let n = 0;
  for (const e of entries) {
    if (e.homeKey === key || e.awayKey === key) n++;
  }
  return n;
}

/** Classify data richness for one team given its match count. */
export function sufficiencyOf(minPlayed: number): DataSufficiency {
  if (minPlayed >= FORECAST_MODEL.sufficiency.hot) return 'hot';
  if (minPlayed >= FORECAST_MODEL.sufficiency.warm) return 'warm';
  return 'cold';
}

/**
 * Mean home and away goals across all entries in the slice.
 * Returns league-level fallbacks when the slice is empty.
 */
export function leagueGoalsPerMatch(
entries: readonly ForecastHistoryEntry[])
: LeagueGoalsPerMatch {
  const n = entries.length;
  if (n === 0) {
    return {
      home: FORECAST_MODEL.fallback.leagueHomeGpm,
      away: FORECAST_MODEL.fallback.leagueAwayGpm
    };
  }
  let home = 0;
  let away = 0;
  for (const e of entries) {
    home += e.match.home_score;
    away += e.match.away_score;
  }
  return { home: home / n, away: away / n };
}

/**
 * Points-per-game and goal difference over the last `window` matches for
 * `teamKey`. Returns `emptyForm()` when the team has no history.
 */
export function formOf(
entries: readonly ForecastHistoryEntry[],
teamKey: string,
window = FORECAST_MODEL.fallback.formWindow)
: TeamForm {
  const tail: ForecastHistoryEntry[] = [];
  for (const e of entries) {
    if (e.homeKey === teamKey || e.awayKey === teamKey) tail.push(e);
  }
  const slice = tail.slice(-window);
  if (slice.length === 0) return emptyForm();

  let pts = 0;
  let gd = 0;
  for (const e of slice) {
    const isHome = e.homeKey === teamKey;
    const scored = isHome ? e.match.home_score : e.match.away_score;
    const conceded = isHome ? e.match.away_score : e.match.home_score;
    gd += scored - conceded;
    if (scored > conceded) pts += 3;else
    if (scored === conceded) pts += 1;
  }
  return { ppg: pts / slice.length, gdAvg: gd / slice.length };
}

/**
 * Head-to-head points-per-game from the HOME TEAM's perspective, across both
 * direct and reverse meetings. Falls back to the league prior when the sample
 * is below `minH2HMeetings`.
 */
export function h2hHomePpgOf(
entries: readonly ForecastHistoryEntry[],
homeKey: string,
awayKey: string)
: number {
  const meetings: ForecastHistoryEntry[] = [];
  for (const e of entries) {
    if (
    e.homeKey === homeKey && e.awayKey === awayKey ||
    e.homeKey === awayKey && e.awayKey === homeKey)
    {
      meetings.push(e);
    }
  }
  if (meetings.length < FORECAST_MODEL.fallback.minH2HMeetings) {
    return FORECAST_MODEL.fallback.h2hHomePpg;
  }
  let pts = 0;
  for (const e of meetings) {
    const scored = e.homeKey === homeKey ? e.match.home_score : e.match.away_score;
    const conceded = e.homeKey === homeKey ? e.match.away_score : e.match.home_score;
    if (scored > conceded) pts += 3;else
    if (scored === conceded) pts += 1;
  }
  return pts / meetings.length;
}

// ─── Phase 2 — half-time dynamics ────────────────────────────────────────────

/**
 * Half-time feature set. Every value is Bayesian-shrunk toward a league prior
 * so the contract is: always finite, always in (0, 1), never NaN.
 */
export interface HtFeatures {
  /** Fraction of combined-team matches where half-time had ≥1 goal. */
  readonly htGoalRate5: number;
  /** Home team's rate of converting a half-time lead into a full-time win. */
  readonly htLeadConversionHome: number;
  /** Away team's rate of converting a half-time lead into a full-time win. */
  readonly htLeadConversionAway: number;
  /** Share of all goals falling in the second half (shrunk). */
  readonly secondHalfGoalRatio: number;
}

/** Pseudo-count of the Bayesian shrinkage prior for half-time features. */
const HT_SHRINK_K = 5;

/**
 * Shrink an observed rate toward `prior` using a pseudo-count of `k`.
 * Returns `prior` on any non-finite input to guarantee NaN propagation stops.
 */
function shrink(hits: number, n: number, prior: number, k = HT_SHRINK_K): number {
  const v = (hits + k * prior) / (n + k);
  return Number.isFinite(v) ? v : prior;
}

export const PRIOR_HT_GOAL_RATE = 0.65;
export const PRIOR_HT_LEAD_CONVERSION = 0.72;
/** Slightly more goals fall after the break in most virtual leagues. */
export const PRIOR_SECOND_HALF_RATIO = 0.52;

/**
 * Compute half-time dynamics for a pair of teams from prior matches.
 *
 * WINDOW NOTE — the combined window is the chronologically last `window`
 * matches involving EITHER team (deduplicated), not a per-team concatenation,
 * which would silently reduce the shared features to the away team alone.
 */
export function computeHtFeatures(
entries: readonly ForecastHistoryEntry[],
homeKey: string,
awayKey: string,
window = FORECAST_MODEL.fallback.formWindow)
: HtFeatures {
  const homeMatches: MatchRow[] = [];
  const awayMatches: MatchRow[] = [];
  const eitherMatches: MatchRow[] = [];

  for (const e of entries) {
    const m = e.match;
    if (m.ht_home_score === null || m.ht_away_score === null) continue;
    const involvesHome = e.homeKey === homeKey || e.awayKey === homeKey;
    const involvesAway = e.homeKey === awayKey || e.awayKey === awayKey;
    if (involvesHome) homeMatches.push(m);
    if (involvesAway) awayMatches.push(m);
    if (involvesHome || involvesAway) eitherMatches.push(m);
  }

  const homeTail = homeMatches.slice(-window);
  const awayTail = awayMatches.slice(-window);
  const combinedTail = eitherMatches.slice(-window);

  const htGoalHits = combinedTail.filter(
    (m) => (m.ht_home_score ?? 0) + (m.ht_away_score ?? 0) > 0
  ).length;
  const htGoalRate5 = shrink(htGoalHits, combinedTail.length, PRIOR_HT_GOAL_RATE);

  const leadConversionRate = (matches: MatchRow[], isHome: boolean): number => {
    const withLead = matches.filter((m) => {
      const htSign = Math.sign((m.ht_home_score ?? 0) - (m.ht_away_score ?? 0));
      return isHome ? htSign > 0 : htSign < 0;
    });
    const converted = withLead.filter((m) => {
      const ftSign = Math.sign(m.home_score - m.away_score);
      return isHome ? ftSign > 0 : ftSign < 0;
    }).length;
    return shrink(converted, withLead.length, PRIOR_HT_LEAD_CONVERSION);
  };

  let firstHalfGoals = 0;
  let secondHalfGoals = 0;
  for (const m of combinedTail) {
    firstHalfGoals += (m.ht_home_score ?? 0) + (m.ht_away_score ?? 0);
    secondHalfGoals +=
    m.home_score - (m.ht_home_score ?? 0) + (
    m.away_score - (m.ht_away_score ?? 0));
  }

  return {
    htGoalRate5,
    htLeadConversionHome: leadConversionRate(homeTail, true),
    htLeadConversionAway: leadConversionRate(awayTail, false),
    // Shrunk on GOAL counts, not match counts — the rate is a goal share.
    secondHalfGoalRatio: shrink(
      secondHalfGoals,
      firstHalfGoals + secondHalfGoals,
      PRIOR_SECOND_HALF_RATIO
    )
  };
}

// ─── Phase 4 — momentum reversion ────────────────────────────────────────────

/**
 * League-wide prior for total goals in a single match.
 * Used to centre the momentum reversion feature around zero.
 */
export const PRIOR_MATCH_TOTAL_GOALS = 2.5;

/**
 * Total goals in the most recent match played by `teamKey`.
 * Returns the league prior when the team has no history in the slice.
 *
 * HYPOTHESIS (ablation-gated): the virtual engine regresses to the mean after a
 * high-scoring round. This feature carries NO assumed sign — the L2 logistic
 * learns direction and magnitude once M1 activates, and the feature only earns
 * permanence after a ≥5-round walk-forward ablation shows non-negative impact.
 */
export function prevMatchGoals(
entries: readonly ForecastHistoryEntry[],
teamKey: string)
: number {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.homeKey === teamKey || e.awayKey === teamKey) {
      return e.match.home_score + e.match.away_score;
    }
  }
  return PRIOR_MATCH_TOTAL_GOALS;
}

// ─── Phase 3 — joint bivariate score distribution ────────────────────────────

/**
 * The complete joint score distribution P(Home = i, Away = j).
 *
 * All downstream markets (1X2, BTTS, O/U lines, correct score) are marginals
 * of this single matrix. Contradictory combinations are arithmetically excluded,
 * not just warned against.
 */
export interface JointMarketDistribution {
  /**
   * (maxGoals + 1) × (maxGoals + 1) probability matrix.
   * Row index = home goals, column index = away goals. Sums to 1.0.
   */
  readonly scoreMatrix: number[][];
  readonly probs: Probs;
  readonly over15: number;
  readonly over25: number;
  readonly over35: number;
  readonly bttsYes: number;
  readonly bttsNo: number;
  /* --- RELEASE A — team-goal markets ------------------------------------- *
   * MODEL-IMPLIED probabilities: marginals of THIS matrix, produced inside the
   * single accumulation pass below. They are NOT market-calibrated values, and
   * must not be described as such anywhere (code, comment or surface) until the
   * Release C market-specific evaluation says so for that league and market.
   *
   * `homeOver05` = the whole matrix minus its first ROW (home scored ≥ 1).
   * `awayOver05` = the whole matrix minus its first COLUMN (away scored ≥ 1).
   * BTTS is the strict intersection of the two, hence always ≤ either one.
   * ---------------------------------------------------------------------- */
  readonly homeOver05: number;
  readonly homeUnder05: number;
  readonly awayOver05: number;
  readonly awayUnder05: number;
  /* --- BTTS CORE PROFILE — one-sided blowout risk ------------------------- *
   * Two further marginals of the SAME matrix, accumulated in the SAME pass.
   * They exist so a BTTS recommendation can be judged on the SHAPE of the
   * pair's scoring, not only on the BTTS marginal:
   *
   *   highGoalNoBtts    = P(H + A ≥ 4  ∧  (H = 0 ∨ A = 0))
   *   cleanSheetBlowout = P(|H − A| ≥ 3 ∧  min(H, A) = 0)
   *
   * ORDERING NOTE. `cleanSheetBlowout` is the WIDER event, not the narrower
   * one: `3-0` and `0-3` are clean-sheet blowouts whose total is 3, so they are
   * NOT high-goal. Conversely every no-BTTS scoreline with 4+ goals has a
   * margin of at least 4, hence
   *   highGoalNoBtts ≤ cleanSheetBlowout ≤ bttsNo,
   * and the gap between the first two is exactly P(3-0) + P(0-3). Both are
   * MODEL-IMPLIED risk descriptors, never market-calibrated values.
   * ---------------------------------------------------------------------- */
  readonly highGoalNoBtts: number;
  readonly cleanSheetBlowout: number;
  readonly mostLikelyScore: string;
  readonly mostLikelyScoreProb: number;
  readonly topScores: ReadonlyArray<{score: string;prob: number;}>;
}

/**
 * Build the joint bivariate score distribution from two Poisson intensities.
 *
 * @param lambdaH - Expected home goals.
 * @param lambdaA - Expected away goals.
 * @param rho     - Dixon-Coles low-score dependence. 0 disables it exactly,
 *                  yielding the independent-Poisson baseline.
 * @param maxGoals - Grid truncation. 7 keeps the truncated tail under 1 × 10⁻⁴
 *                   at any realistic lambda. Never set below 7.
 */
export function computeJointScoreDistribution(
lambdaH: number,
lambdaA: number,
rho = 0,
maxGoals = 7)
: JointMarketDistribution {
  const pmfH = poissonPmfArray(lambdaH, maxGoals);
  const pmfA = poissonPmfArray(lambdaA, maxGoals);
  const useRho = Math.abs(rho) > 1e-9;

  // Build and normalise the raw matrix.
  const matrix: number[][] = Array.from(
    { length: maxGoals + 1 },
    () => new Array<number>(maxGoals + 1).fill(0)
  );
  let totalProb = 0;
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = pmfH[h] * pmfA[a] * (useRho ? dcTau(h, a, lambdaH, lambdaA, rho) : 1);
      matrix[h][a] = Math.max(0, p);
      totalProb += matrix[h][a];
    }
  }
  const norm = totalProb > 0 ? totalProb : 1;
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      matrix[h][a] /= norm;
    }
  }

  // Accumulate market marginals in a single pass.
  let home = 0,draw = 0,away = 0;
  let over15 = 0,over25 = 0,over35 = 0;
  let bttsYes = 0;
  // RELEASE A — accumulated in the SAME pass, never a second traversal.
  let homeUnder05 = 0,awayUnder05 = 0;
  // BTTS CORE PROFILE — same pass again, no parallel classifier.
  let highGoalNoBtts = 0,cleanSheetBlowout = 0;
  let bestP = -1;
  let mostLikelyScore = '1-1';
  const scoreList: Array<{score: string;prob: number;}> = [];

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = matrix[h][a];
      const total = h + a;

      if (h > a) home += p;else
      if (h < a) away += p;else
      draw += p;

      if (total > 1.5) over15 += p;
      if (total > 2.5) over25 += p;
      if (total > 3.5) over35 += p;
      if (h > 0 && a > 0) bttsYes += p;
      if (h === 0) homeUnder05 += p;
      if (a === 0) awayUnder05 += p;

      const isNoBtts = h === 0 || a === 0;
      if (isNoBtts && total >= 4) highGoalNoBtts += p;
      if (isNoBtts && Math.abs(h - a) >= 3) cleanSheetBlowout += p;

      scoreList.push({ score: `${h}-${a}`, prob: p });
      if (p > bestP) {bestP = p;mostLikelyScore = `${h}-${a}`;}
    }
  }

  scoreList.sort((x, y) => y.prob - x.prob);

  return {
    scoreMatrix: matrix,
    probs: { home, draw, away },
    over15,
    over25,
    over35,
    bttsYes,
    bttsNo: 1 - bttsYes,
    // The matrix is normalised above, so the complement is exact; the truncated
    // tail is already absorbed by the same `norm` division that BTTS relies on.
    homeUnder05,
    homeOver05: 1 - homeUnder05,
    awayUnder05,
    awayOver05: 1 - awayUnder05,
    highGoalNoBtts,
    cleanSheetBlowout,
    mostLikelyScore,
    mostLikelyScoreProb: Math.max(0, bestP),
    topScores: scoreList.slice(0, 5)
  };
}

// ─── Deterministic outcome helpers ───────────────────────────────────────────

/**
 * Argmax over a probability triple with DETERMINISTIC tie-break (H → D → A).
 *
 * Replaces the previous float-equality comparisons that could leave a
 * recommendation unset when two chained computations produced values that were
 * equal in principle but not bit-identical.
 */
export function argmaxOutcome(probs: Probs): Outcome {
  if (probs.home >= probs.draw && probs.home >= probs.away) return 'H';
  if (probs.draw >= probs.away) return 'D';
  return 'A';
}

/** Extract the scalar probability for one outcome from a triple. */
export function probabilityOf(probs: Probs, outcome: Outcome): number {
  return outcome === 'H' ? probs.home : outcome === 'D' ? probs.draw : probs.away;
}

/** Map a numeric confidence score to its human-readable label. */
export function confidenceLabelOf(score: number): ConfidenceLabel {
  if (score >= FORECAST_MODEL.labels.high) return 'High';
  if (score >= FORECAST_MODEL.labels.good) return 'Good';
  if (score >= FORECAST_MODEL.labels.moderate) return 'Moderate';
  return 'Low';
}

/** Issue a recommendation only when both the probability and confidence gates pass. */
function recommendationOf(probs: Probs, confidence: number): Recommendation {
  const top = argmaxOutcome(probs);
  const maxP = probabilityOf(probs, top);
  const { minProbability, minConfidence } = FORECAST_MODEL.recommendation;
  if (maxP < minProbability || confidence < minConfidence) return 'NO_CLEAR_EDGE';
  return top === 'H' ? 'HOME_WIN' : top === 'D' ? 'DRAW' : 'AWAY_WIN';
}

/** Look up a team weight, falling back to DEFAULT_WEIGHT on a cache miss. */
function weightOf(weights: Record<string, number>, key: string): number {
  const w = weights[key];
  return w === undefined ? DEFAULT_WEIGHT : w;
}

// ─── M1 design vector ─────────────────────────────────────────────────────────

/**
 * The M1 design vector, WITHOUT intercept.
 *
 * Column order is LOCKED. The pipeline fit (`utils/pipeline.ts`) and the
 * predictor both call this function — column drift is a compile-time error.
 *
 * Append new features at the END. Never insert, never reorder existing columns.
 */
export function m1DesignVector(features: FeatureVector): number[] {
  return [
  /* 0  */features.weight_diff,
  /* 1  */features.home_form_5 - features.away_form_5,
  /* 2  */features.home_gd_form_5 - features.away_gd_form_5,
  /* 3  */features.home_att_home - features.away_def_away,
  /* 4  */features.away_att_away - features.home_def_home,
  /* 5  */features.h2h_home_ppg - FORECAST_MODEL.fallback.h2hHomePpg,
  /* 6  Phase 2: half-time dynamics (appended, never inserted) */
  features.htGoalRate5,
  /* 7  */features.htLeadConversionHome - features.htLeadConversionAway,
  /* 8  */features.secondHalfGoalRatio - PRIOR_SECOND_HALF_RATIO,
  /* 9  Phase 4: momentum reversion, centred on the league prior */
  features.prevMatchTotalGoalsHome - PRIOR_MATCH_TOTAL_GOALS,
  /* 10 */features.prevMatchTotalGoalsAway - PRIOR_MATCH_TOTAL_GOALS];

}

/** Dimensionality of {@link m1DesignVector}. Asserted at pipeline startup. */
export const M1_DESIGN_DIM = 11;

/** Map an outcome string to its logistic class index (0 = H, 1 = D, 2 = A). */
export function classIndexOf(outcome: Outcome): ClassIndex {
  return outcome === 'H' ? 0 : outcome === 'D' ? 1 : 2;
}

/** Build one training sample for the as-of logistic fit. */
export function m1SampleOf(features: FeatureVector, outcome: Outcome): LogisticSample {
  return { x: m1DesignVector(features), y: classIndexOf(outcome) };
}

// ─── Forecast request / result types ─────────────────────────────────────────

export interface ForecastRequest {
  /** History slice to reason from. Audit: strictly-prior matches; predictor: all. */
  readonly entries: readonly ForecastHistoryEntry[];
  readonly homeKey: string;
  readonly awayKey: string;
  readonly weights: Record<string, number>;
  /** Active temperature for softmax calibration (T = 1 → identity). */
  readonly T: number;
  /**
   * Pre-computed league rates. Passing this avoids re-scanning a large slice
   * when multiple fixtures share the same league history.
   */
  readonly leagueGpm?: LeagueGoalsPerMatch;
  /**
   * As-of fitted M1 coefficients. Absent → cold-start hand-set logits,
   * and `m1Source` in the result is `'manual'`.
   */
  readonly m1Fit?: M1Fit | null;
  /**
   * Tuned M1 share of the ensemble. When absent the model constant is used.
   * Must be in (0, 1); values outside are clamped silently.
   */
  readonly ensembleWM1?: number;
  /**
   * Dixon-Coles ρ applied to the B1 grid.
   * Only non-null after the bootstrap interval excludes zero.
   */
  readonly dixonColesRho?: number | null;
}

/** Intermediate confidence sub-terms, exposed verbatim for the audit UI. */
export interface ConfidenceTerms {
  /** How peaked the calibrated distribution is (0 = flat, 1 = point mass). */
  readonly sharpness: number;
  /** Data richness, saturating at `sufficiencySaturation` matches. */
  readonly sufficiency: number;
  /** B1 / M1 agreement (0 = maximum divergence, 1 = identical). */
  readonly agreement: number;
  /** The calibrated probability of the argmax outcome. */
  readonly maxProbability: number;
}

/** The complete output of one forecast run. */
export interface ForecastResult {
  readonly features: FeatureVector;
  readonly b0: Probs;
  readonly b1: Probs;
  readonly m1: Probs;
  readonly ensRaw: Probs;
  readonly calibrated: Probs;
  readonly calibratedT: number;
  readonly confidence: number;
  readonly confidenceLabel: ConfidenceLabel;
  readonly decision: DecisionQuadrant;
  readonly m1Source: M1Source;
  readonly ensembleWM1: number;
  readonly priorDivergence: number;
  readonly recommendation: Recommendation;
  readonly caveat: string | null;
  readonly dataSufficiency: DataSufficiency;
  readonly homePlayed: number;
  readonly awayPlayed: number;
  /** Poisson intensities of the B1 leg — consumed by experiment branches. */
  readonly lambdas: {readonly home: number;readonly away: number;};
  /** The joint score matrix; every market below is a marginal of this. */
  readonly joint: JointMarketDistribution;
  readonly secondary: {
    readonly over15: number;
    readonly over25: number;
    readonly over35: number;
    readonly btts: number;
    readonly bttsNo: number;
    /** RELEASE A — model-implied team-goal markets, marginals of `joint`. */
    readonly homeOver05: number;
    readonly homeUnder05: number;
    readonly awayOver05: number;
    readonly awayUnder05: number;
    /** BTTS CORE PROFILE — model-implied one-sided blowout risk descriptors. */
    readonly highGoalNoBtts: number;
    readonly cleanSheetBlowout: number;
    readonly mostLikelyScore: string;
    readonly mostLikelyScoreProb: number;
    readonly topScores: ReadonlyArray<{score: string;prob: number;}>;
  };
  /** Decomposed confidence terms for the audit panel. */
  readonly terms: ConfidenceTerms;
}

// ─── Core forecast function ───────────────────────────────────────────────────

/**
 * Run the full Stage 0–6 forecast pipeline for one fixture.
 *
 * This is the ONLY place the math lives. Both the audit walk (pipeline.ts)
 * and the forward predictor (fixtures.ts) call this function; they differ only
 * in the `entries` slice they provide.
 *
 * @returns An immutable {@link ForecastResult} containing every intermediate
 *   value needed by the UI, the slip builder, and the audit reconciliation.
 */
export function forecastCore(request: ForecastRequest): ForecastResult {
  const { entries, homeKey, awayKey, weights, T } = request;
  const gpm = request.leagueGpm ?? leagueGoalsPerMatch(entries);

  // ── Stage 0: context & data sufficiency ────────────────────────────────────
  const homePlayed = playedCount(entries, homeKey);
  const awayPlayed = playedCount(entries, awayKey);
  const minPlayed = Math.min(homePlayed, awayPlayed);
  const dataSufficiency = sufficiencyOf(minPlayed);

  // ── Stage 1: feature engineering (20 dimensions) ──────────────────────────
  const homeVenue: MatchRow[] = [];
  const awayVenue: MatchRow[] = [];
  for (const e of entries) {
    if (e.homeKey === homeKey) homeVenue.push(e.match);
    if (e.awayKey === awayKey) awayVenue.push(e.match);
  }

  const homeAttHome = venueAttack(homeVenue, true, gpm.home);
  const homeDefHome = venueDefense(homeVenue, true, gpm.away);
  const awayAttAway = venueAttack(awayVenue, false, gpm.away);
  const awayDefAway = venueDefense(awayVenue, false, gpm.home);

  const wHome = weightOf(weights, homeKey);
  const wAway = weightOf(weights, awayKey);
  const weightDiff = wHome - wAway;

  const homeForm = formOf(entries, homeKey);
  const awayForm = formOf(entries, awayKey);
  const h2hHomePpg = h2hHomePpgOf(entries, homeKey, awayKey);
  const htF = computeHtFeatures(entries, homeKey, awayKey);

  const features: FeatureVector = {
    home_weight_index: wHome,
    away_weight_index: wAway,
    weight_diff: weightDiff,
    home_att_home: homeAttHome,
    home_def_home: homeDefHome,
    away_att_away: awayAttAway,
    away_def_away: awayDefAway,
    league_home_gpm: gpm.home,
    league_away_gpm: gpm.away,
    home_form_5: homeForm.ppg,
    away_form_5: awayForm.ppg,
    home_gd_form_5: homeForm.gdAvg,
    away_gd_form_5: awayForm.gdAvg,
    h2h_home_ppg: h2hHomePpg,
    htGoalRate5: htF.htGoalRate5,
    htLeadConversionHome: htF.htLeadConversionHome,
    htLeadConversionAway: htF.htLeadConversionAway,
    secondHalfGoalRatio: htF.secondHalfGoalRatio,
    prevMatchTotalGoalsHome: prevMatchGoals(entries, homeKey),
    prevMatchTotalGoalsAway: prevMatchGoals(entries, awayKey)
  };

  // ── Stage 2: baselines (B0 flat prior + B1 venue-adjusted Poisson) ────────
  const b0: Probs = { ...FORECAST_MODEL.prior };

  /* Clamp lambdas to a sensible floor (0.30) to prevent degenerate Poisson PMFs.
   *
   * NORMALISER ORIENTATION (this was the BTTS mis-calibration).
   * `awayDefAway` counts the goals the AWAY side concedes away — those are HOME
   * goals, so its league mean is `gpm.home`, and that is what turns it into a
   * unit-free defensive ratio. Symmetrically `homeDefHome` counts AWAY goals and
   * must be divided by `gpm.away`. Swapping the two (as before) scaled λ_home by
   * gpm.home / gpm.away and λ_away by its reciprocal — roughly +35% / −26% at
   * typical league rates. Every goal market read off the joint matrix inherited
   * that bias, which is why all BTTS probability bands measured ≈50% regardless
   * of the priced value. */
  const lambdaH = Math.max(
    0.3,
    homeAttHome * (awayDefAway / Math.max(0.5, gpm.home))
  );
  const lambdaA = Math.max(
    0.3,
    awayAttAway * (homeDefHome / Math.max(0.5, gpm.away))
  );

  // One matrix; every market is a marginal. rho = 0 → independent Poisson exactly.
  const maxGoals = Math.max(adaptiveMaxGoals(lambdaH), adaptiveMaxGoals(lambdaA));
  const joint = computeJointScoreDistribution(
    lambdaH,
    lambdaA,
    request.dixonColesRho ?? 0,
    maxGoals
  );
  const b1: Probs = joint.probs;

  // ── Stage 3: M1 — fitted logistic or cold-start fallback ──────────────────
  let m1: Probs;
  let m1Source: M1Source;

  if (request.m1Fit) {
    m1 = predictMultinomial(request.m1Fit, m1DesignVector(features));
    m1Source = 'fitted';
  } else {
    const c = FORECAST_MODEL.m1;
    const formDiff = homeForm.ppg - awayForm.ppg;
    const zH =
    c.weightDiff * weightDiff +
    c.formDiff * formDiff +
    c.attDefDiff * (homeAttHome - awayDefAway) +
    c.homeAdvantage;
    const zD = c.drawBase + c.drawSpread * Math.abs(weightDiff);
    const zA =
    -c.weightDiff * weightDiff -
    c.formDiff * formDiff +
    c.attDefDiff * (awayAttAway - homeDefHome);
    const eH = Math.exp(zH),eD = Math.exp(zD),eA = Math.exp(zA);
    const sumM1 = eH + eD + eA;
    m1 = { home: eH / sumM1, draw: eD / sumM1, away: eA / sumM1 };
    m1Source = 'manual';
  }

  // ── Stage 3b: ensemble blend ───────────────────────────────────────────────
  // Clamp wM1 to (0, 1) so an erroneous tuning param cannot invert the blend.
  const wM1 = Math.min(0.999, Math.max(0.001,
  request.ensembleWM1 ?? FORECAST_MODEL.ensemble.wM1
  ));
  const wB1 = 1 - wM1;
  const ensRaw: Probs = {
    home: wB1 * b1.home + wM1 * m1.home,
    draw: wB1 * b1.draw + wM1 * m1.draw,
    away: wB1 * b1.away + wM1 * m1.away
  };

  // ── Stage 4: temperature calibration ──────────────────────────────────────
  const calibrated = calibrateWithT(ensRaw, T);

  // ── Stage 5: confidence (fully decomposed) ────────────────────────────────
  const conf = FORECAST_MODEL.confidence;

  // Sharpness: 1 − normalised Shannon entropy of the calibrated distribution.
  // Guard against log(0) by clamping each probability to a tiny positive value.
  const safeH = Math.max(1e-9, calibrated.home);
  const safeD = Math.max(1e-9, calibrated.draw);
  const safeA = Math.max(1e-9, calibrated.away);
  const entropy = -(safeH * Math.log(safeH) + safeD * Math.log(safeD) + safeA * Math.log(safeA));
  const sharpness = Math.max(0, 1 - entropy / Math.log(3));

  // Sufficiency: saturates at `sufficiencySaturation` matches.
  const sufficiency = Math.min(1, minPlayed / conf.sufficiencySaturation);

  // Agreement: mean absolute deviation between B1 and M1, normalised.
  const divergence =
  (Math.abs(b1.home - m1.home) +
  Math.abs(b1.draw - m1.draw) +
  Math.abs(b1.away - m1.away)) / 3;
  const agreement = Math.max(0, 1 - divergence / conf.disagreementScale);

  // Composite score: each term floored before the exponent to prevent a single
  // zero from collapsing the entire score.
  const rawConfidence =
  Math.pow(sharpness, conf.sharpnessExp) *
  Math.pow(Math.max(conf.termFloor, sufficiency), conf.sufficiencyExp) *
  Math.pow(Math.max(conf.termFloor, agreement), conf.agreementExp);

  const confidence = Math.min(
    conf.ceiling,
    Math.max(conf.floor, Math.round(rawConfidence * 100))
  );
  const confidenceLabel = confidenceLabelOf(confidence);

  // ── Stage 6: recommendation, decision quadrant, caveat ────────────────────
  const recommendation = recommendationOf(calibrated, confidence);
  const maxProbability = probabilityOf(calibrated, argmaxOutcome(calibrated));
  const decision = decisionQuadrantOf(maxProbability, confidence);

  /**
   * Prior divergence — the model's distance from its OWN B0 prior.
   * This is a diagnostic for anomalies and data errors, NOT a value edge
   * (there is no exogenous market price to compare against).
   */
  const priorDivergence =
  (Math.abs(calibrated.home - b0.home) +
  Math.abs(calibrated.draw - b0.draw) +
  Math.abs(calibrated.away - b0.away)) / 3;

  // Caveats are mutually exclusive; the most severe wins.
  let caveat: string | null = null;
  if (dataSufficiency === 'cold') {
    caveat = 'Kevés mérkőzésadat: szezon eleji (vagy liga-szintű) hidegindítás.';
  } else if (agreement < FORECAST_MODEL.caveats.lowAgreement) {
    caveat = 'A statisztikai (Poisson) és ML modellek eltérő képet mutatnak.';
  } else if (maxProbability < FORECAST_MODEL.caveats.flatMaxProb) {
    caveat = 'Kiegyenlített esélyek, nincs határozott statisztikai él.';
  }

  return {
    features,
    b0,
    b1,
    m1,
    ensRaw,
    calibrated,
    calibratedT: T,
    confidence,
    confidenceLabel,
    decision,
    m1Source,
    ensembleWM1: wM1,
    priorDivergence,
    recommendation,
    caveat,
    dataSufficiency,
    homePlayed,
    awayPlayed,
    lambdas: { home: lambdaH, away: lambdaA },
    joint,
    secondary: {
      over15: joint.over15,
      over25: joint.over25,
      over35: joint.over35,
      btts: joint.bttsYes,
      bttsNo: joint.bttsNo,
      homeOver05: joint.homeOver05,
      homeUnder05: joint.homeUnder05,
      awayOver05: joint.awayOver05,
      awayUnder05: joint.awayUnder05,
      highGoalNoBtts: joint.highGoalNoBtts,
      cleanSheetBlowout: joint.cleanSheetBlowout,
      mostLikelyScore: joint.mostLikelyScore,
      mostLikelyScoreProb: joint.mostLikelyScoreProb,
      topScores: joint.topScores
    },
    terms: { sharpness, sufficiency, agreement, maxProbability }
  };
}

// ─── Reconciliation ───────────────────────────────────────────────────────────

/**
 * Compute Brier score and log-loss for a forecast that now has a known outcome.
 *
 * Both metrics are computed for B1 (Poisson baseline) AND the calibrated
 * ensemble so the audit can track whether the ensemble adds value.
 */
export function reconcile(
forecast: ForecastResult,
outcome: Outcome)
: MatchPipeline['reconciliation'] {
  const actualH = outcome === 'H' ? 1 : 0;
  const actualD = outcome === 'D' ? 1 : 0;
  const actualA = outcome === 'A' ? 1 : 0;
  const { b1, calibrated, recommendation } = forecast;

  const brierB1 =
  Math.pow(b1.home - actualH, 2) +
  Math.pow(b1.draw - actualD, 2) +
  Math.pow(b1.away - actualA, 2);

  const brierEns =
  Math.pow(calibrated.home - actualH, 2) +
  Math.pow(calibrated.draw - actualD, 2) +
  Math.pow(calibrated.away - actualA, 2);

  // Clamp to 1e-5 to prevent log(0) blowing up to −∞.
  const logLossB1 = -Math.log(Math.max(1e-5, probabilityOf(b1, outcome)));
  const logLossEns = -Math.log(Math.max(1e-5, probabilityOf(calibrated, outcome)));

  const isCorrect =
  recommendation === 'HOME_WIN' && outcome === 'H' ||
  recommendation === 'DRAW' && outcome === 'D' ||
  recommendation === 'AWAY_WIN' && outcome === 'A';

  return { brierB1, brierEns, logLossB1, logLossEns, isCorrect };
}

/**
 * Pack a forecast into the persisted per-match pipeline record for the audit.
 * This is the canonical serialisation; the type system enforces the shape.
 */
export function toMatchPipeline(
forecast: ForecastResult,
outcome: Outcome)
: MatchPipeline {
  return {
    context: {
      homePlayed: forecast.homePlayed,
      awayPlayed: forecast.awayPlayed,
      dataSufficiency: forecast.dataSufficiency
    },
    features: forecast.features,
    b0: forecast.b0,
    b1: forecast.b1,
    m1: forecast.m1,
    ensRaw: forecast.ensRaw,
    calibrated: forecast.calibrated,
    calibratedT: forecast.calibratedT,
    confidence: forecast.confidence,
    confidenceLabel: forecast.confidenceLabel,
    decision: forecast.decision,
    m1Source: forecast.m1Source,
    ensembleWM1: forecast.ensembleWM1,
    priorDivergence: forecast.priorDivergence,
    recommendation: forecast.recommendation,
    caveat: forecast.caveat,
    secondary: { ...forecast.secondary, topScores: forecast.secondary.topScores.map((entry) => ({ ...entry })) },
    reconciliation: reconcile(forecast, outcome)
  };
}