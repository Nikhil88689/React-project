import { PLANS, type PlanLimits, type PlanTier } from '@recruitflow/shared';
import { errors } from '../../lib/errors';
import { prisma } from '../../lib/prisma';

export async function getSubscription(companyId: string) {
  const sub = await prisma.subscription.findUnique({ where: { companyId } });
  if (sub) return sub;
  return prisma.subscription.create({
    data: { companyId, plan: 'STARTER', status: 'TRIALING', currentPeriodEnd: new Date(Date.now() + 14 * 86400_000) },
  });
}

export async function getUsage(companyId: string, periodStart?: Date): Promise<Record<keyof PlanLimits, number>> {
  const start = periodStart ?? (await getSubscription(companyId)).currentPeriodStart;
  const [activeJobs, members, invites, candidates, aiAnalyses, storage] = await Promise.all([
    prisma.job.count({ where: { companyId, status: 'PUBLISHED' } }),
    prisma.companyMember.count({ where: { companyId, status: { not: 'DISABLED' } } }),
    prisma.invitation.count({ where: { companyId, acceptedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.candidate.count({ where: { companyId } }),
    prisma.aiAnalysis.count({ where: { companyId, createdAt: { gte: start }, kind: { not: 'RESUME_PARSE' } } }),
    prisma.file.aggregate({ where: { companyId }, _sum: { size: true } }),
  ]);
  return {
    activeJobs,
    teamMembers: members + invites,
    candidates,
    aiAnalyses,
    storageMb: Math.round(((storage._sum.size ?? 0) / (1024 * 1024)) * 10) / 10,
  };
}

const LIMIT_LABELS: Record<keyof PlanLimits, string> = {
  activeJobs: 'active jobs',
  teamMembers: 'team members',
  candidates: 'candidates',
  aiAnalyses: 'AI analyses this billing period',
  storageMb: 'MB of storage',
};

/** Enforces subscription limits server-side; returns 402 PLAN_LIMIT_REACHED when exceeded. */
export async function assertWithinLimit(companyId: string, key: keyof PlanLimits, increment = 1) {
  const sub = await getSubscription(companyId);
  const plan = PLANS[sub.plan as PlanTier];
  const usage = await getUsage(companyId, sub.currentPeriodStart);
  if (usage[key] + increment > plan.limits[key]) {
    throw errors.planLimit(
      `Your ${plan.name} plan allows ${plan.limits[key]} ${LIMIT_LABELS[key]}. Upgrade to add more.`,
      { limit: plan.limits[key], usage: usage[key], key },
    );
  }
}
