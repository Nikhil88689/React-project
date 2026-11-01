import type { ActivityDTO, InterviewDTO } from '@recruitflow/shared';
import { ArrowRight, Briefcase, CalendarDays, Clock, FileText, Plus, Sparkles, Users, Video } from 'lucide-react';
import { Link } from 'react-router';
import { Avatar, AvatarStack } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { formatDay, formatTime, timeAgo } from '@/lib/utils';

export function UpcomingInterviews({ interviews, title = 'Upcoming interviews' }: { interviews: InterviewDTO[]; title?: string }) {
  return (
    <Card>
      <CardHeader
        title={title}
        action={
          <Button variant="ghost" size="sm" asChild>
            <Link to="/interviews">
              Calendar <ArrowRight />
            </Link>
          </Button>
        }
      />
      <CardContent className="pt-3">
        {interviews.length === 0 ? (
          <EmptyState compact icon={CalendarDays} title="No interviews scheduled" description="Interviews you schedule will appear here." />
        ) : (
          <ul className="space-y-2">
            {interviews.slice(0, 6).map((i) => (
              <li key={i.id}>
                <Link to={`/interviews/${i.id}`} className="flex items-center gap-3 rounded-xl border border-border p-3 transition hover:border-ring/40 hover:bg-accent/40">
                  <div className="flex w-16 shrink-0 flex-col items-center rounded-lg bg-primary-soft py-1.5 text-primary-soft-foreground">
                    <span className="text-[10px] font-semibold uppercase">{formatDay(i.startsAt).slice(0, 9)}</span>
                    <span className="text-[13px] font-bold">{formatTime(i.startsAt).replace(' ', '')}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{i.candidate.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {i.title} · {i.application.jobTitle}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <AvatarStack people={i.interviewers} />
                    {i.meetingUrl && <Video className="size-3.5 text-muted-foreground" />}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const ACTIVITY_ICONS: Record<string, typeof FileText> = {
  CREATE_APPLICATION: Users,
  MOVE_CANDIDATE: ArrowRight,
  SCHEDULE_INTERVIEW: CalendarDays,
  SUBMIT_FEEDBACK: FileText,
  PUBLISH_JOB: Briefcase,
  CREATE_JOB: Plus,
};

export function ActivityFeed({ items }: { items: ActivityDTO[] }) {
  const link = (a: ActivityDTO) => (a.entityType === 'candidate' && a.entityId ? `/candidates/${a.entityId}` : a.entityType === 'job' && a.entityId ? `/jobs/${a.entityId}` : null);
  return (
    <Card>
      <CardHeader title="Recent activity" />
      <CardContent className="pt-3">
        {items.length === 0 ? (
          <EmptyState compact icon={Clock} title="No activity yet" />
        ) : (
          <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-4 before:top-2 before:w-px before:bg-border">
            {items.map((a) => {
              const Icon = ACTIVITY_ICONS[a.action] ?? Sparkles;
              const href = link(a);
              const body = (
                <>
                  <span className="font-semibold">{a.actor?.name ?? 'Candidate'}</span> <span className="text-muted-foreground">{a.summary}</span>
                </>
              );
              return (
                <li key={a.id} className="relative flex gap-3">
                  <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card">
                    {a.actor ? <Avatar name={a.actor.name} src={a.actor.avatarUrl} size="xs" className="ring-0" /> : <Icon className="size-3.5 text-muted-foreground" />}
                  </span>
                  <div className="min-w-0 pt-1">
                    <p className="text-[13px] leading-snug">
                      {href ? (
                        <Link to={href} className="hover:underline">
                          {body}
                        </Link>
                      ) : (
                        body
                      )}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{timeAgo(a.createdAt)}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
