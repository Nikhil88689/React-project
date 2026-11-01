import type { Request, Response } from 'express';
import { Router } from 'express';
import Stripe from 'stripe';
import { PLANS, changePlanSchema, type BillingOverviewDTO, type PlanTier } from '@recruitflow/shared';
import { env, features } from '../../config/env';
import { audit } from '../../lib/audit';
import { errors } from '../../lib/errors';
import { ok, parse } from '../../lib/http';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { authenticate, companyAuth, requirePermission } from '../../middleware/auth';
import { getSubscription, getUsage } from './limits';

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;
const PRICE_IDS: Record<PlanTier, string | undefined> = {
  STARTER: env.STRIPE_PRICE_STARTER,
  GROWTH: env.STRIPE_PRICE_GROWTH,
  BUSINESS: env.STRIPE_PRICE_BUSINESS,
};

export const billingRouter = Router();
billingRouter.use(authenticate);

billingRouter.get('/', requirePermission('billing:view'), async (req, res) => {
  const auth = companyAuth(req);
  const sub = await getSubscription(auth.companyId);
  const plan = PLANS[sub.plan as PlanTier];
  const [usage, payments] = await Promise.all([
    getUsage(auth.companyId, sub.currentPeriodStart),
    prisma.payment.findMany({ where: { companyId: auth.companyId }, orderBy: { createdAt: 'desc' }, take: 12 }),
  ]);
  const dto: BillingOverviewDTO = {
    plan: sub.plan as PlanTier,
    status: sub.status,
    priceMonthly: plan.priceMonthly,
    currency: plan.currency,
    currentPeriodStart: sub.currentPeriodStart.toISOString(),
    currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    limits: plan.limits,
    usage,
    stripeEnabled: features.stripe,
    payments: payments.map((p) => ({ id: p.id, amount: p.amount, currency: p.currency, status: p.status, description: p.description, paidAt: p.paidAt?.toISOString() ?? null })),
  };
  ok(res, dto);
});

async function applyPlan(companyId: string, plan: PlanTier, actorId: string | null, stripeIds?: { customer?: string; subscription?: string }) {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  const previous = await getSubscription(companyId);
  await prisma.subscription.update({
    where: { companyId },
    data: {
      plan,
      status: 'ACTIVE',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      ...(stripeIds?.customer ? { stripeCustomerId: stripeIds.customer } : {}),
      ...(stripeIds?.subscription ? { stripeSubscriptionId: stripeIds.subscription } : {}),
    },
  });
  await prisma.payment.create({
    data: { companyId, amount: PLANS[plan].priceMonthly, currency: 'INR', status: 'PAID', description: `${PLANS[plan].name} plan — monthly`, paidAt: now },
  });
  await audit({ companyId, actorId, action: 'CHANGE_PLAN', entityType: 'subscription', entityId: previous.id, summary: `changed plan from ${PLANS[previous.plan as PlanTier].name} to ${PLANS[plan].name}`, metadata: { from: previous.plan, to: plan } });
}

billingRouter.post('/change-plan', requirePermission('billing:manage'), async (req, res) => {
  const auth = companyAuth(req);
  const { plan } = parse(changePlanSchema, req.body);
  const target = PLANS[plan];
  const usage = await getUsage(auth.companyId);
  const over = (Object.keys(target.limits) as (keyof typeof target.limits)[]).filter((k) => k !== 'aiAnalyses' && usage[k] > target.limits[k]);
  if (over.length) {
    throw errors.conflict(`Your current usage exceeds the ${target.name} plan limits (${over.join(', ')}). Reduce usage before downgrading.`, 'USAGE_EXCEEDS_PLAN', { over });
  }

  if (stripe) {
    const sub = await getSubscription(auth.companyId);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.userId } });
    const priceId = PRICE_IDS[plan];
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: sub.stripeCustomerId ?? undefined,
      customer_email: sub.stripeCustomerId ? undefined : user.email,
      line_items: [
        priceId
          ? { price: priceId, quantity: 1 }
          : { quantity: 1, price_data: { currency: 'inr', unit_amount: target.priceMonthly * 100, recurring: { interval: 'month' }, product_data: { name: `RecruitFlow ${target.name}` } } },
      ],
      metadata: { companyId: auth.companyId, plan, actorId: auth.userId },
      success_url: `${env.APP_URL}/settings/billing?checkout=success`,
      cancel_url: `${env.APP_URL}/settings/billing?checkout=cancelled`,
    });
    return ok(res, { checkoutUrl: session.url });
  }

  await applyPlan(auth.companyId, plan, auth.userId);
  ok(res, { checkoutUrl: null, plan });
});

billingRouter.post('/cancel', requirePermission('billing:manage'), async (req, res) => {
  const auth = companyAuth(req);
  const sub = await getSubscription(auth.companyId);
  if (stripe && sub.stripeSubscriptionId) {
    await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: !sub.cancelAtPeriodEnd });
  }
  const updated = await prisma.subscription.update({ where: { companyId: auth.companyId }, data: { cancelAtPeriodEnd: !sub.cancelAtPeriodEnd } });
  ok(res, { cancelAtPeriodEnd: updated.cancelAtPeriodEnd });
});

billingRouter.post('/portal', requirePermission('billing:manage'), async (req, res) => {
  const auth = companyAuth(req);
  const sub = await getSubscription(auth.companyId);
  if (!stripe || !sub.stripeCustomerId) throw errors.badRequest('Billing portal is available once Stripe billing is set up', undefined, 'STRIPE_NOT_CONFIGURED');
  const session = await stripe.billingPortal.sessions.create({ customer: sub.stripeCustomerId, return_url: `${env.APP_URL}/settings/billing` });
  ok(res, { url: session.url });
});

/** Stripe webhook — mounted with a raw body parser before express.json(). */
export async function billingWebhookHandler(req: Request, res: Response) {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) return res.status(400).send('Stripe not configured');
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, req.headers['stripe-signature'] as string, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.warn({ err }, 'Invalid Stripe webhook signature');
    return res.status(400).send('Invalid signature');
  }
  if (event.type === 'checkout.session.completed') {
    const s = event.data.object;
    const companyId = s.metadata?.companyId;
    const plan = s.metadata?.plan as PlanTier | undefined;
    if (companyId && plan && PLANS[plan]) {
      await applyPlan(companyId, plan, s.metadata?.actorId ?? null, {
        customer: typeof s.customer === 'string' ? s.customer : undefined,
        subscription: typeof s.subscription === 'string' ? s.subscription : undefined,
      });
    }
  }
  res.json({ received: true });
}
