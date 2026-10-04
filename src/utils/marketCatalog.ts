import type {
  CoreCardMarkets,
  PatternHit,
  SlipMarketPreferences } from
'../types/winmix';

/**
 * A Top 3+3 szelvény választható piac-készlete.
 *
 * A katalógus a ténylegesen létező mintacsaládokból (`PatternType` + `code`)
 * származik, így nem lehet olyan piacot bejelölni, amire a pipeline nem termel
 * mintát. Minden bejegyzés SAJÁT predikátumot hoz: a `code` önmagában nem
 * egyértelmű (a `streak` család ugyanazokat a kódokat használja, mint a
 * `safety_trend` és a `goal_market`), ezért a típus is része az illesztésnek.
 */

/* ------------------------------------------------------------------ *
 * PHASE 0 — TYPED, CENTRAL MARKET REGISTRY
 *
 * Market codes used to be bare strings in every consumer (`PatternHit.code`,
 * the `SlipMarketPreferences` id arrays, the `marketReferenceProb()` switch).
 * Nothing stopped `HOME_O0.5`, `HOME_O05` and `HOME_OVER_05` from coexisting.
 * The families and the team-goal codes are therefore declared ONCE here, as
 * const, and every downstream union is derived from these declarations — a typo
 * is now a compile error, not a silently empty pattern list.
 *
 * The pre-existing codes (BTTS, O2.5, …) are unchanged and unmigrated; they are
 * merely declared with types too, so the new family does not live as an island.
 * ------------------------------------------------------------------ */

export const MARKET_FAMILIES = {
  goal: 'Gólpiac',
  teamGoal: 'Csapatgól piacok',
  trend: 'Biztonsági trend',
  half: 'Félidő és fordulat',
  other: 'Egyéb minták'
} as const;

export type MarketFamilyKey = keyof typeof MARKET_FAMILIES;

/** Render order of the families in the market pool editor. */
export const MARKET_FAMILY_LIST: ReadonlyArray<{key: MarketFamilyKey;label: string;}> = (
Object.keys(MARKET_FAMILIES) as MarketFamilyKey[]).
map((key) => ({ key, label: MARKET_FAMILIES[key] }));

/**
 * RELEASE A — the four team-goal markets, all marginals of the SAME joint score
 * matrix as 1X2 / BTTS / Over-Under. `HOME_O0.5` is "the home team scores at
 * least one goal" — a strictly WIDER set than BTTS, never a substitute for it.
 */
export const TEAM_GOAL_MARKETS = [
{
  code: 'HOME_O0.5',
  label: 'Hazai csapat gólt szerez',
  short: 'Hazai 0.5+',
  side: 'home',
  scores: true
},
{
  code: 'HOME_U0.5',
  label: 'Hazai csapat nem szerez gólt',
  short: 'Hazai 0.5−',
  side: 'home',
  scores: false
},
{
  code: 'AWAY_O0.5',
  label: 'Vendég csapat gólt szerez',
  short: 'Vendég 0.5+',
  side: 'away',
  scores: true
},
{
  code: 'AWAY_U0.5',
  label: 'Vendég csapat nem szerez gólt',
  short: 'Vendég 0.5−',
  side: 'away',
  scores: false
}] as
const;

export type TeamGoalMarketCode = (typeof TEAM_GOAL_MARKETS)[number]['code'];

const TEAM_GOAL_CODES = new Set<string>(TEAM_GOAL_MARKETS.map((m) => m.code));

export function isTeamGoalCode(code: string): code is TeamGoalMarketCode {
  return TEAM_GOAL_CODES.has(code);
}

/** The "scores at least one goal" code of a side. */
export function teamGoalCodeOf(side: 'home' | 'away'): TeamGoalMarketCode {
  return side === 'home' ? 'HOME_O0.5' : 'AWAY_O0.5';
}

/**
 * RELEASE C — markets registered for market-specific, out-of-sample
 * calibration. The rule is deliberate and absolute: A MARKET THAT CAN BE
 * SELECTED IS A MARKET THAT MUST BE MEASURED. All four team-goal codes are
 * Joker-selectable from the first release, so all four are registered — the
 * Under lines are NOT the mirror image of the Over lines in probability-band
 * space (a 0.72 Over sits in `p65_75`, its 0.28 Under complement in `p20_40`),
 * so each earns its own bands, its own sample and its own diagnosis.
 */
export const EVALUATED_MARKET_CODES = [
'BTTS',
'O2.5',
'HOME_O0.5',
'HOME_U0.5',
'AWAY_O0.5',
'AWAY_U0.5'] as
const;

export type EvaluatedMarketCode = (typeof EVALUATED_MARKET_CODES)[number];

const EVALUATED_CODES = new Set<string>(EVALUATED_MARKET_CODES);

export function isEvaluatedMarketCode(code: string): code is EvaluatedMarketCode {
  return EVALUATED_CODES.has(code);
}

/** The dynamic "weaker side scores" filter label — not a market of its own. */
export const UNDERDOG_GOAL_MARKET_ID = 'teamGoal:UNDERDOG';

export interface MarketOption {
  /** Stabil azonosító — ez kerül a mentett beállításba. */
  id: string;
  /** Teljes, emberi címke (kártyafejléc). */
  label: string;
  /** Rövid chip-felirat. */
  short: string;
  family: MarketFamilyKey;
  /**
   * True, ha a piac ritkán jut át a kalibrációs kapun, tehát core slotra
   * választva jellemzően „kapun kívüli” kitöltést eredményez.
   */
  coreRisk?: boolean;
  match: (pattern: PatternHit) => boolean;
}

function goal(code: string, label: string, short: string): MarketOption {
  return {
    id: `goal:${code}`,
    label,
    short,
    family: 'goal',
    match: (p) => p.type === 'goal_market' && p.code === code
  };
}

/**
 * RELEASE B — a team-goal option.
 *
 * The candidates keep `type: 'goal_market'`, so they inherit the stricter
 * secondary-market quadrant and the `effectiveDecisionOf` routing for free; no
 * looser rule bed is created for them. `coreRisk` is on for the whole family
 * until Release C's market-specific calibration confirms a league and a market.
 */
function teamGoal(code: TeamGoalMarketCode, label: string, short: string): MarketOption {
  return {
    id: `teamGoal:${code}`,
    label,
    short,
    family: 'teamGoal',
    coreRisk: true,
    match: (p) => p.type === 'goal_market' && p.code === code
  };
}

function trend(code: string, label: string): MarketOption {
  return {
    id: `trend:${code}`,
    label,
    short: code,
    family: 'trend',
    match: (p) => p.type === 'safety_trend' && p.code === code
  };
}

export const MARKET_OPTIONS: MarketOption[] = [
goal('BTTS', 'Mindkét csapat szerez gólt', 'BTTS'),
goal('NOBTTS', 'Nem szerez gólt mindkét csapat', 'Nincs BTTS'),
goal('O1.5', '1,5 gól felett', 'Over 1.5'),
goal('U1.5', '1,5 gól alatt', 'Under 1.5'),
goal('O2.5', '2,5 gól felett', 'Over 2.5'),
goal('U2.5', '2,5 gól alatt', 'Under 2.5'),
goal('O3.5', '3,5 gól felett', 'Over 3.5'),
goal('U3.5', '3,5 gól alatt', 'Under 3.5'),

...TEAM_GOAL_MARKETS.map((m) => teamGoal(m.code, m.label, m.short)),

trend('1', 'Hazai győzelem'),
trend('2', 'Vendég győzelem'),
trend('1X', 'Hazai vagy döntetlen'),
trend('X2', 'Vendég vagy döntetlen'),
trend('12', 'Nincs döntetlen'),

{
  id: 'half:HT:1',
  label: 'Félidei hazai vezetés',
  short: 'HT:1',
  family: 'half',
  match: (p) => p.type === 'ht_market' && p.code === 'HT:1'
},
{
  id: 'half:HT:X',
  label: 'Félidei döntetlen',
  short: 'HT:X',
  family: 'half',
  match: (p) => p.type === 'ht_market' && p.code === 'HT:X'
},
{
  id: 'half:HT:2',
  label: 'Félidei vendég vezetés',
  short: 'HT:2',
  family: 'half',
  match: (p) => p.type === 'ht_market' && p.code === 'HT:2'
},
{
  id: 'half:HTFT:REV',
  label: 'HT/FT fordulat',
  short: 'Fordulat',
  family: 'half',
  match: (p) => p.type === 'htft_reversal' && p.code === 'HTFT:REV'
},
{
  id: 'half:HTFT:NOREV',
  label: 'Fordulat nélküli menet',
  short: 'Nincs fordulat',
  family: 'half',
  match: (p) => p.type === 'htft_reversal' && p.code === 'HTFT:NOREV'
},

{
  id: 'other:exact_score',
  label: 'Pontos eredmény',
  short: 'Pontos eredmény',
  family: 'other',
  coreRisk: true,
  match: (p) => p.type === 'exact_score'
},
{
  id: 'other:streak',
  label: 'Sorozat (5-ből-5)',
  short: 'Sorozat',
  family: 'other',
  match: (p) => p.type === 'streak'
},
{
  id: 'other:model_agreement',
  label: 'Modell-egyetértés',
  short: 'Modell-egyetértés',
  family: 'other',
  coreRisk: true,
  match: (p) => p.type === 'model_agreement'
},

/**
 * RELEASE B — "the weaker team scores". NOT a separate pattern and NOT a
 * second probability: a DYNAMIC FILTER over the team-goal lines that already
 * exist. It matches only the line whose code is the underdog side's own
 * team-goal market, and matches nothing at all when the weight gap is below
 * `UNDERDOG_MIN_WEIGHT_GAP` (no underdog ⇒ no annotation on the pattern).
 *
 * Declared LAST so `marketOfPattern()` / `marketLabelOf()` still resolve a
 * team-goal line to its own plain label.
 */
{
  id: UNDERDOG_GOAL_MARKET_ID,
  label: 'Gyengébb csapat gólt szerez',
  short: 'Underdog gól',
  family: 'teamGoal',
  coreRisk: true,
  match: (p) =>
  p.type === 'goal_market' &&
  isTeamGoalCode(p.code) &&
  Boolean(p.underdogMarketCode) &&
  p.underdogMarketCode === p.code
}];


export const MARKET_BY_ID: Record<string, MarketOption> = MARKET_OPTIONS.reduce<
  Record<string, MarketOption>>(
  (acc, option) => {
    acc[option.id] = option;
    return acc;
  }, {});

export const MARKET_IDS: string[] = MARKET_OPTIONS.map((o) => o.id);

export function marketsOfFamily(family: MarketFamilyKey): MarketOption[] {
  return MARKET_OPTIONS.filter((o) => o.family === family);
}

/** A core kártyák száma — a szelvény felállása fix 3+3. */
export const CORE_CARD_COUNT = 3;

/**
 * Kártyánkénti alapértelmezés. Core 01 a legstabilabb gólpiacokra és dupla
 * esélyre épül, Core 02 a szélesebb gólsávokra és sorozat-mintákra, Core 03 a
 * zárt, alacsony gólszámú menetekre. A joker oldal minden piacot pályáztat —
 * onnan a lazább kapu válogat.
 */
export function defaultCoreCards(): CoreCardMarkets {
  return [
  ['goal:BTTS', 'goal:O2.5', 'trend:X2'],
  ['goal:O1.5', 'goal:U3.5', 'trend:1X', 'other:streak', 'other:model_agreement'],
  ['goal:NOBTTS', 'goal:U2.5', 'trend:12', 'half:HTFT:NOREV']];

}

export function emptyCoreCards(): CoreCardMarkets {
  return [[], [], []];
}

export function defaultSlipMarkets(): SlipMarketPreferences {
  return {
    coreCards: defaultCoreCards(),
    joker: [...MARKET_IDS]
  };
}

function sanitizeSide(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const cleaned: string[] = [];
  value.forEach((entry) => {
    if (typeof entry !== 'string' || !MARKET_BY_ID[entry] || seen.has(entry)) return;
    seen.add(entry);
    cleaned.push(entry);
  });
  return cleaned;
}

/**
 * Régi vagy sérült pillanatképből érkező készlet visszavezetése: ismeretlen
 * azonosító eldobva. A szándékosan üres (nem konfigurált) kártya megmarad
 * üresen — a szelvényen ez üres slotként jelenik meg.
 *
 * A régi, egyetlen közös core készletet használó pillanatképek úgy vezetődnek
 * vissza, hogy mindhárom core kártya azt a készletet kapja meg.
 */
export function sanitizeSlipMarkets(value: unknown): SlipMarketPreferences {
  const defaults = defaultSlipMarkets();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults;
  const raw = value as Partial<SlipMarketPreferences> & {core?: unknown;};

  const joker = Array.isArray(raw.joker) ? sanitizeSide(raw.joker) : defaults.joker;

  if (Array.isArray(raw.coreCards)) {
    const cards = Array.from({ length: CORE_CARD_COUNT }, (_, i) =>
    sanitizeSide((raw.coreCards as unknown[])[i])
    ) as CoreCardMarkets;
    return { coreCards: cards, joker };
  }

  if (Array.isArray(raw.core)) {
    const legacy = sanitizeSide(raw.core);
    const pool = legacy.length > 0 ? legacy : defaults.coreCards[0];
    return { coreCards: [[...pool], [...pool], [...pool]], joker };
  }

  return { coreCards: defaults.coreCards, joker };
}

/** Egy adott core kártya készlete, index szerint. */
export function coreCardMarkets(prefs: SlipMarketPreferences, index: number): string[] {
  return prefs.coreCards[index] ?? [];
}

/** Minden bejelölt piac (core kártyák + joker), duplikáció nélkül. */
export function allSelectedMarkets(prefs: SlipMarketPreferences): string[] {
  return Array.from(new Set([...prefs.coreCards.flat(), ...prefs.joker]));
}

export function sameMarkets(a: SlipMarketPreferences, b: SlipMarketPreferences): boolean {
  const eq = (x: string[], y: string[]) =>
  x.length === y.length && x.every((id) => y.includes(id));
  return (
    a.coreCards.every((card, i) => eq(card, b.coreCards[i] ?? [])) && eq(a.joker, b.joker));

}

/** Illeszkedik a minta a megadott piac-készlet bármelyik tagjára? */
export function matchesMarkets(pattern: PatternHit, ids: string[]): boolean {
  return ids.some((id) => MARKET_BY_ID[id]?.match(pattern) ?? false);
}

export function marketOfPattern(pattern: PatternHit): MarketOption | null {
  return MARKET_OPTIONS.find((o) => o.match(pattern)) ?? null;
}

/** A kártyafejlécen megjelenő piac-címke, ismeretlen minta esetén a saját címkéje. */
export function marketLabelOf(pattern: PatternHit): string {
  return marketOfPattern(pattern)?.label ?? pattern.label;
}

/** Rövid, felsorolás-szerű összefoglaló a készletről. */
export function summarizeMarkets(ids: string[], limit = 4): string {
  const shorts = ids.map((id) => MARKET_BY_ID[id]?.short).filter((s): s is string => Boolean(s));
  if (shorts.length === 0) return 'Nincs kiválasztott piac';
  if (shorts.length <= limit) return shorts.join(' · ');
  return `${shorts.slice(0, limit).join(' · ')} +${shorts.length - limit}`;
}