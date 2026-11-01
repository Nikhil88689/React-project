import type { Prisma } from '@prisma/client';
import {
  STAGE_LABELS,
  STAGE_TYPES,
  applicationListQuerySchema,
  type CandidateSource,
  type MoveStageInput,
  type PipelineCardDTO,
  type PipelineColumnDTO,
  type StageHistoryDTO,
} from '@recruitflow/shared';
import type { z } from 'zod';
import { audit } from '../../lib/audit';
import { invalidateCompanyCache } from '../../lib/cache';
import { errors } from '../../lib/errors';
import { publish } from '../../lib/events';
import { enqueue } from '../../lib/queue';
import { prisma } from '../../lib/prisma';
import type { CompanyAuth } from '../../middleware/auth';

type PipelineQuery = z.infer<typeof applicationListQuerySchema>;

const cardInclude = (now: Date) =>
  ({
    candidate: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        headline: true,
        experienceYears: true,
        skills: { select: { name: true }, orderBy: { years: 'desc' }, take: 3 },
      },
    },
    job: { select: { id: true, title: true } },
    interviews: {
      where: { status: 'SCHEDULED', startsAt: { gte: now } },
      orderBy: { startsAt: 'asc' },
      take: 1,
      select: { id: true, startsAt: true, title: true },
    },
  }) satisfies Prisma.ApplicationInclude;

type CardRow = Prisma.ApplicationGetPayload<{ include: ReturnType<typeof cardInclude> }>;

const toCard = (a: CardRow): PipelineCardDTO => ({
  id: a.id,
  candidateId: a.candidateId,
  candidateName: `${a.candidate.firstName} ${a.candidate.lastName}`,
  avatarUrl: a.candidate.avatarUrl,
  headline: a.candidate.headline,
  jobId: a.job.id,
  jobTitle: a.job.title,
  stageId: a.stageId,
  stageType: a.stageType,
  matchScore: a.matchScore,
  experienceYears: a.candidate.experienceYears,
  appliedAt: a.appliedAt.toISOString(),
  stageChangedAt: a.stageChangedAt.toISOString(),
  nextInterview: a.interviews[0]
    ? { id: a.interviews[0].id, startsAt: a.interviews[0].startsAt.toISOString(), title: a.interviews[0].title }
    : null,
  skills: a.candidate.skills.map((s) => s.name),
});

export async function getPipeline(auth: CompanyAuth, q: PipelineQuery): Promise<{ columns: PipelineColumnDTO[]; job: { id: string; title: string } | null }> {
  const base: Prisma.ApplicationWhereInput = {
    companyId: auth.companyId,
    ...(q.minMatch != null ? { matchScore: { gte: q.minMatch } } : {}),
    ...(q.search
      ? {
          candidate: {
            OR: [
              { firstName: { contains: q.search, mode: 'insensitive' } },
              { lastName: { contains: q.search, mode: 'insensitive' } },
            ],
          },
        }
      : {}),
  };
  const now = new Date();
  const orderBy: Prisma.ApplicationOrderByWithRelationInput[] = [{ matchScore: { sort: 'desc', nulls: 'last' } }, { stageChangedAt: 'desc' }];

  if (q.jobId) {
    const job = await prisma.job.findFirst({
      where: { id: q.jobId, companyId: auth.companyId },
      include: { stages: { orderBy: { order: 'asc' } } },
    });
    if (!job) throw errors.notFound('Job');
    const where = { ...base, jobId: job.id };
    const [counts, cardsPerStage] = await Promise.all([
      prisma.application.groupBy({ by: ['stageId'], where, _count: true }),
      Promise.all(
        job.stages.map((s) =>
          prisma.application.findMany({ where: { ...where, stageId: s.id }, include: cardInclude(now), orderBy, take: q.limitPerStage }),
        ),
      ),
    ]);
    const countMap = new Map(counts.map((c) => [c.stageId, c._count]));
    return {
      job: { id: job.id, title: job.title },
      columns: job.stages.map((s, i) => ({ id: s.id, name: s.name, type: s.type, total: countMap.get(s.id) ?? 0, cards: cardsPerStage[i].map(toCard) })),
    };
  }

  // Cross-job board: columns are canonical stage types.
  const where = { ...base, job: { status: { in: ['PUBLISHED', 'CLOSED'] } } } satisfies Prisma.ApplicationWhereInput;
  const [counts, cardsPerType] = await Promise.all([
    prisma.application.groupBy({ by: ['stageType'], where, _count: true }),
    Promise.all(
      STAGE_TYPES.map((t) =>
        prisma.application.findMany({ where: { ...where, stageType: t }, include: cardInclude(now), orderBy, take: q.limitPerStage }),
      ),
    ),
  ]);
  const countMap = new Map(counts.map((c) => [c.stageType, c._count]));
  return {
    job: null,
    columns: STAGE_TYPES.map((t, i) => ({ id: t, name: STAGE_LABELS[t], type: t, total: countMap.get(t) ?? 0, cards: cardsPerType[i].map(toCard) })),
  };
}

export async function createApplication(
  auth: CompanyAuth | { companyId: string; userId: null },
  input: { candidateId: string; jobId: string; source?: CandidateSource; answers?: Record<string, string>; trackingToken?: string },
) {
  const job = await prisma.job.findFirst({
    where: { id: input.jobId, companyId: auth.companyId },
    include: { stages: { orderBy: { order: 'asc' } } },
  });
  if (!job) throw errors.notFound('Job');
  const first = job.stages.find((s) => s.type === 'APPLIED') ?? job.stages[0];
  if (!first) throw errors.badRequest('This job has no hiring workflow configured');

  const duplicate = await prisma.application.findUnique({ where: { jobId_candidateId: { jobId: job.id, candidateId: input.candidateId } } });
  if (duplicate) throw errors.conflict('This candidate has already applied for this job', 'ALREADY_APPLIED', { applicationId: duplicate.id });

  const application = await prisma.application.create({
    data: {
      companyId: auth.companyId,
      jobId: job.id,
      candidateId: input.candidateId,
      stageId: first.id,
      stageType: first.type,
      source: input.source ?? 'OTHER',
      answers: input.answers ?? {},
      trackingToken: input.trackingToken,
      history: { create: { toStageId: first.id, toStageType: first.type, changedById: auth.userId } },
    },
    include: { candidate: { select: { firstName: true, lastName: true } } },
  });

  await audit({
    companyId: auth.companyId,
    actorId: auth.userId,
    action: 'CREATE_APPLICATION',
    entityType: 'candidate',
    entityId: input.candidateId,
    summary: `${application.candidate.firstName} ${application.candidate.lastName} applied for ${job.title}`,
    metadata: { applicationId: application.id, jobId: job.id },
  });
  await invalidateCompanyCache(auth.companyId);
  publish('candidate.applied', { companyId: auth.companyId, applicationId: application.id, candidateId: input.candidateId, jobId: job.id, actorId: auth.userId });
  await enqueue('ai.match', { applicationId: application.id });
  return application;
}

/**
 * Moves an application to another stage and records previous_stage → new_stage,
 * changed_by and changed_at. Accepts a concrete stageId or a canonical stageType
 * (cross-job board), which resolves to the first stage of that type in the job.
 */
export async function moveStage(auth: CompanyAuth, applicationId: string, input: MoveStageInput) {
  const app = await prisma.application.findFirst({
    where: { id: applicationId, companyId: auth.companyId },
    include: {
      stage: true,
      candidate: { select: { firstName: true, lastName: true } },
      job: { select: { id: true, title: true, stages: { orderBy: { order: 'asc' } } } },
    },
  });
  if (!app) throw errors.notFound('Application');

  const target = input.stageId
    ? app.job.stages.find((s) => s.id === input.stageId)
    : app.job.stages.find((s) => s.type === input.stageType);
  if (!target) throw errors.badRequest('That stage is not part of this job’s workflow', undefined, 'INVALID_STAGE');
  if (target.id === app.stageId) return { id: app.id, stageId: app.stageId, stageType: app.stageType, unchanged: true };

  const now = new Date();
  const [updated] = await prisma.$transaction([
    prisma.application.update({
      where: { id: app.id },
      data: {
        stageId: target.id,
        stageType: target.type,
        stageChangedAt: now,
        status: target.type === 'HIRED' ? 'HIRED' : target.type === 'REJECTED' ? 'REJECTED' : 'ACTIVE',
        hiredAt: target.type === 'HIRED' ? now : null,
        rejectedAt: target.type === 'REJECTED' ? now : null,
        rejectionReason: target.type === 'REJECTED' ? (input.rejectionReason ?? null) : null,
      },
    }),
    prisma.applicationStageHistory.create({
      data: {
        applicationId: app.id,
        fromStageId: app.stageId,
        fromStageType: app.stageType,
        toStageId: target.id,
        toStageType: target.type,
        changedById: auth.userId,
        changedAt: now,
      },
    }),
  ]);

  const actor = await prisma.user.findUnique({ where: { id: auth.userId }, select: { firstName: true, lastName: true } });
  const candidateName = `${app.candidate.firstName} ${app.candidate.lastName}`;
  await audit({
    companyId: auth.companyId,
    actorId: auth.userId,
    action: 'MOVE_CANDIDATE',
    entityType: 'candidate',
    entityId: app.candidateId,
    summary: `moved ${candidateName} to ${target.name}`,
    metadata: { applicationId: app.id, jobId: app.jobId, from: app.stage.name, to: target.name },
  });
  await invalidateCompanyCache(auth.companyId);
  publish('application.moved', {
    companyId: auth.companyId,
    applicationId: app.id,
    candidateId: app.candidateId,
    candidateName,
    jobId: app.jobId,
    jobTitle: app.job.title,
    fromStageName: app.stage.name,
    toStageName: target.name,
    toStageType: target.type,
    actorId: auth.userId,
    actorName: actor ? `${actor.firstName} ${actor.lastName}` : null,
  });
  return { id: updated.id, stageId: updated.stageId, stageType: updated.stageType, unchanged: false };
}

export async function getHistory(auth: CompanyAuth, applicationId: string): Promise<StageHistoryDTO[]> {
  const app = await prisma.application.findFirst({ where: { id: applicationId, companyId: auth.companyId }, select: { id: true } });
  if (!app) throw errors.notFound('Application');
  const rows = await prisma.applicationStageHistory.findMany({
    where: { applicationId },
    orderBy: { changedAt: 'asc' },
    include: {
      fromStage: { select: { name: true } },
      toStage: { select: { name: true } },
      changedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  return rows.map((h) => ({
    id: h.id,
    fromStageName: h.fromStage?.name ?? null,
    toStageName: h.toStage.name,
    changedAt: h.changedAt.toISOString(),
    changedBy: h.changedBy ? { id: h.changedBy.id, name: `${h.changedBy.firstName} ${h.changedBy.lastName}` } : null,
  }));
}

export async function listForSelect(auth: CompanyAuth, search?: string) {
  const rows = await prisma.application.findMany({
    where: {
      companyId: auth.companyId,
      status: 'ACTIVE',
      ...(search
        ? { candidate: { OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }] } }
        : {}),
    },
    take: 20,
    orderBy: { stageChangedAt: 'desc' },
    include: { candidate: { select: { firstName: true, lastName: true, email: true } }, job: { select: { title: true } }, stage: { select: { name: true } } },
  });
  return rows.map((a) => ({
    id: a.id,
    candidateId: a.candidateId,
    candidateName: `${a.candidate.firstName} ${a.candidate.lastName}`,
    email: a.candidate.email,
    jobTitle: a.job.title,
    stageName: a.stage.name,
  }));
}
