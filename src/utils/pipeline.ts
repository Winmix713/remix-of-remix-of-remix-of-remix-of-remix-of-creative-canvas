/**
 * pipeline — the CHRONOLOGICAL, WALK-FORWARD scoring engine of one league.
 *
 * CONTRACT
 * --------
 * Every match is scored using ONLY the matches that preceded it. Nothing in
 * this module may read a match's own result before its forecast is produced:
 *  - the feature vector is built from the prior slice,
 *  - the logistic fit, the ensemble weight and the calibration temperature are
 *    refitted PREQUENTIALLY (on strictly prior data, at a fixed cadence),
 *  - the per-market calibration tallies fold in one settled match at a time,
 *    always after its own as-of probability was emitted.
 *
 * The math itself lives in `utils/forecastCore.ts`; this module owns ORDER,
 * STATE and RESUMPTION. The forward-looking predictor calls the same
 * `forecastCore()` with a different history slice, which is what makes the
 * audit and the prediction comparable at all.
 *
 * RESUMPTION
 * ----------
 * A {@link PipelineCheckpoint} lets an APPENDED fixture avoid re-walking the
 * whole history. It is only reusable when every one of these matches:
 * feature-schema version, pipeline-contract version, history scope, team
 * weights, experiment flags, and a fingerprint of the processed prefix. Any
 * mismatch is a full rebuild with a stated reason — never a partial patch.
 */

import {
  CALIB_MIN_SAMPLE,
  CALIB_REFIT_INTERVAL,
  DC_MIN_SAMPLE,
  ENSEMBLE_MIN_SAMPLE,
  ENSEMBLE_REFIT_INTERVAL,
  ENSEMBLE_WM1_MAX,
  ENSEMBLE_WM1_MIN,
  FEATURE_SCHEMA_VERSION,
  M1_L2_LAMBDA,
  M1_MIN_SAMPLE,
  M1_REFIT_INTERVAL,
  PIPELINE_CONTRACT_VERSION,
  YIELD_EVERY_N_MATCHES } from
'./constants';
import { bootstrapSkillCI, skillPairsOf } from './bootstrap';
import { dcOutcomeProbs, fitRho, type DcSample } from './experiments/dixonColes';
import { GlickoLedger } from './experiments/glicko2';
import {
  FORECAST_MODEL,
  classIndexOf,
  forecastCore,
  leagueGoalsPerMatch,
  m1SampleOf,
  toMatchPipeline,
  type ForecastHistoryEntry,
  type ForecastResult } from
'./forecastCore';
import { fitEnsembleWeight, fitMultinomialLogistic } from './logistic';
import { MarketCalibrationAccumulator } from './marketEval';
import { estimateEntropyFloor } from './oracle';
import { computeECEForSlice, fitTemperature } from './stats';
import { canon, simpleHash } from './teams';
import type {
  BranchScore,
  CalibFit,
  CalibrationSampleRecord,
  CalibrationState,
  EnsembleSampleRecord,
  ExperimentReport,
  ExperimentSettings,
  HistoryScope,
  League,
  M1Fit,
  M1TrainingSample,
  MatchPipeline,
  MatchRow,
  ModelFitEntry,
  ModelFitState,
  Outcome,
  PipelineCheckpoint,
  Probs,
  Season,
  TemperatureFit } from
'../types/winmix';

/* -------------------------------------------------------------------------- *
 * Public contract
 * -------------------------------------------------------------------------- */

/** Whether the run resumed a checkpoint or rebuilt the whole history. */
export type PipelineRunKind = 'incremental' | 'full';

export interface PipelineParams {
  seasons: Season[];
  league: League;
  weights: Record<string, number>;
  historyScope: HistoryScope;
  experiments: ExperimentSettings;
  checkpoint: PipelineCheckpoint | null;
  forceFullRebuild: boolean;
  onProgress?: (done: number, total: number) => void;
}

export interface PipelineResult {
  /** The league's seasons, with `pipeline` written onto every match. */
  seasons: Season[];
  calibration: CalibrationState;
  checkpoint: PipelineCheckpoint;
  /** How many matches were reused from the checkpoint instead of re-scored. */
  reusedMatches: number;
  kind: PipelineRunKind;
  /** Why a full rebuild happened, or `null` on a clean incremental run. */
  rebuildReason: string | null;
}

/** A match that has definitely been scored — no optional `pipeline` access. */
export type ScoredMatch = MatchRow & {pipeline: MatchPipeline;};

/** Narrow a match list to the matches that carry a forecast. */
export function scoredMatchesOf(matches: readonly MatchRow[]): ScoredMatch[] {
  return matches.filter((m): m is ScoredMatch => Boolean(m.pipeline));
}

/** Cooperative yield, so a long walk never blocks the main thread. */
export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/* -------------------------------------------------------------------------- *
 * Ordering + signatures
 * -------------------------------------------------------------------------- */

interface WalkItem {
  seasonIdx: number;
  matchIdx: number;
  homeKey: string;
  awayKey: string;
}

function orderedSeasons(seasons: readonly Season[], league: League): Season[] {
  return seasons.
  filter((season) => season.league === league).
  slice().
  sort((a, b) => a.seasonIndex - b.seasonIndex || a.createdAt.localeCompare(b.createdAt));
}

function identityOf(match: MatchRow): string {
  return [
  match.kickoffIso ?? match.date ?? '',
  match.home_team,
  match.away_team,
  match.home_score,
  match.away_score].
  join('|');
}

function prefixSignatureOf(rows: readonly MatchRow[], count: number): string {
  let acc = '';
  for (let i = 0; i < count && i < rows.length; i++) acc += identityOf(rows[i]) + ';';
  return simpleHash(`${count}#${acc}`);
}

function weightsSignatureOf(weights: Record<string, number>): string {
  const parts = Object.keys(weights).
  sort().
  map((key) => `${key}=${weights[key]}`);
  return simpleHash(parts.join('|'));
}

function experimentsKeyOf(experiments: ExperimentSettings): string {
  return `dc:${experiments.dixonColes ? 1 : 0}|g:${experiments.glicko2 ? 1 : 0}`;
}

/* -------------------------------------------------------------------------- *
 * Walk-forward state
 * -------------------------------------------------------------------------- */

interface WalkState {
  T: number;
  m1Fit: M1Fit | null;
  ensembleWM1: number;
  ensembleTuned: boolean;
  calibHistory: CalibFit[];
  fitHistory: ModelFitEntry[];
  m1Samples: M1TrainingSample[];
  calibSample: CalibrationSampleRecord[];
  ensSamples: EnsembleSampleRecord[];
  markets: MarketCalibrationAccumulator;
  m1AvgLogLoss: number | null;
}

function coldState(): WalkState {
  return {
    T: 1,
    m1Fit: null,
    ensembleWM1: FORECAST_MODEL.ensemble.wM1,
    ensembleTuned: false,
    calibHistory: [],
    fitHistory: [],
    m1Samples: [],
    calibSample: [],
    ensSamples: [],
    markets: new MarketCalibrationAccumulator(null),
    m1AvgLogLoss: null
  };
}

function stateFromCheckpoint(checkpoint: PipelineCheckpoint): WalkState {
  return {
    T: checkpoint.T,
    m1Fit: checkpoint.m1Fit,
    ensembleWM1: checkpoint.ensembleWM1,
    ensembleTuned: checkpoint.ensembleTuned,
    calibHistory: checkpoint.calibHistory.slice(),
    fitHistory: checkpoint.fitHistory.slice(),
    m1Samples: checkpoint.m1Samples.slice(),
    calibSample: checkpoint.calibSample.slice(),
    ensSamples: checkpoint.ensSamples.slice(),
    markets: new MarketCalibrationAccumulator(checkpoint.marketTallies ?? null),
    m1AvgLogLoss: checkpoint.m1Fit?.avgLogLoss ?? null
  };
}

/**
 * How much of the checkpoint may be reused, and why not more.
 *
 * A checkpoint is either fully valid for its cursor or discarded whole: a
 * logistic fit cannot be migrated across a contract change, only rebuilt.
 */
function reusableCount(
params: PipelineParams,
rows: readonly MatchRow[],
weightsSignature: string,
experimentsKey: string)
: {count: number;reason: string | null;} {
  const { checkpoint, forceFullRebuild, historyScope, experiments } = params;
  if (forceFullRebuild) return { count: 0, reason: 'kézi teljes újraépítés' };
  if (!checkpoint) return { count: 0, reason: null };
  if (checkpoint.league !== params.league) return { count: 0, reason: 'más liga checkpointja' };
  if (checkpoint.featureSchemaVersion !== FEATURE_SCHEMA_VERSION)
  return { count: 0, reason: 'feature-séma verzió változott' };
  if ((checkpoint.pipelineContractVersion ?? 0) !== PIPELINE_CONTRACT_VERSION)
  return { count: 0, reason: 'pipeline-szerződés verzió változott' };
  if (checkpoint.historyScope !== historyScope)
  return { count: 0, reason: 'előzmény-hatókör változott' };
  if (checkpoint.weightsSignature !== weightsSignature)
  return { count: 0, reason: 'csapatsúlyok változtak' };
  if (checkpoint.experimentsKey !== experimentsKey)
  return { count: 0, reason: 'kísérleti ágak változtak' };
  if (experiments.dixonColes || experiments.glicko2)
  return { count: 0, reason: 'a kísérleti ágakat sosem folytatjuk, mindig újraépítjük' };

  const count = checkpoint.processedMatchCount;
  if (count <= 0) return { count: 0, reason: null };
  if (count > rows.length) return { count: 0, reason: 'a feldolgozott előtag rövidebb lett' };
  if (checkpoint.prefixSignature !== prefixSignatureOf(rows, count))
  return { count: 0, reason: 'a feldolgozott előtag módosult' };
  for (let i = 0; i < count; i++) {
    if (!rows[i].pipeline) return { count: 0, reason: 'a korábbi előrejelzések nem álltak rendelkezésre' };
  }
  return { count, reason: null };
}

/* -------------------------------------------------------------------------- *
 * Prequential refits
 * -------------------------------------------------------------------------- */

function refitTemperature(state: WalkState, cursor: number): void {
  if (state.calibSample.length < CALIB_MIN_SAMPLE) return;
  const fit = fitTemperature(state.calibSample.map((s) => ({ ensRaw: s.ensRaw, outcome: s.outcome })));
  if (!fit) return;
  state.T = fit.T;
  state.calibHistory.push({
    fittedAtMatchIndex: cursor,
    T: fit.T,
    ece: fit.ece,
    sampleSize: fit.n
  });
}

function refitM1(state: WalkState, cursor: number): void {
  if (state.m1Samples.length < M1_MIN_SAMPLE) return;
  const fit = fitMultinomialLogistic(
    state.m1Samples.map((s) => ({ x: s.x, y: s.y })),
    M1_L2_LAMBDA,
    M1_MIN_SAMPLE
  );
  if (!fit) return;
  state.m1Fit = fit;
  state.m1AvgLogLoss = fit.avgLogLoss;
  state.fitHistory.push({
    fittedAtMatchIndex: cursor,
    kind: 'm1',
    n: fit.n,
    avgLogLoss: fit.avgLogLoss
  });
}

function refitEnsemble(state: WalkState, cursor: number): void {
  if (state.ensSamples.length < ENSEMBLE_MIN_SAMPLE) return;
  const fit = fitEnsembleWeight(
    state.ensSamples.map((s) => ({ b1: s.b1, m1: s.m1, y: s.y })),
    ENSEMBLE_WM1_MIN,
    ENSEMBLE_WM1_MAX,
    FORECAST_MODEL.ensemble.wM1,
    ENSEMBLE_MIN_SAMPLE
  );
  if (!fit) return;
  state.ensembleWM1 = fit.wM1;
  state.ensembleTuned = true;
  state.fitHistory.push({
    fittedAtMatchIndex: cursor,
    kind: 'ensemble',
    n: fit.n,
    avgLogLoss: fit.avgLogLoss,
    wM1: fit.wM1
  });
}

/* -------------------------------------------------------------------------- *
 * Experiment branches — parallel, never merged into the live model
 * -------------------------------------------------------------------------- */

function logLossOf(probs: Probs, outcome: Outcome): number {
  const p = outcome === 'H' ? probs.home : outcome === 'D' ? probs.draw : probs.away;
  return -Math.log(Math.max(1e-9, p));
}

function brierOf(probs: Probs, outcome: Outcome): number {
  const target = {
    home: outcome === 'H' ? 1 : 0,
    draw: outcome === 'D' ? 1 : 0,
    away: outcome === 'A' ? 1 : 0
  };
  return (
    Math.pow(probs.home - target.home, 2) +
    Math.pow(probs.draw - target.draw, 2) +
    Math.pow(probs.away - target.away, 2));

}

interface BranchObservation {
  branch: Probs;
  b1: Probs;
  outcome: Outcome;
}

function scoreBranch(label: string, observations: readonly BranchObservation[]): BranchScore | null {
  if (observations.length === 0) return null;
  let logLoss = 0;
  let brier = 0;
  const pairs = observations.map((obs) => {
    const branchLoss = logLossOf(obs.branch, obs.outcome);
    logLoss += branchLoss;
    brier += brierOf(obs.branch, obs.outcome);
    return { logLossB1: logLossOf(obs.b1, obs.outcome), logLossEns: branchLoss };
  });
  const n = observations.length;
  return {
    label,
    n,
    logLoss: logLoss / n,
    brier: brier / n,
    skillCI: n >= 30 ? bootstrapSkillCI(pairs) : null
  };
}

/* -------------------------------------------------------------------------- *
 * The walk
 * -------------------------------------------------------------------------- */

export async function computeLeaguePipeline(params: PipelineParams): Promise<PipelineResult> {
  const { league, weights, historyScope, experiments, onProgress } = params;

  const seasons = orderedSeasons(params.seasons, league).map((season) => ({
    ...season,
    matches: season.matches.map((match) => ({ ...match }))
  }));

  const flat: WalkItem[] = [];
  const rows: MatchRow[] = [];
  seasons.forEach((season, seasonIdx) => {
    season.matches.forEach((match, matchIdx) => {
      flat.push({
        seasonIdx,
        matchIdx,
        homeKey: canon(match.home_team),
        awayKey: canon(match.away_team)
      });
      rows.push(match);
    });
  });

  const total = flat.length;
  const weightsSignature = weightsSignatureOf(weights);
  const experimentsKey = experimentsKeyOf(experiments);
  const reuse = reusableCount(params, rows, weightsSignature, experimentsKey);
  const reuseCount = reuse.count;

  const state = reuseCount > 0 && params.checkpoint ?
  stateFromCheckpoint(params.checkpoint) :
  coldState();

  /* History slices. `season-only` restarts the slice at every season boundary;
   * `league-cumulative` carries the whole league forward. */
  let entries: ForecastHistoryEntry[] = [];
  let currentSeasonIdx = flat[0]?.seasonIdx ?? 0;

  const dcSamples: DcSample[] = [];
  const dcObservations: BranchObservation[] = [];
  const glickoObservations: BranchObservation[] = [];
  const glicko = experiments.glicko2 ? new GlickoLedger() : null;

  let m1Source: MatchPipeline['m1Source'] = state.m1Fit ? 'fitted' : 'manual';
  let processedSinceRefit = reuseCount;

  for (let i = 0; i < total; i++) {
    const item = flat[i];
    const season = seasons[item.seasonIdx];
    const match = season.matches[item.matchIdx];

    if (historyScope === 'season-only' && item.seasonIdx !== currentSeasonIdx) {
      entries = [];
      currentSeasonIdx = item.seasonIdx;
    }

    if (i >= reuseCount) {
      const forecast: ForecastResult = forecastCore({
        entries,
        homeKey: item.homeKey,
        awayKey: item.awayKey,
        weights,
        T: state.T,
        leagueGpm: leagueGoalsPerMatch(entries),
        m1Fit: state.m1Fit,
        ensembleWM1: state.ensembleWM1,
        dixonColesRho: null
      });

      match.pipeline = toMatchPipeline(forecast, match.outcome);
      m1Source = forecast.m1Source;

      /* --- fold this settled match into the as-of state ------------------- */
      state.calibSample.push({ ensRaw: forecast.ensRaw, outcome: match.outcome });
      state.m1Samples.push(m1SampleOf(forecast.features, match.outcome));
      state.ensSamples.push({
        b1: forecast.b1,
        m1: forecast.m1,
        y: classIndexOf(match.outcome)
      });
      state.markets.observe(match.pipeline.secondary, {
        home_score: match.home_score,
        away_score: match.away_score
      });

      if (experiments.dixonColes) {
        dcSamples.push({
          lambdaH: forecast.lambdas.home,
          lambdaA: forecast.lambdas.away,
          outcome: match.outcome
        });
      }
      if (glicko) {
        glickoObservations.push({
          branch: glicko.predict(item.homeKey, item.awayKey),
          b1: forecast.b1,
          outcome: match.outcome
        });
        glicko.observe(item.homeKey, item.awayKey, match.outcome);
      }

      processedSinceRefit += 1;
      const cursor = i + 1;
      if (processedSinceRefit % CALIB_REFIT_INTERVAL === 0) refitTemperature(state, cursor);
      if (processedSinceRefit % M1_REFIT_INTERVAL === 0) refitM1(state, cursor);
      if (processedSinceRefit % ENSEMBLE_REFIT_INTERVAL === 0) refitEnsemble(state, cursor);

      if (cursor % YIELD_EVERY_N_MATCHES === 0) {
        onProgress?.(cursor, total);
        await yieldToMain();
      }
    }

    entries.push({ homeKey: item.homeKey, awayKey: item.awayKey, match });
  }

  onProgress?.(total, total);

  /* --- Experiment branches, measured on this run's scored matches --------- */
  let experimentReport: ExperimentReport | null = null;
  if (experiments.dixonColes || experiments.glicko2) {
    const dcFit = experiments.dixonColes ? fitRho(dcSamples, DC_MIN_SAMPLE) : null;
    if (dcFit) {
      dcSamples.forEach((sample, index) => {
        const b1 = rows[reuseCount + index]?.pipeline?.b1;
        if (!b1) return;
        dcObservations.push({
          branch: dcOutcomeProbs(sample.lambdaH, sample.lambdaA, dcFit.rho),
          b1,
          outcome: sample.outcome
        });
      });
    }
    const dcBranch = dcFit ? scoreBranch('Dixon-Coles', dcObservations) : null;
    const dcActive = Boolean(
      dcFit &&
      dcBranch?.skillCI &&
      !dcBranch.skillCI.crossesZero &&
      dcBranch.skillCI.mean > 0
    );
    experimentReport = {
      dixonColes: experiments.dixonColes ?
      { fit: dcFit, branch: dcBranch, active: dcActive } :
      null,
      glicko2: experiments.glicko2 ? scoreBranch('Glicko-2', glickoObservations) : null
    };
  }

  const validatedRho =
  experimentReport?.dixonColes?.active && experimentReport.dixonColes.fit ?
  experimentReport.dixonColes.fit.rho :
  null;

  /* --- Published calibration state ---------------------------------------- */
  const scored = scoredMatchesOf(rows);
  const pairs = skillPairsOf(scored);
  const modelFit: ModelFitState = {
    m1Source: state.m1Fit ? 'fitted' : m1Source,
    m1SampleSize: state.m1Samples.length,
    m1AvgLogLoss: state.m1AvgLogLoss,
    ensembleWM1: state.ensembleWM1,
    ensembleTuned: state.ensembleTuned,
    history: state.fitHistory,
    m1Fit: state.m1Fit,
    dixonColesRho: validatedRho
  };

  const calibration: CalibrationState = {
    T: state.T,
    history: state.calibHistory,
    ece: scored.length > 0 ? computeECEForSlice(scored) : null,
    lastComputedAt: new Date().toISOString(),
    skillCI: pairs.length >= 30 ? bootstrapSkillCI(pairs) : null,
    entropyFloor: estimateEntropyFloor(scored),
    modelFit,
    experiments: experimentReport,
    markets: state.markets.report()
  };

  const checkpoint: PipelineCheckpoint = {
    league,
    featureSchemaVersion: FEATURE_SCHEMA_VERSION,
    pipelineContractVersion: PIPELINE_CONTRACT_VERSION,
    processedMatchCount: total,
    prefixSignature: prefixSignatureOf(rows, total),
    weightsSignature,
    experimentsKey,
    historyScope,
    T: state.T,
    m1Fit: state.m1Fit,
    ensembleWM1: state.ensembleWM1,
    ensembleTuned: state.ensembleTuned,
    dixonColesRho: validatedRho,
    calibHistory: state.calibHistory,
    fitHistory: state.fitHistory,
    m1Samples: state.m1Samples,
    calibSample: state.calibSample,
    ensSamples: state.ensSamples,
    marketTallies: state.markets.state(),
    savedAt: new Date().toISOString()
  };

  return {
    seasons,
    calibration,
    checkpoint,
    reusedMatches: reuseCount,
    kind: reuseCount > 0 ? 'incremental' : 'full',
    rebuildReason: reuseCount > 0 ? null : reuse.reason
  };
}

/* -------------------------------------------------------------------------- *
 * Diagnostic — IN-SAMPLE temperature
 * -------------------------------------------------------------------------- */

/**
 * Fits the calibration temperature on the league's WHOLE history at once.
 *
 * Deliberately cheating on time: it is a DIAGNOSTIC ceiling ("how well could
 * temperature scaling ever have done here?"), never a value the pipeline runs
 * on. Returns `null` below 50 scored matches, where the fit means nothing.
 */
export function computeDebugInSampleT(
seasons: readonly Season[],
league: League)
: TemperatureFit | null {
  const sample = orderedSeasons(seasons, league).
  flatMap((season) => scoredMatchesOf(season.matches)).
  map((match) => ({ ensRaw: match.pipeline.ensRaw, outcome: match.outcome }));

  if (sample.length < 50) return null;
  return fitTemperature(sample);
}