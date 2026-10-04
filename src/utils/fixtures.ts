import { SLOTS_PER_LEAGUE } from './constants';
import { LEAGUES } from '../data/leagues';
import {
  forecastCore,
  leagueGoalsPerMatch,
  type ForecastHistoryEntry,
  type LeagueGoalsPerMatch } from
'./forecastCore';
import { finalizeMatchOrder } from './matchDate';
import { canon, displayNameOf } from './teams';
import type {
  ConfidenceLabel,
  DataSufficiency,
  DecisionQuadrant,
  FeatureVector,
  Fixture,
  FixtureRound,
  League,
  M1Fit,
  Probs,
  Recommendation,
  Season } from
'../types/winmix';

export interface TeamOption {
  key: string;
  display: string;
  played: number;
}

/** Re-exported so callers keep a single history-entry shape. */
export type HistoryEntry = ForecastHistoryEntry;

export interface LeagueHistory {
  entries: HistoryEntry[];
  leagueHomeGpm: number;
  leagueAwayGpm: number;
}

export interface FixtureForecast {
  probs: Probs;
  b1: Probs;
  m1: Probs;
  features: FeatureVector;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  /** Quadrant of the 2×2 decision matrix. Never a P × C product. */
  decision: DecisionQuadrant;
  /** Whether M1 ran on fitted or cold-start coefficients. */
  m1Source: 'fitted' | 'manual';
  recommendation: Recommendation;
  caveat: string | null;
  /**
   * Goal markets, all marginals of the SAME joint score matrix as `probs` —
   * so a pattern can be scored against the model without any risk of the two
   * describing different matches.
   */
  over15: number;
  over25: number;
  over35: number;
  btts: number;
  /**
   * RELEASE A — model-implied team-goal probabilities. Same matrix, same pass;
   * no separate estimate and no market-specific calibration attached to them
   * before the Release C evaluation confirms one.
   */
  homeOver05: number;
  homeUnder05: number;
  awayOver05: number;
  awayUnder05: number;
  /**
   * BTTS CORE PROFILE — model-implied one-sided blowout risk, marginals of the
   * same joint matrix. `cleanSheetBlowout` is the primary Core-risk signal:
   * P(a margin of 3+ goals with one side kept scoreless).
   */
  highGoalNoBtts: number;
  cleanSheetBlowout: number;
  mostLikelyScore: string;
  sufficiency: DataSufficiency;
  homePlayed: number;
  awayPlayed: number;
}

function todayLabel(): string {
  return new Date().toISOString().slice(0, 10);
}

export function defaultRoundName(): string {
  return `Forduló — ${todayLabel()}`;
}

/** A fresh, empty 8 + 8 round skeleton. */
export function emptyRound(): FixtureRound {
  const fixtures: Fixture[] = [];
  LEAGUES.forEach((league) => {
    for (let slot = 1; slot <= SLOTS_PER_LEAGUE; slot++) {
      fixtures.push({ id: `${league}-${slot}`, league, slot, homeKey: null, awayKey: null });
    }
  });
  return { name: defaultRoundName(), createdAt: new Date().toISOString(), fixtures };
}

/** Guarantees a persisted round still has exactly 8 slots per league. */
export function sanitizeRound(round: FixtureRound | undefined | null): FixtureRound {
  const base = emptyRound();
  if (!round || !Array.isArray(round.fixtures)) return base;
  const byId = new Map(round.fixtures.map((f) => [f.id, f]));
  return {
    name: round.name || base.name,
    createdAt: round.createdAt || base.createdAt,
    fixtures: base.fixtures.map((f) => {
      const found = byId.get(f.id);
      return found ?
      { ...f, homeKey: found.homeKey ?? null, awayKey: found.awayKey ?? null } :
      f;
    })
  };
}

export function fixturesOf(round: FixtureRound, league: League): Fixture[] {
  return round.fixtures.filter((f) => f.league === league).sort((a, b) => a.slot - b.slot);
}

export function isComplete(fixture: Fixture): boolean {
  return Boolean(fixture.homeKey && fixture.awayKey && fixture.homeKey !== fixture.awayKey);
}

export function completedFixtures(round: FixtureRound): Fixture[] {
  return round.fixtures.filter(isComplete);
}

/** Team keys already used inside one league's column — the dynamic exclusion set. */
export function usedTeamKeys(round: FixtureRound, league: League): Set<string> {
  const used = new Set<string>();
  fixturesOf(round, league).forEach((f) => {
    if (f.homeKey) used.add(f.homeKey);
    if (f.awayKey) used.add(f.awayKey);
  });
  return used;
}

/**
 * Every team that actually appears in the loaded seasons of a league.
 *
 * Display names are the exact uploaded spellings (accents and casing intact);
 * `key` is the internal canonical key. See `utils/teams.ts`.
 */
export function buildTeamPool(
seasons: Season[],
league: League,
aliases: Record<string, string>)
: TeamOption[] {
  const counts = new Map<string, number>();
  const firstSeen = new Map<string, string>();
  seasons.
  filter((s) => s.league === league).
  forEach((s) =>
  s.matches.forEach((m) => {
    ;[m.home_team, m.away_team].forEach((name) => {
      const key = canon(name);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (!firstSeen.has(key)) firstSeen.set(key, name);
    });
  })
  );
  return Array.from(counts.entries()).
  map<TeamOption>(([key, played]) => ({
    key,
    display: displayNameOf(aliases, key, firstSeen.get(key)),
    played
  })).
  sort((a, b) => a.display.localeCompare(b.display, 'hu'));
}

/**
 * Flattens a league into one chronologically ordered history.
 *
 * Seasons are ordered by creation, and each season's matches are ordered by
 * resolved kickoff instant (falling back to source order when the season is not
 * fully dated) — the same ordering the audit pipeline uses.
 */
export function buildLeagueHistory(seasons: readonly Season[], league: League): LeagueHistory {
  const entries: HistoryEntry[] = [];
  seasons.
  filter((s) => s.league === league).
  slice().
  sort(
    (a, b) =>
    (a.createdAt || '').localeCompare(b.createdAt || '') || a.seasonIndex - b.seasonIndex
  ).
  forEach((s) =>
  finalizeMatchOrder(s.matches).matches.forEach((m) =>
  entries.push({ homeKey: canon(m.home_team), awayKey: canon(m.away_team), match: m })
  )
  );

  const gpm: LeagueGoalsPerMatch = leagueGoalsPerMatch(entries);
  return { entries, leagueHomeGpm: gpm.home, leagueAwayGpm: gpm.away };
}

/* -------------------------------------------------------------------------- */
/* Cold-start diagnostics                                                     */
/* -------------------------------------------------------------------------- */

const IS_DEV =
(import.meta as unknown as {env?: Record<string, unknown>;}).env?.DEV === true;

/** Leagues already warned about in the current analysis run. */
const coldStartWarned = new Set<string>();

/**
 * Called at the start of every round analysis so each run reports cold-start
 * mode once per league instead of once per fixture.
 */
export function resetColdStartWarnings(): void {
  coldStartWarned.clear();
}

function warnColdStart(league?: League): void {
  if (!IS_DEV) return;
  const key = league ?? '_unknown';
  if (coldStartWarned.has(key)) return;
  coldStartWarned.add(key);
  console.warn(
    `[predictFixture] ${key}: no m1Fit provided — the tip is using COLD-START ` +
    'M1 logits, not the coefficients the audit walk converged on. The tip and ' +
    'the measured accuracy therefore describe different models.'
  );
}

/**
 * "What if" forecast for a match that has not been played.
 *
 * PHASE 0: this used to be a verbatim second copy of the pipeline's Stage 1–6
 * math. It now delegates to the shared {@link forecastCore}, so the accuracy
 * measured on the Audit screen is by construction the accuracy of the model
 * that produces these tips. The only difference between the two call sites is
 * the history slice: the audit passes strictly-prior matches, this passes
 * everything currently known.
 *
 * PHASE 0 FOLLOW-UP (closed): `forecastCore`'s Stage 2 baseline supports an
 * optional Dixon-Coles low-score correction (`dixonColesRho`), consumed by
 * {@link computeJointScoreDistribution}. Until now this predictor never
 * forwarded it, so whenever the experiment branch tuned and enabled a
 * validated rho on the audit side, the forward-looking tip silently kept
 * using the independent-Poisson grid (`rho = 0`) — the exact audit/prediction
 * split PHASE 0 was written to eliminate, just reopened one parameter later.
 *
 * `dixonColesRho` is therefore now a first-class, pass-through parameter here,
 * mirroring `m1Fit` and `ensembleWM1`: the caller decides whether a validated
 * value exists (see `utils/experiments/dixonColes.ts`), this function's only
 * job is to make sure that decision reaches `forecastCore` unchanged.
 *
 * CONSEQUENCE OF OMISSION — read this before calling without `m1Fit`:
 * omitting `m1Fit` does NOT fall back to the audited model, it silently
 * switches the tip to COLD-START logits (`m1Source: 'manual'`). Likewise a
 * missing `ensembleWM1` reverts to the constant default instead of the tuned
 * weight, and a missing `dixonColesRho` reverts to independent Poisson. In all
 * three cases the tip and the accuracy measured on the Audit screen describe
 * DIFFERENT models. A dev-mode warning is emitted for the `m1Fit` case so the
 * regression cannot happen quietly again.
 */
export function predictFixture(params: {
  history: LeagueHistory;
  homeKey: string;
  awayKey: string;
  weights: Record<string, number>;
  T: number;
  /** The M1 coefficients the audit walk ended on, so tips use the same model. */
  m1Fit?: M1Fit | null;
  ensembleWM1?: number;
  /**
   * Diagnostics only — never touches the math. Used solely to throttle the
   * cold-start warning to one message per league per analysis run.
   */
  league?: League;
  /**
   * Dixon-Coles low-score dependence coefficient. Pass the SAME value the
   * audit walk used for this league (only ever non-null once its prequential
   * bootstrap interval has excluded zero) so a tip and its measured accuracy
   * always describe the same model. Omitted or `null` reproduces the
   * independent-Poisson baseline exactly, matching the previous behaviour.
   */
  dixonColesRho?: number | null;
}): FixtureForecast {
  const { history, homeKey, awayKey, weights, T, m1Fit, ensembleWM1, dixonColesRho } = params;

  if (!m1Fit) warnColdStart(params.league);

  const result = forecastCore({
    entries: history.entries,
    homeKey,
    awayKey,
    weights,
    T,
    m1Fit,
    ensembleWM1,
    dixonColesRho,
    leagueGpm: { home: history.leagueHomeGpm, away: history.leagueAwayGpm }
  });

  return {
    probs: result.calibrated,
    b1: result.b1,
    m1: result.m1,
    features: result.features,
    confidence: result.confidence,
    confidenceLabel: result.confidenceLabel,
    decision: result.decision,
    m1Source: result.m1Source,
    recommendation: result.recommendation,
    caveat: result.caveat,
    over15: result.secondary.over15,
    over25: result.secondary.over25,
    over35: result.secondary.over35,
    btts: result.secondary.btts,
    homeOver05: result.secondary.homeOver05,
    homeUnder05: result.secondary.homeUnder05,
    awayOver05: result.secondary.awayOver05,
    awayUnder05: result.secondary.awayUnder05,
    highGoalNoBtts: result.secondary.highGoalNoBtts,
    cleanSheetBlowout: result.secondary.cleanSheetBlowout,
    mostLikelyScore: result.secondary.mostLikelyScore,
    sufficiency: result.dataSufficiency,
    homePlayed: result.homePlayed,
    awayPlayed: result.awayPlayed
  };
}