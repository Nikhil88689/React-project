import { Router } from 'express';
import { aiAssistantSchema, aiJobDescriptionSchema, aiMatchSchema, aiQuestionsSchema } from '@recruitflow/shared';
import { z } from 'zod';
import { features } from '../../config/env';
import { errors } from '../../lib/errors';
import { ok, param, parse } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { enqueue } from '../../lib/queue';
import { authenticate, companyAuth, requirePermission } from '../../middleware/auth';
import { aiLimiter } from '../../middleware/rateLimit';
import { assertWithinLimit } from '../billing/limits';
import { candidatesService } from '../candidates/candidates.service';
import { assistant, candidateInsights, generateJD, interviewQuestions, matchApplication } from './ai.service';

export const aiRouter = Router();
aiRouter.use(authenticate, aiLimiter, requirePermission('ai:use'));

aiRouter.get('/status', (_req, res) => {
  ok(res, { engine: features.llm ? 'llm' : 'heuristic' });
});

aiRouter.post('/job-description', requirePermission('jobs:create'), async (req, res) => {
  ok(res, await generateJD(companyAuth(req), parse(aiJobDescriptionSchema, req.body)));
});

aiRouter.post('/match', requirePermission('candidates:view'), async (req, res) => {
  const auth = companyAuth(req);
  const input = parse(aiMatchSchema, req.body);
  await candidatesService.assertAccess(auth, input.candidateId);
  const app = await prisma.application.findFirst({ where: { candidateId: input.candidateId, jobId: input.jobId, companyId: auth.companyId } });
  if (!app) throw errors.notFound('Application');
  if (input.refresh) await assertWithinLimit(auth.companyId, 'aiAnalyses');
  ok(res, await matchApplication(app.id, { refresh: input.refresh }));
});

aiRouter.get('/candidates/:id/insights', requirePermission('candidates:view'), async (req, res) => {
  const q = parse(z.object({ jobId: z.string().optional(), refresh: z.enum(['true', 'false']).optional() }), req.query);
  ok(res, await candidateInsights(companyAuth(req), param(req.params.id), q.jobId, q.refresh === 'true'));
});

aiRouter.post('/candidates/:id/reparse', requirePermission('candidates:update'), async (req, res) => {
  const auth = companyAuth(req);
  const candidate = await candidatesService.assertAccess(auth, param(req.params.id));
  const file = await prisma.file.findFirst({ where: { candidateId: candidate.id, kind: 'RESUME', status: 'UPLOADED' }, orderBy: { createdAt: 'desc' } });
  if (!file) throw errors.badRequest('This candidate has no resume on file', undefined, 'NO_RESUME');
  await prisma.candidate.update({ where: { id: candidate.id }, data: { parseStatus: 'PROCESSING' } });
  await enqueue('resume.process', { fileId: file.id, candidateId: candidate.id, companyId: auth.companyId });
  ok(res, { queued: true }, 202);
});

aiRouter.post('/interview-questions', async (req, res) => {
  ok(res, await interviewQuestions(companyAuth(req), parse(aiQuestionsSchema, req.body)));
});

aiRouter.post('/assistant', async (req, res) => {
  ok(res, await assistant(companyAuth(req), parse(aiAssistantSchema, req.body)));
});
