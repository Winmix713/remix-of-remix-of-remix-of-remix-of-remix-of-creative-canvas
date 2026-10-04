/**
 * Score integrity rules shared by every ingestion path (CSV and JSON import).
 *
 * PHASE 0 — why this module exists
 * --------------------------------
 * `parseInt` happily accepts `-1` and `99`, and only `NaN` was guarded, so an
 * impossible result flowed straight into the standings, the Poisson rates and
 * the calibration sample. Half-time scores were never checked against the final
 * score at all.
 *
 * Policy: a broken FINAL score makes the match unusable, so the row is
 * rejected with an explicit reason. A broken HALF-TIME score only invalidates
 * the optional HT data, so the match is kept and the HT fields are cleared —
 * we never discard a usable match over optional metadata.
 */

/** Hard upper bound per team. Above this the cell is data corruption, not football. */
export const MAX_GOALS_PER_TEAM = 20;

export type ScoreIssue =
'ft_unreadable' |
'ft_negative' |
'ft_non_integer' |
'ft_out_of_range' |
'ht_unreadable' |
'ht_partial' |
'ht_out_of_range' |
'ht_exceeds_ft';

export interface ScoreCheckInput {
  homeScore: number;
  awayScore: number;
  htHome: number | null;
  htAway: number | null;
}

export interface ScoreCheckResult {
  status: 'ok' | 'rejected' | 'repaired';
  issue: ScoreIssue | null;
  reason: string | null;
  /** Sanitised HT values — null when the HT data was dropped. */
  htHome: number | null;
  htAway: number | null;
}

function isValidGoals(value: number): boolean {
  return (
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_GOALS_PER_TEAM);

}

function reject(issue: ScoreIssue, reason: string): ScoreCheckResult {
  return { status: 'rejected', issue, reason, htHome: null, htAway: null };
}

function repair(issue: ScoreIssue, reason: string): ScoreCheckResult {
  return { status: 'repaired', issue, reason, htHome: null, htAway: null };
}

/**
 * Validates one match's scores.
 *
 * @returns `ok` (use as-is), `repaired` (keep the match, HT cleared) or
 *          `rejected` (drop the row, `reason` is user-facing Hungarian).
 */
export function checkScores(input: ScoreCheckInput): ScoreCheckResult {
  const { homeScore, awayScore, htHome, htAway } = input;

  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
    return reject('ft_unreadable', 'Érvénytelen/olvashatatlan végeredmény (home_score / away_score).');
  }
  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
    return reject('ft_non_integer', 'A végeredmény nem egész szám.');
  }
  if (homeScore < 0 || awayScore < 0) {
    return reject('ft_negative', `Negatív végeredmény (${homeScore}-${awayScore}) — érvénytelen adat.`);
  }
  if (homeScore > MAX_GOALS_PER_TEAM || awayScore > MAX_GOALS_PER_TEAM) {
    return reject(
      'ft_out_of_range',
      `Valószerűtlen végeredmény (${homeScore}-${awayScore}), a felső korlát ${MAX_GOALS_PER_TEAM} gól/csapat.`
    );
  }

  const hasHome = htHome !== null && htHome !== undefined;
  const hasAway = htAway !== null && htAway !== undefined;

  if (!hasHome && !hasAway) {
    return { status: 'ok', issue: null, reason: null, htHome: null, htAway: null };
  }
  if (hasHome !== hasAway) {
    return repair('ht_partial', 'Félbehagyott félidei eredmény (csak az egyik oldal) — a HT adat elhagyva.');
  }
  const h = htHome as number;
  const a = htAway as number;
  if (!Number.isFinite(h) || !Number.isFinite(a)) {
    return repair('ht_unreadable', 'Olvashatatlan félidei eredmény — a HT adat elhagyva.');
  }
  if (!isValidGoals(h) || !isValidGoals(a)) {
    return repair(
      'ht_out_of_range',
      `Érvénytelen félidei eredmény (${h}-${a}) — a HT adat elhagyva.`
    );
  }
  if (h > homeScore || a > awayScore) {
    return repair(
      'ht_exceeds_ft',
      `A félidei eredmény (${h}-${a}) meghaladja a végeredményt (${homeScore}-${awayScore}) — a HT adat elhagyva.`
    );
  }
  return { status: 'ok', issue: null, reason: null, htHome: h, htAway: a };
}

/**
 * Fixture + score signature, WITHOUT any date or row position.
 *
 * Used only to *report* how many undated rows look alike. It is deliberately
 * NOT a dedupe key: two undated 1-1 draws between the same teams are a normal
 * home/away pair, not a duplicate.
 */
export function fixtureSignature(input: {
  homeKey: string;
  awayKey: string;
  homeScore: number;
  awayScore: number;
}): string {
  return `${input.homeKey}|${input.awayKey}|${input.homeScore}-${input.awayScore}`;
}