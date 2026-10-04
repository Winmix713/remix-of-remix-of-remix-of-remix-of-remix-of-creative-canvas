/**
 * PHASE 0 — QUICK CORE STRATEGY.
 *
 * WHY THIS EXISTS. Before a virtual round the operator has minutes, not
 * patience: configuring three independent Core cards market-by-market on every
 * single round is the wrong default. One click now selects the whole Core side,
 * and the card-by-card editor survives untouched behind `custom`.
 *
 * WHAT A STRATEGY IS ALLOWED TO DO. It narrows WHICH market codes may reach a
 * Core slot and whether the blowout profile filter is consulted. It does NOT
 * loosen anything: the strict Core calibration gate is unchanged, the relaxed
 * fallback is FORBIDDEN in every quick strategy, one fixture still occupies at
 * most one line, and a slot with no qualifying candidate stays EMPTY.
 *
 * An empty third Core card is a valid — and more honest — output than a weak or
 * profile-conflicted BTTS recommendation.
 */

import type {
  BttsVetoMode,
  CoreStrategySettings,
  QuickCoreStrategy,
  SpecNullReason } from
'../types/winmix';

export interface QuickStrategySpec {
  id: QuickCoreStrategy;
  label: string;
  /** Short form for chips and slot captions. */
  short: string;
  description: string;
  /**
   * The EXACT pattern codes allowed onto a Core slot. An empty list means the
   * strategy does not drive Core selection at all (`custom`).
   */
  codes: string[];
  /** Core slots the strategy may fill. Never more than the three that exist. */
  slots: number;
  /** Always false: a quick strategy never inserts a gate-relaxed line. */
  allowRelaxed: false;
  /** Does this strategy consult the BTTS clean-sheet blowout profile filter? */
  profileVeto: boolean;
}

export const QUICK_STRATEGY: Record<QuickCoreStrategy, QuickStrategySpec> = {
  btts_profile_safe: {
    id: 'btts_profile_safe',
    label: 'Top 3 BTTS Igen — Profil-biztos',
    short: 'BTTS · profil-biztos',
    description:
    'Csak BTTS jelöltek, csak a szigorú core kapun belül, tartalék nélkül — ' +
    'majd az egyoldalú, nagy gólszámú kapott-nullás profilú párok kiszűrése. ' +
    'Legfeljebb három sor, mindegyik más mérkőzésről; ami nem áll össze, üresen marad.',
    codes: ['BTTS'],
    slots: 3,
    allowRelaxed: false,
    profileVeto: true
  },
  btts_raw_h2h: {
    id: 'btts_raw_h2h',
    label: 'Top 3 BTTS Igen — nyers H2H (bázis)',
    short: 'BTTS · bázis',
    description:
    'A kontroll ág: ugyanaz a szigorú core kapu és ugyanaz a rangsor, de a ' +
    'kiütés-profil szűrő NÉLKÜL. Ez a „A” baseline, amivel a profil-biztos ' +
    'változat összemérhető.',
    codes: ['BTTS'],
    slots: 3,
    allowRelaxed: false,
    profileVeto: false
  },
  over25: {
    id: 'over25',
    label: 'Top 3 Over 2.5',
    short: 'O2.5',
    description:
    'Csak Over 2.5 jelöltek, a szigorú core kapun belül, tartalék nélkül.',
    codes: ['O2.5'],
    slots: 3,
    allowRelaxed: false,
    profileVeto: false
  },
  safety_trend: {
    id: 'safety_trend',
    label: 'Top 3 biztonsági trend',
    short: '1X · X2 · 12',
    description:
    'Kimenet-trend jelöltek (1, 2, 1X, X2, 12) a szigorú core kapun belül, ' +
    'tartalék nélkül.',
    codes: ['1', '2', '1X', 'X2', '12'],
    slots: 3,
    allowRelaxed: false,
    profileVeto: false
  },
  custom_btts: {
    id: 'custom_btts',
    label: 'Saját',
    short: 'Saját · BTTS > 50%',
    description:
    'Csak BTTS Igen 50% felett. BTTS százalék szerint rangsorolva. Semmilyen ' +
    'minőségi kapu nem fut le.',
    codes: ['BTTS'],
    slots: 6,
    allowRelaxed: false,
    profileVeto: false
  },
  custom: {
    id: 'custom',
    label: 'Haladó — egyedi piac-készlet',
    short: 'egyedi',
    description:
    'A kártyánkénti piac-készlet szerkesztő. A core slotokat a saját ' +
    'készletük tölti fel, a megszokott tartalék-szabállyal.',
    codes: [],
    slots: 3,
    allowRelaxed: false,
    profileVeto: false
  }
};

/** Selector order. `custom` is last: it is the escape hatch, not the default. */
export const QUICK_STRATEGY_LIST: QuickStrategySpec[] = [
QUICK_STRATEGY.btts_profile_safe,
QUICK_STRATEGY.btts_raw_h2h,
QUICK_STRATEGY.over25,
QUICK_STRATEGY.safety_trend,
QUICK_STRATEGY.custom_btts,
QUICK_STRATEGY.custom];


export const VETO_MODE_COPY: Record<BttsVetoMode, {label: string;detail: string;}> = {
  shadow: {
    label: 'Árnyék',
    detail:
    'A kiütés-szűrő mindent kiszámol és megjelenít, de NEM vesz le sort a ' +
    'szelvényről. Ez az alapérték, amíg egy előre deklarált, minta-elemen ' +
    'kívüli mérés nem igazolja a szűrő előnyét.'
  },
  active: {
    label: 'Éles',
    detail:
    'A megjelölt jelöltek tényleg kiesnek a core slotokból. Csak akkor ' +
    'használd, ha össze akarod hasonlítani a kimenetet a bázissal — a ' +
    'szűrőnek ezen a build-en még nincs visszamért előnye.'
  }
};

export function defaultCoreStrategy(): CoreStrategySettings {
  return {
    mode: 'quick',
    quickStrategy: 'btts_profile_safe',
    // PHASE 4 — the veto starts as a hypothesis, not as a rule.
    vetoMode: 'shadow'
  };
}

/** Unknown or corrupted snapshots fall back to the default, never to a guess. */
export function sanitizeCoreStrategy(value: unknown): CoreStrategySettings {
  const defaults = defaultCoreStrategy();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults;
  const raw = value as Partial<CoreStrategySettings>;

  const quickStrategy =
  typeof raw.quickStrategy === 'string' && raw.quickStrategy in QUICK_STRATEGY ?
  raw.quickStrategy as QuickCoreStrategy :
  defaults.quickStrategy;
  const mode = raw.mode === 'custom' ? 'custom' : 'quick';
  const vetoMode: BttsVetoMode = raw.vetoMode === 'active' ? 'active' : 'shadow';

  // A `custom` strategy id and `quick` mode contradict each other; the id wins.
  return {
    mode: quickStrategy === 'custom' ? 'custom' : mode,
    quickStrategy,
    vetoMode
  };
}

/**
 * „Saját” (custom_btts) — a mód, amely SEMMILYEN core kaput nem használ.
 *
 * A szelvényépítő ezt a módot a legelső lépésben lekezeli, ezért a
 * `coreStrategySpecOf` szándékosan `null`-t ad rá: így egyetlen kapu-, kalibrációs
 * vagy evidencia-számító útvonal sem indul el.
 */
export const CUSTOM_BTTS_MIN_RATE = 0.5;

export function isCustomBttsStrategy(
settings: CoreStrategySettings | null | undefined)
: boolean {
  return settings?.quickStrategy === 'custom_btts';
}

/** The spec that actually drives Core selection, or null in custom mode. */
export function coreStrategySpecOf(
settings: CoreStrategySettings | null | undefined)
: QuickStrategySpec | null {
  if (!settings || settings.mode !== 'quick') return null;
  if (isCustomBttsStrategy(settings)) return null;
  const spec = QUICK_STRATEGY[settings.quickStrategy];
  return spec && spec.codes.length > 0 ? spec : null;
}

/**
 * BUG-1101/BUG-1402 — the exact reason a quick strategy's spec is null, so the
 * slip builder can fail closed with a traceable cause instead of silently
 * falling back to `pooledSlots`.
 */
export function specNullReasonOf(
settings: CoreStrategySettings | null | undefined)
: SpecNullReason {
  if (!settings) return 'no_settings';
  if (settings.mode === 'custom' || settings.quickStrategy === 'custom') return 'custom_mode';
  const spec = QUICK_STRATEGY[settings.quickStrategy];
  if (!spec || spec.codes.length === 0) return 'empty_codes';
  return null;
}