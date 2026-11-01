import { INTERVIEW_TYPE_LABELS } from '@recruitflow/shared';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { emailLayout, sendEmail } from '../lib/mailer';
import { prisma } from '../lib/prisma';
import { enqueue, registerHandler } from '../lib/queue';
import { matchApplication } from '../modules/ai/ai.service';
import { notifyUsers } from '../modules/notifications/notifications.service';
import { processResume } from './resume.worker';

export const formatWhen = (d: Date, tz = 'Asia/Kolkata') =>
  d.toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: tz });

/** Registers every background job handler. Called by the API (in-process mode) or the standalone worker. */
export function registerWorkers() {
  registerHandler('resume.process', processResume);

  registerHandler('ai.match', async ({ applicationId }) => {
    await matchApplication(applicationId);
  });

  registerHandler('email.send', async ({ to, subject, html, text, messageId }) => {
    try {
      await sendEmail({ to, subject, html, text });
      if (messageId) await prisma.message.update({ where: { id: messageId }, data: { status: 'SENT', sentAt: new Date() } });
    } catch (err) {
      if (messageId) await prisma.message.update({ where: { id: messageId }, data: { status: 'FAILED' } });
      throw err;
    }
  });

  // Reminders re-read the interview so reschedules/cancellations are always respected.
  registerHandler('interview.reminder', async ({ interviewId, window }) => {
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        participants: { include: { user: true } },
        application: { include: { candidate: true, job: true } },
      },
    });
    if (!interview || interview.status !== 'SCHEDULED') return;
    const expectedLead = window === '24h' ? 24 * 3600_000 : 3600_000;
    if (Math.abs(interview.startsAt.getTime() - Date.now() - expectedLead) > 15 * 60_000) return;

    const { candidate, job } = interview.application;
    const when = formatWhen(interview.startsAt);
    const label = window === '24h' ? 'tomorrow' : 'in 1 hour';

    await notifyUsers(
      interview.participants.map((p) => p.userId),
      {
        companyId: interview.companyId,
        type: 'INTERVIEW_REMINDER',
        title: `Interview starts ${label}`,
        body: `${INTERVIEW_TYPE_LABELS[interview.type]} with ${candidate.firstName} ${candidate.lastName} · ${when}`,
        link: `/interviews/${interview.id}`,
      },
    );
    await enqueue('email.send', {
      to: candidate.email,
      subject: `Reminder: your ${job.title} interview is ${label}`,
      html: emailLayout(
        `Your interview is ${label}`,
        `<p>Hi ${candidate.firstName},</p><p>This is a reminder for your <b>${interview.title}</b> for <b>${job.title}</b> on <b>${when} IST</b>.</p>`,
        interview.meetingUrl ? { label: 'Join meeting', url: interview.meetingUrl } : undefined,
      ),
    });
  });

  logger.info({ appUrl: env.APP_URL }, 'Background job handlers registered');
}
