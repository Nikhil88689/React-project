import { Router } from 'express';
import { createInterviewSchema, feedbackSchema, interviewListQuerySchema, updateInterviewSchema } from '@recruitflow/shared';
import { z } from 'zod';
import { ok, param, parse } from '../../lib/http';
import { authenticate, companyAuth, requirePermission } from '../../middleware/auth';
import { interviewsService as svc } from './interviews.service';

export const interviewsRouter = Router();
interviewsRouter.use(authenticate);

interviewsRouter.get('/', requirePermission('interviews:view'), async (req, res) => {
  ok(res, await svc.list(companyAuth(req), parse(interviewListQuerySchema, req.query)));
});

interviewsRouter.get('/pending-feedback', requirePermission('interviews:view'), async (req, res) => {
  const { mine } = parse(z.object({ mine: z.enum(['true', 'false']).optional() }), req.query);
  ok(res, await svc.pendingFeedback(companyAuth(req), mine === 'true'));
});

interviewsRouter.post('/', requirePermission('interviews:create'), async (req, res) => {
  ok(res, await svc.create(companyAuth(req), parse(createInterviewSchema, req.body)), 201);
});

interviewsRouter.get('/:id', requirePermission('interviews:view'), async (req, res) => {
  ok(res, await svc.get(companyAuth(req), param(req.params.id)));
});

interviewsRouter.patch('/:id', requirePermission('interviews:create'), async (req, res) => {
  ok(res, await svc.update(companyAuth(req), param(req.params.id), parse(updateInterviewSchema, req.body)));
});

interviewsRouter.post('/:id/feedback', requirePermission('interviews:feedback'), async (req, res) => {
  const fb = await svc.submitFeedback(companyAuth(req), param(req.params.id), parse(feedbackSchema, req.body));
  ok(res, { id: fb.id, overallRating: fb.overallRating }, 201);
});
