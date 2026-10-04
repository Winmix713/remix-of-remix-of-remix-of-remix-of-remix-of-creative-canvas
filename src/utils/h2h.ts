import { canon } from './teams';
import type { H2HMatch, H2HPair, Season } from '../types/winmix';

/**
 * Cumulative, directed (home → away) head-to-head pairs across every loaded
 * season of a league. New uploads append to existing pairings.
 */
export function computeH2HPairs(
seasons: Season[],
aliases: Record<string, string>)
: H2HPair[] {
  const pairs = new Map<string, {homeKey: string;awayKey: string;matches: H2HMatch[];}>();

  seasons.forEach((season) => {
    season.matches.forEach((m) => {
      const homeKey = canon(m.home_team);
      const awayKey = canon(m.away_team);
      const key = `${homeKey}___${awayKey}`;
      if (!pairs.has(key)) pairs.set(key, { homeKey, awayKey, matches: [] });
      pairs.get(key)!.matches.push({
        seasonName: season.name,
        seasonId: season.id,
        date: m.date,
        home_team: m.home_team,
        away_team: m.away_team,
        ht_home_score: m.ht_home_score,
        ht_away_score: m.ht_away_score,
        home_score: m.home_score,
        away_score: m.away_score,
        total_goals: m.total_goals,
        btts: m.btts
      });
    });
  });

  return Array.from(pairs.entries()).
  map<H2HPair>(([id, pair]) => {
    const list = pair.matches;
    const n = list.length;
    let winsHome = 0;
    let winsAway = 0;
    let draws = 0;
    let goalsHome = 0;
    let goalsAway = 0;
    let bttsCount = 0;
    let over25Count = 0;

    list.forEach((m) => {
      goalsHome += m.home_score;
      goalsAway += m.away_score;
      if (m.home_score > m.away_score) winsHome++;else
      if (m.away_score > m.home_score) winsAway++;else
      draws++;
      if (m.btts) bttsCount++;
      if (m.total_goals > 2.5) over25Count++;
    });

    return {
      id,
      homeKey: pair.homeKey,
      awayKey: pair.awayKey,
      homeDisplay: aliases[pair.homeKey] ?? pair.homeKey,
      awayDisplay: aliases[pair.awayKey] ?? pair.awayKey,
      matches: list,
      played: n,
      winsHome,
      winsAway,
      draws,
      goalsHome,
      goalsAway,
      totalGoals: goalsHome + goalsAway,
      avgGoals: n > 0 ? (goalsHome + goalsAway) / n : 0,
      bttsPct: n > 0 ? bttsCount / n * 100 : 0,
      over25Pct: n > 0 ? over25Count / n * 100 : 0,
      lastMeeting: n > 0 ? list[n - 1] : null
    };
  }).
  sort((x, y) => y.played - x.played || x.homeDisplay.localeCompare(y.homeDisplay, 'hu'));
}

/** Last five results from the home team's point of view. */
export function h2hFormTail(pair: H2HPair): string[] {
  return pair.matches.slice(-5).map((m) => {
    if (m.home_score > m.away_score) return 'GY';
    if (m.home_score < m.away_score) return 'V';
    return 'D';
  });
}

export type FormResult = 'GY' | 'D' | 'V';

/**
 * One directed matchup folded into a team-centric verdict.
 *
 * The selected home → away orientation is the complete scope. Reverse fixtures
 * are deliberately excluded because they describe a different venue setup.
 */
export interface MatchupSummary {
  aDisplay: string;
  bDisplay: string;
  played: number;
  aWins: number;
  draws: number;
  bWins: number;
  aGoals: number;
  bGoals: number;
  totalGoals: number;
  avgGoals: number;
  bttsPct: number;
  over25Pct: number;
  /** Newest first. */
  matches: H2HMatch[];
  /** Last five results from A's point of view, newest last. */
  aForm: FormResult[];
  lastMeeting: H2HMatch | null;
}

function byDateDesc(a: H2HMatch, b: H2HMatch): number {
  if (a.date && b.date) return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
  return 0;
}

export function summarizeMatchup(
pairs: H2HPair[],
aKey: string,
bKey: string,
displayOf: (key: string) => string)
: MatchupSummary | null {
  const forward = pairs.find((p) => p.homeKey === aKey && p.awayKey === bKey) ?? null;
  if (!forward) return null;

  const matches = forward.matches;
  const played = matches.length;

  let aWins = 0;
  let bWins = 0;
  let draws = 0;
  let aGoals = 0;
  let bGoals = 0;
  let btts = 0;
  let over25 = 0;

  matches.forEach((m) => {
    const aScore = m.home_score;
    const bScore = m.away_score;
    aGoals += aScore;
    bGoals += bScore;
    if (aScore > bScore) aWins++;else
    if (aScore < bScore) bWins++;else
    draws++;
    if (m.btts) btts++;
    if (m.total_goals > 2.5) over25++;
  });

  const sorted = [...matches].sort(byDateDesc);
  const chronological = [...sorted].reverse();

  return {
    aDisplay: displayOf(aKey),
    bDisplay: displayOf(bKey),
    played,
    aWins,
    draws,
    bWins,
    aGoals,
    bGoals,
    totalGoals: aGoals + bGoals,
    avgGoals: played > 0 ? (aGoals + bGoals) / played : 0,
    bttsPct: played > 0 ? btts / played * 100 : 0,
    over25Pct: played > 0 ? over25 / played * 100 : 0,
    matches: sorted,
    aForm: chronological.slice(-5).map<FormResult>((m) => {
      if (m.home_score > m.away_score) return 'GY';
      if (m.home_score < m.away_score) return 'V';
      return 'D';
    }),
    lastMeeting: sorted[0] ?? null
  };
}