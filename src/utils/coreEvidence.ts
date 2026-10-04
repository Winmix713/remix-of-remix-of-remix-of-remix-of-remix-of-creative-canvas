/**
 * coreEvidence — THE EVIDENCE LIFECYCLE OF ONE CORE LINE.
 *
 * THE SINGLE SOURCE OF TRUTH. Every consumer — `utils/slip.ts`, the gate, the
 * audit surface, the badges — reads `level`, `kind`, `observations`, `bandKey`,
 * `bandLabel`, `environmentKeys`, `environmentLabel`, `widened` and `diagnosis`
 * from the snapshot this module returns. No consumer may re-derive a band
 * verdict from `bandCalibrated`, `marketBandCalibrated`, a raw diagnosis or a
 * hand-written "Cáfolt sáv" label.
 *
 * The strict Core gate used to consume a single boolean, which collapsed two
 * OPPOSITE states into the same refusal:
 *
 *   "we measured this probability band and it did not hold"   (a real refusal)
 *   "we have never measured this probability band"            (missing data)
 *
 * Three levels separate them for good:
 *
 *   `calibrated`  — the signalled probability was measured and held,
 *   `conditional` — nothing evaluable exists yet, or only a WIDENED
 *                   environment is evaluable and it diverges,
 *   `excluded`    — the line's OWN band is evaluable, has at least
 *                   {@link BAND_MIN_SAMPLE} audited observations, and is NOT
 *                   calibrated.
 *
 * THREE INVARIANTS THIS MODULE ENFORCES, AND WHY THEY ARE ASYMMETRIC
 * -----------------------------------------------------------------
 *  1. EXCLUSION HAS EXACTLY ONE DOOR: {@link exclusionAllowed}. A row may be
 *     `level: 'excluded'` / `kind: 'disproved'` only when its OWN band is
 *     simultaneously `evaluable === true`, `n >= BAND_MIN_SAMPLE` and
 *     `calibrated === false`. At `0 / 20 … 19 / 20` audited observations the
 *     verdict is ALWAYS `conditional` + `missing_evidence` — "not yet measured"
 *     is not "disproved", and a screen showing `0 / 20 auditált megfigyelés`
 *     next to `Cáfolt sáv` states a contradiction.
 *  2. A WIDENED ENVIRONMENT MAY CONFIRM, NEVER DISPROVE. Merging neighbouring
 *     probability bands answers a WIDER question than the card asks (`55–75%`
 *     instead of `55–65%`). That is enough to support a line, never enough to
 *     refuse one — so the widened branch can only ever return `calibrated` or
 *     `conditional`.
 *  3. EVERY SNAPSHOT IS SEALED. {@link sealSnapshot} re-checks coherence on the
 *     way out: an `excluded` snapshot must carry `observations >= required`,
 *     `evaluable === true` and `kind === 'disproved'`. If it does not, it is
 *     DOWNGRADED to `conditional` + `missing_evidence` before it leaves the
 *     module. A future edit to any branch therefore cannot leak a contradiction.
 *
 * Deterministic and side-effect free: the same tallies in always give the same
 * verdict out, so a saved slip stays reproducible and the whole lifecycle is
 * unit-testable (see `utils/coreEvidenceTests.ts`).
 */

import { wilsonInterval } from './bootstrap';
import { BAND_MIN_SAMPLE } from './constants';
import {
  MARKET_CALIBRATION_BANDS,
  diagnoseMarketBand,
  marketBandOfProbability } from
'./decision';
import type {
  BandDiagnosis,
  CoreEvidenceKind,
  CoreEvidenceLevel,
  CoreEvidenceSnapshot,
  MarketCalibrationBand,
  MarketCalibrationBandKey,
  ReliabilityBand } from
'../types/winmix';

/**
 * Versioned rule set. Stamped onto every snapshot — and therefore onto every
 * saved slip — so a later audit can tell WHICH rules produced a verdict.
 *
 * `1.1` is the version in which exclusion became gated by the single
 * {@link exclusionAllowed} predicate and every snapshot became sealed.
 */
export const CORE_EVIDENCE_RULE_VERSION = 'core-evidence/1.1';

/**
 * How many neighbouring bands on EACH side may be merged in to reach the
 * sample minimum. Bounded on purpose: at some width the merged environment no
 * longer describes the line at all.
 */
export const CORE_EVIDENCE_MAX_RADIUS = 2;

export const EVIDENCE_COPY: Record<
  CoreEvidenceLevel,
  {label: string;short: string;detail: string;tone: 'positive' | 'warning' | 'negative';}> =
{
  calibrated: {
    label: 'Kalibrált',
    short: 'kalibrált',
    tone: 'positive',
    detail:
    'A jelzett valószínűséget MEGMÉRTÜK, és a tényleges beválás ' +
    'Wilson-intervallumán belül van. Visszamért sor.'
  },
  conditional: {
    label: 'Feltételes',
    short: 'feltételes',
    tone: 'warning',
    detail:
    'A sor saját valószínűségi sávja még nincs visszamérve — ez ADATHIÁNY, ' +
    'nem cáfolat. A sor felkerülhet a core oldalra, de a kombinált érték nem ' +
    'nevezhető visszamért valószínűségnek.'
  },
  excluded: {
    label: 'Kizárt',
    short: 'kizárt',
    tone: 'negative',
    detail:
    'A sor saját sávját legalább ' +
    `${BAND_MIN_SAMPLE} auditált megfigyelésen megmértük, és a jelzett ` +
    'valószínűség a tényleges beválás intervallumán KÍVÜL van. Cáfolt ' +
    'evidencia — core kártyára feltételesen sem kerülhet.'
  }
};

const DIAGNOSIS_PHRASE: Record<BandDiagnosis, string> = {
  reliable: 'a mérés megerősítette a jelzést',
  calibrated: 'a mérés megerősítette a jelzést',
  overconfident: 'a tényleges beválás a jelzett valószínűség ALATT van',
  underconfident: 'a tényleges beválás a jelzett valószínűség FÖLÖTT van',
  noise: 'a minta túl szórt ahhoz, hogy a jelzést igazolja',
  insufficient: 'még nincs elegendő auditált megfigyelés'
};

/* -------------------------------------------------------------------------- *
 * INVARIANT 1 — the one and only door to `excluded`
 * -------------------------------------------------------------------------- */

/**
 * The minimum a band must expose to be judged at all. Both the market
 * probability bands and the legacy 1X2 confidence bands satisfy this shape, so
 * ONE predicate governs BOTH paths.
 */
export interface EvidenceBandLike {
  n: number;
  evaluable: boolean;
  calibrated: boolean;
}

/**
 * Was this band actually MEASURED? A band under {@link BAND_MIN_SAMPLE}
 * observations — or one the producer flagged unevaluable — is reported, never
 * judged, in either direction.
 */
export function bandMeasured(band: EvidenceBandLike | null | undefined): boolean {
  if (!band) return false;
  return band.evaluable === true && Number.isFinite(band.n) && band.n >= BAND_MIN_SAMPLE;
}

/**
 * INVARIANT 1, AS THE SINGLE CENTRAL PREDICATE.
 *
 * `level: 'excluded'` + `kind: 'disproved'` may be produced ONLY through this
 * function, and only when the row's OWN band is simultaneously:
 *
 *   • `band.evaluable === true`
 *   • `band.n >= BAND_MIN_SAMPLE`
 *   • `band.calibrated === false`
 *
 * Consequently `0 / 20`, `1 / 20`, … `19 / 20` audited observations can NEVER
 * yield an exclusion, and never a "Cáfolt sáv" caption.
 */
export function exclusionAllowed(band: EvidenceBandLike | null | undefined): boolean {
  if (!band) return false;
  if (!bandMeasured(band)) return false;
  return band.calibrated === false;
}

/* -------------------------------------------------------------------------- *
 * Band geometry
 * -------------------------------------------------------------------------- */

const BAND_ORDER: MarketCalibrationBandKey[] = MARKET_CALIBRATION_BANDS.map((s) => s.key);

function pct(value: number): string {
  return `${Math.round(value * 100)}`;
}

/** Printable probability window of a set of bands, e.g. `55–75%`. */
function windowLabelOf(keys: readonly MarketCalibrationBandKey[]): string {
  const specs = MARKET_CALIBRATION_BANDS.filter((s) => keys.includes(s.key));
  if (specs.length === 0) return 'sáv';
  const lo = Math.min(...specs.map((s) => s.min));
  const hi = Math.max(...specs.map((s) => s.max));
  return `${pct(lo)}–${pct(hi)}%`;
}

interface Environment {
  keys: MarketCalibrationBandKey[];
  n: number;
  hits: number;
  sumP: number;
}

/**
 * The additive merge of the home band and every band within `radius` of it.
 *
 * Additive by construction — `n`, `hits` and `sumP` are the only quantities
 * combined — so a merged environment is measured exactly the same way a single
 * band is, with no re-weighting and no re-derivation.
 */
function environmentAt(
byKey: Map<MarketCalibrationBandKey, MarketCalibrationBand>,
homeIndex: number,
radius: number)
: Environment {
  const keys: MarketCalibrationBandKey[] = [];
  let n = 0;
  let hits = 0;
  let sumP = 0;

  for (let i = homeIndex - radius; i <= homeIndex + radius; i++) {
    const key = BAND_ORDER[i];
    if (!key) continue;
    keys.push(key);
    const band = byKey.get(key);
    if (!band) continue;
    n += band.n;
    hits += band.hits;
    sumP += band.avgP * band.n;
  }

  return { keys, n, hits, sumP };
}

/* -------------------------------------------------------------------------- *
 * INVARIANT 3 — sealing: no snapshot leaves incoherent
 * -------------------------------------------------------------------------- */

/**
 * The kinds that are ALLOWED to accompany a hard exclusion.
 *
 * Anything else pairing `excluded` with a thin sample is a contradiction, and
 * the suite in `utils/coreEvidenceTests.ts` asserts it never happens.
 */
export const EXCLUDING_KINDS: readonly CoreEvidenceKind[] = ['disproved'];

/**
 * Contract check for every snapshot this module returns.
 *
 * `excluded` requires a MEASURED own band: `observations >= required`,
 * `evaluable === true`, `kind === 'disproved'`, and no widening (a merged
 * environment may never disprove). A `0 / 20 · Cáfolt sáv` row therefore
 * reports itself as incoherent instead of being rendered as a refusal.
 */
export function isSnapshotCoherent(snap: CoreEvidenceSnapshot): boolean {
  if (snap.level !== 'excluded') return true;
  return (
    snap.observations >= snap.required &&
    snap.observations >= BAND_MIN_SAMPLE &&
    snap.evaluable === true &&
    snap.widened === false &&
    EXCLUDING_KINDS.includes(snap.kind));

}

type SnapshotDraft = Omit<CoreEvidenceSnapshot, 'required' | 'ruleVersion'>;

/**
 * Downgrade an incoherent exclusion into the only honest alternative: missing
 * evidence. Numeric verdict fields are cleared too, so nothing downstream can
 * present an interval that no longer backs a verdict.
 */
function downgradeToMissing(snap: CoreEvidenceSnapshot): CoreEvidenceSnapshot {
  const scope = snap.bandLabel ?? snap.environmentLabel ?? 'sáv';
  return {
    ...snap,
    level: 'conditional',
    kind: 'missing_evidence',
    avgP: null,
    hitRate: null,
    ciLo: null,
    ciHi: null,
    diagnosis: 'insufficient',
    headline:
    `A ${scope} sávban ${snap.observations} / ${BAND_MIN_SAMPLE} auditált megfigyelés ` +
    'van, ezért a sáv nem cáfolható. A sor feltételes — adathiány, nem cáfolat.'
  };
}

/**
 * The only snapshot constructor. Stamps the rule version and the entry minimum,
 * then SEALS the result against {@link isSnapshotCoherent}.
 */
function sealSnapshot(draft: SnapshotDraft): CoreEvidenceSnapshot {
  const snap: CoreEvidenceSnapshot = {
    ...draft,
    required: BAND_MIN_SAMPLE,
    ruleVersion: CORE_EVIDENCE_RULE_VERSION
  };
  return isSnapshotCoherent(snap) ? snap : downgradeToMissing(snap);
}

/* -------------------------------------------------------------------------- *
 * Resolution
 * -------------------------------------------------------------------------- */

export interface CoreEvidenceInput {
  /** Is the market registered in the out-of-sample market evaluation? */
  registered: boolean;
  /** The line's OWN model-implied probability. */
  modelProb: number | null | undefined;
  /** Measured probability bands of this market, or null when unmeasured. */
  marketBands: readonly MarketCalibrationBand[] | null | undefined;
  /** Legacy 1X2 confidence band, used only by unregistered markets. */
  globalBand: ReliabilityBand | null | undefined;
}

/**
 * The legacy 1X2 confidence-band path, used only by markets that are not
 * registered in the market evaluation.
 *
 * Same hard guard as the market path: {@link bandMeasured} to be judged at all,
 * {@link exclusionAllowed} to be refused.
 */
function resolveFromGlobalBand(globalBand: ReliabilityBand | null | undefined): CoreEvidenceSnapshot {
  const n = globalBand?.n ?? 0;
  const label = globalBand?.label ?? null;
  const measured = bandMeasured(globalBand);

  if (!measured) {
    return sealSnapshot({
      level: 'conditional',
      kind: 'missing_evidence',
      bandKey: null,
      bandLabel: label,
      environmentKeys: [],
      environmentLabel: label,
      widened: false,
      observations: n,
      evaluable: false,
      avgP: null,
      hitRate: null,
      ciLo: null,
      ciHi: null,
      hits: globalBand?.hits ?? 0,
      diagnosis: 'insufficient',
      headline:
      `A konfidencia-sáv${label ? ` (${label})` : ''} eddig ${n} / ${BAND_MIN_SAMPLE} ` +
      'auditált megfigyelést tartalmaz — még nem visszamért, a sor feltételes.'
    });
  }

  const excluded = exclusionAllowed(globalBand);
  return sealSnapshot({
    level: excluded ? 'excluded' : 'calibrated',
    kind: excluded ? 'disproved' : 'verified',
    bandKey: null,
    bandLabel: label,
    environmentKeys: [],
    environmentLabel: label,
    widened: false,
    observations: n,
    evaluable: true,
    avgP: globalBand?.avgP ?? null,
    hitRate: globalBand?.hitRate ?? null,
    ciLo: globalBand?.ciLo ?? null,
    ciHi: globalBand?.ciHi ?? null,
    hits: globalBand?.hits ?? 0,
    diagnosis: globalBand?.diagnosis ?? 'insufficient',
    headline: excluded ?
    `A ${label} sáv ${n} megfigyelésen mérve NEM igazolta a jelzett ` +
    'valószínűséget — cáfolt evidencia.' :
    `A ${label} sáv ${n} megfigyelésen visszamért.`
  });
}

/**
 * The one function that decides a line's evidence level.
 *
 * Deterministic and side-effect free: same tallies in, same verdict out, so it
 * is unit-testable and reproducible from a saved slip.
 */
export function resolveCoreEvidence(input: CoreEvidenceInput): CoreEvidenceSnapshot {
  const { registered, modelProb, marketBands, globalBand } = input;

  /* --- Unregistered markets keep the legacy global-band path -------------- */
  if (!registered) return resolveFromGlobalBand(globalBand);

  /* --- Registered market, but nothing measured at all --------------------- */
  if (
  typeof modelProb !== 'number' ||
  !Number.isFinite(modelProb) ||
  !marketBands ||
  marketBands.length === 0)
  {
    return sealSnapshot({
      level: 'conditional',
      kind: 'missing_evidence',
      bandKey: null,
      bandLabel: null,
      environmentKeys: [],
      environmentLabel: null,
      widened: false,
      observations: 0,
      evaluable: false,
      avgP: null,
      hitRate: null,
      ciLo: null,
      ciHi: null,
      hits: 0,
      diagnosis: 'insufficient',
      headline:
      'Ehhez a piachoz még egyetlen auditált megfigyelés sem tartozik — a ' +
      'kalibrációs napló üres, ezért a sor feltételes. Futtass audit-bejárást, ' +
      'vagy tölts be több lezárt fordulót.'
    });
  }

  const byKey = new Map<MarketCalibrationBandKey, MarketCalibrationBand>(
    marketBands.map((b) => [b.key, b])
  );
  const homeKey = marketBandOfProbability(modelProb);
  const homeIndex = BAND_ORDER.indexOf(homeKey);
  const own = byKey.get(homeKey) ?? null;
  const homeLabel = own?.label ?? windowLabelOf([homeKey]);

  /* --- 1. The line's OWN band is measured: it decides, both ways ---------- *
   * INVARIANT 1 — `exclusionAllowed` is the ONLY door to `excluded`. An own
   * band of 0 / 20 … 19 / 20 cannot enter here, so it can never be reported as
   * a disproved band. */
  if (bandMeasured(own) && own) {
    const excluded = exclusionAllowed(own);
    return sealSnapshot({
      level: excluded ? 'excluded' : 'calibrated',
      kind: excluded ? 'disproved' : 'verified',
      bandKey: homeKey,
      bandLabel: homeLabel,
      environmentKeys: [homeKey],
      environmentLabel: homeLabel,
      widened: false,
      observations: own.n,
      evaluable: true,
      avgP: own.avgP,
      hitRate: own.hitRate,
      ciLo: own.ciLo,
      ciHi: own.ciHi,
      hits: own.hits,
      diagnosis: own.diagnosis,
      headline: excluded ?
      `A ${homeLabel} sávban ${own.n} auditált megfigyelés van, és ` +
      `${DIAGNOSIS_PHRASE[own.diagnosis] ?? 'a mérés nem igazolta a jelzést'}. ` +
      'Ez cáfolt evidencia, nem adathiány.' :
      `A ${homeLabel} sávban ${own.n} auditált megfigyelés — a jelzett ` +
      'valószínűség a tényleges beválás Wilson-intervallumán belül van.'
    });
  }

  /* --- 2. Adaptive widening — visible, bounded, never a disproof ---------- *
   * INVARIANT 2 — a ±1…±2 neighbour environment answers a WIDER question than
   * the card shows. It may return `calibrated` or `conditional`, and it NEVER
   * calls `exclusionAllowed`, so it can never return `excluded`. */
  for (let radius = 1; radius <= CORE_EVIDENCE_MAX_RADIUS; radius++) {
    const env = environmentAt(byKey, homeIndex, radius);
    if (env.n < BAND_MIN_SAMPLE) continue;

    const avgP = env.sumP / env.n;
    const ci = wilsonInterval(env.hits, env.n);
    const diagnosis = diagnoseMarketBand(env.n, avgP, ci);
    const label = windowLabelOf(env.keys);
    const calibrated = diagnosis === 'calibrated';

    return sealSnapshot({
      level: calibrated ? 'calibrated' : 'conditional',
      kind: calibrated ? 'verified' : 'divergent_environment',
      bandKey: homeKey,
      bandLabel: homeLabel,
      environmentKeys: env.keys,
      environmentLabel: label,
      widened: true,
      observations: env.n,
      evaluable: true,
      avgP,
      hitRate: ci.rate,
      ciLo: ci.lo,
      ciHi: ci.hi,
      hits: env.hits,
      diagnosis,
      headline: calibrated ?
      `A saját sáv (${homeLabel}) még nem érte el a ${BAND_MIN_SAMPLE} esetes ` +
      `minimumot, ezért a kalibrációs környezet ${label}-re bővítve: ` +
      `${env.n} auditált megfigyelés, a jelzett valószínűség az intervallumon belül.` :
      `A saját sáv (${homeLabel}) még nem értékelhető; a ${label} bővített ` +
      `környezet ${env.n} megfigyelésen eltérést jelez ` +
      `(${DIAGNOSIS_PHRASE[diagnosis] ?? 'eltérés'}). Ez óvatosságra ok, de nem ` +
      'cáfolat — a sor feltételes marad.'
    });
  }

  /* --- 3. Genuinely missing evidence: conditional, with the shortfall ----- */
  const widest = environmentAt(byKey, homeIndex, CORE_EVIDENCE_MAX_RADIUS);
  const widestLabel = windowLabelOf(widest.keys);
  const ownN = own?.n ?? 0;

  return sealSnapshot({
    level: 'conditional',
    kind: 'missing_evidence',
    bandKey: homeKey,
    bandLabel: homeLabel,
    environmentKeys: widest.keys,
    environmentLabel: widestLabel,
    widened: widest.n > ownN,
    observations: ownN,
    evaluable: false,
    avgP: null,
    hitRate: null,
    ciLo: null,
    ciHi: null,
    hits: own?.hits ?? 0,
    diagnosis: 'insufficient',
    headline:
    `A ${homeLabel} sávban eddig ${ownN} / ${BAND_MIN_SAMPLE} auditált megfigyelés ` +
    `van (a ${widestLabel} bővített környezetben ${widest.n}). A sáv még nincs ` +
    'visszamérve, ezért a sor feltételes — nem kalibrált és nem cáfolt.'
  });
}

/* -------------------------------------------------------------------------- *
 * Small readers used by the gate and the surface
 * -------------------------------------------------------------------------- */

/**
 * The level the gate and the UI must read.
 *
 * A missing snapshot is `conditional` — never `excluded` — and an incoherent
 * exclusion is downgraded here too, so no consumer needs its own guard.
 */
export function coherentLevelOf(
snap: CoreEvidenceSnapshot | null | undefined)
: CoreEvidenceLevel {
  if (!snap) return 'conditional';
  if (snap.level !== 'excluded') return snap.level;
  return isSnapshotCoherent(snap) ? 'excluded' : 'conditional';
}

/** Ordering weight: calibrated lines always fill a core slot before conditional ones. */
export function evidenceRank(level: CoreEvidenceLevel): number {
  return level === 'calibrated' ? 0 : level === 'conditional' ? 1 : 2;
}

/** How many more audited observations the own band still needs. */
export function observationsMissing(snap: CoreEvidenceSnapshot): number {
  return Math.max(0, snap.required - snap.observations);
}

/** One-line coverage caption, e.g. `12 / 20 · 55–65%`. */
export function coverageLabel(snap: CoreEvidenceSnapshot): string {
  const scope = snap.environmentLabel ?? snap.bandLabel ?? 'sáv';
  return `${snap.observations} / ${snap.required} · ${scope}${snap.widened ? ' (bővített)' : ''}`;
}
/* -------------------------------------------------------------------------- *
 * BTTS BAND HEALTH — sávegészség értékelő (Phase 6 rangsor-integráció)
 *
 * A kanonikus `evaluateBttsBandHealth` és `BandRiskEvaluation` a
 * `coreEligibility.ts`-ben él. Ez a modul nem tartalmaz saját másolatot —
 * a `coreTrace.ts` és az audit felületek a `coreEligibility.ts`-ből
 * importálják, így nincs körkörös függőség és nincs duplikáció.
 * -------------------------------------------------------------------------- */
export { evaluateBttsBandHealth, type BandRiskEvaluation } from './coreEligibility';
