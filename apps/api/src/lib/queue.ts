import { Queue, Worker, type JobsOptions } from 'bullmq';
import { env } from '../config/env';
import { logger } from './logger';
import { createRedisConnection } from './redis';

export interface JobPayloads {
  'resume.process': { fileId: string; candidateId: string; applicationId?: string; companyId: string };
  'email.send': {
    to: string;
    subject: string;
    html: string;
    text?: string;
    messageId?: string;
  };
  'interview.reminder': { interviewId: string; window: '24h' | '1h' };
  'ai.match': { applicationId: string };
}

export type JobName = keyof JobPayloads;
type Handler<N extends JobName> = (data: JobPayloads[N]) => Promise<void>;

const QUEUE_NAME = 'recruitflow';
const handlers = new Map<JobName, Handler<JobName>>();

let bullQueue: Queue | null = null;
let bullWorker: Worker | null = null;
const memoryTimers = new Map<string, NodeJS.Timeout>();
const MAX_TIMEOUT = 2_147_483_647;

export const queueMode = () => (env.REDIS_URL ? 'bullmq' : 'in-memory');

function getQueue() {
  if (!bullQueue) {
    bullQueue = new Queue(QUEUE_NAME, {
      connection: createRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
  }
  return bullQueue;
}

export function registerHandler<N extends JobName>(name: N, handler: Handler<N>) {
  handlers.set(name, handler as Handler<JobName>);
}

async function runWithRetry(name: JobName, data: unknown, attempt = 1): Promise<void> {
  const handler = handlers.get(name);
  if (!handler) {
    logger.warn({ job: name }, 'No handler registered for job');
    return;
  }
  try {
    await handler(data as JobPayloads[JobName]);
  } catch (err) {
    logger.error({ err, job: name, attempt }, 'Job failed');
    if (attempt < 3) {
      setTimeout(() => void runWithRetry(name, data, attempt + 1), 1000 * 2 ** attempt);
    }
  }
}

export async function enqueue<N extends JobName>(
  name: N,
  data: JobPayloads[N],
  opts: { delayMs?: number; jobId?: string } = {},
) {
  const delay = Math.max(0, opts.delayMs ?? 0);
  if (env.REDIS_URL) {
    const jobOpts: JobsOptions = { delay, jobId: opts.jobId };
    await getQueue().add(name, data, jobOpts);
    return;
  }
  // In-process fallback: good enough for local dev; delays beyond ~24 days are skipped.
  if (delay > MAX_TIMEOUT) return;
  const timer = setTimeout(() => {
    if (opts.jobId) memoryTimers.delete(opts.jobId);
    void runWithRetry(name, data);
  }, delay);
  if (opts.jobId) {
    const existing = memoryTimers.get(opts.jobId);
    if (existing) clearTimeout(existing);
    memoryTimers.set(opts.jobId, timer);
  }
}

export async function cancelJob(jobId: string) {
  if (env.REDIS_URL) {
    const job = await getQueue().getJob(jobId);
    await job?.remove().catch(() => undefined);
    return;
  }
  const timer = memoryTimers.get(jobId);
  if (timer) clearTimeout(timer);
  memoryTimers.delete(jobId);
}

/** Starts the BullMQ worker (no-op for the in-memory queue, which runs handlers inline). */
export function startQueueWorker() {
  if (!env.REDIS_URL || bullWorker) return;
  bullWorker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const handler = handlers.get(job.name as JobName);
      if (!handler) throw new Error(`No handler for ${job.name}`);
      await handler(job.data);
    },
    { connection: createRedisConnection(), concurrency: 5 },
  );
  bullWorker.on('failed', (job, err) => logger.error({ err, job: job?.name, id: job?.id }, 'Queue job failed'));
  bullWorker.on('completed', (job) => logger.debug({ job: job.name, id: job.id }, 'Queue job completed'));
  logger.info('BullMQ worker started');
}

export async function closeQueue() {
  await bullWorker?.close();
  await bullQueue?.close();
  for (const timer of memoryTimers.values()) clearTimeout(timer);
}
