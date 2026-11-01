import type { Request, Response } from 'express';
import { createJobSchema, jobListQuerySchema, updateJobSchema } from '@recruitflow/shared';
import { ok, pageMeta, param, parse } from '../../lib/http';
import { companyAuth } from '../../middleware/auth';
import { jobsService } from './jobs.service';

export const jobsController = {
  async list(req: Request, res: Response) {
    const q = parse(jobListQuerySchema, req.query);
    const { items, total, statusCounts } = await jobsService.list(companyAuth(req), q);
    ok(res, { items, statusCounts }, 200, pageMeta(q.page, q.limit, total));
  },
  async get(req: Request, res: Response) {
    ok(res, await jobsService.get(companyAuth(req), param(req.params.id)));
  },
  async create(req: Request, res: Response) {
    ok(res, await jobsService.create(companyAuth(req), parse(createJobSchema, req.body)), 201);
  },
  async update(req: Request, res: Response) {
    ok(res, await jobsService.update(companyAuth(req), param(req.params.id), parse(updateJobSchema, req.body)));
  },
  async publish(req: Request, res: Response) {
    ok(res, await jobsService.publish(companyAuth(req), param(req.params.id)));
  },
  async close(req: Request, res: Response) {
    ok(res, await jobsService.close(companyAuth(req), param(req.params.id)));
  },
  async duplicate(req: Request, res: Response) {
    ok(res, await jobsService.duplicate(companyAuth(req), param(req.params.id)), 201);
  },
  async remove(req: Request, res: Response) {
    await jobsService.remove(companyAuth(req), param(req.params.id));
    ok(res, { ok: true });
  },
};
