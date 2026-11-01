import { STAGE_LABELS } from '@recruitflow/shared';
import { env } from '../config/env';
import { subscribe } from '../lib/events';
import { emailLayout } from '../lib/mailer';
import { prisma } from '../lib/prisma';
import { enqueue } from '../lib/queue';
import { emitToCompany } from '../lib/socket';
import { hiringTeamIds, notifyUsers } from '../modules/notifications/notifications.service';
import { formatWhen } from '../workers';

/**
 * Event consumers: notification service (in-app + socket), email, realtime board sync.
 * Each consumer is independent — a failing email never blocks an in-app notification.
 */
export function registerEventHandlers() {
  subscribe('candidate.applied', async (e) => {
    const app = await prisma.application.findUnique({
      where: { id: e.applicationId },
      include: { candidate: true, job: { include: { company: true } } },
    });
    if (!app) return;
    const name = `${app.candidate.firstName} ${app.candidate.lastName}`;
    emitToCompany(e.companyId, 'application:created', { applicationId: app.id, jobId: app.jobId, candidateName: name, actorId: e.actorId });

    const recipients = [app.job.hiringManagerId, app.job.createdById, ...(await hiringTeamIds(e.companyId))].filter((id): id is string => Boolean(id) && id !== e.actorId);
    await notifyUsers(recipients.slice(0, 10), {
      companyId: e.companyId,
      type: 'CANDIDATE_APPLIED',
      title: `${name} applied for ${app.job.title}`,
      body: app.candidate.headline,
      link: `/candidates/${app.candidateId}`,
    });

    if (!e.actorId) {
      await enqueue('email.send', {
        to: app.candidate.email,
        subject: `We received your application for ${app.job.title}`,
        html: emailLayout(
          'Application received',
          `<p>Hi ${app.candidate.firstName},</p><p>Thanks for applying for <b>${app.job.title}</b> at <b>${app.job.company.name}</b>. Our team will review your profile and get back to you soon.</p>`,
          { label: 'Track your application', url: `${env.APP_URL}/portal` },
        ),
      });
    }
  });

  subscribe('application.moved', async (e) => {
    emitToCompany(e.companyId, 'application:moved', e);
    const job = await prisma.job.findUnique({ where: { id: e.jobId }, select: { hiringManagerId: true, createdById: true } });
    const recipients = [job?.hiringManagerId, job?.createdById].filter((id): id is string => Boolean(id) && id !== e.actorId);
    await notifyUsers(recipients, {
      companyId: e.companyId,
      type: 'CANDIDATE_MOVED',
      title: `${e.candidateName} moved to ${e.toStageName}`,
      body: `${e.jobTitle}${e.actorName ? ` · by ${e.actorName}` : ''}`,
      link: `/candidates/${e.candidateId}`,
    });
  });

  subscribe('interview.scheduled', async (e) => {
    const interview = await prisma.interview.findUnique({
      where: { id: e.interviewId },
      include: {
        participants: { include: { user: true } },
        createdBy: true,
        application: { include: { candidate: true, job: { include: { company: true } } } },
      },
    });
    if (!interview) return;
    const { candidate, job } = interview.application;
    const when = formatWhen(interview.startsAt);
    const interviewerNames = interview.participants.map((p) => `${p.user.firstName} ${p.user.lastName}`).join(', ');

    emitToCompany(e.companyId, 'interview:scheduled', { interviewId: interview.id, actorId: e.actorId });
    await notifyUsers(
      interview.participants.map((p) => p.userId).filter((id) => id !== e.actorId),
      {
        companyId: e.companyId,
        type: 'INTERVIEW_SCHEDULED',
        title: `You're interviewing ${candidate.firstName} ${candidate.lastName}`,
        body: `${interview.title} · ${when}`,
        link: `/interviews/${interview.id}`,
      },
    );

    await enqueue('email.send', {
      to: candidate.email,
      subject: `Interview scheduled — ${job.title} at ${job.company.name}`,
      html: emailLayout(
        'Your interview is scheduled',
        `<p>Hi ${candidate.firstName},</p>
         <p>Your <b>${interview.title}</b> for <b>${job.title}</b> is confirmed.</p>
         <p><b>Date & time:</b> ${when} IST<br/><b>Duration:</b> ${interview.durationMins} minutes<br/><b>Interviewer(s):</b> ${interviewerNames}</p>`,
        interview.meetingUrl ? { label: 'Join meeting', url: interview.meetingUrl } : undefined,
      ),
    });
    await enqueue('email.send', {
      to: interview.createdBy.email,
      subject: `Confirmed: ${interview.title} with ${candidate.firstName} ${candidate.lastName}`,
      html: emailLayout('Interview confirmed', `<p>${interview.title} with ${candidate.firstName} ${candidate.lastName} is scheduled for <b>${when} IST</b> with ${interviewerNames}.</p>`),
    });
  });

  subscribe('interview.updated', async (e) => {
    emitToCompany(e.companyId, 'interview:updated', e);
    if (e.change === 'UPDATED') return;
    const interview = await prisma.interview.findUnique({
      where: { id: e.interviewId },
      include: { participants: true, application: { include: { candidate: true, job: true } } },
    });
    if (!interview) return;
    const { candidate, job } = interview.application;
    const cancelled = e.change === 'CANCELLED';
    await notifyUsers(
      interview.participants.map((p) => p.userId).filter((id) => id !== e.actorId),
      {
        companyId: e.companyId,
        type: 'INTERVIEW_SCHEDULED',
        title: `${interview.title} with ${candidate.firstName} ${cancelled ? 'was cancelled' : 'was rescheduled'}`,
        body: cancelled ? job.title : `Now ${formatWhen(interview.startsAt)}`,
        link: `/interviews/${interview.id}`,
      },
    );
    await enqueue('email.send', {
      to: candidate.email,
      subject: cancelled ? `Interview cancelled — ${job.title}` : `Interview rescheduled — ${job.title}`,
      html: emailLayout(
        cancelled ? 'Your interview was cancelled' : 'Your interview was rescheduled',
        cancelled
          ? `<p>Hi ${candidate.firstName}, your ${interview.title} for ${job.title} has been cancelled. Our team will be in touch.</p>`
          : `<p>Hi ${candidate.firstName}, your ${interview.title} for ${job.title} is now on <b>${formatWhen(interview.startsAt)} IST</b>.</p>`,
      ),
    });
  });

  subscribe('feedback.submitted', async (e) => {
    const fb = await prisma.interviewFeedback.findUnique({
      where: { id: e.feedbackId },
      include: { interviewer: true, interview: { include: { application: { include: { candidate: true, job: true } } } } },
    });
    if (!fb) return;
    const { candidate, job } = fb.interview.application;
    emitToCompany(e.companyId, 'feedback:submitted', { interviewId: e.interviewId, candidateId: candidate.id, actorId: e.actorId });
    await notifyUsers(
      [fb.interview.createdById, job.hiringManagerId].filter((id): id is string => Boolean(id) && id !== e.actorId),
      {
        companyId: e.companyId,
        type: 'FEEDBACK_SUBMITTED',
        title: `${fb.interviewer.firstName} submitted feedback for ${candidate.firstName} ${candidate.lastName}`,
        body: `${fb.interview.title} · ${fb.overallRating.toFixed(1)}/5`,
        link: `/candidates/${candidate.id}?tab=feedback`,
      },
    );
  });

  subscribe('job.published', async (e) => {
    const job = await prisma.job.findUnique({ where: { id: e.jobId } });
    if (!job) return;
    emitToCompany(e.companyId, 'job:published', { jobId: job.id, actorId: e.actorId });
    await notifyUsers(await hiringTeamIds(e.companyId, e.actorId), {
      companyId: e.companyId,
      type: 'JOB_PUBLISHED',
      title: `Job "${job.title}" published`,
      body: `${job.location} · ${job.department}`,
      link: `/jobs/${job.id}`,
    });
  });

  subscribe('resume.parsed', async (e) => {
    emitToCompany(e.companyId, 'resume:parsed', e);
    if (!e.applicationId || !e.success) return;
    const app = await prisma.application.findUnique({ where: { id: e.applicationId }, include: { candidate: true, job: true } });
    if (!app || app.matchScore == null) return;
    const recipients = [app.job.hiringManagerId].filter((id): id is string => Boolean(id));
    await notifyUsers(recipients, {
      companyId: e.companyId,
      type: 'RESUME_PARSED',
      title: `AI analysis ready: ${app.candidate.firstName} ${app.candidate.lastName} — ${app.matchScore}% match`,
      body: `${app.job.title} · ${STAGE_LABELS[app.stageType]}`,
      link: `/candidates/${app.candidateId}`,
    });
  });
}
