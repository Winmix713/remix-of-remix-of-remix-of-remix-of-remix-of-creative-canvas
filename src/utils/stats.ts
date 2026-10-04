import { CALIB_MIN_SAMPLE, VENUE_DECAY_LAMBDA } from './constants';
import type {
  MatchRow,
  Outcome,
  Probs,
  SignTestResult,
  TemperatureFit } from
'../types/winmix';

/** Poisson PMF via the P(k) = P(k-1) * lambda / k recurrence. */
export function poissonPmfArray(lambda: number, maxK: number): number[] {
  const arr = new Array<number>(maxK + 1);
  arr[0] = Math.exp(-lambda);
  for (let k = 1; k <= maxK; k++) arr[k] = arr[k - 1] * lambda / k;
  return arr;
}

export function adaptiveMaxGoals(lambda: number): number {
  return Math.min(15, Math.max(7, Math.ceil(lambda + 5 * Math.sqrt(Math.max(0.01, lambda)))));
}

/**
 * Exponential decay (recency weighting) + shrinkage toward the league mean.
 *
 * Weight formula: `w_t = lambda^(n - 1 - t)` — the newest observation carries
 * weight 1. Zero-length and uniform cold-start inputs return the league mean
 * instead of dividing by zero, so the result is always finite.
 */
export function decayedShrunkAvg(
values: number[],
leagueAvg: number,
lambda: number,
k: number)
: number {
  const n = values.length;
  if (n === 0) return leagueAvg;
  let weightedSum = 0;
  let weightSum = 0;
  values.forEach((v, idx) => {
    const w = Math.pow(lambda, n - 1 - idx);
    weightedSum += v * w;
    weightSum += w;
  });
  const rawAvg = weightSum > 0 ? weightedSum / weightSum : leagueAvg;
  const shrunk = (n * rawAvg + k * leagueAvg) / (n + k);
  return Number.isFinite(shrunk) ? shrunk : leagueAvg;
}

/**
 * Venue-specific attack rate. The decay is a NAMED PARAMETER (defaulting to
 * {@link VENUE_DECAY_LAMBDA}) so the adaptation speed lives in `constants.ts`
 * and can be swept in an ablation without touching this function.
 */
export function venueAttack(
venueMatches: MatchRow[],
isHome: boolean,
leagueAvg: number,
lambda: number = VENUE_DECAY_LAMBDA,
k = 5)
: number {
  const scored = venueMatches.map((m) => isHome ? m.home_score : m.away_score);
  return decayedShrunkAvg(scored, leagueAvg, lambda, k);
}

export function venueDefense(
venueMatches: MatchRow[],
isHome: boolean,
leagueAvg: number,
lambda: number = VENUE_DECAY_LAMBDA,
k = 5)
: number {
  const conceded = venueMatches.map((m) => isHome ? m.away_score : m.home_score);
  return decayedShrunkAvg(conceded, leagueAvg, lambda, k);
}

/** Temperature scaling — the exact same distribution is fitted and applied. */
export function calibrateWithT(raw: Probs, T: number): Probs {
  const lH = Math.log(Math.max(1e-6, raw.home)) / T;
  const lD = Math.log(Math.max(1e-6, raw.draw)) / T;
  const lA = Math.log(Math.max(1e-6, raw.away)) / T;
  const s = Math.exp(lH) + Math.exp(lD) + Math.exp(lA);
  return { home: Math.exp(lH) / s, draw: Math.exp(lD) / s, away: Math.exp(lA) / s };
}

interface EceBin {
  min: number;
  max: number;
  predicted: number[];
  actual: number[];
}

function makeBins(): EceBin[] {
  return [
  { min: 0.0, max: 0.2, predicted: [], actual: [] },
  { min: 0.2, max: 0.4, predicted: [], actual: [] },
  { min: 0.4, max: 0.6, predicted: [], actual: [] },
  { min: 0.6, max: 0.8, predicted: [], actual: [] },
  { min: 0.8, max: 1.0, predicted: [], actual: [] }];

}

function fillBins<T>(
list: T[],
getProbs: (item: T) => Probs,
getOutcome: (item: T) => Outcome)
: {bins: EceBin[];total: number;} {
  const bins = makeBins();
  let total = 0;
  const keys: Array<keyof Probs> = ['home', 'draw', 'away'];
  list.forEach((item) => {
    const p = getProbs(item);
    const outcome = getOutcome(item);
    keys.forEach((out) => {
      const prob = p[out];
      const act =
      out === 'home' && outcome === 'H' ||
      out === 'draw' && outcome === 'D' ||
      out === 'away' && outcome === 'A' ?
      1 :
      0;
      const b = bins.find((bin) => prob >= bin.min && prob < bin.max) ?? bins[bins.length - 1];
      b.predicted.push(prob);
      b.actual.push(act);
      total++;
    });
  });
  return { bins, total };
}

export function computeECEGeneric<T>(
list: T[],
getProbs: (item: T) => Probs,
getOutcome: (item: T) => Outcome)
: number {
  const { bins, total } = fillBins(list, getProbs, getOutcome);
  if (total === 0) return 0;
  let ece = 0;
  bins.forEach((b) => {
    if (b.predicted.length === 0) return;
    const avgPred = b.predicted.reduce((a, c) => a + c, 0) / b.predicted.length;
    const avgAct = b.actual.reduce((a, c) => a + c, 0) / b.actual.length;
    ece += b.predicted.length / total * Math.abs(avgPred - avgAct);
  });
  return ece;
}

export function computeECEForSlice(slice: MatchRow[]): number {
  return computeECEGeneric(
    slice.filter((m) => m.pipeline),
    (m) => m.pipeline!.calibrated,
    (m) => m.outcome
  );
}

export interface ReliabilityPoint {
  label: string;
  actual: number;
  perfect: number;
}

/** Reliability diagram data over the calibrated distribution. */
export function computeReliability(matches: MatchRow[]): ReliabilityPoint[] {
  const labels = ['0–20%', '20–40%', '40–60%', '60–80%', '80–100%'];
  const { bins } = fillBins(
    matches.filter((m) => m.pipeline),
    (m) => m.pipeline!.calibrated,
    (m) => m.outcome
  );
  return bins.map((b, idx) => ({
    label: labels[idx],
    actual: b.actual.length ?
    b.actual.reduce((a, c) => a + c, 0) / b.actual.length * 100 :
    0,
    perfect: b.predicted.length ?
    b.predicted.reduce((a, c) => a + c, 0) / b.predicted.length * 100 :
    (b.min + b.max) * 50
  }));
}

export interface CalibSample {
  ensRaw: Probs;
  outcome: Outcome;
}

/** Grid-search temperature fit on strictly prior data. */
export function fitTemperature(sample: CalibSample[]): TemperatureFit | null {
  if (!sample || sample.length < CALIB_MIN_SAMPLE) return null;
  let bestT = 1.0;
  let minLoss = Infinity;
  for (let t = 0.7; t <= 1.8 + 1e-9; t += 0.05) {
    let loss = 0;
    for (const s of sample) {
      const c = calibrateWithT(s.ensRaw, t);
      const p = s.outcome === 'H' ? c.home : s.outcome === 'D' ? c.draw : c.away;
      loss += -Math.log(Math.max(1e-6, p));
    }
    if (loss < minLoss) {
      minLoss = loss;
      bestT = t;
    }
  }
  bestT = parseFloat(bestT.toFixed(2));
  const ece = computeECEGeneric(
    sample,
    (s) => calibrateWithT(s.ensRaw, bestT),
    (s) => s.outcome
  );
  return { T: bestT, ece, n: sample.length, avgLogLoss: minLoss / sample.length };
}

export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  let p =
  d *
  t * (
  0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (z > 0) p = 1 - p;
  return p;
}

/** Sign test on paired per-match Brier deltas (ensemble vs B1). */
export function pairedSignTest(slice: MatchRow[]): SignTestResult {
  let wins = 0;
  let losses = 0;
  let ties = 0;
  slice.forEach((m) => {
    if (!m.pipeline) return;
    const d = m.pipeline.reconciliation.brierEns - m.pipeline.reconciliation.brierB1;
    if (d < -1e-9) wins++;else
    if (d > 1e-9) losses++;else
    ties++;
  });
  const n = wins + losses;
  if (n === 0) {
    return { wins, losses, ties, n: 0, p: 1, z: 0, significant: false, direction: 'none' };
  }
  const mean = n / 2;
  const sd = Math.sqrt(n * 0.25);
  const cc = 0.5;
  const z = sd > 0 ? (Math.abs(wins - mean) - cc) / sd : 0;
  const pTwoSided = 2 * (1 - normalCdf(Math.abs(z)));
  return {
    wins,
    losses,
    ties,
    n,
    p: Math.max(0, Math.min(1, pTwoSided)),
    z,
    significant: pTwoSided < 0.05,
    direction: wins > losses ? 'ensemble_better' : losses > wins ? 'b1_better' : 'none'
  };
}
/* ---------------- Sequence diagnostics (Generator Structure Suite) ----------------
 * Added here rather than in src/utils/generator/ so that no statistical
 * primitive is ever duplicated: the suite imports these, it does not re-derive
 * chi-square, Ljung–Box or the runs test locally.
 */

/** Regularised lower incomplete gamma P(s, x), series + continued fraction. */
function lowerGammaP(s: number, x: number): number {
  if (x <= 0) return 0;
  const lnGammaS = logGamma(s);
  if (x < s + 1) {
    let term = 1 / s;
    let sum = term;
    for (let n = 1; n < 300; n++) {
      term *= x / (s + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-14) break;
    }
    return sum * Math.exp(-x + s * Math.log(x) - lnGammaS);
  }
  // Continued fraction for Q(s, x), then P = 1 - Q.
  let b = x + 1 - s;
  let c = 1e300;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 300; i++) {
    const an = -i * (i - s);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  const q = Math.exp(-x + s * Math.log(x) - lnGammaS) * h;
  return 1 - q;
}

/** Lanczos log-gamma. */
export function logGamma(z: number): number {
  const g = [
  676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012,
  9.9843695780195716e-6, 1.5056327351493116e-7];

  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  const zz = z - 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < g.length; i++) x += g[i] / (zz + i + 1);
  const t = zz + g.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (zz + 0.5) * Math.log(t) - t + Math.log(x);
}

/** Upper-tail probability of a chi-square statistic with `df` degrees of freedom. */
export function chiSquareSf(stat: number, df: number): number {
  if (!(stat > 0) || df <= 0) return 1;
  return Math.max(0, Math.min(1, 1 - lowerGammaP(df / 2, stat / 2)));
}

/** Sample autocorrelation of a series at a given lag (mean-centred, biased n-divisor). */
export function autocorrelation(series: readonly number[], lag: number): number {
  const n = series.length;
  if (lag <= 0 || n <= lag + 1) return 0;
  let m = 0;
  for (const v of series) m += v;
  m /= n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const d = series[i] - m;
    den += d * d;
    if (i >= lag) num += d * (series[i - lag] - m);
  }
  return den > 1e-12 ? num / den : 0;
}

export interface LjungBoxResult {
  statistic: number;
  df: number;
  p: number;
  n: number;
  /** Autocorrelations used, lag 1..maxLag. */
  acf: number[];
}

/** Ljung–Box portmanteau test for autocorrelation up to `maxLag`. */
export function ljungBoxTest(series: readonly number[], maxLag = 5): LjungBoxResult {
  const n = series.length;
  const usableLags = Math.min(maxLag, Math.max(0, n - 2));
  const acf: number[] = [];
  let stat = 0;
  for (let k = 1; k <= usableLags; k++) {
    const r = autocorrelation(series, k);
    acf.push(r);
    stat += r * r / (n - k);
  }
  stat *= n * (n + 2);
  const df = usableLags;
  return { statistic: stat, df, p: df > 0 ? chiSquareSf(stat, df) : 1, n, acf };
}

export interface RunsTestResult {
  runs: number;
  expectedRuns: number;
  z: number;
  p: number;
  n: number;
}

/**
 * Wald–Wolfowitz runs test on a binary sequence (e.g. win vs not-win).
 * A negative z means fewer runs than chance — streaky. Positive means
 * alternating. Returns z = 0, p = 1 when the sequence is degenerate.
 */
export function runsTest(sequence: readonly boolean[]): RunsTestResult {
  const n = sequence.length;
  let n1 = 0;
  for (const v of sequence) if (v) n1++;
  const n2 = n - n1;
  if (n1 === 0 || n2 === 0 || n < 3) {
    return { runs: n > 0 ? 1 : 0, expectedRuns: 1, z: 0, p: 1, n };
  }
  let runs = 1;
  for (let i = 1; i < n; i++) if (sequence[i] !== sequence[i - 1]) runs++;
  const expected = 2 * n1 * n2 / n + 1;
  const variance =
  2 * n1 * n2 * (2 * n1 * n2 - n) / (n * n * (n - 1));
  const sd = Math.sqrt(Math.max(variance, 1e-12));
  const z = (runs - expected) / sd;
  const p = Math.max(0, Math.min(1, 2 * (1 - normalCdf(Math.abs(z)))));
  return { runs, expectedRuns: expected, z, p, n };
}

/** Median of a numeric list (no mutation of the input). */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
