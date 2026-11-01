import { FUNNEL_STAGE_TYPES, STAGE_LABELS, type CandidateSummaryDTO, type DashboardDTO, type PipelineColumnDTO, type StageType } from '@recruitflow/shared';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Briefcase, CalendarCheck, Plus, UserCheck, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { MatchScore, STAGE_STYLES } from '@/components/domain';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, SheetContent } from '@/components/ui/dialog';
import { EmptyState, ErrorState, PageHeader } from '@/components/ui/feedback';
import { NativeSelect } from '@/components/ui/input';
import { Skeleton, SkeletonRows } from '@/components/ui/skeleton';
import { useDocumentTitle } from '@/hooks';
import { api } from '@/lib/api';
import { cn, formatNumber, fullName, greeting } from '@/lib/utils';
import { useAuth, usePermission } from '@/stores/auth';
import { InterviewerDashboard } from './InterviewerDashboard';
import { ActivityFeed, UpcomingInterviews } from './widgets';

export const RANGES = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'This month' },
  { value: '90d', label: 'Last 3 months' },
  { value: '180d', label: 'Last 6 months' },
  { value: '365d', label: 'This year' },
] as const;
export type Range = (typeof RANGES)[number]['value'];

const KPI_META = [
  { key: 'openPositions', label: 'Open positions', icon: Briefcase, tint: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300', to: '/jobs?status=PUBLISHED' },
  { key: 'candidates', label: 'New candidates', icon: Users, tint: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300', to: '/candidates' },
  { key: 'interviews', label: 'Interviews scheduled', icon: CalendarCheck, tint: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300', to: '/interviews' },
  { key: 'hires', label: 'Hires', icon: UserCheck, tint: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300', to: '/pipeline' },
] as const;

function KpiCard({ label, value, change, icon: Icon, tint, to, index }: { label: string; value: number; change: number; icon: typeof Briefcase; tint: string; to: string; index: number }) {
  const up = change >= 0;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
      <Link to={to} className="block">
        <Card className="group p-5 transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-900/5">
          <div className="flex items-start justify-between">
            <span className={cn('flex size-10 items-center justify-center rounded-xl', tint)}>
              <Icon className="size-5" />
            </span>
            <span className={cn('inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold', up ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300')}>
              {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {Math.abs(change)}%
            </span>
          </div>
          <p className="mt-4 text-[28px] font-bold leading-none tracking-tight tabular-nums">{formatNumber(value)}</p>
          <p className="mt-1.5 text-sm text-muted-foreground">{label}</p>
        </Card>
      </Link>
    </motion.div>
  );
}

function FunnelStageSheet({ stage, onClose }: { stage: StageType | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['candidates', { stage, limit: 30 }],
    queryFn: () => api.getEnvelope<CandidateSummaryDTO[]>('/candidates', { stage: stage!, limit: 30 }),
    enabled: Boolean(stage),
  });
  return (
    <Dialog open={Boolean(stage)} onOpenChange={(o) => !o && onClose()}>
      {stage && (
        <SheetContent
          title={`${STAGE_LABELS[stage]} candidates`}
          description={data ? `${formatNumber((data.meta as { total?: number })?.total ?? data.data.length)} candidates currently in this stage` : 'Loading…'}
          footer={
            <Button asChild variant="outline" className="w-full">
              <Link to={`/candidates?stage=${stage}`} onClick={onClose}>
                Open full list <ArrowRight />
              </Link>
            </Button>
          }
        >
          {isLoading ? (
            <SkeletonRows rows={8} className="p-5" />
          ) : !data?.data.length ? (
            <EmptyState compact icon={Users} title="No candidates here yet" />
          ) : (
            <ul className="divide-y divide-border">
              {data.data.map((c) => (
                <li key={c.id}>
                  <Link to={`/candidates/${c.id}`} onClick={onClose} className="flex items-center gap-3 px-5 py-3 transition hover:bg-accent/50">
                    <Avatar name={fullName(c)} src={c.avatarUrl} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{fullName(c)}</span>
                      <span className="block truncate text-xs text-muted-foreground">{c.latestApplication?.jobTitle ?? c.headline}</span>
                    </span>
                    <MatchScore score={c.bestMatch} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SheetContent>
      )}
    </Dialog>
  );
}

function HiringFunnel({ funnel, onSelect }: { funnel: DashboardDTO['funnel']; onSelect: (s: StageType) => void }) {
  const max = Math.max(1, ...funnel.map((f) => f.count));
  return (
    <div className="space-y-2.5">
      {funnel.map((f, i) => {
        const prev = funnel[i - 1];
        const conv = prev && prev.count ? Math.round((f.count / prev.count) * 100) : null;
        return (
          <button key={f.stage} onClick={() => onSelect(f.stage)} className="group flex w-full items-center gap-3 text-left" aria-label={`${f.label}: ${f.count} candidates. View list`}>
            <span className="w-24 shrink-0 text-[13px] font-medium text-muted-foreground group-hover:text-foreground">{f.label}</span>
            <span className="relative h-9 flex-1 overflow-hidden rounded-lg bg-muted/70">
              <motion.span
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(4, (f.count / max) * 100)}%` }}
                transition={{ duration: 0.7, delay: i * 0.06, ease: 'easeOut' }}
                className="absolute inset-y-0 left-0 flex items-center rounded-lg px-3 text-[13px] font-semibold text-white transition group-hover:brightness-110"
                style={{ background: STAGE_STYLES[f.stage].bar }}
              >
                {formatNumber(f.count)}
              </motion.span>
            </span>
            <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{conv != null ? `${conv}%` : ''}</span>
          </button>
        );
      })}
      <p className="pt-1 text-xs text-muted-foreground">Click a stage to see its candidates. Percentages show conversion from the previous stage.</p>
    </div>
  );
}

function TrendChart({ data }: { data: DashboardDTO['applicationsTrend'] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ left: -18, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="apps" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="hires" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickFormatter={(d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} minTickGap={24} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} allowDecimals={false} />
        <ChartTooltip contentStyle={{ borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-popover)', fontSize: 12 }} labelFormatter={(d) => new Date(String(d)).toLocaleDateString('en-IN', { dateStyle: 'medium' })} />
        <Area type="monotone" dataKey="applications" name="Applications" stroke="#6366f1" strokeWidth={2} fill="url(#apps)" />
        <Area type="monotone" dataKey="hires" name="Hires" stroke="#10b981" strokeWidth={2} fill="url(#hires)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function PipelineWidget() {
  const { data, isLoading } = useQuery({ queryKey: ['pipeline', { limitPerStage: 3 }], queryFn: () => api.get<{ columns: PipelineColumnDTO[] }>('/applications', { limitPerStage: 3 }) });
  const columns = data?.columns.filter((c) => FUNNEL_STAGE_TYPES.includes(c.type)) ?? [];
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Pipeline"
        description="Latest movement across all open roles"
        action={
          <Button variant="ghost" size="sm" asChild>
            <Link to="/pipeline">
              Open board <ArrowRight />
            </Link>
          </Button>
        }
      />
      <CardContent className="scrollbar-thin overflow-x-auto">
        {isLoading ? (
          <div className="flex gap-3">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-56 w-56 shrink-0 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="flex gap-3">
            {columns.map((col) => (
              <div key={col.id} className="w-56 shrink-0 rounded-xl bg-muted/60 p-2">
                <div className="mb-2 flex items-center gap-2 px-1.5 pt-1">
                  <span className={cn('size-2 rounded-full', STAGE_STYLES[col.type].dot)} />
                  <span className="text-[13px] font-semibold">{col.name}</span>
                  <span className="ml-auto rounded-full bg-card px-1.5 text-[11px] font-semibold text-muted-foreground">{col.total}</span>
                </div>
                <div className="space-y-2">
                  {col.cards.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted-foreground">No candidates</p>}
                  {col.cards.map((card) => (
                    <Link key={card.id} to={`/candidates/${card.candidateId}`} className="block rounded-lg border border-border bg-card p-2.5 shadow-xs transition hover:border-ring/40">
                      <div className="flex items-center gap-2">
                        <Avatar name={card.candidateName} src={card.avatarUrl} size="xs" />
                        <span className="truncate text-[13px] font-medium">{card.candidateName}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="truncate text-[11px] text-muted-foreground">{card.jobTitle}</span>
                        <MatchScore score={card.matchScore} />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecruiterDashboard() {
  const user = useAuth((s) => s.user)!;
  const can = usePermission();
  const navigate = useNavigate();
  const [range, setRange] = useState<Range>('30d');
  const [stage, setStage] = useState<StageType | null>(null);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['dashboard', range], queryFn: () => api.get<DashboardDTO>('/analytics/dashboard', { range }), placeholderData: (prev) => prev });

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user.firstName} 👋`}
        description="Here's what's happening with your hiring."
        actions={
          <>
            <NativeSelect value={range} onChange={(e) => setRange(e.target.value as Range)} className="w-40" aria-label="Date range">
              {RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </NativeSelect>
            {can('jobs:create') && (
              <Button onClick={() => navigate('/jobs/new')}>
                <Plus /> Create job
              </Button>
            )}
          </>
        }
      />

      {isError ? (
        <Card>
          <ErrorState message="We couldn't load your dashboard." onRetry={() => refetch()} />
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {isLoading || !data
              ? KPI_META.map((k) => <Skeleton key={k.key} className="h-[148px] rounded-xl" />)
              : KPI_META.map((k, i) => <KpiCard key={k.key} index={i} label={k.label} icon={k.icon} tint={k.tint} to={k.to} value={data.kpis[k.key].value} change={data.kpis[k.key].change} />)}
          </div>

          <div className="grid gap-6 xl:grid-cols-5">
            <Card className="xl:col-span-2">
              <CardHeader title="Hiring funnel" description={`Applications received ${RANGES.find((r) => r.value === range)?.label.toLowerCase()}`} />
              <CardContent>{data ? <HiringFunnel funnel={data.funnel} onSelect={setStage} /> : <SkeletonRows rows={6} />}</CardContent>
            </Card>
            <Card className="xl:col-span-3">
              <CardHeader
                title="Applications & hires"
                action={
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-indigo-500" /> Applications</span>
                    <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500" /> Hires</span>
                  </div>
                }
              />
              <CardContent>{data ? <TrendChart data={data.applicationsTrend} /> : <Skeleton className="h-[260px]" />}</CardContent>
            </Card>
          </div>

          <PipelineWidget />

          <div className="grid gap-6 xl:grid-cols-2">
            {data ? <UpcomingInterviews interviews={data.upcomingInterviews} /> : <Skeleton className="h-96 rounded-xl" />}
            {data ? <ActivityFeed items={data.activity} /> : <Skeleton className="h-96 rounded-xl" />}
          </div>
        </div>
      )}
      <FunnelStageSheet stage={stage} onClose={() => setStage(null)} />
    </>
  );
}

export function DashboardPage() {
  useDocumentTitle('Dashboard');
  const role = useAuth((s) => s.user?.role);
  return role === 'INTERVIEWER' ? <InterviewerDashboard /> : <RecruiterDashboard />;
}
