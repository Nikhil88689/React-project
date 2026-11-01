import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { buildOpenApi } from './docs/openapi';
import { errorHandler, notFoundHandler } from './middleware/error';
import { globalLimiter } from './middleware/rateLimit';
import { httpLogger, requestId } from './middleware/requestContext';
import { aiRouter } from './modules/ai/ai.routes';
import { analyticsRouter } from './modules/analytics/analytics.routes';
import { applicationsRouter } from './modules/applications/applications.routes';
import { authRouter } from './modules/auth/auth.routes';
import { billingRouter, billingWebhookHandler } from './modules/billing/billing.routes';
import { candidatesRouter } from './modules/candidates/candidates.routes';
import { companyRouter, usersRouter } from './modules/company/company.routes';
import { filesRouter } from './modules/files/files.routes';
import { interviewsRouter } from './modules/interviews/interviews.routes';
import { jobsRouter } from './modules/jobs/jobs.routes';
import { messagesRouter } from './modules/messages/messages.routes';
import { adminRouter, auditRouter, devRouter, healthRouter, portalRouter, searchRouter } from './modules/misc/misc.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { publicRouter } from './modules/public/public.routes';
import { talentPoolsRouter } from './modules/talent-pools/talentPools.routes';
import { teamRouter } from './modules/team/team.routes';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(httpLogger);
  app.use(
    helmet({
      contentSecurityPolicy: false, // API only; the SPA is served (with its own CSP) by nginx.
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(cors({ origin: env.APP_URL, credentials: true }));

  // Stripe needs the raw body to verify signatures, so mount before the JSON parser.
  app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), billingWebhookHandler);

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use('/api', globalLimiter);

  const openapi = buildOpenApi();
  app.get('/api/openapi.json', (_req, res) => res.json(openapi));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'RecruitFlow API' }));

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/company', companyRouter);
  app.use('/api/team', teamRouter);
  app.use('/api/jobs', jobsRouter);
  app.use('/api/candidates', candidatesRouter);
  app.use('/api/applications', applicationsRouter);
  app.use('/api/interviews', interviewsRouter);
  app.use('/api/talent-pools', talentPoolsRouter);
  app.use('/api/messages', messagesRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/files', filesRouter);
  app.use('/api/billing', billingRouter);
  app.use('/api/audit-logs', auditRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/portal', portalRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/public', publicRouter);
  app.use('/api/dev', devRouter);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
