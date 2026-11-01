import http from 'node:http';
import { createApp } from './app';
import { env, features } from './config/env';
import { registerEventHandlers } from './events/handlers';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { closeQueue, queueMode, startQueueWorker } from './lib/queue';
import { initSocket } from './lib/socket';
import { storage } from './lib/storage';
import { registerWorkers } from './workers';

const app = createApp();
const server = http.createServer(app);
initSocket(server);
registerEventHandlers();
registerWorkers();
if (env.RUN_WORKERS_IN_API) startQueueWorker();

server.listen(env.PORT, () => {
  logger.info(
    { queue: queueMode(), storage: storage.mode, ai: features.llm ? 'llm' : 'heuristic', email: features.smtp ? 'smtp' : 'console' },
    `🚀 RecruitFlow API listening on http://localhost:${env.PORT} (docs: /api/docs)`,
  );
});

async function shutdown(signal: string) {
  logger.info(`${signal} received — shutting down`);
  server.close();
  await closeQueue();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
