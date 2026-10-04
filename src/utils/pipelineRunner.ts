/**
 * pipelineRunner — one entry point, two execution strategies.
 *
 * P3 INFRASTRUCTURE
 * -----------------
 * Callers ask for a league pipeline and do not care where it ran. This module
 * prefers the Web Worker (so the UI never drops a frame) and falls back to the
 * in-process walk whenever a Worker cannot be constructed or a run fails.
 *
 * Only the TARGET LEAGUE's seasons cross the thread boundary. On a FULL
 * rebuild their derived per-match forecasts are stripped first — those are
 * recomputed anyway, and shipping them would double the structured-clone cost
 * for nothing. On a RESUME attempt they must be kept: see below.
 */

import { computeLeaguePipeline, type PipelineParams, type PipelineResult } from './pipeline';
import type { Season } from '../types/winmix';
import type { WorkerRequest, WorkerResponse } from '../workers/pipeline.worker';

export type PipelineRunMode = 'worker' | 'inline';

let worker: Worker | null | undefined;
let requestId = 0;
/** Sticky: once the Worker path has failed, stop paying to retry it. */
let workerDisabled = false;

function getWorker(): Worker | null {
  if (workerDisabled) return null;
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('../workers/pipeline.worker.ts', import.meta.url), {
      type: 'module'
    });
    worker.addEventListener('error', () => {
      workerDisabled = true;
      worker = null;
    });
  } catch {
    worker = null;
    workerDisabled = true;
  }
  return worker;
}

/** Strips derived forecasts before the structured clone. */
function lighten(seasons: readonly Season[]): Season[] {
  return seasons.map((s) => ({
    ...s,
    matches: s.matches.map(({ pipeline: _pipeline, ...rest }) => rest)
  }));
}

function mergeSeasons(all: readonly Season[], computed: readonly Season[]): Season[] {
  const byId = new Map(computed.map((s) => [s.id, s]));
  return all.map((s) => byId.get(s.id) ?? s);
}

function runInWorker(
instance: Worker,
params: Omit<PipelineParams, 'onProgress'>,
onProgress?: PipelineParams['onProgress'])
: Promise<PipelineResult> {
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    const handleMessage = (event: MessageEvent<WorkerResponse>) => {
      const data = event.data;
      if (!data || data.id !== id) return;
      if (data.type === 'progress') {
        onProgress?.(data.done, data.total);
        return;
      }
      cleanup();
      if (data.type === 'done') resolve(data.result);else
      reject(new Error(data.message));
    };
    const handleError = (event: ErrorEvent) => {
      cleanup();
      reject(new Error(event.message || 'A pipeline worker váratlanul leállt.'));
    };
    const cleanup = () => {
      instance.removeEventListener('message', handleMessage as EventListener);
      instance.removeEventListener('error', handleError as EventListener);
    };
    instance.addEventListener('message', handleMessage as EventListener);
    instance.addEventListener('error', handleError as EventListener);
    const request: WorkerRequest = { id, params };
    instance.postMessage(request);
  });
}

export interface RunOutcome extends PipelineResult {
  /** Where the walk actually ran, so the UI can be honest about it. */
  mode: PipelineRunMode;
}

/**
 * Runs one league's pipeline, off-thread when possible.
 *
 * `checkpoint` and `forceFullRebuild` are forwarded verbatim to whichever
 * execution strategy wins — the worker and the in-process walk run the same
 * function, so a resume produces the same numbers either way.
 *
 * Switching `historyScope` or an experiment flag always means a full
 * recomputation — there is no partial-invalidation path, by design.
 */
export async function runLeaguePipeline(params: PipelineParams): Promise<RunOutcome> {
  const { onProgress, ...rest } = params;
  const leagueSeasons = params.seasons.filter((s) => s.league === params.league);
  /**
   * PHASE 8 — a resume attempt MUST keep the prefix's forecasts. The pipeline
   * only honours a checkpoint when every match before its cursor already
   * carries one, and it reuses those forecasts verbatim. Stripping them here
   * would fail that check on every run and turn incremental checkpointing into
   * dead code that silently costs a full rebuild instead.
   */
  const resuming = Boolean(rest.checkpoint) && rest.forceFullRebuild !== true;
  const payload = {
    ...rest,
    seasons: resuming ? leagueSeasons : lighten(leagueSeasons)
  };

  const instance = getWorker();
  if (instance) {
    try {
      const result = await runInWorker(instance, payload, onProgress);
      return {
        ...result,
        seasons: mergeSeasons(params.seasons, result.seasons),
        mode: 'worker'
      };
    } catch {
      // Fall through to the in-process walk; identical math, same output.
      workerDisabled = true;
      worker = null;
    }
  }

  const result = await computeLeaguePipeline({ ...payload, onProgress });
  return {
    ...result,
    seasons: mergeSeasons(params.seasons, result.seasons),
    mode: 'inline'
  };
}