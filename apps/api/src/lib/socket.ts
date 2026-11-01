import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { env } from '../config/env';
import { verifyAccessToken } from './crypto';
import { logger } from './logger';

let io: Server | null = null;

export const rooms = {
  company: (id: string) => `company:${id}`,
  user: (id: string) => `user:${id}`,
};

export function initSocket(server: HttpServer) {
  io = new Server(server, {
    path: '/socket.io',
    cors: { origin: env.APP_URL, credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('UNAUTHORIZED'));
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.companyId = payload.cid;
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket) => {
    const { userId, companyId } = socket.data as { userId: string; companyId: string | null };
    void socket.join(rooms.user(userId));
    if (companyId) void socket.join(rooms.company(companyId));
    logger.debug({ userId }, 'Socket connected');
  });

  return io;
}

/** Broadcasts to every connected member of a company workspace. */
export function emitToCompany(companyId: string, event: string, payload: unknown) {
  io?.to(rooms.company(companyId)).emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(rooms.user(userId)).emit(event, payload);
}
