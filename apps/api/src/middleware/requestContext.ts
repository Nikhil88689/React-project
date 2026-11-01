import crypto from 'node:crypto';
import type { RequestHandler } from 'express';
import { pinoHttp } from 'pino-http';
import { logger } from '../lib/logger';

export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.headers['x-request-id'];
  req.requestId = typeof incoming === 'string' && incoming.length < 100 ? incoming : `req_${crypto.randomUUID().slice(0, 12)}`;
  res.setHeader('x-request-id', req.requestId);
  next();
};

/** Structured access logs: requestId, userId, companyId, route, status, duration. */
export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => (req as unknown as { requestId: string }).requestId,
  autoLogging: { ignore: (req) => req.url === '/api/health' },
  customProps: (req) => {
    const r = req as unknown as { auth?: { userId: string; companyId: string | null } };
    return { userId: r.auth?.userId, companyId: r.auth?.companyId };
  },
  customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
  customSuccessMessage: (req, res, responseTime) => `${req.method} ${req.url} ${res.statusCode} ${Math.round(responseTime)}ms`,
  customErrorMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  serializers: {
    req: (req) => ({ method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});
