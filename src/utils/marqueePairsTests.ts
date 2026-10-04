/**
 * RANGADÓ (BÜNTETŐPONT) — EXECUTABLE REGRESSION SUITE.
 *
 * A rangadó-címke a legkönnyebben elrontható fajta szabály: egy névlista,
 * amely látszólag „tudja”, hogy egy meccsen nem lesz kétoldalú gól. Ezért a
 * modul szerződése öt olyan tulajdonságból áll, amelyek EGY kör ránézésre
 * teljesen láthatatlanok — egy Core kártya ugyanúgy néz ki akkor is, ha a
 * levonás evidencia nélkül keletkezett:
 *
 *   1. NINCS LEVONÁS EVIDENCIA NÉLKÜL — a puszta megjelölés 0 pont.
 *   2. KIS MINTÁN SOHA — `MARQUEE_MIN_ESS` alatt nincs korrekció, akkor sem,
 *      ha a nyers arányok szélsőségesek.
 *   3. NINCS KIZÁRÁS — a verdikt sosem kapu: a jelölt Core-jogosult marad,
 *      és egyetlen mért érték (`hitRate`, `modelProb`, `coreEvidence`) sem
 *      változik tőle.
 *   4. MÁS PIACOK BITRE AZONOSAK — a levonás kizárólag BTTS soron létezik.
 *   5. SHADOW OFF → VÁLTOZATLAN SORREND — amíg `MARQUEE_RANKING_ACTIVE`
 *      hamis, a rangsor bitre ugyanaz, mint korrekció nélkül.
 *
 * Tiszta és szinkron, a `utils/coreTierTests.ts` alakjában: az operátor a
 * saját buildjén futtatja az audit felületről, fejlesztői módban pedig a
 * modul betöltése azonnal jelzi a törést.
 */

import { SECONDARY_MARKET_THRESHOLDS, decisionQuadrantOf } from './decision';
import {
  MARQUEE_MIN_ESS,
  MARQUEE_PENALTY,
  MARQUEE_RANKING_ACTIVE,
  assessMarqueeRisk,
  marqueeKeyOf } from
'./marqueePairs';
import {
  CORE_SELECTION_RULE_VERSION,
  isCoreEligible,
  rankHitRate,
  selectCoreSet } from
'./slip';
import type { H2HGoalProfile, PatternHit } from '../types/winmix';

/* -------------------------------------------------------------------------- *
 * Szintetikus H2H profil — a valódi mezőnevekkel, kézzel állított mintával
 * -------------------------------------------------------------------------- */

interface ProfileSeed {
  ess: number;
  direct: number;
  bttsRate: number;
  highGoalNoBtts?: number;
  cleanSheetBlowout?: number;
}

function profileOf(seed: ProfileSeed): H2HGoalProfile {
  const btts = seed.bttsRate;
  const highGoalNoBtts = seed.highGoalNoBtts ?? 0;
  const blowout = seed.cleanSheetBlowout ?? 0;

  return {
    avgGoals: 2.4,
    homeGoalsAvg: 1.5,
    awayGoalsAvg: 0.9,
    bttsRate: btts,
    over25Rate: 0.5,
    noBttsRate: 1 - btts,
    highGoalNoBttsRate: highGoalNoBtts,
    cleanSheetBlowoutRate: blowout,
    weightedAvgGoals: 2.4,
    weightedBttsRate: btts,
    weightedOver25Rate: 0.5,
    weightedHighGoalNoBttsRate: highGoalNoBtts,
    weightedCleanSheetBlowoutRate: blowout,
    shrunkBttsRate: btts,
    shrunkHighGoalNoBttsRate: highGoalNoBtts,
    shrunkCleanSheetBlowoutRate: blowout,
    effectiveSampleSize: seed.ess,
    directSampleSize: seed.direct,
    usedReverse: false,
    bttsCount: Math.round(btts * seed.direct),
    highGoalNoBttsCount: Math.round(highGoalNoBtts * seed.direct),
    cleanSheetBlowoutCount: Math.round(blowout * seed.direct),
    blowoutScores: blowout > 0 ? ['5-0', '4-0'] : []
  };
}

/* -------------------------------------------------------------------------- *
 * Szintetikus jelölt — a kvadránst a produkciós matek adja
 * -------------------------------------------------------------------------- */

interface PatternSeed {
  id: string;
  code?: string;
  hitRate: number;
  marketConfidence?: number;
  profile?: H2HGoalProfile | null;
  registered?: boolean;
}

function makePattern(seed: PatternSeed): PatternHit {
  const marketConfidence = seed.marketConfidence ?? 78;
  const quadrant = decisionQuadrantOf(seed.hitRate, marketConfidence, SECONDARY_MARKET_THRESHOLDS);
  const profile = seed.profile ?? null;

  const pattern: PatternHit = {
    id: seed.id,
    fixtureId: seed.id,
    fixtureLabel: `${seed.id} hazai – ${seed.id} vendég`,
    league: 'angol',
    type: 'goal_market',
    code: seed.code ?? 'BTTS',
    label: 'Szintetikus piac',
    rawRate: seed.hitRate,
    hitRate: seed.hitRate,
    sample: 8,
    effectiveSampleSize: 5.4,
    usedReverse: false,
    sufficiency: 'warm',
    agreement: 'neutral',
    stability: 72,
    impliedOdds: 1 / Math.max(seed.hitRate, 0.01),
    weightApplied: 1,
    decision: quadrant,
    marketConfidence,
    marketDecision: quadrant,
    band: 'good',
    bandHitRate: 0.61,
    bandCalibrated: true,
    bandDiagnosis: 'calibrated',
    modelProb: 0.6,
    marketCalibrationStatus: 'calibrated',
    coreEvidence: {
      level: 'calibrated',
      kind: 'verified',
      ruleVersion: 'core-evidence/1.1',
      bandKey: 'p55_65',
      bandLabel: '55–65%',
      environmentKeys: ['p55_65'],
      environmentLabel: '55–65%',
      widened: false,
      observations: 40,
      evaluable: true,
      required: 20,
      avgP: 0.6,
      hitRate: 0.61,
      ciLo: 0.5,
      ciHi: 0.72,
      hits: 24,
      diagnosis: 'calibrated',
      headline: 'Szintetikus kalibrált eset.'
    },
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
      avgGoals: 2.6,
      bttsPct: seed.hitRate,
      over25Pct: 0.55,
      over15Pct: 0.8,
      over35Pct: 0.3
    },
    htStats: null,
    topModalScores: [],
    reversalStats: null,
    goalProfile: profile,
    bttsRisk: null
  };

  pattern.marqueeRisk = assessMarqueeRisk({
    registered: seed.registered ?? false,
    profile,
    risk: null
  });
  return pattern;
}

/* -------------------------------------------------------------------------- *
 * Esettábla
 * -------------------------------------------------------------------------- */

export interface MarqueeCheck {
  name: string;
  passed: boolean;
  actual: string;
}

export interface MarqueeCaseResult {
  label: string;
  requirement: string;
  passed: boolean;
  checks: MarqueeCheck[];
}

export interface MarqueeSuiteResult {
  cases: MarqueeCaseResult[];
  total: number;
  failed: number;
  passed: boolean;
  ruleVersion: string;
  shadowActive: boolean;
}

function check(name: string, passed: boolean, actual: string): MarqueeCheck {
  return { name, passed, actual };
}

function marqueeCase(
label: string,
requirement: string,
checks: MarqueeCheck[])
: MarqueeCaseResult {
  return { label, requirement, checks, passed: checks.every((c) => c.passed) };
}

/** A rangadó-korrekció nélküli, referencia rangsor: a mért hitRate szerint. */
function baselineOrder(patterns: readonly PatternHit[]): string {
  return [...patterns].
  sort((a, b) => b.hitRate - a.hitRate || a.id.localeCompare(b.id)).
  map((p) => p.id).
  join(',');
}

export function runMarqueeSuite(): MarqueeSuiteResult {
  const cases: MarqueeCaseResult[] = [];

  /* --- 1. Nincs levonás evidencia nélkül -------------------------------- */

  const cleanProfile = profileOf({ ess: 9, direct: 10, bttsRate: 0.66 });
  const labelledOnly = assessMarqueeRisk({ registered: true, profile: cleanProfile, risk: null });
  const unregistered = assessMarqueeRisk({ registered: false, profile: cleanProfile, risk: null });

  cases.push(
    marqueeCase(
      'A címke önmagában nem büntet',
      'Megjelölt párosítás ép BTTS profillal: 0 pont levonás, és az indoklás ki is mondja',
      [
      check('szint = none', labelledOnly.level === 'none', labelledOnly.level),
      check('levonás = 0', labelledOnly.penalty === 0, String(labelledOnly.penalty)),
      check('nem alkalmazott', labelledOnly.applied === false, String(labelledOnly.applied)),
      check(
        'van számmal alátámasztott indoklás',
        labelledOnly.reasons.length > 0 && labelledOnly.reasons[0].includes('%'),
        labelledOnly.reasons[0] ?? '—'
      ),
      check('nem jelölt páros: 0', unregistered.penalty === 0, String(unregistered.penalty))]

    )
  );

  /* --- 2. Kis mintán soha nincs korrekció ------------------------------- */

  const thin = profileOf({
    ess: MARQUEE_MIN_ESS - 1.2,
    direct: 3,
    bttsRate: 0.05,
    highGoalNoBtts: 0.4,
    cleanSheetBlowout: 0.8
  });
  const thinVerdict = assessMarqueeRisk({ registered: true, profile: thin, risk: null });
  const noProfile = assessMarqueeRisk({ registered: true, profile: null, risk: null });

  cases.push(
    marqueeCase(
      'Kis minta — nincs korrekció',
      `ESS < ${MARQUEE_MIN_ESS} esetén a szélsőséges nyers arányok sem termelnek levonást`,
      [
      check('vékony minta: szint none', thinVerdict.level === 'none', thinVerdict.level),
      check('vékony minta: levonás 0', thinVerdict.penalty === 0, String(thinVerdict.penalty)),
      check(
        'az indoklás a mintaméretre hivatkozik',
        (thinVerdict.reasons[0] ?? '').includes('effektív minta'),
        thinVerdict.reasons[0] ?? '—'
      ),
      check('profil nélkül: levonás 0', noProfile.penalty === 0, String(noProfile.penalty))]

    )
  );

  /* --- 3. Evidencia esetén VAN levonás, de nincs kizárás ---------------- */

  const badProfile = profileOf({
    ess: 9,
    direct: 10,
    bttsRate: 0.2,
    highGoalNoBtts: 0.15,
    cleanSheetBlowout: 0.5
  });
  const evidenced = makePattern({ id: 'ev', hitRate: 0.62, profile: badProfile, registered: true });
  const verdict = evidenced.marqueeRisk!;
  const untouched = makePattern({ id: 'ev', hitRate: 0.62, profile: badProfile, registered: false });

  cases.push(
    marqueeCase(
      'Evidencia esetén levonás — de sosem kizárás',
      'A saját H2H minta indokol levonást, a jelölt viszont Core-jogosult marad és minden mért értéke változatlan',
      [
      check('szint magasabb mint none', verdict.level !== 'none', verdict.level),
      check(
        'a levonás a szinthez tartozó fix érték',
        verdict.penalty === MARQUEE_PENALTY[verdict.level],
        `${verdict.penalty} vs ${MARQUEE_PENALTY[verdict.level]}`
      ),
      check('Core-jogosult marad', isCoreEligible(evidenced), String(isCoreEligible(evidenced))),
      check(
        'a mért hitRate változatlan',
        evidenced.hitRate === untouched.hitRate,
        `${evidenced.hitRate} vs ${untouched.hitRate}`
      ),
      check(
        'az evidencia-pillanatkép változatlan',
        evidenced.coreEvidence?.level === untouched.coreEvidence?.level,
        `${evidenced.coreEvidence?.level} vs ${untouched.coreEvidence?.level}`
      ),
      check(
        'minden indoklás számmal alátámasztott',
        verdict.reasons.every((r) => /\d/.test(r)),
        verdict.reasons.join(' | ')
      )]

    )
  );

  /* --- 4. Más piacok bitre azonosak ------------------------------------- */

  const otherMarket = makePattern({
    id: 'o25',
    code: 'O2.5',
    hitRate: 0.62,
    profile: badProfile,
    registered: true
  });

  cases.push(
    marqueeCase(
      'Más piacok bitre azonosak',
      'A rangsor-levonás kizárólag BTTS soron létezik; minden más piac hitRate-je érintetlen',
      [
      check(
        'nem-BTTS sor rangsor-értéke = mért hitRate',
        rankHitRate(otherMarket) === otherMarket.hitRate,
        `${rankHitRate(otherMarket)} vs ${otherMarket.hitRate}`
      ),
      check(
        'nem-BTTS sor Core-jogosultsága változatlan',
        isCoreEligible(otherMarket) === isCoreEligible(makePattern({ id: 'o25', code: 'O2.5', hitRate: 0.62, profile: badProfile, registered: false })),
        String(isCoreEligible(otherMarket))
      )]

    )
  );

  /* --- 5. Shadow OFF → változatlan sorrend ------------------------------ */

  const round = [
  makePattern({ id: 'a', hitRate: 0.66, profile: badProfile, registered: true }),
  makePattern({ id: 'b', hitRate: 0.64, profile: cleanProfile, registered: false }),
  makePattern({ id: 'c', hitRate: 0.62, profile: cleanProfile, registered: false })].
  filter(isCoreEligible);

  const selected = selectCoreSet(round, 3).map((p) => p.id).join(',');
  const baseline = baselineOrder(round);
  const rankUnchanged = round.every((p) => rankHitRate(p) === p.hitRate);

  cases.push(
    marqueeCase(
      'Árnyék mód — a sorrend nem mozdul',
      'MARQUEE_RANKING_ACTIVE = false mellett a rangsor bitre azonos a korrekció nélküli sorrenddel',
      [
      check('a zászló árnyék állásban van', MARQUEE_RANKING_ACTIVE === false, String(MARQUEE_RANKING_ACTIVE)),
      check('rankHitRate = hitRate minden soron', rankUnchanged, String(rankUnchanged)),
      check('a core sorrend a referencia sorrend', selected === baseline, `${selected} vs ${baseline}`)]

    )
  );

  /* --- 6. Irányított kulcs ---------------------------------------------- */

  cases.push(
    marqueeCase(
      'A regiszter irányított',
      'A hazai–vendég sorrend számít: az „A otthon B ellen” megjelölés nem jelöli meg a fordítottját',
      [
      check(
        'A___B ≠ B___A',
        marqueeKeyOf('a', 'b') !== marqueeKeyOf('b', 'a'),
        `${marqueeKeyOf('a', 'b')} vs ${marqueeKeyOf('b', 'a')}`
      )]

    )
  );

  const failed = cases.filter((c) => !c.passed).length;
  return {
    cases,
    total: cases.length,
    failed,
    passed: failed === 0,
    ruleVersion: CORE_SELECTION_RULE_VERSION,
    shadowActive: MARQUEE_RANKING_ACTIVE
  };
}

/* Development-mode self-check: egy itteni regresszió csendben átírná, MELYIK
 * sorok kerülnek Core kártyára — ez egyetlen körön nem látszik. */
if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
  const result = runMarqueeSuite();
  if (!result.passed) {
    const broken = result.cases.
    filter((c) => !c.passed).
    map(
      (c) =>
      `${c.label}: ${c.checks.
      filter((x) => !x.passed).
      map((x) => `${x.name} → ${x.actual}`).
      join(', ')}`
    );
    console.error(
      `[marqueePairs] A rangadó rangsor-szerződés sérült (${result.failed} hiba): ` + broken.join(' | ')
    );
  }
}
