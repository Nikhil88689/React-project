import path from 'node:path';
import type { FileKind } from '@prisma/client';
import { RESUME_UPLOAD, type PresignUploadInput } from '@recruitflow/shared';
import { shortId } from '../../lib/crypto';
import { errors } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { detectFileType, storage } from '../../lib/storage';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

/** Validates declared type/extension/size before issuing an upload URL. Magic bytes are checked after upload. */
export function validateUpload(kind: FileKind, input: PresignUploadInput) {
  const ext = path.extname(input.filename).toLowerCase();
  if (kind === 'RESUME') {
    if (!(RESUME_UPLOAD.extensions as readonly string[]).includes(ext) || !(RESUME_UPLOAD.mimeTypes as readonly string[]).includes(input.mimeType)) {
      throw errors.badRequest('Only PDF or DOCX resumes are accepted', undefined, 'INVALID_FILE_TYPE');
    }
    if (input.size > RESUME_UPLOAD.maxBytes) throw errors.badRequest('Resume must be 5 MB or smaller', undefined, 'FILE_TOO_LARGE');
  } else {
    if (!IMAGE_TYPES.includes(input.mimeType)) throw errors.badRequest('Only PNG, JPG, WEBP or SVG images are accepted', undefined, 'INVALID_FILE_TYPE');
    if (input.size > 2 * 1024 * 1024) throw errors.badRequest('Images must be 2 MB or smaller', undefined, 'FILE_TOO_LARGE');
  }
  return ext;
}

export async function createUpload(opts: {
  kind: FileKind;
  companyId: string | null;
  uploadedById?: string | null;
  candidateId?: string | null;
  input: PresignUploadInput;
}) {
  const ext = validateUpload(opts.kind, opts.input);
  const key = `${opts.companyId ?? 'platform'}/${opts.kind.toLowerCase()}s/${new Date().toISOString().slice(0, 7)}/${shortId(12)}${ext}`;
  const file = await prisma.file.create({
    data: {
      kind: opts.kind,
      companyId: opts.companyId,
      uploadedById: opts.uploadedById ?? null,
      candidateId: opts.candidateId ?? null,
      storageKey: key,
      filename: opts.input.filename.replace(/[^\w.\- ]/g, '_').slice(0, 200),
      mimeType: opts.input.mimeType,
      size: opts.input.size,
    },
  });
  const upload = await storage.presignUpload(file.id, key, opts.input.mimeType);
  return { fileId: file.id, upload };
}

/** Confirms an uploaded object exists and has the right file signature. */
export async function finalizeUpload(fileId: string, expected: { companyId: string | null }) {
  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file || file.companyId !== expected.companyId) throw errors.notFound('File');
  if (file.status === 'UPLOADED') return file;
  if (file.status === 'REJECTED') throw errors.badRequest('This file was rejected', undefined, 'FILE_REJECTED');

  const stat = await storage.stat(file.storageKey);
  if (!stat) throw errors.badRequest('Upload not found — please upload the file again', undefined, 'UPLOAD_MISSING');
  if (stat.size > RESUME_UPLOAD.maxBytes) {
    await prisma.file.update({ where: { id: file.id }, data: { status: 'REJECTED' } });
    throw errors.badRequest('File is too large', undefined, 'FILE_TOO_LARGE');
  }
  if (file.kind === 'RESUME') {
    const head = await storage.getObject(file.storageKey);
    const type = detectFileType(head);
    if (!type || !file.filename.toLowerCase().endsWith(type)) {
      await prisma.file.update({ where: { id: file.id }, data: { status: 'REJECTED' } });
      throw errors.badRequest("This file doesn't look like a valid PDF or DOCX", undefined, 'INVALID_FILE_SIGNATURE');
    }
  }
  return prisma.file.update({ where: { id: file.id }, data: { status: 'UPLOADED', size: stat.size } });
}

export async function signedViewUrl(fileId: string, companyId: string) {
  const file = await prisma.file.findFirst({ where: { id: fileId, companyId, status: 'UPLOADED' } });
  if (!file) throw errors.notFound('File');
  return { url: await storage.presignDownload(file.id, file.storageKey, file.filename), filename: file.filename, mimeType: file.mimeType };
}
