/**
 * Generator Structure Suite — shared type contract.
 *
 * READ-ONLY MODULE FAMILY. Nothing under src/utils/generator/ may write state,
 * touch the Prediction Engine, alter ratings, gates, ranking, calibration or
 * feature flags. It consumes Season[] / MatchRow[] and emits a report.
 *
 * VOCABULARY. A test never "proves" anything. Every statistical answer is one
 * of COMPATIBLE / INCOMPATIBLE / INCONCLUSIVE. KEEP / REMOVE exist only in the
 * MODEL IMPLICATIONS layer, and only alongside effect size, CI and OOS deltas.
 */

import type { League } from '../../types/winmix';

/**
 * Verdict on a generator hypothesis.
 * - COMPATIBLE   — the hypothesis is compatible with what the data shows.
 * - INCOMPATIBLE — observation and hypothesis differ materially (effect + OOS).
 * - INCONCLUSIVE — validity, sample or uncertainty forbids a verdict.
 */
export type Conclusion = 'COMPATIBLE' | 'INCOMPATIBLE' | 'INCONCLUSIVE';

/** Suggested state in the MODEL IMPLICATIONS block. Never applied automatically. */
export type ImplicationState = 'KEEP' | 'REMOVE' | 'INCONCLUSIVE';

/** A point estimate with its 95% interval. Never report one without the other. */
export interface Effect {
  estimate: number;
  ci95Low: number;
  ci95High: number;
}

/** What information a predictive test was allowed to see. */
export interface LeakageAudit {
  /** Human-readable description of the cutoff rule, e.g. "matches 1..t-1". */
  informationCutoff: string;
  /** Inclusive 0-based index range used for fitting. */
  trainingRange: [number, number];
  /** Inclusive 0-based index range scored out-of-sample. */
  testRange: [number, number];
  leakageSafe: boolean;
}

/** Dataset provenance — a report without this block is not interpretable. */
export interface DatasetInfo {
  league: League;
  seasonCount: number;
  matchCount: number;
  sampleSize: number;
  seed: number;
}

/** The canonical result shape of every statistical test in the suite. */
export interface TestResult {
  conclusion: Conclusion;
  /** What the effect measures, in words, so the number is never read blind. */
  effectLabel: string;
  effect: Effect;
  rawPValue?: number;
  adjustedPValue?: number;
  oosDeltaBrier?: number;
  oosDeltaLogLoss?: number;
  sampleSize: number;
  leakageSafe: boolean;
  /** Why the conclusion is what it is, in one sentence. */
  rationale: string;
}

/** Out-of-sample metrics of one model over one test range. */
export interface OosMetrics {
  brier: number;
  logLoss: number;
  ece: number;
  n: number;
}

/** A strict walk-forward comparison of a baseline and a richer model. */
export interface OosComparison {
  baselineLabel: string;
  candidateLabel: string;
  baseline: OosMetrics;
  candidate: OosMetrics;
  /** candidate − baseline. Negative means the candidate predicts better. */
  deltaBrier: Effect;
  deltaLogLoss: Effect;
  leakage: LeakageAudit;
}

/**
 * One MODEL IMPLICATIONS row. `automaticConfigurationChange` is always false —
 * the suite reports, it never reconfigures.
 */
export interface ModelImplication {
  component: string;
  currentSetting: string;
  suiteResult: Conclusion;
  effect: Effect;
  oosDeltaBrier?: number;
  oosDeltaLogLoss?: number;
  suggestedState: ImplicationState;
  automaticConfigurationChange: false;
}

/** Per-league Independence (form) test output. */
export interface IndependenceReport {
  dataset: DatasetInfo;
  /** Autocorrelation / Ljung–Box / runs diagnostics, aggregated over teams. */
  series: SeriesDiagnostics;
  /** Model A (rating-only) vs Model B (rating + previous-5 form). */
  comparison: OosComparison;
  result: TestResult;
  implication: ModelImplication;
}

/** Aggregated per-team sequence diagnostics. */
export interface SeriesDiagnostics {
  teamsAnalysed: number;
  /** Mean autocorrelation across teams, index 0 = lag 1 … index 4 = lag 5. */
  meanAutocorrelation: number[];
  /** Share of teams whose Ljung–Box test rejects independence at alpha = .05. */
  ljungBoxRejectShare: number;
  /** Share of teams whose Wald–Wolfowitz runs test rejects at alpha = .05. */
  runsRejectShare: number;
  /** Median runs-test z across teams. Negative = streaky, positive = alternating. */
  medianRunsZ: number;
}
