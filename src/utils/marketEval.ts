/**
 * RELEASE C — MARKET-SPECIFIC, OUT-OF-SAMPLE MARKET EVALUATION.
 *
 * WHAT THIS CLOSES
 * ----------------
 * Until now every pattern family was gated on the 1X2 reliability bands
 * (`bandOfConfidence(stability)`), so the `bandCalibrated` flag on a BTTS or an
 * Over line never meant "this market's probabilities are calibrated". This
 * module measures what the flag claims: for one market code, how often did the
 * events the model priced at p actually happen?
 *
 * THREE RULES THAT ARE NOT NEGOTIABLE
 * -----------------------------------
 * 1. The unit of measurement is the MODEL-IMPLIED PROBABILITY and the REALIZED
 *    OUTCOME. Not `stability`, not `marketConfidence`, not the H2H hit rate —
 *    those measure the sharpness and support of the H2H SIGNAL, a separate
 *    layer that never substitutes for probability calibration.
 * 2. The probability must come from the match's AS-OF pre-match state. The
 *    pipeline walk is prequential, so feeding it a stored `pipeline.secondary`
 *    is genuinely out-of-sample; recomputing p from today's model would not be.
 *    This is precisely why a contract-version bump forces a full chronological
 *    rebuild instead of back-filling.
 * 3. A market that can be SELECTED must be MEASURED. All four team-goal codes
 *    are Joker-selectable from the first release, so all four are registered
 *    here — the Under lines included, because they populate different
 *    probability bands than their Over complements and can carry a different
 *    systematic error.
 */

import { BAND_MIN_SAMPLE } from './constants';
import { marketBandsFromTallies, MARKET_CALIBRATION_BANDS } from './decision';
import { marketBandOfProbability } from './decision';
import { EVALUATED_MARKET_CODES, type EvaluatedMarketCode } from './marketCatalog';
import type {
  MarketBandTally,
  MarketCalibrationReport,
  MarketCalibrationState,
  MarketCalibrationVerdict,
  MarketTally,
  MarketTallyMap,
  MatchPipeline,
  MatchRow } from
'../types/winmix';

type Secondary = MatchPipeline['secondary'];

/** The realized score of a settled match — the only outcome input needed. */
export interface SettledScore {
  home_score: number;
  away_score: number;
}

export interface MarketEvalSpec {
  market: EvaluatedMarketCode;
  label: string;
  /**
   * Model-implied probability, read from a settled match's AS-OF pipeline
   * record. Returns `undefined` for records written before the market existed —
   * those observations are skipped rather than guessed.
   */
  probOf: (secondary: Secondary) => number | undefined;
  /** Did the market actually land? */
  hitOf: (score: SettledScore) => boolean;
}

/**
 * The typed central register, keyed on the Phase 0 market codes. Every other
 * Over/Under line can be switched on here later with no change anywhere else.
 */
export const MARKET_EVAL_SPECS: Record<EvaluatedMarketCode, MarketEvalSpec> = {
  BTTS: {
    market: 'BTTS',
    label: 'Mindkét csapat szerez gólt',
    probOf: (s) => s.btts,
    hitOf: (m) => m.home_score > 0 && m.away_score > 0
  },
  'O2.5': {
    market: 'O2.5',
    label: '2,5 gól felett',
    probOf: (s) => s.over25,
    hitOf: (m) => m.home_score + m.away_score > 2.5
  },
  'HOME_O0.5': {
    market: 'HOME_O0.5',
    label: 'Hazai csapat gólt szerez',
    probOf: (s) => s.homeOver05,
    hitOf: (m) => m.home_score > 0
  },
  'HOME_U0.5': {
    market: 'HOME_U0.5',
    label: 'Hazai csapat nem szerez gólt',
    probOf: (s) => s.homeUnder05,
    hitOf: (m) => m.home_score === 0
  },
  'AWAY_O0.5': {
    market: 'AWAY_O0.5',
    label: 'Vendég csapat gólt szerez',
    probOf: (s) => s.awayOver05,
    hitOf: (m) => m.away_score > 0
  },
  'AWAY_U0.5': {
    market: 'AWAY_U0.5',
    label: 'Vendég csapat nem szerez gólt',
    probOf: (s) => s.awayUnder05,
    hitOf: (m) => m.away_score === 0
  }
};

export const MARKET_EVAL_SPEC_LIST: readonly MarketEvalSpec[] = EVALUATED_MARKET_CODES.map(
  (code) => MARKET_EVAL_SPECS[code]
);

export function marketEvalSpecOf(code: string): MarketEvalSpec | null {
  return (MARKET_EVAL_SPECS as Record<string, MarketEvalSpec>)[code] ?? null;
}

function emptyBandTallies(): Record<string, MarketBandTally> {
  return MARKET_CALIBRATION_BANDS.reduce<Record<string, MarketBandTally>>((acc, spec) => {
    acc[spec.key] = { n: 0, sumP: 0, hits: 0 };
    return acc;
  }, {});
}

function emptyTally(): MarketTally {
  return {
    n: 0,
    sumP: 0,
    hits: 0,
    brier: 0,
    logLoss: 0,
    bands: emptyBandTallies() as MarketTally['bands']
  };
}

/** Defensive rehydration: a malformed stored tally degrades to a fresh one. */
function adoptTally(candidate: unknown): MarketTally {
  const fresh = emptyTally();
  if (!candidate || typeof candidate !== 'object') return fresh;
  const raw = candidate as MarketTally;
  if (!Number.isFinite(raw.n) || raw.n < 0) return fresh;
  MARKET_CALIBRATION_BANDS.forEach((spec) => {
    const band = raw.bands?.[spec.key];
    if (band && Number.isFinite(band.n)) {
      fresh.bands[spec.key] = { n: band.n, sumP: band.sumP, hits: band.hits };
    }
  });
  fresh.n = raw.n;
  fresh.sumP = Number.isFinite(raw.sumP) ? raw.sumP : 0;
  fresh.hits = Number.isFinite(raw.hits) ? raw.hits : 0;
  fresh.brier = Number.isFinite(raw.brier) ? raw.brier : 0;
  fresh.logLoss = Number.isFinite(raw.logLoss) ? raw.logLoss : 0;
  return fresh;
}

/** Both scores present, finite and non-negative — otherwise not measurable. */
function isSettled(score: SettledScore): boolean {
  return (
    Number.isFinite(score?.home_score) &&
    Number.isFinite(score?.away_score) &&
    score.home_score >= 0 &&
    score.away_score >= 0);

}


/**
 * Walk-forward accumulator. Additive by construction, so an incremental run
 * CONTINUES the same out-of-sample measurement from a checkpoint instead of
 * restarting it — and so the whole state fits in a session checkpoint without
 * carrying one record per match.
 */
export class MarketCalibrationAccumulator {
  private readonly tallies: MarketTallyMap;

  constructor(initial?: MarketTallyMap | null) {
    this.tallies = EVALUATED_MARKET_CODES.reduce<MarketTallyMap>((acc, code) => {
      acc[code] = adoptTally(initial?.[code]);
      return acc;
    }, {});
  }

  /** Fold one settled match in, at its chronological position. */
  observe(secondary: Secondary | undefined, score: SettledScore): void {
    if (!secondary) return;
    // A market observation is only out-of-sample evidence if the outcome is
    // genuinely SETTLED. A missing or non-integer score would otherwise be read
    // as 0–0 and silently count as a BTTS miss, dragging every band's measured
    // hit rate down towards "the model overestimates".
    if (!isSettled(score)) return;
    MARKET_EVAL_SPEC_LIST.forEach((spec) => {
      const p = spec.probOf(secondary);
      if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1) return;
      const hit = spec.hitOf(score);
      const tally = this.tallies[spec.market];
      const y = hit ? 1 : 0;

      tally.n++;
      tally.sumP += p;
      tally.hits += y;
      tally.brier += Math.pow(p - y, 2);
      tally.logLoss += -Math.log(Math.max(1e-5, hit ? p : 1 - p));

      const band = tally.bands[marketBandOfProbability(p)];
      band.n++;
      band.sumP += p;
      band.hits += y;
    });
  }

  /** Serialisable state for the checkpoint. */
  state(): MarketTallyMap {
    return JSON.parse(JSON.stringify(this.tallies)) as MarketTallyMap;
  }

  /** The finished per-market reports. */
  report(): MarketCalibrationState {
    return EVALUATED_MARKET_CODES.reduce<MarketCalibrationState>((acc, code) => {
      acc[code] = summarizeMarketTally(code, this.tallies[code]);
      return acc;
    }, {});
  }
}

function verdictOf(
evaluable: boolean,
bands: MarketCalibrationReport['bands'])
: MarketCalibrationVerdict {
  if (!evaluable) return 'unevaluable';
  const judged = bands.filter((b) => b.evaluable);
  if (judged.some((b) => b.diagnosis === 'overconfident')) return 'overconfident';
  if (judged.some((b) => b.diagnosis === 'underconfident')) return 'underconfident';
  return 'calibrated';
}

const VERDICT_COPY: Record<MarketCalibrationVerdict, string> = {
  calibrated:
  'Piacspecifikusan kalibrált: minden értékelhető valószínűségi sávban a jelzett esély a tényleges beválás Wilson-intervallumán belül van.',
  overconfident:
  'Túl magabiztos: legalább egy értékelhető sávban a jelzett esély a tényleges beválás Wilson-intervalluma FÖLÖTT van.',
  underconfident:
  'Túl óvatos: legalább egy értékelhető sávban a jelzett esély a tényleges beválás Wilson-intervalluma ALATT van.',
  unevaluable: `Nem értékelhető: egyetlen valószínűségi sáv sem érte el a ${BAND_MIN_SAMPLE} esetes minimumot.`
};

export function summarizeMarketTally(
market: string,
tally: MarketTally)
: MarketCalibrationReport {
  const spec = marketEvalSpecOf(market);
  const bands = marketBandsFromTallies(tally.bands);
  const n = tally.n;
  const evaluable = bands.some((b) => b.evaluable);
  const verdict = verdictOf(evaluable, bands);

  const ece =
  n > 0 ?
  bands.reduce(
    (acc, band) =>
    band.n > 0 ? acc + band.n / n * Math.abs(band.avgP - band.hitRate) : acc,
    0
  ) :
  0;

  return {
    market,
    label: spec?.label ?? market,
    n,
    avgP: n > 0 ? tally.sumP / n : 0,
    hitRate: n > 0 ? tally.hits / n : 0,
    brier: n > 0 ? tally.brier / n : 0,
    logLoss: n > 0 ? tally.logLoss / n : 0,
    ece,
    bands,
    evaluable,
    calibrated: verdict === 'calibrated',
    verdict,
    headline: VERDICT_COPY[verdict]
  };
}

/**
 * The same accumulator, fed from already-scored matches.
 *
 * Identical math on identical inputs: each `pipeline.secondary` was produced
 * as-of, by the prequential walk, so this reproduces the walk's own report
 * exactly. It exists so the pattern builder and the audit surface never have to
 * wait for — or diverge from — the pipeline's published state.
 */
export function computeMarketCalibration(
matches: readonly MatchRow[])
: MarketCalibrationState {
  const acc = new MarketCalibrationAccumulator();
  matches.forEach((m) => {
    if (!m.pipeline) return;
    acc.observe(m.pipeline.secondary, m);
  });
  return acc.report();
}