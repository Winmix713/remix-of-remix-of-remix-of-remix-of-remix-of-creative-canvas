/**
 * backtest/metrics — the single measurement source for out-of-sample scoring.
 *
 * The Generator Structure Suite is forbidden from defining its own Brier /
 * LogLoss / ECE. Every predictive comparison in the suite goes through this
 * module so that two tests can never disagree about what "better" means.
 *
 * Definitions (fixed, do not change without migrating every caller):
 *   Brier   — multiclass (Brier score over the 3 outcome indicators), range 0..2.
 *   LogLoss — natural log, clipped at PROB_FLOOR to stay finite.
 *   ECE     — expected calibration error, delegated to the existing
 *             `computeECEGeneric` in src/utils/stats.ts (never duplicated).
 */

import type { Outcome, Probs } from '../../types/winmix';
import { computeECEGeneric } from '../stats';

/** Probabilities are clipped here before any logarithm is taken. */
export const PROB_FLOOR = 1e-6;

export interface ScoredPrediction {
  probs: Probs;
  outcome: Outcome;
}

export function probOfOutcome(probs: Probs, outcome: Outcome): number {
  const p =
  outcome === 'H' ? probs.home : outcome === 'D' ? probs.draw : probs.away;
  return Math.min(1 - PROB_FLOOR, Math.max(PROB_FLOOR, p));
}

/** Multiclass Brier score for one prediction. */
export function brier(probs: Probs, outcome: Outcome): number {
  const h = outcome === 'H' ? 1 : 0;
  const d = outcome === 'D' ? 1 : 0;
  const a = outcome === 'A' ? 1 : 0;
  return (
    (probs.home - h) ** 2 + (probs.draw - d) ** 2 + (probs.away - a) ** 2);

}

/** Negative log-likelihood of one prediction. */
export function logLoss(probs: Probs, outcome: Outcome): number {
  return -Math.log(probOfOutcome(probs, outcome));
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

/** Per-match Brier values, in input order (paired comparisons need the order). */
export function brierSeries(rows: readonly ScoredPrediction[]): number[] {
  return rows.map((r) => brier(r.probs, r.outcome));
}

/** Per-match log-loss values, in input order. */
export function logLossSeries(rows: readonly ScoredPrediction[]): number[] {
  return rows.map((r) => logLoss(r.probs, r.outcome));
}

export function meanBrier(rows: readonly ScoredPrediction[]): number {
  return mean(brierSeries(rows));
}

export function meanLogLoss(rows: readonly ScoredPrediction[]): number {
  return mean(logLossSeries(rows));
}

/** Expected calibration error over the top-probability bins. */
export function ece(rows: readonly ScoredPrediction[]): number {
  return computeECEGeneric(
    [...rows],
    (r) => r.probs,
    (r) => r.outcome
  );
}

export interface MetricSet {
  brier: number;
  logLoss: number;
  ece: number;
  n: number;
}

export function scoreAll(rows: readonly ScoredPrediction[]): MetricSet {
  return {
    brier: meanBrier(rows),
    logLoss: meanLogLoss(rows),
    ece: ece(rows),
    n: rows.length
  };
}
