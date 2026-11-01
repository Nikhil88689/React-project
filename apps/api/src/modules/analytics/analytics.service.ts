import { Prisma } from '@prisma/client';
import {
  FUNNEL_STAGE_TYPES,
  SOURCE_LABELS,
  STAGE_LABELS,
  type ActivityDTO,
  type AnalyticsDTO,
  type CandidateSource,
  type DashboardDTO,
  type StageType,
} from '@recruitflow/shared';
import { cached } from '../../lib/cache';
import { prisma } from '../../lib/prisma';
import type { CompanyAuth } from '../../middleware/auth';
import { interviewInclude, toInterviewDTO } from '../interviews/interviews.service';

const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90, '180d': 180, '365d': 365 } as const;
export type Range = keyof typeof RANGE_DAYS;

const pct = (curr: number, prev: number) => (prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 1000) / 10);

function periods(range: Range) {
  const days = RANGE_DAYS[range];
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400_000);
  const prevStart = new Date(start.getTime() - days * 86400_000);
  return { days, start, end, prevStart };
}

const FUNNEL_INDEX_SQL = Prisma.sql`CASE h."toStageType"
  WHEN 'APPLIED' THEN 0 WHEN 'SCREENING' THEN 1 WHEN 'SHORTLISTED' THEN 2
  WHEN 'INTERVIEW' THEN 3 WHEN 'OFFER' THEN 4 WHEN 'HIRED' THEN 5 ELSE -1 END`;

/**
 * Funnel = how many applications *reached* each stage (from stage history),
 * so rejected candidates still count toward the stages they passed.
 */
async function reachedFunnel(companyId: string, since: Date, jobId?: string) {
  const rows = await prisma.$queryRaw<{ reached: number; count: bigint }[]>`
    SELECT reached, COUNT(*)::bigint AS count FROM (
      SELECT a.id, MAX(${FUNNEL_INDEX_SQL}) AS reached
      FROM applications a
      JOIN application_stage_history h ON h."applicationId" = a.id
      WHERE a."companyId" = ${companyId} AND a."appliedAt" >= ${since}
      ${jobId ? Prisma.sql`AND a."jobId" = ${jobId}` : Prisma.empty}
      GROUP BY a.id
    ) t GROUP BY reached`;
  const counts = FUNNEL_STAGE_TYPES.map((_, i) => rows.filter((r) => Number(r.reached) >= i).reduce((s, r) => s + Number(r.count), 0));
  return FUNNEL_STAGE_TYPES.map((stage, i) => ({ stage, label: STAGE_LABELS[stage], count: counts[i] }));
}

async function trend(companyId: string, since: Date, bucket: 'day' | 'week', jobId?: string) {
  const unit = Prisma.raw(`'${bucket}'`);
  const jobFilter = jobId ? Prisma.sql`AND "jobId" = ${jobId}` : Prisma.empty;
  const [apps, hires, interviews] = await Promise.all([
    prisma.$queryRaw<{ d: Date; c: bigint }[]>`SELECT date_trunc(${unit}, "appliedAt") AS d, COUNT(*)::bigint AS c FROM applications WHERE "companyId" = ${companyId} AND "appliedAt" >= ${since} ${jobFilter} GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<{ d: Date; c: bigint }[]>`SELECT date_trunc(${unit}, "hiredAt") AS d, COUNT(*)::bigint AS c FROM applications WHERE "companyId" = ${companyId} AND "hiredAt" >= ${since} ${jobFilter} GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<{ d: Date; c: bigint }[]>`SELECT date_trunc(${unit}, "startsAt") AS d, COUNT(*)::bigint AS c FROM interviews WHERE "companyId" = ${companyId} AND "startsAt" >= ${since} AND "startsAt" <= now() GROUP BY 1 ORDER BY 1`,
  ]);
  const key = (d: Date) => d.toISOString().slice(0, 10);
  const map = new Map<string, { applications: number; hires: number; interviews: number }>();
  const step = bucket === 'day' ? 86400_000 : 7 * 86400_000;
  const first = new Date(since);
  first.setUTCHours(0, 0, 0, 0);
  if (bucket === 'week') first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
  for (let t = first.getTime(); t <= Date.now(); t += step) map.set(key(new Date(t)), { applications: 0, hires: 0, interviews: 0 });
  for (const r of apps) (map.get(key(r.d)) ?? map.set(key(r.d), { applications: 0, hires: 0, interviews: 0 }).get(key(r.d))!).applications = Number(r.c);
  for (const r of hires) { const v = map.get(key(r.d)); if (v) v.hires = Number(r.c); }
  for (const r of interviews) { const v = map.get(key(r.d)); if (v) v.interviews = Number(r.c); }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v }));
}

export async function recentActivity(companyId: string, take = 12): Promise<ActivityDTO[]> {
  const logs = await prisma.auditLog.findMany({
    where: { companyId, action: { notIn: ['LOGIN', 'LOGOUT', 'CHANGE_PASSWORD', 'REVOKE_SESSION'] } },
    orderBy: { createdAt: 'desc' },
    take,
    include: { actor: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
  });
  return logs.map((l) => ({
    id: l.id,
    action: l.action,
    summary: l.summary,
    entityType: l.entityType,
    entityId: l.entityId,
    createdAt: l.createdAt.toISOString(),
    actor: l.actor ? { id: l.actor.id, name: `${l.actor.firstName} ${l.actor.lastName}`, avatarUrl: l.actor.avatarUrl } : null,
    metadata: l.metadata as Record<string, unknown> | null,
  }));
}

export async function getDashboard(auth: CompanyAuth, range: Range): Promise<DashboardDTO> {
  const companyId = auth.companyId;
  const { start, prevStart, days } = periods(range);

  const metrics = await cached(companyId, `dashboard:${range}`, 30, async () => {
    const [openNow, openPrev, candNow, candPrev, intNow, intPrev, hireNow, hirePrev, funnel, applicationsTrend] = await Promise.all([
      prisma.job.count({ where: { companyId, status: 'PUBLISHED' } }),
      prisma.job.count({ where: { companyId, publishedAt: { lte: start }, OR: [{ closedAt: null }, { closedAt: { gt: start } }] } }),
      prisma.application.count({ where: { companyId, appliedAt: { gte: start } } }),
      prisma.application.count({ where: { companyId, appliedAt: { gte: prevStart, lt: start } } }),
      prisma.interview.count({ where: { companyId, startsAt: { gte: start }, status: { not: 'CANCELLED' } } }),
      prisma.interview.count({ where: { companyId, startsAt: { gte: prevStart, lt: start }, status: { not: 'CANCELLED' } } }),
      prisma.application.count({ where: { companyId, hiredAt: { gte: start } } }),
      prisma.application.count({ where: { companyId, hiredAt: { gte: prevStart, lt: start } } }),
      reachedFunnel(companyId, start),
      trend(companyId, start, days > 60 ? 'week' : 'day'),
    ]);
    return {
      kpis: {
        openPositions: { value: openNow, change: pct(openNow, openPrev) },
        candidates: { value: candNow, change: pct(candNow, candPrev) },
        interviews: { value: intNow, change: pct(intNow, intPrev) },
        hires: { value: hireNow, change: pct(hireNow, hirePrev) },
      },
      funnel,
      applicationsTrend: applicationsTrend.map(({ date, applications, hires }) => ({ date, applications, hires })),
    };
  });

  const [upcoming, activity] = await Promise.all([
    prisma.interview.findMany({
      where: { companyId, status: 'SCHEDULED', startsAt: { gte: new Date() } },
      orderBy: { startsAt: 'asc' },
      take: 6,
      include: interviewInclude,
    }),
    recentActivity(companyId, 10),
  ]);

  return { ...metrics, upcomingInterviews: upcoming.map(toInterviewDTO), activity };
}

export async function getAnalytics(auth: CompanyAuth, range: Range, jobId?: string): Promise<AnalyticsDTO> {
  const companyId = auth.companyId;
  return cached(companyId, `analytics:${range}:${jobId ?? 'all'}`, 60, async () => {
    const { start, days } = periods(range);
    const jobFilter = jobId ? Prisma.sql`AND a."jobId" = ${jobId}` : Prisma.empty;

    const [company, hires, funnel, overTime, sourceRows, deptRows, stageTimes, topJobs, offersReached] = await Promise.all([
      prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
      prisma.application.findMany({ where: { companyId, hiredAt: { gte: start }, ...(jobId ? { jobId } : {}) }, select: { appliedAt: true, hiredAt: true } }),
      reachedFunnel(companyId, start, jobId),
      trend(companyId, start, days > 60 ? 'week' : 'day', jobId),
      prisma.$queryRaw<{ source: CandidateSource; applications: bigint; interviews: bigint; offers: bigint; hires: bigint }[]>`
        SELECT a.source,
          COUNT(DISTINCT a.id)::bigint AS applications,
          COUNT(DISTINCT a.id) FILTER (WHERE h."toStageType" = 'INTERVIEW')::bigint AS interviews,
          COUNT(DISTINCT a.id) FILTER (WHERE h."toStageType" = 'OFFER')::bigint AS offers,
          COUNT(DISTINCT a.id) FILTER (WHERE h."toStageType" = 'HIRED')::bigint AS hires
        FROM applications a LEFT JOIN application_stage_history h ON h."applicationId" = a.id
        WHERE a."companyId" = ${companyId} AND a."appliedAt" >= ${start} ${jobFilter}
        GROUP BY a.source ORDER BY applications DESC`,
      prisma.$queryRaw<{ department: string; open_jobs: bigint; applications: bigint; hires: bigint }[]>`
        SELECT j.department,
          COUNT(DISTINCT j.id) FILTER (WHERE j.status = 'PUBLISHED')::bigint AS open_jobs,
          COUNT(a.id) FILTER (WHERE a."appliedAt" >= ${start})::bigint AS applications,
          COUNT(a.id) FILTER (WHERE a."hiredAt" >= ${start})::bigint AS hires
        FROM jobs j LEFT JOIN applications a ON a."jobId" = j.id
        WHERE j."companyId" = ${companyId}
        GROUP BY j.department ORDER BY applications DESC`,
      prisma.$queryRaw<{ stage: StageType; days: number }[]>`
        SELECT "toStageType" AS stage, AVG(EXTRACT(EPOCH FROM (next_at - "changedAt")) / 86400)::float AS days FROM (
          SELECT h."toStageType", h."changedAt",
            LEAD(h."changedAt") OVER (PARTITION BY h."applicationId" ORDER BY h."changedAt") AS next_at
          FROM application_stage_history h JOIN applications a ON a.id = h."applicationId"
          WHERE a."companyId" = ${companyId} AND a."appliedAt" >= ${start} ${jobFilter}
        ) t WHERE next_at IS NOT NULL GROUP BY "toStageType"`,
      prisma.job.findMany({
        where: { companyId, ...(jobId ? { id: jobId } : {}) },
        select: { id: true, title: true, _count: { select: { applications: { where: { appliedAt: { gte: start } } } } } },
        orderBy: { applications: { _count: 'desc' } },
        take: 6,
      }),
      prisma.applicationStageHistory.findMany({
        where: { toStageType: 'OFFER', changedAt: { gte: start }, application: { companyId, ...(jobId ? { jobId } : {}) } },
        select: { applicationId: true, application: { select: { status: true } } },
        distinct: ['applicationId'],
      }),
    ]);

    const hiresByJob = await prisma.application.groupBy({ by: ['jobId'], where: { companyId, hiredAt: { gte: start }, jobId: { in: topJobs.map((j) => j.id) } }, _count: true });
    const hireMap = new Map(hiresByJob.map((h) => [h.jobId, h._count]));

    const timeToHire = hires.length ? hires.reduce((s, h) => s + (h.hiredAt!.getTime() - h.appliedAt.getTime()), 0) / hires.length / 86400_000 : 0;
    const resolvedOffers = offersReached.filter((o) => o.application.status !== 'ACTIVE');
    const acceptedOffers = resolvedOffers.filter((o) => o.application.status === 'HIRED').length;
    const totalApps = funnel[0]?.count ?? 0;
    const interviewed = funnel.find((f) => f.stage === 'INTERVIEW')?.count ?? 0;
    const months = days / 30;
    const totalSourceApps = sourceRows.reduce((s, r) => s + Number(r.applications), 0) || 1;

    return {
      kpis: {
        timeToHireDays: Math.round(timeToHire * 10) / 10,
        costPerHire: hires.length ? Math.round((company.recruitingSpend * months) / hires.length) : 0,
        offerAcceptance: resolvedOffers.length ? Math.round((acceptedOffers / resolvedOffers.length) * 1000) / 10 : 0,
        applicationToInterview: totalApps ? Math.round((interviewed / totalApps) * 1000) / 10 : 0,
      },
      applicationsOverTime: overTime,
      funnel: funnel.map((f, i) => ({ ...f, conversion: i === 0 ? 100 : funnel[i - 1].count ? Math.round((f.count / funnel[i - 1].count) * 1000) / 10 : 0 })),
      sources: sourceRows.map((r) => ({
        source: r.source,
        label: SOURCE_LABELS[r.source],
        applications: Number(r.applications),
        interviews: Number(r.interviews),
        offers: Number(r.offers),
        hires: Number(r.hires),
        conversion: Number(r.applications) ? Math.round((Number(r.hires) / Number(r.applications)) * 1000) / 10 : 0,
        share: Math.round((Number(r.applications) / totalSourceApps) * 1000) / 10,
      })),
      departments: deptRows.map((d) => ({ department: d.department, openJobs: Number(d.open_jobs), applications: Number(d.applications), hires: Number(d.hires) })),
      timeInStage: FUNNEL_STAGE_TYPES.filter((s) => s !== 'HIRED').map((s) => ({
        stage: STAGE_LABELS[s],
        days: Math.round((stageTimes.find((t) => t.stage === s)?.days ?? 0) * 10) / 10,
      })),
      topJobs: topJobs.map((j) => ({ id: j.id, title: j.title, applications: j._count.applications, hires: hireMap.get(j.id) ?? 0 })),
    };
  });
}
