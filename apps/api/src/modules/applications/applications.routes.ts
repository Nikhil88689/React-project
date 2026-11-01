import { Router } from 'express';
import { applicationListQuerySchema, createApplicationSchema, moveStageSchema } from '@recruitflow/shared';
import { z } from 'zod';
import { ok, param, parse } from '../../lib/http';
import { authenticate, companyAuth, requirePermission } from '../../middleware/auth';
import { candidatesService } from '../candidates/candidates.service';
import { createApplication, getHistory, getPipeline, listForSelect, moveStage } from './applications.service';

export const applicationsRouter = Router();
applicationsRouter.use(authenticate);

applicationsRouter.get('/', requirePermission('applications:view'), async (req, res) => {
  ok(res, await getPipeline(companyAuth(req), parse(applicationListQuerySchema, req.query)));
});

applicationsRouter.get('/options', requirePermission('interviews:create'), async (req, res) => {
  const { search } = parse(z.object({ search: z.string().max(60).optional() }), req.query);
  ok(res, await listForSelect(companyAuth(req), search));
});

applicationsRouter.post('/', requirePermission('applications:move'), async (req, res) => {
  const auth = companyAuth(req);
  const input = parse(createApplicationSchema, req.body);
  await candidatesService.assertAccess(auth, input.candidateId);
  const app = await createApplication(auth, input);
  ok(res, { id: app.id }, 201);
});

applicationsRouter.patch('/:id/stage', requirePermission('applications:move'), async (req, res) => {
  ok(res, await moveStage(companyAuth(req), param(req.params.id), parse(moveStageSchema, req.body)));
});

applicationsRouter.get('/:id/history', requirePermission('applications:view'), async (req, res) => {
  ok(res, await getHistory(companyAuth(req), param(req.params.id)));
});
