import { Router } from 'express';
import { CANDIDATE_STAGE_LABELS, auditLogQuerySchema, searchQuerySchema, type SearchResultsDTO } from '@recruitflow/shared';
import { features, isProd } from '../../config/env';
import { ok, pageMeta, parse } from '../../lib/http';
import { devOutbox } from '../../lib/mailer';
import { prisma } from '../../lib/prisma';
import { queueMode } from '../../lib/queue';
import { getRedis } from '../../lib/redis';
import { storage } from '../../lib/storage';
import { authenticate, companyAuth, requireAuth, requirePermission } from '../../middleware/auth';
import { candidateScope } from '../candidates/candidates.service';

/* ─────────────────────────────── Health ─────────────────────────────── */

export const healthRouter = Router();
healthRouter.get('/', async (_req, res) => {
  let db = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = 'down';
  }
  let redis = 'disabled';
  const r = getRedis();
  if (r) redis = (await r.ping().catch(() => 'down')) === 'PONG' ? 'ok' : 'down';
  res.status(db === 'ok' ? 200 : 503).json({
    success: db === 'ok',
    data: { status: db === 'ok' ? 'ok' : 'degraded', db, redis, queue: queueMode(), storage: storage.mode, ai: features.llm ? 'llm' : 'heuristic', email: features.smtp ? 'smtp' : 'console', billing: features.stripe ? 'stripe' : 'mock', uptime: Math.round(process.uptime()) },
  });
});

/* ─────────────────────────────── Search ─────────────────────────────── */

export const searchRouter = Router();
searchRouter.use(authenticate);

/** Global Ctrl+K search across candidates, jobs, applications and interviews (tenant + role scoped). */
searchRouter.get('/', requirePermission('candidates:view'), async (req, res) => {
  const auth = companyAuth(req);
  const { q } = parse(searchQuerySchema, req.query);
  const contains = { contains: q, mode: 'insensitive' as const };
  const tokens = q.split(/\s+/).filter(Boolean).slice(0, 3);
  const nameMatch = tokens.map((t) => ({ OR: [{ firstName: { contains: t, mode: 'insensitive' as const } }, { lastName: { contains: t, mode: 'insensitive' as const } }] }));
  const isInterviewer = auth.role === 'INTERVIEWER';

  const [candidates, jobs, applications, interviews] = await Promise.all([
    prisma.candidate.findMany({
      where: { AND: [candidateScope(auth), { OR: [{ AND: nameMatch }, { email: contains }, { headline: contains }, { skills: { some: { name: contains } } }] }] },
      take: 6,
      select: { id: true, firstName: true, lastName: true, headline: true, email: true },
    }),
    prisma.job.findMany({
      where: { companyId: auth.companyId, status: { not: 'ARCHIVED' }, OR: [{ title: contains }, { department: contains }, { skills: { some: { name: contains } } }] },
      take: 5,
      select: { id: true, title: true, status: true, department: true },
    }),
    isInterviewer
      ? Promise.resolve([])
      : prisma.application.findMany({
          where: { companyId: auth.companyId, OR: [{ candidate: { AND: nameMatch } }, { job: { title: contains } }] },
          take: 5,
          orderBy: { stageChangedAt: 'desc' },
          include: { candidate: { select: { firstName: true, lastName: true } }, job: { select: { title: true } }, stage: { select: { name: true } } },
        }),
    prisma.interview.findMany({
      where: {
        companyId: auth.companyId,
        ...(isInterviewer ? { participants: { some: { userId: auth.userId } } } : {}),
        OR: [{ title: contains }, { application: { candidate: { AND: nameMatch } } }],
      },
      take: 5,
      orderBy: { startsAt: 'desc' },
      include: { application: { include: { candidate: { select: { firstName: true, lastName: true } } } } },
    }),
  ]);

  const dto: SearchResultsDTO = {
    candidates: candidates.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, headline: c.headline, email: c.email })),
    jobs,
    applications: applications.map((a) => ({ id: a.id, candidateId: a.candidateId, candidateName: `${a.candidate.firstName} ${a.candidate.lastName}`, jobTitle: a.job.title, stageName: a.stage.name })),
    interviews: interviews.map((i) => ({ id: i.id, title: i.title, candidateName: `${i.application.candidate.firstName} ${i.application.candidate.lastName}`, startsAt: i.startsAt.toISOString() })),
  };
  ok(res, dto);
});

/* ───────────────────────────── Audit logs ───────────────────────────── */

export const auditRouter = Router();
auditRouter.use(authenticate, requirePermission('audit:view'));

auditRouter.get('/', async (req, res) => {
  const auth = companyAuth(req);
  const q = parse(auditLogQuerySchema, req.query);
  const where = { companyId: auth.companyId, ...(q.action ? { action: q.action } : {}), ...(q.actorId ? { actorId: q.actorId } : {}) };
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      include: { actor: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  ok(
    res,
    rows.map((l) => ({
      id: l.id,
      action: l.action,
      summary: l.summary,
      entityType: l.entityType,
      entityId: l.entityId,
      ip: l.ip,
      metadata: l.metadata,
      createdAt: l.createdAt.toISOString(),
      actor: l.actor ? { id: l.actor.id, name: `${l.actor.firstName} ${l.actor.lastName}`, email: l.actor.email, avatarUrl: l.actor.avatarUrl } : null,
    })),
    200,
    pageMeta(q.page, q.limit, total),
  );
});

/* ────────────────────────── Candidate portal ────────────────────────── */

export const portalRouter = Router();
portalRouter.use(authenticate, requirePermission('portal:view'));

portalRouter.get('/applications', async (req, res) => {
  const auth = requireAuth(req);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });
  const apps = await prisma.application.findMany({
    where: { candidate: { OR: [{ userId: user.id }, { email: user.email }] } },
    orderBy: { appliedAt: 'desc' },
    include: {
      job: { select: { title: true, slug: true, location: true, workMode: true, company: { select: { name: true, logoUrl: true } } } },
      interviews: { where: { status: 'SCHEDULED', startsAt: { gte: new Date() } }, orderBy: { startsAt: 'asc' }, take: 1, select: { title: true, startsAt: true, meetingUrl: true, durationMins: true } },
    },
  });
  ok(
    res,
    apps.map((a) => ({
      id: a.id,
      jobTitle: a.job.title,
      jobSlug: a.job.slug,
      location: a.job.location,
      workMode: a.job.workMode,
      companyName: a.job.company.name,
      companyLogo: a.job.company.logoUrl,
      status: CANDIDATE_STAGE_LABELS[a.stageType],
      stageType: a.stageType,
      appliedAt: a.appliedAt.toISOString(),
      updatedAt: a.stageChangedAt.toISOString(),
      nextInterview: a.interviews[0] ? { ...a.interviews[0], startsAt: a.interviews[0].startsAt.toISOString() } : null,
    })),
  );
});

/* ───────────────────────────── Super admin ───────────────────────────── */

export const adminRouter = Router();
adminRouter.use(authenticate, requirePermission('platform:admin'));

adminRouter.get('/overview', async (_req, res) => {
  const [companies, users, jobs, applications, interviews] = await Promise.all([
    prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
      include: { subscription: true, _count: { select: { members: true, jobs: true, candidates: true, applications: true } } },
    }),
    prisma.user.count(),
    prisma.job.count(),
    prisma.application.count(),
    prisma.interview.count(),
  ]);
  ok(res, {
    totals: { companies: companies.length, users, jobs, applications, interviews },
    companies: companies.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      industry: c.industry,
      plan: c.subscription?.plan ?? 'STARTER',
      status: c.subscription?.status ?? 'TRIALING',
      members: c._count.members,
      jobs: c._count.jobs,
      candidates: c._count.candidates,
      applications: c._count.applications,
      createdAt: c.createdAt.toISOString(),
    })),
  });
});

/* ────────────────────────────── Dev tools ────────────────────────────── */

export const devRouter = Router();
devRouter.get('/emails', (_req, res) => {
  if (isProd) return res.status(404).end();
  ok(res, devOutbox);
});
