import type { CookieOptions, Request, Response } from 'express';
import {
  acceptInviteSchema,
  candidateRegisterSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '@recruitflow/shared';
import { z } from 'zod';
import { isProd } from '../../config/env';
import { ok, param, parse } from '../../lib/http';
import { requireAuth } from '../../middleware/auth';
import * as auth from './auth.service';

export const REFRESH_COOKIE = 'rf_refresh';

const cookieOptions = (expires?: Date): CookieOptions => ({
  httpOnly: true,
  secure: isProd,
  sameSite: 'strict',
  path: '/api/auth',
  expires,
});

const meta = (req: Request): auth.ClientMeta => ({ ip: req.ip ?? null, userAgent: req.get('user-agent') ?? null });

function sendTokens(res: Response, tokens: auth.IssuedTokens, status = 200) {
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions(tokens.refreshExpiresAt));
  ok(res, { accessToken: tokens.accessToken, user: tokens.user }, status);
}

export const authController = {
  async register(req: Request, res: Response) {
    sendTokens(res, await auth.register(parse(registerSchema, req.body), meta(req)), 201);
  },

  async registerCandidate(req: Request, res: Response) {
    sendTokens(res, await auth.registerCandidate(parse(candidateRegisterSchema, req.body), meta(req)), 201);
  },

  async login(req: Request, res: Response) {
    const body = parse(loginSchema, req.body);
    sendTokens(res, await auth.login(body.email, body.password, meta(req)));
  },

  async refresh(req: Request, res: Response) {
    try {
      sendTokens(res, await auth.refresh(req.cookies?.[REFRESH_COOKIE], meta(req)));
    } catch (err) {
      res.clearCookie(REFRESH_COOKIE, cookieOptions());
      throw err;
    }
  },

  async logout(req: Request, res: Response) {
    await auth.logout(req.cookies?.[REFRESH_COOKIE], req.auth ? { userId: req.auth.userId, companyId: req.auth.companyId } : undefined);
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
    ok(res, { ok: true });
  },

  async me(req: Request, res: Response) {
    const a = requireAuth(req);
    ok(res, await auth.buildAuthUser(a.userId, a.companyId));
  },

  async forgotPassword(req: Request, res: Response) {
    await auth.forgotPassword(parse(forgotPasswordSchema, req.body).email);
    ok(res, { message: 'If an account exists for that email, a reset link is on its way.' });
  },

  async resetPassword(req: Request, res: Response) {
    const body = parse(resetPasswordSchema, req.body);
    await auth.resetPassword(body.token, body.password);
    ok(res, { message: 'Password updated. You can now sign in.' });
  },

  async changePassword(req: Request, res: Response) {
    const a = requireAuth(req);
    const body = parse(changePasswordSchema, req.body);
    await auth.changePassword(a.userId, a.sessionId, body.currentPassword, body.newPassword, a.companyId);
    ok(res, { message: 'Password changed. Other sessions were signed out.' });
  },

  async sessions(req: Request, res: Response) {
    const a = requireAuth(req);
    ok(res, await auth.listSessions(a.userId, a.sessionId));
  },

  async revokeSession(req: Request, res: Response) {
    const a = requireAuth(req);
    await auth.revokeSession(a.userId, param(req.params.id), a.companyId);
    ok(res, { ok: true });
  },

  async loginHistory(req: Request, res: Response) {
    ok(res, await auth.loginHistory(requireAuth(req).userId));
  },

  async getInvitation(req: Request, res: Response) {
    const { token } = parse(z.object({ token: z.string().min(20) }), req.params);
    const { invite, existingUser } = await auth.getInvitation(token);
    ok(res, { email: invite.email, role: invite.role, companyName: invite.company.name, existingUser });
  },

  async acceptInvite(req: Request, res: Response) {
    sendTokens(res, await auth.acceptInvite(parse(acceptInviteSchema, req.body), meta(req)), 201);
  },
};
