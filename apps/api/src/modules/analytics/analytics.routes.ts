import { Router } from 'express';
import { analyticsQuerySchema } from '@recruitflow/shared';
import { ok, parse } from '../../lib/http';
import { authenticate, companyAuth, requirePermission } from '../../middleware/auth';
import { getAnalytics, getDashboard } from './analytics.service';

export const analyticsRouter = Router();
analyticsRouter.use(authenticate, requirePermission('analytics:view'));

analyticsRouter.get('/dashboard', async (req, res) => {
  const q = parse(analyticsQuerySchema, req.query);
  ok(res, await getDashboard(companyAuth(req), q.range));
});

analyticsRouter.get('/', async (req, res) => {
  const q = parse(analyticsQuerySchema, req.query);
  ok(res, await getAnalytics(companyAuth(req), q.range, q.jobId));
});
