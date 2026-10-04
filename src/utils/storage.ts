import { FEATURE_SCHEMA_VERSION, SCHEMA_VERSION, STORAGE_KEY } from './constants';
import { emptyRound, sanitizeRound } from './fixtures';
import { defaultCoreStrategy, sanitizeCoreStrategy } from './coreStrategy';
import { defaultSlipMarkets, sanitizeSlipMarkets } from './marketCatalog';
import { canon } from './teams';
import type {
  AliasMap,
  CalibrationMap,
  FixtureRound,
  League,
  PersistedState,
  SeasonCounters,
  Season,
  Slip,
  StorageBackend,
  WeightMap,
  WinmixSettings } from
'../types/winmix';

export const DEFAULT_SETTINGS: WinmixSettings = {
  historyScope: 'season-only',
  allowDuplicateImport: false,
  debugInSampleT: false,
  /** Hypothesis branches stay OFF until measurement earns them. */
  experiments: { dixonColes: false, glicko2: false },
  /** A bevezetés előtti Top 3+3 felállást tükröző alapkészlet. */
  slipMarkets: defaultSlipMarkets(),
  /**
   * PHASE 0 — a napi használat alapértéke a gyors, profil-biztos BTTS core.
   * A kiütés-szűrő ÁRNYÉK módban indul: számol és jelez, de nem vesz le sort.
   */
  coreStrategy: defaultCoreStrategy()
};

export function emptyCalibration(): CalibrationMap {
  return {
    angol: { T: 1.0, history: [], ece: null, lastComputedAt: null },
    spanyol: { T: 1.0, history: [], ece: null, lastComputedAt: null }
  };
}

export function emptyWeights(): WeightMap {
  return { angol: {}, spanyol: {} };
}

export function emptyAliases(): AliasMap {
  return { angol: {}, spanyol: {} };
}

export function emptyCounters(): SeasonCounters {
  return { angol: 0, spanyol: 0 };
}

const memoryStore: Record<string, string> = {};

export function detectStorageBackend(): StorageBackend {
  try {
    const testKey = '__winmix_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return 'local';
  } catch {
    return 'memory';
  }
}

export const storageAdapter = {
  get(backend: StorageBackend, key: string): string | null {
    if (backend === 'local') return window.localStorage.getItem(key);
    return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
  },
  set(backend: StorageBackend, key: string, value: string): void {
    if (backend === 'local') window.localStorage.setItem(key, value);else
    memoryStore[key] = value;
  },
  remove(backend: StorageBackend, key: string): void {
    if (backend === 'local') window.localStorage.removeItem(key);else
    delete memoryStore[key];
  }
};

/**
 * Seasons are persisted WITHOUT their per-match pipeline output: it is fully
 * derived, an order of magnitude larger than the raw matches, and recomputed
 * on load. This keeps a dozen seasons comfortably inside the storage cap.
 */
function stripPipeline(seasons: Season[]): Season[] {
  return seasons.map((s) => ({
    ...s,
    matches: s.matches.map(({ pipeline: _pipeline, ...rest }) => rest)
  }));
}

export interface SaveResult {
  sizeBytes: number;
  error: string | null;
}

export function savePersistedState(
backend: StorageBackend,
state: Omit<PersistedState, 'schemaVersion' | 'savedAt'>)
: SaveResult {
  try {
    const payload: PersistedState = {
      schemaVersion: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      ...state,
      seasons: stripPipeline(state.seasons),
      // PHASE 8 — stamped on write, always with the CURRENT feature shape. A
      // snapshot restored under a different value forces exactly one full
      // historical rebuild before incremental checkpointing resumes.
      featureSchemaVersion: FEATURE_SCHEMA_VERSION
    };
    const serialized = JSON.stringify(payload);
    storageAdapter.set(backend, STORAGE_KEY, serialized);
    return { sizeBytes: new Blob([serialized]).size, error: null };
  } catch (e) {
    return { sizeBytes: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface LoadedState {
  seasons: Season[];
  teamWeights: WeightMap;
  teamAliasMap: AliasMap;
  seasonCounters: SeasonCounters;
  calibration: CalibrationMap;
  settings: WinmixSettings;
  round: FixtureRound;
  slips: Slip[];
  migrated: boolean;
  /**
   * PHASE 8 — the feature shape this snapshot was written under. `null` for
   * pre-Phase-8 snapshots, which are treated exactly like a mismatch.
   */
  featureSchemaVersion: number | null;
}

interface LegacyState {
  schemaVersion?: number;
  seasons?: Season[];
  teamWeights?: Record<string, number>;
  currentCalibration?: {T?: number;ece?: number | null;};
}

function migrateV1ToV2(parsed: LegacyState): LoadedState {
  const oldFlatWeights = parsed.teamWeights ?? {};
  const migratedSeasons = (parsed.seasons ?? []).map((s) => ({
    ...s,
    contentHash: s.contentHash ?? null
  }));

  const newWeights = emptyWeights();
  const newAliases = emptyAliases();
  migratedSeasons.forEach((s) => {
    ;(s.matches ?? []).forEach((m) => {
      ;[m.home_team, m.away_team].forEach((t) => {
        const key = canon(t);
        if (!newAliases[s.league][key]) newAliases[s.league][key] = t;
        if (newWeights[s.league][key] === undefined) {
          newWeights[s.league][key] =
          oldFlatWeights[t] !== undefined ? oldFlatWeights[t] : 5.0;
        }
      });
    });
  });

  const counters = emptyCounters();
  migratedSeasons.forEach((s) => {
    const league = s.league as League;
    counters[league] = Math.max(counters[league], s.seasonIndex || 0);
  });

  const oldCal = parsed.currentCalibration ?? { T: 1.0, ece: null };
  return {
    seasons: migratedSeasons,
    teamWeights: newWeights,
    teamAliasMap: newAliases,
    seasonCounters: counters,
    calibration: {
      angol: { T: oldCal.T || 1.0, history: [], ece: oldCal.ece ?? null, lastComputedAt: null },
      spanyol: {
        T: oldCal.T || 1.0,
        history: [],
        ece: oldCal.ece ?? null,
        lastComputedAt: null
      }
    },
    settings: { ...DEFAULT_SETTINGS, slipMarkets: defaultSlipMarkets() },
    round: emptyRound(),
    slips: [],
    migrated: true,
    featureSchemaVersion: null
  };
}

/** Prefix under which an unreadable snapshot is quarantined instead of lost. */
export const CORRUPT_BACKUP_PREFIX = `${STORAGE_KEY}::corrupt::`;

export interface LoadOutcome {
  /** Restored state, or null when there was nothing (or nothing usable) to load. */
  state: LoadedState | null;
  /** True when a snapshot existed but could not be read. */
  corrupted: boolean;
  /** Where the unreadable raw value was preserved, when it could be saved. */
  backupKey: string | null;
  error: string | null;
}

function quarantine(backend: StorageBackend, raw: string): string | null {
  const key = `${CORRUPT_BACKUP_PREFIX}${new Date().toISOString()}`;
  try {
    storageAdapter.set(backend, key, raw);
    return key;
  } catch {
    // Storage may be full — the load must still fail gracefully.
    return null;
  }
}

function hydrate(parsed: PersistedState & LegacyState): LoadedState {
  if (!parsed.schemaVersion || parsed.schemaVersion < 2) return migrateV1ToV2(parsed);
  return {
    seasons: Array.isArray(parsed.seasons) ? parsed.seasons : [],
    teamWeights: parsed.teamWeights ?? emptyWeights(),
    teamAliasMap: parsed.teamAliasMap ?? emptyAliases(),
    seasonCounters: parsed.seasonCounters ?? emptyCounters(),
    calibration: parsed.calibration ?? emptyCalibration(),
    settings: {
      historyScope: parsed.settings?.historyScope ?? DEFAULT_SETTINGS.historyScope,
      allowDuplicateImport: parsed.settings?.allowDuplicateImport ?? DEFAULT_SETTINGS.allowDuplicateImport,
      debugInSampleT: parsed.settings?.debugInSampleT ?? DEFAULT_SETTINGS.debugInSampleT,
      experiments: {
        ...DEFAULT_SETTINGS.experiments,
        ...(parsed.settings?.experiments ?? {})
      },
      slipMarkets: sanitizeSlipMarkets(parsed.settings?.slipMarkets),
      coreStrategy: sanitizeCoreStrategy(parsed.settings?.coreStrategy)
    },
    round: sanitizeRound(parsed.round),
    slips: Array.isArray(parsed.slips) ? parsed.slips : [],
    migrated: false,
    featureSchemaVersion:
    typeof parsed.featureSchemaVersion === 'number' ? parsed.featureSchemaVersion : null
  };
}

/**
 * Reads the persisted snapshot.
 *
 * PHASE 0 FIX — `JSON.parse` used to run unguarded, so a single corrupted
 * character threw synchronously and the caller fell back to an empty state.
 * The app then looked like a fresh install and the user's seasons were
 * unrecoverable, with nothing but a diagnostics line to show for it.
 *
 * Now the unreadable raw value is QUARANTINED under a timestamped backup key
 * (never overwritten by the next save) and the failure is reported to the
 * caller so it can be surfaced to the user instead of silently swallowed.
 */
export function loadPersistedState(backend: StorageBackend): LoadOutcome {
  let raw: string | null = null;
  try {
    raw = storageAdapter.get(backend, STORAGE_KEY);
  } catch (e) {
    return {
      state: null,
      corrupted: false,
      backupKey: null,
      error: e instanceof Error ? e.message : String(e)
    };
  }
  if (!raw) return { state: null, corrupted: false, backupKey: null, error: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return {
      state: null,
      corrupted: true,
      backupKey: quarantine(backend, raw),
      error: e instanceof Error ? e.message : String(e)
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      state: null,
      corrupted: true,
      backupKey: quarantine(backend, raw),
      error: 'A mentett állapot gyökere nem objektum.'
    };
  }

  try {
    return {
      state: hydrate(parsed as PersistedState & LegacyState),
      corrupted: false,
      backupKey: null,
      error: null
    };
  } catch (e) {
    return {
      state: null,
      corrupted: true,
      backupKey: quarantine(backend, raw),
      error: e instanceof Error ? e.message : String(e)
    };
  }
}