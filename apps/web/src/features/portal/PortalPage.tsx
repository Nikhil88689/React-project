import type { StageType } from '@recruitflow/shared';
import { CANDIDATE_STAGE_LABELS, WORK_MODE_LABELS } from '@recruitflow/shared';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, CalendarDays, LogOut } from 'lucide-react';
import { Logo, StageBadge } from '@/components/domain';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Skeleton } from '@/components/ui/skeleton';
import { useDocumentTitle } from '@/hooks';
import { api } from '@/lib/api';
import { formatDateTime, formatDate } from '@/lib/utils';
import { useAuth } from '@/stores/auth';

interface PortalApp {
  id: string;
  jobTitle: string;
  jobSlug: string;
  location: string;
  workMode: keyof typeof WORK_MODE_LABELS;
  companyName: string;
  companyLogo: string | null;
  status: string;
  stageType: StageType;
  appliedAt: string;
  updatedAt: string;
  nextInterview: { title: string; startsAt: string; meetingUrl: string | null; durationMins: number } | null;
}

export function PortalPage() {
  useDocumentTitle('My applications');
  const user = useAuth((s) => s.user)!;
  const { data, isLoading } = useQuery({ queryKey: ['portal'], queryFn: () => api.get<PortalApp[]>('/portal/applications') });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
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
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Hi {user.firstName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Track the roles you've applied to. Recruiters see more detail than this — that's by design.</p>
        <div className="mt-8 space-y-3">
          {isLoading ? (
            <Skeleton className="h-40" />
          ) : !data?.length ? (
            <Card>
              <EmptyState icon={Briefcase} title="No applications yet" description="When you apply from a careers page with this email, they'll show up here." />
            </Card>
          ) : (
            data.map((a) => (
              <Card key={a.id}>
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{a.jobTitle}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.companyName} · {a.location} · {WORK_MODE_LABELS[a.workMode]}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Applied {formatDate(a.appliedAt)}</p>
                  </div>
                  <StageBadge type={a.stageType} name={CANDIDATE_STAGE_LABELS[a.stageType]} />
                </CardContent>
                {a.nextInterview && (
                  <div className="border-t border-border px-5 py-3 text-sm">
                    <p className="inline-flex items-center gap-2 font-medium">
                      <CalendarDays className="size-4" /> {a.nextInterview.title}
                    </p>
                    <p className="text-muted-foreground">{formatDateTime(a.nextInterview.startsAt)}</p>
                    {a.nextInterview.meetingUrl && (
                      <Button size="sm" className="mt-2" asChild>
                        <a href={a.nextInterview.meetingUrl} target="_blank" rel="noreferrer">
                          Join meeting
                        </a>
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
