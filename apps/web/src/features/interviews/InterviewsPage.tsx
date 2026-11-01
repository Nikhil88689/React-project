import { INTERVIEW_TYPE_LABELS, type InterviewDTO } from '@recruitflow/shared';
import { useQuery } from '@tanstack/react-query';
import { addDays, format, isSameDay, startOfMonth, startOfWeek } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Video } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Avatar, AvatarStack } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Segmented } from '@/components/ui/controls';
import { EmptyState, PageHeader } from '@/components/ui/feedback';
import { Skeleton } from '@/components/ui/skeleton';
import { ScheduleInterviewDialog } from '@/features/interviews/ScheduleInterviewDialog';
import { useDocumentTitle } from '@/hooks';
import { api } from '@/lib/api';
import { cn, formatDay, formatTime } from '@/lib/utils';
import { useAuth, usePermission } from '@/stores/auth';

export function InterviewsPage() {
  useDocumentTitle('Interviews');
  const can = usePermission();
  const user = useAuth((s) => s.user)!;
  const [mine, setMine] = useState(user.role === 'INTERVIEWER');
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(new Date());
  const [open, setOpen] = useState(false);

  const from = startOfMonth(month);
  const to = addDays(startOfMonth(addDays(month, 32)), 0);
  const { data, isLoading } = useQuery({
    queryKey: ['interviews', { from: from.toISOString(), to: to.toISOString(), mine }],
    queryFn: () => api.get<InterviewDTO[]>('/interviews', { from: from.toISOString(), to: new Date(to.getFullYear(), to.getMonth() + 1, 1).toISOString(), mine: mine ? 'true' : undefined }),
  });

  const interviews = data ?? [];
  const byDay = useMemo(() => {
    const map = new Map<string, InterviewDTO[]>();
    for (const i of interviews) {
      const key = format(new Date(i.startsAt), 'yyyy-MM-dd');
      map.set(key, [...(map.get(key) ?? []), i]);
    }
    return map;
  }, [interviews]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month]);

  const selectedKey = format(selected, 'yyyy-MM-dd');
  const todays = byDay.get(selectedKey) ?? [];

  return (
    <>
      <PageHeader
        title="Interviews"
        description="Schedule panels, join meetings, and keep scorecards moving."
        actions={
          <>
            <Segmented value={mine ? 'mine' : 'all'} onChange={(v) => setMine(v === 'mine')} options={[{ value: 'all', label: 'Everyone' }, { value: 'mine', label: 'My interviews' }]} />
            {can('interviews:create') && (
              <Button onClick={() => setOpen(true)}>
                <Plus /> Schedule interview
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
          <div className="flex items-center justify-between px-5 pt-4">
            <h2 className="text-sm font-semibold">{format(month, 'MMMM yyyy')}</h2>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon-sm" onClick={() => setMonth(startOfMonth(addDays(month, -1)))} aria-label="Previous month">
                <ChevronLeft />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => setMonth(startOfMonth(addDays(month, 32)))} aria-label="Next month">
                <ChevronRight />
              </Button>
            </div>
          </div>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-80" />
            ) : (
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                  <div key={d} className="py-1 font-medium text-muted-foreground">
                    {d}
                  </div>
                ))}
                {days.map((d) => {
                  const key = format(d, 'yyyy-MM-dd');
                  const count = byDay.get(key)?.length ?? 0;
                  const inMonth = d.getMonth() === month.getMonth();
                  return (
                    <button
                      key={key}
                      onClick={() => setSelected(d)}
                      className={cn(
                        'flex min-h-16 flex-col rounded-lg p-1 text-left transition',
                        isSameDay(d, selected) ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
                        !inMonth && 'opacity-40',
                      )}
                    >
                      <span className="text-[13px] font-medium">{format(d, 'd')}</span>
                      {count > 0 && <span className={cn('mt-auto text-[10px] font-semibold', isSameDay(d, selected) ? 'text-primary-foreground/80' : 'text-primary')}>{count} interview{count > 1 ? 's' : ''}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <h3 className="text-sm font-semibold">{formatDay(selected.toISOString())}</h3>
            <div className="mt-4 space-y-3">
              {todays.length === 0 ? (
                <EmptyState compact icon={CalendarDays} title="Nothing scheduled" />
              ) : (
                todays.map((i) => (
                  <Link key={i.id} to={`/interviews/${i.id}`} className="block rounded-xl border border-border p-3 hover:bg-accent/40">
                    <div className="flex items-start gap-3">
                      <Avatar name={i.candidate.name} src={i.candidate.avatarUrl} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{i.candidate.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {i.title} · {i.application.jobTitle}
                        </p>
                        <p className="mt-1 text-xs font-medium">
                          {formatTime(i.startsAt)} · {i.durationMins} min
                        </p>
                      </div>
                      {i.meetingUrl && <Video className="size-4 text-muted-foreground" />}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <AvatarStack people={i.interviewers.map((p) => ({ name: p.name, avatarUrl: p.avatarUrl }))} />
                      <Badge variant="secondary">{INTERVIEW_TYPE_LABELS[i.type]}</Badge>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <ScheduleInterviewDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
