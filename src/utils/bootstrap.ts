/**
 * bootstrap — every performance number in WinMix must carry an error bar.
 *
 * P0 MEASUREMENT FOUNDATION
 * -------------------------
 * A 240-match season is a small sample. A "+2% skill vs the B1 baseline"
 * headline is meaningless without knowing whether that 2% survives
 * resampling. This module produces the interval; the UI is forbidden from
 * rendering a skill/Brier/log-loss figure without one.
 *
 * DETERMINISM
 * -----------
 * The resampler uses a seeded mulberry32 PRNG, never `Math.random`. The same
 * match list therefore always yields bit-identical intervals — on the main
 * thread and inside the pipeline Web Worker alike.
 */

import {
  BOOTSTRAP_CI_ALPHA,
  BOOTSTRAP_ITERATIONS,
  BOOTSTRAP_SEED } from
'./constants';
import type { MeanCI, SkillCI, WilsonInterval } from '../types/winmix';

/** Small, fast, fully deterministic 32-bit PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = a + 0x6d2b79f5 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/** One match's paired losses. Positive skill means the ensemble beat B1. */
export interface SkillPair {
  logLossB1: number;
  logLossEns: number;
}

/** Skill as displayed everywhere: percentage log-loss reduction vs B1. */
export function skillPercent(meanB1: number, meanEns: number): number {
  return meanB1 > 0 ? (1 - meanEns / meanB1) * 100 : 0;
}

/**
 * Bootstrap percentile CI of the skill percentage.
 *
 * Resamples MATCHES (not losses independently), so the pairing between the
 * baseline and the ensemble is preserved in every replicate.
 */
export function bootstrapSkillCI(
pairs: readonly SkillPair[],
iterations: number = BOOTSTRAP_ITERATIONS,
seed: number = BOOTSTRAP_SEED)
: SkillCI {
  const n = pairs.length;
  const empty: SkillCI = {
    mean: 0,
    lo: 0,
    hi: 0,
    crossesZero: true,
    iterations: 0,
    n
  };
  if (n < 2) return empty;

  const point = skillPercent(
    mean(pairs.map((p) => p.logLossB1)),
    mean(pairs.map((p) => p.logLossEns))
  );

  const rand = mulberry32(seed);
  const replicates = new Array<number>(iterations);
  for (let it = 0; it < iterations; it++) {
    let sumB1 = 0;
    let sumEns = 0;
    for (let i = 0; i < n; i++) {
      const pick = pairs[Math.floor(rand() * n) % n];
      sumB1 += pick.logLossB1;
      sumEns += pick.logLossEns;
    }
    replicates[it] = skillPercent(sumB1 / n, sumEns / n);
  }
  replicates.sort((a, b) => a - b);

  const lo = quantile(replicates, BOOTSTRAP_CI_ALPHA / 2);
  const hi = quantile(replicates, 1 - BOOTSTRAP_CI_ALPHA / 2);
  return {
    mean: point,
    lo,
    hi,
    crossesZero: lo <= 0 && hi >= 0,
    iterations,
    n
  };
}

/** Bootstrap percentile CI around the mean of any per-match metric. */
export function bootstrapMeanCI(
values: readonly number[],
iterations: number = BOOTSTRAP_ITERATIONS,
seed: number = BOOTSTRAP_SEED)
: MeanCI {
  const n = values.length;
  if (n === 0) return { mean: 0, lo: 0, hi: 0, n: 0 };
  if (n < 2) return { mean: values[0], lo: values[0], hi: values[0], n };

  const rand = mulberry32(seed);
  const replicates = new Array<number>(iterations);
  for (let it = 0; it < iterations; it++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += values[Math.floor(rand() * n) % n];
    replicates[it] = sum / n;
  }
  replicates.sort((a, b) => a - b);
  return {
    mean: mean(values),
    lo: quantile(replicates, BOOTSTRAP_CI_ALPHA / 2),
    hi: quantile(replicates, 1 - BOOTSTRAP_CI_ALPHA / 2),
    n
  };
}

/**
 * Wilson score interval for a hit rate.
 *
 * Used by the reliability band table: with 20–40 samples in a band the naive
 * proportion looks far more certain than it is.
 */
export function wilsonInterval(hits: number, n: number, z = 1.96): WilsonInterval {
  if (n <= 0) return { lo: 0, hi: 1, rate: 0, n: 0 };
  const p = hits / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const halfWidth =
  z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / denom;
  return {
    rate: p,
    lo: Math.max(0, center - halfWidth),
    hi: Math.min(1, center + halfWidth),
    n
  };
}

/** Convenience: extracts the paired losses from scored matches. */
export function skillPairsOf(
matches: readonly {pipeline?: {reconciliation: SkillPair;};}[])
: SkillPair[] {
  const out: SkillPair[] = [];
  for (const m of matches) {
    if (!m.pipeline) continue;
    out.push({
      logLossB1: m.pipeline.reconciliation.logLossB1,
      logLossEns: m.pipeline.reconciliation.logLossEns
    });
  }
  return out;
}