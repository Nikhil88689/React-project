import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { candidateDetailInclude, candidateSummaryInclude } from './candidates.mapper';

export const candidatesRepository = {
  findPage(where: Prisma.CandidateWhereInput, limit: number, cursor?: string) {
    return prisma.candidate.findMany({
      where,
      include: candidateSummaryInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  },

  count(where: Prisma.CandidateWhereInput) {
    return prisma.candidate.count({ where });
  },

  findDetail(where: Prisma.CandidateWhereInput) {
    return prisma.candidate.findFirst({ where, include: candidateDetailInclude });
  },

  findOne(where: Prisma.CandidateWhereInput) {
    return prisma.candidate.findFirst({ where });
  },

  create(data: Prisma.CandidateCreateInput) {
    return prisma.candidate.create({ data });
  },

  update(id: string, data: Prisma.CandidateUpdateInput) {
    return prisma.candidate.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.candidate.delete({ where: { id } });
  },
};
