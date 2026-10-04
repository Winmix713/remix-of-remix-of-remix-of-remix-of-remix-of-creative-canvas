/**
 * CORE CANONICALISATION — EXECUTABLE REGRESSION SUITE (A–H).
 *
 * Three populations decide a Core round, and they are never interchangeable:
 *
 *   raw       — every strategy-market record, duplicates kept, pre-gate
 *   eligible  — records inside every active hard gate
 *   canonical — the eligible set collapsed to one record per (fixture, market)
 *
 * The subtle failure this suite pins down is ORDER: canonicalisation must run
 * AFTER the gates. If a hard-gated record is allowed to win its duplicate
 * group first, it silently deletes a gate-passing sibling, and a Core card is
 * left empty even though a valid candidate existed.
 *
 * Pure and synchronous, in the shape of `utils/coreTierTests.ts`: the operator
 * runs it on their own build from the audit surface.
 */

import { SECONDARY_MARKET_THRESHOLDS, decisionQuadrantOf } from './decision';
import {
  CORE_SELECTION_RULE_VERSION,
  canonicalCandidates,
  candidateKeyOf,
  coreTierOf,
  isCoreEligible,
  selectCoreSet } from
'./slip';
import type { CoreEvidenceSnapshot, DataSufficiency, PatternHit } from '../types/winmix';

/* -------------------------------------------------------------------------- *
 * Fixture builder — synthetic records, real quadrant math
 * -------------------------------------------------------------------------- */

type EvidenceState = 'calibrated' | 'conditional' | 'excluded';

interface RecordSeed {
  id: string;
  /** Defaults to `id`, so two seeds can share one fixture on purpose. */
  fixtureId?: string;
  code?: string;
  hitRate: number;
  marketConfidence: number;
  evidence?: EvidenceState;
  sufficiency?: DataSufficiency;
  stability?: number;
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

function makeRecord(seed: RecordSeed): PatternHit {
  const evidence = seed.evidence ?? 'calibrated';
  const quadrant = decisionQuadrantOf(
    seed.hitRate,
    seed.marketConfidence,
    SECONDARY_MARKET_THRESHOLDS
  );

  return {
    id: seed.id,
    fixtureId: seed.fixtureId ?? seed.id,
    fixtureLabel: `${seed.fixtureId ?? seed.id} hazai – ${seed.fixtureId ?? seed.id} vendég`,
    league: 'angol',
    type: 'goal_market',
    code: seed.code ?? 'BTTS',
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
    modelProb: 0.6,
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
    bttsRisk: null
  };
}

/** Strong direction, strong confidence → primary tier. */
const ACTIONABLE = { hitRate: 0.66, marketConfidence: 62 };
/** Strong direction, confidence under the primary cut-point → secondary tier. */
const VOLATILE = { hitRate: 0.66, marketConfidence: 48 };
/** No direction → refused by the gate. */
const FLAT = { hitRate: 0.54, marketConfidence: 62 };

/* -------------------------------------------------------------------------- *
 * Case table
 * -------------------------------------------------------------------------- */

export interface CoreCanonicalCheck {
  name: string;
  passed: boolean;
  actual: string;
}

export interface CoreCanonicalCaseResult {
  label: string;
  requirement: string;
  passed: boolean;
  checks: CoreCanonicalCheck[];
}

export interface CoreCanonicalSuiteResult {
  cases: CoreCanonicalCaseResult[];
  total: number;
  failed: number;
  passed: boolean;
  ruleVersion: string;
}

function check(name: string, passed: boolean, actual: string): CoreCanonicalCheck {
  return { name, passed, actual };
}

function canonicalCase(
label: string,
requirement: string,
checks: CoreCanonicalCheck[])
: CoreCanonicalCaseResult {
  return { label, requirement, checks, passed: checks.every((c) => c.passed) };
}

/** The production order: gates first, canonicalisation second. */
function gateFirstCanonical(records: readonly PatternHit[]): PatternHit[] {
  return canonicalCandidates(records.filter(isCoreEligible));
}

function tally(records: readonly PatternHit[]): {calibrated: number;conditional: number;} {
  return {
    calibrated: records.filter((r) => r.coreEvidence?.level === 'calibrated').length,
    conditional: records.filter((r) => r.coreEvidence?.level === 'conditional').length
  };
}

export function runCoreCanonicalSuite(): CoreCanonicalSuiteResult {
  const cases: CoreCanonicalCaseResult[] = [];

  /* --- A. No duplicates: raw == canonical ------------------------------- */
  {
    const raw = [
    makeRecord({ id: 'a1', ...ACTIONABLE }),
    makeRecord({ id: 'a2', ...ACTIONABLE }),
    makeRecord({ id: 'a3', ...ACTIONABLE })];

    const canonical = gateFirstCanonical(raw);
    cases.push(
      canonicalCase(
        'A — nincs duplikátum',
        'Három külön mérkőzés, egy piac: a kanonikus halmaz megegyezik a nyerssel.',
        [
        check('kanonikus darab = 3', canonical.length === 3, String(canonical.length)),
        check(
          'nincs beolvasztás',
          new Set(canonical.map(candidateKeyOf)).size === 3,
          String(new Set(canonical.map(candidateKeyOf)).size)
        )]

      )
    );
  }

  /* --- B. Two records for one fixture: one winner, one merged ----------- */
  {
    const raw = [
    makeRecord({ id: 'b-weak', fixtureId: 'b', ...VOLATILE }),
    makeRecord({ id: 'b-strong', fixtureId: 'b', ...ACTIONABLE })];

    const canonical = gateFirstCanonical(raw);
    cases.push(
      canonicalCase(
        'B — egy mérkőzés, két rekord',
        'Ugyanaz a mérkőzés és piac: pontosan EGY kanonikus nyertes, a magasabb szintű.',
        [
        check('kanonikus darab = 1', canonical.length === 1, String(canonical.length)),
        check(
          'nyertes = b-strong (elsődleges)',
          canonical[0]?.id === 'b-strong',
          canonical[0]?.id ?? 'nincs'
        )]

      )
    );
  }

  /* --- C. GATE-FIRST: a gated record must not suppress a passing one ---- */
  {
    // The gate-failing record wins the canonical comparator outright (same
    // primary tier and evidence, higher H2H rate), so a canonical-first order
    // would delete the eligible sibling. Its hard-gate failure is the cold
    // sample gate — a condition the comparator deliberately does not look at.
    const gated = makeRecord({
      id: 'c-gated',
      fixtureId: 'c',
      ...ACTIONABLE,
      hitRate: 0.9,
      sufficiency: 'cold'
    });


    const passing = makeRecord({ id: 'c-ok', fixtureId: 'c', ...ACTIONABLE });
    const raw = [gated, passing];

    const canonicalFirst = canonicalCandidates(raw).filter(isCoreEligible);
    const gateFirst = gateFirstCanonical(raw);
    cases.push(
      canonicalCase(
        'C — kapun kívüli rekord nem nyomhat el kapun belülit',
        'A kapuk ELŐBB futnak, mint az összevonás: a kapun belüli sor megmarad.',
        [
        check('kapu-először eredmény = c-ok', gateFirst[0]?.id === 'c-ok', gateFirst[0]?.id ?? 'nincs'),
        check('kapu-először darab = 1', gateFirst.length === 1, String(gateFirst.length)),
        check(
          'a fordított sorrend valóban veszteséges (regresszió-őr)',
          canonicalFirst.length === 0,
          `${canonicalFirst.length} sor maradna`
        )]

      )
    );
  }

  /* --- D. Everything outside the gate → zero canonical eligible --------- */
  {
    const raw = [
    makeRecord({ id: 'd1', ...FLAT }),
    makeRecord({ id: 'd2', ...FLAT }),
    makeRecord({ id: 'd3', ...FLAT })];

    const canonical = gateFirstCanonical(raw);
    cases.push(
      canonicalCase(
        'D — minden rekord kapun kívül',
        'Nulla kanonikus jogosult, és nincs kényszerkitöltés a core kártyákon.',
        [
        check('kanonikus darab = 0', canonical.length === 0, String(canonical.length)),
        check('core készlet üres', selectCoreSet(raw, 3).length === 0, String(selectCoreSet(raw, 3).length))]

      )
    );
  }

  /* --- E. One fixture may occupy only one Core card --------------------- */
  {
    const raw = [
    makeRecord({ id: 'e-btts', fixtureId: 'e', code: 'BTTS', ...ACTIONABLE }),
    makeRecord({ id: 'e-o25', fixtureId: 'e', code: 'O2.5', ...ACTIONABLE }),
    makeRecord({ id: 'e2', fixtureId: 'e2', ...ACTIONABLE })];

    const core = selectCoreSet(raw, 3);
    const fixtures = new Set(core.map((p) => p.fixtureId));
    cases.push(
      canonicalCase(
        'E — mérkőzés-ütközés a kártyák között',
        'Két piac ugyanarra a mérkőzésre két kanonikus rekord, de csak EGY core kártya.',
        [
        check('kanonikus darab = 3', gateFirstCanonical(raw).length === 3, String(gateFirstCanonical(raw).length)),
        check('core sorok = 2', core.length === 2, String(core.length)),
        check('egyedi mérkőzések = core sorok', fixtures.size === core.length, String(fixtures.size))]

      )
    );
  }

  /* --- F. Secondary fills, but never displaces an available Primary ----- */
  {
    const raw = [
    makeRecord({ id: 'f-sec', fixtureId: 'f1', ...VOLATILE }),
    makeRecord({ id: 'f-pri', fixtureId: 'f2', ...ACTIONABLE })];

    const core = selectCoreSet(raw, 2);
    cases.push(
      canonicalCase(
        'F — másodlagos tölt, de nem szorít ki elsődlegest',
        'Mindkettő bekerül, az elsődleges sor előbb.',
        [
        check('core sorok = 2', core.length === 2, String(core.length)),
        check(
          'első sor elsődleges',
          coreTierOf(core[0]) === 'primary',
          coreTierOf(core[0]) ?? 'nincs'
        )]

      )
    );
  }

  /* --- G. Conditional evidence lands in the right tally ----------------- */
  {
    const raw = [
    makeRecord({ id: 'g-cal', fixtureId: 'g1', ...ACTIONABLE, evidence: 'calibrated' }),
    makeRecord({ id: 'g-con', fixtureId: 'g2', ...ACTIONABLE, evidence: 'conditional' }),
    makeRecord({ id: 'g-exc', fixtureId: 'g3', ...ACTIONABLE, evidence: 'excluded' })];

    const canonical = gateFirstCanonical(raw);
    const counts = tally(canonical);
    cases.push(
      canonicalCase(
        'G — feltételes evidencia a helyes számlálóban',
        'A cáfolt sáv kizár; a kalibrált és a feltételes sor külön számlálóba kerül.',
        [
        check('kizárt evidencia nem jogosult', !canonical.some((r) => r.id === 'g-exc'), String(canonical.length)),
        check('kalibrált = 1', counts.calibrated === 1, String(counts.calibrated)),
        check('feltételes = 1', counts.conditional === 1, String(counts.conditional))]

      )
    );
  }

  /* --- H. Tally invariant: placed ⊆ eligible ⊆ raw ---------------------- */
  {
    const raw = [
    makeRecord({ id: 'h1', fixtureId: 'h1', ...ACTIONABLE }),
    makeRecord({ id: 'h1-dup', fixtureId: 'h1', ...VOLATILE }),
    makeRecord({ id: 'h2', fixtureId: 'h2', ...VOLATILE }),
    makeRecord({ id: 'h3', fixtureId: 'h3', ...FLAT })];

    const canonical = gateFirstCanonical(raw);
    const placed = selectCoreSet(raw, 3);
    const canonicalIds = new Set(canonical.map((r) => r.id));
    const rawIds = new Set(raw.map((r) => r.id));
    cases.push(
      canonicalCase(
        'H — populáció-invariáns',
        'Kártyára került ⊆ kanonikus jogosult ⊆ nyers rekordok, minden lépésnél monoton.',
        [
        check(
          'kártyára került ⊆ kanonikus',
          placed.every((r) => canonicalIds.has(r.id)),
          `${placed.length} / ${canonical.length}`
        ),
        check(
          'kanonikus ⊆ nyers',
          canonical.every((r) => rawIds.has(r.id)),
          `${canonical.length} / ${raw.length}`
        ),
        check(
          'monoton csökkenés',
          placed.length <= canonical.length && canonical.length <= raw.length,
          `${raw.length} → ${canonical.length} → ${placed.length}`
        )]

      )
    );
  }

  const failed = cases.filter((c) => !c.passed).length;
  return {
    cases,
    total: cases.length,
    failed,
    passed: failed === 0,
    ruleVersion: CORE_SELECTION_RULE_VERSION
  };
}
