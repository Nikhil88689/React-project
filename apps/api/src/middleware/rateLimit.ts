import rateLimit from 'express-rate-limit';
import { isTest } from '../config/env';

const handler = (_req: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) =>
  res.status(429).json({
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment and try again.' },
  });

const make = (windowMs: number, limit: number) =>
  rateLimit({ windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false, handler, skip: () => isTest });

export const globalLimiter = make(60_000, 600);
export const authLimiter = make(15 * 60_000, 30);
export const publicApplyLimiter = make(15 * 60_000, 30);
export const aiLimiter = make(60_000, 30);
