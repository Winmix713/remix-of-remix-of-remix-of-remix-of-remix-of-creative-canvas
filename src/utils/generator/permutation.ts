/**
 * Seeded permutation / bootstrap framework for the Generator Structure Suite.
 *
 * DETERMINISM IS A HARD REQUIREMENT. No Math.random, no Date.now, no unseeded
 * resampling anywhere in this module or its callers. Everything derives from
 * BOOTSTRAP_SEED (src/utils/constants.ts) and the seed travels into the report.
 */

import { BOOTSTRAP_CI_ALPHA, BOOTSTRAP_ITERATIONS, BOOTSTRAP_SEED } from '../constants';
import { mulberry32 } from '../bootstrap';
import type { Effect } from './types';

export { BOOTSTRAP_SEED };

/** Deterministic Fisher–Yates. Returns a copy; the input is never mutated. */
export function seededShuffle<T>(items: readonly T[], seed: number = BOOTSTRAP_SEED): T[] {
  const out = [...items];
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1)) % (i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

/**
 * Percentile bootstrap CI around the mean of a per-observation series.
 * Used for paired OOS deltas: pass candidate−baseline per match.
 */
export function bootstrapMeanEffect(
values: readonly number[],
iterations: number = BOOTSTRAP_ITERATIONS,
seed: number = BOOTSTRAP_SEED)
: Effect {
  const n = values.length;
  const point = mean(values);
  if (n < 2) return { estimate: point, ci95Low: point, ci95High: point };

  const rand = mulberry32(seed);
  const reps = new Array<number>(iterations);
  for (let it = 0; it < iterations; it++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += values[Math.floor(rand() * n) % n];
    }
    reps[it] = sum / n;
  }
  reps.sort((a, b) => a - b);
  return {
    estimate: point,
    ci95Low: quantile(reps, BOOTSTRAP_CI_ALPHA / 2),
    ci95High: quantile(reps, 1 - BOOTSTRAP_CI_ALPHA / 2)
  };
}

export interface PermutationResult {
  observed: number;
  /** Mean of the null distribution. */
  nullMean: number;
  nullSd: number;
  /** Two-sided p-value with the +1 correction (never reports p = 0). */
  pValue: number;
  iterations: number;
  seed: number;
}

/**
 * Generic two-sided permutation test.
 *
 * `statistic` is evaluated once on the observed data and `iterations` times on
 * data reshuffled by `permute`, which receives a seeded uniform generator so
 * that every replicate is reproducible.
 */
export function permutationTest<T>(
data: T,
statistic: (d: T) => number,
permute: (d: T, rand: () => number) => T,
iterations: number = BOOTSTRAP_ITERATIONS,
seed: number = BOOTSTRAP_SEED)
: PermutationResult {
  const observed = statistic(data);
  const rand = mulberry32(seed);
  const nulls = new Array<number>(iterations);
  let atLeastAsExtreme = 0;
  for (let it = 0; it < iterations; it++) {
    const value = statistic(permute(data, rand));
    nulls[it] = value;
    if (Math.abs(value) >= Math.abs(observed) - 1e-12) atLeastAsExtreme++;
  }
  const nullMean = mean(nulls);
  const variance =
  nulls.reduce((acc, v) => acc + (v - nullMean) ** 2, 0) / Math.max(1, nulls.length - 1);
  return {
    observed,
    nullMean,
    nullSd: Math.sqrt(variance),
    pValue: (atLeastAsExtreme + 1) / (iterations + 1),
    iterations,
    seed
  };
}
