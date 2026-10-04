/**
 * RELEASE A — AUTOMATED JOINT-MATRIX INVARIANT TESTS.
 *
 * The team-goal markets are not a new estimate: they are marginals of the same
 * normalised bivariate score matrix that already produces 1X2, BTTS, the
 * Over/Under lines and the correct score. Six identities therefore hold BY
 * CONSTRUCTION:
 *
 *   1. homeOver05 + homeUnder05 = 1
 *   2. awayOver05 + awayUnder05 = 1
 *   3. bttsYes ≤ homeOver05          (BTTS is the strict intersection)
 *   4. bttsYes ≤ awayOver05
 *   5. homeUnder05 ≥ P("0-0")
 *   6. awayUnder05 ≥ P("0-0")
 *
 * BTTS CORE PROFILE adds three more, for the same reason — the one-sided
 * blowout descriptors are marginals of the same matrix, so their containment
 * is arithmetic, not an assumption:
 *
 *   8.  highGoalNoBtts ≤ cleanSheetBlowout
 *   9.  cleanSheetBlowout ≤ bttsNo
 *   10. cleanSheetBlowout − highGoalNoBtts = P("3-0") + P("0-3")
 *
 * Note the DIRECTION of 8. A `3-0` is a clean-sheet blowout with only three
 * goals, so the clean-sheet event is the WIDER one; every no-BTTS scoreline
 * with 4+ goals necessarily has a margin of 4+ and is therefore contained in
 * it. Any specification claiming the reverse ordering is arithmetically wrong,
 * and this suite is where that gets caught.
 *
 * "By construction" is exactly the kind of claim that quietly stops being true
 * after a refactor, so the contract is pinned down here as an EXECUTABLE test
 * rather than a developer-mode warning. It sweeps low and high goal
 * expectations, a lambda approaching zero, and positive / negative / disabled
 * Dixon-Coles corrections. The suite is pure and synchronous: it is run from the
 * audit surface (so an operator can see the contract holding on their own
 * build) and in development on module load.
 *
 * It deliberately checks a SEVENTH property too — that the matrix still sums to
 * one — because every identity above is meaningless on an unnormalised matrix.
 */

import { computeJointScoreDistribution } from './forecastCore';

/** Absolute tolerance for float identities. */
export const INVARIANT_TOLERANCE = 1e-9;

export interface InvariantCase {
  label: string;
  lambdaH: number;
  lambdaA: number;
  rho: number;
}

export interface InvariantCheck {
  name: string;
  passed: boolean;
  /** Signed slack: ≥ 0 means the identity held. */
  slack: number;
}

export interface InvariantCaseResult {
  label: string;
  lambdaH: number;
  lambdaA: number;
  rho: number;
  passed: boolean;
  checks: InvariantCheck[];
}

export interface InvariantSuiteResult {
  cases: InvariantCaseResult[];
  total: number;
  failed: number;
  passed: boolean;
  tolerance: number;
}

/**
 * The parameter sweep. Low and high goal expectations, an asymmetric pair, a
 * lambda tending to zero, and both signs of the Dixon-Coles correction plus the
 * exactly-disabled rho = 0 baseline.
 */
export const INVARIANT_CASES: readonly InvariantCase[] = [
{ label: 'Alacsony gólvárakozás, ρ = 0', lambdaH: 0.4, lambdaA: 0.3, rho: 0 },
{ label: 'Tipikus liga, ρ = 0', lambdaH: 1.55, lambdaA: 1.15, rho: 0 },
{ label: 'Tipikus liga, ρ = +0.12', lambdaH: 1.55, lambdaA: 1.15, rho: 0.12 },
{ label: 'Tipikus liga, ρ = −0.12', lambdaH: 1.55, lambdaA: 1.15, rho: -0.12 },
{ label: 'Magas gólvárakozás, ρ = +0.05', lambdaH: 3.4, lambdaA: 2.8, rho: 0.05 },
{ label: 'Magas gólvárakozás, ρ = −0.05', lambdaH: 3.4, lambdaA: 2.8, rho: -0.05 },
{ label: 'Erősen aszimmetrikus, ρ = −0.08', lambdaH: 2.9, lambdaA: 0.45, rho: -0.08 },
{ label: 'Nullához tartó vendég λ, ρ = 0', lambdaH: 1.2, lambdaA: 1e-6, rho: 0 },
{ label: 'Nullához tartó mindkét λ, ρ = 0', lambdaH: 1e-6, lambdaA: 1e-6, rho: 0 },
{ label: 'Nullához tartó λ, ρ = +0.1', lambdaH: 0.05, lambdaA: 0.05, rho: 0.1 }];


function check(name: string, slack: number): InvariantCheck {
  return { name, passed: slack >= -INVARIANT_TOLERANCE, slack };
}

export function runInvariantCase(testCase: InvariantCase): InvariantCaseResult {
  const joint = computeJointScoreDistribution(
    testCase.lambdaH,
    testCase.lambdaA,
    testCase.rho
  );
  const nilNil = joint.scoreMatrix[0][0];
  const matrixSum = joint.scoreMatrix.reduce(
    (acc, row) => acc + row.reduce((rowAcc, cell) => rowAcc + cell, 0),
    0
  );

  const checks: InvariantCheck[] = [
  check(
    'homeOver05 + homeUnder05 = 1',
    -Math.abs(joint.homeOver05 + joint.homeUnder05 - 1)
  ),
  check(
    'awayOver05 + awayUnder05 = 1',
    -Math.abs(joint.awayOver05 + joint.awayUnder05 - 1)
  ),
  check('bttsYes ≤ homeOver05', joint.homeOver05 - joint.bttsYes),
  check('bttsYes ≤ awayOver05', joint.awayOver05 - joint.bttsYes),
  check('homeUnder05 ≥ P(0-0)', joint.homeUnder05 - nilNil),
  check('awayUnder05 ≥ P(0-0)', joint.awayUnder05 - nilNil),
  check('Σ mátrix = 1', -Math.abs(matrixSum - 1)),
  check('highGoalNoBtts ≥ 0', joint.highGoalNoBtts),
  check('cleanSheetBlowout ≥ 0', joint.cleanSheetBlowout),
  check(
    'highGoalNoBtts ≤ cleanSheetBlowout',
    joint.cleanSheetBlowout - joint.highGoalNoBtts
  ),
  check('cleanSheetBlowout ≤ bttsNo', joint.bttsNo - joint.cleanSheetBlowout),
  check(
    'cleanSheetBlowout − highGoalNoBtts = P(3-0) + P(0-3)',
    -Math.abs(
      joint.cleanSheetBlowout -
      joint.highGoalNoBtts - (
      joint.scoreMatrix[3][0] + joint.scoreMatrix[0][3])
    )
  )];


  return {
    label: testCase.label,
    lambdaH: testCase.lambdaH,
    lambdaA: testCase.lambdaA,
    rho: testCase.rho,
    passed: checks.every((c) => c.passed),
    checks
  };
}

export function runJointMatrixInvariantTests(
cases: readonly InvariantCase[] = INVARIANT_CASES)
: InvariantSuiteResult {
  const results = cases.map(runInvariantCase);
  const failed = results.filter((r) => !r.passed).length;
  return {
    cases: results,
    total: results.length,
    failed,
    passed: failed === 0,
    tolerance: INVARIANT_TOLERANCE
  };
}

/* Development-mode self-check: a broken identity is reported the moment the
 * module graph loads, not when someone happens to open the audit screen. */
if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
  const result = runJointMatrixInvariantTests();
  if (!result.passed) {
    const broken = result.cases.
    filter((c) => !c.passed).
    map((c) => `${c.label}: ${c.checks.filter((x) => !x.passed).map((x) => x.name).join(', ')}`);
    console.error(
      `[invariants] A joint-mátrix szerződése sérült (${result.failed}/${result.total} eset): ` +
      broken.join(' | ')
    );
  }
}