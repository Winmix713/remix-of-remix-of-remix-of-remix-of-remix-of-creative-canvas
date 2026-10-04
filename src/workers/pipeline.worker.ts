/**
 * pipeline.worker — the as-of walk, off the main thread.
 *
 * P3 INFRASTRUCTURE
 * -----------------
 * The walk now carries three genuinely expensive extras: the prequential
 * logistic refits, the ensemble-weight grid search and 1000-iteration
 * bootstrap intervals. Cooperative yielding was enough for the plain Poisson
 * walk; it is not enough for these. So the whole computation moves here and
 * streams progress back as messages.
 *
 * DETERMINISM
 * -----------
 * Nothing in the walk reads a clock or `Math.random` — the bootstrap uses a
 * seeded PRNG and match order is fixed by `finalizeMatchOrder`. The worker
 * therefore produces byte-identical output to the in-process fallback in
 * `utils/pipelineRunner.ts`.
 */

import { computeLeaguePipeline, type PipelineParams } from '../utils/pipeline';

export interface WorkerRequest {
  id: number;
  params: Omit<PipelineParams, 'onProgress'>;
}

export type WorkerResponse =
{id: number;type: 'progress';done: number;total: number;} |
{id: number;type: 'done';result: Awaited<ReturnType<typeof computeLeaguePipeline>>;} |
{id: number;type: 'error';message: string;};

const ctx = self as unknown as {
  postMessage: (message: WorkerResponse) => void;
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
};

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, params } = event.data;
  try {
    const result = await computeLeaguePipeline({
      ...params,
      onProgress: (done, total) => ctx.postMessage({ id, type: 'progress', done, total })
    });
    ctx.postMessage({ id, type: 'done', result });
  } catch (error) {
    ctx.postMessage({
      id,
      type: 'error',
      message: error instanceof Error ? error.message : String(error)
    });
  }
};