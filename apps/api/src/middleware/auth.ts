import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { hasPermission, type Permission, type Role } from '@recruitflow/shared';
import { verifyAccessToken } from '../lib/crypto';
import { AppError, errors } from '../lib/errors';
import { prisma } from '../lib/prisma';
import type { AuthContext } from '../types/express';

const lastSeen = new Map<string, number>();
const ACTIVITY_WRITE_INTERVAL = 5 * 60 * 1000;

function touchActivity(userId: string) {
  const now = Date.now();
  if ((lastSeen.get(userId) ?? 0) + ACTIVITY_WRITE_INTERVAL > now) return;
  lastSeen.set(userId, now);
  void prisma.user.update({ where: { id: userId }, data: { lastActiveAt: new Date() } }).catch(() => undefined);
}

/**
 * Verifies the bearer access token, then re-reads the membership so that role
 * changes and removals take effect immediately rather than at token expiry.
 */
export const authenticate: RequestHandler = async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) throw errors.unauthorized();

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw errors.unauthorized('Your session has expired', 'TOKEN_EXPIRED');
    throw errors.unauthorized('Invalid access token', 'INVALID_TOKEN');
  }

  let role: Role = payload.role;
  if (payload.cid) {
    const membership = await prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId: payload.cid, userId: payload.sub } },
      select: { role: true, status: true },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw errors.unauthorized('Your access to this workspace was revoked', 'MEMBERSHIP_REVOKED');
    }
    role = membership.role;
  }

  req.auth = { userId: payload.sub, sessionId: payload.sid, companyId: payload.cid, role };
  touchActivity(payload.sub);
  next();
};

/** Backend RBAC gate — the UI hides actions too, but this is the enforcement point. */
export const requirePermission =
  (...permissions: Permission[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) throw errors.unauthorized();
    const missing = permissions.filter((p) => !hasPermission(req.auth!.role, p));
    if (missing.length) {
      throw new AppError(403, 'FORBIDDEN', "You don't have permission to perform this action", { required: missing });
    }
    next();
  };

export type CompanyAuth = AuthContext & { companyId: string };

/** Returns the auth context for routes that operate inside a company workspace. */
export function companyAuth(req: Request): CompanyAuth {
  if (!req.auth) throw errors.unauthorized();
  if (!req.auth.companyId) throw errors.forbidden('This action requires a company workspace', 'NO_WORKSPACE');
  return req.auth as CompanyAuth;
}

export function requireAuth(req: Request): AuthContext {
  if (!req.auth) throw errors.unauthorized();
  return req.auth;
}
