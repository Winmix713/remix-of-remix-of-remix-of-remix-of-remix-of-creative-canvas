import { describe, expect, it } from 'vitest';
import {
  BOOTSTRAP_SEED,
  bootstrapMeanEffect,
  permutationTest,
  seededShuffle } from
'../permutation';

const values = Array.from({ length: 200 }, (_, i) => Math.sin(i) * 0.1 + 0.02);

describe('permutation framework — determinism', () => {
  it('shuffles identically for the same seed and differently for another', () => {
    const a = seededShuffle(values, BOOTSTRAP_SEED);
    const b = seededShuffle(values, BOOTSTRAP_SEED);
    const c = seededShuffle(values, BOOTSTRAP_SEED + 1);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect([...a].sort()).toEqual([...values].sort());
  });

  it('does not mutate its input', () => {
    const copy = [...values];
    seededShuffle(values);
    expect(values).toEqual(copy);
  });

  it('produces bit-identical bootstrap intervals on repeat runs', () => {
    const first = bootstrapMeanEffect(values, 300, BOOTSTRAP_SEED);
    const second = bootstrapMeanEffect(values, 300, BOOTSTRAP_SEED);
    expect(first).toEqual(second);
    expect(first.ci95Low).toBeLessThanOrEqual(first.estimate);
    expect(first.ci95High).toBeGreaterThanOrEqual(first.estimate);
  });

  it('runs permutation tests deterministically and never reports p = 0', () => {
    const run = () =>
    permutationTest<readonly number[]>(
      values,
      (d) => d.reduce((a, c) => a + c, 0) / d.length,
      (d, rand) => d.map((v) => rand() < 0.5 ? -v : v),
      300,
      BOOTSTRAP_SEED
    );
    const a = run();
    const b = run();
    expect(a).toEqual(b);
    expect(a.pValue).toBeGreaterThan(0);
    expect(a.pValue).toBeLessThanOrEqual(1);
    expect(a.seed).toBe(BOOTSTRAP_SEED);
  });
});
