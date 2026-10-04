/**
 * decision — the 2×2 DECISION MATRIX and every calibration BAND definition.
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * Probability and confidence are ORTHOGONAL. A forecast is never collapsed
 * into one scalar "score": a high probability standing on almost no
 * information, and a well-supported but flat distribution, are different
 * products and must be rendered differently. So a forecast lands in a
 * QUADRANT instead:
 *
 *   actionable — P ≥ pMin AND C ≥ cMin
 *   volatile   — P ≥ pMin but the information behind it is thin
 *   flat       — the information is solid, but there is no edge
 *   ignore     — neither
 *
 * TWO SEPARATE BAND SYSTEMS, DELIBERATELY NOT MERGED
 * --------------------------------------------------
 *  - {@link CONFIDENCE_BANDS} buckets by the CONFIDENCE SCORE and answers
 *    "did our high-confidence top picks land as often as we signalled?"
 *  - {@link MARKET_CALIBRATION_BANDS} buckets by the ESTIMATED PROBABILITY and
 *    answers "did the events we priced at 65–75% happen 65–75% of the time?"
 *
 * Both verdicts are read against a WILSON INTERVAL, never a point estimate:
 * a band is `calibrated` only when the signalled probability sits inside the
 * measured interval of the realized rate.
 */

import { wilsonInterval } from './bootstrap';
import { BAND_MIN_SAMPLE } from './constants';
import type {
  BandDiagnosis,
  ConfidenceBandKey,
  DecisionQuadrant,
  MarketBandTally,
  MarketCalibrationBand,
  MarketCalibrationBandKey,
  Outcome,
  Probs,
  ReliabilityBand,
  WilsonInterval } from
'../types/winmix';

/* -------------------------------------------------------------------------- *
 * Decision matrix cut-points
 * -------------------------------------------------------------------------- */

/**
 * One quadrant cut-point pair. `pMin` is on the 0–1 probability scale, `cMin`
 * on the 0–100 confidence scale. `ignorePMax` is an optional floor below which
 * a line is `ignore` even when its confidence term is satisfied.
 */
export interface DecisionThresholdSet {
  pMin: number;
  cMin: number;
  ignorePMax?: number;
}

/**
 * Default (1X2-based) cut-points. Named differently from `DecisionThresholdSet`
 * on purpose: this object is also embedded in `FORECAST_MODEL.decision`, where
 * `minProbability` / `minConfidence` are the load-bearing published names.
 * There is no ignore floor on the 1X2 system.
 */
export const DECISION_THRESHOLDS = Object.freeze({
  minProbability: 0.5,
  minConfidence: 56
});

/** Secondary (goal / HT-FT market) cut-points. Never loosened silently. */
const SECONDARY_MARKET_P_MIN = 0.58;
const SECONDARY_MARKET_C_MIN = 56;
const SECONDARY_MARKET_IGNORE_P_MAX = 0.5;

/**
 * Goal- and HT/FT-market cut-points, including BTTS. A market line may not sit
 * on a 1X2 confidence score, so it is judged on its own axes.
 */
export const SECONDARY_MARKET_THRESHOLDS: DecisionThresholdSet = Object.freeze({
  pMin: SECONDARY_MARKET_P_MIN,
  cMin: SECONDARY_MARKET_C_MIN,
  ignorePMax: SECONDARY_MARKET_IGNORE_P_MAX
});

/**
 * Place a (probability, confidence) pair in the decision matrix.
 *
 * `actionable ⟺ (P ≥ pMin) AND (C ≥ cMin)`. Otherwise: below `ignorePMax` the
 * line is `ignore`; a satisfied P alone is `volatile`; a satisfied C alone is
 * `flat`; neither is `ignore`.
 */
export function decisionQuadrantOf(
pTop: number,
confidence: number,
thresholds: DecisionThresholdSet = {
  pMin: DECISION_THRESHOLDS.minProbability,
  cMin: DECISION_THRESHOLDS.minConfidence
})
: DecisionQuadrant {
  const p = Number.isFinite(pTop) ? pTop : 0;
  const c = Number.isFinite(confidence) ? confidence : 0;
  const pOk = p >= thresholds.pMin;
  const cOk = c >= thresholds.cMin;

  if (pOk && cOk) return 'actionable';
  if (thresholds.ignorePMax !== undefined && p < thresholds.ignorePMax) return 'ignore';
  if (pOk) return 'volatile';
  if (cOk) return 'flat';
  return 'ignore';
}

/** Fixed render order of the quadrant legend. */
export const DECISION_ORDER: DecisionQuadrant[] = ['actionable', 'volatile', 'flat', 'ignore'];

export interface DecisionMeta {
  glyph: string;
  label: string;
  description: string;
  /** Tailwind classes for the badge surface. */
  tone: string;
  /**
   * CORE TIERING — the Core-surface label of this quadrant, or `null` when the
   * quadrant never reaches a Core slot. Deliberately NOT a general
   * "eligible" flag: only the Core selection surface may read it.
   */
  coreTierLabel?: string | null;
}

export const DECISION_META: Record<DecisionQuadrant, DecisionMeta> = {
  actionable: {
    glyph: '◆',
    label: 'Cselekvőképes',
    description:
    'Van kimutatható él, és van mögötte elegendő megbízható információ. ' +
    'Mindkét tengely teljesül egyszerre.',
    tone: 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30',
    coreTierLabel: 'Elsődleges core'
  },
  volatile: {
    glyph: '◈',
    label: 'Volatilis',
    description:
    'Az él megvan, de az információ-megbízhatóság a küszöb alatt van. ' +
    'Másodlagos, magasabb kockázatú core sor lehet — elsődlegest nem szorít ki.',
    tone: 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30',
    coreTierLabel: 'Másodlagos core / magasabb kockázat'
  },
  flat: {
    glyph: '▬',
    label: 'Lapos',
    description:
    'Az információ szilárd, de nincs kimutatható él. Nem hiba — csak nincs mire tenni.',
    tone: 'bg-slate-500/10 text-slate-300 ring-1 ring-slate-500/30',
    coreTierLabel: null
  },
  ignore: {
    glyph: '·',
    label: 'Elvetendő',
    description: 'Sem él, sem elegendő információ. A sor nem kerül döntési felületre.',
    tone: 'bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/30',
    coreTierLabel: null
  }
};

/* -------------------------------------------------------------------------- *
 * Band diagnosis copy
 * -------------------------------------------------------------------------- */

export const BAND_DIAGNOSIS_COPY: Record<BandDiagnosis, string> = {
  reliable: 'A sáv visszamért: a jelzett valószínűség a mért intervallumon belül van.',
  calibrated: 'Kalibrált: a jelzett valószínűség a tényleges beválás Wilson-intervallumán belül van.',
  overconfident: 'Túlzottan magabiztos: a jelzett valószínűség a mért beválás fölött van.',
  underconfident: 'Alulértékelt: a jelzett valószínűség a mért beválás alatt van.',
  noise: 'A minta túl szórt ahhoz, hogy a sávból következtetést vonjunk le.',
  insufficient: `A sáv még nem értékelhető — kevesebb, mint ${BAND_MIN_SAMPLE} auditált megfigyelés.`
};

/* -------------------------------------------------------------------------- *
 * Confidence bands — the 1X2 reliability table
 * -------------------------------------------------------------------------- */

export interface ConfidenceBandSpec {
  key: ConfidenceBandKey;
  label: string;
  /** Inclusive confidence-score bounds. */
  min: number;
  max: number;
  range: string;
}

export const CONFIDENCE_BANDS: readonly ConfidenceBandSpec[] = Object.freeze([
{ key: 'high', label: 'Magas', min: 76, max: 100, range: '76–100' },
{ key: 'good', label: 'Jó', min: 56, max: 75, range: '56–75' },
{ key: 'moderate', label: 'Közepes', min: 36, max: 55, range: '36–55' },
{ key: 'low', label: 'Alacsony', min: 0, max: 35, range: '0–35' }]
);

/** Which confidence band a 0–100 score falls into. */
export function bandOfConfidence(stability: number): ConfidenceBandKey {
  const score = Number.isFinite(stability) ? stability : 0;
  const hit = CONFIDENCE_BANDS.find((band) => score >= band.min && score <= band.max);
  return hit?.key ?? 'low';
}

/** One observation of the reliability table: what we signalled, what happened. */
export interface BandObservation {
  confidence: number;
  probs: Probs;
  outcome: Outcome;
}

function topPick(probs: Probs): {outcome: Outcome;p: number;} {
  const entries: Array<{outcome: Outcome;p: number;}> = [
  { outcome: 'H', p: probs.home },
  { outcome: 'D', p: probs.draw },
  { outcome: 'A', p: probs.away }];

  return entries.reduce((best, item) => item.p > best.p ? item : best, entries[0]);
}

function diagnoseBand(n: number, avgP: number, ci: WilsonInterval): BandDiagnosis {
  if (n < BAND_MIN_SAMPLE) return 'insufficient';
  if (avgP >= ci.lo && avgP <= ci.hi) return 'calibrated';
  return avgP > ci.hi ? 'overconfident' : 'underconfident';
}

/**
 * Empirical reliability of the TOP PICK, bucketed by confidence score.
 *
 * Every band carries its Wilson interval and an explicit `evaluable` flag: a
 * band under {@link BAND_MIN_SAMPLE} observations is reported, never judged.
 */
export function computeReliabilityBands(
observations: readonly BandObservation[])
: ReliabilityBand[] {
  return CONFIDENCE_BANDS.map((spec) => {
    const slice = observations.filter(
      (obs) => obs.confidence >= spec.min && obs.confidence <= spec.max
    );
    const n = slice.length;
    let hits = 0;
    let sumP = 0;
    slice.forEach((obs) => {
      const pick = topPick(obs.probs);
      sumP += pick.p;
      if (pick.outcome === obs.outcome) hits += 1;
    });

    const avgP = n === 0 ? 0 : sumP / n;
    const ci = wilsonInterval(hits, n);
    const hitRate = n === 0 ? 0 : hits / n;
    const evaluable = n >= BAND_MIN_SAMPLE;
    const diagnosis = diagnoseBand(n, avgP, ci);

    return {
      key: spec.key,
      label: spec.label,
      range: spec.range,
      n,
      hits,
      avgP,
      hitRate,
      gap: avgP - hitRate,
      ciLo: ci.lo,
      ciHi: ci.hi,
      calibrated: evaluable && diagnosis === 'calibrated',
      evaluable,
      diagnosis
    };
  });
}

/* -------------------------------------------------------------------------- *
 * Market calibration bands — bucketed by the PROBABILITY itself
 * -------------------------------------------------------------------------- */

export interface MarketCalibrationBandSpec {
  key: MarketCalibrationBandKey;
  label: string;
  /** Inclusive lower bound, exclusive upper bound (the last band closes at 1). */
  min: number;
  max: number;
}

export const MARKET_CALIBRATION_BANDS: readonly MarketCalibrationBandSpec[] = Object.freeze([
{ key: 'p00_20', label: '0–20%', min: 0, max: 0.2 },
{ key: 'p20_40', label: '20–40%', min: 0.2, max: 0.4 },
{ key: 'p40_55', label: '40–55%', min: 0.4, max: 0.55 },
{ key: 'p55_65', label: '55–65%', min: 0.55, max: 0.65 },
{ key: 'p65_75', label: '65–75%', min: 0.65, max: 0.75 },
{ key: 'p75_100', label: '75–100%', min: 0.75, max: 1 }]
);

/** Which probability band a 0–1 model probability falls into. */
export function marketBandOfProbability(p: number): MarketCalibrationBandKey {
  const value = Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0;
  const hit = MARKET_CALIBRATION_BANDS.find(
    (spec) => value >= spec.min && (value < spec.max || spec.max >= 1)
  );
  return hit?.key ?? 'p00_20';
}

/** The measured band belonging to one probability, or null when unmeasured. */
export function marketBandForProbability(
bands: readonly MarketCalibrationBand[] | null | undefined,
p: number)
: MarketCalibrationBand | null {
  if (!bands || bands.length === 0 || !Number.isFinite(p)) return null;
  const key = marketBandOfProbability(p);
  return bands.find((band) => band.key === key) ?? null;
}

/**
 * Verdict of ONE probability band. The signalled average is read against the
 * Wilson interval of the realized rate, so a thin band can never be judged.
 */
export function diagnoseMarketBand(n: number, avgP: number, ci: WilsonInterval): BandDiagnosis {
  return diagnoseBand(n, avgP, ci);
}

/** Turn additive per-band tallies into renderable, judged bands. */
export function marketBandsFromTallies(
tallies: Record<MarketCalibrationBandKey, MarketBandTally>)
: MarketCalibrationBand[] {
  return MARKET_CALIBRATION_BANDS.map((spec) => {
    const tally = tallies[spec.key] ?? { n: 0, sumP: 0, hits: 0 };
    const n = tally.n;
    const avgP = n === 0 ? 0 : tally.sumP / n;
    const ci = wilsonInterval(tally.hits, n);
    const hitRate = n === 0 ? 0 : tally.hits / n;
    const evaluable = n >= BAND_MIN_SAMPLE;
    const diagnosis = diagnoseMarketBand(n, avgP, ci);

    return {
      key: spec.key,
      label: spec.label,
      range: spec.label,
      n,
      hits: tally.hits,
      avgP,
      hitRate,
      gap: avgP - hitRate,
      ciLo: ci.lo,
      ciHi: ci.hi,
      calibrated: evaluable && diagnosis === 'calibrated',
      evaluable,
      diagnosis
    };
  });
}