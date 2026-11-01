import type { Request, Response } from 'express';
import { candidateCreateSchema, candidateListQuerySchema, candidateUpdateSchema, noteSchema } from '@recruitflow/shared';
import { ok, param, parse } from '../../lib/http';
import { companyAuth } from '../../middleware/auth';
import { candidatesService as svc } from './candidates.service';

export const candidatesController = {
  async list(req: Request, res: Response) {
    const q = parse(candidateListQuerySchema, req.query);
    const { items, nextCursor, total } = await svc.list(companyAuth(req), q);
    ok(res, items, 200, { nextCursor, limit: q.limit, total });
  },
  async get(req: Request, res: Response) {
    ok(res, await svc.get(companyAuth(req), param(req.params.id)));
  },
  async create(req: Request, res: Response) {
    ok(res, await svc.create(companyAuth(req), parse(candidateCreateSchema, req.body)), 201);
  },
  async update(req: Request, res: Response) {
    ok(res, await svc.update(companyAuth(req), param(req.params.id), parse(candidateUpdateSchema, req.body)));
  },
  async remove(req: Request, res: Response) {
    await svc.remove(companyAuth(req), param(req.params.id));
    ok(res, { ok: true });
  },
  async notes(req: Request, res: Response) {
    ok(res, await svc.listNotes(companyAuth(req), param(req.params.id)));
  },
  async addNote(req: Request, res: Response) {
    const { body } = parse(noteSchema, req.body);
    await svc.addNote(companyAuth(req), param(req.params.id), body);
    ok(res, await svc.listNotes(companyAuth(req), param(req.params.id)), 201);
  },
  async deleteNote(req: Request, res: Response) {
    await svc.deleteNote(companyAuth(req), param(req.params.id), param(req.params.noteId));
    ok(res, { ok: true });
  },
  async feedback(req: Request, res: Response) {
    ok(res, await svc.feedback(companyAuth(req), param(req.params.id)));
  },
  async timeline(req: Request, res: Response) {
    ok(res, await svc.timeline(companyAuth(req), param(req.params.id)));
  },
};
