import express, { Router } from 'express';
import { hasPermission, presignUploadSchema } from '@recruitflow/shared';
import { z } from 'zod';
import { verifyUrlParams } from '../../lib/crypto';
import { errors } from '../../lib/errors';
import { ok, param, parse } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { enqueue } from '../../lib/queue';
import { storage } from '../../lib/storage';
import { authenticate, companyAuth } from '../../middleware/auth';
import { candidatesService } from '../candidates/candidates.service';
import { createUpload, finalizeUpload, signedViewUrl } from './files.service';

export const filesRouter = Router();

const signedQuery = z.object({ exp: z.coerce.number(), sig: z.string().min(10) });

/** Local-storage stand-in for an S3 presigned PUT (only active when S3 is not configured). */
filesRouter.put('/local/:id', express.raw({ type: '*/*', limit: '6mb' }), async (req, res) => {
  if (storage.mode !== 'local') throw errors.notFound('Route');
  const id = param(req.params.id);
  const q = parse(signedQuery, req.query);
  if (!verifyUrlParams(`upload:${id}`, q.exp, q.sig)) throw errors.forbidden('Upload link expired', 'INVALID_SIGNATURE');
  const file = await prisma.file.findUnique({ where: { id } });
  if (!file || file.status !== 'PENDING') throw errors.notFound('File');
  if (!Buffer.isBuffer(req.body) || !req.body.length) throw errors.badRequest('Empty upload');
  await storage.putObject(file.storageKey, req.body, file.mimeType);
  res.status(200).end();
});

filesRouter.get('/local/:id', async (req, res) => {
  if (storage.mode !== 'local') throw errors.notFound('Route');
  const id = param(req.params.id);
  const q = parse(signedQuery, req.query);
  if (!verifyUrlParams(`download:${id}`, q.exp, q.sig)) throw errors.forbidden('Link expired', 'INVALID_SIGNATURE');
  const file = await prisma.file.findUnique({ where: { id } });
  if (!file) throw errors.notFound('File');
  const body = await storage.getObject(file.storageKey);
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${file.filename.replace(/"/g, '')}"`);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.send(body);
});

filesRouter.use(authenticate);

const presignBody = presignUploadSchema.extend({
  kind: z.enum(['RESUME', 'LOGO', 'AVATAR', 'ATTACHMENT']),
  candidateId: z.string().optional(),
});

filesRouter.post('/presign', async (req, res) => {
  const auth = companyAuth(req);
  const body = parse(presignBody, req.body);
  if (body.kind === 'RESUME') {
    if (!body.candidateId) throw errors.badRequest('candidateId is required for resumes');
    await candidatesService.assertAccess(auth, body.candidateId);
  }
  ok(res, await createUpload({ kind: body.kind, companyId: auth.companyId, uploadedById: auth.userId, candidateId: body.candidateId, input: body }), 201);
});

filesRouter.post('/:id/complete', async (req, res) => {
  const auth = companyAuth(req);
  const pending = await prisma.file.findFirst({ where: { id: param(req.params.id), companyId: auth.companyId } });
  if (!pending) throw errors.notFound('File');
  if (pending.kind === 'LOGO' && !hasPermission(auth.role, 'company:manage')) throw errors.forbidden('You cannot update the company logo');
  if ((pending.kind === 'RESUME' || pending.kind === 'ATTACHMENT') && !hasPermission(auth.role, 'candidates:update')) {
    throw errors.forbidden('You cannot upload candidate files');
  }
  const file = await finalizeUpload(pending.id, { companyId: auth.companyId });
  if (file.kind === 'RESUME' && file.candidateId) {
    await prisma.candidate.update({ where: { id: file.candidateId }, data: { parseStatus: 'PROCESSING' } });
    await enqueue('resume.process', { fileId: file.id, candidateId: file.candidateId, companyId: auth.companyId });
  }
  ok(res, { id: file.id, status: file.status, url: file.kind !== 'RESUME' ? (await signedViewUrl(file.id, auth.companyId)).url : null });
});

filesRouter.get('/:id/url', async (req, res) => {
  ok(res, await signedViewUrl(param(req.params.id), companyAuth(req).companyId));
});
