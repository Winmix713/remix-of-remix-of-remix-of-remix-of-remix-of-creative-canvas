/**
 * RELEASE B — UNDERDOG ROLE AND THE UNDERDOG GOAL INDEX.
 *
 * No new model and no new data. The favourite/underdog role comes from the
 * feature vector's existing `weight_diff`, and the goal probability comes from
 * the same joint score matrix as everything else. The weight gap decides WHO
 * the underdog is; it is never evidence that the underdog scores, which is why
 * it carries no positive weight in the index below.
 *
 * The index is a RANKING AND EXPLANATION aid, not a prediction source. It is
 * withheld — with a state-specific sentence rather than one catch-all "no H2H"
 * message — whenever its inputs cannot support it.
 */

import { UNDERDOG_MIN_WEIGHT_GAP } from './constants';
import { H2H_ESS_HOT } from './patterns';
import { teamGoalCodeOf } from './marketCatalog';
import type { DecisionQuadrant, PatternHit, UnderdogInfo } from '../types/winmix';

export { UNDERDOG_MIN_WEIGHT_GAP };

/**
 * The underdog of a fixture, or `null` when the sides are too close to name one.
 *
 * @param weightDiff - `features.weight_diff`, i.e. wHome − wAway.
 */
export function underdogOf(params: {
  weightDiff: number;
  homeDisplay: string;
  awayDisplay: string;
  homeGoalProb: number;
  awayGoalProb: number;
}): UnderdogInfo | null {
  const { weightDiff, homeDisplay, awayDisplay, homeGoalProb, awayGoalProb } = params;
  if (!Number.isFinite(weightDiff)) return null;
  const gap = Math.abs(weightDiff);
  if (gap < UNDERDOG_MIN_WEIGHT_GAP) return null;

  const side: 'home' | 'away' = weightDiff < 0 ? 'home' : 'away';
  return {
    side,
    display: side === 'home' ? homeDisplay : awayDisplay,
    weightGap: gap,
    signedGap: weightDiff,
    goalProb: side === 'home' ? homeGoalProb : awayGoalProb,
    marketCode: teamGoalCodeOf(side)
  };
}

export type UnderdogIndexStatus =
'ok' |
'limited' |
'no_underdog' |
'no_h2h' |
'no_model_prob' |
'no_market_signal';

export interface UnderdogIndexResult {
  status: UnderdogIndexStatus;
  /** 0–10, or null whenever the index may not be shown. */
  index: number | null;
  /** The exact sentence to render instead of (or beside) the index. */
  message: string | null;
  /** Decomposition, so the surface can explain the number honestly. */
  terms: {
    modelProb: number | null;
    shrunkH2H: number | null;
    agreement: number | null;
    sufficiency: number | null;
  } | null;
}

/**
 * State-specific copy. The five conditions are not interchangeable, so they do
 * not share one message: a user must never read "no H2H sample" when the real
 * reason is that the two sides are evenly matched.
 */
const MESSAGES: Record<Exclude<UnderdogIndexStatus, 'ok'>, string> = {
  limited: 'Underdog-gól index korlátozott: hideg effektív H2H minta.',
  no_underdog: `Nincs egyértelmű underdog a beállított súlyküszöb alapján (min. ${UNDERDOG_MIN_WEIGHT_GAP.toFixed(1)} súlyeltérés).`,
  no_h2h: 'Underdog-gól index még nem értékelhető: nincs irányhelyes H2H minta.',
  no_model_prob:
  'Underdog-gól index még nem értékelhető: a piac modellvalószínűsége nem értelmezhető.',
  no_market_signal: 'Underdog-gól index nem javasolt: nincs használható piaci jel.'
};

const IDLE_MARKET_DECISIONS: DecisionQuadrant[] = ['flat', 'ignore'];

/**
 * Underdog Goal Index (0–10).
 *
 * Weights: model-implied team-goal probability 45%, shrunk directional H2H rate
 * 30%, model↔H2H agreement 15%, ESS data sufficiency 10%. The team-weight gap
 * gets no direct positive weight at all.
 */
export function underdogGoalIndex(params: {
  underdog: UnderdogInfo | null;
  /** The underdog side's own team-goal pattern, if the round produced one. */
  pattern: PatternHit | null;
  /** Model-implied probability that the underdog scores. */
  modelProb: number | null;
  /** Direct, orientation-correct H2H meetings behind the pattern. */
  directMeetings: number;
}): UnderdogIndexResult {
  const { underdog, pattern, modelProb, directMeetings } = params;
  const withoutIndex = (status: Exclude<UnderdogIndexStatus, 'ok' | 'limited'>) => ({
    status,
    index: null,
    message: MESSAGES[status],
    terms: null
  });

  if (!underdog) return withoutIndex('no_underdog');
  if (modelProb === null || !Number.isFinite(modelProb)) return withoutIndex('no_model_prob');
  if (directMeetings < 1 || !pattern) return withoutIndex('no_h2h');
  if (IDLE_MARKET_DECISIONS.includes(pattern.marketDecision ?? pattern.decision)) {
    return withoutIndex('no_market_signal');
  }

  const shrunkH2H = pattern.hitRate;
  const agreement = Math.max(0, 1 - Math.abs(shrunkH2H - modelProb) / 0.3);
  const sufficiency = Math.min(1, Math.max(0, pattern.effectiveSampleSize) / H2H_ESS_HOT);

  const raw = 0.45 * modelProb + 0.3 * shrunkH2H + 0.15 * agreement + 0.1 * sufficiency;
  const index = Math.round(Math.min(10, Math.max(0, raw * 10)) * 10) / 10;
  const cold = pattern.sufficiency === 'cold';

  return {
    status: cold ? 'limited' : 'ok',
    index,
    message: cold ? MESSAGES.limited : null,
    terms: { modelProb, shrunkH2H, agreement, sufficiency }
  };
}

/**
 * The diagnostic theoretical price, `1 / p`.
 *
 * DIAGNOSTIC ONLY. Until a market-specific out-of-sample evaluation confirms a
 * league and a market it is labelled "modellből számított elméleti szorzó" —
 * never "fair odds", and never anywhere near a value, EV or edge claim, which
 * would require timestamped pre-match external odds and margin handling.
 */
export function theoreticalPriceOf(p: number | null | undefined): number | null {
  if (typeof p !== 'number' || !Number.isFinite(p) || p <= 0) return null;
  return 1 / p;
}