/**
 * Match timestamp resolution and deterministic chronological ordering.
 *
 * PHASE 0 — why this module exists
 * --------------------------------
 * The pipeline walks a season's match list as if it were chronological, but
 * before this module that order was simply the *physical row order of the CSV*.
 * The `date` column was stored as an opaque string and never parsed, so
 * re-exporting the same season with rows in a different order silently produced
 * different as-of features, different calibration and different predictions.
 *
 * Two guarantees are established here:
 *   1. Where the source carries a usable date, it becomes a real ISO instant.
 *   2. Ordering is DETERMINISTIC. Either every match in the batch is dated and
 *      we sort by instant, or we keep the untouched source order — we never
 *      interleave dated and undated rows, because that result would depend on
 *      which rows happened to have a date.
 */

/** `20:00` / `20:00:30` — a kickoff time with no calendar date attached. */
const TIME_ONLY = /^\d{1,2}:\d{2}(?::\d{2})?$/;
/** `2024-08-17`, `2024/08/17`, `2024.08.17`, trailing dot allowed. */
const YEAR_FIRST = /^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})\.?$/;
/** `17/08/2024`, `17.08.2024`, `17-08-2024` — day first (European / Hungarian). */
const DAY_FIRST = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})\.?$/;
/** Optional trailing clock component, e.g. `2024-08-17 20:00`. */
const WITH_TIME = /^(.*?)[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

import type { MatchOrderMode, MatchRow } from '../types/winmix';

export type { MatchOrderMode };

export interface ParsedMatchDate {
  /** Normalised ISO instant, or null when no calendar date could be resolved. */
  iso: string | null;
  /** Epoch millis, or null when unresolved. Used only for ordering. */
  ms: number | null;
  /** True when a non-empty value was present but could not be parsed. */
  unparsed: boolean;
}

const UNRESOLVED: ParsedMatchDate = { iso: null, ms: null, unparsed: false };

function build(
year: number,
month: number,
day: number,
hour: number,
minute: number,
second: number)
: ParsedMatchDate | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  const ms = Date.UTC(year, month - 1, day, hour, minute, second);
  const probe = new Date(ms);
  // Rejects impossible calendar dates such as 2024-02-30, which Date.UTC rolls over.
  if (probe.getUTCFullYear() !== year) return null;
  if (probe.getUTCMonth() !== month - 1) return null;
  if (probe.getUTCDate() !== day) return null;
  return { iso: probe.toISOString(), ms, unparsed: false };
}

/**
 * Resolves a raw CSV/JSON date cell into an instant.
 *
 * Accepts ISO (`2024-08-17`, `2024-08-17T20:00`), Hungarian dotted
 * (`2024.08.17.`) and European day-first (`17/08/2024`) forms, each with an
 * optional clock. A bare clock (`20:00`) carries no date and resolves to
 * "unresolved" rather than being coerced into a fake timestamp.
 */
export function parseMatchDate(raw: string | null | undefined): ParsedMatchDate {
  const value = String(raw ?? '').trim();
  if (!value) return UNRESOLVED;
  if (TIME_ONLY.test(value)) return UNRESOLVED;

  let datePart = value;
  let hour = 0;
  let minute = 0;
  let second = 0;

  const withTime = WITH_TIME.exec(value);
  if (withTime) {
    datePart = withTime[1].trim();
    hour = Number(withTime[2]);
    minute = Number(withTime[3]);
    second = withTime[4] ? Number(withTime[4]) : 0;
  }
  // Strip a trailing timezone marker so `2024-08-17T20:00Z` still matches.
  datePart = datePart.replace(/[zZ]$/, '').trim();
  if (!datePart) return UNRESOLVED;

  const yearFirst = YEAR_FIRST.exec(datePart);
  if (yearFirst) {
    const built = build(
      Number(yearFirst[1]),
      Number(yearFirst[2]),
      Number(yearFirst[3]),
      hour,
      minute,
      second
    );
    if (built) return built;
    return { iso: null, ms: null, unparsed: true };
  }

  const dayFirst = DAY_FIRST.exec(datePart);
  if (dayFirst) {
    const a = Number(dayFirst[1]);
    const b = Number(dayFirst[2]);
    const year = Number(dayFirst[3]);
    // Day-first is the documented convention; fall back to month-first only
    // when day-first is impossible (e.g. `08/17/2024`).
    const built = build(year, b, a, hour, minute, second) ?? build(year, a, b, hour, minute, second);
    if (built) return built;
    return { iso: null, ms: null, unparsed: true };
  }

  const native = Date.parse(value);
  if (Number.isFinite(native)) {
    return { iso: new Date(native).toISOString(), ms: native, unparsed: false };
  }
  return { iso: null, ms: null, unparsed: true };
}

/** Anything orderable: a resolved instant plus a stable source position. */
export interface OrderableMatch {
  kickoffIso?: string | null;
  rowIndex?: number;
  match_no?: number;
}

export interface OrderingResult<T> {
  ordered: T[];
  mode: MatchOrderMode;
  dated: number;
  total: number;
}

function positionOf(item: OrderableMatch, fallbackIndex: number): number {
  if (typeof item.rowIndex === 'number') return item.rowIndex;
  if (typeof item.match_no === 'number') return item.match_no;
  return fallbackIndex;
}

function instantOf(item: OrderableMatch): number | null {
  if (!item.kickoffIso) return null;
  const ms = Date.parse(item.kickoffIso);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Orders a batch of matches for pipeline consumption.
 *
 * `chronological` is used only when EVERY match resolved to an instant; the
 * source position then breaks ties, so the result is fully deterministic.
 * Otherwise the untouched source order is preserved and reported as such, so
 * the UI can tell the user that chronology is assumed rather than known.
 */
export function orderMatchesChronologically<T extends OrderableMatch>(
matches: T[])
: OrderingResult<T> {
  const total = matches.length;
  const instants = matches.map(instantOf);
  const dated = instants.reduce<number>((acc, ms) => ms === null ? acc : acc + 1, 0);

  const indexed = matches.map((match, index) => ({
    match,
    ms: instants[index],
    position: positionOf(match, index)
  }));

  if (dated !== total || total === 0) {
    const bySource = indexed.
    slice().
    sort((a, b) => a.position - b.position).
    map((entry) => entry.match);
    return { ordered: bySource, mode: 'source-order', dated, total };
  }

  const chronological = indexed.
  slice().
  sort((a, b) => (a.ms as number) - (b.ms as number) || a.position - b.position).
  map((entry) => entry.match);
  return { ordered: chronological, mode: 'chronological', dated, total };
}

export interface OrderedMatches {
  matches: MatchRow[];
  mode: MatchOrderMode;
  dated: number;
}

/**
 * Establishes a season's canonical order and renumbers `match_no` to match it.
 *
 * The pipeline treats the list as chronological, so this must run before the
 * matches are stored or scored. Idempotent: running it on an already-ordered
 * list is a no-op.
 */
export function finalizeMatchOrder(matches: MatchRow[]): OrderedMatches {
  const { ordered, mode, dated } = orderMatchesChronologically(matches);
  return {
    matches: ordered.map((m, index) =>
    m.match_no === index + 1 ? m : { ...m, match_no: index + 1 }
    ),
    mode,
    dated
  };
}