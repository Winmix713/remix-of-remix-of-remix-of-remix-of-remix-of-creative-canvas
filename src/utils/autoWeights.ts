import { DEFAULT_WEIGHT } from './constants';
import { canon } from './teams';
import type { League, MatchRow } from '../types/winmix';

/**
 * PHASE 3 — empirical, venue-stratified team strength.
 *
 * This produces a RECOMMENDATION per canonical team key. The function remains
 * pure; callers decide whether to preview or apply the values. CSV ingestion
 * applies them automatically for every touched English or Spanish league,
 * while the operations surface still supports manual re-application.
 *
 * The math mirrors the `view_team_ratings` SQL view (see
 * docs/supabase-migration.md) EXACTLY, so the two can be cross-checked to two
 * decimal places on an identical dataset. If they diverge, one of them has a
 * bug — that cross-check is the Phase 1 go/no-go gate.
 */
export interface AutoWeightEntry {
  /** Mean goal difference in home fixtures only. */
  netHome: number;
  /** Mean goal difference in away fixtures only. */
  netAway: number;
  ppg: number;
  rawScore: number;
  homeGames: number;
  awayGames: number;
  /** 0.0–10.0, one decimal. A recommendation that callers may apply. */
  recommendedWeight: number;
}

/** Keyed by canonical team key — the same key space as `teamWeights[league]`. */
export type AutoWeightMap = Record<string, AutoWeightEntry>;

interface Acc {
  homeGames: number;
  awayGames: number;
  homeGf: number;
  homeGa: number;
  awayGf: number;
  awayGa: number;
  pts: number;
}

function blank(): Acc {
  return { homeGames: 0, awayGames: 0, homeGf: 0, homeGa: 0, awayGf: 0, awayGa: 0, pts: 0 };
}

/** League-prior points-per-game, used when a team has no completed fixtures. */
const PPG_PRIOR = 1.35;

/**
 * Venue-stratified strength, z-score standardized around the 5.0 midpoint and
 * clamped to [0, 10]. Deterministic and allocation-light: one pass over the
 * matches, one pass over the teams. No PRNG, no bootstrap — this is a
 * descriptive statistic, not an inference, so it never touches the seeded
 * Mulberry32 path.
 *
 * `matches` MUST already be filtered to the point in time being scored; this
 * function reads every row it is handed, so passing future fixtures would
 * violate as-of integrity at the CALL SITE, not here.
 */
export function computeAutoTeamWeights(
matches: readonly MatchRow[],
_league: League)
: AutoWeightMap {
  const stats = new Map<string, Acc>();

  for (const m of matches) {
    if (!Number.isFinite(m.home_score) || !Number.isFinite(m.away_score)) continue;
    const hKey = canon(m.home_team);
    const aKey = canon(m.away_team);
    if (!hKey || !aKey || hKey === aKey) continue;

    const h = stats.get(hKey) ?? blank();
    const a = stats.get(aKey) ?? blank();

    h.homeGames += 1;
    h.homeGf += m.home_score;
    h.homeGa += m.away_score;
    h.pts += m.home_score > m.away_score ? 3 : m.home_score === m.away_score ? 1 : 0;

    a.awayGames += 1;
    a.awayGf += m.away_score;
    a.awayGa += m.home_score;
    a.pts += m.away_score > m.home_score ? 3 : m.home_score === m.away_score ? 1 : 0;

    stats.set(hKey, h);
    stats.set(aKey, a);
  }

  const rows = Array.from(stats.entries()).map(([key, s]) => {
    const netHome = s.homeGames > 0 ? (s.homeGf - s.homeGa) / s.homeGames : 0;
    const netAway = s.awayGames > 0 ? (s.awayGf - s.awayGa) / s.awayGames : 0;
    const played = s.homeGames + s.awayGames;
    const ppg = played > 0 ? s.pts / played : PPG_PRIOR;
    const rawScore = 0.55 * netHome + 0.45 * netAway + 0.33 * ppg;
    return { key, netHome, netAway, ppg, rawScore, homeGames: s.homeGames, awayGames: s.awayGames };
  });

  if (rows.length === 0) return {};

  const mean = rows.reduce((acc, r) => acc + r.rawScore, 0) / rows.length;
  const variance = rows.reduce((acc, r) => acc + (r.rawScore - mean) ** 2, 0) / rows.length;
  // A degenerate spread (single team, or every team identical) must yield the
  // neutral midpoint rather than NaN — graceful degradation, never a throw.
  const std = Math.sqrt(variance) || 1;

  const out: AutoWeightMap = {};
  for (const r of rows) {
    const standardized = 5.0 + (r.rawScore - mean) / std * 1.75;
    const bounded = Math.min(10, Math.max(0, Math.round(standardized * 10) / 10));
    out[r.key] = {
      netHome: r.netHome,
      netAway: r.netAway,
      ppg: r.ppg,
      rawScore: r.rawScore,
      homeGames: r.homeGames,
      awayGames: r.awayGames,
      recommendedWeight: Number.isFinite(bounded) ? bounded : DEFAULT_WEIGHT
    };
  }
  return out;
}

/** How far a recommendation sits from the currently active weight. */
export function weightDelta(current: number, recommended: number): number {
  return Math.round((recommended - current) * 10) / 10;
}