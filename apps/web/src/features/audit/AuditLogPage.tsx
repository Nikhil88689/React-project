import { AUDIT_ACTIONS, type PageMeta } from '@recruitflow/shared';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/feedback';
import { NativeSelect } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useDocumentTitle } from '@/hooks';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

interface AuditRow {
  id: string;
  action: string;
  summary: string;
  entityType: string;
  entityId: string | null;
  ip: string | null;
  createdAt: string;
  actor: { id: string; name: string; email: string; avatarUrl: string | null } | null;
}

export function AuditLogPage() {
  useDocumentTitle('Audit log');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['audit', action, page],
    queryFn: () => api.getEnvelope<AuditRow[]>('/audit-logs', { action, page, limit: 25 }),
  });
  const meta = data?.meta as PageMeta | undefined;

  return (
    <>
      <PageHeader title="Audit log" description="Every sensitive action in this workspace — who did what, and when." />
      <div className="mb-4">
        <NativeSelect
          value={action}
          className="w-56"
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All actions</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a.replace(/_/g, ' ')}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-5">
            <Skeleton className="h-80" />
          </div>
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <th className="px-5 py-3 font-medium">Who</th>
                <th className="px-3 py-3 font-medium">Action</th>
                <th className="px-3 py-3 font-medium">Summary</th>
                <th className="px-3 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(data?.data ?? []).map((row) => (
                <tr key={row.id}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={row.actor?.name ?? 'System'} src={row.actor?.avatarUrl} size="xs" />
                      <span>{row.actor?.name ?? 'System'}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">{row.action}</td>
                  <td className="px-3 py-3">{row.summary}</td>
                  <td className="px-3 py-3 text-muted-foreground">{formatDateTime(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm text-muted-foreground">
            <span>
              Page {meta.page} of {meta.totalPages}
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon-sm" disabled={meta.page <= 1} onClick={() => setPage(meta.page - 1)}>
                <ChevronLeft />
              </Button>
              <Button variant="outline" size="icon-sm" disabled={meta.page >= meta.totalPages} onClick={() => setPage(meta.page + 1)}>
                <ChevronRight />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
