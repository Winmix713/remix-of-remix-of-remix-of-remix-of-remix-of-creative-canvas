/**
 * TEST 1 — INDEPENDENCE / FORM
 *
 * QUESTION
 * --------
 * Do a team's recent results carry out-of-sample predictive information BEYOND
 * what the rating already encodes?
 *
 * HYPOTHESIS UNDER TEST
 * ---------------------
 * "The generator contains a form component in addition to team strength."
 *   COMPATIBLE   — the data shows a real OOS gain from adding form.
 *   INCOMPATIBLE — the data shows no meaningful OOS gain (CI tight around 0).
 *   INCONCLUSIVE — the interval is too wide, or the test could not run safely.
 *
 * INTERPRETATION LIMIT (spec §7.3)
 * --------------------------------
 * The rating is itself built from past matches. A null result therefore means
 * "no detectable out-of-sample SURPLUS signal under this baseline", never
 * "there is no form in the generator".
 *
 * Every predictive comparison is strict walk-forward: the model scoring match t
 * was fitted only on matches < t.
 */

import type { League, MatchRow, Season } from '../../types/winmix';
import { brier, logLoss, scoreAll } from '../backtest/metrics';
import type { ScoredPrediction } from '../backtest/metrics';
import {
  autocorrelation,
  ljungBoxTest,
  median,
  runsTest } from
'../stats';
import { BOOTSTRAP_ITERATIONS, BOOTSTRAP_SEED } from '../constants';
import { bootstrapMeanEffect, mean, permutationTest } from './permutation';
import {
  DEFAULT_RATING_CONFIG,
  buildFeatureRows,
  fitOrderedLogit,
  predictRow } from
'./ratings';
import type { FeatureKey, FeatureRow, RatingConfig } from './ratings';
import type {
  Conclusion,
  Effect,
  IndependenceReport,
  OosComparison,
  SeriesDiagnostics,
  TestResult } from
'./types';

export interface IndependenceOptions {
  /** Matches used to warm up before the first out-of-sample prediction. */
  minTrain: number;
  /** Refit cadence, in matches. Keeps the walk-forward cost bounded. */
  refitInterval: number;
  /** Maximum number of most-recent matches used for one fit. */
  trainWindow: number;
  ratingConfig: RatingConfig;
  bootstrapIterations: number;
  seed: number;
  /**
   * Smallest mean log-loss improvement considered practically meaningful.
   * Below this, an effect is noise-floor material regardless of its p-value.
   */
  meaningfulLogLoss: number;
}

export const DEFAULT_INDEPENDENCE_OPTIONS: IndependenceOptions = {
  minTrain: 200,
  refitInterval: 50,
  trainWindow: 1200,
  ratingConfig: DEFAULT_RATING_CONFIG,
  bootstrapIterations: BOOTSTRAP_ITERATIONS,
  seed: BOOTSTRAP_SEED,
  meaningfulLogLoss: 0.002
};

const MODEL_A_FEATURES: FeatureKey[] = ['ratingDiff'];
const MODEL_B_FEATURES: FeatureKey[] = ['ratingDiff', 'formDiff', 'gdFormDiff'];

/** Chronological match list of one league, seasons concatenated in order. */
export function collectLeagueMatches(
seasons: readonly Season[],
league: League)
: MatchRow[] {
  return seasons.
  filter((s) => s.league === league).
  slice().
  sort((a, b) => a.seasonIndex - b.seasonIndex).
  flatMap((s) => s.matches);
}

/* ---------------- sequence diagnostics ---------------- */

export function computeSeriesDiagnostics(
matches: readonly MatchRow[],
maxLag = 5)
: SeriesDiagnostics {
  const points = new Map<string, number[]>();
  const wins = new Map<string, boolean[]>();

  const push = (team: string, pts: number, won: boolean) => {
    const p = points.get(team) ?? [];
    p.push(pts);
    points.set(team, p);
    const w = wins.get(team) ?? [];
    w.push(won);
    wins.set(team, w);
  };

  for (const m of matches) {
    push(m.home_team, m.outcome === 'H' ? 3 : m.outcome === 'D' ? 1 : 0, m.outcome === 'H');
    push(m.away_team, m.outcome === 'A' ? 3 : m.outcome === 'D' ? 1 : 0, m.outcome === 'A');
  }

  const acfSums = new Array<number>(maxLag).fill(0);
  let teamsAnalysed = 0;
  let ljungRejects = 0;
  let runsRejects = 0;
  const runsZ: number[] = [];

  points.forEach((series, team) => {
    if (series.length < maxLag + 5) return;
    teamsAnalysed++;
    for (let lag = 1; lag <= maxLag; lag++) {
      acfSums[lag - 1] += autocorrelation(series, lag);
    }
    if (ljungBoxTest(series, maxLag).p < 0.05) ljungRejects++;
    const r = runsTest(wins.get(team) ?? []);
    runsZ.push(r.z);
    if (r.p < 0.05) runsRejects++;
  });

  return {
    teamsAnalysed,
    meanAutocorrelation: acfSums.map((s) => teamsAnalysed > 0 ? s / teamsAnalysed : 0),
    ljungBoxRejectShare: teamsAnalysed > 0 ? ljungRejects / teamsAnalysed : 0,
    runsRejectShare: teamsAnalysed > 0 ? runsRejects / teamsAnalysed : 0,
    medianRunsZ: median(runsZ)
  };
}

/* ---------------- walk-forward OOS comparison ---------------- */

export interface WalkForwardOutput {
  comparison: OosComparison;
  /** Per-match candidate − baseline differences, in chronological order. */
  brierDeltas: number[];
  logLossDeltas: number[];
}

export function walkForwardFormComparison(
rows: readonly FeatureRow[],
options: IndependenceOptions = DEFAULT_INDEPENDENCE_OPTIONS)
: WalkForwardOutput | null {
  const { minTrain, refitInterval, trainWindow, ratingConfig } = options;
  if (rows.length <= minTrain + 20) return null;

  const scoredA: ScoredPrediction[] = [];
  const scoredB: ScoredPrediction[] = [];
  const brierDeltas: number[] = [];
  const logLossDeltas: number[] = [];

  let modelA = fitOrderedLogit(rows.slice(0, minTrain), MODEL_A_FEATURES);
  let modelB = fitOrderedLogit(rows.slice(0, minTrain), MODEL_B_FEATURES);
  let firstTest = -1;
  let lastTest = -1;
  let lastTrainEnd = minTrain - 1;

  for (let t = minTrain; t < rows.length; t++) {
    if ((t - minTrain) % refitInterval === 0 && t > minTrain) {
      const from = Math.max(0, t - trainWindow);
      const train = rows.slice(from, t);
      modelA = fitOrderedLogit(train, MODEL_A_FEATURES);
      modelB = fitOrderedLogit(train, MODEL_B_FEATURES);
      lastTrainEnd = t - 1;
    }
    const row = rows[t];
    // Form features are only defined once both sides have a full window.
    if (row.priorMatches < ratingConfig.formWindow) continue;

    const pa = predictRow(modelA, row);
    const pb = predictRow(modelB, row);
    scoredA.push({ probs: pa, outcome: row.outcome });
    scoredB.push({ probs: pb, outcome: row.outcome });
    brierDeltas.push(brier(pb, row.outcome) - brier(pa, row.outcome));
    logLossDeltas.push(logLoss(pb, row.outcome) - logLoss(pa, row.outcome));

    if (firstTest < 0) firstTest = t;
    lastTest = t;
  }

  if (scoredA.length < 50) return null;

  const deltaBrier = bootstrapMeanEffect(
    brierDeltas,
    options.bootstrapIterations,
    options.seed
  );
  const deltaLogLoss = bootstrapMeanEffect(
    logLossDeltas,
    options.bootstrapIterations,
    options.seed
  );

  return {
    brierDeltas,
    logLossDeltas,
    comparison: {
      baselineLabel: 'Model A — rating only',
      candidateLabel: 'Model B — rating + previous 5 match form',
      baseline: scoreAll(scoredA),
      candidate: scoreAll(scoredB),
      deltaBrier,
      deltaLogLoss,
      leakage: {
        informationCutoff:
        'Match t is scored by a model fitted exclusively on matches < t; ' +
        'ratings and form features are built from matches < t only.',
        trainingRange: [0, lastTrainEnd],
        testRange: [firstTest, lastTest],
        leakageSafe: true
      }
    }
  };
}

/** Sign-flip permutation p-value for a paired per-match delta series. */
export function signFlipPValue(
deltas: readonly number[],
iterations: number,
seed: number)
: number {
  return permutationTest<readonly number[]>(
    deltas,
    (d) => mean(d),
    (d, rand) => d.map((v) => rand() < 0.5 ? -v : v),
    iterations,
    seed
  ).pValue;
}

/* ---------------- conclusion contract ---------------- */

export function concludeFormEffect(
deltaLogLoss: Effect,
threshold: number)
: { conclusion: Conclusion; rationale: string } {
  // Negative delta = the form model predicts better out-of-sample.
  if (deltaLogLoss.ci95High < -threshold) {
    return {
      conclusion: 'COMPATIBLE',
      rationale:
      'Adding previous-5 form improves out-of-sample log-loss by more than the ' +
      'practical threshold, with the whole 95% interval on the improving side.'
    };
  }
  if (deltaLogLoss.ci95Low > -threshold && deltaLogLoss.ci95High < threshold) {
    return {
      conclusion: 'INCOMPATIBLE',
      rationale:
      'The 95% interval of the out-of-sample log-loss change is contained within ' +
      'the practical-irrelevance band, so no surplus form signal is detectable ' +
      'beyond the rating under this baseline.'
    };
  }
  return {
    conclusion: 'INCONCLUSIVE',
    rationale:
    'The 95% interval spans both meaningful and negligible effects; the available ' +
    'sample does not separate them.'
  };
}

/* ---------------- entry point ---------------- */

export function runIndependenceTest(
seasons: readonly Season[],
league: League,
options: IndependenceOptions = DEFAULT_INDEPENDENCE_OPTIONS)
: IndependenceReport | null {
  const matches = collectLeagueMatches(seasons, league);
  const seasonCount = seasons.filter((s) => s.league === league).length;
  if (matches.length === 0) return null;

  const rows = buildFeatureRows(matches, options.ratingConfig);
  const series = computeSeriesDiagnostics(matches);
  const wf = walkForwardFormComparison(rows, options);

  const dataset = {
    league,
    seasonCount,
    matchCount: matches.length,
    sampleSize: wf ? wf.comparison.candidate.n : 0,
    seed: options.seed
  };

  if (!wf) {
    const result: TestResult = {
      conclusion: 'INCONCLUSIVE',
      effectLabel: 'OOS ΔLogLoss (rating+form − rating-only)',
      effect: { estimate: 0, ci95Low: 0, ci95High: 0 },
      sampleSize: 0,
      leakageSafe: false,
      rationale:
      'Too few matches for a leakage-safe walk-forward comparison; ' +
      'no MODEL IMPLICATIONS decision may be derived from this run.'
    };
    return {
      dataset,
      series,
      comparison: {
        baselineLabel: 'Model A — rating only',
        candidateLabel: 'Model B — rating + previous 5 match form',
        baseline: { brier: 0, logLoss: 0, ece: 0, n: 0 },
        candidate: { brier: 0, logLoss: 0, ece: 0, n: 0 },
        deltaBrier: { estimate: 0, ci95Low: 0, ci95High: 0 },
        deltaLogLoss: { estimate: 0, ci95Low: 0, ci95High: 0 },
        leakage: {
          informationCutoff: 'not run',
          trainingRange: [0, 0],
          testRange: [0, 0],
          leakageSafe: false
        }
      },
      result,
      implication: {
        component: 'Form (previous 5 matches)',
        currentSetting: 'ACTIVE — form features present in the WinMix design vector',
        suiteResult: 'INCONCLUSIVE',
        effect: { estimate: 0, ci95Low: 0, ci95High: 0 },
        suggestedState: 'INCONCLUSIVE',
        automaticConfigurationChange: false
      }
    };
  }

  const { conclusion, rationale } = concludeFormEffect(
    wf.comparison.deltaLogLoss,
    options.meaningfulLogLoss
  );
  const rawPValue = signFlipPValue(
    wf.logLossDeltas,
    options.bootstrapIterations,
    options.seed
  );

  const result: TestResult = {
    conclusion,
    effectLabel: 'OOS ΔLogLoss (rating+form − rating-only), negative = form helps',
    effect: wf.comparison.deltaLogLoss,
    rawPValue,
    oosDeltaBrier: wf.comparison.deltaBrier.estimate,
    oosDeltaLogLoss: wf.comparison.deltaLogLoss.estimate,
    sampleSize: wf.comparison.candidate.n,
    leakageSafe: true,
    rationale
  };

  return {
    dataset,
    series,
    comparison: wf.comparison,
    result,
    implication: {
      component: 'Form (previous 5 matches)',
      currentSetting: 'ACTIVE — form features present in the WinMix design vector',
      suiteResult: conclusion,
      effect: wf.comparison.deltaLogLoss,
      oosDeltaBrier: wf.comparison.deltaBrier.estimate,
      oosDeltaLogLoss: wf.comparison.deltaLogLoss.estimate,
      suggestedState:
      conclusion === 'COMPATIBLE' ?
      'KEEP' :
      conclusion === 'INCOMPATIBLE' ?
      'REMOVE' :
      'INCONCLUSIVE',
      automaticConfigurationChange: false
    }
  };
}
