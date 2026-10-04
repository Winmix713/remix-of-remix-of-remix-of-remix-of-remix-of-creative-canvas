/**
 * slip — the Top 3+3 slip builder: CORE SELECTION, JOKER SELECTION and the
 * auditable readout of both.
 *
 * THREE SEPARATE QUESTIONS, THREE SEPARATE ANSWERS
 * ------------------------------------------------
 *  1. QUALITY (the gates)  — is the signal itself admissible? Quadrant, Kish
 *     effective sample, stability floor, team-goal market ban.
 *  2. EVIDENCE (the bands) — has the signalled PROBABILITY been measured?
 *     `calibrated` / `conditional` / `excluded`, resolved in
 *     `utils/coreEvidence.ts`. A missing measurement is NOT a refusal; a
 *     disproved own band IS, and is never softened to fill a card.
 *  3. TIER (the quadrant) — `actionable` → Primary Core, `volatile` →
 *     Secondary Core. `flat` and `ignore` never reach a Core card. A Secondary
 *     line may FILL a card no Primary line was available for, and can never
 *     DISPLACE an available Primary one.
 *
 * ONE FIXTURE + ONE MARKET = ONE CANDIDATE
 * ----------------------------------------
 * The candidate list is CANONICALISED (see {@link canonicalCandidates}) before
 * the Core gate and before every eligibility counter. Two pattern records for
 * the same `(fixtureId, code)` pair — e.g. a `77.4%` and a `79.8%` BTTS row for
 * Getafe – Barcelona produced by two generators — used to survive all the way
 * to `selectCoreSet`, where the one-fixture-per-card rule finally dropped one.
 * By then the readout had already reported "Core-eligible: 2" for a single
 * eligible fixture. Deduplication therefore happens FIRST, on a deterministic
 * key (tier → evidence → lexicographic rank → type priority), so every counter,
 * funnel stage and card reads the same population.
 *
 * CANONICAL KEY vs PATTERN IDENTITY
 * ----------------------------------
 * Raw PatternHit identity:  fixtureId + type + code  (id field)
 * Core canonical key:       fixtureId + code          (candidateKeyOf)
 *
 * The `id` field is NEVER changed — it uniquely identifies the raw pattern
 * record for React keys, swap/lookup, and audit trails. The canonical key is
 * used ONLY inside slip-building to collapse duplicates before any gate or
 * counter runs.
 *
 * NO FORCE FILL. Fewer than three valid candidates yields fewer than three
 * cards. An empty third card is a more honest output than a line that failed a
 * gate. Every funnel count is built from the PREVIOUS candidate array, never by
 * subtracting an aggregate from a different population — that is how a stage
 * once reported `1 − 6 = −5`.
 *
 * FUNNEL STAGES ARE ALL NAMED AND EXPORTED (readout hygiene)
 * ------------------------------------------------------------
 * `StrategyReadout` used to expose only the END of two different funnels
 * (`strictCandidates`/`calibratedCandidates`/`conditionalCandidates`, all
 * scoped to `eligible`, i.e. AFTER the full core gate) plus one
 * mid-funnel delta (`disprovedCandidates`, scoped to the quality-gate
 * population). Nothing named the population BEFORE the quality gate, and
 * nothing named the evidence-level breakdown across ALL candidates
 * (irrespective of the quality gate). Any UI that needed either of those —
 * e.g. "Minőségi kapun átment: N" or "0 kalibrált / 0 feltételes / 3 kizárt
 * az összes jelölt között" — had no exported field to read, and was forced to
 * recompute it locally. That is exactly how a `1 − 3 = −2` contradiction
 * happens: one side of the subtraction quietly scoped to "quality-gate
 * survivors" while the other quietly scoped to "all canonical candidates".
 *
 * Every stage of the funnel below is now named, computed ONLY from the stage
 * immediately above it, and exposed on `StrategyReadout`. No two exposed
 * counters may ever be combined across scopes by a caller, because every
 * scope a caller could plausibly need already exists as its own field:
 *
 *   rawCandidates         → rawCandidatesCount, totalCandidates,
 *                          totalCalibratedCandidates,
 *                          totalConditionalCandidates, totalExcludedCandidates
 *   qualityPassedRaw      → qualityPassedRawCount, qualityFailedCandidates
 *   afterEvidenceRaw      → afterEvidenceRawCount, disprovedCandidates
 *   afterConditionalModelConflictRaw
 *                         → afterModelConflictRawCount,
 *                           modelConflictExcludedCandidates
 *   afterActiveProfileVetoRaw
 *                         → afterActiveProfileVetoRawCount
 *   canonicalEligible     → canonicalEligibleCount, strictCandidates,
 *                          calibratedCandidates, conditionalCandidates,
 *                          primaryEligibleCandidates,
 *                          secondaryEligibleCandidates, eligibleFixtures,
 *                          tierExcludedCandidates (invariant check, see below)

 */

import { CORE_STABILITY_MIN } from './constants';
import { CORE_EVIDENCE_RULE_VERSION, coherentLevelOf, evidenceRank } from './coreEvidence';
import { BTTS_PROFILE_RULE_VERSION } from './bttsProfile';
import { MARQUEE_RANKING_ACTIVE } from './marqueePairs';
import {
  BTTS_DEATHZONE_GATE_ACTIVE,
  evaluateBttsBandHealth,
  isBttsEligibleForCore,
  type CoreCandidateState } from
'./coreEligibility';
import {
  CUSTOM_BTTS_MIN_RATE,
  coreStrategySpecOf,
  isCustomBttsStrategy,
  specNullReasonOf,
  type QuickStrategySpec } from
'./coreStrategy';
import { DECISION_THRESHOLDS, SECONDARY_MARKET_THRESHOLDS } from './decision';
import {
  coreCardMarkets,
  isTeamGoalCode,
  matchesMarkets,
  summarizeMarkets } from
'./marketCatalog';
import type {
  BandDiagnosis,
  BttsBlowoutRiskAssessment,
  CoreEvidenceLevel,
  CoreExecutionPath,
  CoreStrategySettings,
  CoreTier,
  DecisionQuadrant,
  FixtureAnalysis,
  PatternHit,
  PatternType,
  Slip,
  SlipLine,
  SlipMarketPreferences,
  SlipRole,
  SpecNullReason } from
'../types/winmix';

/** Bumped whenever WHICH line reaches a Core card can change.
 *
 *  2.3 — a 'band' (cáfolt sáv) kapu a PHASE6_MARKET_GATING_ACTIVE zászló mögé
 *        került (Release D-ig inaktív), a modell-konfliktus kapu pedig
 *        fixture-szintű helyett piac-szintű, és csak extrém eltérés + vékony
 *        minta esetén kizáró. */
/*  2.4 — RANGADÓ: a BTTS rangsor első kritériuma a `rankHitRate`, amely a
 *        megjelölt párosítás saját H2H evidenciájából származó levonást
 *        vonja le a hitRate-ből. A MARQUEE_RANKING_ACTIVE zászló mögött van,
 *        OFF állapotban bitre azonos a 2.3 sorrenddel. */
/*  2.5 — MODELL-FIRST rangsorolás: `getBttsRankingScore()` és a súlyozott
 *        BTTS komparátor. A `BTTS_DEATHZONE_GATE_ACTIVE` zászló mögé tett
 *        halálzóna szűrő (40–55% + modell < 48%), shadow mód. Az
 *        `isBttsEligibleForCore()` (`coreEligibility.ts`) a canonicalCandidates()
 *        ELŐTT fut, gate-first tölcsér. OFF állapotban bitre azonos a 2.4
 *        sorrenddel. */
export const CORE_SELECTION_RULE_VERSION = 'core-selection/2.5';

/* -------------------------------------------------------------------------- *
 * PHASE 6 ACTIVATION GATE (Release D)
 *
 * A megmért, CÁFOLT saját sáv ('excluded' evidencia) jelenleg NEM terminális
 * kizárás: a verdikt továbbra is látszik a jelölt sor evidencia-oszlopában és
 * a trace-ben, és a rangsor (evidenceRank) természetesen a kalibrált /
 * feltételes sorok mögé teszi — de a kártya megtölthető vele. A 'band' kapu
 * csak akkor zár újra, ha a Phase 6 kalibrációs napló kellően feltöltődött:
 * Release D-ben flippeljük true-ra.
 * -------------------------------------------------------------------------- */
export const PHASE6_MARKET_GATING_ACTIVE = false;

/* A modell-konfliktus kemény kapujának PIAC-SZINTŰ küszöbei. Kizárás csak
 * akkor, ha a mért hitRate és a piac SAJÁT modelProb-becslése közti eltérés
 * extrém (≥ 25 százalékpont) ÉS a minta vékony (ESS < 6); minden más esetben
 * a byStrategyRank modelSpread tie-breakje ad természetes rangsor-büntetést. */
const MODEL_CONFLICT_HARD_SPREAD = 0.25;
const MODEL_CONFLICT_HARD_ESS = 6;

/* -------------------------------------------------------------------------- *
 * Roles
 * -------------------------------------------------------------------------- */

export type ActiveSlipRole =
'btts_top' |
'btts_second' |
'over25' |
'joker_score' |
'joker_ht' |
'joker_trend';

export interface RoleSpec {
  title: string;
  families: string;
  empty: string;
  kind: 'core' | 'joker';
}

export const ROLE_SPEC: Record<ActiveSlipRole, RoleSpec> = {
  btts_top: {
    title: 'Core 01',
    families: 'A core stratégia piaca',
    empty:
    'Nincs olyan jelölt, amely a szigorú core kapun belül van. A kártya ' +
    'szándékosan üres — a hármas szám kedvéért nem kerül fel sor.',
    kind: 'core'
  },
  btts_second: {
    title: 'Core 02',
    families: 'A core stratégia piaca',
    empty:
    'Egy mérkőzés csak egy soron szerepelhet, és a maradék jelöltek nem ' +
    'jutottak át a kapun. A kártya üresen marad.',
    kind: 'core'
  },
  over25: {
    title: 'Core 03',
    families: 'A core stratégia piaca',
    empty:
    'Nem maradt harmadik, más mérkőzésről érkező érvényes jelölt. A kártya ' +
    'üresen marad.',
    kind: 'core'
  },
  joker_score: {
    title: 'Joker 01 — pontos eredmény',
    families: 'Pontos eredmény',
    empty: 'Nincs modális pontos eredmény minta ebben a fordulóban.',
    kind: 'joker'
  },
  joker_ht: {
    title: 'Joker 02 — félidő',
    families: 'Félidei piacok',
    empty: 'Nincs elegendő félidős adat egyetlen szabad mérkőzésen sem.',
    kind: 'joker'
  },
  joker_trend: {
    title: 'Joker 03 — trend és fordulat',
    families: 'Trend · sorozat · fordulat · modell-egyetértés',
    empty: 'Nincs szabad mérkőzésre eső trend- vagy fordulat-minta.',
    kind: 'joker'
  }
};

export const CORE_ROLES: ActiveSlipRole[] = ['btts_top', 'btts_second', 'over25'];
export const JOKER_ROLES: ActiveSlipRole[] = ['joker_score', 'joker_ht', 'joker_trend'];
export const ROLE_ORDER: ActiveSlipRole[] = [...CORE_ROLES, ...JOKER_ROLES];

const LEGACY_ROLE_MAP: Record<string, ActiveSlipRole> = {
  core: 'btts_top',
  safety: 'btts_top',
  goals: 'over25',
  recurring: 'btts_second',
  joker: 'joker_trend'
};

/** Map any stored role — including the pre-split legacy ones — onto a slot. */
export function activeRoleOf(role: SlipRole): ActiveSlipRole {
  if ((ROLE_ORDER as string[]).includes(role)) return role as ActiveSlipRole;
  return LEGACY_ROLE_MAP[role] ?? 'joker_trend';
}

/* -------------------------------------------------------------------------- *
 * Gates
 * -------------------------------------------------------------------------- */

export type GateCondition =
'decision' |
'sample' |
'stability' |
'market_uncalibrated' |
'band' |
'model_conflict' |
'blowout_profile';

export const GATE_LABEL: Record<GateCondition, string> = {
  decision: 'kvadráns',
  sample: 'hideg minta',
  stability: 'stabilitás',
  market_uncalibrated: 'piac nincs visszamérve',
  band: 'cáfolt sáv',
  model_conflict: 'modell-konfliktus',
  blowout_profile: 'kiütés-profil'
};

export const GATE_DETAIL: Record<GateCondition, string> = {
  decision:
  'A kvadráns lapos vagy elvetendő: vagy nincs kimutatható él, vagy nincs ' +
  'mögötte elegendő megbízható információ. Csak a cselekvőképes (elsődleges) ' +
  'és a volatilis (másodlagos) szint kerülhet core kártyára.',
  sample:
  'A recency-súlyozott Kish effektív mintaméret a hideg fokozatban van — a ' +
  'százalék mögött nincs elegendő valós előzmény.',
  stability: `A stabilitás a core padló (${CORE_STABILITY_MIN}) alatt van: a minta nem ismétlődő.`,
  market_uncalibrated:
  'A csapatgól-család joker-only, amíg a piacspecifikus, minta-elemen kívüli ' +
  'mérés nem igazolja a saját sávját.',
  band:
  'A sor saját valószínűségi sávját MEGMÉRTÜK, és a jelzett valószínűség a ' +
  'tényleges beválás Wilson-intervallumán kívül van. Cáfolt evidencia — nem ' +
  'adathiány. A kapu a Phase 6 aktiválásával (Release D) lesz újra kizáró.',
  model_conflict:
  'Feltételes evidencia mellett a piac mért aránya és a saját modellbecslése ' +
  'vékony mintán extrémen (≥ 25 százalékpont) eltér — a sor semmire nem támaszkodik.',
  blowout_profile:
  'Egyoldalú, nagy gólszámú, kapott-nullás profil — éles veto módban ez a sor kiesik.'
};

/** Goal- and HT/FT-market lines are judged on the secondary axes. */
function isSecondaryMarket(pattern: PatternHit): boolean {
  return pattern.type === 'goal_market' || pattern.type === 'htft_reversal';
}

export interface CoreConfidenceReading {
  /** The C axis the quadrant judged this line on. */
  value: number;
  /** The primary (actionable) cut-point of that axis. */
  threshold: number;
  /** True when the value is the market-specific confidence, not `stability`. */
  marketSpecific: boolean;
}

export function coreConfidenceOf(pattern: PatternHit): CoreConfidenceReading {
  return isSecondaryMarket(pattern) ?
  {
    value: pattern.marketConfidence,
    threshold: SECONDARY_MARKET_THRESHOLDS.cMin,
    marketSpecific: true
  } :
  {
    value: pattern.stability,
    threshold: DECISION_THRESHOLDS.minConfidence,
    marketSpecific: false
  };
}

/** The quadrant the gate actually reads. */
export function effectiveDecisionOf(pattern: PatternHit): DecisionQuadrant {
  return isSecondaryMarket(pattern) ? pattern.marketDecision ?? pattern.decision : pattern.decision;
}

/**
 * The resolved evidence level — read ONLY from the coreEvidence snapshot.
 *
 * `coherentLevelOf` is the single reader: a missing snapshot is `conditional`
 * (never `excluded`), and an incoherent exclusion — one whose own band never
 * reached `BAND_MIN_SAMPLE` audited observations — is downgraded there. No
 * separate `bandCalibrated` / `marketBandCalibrated` fallback exists any more,
 * because a thin band must never masquerade as a measured verdict.
 */
export function evidenceLevelOf(pattern: PatternHit): CoreEvidenceLevel {
  return coherentLevelOf(pattern.coreEvidence ?? null);
}

/** The band diagnosis that judged this line — from the snapshot, nowhere else. */
export function effectiveBandDiagnosisOf(pattern: PatternHit): BandDiagnosis {
  return pattern.coreEvidence?.diagnosis ?? 'insufficient';
}

/** A modell-konfliktus PIAC-SZINTŰ olvasata: a mért hitRate és a piac saját
 *  modelProb-becslése közti eltérés. A fixture-szintű bttsRisk jelzést a kapu
 *  szándékosan NEM olvassa — az a BTTS-sorok modell-érzékenységén termelődik,
 *  és korábban a stabilabb piacok (O2.5, csapatgól) jelöltjeit is kizárta vele
 *  (keresztpiaci veto). */
export function perMarketModelSpread(pattern: PatternHit): number | null {
  return typeof pattern.modelProb === 'number' ?
  Math.abs(pattern.hitRate - pattern.modelProb) :
  null;
}

/* Kemény kizárás csak extrém eltérésnél ÉS vékony mintánál: ilyenkor a sor
 * tényleg megbízhatatlan. Minden enyhébb eltérés rangsor-büntetés marad. */
function hasMaterialModelConflict(pattern: PatternHit): boolean {
  const spread = perMarketModelSpread(pattern);
  if (spread === null) return false;
  return spread >= MODEL_CONFLICT_HARD_SPREAD && pattern.effectiveSampleSize < MODEL_CONFLICT_HARD_ESS;
}

function isTeamGoalCoreBlocked(pattern: PatternHit): boolean {
  return isTeamGoalCode(pattern.code) && pattern.marketCalibrationStatus !== 'calibrated';
}

/**
 * The CALIBRATION-INDEPENDENT conditions. Kept separate so the funnel can say
 * whether a candidate fell on quality or on measured evidence.
 */
export function coreQualityFailures(pattern: PatternHit): GateCondition[] {
  const failed: GateCondition[] = [];
  const quadrant = effectiveDecisionOf(pattern);
  if (quadrant !== 'actionable' && quadrant !== 'volatile') failed.push('decision');
  if (pattern.sufficiency === 'cold') failed.push('sample');
  if (pattern.stability < CORE_STABILITY_MIN) failed.push('stability');
  if (isTeamGoalCoreBlocked(pattern)) failed.push('market_uncalibrated');
  return failed;
}

/** The full strict gate of one side of the slip. */
export function gateFailuresForKind(
pattern: PatternHit,
kind: 'core' | 'joker')
: GateCondition[] {
  const level = evidenceLevelOf(pattern);

  if (kind === 'joker') {
    const failed: GateCondition[] = [];
    if (effectiveDecisionOf(pattern) === 'ignore') failed.push('decision');
    if (level === 'excluded') failed.push('band');
    return failed;
  }

  const failed = coreQualityFailures(pattern);
  if (level === 'excluded') failed.push('band');
  if (level === 'conditional' && hasMaterialModelConflict(pattern)) failed.push('model_conflict');
  return failed;
}

/* -------------------------------------------------------------------------- *
 * Core tiering
 * -------------------------------------------------------------------------- */

export const CORE_TIER_LABEL: Record<CoreTier, string> = {
  primary: 'Elsődleges core',
  secondary: 'Másodlagos core'
};

export const CORE_TIER_DETAIL: Record<CoreTier, string> = {
  primary:
  'Cselekvőképes kvadráns: a súlyozott H2H irány és az információ-megbízhatóság ' +
  'is eléri az elsődleges küszöböt.',
  secondary:
  'Volatilis kvadráns: az irány erős, de a konfidencia az elsődleges küszöb alatt ' +
  'van. Magasabb kockázatú szint, amely csak olyan kártyára kerül, amelyre nem ' +
  'volt elérhető elsődleges jelölt.'
};

/** The Core selection tier of a line, or `null` when it never reaches Core. */
export function coreTierOf(pattern: PatternHit): CoreTier | null {
  const quadrant = effectiveDecisionOf(pattern);
  if (quadrant === 'actionable') return 'primary';
  if (quadrant === 'volatile') return 'secondary';
  return null;
}

/** Ordering weight of a tier. Primary always fills before Secondary. */
export function coreTierRank(tier: CoreTier | null): number {
  return tier === 'primary' ? 0 : tier === 'secondary' ? 1 : 2;
}

export function isCoreEligible(pattern: PatternHit): boolean {
  return coreTierOf(pattern) !== null && gateFailuresForKind(pattern, 'core').length === 0;
}

export function isJokerEligible(pattern: PatternHit): boolean {
  return gateFailuresForKind(pattern, 'joker').length === 0;
}

/* -------------------------------------------------------------------------- *
 * Ranking
 * -------------------------------------------------------------------------- */

function modelSpread(pattern: PatternHit): number {
  return typeof pattern.modelProb === 'number' ?
  Math.abs(pattern.hitRate - pattern.modelProb) :
  1;
}

function blowoutRisk(pattern: PatternHit): number {
  return pattern.bttsRisk?.modelRisk ?? 0;
}

/**
 * MODELL-FIRST BTTS PONTSZÁM (v2.5)
 *
 * Súlyozás:
 *   60% — modell valószínűség (jelenlegi forma & xG alapú)
 *   25% — H2H hit rate (zsugorított történelmi arány)
 *   15% — konfidencia pontszám (normált)
 *   + sáv bónusz / büntetés (`evaluateBttsBandHealth` alapján)
 *
 * Ez a pontszám CSAK a BTTS Igen jelöltek egymás közötti sorrendjéhez
 * használatos. Más piacokat (O2.5, 1X2, csapatgól) NEM érint.
 * A `byStrategyRank` komparátor ezt olvassa BTTS soroknál.
 */
export function getBttsRankingScore(candidate: {
  modelProb?: number | null;
  hitRate: number;
  confidence?: number;
  stability?: number;
  band?: string | null;
}): number {
  const model = candidate.modelProb ?? candidate.hitRate;
  const h2h = candidate.hitRate;
  // Konfidencia normálás: a meglévő CORE_STABILITY_MIN (55) alapján
  const confRaw = candidate.confidence ?? candidate.stability ?? 0;
  const confNorm = Math.min(confRaw / 56, 1.0);

  // Alappontszám súlyozás
  let score = (model * 60) + (h2h * 25) + (confNorm * 15);

  // Sáv korrekció — `evaluateBttsBandHealth` adja a `priorityBonus`-t
  if (candidate.band) {
    const bandEval = evaluateBttsBandHealth(candidate.band, model, h2h);
    // A bónuszt skálázzuk, hogy a 0..100 pontszámba illeszkedjen
    score += bandEval.priorityBonus * 0.5;
  }

  return score;
}

/**
 * Stable type-priority tiebreaker for canonical deduplication.
 *
 * When two records for the same (fixtureId, code) are otherwise equal on tier,
 * evidence and strategy rank, `goal_market` wins over `streak` — the weighted
 * pool rate is a more direct measurement than a 5-of-5 shrunk estimate.
 * This is a DOCUMENTED CONSTANT: if ablation shows streaks should win, change
 * the order here, not inline at callsites.
 *
 * FIX v2.2: added as the final, stable tiebreaker in byTierThenEvidenceThenStrategy
 * to eliminate Map-insertion-order non-determinism in canonicalCandidates.
 */
const TYPE_PRIORITY: Record<string, number> = {
  goal_market: 0,
  safety_trend: 1,
  model_agreement: 2,
  streak: 3,
  htft_reversal: 4,
  ht_market: 5,
  exact_score: 6
};

function typePriorityOf(pattern: PatternHit): number {
  return TYPE_PRIORITY[pattern.type] ?? 99;
}

/**
 * Lexicographic, deterministic ranking. Nothing is fused into one product: a
 * criterion only speaks when every criterion above it is tied.
 */
/**
 * RANGADÓ (BÜNTETŐPONT) — a rangsorolásban használt hit rate.
 *
 * A MÉRT `hitRate` soha nem változik: ez a függvény kizárólag a
 * SORRENDHEZ von le, kizárólag BTTS soroknál, kizárólag akkor, ha a
 * párosítás saját H2H evidenciája indokolja (`assessMarqueeRisk`), és
 * kizárólag a MARQUEE_RANKING_ACTIVE zászló ÉLES állapotában. A zászló OFF
 * értékén ez a függvény azonos a `pattern.hitRate`-tel, tehát a sorrend
 * bitre változatlan.
 */
export function rankHitRate(pattern: PatternHit): number {
  if (!MARQUEE_RANKING_ACTIVE) return pattern.hitRate;
  if (pattern.code !== 'BTTS') return pattern.hitRate;
  const verdict = pattern.marqueeRisk;
  if (!verdict || !verdict.registered || verdict.penalty <= 0) return pattern.hitRate;
  return pattern.hitRate - verdict.penalty / 100;
}

/**
 * BTTS-specifikus komparátor (v2.5 — Modell-First rangsorolás).
 *
 * Ha mindkét sor BTTS kód, a `getBttsRankingScore()` pontszáma dönt először.
 * Ez biztosítja, hogy a 55–65% sávos, magas modell-valószínűségű sorok
 * (pl. Madrid–Getafe 59.8%, Barcelona–Villarreal 62.6%) megelőzzék a
 * 40–55% sávos gyenge modellű sorokat (pl. Newcastle–ManCity 42.4%).
 *
 * Nem BTTS soroknál: az eredeti `rankHitRate`-alapú sorrend marad érintetlen.
 */
function byStrategyRank(a: PatternHit, b: PatternHit): number {
  // BTTS sorokra: Modell-First súlyozott pontszám
  if (a.code === 'BTTS' && b.code === 'BTTS') {
    const scoreA = getBttsRankingScore({
      modelProb: a.modelProb,
      hitRate: a.hitRate,
      confidence: a.marketConfidence,
      stability: a.stability,
      band: a.band,
    });
    const scoreB = getBttsRankingScore({
      modelProb: b.modelProb,
      hitRate: b.hitRate,
      confidence: b.marketConfidence,
      stability: b.stability,
      band: b.band,
    });

    if (Math.abs(scoreA - scoreB) > 0.001) {
      return scoreB - scoreA; // Magasabb pontszámú kerül előre
    }
    // Holtverseny esetén: modell % dönt
    return (b.modelProb ?? 0) - (a.modelProb ?? 0) ||
      b.effectiveSampleSize - a.effectiveSampleSize ||
      modelSpread(a) - modelSpread(b) ||
      blowoutRisk(a) - blowoutRisk(b) ||
      a.id.localeCompare(b.id);
  }

  // Nem BTTS sorokra: eredeti sorrend (rankHitRate alapú)
  return (
    rankHitRate(b) - rankHitRate(a) ||
    (b.modelProb ?? 0) - (a.modelProb ?? 0) ||
    b.effectiveSampleSize - a.effectiveSampleSize ||
    modelSpread(a) - modelSpread(b) ||
    blowoutRisk(a) - blowoutRisk(b) ||
    a.id.localeCompare(b.id));
}

/**
 * Tier first, then measured evidence, then the lexicographic ranking, then
 * type priority as the final stable tiebreaker.
 *
 * FIX v2.2: `typePriorityOf` added as the last criterion so that two records
 * with identical tier + evidence + hitRate + modelProb + ESS + spread + risk
 * always resolve in the same order regardless of Map insertion order.
 * Without this, `canonicalCandidates` could non-deterministically keep either
 * the `streak::BTTS` or the `goal_market::BTTS` record.
 */
function byTierThenEvidenceThenStrategy(a: PatternHit, b: PatternHit): number {
  return (
    coreTierRank(coreTierOf(a)) - coreTierRank(coreTierOf(b)) ||
    evidenceRank(evidenceLevelOf(a)) - evidenceRank(evidenceLevelOf(b)) ||
    byStrategyRank(a, b) ||
    typePriorityOf(a) - typePriorityOf(b));

}

/**
 * CANONICAL WINNER COMPARATOR — documented, deterministic, and applied ONLY to
 * records of the same `(fixtureId, code)` group that already survived every
 * active hard gate.
 *
 *   1. Primary/actionable tier before secondary/volatile tier
 *   2. Calibrated evidence before conditional evidence
 *   3. Higher H2H hit rate
 *   4. Higher stability
 *   5. Higher Kish effective sample size
 *   6. Generator type priority (`TYPE_PRIORITY`)
 *   7. `pattern.id` — stable final tiebreaker
 *
 * If ablation shows a different order is better, change it HERE; no callsite
 * may reorder these criteria inline.
 */
export function byCanonicalWinner(a: PatternHit, b: PatternHit): number {
  return (
    coreTierRank(coreTierOf(a)) - coreTierRank(coreTierOf(b)) ||
    evidenceRank(evidenceLevelOf(a)) - evidenceRank(evidenceLevelOf(b)) ||
    b.hitRate - a.hitRate ||
    b.stability - a.stability ||
    b.effectiveSampleSize - a.effectiveSampleSize ||
    typePriorityOf(a) - typePriorityOf(b) ||
    a.id.localeCompare(b.id));

}

/**
 * Human-readable reason why `winner` beat `loser` — surfaced in the raw
 * duplicate audit so every merge is explainable, never magic.
 */
export function canonicalWinnerReason(winner: PatternHit, loser: PatternHit): string {
  if (coreTierRank(coreTierOf(winner)) !== coreTierRank(coreTierOf(loser))) {
    return `Erősebb core-szint (${coreTierOf(winner) ?? '—'} > ${coreTierOf(loser) ?? '—'}).`;
  }
  if (evidenceRank(evidenceLevelOf(winner)) !== evidenceRank(evidenceLevelOf(loser))) {
    return `Jobb evidencia-szint (${evidenceLevelOf(winner)} > ${evidenceLevelOf(loser)}).`;
  }
  if (winner.hitRate !== loser.hitRate) {
    return `Magasabb H2H arány (${Math.round(winner.hitRate * 100)}% > ${Math.round(loser.hitRate * 100)}%).`;
  }
  if (winner.stability !== loser.stability) {
    return `Magasabb stabilitás (${winner.stability.toFixed(2)} > ${loser.stability.toFixed(2)}).`;
  }
  if (winner.effectiveSampleSize !== loser.effectiveSampleSize) {
    return `Nagyobb Kish ESS (${winner.effectiveSampleSize.toFixed(1)} > ${loser.effectiveSampleSize.toFixed(1)}).`;
  }
  if (typePriorityOf(winner) !== typePriorityOf(loser)) {
    return `Generátor-prioritás (${winner.type} > ${loser.type}).`;
  }
  return `Stabil végső döntő: rekord-azonosító (${winner.id} < ${loser.id}).`;
}


/**
 * Identity of a market line for Core deduplication purposes.
 *
 * NOTE: This is NOT the same as `PatternHit.id`. The raw pattern id includes
 * the pattern type (`fixtureId::type::code`) to uniquely identify the record
 * from its generator. The canonical key drops the type so that two generators
 * producing the same market for the same fixture are treated as ONE Core
 * candidate — which is the correct domain rule.
 */
export function candidateKeyOf(pattern: PatternHit): string {
  return `${pattern.fixtureId}::${pattern.code}`;
}

/**
 * Collapse every `(fixtureId, code)` group to ONE canonical candidate.
 *
 * GATE-FIRST CONTRACT (v2.3)
 * ---------------------------
 * This function must only ever be called with records that have ALREADY passed
 * every hard gate that is active in the current run. A raw pattern is not
 * allowed to suppress another raw pattern until every applicable exclusion has
 * been evaluated: otherwise an early canonical winner that later fails a hard
 * gate silently removes a duplicate that would have passed, and a Core slot is
 * left empty even though a valid candidate existed.
 *
 * The surviving record is chosen deterministically, and the comparator is
 * documented in {@link byCanonicalWinner}:
 *   1. Primary/actionable tier before secondary/volatile tier
 *   2. Calibrated evidence before conditional evidence
 *   3. Higher H2H hit rate
 *   4. Higher stability
 *   5. Higher Kish effective sample size
 *   6. Generator type priority
 *   7. `pattern.id` as the stable final tiebreaker
 */
export function canonicalCandidates(patterns: readonly PatternHit[]): PatternHit[] {
  const best = new Map<string, PatternHit>();

  patterns.forEach((pattern) => {
    const key = candidateKeyOf(pattern);
    const incumbent = best.get(key);
    if (!incumbent || byCanonicalWinner(pattern, incumbent) < 0) {
      best.set(key, pattern);
    }
  });

  return Array.from(best.values()).sort(byTierThenEvidenceThenStrategy);
}

/**
 * Canonicalisation WITH an audit trail.
 *
 * `winnerOf` maps a `(fixtureId, code)` key to the winning record; `mergedInto`
 * maps every losing record's id to the winner's id. Records that never reach
 * this function (because they failed a hard gate) appear in neither map — they
 * are hard-gate failures, never "merged losers".
 */
export interface CanonicalisationAudit {
  winners: PatternHit[];
  winnerIds: Set<string>;
  mergedInto: Map<string, string>;
}

export function auditedCanonicalCandidates(
patterns: readonly PatternHit[])
: CanonicalisationAudit {
  const groups = new Map<string, PatternHit[]>();
  patterns.forEach((pattern) => {
    const key = candidateKeyOf(pattern);
    const rows = groups.get(key) ?? [];
    rows.push(pattern);
    groups.set(key, rows);
  });

  const winners: PatternHit[] = [];
  const mergedInto = new Map<string, string>();

  groups.forEach((rows) => {
    const ordered = rows.slice().sort(byCanonicalWinner);
    const winner = ordered[0];
    winners.push(winner);
    ordered.slice(1).forEach((loser) => mergedInto.set(loser.id, winner.id));
  });

  winners.sort(byTierThenEvidenceThenStrategy);
  return { winners, winnerIds: new Set(winners.map((p) => p.id)), mergedInto };
}

/**
 * How many `(fixtureId, code)` groups in a RAW record set contain more than one
 * record — including groups where no record survives the gates.
 */
export function rawDuplicateGroupCount(patterns: readonly PatternHit[]): number {
  const counts = new Map<string, number>();
  patterns.forEach((pattern) => {
    const key = candidateKeyOf(pattern);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  let groups = 0;
  counts.forEach((count) => {
    if (count > 1) groups += 1;
  });
  return groups;
}


/** Every pattern of the round, best first. */
export function rankedPatterns(analyses: readonly FixtureAnalysis[]): PatternHit[] {
  return analyses.flatMap((analysis) => analysis.patterns).slice().sort(byStrategyRank);
}

/**
 * The ordered Core set: canonical, eligible candidates only, one fixture per
 * card, capped at `slots`. No relaxed fallback, no force fill.
 */
export function selectCoreSet(patterns: readonly PatternHit[], slots: number): PatternHit[] {
  const ordered = canonicalCandidates(patterns.filter(isCoreEligible));
  const picked: PatternHit[] = [];
  const usedFixtures = new Set<string>();

  ordered.forEach((pattern) => {
    if (picked.length >= slots) return;
    if (usedFixtures.has(pattern.fixtureId)) return;
    usedFixtures.add(pattern.fixtureId);
    picked.push(pattern);
  });

  return picked;
}

/* -------------------------------------------------------------------------- *
 * Draft shape
 * -------------------------------------------------------------------------- */

export interface BlockedCandidate {
  pattern: PatternHit;
  failed: GateCondition[];
}

export type CanonicalStatus = 'winner' | 'merged' | 'no_eligible_winner' | null;

export interface CoreCandidateRow {
  pattern: PatternHit;
  evidence: CoreEvidenceLevel;
  quadrant: DecisionQuadrant;
  coreTier: CoreTier | null;
  failed: GateCondition[];
  /** 1-based core card index, or `null` when the line was not placed. */
  slot: number | null;
  reason: string;
  /** True when this raw record survived every active hard gate AND won its
   *  `(fixtureId, code)` group. Only a winner can occupy a Core slot. */
  canonicalWinner: boolean;
  /** Winner record id when this record was merged away, otherwise `null`. */
  mergedInto: string | null;
  /**
   * `winner`              — survived every active hard gate and won.
   * `merged`              — survived every active hard gate, another survivor won.
   * `no_eligible_winner`  — failed a hard gate; NO winner relationship is claimed.
   * `null`                — not part of a duplicate group.
   */
  canonicalStatus: CanonicalStatus;
  /** The explicit state-machine state this candidate reached. */
  candidateState: CoreCandidateState;
}


export interface CoreExecutionTrace {
  executionPath: CoreExecutionPath;
  specNullReason: SpecNullReason;
  /** The configured per-card market pool, when one exists. */
  configuredMarketPool: (string[] | null)[] | null;
}

export interface StrategyReadout {
  strategy: string;
  label: string;
  vetoMode: string;
  vetoActive: boolean;
  ruleVersion: string;
  evidenceRuleVersion: string;
  selectionRuleVersion: string;
  /** Selection WITHOUT the profile filter — the "A" control branch. */
  baseline: PatternHit[];
  /** Selection WITH the profile filter — the "B" branch. */
  experiment: PatternHit[];
  excluded: Array<{pattern: PatternHit;risk: BttsBlowoutRiskAssessment;}>;
  candidates: CoreCandidateRow[];
  analysedFixtures: number;

  /**
   * STAGE 0 — `strategyCandidates` (canonical, BEFORE any gate).
   * "BTTS jelölt: N" — how many distinct (fixture, market) candidates exist
   * at all, once duplicate generator records are collapsed. Every other
   * count in this readout is a subset of this one, and this field is the
   * ONLY correct denominator for an "out of how many total" label.
   */
  totalCandidates: number;
  /** Evidence-level breakdown across `totalCandidates` — i.e. ALL canonical
   *  candidates, irrespective of whether they pass the quality gate. Use
   *  these three fields (not `calibratedCandidates`/`conditionalCandidates`
   *  below) for a "0 kalibrált / 0 feltételes / 3 kizárt" style summary that
   *  is meant to describe the whole candidate pool. */
  totalCalibratedCandidates: number;
  totalConditionalCandidates: number;
  totalExcludedCandidates: number;

  /**
   * STAGE 1 — `qualityPassed` (quadrant, sample, stability, team-goal ban).
   * Calibration-independent: a candidate can be here with `excluded`
   * evidence. "Minőségi kapun átment: N" / "Minőségi kapun kiesett: N".
   */
  qualityPassedCandidates: number;
  qualityFailedCandidates: number;

  /**
   * STAGE 2 — `afterEvidence` (STAGE 1 minus disproved own bands).
   * "Kalibráció után marad: N". `disprovedCandidates` is STAGE 1 minus
   * STAGE 2 — i.e. "cáfolt sáv a minőségi kapun BELÜLI jelöltek között".
   * It must never be compared against `totalCandidates` or
   * `totalExcludedCandidates`, which are a different, wider population.
   */
  afterEvidenceCandidates: number;
  disprovedCandidates: number;

  /**
   * STAGE 3 — `afterModelConflict` (STAGE 2 minus conditional lines that
   * contradict their own model). STAGE 2 minus STAGE 3.
   */
  modelConflictExcludedCandidates: number;

  /**
   * STAGE 4 — `eligible` (STAGE 3 minus non-actionable/volatile quadrants).
   * This is expected to be 0 in practice, because `coreQualityFailures`
   * already removes `flat`/`ignore` at STAGE 1 — it exists purely as an
   * invariant check so a future change to the gate order cannot silently
   * reopen the STAGE-1/STAGE-4 scope gap this whole fix addresses.
   */
  tierExcludedCandidates: number;

  /** Candidates inside the full strict gate (== STAGE 4, `eligible`). */
  strictCandidates: number;
  calibratedCandidates: number;
  conditionalCandidates: number;
  /** Gate-passing duplicate records collapsed by canonicalisation.
   *  == `afterActiveProfileVetoRawCount − canonicalEligibleCount`. */
  duplicateCandidatesMerged: number;

  /* --- GATE-FIRST POPULATIONS (v2.3) -------------------------------------
   * Each name declares its own population. No consumer may reuse one
   * ambiguous "candidate" count for two different denominators.
   *
   *   rawCandidatesCount              all strategy-market records, pre-gate
   *   qualityPassedRawCount           raw records inside the quality gate
   *   afterEvidenceRawCount           minus own disproved bands
   *   afterModelConflictRawCount      minus conditional model conflicts
   *   afterActiveProfileVetoRawCount  minus LIVE profile vetoes only
   *   canonicalEligibleCount          gate-passing records, merged by (fixture, code)
   *   selectedCoreCount               canonical records occupying a Core slot
   *   mergedEligibleDuplicatesCount   afterActiveProfileVetoRawCount − canonicalEligibleCount
   *   rawDuplicateGroupsCount         duplicate groups in the RAW set, including
   *                                   groups where no record survives
   */
  rawCandidatesCount: number;
  qualityPassedRawCount: number;
  afterEvidenceRawCount: number;
  afterModelConflictRawCount: number;
  afterActiveProfileVetoRawCount: number;
  canonicalEligibleCount: number;
  selectedCoreCount: number;
  mergedEligibleDuplicatesCount: number;
  rawDuplicateGroupsCount: number;

  coreFilled: number;
  coreSlots: number;
  primaryEligibleCandidates: number;
  secondaryEligibleCandidates: number;
  /** Distinct fixtures behind the eligible candidates — the honest denominator. */
  eligibleFixtures: number;
  primaryCoreCount: number;
  secondaryCoreCount: number;
  tierNote: string | null;
  coreEvidenceLevel: CoreEvidenceLevel | null;
}

export interface SlipSlot {
  role: ActiveSlipRole;
  pattern: PatternHit | null;
  title: string | null;
  families: string | null;
  reason: string | null;
  blocked: BlockedCandidate[];
  /** Always false: no strategy inserts a gate-relaxed line. */
  relaxed: boolean;
  failed: GateCondition[];
  risk: BttsBlowoutRiskAssessment | null;
  shadowVeto: boolean;
  coreTier: CoreTier | null;
  /**
   * „Saját” (custom_btts) mód: a sor mögött SEMMILYEN kapu, kalibráció,
   * evidencia vagy kockázat-értékelés nem futott le, ezért a kártya nem
   * jeleníthet meg ilyen minősítést — az félrevezető lenne.
   */
  plain?: boolean;
}

export interface SlipDraft {
  slots: SlipSlot[];
  strategy: StrategyReadout | null;
  trace: CoreExecutionTrace | null;
  configError: string | null;
  notes: string[];
}

function emptySlot(role: ActiveSlipRole, reason: string | null): SlipSlot {
  return {
    role,
    pattern: null,
    title: null,
    families: null,
    reason,
    blocked: [],
    relaxed: false,
    failed: [],
    risk: null,
    shadowVeto: false,
    coreTier: null
  };
}

function filledSlot(
role: ActiveSlipRole,
pattern: PatternHit,
options: {
  title?: string | null;
  families?: string | null;
  vetoActive: boolean;
  profileVeto: boolean;
  coreTier: CoreTier | null;
})
: SlipSlot {
  const flagged = pattern.bttsRisk?.wouldVeto ?? false;
  return {
    role,
    pattern,
    title: options.title ?? null,
    families: options.families ?? null,
    reason: null,
    blocked: [],
    relaxed: false,
    failed: [],
    risk: pattern.bttsRisk ?? null,
    shadowVeto: options.profileVeto && flagged && !options.vetoActive,
    coreTier: options.coreTier
  };
}

function blockedList(patterns: readonly PatternHit[], limit = 4): BlockedCandidate[] {
  return patterns.
  map((pattern) => ({ pattern, failed: gateFailuresForKind(pattern, 'core') })).
  filter((entry) => entry.failed.length > 0).
  slice(0, limit);
}

/* -------------------------------------------------------------------------- *
 * Joker pools
 * -------------------------------------------------------------------------- */

const JOKER_TYPES: Record<ActiveSlipRole, PatternType[]> = {
  btts_top: [],
  btts_second: [],
  over25: [],
  joker_score: ['exact_score'],
  joker_ht: ['ht_market'],
  joker_trend: ['streak', 'model_agreement', 'htft_reversal', 'safety_trend']
};

function jokerPool(
role: ActiveSlipRole,
allPatterns: readonly PatternHit[],
markets: SlipMarketPreferences | null)
: PatternHit[] {
  const types = JOKER_TYPES[role];
  const pool = allPatterns.filter((pattern) => {
    if (!types.includes(pattern.type)) return false;
    if (markets && markets.joker.length > 0 && !matchesMarkets(pattern, markets.joker)) return false;
    return isJokerEligible(pattern);
  });
  return canonicalCandidates(pool);
}

/* -------------------------------------------------------------------------- *
 * The builder
 * -------------------------------------------------------------------------- */

interface CoreOutcome {
  slots: SlipSlot[];
  readout: StrategyReadout | null;
  trace: CoreExecutionTrace;
  configError: string | null;
  usedFixtures: Set<string>;
  notes: string[];
}

function tierNoteOf(
secondaryCoreCount: number,
coreFilled: number,
coreSlots: number)
: string | null {
  if (secondaryCoreCount > 0) {
    return (
      `${secondaryCoreCount} core kártyát MÁSODLAGOS (volatilis) sor tart: az irány ` +
      'erős, de a piaci konfidencia az elsődleges küszöb alatt van. Ezek a sorok ' +
      'kizárólag olyan helyre kerültek, amelyre nem volt elérhető elsődleges jelölt.');

  }
  if (coreFilled < coreSlots) {
    return (
      `${coreFilled} / ${coreSlots} core kártya telt meg — sem elsődleges, sem ` +
      'másodlagos szinten nem volt több érvényes jelölt. A többi kártya szándékosan üres.');

  }
  return null;
}

/**
 * Build the Core side of the slip for a strategy-mode configuration.
 *
 * FIX v2.3 — GATE-FIRST CANONICALISATION
 * ---------------------------------------
 * Canonicalisation used to run at STAGE 0, BEFORE the quality, evidence,
 * conditional-conflict and profile-veto gates. That ordering can discard an
 * eligible record before it is ever evaluated: raw record A wins the group
 * early, then fails a hard gate, while raw record B — same fixture, same market
 * code, and passing every gate — was already thrown away. The Core slot ends up
 * empty although a valid candidate existed.
 *
 * The rule is now: a raw pattern may not suppress another raw pattern until
 * every exclusion that applies in the current mode has been evaluated.
 *
 *   allPatterns
 *     → rawCandidates                     — spec.codes filter (duplicates KEPT)
 *     → qualityPassedRaw                  — coreQualityFailures === 0
 *     → afterEvidenceRaw                  — own band not disproved (Phase 6 gate)
 *     → afterConditionalModelConflictRaw   — no per-market extreme conflict on a thin sample
 *     → afterTierRaw                      — coreTierOf !== null (invariant stage)
 *     → afterActiveProfileVetoRaw         — LIVE veto only; shadow removes nothing
 *     → canonicalEligible                 — canonicalise ONLY survivors
 *     → ranking → distinct fixtures → Core slots
 *
 * Every readout number is named after exactly one of those populations, and no
 * expression mixes two scopes. The audit rows (`candidates`) stay RAW-record
 * based — every raw record remains inspectable — but only `canonicalEligible`
 * affects Core selection and Core counts.
 */
function buildStrategyCore(
spec: QuickStrategySpec,
strategy: CoreStrategySettings,
allPatterns: readonly PatternHit[],
analysedFixtures: number,
markets: SlipMarketPreferences | null)
: CoreOutcome {
  const vetoActive = strategy.vetoMode === 'active';
  const flaggedOf = (pattern: PatternHit) => pattern.bttsRisk?.wouldVeto ?? false;

  /* --- RAW population: duplicates deliberately kept ---------------------- */
  const rawCandidates = allPatterns.filter((pattern) => spec.codes.includes(pattern.code));

  /* --- STAGE 0b — BTTS modell-alapú előszűrés (v2.5, gate-first)  -------
   * Az `isBttsEligibleForCore()` a `canonicalCandidates()` ELŐTT fut.
   * Shadow módban (`BTTS_DEATHZONE_GATE_ACTIVE = false`) az eligibility mindig
   * true, de a `shadowWouldFail` flag kitöltve a trace-hez. */
  const bttsPreFiltered = rawCandidates.filter((pattern) => {
    if (pattern.code !== 'BTTS') return true; // Nem BTTS sort nem érint
    const result = isBttsEligibleForCore({
      modelProb: pattern.modelProb,
      hitRate: pattern.hitRate,
      band: pattern.band,
      evidenceLevel: pattern.coreEvidence?.level,
    });
    // Shadow módban: a sor átmegy, de a `shadowWouldFail` flag a trace-nek
    // A `BTTS_DEATHZONE_GATE_ACTIVE` éles módban a `eligible: false` rekordot tényleg kizárja
    return result.eligible;
  });

  /* --- Hard gates, applied PER RAW RECORD -------------------------------- */
  const qualityPassedRaw = bttsPreFiltered.filter(
    (pattern) => coreQualityFailures(pattern).length === 0
  );
  /* --- STAGE 2 — megmért és cáfolt saját sáv. Policy A: a cáfolt sáv
     ALWAYS kizár — nem a PHASE6 kapu mögött van, hanem az `isBttsEligibleForCore`
     evidence veto-jában (Gate 0). Ez a stage a nem-BTTS sorok számára is
     kizárja az `excluded` evidencia-szintet, konzisztens módon. */
  const afterEvidenceRaw = qualityPassedRaw.filter(
    (pattern) => evidenceLevelOf(pattern) !== 'excluded'
  );
  const afterConditionalModelConflictRaw = afterEvidenceRaw.filter(
    (pattern) => !(evidenceLevelOf(pattern) === 'conditional' && hasMaterialModelConflict(pattern))
  );
  // Tier check. In practice this removes nothing new, because
  // `coreQualityFailures` already pushes 'decision' for flat/ignore quadrants —
  // it is kept as its own stage so the invariant stays visible and checkable.
  const afterTierRaw = afterConditionalModelConflictRaw.filter(
    (pattern) => coreTierOf(pattern) !== null
  );

  /* --- Profile veto: a HARD gate only in LIVE mode -----------------------
   * Shadow mode flags the record for diagnostics and changes nothing about
   * eligibility. Live mode removes the raw record BEFORE canonicalisation, so a
   * vetoed record can never suppress an unflagged, valid alternative from the
   * same fixture and market. */
  const vetoFilteredRaw = spec.profileVeto ?
  afterTierRaw.filter((pattern) => !flaggedOf(pattern)) :
  afterTierRaw;
  const afterActiveProfileVetoRaw =
  spec.profileVeto && vetoActive ? vetoFilteredRaw : afterTierRaw;

  /* --- Canonicalise ONLY the gate survivors ------------------------------ */
  const canonicalAudit = auditedCanonicalCandidates(afterActiveProfileVetoRaw);
  const canonicalEligible = canonicalAudit.winners;
  const mergedEligibleDuplicatesCount =
  afterActiveProfileVetoRaw.length - canonicalEligible.length;

  /* --- Selection: production, plus the A/B control branches -------------- */
  const eligible = canonicalEligible;
  const baseline = selectCoreSet(canonicalCandidates(afterTierRaw), spec.slots);
  const experiment = selectCoreSet(canonicalCandidates(vetoFilteredRaw), spec.slots);
  const rankedCandidates = [...canonicalEligible].sort(byTierThenEvidenceThenStrategy);
  const selected = selectCoreSet(rankedCandidates, spec.slots);

  const slotOf = new Map<string, number>();
  selected.forEach((pattern, index) => slotOf.set(pattern.id, index + 1));


  /* --- Candidate audit rows — RAW records, canonical status annotated -----
   * Every raw record stays inspectable. A hard-gate failure is NEVER labelled
   * "merged": only a record that passed every active hard gate but lost its
   * group can be a canonical merged loser. */
  const rawGroupSizes = new Map<string, number>();
  rawCandidates.forEach((pattern) => {
    const key = candidateKeyOf(pattern);
    rawGroupSizes.set(key, (rawGroupSizes.get(key) ?? 0) + 1);
  });
  const gateSurvivorIds = new Set(afterActiveProfileVetoRaw.map((pattern) => pattern.id));

  const candidates: CoreCandidateRow[] = rawCandidates.
  map((pattern) => {
    const failed = gateFailuresForKind(pattern, 'core');
    const slot = slotOf.get(pattern.id) ?? null;
    const flagged = flaggedOf(pattern);
    const inDuplicateGroup = (rawGroupSizes.get(candidateKeyOf(pattern)) ?? 1) > 1;
    const survived = gateSurvivorIds.has(pattern.id);
    const canonicalWinner = canonicalAudit.winnerIds.has(pattern.id);
    const mergedInto = canonicalAudit.mergedInto.get(pattern.id) ?? null;
    const canonicalStatus: CanonicalStatus =
    canonicalWinner ? 'winner' :
    mergedInto !== null ? 'merged' :
    inDuplicateGroup && !survived ? 'no_eligible_winner' :
    null;
    const reason =
    slot !== null ?
    `Core ${slot} — ${
    evidenceLevelOf(pattern) === 'calibrated' ?
    'kalibrált evidencia-szinten került kártyára' :
    evidenceLevelOf(pattern) === 'conditional' ?
    'feltételes evidencia-szinten került kártyára' :
    'CÁFOLT sávval került kártyára — a Phase 6 kapu inaktív, a mért verdikt látható figyelmeztetés'}.` :

    failed.length > 0 ?
    GATE_DETAIL[failed[0]] :
    flagged && spec.profileVeto && vetoActive ?
    'Éles kiütés-profil veto vette le a sort.' :
    mergedInto !== null ?
    `Kapun belüli nyers rekord, de a kanonikus döntést a(z) ${mergedInto} rekord nyerte ` +
    '(ugyanaz a mérkőzés és piac, másik generátor) — nem kapu-elutasítás.' :
    'Kapun belüli jelölt, de a rangsorban a felvett sorok mögé került, ' +
    'vagy a mérkőzése már szerepel a core oldalon.';
    const level = evidenceLevelOf(pattern);
    const candidateState: CoreCandidateState =
      level === 'excluded' ? 'BLOCKED' :
      failed.length > 0 ? 'FLAGGED' :
      slot !== null ? 'CORE_PUBLISHED' :
      canonicalWinner ? 'CORE_ELIGIBLE' :
      level === 'calibrated' ? 'CALIBRATED' :
      'EVIDENCE_ASSESSED';
    return {
      pattern,
      evidence: level,
      quadrant: effectiveDecisionOf(pattern),
      coreTier: coreTierOf(pattern),
      failed,
      slot,
      reason,
      canonicalWinner,
      mergedInto,
      canonicalStatus,
      candidateState
    };
  }).
  sort(
    (a, b) =>
    (a.slot ?? 99) - (b.slot ?? 99) ||
    a.failed.length - b.failed.length ||
    b.pattern.hitRate - a.pattern.hitRate
  );

  const slots = CORE_ROLES.map((role, index) => {
    const pattern = selected[index] ?? null;
    if (!pattern) {
      return {
        ...emptySlot(
          role,
          eligible.length === 0 ?
          `${rawCandidates.length} nyers stratégia-piaci rekord közül egy sem jutott át a ` +
          'szigorú core kapun — a kártya üresen marad.' :
          'Nem maradt más mérkőzésről érkező érvényes jelölt erre a kártyára.'
        ),
        title: `${ROLE_SPEC[role].title} — ${spec.short}`,
        families: spec.codes.join(' · '),
        blocked: blockedList(rawCandidates)
      };
    }

    return filledSlot(role, pattern, {
      title: `${ROLE_SPEC[role].title} — ${spec.short}`,
      families: spec.codes.join(' · '),
      vetoActive,
      profileVeto: spec.profileVeto,
      coreTier: coreTierOf(pattern)
    });
  });

  const primaryCoreCount = selected.filter((p) => coreTierOf(p) === 'primary').length;
  const secondaryCoreCount = selected.filter((p) => coreTierOf(p) === 'secondary').length;
  const placedLevels = selected.map(evidenceLevelOf);

  /* --- StrategyReadout — every count named after ONE population -----------
   *
   *   rawCandidatesCount / total*Candidates ← rawCandidates (pre-gate, RAW)
   *   qualityPassedRawCount                 ← qualityPassedRaw
   *   afterEvidenceRawCount                 ← afterEvidenceRaw
   *   afterModelConflictRawCount            ← afterConditionalModelConflictRaw
   *   afterActiveProfileVetoRawCount        ← afterActiveProfileVetoRaw
   *   canonicalEligibleCount / strict* /
   *   calibrated* / conditional* /
   *   primaryEligible* / secondaryEligible* /
   *   eligibleFixtures                      ← canonicalEligible
   *   selectedCoreCount / coreFilled        ← selected
   *
   * Each delta below subtracts ADJACENT stages only; no global tally is ever
   * subtracted from a narrower stage (that is what once produced 1 − 3 = −2).
   */
  const readout: StrategyReadout = {
    strategy: spec.id,
    label: spec.label,
    vetoMode: strategy.vetoMode,
    vetoActive: spec.profileVeto && vetoActive,
    ruleVersion: BTTS_PROFILE_RULE_VERSION,
    evidenceRuleVersion: CORE_EVIDENCE_RULE_VERSION,
    selectionRuleVersion: CORE_SELECTION_RULE_VERSION,
    baseline,
    experiment,
    excluded: spec.profileVeto ?
    rawCandidates.
    filter((pattern) => pattern.bttsRisk && pattern.bttsRisk.wouldVeto).
    map((pattern) => ({
      pattern,
      risk: pattern.bttsRisk as BttsBlowoutRiskAssessment
    })) :
    [],
    candidates,
    analysedFixtures,

    totalCandidates: rawCandidates.length,
    totalCalibratedCandidates: rawCandidates.filter(
      (p) => evidenceLevelOf(p) === 'calibrated'
    ).length,
    totalConditionalCandidates: rawCandidates.filter(
      (p) => evidenceLevelOf(p) === 'conditional'
    ).length,
    totalExcludedCandidates: rawCandidates.filter(
      (p) => evidenceLevelOf(p) === 'excluded'
    ).length,

    qualityPassedCandidates: qualityPassedRaw.length,
    // bttsPreFiltered → qualityPassedRaw különbség: a BTTS modell-szűrő +
    // a minőségi kapu együttes kiesése; a rawCandidates az abszolút alap
    qualityFailedCandidates: rawCandidates.length - qualityPassedRaw.length,

    afterEvidenceCandidates: afterEvidenceRaw.length,
    disprovedCandidates: qualityPassedRaw.length - afterEvidenceRaw.length,

    modelConflictExcludedCandidates:
    afterEvidenceRaw.length - afterConditionalModelConflictRaw.length,
    tierExcludedCandidates: afterConditionalModelConflictRaw.length - afterTierRaw.length,

    strictCandidates: canonicalEligible.length,
    calibratedCandidates: canonicalEligible.filter(
      (p) => evidenceLevelOf(p) === 'calibrated'
    ).length,
    conditionalCandidates: canonicalEligible.filter(
      (p) => evidenceLevelOf(p) === 'conditional'
    ).length,
    duplicateCandidatesMerged: mergedEligibleDuplicatesCount,

    rawCandidatesCount: rawCandidates.length,        // STAGE 0 — spec.codes szűrés (BTTS előszűrés előtt)
    qualityPassedRawCount: qualityPassedRaw.length,  // STAGE 1 — bttsPreFiltered + quality gate
    afterEvidenceRawCount: afterEvidenceRaw.length,
    afterModelConflictRawCount: afterConditionalModelConflictRaw.length,
    afterActiveProfileVetoRawCount: afterActiveProfileVetoRaw.length,
    canonicalEligibleCount: canonicalEligible.length,
    selectedCoreCount: selected.length,
    mergedEligibleDuplicatesCount,
    rawDuplicateGroupsCount: rawDuplicateGroupCount(rawCandidates),

    coreFilled: selected.length,
    coreSlots: spec.slots,
    primaryEligibleCandidates: canonicalEligible.filter(
      (p) => coreTierOf(p) === 'primary'
    ).length,
    secondaryEligibleCandidates: canonicalEligible.filter(
      (p) => coreTierOf(p) === 'secondary'
    ).length,
    eligibleFixtures: new Set(canonicalEligible.map((p) => p.fixtureId)).size,
    primaryCoreCount,
    secondaryCoreCount,
    tierNote: tierNoteOf(secondaryCoreCount, selected.length, spec.slots),
    coreEvidenceLevel:
    placedLevels.length === 0 ?
    null :
    placedLevels.includes('excluded') ?
    'excluded' :
    placedLevels.includes('conditional') ?
    'conditional' :
    'calibrated'
  };

  const placedExcludedCount = placedLevels.filter((level) => level === 'excluded').length;

  return {
    slots,
    readout,
    trace: {
      executionPath: 'strategy',
      specNullReason: specNullReasonOf(strategy),
      configuredMarketPool: markets ? markets.coreCards.map((card) => card) : null
    },
    configError: null,
    usedFixtures: new Set(selected.map((p) => p.fixtureId)),
    notes: [
    ...(mergedEligibleDuplicatesCount > 0 ?
    [
    `${mergedEligibleDuplicatesCount} kapun belüli duplikált nyers rekord (ugyanaz a ` +
    'mérkőzés és ugyanaz a piac, két külön minta-generátorból) a kapuk UTÁN egyetlen ' +
    'kanonikus sorra lett vonva — a jogosultsági számlálók ezért mérkőzésenként ' +
    'egyszer számolnak, és egy kapun elbukott rekord soha nem tud levenni egy ' +
    'érvényes duplikátumot.'] :
    []),
    ...(placedExcludedCount > 0 ?
    [
    `${placedExcludedCount} core sor CÁFOLT saját sávval került kártyára: a Phase 6 ` +
    'market gate jelenleg INAKTÍV, ezért a mért cáfolat nem zár ki, csak látható ' +
    'figyelmeztetés és rangsor-hátrány.'] :
    []),
    ...(!BTTS_DEATHZONE_GATE_ACTIVE ?
    [
    'BTTS halálzóna kapu (40–55% sáv, modell < 48%) SHADOW módban van — a rangsor ' +
    'a modell-first pontszámot alkalmazza, de hard kizárás nem történik. ' +
    'Élesítéshez: BTTS_DEATHZONE_GATE_ACTIVE = true (coreEligibility.ts).'] :
    [])]

  };
}


function buildPooledCore(
allPatterns: readonly PatternHit[],
markets: SlipMarketPreferences | null,
strategy: CoreStrategySettings | null,
path: CoreExecutionPath)
: CoreOutcome {
  const usedFixtures = new Set<string>();
  const slots: SlipSlot[] = [];

  // Audit counters: how many raw records the canonical dedup merged away.
  let rawCandidates = 0;
  let canonicalCandidateCount = 0;

  CORE_ROLES.forEach((role, index) => {
    const ids = markets ? coreCardMarkets(markets, index) : [];
    const rawPool = allPatterns.filter((pattern) =>
    markets && ids.length > 0 ?
    matchesMarkets(pattern, ids) :
    index === 0 ?
    pattern.code === 'BTTS' :
    index === 1 ?
    pattern.code === 'O2.5' :
    pattern.type === 'safety_trend'
    );
    /* GATE-FIRST: a hard-gated record may never suppress a gate-passing
       duplicate, so `isCoreEligible` runs BEFORE canonicalisation. */
    const pool = canonicalCandidates(rawPool.filter(isCoreEligible));
    rawCandidates += rawPool.length;
    canonicalCandidateCount += pool.length;
    const candidate =
    pool.
    filter((pattern) => !usedFixtures.has(pattern.fixtureId)).
    slice().
    sort(byTierThenEvidenceThenStrategy)[0] ?? null;

    if (!candidate) {
      slots.push({
        ...emptySlot(
          role,
          ids.length === 0 && markets ?
          'Ehhez a core kártyához nincs kiválasztott piac.' :
          'Nincs olyan jelölt ebben a készletben, amely a szigorú core kapun belül van.'
        ),
        title: `${ROLE_SPEC[role].title}`,
        families: markets && ids.length > 0 ? summarizeMarkets(ids) : ROLE_SPEC[role].families,
        blocked: blockedList(pool)
      });
      return;
    }

    usedFixtures.add(candidate.fixtureId);
    slots.push(
      filledSlot(role, candidate, {
        title: `${ROLE_SPEC[role].title}`,
        families: markets && ids.length > 0 ? summarizeMarkets(ids) : ROLE_SPEC[role].families,
        vetoActive: strategy?.vetoMode === 'active',
        profileVeto: false,
        coreTier: coreTierOf(candidate)
      })
    );
  });

  // Audit trail: report how many raw records the canonical dedup merged.
  const duplicateCandidatesMerged = rawCandidates - canonicalCandidateCount;
  const notes: string[] = [
  `Core-pool audit: ${rawCandidates} nyers jelölt → ${canonicalCandidateCount} kanonikus jelölt` +
  (duplicateCandidatesMerged > 0 ? ` (${duplicateCandidatesMerged} duplikátum összeolvasztva).` : ' (nincs összeolvasztott duplikátum).')];


  return {
    slots,
    readout: null,
    trace: {
      executionPath: path,
      specNullReason: specNullReasonOf(strategy),
      configuredMarketPool: markets ? markets.coreCards.map((card) => card) : null
    },
    configError: null,
    usedFixtures,
    notes
  };
}

function buildBlockedCore(
markets: SlipMarketPreferences | null,
strategy: CoreStrategySettings | null)
: CoreOutcome {
  return {
    slots: CORE_ROLES.map((role) =>
    emptySlot(
      role,
      'A core stratégia beállítása önmagával ellentmondó (gyors mód piac-kód nélkül).'
    )
    ),
    readout: null,
    trace: {
      executionPath: 'blocked',
      specNullReason: specNullReasonOf(strategy),
      configuredMarketPool: markets ? markets.coreCards.map((card) => card) : null
    },
    configError:
    'A core stratégia gyors módban van, de nem hordoz egyetlen piac-kódot sem, ' +
    'ezért nem dönthető el, melyik kiválasztási út volt a szándék.',
    usedFixtures: new Set<string>(),
    notes: []
  };
}

/* -------------------------------------------------------------------------- *
 * „SAJÁT” (custom_btts) — a szándékosan kapu nélküli mód
 * -------------------------------------------------------------------------- *
 * Ez az útvonal TELJESEN elkülönül a fenti core logikától. Nem hív kapu-,
 * kalibrációs-, evidencia-, kvadráns-, kiütés-profil- vagy tartalék-függvényt.
 * Egyetlen szabálya van: a beállított mérkőzések BTTS Igen százaléka legyen
 * SZIGORÚAN 50% felett, és a hat kártya ebből a csökkenő rangsorból töltődjön.
 * -------------------------------------------------------------------------- */

/** A kártyán is látható BTTS Igen arány (0..1) — a nyers, nem kerekített érték. */
export function bttsYesRateOf(pattern: PatternHit): number {
  const value = pattern.goalStats?.bttsPct;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Mérkőzésenként EGY BTTS Igen jelölt, 50% felett, arány szerint csökkenően.
 * Holtverseny esetén a beállított mérkőzés-sorrend, majd a rekord-azonosító dönt
 * — így ugyanaz a bemenet mindig ugyanazt a kártya-sorrendet adja.
 */
export function customBttsCandidates(analyses: readonly FixtureAnalysis[]): PatternHit[] {
  const picked: Array<{pattern: PatternHit;order: number;rate: number;}> = [];

  analyses.forEach((analysis, order) => {
    const bttsRows = analysis.patterns.filter((pattern) => pattern.code === 'BTTS');
    if (bttsRows.length === 0) return;
    // A `goal_market` rekord a közvetlen H2H BTTS arányt hordozza — ezt mutatja a
    // kártya is; csak ha nincs ilyen, akkor esünk vissza az első BTTS rekordra.
    const pattern =
    bttsRows.find((row) => row.type === 'goal_market') ??
    bttsRows.slice().sort((a, b) => a.id.localeCompare(b.id))[0];
    const rate = bttsYesRateOf(pattern);
    if (!(rate > CUSTOM_BTTS_MIN_RATE)) return;
    picked.push({ pattern, order, rate });
  });

  return picked.
  sort((a, b) => b.rate - a.rate || a.order - b.order || a.pattern.id.localeCompare(b.pattern.id)).
  map((entry) => entry.pattern);
}

function customBttsSlot(
role: ActiveSlipRole,
pattern: PatternHit | null,
rank: number)
: SlipSlot {
  const base = ROLE_SPEC[role].title.split(' — ')[0];
  if (!pattern) {
    return {
      ...emptySlot(role, 'Nincs 50% felett álló BTTS Igen jelölt a beállított mérkőzések között.'),
      title: `${base} — Saját`,
      families: 'BTTS Igen · 50% felett',
      plain: true
    };
  }
  return {
    role,
    pattern,
    title: `${base} — #${rank} BTTS jelölt · ${(bttsYesRateOf(pattern) * 100).toFixed(1)}%`,
    families: 'BTTS Igen · 50% felett',
    reason: null,
    blocked: [],
    relaxed: false,
    failed: [],
    risk: null,
    shadowVeto: false,
    coreTier: null,
    plain: true
  };
}

function buildCustomBttsDraft(analyses: readonly FixtureAnalysis[]): SlipDraft {
  const ordered = customBttsCandidates(analyses);
  const slots = ROLE_ORDER.map((role, index) =>
  customBttsSlot(role, ordered[index] ?? null, index + 1)
  );

  return {
    slots,
    strategy: null,
    trace: null,
    configError: null,
    notes: [
    `Saját mód: ${ordered.length} beállított mérkőzés BTTS Igen aránya haladja meg az 50%-ot. ` +
    'A hat kártya kizárólag ebből a csökkenő rangsorból telik meg — minőségi kapu, ' +
    'kalibráció, kockázati veto és tartalék nélkül. Ami nem áll össze, üresen marad.']

  };
}

/** Build the whole 3+3 draft from a finished round analysis. */
export function buildSlipDraft(
analyses: readonly FixtureAnalysis[],
markets?: SlipMarketPreferences | null,
strategy?: CoreStrategySettings | null)
: SlipDraft {
  // „Saját” mód: a legelső ág, hogy egyetlen kapu-számítás se induljon el.
  if (isCustomBttsStrategy(strategy)) return buildCustomBttsDraft(analyses);

  const allPatterns = rankedPatterns(analyses);
  const spec = coreStrategySpecOf(strategy);
  const reason = specNullReasonOf(strategy);
  const marketPrefs = markets ?? null;
  const strategySettings = strategy ?? null;

  const core: CoreOutcome = spec ?
  buildStrategyCore(
    spec,
    strategySettings as CoreStrategySettings,
    allPatterns,
    analyses.length,
    marketPrefs
  ) :
  reason === 'empty_codes' ?
  buildBlockedCore(marketPrefs, strategySettings) :
  buildPooledCore(
    allPatterns,
    marketPrefs,
    strategySettings,
    marketPrefs ? 'pooled' : 'fixed'
  );

  const usedFixtures = new Set(core.usedFixtures);
  const jokerSlots = JOKER_ROLES.map((role) => {
    const pool = jokerPool(role, allPatterns, marketPrefs);
    const candidate = pool.find((pattern) => !usedFixtures.has(pattern.fixtureId)) ?? null;
    if (!candidate) return emptySlot(role, ROLE_SPEC[role].empty);
    usedFixtures.add(candidate.fixtureId);
    return filledSlot(role, candidate, {
      vetoActive: strategy?.vetoMode === 'active',
      profileVeto: false,
      coreTier: null
    });
  });

  const notes = [...core.notes];
  if (core.readout && core.readout.coreEvidenceLevel === 'conditional') {
    notes.push(
      'A core oldalon feltételes evidencia-szintű sor is van: ezeknél a jelzett ' +
      'valószínűség még nincs visszamérve, ezért a kombinált érték nem visszamért ' +
      'valószínűség.'
    );
  }

  return {
    slots: [...core.slots, ...jokerSlots],
    strategy: core.readout,
    trace: core.trace,
    configError: core.configError,
    notes
  };
}

/* -------------------------------------------------------------------------- *
 * Draft operations
 * -------------------------------------------------------------------------- */

function poolForRole(
role: ActiveSlipRole,
allPatterns: readonly PatternHit[],
markets: SlipMarketPreferences | null,
strategy: CoreStrategySettings | null)
: PatternHit[] {
  // „Saját” mód: minden kártya ugyanabból a kapu nélküli, 50% feletti BTTS
  // rangsorból cserél — joker oldalon is.
  if (isCustomBttsStrategy(strategy)) {
    const seen = new Set<string>();
    return allPatterns.
    filter((pattern) => pattern.code === 'BTTS' && bttsYesRateOf(pattern) > CUSTOM_BTTS_MIN_RATE).
    filter((pattern) => {
      if (seen.has(pattern.fixtureId)) return false;
      seen.add(pattern.fixtureId);
      return true;
    }).
    sort(
      (a, b) =>
      bttsYesRateOf(b) - bttsYesRateOf(a) || a.id.localeCompare(b.id)
    );
  }

  if (ROLE_SPEC[role].kind === 'joker') return jokerPool(role, allPatterns, markets);

  const spec = coreStrategySpecOf(strategy);
  if (spec) {
    return canonicalCandidates(
      allPatterns.filter((pattern) => spec.codes.includes(pattern.code)).filter(isCoreEligible)
    );
  }

  const index = CORE_ROLES.indexOf(role);
  const ids = markets ? coreCardMarkets(markets, index) : [];
  return canonicalCandidates(
    allPatterns.
    filter((pattern) => ids.length > 0 ? matchesMarkets(pattern, ids) : false).
    filter(isCoreEligible)
  );
}

/**
 * Replace one slot's line with the next valid alternative.
 *
 * Fixtures already used by the OTHER slots are excluded, so a swap can never
 * introduce a correlated duplicate. Returns `null` when no alternative exists.
 */
export function swapSlot(
draft: SlipDraft,
role: ActiveSlipRole,
allPatterns: readonly PatternHit[],
markets: SlipMarketPreferences | null,
strategy: CoreStrategySettings | null)
: SlipDraft | null {
  const slot = draft.slots.find((s) => s.role === role);
  if (!slot) return null;

  const blockedFixtures = new Set(
    draft.slots.
    filter((s) => s.role !== role && s.pattern).
    map((s) => (s.pattern as PatternHit).fixtureId)
  );

  const pool = poolForRole(role, allPatterns, markets, strategy).filter(
    (pattern) => !blockedFixtures.has(pattern.fixtureId)
  );
  if (pool.length === 0) return null;

  // The slot may hold a RAW record (e.g. `streak::BTTS`) while the pool holds
  // the CANONICAL record for the same market line (e.g. `goal_market::BTTS`).
  // Their ids differ, so match on the canonical candidate key too — otherwise
  // currentIndex would be -1 and the swap would restart from the pool head.
  const currentKey = slot.pattern ? candidateKeyOf(slot.pattern as PatternHit) : null;
  const currentIndex = currentKey === null ?
  -1 :
  pool.findIndex((pattern) =>
  pattern.id === (slot.pattern as PatternHit).id || candidateKeyOf(pattern) === currentKey
  );
  const next = pool[(currentIndex + 1) % pool.length];
  if (!next || currentKey !== null && candidateKeyOf(next) === currentKey) return null;

  return {
    ...draft,
    slots: draft.slots.map((s) =>
    s.role === role ?
    {
      ...filledSlot(role, next, {
        title: s.title,
        families: s.families,
        vetoActive: strategy?.vetoMode === 'active',
        profileVeto: ROLE_SPEC[role].kind === 'core',
        coreTier: ROLE_SPEC[role].kind === 'core' ? coreTierOf(next) : null
      })
    } :
    s
    )
  };
}

function lineProbability(pattern: PatternHit): number {
  const value = typeof pattern.modelProb === 'number' ? pattern.modelProb : pattern.hitRate;
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

export function hasLines(draft: SlipDraft): boolean {
  return draft.slots.some((slot) => slot.pattern !== null);
}

/**
 * Fixture labels that occur on more than one line.
 *
 * The identity is the `fixtureId`, NOT the display label: two different
 * fixtures (e.g. one in each league column) can render an identical
 * `${home} – ${away}` label, and counting labels reported those as a
 * duplicate — invalidating a perfectly valid slip. The label is only used
 * for the message shown to the user.
 */
export function duplicateFixtures(draft: SlipDraft): string[] {
  const counts = new Map<string, number>();
  const labels = new Map<string, string>();
  draft.slots.forEach((slot) => {
    if (!slot.pattern) return;
    const key = slot.pattern.fixtureId;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!labels.has(key)) labels.set(key, slot.pattern.fixtureLabel);
  });
  return Array.from(counts.entries()).
  filter(([, count]) => count > 1).
  map(([id]) => labels.get(id) ?? id);
}

/**
 * Product of the line probabilities.
 *
 * A duplicated fixture makes the lines correlated, so the product is NOT a
 * probability — it returns 0, and the surface renders an explicit invalid state
 * rather than a catastrophic-looking 0.0%.
 */
export function combinedProbability(draft: SlipDraft): number {
  if (duplicateFixtures(draft).length > 0) return 0;
  const lines = draft.slots.map((slot) => slot.pattern).filter((p): p is PatternHit => Boolean(p));
  if (lines.length === 0) return 0;
  return lines.reduce((acc, pattern) => acc * lineProbability(pattern), 1);
}

/** The weakest evidence level on the core side, or `null` when it is empty. */
export function draftEvidenceLevel(draft: SlipDraft): CoreEvidenceLevel | null {
  const levels = draft.slots.
  filter((slot) => ROLE_SPEC[slot.role].kind === 'core' && slot.pattern).
  map((slot) => evidenceLevelOf(slot.pattern as PatternHit));
  if (levels.length === 0) return null;
  if (levels.includes('excluded')) return 'excluded';
  if (levels.includes('conditional')) return 'conditional';
  return 'calibrated';
}

function lineOf(slot: SlipSlot, pattern: PatternHit): SlipLine {
  return {
    id: `${slot.role}-${pattern.id}`,
    role: slot.role,
    fixtureLabel: pattern.fixtureLabel,
    league: pattern.league,
    type: pattern.type,
    code: pattern.code,
    label: pattern.label,
    stability: pattern.stability,
    hitRate: pattern.hitRate,
    sample: pattern.sample,
    decision: effectiveDecisionOf(pattern),
    band: pattern.band,
    bandHitRate: pattern.bandHitRate,
    // Both derived from the ONE snapshot, so a saved slip can never disagree
    // with the screen that produced it.
    bandCalibrated: evidenceLevelOf(pattern) === 'calibrated',
    bandDiagnosis: effectiveBandDiagnosisOf(pattern),
    htHome: null,
    htAway: null,
    ftHome: null,
    ftAway: null,
    headToHeadRecord: pattern.headToHeadRecord,
    goalStats: pattern.goalStats,
    htStats: pattern.htStats,
    topModalScores: pattern.topModalScores,
    reversalStats: pattern.reversalStats,
    goalProfile: pattern.goalProfile ?? null,
    bttsRisk: pattern.bttsRisk ?? null,
    coreEvidence: pattern.coreEvidence ?? null,
    evidenceLevel: evidenceLevelOf(pattern),
    coreTier: slot.coreTier ?? null,
    coreSelectionRuleVersion: CORE_SELECTION_RULE_VERSION,
    candidateState:
    ROLE_SPEC[slot.role].kind === 'core' ? 'CORE_PUBLISHED' : null
  };
}

/** Freeze a draft into a persistable slip, stamped with its rule versions.
 *  Policy A: BLOCKED candidates (evidenceLevel === 'excluded') must never
 *  reach the published slip. The slot-assembly funnel already filters on
 *  `isCoreEligible`, which calls `gateFailuresForKind` — and `excluded`
 *  evidence now always pushes the `band` gate. This guard is a defensive
 *  assertion that no BLOCKED record slipped through. */
export function draftToSlip(
draft: SlipDraft,
roundName: string,
strategy: CoreStrategySettings)
: Slip {
  const lines = draft.slots.
  filter((slot) => slot.pattern && evidenceLevelOf(slot.pattern as PatternHit) !== 'excluded').
  map((slot) => lineOf(slot, slot.pattern as PatternHit));

  const coreLineCount = lines.filter(
    (line) => ROLE_SPEC[activeRoleOf(line.role)].kind === 'core'
  ).length;


  return {
    id: `slip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    roundName,
    combinedProb: combinedProbability(draft),
    lines,
    coreStrategy: strategy.quickStrategy,
    vetoMode: strategy.vetoMode,
    ruleVersion: CORE_SELECTION_RULE_VERSION,
    executionPath: draft.trace?.executionPath,
    specNullReason: draft.trace?.specNullReason ?? null,
    coreLineCount,
    zeroCore: coreLineCount === 0
  };
}