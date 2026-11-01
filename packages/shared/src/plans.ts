export const PLAN_TIERS = ['STARTER', 'GROWTH', 'BUSINESS'] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export interface PlanLimits {
  activeJobs: number;
  teamMembers: number;
  candidates: number;
  aiAnalyses: number;
  storageMb: number;
}

export interface Plan {
  tier: PlanTier;
  name: string;
  priceMonthly: number;
  currency: 'INR';
  tagline: string;
  limits: PlanLimits;
  features: string[];
}

export const PLANS: Record<PlanTier, Plan> = {
  STARTER: {
    tier: 'STARTER',
    name: 'Starter',
    priceMonthly: 1999,
    currency: 'INR',
    tagline: 'For small teams making their first hires',
    limits: { activeJobs: 10, teamMembers: 3, candidates: 1000, aiAnalyses: 100, storageMb: 1024 },
    features: ['Hiring pipeline', 'Careers page', 'Interview scheduling', 'Email templates'],
  },
  GROWTH: {
    tier: 'GROWTH',
    name: 'Growth',
    priceMonthly: 4999,
    currency: 'INR',
    tagline: 'For scaling teams hiring every month',
    limits: { activeJobs: 30, teamMembers: 15, candidates: 10000, aiAnalyses: 1000, storageMb: 10240 },
    features: ['Everything in Starter', 'AI matching & summaries', 'Analytics', 'Talent pools', 'Audit log'],
  },
  BUSINESS: {
    tier: 'BUSINESS',
    name: 'Business',
    priceMonthly: 9999,
    currency: 'INR',
    tagline: 'For organizations with complex hiring',
    limits: { activeJobs: 200, teamMembers: 100, candidates: 100000, aiAnalyses: 10000, storageMb: 102400 },
    features: ['Everything in Growth', 'Unlimited workflows', 'Priority support', 'SSO (coming soon)'],
  },
};
