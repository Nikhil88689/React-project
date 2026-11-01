import type { NotificationDTO } from '@recruitflow/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { useAuth } from '@/stores/auth';

type NotificationPage = { items: NotificationDTO[]; unread: number; nextCursor: string | null };

/** Keeps cached data in sync with what teammates are doing, via Socket.IO. */
export function useRealtime() {
  const qc = useQueryClient();
  const userId = useAuth((s) => s.user?.id);
  const hasCompany = useAuth((s) => Boolean(s.user?.company));

  useEffect(() => {
    if (!userId || !hasCompany) return;
    const socket = connectSocket();
    const invalidate = (...keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    const fromOthers = (actorId?: string | null) => actorId !== userId;

    const handlers: Record<string, (p: Record<string, unknown>) => void> = {
      'notification:new': (n) => {
        const dto = n as unknown as NotificationDTO;
        qc.setQueryData<NotificationPage>(['notifications'], (old) => (old ? { ...old, items: [dto, ...old.items], unread: old.unread + 1 } : old));
        toast(dto.title, { description: dto.body ?? undefined, action: dto.link ? { label: 'View', onClick: () => (window.location.href = dto.link!) } : undefined });
      },
      'application:created': () => invalidate('pipeline', 'dashboard', 'candidates', 'jobs'),
      'application:moved': (p) => {
        if (fromOthers(p.actorId as string)) invalidate('pipeline');
        invalidate('dashboard', 'candidates', 'analytics');
        if (p.candidateId) qc.invalidateQueries({ queryKey: ['candidate', p.candidateId] });
      },
      'interview:scheduled': () => invalidate('interviews', 'dashboard', 'pipeline'),
      'interview:updated': () => invalidate('interviews', 'interview', 'dashboard'),
      'feedback:submitted': (p) => {
        invalidate('interviews', 'interview', 'pending-feedback');
        if (p.candidateId) qc.invalidateQueries({ queryKey: ['candidate', p.candidateId] });
      },
      'job:published': () => invalidate('jobs', 'dashboard'),
      'resume:parsed': (p) => {
        if (p.candidateId) qc.invalidateQueries({ queryKey: ['candidate', p.candidateId] });
        invalidate('candidates', 'pipeline');
      },
    };
    for (const [event, fn] of Object.entries(handlers)) socket.on(event, fn);
    return () => {
      for (const [event, fn] of Object.entries(handlers)) socket.off(event, fn);
      disconnectSocket();
    };
  }, [userId, hasCompany, qc]);
}
