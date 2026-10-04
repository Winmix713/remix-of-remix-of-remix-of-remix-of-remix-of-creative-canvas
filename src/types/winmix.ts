export type League = 'angol' | 'spanyol';
export type LeagueMode = 'auto' | League;
export type Outcome = 'H' | 'D' | 'A';
export type DataSufficiency = 'hot' | 'warm' | 'cold';
export type Recommendation = 'HOME_WIN' | 'DRAW' | 'AWAY_WIN' | 'NO_CLEAR_EDGE';
export type ConfidenceLabel = 'High' | 'Good' | 'Moderate' | 'Low';
export type HistoryScope = 'season-only' | 'league-cumulative';
/**
 * The 2×2 decision matrix. Probability and confidence are orthogonal and are
 * NEVER multiplied into one scalar — a forecast lands in a quadrant instead.
 */
export type DecisionQuadrant = 'actionable' | 'volatile' | 'flat' | 'ignore';
/** Confidence bands backing the empirical reliability table. */
export type ConfidenceBandKey = 'high' | 'good' | 'moderate' | 'low';
export type BandDiagnosis =
'reliable' |
'calibrated' |
'overconfident' |
'underconfident' |
'noise' |
'insufficient';
/**
 * RELEASE C — PROBABILITY bands for market-specific calibration.
 *
 * Deliberately NOT {@link ConfidenceBandKey}. The 1X2 reliability table asks
 * "did our HIGH-CONFIDENCE top picks land as often as we signalled?" and buckets
 * by a confidence score. A market calibration band asks a different question —
 * "did the events we priced at 65–75% actually happen 65–75% of the time?" —
 * and buckets by the ESTIMATED PROBABILITY itself. Two measurements, two
 * semantic models. The UI may share rendering primitives; the types may not be
 * merged.
 */
export type MarketCalibrationBandKey =
'p00_20' |
'p20_40' |
'p40_55' |
'p55_65' |
'p65_75' |
'p75_100';
/** Whether M1 ran on fitted coefficients or the cold-start fallback. */
export type M1Source = 'fitted' | 'manual';
export type DiagnosticLevel = 'info' | 'warn' | 'error';
export type StorageBackend = 'local' | 'memory';
export type ViewKey =
'dashboard' |
'operations' |
'pipeline' |
'h2h' |
'predictor' |
'ledger';

export interface Probs {
  home: number;
  draw: number;
  away: number;
}

/**
 * The as-of design space of the model, 20 dimensions.
 *
 * NAMING — the existing 14 base dimensions are snake_case and are load-bearing
 * (`m1DesignVector()`, the Match Inspector grid, every persisted forecast), so
 * they are preserved VERBATIM: the contract is append-only, never rename.
 * The dimensions added in Phase 2 / Phase 4 use the camelCase names the upgrade
 * spec defines. `MatchRow` stays snake_case because it mirrors CSV headers.
 */
export interface FeatureVector {
  home_weight_index: number;
  away_weight_index: number;
  weight_diff: number;
  home_att_home: number;
  home_def_home: number;
  away_att_away: number;
  away_def_away: number;
  league_home_gpm: number;
  league_away_gpm: number;
  home_form_5: number;
  away_form_5: number;
  home_gd_form_5: number;
  away_gd_form_5: number;
  h2h_home_ppg: number;

  /* --- PHASE 2 — half-time dynamics (4 dimensions → 18) --- */
  /** Share of the last 5 matches (either team) where a goal fell by HT. */
  htGoalRate5: number;
  /** Home team's rate of converting an HT lead into an FT win. */
  htLeadConversionHome: number;
  /** Away team's rate of converting an HT lead into an FT win. */
  htLeadConversionAway: number;
  /** 2H goals / total goals over the last matches carrying HT data. */
  secondHalfGoalRatio: number;

  /* --- PHASE 4 — momentum reversion (2 dimensions → 20) --- */
  /** Total goals in the home team's most recent match. */
  prevMatchTotalGoalsHome: number;
  /** Total goals in the away team's most recent match. */
  prevMatchTotalGoalsAway: number;
}

export interface MatchPipeline {
  context: {
    homePlayed: number;
    awayPlayed: number;
    dataSufficiency: DataSufficiency;
  };
  features: FeatureVector;
  b0: Probs;
  b1: Probs;
  m1: Probs;
  ensRaw: Probs;
  calibrated: Probs;
  calibratedT: number;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  /** Which quadrant of the 2×2 decision matrix this forecast landed in. */
  decision: DecisionQuadrant;
  /** Whether the M1 leg used fitted or hand-set cold-start coefficients. */
  m1Source: M1Source;
  /** Active M1 share of the ensemble blend. */
  ensembleWM1: number;
  /**
   * Mean absolute deviation of the calibrated distribution from the model's own
   * B0 prior. A DIAGNOSTIC for anomalies and data errors — explicitly NOT a
   * betting value, since no exogenous market price exists.
   */
  priorDivergence: number;
  recommendation: Recommendation;
  caveat: string | null;
  /**
   * Every secondary market. PHASE 3 — sourced exclusively from the single joint
   * bivariate score matrix, so a `Draw 0-0` and a `BTTS: Yes` can no longer
   * coexist. The extra fields are optional only for backwards compatibility
   * with forecasts computed before the refactor.
   */
  secondary: {
    over25: number;
    btts: number;
    mostLikelyScore: string;
    over15?: number;
    over35?: number;
    bttsNo?: number;
    mostLikelyScoreProb?: number;
    topScores?: Array<{score: string;prob: number;}>;
    /**
     * RELEASE A — team-goal markets. MODEL-IMPLIED marginals of the same joint
     * score matrix as everything above, NOT market-calibrated values.
     *
     * Optional purely for backwards compatibility with checkpoints and ledger
     * records written before they existed. A pipeline run stamped with the
     * current `PIPELINE_CONTRACT_VERSION` always populates all four.
     */
    homeOver05?: number;
    homeUnder05?: number;
    awayOver05?: number;
    awayUnder05?: number;
    /**
     * BTTS CORE PROFILE — model-implied one-sided blowout descriptors, same
     * matrix, same pass. Optional for snapshots written before they existed.
     */
    highGoalNoBtts?: number;
    cleanSheetBlowout?: number;
  };
  reconciliation: {
    brierB1: number;
    brierEns: number;
    logLossB1: number;
    logLossEns: number;
    isCorrect: boolean;
  };
}

export interface MatchRow {
  /** Position in the season's CHRONOLOGICAL order (1-based), used for display. */
  match_no: number;
  /** Raw date cell exactly as it appeared in the source. Never overwritten. */
  date: string;
  /**
   * Resolved kickoff instant, or null when the source carried no usable date.
   * This — not the physical row order — is what makes ordering deterministic.
   */
  kickoffIso?: string | null;
  /** 1-based data-row position within its source file. Part of the dedupe identity. */
  rowIndex?: number;
  /** Identity of the file this row came from. Part of the dedupe identity. */
  sourceFileId?: string | null;
  home_team: string;
  away_team: string;
  ht_home_score: number | null;
  ht_away_score: number | null;
  home_score: number;
  away_score: number;
  total_goals: number;
  btts: boolean;
  outcome: Outcome;
  pipeline?: MatchPipeline;
}

export interface Season {
  id: string;
  league: League;
  seasonIndex: number;
  name: string;
  fileName: string;
  createdAt: string;
  contentHash: string | null;
  countWarning: boolean;
  actualMatchCount: number;
  /**
   * Whether the match list is known-chronological or merely in source order.
   * `source-order` means at least one row had no usable date, so chronology is
   * assumed rather than proven.
   */
  orderMode?: MatchOrderMode;
  /** How many matches resolved to a real kickoff instant. */
  datedMatchCount?: number;
  matches: MatchRow[];
}

export interface CalibFit {
  fittedAtMatchIndex: number;
  T: number;
  ece: number;
  sampleSize: number;
}

export interface CalibrationState {
  T: number;
  history: CalibFit[];
  ece: number | null;
  lastComputedAt: string | null;
  /** Bootstrap 95% CI of the skill vs the B1 baseline over the whole league. */
  skillCI?: SkillCI | null;
  /** Theoretical entropy floor and the honest headroom above it. */
  entropyFloor?: EntropyFloorEstimate | null;
  /** As-of fitted M1 / ensemble-weight state at the end of the walk. */
  modelFit?: ModelFitState | null;
  /** Parallel experiment branches; null whenever the flag was off. */
  experiments?: ExperimentReport | null;
  /**
   * RELEASE C — per-market, out-of-sample probability calibration accumulated
   * during the same chronological walk. Optional: absent on states computed
   * before this contract version.
   */
  markets?: MarketCalibrationState | null;
}

/* ------------------------------------------------------------------ *
 * P0 — uncertainty primitives. No metric is renderable without one.
 * ------------------------------------------------------------------ */

export interface MeanCI {
  mean: number;
  lo: number;
  hi: number;
  n: number;
}

export interface SkillCI {
  /** Point estimate of the skill percentage vs B1. */
  mean: number;
  lo: number;
  hi: number;
  /** True when the interval spans zero — i.e. no demonstrable advantage. */
  crossesZero: boolean;
  iterations: number;
  n: number;
}

export interface WilsonInterval {
  rate: number;
  lo: number;
  hi: number;
  n: number;
}

export interface ReliabilityBand {
  key: ConfidenceBandKey;
  label: string;
  /** Human-readable confidence score range, e.g. "76–100". */
  range: string;
  n: number;
  hits: number;
  /** Mean signalled probability of the top pick inside the band. */
  avgP: number;
  /** Measured hit rate of the top pick. */
  hitRate: number;
  /** Signalled minus actual. Positive = overconfident. */
  gap: number;
  ciLo: number;
  ciHi: number;
  /** Signalled probability sits inside the Wilson interval. */
  calibrated: boolean;
  /** False when the band holds too few observations to judge. */
  evaluable: boolean;
  diagnosis: BandDiagnosis;
}

/* ------------------------------------------------------------------ *
 * RELEASE C — market-specific, out-of-sample probability calibration.
 *
 * Every record below is measured on ONE market code (`BTTS`, `O2.5`,
 * `HOME_O0.5`, …) from the AS-OF model probability and the realized outcome.
 * None of it is derived from `stability`, `marketConfidence` or the H2H hit
 * rate: those measure how sharp and how well-supported the H2H SIGNAL is,
 * which is a separate layer and never a substitute for probability
 * calibration.
 * ------------------------------------------------------------------ */

/** One observation: what the model said before the match, and what happened. */
export interface MarketProbObservation {
  /** Model-implied probability from the AS-OF pre-match state. */
  p: number;
  hit: boolean;
}

export interface MarketCalibrationBand {
  key: MarketCalibrationBandKey;
  label: string;
  /** Human-readable probability range, e.g. "65–75%". */
  range: string;
  n: number;
  hits: number;
  /** Mean model-implied probability inside the band. */
  avgP: number;
  /** Measured hit rate inside the band. */
  hitRate: number;
  /** Signalled minus actual. Positive = overconfident. */
  gap: number;
  ciLo: number;
  ciHi: number;
  /** Model-implied probability sits inside the Wilson interval of the outcome. */
  calibrated: boolean;
  /** False when the band holds too few observations to judge. */
  evaluable: boolean;
  diagnosis: BandDiagnosis;
}

export type MarketCalibrationVerdict = 'calibrated' | 'overconfident' | 'underconfident' | 'unevaluable';

export interface MarketCalibrationReport {
  /** Market code, e.g. `'HOME_O0.5'`. */
  market: string;
  label: string;
  n: number;
  /** Mean model-implied probability over every observation. */
  avgP: number;
  /** Measured overall hit rate. */
  hitRate: number;
  brier: number;
  logLoss: number;
  /** Expected Calibration Error over the six probability bands. */
  ece: number;
  bands: MarketCalibrationBand[];
  /** True when at least one band reached the minimum sample. */
  evaluable: boolean;
  /** True only when every evaluable band is calibrated. */
  calibrated: boolean;
  verdict: MarketCalibrationVerdict;
  /** One sentence, ready to render. */
  headline: string;
}

/** Additive per-band tally — the only thing a checkpoint has to carry. */
export interface MarketBandTally {
  n: number;
  sumP: number;
  hits: number;
}

export interface MarketTally {
  n: number;
  sumP: number;
  hits: number;
  brier: number;
  logLoss: number;
  bands: Record<MarketCalibrationBandKey, MarketBandTally>;
}

/** Walk-forward accumulator state, keyed by market code. Resumable. */
export type MarketTallyMap = Record<string, MarketTally>;

/** Finished per-market reports, keyed by market code. */
export type MarketCalibrationState = Record<string, MarketCalibrationReport>;

export interface EntropyFloorEstimate {
  n: number;
  /** Mean entropy of the oracle-fitted generator distribution. */
  entropyFloor: number;
  /** In-sample log-loss of the oracle model itself. */
  oracleLogLoss: number;
  b1LogLoss: number | null;
  ensLogLoss: number | null;
  /** B1 log-loss minus the floor: the total remaining modelling headroom. */
  headroom: number | null;
  /** True when the headroom is too small to justify more model complexity. */
  saturated: boolean;
  saturationGap: number;
}

/* ------------------------------------------------------------------ *
 * P1 — fitted model state
 * ------------------------------------------------------------------ */

export interface M1Fit {
  /** [class][feature] softmax weights, intercept first. */
  weights: number[][];
  mean: number[];
  std: number[];
  dim: number;
  n: number;
  lambda: number;
  iterations: number;
  avgLogLoss: number;
}

export interface ModelFitEntry {
  fittedAtMatchIndex: number;
  kind: 'm1' | 'ensemble';
  n: number;
  avgLogLoss: number;
  /** Fitted M1 share of the blend; only set for `kind: 'ensemble'`. */
  wM1?: number;
}

export interface ModelFitState {
  /** Which coefficient set was live at the end of the walk. */
  m1Source: M1Source;
  m1SampleSize: number;
  m1AvgLogLoss: number | null;
  /** Active M1 share of the ensemble blend. */
  ensembleWM1: number;
  ensembleTuned: boolean;
  history: ModelFitEntry[];
  /**
   * C1 — the EXACT coefficient set the walk ended on, not just a summary of it.
   * Published so the forward-looking predictor can run the same model the audit
   * measured; `null` means the walk never reached the minimum fit sample and
   * the audit itself finished in cold-start mode.
   *
   * Optional because snapshots persisted before this field existed rehydrate
   * without it.
   */
  m1Fit?: M1Fit | null;
  /**
   * C1 — the Dixon-Coles low-score coefficient that was actually live at the
   * end of the walk. Only ever a number when the experiment ran AND its
   * prequential bootstrap interval excluded zero; `null` reproduces the
   * independent-Poisson baseline.
   */
  dixonColesRho?: number | null;
}

/* ------------------------------------------------------------------ *
 * P2 — experiments, always behind a feature flag
 * ------------------------------------------------------------------ */

export interface ExperimentSettings {
  dixonColes: boolean;
  glicko2: boolean;
}

export interface DixonColesFit {
  rho: number;
  n: number;
  avgLogLoss: number;
  /** Log-loss of the independent Poisson (rho = 0) on the same sample. */
  baseLogLoss: number;
  /** Positive means rho helped in sample — still needs a CI excluding zero. */
  improvement: number;
}

export interface GlickoRating {
  rating: number;
  rd: number;
  vol: number;
}

export interface BranchScore {
  label: string;
  n: number;
  logLoss: number;
  brier: number;
  /** Skill vs B1 with a bootstrap interval; null when unmeasurable. */
  skillCI: SkillCI | null;
}

export interface ExperimentReport {
  /** Fitted rho and whether the improvement survived the bootstrap interval. */
  dixonColes: {
    fit: DixonColesFit | null;
    branch: BranchScore | null;
    /** Only ever true when the CI excludes zero. */
    active: boolean;
  } | null;
  /** Parallel A/B branch — never merged into the M1 feature set. */
  glicko2: BranchScore | null;
}

export type CalibrationMap = Record<League, CalibrationState>;
export type WeightMap = Record<League, Record<string, number>>;
export type AliasMap = Record<League, Record<string, string>>;
export type SeasonCounters = Record<League, number>;

/**
 * A Top 3+3 szelvény piac-készlete. A három core kártya KÜLÖN-KÜLÖN
 * konfigurálható (Core 01–03), a három joker sor közös készletből dolgozik.
 * Az azonosítók a `utils/marketCatalog` katalógusából származnak.
 */
export type CoreCardMarkets = [string[], string[], string[]];

export interface SlipMarketPreferences {
  /** Core 01 · Core 02 · Core 03 saját piac-készlete. */
  coreCards: CoreCardMarkets;
  /** A három joker sor közös készlete. */
  joker: string[];
}

/**
 * PHASE 0 — a napi használatú gyors core stratégia.
 *
 * `custom` az örökölt, kártyánkénti piac-készlet szerkesztő; minden más érték
 * egyetlen kattintással beállítja a teljes core oldalt.
 */
export type QuickCoreStrategy =
'btts_profile_safe' |
'btts_raw_h2h' |
'over25' |
'safety_trend' |
/**
 * „Saját” — szándékosan kapu nélküli mód: kizárólag a beállított mérkőzések
 * 50% FELETTI BTTS Igen jelöltjei, BTTS százalék szerint csökkenő sorrendben,
 * a hat kártyára (3 core + 3 joker). Semmilyen kapu, kalibráció, evidencia,
 * kvadráns, veto vagy tartalék logika nem fut le rá.
 */
'custom_btts' |
'custom';

/**
 * A veto üzemmódja. `shadow` az alapérték: a Blowout No-BTTS szűrő kiszámol és
 * megjelenít mindent, de NEM vesz le sort a szelvényről, amíg egy előre
 * deklarált, minta-elemen kívüli mérés meg nem érdemli az élesítést.
 */
export type BttsVetoMode = 'shadow' | 'active';

/**
 * CORE TIERING — the decision quadrant's `actionable` / `volatile` split,
 * relabelled for the Core selection surface only. `flat` and `ignore` never
 * produce a tier at all (`null`) because they never reach a Core slot.
 *
 * This is deliberately a NEW, Core-specific type rather than a reuse of
 * `DecisionQuadrant`: it must never be read by Joker selection, pooled-mode
 * ranking outside Core, or any other surface as an implicit eligibility flag.
 */
export type CoreTier = 'primary' | 'secondary';

export interface CoreStrategySettings {
  mode: 'quick' | 'custom';
  quickStrategy: QuickCoreStrategy;
  vetoMode: BttsVetoMode;
}

/**
 * CORE STRATEGY CONTRACT AUDIT (P0-A) — which slot-filling algorithm actually
 * produced a draft's Core side, and why, so a silent fallback can never hide
 * behind output that looks identical to a real strategy run.
 *
 *  `strategy` — a quick strategy spec resolved and drove Core selection.
 *  `pooled`   — no spec resolved AND a market-pool preference existed, so the
 *               card-by-card editor (`pooledSlots`) filled the Core side.
 *               This is the LEGITIMATE `custom` mode path.
 *  `fixed`    — no spec, no market-pool preference: the legacy fixed mapping.
 *  `blocked`  — the settings were internally contradictory (`quick` mode with
 *               a strategy that carries no market codes — a state the current
 *               settings sanitizer should never produce, but a corrupted or
 *               hand-built settings object could). Rather than guessing which
 *               fallback the operator meant, every Core slot is left empty.
 */
export type CoreExecutionPath = 'strategy' | 'pooled' | 'fixed' | 'blocked';

/** Why `coreStrategySpecOf` returned `null` — the trace's causal explanation. */
export type SpecNullReason = 'custom_mode' | 'empty_codes' | 'no_settings' | null;

export interface WinmixSettings {
  historyScope: HistoryScope;
  allowDuplicateImport: boolean;
  debugInSampleT: boolean;
  /** Hypothesis-driven model branches. Both default to off. */
  experiments: ExperimentSettings;
  /** Melyik piacok kerülhetnek a core, illetve a joker sorokra. */
  slipMarkets: SlipMarketPreferences;
  /** PHASE 0 — gyors core stratégia; hiányzó érték az alapértékre esik vissza. */
  coreStrategy: CoreStrategySettings;
}

export interface DiagnosticEntry {
  ts: string;
  level: DiagnosticLevel;
  message: string;
}

export interface PersistedState {
  schemaVersion: number;
  savedAt: string;
  seasons: Season[];
  teamWeights: WeightMap;
  teamAliasMap: AliasMap;
  seasonCounters: SeasonCounters;
  calibration: CalibrationMap;
  settings: WinmixSettings;
  round: FixtureRound;
  slips: Slip[];
  /**
   * PHASE 8 — the `FeatureVector` shape the snapshot was written under. A
   * mismatch against `FEATURE_SCHEMA_VERSION` forces exactly one full
   * historical rebuild; a missing value is treated as a mismatch. Absent on
   * snapshots written before Phase 8, which cold-start cleanly.
   */
  featureSchemaVersion?: number;
}

/* ------------------------------------------------------------------ *
 * PHASE 8 — walk-forward checkpointing
 *
 * The per-match forecast is derived and deliberately never persisted, so a
 * page reload always costs one full rebuild. What the checkpoint removes is
 * the repeated cost of re-walking the whole history every time a fixture is
 * APPENDED inside a session.
 * ------------------------------------------------------------------ */

/** One row of the as-of logistic training set. */
export interface M1TrainingSample {
  x: number[];
  y: 0 | 1 | 2;
}

export interface CalibrationSampleRecord {
  ensRaw: Probs;
  outcome: Outcome;
}

export interface EnsembleSampleRecord {
  b1: Probs;
  m1: Probs;
  y: 0 | 1 | 2;
}

export interface PipelineCheckpoint {
  league: League;
  /** Must equal `FEATURE_SCHEMA_VERSION`, or the checkpoint is discarded. */
  featureSchemaVersion: number;
  /**
   * RELEASE A/C — must equal `PIPELINE_CONTRACT_VERSION`, or the checkpoint is
   * discarded and the whole history is rebuilt. Guards the pipeline OUTPUT
   * contract (score-matrix marginals, `secondary` markets, per-market
   * calibration), which the feature-schema guard cannot see. Checkpoints
   * written before this field existed lack it and are therefore rebuilt.
   */
  pipelineContractVersion?: number;
  /** Walk-forward cursor: how many matches have already been folded in. */
  processedMatchCount: number;
  /** Fingerprint of the processed prefix; any edit inside it invalidates it. */
  prefixSignature: string;
  /** Team weights the prefix was scored with — a change invalidates it. */
  weightsSignature: string;
  /** `'dc:0|g:0'`. Experiment branches are never resumed, only rebuilt. */
  experimentsKey: string;
  historyScope: HistoryScope;
  /** Live calibration temperature at the cursor. */
  T: number;
  m1Fit: M1Fit | null;
  ensembleWM1: number;
  ensembleTuned: boolean;
  /**
   * C1 — the validated Dixon-Coles rho at the cursor, or `null` when the
   * experiment was off or its interval did not exclude zero. Persisted so a
   * resumed run reports the same model the previous walk concluded on.
   * Optional: checkpoints written before this field existed simply lack it.
   */
  dixonColesRho?: number | null;
  calibHistory: CalibFit[];
  fitHistory: ModelFitEntry[];
  m1Samples: M1TrainingSample[];
  calibSample: CalibrationSampleRecord[];
  ensSamples: EnsembleSampleRecord[];
  /**
   * RELEASE C — additive per-market calibration tallies at the cursor, so an
   * incremental run continues the same out-of-sample measurement instead of
   * restarting it. Optional for backwards compatibility.
   */
  marketTallies?: MarketTallyMap;
  savedAt: string;
}

export type CheckpointMap = Partial<Record<League, PipelineCheckpoint>>;

/** Deterministic ordering of a season's match list. */
export type MatchOrderMode = 'chronological' | 'source-order';

export type RowIssueKind =
'structure' |
'missing_team' |
'invalid_score' |
'invalid_date' |
'header';

export interface SkippedRow {
  line: number;
  reason: string;
  kind?: RowIssueKind;
}

export interface CsvParseStats {
  /** Data rows seen after the header, excluding blank lines. */
  dataRows: number;
  accepted: number;
  rejected: number;
  /** Rows kept but with unusable half-time data cleared. */
  repaired: number;
  /** Rows that resolved to a real kickoff instant. */
  dated: number;
  /**
   * Whether the file even HAS a `date` column. A virtual league export without
   * one is a normal, expected input; a dated column that fails to parse is a
   * data problem. The two must not be reported the same way.
   */
  hasDateColumn: boolean;
}

export interface ParsedCsv {
  matches: MatchRow[];
  skippedRows: SkippedRow[];
  /** Rows that were kept after non-fatal data was dropped. */
  repairedRows: SkippedRow[];
  stats: CsvParseStats;
}

export interface LeagueDetection {
  league: League | 'unknown';
  confidence: number;
  source: 'filename' | 'heuristic';
}

export interface StandingRow {
  key: string;
  displayName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  points: number;
  homeAtt: number;
  awayAtt: number;
  weight: number;
}

export interface H2HMatch {
  seasonName: string;
  seasonId: string;
  date: string;
  home_team: string;
  away_team: string;
  ht_home_score: number | null;
  ht_away_score: number | null;
  home_score: number;
  away_score: number;
  total_goals: number;
  btts: boolean;
}

export interface H2HPair {
  id: string;
  homeKey: string;
  awayKey: string;
  homeDisplay: string;
  awayDisplay: string;
  matches: H2HMatch[];
  played: number;
  winsHome: number;
  winsAway: number;
  draws: number;
  goalsHome: number;
  goalsAway: number;
  totalGoals: number;
  avgGoals: number;
  bttsPct: number;
  over25Pct: number;
  lastMeeting: H2HMatch | null;
}

export interface EvalWindow {
  index: number;
  from: number;
  to: number;
  logLossB1: number;
  logLossEns: number;
  brier: number;
  skill: number;
  ece: number;
  sign: SignTestResult;
  /** Bootstrap 95% CI of `skill`. A window without one may not be rendered. */
  skillCI: SkillCI;
}

export interface SignTestResult {
  wins: number;
  losses: number;
  ties: number;
  n: number;
  p: number;
  z: number;
  significant: boolean;
  direction: 'ensemble_better' | 'b1_better' | 'none';
}

export interface TemperatureFit {
  T: number;
  ece: number;
  n: number;
  avgLogLoss: number;
}

/* ------------------------------------------------------------------ *
 * Part D — Fixture predictor, Top 3+1 pattern matcher, tip ledger
 * ------------------------------------------------------------------ */

export type PatternType =
'safety_trend' |
'goal_market' |
'exact_score' |
'htft_reversal' |
'ht_market' |
'streak' |
'model_agreement';

export type PatternAgreement = 'agree' | 'conflict' | 'neutral';

/** One manually assembled slot of the weekly round (8 per league). */
export interface Fixture {
  id: string;
  league: League;
  slot: number;
  homeKey: string | null;
  awayKey: string | null;
}

export interface FixtureRound {
  name: string;
  createdAt: string;
  fixtures: Fixture[];
}

/** H2H head-to-head record breakdown. */
export interface H2HRecord {
  homeWins: number;
  draws: number;
  awayWins: number;
  total: number;
  homeWinPct: number;
  drawPct: number;
  awayWinPct: number;
  /** Length of the current home unbeaten run (0 if broken). */
  homeUnbeatenStreak: number;
  /** Length of the current away unbeaten run (0 if broken). */
  awayUnbeatenStreak: number;
}

/** Goal market frequencies derived from H2H meetings. */
export interface H2HGoalStats {
  avgGoals: number;
  bttsPct: number;
  over25Pct: number;
  over15Pct: number;
  over35Pct: number;
}

/** Half-time dominance rates derived from H2H meetings with HT data. */
export interface H2HHtStats {
  /** Share of meetings where a goal was scored by HT. */
  htGoalRate: number;
  htHomeLeadRate: number;
  htDrawRate: number;
  htAwayLeadRate: number;
  /** Meetings with usable HT data out of total. */
  htSampleSize: number;
  /**
   * BTTS CORE PROFILE — historical share of valid HT meetings where BOTH teams
   * had already scored by half time.
   *
   * PAIR-PROFILE EVIDENCE ONLY. HT BTTS implies FT BTTS for the SAME historical
   * match, but a historical frequency never makes a future match deterministic,
   * so this value must not multiply the model BTTS probability. Optional for
   * slips saved before it existed.
   */
  htBttsRate?: number;
}

/**
 * BTTS CORE PROFILE — directed H2H goal-shape evidence for one fixture pair.
 *
 * The plain rates are DISPLAY ONLY. Everything a gate consumes is the
 * recency-weighted value, shrunk toward the league baseline on the Kish
 * effective sample size — so a 1-of-2 history can never become a hard veto.
 */
export interface H2HGoalProfile {
  /* --- Full direct H2H display statistics ------------------------------- */
  avgGoals: number;
  homeGoalsAvg: number;
  awayGoalsAvg: number;
  bttsRate: number;
  over25Rate: number;
  noBttsRate: number;
  highGoalNoBttsRate: number;
  cleanSheetBlowoutRate: number;
  /* --- Recency-weighted / decision statistics --------------------------- */
  weightedAvgGoals: number;
  weightedBttsRate: number;
  weightedOver25Rate: number;
  weightedHighGoalNoBttsRate: number;
  weightedCleanSheetBlowoutRate: number;
  /** Weighted rates after ESS-aware shrinkage toward the league baseline. */
  shrunkBttsRate: number;
  shrunkHighGoalNoBttsRate: number;
  shrunkCleanSheetBlowoutRate: number;
  effectiveSampleSize: number;
  directSampleSize: number;
  usedReverse: boolean;
  /* --- Counts and raw evidence, for explanation only -------------------- */
  bttsCount: number;
  highGoalNoBttsCount: number;
  cleanSheetBlowoutCount: number;
  /** Blowout scorelines, newest first, e.g. `['6-0', '5-0', '0-4']`. */
  blowoutScores: string[];
}

/**
 * A transparent, explanatory label for the pair's scoring shape.
 *
 * Deliberately NOT one magical scalar: the label explains, the veto reasons
 * decide, and both are shown side by side with their sample.
 */
export type BttsPairProfile =
'stable_two_sided' |
'btts_narrow' |
'underdog_scores' |
'one_sided_blowout_risk' |
'low_tempo' |
'high_variance' |
'insufficient_data';

/** Why a BTTS candidate would be refused a Profile Safe Core slot. */
export type BttsVetoReason =
'blowout_history' |
'blowout_model' |
'insufficient_sample' |
'reverse_assisted' |
'model_conflict';

/**
 * PHASE 4 — the shadow assessment of one BTTS Core candidate.
 *
 * `wouldVeto` is DIAGNOSTIC while the veto runs in shadow mode: it is recorded
 * and displayed, but it does not remove a line from the slip until an operator
 * switches the veto to active, or a pre-declared out-of-sample evaluation earns
 * the switch.
 */
export interface BttsBlowoutRiskAssessment {
  profile: BttsPairProfile;
  /** Weighted, shrunk directed H2H clean-sheet blowout rate. */
  historicalRisk: number;
  /** Model-implied clean-sheet blowout probability from the joint matrix. */
  modelRisk: number;
  effectiveSampleSize: number;
  usedReverse: boolean;
  wouldVeto: boolean;
  reasonCodes: BttsVetoReason[];
  /** Sentence-form reasons, in the same order as `reasonCodes`. */
  vetoReasons: string[];
  /** Non-decisive HT booster label: both teams historically score early. */
  earlyOpenProfile: boolean;
}

/** Most-frequent exact scores in H2H history. */
export interface H2HModalScore {
  score: string;
  count: number;
  pct: number;
}

/** HT/FT reversal statistics. */
export interface H2HReversalStats {
  turnaroundCount: number;
  turnaroundRate: number;
  /** Meetings with usable HT data (denominator). */
  htSampleSize: number;
}

/* ------------------------------------------------------------------ *
 * CORE CALIBRATION BOOTSTRAP — the evidence lifecycle of a core line.
 *
 * The strict gate used to consume one boolean, which collapsed two opposite
 * states: "measured and refused" and "never measured". These three levels
 * separate them, so a missing measurement can no longer masquerade as a
 * statistical refusal — and a real refusal can never be softened into one.
 * ------------------------------------------------------------------ */

export type CoreEvidenceLevel = 'calibrated' | 'conditional' | 'excluded';

/**
 * The explicit state a candidate reaches in the core eligibility funnel.
 * `BLOCKED` is the hard-veto terminal state — the candidate may not proceed
 * to canonicalisation, ranking, or card placement. Policy A (see
 * lastinfo.md §1–2): a statistically refuted evidence band is a hard veto.
 */
export type CoreCandidateState =
| 'RAW'
| 'CALIBRATED'
| 'EVIDENCE_ASSESSED'
| 'RISK_ASSESSED'
| 'VALUE_ASSESSED'
| 'CORE_ELIGIBLE'
| 'CORE_PUBLISHED'
| 'BLOCKED'
| 'RESEARCH_ONLY'
| 'FLAGGED';

/**
 * WHY the level is what it is:
 *  `verified`              — own band evaluable and calibrated,
 *  `disproved`             — own band evaluable and over/underconfident,
 *  `missing_evidence`      — no evaluable measurement exists yet,
 *  `divergent_environment` — only a widened environment is evaluable, and it
 *                            diverges. Caution, never a disproof.
 */
export type CoreEvidenceKind =
'verified' |
'disproved' |
'missing_evidence' |
'divergent_environment';

export interface CoreEvidenceSnapshot {
  level: CoreEvidenceLevel;
  kind: CoreEvidenceKind;
  /** Versioned rule set, stamped onto saved slips for honest later audit. */
  ruleVersion: string;
  /** The band belonging to THIS line's own model probability. */
  bandKey: MarketCalibrationBandKey | null;
  bandLabel: string | null;
  /** The bands actually consulted — one, or a widened neighbourhood. */
  environmentKeys: MarketCalibrationBandKey[];
  /** Printable probability window of the environment, e.g. `55–75%`. */
  environmentLabel: string | null;
  /** True when neighbouring bands were merged to reach the sample minimum. */
  widened: boolean;
  /** Audited observations behind the verdict (own band when not evaluable). */
  observations: number;
  /**
   * Was the scope behind this verdict actually MEASURED? Part of the coherence
   * contract: an `excluded` snapshot must carry `evaluable === true` together
   * with `observations >= required` and `kind === 'disproved'`, otherwise
   * `utils/coreEvidence.ts` downgrades it to `conditional` + `missing_evidence`.
   * Optional only so snapshots persisted before this field existed still parse.
   */
  evaluable?: boolean;
  /** The entry minimum for judging a band at all — a floor, not certainty. */
  required: number;
  /** Mean signalled probability of the environment; null when not evaluable. */
  avgP: number | null;
  /** Measured hit rate of the environment; null when not evaluable. */
  hitRate: number | null;
  /**
   * Wilson bounds of the realized rate the verdict was read against. Optional
   * only so snapshots saved before the decision trace existed still parse; a
   * `calibrated` or `excluded` verdict always carries them, because those two
   * levels ARE the statement "the signalled probability is inside / outside
   * this interval" and must be checkable without re-deriving anything.
   */
  ciLo?: number | null;
  ciHi?: number | null;
  /** Realized hits behind the verdict, so the interval can be recomputed. */
  hits?: number;
  diagnosis: BandDiagnosis;
  /** One ready-to-render sentence stating exactly what is and is not known. */
  headline: string;
}

export interface PatternHit {
  id: string;
  fixtureId: string;
  fixtureLabel: string;
  league: League;
  type: PatternType;
  /** Machine-gradable selection code, e.g. '1X', 'O2.5', 'CS:2-1', 'HTFT:REV'. */
  code: string;
  label: string;
  /** Recency-weighted raw share of meetings that hit, before shrinkage. */
  rawRate: number;
  hitRate: number;
  /** NOMINAL meeting count. For display only — never a sufficiency gate. */
  sample: number;
  /**
   * PHASE 5 — Kish effective sample size of the recency-weighted pool. Every
   * sufficiency and confidence gate consumes THIS, never `sample`.
   */
  effectiveSampleSize: number;
  usedReverse: boolean;
  sufficiency: DataSufficiency;
  agreement: PatternAgreement;
  stability: number;
  impliedOdds: number;
  weightApplied: number;
  /** Quadrant from P = hitRate and C = stability. Never their product. */
  decision: DecisionQuadrant;
  /**
   * PHASE 7 — market-specific confidence (0–99) for goal / HT-FT families.
   * Mirrors `stability` for every other family, so it is always renderable.
   */
  marketConfidence: number;
  /** Quadrant derived from `marketConfidence` under the secondary thresholds. */
  marketDecision: DecisionQuadrant;
  /** Confidence band this line's stability falls into. */
  band: ConfidenceBandKey;
  /** Empirically measured hit rate of that band; null when not evaluable. */
  bandHitRate: number | null;
  /** True only when the band's signalled probability survived its Wilson interval. */
  bandCalibrated: boolean;
  bandDiagnosis: BandDiagnosis;
  /**
   * RELEASE A — the MODEL-IMPLIED probability this line is scored against, read
   * from the joint score matrix. `null` for families with no matrix counterpart.
   * Explicitly not a market-calibrated value before Release C confirms one.
   */
  modelProb?: number | null;
  /**
   * RELEASE C — the probability band `modelProb` falls into, resolved from THIS
   * fixture's own model probability and never from a global market aggregate.
   */
  marketBand?: MarketCalibrationBandKey | null;
  /** Measured hit rate of that probability band; null when not evaluable. */
  marketBandHitRate?: number | null;
  /** True only when this line's own probability band is empirically calibrated. */
  marketBandCalibrated?: boolean;
  marketBandDiagnosis?: BandDiagnosis;
  /**
   * Where this market stands in the Release C evaluation:
   * `'calibrated'` — its own band is evaluable AND calibrated,
   * `'uncalibrated'` — its own band is evaluable and failed,
   * `'unevaluated'` — no market-specific measurement exists yet,
   * `'unregistered'` — the market has no eval spec (legacy global band path).
   */
  marketCalibrationStatus?: 'calibrated' | 'uncalibrated' | 'unevaluated' | 'unregistered';
  /**
   * CORE CALIBRATION BOOTSTRAP — the resolved evidence lifecycle of this line.
   * `bandCalibrated` above stays exactly what it always was (verified only);
   * this snapshot adds the missing middle state and the reason for it.
   */
  coreEvidence?: CoreEvidenceSnapshot | null;
  /** RELEASE B — which side is the underdog on this fixture, if any. */
  underdogSide?: 'home' | 'away' | null;
  /** The team-goal market code belonging to the underdog side, if any. */
  underdogMarketCode?: string | null;
  evidence: string[];
  /** H/D/V breakdown from the full H2H meeting pool. */
  headToHeadRecord: H2HRecord;
  /** Goal market frequencies. Always populated when sample > 0. */
  goalStats: H2HGoalStats;
  /** Half-time dominance rates. Null when HT coverage is insufficient. */
  htStats: H2HHtStats | null;
  /** Top-3 most frequent exact scores. Empty array when sample = 0. */
  topModalScores: H2HModalScore[];
  /** HT/FT reversal rate. Null when HT coverage is insufficient. */
  reversalStats: H2HReversalStats | null;
  /**
   * BTTS CORE PROFILE — the pair's directed goal-shape evidence. Shared by
   * every pattern of the fixture, exactly like `goalStats`.
   */
  goalProfile?: H2HGoalProfile | null;
  /** The shadow blowout-risk assessment of this pair. */
  bttsRisk?: BttsBlowoutRiskAssessment | null;
  /**
   * RANGADÓ — the marquee-pair ranking verdict of this directed pair.
   * Ranking-only, shadow-first: it never gates and never alters a measurement.
   */
  marqueeRisk?: MarqueeRiskVerdict | null;
}

/* ------------------------------------------------------------------ *
 * RANGADÓ (BÜNTETŐPONT) — marquee-pair BTTS ranking correction.
 *
 * The label alone never penalises: a deduction only exists when the pair's
 * OWN directed H2H evidence shows a recurring BTTS-No / low-scoring /
 * one-sided clean-sheet shape. Ranking-only, never a gate.
 * ------------------------------------------------------------------ */

export type MarqueeRiskLevel = 'none' | 'low' | 'medium' | 'high';

export interface MarqueeRiskVerdict {
  /** Operator-registered marquee pair (directed home → away). */
  registered: boolean;
  level: MarqueeRiskLevel;
  /** Ranking deduction in percentage points on the ranking hit-rate scale. */
  penalty: number;
  /** True only when the shadow flag is live AND a deduction exists. */
  applied: boolean;
  /** Number-backed sentences explaining the verdict. */
  reasons: string[];
  directSampleSize: number;
  effectiveSampleSize: number;
  noBttsRate: number | null;
  lowGoalNoBttsRate: number | null;
  cleanSheetBlowoutRate: number | null;
  blowoutScores: string[];
  /** Context only — a weight gap is never a reason on its own. */
  weightDiff: number | null;
  /** The existing BTTS pair profile label, when available. */
  profile: BttsPairProfile | null;
}

/**
 * RELEASE B — the favourite/underdog role of a fixture.
 *
 * Derived purely from the existing `features.weight_diff`; no new data, no new
 * model. The weight gap decides WHO the underdog is — it never argues that the
 * underdog scores.
 */
export interface UnderdogInfo {
  side: 'home' | 'away';
  /** Display name of the weaker team. */
  display: string;
  /** Absolute team-weight gap. Always ≥ `UNDERDOG_MIN_WEIGHT_GAP`. */
  weightGap: number;
  /** Signed gap as the feature vector reports it (wHome − wAway). */
  signedGap: number;
  /** Model-implied probability that this side scores at least one goal. */
  goalProb: number;
  /** The team-goal market code of that probability. */
  marketCode: string;
}

export interface FixtureAnalysis {
  fixtureId: string;
  league: League;
  slot: number;
  homeKey: string;
  awayKey: string;
  homeDisplay: string;
  awayDisplay: string;
  label: string;
  directMeetings: number;
  reverseMeetings: number;
  htCoverage: number;
  probs: Probs;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  /** Quadrant of the 2×2 decision matrix for this fixture. */
  decision: DecisionQuadrant;
  recommendation: Recommendation;
  mostLikelyScore: string;
  over25: number;
  btts: number;
  /**
   * RELEASE A/B — model-implied team-goal probabilities, marginals of the same
   * joint score matrix as `probs`, `over25` and `btts`. Optional so analyses
   * restored from an older snapshot still render.
   */
  homeOver05?: number;
  homeUnder05?: number;
  awayOver05?: number;
  awayUnder05?: number;
  /**
   * BTTS CORE PROFILE — model-implied blowout risk (same joint matrix) plus the
   * directed H2H goal-shape evidence and its shadow assessment.
   */
  highGoalNoBtts?: number;
  cleanSheetBlowout?: number;
  goalProfile?: H2HGoalProfile | null;
  bttsRisk?: BttsBlowoutRiskAssessment | null;
  /** Half-time rates of the pair; null when HT coverage is insufficient. */
  htStats?: H2HHtStats | null;
  /** RELEASE B — underdog role, or null below the weight-gap threshold. */
  underdog?: UnderdogInfo | null;
  sufficiency: DataSufficiency;
  patterns: PatternHit[];
  notes: string[];
}

export type LineGrade = 'pending' | 'won' | 'lost';
export type SlipStatus = 'pending' | 'won' | 'partial' | 'lost';

/**
 * The six dedicated slip slots — three fixed core markets plus three joker
 * slots. `core`, `safety`, `goals`, `recurring` and `joker` only appear on
 * slips saved before the split, and are mapped onto a current slot for display.
 */
export type SlipRole =
'btts_top' |
'btts_second' |
'over25' |
'joker_score' |
'joker_ht' |
'joker_trend'
/* legacy */ |
'safety' |
'goals' |
'recurring' |
'joker' |
'core';

export interface SlipLine {
  id: string;
  role: SlipRole;
  fixtureLabel: string;
  league: League;
  type: PatternType;
  code: string;
  label: string;
  stability: number;
  hitRate: number;
  sample: number;
  /** Quadrant carried from the source pattern. Absent on slips saved earlier. */
  decision?: DecisionQuadrant;
  band?: ConfidenceBandKey;
  bandHitRate?: number | null;
  bandCalibrated?: boolean;
  bandDiagnosis?: BandDiagnosis;
  htHome: number | null;
  htAway: number | null;
  ftHome: number | null;
  ftAway: number | null;
  /** H/D/V breakdown carried from the source PatternHit. */
  headToHeadRecord: H2HRecord;
  /** Goal market frequencies carried from the source PatternHit. */
  goalStats: H2HGoalStats;
  /** Half-time dominance rates; null when HT coverage was insufficient. */
  htStats: H2HHtStats | null;
  /** Top-3 most frequent exact scores. */
  topModalScores: H2HModalScore[];
  /** HT/FT reversal stats; null when HT coverage was insufficient. */
  reversalStats: H2HReversalStats | null;
  /** BTTS CORE PROFILE — the pair profile the line was issued under. */
  goalProfile?: H2HGoalProfile | null;
  bttsRisk?: BttsBlowoutRiskAssessment | null;
  /**
   * CORE CALIBRATION BOOTSTRAP — the evidence level and its full snapshot AT
   * ISSUE TIME. Calibrated and conditional lines must be measurable as separate
   * cohorts later, which is impossible unless the level is persisted with the
   * line rather than recomputed against a future, different calibration state.
   */
  coreEvidence?: CoreEvidenceSnapshot | null;
  /** Denormalised level, so a ledger query never has to open the snapshot. */
  evidenceLevel?: CoreEvidenceLevel;
  /**
   * CORE TIERING — the Core selection tier at issue time: `'primary'` for an
   * actionable pattern, `'secondary'` for a volatile one placed only because
   * fewer than three primary candidates existed, `null` for a Joker line (no
   * Core tier applies). LEFT UNDEFINED, not backfilled, on any line saved
   * before tiering existed — `undefined` is what tells the UI to render
   * "Legacy Core" instead of guessing a tier the line was never assigned.
   */
  coreTier?: CoreTier | null;
  /** Versioned separately from `coreEvidence`'s rule version — see CORE_SELECTION_RULE_VERSION. */
  coreSelectionRuleVersion?: string | null;
  /**
   * DÖNTÉSI ÁLLAPOT KIADÁSKOR — a sor állapotgép-végállapota a kiadás
   * pillanatában, elmentve, hogy a napló később ne egy azóta megváltozott
   * kalibrációs állapotból számolja vissza. `undefined` a régi sorokon.
   */
  candidateState?: CoreCandidateState | null;
}

export interface Slip {
  id: string;
  createdAt: string;
  roundName: string;
  combinedProb: number;
  lines: SlipLine[];
  /**
   * RELEASE D — auditálhatóság: melyik core stratégia és melyik szabályverzió
   * állította elő a szelvényt. Régebbi szelvényeken hiányzik.
   */
  coreStrategy?: QuickCoreStrategy;
  vetoMode?: BttsVetoMode;
  ruleVersion?: string;
  /**
   * P0-A — which Core slot-filling path actually produced this slip, and why
   * a strategy did not resolve. Lets a `custom`-mode or contradictory-settings
   * slip be told apart from a genuine quick-strategy run after the fact, even
   * once the live settings have since changed.
   */
  executionPath?: CoreExecutionPath;
  specNullReason?: SpecNullReason;
  /** Hány core kártya telt meg kiadáskor. `undefined` a régi szelvényeken. */
  coreLineCount?: number;
  /**
   * „0 CORE" FORDULÓ — értékes mérési eredmény, nem üres sor: a forduló
   * lefutott, de egyetlen jelölt sem érte el a core szintet.
   */
  zeroCore?: boolean;
}

export interface PatternPerformance {
  type: PatternType;
  issued: number;
  settled: number;
  hits: number;
  hitRate: number | null;
  /** Laplace-smoothed rate — the field name `computePatternPerformance` emits. */
  smoothed: number;
  weight: number;
}

export type PatternWeightMap = Record<PatternType, number>;