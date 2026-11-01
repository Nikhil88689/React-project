import { useQuery } from '@tanstack/react-query';
import { Building2, Briefcase, LogOut, Users } from 'lucide-react';
import { Logo } from '@/components/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/feedback';
import { Skeleton } from '@/components/ui/skeleton';
import { useDocumentTitle } from '@/hooks';
import { api } from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/utils';
import { useAuth } from '@/stores/auth';

interface AdminOverview {
  totals: { companies: number; users: number; jobs: number; applications: number; interviews: number };
  companies: { id: string; name: string; slug: string; industry: string | null; plan: string; status: string; members: number; jobs: number; candidates: number; applications: number; createdAt: string }[];
}

export function AdminPage() {
  useDocumentTitle('Platform admin');
  const { data, isLoading } = useQuery({ queryKey: ['admin'], queryFn: () => api.get<AdminOverview>('/admin/overview') });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await api.post('/auth/logout').catch(() => undefined);
              useAuth.getState().clear();
            }}
          >
            <LogOut /> Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <PageHeader title="Platform overview" description="Super-admin view across every tenant on RecruitFlow." />
        {isLoading || !data ? (
          <Skeleton className="h-64" />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {[
                ['Companies', data.totals.companies, Building2],
                ['Users', data.totals.users, Users],
                ['Jobs', data.totals.jobs, Briefcase],
                ['Applications', data.totals.applications, Users],
                ['Interviews', data.totals.interviews, Users],
              ].map(([label, value]) => (
                <Card key={String(label)} className="p-5">
                  <p className="text-sm text-muted-foreground">{label as string}</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums">{formatNumber(value as number)}</p>
                </Card>
              ))}
            </div>
            <Card className="mt-8 overflow-hidden">
              <table className="w-full min-w-[800px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Company</th>
                    <th className="px-3 py-3 font-medium">Plan</th>
                    <th className="px-3 py-3 font-medium">Members</th>
                    <th className="px-3 py-3 font-medium">Jobs</th>
                    <th className="px-3 py-3 font-medium">Candidates</th>
                    <th className="px-3 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.companies.map((c) => (
                    <tr key={c.id}>
                      <td className="px-5 py-3">
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.slug}</p>
                      </td>
                      <td className="px-3 py-3">
                        <Badge>{c.plan}</Badge>
                      </td>
                      <td className="px-3 py-3 tabular-nums">{c.members}</td>
                      <td className="px-3 py-3 tabular-nums">{c.jobs}</td>
                      <td className="px-3 py-3 tabular-nums">{c.candidates}</td>
                      <td className="px-3 py-3 text-muted-foreground">{formatDate(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
