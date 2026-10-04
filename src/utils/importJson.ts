import { LEAGUES, LEAGUE_SEASON_PREFIX } from '../data/leagues';
import { SCHEMA_VERSION } from './constants';
import { finalizeMatchOrder, parseMatchDate } from './matchDate';
import { checkScores } from './matchIntegrity';
import { sanitizeCoreStrategy } from './coreStrategy';
import { sanitizeSlipMarkets } from './marketCatalog';
import {
  DEFAULT_SETTINGS,
  emptyAliases,
  emptyCalibration,
  emptyCounters,
  emptyWeights } from
'./storage';
import type {
  AliasMap,
  CalibrationMap,
  League,
  MatchRow,
  Season,
  SeasonCounters,
  WeightMap,
  WinmixSettings } from
'../types/winmix';

/** The exact slices the JSON export writes — and therefore the ones an import restores. */
export interface ImportPayload {
  schemaVersion: number;
  exportedAt: string | null;
  settings: WinmixSettings;
  calibration: CalibrationMap;
  teamWeights: WeightMap;
  teamAliasMap: AliasMap;
  seasonCounters: SeasonCounters;
  seasons: Season[];
}

export interface ImportStateSlices {
  seasons: Season[];
  teamWeights: WeightMap;
  teamAliasMap: AliasMap;
  seasonCounters: SeasonCounters;
  calibration: CalibrationMap;
  settings: WinmixSettings;
}

export interface ImportSummary {
  schemaVersion: number | null;
  exportedAt: string | null;
  seasons: number;
  matches: number;
  seasonsByLeague: Record<League, number>;
  matchesByLeague: Record<League, number>;
  weights: number;
  aliases: number;
  calibrationT: Record<League, number>;
}

export interface ParseImportResult {
  payload: ImportPayload | null;
  error: string | null;
  warnings: string[];
}

function isLeague(value: unknown): value is League {
  return value === 'angol' || value === 'spanyol';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Collision-proof season id. `Date.now()` alone repeats inside a synchronous
 * merge loop, so a UUID is used where available.
 */
function makeImportedSeasonId(league: League): string {
  const unique =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ?
  crypto.randomUUID() :
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `season_${league}_${unique}`;
}

interface SanitizedMatches {
  matches: MatchRow[];
  /** Rows dropped because the final score was unusable. */
  dropped: number;
  /** Rows kept after unusable half-time data was cleared. */
  repaired: number;
}

/**
 * PHASE 0 FIX — this used to drop any row failing the type guard with no report
 * at all, so partial data loss inside an otherwise-valid season was invisible.
 * It now applies the same score-integrity rules as the CSV path and counts
 * every drop and repair so the caller can surface them.
 */
function sanitizeMatches(raw: unknown): SanitizedMatches {
  if (!Array.isArray(raw)) return { matches: [], dropped: 0, repaired: 0 };

  const matches: MatchRow[] = [];
  let dropped = 0;
  let repaired = 0;

  raw.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      dropped++;
      return;
    }
    const row = entry as Partial<MatchRow>;
    if (
    typeof row.home_team !== 'string' ||
    typeof row.away_team !== 'string' ||
    !row.home_team.trim() ||
    !row.away_team.trim() ||
    !isFiniteNumber(row.home_score) ||
    !isFiniteNumber(row.away_score))
    {
      dropped++;
      return;
    }

    const check = checkScores({
      homeScore: row.home_score,
      awayScore: row.away_score,
      htHome: isFiniteNumber(row.ht_home_score) ? row.ht_home_score : null,
      htAway: isFiniteNumber(row.ht_away_score) ? row.ht_away_score : null
    });
    if (check.status === 'rejected') {
      dropped++;
      return;
    }
    if (check.status === 'repaired') repaired++;

    const parsedDate = parseMatchDate(
      typeof row.kickoffIso === 'string' && row.kickoffIso ?
      row.kickoffIso :
      typeof row.date === 'string' ?
      row.date :
      ''
    );

    // Pipeline output is fully derived and recomputed right after the import.
    const { pipeline: _pipeline, ...rest } = row as MatchRow;
    matches.push({
      ...rest,
      date: typeof row.date === 'string' ? row.date : '',
      kickoffIso: parsedDate.iso,
      rowIndex: isFiniteNumber(row.rowIndex) ? row.rowIndex : index + 1,
      sourceFileId: typeof row.sourceFileId === 'string' ? row.sourceFileId : null,
      ht_home_score: check.htHome,
      ht_away_score: check.htAway,
      home_score: row.home_score,
      away_score: row.away_score,
      total_goals: row.home_score + row.away_score,
      btts: row.home_score > 0 && row.away_score > 0,
      outcome:
      row.home_score > row.away_score ?
      'H' :
      row.home_score === row.away_score ?
      'D' :
      'A'
    });
  });

  return { matches, dropped, repaired };
}

interface SanitizedSeason {
  season: Season;
  dropped: number;
  repaired: number;
}

function sanitizeSeason(raw: unknown, index: number): SanitizedSeason | null {
  if (!raw || typeof raw !== 'object') return null;
  const season = raw as Partial<Season>;
  if (!isLeague(season.league)) return null;
  const sanitized = sanitizeMatches(season.matches);
  if (sanitized.matches.length === 0) return null;

  const ordered = finalizeMatchOrder(sanitized.matches);
  const league = season.league;
  const seasonIndex = isFiniteNumber(season.seasonIndex) ? season.seasonIndex : index + 1;

  return {
    season: {
      id:
      typeof season.id === 'string' && season.id ?
      season.id :
      `season_${league}_import_${index}_${Math.random().toString(36).slice(2, 7)}`,
      league,
      seasonIndex,
      name:
      typeof season.name === 'string' && season.name ?
      season.name :
      `${LEAGUE_SEASON_PREFIX[league]} ${seasonIndex}`,
      fileName: typeof season.fileName === 'string' ? season.fileName : 'import.json',
      createdAt:
      typeof season.createdAt === 'string' ? season.createdAt : new Date().toISOString(),
      contentHash: typeof season.contentHash === 'string' ? season.contentHash : null,
      countWarning: season.countWarning === true,
      actualMatchCount: ordered.matches.length,
      orderMode: ordered.mode,
      datedMatchCount: ordered.dated,
      matches: ordered.matches
    },
    dropped: sanitized.dropped,
    repaired: sanitized.repaired
  };
}

function sanitizeLeagueRecord<T>(
raw: unknown,
pick: (value: unknown) => T | null)
: Record<League, Record<string, T>> {
  const out = { angol: {}, spanyol: {} } as Record<League, Record<string, T>>;
  if (!raw || typeof raw !== 'object') return out;
  LEAGUES.forEach((league) => {
    const bucket = (raw as Record<string, unknown>)[league];
    if (!bucket || typeof bucket !== 'object') return;
    Object.entries(bucket as Record<string, unknown>).forEach(([key, value]) => {
      const parsed = pick(value);
      if (parsed !== null) out[league][key] = parsed;
    });
  });
  return out;
}

function sanitizeCalibration(raw: unknown): CalibrationMap {
  const out = emptyCalibration();
  if (!raw || typeof raw !== 'object') return out;
  LEAGUES.forEach((league) => {
    const entry = (raw as Record<string, unknown>)[league];
    if (!entry || typeof entry !== 'object') return;
    const cal = entry as Partial<CalibrationMap[League]>;
    out[league] = {
      T: isFiniteNumber(cal.T) && cal.T > 0 ? cal.T : 1,
      history: Array.isArray(cal.history) ? cal.history : [],
      ece: isFiniteNumber(cal.ece) ? cal.ece : null,
      lastComputedAt: typeof cal.lastComputedAt === 'string' ? cal.lastComputedAt : null
    };
  });
  return out;
}

export function parseImportFile(text: string): ParseImportResult {
  const warnings: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      payload: null,
      error: 'A fájl nem érvényes JSON — valószínűleg nem a WinMix exportja.',
      warnings
    };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { payload: null, error: 'A fájl gyökere nem objektum — nem WinMix exportállomány.', warnings };
  }

  const raw = parsed as Record<string, unknown>;
  if (!Array.isArray(raw.seasons)) {
    return {
      payload: null,
      error: 'A fájlból hiányzik a "seasons" lista — nem WinMix adatbázis export.',
      warnings
    };
  }

  const schemaVersion = isFiniteNumber(raw.schemaVersion) ? raw.schemaVersion : null;
  if (schemaVersion === null) {
    warnings.push('A fájl nem tartalmaz séma-verziót — a betöltés legjobb tudás szerint történik.');
  } else if (schemaVersion !== SCHEMA_VERSION) {
    warnings.push(
      `A fájl séma-verziója ${schemaVersion}, az alkalmazás ${SCHEMA_VERSION}-t használ — a hiányzó mezők alapértelmezéssel töltődnek.`
    );
  }

  const seasons: Season[] = [];
  raw.seasons.forEach((entry, index) => {
    const sanitized = sanitizeSeason(entry, index);
    if (!sanitized) {
      warnings.push(
        `A ${index + 1}. szezon kihagyva: érvénytelen liga vagy nincs érvényes mérkőzés.`
      );
      return;
    }
    seasons.push(sanitized.season);

    const rawCount = Array.isArray((entry as Partial<Season>)?.matches) ?
    ((entry as Partial<Season>).matches as unknown[]).length :
    sanitized.season.matches.length;
    if (sanitized.dropped > 0) {
      warnings.push(
        `"${sanitized.season.name}": ${sanitized.season.matches.length} / ${rawCount} mérkőzés átvéve — ` +
        `${sanitized.dropped} sor érvénytelen eredmény miatt kimaradt.`
      );
    }
    if (sanitized.repaired > 0) {
      warnings.push(
        `"${sanitized.season.name}": ${sanitized.repaired} mérkőzésnél a félidei eredmény nem volt ` +
        `konzisztens a végeredménnyel — a HT adat elhagyva, a mérkőzés megtartva.`
      );
    }
    if (sanitized.season.orderMode === 'source-order' && sanitized.season.matches.length > 1) {
      warnings.push(
        `"${sanitized.season.name}": nem minden mérkőzésnek van értelmezhető dátuma ` +
        `(${sanitized.season.datedMatchCount ?? 0} / ${sanitized.season.matches.length}) — ` +
        `a kronológia a fájl sorrendjéből feltételezett.`
      );
    }
  });

  if (seasons.length === 0) {
    return {
      payload: null,
      error: 'A fájl egyetlen érvényes szezont sem tartalmaz — nincs mit betölteni.',
      warnings
    };
  }

  const weights = sanitizeLeagueRecord<number>(raw.teamWeights, (v) =>
  isFiniteNumber(v) ? v : null
  );
  const aliases = sanitizeLeagueRecord<string>(raw.teamAliasMap, (v) =>
  typeof v === 'string' && v ? v : null
  );

  const counters = emptyCounters();
  const rawCounters = raw.seasonCounters;
  LEAGUES.forEach((league) => {
    const value =
    rawCounters && typeof rawCounters === 'object' ?
    (rawCounters as Record<string, unknown>)[league] :
    undefined;
    counters[league] = isFiniteNumber(value) ?
    value :
    seasons.filter((s) => s.league === league).length;
  });

  const rawSettings = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};

  return {
    payload: {
      schemaVersion: schemaVersion ?? SCHEMA_VERSION,
      exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : null,
      settings: {
        ...DEFAULT_SETTINGS,
        ...(rawSettings as Partial<WinmixSettings>),
        // Az importált piac-készlet ismeretlen azonosítót is tartalmazhat.
        slipMarkets: sanitizeSlipMarkets(
          (rawSettings as Partial<WinmixSettings>).slipMarkets
        ),
        // Ugyanez a core stratégiára: ismeretlen érték az alapértékre esik.
        coreStrategy: sanitizeCoreStrategy(
          (rawSettings as Partial<WinmixSettings>).coreStrategy
        )
      },
      calibration: sanitizeCalibration(raw.calibration),
      teamWeights: weights as WeightMap,
      teamAliasMap: aliases as AliasMap,
      seasonCounters: counters,
      seasons
    },
    error: null,
    warnings
  };
}

function countRecord(record: Record<League, Record<string, unknown>>): number {
  return LEAGUES.reduce((acc, league) => acc + Object.keys(record[league] ?? {}).length, 0);
}

export function summarize(
slices: Pick<ImportStateSlices, 'seasons' | 'teamWeights' | 'teamAliasMap' | 'calibration'>,
meta: {schemaVersion: number | null;exportedAt: string | null;})
: ImportSummary {
  const seasonsByLeague = { angol: 0, spanyol: 0 } as Record<League, number>;
  const matchesByLeague = { angol: 0, spanyol: 0 } as Record<League, number>;
  slices.seasons.forEach((s) => {
    seasonsByLeague[s.league] += 1;
    matchesByLeague[s.league] += s.matches.length;
  });
  return {
    schemaVersion: meta.schemaVersion,
    exportedAt: meta.exportedAt,
    seasons: slices.seasons.length,
    matches: matchesByLeague.angol + matchesByLeague.spanyol,
    seasonsByLeague,
    matchesByLeague,
    weights: countRecord(slices.teamWeights),
    aliases: countRecord(slices.teamAliasMap),
    calibrationT: {
      angol: slices.calibration.angol?.T ?? 1,
      spanyol: slices.calibration.spanyol?.T ?? 1
    }
  };
}

/** Content-identity of a season, used to skip re-adding the same file on merge. */
function seasonFingerprint(season: Season): string {
  return season.contentHash ?
  `${season.league}::${season.contentHash}` :
  `${season.league}::${season.fileName}::${season.actualMatchCount}::${season.matches.length}`;
}

export function replaceWithPayload(payload: ImportPayload): ImportStateSlices {
  return {
    seasons: payload.seasons,
    teamWeights: {
      angol: { ...payload.teamWeights.angol },
      spanyol: { ...payload.teamWeights.spanyol }
    },
    teamAliasMap: {
      angol: { ...payload.teamAliasMap.angol },
      spanyol: { ...payload.teamAliasMap.spanyol }
    },
    seasonCounters: { ...payload.seasonCounters },
    calibration: payload.calibration,
    settings: payload.settings
  };
}

export interface MergeResult extends ImportStateSlices {
  addedSeasons: number;
  skippedSeasons: number;
}

/**
 * Seasons are merged by content fingerprint (the same hash-level dedup the CSV
 * ingestion uses); weights and aliases take the imported value on collision.
 */
export function mergeWithPayload(
current: ImportStateSlices,
payload: ImportPayload)
: MergeResult {
  const known = new Set(current.seasons.map(seasonFingerprint));
  const counters: SeasonCounters = { ...current.seasonCounters };
  const seasons = current.seasons.slice();
  let addedSeasons = 0;
  let skippedSeasons = 0;

  payload.seasons.forEach((season) => {
    const fingerprint = seasonFingerprint(season);
    if (known.has(fingerprint)) {
      skippedSeasons++;
      return;
    }
    known.add(fingerprint);
    counters[season.league] = (counters[season.league] || 0) + 1;
    const seasonIndex = counters[season.league];
    seasons.push({
      ...season,
      id: makeImportedSeasonId(season.league),
      seasonIndex,
      name: `${LEAGUE_SEASON_PREFIX[season.league]} ${seasonIndex}`,
      // Deep-clone the match list so later in-place edits can never reach back
      // into the imported payload object.
      matches: season.matches.map((m) => ({ ...m }))
    });
    addedSeasons++;
  });

  const weights = emptyWeights();
  const aliases = emptyAliases();
  LEAGUES.forEach((league) => {
    weights[league] = { ...current.teamWeights[league], ...payload.teamWeights[league] };
    aliases[league] = { ...current.teamAliasMap[league], ...payload.teamAliasMap[league] };
  });

  return {
    seasons,
    teamWeights: weights,
    teamAliasMap: aliases,
    seasonCounters: counters,
    // Temperature and settings stay local on merge; the pipeline refits T right after.
    calibration: current.calibration,
    settings: current.settings,
    addedSeasons,
    skippedSeasons
  };
}