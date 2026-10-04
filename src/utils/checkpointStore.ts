/**
 * PHASE 8 — session-scoped checkpoint store.
 *
 * `computeLeaguePipeline()` already knows how to resume from a checkpoint and
 * how to refuse a suspicious one. What was missing is a place to KEEP the
 * checkpoint between runs. This module is that place.
 *
 * Deliberate scope:
 * - SESSION, not local storage. A checkpoint is a performance cache, never a
 *   source of truth. It must not outlive the tab, and it must never be the
 *   reason a stale fit survives a browser restart.
 * - The per-match forecasts are NOT persisted, so after a reload the pipeline
 *   has to walk the history anyway. The value the checkpoint delivers is
 *   within a session: appending one fixture round no longer re-forecasts
 *   1000 historical matches.
 * - Every read is guarded twice: by the store's own envelope version and by
 *   `FEATURE_SCHEMA_VERSION`. A mismatch drops the whole blob rather than
 *   attempting a migration — a logistic fit cannot be migrated across a
 *   dimensionality change, only rebuilt.
 * - Nothing here ever throws. A missing, full, blocked or malformed session
 *   store degrades to an in-memory map, and an in-memory miss degrades to a
 *   full rebuild.
 */

import {
  FEATURE_SCHEMA_VERSION,
  PIPELINE_CONTRACT_VERSION,
  STORAGE_KEY } from
'./constants';
import type { CheckpointMap, League, PipelineCheckpoint } from '../types/winmix';

/** Bump when the ENVELOPE shape below changes. */
export const CHECKPOINT_STORE_VERSION = 2;

export const CHECKPOINT_SESSION_KEY = `${STORAGE_KEY}::checkpoints`;

export type CheckpointStoreBackend = 'session' | 'memory';

interface CheckpointEnvelope {
  storeVersion: number;
  featureSchemaVersion: number;
  /**
   * RELEASE A/C — the pipeline OUTPUT contract the stored checkpoints were
   * written under. Guarded separately from the feature schema: the market work
   * changes what a walk emits without touching the feature vector's shape, and
   * a resumed prefix missing the team-goal probabilities would silently
   * truncate the market-specific calibration history.
   */
  pipelineContractVersion: number;
  checkpoints: CheckpointMap;
}

let cache: CheckpointMap | null = null;
/** Sticky: once the session store has refused a write, stop paying for it. */
let sessionUsable = true;

function session(): Storage | null {
  if (!sessionUsable) return null;
  try {
    return window.sessionStorage;
  } catch {
    sessionUsable = false;
    return null;
  }
}

function drop(store: Storage): void {
  try {
    store.removeItem(CHECKPOINT_SESSION_KEY);
  } catch {
    /* A store we cannot clean is a store we stop trusting. */
    sessionUsable = false;
  }
}

function load(): CheckpointMap {
  if (cache) return cache;
  cache = {};

  const store = session();
  if (!store) return cache;

  let raw: string | null = null;
  try {
    raw = store.getItem(CHECKPOINT_SESSION_KEY);
  } catch {
    sessionUsable = false;
    return cache;
  }
  if (!raw) return cache;

  try {
    const parsed = JSON.parse(raw) as CheckpointEnvelope | null;
    if (
    !parsed ||
    typeof parsed !== 'object' ||
    parsed.storeVersion !== CHECKPOINT_STORE_VERSION ||
    parsed.featureSchemaVersion !== FEATURE_SCHEMA_VERSION ||
    parsed.pipelineContractVersion !== PIPELINE_CONTRACT_VERSION ||
    !parsed.checkpoints ||
    typeof parsed.checkpoints !== 'object')
    {
      drop(store);
      return cache;
    }
    cache = { ...parsed.checkpoints };
  } catch {
    drop(store);
  }
  return cache;
}

function flush(): void {
  const store = session();
  if (!store || !cache) return;
  const envelope: CheckpointEnvelope = {
    storeVersion: CHECKPOINT_STORE_VERSION,
    featureSchemaVersion: FEATURE_SCHEMA_VERSION,
    pipelineContractVersion: PIPELINE_CONTRACT_VERSION,
    checkpoints: cache
  };
  try {
    store.setItem(CHECKPOINT_SESSION_KEY, JSON.stringify(envelope));
  } catch {
    // Quota or a privacy mode. The in-memory map stays authoritative for the
    // rest of the session; only cross-reload resume is lost.
    sessionUsable = false;
  }
}

/** True when a checkpoint carries everything the pipeline needs to resume. */
function usable(candidate: unknown, league: League): candidate is PipelineCheckpoint {
  if (!candidate || typeof candidate !== 'object') return false;
  const cp = candidate as PipelineCheckpoint;
  return (
    cp.league === league &&
    cp.featureSchemaVersion === FEATURE_SCHEMA_VERSION &&
    cp.pipelineContractVersion === PIPELINE_CONTRACT_VERSION &&
    typeof cp.processedMatchCount === 'number' &&
    cp.processedMatchCount > 0 &&
    typeof cp.prefixSignature === 'string' &&
    typeof cp.weightsSignature === 'string' &&
    Array.isArray(cp.calibHistory) &&
    Array.isArray(cp.m1Samples));

}

/**
 * The checkpoint the next run for `league` may resume from, or `null`.
 *
 * A `null` here is not an error condition: the pipeline treats it as a cold
 * start and performs a full — identical — rebuild.
 */
export function readCheckpoint(league: League): PipelineCheckpoint | null {
  const candidate = load()[league];
  return usable(candidate, league) ? candidate : null;
}

export function writeCheckpoint(checkpoint: PipelineCheckpoint): void {
  if (checkpoint.featureSchemaVersion !== FEATURE_SCHEMA_VERSION) return;
  if (checkpoint.pipelineContractVersion !== PIPELINE_CONTRACT_VERSION) return;
  const map = load();
  map[checkpoint.league] = checkpoint;
  cache = map;
  flush();
}

/** The operator escape hatch behind "Teljes újraépítés". */
export function clearCheckpoints(): void {
  cache = {};
  const store = session();
  if (store) drop(store);
}

/** Whether resume survives a reload, so the UI can be honest about it. */
export function checkpointStoreBackend(): CheckpointStoreBackend {
  return session() ? 'session' : 'memory';
}