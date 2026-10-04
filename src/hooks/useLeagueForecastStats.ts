import { useMemo } from 'react';
import { useWinmix } from '../contexts/WinmixContext';
import { bootstrapSkillCI, skillPairsOf } from '../utils/bootstrap';
import { computeReliabilityBands } from '../utils/decision';
import { computeMarketCalibration } from '../utils/marketEval';
import { argmaxOutcome } from '../utils/forecastCore';
import { scoredMatchesOf, type ScoredMatch } from '../utils/pipeline';
import { computeECEForSlice, pairedSignTest } from '../utils/stats';
import type {
  MarketCalibrationState,
  ReliabilityBand,
  SignTestResult,
  SkillCI } from
'../types/winmix';

export interface LeagueForecastStats {
  scored: ScoredMatch[];
  /** Forecasts are derived data and are not persisted — after a reload this is false. */
  hasPipeline: boolean;
  evaluated: number;
  actionableCount: number;
  coveragePct: number;
  /** Accuracy over actionable (non NO_CLEAR_EDGE) matches, in percent. */
  accActionable: number;
  /** Plain argmax accuracy over every scored match, in percent. */
  accAll: number;
  brier: number;
  logLossEns: number;
  logLossB1: number;
  skill: number;
  ece: number | null;
  sign: SignTestResult | null;
  skillCI: SkillCI | null;
  /** 1X2 confidence bands. NOT market-specific — see `marketCalibration`. */
  bands: ReliabilityBand[];
  /**
   * RELEASE C — per-market, out-of-sample probability calibration, measured on
   * the as-of `pipeline.secondary` values the prequential walk produced.
   */
  marketCalibration: MarketCalibrationState;
}

/**
 * The one aggregation of a league's forecast quality.
 *
 * DataStudio and PipelineAudit each computed this independently from the same
 * inputs (`scoredMatchesOf` → skill CI → reliability bands), which is exactly
 * how two screens start quoting different numbers for the same league.
 */
export function useLeagueForecastStats(): LeagueForecastStats {
  const { leagueMatches } = useWinmix();

  const scored = useMemo(() => scoredMatchesOf(leagueMatches), [leagueMatches]);

  const bands = useMemo(
    () =>
    computeReliabilityBands(
      scored.map((m) => ({
        confidence: m.pipeline.confidence,
        probs: m.pipeline.calibrated,
        outcome: m.outcome
      }))
    ),
    [scored]
  );

  const marketCalibration = useMemo(() => computeMarketCalibration(scored), [scored]);

  return useMemo<LeagueForecastStats>(() => {
    if (scored.length === 0) {
      return {
        scored,
        hasPipeline: false,
        evaluated: 0,
        actionableCount: 0,
        coveragePct: 0,
        accActionable: 0,
        accAll: 0,
        brier: 0,
        logLossEns: 0,
        logLossB1: 0,
        skill: 0,
        ece: null,
        sign: null,
        skillCI: null,
        bands,
        marketCalibration
      };
    }

    const n = scored.length;
    const actionable = scored.filter((m) => m.pipeline.recommendation !== 'NO_CLEAR_EDGE');
    const actionableCorrect = actionable.filter((m) => m.pipeline.reconciliation.isCorrect).length;
    const argmaxCorrect = scored.filter((m) => argmaxOutcome(m.pipeline.calibrated) === m.outcome).
    length;

    const logLossEns = scored.reduce((a, m) => a + m.pipeline.reconciliation.logLossEns, 0) / n;
    const logLossB1 = scored.reduce((a, m) => a + m.pipeline.reconciliation.logLossB1, 0) / n;

    return {
      scored,
      hasPipeline: true,
      evaluated: n,
      actionableCount: actionable.length,
      coveragePct: actionable.length / n * 100,
      accActionable: actionable.length ? actionableCorrect / actionable.length * 100 : 0,
      accAll: argmaxCorrect / n * 100,
      brier: scored.reduce((a, m) => a + m.pipeline.reconciliation.brierEns, 0) / n,
      logLossEns,
      logLossB1,
      skill: logLossB1 > 0 ? (1 - logLossEns / logLossB1) * 100 : 0,
      ece: computeECEForSlice(scored),
      sign: pairedSignTest(scored),
      // No skill figure may be rendered without its bootstrap interval.
      skillCI: n > 1 ? bootstrapSkillCI(skillPairsOf(scored)) : null,
      bands,
      marketCalibration
    };
  }, [bands, marketCalibration, scored]);
}