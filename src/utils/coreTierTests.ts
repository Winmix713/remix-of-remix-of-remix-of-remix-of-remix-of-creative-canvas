/**
 * CORE TIERING — EXECUTABLE REGRESSION SUITE.
 *
 * The quadrant used to be a hard Core entry gate: anything short of
 * `actionable` was refused outright. On a 16-fixture round that routinely
 * produced `0 / 3` Core cards while seven to nine real BTTS candidates sat in
 * `volatile` with strong H2H direction. The quadrant is now a SELECTION TIER:
 *
 *   actionable → Primary Core
 *   volatile   → Secondary Core (higher-risk tier, clearly labelled)
 *   flat       → still refused
 *   ignore     → still refused
 *
 * That change is only safe if three properties hold at once, and each is the
 * kind of property a later refactor quietly breaks:
 *
 *   1. ELIGIBILITY — volatile passes, flat/ignore do not, and NONE of the other
 *      strict conditions were softened (cold sample, stability floor, team-goal
 *      market ban). A cáfolt sáv a Phase 6 zászlóig nem terminális kizárás
 *      (látszik + rangsor-büntet), a modell-konfliktus kapu pedig piac-szintű:
 *      csak extrém eltérés + vékony minta zár ki.
 *   2. ORDERING — a Secondary candidate can FILL a card no Primary candidate
 *      was available for, but can never DISPLACE an available Primary one,
 *      not even a conditional Primary one.
 *   3. SLOT FILLING — one fixture per card, no relaxed fallback, and fewer than
 *      three valid candidates yields fewer than three cards rather than a
 *      force-filled set.
 *
 * Pure and synchronous, in the shape of `utils/invariants.ts` and
 * `utils/coreEvidenceTests.ts`: the operator runs it on their own build from
 * the audit surface, and a development-mode module load reports a break
 * immediately.
 */

import { CORE_STABILITY_MIN } from './constants';
import { SECONDARY_MARKET_THRESHOLDS, decisionQuadrantOf } from './decision';
import {
  CORE_SELECTION_RULE_VERSION,
  coreTierOf,
  coreTierRank,
  isCoreEligible,
  selectCoreSet } from
'./slip';
import type { CoreEvidenceSnapshot, CoreTier, DataSufficiency, PatternHit } from '../types/winmix';

/* -------------------------------------------------------------------------- *
 * Fixture builder — synthetic candidates, real quadrant math
 * -------------------------------------------------------------------------- */

type EvidenceState = 'calibrated' | 'conditional' | 'excluded';

interface PatternSeed {
  id: string;
  /** Defaults to `id`, so two seeds can share one fixture on purpose. */
  fixtureId?: string;
  /** P axis — the weighted, shrunk H2H hit rate. */
  hitRate: number;
  /** C axis — the market-specific confidence (0–99). */
  marketConfidence: number;
  evidence?: EvidenceState;
  sufficiency?: DataSufficiency;
  stability?: number;
  modelConflict?: boolean;
  /** A piac saját modellbecslése — a per-market konfliktus-kapu ehhez méri a hitRate-et. */
  modelProb?: number;
}

function snapshotOf(level: EvidenceState): CoreEvidenceSnapshot {
  return {
    level,
    kind: level === 'excluded' ? 'disproved' : level === 'calibrated' ? 'verified' : 'missing_evidence',
    ruleVersion: 'core-evidence/1.1',
    bandKey: 'p55_65',
    bandLabel: '55–65%',
    environmentKeys: ['p55_65'],
    environmentLabel: '55–65%',
    widened: false,
    observations: level === 'conditional' ? 4 : 40,
    evaluable: level !== 'conditional',
    required: 20,
    avgP: level === 'conditional' ? null : 0.6,
    hitRate: level === 'conditional' ? null : level === 'calibrated' ? 0.61 : 0.34,
    ciLo: level === 'conditional' ? null : level === 'calibrated' ? 0.5 : 0.24,
    ciHi: level === 'conditional' ? null : level === 'calibrated' ? 0.72 : 0.45,
    hits: level === 'conditional' ? 0 : level === 'calibrated' ? 24 : 14,
    diagnosis:
    level === 'conditional' ? 'insufficient' : level === 'calibrated' ? 'calibrated' : 'overconfident',
    headline: `Szintetikus ${level} eset.`
  };
}

/**
 * A BTTS candidate. Everything the Core gate reads is real: the quadrant is
 * produced by `decisionQuadrantOf` under the production secondary cut-points,
 * never hand-written.
 */
function makePattern(seed: PatternSeed): PatternHit {
  const evidence = seed.evidence ?? 'calibrated';
  const quadrant = decisionQuadrantOf(
    seed.hitRate,
    seed.marketConfidence,
    SECONDARY_MARKET_THRESHOLDS
  );

  return {
    id: seed.id,
    fixtureId: seed.fixtureId ?? seed.id,
    fixtureLabel: `${seed.id} hazai – ${seed.id} vendég`,
    league: 'angol',
    type: 'goal_market',
    code: 'BTTS',
    label: 'Mindkét csapat szerez gólt',
    rawRate: seed.hitRate,
    hitRate: seed.hitRate,
    sample: 8,
    effectiveSampleSize: 5.4,
    usedReverse: false,
    sufficiency: seed.sufficiency ?? 'warm',
    agreement: 'neutral',
    stability: seed.stability ?? 70,
    impliedOdds: 1 / Math.max(seed.hitRate, 0.01),
    weightApplied: 1,
    decision: quadrant,
    marketConfidence: seed.marketConfidence,
    marketDecision: quadrant,
    band: 'good',
    bandHitRate: evidence === 'calibrated' ? 0.61 : null,
    bandCalibrated: evidence === 'calibrated',
    bandDiagnosis: evidence === 'calibrated' ? 'calibrated' : 'insufficient',
    modelProb: seed.modelProb ?? 0.6,
    marketCalibrationStatus: 'calibrated',
    coreEvidence: snapshotOf(evidence),
    evidence: [],
    headToHeadRecord: {
      homeWins: 3,
      draws: 2,
      awayWins: 3,
      total: 8,
      homeWinPct: 0.375,
      drawPct: 0.25,
      awayWinPct: 0.375,
      homeUnbeatenStreak: 1,
      awayUnbeatenStreak: 0
    },
    goalStats: {
      avgGoals: 2.9,
      bttsPct: seed.hitRate,
      over25Pct: 0.62,
      over15Pct: 0.82,
      over35Pct: 0.38
    },
    htStats: null,
    topModalScores: [],
    reversalStats: null,
    goalProfile: null,
    bttsRisk: seed.modelConflict ?
    {
      profile: 'high_variance',
      historicalRisk: 0.18,
      modelRisk: 0.2,
      effectiveSampleSize: 5.4,
      usedReverse: false,
      wouldVeto: false,
      reasonCodes: ['model_conflict'],
      vetoReasons: ['A H2H és a modell becslése érdemben eltér.'],
      earlyOpenProfile: false
    } :
    null
  };
}

/* -------------------------------------------------------------------------- *
 * Case table
 * -------------------------------------------------------------------------- */

export interface CoreTierCheck {
  name: string;
  passed: boolean;
  actual: string;
}

export interface CoreTierCaseResult {
  label: string;
  requirement: string;
  passed: boolean;
  checks: CoreTierCheck[];
}

export interface CoreTierSuiteResult {
  cases: CoreTierCaseResult[];
  total: number;
  failed: number;
  passed: boolean;
  ruleVersion: string;
}

function check(name: string, passed: boolean, actual: string): CoreTierCheck {
  return { name, passed, actual };
}

function tierCase(
label: string,
requirement: string,
checks: CoreTierCheck[])
: CoreTierCaseResult {
  return { label, requirement, checks, passed: checks.every((c) => c.passed) };
}

function eligibility(
label: string,
requirement: string,
pattern: PatternHit,
expectedTier: CoreTier | null,
expectedEligible: boolean)
: CoreTierCaseResult {
  const tier = coreTierOf(pattern);
  const eligible = isCoreEligible(pattern);
  return tierCase(label, requirement, [
  check(`szint = ${expectedTier ?? 'nincs'}`, tier === expectedTier, tier ?? 'nincs'),
  check(
    `core-jogosult = ${expectedEligible ? 'igen' : 'nem'}`,
    eligible === expectedEligible,
    eligible ? 'igen' : 'nem'
  )]
  );
}

/** Strong direction, strong confidence. */
const ACTIONABLE = { hitRate: 0.66, marketConfidence: 62 };
/** Strong direction, confidence under the primary cut-point — the whole point. */
const VOLATILE = { hitRate: 0.66, marketConfidence: 48 };
/** No direction, solid base. */
const FLAT = { hitRate: 0.54, marketConfidence: 62 };
/** Neither. */
const IGNORE = { hitRate: 0.41, marketConfidence: 30 };

export function runCoreTierSuite(): CoreTierSuiteResult {
  const cases: CoreTierCaseResult[] = [];

  /* --- 1. Tier eligibility --------------------------------------------- */

  cases.push(
    eligibility(
      'Cselekvőképes jelölt',
      'P ≥ 58% ÉS C ≥ 56 → elsődleges core, jogosult',
      makePattern({ id: 'a1', ...ACTIONABLE }),
      'primary',
      true
    ),
    eligibility(
      'Volatilis jelölt (C a küszöb alatt)',
      'Erős H2H irány, C < 56 → MÁSODLAGOS core, továbbra is jogosult',
      makePattern({ id: 'v1', ...VOLATILE }),
      'secondary',
      true
    ),
    eligibility(
      'Lapos jelölt',
      'Nincs kimutatható él → nincs core szint, kizárva',
      makePattern({ id: 'f1', ...FLAT }),
      null,
      false
    ),
    eligibility(
      'Elvetendő jelölt',
      'Sem él, sem információ → nincs core szint, kizárva',
      makePattern({ id: 'i1', ...IGNORE }),
      null,
      false
    ),
    eligibility(
      'Volatilis + hideg minta',
      'A hideg minta kemény kizárás marad a másodlagos szinten is',
      makePattern({ id: 'v2', ...VOLATILE, sufficiency: 'cold' }),
      'secondary',
      false
    ),
    eligibility(
      'Volatilis + stabilitás a padló alatt',
      `A stabilitási padló (${CORE_STABILITY_MIN}) kemény kizárás marad`,
      makePattern({ id: 'v3', ...VOLATILE, stability: CORE_STABILITY_MIN - 1 }),
      'secondary',
      false
    ),
    eligibility(
      'Volatilis + cáfolt sáv (Phase 6 inaktív)',
      'A megmért cáfolat látszik és rangsor-büntet, de Release D-ig nem zár ki terminálisan',
      makePattern({ id: 'v4', ...VOLATILE, evidence: 'excluded' }),
      'secondary',
      true
    ),
    eligibility(
      'Volatilis + feltételes sáv + fixture-szintű konfliktus-jelzés',
      'A fixture-szintű jelzés önmagában nem zár ki — a kapu piac-szintű (keresztpiaci veto megszűnt)',
      makePattern({ id: 'v5', ...VOLATILE, evidence: 'conditional', modelConflict: true }),
      'secondary',
      true
    ),
    eligibility(
      'Volatilis + feltételes sáv + piac-szintű extrém konfliktus',
      '|hitRate − modelProb| ≥ 0,25 ÉS ESS < 6 → kizárva marad',
      makePattern({ id: 'v6', ...VOLATILE, evidence: 'conditional', modelProb: 0.3 }),
      'secondary',
      false
    ),
    eligibility(
      'Cselekvőképes + feltételes sáv',
      'A feltételes evidencia nem kizárás — elsődleges szinten is jogosult',
      makePattern({ id: 'a2', ...ACTIONABLE, evidence: 'conditional' }),
      'primary',
      true
    )
  );

  /* --- 2. Ordering ------------------------------------------------------ */

  const primaryConditional = makePattern({ id: 'p-cond', ...ACTIONABLE, evidence: 'conditional' });
  const secondaryCalibrated = makePattern({ id: 's-cal', ...VOLATILE, evidence: 'calibrated' });
  const orderedTiers = selectCoreSet([secondaryCalibrated, primaryConditional], 3);

  cases.push(
    tierCase(
      'Elsődleges feltételes vs. másodlagos kalibrált',
      'A szint az első kulcs: a másodlagos sor sosem szorít ki elérhető elsődlegest',
      [
      check(
        'elsődleges az első',
        orderedTiers[0]?.id === 'p-cond',
        orderedTiers.map((p) => p.id).join(' → ')
      ),
      check(
        'szint-rangsor: elsődleges < másodlagos',
        coreTierRank('primary') < coreTierRank('secondary') &&
        coreTierRank('secondary') < coreTierRank(null),
        `${coreTierRank('primary')} / ${coreTierRank('secondary')} / ${coreTierRank(null)}`
      )]

    )
  );

  const withinTier = selectCoreSet(
    [
    makePattern({ id: 'w-cond', ...VOLATILE, evidence: 'conditional' }),
    makePattern({ id: 'w-cal', ...VOLATILE, evidence: 'calibrated' })],

    3
  );

  cases.push(
    tierCase(
      'Szinten belül az evidencia dönt',
      'Azonos szinten a kalibrált sor előbb kerül kártyára, mint a feltételes',
      [
      check(
        'kalibrált az első',
        withinTier[0]?.id === 'w-cal',
        withinTier.map((p) => p.id).join(' → ')
      )]

    )
  );

  /* --- 3. Slot filling -------------------------------------------------- */

  const mixedRound = [
  makePattern({ id: 'm-sec-1', ...VOLATILE, hitRate: 0.71 }),
  makePattern({ id: 'm-pri', ...ACTIONABLE, hitRate: 0.63 }),
  makePattern({ id: 'm-sec-2', ...VOLATILE, hitRate: 0.68 }),
  makePattern({ id: 'm-flat', ...FLAT })].
  filter(isCoreEligible);
  const mixedSet = selectCoreSet(mixedRound, 3);

  cases.push(
    tierCase(
      'Egy elsődleges + két másodlagos',
      'Három kártya telik meg, az elsődleges az első, lapos sor nem kerül be',
      [
      check('három kártya', mixedSet.length === 3, String(mixedSet.length)),
      check('elsődleges az első', coreTierOf(mixedSet[0]) === 'primary', mixedSet[0]?.id ?? '—'),
      check(
        'a maradék kettő másodlagos',
        mixedSet.slice(1).every((p) => coreTierOf(p) === 'secondary'),
        mixedSet.slice(1).map((p) => coreTierOf(p) ?? 'nincs').join(', ')
      ),
      check(
        'lapos sor nincs a készletben',
        !mixedSet.some((p) => p.id === 'm-flat'),
        mixedSet.map((p) => p.id).join(' → ')
      )]

    )
  );

  const thinRound = [
  makePattern({ id: 't-sec', ...VOLATILE }),
  makePattern({ id: 't-ignore', ...IGNORE })].
  filter(isCoreEligible);
  const thinSet = selectCoreSet(thinRound, 3);

  cases.push(
    tierCase(
      'Kevés érvényes jelölt',
      'Nincs kényszerkitöltés: a hármas szám kedvéért nem kerül fel érvénytelen sor',
      [check('egy kártya telik meg', thinSet.length === 1, String(thinSet.length))]
    )
  );

  const sameFixture = [
  makePattern({ id: 'd-1', fixtureId: 'same', ...ACTIONABLE, hitRate: 0.7 }),
  makePattern({ id: 'd-2', fixtureId: 'same', ...ACTIONABLE, hitRate: 0.66 }),
  makePattern({ id: 'd-3', ...VOLATILE })].
  filter(isCoreEligible);
  const distinctSet = selectCoreSet(sameFixture, 3);

  cases.push(
    tierCase(
      'Egy mérkőzés — egy sor',
      'A mérkőzés-egyediség a szintezés után is sérthetetlen',
      [
      check('két kártya telik meg', distinctSet.length === 2, String(distinctSet.length)),
      check(
        'ugyanarról a mérkőzésről csak egy sor',
        new Set(distinctSet.map((p) => p.fixtureId)).size === distinctSet.length,
        distinctSet.map((p) => p.fixtureId).join(', ')
      )]

    )
  );

  /* --- 4. Determinism --------------------------------------------------- */

  const twins = [
  makePattern({ id: 'z-twin', ...VOLATILE }),
  makePattern({ id: 'a-twin', ...VOLATILE })];

  const firstPass = selectCoreSet(twins, 2).map((p) => p.id).join(',');
  const secondPass = selectCoreSet([...twins].reverse(), 2).map((p) => p.id).join(',');

  cases.push(
    tierCase(
      'Determinisztikus sorrend',
      'Minden mért kritériumon holtversenyes sorok mindig ugyanúgy rendeződnek',
      [check('a bemeneti sorrend nem számít', firstPass === secondPass, `${firstPass} vs ${secondPass}`)]
    )
  );

  const failed = cases.filter((c) => !c.passed).length;
  return {
    cases,
    total: cases.length,
    failed,
    passed: failed === 0,
    ruleVersion: CORE_SELECTION_RULE_VERSION
  };
}

/* Development-mode self-check: a regression here silently changes WHICH lines
 * reach a Core card, which is invisible on any single round. */
if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
  const result = runCoreTierSuite();
  if (!result.passed) {
    const broken = result.cases.
    filter((c) => !c.passed).
    map(
      (c) =>
      `${c.label}: ${c.checks.
      filter((x) => !x.passed).
      map((x) => `${x.name} → ${x.actual}`).
      join(', ')}`
    );
    console.error(
      `[coreTier] A core szintezés szerződése sérült (${result.failed} hiba): ` + broken.join(' | ')
    );
  }
}