/**
 * Standalone background worker (BullMQ). Run with REDIS_URL set and
 * RUN_WORKERS_IN_API=false on the API so jobs are processed here instead.
 */
import { env } from './config/env';
import { registerEventHandlers } from './events/handlers';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { closeQueue, startQueueWorker } from './lib/queue';
import { registerWorkers } from './workers';

if (!env.REDIS_URL) {
  logger.error('The standalone worker requires REDIS_URL. Without Redis, jobs run inside the API process.');
  process.exit(1);
}

registerEventHandlers();
registerWorkers();
startQueueWorker();
logger.info('Worker running — waiting for jobs');

async function shutdown() {
  await closeQueue();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
