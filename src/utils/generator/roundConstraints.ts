/**
 * ROUND-LEVEL CONSTRAINT & REGIME-SHIFT ANALYSIS (read-only)
 *
 * Hypotheses under test, per league, never mixed:
 *  R1 BTTS band     — the per-round BTTS count is MORE concentrated than
 *                     independent matches would produce (e.g. "3–5 of 8").
 *  R2 Upset ceiling — the per-round upset count is more concentrated than
 *                     independent matches would produce ("max 1–2").
 *  R3 H2H break     — when a pair with a strong BTTS history fails to produce
 *                     BTTS, the REST of that round deviates in BTTS rate.
 *
 * Null model: labels shuffled inside the season (preserves the season rate,
 * destroys any round grouping). Seeded with BOOTSTRAP_SEED. Nothing here
 * modifies the prediction engine or any configuration.
 */

import type { League, MatchRow, Season } from '../../types/winmix';
import { mulberry32 } from '../bootstrap';
import { BOOTSTRAP_ITERATIONS, BOOTSTRAP_SEED } from '../constants';
import { mean } from './permutation';
import { DEFAULT_RATING_CONFIG, buildFeatureRows } from './ratings';
import type { Conclusion, TestResult } from './types';

export const ROUND_SIZE = 8;

export interface RoundOptions {
  roundSize: number;
  iterations: number;
  seed: number;
  alpha: number;
  /** Min |ratingDiff| for a match to have a defined favourite. */
  minFavouriteGap: number;
  /** Min prior meetings for an H2H BTTS pattern. */
  h2hMinMeetings: number;
  /** Min prior BTTS share for a "nearly always BTTS" pair. */
  h2hMinBttsRate: number;
  /** Rest-of-round BTTS-rate difference considered practically meaningful. */
  meaningfulRateDiff: number;
}

export const DEFAULT_ROUND_OPTIONS: RoundOptions = {
  roundSize: ROUND_SIZE,
  iterations: BOOTSTRAP_ITERATIONS,
  seed: BOOTSTRAP_SEED,
  alpha: 0.05,
  minFavouriteGap: 0.05,
  h2hMinMeetings: 5,
  h2hMinBttsRate: 0.8,
  meaningfulRateDiff: 0.05
};

/** One flag per match, grouped into seasons and rounds. null = not eligible. */
type Flags = (boolean | null)[][];

export interface CountDistribution {
  /** counts[k] = number of rounds with k flagged matches. */
  observed: number[];
  /** Expected under the shuffled null (mean over replicates). */
  expected: number[];
}

export interface DispersionResult extends TestResult {
  rounds: number;
  observedVariance: number;
  nullVariance: number;
  /** Share of rounds whose count lies inside `band`. */
  bandShareObserved: number;
  bandShareNull: number;
  band: [number, number];
  distribution: CountDistribution;
}

export interface RegimeResult extends TestResult {
  breakRounds: number;
  normalRounds: number;
  restRateBreak: number;
  restRateNormal: number;
}

export interface RoundConstraintReport {
  league: League;
  seasonCount: number;
  matchCount: number;
  seed: number;
  bttsBand: DispersionResult;
  upsetCeiling: DispersionResult;
  h2hBreak: RegimeResult;
}

/* ---------------- helpers ---------------- */

function seasonsOf(seasons: readonly Season[], league: League): Season[] {
  return seasons.filter((s) => s.league === league).slice().sort((a, b) => a.seasonIndex - b.seasonIndex);
}

function variance(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((a, v) => a + (v - m) ** 2, 0) / (xs.length - 1);
}

/** Per-round counts; only complete rounds whose every match is eligible count. */
function roundCounts(flags: Flags, size: number): number[] {
  const out: number[] = [];
  for (const season of flags) {
    for (let start = 0; start + size <= season.length; start += size) {
      let c = 0;
      let ok = true;
      for (let i = start; i < start + size; i++) {
        const f = season[i];
        if (f === null) { ok = false; break; }
        if (f) c++;
      }
      if (ok) out.push(c);
    }
  }
  return out;
}

function shuffleWithinSeason(flags: Flags, rand: () => number): Flags {
  return flags.map((season) => {
    const idx: number[] = [];
    const vals: boolean[] = [];
    season.forEach((f, i) => { if (f !== null) { idx.push(i); vals.push(f); } });
    for (let i = vals.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [vals[i], vals[j]] = [vals[j], vals[i]];
    }
    const copy = season.slice();
    idx.forEach((pos, k) => { copy[pos] = vals[k]; });
    return copy;
  });
}

function histogram(counts: readonly number[], size: number): number[] {
  const h = new Array<number>(size + 1).fill(0);
  for (const c of counts) h[c]++;
  return h;
}

function quantileSorted(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/* ---------------- R1 / R2: dispersion test ---------------- */

/**
 * Lower-tail test: is the per-round count variance SMALLER than under the
 * within-season shuffle? Effect = observed / null variance ratio
 * (< 1 = concentrated). Interval: ratio of observed variance to the
 * 2.5–97.5% null variance quantiles.
 */
export function dispersionTest(
  flags: Flags,
  band: [number, number],
  label: string,
  opt: RoundOptions = DEFAULT_ROUND_OPTIONS
): DispersionResult {
  const size = opt.roundSize;
  const obsCounts = roundCounts(flags, size);
  const obsVar = variance(obsCounts);
  const inBand = (cs: number[]) => cs.length === 0 ? 0 : cs.filter((c) => c >= band[0] && c <= band[1]).length / cs.length;

  const rand = mulberry32(opt.seed);
  const nullVars: number[] = [];
  const nullBand: number[] = [];
  const expected = new Array<number>(size + 1).fill(0);
  let atMost = 0;
  for (let it = 0; it < opt.iterations; it++) {
    const cs = roundCounts(shuffleWithinSeason(flags, rand), size);
    const v = variance(cs);
    nullVars.push(v);
    nullBand.push(inBand(cs));
    histogram(cs, size).forEach((n, k) => { expected[k] += n / opt.iterations; });
    if (v <= obsVar + 1e-12) atMost++;
  }
  const pValue = (atMost + 1) / (opt.iterations + 1);
  const nullVar = mean(nullVars);
  const sorted = nullVars.slice().sort((a, b) => a - b);
  const qLo = quantileSorted(sorted, 0.025);
  const qHi = quantileSorted(sorted, 0.975);
  const ratio = nullVar > 0 ? obsVar / nullVar : NaN;
  const effect = {
    estimate: ratio,
    ci95Low: qHi > 0 ? obsVar / qHi : NaN,
    ci95High: qLo > 0 ? obsVar / qLo : NaN
  };

  let conclusion: Conclusion;
  let rationale: string;
  if (obsCounts.length < 30 || !Number.isFinite(ratio)) {
    conclusion = 'INCONCLUSIVE';
    rationale = 'Too few complete rounds for a stable dispersion estimate.';
  } else if (pValue < opt.alpha && ratio < 1) {
    conclusion = 'COMPATIBLE';
    rationale = 'Round counts are significantly more concentrated than independent matches would give.';
  } else if (effect.ci95Low >= 0.9) {
    conclusion = 'INCOMPATIBLE';
    rationale = 'Round counts spread as widely as independent matches; no round-level ceiling detected.';
  } else {
    conclusion = 'INCONCLUSIVE';
    rationale = 'Concentration is not significant, but the interval cannot exclude a modest effect.';
  }

  return {
    conclusion,
    effectLabel: `${label}: observed / independent variance ratio (<1 = concentrated)`,
    effect,
    rawPValue: pValue,
    sampleSize: obsCounts.length,
    leakageSafe: true,
    rationale,
    rounds: obsCounts.length,
    observedVariance: obsVar,
    nullVariance: nullVar,
    bandShareObserved: inBand(obsCounts),
    bandShareNull: mean(nullBand),
    band,
    distribution: { observed: histogram(obsCounts, size), expected }
  };
}

/* ---------------- flag builders ---------------- */

export function bttsFlags(seasons: readonly Season[]): Flags {
  return seasons.map((s) => s.matches.map((m) => m.btts));
}

/**
 * Upset = the pre-match rating favourite loses (draws are not upsets).
 * Ratings are walk-forward across the whole league history (no leakage).
 * Matches without a clear favourite are ineligible (null).
 */
export function upsetFlags(seasons: readonly Season[], opt: RoundOptions = DEFAULT_ROUND_OPTIONS): Flags {
  const all: MatchRow[] = seasons.flatMap((s) => s.matches);
  const rows = buildFeatureRows(all, DEFAULT_RATING_CONFIG);
  const flags: Flags = [];
  let k = 0;
  for (const s of seasons) {
    const f: (boolean | null)[] = [];
    for (let i = 0; i < s.matches.length; i++, k++) {
      const r = rows[k];
      if (!r || Math.abs(r.ratingDiff) < opt.minFavouriteGap || r.priorMatches < 5) { f.push(null); continue; }
      f.push(r.ratingDiff > 0 ? r.outcome === 'A' : r.outcome === 'H');
    }
    flags.push(f);
  }
  return flags;
}

/* ---------------- R3: H2H BTTS break ---------------- */

interface RoundRest { isBreak: boolean; restBtts: number; restN: number }

/** Walk-forward: a pair's pattern uses only meetings BEFORE the current match. */
export function collectRoundRests(seasons: readonly Season[], opt: RoundOptions = DEFAULT_ROUND_OPTIONS): RoundRest[] {
  const history = new Map<string, { n: number; btts: number }>();
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const out: RoundRest[] = [];
  for (const s of seasons) {
    for (let start = 0; start + opt.roundSize <= s.matches.length; start += opt.roundSize) {
      const round = s.matches.slice(start, start + opt.roundSize);
      const breaks = round.map((m) => {
        const h = history.get(key(m.home_team, m.away_team));
        return !!h && h.n >= opt.h2hMinMeetings && h.btts / h.n >= opt.h2hMinBttsRate && !m.btts;
      });
      const isBreak = breaks.some(Boolean);
      let restBtts = 0;
      let restN = 0;
      round.forEach((m, i) => { if (!breaks[i]) { restN++; if (m.btts) restBtts++; } });
      out.push({ isBreak, restBtts, restN });
      for (const m of round) {
        const k = key(m.home_team, m.away_team);
        const h = history.get(k) ?? { n: 0, btts: 0 };
        history.set(k, { n: h.n + 1, btts: h.btts + (m.btts ? 1 : 0) });
      }
    }
  }
  return out;
}

function rate(rs: readonly RoundRest[]): number {
  let b = 0, n = 0;
  for (const r of rs) { b += r.restBtts; n += r.restN; }
  return n > 0 ? b / n : NaN;
}

export function h2hBreakTest(seasons: readonly Season[], opt: RoundOptions = DEFAULT_ROUND_OPTIONS): RegimeResult {
  const rests = collectRoundRests(seasons, opt);
  const diffOf = (rs: RoundRest[]) => rate(rs.filter((r) => r.isBreak)) - rate(rs.filter((r) => !r.isBreak));
  const breakN = rests.filter((r) => r.isBreak).length;
  const observed = diffOf(rests);

  const rand = mulberry32(opt.seed);
  const labels = rests.map((r) => r.isBreak);
  const nulls: number[] = [];
  let extreme = 0;
  for (let it = 0; it < opt.iterations; it++) {
    const l = labels.slice();
    for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
    const v = diffOf(rests.map((r, i) => ({ ...r, isBreak: l[i] })));
    nulls.push(v);
    if (Math.abs(v) >= Math.abs(observed) - 1e-12) extreme++;
  }
  const pValue = (extreme + 1) / (opt.iterations + 1);

  // Bootstrap CI over rounds, stratified by break label.
  const brk = rests.filter((r) => r.isBreak);
  const nrm = rests.filter((r) => !r.isBreak);
  const reps: number[] = [];
  const bRand = mulberry32(opt.seed + 1);
  const draw = (arr: RoundRest[]) => arr.map(() => arr[Math.floor(bRand() * arr.length)]);
  if (brk.length > 0 && nrm.length > 0) {
    for (let it = 0; it < opt.iterations; it++) reps.push(rate(draw(brk)) - rate(draw(nrm)));
  }
  reps.sort((a, b) => a - b);
  const effect = {
    estimate: observed,
    ci95Low: reps.length ? quantileSorted(reps, 0.025) : NaN,
    ci95High: reps.length ? quantileSorted(reps, 0.975) : NaN
  };

  let conclusion: Conclusion;
  let rationale: string;
  if (breakN < 20 || !Number.isFinite(observed)) {
    conclusion = 'INCONCLUSIVE';
    rationale = 'Too few H2H BTTS-break rounds to judge.';
  } else if (pValue < opt.alpha && Math.abs(observed) >= opt.meaningfulRateDiff) {
    conclusion = 'COMPATIBLE';
    rationale = 'Rounds with an H2H BTTS break show a different BTTS rate in their other matches.';
  } else if (effect.ci95Low > -opt.meaningfulRateDiff && effect.ci95High < opt.meaningfulRateDiff) {
    conclusion = 'INCOMPATIBLE';
    rationale = 'The rest of the round behaves the same whether or not a strong H2H BTTS pattern breaks.';
  } else {
    conclusion = 'INCONCLUSIVE';
    rationale = 'Difference not significant but the interval is too wide to exclude a meaningful effect.';
  }

  return {
    conclusion,
    effectLabel: 'Rest-of-round BTTS rate: break rounds − normal rounds',
    effect,
    rawPValue: pValue,
    sampleSize: rests.length,
    leakageSafe: true,
    rationale,
    breakRounds: breakN,
    normalRounds: rests.length - breakN,
    restRateBreak: rate(brk),
    restRateNormal: rate(nrm)
  };
}

/* ---------------- multiple testing + entry point ---------------- */

/** Benjamini–Hochberg adjusted p-values, same order as input. */
export function benjaminiHochberg(ps: readonly number[]): number[] {
  const n = ps.length;
  const order = ps.map((p, i) => [p, i] as const).sort((a, b) => a[0] - b[0]);
  const adj = new Array<number>(n);
  let prev = 1;
  for (let r = n - 1; r >= 0; r--) {
    const [p, i] = order[r];
    prev = Math.min(prev, (p * n) / (r + 1));
    adj[i] = prev;
  }
  return adj;
}

export function runRoundConstraintAnalysis(
  allSeasons: readonly Season[],
  league: League,
  opt: RoundOptions = DEFAULT_ROUND_OPTIONS
): RoundConstraintReport | null {
  const seasons = seasonsOf(allSeasons, league);
  if (seasons.length === 0) return null;
  const bttsBand = dispersionTest(bttsFlags(seasons), [3, 5], 'BTTS per round', opt);
  const upsetCeiling = dispersionTest(upsetFlags(seasons, opt), [0, 2], 'Upsets per round', opt);
  const h2hBreak = h2hBreakTest(seasons, opt);

  const tests = [bttsBand, upsetCeiling, h2hBreak];
  const adj = benjaminiHochberg(tests.map((t) => t.rawPValue ?? 1));
  tests.forEach((t, i) => {
    t.adjustedPValue = adj[i];
    if (t.conclusion === 'COMPATIBLE' && adj[i] >= opt.alpha) {
      t.conclusion = 'INCONCLUSIVE';
      t.rationale += ' Not significant after BH-FDR correction.';
    }
  });

  return {
    league,
    seasonCount: seasons.length,
    matchCount: seasons.reduce((a, s) => a + s.matches.length, 0),
    seed: opt.seed,
    bttsBand,
    upsetCeiling,
    h2hBreak
  };
}
