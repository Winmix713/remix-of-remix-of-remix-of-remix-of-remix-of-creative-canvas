/**
 * coreEligibility — BTTS Core belépési szűrő: modell-alapú halálzóna szűrés.
 *
 * Ez a modul a nyers rekordok LEGELSŐ szűrési kapuját valósítja meg, amelyet
 * a `canonicalCandidates()` hívás ELŐTT kell alkalmazni (lásd slip.ts
 * gate-first tölcsér, v2.3). Önálló fájlban van, hogy a `slip.ts` és a
 * `coreTrace.ts` egyaránt importálhassa anélkül, hogy körkörös függőség
 * keletkezne.
 *
 * KÉT KAPU, KÉT FLAG
 * -------------------
 * 1. `BTTS_DEATHZONE_GATE_ACTIVE` — a 40–55% halálzóna hard kapuját vezérli.
 *    OFF (shadow) állapotban a kapu nem zár ki, de a `shadowWouldFail` flag
 *    igaz, így a trace és a kártya megmutatja a hipotetikus kiesést.
 *
 * 2. A band-értékelő `evaluateBttsBandHealth()` SOHA nem ad ki hard kizárást
 *    maga — a `priorityBonus`-t a `getBttsRankingScore()` olvassa a
 *    `slip.ts`-ben. A sávegészség és az eligibility szándékosan szét van
 *    választva: az eligibility dönt a kapunál, a sávegészség a rangsornál.
 *
 * SHADOW MÓD
 * ----------
 * OFF állapotban (`BTTS_DEATHZONE_GATE_ACTIVE = false`) a visszatérő
 * `eligible: true` jelenti, hogy a sor ÁTMEGY, de a `shadowWouldFail: true`
 * azt, hogy éles módban kiesne. A trace panel ezt sárga/narancs figyelmeztetésként
 * jeleníti meg, nem piros kapuhibaként.
 *
 * Élesítés: flip `BTTS_DEATHZONE_GATE_ACTIVE = true` miután a historikus
 * mérésen a Top-1 / Top-3 találati arány nem romlik.
 */

// ---------------------------------------------------------------------------
// Aktiválási flag
// ---------------------------------------------------------------------------

/**
 * A 40–55% halálzóna és a <40% abszolút minimum hard kapuját vezérli.
 *
 * `false` (alapértelmezés, shadow mód): a kapu NEM zár ki, de a
 * `shadowWouldFail` flag mutatja, hogy éles módban kiesne.
 *
 * `true` (éles mód, Release D után): a kapu hard kizárásként működik,
 * az eligibility `false` és a `failureReason` kitöltött.
 */
export const BTTS_DEATHZONE_GATE_ACTIVE = false;

// ---------------------------------------------------------------------------
// Típusok
// ---------------------------------------------------------------------------

/**
 * The explicit state a candidate reaches in the core eligibility funnel.
 *
 * `BLOCKED` is the hard-veto terminal state: the candidate may not proceed to
 * canonicalisation, ranking, or card placement. `eligible` remains `false` and
 * `reason` is filled. The `RAW` / `CALIBRATED` etc. states are informational —
 * only `BLOCKED` changes the outcome.
 *
 * Policy A (see lastinfo.md §1–2): a statistically refuted evidence band
 * (`evidenceLevel === 'excluded'`) with sufficient own-sample is a hard veto.
 * Raw model probability cannot override it under any circumstances.
 */
export type CoreCandidateState =
  | 'RAW'
  | 'CALIBRATED'
  | 'EVIDENCE_ASSESSED'
  | 'RISK_ASSESSED'
  | 'VALUE_ASSESSED'
  | 'CORE_ELIGIBLE'
  | 'CORE_PUBLISHED'
  | 'BLOCKED'
  | 'RESEARCH_ONLY'
  | 'FLAGGED';

export interface BttsEligibilityResult {
  /** A sor átmehet-e a Core kapun. Shadow módban mindig `true`. */
  eligible: boolean;
  /**
   * Az explicit állapot. `BLOCKED` jelenti, hogy a sor nem proceeding — a
   * `reason` mező mondja meg, miért. Shadow módban a deathzone kapu nem
   * blokkol, csak `shadowWouldFail`-t állít.
   */
  state: CoreCandidateState;
  /**
   * Strukturált blokkolási ok. Csak `state === 'BLOCKED'` esetén kitöltött.
   * `'evidence_refuted'` — a sor saját sávja cáfolt (Policy A hard veto).
   * `'deathzone'` — a 40–55% halálzóna hard kapuja (éles módban).
   */
  reason: 'evidence_refuted' | 'deathzone' | null;
  /**
   * Olvasható, renderelhető részlet a trace panel számára. Csak `BLOCKED`
   * esetén kitöltött.
   */
  detail: string | null;
  /**
   * Az első megbukott kapu szöveges oka. Csak `eligible: false` esetén
   * kitöltött — éles módban; shadow módban `undefined`.
   */
  failureReason?: string;
  /**
   * `true`, ha a sor shadow módban is kiesne — azaz a kapu éles állapotban
   * `eligible: false`-t adna vissza. Trace és UI figyelmeztetés forrása.
   * Shadow módban lehet `true` a `eligible: true` mellett.
   */
  shadowWouldFail: boolean;
  /**
   * A kiesést okozó kapu neve, shadow módban is kitöltve, ha `shadowWouldFail`.
   * A trace panel ezt jeleníti meg "hipotetikus kiesés" ként.
   */
  shadowFailureReason?: string;
}

export interface BandRiskEvaluation {
  /**
   * `true` ha a sáv evidencia alapján kizárandó lenne (csak tájékoztató —
   * a hard kizárást az `isBttsEligibleForCore` kezeli).
   */
  isExcluded: boolean;
  /**
   * Pozitív: előre sorolás a rangsorban. Negatív: hátrasorolás.
   * A `getBttsRankingScore()` olvassa a `slip.ts`-ben.
   */
  priorityBonus: number;
  /** Olvasható indoklás, ha `isExcluded` vagy erős büntetés. */
  reason?: string;
}

// ---------------------------------------------------------------------------
// Kapu — eligibility
// ---------------------------------------------------------------------------

/**
 * A BTTS jelölt LEGKORÁBBAN futtatandó szűrője.
 *
 * Sorrendben:
 *   1. Abszolút minimum: modell < 40% → mindig kizárja (éles + shadow).
 *   2. Halálzóna: 40–55% sáv ÉS modell < 48% → kizárja, ha `BTTS_DEATHZONE_GATE_ACTIVE`.
 *
 * @param candidate - A vizsgált PatternHit-szerű objektum
 *   `modelProb`     — a piac saját modell-valószínűsége (0..1), null ha nincs
 *   `hitRate`       — a mért H2H BTTS arány (0..1), fallback ha nincs modelProb
 *   `band`          — a valószínűségi sáv szöveges neve, pl. '40–55%', '55–65%'
 *   `evidenceLevel` — az evidencia szintje (opcionális, tájékoztató)
 *
 * @returns `BttsEligibilityResult` — a sor jogosult-e, és shadow módban kiesne-e
 */
export function isBttsEligibleForCore(candidate: {
  modelProb?: number | null;
  hitRate: number;
  band?: string | null;
  evidenceLevel?: string | null;
}): BttsEligibilityResult {
  const modelProb = candidate.modelProb ?? 0;

  // --- Kapu 0: Evidence veto — Policy A hard veto (ALWAYS active) ----------
  // A statistically refuted own band (evidenceLevel === 'excluded') with
  // sufficient own-sample is a hard veto. Raw model probability cannot
  // override a refuted evidence band under any circumstances.
  // See lastinfo.md §1–2 for the rationale.
  if (candidate.evidenceLevel === 'excluded') {
    const detail =
      `Band statistically refuted (evidenceLevel=excluded). ` +
      `modelProb=${(modelProb * 100).toFixed(1)}% is not sufficient to override. ` +
      `Policy A in effect — see lastinfo.md §2.`;
    return {
      eligible: false,
      state: 'BLOCKED',
      reason: 'evidence_refuted',
      detail,
      failureReason: detail,
      shadowWouldFail: true,
      shadowFailureReason: detail,
    };
  }

  // --- Kapu 1: Abszolút minimum — modell < 40% ----------------------------
  // Ez a kapu a BTTS_DEATHZONE_GATE_ACTIVE flag értékétől FÜGGETLEN:
  // 40% alatt a sor semmilyen üzemmódban nem lehet Core-jogosult.
  if (modelProb < 0.40) {
    const reason = `Modell valószínűség < 40% (${(modelProb * 100).toFixed(1)}%) — alacsony BTTS esély`;
    if (!BTTS_DEATHZONE_GATE_ACTIVE) {
      // Shadow mód: átengedi, de jelzi, hogy éles módban kiesne
      return {
        eligible: true,
        state: 'RAW',
        reason: null,
        detail: null,
        shadowWouldFail: true,
        shadowFailureReason: reason,
      };
    }
    return {
      eligible: false,
      state: 'BLOCKED',
      reason: 'deathzone',
      detail: reason,
      failureReason: reason,
      shadowWouldFail: true,
      shadowFailureReason: reason,
    };
  }

  // --- Kapu 2: Halálzóna — 40–55% sáv + gyenge modell --------------------
  // Aktiválási flag mögé van téve: shadow módban csak jelzi, nem zárja ki.
  if (candidate.band === '40–55%' && modelProb < 0.48) {
    const reason =
      `40–55% halálzóna: modell valószínűség ${(modelProb * 100).toFixed(1)}% < 48% küszöb`;
    if (!BTTS_DEATHZONE_GATE_ACTIVE) {
      return {
        eligible: true,
        state: 'RAW',
        reason: null,
        detail: null,
        shadowWouldFail: true,
        shadowFailureReason: reason,
      };
    }
    return {
      eligible: false,
      state: 'BLOCKED',
      reason: 'deathzone',
      detail: reason,
      failureReason: reason,
      shadowWouldFail: true,
      shadowFailureReason: reason,
    };
  }

  // --- Átment minden kapun ---------------------------------------------------
  return {
    eligible: true,
    state: 'EVIDENCE_ASSESSED',
    reason: null,
    detail: null,
    shadowWouldFail: false,
  };
}

// ---------------------------------------------------------------------------
// Sávegészség értékelő — rangsorhoz
// ---------------------------------------------------------------------------

/**
 * A BTTS jelölt sávjának minőségi értékelése.
 *
 * Ez a függvény NEM ad hard kizárást — azt az `isBttsEligibleForCore` kezeli.
 * Kizárólag a `priorityBonus` értékét állítja be, amelyet a `slip.ts`-beli
 * `getBttsRankingScore()` olvas be a rangsoroláshoz.
 *
 * SÁV LOGIKA:
 *   55–65% (ARANYBÁNYA): modell ≥ 58% ÉS h2hRate ≥ 55% → +25 bónusz
 *   40–55% (HALÁLZÓNA):  modell < 48%                  → −50 büntetés
 *   20–40% (CÁFOLT):     modell < 35%                  → −100 büntetés
 *   Egyéb:               nincs korrekció                → 0
 *
 * @param band      - A valószínűségi sáv neve, pl. '55–65%'
 * @param modelProb - A modell-valószínűség (0..1)
 * @param h2hRate   - A mért H2H BTTS arány (0..1)
 */
export function evaluateBttsBandHealth(
  band: string,
  modelProb: number,
  h2hRate: number,
): BandRiskEvaluation {
  // 1. ARANYBÁNYA SÁV (55–65%): modell megerősíti → kiemelt bónusz
  if (band === '55–65%' || (modelProb >= 0.58 && h2hRate >= 0.55)) {
    return {
      isExcluded: false,
      priorityBonus: 25,
    };
  }

  // 2. HALÁLZÓNA SÁV (40–55%): gyenge modell → erős rangsor-büntetés
  if (band === '40–55%' && modelProb < 0.48) {
    return {
      isExcluded: true, // tájékoztató — a hard kizárást az eligibility kezeli
      priorityBonus: -50,
      reason: `Halálzóna: 40–55% sáv, modell valószínűség ${(modelProb * 100).toFixed(1)}% < 48%`,
    };
  }

  // 3. CÁFOLT MINIMÁLIS SÁV (20–40%): kritikusan alacsony modell
  if (band === '20–40%' || modelProb < 0.35) {
    return {
      isExcluded: true,
      priorityBonus: -100,
      reason: `Kritikusan alacsony modell valószínűség (${(modelProb * 100).toFixed(1)}%) — cáfolt BTTS`,
    };
  }

  return { isExcluded: false, priorityBonus: 0 };
}
