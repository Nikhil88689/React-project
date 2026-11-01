import { Router } from 'express';
import { z } from 'zod';
import { ok, param, parse } from '../../lib/http';
import { authenticate, requireAuth } from '../../middleware/auth';
import { listNotifications, markAllRead, markRead } from './notifications.service';

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

const listQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unread: z.enum(['true', 'false']).optional(),
});

notificationsRouter.get('/', async (req, res) => {
  const q = parse(listQuery, req.query);
  const result = await listNotifications(requireAuth(req).userId, { cursor: q.cursor, limit: q.limit, unreadOnly: q.unread === 'true' });
  ok(res, result);
});

notificationsRouter.post('/read-all', async (req, res) => {
  await markAllRead(requireAuth(req).userId);
  ok(res, { ok: true });
});

notificationsRouter.patch('/:id/read', async (req, res) => {
  await markRead(requireAuth(req).userId, param(req.params.id));
  ok(res, { ok: true });
});
