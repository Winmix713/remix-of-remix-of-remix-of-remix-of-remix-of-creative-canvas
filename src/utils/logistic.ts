/**
 * logistic — regularized multinomial logistic regression, fitted from data.
 *
 * P1 MODEL CORRECTNESS
 * --------------------
 * The M1 leg of the ensemble used to run on hand-typed logit coefficients
 * (0.42 for the weight difference, 0.55 for form, …) that were never fitted to
 * anything, yet carried the majority of the ensemble weight. This module
 * replaces them with an L2-regularized softmax regression.
 *
 * DETERMINISM & LEAKAGE
 * ---------------------
 *  - Full-batch gradient descent, fixed iteration budget, no randomness: the
 *    same sample always produces the same coefficients.
 *  - The module knows nothing about time. Keeping the fit as-of is the caller's
 *    job (`utils/pipeline.ts` only ever hands it strictly-prior matches).
 */

import {
  M1_GD_ITERATIONS,
  M1_GD_LEARNING_RATE,
  M1_L2_LAMBDA,
  M1_MIN_SAMPLE } from
'./constants';
import type { M1Fit, Probs } from '../types/winmix';

/** Class index convention: 0 = home, 1 = draw, 2 = away. */
export type ClassIndex = 0 | 1 | 2;

export interface LogisticSample {
  /** Design vector WITHOUT the intercept — it is added internally. */
  x: number[];
  y: ClassIndex;
}

const CLASSES = 3;

function softmax(z: number[]): number[] {
  const max = Math.max(z[0], z[1], z[2]);
  const e0 = Math.exp(z[0] - max);
  const e1 = Math.exp(z[1] - max);
  const e2 = Math.exp(z[2] - max);
  const s = e0 + e1 + e2;
  return [e0 / s, e1 / s, e2 / s];
}

function standardize(samples: readonly LogisticSample[], dim: number) {
  const mean = new Array<number>(dim).fill(0);
  const std = new Array<number>(dim).fill(0);
  for (const s of samples) {
    for (let d = 0; d < dim; d++) mean[d] += s.x[d] ?? 0;
  }
  for (let d = 0; d < dim; d++) mean[d] /= samples.length;
  for (const s of samples) {
    for (let d = 0; d < dim; d++) {
      const diff = (s.x[d] ?? 0) - mean[d];
      std[d] += diff * diff;
    }
  }
  for (let d = 0; d < dim; d++) {
    std[d] = Math.sqrt(std[d] / Math.max(1, samples.length - 1));
    if (!Number.isFinite(std[d]) || std[d] < 1e-8) std[d] = 1;
  }
  return { mean, std };
}

/** Builds the standardized design row, intercept first. */
function designRow(
x: readonly number[],
mean: readonly number[],
std: readonly number[])
: number[] {
  const row = new Array<number>(mean.length + 1);
  row[0] = 1;
  for (let d = 0; d < mean.length; d++) {
    row[d + 1] = ((x[d] ?? 0) - mean[d]) / std[d];
  }
  return row;
}

/**
 * Fits softmax weights by gradient descent on the L2-penalized mean
 * cross-entropy. Returns `null` when there is not enough prior data — the
 * caller must then fall back to the hand-set cold-start coefficients.
 */
export function fitMultinomialLogistic(
samples: readonly LogisticSample[],
lambda: number = M1_L2_LAMBDA,
minSample: number = M1_MIN_SAMPLE)
: M1Fit | null {
  const n = samples.length;
  if (n < minSample) return null;
  const dim = samples[0].x.length;
  if (dim === 0) return null;

  const { mean, std } = standardize(samples, dim);
  const rows = samples.map((s) => designRow(s.x, mean, std));
  const width = dim + 1;

  // weights[k][j]; the softmax is over-parameterized but the L2 penalty makes
  // it identifiable, so no reference class has to be pinned to zero.
  const weights: number[][] = Array.from({ length: CLASSES }, () =>
  new Array<number>(width).fill(0)
  );

  const grad: number[][] = Array.from({ length: CLASSES }, () =>
  new Array<number>(width).fill(0)
  );

  for (let iter = 0; iter < M1_GD_ITERATIONS; iter++) {
    for (let k = 0; k < CLASSES; k++) grad[k].fill(0);

    for (let i = 0; i < n; i++) {
      const row = rows[i];
      const z = [0, 0, 0];
      for (let k = 0; k < CLASSES; k++) {
        let acc = 0;
        for (let j = 0; j < width; j++) acc += weights[k][j] * row[j];
        z[k] = acc;
      }
      const p = softmax(z);
      const y = samples[i].y;
      for (let k = 0; k < CLASSES; k++) {
        const err = p[k] - (k === y ? 1 : 0);
        if (err === 0) continue;
        for (let j = 0; j < width; j++) grad[k][j] += err * row[j];
      }
    }

    for (let k = 0; k < CLASSES; k++) {
      for (let j = 0; j < width; j++) {
        // The intercept (j = 0) is deliberately left unpenalized.
        const penalty = j === 0 ? 0 : lambda * weights[k][j] / n;
        weights[k][j] -= M1_GD_LEARNING_RATE * (grad[k][j] / n + penalty);
      }
    }
  }

  let loss = 0;
  for (let i = 0; i < n; i++) {
    const row = rows[i];
    const z = [0, 0, 0];
    for (let k = 0; k < CLASSES; k++) {
      let acc = 0;
      for (let j = 0; j < width; j++) acc += weights[k][j] * row[j];
      z[k] = acc;
    }
    const p = softmax(z);
    loss += -Math.log(Math.max(1e-9, p[samples[i].y]));
  }

  return {
    weights,
    mean,
    std,
    dim,
    n,
    lambda,
    iterations: M1_GD_ITERATIONS,
    avgLogLoss: loss / n
  };
}

/** Applies a fit to one design vector. */
export function predictMultinomial(fit: M1Fit, x: readonly number[]): Probs {
  const row = designRow(x, fit.mean, fit.std);
  const z = [0, 0, 0];
  for (let k = 0; k < CLASSES; k++) {
    let acc = 0;
    for (let j = 0; j < row.length; j++) acc += fit.weights[k][j] * row[j];
    z[k] = acc;
  }
  const p = softmax(z);
  return { home: p[0], draw: p[1], away: p[2] };
}

/**
 * Grid-searches the ensemble weight given to M1, minimizing log-loss on
 * strictly prior data. The band is deliberately narrow: the point is to nudge
 * a hand-set constant, not to let one noisy season swing the whole model.
 */
export function fitEnsembleWeight(
samples: readonly {b1: Probs;m1: Probs;y: ClassIndex;}[],
min: number,
max: number,
fallback: number,
minSample: number)
: {wM1: number;avgLogLoss: number;n: number;} | null {
  if (samples.length < minSample) return null;
  let best = fallback;
  let bestLoss = Infinity;
  for (let w = min; w <= max + 1e-9; w += 0.05) {
    let loss = 0;
    for (const s of samples) {
      const blended = [
      (1 - w) * s.b1.home + w * s.m1.home,
      (1 - w) * s.b1.draw + w * s.m1.draw,
      (1 - w) * s.b1.away + w * s.m1.away];

      loss += -Math.log(Math.max(1e-6, blended[s.y]));
    }
    if (loss < bestLoss) {
      bestLoss = loss;
      best = w;
    }
  }
  return {
    wM1: parseFloat(best.toFixed(2)),
    avgLogLoss: bestLoss / samples.length,
    n: samples.length
  };
}