/**
 * BTTS CORE PROFILE — pair-shape classification and the shadow blowout veto.
 *
 * WHAT PROBLEM THIS SOLVES. A high BTTS rate alone is not evidence of a
 * two-sided scoring pair. The same head-to-head pool can hold two completely
 * different generators:
 *
 *   stable two-sided   1-1, 2-1, 1-2, 2-2, 3-1, 1-3
 *   one-sided blowout  3-0, 4-0, 5-0, 0-3, 0-4, 0-5   (+ enough 1-1 / 2-1 to
 *                                                      keep the BTTS rate high)
 *
 * Both can read "65% BTTS". Only the first one describes a pair that reliably
 * has both teams on the scoresheet; the second can switch into an asymmetric
 * clean-sheet regime at any time. This module makes that difference VISIBLE and
 * then — and only then — lets an operator act on it.
 *
 * THREE RULES IT OBEYS.
 *  1. No new prediction model. `modelRisk` is a marginal of the existing joint
 *     score matrix; `historicalRisk` is the existing recency-weighted, shrunk
 *     H2H machinery applied to a new event definition.
 *  2. No raw-rate decisions. Every gated value is weighted and shrunk on the
 *     Kish ESS, so a single old 5-0 cannot veto a fixture on its own.
 *  3. No opaque super-score. The label EXPLAINS, the reason codes DECIDE, and
 *     both are rendered next to their sample size.
 */

import type {
  BttsBlowoutRiskAssessment,
  BttsPairProfile,
  BttsVetoReason,
  H2HGoalProfile } from
'../types/winmix';

/* -------------------------------------------------------------------------- *
 * Thresholds — TUNED PRIORS, not derived constants.
 *
 * They are deliberately conservative: the whole point of shadow mode is that
 * these numbers get measured before they are allowed to remove a line.
 * -------------------------------------------------------------------------- */

/** Weighted, shrunk directed H2H clean-sheet blowout rate that reads as risk. */
export const BLOWOUT_H2H_RISK_MIN = 0.14;
/**
 * How many blowouts the directed history must actually contain before the
 * historical branch may fire. A single, heavily shrunk 5-0 is evidence to show,
 * never a veto on its own.
 */
export const BLOWOUT_H2H_MIN_COUNT = 2;
/** Model-implied clean-sheet blowout probability that reads as risk. */
export const BLOWOUT_MODEL_RISK_MIN = 0.09;
/** Weighted, shrunk BTTS rate a `stable_two_sided` label requires. */
export const STABLE_BTTS_MIN = 0.55;
/** Below this the pair is a low-tempo pair, not a BTTS pair. */
export const LOW_TEMPO_GOALS_MAX = 2.2;
/** |H2H BTTS − model BTTS| above which the two sources genuinely disagree. */
export const BTTS_CONFLICT_SPREAD = 0.18;
/** Minimum Kish ESS for any BTTS Core candidacy. */
export const PROFILE_ESS_MIN = 4;
/** Minimum nominal directed meetings before a profile may be labelled at all. */
export const PROFILE_DIRECT_MIN = 5;
/** HT BTTS rate at which the non-decisive early-open label may be shown. */
export const EARLY_OPEN_HT_BTTS_MIN = 0.3;

/** The rule set version stamped onto every saved slip, for later auditability. */
export const BTTS_PROFILE_RULE_VERSION = 'btts-profile-safe/1.0';

/* -------------------------------------------------------------------------- */

export interface BttsPairProfileInput {
  profile: H2HGoalProfile | null;
  /** Model-implied BTTS probability from the joint matrix. */
  modelBtts: number;
  /** Model-implied P(|H−A| ≥ 3 ∧ one side scoreless). */
  modelCleanSheetBlowout: number;
  /** Model-implied P(total ≥ 4 ∧ one side scoreless). */
  modelHighGoalNoBtts: number;
  /** Historical HT BTTS rate, when HT coverage was sufficient. */
  htBttsRate?: number | null;
}

export const PROFILE_COPY: Record<
  BttsPairProfile,
  {label: string;tone: 'positive' | 'warning' | 'negative';detail: string;}> =
{
  stable_two_sided: {
    label: 'Stabil kétoldalú',
    tone: 'positive',
    detail:
    'Magas BTTS evidencia, alacsony egyoldalú kapott-nullás kockázat, és a H2H ' +
    'illetve a modell nem mond egymásnak ellent.'
  },
  btts_narrow: {
    label: 'Szűk BTTS',
    tone: 'warning',
    detail:
    'A BTTS evidencia 50% felett van, de nem éri el a stabil kétoldalú profil ' +
    'küszöbét — a sor bekerülhet, de nem a legerősebb jelölt.'
  },
  underdog_scores: {
    label: 'A gyengébb fél is betalál',
    tone: 'positive',
    detail:
    'A kétoldalúságot az adja, hogy a papírforma szerint gyengébb csapat is ' +
    'rendszeresen gólt szerez ebben a párosításban.'
  },
  one_sided_blowout_risk: {
    label: 'Egyoldalú kiütés kockázata',
    tone: 'negative',
    detail:
    'A BTTS arány lehet magas, de az egyirányú H2H ismétlődő, nagy gólszámú ' +
    'kapott-nullás meneteket tartalmaz, és/vagy a mátrix érdemi kiütés-' +
    'valószínűséget ad. Nem egyenértékű egy stabil kétoldalú párral.'
  },
  low_tempo: {
    label: 'Alacsony tempó',
    tone: 'warning',
    detail: 'Kevés gól, gyenge BTTS evidencia — ez nem BTTS párosítás.'
  },
  high_variance: {
    label: 'Nagy szórás',
    tone: 'warning',
    detail:
    'A H2H és a modell BTTS becslése érdemben eltér, így a jelzett ' +
    'valószínűség bizonytalan.'
  },
  insufficient_data: {
    label: 'Kevés adat',
    tone: 'warning',
    detail:
    'A közvetlen, egyirányú minta vagy annak effektív mérete túl kicsi ahhoz, ' +
    'hogy a profilról bármit kijelentsünk.'
  }
};

export const VETO_REASON_LABEL: Record<BttsVetoReason, string> = {
  blowout_history: 'H2H kiütés',
  blowout_model: 'Modell kiütés',
  insufficient_sample: 'Kevés minta',
  reverse_assisted: 'Fordított pálya',
  model_conflict: 'Modellkonfliktus'
};

/* -------------------------------------------------------------------------- */

function shortRate(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Classify the pair and collect the veto reasons in one pass.
 *
 * The label is explanatory. The reason codes are what the Profile Safe strategy
 * consults — and even those only remove a line when the veto is ACTIVE.
 */
export function assessBttsPairRisk(
input: BttsPairProfileInput)
: BttsBlowoutRiskAssessment {
  const { profile, modelBtts, modelCleanSheetBlowout, htBttsRate } = input;

  const historicalRisk = profile?.shrunkCleanSheetBlowoutRate ?? 0;
  const modelRisk = modelCleanSheetBlowout;
  const ess = profile?.effectiveSampleSize ?? 0;
  const usedReverse = profile?.usedReverse ?? false;

  const reasonCodes: BttsVetoReason[] = [];
  const vetoReasons: string[] = [];
  const add = (code: BttsVetoReason, sentence: string) => {
    reasonCodes.push(code);
    vetoReasons.push(sentence);
  };

  /* --- Sample first. Nothing below is meaningful without it. ------------- */
  const thin =
  !profile ||
  profile.directSampleSize < PROFILE_DIRECT_MIN ||
  ess < PROFILE_ESS_MIN;
  if (thin) {
    add(
      'insufficient_sample',
      profile ?
      `Az egyirányú minta ${profile.directSampleSize} találkozó (Kish ESS ${ess.toFixed(1)}) — ` +
      `a Profile Safe core legalább ${PROFILE_DIRECT_MIN} találkozót és ${PROFILE_ESS_MIN} ESS-t kér.` :
      'Nincs egyirányú H2H minta ehhez a párosításhoz.'
    );
  }

  if (usedReverse) {
    add(
      'reverse_assisted',
      'A minta fordított pályás találkozókkal van kiegészítve — ez nem kaphatja ' +
      'meg a legerősebb Profile Safe státuszt.'
    );
  }

  /* --- The blowout branches --------------------------------------------- */
  const riskyHistory =
  !!profile &&
  historicalRisk >= BLOWOUT_H2H_RISK_MIN &&
  profile.cleanSheetBlowoutCount >= BLOWOUT_H2H_MIN_COUNT;
  if (riskyHistory && profile) {
    add(
      'blowout_history',
      `Ismétlődő, egyoldalú kapott-nullás menetek: ${profile.cleanSheetBlowoutCount} / ` +
      `${profile.directSampleSize} találkozó (${profile.blowoutScores.slice(0, 3).join(', ')}), ` +
      `recency-súlyozva és zsugorítva ${shortRate(historicalRisk)}.`
    );
  }

  const riskyModel = modelRisk >= BLOWOUT_MODEL_RISK_MIN;
  if (riskyModel) {
    add(
      'blowout_model',
      `A közös eredménymátrix ${shortRate(modelRisk)} valószínűséget ad egy 3+ gólos, ` +
      'kapott-nullás kiütésre.'
    );
  }

  /* --- H2H versus model ------------------------------------------------- */
  const shrunkBtts = profile?.shrunkBttsRate ?? modelBtts;
  const spread = Math.abs(shrunkBtts - modelBtts);
  const conflict = spread >= BTTS_CONFLICT_SPREAD;
  if (conflict) {
    add(
      'model_conflict',
      `A H2H (${shortRate(shrunkBtts)}) és a modell (${shortRate(modelBtts)}) BTTS becslése ` +
      `${shortRate(spread)} ponttal tér el — a jelzett valószínűség nem megalapozott.`
    );
  }

  /* --- The explanatory label -------------------------------------------- */
  let label: BttsPairProfile;
  if (thin) label = 'insufficient_data';else
  if (riskyHistory || riskyModel) label = 'one_sided_blowout_risk';else
  if (
  profile &&
  profile.weightedAvgGoals < LOW_TEMPO_GOALS_MAX &&
  shrunkBtts < 0.5)

  label = 'low_tempo';else
  if (conflict) label = 'high_variance';else
  if (shrunkBtts >= STABLE_BTTS_MIN) label = 'stable_two_sided';else
  label = 'btts_narrow';

  /* --- PHASE 3 — non-decisive early-open booster ------------------------- *
   * Displayed only, and only when the pair is otherwise coherent. It never
   * multiplies the model BTTS probability; it may serve as a tie-break at most
   * once a separate ablation shows it helps.
   * -------------------------------------------------------------------- */
  const earlyOpenProfile =
  typeof htBttsRate === 'number' &&
  htBttsRate >= EARLY_OPEN_HT_BTTS_MIN &&
  !thin &&
  !conflict &&
  !riskyHistory &&
  !riskyModel;

  return {
    profile: label,
    historicalRisk,
    modelRisk,
    effectiveSampleSize: ess,
    usedReverse,
    wouldVeto: reasonCodes.length > 0,
    reasonCodes,
    vetoReasons,
    earlyOpenProfile
  };
}

/** Coarse traffic-light tone of a blowout risk value, for the surface only. */
export function blowoutRiskTone(value: number): 'positive' | 'warning' | 'negative' {
  if (value >= BLOWOUT_MODEL_RISK_MIN) return 'negative';
  if (value >= BLOWOUT_MODEL_RISK_MIN * 0.6) return 'warning';
  return 'positive';
}

export function blowoutRiskLabel(value: number): string {
  const tone = blowoutRiskTone(value);
  return tone === 'negative' ? 'Emelkedett' : tone === 'warning' ? 'Közepes' : 'Alacsony';
}