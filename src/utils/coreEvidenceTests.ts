/**
 * CORE EVIDENCE LIFECYCLE — EXECUTABLE REGRESSION SUITE.
 *
 * The whole correction this gate rests on is one inequality:
 *
 *   "we never measured this probability band"  ≠  "this candidate is bad"
 *
 * That distinction is INVISIBLE on a normal round — an empty core card looks
 * identical whether the cause is a missing measurement or a real, measured
 * refusal — so it is pinned here as a synthetic round that contains all three
 * states at once: a thin-but-otherwise-good band, a measured and calibrated
 * band, and a measured and disproved band.
 *
 * It also pins the ASYMMETRY the fix depends on: a widened neighbour
 * environment may CONFIRM a line, but may never EXCLUDE one. Exclusion can
 * only ever come from the line's OWN evaluable band.
 *
 * Pure and synchronous, in the shape of `utils/invariants.ts` and
 * `utils/coreTierTests.ts`: the operator runs it on their own build from the
 * audit surface, and a development-mode module load reports a break at once.
 */

import { wilsonInterval } from './bootstrap';
import { BAND_MIN_SAMPLE } from './constants';
import {
  CORE_EVIDENCE_RULE_VERSION,
  coherentLevelOf,
  exclusionAllowed,
  isSnapshotCoherent,
  resolveCoreEvidence,
  type CoreEvidenceInput } from
'./coreEvidence';
import {
  MARKET_CALIBRATION_BANDS,
  SECONDARY_MARKET_THRESHOLDS,
  decisionQuadrantOf,
  diagnoseMarketBand } from
'./decision';
import { evidenceLevelOf, gateFailuresForKind, isCoreEligible } from './slip';
import type {
  CoreEvidenceKind,
  CoreEvidenceLevel,
  CoreEvidenceSnapshot,
  MarketCalibrationBand,
  MarketCalibrationBandKey,
  PatternHit } from
'../types/winmix';

/* -------------------------------------------------------------------------- *
 * Synthetic bands — real verdict math, hand-set samples
 * -------------------------------------------------------------------------- */

function bandOf(key: MarketCalibrationBandKey, n: number, hits: number, avgP: number): MarketCalibrationBand {
  const spec = MARKET_CALIBRATION_BANDS.find((s) => s.key === key);
  const ci = wilsonInterval(hits, n);
  const evaluable = n >= BAND_MIN_SAMPLE;
  const diagnosis = diagnoseMarketBand(n, avgP, ci);
  const hitRate = n === 0 ? 0 : hits / n;

  return {
    key,
    label: spec?.label ?? key,
    range: spec?.label ?? key,
    n,
    hits,
    avgP,
    hitRate,
    gap: avgP - hitRate,
    ciLo: ci.lo,
    ciHi: ci.hi,
    calibrated: evaluable && diagnosis === 'calibrated',
    evaluable,
    diagnosis
  };
}

/** The line under test always signals 0.60, i.e. its own band is `p55_65`. */
const MODEL_PROB = 0.6;

/** Own band far too thin to judge, and no usable neighbourhood either. */
function thinOnly(): MarketCalibrationBand[] {
  return [bandOf('p55_65', 6, 4, MODEL_PROB)];
}

/** Own band measured, and the signalled probability survived its interval. */
function calibratedOwnBand(): MarketCalibrationBand[] {
  return [bandOf('p55_65', 120, 72, MODEL_PROB)];
}

/** Own band measured, and the realized rate is nowhere near the signal. */
function disprovedOwnBand(): MarketCalibrationBand[] {
  return [bandOf('p55_65', 671, 228, MODEL_PROB)];
}

/** Own band with EXACTLY `n` audited observations and a hit rate far off the signal. */
function ownBandAt(n: number, hits: number): MarketCalibrationBand[] {
  return [bandOf('p55_65', n, hits, MODEL_PROB)];
}

/** `0 / 20`: the band exists in the log, but nothing was audited into it yet. */
function emptyOwnBand(): MarketCalibrationBand[] {
  return ownBandAt(0, 0);
}

/** `19 / 20`: one observation short of the entry minimum. */
function oneShortOwnBand(): MarketCalibrationBand[] {
  return ownBandAt(19, 7);
}

/** Exactly `20 / 20`, realized rate far BELOW the signal → disproved. */
function minSampleDisproved(): MarketCalibrationBand[] {
  return ownBandAt(BAND_MIN_SAMPLE, 3);
}

/** Exactly `20 / 20`, realized rate inside the interval → calibrated. */
function minSampleCalibrated(): MarketCalibrationBand[] {
  return ownBandAt(BAND_MIN_SAMPLE, 12);
}

/** Thin own band, neighbours that AGREE with the signal once merged. */
function thinOwnBandWithAgreeingNeighbours(): MarketCalibrationBand[] {
  return [
  bandOf('p40_55', 60, 36, 0.5),
  bandOf('p55_65', 6, 4, MODEL_PROB),
  bandOf('p65_75', 60, 37, 0.68)];

}

/** Thin own band, neighbours that DISAGREE once merged — caution, not disproof. */
function thinOwnBandWithDivergentNeighbours(): MarketCalibrationBand[] {
  return [
  bandOf('p40_55', 80, 22, 0.5),
  bandOf('p55_65', 6, 4, MODEL_PROB),
  bandOf('p65_75', 80, 21, 0.68)];

}

/* -------------------------------------------------------------------------- *
 * Synthetic candidate — everything the gate reads is real
 * -------------------------------------------------------------------------- */

function makePattern(
id: string,
snapshot: CoreEvidenceSnapshot,
options: {modelConflict?: boolean;} = {})
: PatternHit {
  const hitRate = 0.66;
  const marketConfidence = 62;
  const quadrant = decisionQuadrantOf(hitRate, marketConfidence, SECONDARY_MARKET_THRESHOLDS);

  return {
    id,
    fixtureId: id,
    fixtureLabel: `${id} hazai – ${id} vendég`,
    league: 'angol',
    type: 'goal_market',
    code: 'BTTS',
    label: 'Mindkét csapat szerez gólt',
    rawRate: hitRate,
    hitRate,
    sample: 9,
    effectiveSampleSize: 6.1,
    usedReverse: false,
    sufficiency: 'warm',
    agreement: 'neutral',
    stability: 72,
    impliedOdds: 1 / hitRate,
    weightApplied: 1,
    decision: quadrant,
    marketConfidence,
    marketDecision: quadrant,
    band: 'good',
    bandHitRate: snapshot.hitRate,
    bandCalibrated: snapshot.level === 'calibrated',
    bandDiagnosis: snapshot.diagnosis,
    modelProb: MODEL_PROB,
    marketBand: snapshot.bandKey,
    marketBandHitRate: snapshot.hitRate,
    marketBandCalibrated: snapshot.level === 'calibrated',
    marketBandDiagnosis: snapshot.diagnosis,
    marketCalibrationStatus:
    snapshot.level === 'calibrated' ?
    'calibrated' :
    snapshot.level === 'excluded' ?
    'uncalibrated' :
    'unevaluated',
    coreEvidence: snapshot,
    evidence: [],
    headToHeadRecord: {
      homeWins: 3,
      draws: 3,
      awayWins: 3,
      total: 9,
      homeWinPct: 1 / 3,
      drawPct: 1 / 3,
      awayWinPct: 1 / 3,
      homeUnbeatenStreak: 2,
      awayUnbeatenStreak: 0
    },
    goalStats: {
      avgGoals: 3.1,
      bttsPct: hitRate,
      over25Pct: 0.64,
      over15Pct: 0.84,
      over35Pct: 0.4
    },
    htStats: null,
    topModalScores: [],
    reversalStats: null,
    goalProfile: null,
    bttsRisk: options.modelConflict ?
    {
      profile: 'high_variance',
      historicalRisk: 0.16,
      modelRisk: 0.18,
      effectiveSampleSize: 6.1,
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
 * Result shape
 * -------------------------------------------------------------------------- */

export interface CoreEvidenceCheck {
  name: string;
  passed: boolean;
  actual: string;
}

export interface CoreEvidenceCaseResult {
  label: string;
  requirement: string;
  expected: CoreEvidenceLevel;
  actual: CoreEvidenceLevel;
  kind: CoreEvidenceKind;
  observations: number;
  required: number;
  scope: string;
  widened: boolean;
  passed: boolean;
  checks: CoreEvidenceCheck[];
}

export interface CoreEvidenceSuiteResult {
  cases: CoreEvidenceCaseResult[];
  gate: CoreEvidenceCheck[];
  total: number;
  failed: number;
  passed: boolean;
  minSample: number;
  ruleVersion: string;
}

function check(name: string, passed: boolean, actual: string): CoreEvidenceCheck {
  return { name, passed, actual };
}

function evidenceCase(
label: string,
requirement: string,
input: CoreEvidenceInput,
expected: CoreEvidenceLevel,
expectedKind: CoreEvidenceKind)
: CoreEvidenceCaseResult {
  const snapshot = resolveCoreEvidence(input);
  const checks = [
  check(`szint = ${expected}`, snapshot.level === expected, snapshot.level),
  check(`indok = ${expectedKind}`, snapshot.kind === expectedKind, snapshot.kind),
  check(
    'a szabályverzió rá van pecsételve',
    snapshot.ruleVersion === CORE_EVIDENCE_RULE_VERSION,
    snapshot.ruleVersion
  ),
  check(
    `a belépési minimum ${BAND_MIN_SAMPLE}`,
    snapshot.required === BAND_MIN_SAMPLE,
    String(snapshot.required)
  )];


  return {
    label,
    requirement,
    expected,
    actual: snapshot.level,
    kind: snapshot.kind,
    observations: snapshot.observations,
    required: snapshot.required,
    scope: snapshot.environmentLabel ?? snapshot.bandLabel ?? '—',
    widened: snapshot.widened,
    passed: checks.every((c) => c.passed),
    checks
  };
}

function registered(marketBands: MarketCalibrationBand[] | null): CoreEvidenceInput {
  return { registered: true, modelProb: MODEL_PROB, marketBands, globalBand: null };
}

/* -------------------------------------------------------------------------- *
 * The suite
 * -------------------------------------------------------------------------- */

export function runCoreEvidenceSuite(): CoreEvidenceSuiteResult {
  const cases: CoreEvidenceCaseResult[] = [
  evidenceCase(
    'Nincs egyetlen mérés sem',
    'Üres kalibrációs napló → feltételes, adathiány indokkal. Sosem kizárás.',
    registered(null),
    'conditional',
    'missing_evidence'
  ),
  evidenceCase(
    'Vékony saját sáv, nincs használható környezet',
    `A saját sáv ${BAND_MIN_SAMPLE} alatt van → feltételes, nem cáfolat.`,
    registered(thinOnly()),
    'conditional',
    'missing_evidence'
  ),
  evidenceCase(
    `n = 0 / ${BAND_MIN_SAMPLE} auditált megfigyelés`,
    'Üres saját sáv → feltételes, adathiány. TILOS a kizárás és a „Cáfolt sáv”.',
    registered(emptyOwnBand()),
    'conditional',
    'missing_evidence'
  ),
  evidenceCase(
    `n = 19 / ${BAND_MIN_SAMPLE} auditált megfigyelés`,
    'Egy megfigyeléssel a minimum alatt → még mindig feltételes, sosem kizárás.',
    registered(oneShortOwnBand()),
    'conditional',
    'missing_evidence'
  ),
  evidenceCase(
    `n = ${BAND_MIN_SAMPLE}, saját sáv cáfolt`,
    'A minimumot pont elérő, NEM kalibrált saját sáv → kemény kizárás.',
    registered(minSampleDisproved()),
    'excluded',
    'disproved'
  ),
  evidenceCase(
    `n = ${BAND_MIN_SAMPLE}, saját sáv kalibrált`,
    'A minimumot pont elérő, kalibrált saját sáv → kalibrált.',
    registered(minSampleCalibrated()),
    'calibrated',
    'verified'
  ),
  evidenceCase(
    'Megmért és igazolt saját sáv',
    'A jelzett valószínűség a Wilson-intervallumon belül → kalibrált.',
    registered(calibratedOwnBand()),
    'calibrated',
    'verified'
  ),
  evidenceCase(
    'Megmért és cáfolt saját sáv',
    'A jelzett valószínűség az intervallumon kívül → KEMÉNY kizárás.',
    registered(disprovedOwnBand()),
    'excluded',
    'disproved'
  ),
  evidenceCase(
    'Vékony saját sáv, egyező bővített környezet',
    'A bővített környezet MEGERŐSÍTHET: kalibrált, láthatóan bővített sávval.',
    registered(thinOwnBandWithAgreeingNeighbours()),
    'calibrated',
    'verified'
  ),
  evidenceCase(
    'Vékony saját sáv, eltérő bővített környezet',
    'A bővített környezet SOSEM zárhat ki — feltételes marad, eltérő környezet indokkal.',
    registered(thinOwnBandWithDivergentNeighbours()),
    'conditional',
    'divergent_environment'
  ),
  evidenceCase(
    'Nem regisztrált piac, nincs értékelhető globális sáv',
    'A régi 1X2 konfidencia-sáv úton is: mérés nélkül feltételes.',
    { registered: false, modelProb: MODEL_PROB, marketBands: null, globalBand: null },
    'conditional',
    'missing_evidence'
  ),

  /* --- NAMED REGRESSION CASES — lastinfo.md §3 fixtures --------------- *
   * Pin the full state transition chain for the three specific fixtures
   * that drove the Policy A correction. Each asserts that the evidence
   * level resolves to the expected terminal state. */

  evidenceCase(
    'Elche – Real Madrid (cáfolt sáv, magas modell)',
    'A modell ~60% BTTS, de a saját sáv cáfolt (671 mérés, 228 találat) → ' +
    'Policy A: hard kizárás, modelProb nem felülbírálja.',
    registered(disprovedOwnBand()),
    'excluded',
    'disproved'
  ),
  evidenceCase(
    'Wolverhampton – Newcastle (vékony sáv, feltételes)',
    'A modell ~60% BTTS, de a saját sáv vékony (6 mérés) → feltételes, ' +
    'nem kizárás. Az adathiány nem cáfolat.',
    registered(thinOnly()),
    'conditional',
    'missing_evidence'
  ),
  evidenceCase(
    'Real Madrid – Getafe (kalibrált sáv, magas modell)',
    'A modell ~60% BTTS, a saját sáv kalibrált (120 mérés, 72 találat) → ' +
    'kalibrált, jogosult core kártyára.',
    registered(calibratedOwnBand()),
    'calibrated',
    'verified'
  )];


  /* --- The gate contract, on top of the resolved levels ------------------- */
  const conditionalPattern = makePattern('cond', resolveCoreEvidence(registered(thinOnly())));
  const calibratedPattern = makePattern('cal', resolveCoreEvidence(registered(calibratedOwnBand())));
  const excludedPattern = makePattern('excl', resolveCoreEvidence(registered(disprovedOwnBand())));
  const conflictPattern = makePattern(
    'conflict',
    resolveCoreEvidence(registered(thinOnly())),
    { modelConflict: true }
  );
  const widenedDivergent = resolveCoreEvidence(registered(thinOwnBandWithDivergentNeighbours()));

  const excludedFailures = gateFailuresForKind(excludedPattern, 'core');
  const conflictFailures = gateFailuresForKind(conflictPattern, 'core');
  const conditionalFailures = gateFailuresForKind(conditionalPattern, 'core');

  /* Per-market EXTREME conflict on a thin sample: |0.66 − 0.30| = 0.36 ≥ 0.25
   * and ESS 5 < 6 — the only shape the model-conflict gate still excludes. */
  const extremeConflictPattern: PatternHit = {
    ...conditionalPattern,
    id: 'cond-extreme-conflict',
    fixtureId: 'cond-extreme-conflict',
    modelProb: 0.3,
    effectiveSampleSize: 5
  };
  const extremeConflictFailures = gateFailuresForKind(extremeConflictPattern, 'core');

  /* --- 0 / 20 … 19 / 20: the whole thin range, swept ---------------------- */
  const thinSweep: CoreEvidenceSnapshot[] = [];
  for (let n = 0; n < BAND_MIN_SAMPLE; n++) {
    thinSweep.push(resolveCoreEvidence(registered(ownBandAt(n, Math.floor(n * 0.15)))));
  }
  const thinSweepBad = thinSweep.filter(
    (snap) => snap.level === 'excluded' || snap.kind === 'disproved'
  );

  /* --- A hand-forged contradiction must not survive the seal -------------- */
  const forgedIncoherent: CoreEvidenceSnapshot = {
    ...resolveCoreEvidence(registered(emptyOwnBand())),
    level: 'excluded',
    kind: 'disproved'
  };

  const allSnapshots: CoreEvidenceSnapshot[] = [
  ...thinSweep,
  resolveCoreEvidence(registered(null)),
  resolveCoreEvidence(registered(thinOnly())),
  resolveCoreEvidence(registered(calibratedOwnBand())),
  resolveCoreEvidence(registered(disprovedOwnBand())),
  resolveCoreEvidence(registered(minSampleDisproved())),
  resolveCoreEvidence(registered(minSampleCalibrated())),
  resolveCoreEvidence(registered(thinOwnBandWithAgreeingNeighbours())),
  widenedDivergent];


  const gate: CoreEvidenceCheck[] = [
  check(
    `0 / ${BAND_MIN_SAMPLE} … ${BAND_MIN_SAMPLE - 1} / ${BAND_MIN_SAMPLE} sosem kizárás`,
    thinSweepBad.length === 0,
    thinSweepBad.length === 0 ?
    `${thinSweep.length} vékony eset, mind feltételes` :
    `${thinSweepBad.length} eset kizárásra futott`
  ),
  check(
    'Az `exclusionAllowed` csak megmért, NEM kalibrált sávra igaz',
    exclusionAllowed({ n: BAND_MIN_SAMPLE, evaluable: true, calibrated: false }) &&
    !exclusionAllowed({ n: BAND_MIN_SAMPLE - 1, evaluable: true, calibrated: false }) &&
    !exclusionAllowed({ n: 400, evaluable: false, calibrated: false }) &&
    !exclusionAllowed({ n: 400, evaluable: true, calibrated: true }) &&
    !exclusionAllowed(null),
    'a központi predikátum mind az öt esetben helyes'
  ),
  check(
    'Minden visszaadott snapshot koherens',
    allSnapshots.every(isSnapshotCoherent),
    `${allSnapshots.filter((s) => !isSnapshotCoherent(s)).length} inkoherens snapshot`
  ),
  check(
    'A kézzel hamisított kizárás visszaminősül feltételesre',
    coherentLevelOf(forgedIncoherent) === 'conditional',
    coherentLevelOf(forgedIncoherent)
  ),
  check(
    'A feltételes szint core kártyára kerülhet (adathiány nem kizárás)',
    isCoreEligible(conditionalPattern),
    isCoreEligible(conditionalPattern) ? 'jogosult' : 'kizárva'
  ),
  check(
    'A kalibrált sor core kártyára kerülhet',
    isCoreEligible(calibratedPattern),
    isCoreEligible(calibratedPattern) ? 'jogosult' : 'kizárva'
  ),
  check(
    'A cáfolt saját sáv Policy A alapján KIZÁR (hard veto, nem Phase 6 mögött)',
    !isCoreEligible(excludedPattern) &&
    excludedFailures.includes('band') &&
    evidenceLevelOf(excludedPattern) === 'excluded',
    `${evidenceLevelOf(excludedPattern)} · ${excludedFailures.join(', ') || 'nincs bukott kapu'}`
  ),
  check(
    'A feltételes sor `band` kapuja NEM bukik el (adathiány nem cáfolat)',
    !conditionalFailures.includes('band'),
    conditionalFailures.join(', ') || 'nincs bukott kapu'
  ),
  check(
    'A fixture-szintű konfliktus-jelzés önmagában NEM zár ki (keresztpiaci veto megszűnt)',
    isCoreEligible(conflictPattern) && !conflictFailures.includes('model_conflict'),
    conflictFailures.join(', ') || 'nincs bukott kapu'
  ),
  check(
    'Piac-szintű extrém eltérés (≥ 25%) + vékony minta (ESS < 6) kizárva (`model_conflict`)',
    !isCoreEligible(extremeConflictPattern) && extremeConflictFailures.includes('model_conflict'),
    extremeConflictFailures.join(', ') || 'nincs bukott kapu'
  ),
  check(
    'A bővített környezet nem termel kizárást',
    widenedDivergent.level !== 'excluded',
    widenedDivergent.level
  ),
  check(
    'A kizárás mindig hordozza a Wilson-korlátokat',
    typeof excludedPattern.coreEvidence?.ciLo === 'number' &&
    typeof excludedPattern.coreEvidence?.ciHi === 'number',
    `${excludedPattern.coreEvidence?.ciLo ?? '—'} … ${excludedPattern.coreEvidence?.ciHi ?? '—'}`
  )];


  const failedCases = cases.filter((c) => !c.passed).length;
  const failedGates = gate.filter((g) => !g.passed).length;

  return {
    cases,
    gate,
    total: cases.length,
    failed: failedCases + failedGates,
    passed: failedCases + failedGates === 0,
    minSample: BAND_MIN_SAMPLE,
    ruleVersion: CORE_EVIDENCE_RULE_VERSION
  };
}

/* Development-mode self-check: a regression here silently changes whether a
 * missing measurement is treated as a refusal — the exact deadlock this module
 * exists to prevent. */
if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
  const result = runCoreEvidenceSuite();
  if (!result.passed) {
    const broken = [
    ...result.cases.
    filter((c) => !c.passed).
    map(
      (c) =>
      `${c.label}: ${c.checks.
      filter((x) => !x.passed).
      map((x) => `${x.name} → ${x.actual}`).
      join(', ')}`
    ),
    ...result.gate.filter((g) => !g.passed).map((g) => `${g.name} → ${g.actual}`)];

    console.error(
      `[coreEvidence] Az evidencia-életciklus szerződése sérült (${result.failed} hiba): ` +
      broken.join(' | ')
    );
  }
}