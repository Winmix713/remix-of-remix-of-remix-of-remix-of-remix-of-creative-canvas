export type League = 'angol' | 'spanyol'
export type LeagueMode = 'auto' | League
export type Outcome = 'H' | 'D' | 'A'
export type DataSufficiency = 'hot' | 'warm' | 'cold'
export type Recommendation = 'HOME_WIN' | 'DRAW' | 'AWAY_WIN' | 'NO_CLEAR_EDGE'
export type ConfidenceLabel = 'High' | 'Good' | 'Moderate' | 'Low'
export type HistoryScope = 'season-only' | 'league-cumulative'
export type DiagnosticLevel = 'info' | 'warn' | 'error'
export type StorageBackend = 'local' | 'memory'
export type ViewKey =
  | 'dashboard'
  | 'pipeline'
  | 'weights'
  | 'h2h'
  | 'predictor'
  | 'ledger'

export interface Probs {
  home: number
  draw: number
  away: number
}

export interface FeatureVector {
  home_weight_index: number
  away_weight_index: number
  weight_diff: number
  home_att_home: number
  home_def_home: number
  away_att_away: number
  away_def_away: number
  league_home_gpm: number
  league_away_gpm: number
  home_form_5: number
  away_form_5: number
  home_gd_form_5: number
  away_gd_form_5: number
  h2h_home_ppg: number
}

export interface MatchPipeline {
  context: {
    homePlayed: number
    awayPlayed: number
    dataSufficiency: DataSufficiency
  }
  features: FeatureVector
  b0: Probs
  b1: Probs
  m1: Probs
  ensRaw: Probs
  calibrated: Probs
  calibratedT: number
  confidence: number
  confidenceLabel: ConfidenceLabel
  recommendation: Recommendation
  caveat: string | null
  secondary: {
    over25: number
    btts: number
    mostLikelyScore: string
  }
  reconciliation: {
    brierB1: number
    brierEns: number
    logLossB1: number
    logLossEns: number
    isCorrect: boolean
  }
}

export interface MatchRow {
  /** Position in the season's CHRONOLOGICAL order (1-based), used for display. */
  match_no: number
  /** Raw date cell exactly as it appeared in the source. Never overwritten. */
  date: string
  /**
   * Resolved kickoff instant, or null when the source carried no usable date.
   * This — not the physical row order — is what makes ordering deterministic.
   */
  kickoffIso?: string | null
  /** 1-based data-row position within its source file. Part of the dedupe identity. */
  rowIndex?: number
  /** Identity of the file this row came from. Part of the dedupe identity. */
  sourceFileId?: string | null
  home_team: string
  away_team: string
  ht_home_score: number | null
  ht_away_score: number | null
  home_score: number
  away_score: number
  total_goals: number
  btts: boolean
  outcome: Outcome
  pipeline?: MatchPipeline
}

export interface Season {
  id: string
  league: League
  seasonIndex: number
  name: string
  fileName: string
  createdAt: string
  contentHash: string | null
  countWarning: boolean
  actualMatchCount: number
  /**
   * Whether the match list is known-chronological or merely in source order.
   * `source-order` means at least one row had no usable date, so chronology is
   * assumed rather than proven.
   */
  orderMode?: MatchOrderMode
  /** How many matches resolved to a real kickoff instant. */
  datedMatchCount?: number
  matches: MatchRow[]
}

export interface CalibFit {
  fittedAtMatchIndex: number
  T: number
  ece: number
  sampleSize: number
}

export interface CalibrationState {
  T: number
  history: CalibFit[]
  ece: number | null
  lastComputedAt: string | null
}

export type CalibrationMap = Record<League, CalibrationState>
export type WeightMap = Record<League, Record<string, number>>
export type AliasMap = Record<League, Record<string, string>>
export type SeasonCounters = Record<League, number>

export interface WinmixSettings {
  historyScope: HistoryScope
  allowDuplicateImport: boolean
  debugInSampleT: boolean
}

export interface DiagnosticEntry {
  ts: string
  level: DiagnosticLevel
  message: string
}

export interface PersistedState {
  schemaVersion: number
  savedAt: string
  seasons: Season[]
  teamWeights: WeightMap
  teamAliasMap: AliasMap
  seasonCounters: SeasonCounters
  calibration: CalibrationMap
  settings: WinmixSettings
  round: FixtureRound
  slips: Slip[]
}

/** Deterministic ordering of a season's match list. */
export type MatchOrderMode = 'chronological' | 'source-order'

export type RowIssueKind =
  | 'structure'
  | 'missing_team'
  | 'invalid_score'
  | 'invalid_date'
  | 'header'

export interface SkippedRow {
  line: number
  reason: string
  kind?: RowIssueKind
}

export interface CsvParseStats {
  /** Data rows seen after the header, excluding blank lines. */
  dataRows: number
  accepted: number
  rejected: number
  /** Rows kept but with unusable half-time data cleared. */
  repaired: number
  /** Rows that resolved to a real kickoff instant. */
  dated: number
}

export interface ParsedCsv {
  matches: MatchRow[]
  skippedRows: SkippedRow[]
  /** Rows that were kept after non-fatal data was dropped. */
  repairedRows: SkippedRow[]
  stats: CsvParseStats
}

export interface LeagueDetection {
  league: League | 'unknown'
  confidence: number
  source: 'filename' | 'heuristic'
}

export interface StandingRow {
  key: string
  displayName: string
  played: number
  wins: number
  draws: number
  losses: number
  gf: number
  ga: number
  points: number
  homeAtt: number
  awayAtt: number
  weight: number
}

export interface H2HMatch {
  seasonName: string
  seasonId: string
  date: string
  home_team: string
  away_team: string
  ht_home_score: number | null
  ht_away_score: number | null
  home_score: number
  away_score: number
  total_goals: number
  btts: boolean
}

export interface H2HPair {
  id: string
  homeKey: string
  awayKey: string
  homeDisplay: string
  awayDisplay: string
  matches: H2HMatch[]
  played: number
  winsHome: number
  winsAway: number
  draws: number
  goalsHome: number
  goalsAway: number
  totalGoals: number
  avgGoals: number
  bttsPct: number
  over25Pct: number
  lastMeeting: H2HMatch | null
}

export interface EvalWindow {
  index: number
  from: number
  to: number
  logLossB1: number
  logLossEns: number
  brier: number
  skill: number
  ece: number
  sign: SignTestResult
}

export interface SignTestResult {
  wins: number
  losses: number
  ties: number
  n: number
  p: number
  z: number
  significant: boolean
  direction: 'ensemble_better' | 'b1_better' | 'none'
}

export interface TemperatureFit {
  T: number
  ece: number
  n: number
  avgLogLoss: number
}

/* ------------------------------------------------------------------ *
 * Part D — Fixture predictor, Top 3+1 pattern matcher, tip ledger
 * ------------------------------------------------------------------ */

export type PatternType =
  | 'safety_trend'
  | 'goal_market'
  | 'exact_score'
  | 'htft_reversal'
  | 'ht_market'
  | 'streak'
  | 'model_agreement'

export type PatternAgreement = 'agree' | 'conflict' | 'neutral'

/** One manually assembled slot of the weekly round (8 per league). */
export interface Fixture {
  id: string
  league: League
  slot: number
  homeKey: string | null
  awayKey: string | null
}

export interface FixtureRound {
  name: string
  createdAt: string
  fixtures: Fixture[]
}

/** H2H head-to-head record breakdown. */
export interface H2HRecord {
  homeWins: number
  draws: number
  awayWins: number
  total: number
  homeWinPct: number
  drawPct: number
  awayWinPct: number
  /** Length of the current home unbeaten run (0 if broken). */
  homeUnbeatenStreak: number
  /** Length of the current away unbeaten run (0 if broken). */
  awayUnbeatenStreak: number
}

/** Goal market frequencies derived from H2H meetings. */
export interface H2HGoalStats {
  avgGoals: number
  bttsPct: number
  over25Pct: number
  over15Pct: number
  over35Pct: number
}

/** Half-time dominance rates derived from H2H meetings with HT data. */
export interface H2HHtStats {
  /** Share of meetings where a goal was scored by HT. */
  htGoalRate: number
  htHomeLeadRate: number
  htDrawRate: number
  htAwayLeadRate: number
  /** Meetings with usable HT data out of total. */
  htSampleSize: number
}

/** Most-frequent exact scores in H2H history. */
export interface H2HModalScore {
  score: string
  count: number
  pct: number
}

/** HT/FT reversal statistics. */
export interface H2HReversalStats {
  turnaroundCount: number
  turnaroundRate: number
  /** Meetings with usable HT data (denominator). */
  htSampleSize: number
}

export interface PatternHit {
  id: string
  fixtureId: string
  fixtureLabel: string
  league: League
  type: PatternType
  /** Machine-gradable selection code, e.g. '1X', 'O2.5', 'CS:2-1', 'HTFT:REV'. */
  code: string
  label: string
  rawRate: number
  hitRate: number
  sample: number
  usedReverse: boolean
  sufficiency: DataSufficiency
  agreement: PatternAgreement
  stability: number
  impliedOdds: number
  weightApplied: number
  evidence: string[]
  /** H/D/V breakdown from the full H2H meeting pool. */
  headToHeadRecord: H2HRecord
  /** Goal market frequencies. Always populated when sample > 0. */
  goalStats: H2HGoalStats
  /** Half-time dominance rates. Null when HT coverage is insufficient. */
  htStats: H2HHtStats | null
  /** Top-3 most frequent exact scores. Empty array when sample = 0. */
  topModalScores: H2HModalScore[]
  /** HT/FT reversal rate. Null when HT coverage is insufficient. */
  reversalStats: H2HReversalStats | null
}

export interface FixtureAnalysis {
  fixtureId: string
  league: League
  slot: number
  homeKey: string
  awayKey: string
  homeDisplay: string
  awayDisplay: string
  label: string
  directMeetings: number
  reverseMeetings: number
  htCoverage: number
  probs: Probs
  confidence: number
  confidenceLabel: ConfidenceLabel
  recommendation: Recommendation
  mostLikelyScore: string
  over25: number
  btts: number
  sufficiency: DataSufficiency
  patterns: PatternHit[]
  notes: string[]
}

export type LineGrade = 'pending' | 'won' | 'lost'
export type SlipStatus = 'pending' | 'won' | 'partial' | 'lost'

/**
 * The four dedicated slip slots. `core` only appears in slips saved before the
 * roles were split out, and is rendered as a generic safety line.
 */
export type SlipRole = 'safety' | 'goals' | 'recurring' | 'joker' | 'core'

export interface SlipLine {
  id: string
  role: SlipRole
  fixtureLabel: string
  league: League
  type: PatternType
  code: string
  label: string
  stability: number
  hitRate: number
  sample: number
  htHome: number | null
  htAway: number | null
  ftHome: number | null
  ftAway: number | null
  /** H/D/V breakdown carried from the source PatternHit. */
  headToHeadRecord: H2HRecord
  /** Goal market frequencies carried from the source PatternHit. */
  goalStats: H2HGoalStats
  /** Half-time dominance rates; null when HT coverage was insufficient. */
  htStats: H2HHtStats | null
  /** Top-3 most frequent exact scores. */
  topModalScores: H2HModalScore[]
  /** HT/FT reversal stats; null when HT coverage was insufficient. */
  reversalStats: H2HReversalStats | null
}

export interface Slip {
  id: string
  createdAt: string
  roundName: string
  combinedProb: number
  lines: SlipLine[]
}

export interface PatternPerformance {
  type: PatternType
  issued: number
  settled: number
  hits: number
  hitRate: number | null
  smoothedRate: number
  weight: number
}

export type PatternWeightMap = Record<PatternType, number>
