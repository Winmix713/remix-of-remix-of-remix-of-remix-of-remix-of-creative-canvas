import { canon } from './teams';
import type { MatchRow } from '../types/winmix';

/**
 * The directed fixture model as a VERIFIABLE invariant, not just an
 * aggregation convenience.
 *
 * A closed double round-robin over N teams contains exactly N × (N − 1)
 * DIRECTED ordered pairs — 16 teams → 240. Every pair (A→B) must appear once
 * and (B→A) must appear once; they are distinct fixtures, never duplicates of
 * each other. This is exactly the distinction the undated-row dedup key
 * (`sourceFileId + rowIndex`) exists to protect: two undated 1–1 results
 * between the same teams are a normal home/away pair.
 *
 * The check is descriptive — it reports, it never mutates or drops rows.
 */
export interface DirectedFixtureReport {
  teamCount: number;
  /** N × (N − 1) — the complete directed schedule for the observed teams. */
  expectedPairs: number;
  /** Distinct directed pairs actually present. */
  observedPairs: number;
  matchCount: number;
  /** Directed pairs that appear more than once (season overlap or duplicates). */
  repeatedPairs: number;
  /** Directed pairs with no fixture at all. */
  missingPairs: number;
  /** True when the observed set is a complete, non-repeating directed schedule. */
  complete: boolean;
  /** Up to 12 human-readable examples of missing directed pairs. */
  missingExamples: string[];
}

export function checkDirectedFixtureMatrix(
matches: readonly MatchRow[],
aliases: Readonly<Record<string, string>> = {})
: DirectedFixtureReport {
  const teams = new Set<string>();
  const counts = new Map<string, number>();

  for (const m of matches) {
    const h = canon(m.home_team);
    const a = canon(m.away_team);
    if (!h || !a || h === a) continue;
    teams.add(h);
    teams.add(a);
    const key = `${h}→${a}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const teamCount = teams.size;
  const expectedPairs = teamCount > 1 ? teamCount * (teamCount - 1) : 0;
  const observedPairs = counts.size;
  let repeatedPairs = 0;
  counts.forEach((n) => {
    if (n > 1) repeatedPairs += 1;
  });

  const missingExamples: string[] = [];
  let missingPairs = 0;
  const list = Array.from(teams);
  for (const h of list) {
    for (const a of list) {
      if (h === a) continue;
      if (!counts.has(`${h}→${a}`)) {
        missingPairs += 1;
        if (missingExamples.length < 12) {
          missingExamples.push(`${aliases[h] ?? h} → ${aliases[a] ?? a}`);
        }
      }
    }
  }

  return {
    teamCount,
    expectedPairs,
    observedPairs,
    matchCount: matches.length,
    repeatedPairs,
    missingPairs,
    complete: expectedPairs > 0 && missingPairs === 0 && repeatedPairs === 0,
    missingExamples
  };
}