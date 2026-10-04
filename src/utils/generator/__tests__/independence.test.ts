import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INDEPENDENCE_OPTIONS,
  computeSeriesDiagnostics,
  runIndependenceTest } from
'../independence';
import { makeSyntheticSeason } from './synthetic';

const OPTIONS = {
  ...DEFAULT_INDEPENDENCE_OPTIONS,
  minTrain: 150,
  refitInterval: 60,
  trainWindow: 600,
  bootstrapIterations: 300
};

const noForm = makeSyntheticSeason({ seed: 101, matches: 1100, formStrength: 0 });
const withForm = makeSyntheticSeason({ seed: 101, matches: 1100, formStrength: 0.75 });

describe('Independence — synthetic validation gate', () => {
  it('finds no surplus form signal in a no-form generator', () => {
    const report = runIndependenceTest([noForm], 'angol', OPTIONS)!;
    expect(report).not.toBeNull();
    expect(report.result.leakageSafe).toBe(true);
    expect(report.result.conclusion).not.toBe('COMPATIBLE');
    expect(report.comparison.deltaLogLoss.ci95High).toBeGreaterThan(
      -OPTIONS.meaningfulLogLoss
    );
    expect(report.implication.suggestedState).not.toBe('KEEP');
    expect(report.implication.automaticConfigurationChange).toBe(false);
  });

  it('detects the form component in a form-driven generator', () => {
    const report = runIndependenceTest([withForm], 'angol', OPTIONS)!;
    expect(report.result.conclusion).toBe('COMPATIBLE');
    expect(report.comparison.deltaLogLoss.estimate).toBeLessThan(0);
    expect(report.comparison.deltaLogLoss.ci95High).toBeLessThan(0);
    expect(report.result.oosDeltaBrier).toBeLessThan(0);
    expect(report.implication.suggestedState).toBe('KEEP');
  });

  it('separates the two generators by out-of-sample log-loss', () => {
    const a = runIndependenceTest([noForm], 'angol', OPTIONS)!;
    const b = runIndependenceTest([withForm], 'angol', OPTIONS)!;
    expect(b.comparison.deltaLogLoss.estimate).toBeLessThan(
      a.comparison.deltaLogLoss.estimate
    );
  });

  it('is deterministic: identical input and seed give identical output', () => {
    const first = runIndependenceTest([withForm], 'angol', OPTIONS);
    const second = runIndependenceTest([withForm], 'angol', OPTIONS);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('reports INCONCLUSIVE and leakageSafe = false when the sample is too small', () => {
    const tiny = makeSyntheticSeason({ seed: 7, matches: 60 });
    const report = runIndependenceTest([tiny], 'angol', OPTIONS)!;
    expect(report.result.conclusion).toBe('INCONCLUSIVE');
    expect(report.result.leakageSafe).toBe(false);
    expect(report.implication.suggestedState).toBe('INCONCLUSIVE');
  });

  it('reports a per-league dataset block and never mixes leagues', () => {
    const spanish = makeSyntheticSeason({ seed: 9, matches: 400, league: 'spanyol' });
    const report = runIndependenceTest([noForm, spanish], 'angol', OPTIONS)!;
    expect(report.dataset.league).toBe('angol');
    expect(report.dataset.matchCount).toBe(noForm.matches.length);
    expect(report.dataset.seed).toBe(OPTIONS.seed);
  });

  it('computes sequence diagnostics with autocorrelations for five lags', () => {
    const d = computeSeriesDiagnostics(withForm.matches);
    expect(d.teamsAnalysed).toBeGreaterThan(0);
    expect(d.meanAutocorrelation).toHaveLength(5);
    expect(d.ljungBoxRejectShare).toBeGreaterThanOrEqual(0);
    expect(d.runsRejectShare).toBeLessThanOrEqual(1);
  });
});
