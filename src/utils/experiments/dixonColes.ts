/**
 * Dixon-Coles rho — EXPERIMENT, feature flagged, off by default.
 *
 * P2 HYPOTHESIS
 * -------------
 * The Dixon-Coles correction exists because REAL football produces more 0-0 /
 * 1-1 / 1-0 results than independent Poisson predicts. A virtual league's
 * match engine may well be an independent Poisson process, in which case
 * fitting rho is literally fitting noise and will hurt out-of-sample.
 *
 * So this module never activates itself. It fits rho on strictly prior data,
 * reports the log-loss it WOULD have achieved, and the caller decides — based
 * on a bootstrap interval that must exclude zero — whether it earns the right
 * to influence anything.
 */

import { adaptiveMaxGoals, poissonPmfArray } from '../stats';
import type { DixonColesFit, Outcome, Probs } from '../../types/winmix';

/** Grid searched for rho. Standard identifiability band. */
const RHO_MIN = -0.2;
const RHO_MAX = 0.2;
const RHO_STEP = 0.02;

/** The classic tau adjustment on the four low-score cells. */
export function dcTau(
gh: number,
ga: number,
lambdaH: number,
lambdaA: number,
rho: number)
: number {
  if (gh === 0 && ga === 0) return Math.max(1e-6, 1 - lambdaH * lambdaA * rho);
  if (gh === 0 && ga === 1) return Math.max(1e-6, 1 + lambdaH * rho);
  if (gh === 1 && ga === 0) return Math.max(1e-6, 1 + lambdaA * rho);
  if (gh === 1 && ga === 1) return Math.max(1e-6, 1 - rho);
  return 1;
}

/** Outcome probabilities from a rho-adjusted Poisson grid. */
export function dcOutcomeProbs(
lambdaH: number,
lambdaA: number,
rho: number)
: Probs {
  const maxGoals = Math.max(adaptiveMaxGoals(lambdaH), adaptiveMaxGoals(lambdaA));
  const pmfH = poissonPmfArray(lambdaH, maxGoals);
  const pmfA = poissonPmfArray(lambdaA, maxGoals);
  let home = 0;
  let draw = 0;
  let away = 0;
  for (let gh = 0; gh <= maxGoals; gh++) {
    for (let ga = 0; ga <= maxGoals; ga++) {
      const p = pmfH[gh] * pmfA[ga] * dcTau(gh, ga, lambdaH, lambdaA, rho);
      if (gh > ga) home += p;else
      if (gh === ga) draw += p;else
      away += p;
    }
  }
  const s = home + draw + away;
  return { home: home / s, draw: draw / s, away: away / s };
}

export interface DcSample {
  lambdaH: number;
  lambdaA: number;
  outcome: Outcome;
}

function lossFor(samples: readonly DcSample[], rho: number): number {
  let loss = 0;
  for (const s of samples) {
    const p = dcOutcomeProbs(s.lambdaH, s.lambdaA, rho);
    const actual = s.outcome === 'H' ? p.home : s.outcome === 'D' ? p.draw : p.away;
    loss += -Math.log(Math.max(1e-6, actual));
  }
  return loss / samples.length;
}

/**
 * Grid-searches rho on prior data. `null` when the sample is too small.
 *
 * `improvement` is the log-loss the independent Poisson (rho = 0) gives minus
 * the log-loss the fitted rho gives. Positive means rho helped IN SAMPLE — which
 * is exactly the claim that still has to survive a bootstrap interval.
 */
export function fitRho(
samples: readonly DcSample[],
minSample: number)
: DixonColesFit | null {
  if (samples.length < minSample) return null;
  const baseLogLoss = lossFor(samples, 0);
  let bestRho = 0;
  let bestLoss = baseLogLoss;
  for (let rho = RHO_MIN; rho <= RHO_MAX + 1e-9; rho += RHO_STEP) {
    const loss = lossFor(samples, rho);
    if (loss < bestLoss - 1e-12) {
      bestLoss = loss;
      bestRho = rho;
    }
  }
  return {
    rho: parseFloat(bestRho.toFixed(3)),
    n: samples.length,
    avgLogLoss: bestLoss,
    baseLogLoss,
    improvement: baseLogLoss - bestLoss
  };
}