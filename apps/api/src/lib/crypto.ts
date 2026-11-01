import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Role } from '@recruitflow/shared';
import { env } from '../config/env';

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

/** Keyed hash for opaque tokens stored at rest (refresh, reset, invite). */
export const hashToken = (token: string) =>
  crypto.createHmac('sha256', env.JWT_REFRESH_SECRET).update(token).digest('hex');

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  cid: string | null;
  role: Role;
}

export function signAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'],
    issuer: 'recruitflow',
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: 'recruitflow' }) as AccessTokenPayload;
}

/** Signs short-lived URLs (local file storage) so links can be used without auth headers. */
export function signUrlParams(resource: string, ttlSeconds: number) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = crypto.createHmac('sha256', env.JWT_ACCESS_SECRET).update(`${resource}:${exp}`).digest('base64url');
  return { exp, sig };
}

export function verifyUrlParams(resource: string, exp: number, sig: string) {
  if (!exp || exp < Date.now() / 1000) return false;
  const expected = crypto.createHmac('sha256', env.JWT_ACCESS_SECRET).update(`${resource}:${exp}`).digest('base64url');
  return safeEqual(expected, sig);
}

export const shortId = (len = 6) =>
  crypto
    .randomBytes(len)
    .toString('base64url')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
    .slice(0, len)
    .padEnd(len, '0');
