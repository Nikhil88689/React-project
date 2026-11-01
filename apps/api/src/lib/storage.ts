import fs from 'node:fs/promises';
import path from 'node:path';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';
import { signUrlParams } from './crypto';

/**
 * Object storage abstraction. In production files go straight from the browser to S3
 * via presigned URLs; locally they are written to ./uploads through a signed endpoint
 * that mimics the same contract.
 */
export interface PresignedUpload {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
}

export interface Storage {
  mode: 's3' | 'local';
  presignUpload(fileId: string, key: string, mimeType: string): Promise<PresignedUpload>;
  presignDownload(fileId: string, key: string, filename: string): Promise<string>;
  getObject(key: string): Promise<Buffer>;
  putObject(key: string, body: Buffer, mimeType: string): Promise<void>;
  stat(key: string): Promise<{ size: number } | null>;
}

class S3Storage implements Storage {
  mode = 's3' as const;
  private client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: Boolean(env.S3_ENDPOINT),
    credentials:
      env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
        ? { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY }
        : undefined,
  });

  async presignUpload(_fileId: string, key: string, mimeType: string) {
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, ContentType: mimeType }),
      { expiresIn: 600 },
    );
    return { url, method: 'PUT' as const, headers: { 'Content-Type': mimeType } };
  }

  async presignDownload(_fileId: string, key: string, filename: string) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        ResponseContentDisposition: `inline; filename="${filename.replace(/"/g, '')}"`,
      }),
      { expiresIn: 300 },
    );
  }

  async getObject(key: string) {
    const out = await this.client.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    const bytes = await out.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }

  async putObject(key: string, body: Buffer, mimeType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: mimeType }));
  }

  async stat(key: string) {
    try {
      const head = await this.client.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
      return { size: head.ContentLength ?? 0 };
    } catch {
      return null;
    }
  }
}

class LocalStorage implements Storage {
  mode = 'local' as const;
  private root = path.resolve(process.cwd(), env.UPLOAD_DIR);

  private resolve(key: string) {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root)) throw new Error('Invalid storage key');
    return full;
  }

  async presignUpload(fileId: string, _key: string, mimeType: string) {
    const { exp, sig } = signUrlParams(`upload:${fileId}`, 600);
    return { url: `/api/files/local/${fileId}?exp=${exp}&sig=${sig}`, method: 'PUT' as const, headers: { 'Content-Type': mimeType } };
  }

  async presignDownload(fileId: string) {
    const { exp, sig } = signUrlParams(`download:${fileId}`, 300);
    return `/api/files/local/${fileId}?exp=${exp}&sig=${sig}`;
  }

  async getObject(key: string) {
    return fs.readFile(this.resolve(key));
  }

  async putObject(key: string, body: Buffer) {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body);
  }

  async stat(key: string) {
    try {
      const s = await fs.stat(this.resolve(key));
      return { size: s.size };
    } catch {
      return null;
    }
  }
}

export const storage: Storage = env.S3_BUCKET ? new S3Storage() : new LocalStorage();

/** Checks magic bytes so a renamed executable can't masquerade as a resume. */
export function detectFileType(buf: Buffer): 'pdf' | 'docx' | null {
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return 'docx';
  return null;
}
