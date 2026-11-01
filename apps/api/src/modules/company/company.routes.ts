import { Router } from 'express';
import { EMAIL_TEMPLATE_KEYS, companyUpdateSchema, profileUpdateSchema, workflowUpdateSchema } from '@recruitflow/shared';
import { z } from 'zod';
import { audit } from '../../lib/audit';
import { errors } from '../../lib/errors';
import { ok, param, parse } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { authenticate, companyAuth, requireAuth, requirePermission } from '../../middleware/auth';
import { buildAuthUser } from '../auth/auth.service';

export const companyRouter = Router();
companyRouter.use(authenticate);

companyRouter.get('/', async (req, res) => {
  const auth = companyAuth(req);
  const company = await prisma.company.findUniqueOrThrow({ where: { id: auth.companyId } });
  ok(res, company);
});

companyRouter.patch('/', requirePermission('company:manage'), async (req, res) => {
  const auth = companyAuth(req);
  const input = parse(companyUpdateSchema, req.body);
  const company = await prisma.company.update({ where: { id: auth.companyId }, data: input });
  await audit({ companyId: auth.companyId, actorId: auth.userId, action: 'UPDATE_COMPANY', entityType: 'company', entityId: company.id, summary: 'updated company settings', metadata: { fields: Object.keys(input) } });
  ok(res, company);
});

companyRouter.get('/workflow', async (req, res) => {
  const auth = companyAuth(req);
  ok(res, await prisma.companyStage.findMany({ where: { companyId: auth.companyId }, orderBy: { order: 'asc' } }));
});

companyRouter.put('/workflow', requirePermission('company:manage'), async (req, res) => {
  const auth = companyAuth(req);
  const { stages } = parse(workflowUpdateSchema, req.body);
  await prisma.$transaction([
    prisma.companyStage.deleteMany({ where: { companyId: auth.companyId } }),
    prisma.companyStage.createMany({ data: stages.map((s, order) => ({ companyId: auth.companyId, name: s.name, type: s.type, order })) }),
  ]);
  await audit({ companyId: auth.companyId, actorId: auth.userId, action: 'UPDATE_WORKFLOW', entityType: 'company', entityId: auth.companyId, summary: 'updated the default hiring workflow' });
  ok(res, await prisma.companyStage.findMany({ where: { companyId: auth.companyId }, orderBy: { order: 'asc' } }));
});

companyRouter.get('/email-templates', requirePermission('messages:send'), async (req, res) => {
  const auth = companyAuth(req);
  ok(res, await prisma.emailTemplate.findMany({ where: { companyId: auth.companyId }, orderBy: { name: 'asc' } }));
});

companyRouter.put('/email-templates/:key', requirePermission('company:manage'), async (req, res) => {
  const auth = companyAuth(req);
  const key = parse(z.enum(EMAIL_TEMPLATE_KEYS), param(req.params.key));
  const body = parse(z.object({ subject: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(20000) }), req.body);
  const existing = await prisma.emailTemplate.findUnique({ where: { companyId_key: { companyId: auth.companyId, key } } });
  if (!existing) throw errors.notFound('Template');
  ok(res, await prisma.emailTemplate.update({ where: { id: existing.id }, data: body }));
});

export const usersRouter = Router();
usersRouter.use(authenticate);

usersRouter.patch('/me', async (req, res) => {
  const auth = requireAuth(req);
  const { title, ...input } = parse(profileUpdateSchema, req.body);
  await prisma.user.update({ where: { id: auth.userId }, data: input });
  if (title !== undefined && auth.companyId) {
    await prisma.companyMember.update({ where: { companyId_userId: { companyId: auth.companyId, userId: auth.userId } }, data: { title } });
  }
  ok(res, await buildAuthUser(auth.userId, auth.companyId));
});
