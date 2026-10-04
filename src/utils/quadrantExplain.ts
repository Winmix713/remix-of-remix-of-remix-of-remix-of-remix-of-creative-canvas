/**
 * ACTIONABLE QUADRANT — the gate, fully unfolded, per candidate.
 *
 * WHY THIS EXISTS
 * ---------------
 * The core decision trace proved that the empty core cards are NOT a
 * calibration problem: several BTTS candidates are `Kalibrált` on 2000+ audited
 * observations and still never reach a card. The gate that actually removes
 * them is the actionable-quadrant hard gate — and the surface printed only its
 * VERDICT (`volatile`, `flat`, `ignore`), never its coordinates.
 *
 * This module prints the coordinates. For one pattern it reports:
 *   - which threshold set judged it (1X2 vs secondary-market),
 *   - what the two axes actually MEASURE (they are NOT model probability),
 *   - the candidate's own (P, C) coordinates,
 *   - the exact boolean condition, and which side of it is false,
 *   - the decomposition of C into its three terms, so the operator can see
 *     WHICH term collapsed,
 *   - the inverted requirement: the minimum H2H rate, the maximum tolerable
 *     model–H2H spread, and the minimum Kish ESS from which `actionable`
 *     becomes true, with the other terms held fixed.
 *
 * WHAT IT MAY NOT DO
 * ------------------
 * Strictly READ-ONLY, exactly like `coreTrace`. It introduces no threshold and
 * loosens none: every cut-point is imported from `utils/decision.ts`, and the
 * quadrant is re-derived with the SAME `decisionQuadrantOf` the gate calls, so
 * a disagreement between `quadrant` and `recomputed` is a bug in this file, not
 * a second opinion.
 *
 * FIX — `feasible` MUST AGREE WITH ITS OWN `note`
 * -------------------------------------------------
 * `needed.note` used to be built with a hardcoded `"actionable = true ettől: "`
 * prefix, appended UNCONDITIONALLY in front of whatever `parts` said — including
 * the branch whose entire content is "C ≥ cMin egyetlen tengely elmozdításával
 * sem érhető el" (the C axis cannot be reached by moving either underlying
 * term). The rendered sentence therefore read `actionable = true ettől: C ≥ 56
 * egyetlen tengely elmozdításával sem érhető el: ...` — a claim of reachability
 * directly glued to a statement of unreachability.
 *
 * Compounding this, `feasible` was computed as
 *   `parts.length > 0 && (inverted.maxSpread !== null || inverted.ess !== null || pOk)`
 * — the trailing `|| pOk` is a non sequitur: whether the P axis already clears
 * its own threshold says nothing about whether the C axis can be moved by a
 * single term. For a line where P already clears (`pOk === true`) but C is
 * unreachable (both `inverted.maxSpread` and `inverted.ess` are `null`), this
 * produced `feasible: true` for a case its own `note` calls unreachable.
 *
 * `feasible` is now derived from the SAME boolean (`cReachable`) that decides
 * which sentence gets built, so the two can never again disagree. The `!terms`
 * (pure 1X2) branch had the mirrored problem the other way around
 * (`pOk || !cOk` marks a P-only shortfall — always recoverable by more H2H
 * evidence — as `false`, and a C-only shortfall — explicitly undecomposable in
 * that branch's own text — as unconditionally `true`); since that branch never
 * asserts unreachability, it is now simply `feasible: true`, consistent with
 * what it actually tells the operator.
 */

import {
  DECISION_THRESHOLDS,
  SECONDARY_MARKET_THRESHOLDS,
  decisionQuadrantOf,
  type DecisionThresholdSet } from
'./decision';
import {
  MARKET_CONFIDENCE_CLAMP,
  MARKET_CONFIDENCE_EXPONENTS,
  MARKET_CONFIDENCE_SATURATION,
  MARKET_CONFIDENCE_TOLERANCE,
  marketConfidenceTerms,
  type MarketConfidenceTerms } from
'./patterns';
import type { DecisionQuadrant, PatternHit } from '../types/winmix';

/* -------------------------------------------------------------------------- *
 * The gate's own documentation — one place, quoted by the UI verbatim
 * -------------------------------------------------------------------------- */

export const QUADRANT_DOC = {
  computedIn: 'utils/decision.ts › decisionQuadrantOf(pTop, confidence, thresholds)',
  assignedIn:
  'utils/patterns.ts › buildPatterns — decision = decisionQuadrantOf(hitRate, stability); ' +
  'marketDecision = decisionQuadrantOf(hitRate, marketConfidence, SECONDARY_MARKET_THRESHOLDS)',
  gatedIn:
  'utils/slip.ts › coreQualityFailures → csak effectiveDecisionOf(pattern) === \u2019flat\u2019 ' +
  'vagy \u2019ignore\u2019 ad GateCondition \u2019decision\u2019 kizárást ' +
  '(actionable = elsődleges Core, volatile = másodlagos Core, mindkettő átjut)',
  xAxis:
  'P = a sor SÚLYOZOTT H2H beválási aránya (pattern.hitRate) — recency-súlyozott, ' +
  'zsugorított direkt H2H arány. NEM a modell valószínűsége.',
  yAxis:
  'C = információ-megbízhatóság. Gól- és HT/FT piacnál a PIACSPECIFIKUS ' +
  'marketConfidence (12–99), minden más családnál a stability (1–99).',
  formula:
  "actionable ⟺ (P ≥ pMin) ÉS (C ≥ cMin). Ha nem: P < ignorePMax → 'ignore'; " +
  "különben P ≥ pMin → 'volatile'; C ≥ cMin → 'flat'; egyébként 'ignore'.",
  confidenceFormula:
  `marketConfidence = clamp(${MARKET_CONFIDENCE_CLAMP.min}..${MARKET_CONFIDENCE_CLAMP.max}, ` +
  `round(100 × élesség^${MARKET_CONFIDENCE_EXPONENTS.sharpness} × ` +
  `elegendőség^${MARKET_CONFIDENCE_EXPONENTS.sufficiency} × ` +
  `egyezés^${MARKET_CONFIDENCE_EXPONENTS.agreement})), ahol ` +
  `élesség = |H2H − 50%| × 2 · elegendőség = min(1, Kish ESS / ${MARKET_CONFIDENCE_SATURATION}) · ` +
  `egyezés = max(0, 1 − |H2H − modell| / ${MARKET_CONFIDENCE_TOLERANCE})`,
  thresholds:
  `Gól- / HT-FT piac (BTTS is ide tartozik): pMin = ${SECONDARY_MARKET_THRESHOLDS.pMin}, ` +
  `cMin = ${SECONDARY_MARKET_THRESHOLDS.cMin}, ignorePMax = ${SECONDARY_MARKET_THRESHOLDS.ignorePMax}. ` +
  `Minden más család (1X2 alapú): pMin = ${DECISION_THRESHOLDS.minProbability}, ` +
  `cMin = ${DECISION_THRESHOLDS.minConfidence}, nincs ignore-padló.`,
  whyHard:
  'Miért kizáró kapu és nem rangsor-jel: a kvadráns nem „jobb vagy rosszabb" ' +
  'skála, hanem két ORTOGONÁLIS feltétel egyidejű teljesülése. A rangsor ' +
  'lexikografikus, tehát egy magas H2H% önmagában a lista élére emelne egy ' +
  'olyan sort is, amely mögött nincs elegendő súlyozott előzmény, vagy amely ' +
  'a saját modelljével áll szemben. Rangsor-jelként ezt a hiányt egy magas ' +
  'százalék elnyomná; kapuként nem tudja. A kalibráció ettől független ' +
  'kérdést válaszol meg: a sáv visszamérése azt mondja meg, hogy a JELZETT ' +
  'valószínűség reális-e, nem azt, hogy ennek a mérkőzésnek van-e elég ' +
  'súlyozott H2H alapja.'
} as const;

/* -------------------------------------------------------------------------- *
 * Per-candidate explanation
 * -------------------------------------------------------------------------- */

export type QuadrantSystem = 'market' | '1x2';

export interface QuadrantRequirement {
  /** Minimum weighted H2H rate that satisfies the P axis. */
  hitRate: number | null;
  /** Max tolerable |H2H − model| spread that lifts C to cMin (others fixed). */
  maxSpread: number | null;
  /** Minimum Kish ESS that lifts C to cMin (others fixed). */
  ess: number | null;
  /** Is `actionable` reachable at all by moving ONE term? */
  feasible: boolean;
  note: string;
}

export interface QuadrantExplain {
  system: QuadrantSystem;
  /** The quadrant the gate actually reads (`effectiveDecisionOf`). */
  quadrant: DecisionQuadrant;
  /** Re-derived here from the coordinates. Must equal `quadrant`. */
  recomputed: DecisionQuadrant;
  consistent: boolean;
  actionable: boolean;
  /** X axis. */
  p: number;
  pMin: number;
  pOk: boolean;
  pShortfall: number | null;
  pSource: string;
  /** Y axis. */
  c: number;
  cMin: number;
  cOk: boolean;
  cShortfall: number | null;
  cSource: string;
  ignorePMax: number | null;
  belowIgnoreFloor: boolean;
  /** Which side of the AND is false, in words. */
  failing: 'none' | 'p' | 'c' | 'both';
  terms: MarketConfidenceTerms | null;
  needed: QuadrantRequirement;
}

function isSecondary(pattern: PatternHit): boolean {
  return pattern.type === 'goal_market' || pattern.type === 'htft_reversal';
}

/** Mirrors `effectiveDecisionOf` in utils/slip.ts, without importing the slip. */
function effectiveQuadrant(pattern: PatternHit): DecisionQuadrant {
  return isSecondary(pattern) ? pattern.marketDecision ?? pattern.decision : pattern.decision;
}

/**
 * Inverts the confidence formula: with two terms held fixed, what value of the
 * third lifts the score to `cMin`?
 *
 * `round(raw × 100) ≥ cMin` ⟺ `raw ≥ (cMin − 0.5) / 100`, and
 * `raw = s^0.5 × f^0.3 × a^0.2`, so each term inverts in closed form.
 */
function invertConfidence(
terms: MarketConfidenceTerms,
cMin: number)
: {maxSpread: number | null;ess: number | null;} {
  const target = (cMin - 0.5) / 100;
  const { sharpness: es, sufficiency: ef, agreement: ea } = MARKET_CONFIDENCE_EXPONENTS;
  const s = Math.pow(terms.sharpness, es);
  const f = Math.pow(terms.sufficiency, ef);
  const a = Math.pow(terms.agreement, ea);

  // Agreement needed, with sharpness and sufficiency as they are.
  let maxSpread: number | null = null;
  if (s > 0 && f > 0) {
    const needAgreement = Math.pow(target / (s * f), 1 / ea);
    if (needAgreement <= 1) {
      maxSpread = Math.max(0, terms.tolerance * (1 - needAgreement));
    }
  }

  // Sufficiency (i.e. Kish ESS) needed, with sharpness and agreement as they are.
  let ess: number | null = null;
  if (s > 0 && a > 0) {
    const needSufficiency = Math.pow(target / (s * a), 1 / ef);
    if (needSufficiency <= 1) {
      ess = needSufficiency * terms.saturation;
    }
  }

  return { maxSpread, ess };
}

export function explainQuadrant(pattern: PatternHit): QuadrantExplain {
  const secondary = isSecondary(pattern);
  const thresholds: DecisionThresholdSet = secondary ?
  SECONDARY_MARKET_THRESHOLDS :
  { pMin: DECISION_THRESHOLDS.minProbability, cMin: DECISION_THRESHOLDS.minConfidence };

  const p = pattern.hitRate;
  const modelProb = pattern.modelProb ?? null;
  const hasMarketAxis = secondary && modelProb !== null;
  const c = secondary ? pattern.marketConfidence : pattern.stability;

  const pMin = thresholds.pMin;
  const cMin = thresholds.cMin;
  const pOk = p >= pMin;
  const cOk = c >= cMin;

  const terms = hasMarketAxis ?
  marketConfidenceTerms(p, modelProb as number, pattern.effectiveSampleSize) :
  null;

  const quadrant = effectiveQuadrant(pattern);
  const recomputed = decisionQuadrantOf(p, c, thresholds);

  const requirement: QuadrantRequirement = (() => {
    if (pOk && cOk) {
      return {
        hitRate: null,
        maxSpread: null,
        ess: null,
        feasible: true,
        note: 'Mindkét tengely teljesül — ez a sor a kvadráns-kapun belül van.'
      };
    }
    const hitRate = pOk ? null : pMin;
    if (!terms) {
      // No decomposition exists on the 1X2 axis, so this branch never claims
      // reachability OR unreachability of C — it only states the raw
      // requirement. `feasible` must therefore not swing on `pOk`/`cOk`
      // (previously `pOk || !cOk`, which called a P-only shortfall
      // unreachable and a C-only shortfall always reachable — backwards on
      // both counts relative to what the sentence itself says).
      return {
        hitRate,
        maxSpread: null,
        ess: null,
        feasible: true,
        note:
        `A C tengely itt a stability (${c}), amely a H2H arányból, a modell-egyezés ` +
        `faktorából és a pattern-súlyból áll össze — nem bontható egyetlen ` +
        `bemenetre. A kapuhoz C ≥ ${cMin} kell${pOk ? '' : `, és P ≥ ${(pMin * 100).toFixed(0)}%`}.`
      };
    }
    const inverted = invertConfidence(terms, cMin);
    const parts: string[] = [];
    // Whether the C axis specifically can be lifted to cMin by moving ONE of
    // its own underlying terms. Defaults to true: if C already clears cMin
    // (`cOk`), there is nothing to reach, and "P alone needs to move" is
    // always achievable in principle by more/better H2H evidence — it is only
    // C's OWN decomposition that can come back genuinely unreachable.
    let cReachable = true;
    if (!pOk) {
      parts.push(`P ≥ ${(pMin * 100).toFixed(0)}% (jelenleg ${(p * 100).toFixed(1)}%)`);
    }
    if (!cOk) {
      if (inverted.maxSpread !== null) {
        parts.push(
          `|H2H − modell| ≤ ${(inverted.maxSpread * 100).toFixed(1)} százalékpont ` +
          `(jelenleg ${(terms.spread * 100).toFixed(1)} pp)`
        );
      }
      if (inverted.ess !== null) {
        parts.push(
          `Kish ESS ≥ ${inverted.ess.toFixed(2)} (jelenleg ${pattern.effectiveSampleSize.toFixed(2)})`
        );
      }
      if (inverted.maxSpread === null && inverted.ess === null) {
        cReachable = false;
        parts.push(
          `C ≥ ${cMin} egyetlen tengely elmozdításával sem érhető el: az élesség ` +
          `(${terms.sharpness.toFixed(2)}), az elegendőség (${terms.sufficiency.toFixed(2)}) ` +
          `és az egyezés (${terms.agreement.toFixed(2)}) együtt túl alacsony`
        );
      }
    }
    // `feasible` and the sentence prefix now read the SAME boolean, so they
    // can never again disagree the way `actionable = true ettől: ... sem
    // érhető el` did.
    return {
      hitRate,
      maxSpread: inverted.maxSpread,
      ess: inverted.ess,
      feasible: cReachable,
      note: cReachable ?
      `actionable = true ettől: ${parts.join(' · ')}.` :
      `actionable EBBŐL A HELYZETBŐL NEM ÉRHETŐ EL egyetlen tengely ` +
      `elmozdításával sem: ${parts.join(' · ')}.`
    };
  })();

  return {
    // The THRESHOLD system, not the availability of the decomposition: a goal
    // line without a model reference is still judged on the secondary cut-points.
    system: secondary ? 'market' : '1x2',
    quadrant,
    recomputed,
    consistent: quadrant === recomputed,
    actionable: quadrant === 'actionable',
    p,
    pMin,
    pOk,
    pShortfall: pOk ? null : pMin - p,
    pSource: 'pattern.hitRate — súlyozott, zsugorított direkt H2H arány',
    c,
    cMin,
    cOk,
    cShortfall: cOk ? null : cMin - c,
    cSource: hasMarketAxis ?
    'pattern.marketConfidence — piacspecifikus (élesség × elegendőség × egyezés)' :
    secondary ?
    'pattern.marketConfidence = stability (nincs modell-referencia ehhez a kódhoz)' :
    'pattern.stability — H2H% × egyezés-faktor × pattern-súly',
    ignorePMax: thresholds.ignorePMax ?? null,
    belowIgnoreFloor:
    thresholds.ignorePMax !== undefined ? p < thresholds.ignorePMax : false,
    failing: pOk && cOk ? 'none' : !pOk && !cOk ? 'both' : pOk ? 'c' : 'p',
    terms,
    needed: requirement
  };
}