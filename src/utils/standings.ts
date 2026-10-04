import { DEFAULT_WEIGHT } from './constants';
import { canon } from './teams';
import type { MatchRow, StandingRow } from '../types/winmix';

interface Accumulator {
  key: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  points: number;
  homeGf: number;
  homeM: number;
  awayGf: number;
  awayM: number;
}

function blank(key: string): Accumulator {
  return {
    key,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    gf: 0,
    ga: 0,
    points: 0,
    homeGf: 0,
    homeM: 0,
    awayGf: 0,
    awayM: 0
  };
}

/** Season table with venue attack strength and the active weight index. */
export function computeStandings(
matches: MatchRow[],
weights: Record<string, number>,
aliases: Record<string, string>)
: StandingRow[] {
  const teams = new Map<string, Accumulator>();

  matches.forEach((m) => {
    const hKey = canon(m.home_team);
    const aKey = canon(m.away_team);
    if (!teams.has(hKey)) teams.set(hKey, blank(hKey));
    if (!teams.has(aKey)) teams.set(aKey, blank(aKey));
    const h = teams.get(hKey)!;
    const a = teams.get(aKey)!;

    h.played++;
    a.played++;
    h.homeM++;
    a.awayM++;
    h.gf += m.home_score;
    h.ga += m.away_score;
    h.homeGf += m.home_score;
    a.gf += m.away_score;
    a.ga += m.home_score;
    a.awayGf += m.away_score;

    if (m.home_score > m.away_score) {
      h.wins++;
      h.points += 3;
      a.losses++;
    } else if (m.home_score === m.away_score) {
      h.draws++;
      h.points++;
      a.draws++;
      a.points++;
    } else {
      a.wins++;
      a.points += 3;
      h.losses++;
    }
  });

  return Array.from(teams.values()).
  map<StandingRow>((t) => ({
    key: t.key,
    displayName: aliases[t.key] ?? t.key,
    played: t.played,
    wins: t.wins,
    draws: t.draws,
    losses: t.losses,
    gf: t.gf,
    ga: t.ga,
    points: t.points,
    homeAtt: t.homeM > 0 ? t.homeGf / t.homeM : 0,
    awayAtt: t.awayM > 0 ? t.awayGf / t.awayM : 0,
    weight: weights[t.key] === undefined ? DEFAULT_WEIGHT : weights[t.key]
  })).
  sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    const gdY = y.gf - y.ga;
    const gdX = x.gf - x.ga;
    if (gdY !== gdX) return gdY - gdX;
    return y.gf - x.gf;
  });
}