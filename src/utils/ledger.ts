import { wilsonInterval } from './bootstrap';
import {
  MARKET_FEEDBACK_GAP_PP,
  MARKET_FEEDBACK_MIN_N,
  PATTERN_WEIGHT_MAX,
  PATTERN_WEIGHT_MIN } from
'./constants';
import { PATTERN_ORDER, defaultPatternWeights } from './patterns';
import type {
  LineGrade,
  PatternPerformance,
  PatternWeightMap,
  Slip,
  SlipLine,
  SlipStatus,
  WilsonInterval } from
'../types/winmix';

export const SLIP_STATUS_LABEL: Record<SlipStatus, string> = {
  pending: 'Függőben',
  won: 'Nyert',
  partial: 'Részleges',
  lost: 'Vesztett'
};

/** Half-time dependent selections cannot be graded from the final score alone. */
export function requiresHt(code: string): boolean {
  return code.startsWith('HT');
}

function sign(a: number, b: number): number {
  return Math.sign(a - b);
}

export function gradeLine(line: SlipLine): LineGrade {
  const { code, ftHome, ftAway, htHome, htAway } = line;
  if (ftHome === null || ftAway === null) return 'pending';
  if (requiresHt(code) && (htHome === null || htAway === null)) return 'pending';

  const ft = sign(ftHome, ftAway);
  const total = ftHome + ftAway;
  const won = (v: boolean): LineGrade => v ? 'won' : 'lost';

  switch (code) {
    case '1':
      return won(ft > 0);
    case 'X':
      return won(ft === 0);
    case '2':
      return won(ft < 0);
    case '1X':
      return won(ft >= 0);
    case 'X2':
      return won(ft <= 0);
    case '12':
      return won(ft !== 0);
    case 'BTTS':
      return won(ftHome > 0 && ftAway > 0);
    case 'NOBTTS':
      return won(ftHome === 0 || ftAway === 0);
    /* RELEASE B — team-goal markets. A selectable line MUST be gradable, or it
     * would sit pending forever and never reach the feedback loop. Note these
     * are per-SIDE, so they must be matched before the generic Over/Under
     * branch below, which reads a TOTAL-goals line out of the code. */
    case 'HOME_O0.5':
      return won(ftHome > 0);
    case 'HOME_U0.5':
      return won(ftHome === 0);
    case 'AWAY_O0.5':
      return won(ftAway > 0);
    case 'AWAY_U0.5':
      return won(ftAway === 0);
    case 'HT:1':
      return won(sign(htHome as number, htAway as number) > 0);
    case 'HT:X':
      return won(sign(htHome as number, htAway as number) === 0);
    case 'HT:2':
      return won(sign(htHome as number, htAway as number) < 0);
    case 'HTFT:REV':{
        const ht = sign(htHome as number, htAway as number);
        return won(ht !== 0 && ft !== ht);
      }
    case 'HTFT:NOREV':{
        const ht = sign(htHome as number, htAway as number);
        return won(ht === 0 || ft === ht);
      }
    default:
      break;
  }

  if (code.startsWith('CS:')) {
    return won(code.slice(3) === `${ftHome}-${ftAway}`);
  }
  if (code.startsWith('O') || code.startsWith('U')) {
    const line_ = Number.parseFloat(code.slice(1));
    if (Number.isNaN(line_)) return 'pending';
    return won(code.startsWith('O') ? total > line_ : total < line_);
  }
  return 'pending';
}

export function slipStatus(slip: Slip): SlipStatus {
  const grades = slip.lines.map(gradeLine);
  if (grades.length === 0) return 'pending';
  if (grades.some((g) => g === 'pending')) return 'pending';
  if (grades.every((g) => g === 'won')) return 'won';
  if (grades.every((g) => g === 'lost')) return 'lost';
  return 'partial';
}

export function slipHitCount(slip: Slip): {won: number;total: number;} {
  const grades = slip.lines.map(gradeLine);
  return { won: grades.filter((g) => g === 'won').length, total: grades.length };
}

/** Laplace-smoothed hit rate per pattern family, mapped into a narrow band. */
export function weightFromRate(smoothed: number): number {
  const raw = 1 + (smoothed - 0.5) * 0.5;
  return Math.min(PATTERN_WEIGHT_MAX, Math.max(PATTERN_WEIGHT_MIN, raw));
}

export function computePatternPerformance(slips: Slip[]): PatternPerformance[] {
  return PATTERN_ORDER.map((type) => {
    let issued = 0;
    let settled = 0;
    let hits = 0;
    slips.forEach((slip) =>
    slip.lines.forEach((line) => {
      if (line.type !== type) return;
      issued++;
      const grade = gradeLine(line);
      if (grade === 'pending') return;
      settled++;
      if (grade === 'won') hits++;
    })
    );
    const smoothed = (hits + 1) / (settled + 2);
    return {
      type,
      issued,
      settled,
      hits,
      hitRate: settled > 0 ? hits / settled : null,
      smoothed,
      weight: weightFromRate(smoothed)
    };
  });
}

export function patternWeightsFromSlips(slips: Slip[]): PatternWeightMap {
  const weights = defaultPatternWeights();
  computePatternPerformance(slips).forEach((p) => {
    weights[p.type] = p.weight;
  });
  return weights;
}

/* ------------------------------------------------------------------ *
 * PHASE 6 — closed-loop market feedback (DIAGNOSTIC ONLY)
 *
 * The ledger already knows whether each line won. What was missing is the
 * comparison at MODEL level: if the system signals BTTS at 65% while 48% is
 * observed, that gap has to be visible before it corrupts more slips.
 *
 * This function never mutates a lambda, a league baseline or a team weight. It
 * only measures. The operator decides what — if anything — to do about it.
 * ------------------------------------------------------------------ */

export interface MarketFeedbackEntry {
  /** Mean signalled probability of the settled lines. */
  predicted: number;
  /** Measured hit rate of the same lines. */
  observed: number;
  /** Settled line count. */
  n: number;
  /** Wins, so the Wilson interval can be computed exactly rather than rounded. */
  hits: number;
}

export interface MarketFeedback {
  btts: MarketFeedbackEntry;
  over25: MarketFeedbackEntry;
  home: MarketFeedbackEntry;
  draw: MarketFeedbackEntry;
  away: MarketFeedbackEntry;
}

interface FeedbackAccumulator {
  sumP: number;
  hits: number;
  n: number;
}

export function computeMarketFeedback(slips: Slip[]): MarketFeedback {
  const acc: Record<keyof MarketFeedback, FeedbackAccumulator> = {
    btts: { sumP: 0, hits: 0, n: 0 },
    over25: { sumP: 0, hits: 0, n: 0 },
    home: { sumP: 0, hits: 0, n: 0 },
    draw: { sumP: 0, hits: 0, n: 0 },
    away: { sumP: 0, hits: 0, n: 0 }
  };

  for (const slip of slips) {
    for (const line of slip.lines) {
      const grade = gradeLine(line);
      if (grade === 'pending') continue;
      const won = grade === 'won' ? 1 : 0;

      const target =
      line.code === 'BTTS' ?
      acc.btts :
      line.code === 'O2.5' ?
      acc.over25 :
      line.code === '1' ?
      acc.home :
      line.code === 'X' ?
      acc.draw :
      line.code === '2' ?
      acc.away :
      null;

      if (target) {
        target.sumP += line.hitRate;
        target.hits += won;
        target.n++;
      }
    }
  }

  const toRate = (a: FeedbackAccumulator): MarketFeedbackEntry => ({
    predicted: a.n > 0 ? a.sumP / a.n : 0,
    observed: a.n > 0 ? a.hits / a.n : 0,
    n: a.n,
    hits: a.hits
  });

  return {
    btts: toRate(acc.btts),
    over25: toRate(acc.over25),
    home: toRate(acc.home),
    draw: toRate(acc.draw),
    away: toRate(acc.away)
  };
}

export type MarketFeedbackKey = keyof MarketFeedback;

/** Fixed render order: goal markets first, then the 1X2 legs. */
export const MARKET_FEEDBACK_ORDER: MarketFeedbackKey[] = [
'btts',
'over25',
'home',
'draw',
'away'];


export const MARKET_FEEDBACK_LABEL: Record<MarketFeedbackKey, string> = {
  btts: 'BTTS (mindkét csapat betalál)',
  over25: 'Over 2.5 gól',
  home: 'Hazai győzelem (1)',
  draw: 'Döntetlen (X)',
  away: 'Vendég győzelem (2)'
};

export interface MarketFeedbackRow {
  key: MarketFeedbackKey;
  label: string;
  /** Mean signalled probability, 0–1. */
  predicted: number;
  /** Measured hit rate, 0–1. */
  observed: number;
  n: number;
  hits: number;
  /** Signed gap in percentage points: positive = over-predicted. */
  gapPp: number;
  /** Wilson 95% interval of the OBSERVED rate. Never optional (invariant 3). */
  ci: WilsonInterval;
  /** The signalled average falls outside the observed interval. */
  outsideInterval: boolean;
  /** All three warning conditions hold. */
  warn: boolean;
  direction: 'over' | 'under';
}

/**
 * Turns raw feedback counts into render-ready rows, attaching a Wilson
 * interval to every observed rate and evaluating the triple warning gate.
 *
 * DIAGNOSTIC ONLY. Nothing here touches a lambda, a league baseline or a team
 * weight — it measures, names the gap, and leaves the decision to the operator.
 */
export function marketFeedbackRows(feedback: MarketFeedback): MarketFeedbackRow[] {
  return MARKET_FEEDBACK_ORDER.map((key) => {
    const entry = feedback[key];
    const ci = wilsonInterval(entry.hits, entry.n);
    const gapPp = (entry.predicted - entry.observed) * 100;
    // With n = 0 the interval is the whole unit line: nothing is "outside" it.
    const outsideInterval =
    entry.n > 0 && (entry.predicted < ci.lo || entry.predicted > ci.hi);

    return {
      key,
      label: MARKET_FEEDBACK_LABEL[key],
      predicted: entry.predicted,
      observed: entry.observed,
      n: entry.n,
      hits: entry.hits,
      gapPp,
      ci,
      outsideInterval,
      warn:
      Math.abs(gapPp) > MARKET_FEEDBACK_GAP_PP &&
      entry.n >= MARKET_FEEDBACK_MIN_N &&
      outsideInterval,
      direction: gapPp >= 0 ? 'over' : 'under'
    };
  });
}

/* ------------------------------------------------------------------ *
 * Cumulative performance curve
 *
 * The ledger is the product's evidence wall: it is the only surface that can
 * answer "is this actually working, over time". Four scalar KPIs cannot — a
 * 61% hit rate reads identically whether it is decaying or climbing.
 * ------------------------------------------------------------------ */

export interface LedgerTrendPoint {
  /** 1-based index of settled lines, in chronological order. */
  index: number;
  /** Cumulative hit rate up to and including this line, in percent. */
  hitRate: number;
  /** Rolling hit rate over the last 20 settled lines, in percent. */
  rolling: number;
  slipName: string;
}

const ROLLING_WINDOW = 20;

export function ledgerTrend(slips: Slip[]): LedgerTrendPoint[] {
  const ordered = [...slips].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const points: LedgerTrendPoint[] = [];
  const outcomes: number[] = [];
  let hits = 0;

  ordered.forEach((slip) => {
    slip.lines.forEach((line) => {
      const grade = gradeLine(line);
      if (grade === 'pending') return;
      const won = grade === 'won' ? 1 : 0;
      outcomes.push(won);
      hits += won;
      const window = outcomes.slice(-ROLLING_WINDOW);
      points.push({
        index: outcomes.length,
        hitRate: hits / outcomes.length * 100,
        rolling: window.reduce((a, b) => a + b, 0) / window.length * 100,
        slipName: slip.roundName
      });
    });
  });

  return points;
}

/* -------------------------------------------------------------------------- *
 * CORE TIERING — Primary / Secondary / Legacy cohorts
 *
 * Merging the tiers into one Core hit rate would make the tiering change
 * unmeasurable: a Secondary line is placed under an explicitly weaker quadrant
 * reading, so its realised rate is the only evidence that will ever say whether
 * admitting volatile candidates was right. Legacy lines (issued before tiering
 * existed) are a THIRD cohort — they were never assigned a tier, so folding
 * them into Primary would rewrite history.
 * -------------------------------------------------------------------------- */

export type CoreTierCohort = 'primary' | 'secondary' | 'legacy';

export const CORE_TIER_COHORT_LABEL: Record<CoreTierCohort, string> = {
  primary: 'Elsődleges core',
  secondary: 'Másodlagos core',
  legacy: 'Örökölt core (szintezés előtti)'
};

export interface CoreTierPerformance {
  cohort: CoreTierCohort;
  label: string;
  /** Lines issued into this cohort, settled or not. */
  issued: number;
  settled: number;
  won: number;
  hitRate: number | null;
  ci: WilsonInterval | null;
}

const CORE_TIER_COHORTS: CoreTierCohort[] = ['primary', 'secondary', 'legacy'];

/** Historical role ids that have always denoted a Core slot. */
const CORE_ROLE_IDS: string[] = ['btts_top', 'btts_second', 'over25', 'safety', 'goals', 'core'];

function cohortOfLine(line: SlipLine): CoreTierCohort | null {
  if (line.coreTier === 'primary') return 'primary';
  if (line.coreTier === 'secondary') return 'secondary';
  // `null` means "a joker line, no Core tier applies"; `undefined` means "saved
  // before tiering existed". Only the latter is a Legacy Core line.
  if (line.coreTier === undefined && CORE_ROLE_IDS.includes(line.role)) return 'legacy';
  return null;
}

export function coreTierPerformance(slips: Slip[]): CoreTierPerformance[] {
  const tally = new Map<CoreTierCohort, {issued: number;settled: number;won: number;}>(
    CORE_TIER_COHORTS.map((c) => [c, { issued: 0, settled: 0, won: 0 }])
  );

  slips.forEach((slip) =>
  slip.lines.forEach((line) => {
    const cohort = cohortOfLine(line);
    if (!cohort) return;
    const entry = tally.get(cohort);
    if (!entry) return;
    entry.issued++;
    const grade = gradeLine(line);
    if (grade === 'pending') return;
    entry.settled++;
    if (grade === 'won') entry.won++;
  })
  );

  return CORE_TIER_COHORTS.map((cohort) => {
    const entry = tally.get(cohort) ?? { issued: 0, settled: 0, won: 0 };
    return {
      cohort,
      label: CORE_TIER_COHORT_LABEL[cohort],
      issued: entry.issued,
      settled: entry.settled,
      won: entry.won,
      hitRate: entry.settled > 0 ? entry.won / entry.settled : null,
      ci: entry.settled > 0 ? wilsonInterval(entry.won, entry.settled) : null
    };
  });
}

export function ledgerTotals(slips: Slip[]) {
  let settledLines = 0;
  let wonLines = 0;
  let pendingSlips = 0;
  let wonSlips = 0;
  slips.forEach((slip) => {
    const status = slipStatus(slip);
    if (status === 'pending') pendingSlips++;
    if (status === 'won') wonSlips++;
    slip.lines.forEach((line) => {
      const grade = gradeLine(line);
      if (grade === 'pending') return;
      settledLines++;
      if (grade === 'won') wonLines++;
    });
  });
  return {
    slips: slips.length,
    pendingSlips,
    wonSlips,
    settledLines,
    wonLines,
    lineHitRate: settledLines > 0 ? wonLines / settledLines : null
  };
}
/* --- "0 core" fordulók kohorsza -------------------------------------------
   Egy forduló, amelyben egyetlen jelölt sem érte el a core szintet, önálló
   mérési eredmény: a szigorítás hatását csak akkor lehet falszifikálni, ha a
   kiadás nélküli fordulók száma is látszik, nem tűnik el üres sorként. */

export interface ZeroCoreCohort {
  /** Szelvények, amelyeken egyáltalán nem szerepel core sor. */
  zeroCoreSlips: number;
  /** Szelvények, amelyeken legalább egy core sor kiadásra került. */
  coreSlips: number;
  /** Régi szelvények, ahol a core-darabszám nem került elmentésre. */
  unknownSlips: number;
  /** A mért (nem ismeretlen) szelvényekre vetített 0-core arány. */
  zeroCoreRate: number | null;
}

export function zeroCoreCohort(slips: Slip[]): ZeroCoreCohort {
  let zeroCoreSlips = 0;
  let coreSlips = 0;
  let unknownSlips = 0;

  slips.forEach((slip) => {
    const count =
    typeof slip.coreLineCount === 'number' ?
    slip.coreLineCount :
    slip.zeroCore === true ?
    0 :
    null;
    if (count === null) {
      unknownSlips++;
      return;
    }
    if (count === 0) zeroCoreSlips++;else
    coreSlips++;
  });

  const measured = zeroCoreSlips + coreSlips;
  return {
    zeroCoreSlips,
    coreSlips,
    unknownSlips,
    zeroCoreRate: measured > 0 ? zeroCoreSlips / measured : null
  };
}
