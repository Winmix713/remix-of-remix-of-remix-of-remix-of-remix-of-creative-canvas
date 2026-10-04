/**
 * IndexedDB-backed cache for the full WinMix domain state INCLUDING per-match
 * pipeline output. The regular localStorage snapshot strips pipeline data
 * (it's large and was assumed ephemeral), which forces a full ~8 800-match
 * recompute on every reload. This cache stores the complete seasons array
 * with predictions intact, so a reload that matches the current schema
 * versions restores instantly with zero recompute.
 *
 * The cache is keyed on three version stamps: STORAGE schema, FEATURE schema
 * and PIPELINE contract. Any mismatch discards the blob — exactly like the
 * checkpoint store, never attempting a migration across a dimensionality
 * change.
 */

import {
  FEATURE_SCHEMA_VERSION,
  PIPELINE_CONTRACT_VERSION,
  SCHEMA_VERSION
} from './constants';
import type { CalibrationMap, Season, Slip, FixtureRound, AliasMap, SeasonCounters, WeightMap, WinmixSettings } from '../types/winmix';

const DB_NAME = 'winmix-pipeline-cache';
const DB_VERSION = 1;
const STORE_NAME = 'state';
const RECORD_KEY = 'full-state';

export interface CachedPipelineState {
  schemaVersion: number;
  featureSchemaVersion: number;
  pipelineContractVersion: number;
  savedAt: string;
  seasons: Season[];
  teamWeights: WeightMap;
  teamAliasMap: AliasMap;
  seasonCounters: SeasonCounters;
  calibration: CalibrationMap;
  settings: WinmixSettings;
  round: FixtureRound;
  slips: Slip[];
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDB(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    let db: IDBDatabase | null = null;
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => {
        db = req.result;
        resolve(db);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

export function isPipelineCacheAvailable(): Promise<boolean> {
  return openDB().then((db) => db !== null);
}

export async function savePipelineCache(state: CachedPipelineState): Promise<void> {
  const db = await openDB();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(state, RECORD_KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Cache is best-effort; a failed write must never break the app.
  }
}

export async function loadPipelineCache(): Promise<CachedPipelineState | null> {
  const db = await openDB();
  if (!db) return null;
  try {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(RECORD_KEY);
    const result = await new Promise<CachedPipelineState | null>((resolve) => {
      req.onsuccess = () => resolve((req.result as CachedPipelineState) ?? null);
      req.onerror = () => resolve(null);
    });
    if (!result) return null;
    if (
      result.schemaVersion !== SCHEMA_VERSION ||
      result.featureSchemaVersion !== FEATURE_SCHEMA_VERSION ||
      result.pipelineContractVersion !== PIPELINE_CONTRACT_VERSION
    ) {
      return null;
    }
    return result;
  } catch {
    return null;
  }
}

export async function clearPipelineCache(): Promise<void> {
  const db = await openDB();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(RECORD_KEY);
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // best-effort
  }
}
