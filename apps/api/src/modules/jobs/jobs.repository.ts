import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const summaryInclude = {
  hiringManager: { select: { id: true, firstName: true, lastName: true } },
  _count: { select: { applications: true } },
} satisfies Prisma.JobInclude;

/** Data access for jobs. Every query is tenant-scoped by companyId. */
export const jobsRepository = {
  list(where: Prisma.JobWhereInput, orderBy: Prisma.JobOrderByWithRelationInput, skip: number, take: number) {
    return prisma.job.findMany({ where, orderBy, skip, take, include: summaryInclude });
  },

  count(where: Prisma.JobWhereInput) {
    return prisma.job.count({ where });
  },

  statusCounts(companyId: string) {
    return prisma.job.groupBy({ by: ['status'], where: { companyId }, _count: true });
  },

  newApplicationCounts(jobIds: string[], since: Date) {
    return prisma.application.groupBy({
      by: ['jobId'],
      where: { jobId: { in: jobIds }, appliedAt: { gte: since } },
      _count: true,
    });
  },

  findById(companyId: string, id: string) {
    return prisma.job.findFirst({
      where: { id, companyId },
      include: { ...summaryInclude, skills: true, stages: { orderBy: { order: 'asc' } } },
    });
  },

  findPublishedBySlug(slug: string) {
    return prisma.job.findFirst({
      where: { slug, status: 'PUBLISHED' },
      include: { skills: true, company: true },
    });
  },

  stageCounts(jobId: string) {
    return prisma.application.groupBy({ by: ['stageId'], where: { jobId }, _count: true });
  },

  companyStages(companyId: string) {
    return prisma.companyStage.findMany({ where: { companyId }, orderBy: { order: 'asc' } });
  },

  create(data: Prisma.JobCreateInput) {
    return prisma.job.create({ data });
  },

  update(id: string, data: Prisma.JobUpdateInput) {
    return prisma.job.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.job.delete({ where: { id } });
  },
};
