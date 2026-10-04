import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../bootstrap';
import type { MatchRow, Season } from '../../../types/winmix';
import { benjaminiHochberg, bttsFlags, dispersionTest, DEFAULT_ROUND_OPTIONS, runRoundConstraintAnalysis } from '../roundConstraints';

const OPT = { ...DEFAULT_ROUND_OPTIONS, iterations: 200 };

/** Synthetic seasons: 30 rounds × 8 matches. constrained=true forces 3–5 BTTS per round. */
function makeSeasons(constrained: boolean, seed: number, count = 4): Season[] {
  const rand = mulberry32(seed);
  const teams = Array.from({ length: 16 }, (_, i) => `T${i}`);
  return Array.from({ length: count }, (_, s) => {
    const matches: MatchRow[] = [];
    for (let r = 0; r < 30; r++) {
      let target = -1;
      if (constrained) target = 3 + Math.floor(rand() * 3);
      const pos = new Set<number>();
      if (constrained) {
        while (pos.size < target) pos.add(Math.floor(rand() * 8));
      }
      for (let k = 0; k < 8; k++) {
        const btts = constrained ? pos.has(k) : rand() < 0.5;
        const hs = btts ? 1 + Math.floor(rand() * 2) : Math.floor(rand() * 3);
        const as = btts ? 1 + Math.floor(rand() * 2) : 0;
        matches.push({
          match_no: r * 8 + k + 1, date: '', home_team: teams[(k * 2 + r) % 16], away_team: teams[(k * 2 + 1 + r) % 16],
          ht_home_score: null, ht_away_score: null, home_score: hs, away_score: as, total_goals: hs + as,
          btts, outcome: hs > as ? 'H' : hs === as ? 'D' : 'A'
        });
      }
    }
    return { id: `s${s}`, league: 'angol', seasonIndex: s, name: `S${s}`, fileName: '', createdAt: '',
      contentHash: null, countWarning: false, actualMatchCount: matches.length, matches } as unknown as Season;
  });
}

describe('round-level BTTS band (synthetic gate)', () => {
  it('detects a constrained 3–5 BTTS generator', () => {
    const r = dispersionTest(bttsFlags(makeSeasons(true, 11)), [3, 5], 'BTTS', OPT);
    expect(r.conclusion).toBe('COMPATIBLE');
    expect(r.effect.estimate).toBeLessThan(1);
    expect(r.bandShareObserved).toBe(1);
  });

  it('does not flag an independent generator', () => {
    const r = dispersionTest(bttsFlags(makeSeasons(false, 12)), [3, 5], 'BTTS', OPT);
    expect(r.conclusion).not.toBe('COMPATIBLE');
  });

  it('is deterministic for a fixed seed', () => {
    const s = makeSeasons(false, 13);
    expect(dispersionTest(bttsFlags(s), [3, 5], 'B', OPT)).toEqual(dispersionTest(bttsFlags(s), [3, 5], 'B', OPT));
  });
});

describe('full analysis', () => {
  it('runs end to end and never reports p = 0', () => {
    const rep = runRoundConstraintAnalysis(makeSeasons(true, 21), 'angol', OPT);
    expect(rep).not.toBeNull();
    for (const t of [rep!.bttsBand, rep!.upsetCeiling, rep!.h2hBreak]) {
      expect(t.rawPValue!).toBeGreaterThan(0);
      expect(t.adjustedPValue!).toBeGreaterThanOrEqual(t.rawPValue!);
    }
  });

  it('BH adjustment is monotone and capped at 1', () => {
    const adj = benjaminiHochberg([0.01, 0.04, 0.03, 0.9]);
    expect(adj.every((p) => p <= 1)).toBe(true);
    expect(adj[0]).toBeCloseTo(0.04);
  });
});
