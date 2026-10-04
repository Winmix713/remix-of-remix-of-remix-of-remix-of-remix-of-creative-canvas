/**
 * Synthetic generators with KNOWN ground truth — the suite's release gate.
 *
 * If the tests cannot separate these controlled generators, no conclusion drawn
 * on the 24 720 real matches may be trusted. Everything here is seeded; no
 * Math.random, no clock.
 */

import { mulberry32 } from '../../bootstrap';
import type { League, MatchRow, Outcome, Season } from '../../../types/winmix';

export interface SyntheticOptions {
  seed: number;
  teams: number;
  matches: number;
  /** Spread of the fixed latent team strengths. */
  strengthSpread: number;
  /** Home advantage on the latent scale. */
  homeAdvantage: number;
  /** Half-width of the draw band. */
  drawWidth: number;
  /**
   * Weight of the form term: latent += formStrength * (formHome − formAway),
   * where form is mean points over the last 5 matches. 0 = no form generator.
   */
  formStrength: number;
  league: League;
}

export const BASE_SYNTHETIC: SyntheticOptions = {
  seed: 424242,
  teams: 16,
  matches: 960,
  strengthSpread: 0.9,
  homeAdvantage: 0.25,
  drawWidth: 0.6,
  formStrength: 0,
  league: 'angol'
};

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

function tailMean(values: readonly number[], window: number): number {
  if (values.length === 0) return 0;
  const slice = values.slice(-window);
  return slice.reduce((a, c) => a + c, 0) / slice.length;
}

/**
 * Build one synthetic season whose generator structure is known exactly.
 * `formStrength > 0` means recent results genuinely feed back into the outcome
 * probability beyond fixed team strength.
 */
export function makeSyntheticSeason(
overrides: Partial<SyntheticOptions> = {})
: Season {
  const o = { ...BASE_SYNTHETIC, ...overrides };
  const rand = mulberry32(o.seed);

  const names = Array.from({ length: o.teams }, (_, i) => `T${String(i + 1).padStart(2, '0')}`);
  // Deterministic, evenly spread latent strengths.
  const strength = new Map<string, number>();
  names.forEach((n, i) => {
    strength.set(n, (i / (o.teams - 1) - 0.5) * 2 * o.strengthSpread);
  });

  const recentPoints = new Map<string, number[]>(names.map((n) => [n, []]));
  const matches: MatchRow[] = [];

  for (let i = 0; i < o.matches; i++) {
    const hi = Math.floor(rand() * o.teams) % o.teams;
    let ai = Math.floor(rand() * o.teams) % o.teams;
    if (ai === hi) ai = (ai + 1) % o.teams;
    const home = names[hi];
    const away = names[ai];

    const formHome = tailMean(recentPoints.get(home)!, 5);
    const formAway = tailMean(recentPoints.get(away)!, 5);
    const z =
    strength.get(home)! -
    strength.get(away)! +
    o.homeAdvantage +
    o.formStrength * (formHome - formAway);

    const pAway = sigmoid(-o.drawWidth - z);
    const pUpToDraw = sigmoid(o.drawWidth - z);
    const u = rand();
    const outcome: Outcome = u < pAway ? 'A' : u < pUpToDraw ? 'D' : 'H';

    const extra = Math.floor(rand() * 3);
    const homeScore = outcome === 'H' ? 1 + extra : outcome === 'D' ? extra : extra;
    const awayScore =
    outcome === 'A' ? 1 + extra : outcome === 'D' ? extra : Math.max(0, extra - 1);

    recentPoints.get(home)!.push(outcome === 'H' ? 3 : outcome === 'D' ? 1 : 0);
    recentPoints.get(away)!.push(outcome === 'A' ? 3 : outcome === 'D' ? 1 : 0);

    matches.push({
      match_no: i + 1,
      date: `2026-01-${String(i % 28 + 1).padStart(2, '0')}`,
      kickoffIso: null,
      home_team: home,
      away_team: away,
      ht_home_score: null,
      ht_away_score: null,
      home_score: homeScore,
      away_score: awayScore,
      total_goals: homeScore + awayScore,
      btts: homeScore > 0 && awayScore > 0,
      outcome
    });
  }

  return {
    id: `synthetic-${o.seed}-${o.formStrength}`,
    league: o.league,
    seasonIndex: 1,
    name: `Synthetic ${o.formStrength > 0 ? 'form' : 'no-form'}`,
    fileName: 'synthetic.csv',
    createdAt: '2026-01-01T00:00:00.000Z',
    contentHash: null,
    countWarning: false,
    actualMatchCount: matches.length,
    orderMode: 'source-order',
    datedMatchCount: 0,
    matches
  };
}
