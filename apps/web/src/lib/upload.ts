import { RESUME_UPLOAD } from '@recruitflow/shared';
import { api, ApiError } from './api';

export interface PresignResult {
  fileId: string;
  upload: { url: string; method: 'PUT'; headers: Record<string, string> };
}

export function validateResumeFile(file: File) {
  const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
  if (!(RESUME_UPLOAD.extensions as readonly string[]).includes(ext)) {
    throw new ApiError(400, 'INVALID_FILE_TYPE', 'Only PDF or DOCX resumes are accepted');
  }
  if (file.size > RESUME_UPLOAD.maxBytes) {
    throw new ApiError(400, 'FILE_TOO_LARGE', 'Resume must be 5 MB or smaller');
  }
}

export function validateImageFile(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
    throw new ApiError(400, 'INVALID_FILE_TYPE', 'Only PNG, JPG, WEBP or SVG images are accepted');
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new ApiError(400, 'FILE_TOO_LARGE', 'Images must be 2 MB or smaller');
  }
}

export async function putPresigned(file: File, presign: PresignResult) {
  const res = await fetch(presign.upload.url, { method: presign.upload.method, headers: presign.upload.headers, body: file });
  if (!res.ok) throw new ApiError(res.status, 'UPLOAD_FAILED', 'The file could not be uploaded. Try again.');
  return presign.fileId;
}

export async function uploadResumePublic(slug: string, file: File) {
  validateResumeFile(file);
  const presign = await api.post<PresignResult>(`/public/jobs/${slug}/resume`, { filename: file.name, mimeType: file.type || 'application/pdf', size: file.size });
  return putPresigned(file, presign);
}

export async function uploadWorkspaceFile(file: File, kind: 'RESUME' | 'LOGO' | 'AVATAR' | 'ATTACHMENT', extra: { candidateId?: string } = {}) {
  if (kind === 'RESUME' || kind === 'ATTACHMENT') validateResumeFile(file);
  else validateImageFile(file);
  const presign = await api.post<PresignResult>('/files/presign', { filename: file.name, mimeType: file.type, size: file.size, kind, ...extra });
  await putPresigned(file, presign);
  return api.post<{ id: string; status: string; url: string | null }>(`/files/${presign.fileId}/complete`);
}
