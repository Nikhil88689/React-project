import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/auth';
import { candidatesController as c } from './candidates.controller';

export const candidatesRouter = Router();
candidatesRouter.use(authenticate);

candidatesRouter.get('/', requirePermission('candidates:view'), c.list);
candidatesRouter.post('/', requirePermission('candidates:create'), c.create);
candidatesRouter.get('/:id', requirePermission('candidates:view'), c.get);
candidatesRouter.patch('/:id', requirePermission('candidates:update'), c.update);
candidatesRouter.delete('/:id', requirePermission('candidates:delete'), c.remove);
candidatesRouter.get('/:id/notes', requirePermission('candidates:notes'), c.notes);
candidatesRouter.post('/:id/notes', requirePermission('candidates:notes'), c.addNote);
candidatesRouter.delete('/:id/notes/:noteId', requirePermission('candidates:notes'), c.deleteNote);
candidatesRouter.get('/:id/feedback', requirePermission('candidates:view'), c.feedback);
candidatesRouter.get('/:id/timeline', requirePermission('candidates:view'), c.timeline);
