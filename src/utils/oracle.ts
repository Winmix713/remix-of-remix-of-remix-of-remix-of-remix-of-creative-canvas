/**
 * oracle — the theoretical floor of this league's predictability.
 *
 * P0 MEASUREMENT FOUNDATION
 * -------------------------
 * Virtual-league fixtures are produced by a generator, so a hard lower bound
 * on log-loss exists: the ENTROPY of the generating distribution. No model,
 * however sophisticated, can beat it.
 *
 * The estimate deliberately CHEATS on time: it fits venue-specific attack and
 * defence rates from the FULL season set (oracle knowledge) and reads off the
 * mean entropy of the resulting per-match Poisson distribution. That is
 * legitimate precisely because the number is not a prediction — it is a
 * ceiling on how much headroom any prediction could ever have.
 *
 * If the honest as-of B1 Poisson already sits within
 * {@link ORACLE_SATURATION_GAP} of that floor, further model complexity buys
 * noise, not skill, and the UI says so.
 */

import { ORACLE_SATURATION_GAP } from './constants';
import { adaptiveMaxGoals, poissonPmfArray } from './stats';
import { canon } from './teams';
import type { EntropyFloorEstimate, MatchRow, Probs } from '../types/winmix';

/** Minimum matches before a floor estimate is meaningful at all. */
const MIN_MATCHES = 60;
/** Shrinkage toward the league mean, so a 2-game team cannot dominate. */
const SHRINK_K = 4;

interface VenueTotals {
  homeGames: number;
  homeScored: number;
  homeConceded: number;
  awayGames: number;
  awayScored: number;
  awayConceded: number;
}

function emptyTotals(): VenueTotals {
  return {
    homeGames: 0,
    homeScored: 0,
    homeConceded: 0,
    awayGames: 0,
    awayScored: 0,
    awayConceded: 0
  };
}

function shrunk(sum: number, games: number, leagueAvg: number): number {
  return (sum + SHRINK_K * leagueAvg) / (games + SHRINK_K);
}

function outcomeProbs(lambdaH: number, lambdaA: number): Probs {
  const maxGoals = Math.max(adaptiveMaxGoals(lambdaH), adaptiveMaxGoals(lambdaA));
  const pmfH = poissonPmfArray(lambdaH, maxGoals);
  const pmfA = poissonPmfArray(lambdaA, maxGoals);
  let home = 0;
  let draw = 0;
  let away = 0;
  for (let gh = 0; gh <= maxGoals; gh++) {
    for (let ga = 0; ga <= maxGoals; ga++) {
      const p = pmfH[gh] * pmfA[ga];
      if (gh > ga) home += p;else
      if (gh === ga) draw += p;else
      away += p;
    }
  }
  const s = home + draw + away;
  return { home: home / s, draw: draw / s, away: away / s };
}

function entropyOf(p: Probs): number {
  const terms = [p.home, p.draw, p.away];
  let h = 0;
  for (const v of terms) {
    if (v > 0) h += -v * Math.log(v);
  }
  return h;
}

/**
 * Estimates the entropy floor plus the honest gap to the current models.
 * Returns `null` when the sample is too small to say anything.
 */
export function estimateEntropyFloor(
matches: readonly MatchRow[])
: EntropyFloorEstimate | null {
  if (matches.length < MIN_MATCHES) return null;

  const totals = new Map<string, VenueTotals>();
  let homeGoals = 0;
  let awayGoals = 0;

  for (const m of matches) {
    const hk = canon(m.home_team);
    const ak = canon(m.away_team);
    const home = totals.get(hk) ?? emptyTotals();
    const away = totals.get(ak) ?? emptyTotals();
    home.homeGames++;
    home.homeScored += m.home_score;
    home.homeConceded += m.away_score;
    away.awayGames++;
    away.awayScored += m.away_score;
    away.awayConceded += m.home_score;
    totals.set(hk, home);
    totals.set(ak, away);
    homeGoals += m.home_score;
    awayGoals += m.away_score;
  }

  const leagueHomeGpm = homeGoals / matches.length;
  const leagueAwayGpm = awayGoals / matches.length;
  if (leagueHomeGpm <= 0 || leagueAwayGpm <= 0) return null;

  let entropySum = 0;
  let oracleLoss = 0;

  for (const m of matches) {
    const home = totals.get(canon(m.home_team));
    const away = totals.get(canon(m.away_team));
    if (!home || !away) continue;

    const homeAtt = shrunk(home.homeScored, home.homeGames, leagueHomeGpm);
    const homeDef = shrunk(home.homeConceded, home.homeGames, leagueAwayGpm);
    const awayAtt = shrunk(away.awayScored, away.awayGames, leagueAwayGpm);
    const awayDef = shrunk(away.awayConceded, away.awayGames, leagueHomeGpm);

    const lambdaH = Math.max(0.3, homeAtt * (awayDef / Math.max(0.5, leagueAwayGpm)));
    const lambdaA = Math.max(0.3, awayAtt * (homeDef / Math.max(0.5, leagueHomeGpm)));
    const probs = outcomeProbs(lambdaH, lambdaA);

    entropySum += entropyOf(probs);
    const actual =
    m.outcome === 'H' ? probs.home : m.outcome === 'D' ? probs.draw : probs.away;
    oracleLoss += -Math.log(Math.max(1e-6, actual));
  }

  const scored = matches.filter((m) => m.pipeline);
  const b1LogLoss = scored.length ?
  scored.reduce((a, m) => a + m.pipeline!.reconciliation.logLossB1, 0) / scored.length :
  null;
  const ensLogLoss = scored.length ?
  scored.reduce((a, m) => a + m.pipeline!.reconciliation.logLossEns, 0) / scored.length :
  null;

  const entropyFloor = entropySum / matches.length;
  const headroom = b1LogLoss === null ? null : b1LogLoss - entropyFloor;

  return {
    n: matches.length,
    entropyFloor,
    oracleLogLoss: oracleLoss / matches.length,
    b1LogLoss,
    ensLogLoss,
    headroom,
    saturated: headroom !== null && headroom < ORACLE_SATURATION_GAP,
    saturationGap: ORACLE_SATURATION_GAP
  };
}