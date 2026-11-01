import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth';
import { jobsController as c } from './jobs.controller';

export const jobsRouter = Router();
jobsRouter.use(authenticate);

jobsRouter.get('/', requirePermission('jobs:view'), c.list);
jobsRouter.post('/', requirePermission('jobs:create'), c.create);
jobsRouter.get('/:id', requirePermission('jobs:view'), c.get);
jobsRouter.patch('/:id', requirePermission('jobs:update'), c.update);
jobsRouter.delete('/:id', requirePermission('jobs:delete'), c.remove);
jobsRouter.post('/:id/publish', requirePermission('jobs:publish'), c.publish);
jobsRouter.post('/:id/close', requirePermission('jobs:publish'), c.close);
jobsRouter.post('/:id/duplicate', requirePermission('jobs:create'), c.duplicate);
