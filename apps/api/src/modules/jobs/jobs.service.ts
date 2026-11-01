import type { Prisma } from '@prisma/client';
import type { CreateJobInput, UpdateJobInput, WorkflowStageInput } from '@recruitflow/shared';
import { jobListQuerySchema } from '@recruitflow/shared';
import type { z } from 'zod';
import { audit } from '../../lib/audit';
import { invalidateCompanyCache } from '../../lib/cache';
import { errors } from '../../lib/errors';
import { publish } from '../../lib/events';
import { sanitizeJobDescription } from '../../lib/html';
import { prisma } from '../../lib/prisma';
import { uniqueSlug } from '../../lib/slug';
import type { CompanyAuth } from '../../middleware/auth';
import { normalizeSkill } from '../ai/engine/skills';
import { assertWithinLimit } from '../billing/limits';
import { toJobDTO, toJobSummary } from './jobs.mapper';
import { jobsRepository as repo } from './jobs.repository';

type JobListQuery = z.infer<typeof jobListQuerySchema>;

export const jobsService = {
  async list(auth: CompanyAuth, q: JobListQuery) {
    const where: Prisma.JobWhereInput = {
      companyId: auth.companyId,
      ...(q.status ? { status: q.status } : { status: { not: 'ARCHIVED' } }),
      ...(q.department ? { department: q.department } : {}),
      ...(q.employmentType ? { employmentType: q.employmentType } : {}),
      ...(q.location ? { location: { contains: q.location, mode: 'insensitive' } } : {}),
      ...(q.createdAfter ? { createdAt: { gte: q.createdAfter } } : {}),
      ...(q.search
        ? {
            OR: [
              { title: { contains: q.search, mode: 'insensitive' } },
              { department: { contains: q.search, mode: 'insensitive' } },
              { skills: { some: { name: { contains: q.search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.JobOrderByWithRelationInput =
      q.sort === 'title' ? { title: 'asc' } : q.sort === 'applications' ? { applications: { _count: 'desc' } } : { createdAt: 'desc' };

    const [items, total, statusGroups] = await Promise.all([
      repo.list(where, orderBy, (q.page - 1) * q.limit, q.limit),
      repo.count(where),
      repo.statusCounts(auth.companyId),
    ]);
    const fresh = await repo.newApplicationCounts(items.map((j) => j.id), new Date(Date.now() - 7 * 86400_000));
    const freshMap = new Map(fresh.map((f) => [f.jobId, f._count]));

    const statusCounts = Object.fromEntries(statusGroups.map((g) => [g.status, g._count]));
    return { items: items.map((j) => toJobSummary(j, freshMap.get(j.id) ?? 0)), total, statusCounts };
  },

  async get(auth: CompanyAuth, id: string) {
    const job = await repo.findById(auth.companyId, id);
    if (!job) throw errors.notFound('Job');
    const [counts, fresh] = await Promise.all([
      repo.stageCounts(job.id),
      repo.newApplicationCounts([job.id], new Date(Date.now() - 7 * 86400_000)),
    ]);
    return toJobDTO(job, Object.fromEntries(counts.map((c) => [c.stageId, c._count])), fresh[0]?._count ?? 0);
  },

  async create(auth: CompanyAuth, input: CreateJobInput) {
    const stages: WorkflowStageInput[] = input.stages ?? (await repo.companyStages(auth.companyId));
    const job = await repo.create({
      company: { connect: { id: auth.companyId } },
      createdBy: { connect: { id: auth.userId } },
      hiringManager: { connect: { id: auth.userId } },
      title: input.title,
      slug: uniqueSlug(input.title),
      department: input.department,
      location: input.location,
      workMode: input.workMode,
      employmentType: input.employmentType,
      experienceLevel: input.experienceLevel,
      experienceMin: input.experienceMin ?? null,
      experienceMax: input.experienceMax ?? null,
      salaryMin: input.salaryMin ?? null,
      salaryMax: input.salaryMax ?? null,
      salaryCurrency: input.salaryCurrency,
      openings: input.openings,
      description: sanitizeJobDescription(input.description),
      questions: input.questions,
      skills: { create: input.skills.map((s) => ({ name: normalizeSkill(s.name), years: s.years ?? null, importance: s.importance })) },
      stages: { create: stages.map((s, order) => ({ name: s.name, type: s.type, order })) },
    });
    await audit({ companyId: auth.companyId, actorId: auth.userId, action: 'CREATE_JOB', entityType: 'job', entityId: job.id, summary: `created job "${job.title}"` });
    return this.get(auth, job.id);
  },

  async update(auth: CompanyAuth, id: string, input: UpdateJobInput) {
    const existing = await repo.findById(auth.companyId, id);
    if (!existing) throw errors.notFound('Job');

    await prisma.$transaction(async (tx) => {
      const { skills, stages, ...fields } = input;
      await tx.job.update({
        where: { id },
        data: { ...fields, description: fields.description ? sanitizeJobDescription(fields.description) : undefined, questions: fields.questions },
      });

      if (skills) {
        await tx.jobSkill.deleteMany({ where: { jobId: id } });
        await tx.jobSkill.createMany({
          data: skills.map((s) => ({ jobId: id, name: normalizeSkill(s.name), years: s.years ?? null, importance: s.importance })),
        });
      }

      if (stages) {
        const keepIds = new Set(stages.filter((s) => s.id).map((s) => s.id!));
        const removed = existing.stages.filter((s) => !keepIds.has(s.id));
        if (removed.length) {
          const inUse = await tx.application.count({ where: { stageId: { in: removed.map((s) => s.id) } } });
          if (inUse) throw errors.conflict('Move candidates out of a stage before removing it', 'STAGE_IN_USE');
          await tx.jobStage.deleteMany({ where: { id: { in: removed.map((s) => s.id) } } });
        }
        for (const [order, s] of stages.entries()) {
          if (s.id && existing.stages.some((e) => e.id === s.id)) {
            await tx.jobStage.update({ where: { id: s.id }, data: { name: s.name, type: s.type, order } });
            await tx.application.updateMany({ where: { stageId: s.id }, data: { stageType: s.type } });
          } else {
            await tx.jobStage.create({ data: { jobId: id, name: s.name, type: s.type, order } });
          }
        }
      }
    });

    await audit({ companyId: auth.companyId, actorId: auth.userId, action: 'UPDATE_JOB', entityType: 'job', entityId: id, summary: `updated job "${input.title ?? existing.title}"` });
    return this.get(auth, id);
  },

  async publish(auth: CompanyAuth, id: string) {
    const job = await repo.findById(auth.companyId, id);
    if (!job) throw errors.notFound('Job');
    if (job.status === 'PUBLISHED') return this.get(auth, id);
    const desc = job.description as { about?: string };
    if (!desc?.about?.replace(/<[^>]+>/g, '').trim()) throw errors.badRequest('Add a job description before publishing', undefined, 'JOB_INCOMPLETE');
    await assertWithinLimit(auth.companyId, 'activeJobs');

    await repo.update(id, { status: 'PUBLISHED', publishedAt: job.publishedAt ?? new Date(), closedAt: null });
    await audit({ companyId: auth.companyId, actorId: auth.userId, action: 'PUBLISH_JOB', entityType: 'job', entityId: id, summary: `published job "${job.title}"` });
    await invalidateCompanyCache(auth.companyId);
    publish('job.published', { companyId: auth.companyId, jobId: id, actorId: auth.userId });
    return this.get(auth, id);
  },

  async close(auth: CompanyAuth, id: string) {
    const job = await repo.findById(auth.companyId, id);
    if (!job) throw errors.notFound('Job');
    await repo.update(id, { status: 'CLOSED', closedAt: new Date() });
    await audit({ companyId: auth.companyId, actorId: auth.userId, action: 'CLOSE_JOB', entityType: 'job', entityId: id, summary: `closed job "${job.title}"` });
    await invalidateCompanyCache(auth.companyId);
    return this.get(auth, id);
  },

  async duplicate(auth: CompanyAuth, id: string) {
    const job = await this.get(auth, id);
    return this.create(auth, {
      ...job,
      title: `${job.title} (copy)`,
      stages: job.stages.map((s) => ({ name: s.name, type: s.type })),
      skills: job.skills.map((s) => ({ name: s.name, years: s.years, importance: s.importance })),
    });
  },

  async remove(auth: CompanyAuth, id: string) {
    const job = await repo.findById(auth.companyId, id);
    if (!job) throw errors.notFound('Job');
    if (job._count.applications > 0) {
      throw errors.conflict('This job has applications. Close it instead so hiring history is preserved.', 'JOB_HAS_APPLICATIONS');
    }
    await repo.delete(id);
    await audit({ companyId: auth.companyId, actorId: auth.userId, action: 'DELETE_JOB', entityType: 'job', entityId: id, summary: `deleted job "${job.title}"` });
  },
};
