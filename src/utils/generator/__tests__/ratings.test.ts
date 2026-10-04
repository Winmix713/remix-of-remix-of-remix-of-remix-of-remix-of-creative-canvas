import { describe, expect, it } from 'vitest';
import { buildFeatureRows, fitOrderedLogit, predictRow, probsFromLatent } from '../ratings';
import { makeSyntheticSeason } from './synthetic';

const season = makeSyntheticSeason({ matches: 400 });

describe('analysis rating baseline', () => {
  it('is deterministic', () => {
    expect(buildFeatureRows(season.matches)).toEqual(buildFeatureRows(season.matches));
  });

  it('leaks no future information: changing a later result cannot alter an earlier row', () => {
    const base = buildFeatureRows(season.matches);
    const tampered = season.matches.map((m, i) =>
    i < 300 ?
    m :
    { ...m, outcome: 'A' as const, home_score: 0, away_score: 3, total_goals: 3, btts: false }
    );
    const after = buildFeatureRows(tampered);
    expect(after.slice(0, 300)).toEqual(base.slice(0, 300));
    // ...and the change IS visible afterwards, so the check is not vacuous.
    expect(after.slice(301)).not.toEqual(base.slice(301));
  });

  it('emits normalised ordered-logit probabilities', () => {
    const p = probsFromLatent(0.3, 0.6);
    expect(p.home + p.draw + p.away).toBeCloseTo(1, 12);
    expect(probsFromLatent(2, 0.6).home).toBeGreaterThan(probsFromLatent(-2, 0.6).home);
  });

  it('fits a positive rating weight and a plausible home advantage', () => {
    const rows = buildFeatureRows(season.matches);
    const model = fitOrderedLogit(rows.slice(100), ['ratingDiff']);
    expect(model.weights[0]).toBeGreaterThan(0);
    expect(model.threshold).toBeGreaterThan(0);
    expect(model.intercept).toBeGreaterThan(0);
    const p = predictRow(model, rows[150]);
    expect(p.home + p.draw + p.away).toBeCloseTo(1, 10);
  });
});
