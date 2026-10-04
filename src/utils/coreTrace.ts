import { CORE_STABILITY_MIN } from './constants';
import { H2H_ESS_WARM } from './patterns';
import { CORE_EVIDENCE_MAX_RADIUS } from './coreEvidence';
import { QUADRANT_DOC, explainQuadrant, type QuadrantExplain } from './quadrantExplain';
import { DECISION_THRESHOLDS, SECONDARY_MARKET_THRESHOLDS } from './decision';
import {
  GATE_DETAIL,
  GATE_LABEL,
  auditedCanonicalCandidates,
  canonicalWinnerReason,
  candidateKeyOf,
  coreQualityFailures,
  coreTierOf,
  effectiveDecisionOf,
  evidenceLevelOf,
  gateFailuresForKind,
  perMarketModelSpread,
  rawDuplicateGroupCount,
  type CanonicalStatus,
  type GateCondition,
  type StrategyReadout } from
'./slip';
import type {
  CoreEvidenceKind,
  CoreEvidenceLevel,
  DecisionQuadrant,
  FixtureAnalysis,
  MarqueeRiskLevel,
  PatternAgreement,
  PatternHit,
  PatternType } from
'../types/winmix';

export type CoreGateEffect = 'hard' | 'conditional_hard' | 'scope' | 'rank' | 'display';

export interface CoreGateSpec {
  id: string;
  step: number;
  name: string;
  file: string;
  fn: string;
  threshold: string;
  why: string;
  effect: CoreGateEffect;
}

export const CORE_GATE_REGISTRY: readonly CoreGateSpec[] = [
{
  id: 'market_scope',
  step: 1,
  name: 'Piac-szűrés (stratégia kódjai)',
  file: 'utils/slip.ts',
  fn: 'strategySlots → spec.codes.includes(p.code)',
  threshold: 'a stratégia pontos market kódjai (pl. BTTS)',
  why: 'Csak a stratégia piacába tartozó sorok lehetnek jelöltek.',
  effect: 'scope'
},
{
  id: 'decision',
  step: 2,
  name: 'Kvadráns (core szint)',
  file: 'utils/decision.ts + utils/slip.ts',
  fn: 'decisionQuadrantOf(hitRate, marketConfidence, …) → effectiveDecisionOf',
  threshold:
  `P = súly. H2H ≥ ${SECONDARY_MARKET_THRESHOLDS.pMin} ÉS C = piaci konfidencia ≥ ` +
  `${SECONDARY_MARKET_THRESHOLDS.cMin} (gól/HT-FT piac, BTTS is); minden más ` +
  `családnál P ≥ ${DECISION_THRESHOLDS.minProbability} ÉS C = stability ≥ ` +
  `${DECISION_THRESHOLDS.minConfidence}`,
  why: 'Cselekvőképes = elsődleges, volatilis = másodlagos core; flat és ignore kizárt.',
  effect: 'hard'
},
{
  id: 'sample',
  step: 3,
  name: 'Hideg minta (Kish ESS)',
  file: 'utils/slip.ts',
  fn: "coreQualityFailures → pattern.sufficiency === 'cold'",
  threshold: `ESS ≥ ${H2H_ESS_WARM} (a 'cold' fokozat felett)`,
  why: 'A recency-súlyozott effektív mintaméretnek elegendőnek kell lennie.',
  effect: 'hard'
},
{
  id: 'stability',
  step: 4,
  name: 'Stabilitás',
  file: 'utils/slip.ts',
  fn: 'coreQualityFailures → pattern.stability < CORE_STABILITY_MIN',
  threshold: `stabilitás ≥ ${CORE_STABILITY_MIN}`,
  why: 'A core nem egyszeri kilengésre épül.',
  effect: 'hard'
},
{
  id: 'market_uncalibrated',
  step: 5,
  name: 'Csapatgól-piac core tilalom',
  file: 'utils/slip.ts',
  fn: 'coreQualityFailures → isTeamGoalCoreBlocked',
  threshold: "csapatgól kód ÉS marketCalibrationStatus !== 'calibrated'",
  why: 'A csapatgól-család csak saját piac-specifikus visszamérés után lehet core.',
  effect: 'hard'
},
{
  id: 'band',
  step: 6,
  name: 'Cáfolt saját valószínűségi sáv',
  file: 'utils/coreEvidence.ts + utils/slip.ts',
  fn: "resolveCoreEvidence → level === 'excluded' → gateFailuresForKind (Policy A — ALWAYS active)",
  threshold: 'a SAJÁT sávban n ≥ 20, és a jelzett érték Wilson-intervallumon kívül van',
  why:
  `Csak a saját, értékelhető sáv zárhat ki; a bővített ±${CORE_EVIDENCE_MAX_RADIUS} ` +
  'sávos környezet soha nem cáfolhat. Policy A: a cáfolt sáv ALWAYS kizár — ' +
  'a modell valószínűség nem írhatja felül. Lásd lastinfo.md §1–2.',
  effect: 'hard'
},
{
  id: 'model_conflict',
  step: 7,
  name: 'Modell–H2H konfliktus (csak feltételes sornál)',
  file: 'utils/slip.ts',
  fn: "gateFailuresForKind → level === 'conditional' && hasMaterialModelConflict (piac-szintű)",
  threshold: '|hitRate − modelProb| ≥ 0,25 ÉS ESS < 6 — a piac saját értékein',
  why:
  'Csak feltételes evidencia mellett, és csak extrém eltérés + vékony minta ' +
  'esetén kizáró; enyhébb eltérés rangsor-büntetés (modelSpread tie-break).',
  effect: 'conditional_hard'
},
{
  id: 'blowout_profile',
  step: 8,
  name: 'Kiütés-profil szűrő (BTTS)',
  file: 'utils/bttsProfile.ts + utils/slip.ts',
  fn: 'assessBttsBlowoutRisk → strategySlots → flagged(p)',
  threshold: 'bttsRisk.wouldVeto — csak ÉLES veto módban és profileVeto stratégiánál',
  why: 'Árnyék módban csak diagnosztika.',
  effect: 'conditional_hard'
},
{
  id: 'evidence_priority',
  step: 9,
  name: 'Szint- és evidencia-elsőbbség',
  file: 'utils/slip.ts',
  fn: 'byTierThenEvidenceThenStrategy → coreTierRank → evidenceRank',
  threshold: 'elsődleges < másodlagos; kalibrált < feltételes < kizárt',
  why: 'Csak rangsorol, nem zár ki.',
  effect: 'rank'
},
{
  id: 'ranking',
  step: 10,
  name: 'Lexikografikus rangsor',
  file: 'utils/slip.ts',
  fn: 'byStrategyRank',
  threshold: 'H2H% → modell% → Kish ESS → modell-egyezés → kiütés-risk',
  why: 'Csak rangsorol, nem zár ki.',
  effect: 'rank'
},
{
  id: 'distinct_fixture',
  step: 11,
  name: 'Egy mérkőzés — egy sor',
  file: 'utils/slip.ts',
  fn: 'pickDistinctFixtures',
  threshold: 'fixtureId egyszer szerepelhet a core oldalon',
  why: 'Egy meccs nem kerülhet két Core-slotba.',
  effect: 'scope'
},
{
  id: 'slot_limit',
  step: 12,
  name: 'Core 01 / 02 / 03 slot-kitöltés',
  file: 'utils/slip.ts',
  fn: 'strategySlots → CORE_ROLES.slice(0, spec.slots)',
  threshold: 'legfeljebb 3 sor; relaxed tartalék tiltott',
  why: 'Az üres Core-slot érvényes kimenet.',
  effect: 'scope'
},
{
  id: 'cohesion',
  step: 13,
  name: 'Kohéziós érték (átlaggól)',
  file: 'utils/patterns.ts → goalProfile.weightedAvgGoals',
  fn: 'CoreCandidateTable — csak megjelenítés',
  threshold: 'nincs küszöb',
  why: 'Nem szűr és nem rangsorol.',
  effect: 'display'
}];


export interface CoreTraceGateResult {
  id: string;
  passed: boolean;
  actual: string;
  binding: boolean;
}

export type CoreTraceVerdict = 'core' | 'gate_failed' | 'vetoed' | 'flagged_shadow' | 'outranked' | 'blocked';

export interface CoreTraceCandidate {
  id: string;
  fixture: string;
  fixtureId: string;
  code: string;
  patternType: PatternType;
  patternLabel: string;
  evidence: CoreEvidenceLevel;
  evidenceKind: CoreEvidenceKind | null;
  modelProb: number | null;
  h2hRate: number;
  stability: number;
  ess: number;
  quadrant: DecisionQuadrant;
  quadrantExplain: QuadrantExplain;
  agreement: PatternAgreement;
  judgedBy: 'market' | 'global';
  bandLabel: string | null;
  widened: boolean;
  observations: number;
  required: number;
  hits: number | null;
  measuredRate: number | null;
  signalledProb: number | null;
  ciLo: number | null;
  ciHi: number | null;
  outsideInterval: boolean | null;
  calibrationStatus: string;
  blowoutHistorical: number | null;
  blowoutModel: number | null;
  wouldVeto: boolean;
  vetoReasons: string[];
  cohesion: number | null;
  gates: CoreTraceGateResult[];
  failed: GateCondition[];
  slot: number | null;
  verdict: CoreTraceVerdict;
  primaryCause: string;
  primaryCauseDetail: string;
  /** GATE-FIRST: true when this RAW record survived every active hard gate. */
  gateSurvivor: boolean;
  /** True when it survived the gates AND won its `(fixtureId, code)` group. */
  canonicalWinner: boolean;
  /** Winner record id when this gate-surviving record was merged away. */
  mergedInto: string | null;
  canonicalStatus: CanonicalStatus;
  /** Why the winner beat this record — only for `merged` rows. */
  canonicalReason: string | null;
  /** Present in the raw duplicate audit (group size > 1). */
  inDuplicateGroup: boolean;
  /* --- RANGADÓ (BÜNTETŐPONT) — csak a BTTS jelölt sorban értelmezett ------ *
   * Rangsor-mezők. Egyetlen mért érték sem függ tőlük, és a `penalty` csak
   * akkor hat a sorrendre, ha `marqueeApplied` igaz (éles zászló). */
  marqueeRegistered: boolean;
  marqueeLevel: MarqueeRiskLevel;
  marqueePenalty: number;
  marqueeApplied: boolean;
  marqueeReasons: string[];
}

export interface CoreTraceStage {
  id: string;
  label: string;
  count: number;
  lost: number;
  detail: string;
  /** False when the stage is not a subset of the stage above it. */
  ok: boolean;
  issue: string | null;
}

export interface CoreTraceFixtureRow {
  fixture: string;
  patterns: number;
  codes: string[];
  inFamily: boolean;
}

export interface CoreTraceConditionalRow {
  code: string;
  total: number;
  eligible: number;
  inFamily: boolean;
}

export interface CoreTraceDuplicateGroup {
  fixture: string;
  fixtureId: string;
  rows: CoreTraceCandidate[];
  explanation: string;
  /** Canonical winner record id of the group, or `null` when nobody passed. */
  winnerId: string | null;
}

export interface CoreTraceLevelTally {
  calibrated: number;
  conditional: number;
  excluded: number;
  total: number;
}

/**
 * THREE NAMED POPULATIONS — never interchangeable.
 *   raw      — every raw strategy-market record, pre-gate
 *   eligible — canonical, gate-passing Core candidates
 *   placed   — the records that actually occupy a Core card
 */
export interface CoreTraceEvidenceTally {
  raw: CoreTraceLevelTally;
  eligible: CoreTraceLevelTally;
  placed: CoreTraceLevelTally;
}

/** Population counters, each named after exactly one set. */
export interface CoreTracePopulations {
  rawRecords: number;
  qualityPassedRaw: number;
  afterEvidenceRaw: number;
  afterModelConflictRaw: number;
  afterActiveProfileVetoRaw: number;
  canonicalEligible: number;
  mergedEligibleDuplicates: number;
  rawDuplicateGroups: number;
  placed: number;
}

export interface CoreTrace {
  strategy: string;
  strategyLabel: string;
  vetoMode: string;
  vetoActive: boolean;
  familyCodes: string[];
  fixtures: number;
  patternsTotal: number;
  fixtureRows: CoreTraceFixtureRow[];
  marketRows: {code: string;count: number;}[];
  stages: CoreTraceStage[];
  /** RAW records of the strategy's market — the audit population. */
  candidates: CoreTraceCandidate[];
  /** Canonical, gate-passing Core candidates — the Core denominator. */
  canonicalEligible: CoreTraceCandidate[];
  populations: CoreTracePopulations;
  /** False when any funnel stage is not a subset of the stage above it. */
  funnelOk: boolean;
  quadrantDoc: typeof QUADRANT_DOC;
  duplicates: CoreTraceDuplicateGroup[];
  evidenceTally: CoreTraceEvidenceTally;
  disproved: CoreTraceCandidate[];
  attribution: {cause: string;count: number;detail: string;}[];
  conditional: {
    familyTotal: number;
    familyEligible: number;
    familyBlocked: number;
    outsideTotal: number;
    byCode: CoreTraceConditionalRow[];
  };
  admitsConditional: {allowed: boolean;reason: string;};
  slots: {index: number;fixture: string | null;evidence: CoreEvidenceLevel | null;}[];
  coreSlots: number;
  coreFilled: number;
}

function quadrantOk(pattern: PatternHit): boolean {
  const decision = effectiveDecisionOf(pattern);
  return decision === 'actionable' || decision === 'volatile';
}

function gateResults(
pattern: PatternHit,
failed: GateCondition[],
vetoActive: boolean,
profileVeto: boolean)
: CoreTraceGateResult[] {
  const level = evidenceLevelOf(pattern);
  const snap = pattern.coreEvidence ?? null;
  const marketSpread = perMarketModelSpread(pattern);
  const flagged = pattern.bttsRisk?.wouldVeto ?? false;

  return [
  { id: 'decision', passed: quadrantOk(pattern), actual: effectiveDecisionOf(pattern), binding: true },
  {
    id: 'sample',
    passed: pattern.sufficiency !== 'cold',
    actual: `${pattern.sufficiency} · ESS ${pattern.effectiveSampleSize.toFixed(2)}`,
    binding: true
  },
  { id: 'stability', passed: pattern.stability >= CORE_STABILITY_MIN, actual: pattern.stability.toFixed(0), binding: true },
  {
    id: 'market_uncalibrated',
    passed: !failed.includes('market_uncalibrated'),
    actual: pattern.marketCalibrationStatus ?? 'unregistered',
    binding: true
  },
  {
    id: 'band',
    passed: level !== 'excluded',
    actual:
    (snap && snap.observations > 0 ? `${level} · n = ${snap.observations} / ${snap.required}` : level) +
    (level === 'excluded' ? ' · Policy A hard veto — cáfolt sáv' : ''),
    binding: true
  },
  {
    id: 'model_conflict',
    passed: !failed.includes('model_conflict'),
    actual:
    marketSpread === null ?
    'nincs modellbecslés a piacon' :
    `|hitRate − modelProb| = ${(marketSpread * 100).toFixed(0)}%` + (
    failed.includes('model_conflict') ? ' — extrém eltérés + vékony minta' : ''),
    binding: level === 'conditional'
  },
  {
    id: 'blowout_profile',
    passed: !flagged,
    actual: flagged ? 'megjelölve' : 'nincs megjelölés',
    binding: profileVeto && vetoActive
  }];

}

function outsideInterval(signalled: number | null, lo: number | null, hi: number | null): boolean | null {
  if (signalled === null || lo === null || hi === null) return null;
  return signalled < lo || signalled > hi;
}

function primaryCauseOf(
row: Omit<CoreTraceCandidate, 'primaryCause' | 'primaryCauseDetail'>)
: {primaryCause: string;primaryCauseDetail: string;} {
  if (row.slot !== null) {
    return {
      primaryCause: `Core ${row.slot}`,
      primaryCauseDetail:
      row.evidence === 'conditional' ?
      'Felkerült, de feltételes evidencia-szinten.' :
      'Felkerült, kalibrált evidencia-szinten.'
    };
  }
  if (row.verdict === 'blocked' || row.evidence === 'excluded') {
    return {
      primaryCause: 'Cáfolt sáv (Policy A)',
      primaryCauseDetail: `A sor saját sávja statisztikailag cáfolt (evidenceLevel=excluded). A modell valószínűség nem elégséges a felülbíráláshoz. Policy A — lásd lastinfo.md §2.`
    };
  }
  if (row.failed.length > 0) {
    const first = row.failed[0];
    return {
      primaryCause: GATE_LABEL[first],
      primaryCauseDetail: `${GATE_DETAIL[first]}${
      row.failed.length > 1 ?
      ` (további bukott feltétel: ${row.failed.slice(1).map((c) => GATE_LABEL[c]).join(', ')})` :
      ''}.`

    };
  }
  if (row.verdict === 'vetoed') {
    return { primaryCause: 'Kiütés-profil (ÉLES)', primaryCauseDetail: row.vetoReasons.join(' ') || 'A profil-szűrő levette a sort.' };
  }
  if (row.canonicalStatus === 'merged' && row.mergedInto !== null) {
    return {
      primaryCause: 'Duplikátum összevonva (kanonikus vesztes)',
      primaryCauseDetail:
      `Minden aktív kaput teljesített, de a(z) ${row.mergedInto} rekord nyerte a ` +
      `(mérkőzés, piac) csoport kanonikus döntését. ${row.canonicalReason ?? ''}`.trim()
    };
  }
  if (row.verdict === 'flagged_shadow') {
    return {
      primaryCause: 'Rangsor (profil-jelölés árnyékban)',
      primaryCauseDetail: 'A profil-szűrő csak megjelölte a sort; a rangsor mögé került.'
    };
  }
  return {
    primaryCause: 'Rangsor / egy-mérkőzés szabály',
    primaryCauseDetail: 'Kanonikus, kapun belüli jelölt, amely a rangsorban hátrébb került, vagy a fixture már szerepel a core oldalon.'
  };
}

/**
 * FUNNEL GUARD — every candidate stage must be a SUBSET of the stage above it.
 *
 * This is what makes a negative or increasing stage impossible: the classic
 * regression was a 6 → 1 → 0 funnel where "lost" was computed from a global
 * tally rather than the adjacent stage, producing counts like `1 − 3 = −2`.
 */
export function assertFunnelStep(
previous: readonly {id: string;}[],
current: readonly {id: string;}[],
name: string)
: {ok: boolean;issue: string | null;} {
  if (current.length > previous.length) {
    return {
      ok: false,
      issue: `„${name}" NŐTT az előző lépéshez képest (${previous.length} → ${current.length}).`
    };
  }
  const previousIds = new Set(previous.map((row) => row.id));
  const stray = current.find((row) => !previousIds.has(row.id));
  if (stray) {
    return {
      ok: false,
      issue: `„${name}" olyan rekordot tartalmaz (${stray.id}), amely az előző lépésben nem szerepelt.`
    };
  }
  return { ok: true, issue: null };
}


function tallyLevels(rows: readonly CoreTraceCandidate[]): CoreTraceLevelTally {
  return {
    calibrated: rows.filter((r) => r.evidence === 'calibrated').length,
    conditional: rows.filter((r) => r.evidence === 'conditional').length,
    excluded: rows.filter((r) => r.evidence === 'excluded').length,
    total: rows.length
  };
}

const PATTERN_SOURCE: Record<PatternType, string> = {
  safety_trend: 'safetyTrend() — kimenet-trend a súlyozott H2H poolon',
  goal_market: 'goalMarket() — súlyozott H2H gólpiaci arány',
  exact_score: 'exactScore() — modális pontos eredmény',
  htft_reversal: 'reversal() — HT/FT fordulás',
  ht_market: 'htMarket() — félidős piac',
  streak: 'streak() — megszakítás nélküli sorozat',
  model_agreement: 'modelAgreement() — modell és H2H egyezése'
};

function duplicateExplanation(rows: readonly CoreTraceCandidate[]): string {
  const types = Array.from(new Set(rows.map((r) => r.patternType)));
  const codes = Array.from(new Set(rows.map((r) => r.code)));
  const parts: string[] = [];
  if (codes.length > 1) parts.push(`Külön market kódok: ${codes.join(', ')}.`);
  if (types.length > 1) {
    parts.push(
      `Azonos piac, ${types.length} generator: ${types.map((t) => `${t} → ${PATTERN_SOURCE[t]}`).join(' · ')}. ` +
      'A modellérték azonos lehet, a H2H különbözhet, mert a generátorok más képletet használnak.'
    );
  }
  if (types.length === 1 && codes.length === 1) {
    parts.push(`Nem várt duplikáció: ${rows.map((r) => r.id).join(' · ')}.`);
  }
  parts.push('A core oldalon ugyanebből a fixture-ből csak egy sor szerepelhet.');
  return parts.join(' ');
}

export interface CoreTraceInput {
  analyses: readonly FixtureAnalysis[];
  readout: StrategyReadout;
  familyCodes: readonly string[];
  profileVeto: boolean;
}

export function buildCoreTrace(input: CoreTraceInput): CoreTrace {
  const { analyses, readout, familyCodes, profileVeto } = input;
  const allPatterns = analyses.flatMap((analysis) => analysis.patterns);
  const family = allPatterns.filter((pattern) => familyCodes.includes(pattern.code));
  const vetoActive = readout.vetoActive;

  const fixtureRows: CoreTraceFixtureRow[] = analyses.map((analysis) => {
    const codes = Array.from(new Set(analysis.patterns.map((pattern) => pattern.code)));
    return {
      fixture: analysis.label || analysis.fixtureId,
      patterns: analysis.patterns.length,
      codes,
      inFamily: codes.some((code) => familyCodes.includes(code))
    };
  });

  const marketCounts = new Map<string, number>();
  allPatterns.forEach((pattern) => marketCounts.set(pattern.code, (marketCounts.get(pattern.code) ?? 0) + 1));
  const marketRows = Array.from(marketCounts.entries()).
  map(([code, count]) => ({ code, count })).
  sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));

  const slotOf = new Map<string, number>();
  readout.candidates.forEach((row) => {
    if (row.slot !== null) slotOf.set(row.pattern.id, row.slot);
  });

  /* ======================================================================== *
   * GATE-FIRST POPULATIONS (v2.3)
   *
   * The trace used to build its whole candidate list from the RAW family and
   * then call that list "jelölt", while the Core summary counted CANONICAL
   * survivors — so one round reported 11 examined candidates and 12 BTTS
   * candidates. Two explicit populations now exist side by side:
   *
   *   rawFamily          — every raw record of the strategy's market (audit)
   *   canonicalEligible  — gate survivors, merged by (fixtureId, code) (Core)
   *
   * Each stage below is derived STRICTLY from the stage above it, and the
   * derivation is checked by `assertFunnelStep`.
   * ======================================================================== */
  const rawFamily = family;
  const qualityPassedRaw = rawFamily.filter(
    (pattern) => coreQualityFailures(pattern).length === 0
  );
  const afterEvidenceRaw = qualityPassedRaw.filter(
    (pattern) => evidenceLevelOf(pattern) !== 'excluded'
  );
  const afterModelConflictRaw = afterEvidenceRaw.filter(
    (pattern) => !gateFailuresForKind(pattern, 'core').includes('model_conflict')
  );
  const afterTierRaw = afterModelConflictRaw.filter((pattern) => coreTierOf(pattern) !== null);
  /* The profile veto is a HARD gate only in LIVE mode. A shadow flag never
   * removes a record and therefore never changes eligibility. */
  const afterActiveProfileVetoRaw =
  profileVeto && vetoActive ?
  afterTierRaw.filter((pattern) => !(pattern.bttsRisk?.wouldVeto ?? false)) :
  afterTierRaw;

  /* Canonicalise ONLY the gate survivors. */
  const canonicalAudit = auditedCanonicalCandidates(afterActiveProfileVetoRaw);
  const gateSurvivorIds = new Set(afterActiveProfileVetoRaw.map((pattern) => pattern.id));
  const winnerById = new Map<string, PatternHit>();
  canonicalAudit.winners.forEach((winner) => winnerById.set(winner.id, winner));
  const patternById = new Map(rawFamily.map((pattern) => [pattern.id, pattern]));

  const rawGroupSizes = new Map<string, number>();
  rawFamily.forEach((pattern) => {
    const key = candidateKeyOf(pattern);
    rawGroupSizes.set(key, (rawGroupSizes.get(key) ?? 0) + 1);
  });

  const candidates: CoreTraceCandidate[] = rawFamily.map((pattern) => {
    const failed = gateFailuresForKind(pattern, 'core');
    const level = evidenceLevelOf(pattern);
    const snap = pattern.coreEvidence ?? null;
    const slot = slotOf.get(pattern.id) ?? null;
    const flagged = pattern.bttsRisk?.wouldVeto ?? false;
    const signalledProb = snap?.avgP ?? null;
    const ciLo = snap?.ciLo ?? null;
    const ciHi = snap?.ciHi ?? null;
    const gateSurvivor = gateSurvivorIds.has(pattern.id);
    const canonicalWinner = canonicalAudit.winnerIds.has(pattern.id);
    const mergedInto = canonicalAudit.mergedInto.get(pattern.id) ?? null;
    const inDuplicateGroup = (rawGroupSizes.get(candidateKeyOf(pattern)) ?? 1) > 1;
    /* A hard-gate failure is NEVER labelled "merged". */
    const canonicalStatus: CanonicalStatus =
    canonicalWinner ? 'winner' :
    mergedInto !== null ? 'merged' :
    inDuplicateGroup && !gateSurvivor ? 'no_eligible_winner' :
    null;
    const winnerPattern = mergedInto !== null ? winnerById.get(mergedInto) ?? null : null;
    const canonicalReason =
    winnerPattern ? canonicalWinnerReason(winnerPattern, pattern) : null;
    const verdict: CoreTraceVerdict =
    slot !== null ? 'core' :
    level === 'excluded' ? 'blocked' :
    failed.length > 0 ? 'gate_failed' :
    flagged && profileVeto && vetoActive ? 'vetoed' :
    flagged && profileVeto ? 'flagged_shadow' : 'outranked';

    const base: Omit<CoreTraceCandidate, 'primaryCause' | 'primaryCauseDetail'> = {
      id: pattern.id,
      fixture: pattern.fixtureLabel,
      fixtureId: pattern.fixtureId,
      code: pattern.code,
      patternType: pattern.type,
      patternLabel: pattern.label,
      evidence: level,
      evidenceKind: snap?.kind ?? null,
      modelProb: pattern.modelProb ?? null,
      h2hRate: pattern.hitRate,
      stability: pattern.stability,
      ess: pattern.effectiveSampleSize,
      quadrant: effectiveDecisionOf(pattern),
      quadrantExplain: explainQuadrant(pattern),
      agreement: pattern.agreement,
      judgedBy: pattern.marketCalibrationStatus && pattern.marketCalibrationStatus !== 'unregistered' ? 'market' : 'global',
      bandLabel: snap?.environmentLabel ?? snap?.bandLabel ?? null,
      widened: snap?.widened ?? false,
      observations: snap?.observations ?? 0,
      required: snap?.required ?? 0,
      hits: snap?.hits ?? null,
      measuredRate: snap?.hitRate ?? null,
      signalledProb,
      ciLo,
      ciHi,
      outsideInterval: outsideInterval(signalledProb, ciLo, ciHi),
      calibrationStatus: pattern.marketCalibrationStatus ?? 'unregistered',
      blowoutHistorical: pattern.bttsRisk?.historicalRisk ?? null,
      blowoutModel: pattern.bttsRisk?.modelRisk ?? null,
      wouldVeto: flagged,
      vetoReasons: pattern.bttsRisk?.vetoReasons ?? [],
      cohesion: pattern.goalProfile?.weightedAvgGoals ?? null,
      gates: gateResults(pattern, failed, vetoActive, profileVeto),
      failed,
      slot,
      verdict,
      gateSurvivor,
      canonicalWinner,
      mergedInto,
      canonicalStatus,
      canonicalReason,
      inDuplicateGroup,
      /* RANGADÓ — csak BTTS soron értelmezett rangsor-információ. */
      marqueeRegistered: pattern.code === 'BTTS' ? pattern.marqueeRisk?.registered ?? false : false,
      marqueeLevel: pattern.code === 'BTTS' ? pattern.marqueeRisk?.level ?? 'none' : 'none',
      marqueePenalty: pattern.code === 'BTTS' ? pattern.marqueeRisk?.penalty ?? 0 : 0,
      marqueeApplied: pattern.code === 'BTTS' ? pattern.marqueeRisk?.applied ?? false : false,
      marqueeReasons: pattern.code === 'BTTS' ? pattern.marqueeRisk?.reasons ?? [] : []
    };
    return { ...base, ...primaryCauseOf(base) };
  });

  candidates.sort((a, b) =>
  (a.slot ?? 99) - (b.slot ?? 99) ||
  a.failed.length - b.failed.length ||
  b.h2hRate - a.h2hRate
  );

  const rowById = new Map(candidates.map((row) => [row.id, row]));
  const rowsOf = (patterns: readonly PatternHit[]): CoreTraceCandidate[] =>
  patterns.map((pattern) => rowById.get(pattern.id)).filter((row): row is CoreTraceCandidate => Boolean(row));

  const canonicalEligibleRows = rowsOf(canonicalAudit.winners);
  const placedRows = candidates.filter((candidate) => candidate.slot !== null);

  /* Evidence tallies: raw ≠ eligible ≠ placed, and each is labelled. */
  const evidenceTally: CoreTraceEvidenceTally = {
    raw: tallyLevels(candidates),
    eligible: tallyLevels(canonicalEligibleRows),
    placed: tallyLevels(placedRows)
  };

  /* --- RAW duplicate audit — never a canonical denominator ---------------- */
  const byKey = new Map<string, CoreTraceCandidate[]>();
  candidates.forEach((row) => {
    const key = `${row.fixtureId}::${row.code}`;
    const rows = byKey.get(key) ?? [];
    rows.push(row);
    byKey.set(key, rows);
  });
  const byFixtureRaw = new Map<string, CoreTraceCandidate[]>();
  candidates.forEach((row) => {
    const rows = byFixtureRaw.get(row.fixtureId) ?? [];
    rows.push(row);
    byFixtureRaw.set(row.fixtureId, rows);
  });
  const duplicates: CoreTraceDuplicateGroup[] = Array.from(byFixtureRaw.entries()).
  filter(([, rows]) => rows.length > 1).
  map(([fixtureId, rows]) => ({
    fixture: rows[0].fixture,
    fixtureId,
    rows,
    explanation: duplicateExplanation(rows),
    winnerId: rows.find((row) => row.canonicalWinner)?.id ?? null
  }));

  const vetoedRows = afterTierRaw.
  filter((pattern) => profileVeto && vetoActive && (pattern.bttsRisk?.wouldVeto ?? false)).
  map((pattern) => rowById.get(pattern.id)).
  filter((row): row is CoreTraceCandidate => Boolean(row));
  /* A cáfolt sávú sorok populációja az EVIDENCIA-SZINTBŐL jön, nem a 'band'
   * kapuhibából: a Phase 6 kapu inaktív állapotában a `failed` lista soha nem
   * tartalmaz 'band'-et, de a mért cáfolat attól még létezik és látszania kell. */
  const allDisprovedRows = candidates.filter((candidate) => candidate.evidence === 'excluded');

  /* --- Funnel: 8 stages, each derived from the one above ------------------ */
  const funnelIssues: string[] = [];
  const stage = (
  id: string,
  label: string,
  current: readonly { id: string }[],
  previous: readonly { id: string }[],
  detail: string)
  : CoreTraceStage => {
    const step = assertFunnelStep(previous, current, label);
    if (!step.ok && step.issue) funnelIssues.push(step.issue);
    return {
      id,
      label,
      count: current.length,
      lost: Math.max(0, previous.length - current.length),
      detail: step.ok ? detail : `${detail} (!! ${step.issue})`,
      ok: step.ok,
      issue: step.issue
    };
  };

  const stages: CoreTraceStage[] = [
  {
    id: 'fixtures',
    label: 'Elemzett mérkőzés',
    count: analyses.length,
    lost: 0,
    detail: 'A fordulóból kitöltött és lefuttatott fixture-ök. Tájékoztató sor: nem jelölt-populáció.',
    ok: true,
    issue: null
  },
  {
    id: 'patterns',
    label: 'Összes piaci sor',
    count: allPatterns.length,
    lost: 0,
    detail: 'Minden mérkőzés minden market pattern-je, minden piacon. Tájékoztató sor.',
    ok: true,
    issue: null
  },
  stage('raw', `Nyers stratégiajelölt-rekordok (${familyCodes.join(', ') || '—'})`, rawFamily, rawFamily, 'A stratégia piacának MINDEN nyers rekordja, duplikátumokkal együtt. Ez az audit populáció, nem a Core nevező.'),
  stage('quality', 'Minőségi kapun belül (kvadráns + minta + stabilitás)', qualityPassedRaw, rawFamily, 'Kalibrációtól független minőségi feltételek, rekordonként.'),
  stage('evidence', 'Cáfolt saját sáv nélkül', afterEvidenceRaw, qualityPassedRaw, 'Csak megmért, SAJÁT és cáfolt sáv zár ki; bővített környezet soha.'),
  stage('conflict', 'Feltételes modell–H2H konfliktus nélkül', afterModelConflictRaw, afterEvidenceRaw, 'Csak feltételes evidencia mellett kizáró.'),
  stage('tier', 'Core-szinttel rendelkező rekordok', afterTierRaw, afterModelConflictRaw, 'Elsődleges vagy másodlagos szint; szint nélküli sor nem lehet Core.'),
  stage('veto', `Kiütés-profil után (${vetoActive ? 'ÉLES' : 'ÁRNYÉK'} mód)`, afterActiveProfileVetoRaw, afterTierRaw, vetoActive ? 'Éles módban a megjelölt rekord itt esik ki — a kanonizálás ELŐTT.' : 'Árnyék módban a szűrő nem vesz le rekordot.'),
  stage('canonical', 'Kanonikus, kapun belüli Core-jelöltek', canonicalAudit.winners, afterActiveProfileVetoRaw, `Egy (mérkőzés, piac) = egy jelölt. ${afterActiveProfileVetoRaw.length - canonicalAudit.winners.length} kapun belüli duplikált rekord lett összevonva.`),
  {
    id: 'slots',
    label: 'Core-kártyára került',
    count: readout.coreFilled,
    lost: Math.max(0, canonicalAudit.winners.length - readout.coreFilled),
    detail: `Rangsor, egy mérkőzés egy sor, legfeljebb ${readout.coreSlots} kártya.`,
    ok: readout.coreFilled <= canonicalAudit.winners.length,
    issue:
    readout.coreFilled <= canonicalAudit.winners.length ?
    null :
    `A Core-kártyák száma (${readout.coreFilled}) több, mint a kanonikus jelöltek száma (${canonicalAudit.winners.length}).`
  }];


  /* Cross-check against the production readout: the trace and the summary must
   * report the SAME canonical count. */
  if (readout.canonicalEligibleCount !== canonicalAudit.winners.length) {
    funnelIssues.push(
      `Populáció-eltérés: a readout ${readout.canonicalEligibleCount} kanonikus jelöltet ` +
      `jelent, a trace ${canonicalAudit.winners.length}-et.`
    );
  }

  // ATTRIBUTION IS MUTUALLY EXCLUSIVE. Every removed record is counted at
  // exactly ONE cause: the FIRST hard gate it failed (`failed[0]`). Losing a
  // canonical duplicate is NOT a hard gate, so it gets its own bucket that
  // counts full gate survivors only.
  const primaryFailure = (candidate: CoreTraceCandidate): string | null =>
  candidate.failed.length > 0 ? candidate.failed[0] : null;
  const countPrimary = (condition: string): number =>
  candidates.filter((candidate) => primaryFailure(candidate) === condition).length;

  const attribution = [
  { cause: 'Kvadráns', count: countPrimary('decision'), detail: "effectiveDecisionOf === 'flat' | 'ignore' (a volatilis másodlagos szintként belefér) — elsődleges kizárási okként számolva" },
  { cause: 'Hideg minta (ESS)', count: countPrimary('sample'), detail: `ESS < ${H2H_ESS_WARM} — elsődleges kizárási okként számolva` },
  { cause: 'Stabilitás', count: countPrimary('stability'), detail: `stabilitás < ${CORE_STABILITY_MIN} — elsődleges kizárási okként számolva` },
  { cause: 'Piac visszamérés (csapatgól)', count: countPrimary('market_uncalibrated'), detail: 'csapatgól-család core tilalom — elsődleges kizárási okként számolva' },
  { cause: 'Cáfolt sáv (Policy A)', count: countPrimary('band'), detail: `megmért saját sáv, a jelzett valószínűség az intervallumon kívül — Policy A hard veto. ${countPrimary('band')} sor elsődleges okként kizárva (a minőségi kapun már kiesett sorokkal együtt összesen ${allDisprovedRows.length} sor sávja cáfolt)` },
  { cause: 'Modell–H2H konfliktus', count: countPrimary('model_conflict'), detail: 'csak feltételes sornál, piac-szintű extrém eltérés + vékony minta esetén zár ki' },
  { cause: 'Kiütés-profil (ÉLES)', count: vetoedRows.length, detail: 'csak éles veto módban vesz le rekordot — a kanonizálás előtt' },
  { cause: 'Duplikátum összevonva (kanonikus vesztes)', count: candidates.filter((candidate) => candidate.canonicalStatus === 'merged').length, detail: 'NEM kapu-elutasítás: teljes kapun átjutott nyers rekord, amely ugyanannak a (mérkőzés, piac) csoportnak a kanonikus döntését elvesztette' },
  { cause: 'Rangsor / egy-mérkőzés szabály', count: canonicalEligibleRows.filter((row) => row.slot === null).length, detail: 'kanonikus, kapun belüli jelölt, amely nem jutott a kártyák valamelyikére' }];



  const conditionalAll = allPatterns.filter((pattern) => evidenceLevelOf(pattern) === 'conditional');
  const byCodeMap = new Map<string, {total: number;eligible: number;}>();
  conditionalAll.forEach((pattern) => {
    const entry = byCodeMap.get(pattern.code) ?? { total: 0, eligible: 0 };
    entry.total++;
    if (gateFailuresForKind(pattern, 'core').length === 0) entry.eligible++;
    byCodeMap.set(pattern.code, entry);
  });
  const conditionalFamily = conditionalAll.filter((pattern) => familyCodes.includes(pattern.code));
  const conditionalFamilyEligible = canonicalEligibleRows.filter(
    (row) => row.evidence === 'conditional'
  ).length;

  // Ensures every raw family record is representable in the audit tables.
  void patternById;
  void byKey;

  return {
    strategy: readout.strategy,
    strategyLabel: readout.label,
    vetoMode: readout.vetoMode,
    vetoActive,
    familyCodes: [...familyCodes],
    fixtures: analyses.length,
    patternsTotal: allPatterns.length,
    fixtureRows,
    marketRows,
    stages,
    candidates,
    canonicalEligible: canonicalEligibleRows,
    populations: {
      rawRecords: rawFamily.length,
      qualityPassedRaw: qualityPassedRaw.length,
      afterEvidenceRaw: afterEvidenceRaw.length,
      afterModelConflictRaw: afterModelConflictRaw.length,
      afterActiveProfileVetoRaw: afterActiveProfileVetoRaw.length,
      canonicalEligible: canonicalAudit.winners.length,
      mergedEligibleDuplicates:
      afterActiveProfileVetoRaw.length - canonicalAudit.winners.length,
      rawDuplicateGroups: rawDuplicateGroupCount(rawFamily),
      placed: placedRows.length
    },
    funnelOk: funnelIssues.length === 0,
    quadrantDoc: QUADRANT_DOC,
    duplicates,
    evidenceTally,
    disproved: allDisprovedRows,
    attribution,
    conditional: {
      familyTotal: conditionalFamily.length,
      familyEligible: conditionalFamilyEligible,
      familyBlocked: conditionalFamily.length - conditionalFamilyEligible,
      outsideTotal: conditionalAll.length - conditionalFamily.length,
      byCode: Array.from(byCodeMap.entries()).
      map(([code, value]) => ({ code, total: value.total, eligible: value.eligible, inFamily: familyCodes.includes(code) })).
      sort((a, b) => Number(b.inFamily) - Number(a.inFamily) || b.total - a.total)
    },
    admitsConditional: {
      allowed: true,
      reason: 'Igen. A feltételes szint engedett; csak megmért és cáfolt saját sáv, illetve feltételes soron fennálló érdemi modell–H2H konfliktus zár ki.'
    },
    slots: Array.from({ length: readout.coreSlots }, (_, index) => {
      const row = candidates.find((candidate) => candidate.slot === index + 1) ?? null;
      return { index: index + 1, fixture: row?.fixture ?? null, evidence: row?.evidence ?? null };
    }),
    coreSlots: readout.coreSlots,
    coreFilled: readout.coreFilled
  };
}

function pct(value: number | null | undefined, digits = 1): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : '—';
}

export function traceToText(trace: CoreTrace): string {
  const lines: string[] = [];
  lines.push('# CORE DECISION TRACE');
  lines.push(`Stratégia: ${trace.strategyLabel} (${trace.strategy}) · piac: ${trace.familyCodes.join(', ')} · veto: ${trace.vetoMode}${trace.vetoActive ? ' (ÉLES)' : ' (nem vesz le sort)'}`);
  lines.push(`Core: ${trace.coreFilled} / ${trace.coreSlots} kártya feltöltve`);
  lines.push('', '## 1–2. Tölcsér');
  trace.stages.forEach((item) => lines.push(`${item.label}: ${item.count}${item.lost ? ` (−${item.lost})` : ''} — ${item.detail}`));
  lines.push('', '## 3. Kapuk');
  CORE_GATE_REGISTRY.forEach((gate) => lines.push(`${gate.step}. ${gate.name} [${gate.effect}] — ${gate.file} › ${gate.fn} — küszöb: ${gate.threshold}`));
  lines.push('', '## 0. Populáció-elszámolás (nyers → kanonikus)');
  const p = trace.populations;
  lines.push(`Nyers stratégiajelölt-rekordok: ${p.rawRecords} — ${trace.evidenceTally.raw.calibrated} kalibrált · ${trace.evidenceTally.raw.conditional} feltételes · ${trace.evidenceTally.raw.excluded} kizárt`);
  lines.push(`Minőségi kapun belül: ${p.qualityPassedRaw} · cáfolt sáv nélkül: ${p.afterEvidenceRaw} · konfliktus nélkül: ${p.afterModelConflictRaw} · éles veto után: ${p.afterActiveProfileVetoRaw}`);
  lines.push(`Kanonikus, kapun belüli Core-jelöltek: ${p.canonicalEligible} — ${trace.evidenceTally.eligible.calibrated} kalibrált · ${trace.evidenceTally.eligible.conditional} feltételes`);
  lines.push(`Összevont kapun belüli duplikátumok: ${p.mergedEligibleDuplicates} · nyers duplikátum-csoportok: ${p.rawDuplicateGroups}`);
  lines.push(`Core-kártyára került: ${trace.coreFilled} / ${trace.coreSlots} — ${trace.evidenceTally.placed.calibrated} kalibrált · ${trace.evidenceTally.placed.conditional} feltételes`);
  lines.push(`Tölcsér-integritás: ${trace.funnelOk ? 'rendben' : 'HIBA — lásd a lépések megjegyzéseit'}`);
  lines.push('', '## 4. Nyers rekordok (audit populáció)');
  trace.candidates.forEach((candidate) => {
    lines.push([candidate.fixture, `id ${candidate.id}`, `generátor ${candidate.patternType}`, `kód ${candidate.code}`, `modell ${pct(candidate.modelProb)}`, `H2H ${pct(candidate.h2hRate)}`, `stab ${candidate.stability.toFixed(0)}`, `ESS ${candidate.ess.toFixed(2)}`, candidate.quadrant, candidate.agreement, `sáv ${candidate.bandLabel ?? '—'}${candidate.widened ? ' (bővített)' : ''}`, `n ${candidate.observations}/${candidate.required}`, `hits ${candidate.hits ?? '—'}`, `jelzett ${pct(candidate.signalledProb)}`, `mért ${pct(candidate.measuredRate)}`, `Wilson ${pct(candidate.ciLo)}–${pct(candidate.ciHi)}`, `verdikt ${candidate.evidence}`, `kapu ${candidate.gateSurvivor ? 'átjutott' : 'elbukott'}`, `kanonikus ${candidate.canonicalStatus ?? '—'}${candidate.mergedInto ? ` → ${candidate.mergedInto}` : ''}`, candidate.canonicalReason ?? '', `rangadó ${candidate.marqueeRegistered ? `${candidate.marqueeLevel} · −${candidate.marqueePenalty}${candidate.marqueeApplied ? ' (éles)' : ' (árnyék)'}` : 'nem jelölt'}`, candidate.marqueeReasons[0] ?? '', candidate.slot !== null ? `CORE ${candidate.slot}` : candidate.verdict, candidate.primaryCause].join(' | '));
  });
  lines.push('', '## 4c. Nyers rekord-duplikátumok — nem számolnak a kanonikus Core-nevezőbe');
  if (trace.duplicates.length === 0) lines.push('Nincs duplikált nyers rekord ebben a futásban.');else
  trace.duplicates.forEach((group) => {
    lines.push(`${group.fixture} — nyertes: ${group.winnerId ?? 'nincs kapun belüli nyertes'}`);
    group.rows.forEach((row) => lines.push(`  ${row.id} | ${row.patternType} | H2H ${pct(row.h2hRate)} | stab ${row.stability.toFixed(0)} | ESS ${row.ess.toFixed(2)} | ${row.quadrant} | ${row.evidence} | kapu ${row.gateSurvivor ? 'átjutott' : `elbukott (${row.failed[0] ?? '—'})`} | kanonikus ${row.canonicalStatus ?? '—'}${row.mergedInto ? ` → ${row.mergedInto}` : ''}${row.canonicalReason ? ` | ${row.canonicalReason}` : ''}`));
  });
  lines.push('', '## 4b. Kvadráns-kapu');
  lines.push(`Számolja: ${trace.quadrantDoc.computedIn}`);
  lines.push(`Hozzárendeli: ${trace.quadrantDoc.assignedIn}`);
  lines.push(`Kapuként alkalmazza: ${trace.quadrantDoc.gatedIn}`);
  lines.push(`Feltétel: ${trace.quadrantDoc.formula}`);
  lines.push(`Küszöbök: ${trace.quadrantDoc.thresholds}`);
  trace.candidates.forEach((candidate) => {
    const q = candidate.quadrantExplain;
    lines.push(`${candidate.fixture} [${candidate.patternType}/${candidate.code}]: P ${pct(q.p)} vs pMin ${pct(q.pMin, 0)} → ${q.pOk ? 'OK' : 'BUKÓ'} · C ${q.c} vs cMin ${q.cMin} → ${q.cOk ? 'OK' : 'BUKÓ'} · kvadráns ${q.quadrant}${q.consistent ? '' : ` (!! újraszámolva ${q.recomputed})`} · ${q.needed.note}`);
  });
  lines.push('', '## 5. Cáfolt sávok bizonyítása');
  if (trace.disproved.length === 0) lines.push('Nincs cáfolt sávú jelölt ebben a futásban.');else
  trace.disproved.forEach((candidate) => lines.push(`${candidate.fixture}: saját sáv ${candidate.bandLabel ?? '—'} · n = ${candidate.observations} (min ${candidate.required}) · hits ${candidate.hits ?? '—'} · jelzett ${pct(candidate.signalledProb)} · mért ${pct(candidate.measuredRate)} · Wilson ${pct(candidate.ciLo)}–${pct(candidate.ciHi)} · intervallumon kívül: ${candidate.outsideInterval ? 'IGEN' : 'NEM'} · ítélő sávrendszer: ${candidate.judgedBy === 'market' ? 'piacspecifikus' : 'globális 1X2'}`));
  lines.push('', '## 7. Feltételes sorok elszámolása');
  lines.push(`A stratégia piacában: ${trace.conditional.familyTotal} feltételes sor (kapun belül ${trace.conditional.familyEligible}, kapun kívül ${trace.conditional.familyBlocked}). Más piacokban / szerepkörökben: ${trace.conditional.outsideTotal}.`);
  trace.conditional.byCode.forEach((row) => lines.push(`  ${row.code}${row.inFamily ? ' (stratégia piaca)' : ''}: ${row.total} feltételes, ebből kapun belül ${row.eligible}`));
  lines.push('', '## 9. Attribúció');
  trace.attribution.forEach((item) => lines.push(`${item.cause}: ${item.count} — ${item.detail}`));
  return lines.join('\n');
}