import { Router } from 'express';
import { sendMessageSchema } from '@recruitflow/shared';
import { z } from 'zod';
import { audit } from '../../lib/audit';
import { ok, parse } from '../../lib/http';
import { emailLayout, textToHtml } from '../../lib/mailer';
import { prisma } from '../../lib/prisma';
import { enqueue } from '../../lib/queue';
import { authenticate, companyAuth, requirePermission } from '../../middleware/auth';
import { candidatesService } from '../candidates/candidates.service';
import { renderTemplate } from '../company/defaults';

export const messagesRouter = Router();
messagesRouter.use(authenticate, requirePermission('messages:send'));

messagesRouter.get('/', async (req, res) => {
  const auth = companyAuth(req);
  const q = parse(z.object({ candidateId: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(50) }), req.query);
  const rows = await prisma.message.findMany({
    where: { companyId: auth.companyId, ...(q.candidateId ? { candidateId: q.candidateId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: q.limit,
    include: {
      candidate: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      sender: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  ok(
    res,
    rows.map((m) => ({
      id: m.id,
      subject: m.subject,
      body: m.body,
      status: m.status,
      templateKey: m.templateKey,
      createdAt: m.createdAt.toISOString(),
      sentAt: m.sentAt?.toISOString() ?? null,
      candidate: { id: m.candidate.id, name: `${m.candidate.firstName} ${m.candidate.lastName}`, email: m.candidate.email, avatarUrl: m.candidate.avatarUrl },
      sender: { id: m.sender.id, name: `${m.sender.firstName} ${m.sender.lastName}` },
    })),
  );
});

/** Template variables are resolved server-side so every email uses trusted data. */
messagesRouter.post('/', async (req, res) => {
  const auth = companyAuth(req);
  const input = parse(sendMessageSchema, req.body);
  const candidate = await candidatesService.assertAccess(auth, input.candidateId);
  const [company, sender, latest] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: auth.companyId } }),
    prisma.user.findUniqueOrThrow({ where: { id: auth.userId } }),
    prisma.application.findFirst({ where: { candidateId: candidate.id }, orderBy: { appliedAt: 'desc' }, include: { job: true } }),
  ]);
  const vars = {
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    companyName: company.name,
    senderName: `${sender.firstName} ${sender.lastName}`,
    jobTitle: latest?.job.title ?? 'the role',
  };
  const subject = renderTemplate(input.subject, vars);
  const body = renderTemplate(input.body, vars);

  const message = await prisma.message.create({
    data: { companyId: auth.companyId, candidateId: candidate.id, senderId: auth.userId, subject, body, templateKey: input.templateKey ?? null },
  });
  await enqueue('email.send', { to: candidate.email, subject, html: emailLayout(subject, textToHtml(body)), text: body, messageId: message.id });
  await audit({ companyId: auth.companyId, actorId: auth.userId, action: 'SEND_MESSAGE', entityType: 'candidate', entityId: candidate.id, summary: `emailed ${candidate.firstName} ${candidate.lastName}: "${subject}"` });
  ok(res, { id: message.id, subject, body, status: message.status }, 201);
});
