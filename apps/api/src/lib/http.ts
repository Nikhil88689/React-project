import type { Response } from 'express';
import type { ZodSchema, ZodTypeDef } from 'zod';
import type { CursorMeta, PageMeta } from '@recruitflow/shared';
import { errors } from './errors';

export function ok<T>(res: Response, data: T, status = 200, meta?: PageMeta | CursorMeta) {
  return res.status(status).json(meta ? { success: true, data, meta } : { success: true, data });
}

export function pageMeta(page: number, limit: number, total: number): PageMeta {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/** Parses untrusted input with a Zod schema, converting failures into a 400 VALIDATION_ERROR. */
export function parse<Out, In = Out>(schema: ZodSchema<Out, ZodTypeDef, In>, input: unknown): Out {
  const result = schema.safeParse(input);
  if (!result.success) throw errors.validation(result.error.flatten());
  return result.data;
}

export function param(value: string | string[] | undefined): string {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v) throw errors.badRequest('Missing route parameter');
  return v;
}
