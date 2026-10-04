/**
 * ratings — the suite's OWN minimal, analysis-only strength estimator.
 *
 * This is deliberately NOT the WinMix rating engine. Nothing here reads, writes
 * or influences the Prediction Engine; it exists so that every generator test
 * shares one transparent, deterministic, strictly walk-forward baseline.
 *
 * LEAKAGE CONTRACT
 * ----------------
 * For match at index t the feature row contains ONLY information derived from
 * matches 0..t-1. The rating update for match t happens AFTER its feature row
 * has been emitted. Changing any future result therefore cannot change an
 * earlier row — this is asserted in ratings.test.ts.
 */

import type { MatchRow, Outcome, Probs } from '../../types/winmix';
import { logLoss } from '../backtest/metrics';

export interface RatingConfig {
  /** Elo K-factor. */
  k: number;
  /** Starting rating for an unseen team. */
  initial: number;
  /** Elo scale (points per 10x odds ratio). */
  scale: number;
  /** Window length of the form features, in matches. */
  formWindow: number;
}

export const DEFAULT_RATING_CONFIG: RatingConfig = {
  k: 20,
  initial: 1500,
  scale: 400,
  formWindow: 5
};

/** One walk-forward feature row: everything is pre-match information. */
export interface FeatureRow {
  /** Position in the league-wide chronological match list. */
  index: number;
  homeTeam: string;
  awayTeam: string;
  outcome: Outcome;
  /** Pre-match Elo difference (home − away), in rating points / scale. */
  ratingDiff: number;
  /** Points-per-match form difference over the last `formWindow` matches. */
  formDiff: number;
  /** Goal-difference-per-match form difference over the same window. */
  gdFormDiff: number;
  /** How many prior matches each side has played (both sides' minimum). */
  priorMatches: number;
}

interface TeamState {
  rating: number;
  points: number[];
  goalDiff: number[];
  played: number;
}

function emptyTeam(initial: number): TeamState {
  return { rating: initial, points: [], goalDiff: [], played: 0 };
}

function tailMean(values: readonly number[], window: number): number {
  if (values.length === 0) return 0;
  const slice = values.slice(-window);
  let s = 0;
  for (const v of slice) s += v;
  return s / slice.length;
}

/**
 * Build the walk-forward feature table for one league's chronological matches.
 * `matches` MUST already be in kickoff order; the caller owns the ordering.
 */
export function buildFeatureRows(
matches: readonly MatchRow[],
config: RatingConfig = DEFAULT_RATING_CONFIG)
: FeatureRow[] {
  const teams = new Map<string, TeamState>();
  const get = (name: string): TeamState => {
    let t = teams.get(name);
    if (!t) {
      t = emptyTeam(config.initial);
      teams.set(name, t);
    }
    return t;
  };

  const rows: FeatureRow[] = [];
  matches.forEach((m, index) => {
    const home = get(m.home_team);
    const away = get(m.away_team);

    rows.push({
      index,
      homeTeam: m.home_team,
      awayTeam: m.away_team,
      outcome: m.outcome,
      ratingDiff: (home.rating - away.rating) / config.scale,
      formDiff:
      tailMean(home.points, config.formWindow) -
      tailMean(away.points, config.formWindow),
      gdFormDiff:
      tailMean(home.goalDiff, config.formWindow) -
      tailMean(away.goalDiff, config.formWindow),
      priorMatches: Math.min(home.played, away.played)
    });

    // --- update AFTER the row was emitted: no future information leaks back ---
    const expectedHome =
    1 / (1 + Math.pow(10, -(home.rating - away.rating) / config.scale));
    const scoreHome = m.outcome === 'H' ? 1 : m.outcome === 'D' ? 0.5 : 0;
    const delta = config.k * (scoreHome - expectedHome);
    home.rating += delta;
    away.rating -= delta;

    const gd = m.home_score - m.away_score;
    home.points.push(m.outcome === 'H' ? 3 : m.outcome === 'D' ? 1 : 0);
    away.points.push(m.outcome === 'A' ? 3 : m.outcome === 'D' ? 1 : 0);
    home.goalDiff.push(gd);
    away.goalDiff.push(-gd);
    home.played++;
    away.played++;
  });

  return rows;
}

/* ---------------- ordered logistic model ---------------- */

/** Feature keys a model may consume. Model A uses only `ratingDiff`. */
export type FeatureKey = 'ratingDiff' | 'formDiff' | 'gdFormDiff';

export interface OrderedLogitModel {
  features: FeatureKey[];
  /** One weight per feature, in `features` order. */
  weights: number[];
  /** Home-advantage style intercept on the latent scale. */
  intercept: number;
  /** Half-width of the draw band (always > 0). */
  threshold: number;
  trainedOn: number;
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

export function probsFromLatent(z: number, threshold: number): Probs {
  const c = Math.max(1e-3, threshold);
  const away = sigmoid(-c - z);
  const upToDraw = sigmoid(c - z);
  const draw = Math.max(1e-6, upToDraw - away);
  const home = Math.max(1e-6, 1 - upToDraw);
  const sum = away + draw + home;
  return { home: home / sum, draw: draw / sum, away: away / sum };
}

function latent(model: OrderedLogitModel, row: FeatureRow): number {
  let z = model.intercept;
  for (let i = 0; i < model.features.length; i++) {
    z += model.weights[i] * row[model.features[i]];
  }
  return z;
}

export function predictRow(model: OrderedLogitModel, row: FeatureRow): Probs {
  return probsFromLatent(latent(model, row), model.threshold);
}

/** Cold-start prior used before a model can be fitted: league base rates. */
export const COLD_START_PROBS: Probs = { home: 0.44, draw: 0.26, away: 0.30 };

export interface FitOptions {
  iterations: number;
  l2: number;
}

export const DEFAULT_FIT_OPTIONS: FitOptions = { iterations: 160, l2: 0.01 };

/**
 * Deterministic full-batch fit of an ordered logistic model.
 *
 * Parameters are [w..., intercept, log(threshold)]. The gradient is computed by
 * central differences: the parameter count is 3–5, so this is cheap, has no
 * randomness, and cannot silently disagree with an analytic derivation.
 */
export function fitOrderedLogit(
rows: readonly FeatureRow[],
features: FeatureKey[],
options: FitOptions = DEFAULT_FIT_OPTIONS)
: OrderedLogitModel {
  const p = features.length;
  // [weights..., intercept, logThreshold]
  let params = new Array<number>(p + 2).fill(0);
  params[p] = 0.2;
  params[p + 1] = Math.log(0.6);

  const toModel = (ps: number[]): OrderedLogitModel => ({
    features,
    weights: ps.slice(0, p),
    intercept: ps[p],
    threshold: Math.exp(ps[p + 1]),
    trainedOn: rows.length
  });

  const loss = (ps: number[]): number => {
    const model = toModel(ps);
    if (rows.length === 0) return 0;
    let total = 0;
    for (const row of rows) {
      total += logLoss(predictRow(model, row), row.outcome);
    }
    let penalty = 0;
    for (let i = 0; i < p; i++) penalty += ps[i] * ps[i];
    return total / rows.length + options.l2 * penalty;
  };

  if (rows.length === 0) return toModel(params);

  let current = loss(params);
  let lr = 0.5;
  const eps = 1e-4;
  for (let it = 0; it < options.iterations; it++) {
    const grad = new Array<number>(params.length).fill(0);
    for (let i = 0; i < params.length; i++) {
      const up = [...params];
      const down = [...params];
      up[i] += eps;
      down[i] -= eps;
      grad[i] = (loss(up) - loss(down)) / (2 * eps);
    }
    const next = params.map((v, i) => v - lr * grad[i]);
    const nextLoss = loss(next);
    if (nextLoss < current - 1e-12) {
      params = next;
      current = nextLoss;
      lr = Math.min(lr * 1.1, 2);
    } else {
      lr *= 0.5;
      if (lr < 1e-6) break;
    }
  }

  return toModel(params);
}
