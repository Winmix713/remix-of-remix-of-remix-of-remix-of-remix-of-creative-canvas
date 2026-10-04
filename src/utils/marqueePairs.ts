import { detectStorageBackend, storageAdapter } from './storage';
import type {
  BttsBlowoutRiskAssessment,
  H2HGoalProfile,
  League,
  MarqueeRiskLevel,
  MarqueeRiskVerdict } from
'../types/winmix';

/* -------------------------------------------------------------------------- *
 * RANGADÓ (BÜNTETŐPONT) — kiemelt párosítások BTTS rangsor-korrekciója
 *
 * ALAPELV: a rangadó-címke ÖNMAGÁBAN nem büntet. A címke csak annyit mond,
 * hogy ezt az irányított párosítást külön meg kell vizsgálni. Levonás
 * kizárólag akkor keletkezik, ha a párosítás SAJÁT, feltöltött H2H adata
 * mutat visszatérő BTTS Nem / alacsony gólos / egyoldalú tisztalapos mintát.
 *
 * A modul nem duplikál kiütés-számítást: a meglévő `H2HGoalProfile`
 * (recency-súlyozott, zsugorított értékek) és a `BttsBlowoutRiskAssessment`
 * árnyék-diagnosztika értékeit olvassa.
 *
 * HATÁS: kizárólag RANGSOR. Nem keletkezik új hard gate, egyetlen mért érték
 * sem változik, és a jelölt Core-jogosult marad.
 * -------------------------------------------------------------------------- */

/** SHADOW MÓD: OFF állapotban a rangsor nem mozdul, csak a levezetés látszik. */
export const MARQUEE_RANKING_ACTIVE = false;

/** Ennyi effektív mintaméret alatt SOHA nincs korrekció. */
export const MARQUEE_MIN_ESS = 4;

/** Stabil, jól alátámasztott BTTS profilt evidencia nélkül nem írunk felül. */
const MARQUEE_STABLE_BTTS_RATE = 0.6;
const MARQUEE_STABLE_ESS = 8;

/** Szintenkénti rangsor-levonás, százalékpontban a rangsor-hitRate skálán. */
export const MARQUEE_PENALTY: Record<MarqueeRiskLevel, number> = {
  none: 0,
  low: 4,
  medium: 8,
  high: 14
};

const REGISTRY_KEY = 'winmix::marquee-pairs::v1';
const STORE_KEY = 'winmix::marquee-pairs::v2';

export type MarqueeRegistry = Partial<Record<League, string[]>>;

/** Egy nyilvántartott kör — a forduló neve és létrehozási ideje azonosít. */
export interface MarqueeRoundMeta {
  id: string;
  name: string;
  createdAt: string;
}

/**
 * KÖRÖNKÉNTI NYILVÁNTARTÁS — a jelölések körhöz kötve maradnak meg, így a
 * rangadó-tábla a múlt körök jelöléseit is mutatja. Az elemzés továbbra is
 * kizárólag az AKTUÁLIS kör kulcsait használja, tehát a rangsor-viselkedés
 * bitre azonos a korábbival, amíg csak egy kör létezik.
 */
export interface MarqueeStore {
  rounds: MarqueeRoundMeta[];
  currentRoundId: string | null;
  byRound: Record<string, MarqueeRegistry>;
}

/** Irányított kulcs — a feltöltött adat kanonikus csapatkulcsaiból. */
export function marqueeKeyOf(homeKey: string, awayKey: string): string {
  return `${homeKey}___${awayKey}`;
}

/** Stabil kör-azonosító: a név és a létrehozási idő együtt azonosít. */
export function marqueeRoundId(round: {name: string;createdAt: string;}): string {
  return `${round.createdAt}::${round.name}`;
}

function parseRegistry(value: unknown): MarqueeRegistry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: MarqueeRegistry = {};
  Object.entries(value as Record<string, unknown>).forEach(([league, keys]) => {
    if (Array.isArray(keys)) {
      out[league as League] = keys.filter((v): v is string => typeof v === 'string');
    }
  });
  return out;
}

function emptyStore(): MarqueeStore {
  return { rounds: [], currentRoundId: null, byRound: {} };
}

function readLegacyRegistry(): MarqueeRegistry {
  try {
    const raw = storageAdapter.get(detectStorageBackend(), REGISTRY_KEY);
    if (!raw) return {};
    return parseRegistry(JSON.parse(raw));
  } catch {
    return {};
  }
}

/** Teljes, körönkénti nyilvántartás — v1 adat esetén egyszeri migrációval. */
export function loadMarqueeStore(): MarqueeStore {
  try {
    const raw = storageAdapter.get(detectStorageBackend(), STORE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>;
        const rounds = Array.isArray(obj.rounds) ?
        (obj.rounds as unknown[]).
        filter(
          (r): r is MarqueeRoundMeta =>
          !!r && typeof r === 'object' && typeof (r as MarqueeRoundMeta).id === 'string'
        ).
        map((r) => ({
          id: r.id,
          name: typeof r.name === 'string' ? r.name : r.id,
          createdAt: typeof r.createdAt === 'string' ? r.createdAt : ''
        })) :
        [];
        const byRound: Record<string, MarqueeRegistry> = {};
        Object.entries((obj.byRound as Record<string, unknown>) ?? {}).forEach(([id, reg]) => {
          byRound[id] = parseRegistry(reg);
        });
        return {
          rounds,
          currentRoundId:
          typeof obj.currentRoundId === 'string' ? obj.currentRoundId : rounds[rounds.length - 1]?.id ?? null,
          byRound
        };
      }
    }
  } catch {
    /* Sérült tároló esetén tiszta lappal indulunk, adatvesztés nélkül. */
  }

  /* Migráció: a v1 lapos regiszter egyetlen „korábbi jelölések" körré válik. */
  const legacy = readLegacyRegistry();
  if (Object.values(legacy).some((keys) => (keys ?? []).length > 0)) {
    const meta: MarqueeRoundMeta = {
      id: 'legacy',
      name: 'Korábbi jelölések',
      createdAt: new Date(0).toISOString()
    };
    const store: MarqueeStore = {
      rounds: [meta],
      currentRoundId: meta.id,
      byRound: { [meta.id]: legacy }
    };
    saveMarqueeStore(store);
    return store;
  }

  return emptyStore();
}

function saveMarqueeStore(store: MarqueeStore): void {
  try {
    storageAdapter.set(detectStorageBackend(), STORE_KEY, JSON.stringify(store));
  } catch {
    /* A perzisztencia hiánya nem törheti meg a felületet. */
  }
}

/** A kör felvétele (ha új) és aktuálissá tétele — idempotens. */
export function ensureMarqueeRound(round: {name: string;createdAt: string;}): MarqueeStore {
  const store = loadMarqueeStore();
  const id = marqueeRoundId(round);
  const known = store.rounds.some((r) => r.id === id);
  if (known && store.currentRoundId === id) return store;
  const next: MarqueeStore = {
    rounds: known ? store.rounds : [...store.rounds, { id, name: round.name, createdAt: round.createdAt }],
    currentRoundId: id,
    byRound: { ...store.byRound, [id]: store.byRound[id] ?? {} }
  };
  saveMarqueeStore(next);
  return next;
}

/** Egy adott kör (alapértelmezetten az aktuális) lapos regisztere. */
export function marqueeRoundRegistry(store: MarqueeStore, roundId?: string | null): MarqueeRegistry {
  const id = roundId ?? store.currentRoundId;
  return id ? store.byRound[id] ?? {} : {};
}

/** Vissza-kompatibilis nézet: az AKTUÁLIS kör lapos regisztere. */
export function loadMarqueeRegistry(): MarqueeRegistry {
  return marqueeRoundRegistry(loadMarqueeStore());
}

export function isMarqueePair(
registry: MarqueeRegistry,
league: League,
homeKey: string,
awayKey: string)
: boolean {
  return (registry[league] ?? []).includes(marqueeKeyOf(homeKey, awayKey));
}

/** ON/OFF kapcsoló — irányonként és KÖRÖNKÉNT tárol. */
export function setMarqueePair(
league: League,
homeKey: string,
awayKey: string,
on: boolean,
roundId?: string | null)
: MarqueeRegistry {
  const store = loadMarqueeStore();
  let id = roundId ?? store.currentRoundId;
  let rounds = store.rounds;
  if (!id) {
    /* Nyilvántartott kör nélkül is működnie kell: alapértelmezett kör nyílik. */
    const meta: MarqueeRoundMeta = {
      id: 'default',
      name: 'Aktuális kör',
      createdAt: new Date().toISOString()
    };
    id = meta.id;
    rounds = [...rounds, meta];
  }
  const registry = store.byRound[id] ?? {};
  const key = marqueeKeyOf(homeKey, awayKey);
  const current = new Set(registry[league] ?? []);
  if (on) current.add(key);else current.delete(key);
  const nextRegistry: MarqueeRegistry = { ...registry, [league]: [...current].sort() };
  saveMarqueeStore({
    rounds,
    currentRoundId: id,
    byRound: { ...store.byRound, [id]: nextRegistry }
  });
  return nextRegistry;
}

/** Egy liga összes megjelölt irányított kulcsa, gyors kereséshez. */
export function marqueeKeySet(registry: MarqueeRegistry, league: League): ReadonlySet<string> {
  return new Set(registry[league] ?? []);
}

/** Egy kör minden ligájának kulcsai egy halmazban. */
export function allMarqueeKeysOfRound(store: MarqueeStore, roundId?: string | null): ReadonlySet<string> {
  const registry = marqueeRoundRegistry(store, roundId);
  return new Set(Object.values(registry).flatMap((keys) => keys ?? []));
}

/** Egy sor a rangadó-táblában — körökön átívelő, lapos nézet. */
export interface MarqueeHistoryRow {
  roundId: string;
  roundName: string;
  createdAt: string;
  isCurrentRound: boolean;
  league: League;
  homeKey: string;
  awayKey: string;
}

/**
 * A tábla forrása: MINDEN nyilvántartott kör jelölései, a legfrissebb körrel
 * elöl. Az aktuális kör sorai külön jelölve, hogy a múlt körök adata soha ne
 * keveredjen össze az élő jelöléssel.
 */
export function marqueeHistoryRows(
store: MarqueeStore,
league?: League | null)
: MarqueeHistoryRow[] {
  const ordered = [...store.rounds].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const rows: MarqueeHistoryRow[] = [];
  ordered.forEach((meta) => {
    const registry = store.byRound[meta.id] ?? {};
    Object.entries(registry).forEach(([lg, keys]) => {
      if (league && lg !== league) return;
      (keys ?? []).forEach((key) => {
        const [homeKey, awayKey] = key.split('___');
        if (!homeKey || !awayKey) return;
        rows.push({
          roundId: meta.id,
          roundName: meta.name,
          createdAt: meta.createdAt,
          isCurrentRound: meta.id === store.currentRoundId,
          league: lg as League,
          homeKey,
          awayKey
        });
      });
    });
  });
  return rows;
}


export interface AssessMarqueeParams {
  registered: boolean;
  profile?: H2HGoalProfile | null;
  risk?: BttsBlowoutRiskAssessment | null;
  /** Csak KONTEXTUS: súlykülönbség önmagában soha nem indok. */
  weightDiff?: number | null;
}

function rate(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function pct(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(0)}%`;
}

/**
 * A kockázati szint levezetése. Minden indoklás számmal alátámasztott, és
 * minden bemenet meglévő, máshol is látható mért érték.
 */
export function assessMarqueeRisk({
  registered,
  profile,
  risk,
  weightDiff
}: AssessMarqueeParams): MarqueeRiskVerdict {
  const shrunkBtts = rate(profile?.shrunkBttsRate);
  const noBtts = shrunkBtts === null ? null : 1 - shrunkBtts;
  const highGoalNoBtts = rate(profile?.shrunkHighGoalNoBttsRate);
  /* Alacsony gólos BTTS Nem = az összes BTTS Nem mínusz a magas gólos ága —
   * ugyanazokból a már kiszámolt, zsugorított értékekből, új számítás nélkül. */
  const lowGoalNoBtts =
  noBtts === null ? null : Math.max(0, noBtts - (highGoalNoBtts ?? 0));
  const cleanSheetBlowout = rate(profile?.shrunkCleanSheetBlowoutRate);
  const ess = profile?.effectiveSampleSize ?? 0;
  const directSampleSize = profile?.directSampleSize ?? 0;

  const base: MarqueeRiskVerdict = {
    registered,
    level: 'none',
    penalty: 0,
    applied: false,
    reasons: [],
    directSampleSize,
    effectiveSampleSize: ess,
    noBttsRate: noBtts,
    lowGoalNoBttsRate: lowGoalNoBtts,
    cleanSheetBlowoutRate: cleanSheetBlowout,
    blowoutScores: profile?.blowoutScores ?? [],
    weightDiff: rate(weightDiff),
    profile: risk?.profile ?? null
  };

  if (!registered) return base;

  if (!profile || ess < MARQUEE_MIN_ESS) {
    return {
      ...base,
      reasons: [
      `Nincs korrekció: az effektív minta ${ess.toFixed(2)} < ${MARQUEE_MIN_ESS} ` +
      `(${directSampleSize} közvetlen találkozó) — a címke önmagában nem büntet.`]

    };
  }

  if (shrunkBtts !== null && shrunkBtts >= MARQUEE_STABLE_BTTS_RATE && ess >= MARQUEE_STABLE_ESS) {
    return {
      ...base,
      reasons: [
      `Nincs korrekció: stabil, jól alátámasztott BTTS profil (zsugorított BTTS ` +
      `${pct(shrunkBtts)}, ESS ${ess.toFixed(2)}) — evidencia nélkül nem írjuk felül.`]

    };
  }

  let points = 0;
  const reasons: string[] = [];

  if (noBtts !== null && noBtts >= 0.7) {
    points += 2;
    reasons.push(`Visszatérő BTTS Nem: zsugorított arány ${pct(noBtts)} (≥ 70%).`);
  } else if (noBtts !== null && noBtts >= 0.55) {
    points += 1;
    reasons.push(`Emelkedett BTTS Nem: zsugorított arány ${pct(noBtts)} (≥ 55%).`);
  }

  if (lowGoalNoBtts !== null && lowGoalNoBtts >= 0.35) {
    points += 1;
    reasons.push(
      `Alacsony gólos BTTS Nem minta: ${pct(lowGoalNoBtts)} (0-0 / 1-0 / 0-1 / 2-0 / 0-2 jellegű).`
    );
  }

  if (cleanSheetBlowout !== null && cleanSheetBlowout >= 0.45) {
    points += 2;
    reasons.push(
      `Egyoldalú tisztalapos kiütés: ${pct(cleanSheetBlowout)} (≥ 45%)` +
      (base.blowoutScores.length > 0 ? ` — ${base.blowoutScores.slice(0, 3).join(', ')}.` : '.')
    );
  } else if (cleanSheetBlowout !== null && cleanSheetBlowout >= 0.3) {
    points += 1;
    reasons.push(
      `Tisztalapos kiütés-hajlam: ${pct(cleanSheetBlowout)} (≥ 30%)` +
      (base.blowoutScores.length > 0 ? ` — ${base.blowoutScores.slice(0, 3).join(', ')}.` : '.')
    );
  }

  if (risk?.wouldVeto) {
    points += 1;
    reasons.push(
      `A meglévő kiütés-profil is jelez (${risk.profile}): ${risk.vetoReasons[0] ?? 'árnyék jelzés'}`
    );
  }

  const level: MarqueeRiskLevel =
  points >= 4 ? 'high' : points >= 2 ? 'medium' : points >= 1 ? 'low' : 'none';

  if (level === 'none') {
    reasons.push(
      'Nincs korrekció: a párosítás saját H2H adata nem mutat visszatérő ' +
      'BTTS Nem / alacsony gólos / egyoldalú mintát.'
    );
  } else if (base.weightDiff !== null) {
    reasons.push(
      `Kontextus (nem indok): súlykülönbség ${base.weightDiff.toFixed(2)}.`
    );
  }

  const penalty = MARQUEE_PENALTY[level];
  return {
    ...base,
    level,
    penalty,
    applied: MARQUEE_RANKING_ACTIVE && penalty > 0,
    reasons
  };
}

export const MARQUEE_LEVEL_LABEL: Record<MarqueeRiskLevel, string> = {
  none: 'Nincs',
  low: 'Alacsony',
  medium: 'Közepes',
  high: 'Magas'
};

/** Egysoros mikro-szöveg a kapcsoló mellé és a jelölt kártyára. */
export function marqueeSummaryText(verdict: MarqueeRiskVerdict): string {
  if (!verdict.registered) return 'Nincs rangadóként megjelölve — nincs levonás.';
  if (verdict.level === 'none') return 'Rangadó megjelölve · kockázat: Nincs · levonás: 0';
  return (
    `Rangadó BTTS-kockázat: ${MARQUEE_LEVEL_LABEL[verdict.level]} · ` +
    `${verdict.applied ? 'Rangsorolási levonás' : 'Hipotetikus levonás (árnyék mód)'}: ` +
    `−${verdict.penalty}`);

}
