import type { InterviewDTO } from '@recruitflow/shared';
import { useQuery } from '@tanstack/react-query';
import { isToday, isThisWeek } from 'date-fns';
import { AlertCircle, ArrowRight, CalendarCheck, CalendarDays, ClipboardCheck, Clock, Video } from 'lucide-react';
import { Link } from 'react-router';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { EmptyState, PageHeader } from '@/components/ui/feedback';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { cn, formatDay, formatTime, greeting, timeAgo } from '@/lib/utils';
import { useAuth } from '@/stores/auth';
import { UpcomingInterviews } from './widgets';

function Stat({ icon: Icon, label, value, tint }: { icon: typeof Clock; label: string; value: number | string; tint: string }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <span className={cn('flex size-11 items-center justify-center rounded-xl', tint)}>
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}

export function InterviewerDashboard() {
  const user = useAuth((s) => s.user)!;
  const now = new Date();
  const upcoming = useQuery({
    queryKey: ['interviews', { mine: true, from: 'today' }],
    queryFn: () => api.get<InterviewDTO[]>('/interviews', { mine: 'true', from: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(), status: 'SCHEDULED' }),
  });
  const pending = useQuery({ queryKey: ['pending-feedback', 'mine'], queryFn: () => api.get<InterviewDTO[]>('/interviews/pending-feedback', { mine: 'true' }) });

  const list = upcoming.data ?? [];
  const today = list.filter((i) => isToday(new Date(i.startsAt)));
  const later = list.filter((i) => new Date(i.startsAt) > now);
  const week = list.filter((i) => isThisWeek(new Date(i.startsAt), { weekStartsOn: 1 }));
  const myPending = (pending.data ?? []).filter((i) => i.interviewers.some((p) => p.id === user.id && !p.feedbackSubmitted));

  return (
    <>
      <PageHeader title={`${greeting()}, ${user.firstName} 👋`} description={today.length ? `You have ${today.length} interview${today.length > 1 ? 's' : ''} today.` : 'No interviews on your calendar today.'} />
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {upcoming.isLoading ? (
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-[92px] rounded-xl" />)
          ) : (
            <>
              <Stat icon={CalendarCheck} label="Interviews today" value={today.length} tint="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300" />
              <Stat icon={CalendarDays} label="This week" value={week.length} tint="bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300" />
              <Stat icon={ClipboardCheck} label="Feedback pending" value={myPending.length} tint="bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300" />
            </>
          )}
        </div>

        <div className="grid gap-6 xl:grid-cols-5">
          <Card className="xl:col-span-3">
            <CardHeader title="Today's schedule" description={formatDay(now.toISOString())} />
            <CardContent className="pt-3">
              {today.length === 0 ? (
                <EmptyState compact icon={CalendarDays} title="A clear day" description="Nothing scheduled for today. Upcoming interviews are listed on the right." />
              ) : (
                <ol className="space-y-3">
                  {today.map((i) => {
                    const start = new Date(i.startsAt);
                    const past = start.getTime() + i.durationMins * 60_000 < Date.now();
                    const live = start.getTime() <= Date.now() && !past;
                    return (
                      <li key={i.id} className={cn('flex flex-wrap items-center gap-4 rounded-xl border border-border p-4', live && 'border-indigo-300 bg-indigo-50/50 dark:border-indigo-500/40 dark:bg-indigo-500/10')}>
                        <div className="w-20 shrink-0">
                          <p className="text-sm font-bold">{formatTime(i.startsAt)}</p>
                          <p className="text-xs text-muted-foreground">{i.durationMins} min</p>
                        </div>
                        <Avatar name={i.candidate.name} src={i.candidate.avatarUrl} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{i.candidate.name}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            {i.title} · {i.application.jobTitle}
                          </p>
                        </div>
                        {live && <Badge variant="default">In progress</Badge>}
                        <div className="flex gap-2">
                          {i.meetingUrl && !past && (
                            <Button size="sm" asChild>
                              <a href={i.meetingUrl} target="_blank" rel="noreferrer">
                                <Video /> Join
                              </a>
                            </Button>
                          )}
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/interviews/${i.id}`}>{past ? 'Give feedback' : 'Prepare'}</Link>
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader title="Waiting for your feedback" description="Submit while it's fresh — recruiters are waiting on you." />
            <CardContent className="pt-3">
              {myPending.length === 0 ? (
                <EmptyState compact icon={ClipboardCheck} title="You're all caught up" description="No pending scorecards." />
              ) : (
                <ul className="space-y-2">
                  {myPending.slice(0, 6).map((i) => (
                    <li key={i.id}>
                      <Link to={`/interviews/${i.id}`} className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3 transition hover:bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10">
                        <AlertCircle className="size-4 shrink-0 text-amber-600" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{i.candidate.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {i.title} · {timeAgo(i.startsAt)}
                          </p>
                        </div>
                        <ArrowRight className="size-4 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <UpcomingInterviews interviews={later.filter((i) => !isToday(new Date(i.startsAt)))} title="Coming up" />
      </div>
    </>
  );
}
