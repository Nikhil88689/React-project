import { Router, type RequestHandler } from 'express';
import { authenticate } from '../../middleware/auth';
import { authLimiter } from '../../middleware/rateLimit';
import { verifyAccessToken } from '../../lib/crypto';
import { authController as c } from './auth.controller';

export const authRouter = Router();

/** Attaches auth context when a valid token is present, without requiring it. */
const optionalAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const p = verifyAccessToken(header.slice(7));
      req.auth = { userId: p.sub, sessionId: p.sid, companyId: p.cid, role: p.role };
    } catch {
      /* ignore */
    }
  }
  next();
};

authRouter.post('/register', authLimiter, c.register);
authRouter.post('/register/candidate', authLimiter, c.registerCandidate);
authRouter.post('/login', authLimiter, c.login);
authRouter.post('/refresh', c.refresh);
authRouter.post('/logout', optionalAuth, c.logout);
authRouter.post('/forgot-password', authLimiter, c.forgotPassword);
authRouter.post('/reset-password', authLimiter, c.resetPassword);
authRouter.get('/invitations/:token', c.getInvitation);
authRouter.post('/accept-invite', authLimiter, c.acceptInvite);

authRouter.get('/me', authenticate, c.me);
authRouter.post('/change-password', authenticate, c.changePassword);
authRouter.get('/sessions', authenticate, c.sessions);
authRouter.delete('/sessions/:id', authenticate, c.revokeSession);
authRouter.get('/login-history', authenticate, c.loginHistory);
