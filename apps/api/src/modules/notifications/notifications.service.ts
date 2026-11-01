import type { NotificationDTO, NotificationType } from '@recruitflow/shared';
import { prisma } from '../../lib/prisma';
import { emitToUser } from '../../lib/socket';

interface NotificationInput {
  companyId: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
}

const toDTO = (n: {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
}): NotificationDTO => ({
  id: n.id,
  type: n.type as NotificationType,
  title: n.title,
  body: n.body,
  link: n.link,
  readAt: n.readAt?.toISOString() ?? null,
  createdAt: n.createdAt.toISOString(),
});

/** Persists in-app notifications and pushes them to connected clients in real time. */
export async function notifyUsers(userIds: string[], input: NotificationInput) {
  const unique = [...new Set(userIds)].filter(Boolean);
  if (!unique.length) return;
  const created = await prisma.notification.createManyAndReturn({
    data: unique.map((userId) => ({
      userId,
      companyId: input.companyId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    })),
  });
  for (const n of created) emitToUser(n.userId, 'notification:new', toDTO(n));
}

/** Members who should hear about pipeline activity: admins + recruiters. */
export async function hiringTeamIds(companyId: string, exclude?: string | null) {
  const members = await prisma.companyMember.findMany({
    where: { companyId, status: 'ACTIVE', role: { in: ['COMPANY_ADMIN', 'RECRUITER'] } },
    select: { userId: true },
  });
  return members.map((m) => m.userId).filter((id) => id !== exclude);
}

export async function listNotifications(userId: string, opts: { cursor?: string; limit: number; unreadOnly?: boolean }) {
  const where = { userId, ...(opts.unreadOnly ? { readAt: null } : {}) };
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: opts.limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  const hasMore = items.length > opts.limit;
  const page = hasMore ? items.slice(0, opts.limit) : items;
  return { items: page.map(toDTO), unread, nextCursor: hasMore ? page[page.length - 1].id : null };
}

export async function markRead(userId: string, id: string) {
  await prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
}

export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}
