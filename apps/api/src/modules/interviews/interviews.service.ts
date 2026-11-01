import type { Prisma } from '@prisma/client';
import {
  INTERVIEW_TYPE_LABELS,
  interviewListQuerySchema,
  updateInterviewSchema,
  type CreateInterviewInput,
  type FeedbackInput,
  type InterviewDTO,
} from '@recruitflow/shared';
import type { z } from 'zod';
import { audit } from '../../lib/audit';
import { invalidateCompanyCache } from '../../lib/cache';
import { errors } from '../../lib/errors';
import { publish } from '../../lib/events';
import { cancelJob, enqueue } from '../../lib/queue';
import { prisma } from '../../lib/prisma';
import type { CompanyAuth } from '../../middleware/auth';

export const interviewInclude = {
  application: {
    select: {
      id: true,
      jobId: true,
      job: { select: { title: true } },
      stage: { select: { name: true } },
      candidate: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, headline: true } },
    },
  },
  participants: { include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } },
  feedback: { select: { interviewerId: true } },
} satisfies Prisma.InterviewInclude;

type InterviewRow = Prisma.InterviewGetPayload<{ include: typeof interviewInclude }>;

export function toInterviewDTO(i: InterviewRow): InterviewDTO {
  const submitted = new Set(i.feedback.map((f) => f.interviewerId));
  const c = i.application.candidate;
  return {
    id: i.id,
    title: i.title,
    type: i.type,
    status: i.status,
    startsAt: i.startsAt.toISOString(),
    durationMins: i.durationMins,
    meetingUrl: i.meetingUrl,
    location: i.location,
    notes: i.notes,
    application: { id: i.application.id, jobId: i.application.jobId, jobTitle: i.application.job.title, stageName: i.application.stage.name },
    candidate: { id: c.id, name: `${c.firstName} ${c.lastName}`, email: c.email, avatarUrl: c.avatarUrl, headline: c.headline },
    interviewers: i.participants.map((p) => ({
      id: p.user.id,
      name: `${p.user.firstName} ${p.user.lastName}`,
      avatarUrl: p.user.avatarUrl,
      feedbackSubmitted: submitted.has(p.user.id),
    })),
    feedbackCount: i.feedback.length,
  };
}

const REMINDERS = [
  { window: '24h' as const, ms: 24 * 3600_000 },
  { window: '1h' as const, ms: 3600_000 },
];

async function scheduleReminders(interviewId: string, startsAt: Date) {
  for (const r of REMINDERS) {
    const jobId = `reminder:${interviewId}:${r.window}`;
    await cancelJob(jobId);
    const delay = startsAt.getTime() - r.ms - Date.now();
    if (delay > 0) await enqueue('interview.reminder', { interviewId, window: r.window }, { delayMs: delay, jobId });
  }
}

async function cancelReminders(interviewId: string) {
  for (const r of REMINDERS) await cancelJob(`reminder:${interviewId}:${r.window}`);
}

function scopeWhere(auth: CompanyAuth, mine: boolean): Prisma.InterviewWhereInput {
  const forceMine = auth.role === 'INTERVIEWER';
  return {
    companyId: auth.companyId,
    ...(mine || forceMine ? { participants: { some: { userId: auth.userId } } } : {}),
  };
}

export const interviewsService = {
  async list(auth: CompanyAuth, q: z.infer<typeof interviewListQuerySchema>) {
    const rows = await prisma.interview.findMany({
      where: {
        ...scopeWhere(auth, q.mine),
        ...(q.status ? { status: q.status } : {}),
        ...(q.candidateId ? { application: { candidateId: q.candidateId } } : {}),
        ...(q.from || q.to ? { startsAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}),
      },
      orderBy: { startsAt: 'asc' },
      take: 500,
      include: interviewInclude,
    });
    return rows.map(toInterviewDTO);
  },

  async get(auth: CompanyAuth, id: string) {
    const row = await prisma.interview.findFirst({
      where: { id, ...scopeWhere(auth, false) },
      include: {
        ...interviewInclude,
        application: {
          select: {
            ...interviewInclude.application.select,
            matchScore: true,
            job: { select: { title: true, skills: { select: { name: true, importance: true } } } },
          },
        },
      },
    });
    if (!row) throw errors.notFound('Interview');
    const dto = toInterviewDTO(row as unknown as InterviewRow);
    const myFeedback = await prisma.interviewFeedback.findUnique({
      where: { interviewId_interviewerId: { interviewId: id, interviewerId: auth.userId } },
    });
    return {
      ...dto,
      matchScore: row.application.matchScore,
      jobSkills: row.application.job.skills,
      isParticipant: row.participants.some((p) => p.userId === auth.userId),
      myFeedback: myFeedback
        ? {
            ratings: myFeedback.ratings as Record<string, number>,
            recommendation: myFeedback.recommendation,
            strengths: myFeedback.strengths,
            concerns: myFeedback.concerns,
            privateNotes: myFeedback.privateNotes,
            submittedAt: myFeedback.submittedAt.toISOString(),
          }
        : null,
    };
  },

  async create(auth: CompanyAuth, input: CreateInterviewInput) {
    const application = await prisma.application.findFirst({
      where: { id: input.applicationId, companyId: auth.companyId },
      include: { candidate: true, job: true },
    });
    if (!application) throw errors.notFound('Application');
    if (input.startsAt.getTime() < Date.now() - 5 * 60_000) throw errors.badRequest('Interview time must be in the future', undefined, 'INVALID_TIME');

    const members = await prisma.companyMember.findMany({
      where: { companyId: auth.companyId, status: 'ACTIVE', userId: { in: input.interviewerIds } },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    if (members.length !== new Set(input.interviewerIds).size) throw errors.badRequest('All interviewers must be active team members', undefined, 'INVALID_INTERVIEWERS');

    const endsAt = new Date(input.startsAt.getTime() + input.durationMins * 60_000);
    const overlapping = await prisma.interview.findMany({
      where: {
        companyId: auth.companyId,
        status: 'SCHEDULED',
        startsAt: { lt: endsAt, gte: new Date(input.startsAt.getTime() - 8 * 3600_000) },
        participants: { some: { userId: { in: input.interviewerIds } } },
      },
      include: { participants: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });
    const conflicts = overlapping.filter((o) => o.startsAt.getTime() + o.durationMins * 60_000 > input.startsAt.getTime());
    if (conflicts.length) {
      const busy = [...new Set(conflicts.flatMap((c) => c.participants.filter((p) => input.interviewerIds.includes(p.userId)).map((p) => `${p.user.firstName} ${p.user.lastName}`)))];
      throw errors.conflict(`${busy.join(', ')} already ${busy.length > 1 ? 'have' : 'has'} an interview at that time`, 'INTERVIEWER_CONFLICT', { busy });
    }

    const interview = await prisma.interview.create({
      data: {
        companyId: auth.companyId,
        applicationId: application.id,
        createdById: auth.userId,
        title: input.title?.trim() || INTERVIEW_TYPE_LABELS[input.type],
        type: input.type,
        startsAt: input.startsAt,
        durationMins: input.durationMins,
        meetingUrl: input.meetingUrl ?? null,
        location: input.location ?? null,
        notes: input.notes ?? null,
        participants: { create: [...new Set(input.interviewerIds)].map((userId) => ({ userId })) },
      },
      include: interviewInclude,
    });

    await scheduleReminders(interview.id, interview.startsAt);
    await audit({
      companyId: auth.companyId,
      actorId: auth.userId,
      action: 'SCHEDULE_INTERVIEW',
      entityType: 'candidate',
      entityId: application.candidateId,
      summary: `scheduled ${interview.title} with ${application.candidate.firstName} ${application.candidate.lastName}`,
      metadata: { interviewId: interview.id },
    });
    await invalidateCompanyCache(auth.companyId);
    publish('interview.scheduled', { companyId: auth.companyId, interviewId: interview.id, actorId: auth.userId });
    return toInterviewDTO(interview);
  },

  async update(auth: CompanyAuth, id: string, input: z.infer<typeof updateInterviewSchema>) {
    const existing = await prisma.interview.findFirst({ where: { id, companyId: auth.companyId } });
    if (!existing) throw errors.notFound('Interview');
    const updated = await prisma.interview.update({ where: { id }, data: input, include: interviewInclude });

    const rescheduled = input.startsAt && input.startsAt.getTime() !== existing.startsAt.getTime();
    if (updated.status !== 'SCHEDULED') await cancelReminders(id);
    else if (rescheduled) await scheduleReminders(id, updated.startsAt);

    if (input.status === 'CANCELLED') {
      await audit({ companyId: auth.companyId, actorId: auth.userId, action: 'CANCEL_INTERVIEW', entityType: 'candidate', entityId: updated.application.candidate.id, summary: `cancelled ${updated.title} with ${updated.application.candidate.firstName}` });
    }
    await invalidateCompanyCache(auth.companyId);
    publish('interview.updated', {
      companyId: auth.companyId,
      interviewId: id,
      actorId: auth.userId,
      change: input.status === 'CANCELLED' ? 'CANCELLED' : rescheduled ? 'RESCHEDULED' : 'UPDATED',
    });
    return toInterviewDTO(updated);
  },

  async submitFeedback(auth: CompanyAuth, interviewId: string, input: FeedbackInput) {
    const interview = await prisma.interview.findFirst({
      where: { id: interviewId, companyId: auth.companyId },
      include: { participants: true, application: { include: { candidate: true } } },
    });
    if (!interview) throw errors.notFound('Interview');
    if (!interview.participants.some((p) => p.userId === auth.userId)) {
      throw errors.forbidden('Only assigned interviewers can submit feedback for this interview');
    }
    if (interview.status === 'CANCELLED') throw errors.badRequest('This interview was cancelled');

    const scores = Object.values(input.ratings);
    const overallRating = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
    const data = {
      ratings: input.ratings,
      overallRating,
      recommendation: input.recommendation,
      strengths: input.strengths ?? null,
      concerns: input.concerns ?? null,
      privateNotes: input.privateNotes ?? null,
      submittedAt: new Date(),
    };
    const feedback = await prisma.interviewFeedback.upsert({
      where: { interviewId_interviewerId: { interviewId, interviewerId: auth.userId } },
      create: { interviewId, interviewerId: auth.userId, ...data },
      update: data,
    });
    if (interview.status === 'SCHEDULED' && interview.startsAt <= new Date()) {
      await prisma.interview.update({ where: { id: interviewId }, data: { status: 'COMPLETED' } });
      await cancelReminders(interviewId);
    }

    await audit({
      companyId: auth.companyId,
      actorId: auth.userId,
      action: 'SUBMIT_FEEDBACK',
      entityType: 'candidate',
      entityId: interview.application.candidateId,
      summary: `submitted ${interview.title} feedback for ${interview.application.candidate.firstName} ${interview.application.candidate.lastName}`,
      metadata: { interviewId, recommendation: input.recommendation, overallRating },
    });
    publish('feedback.submitted', { companyId: auth.companyId, interviewId, feedbackId: feedback.id, actorId: auth.userId });
    return feedback;
  },

  /** Interviews that already happened but are still missing feedback from at least one interviewer. */
  async pendingFeedback(auth: CompanyAuth, onlyMine: boolean) {
    const rows = await prisma.interview.findMany({
      where: {
        ...scopeWhere(auth, onlyMine),
        status: { in: ['SCHEDULED', 'COMPLETED'] },
        startsAt: { lt: new Date() },
      },
      orderBy: { startsAt: 'desc' },
      take: 100,
      include: interviewInclude,
    });
    return rows
      .map(toInterviewDTO)
      .filter((i) => i.interviewers.some((p) => !p.feedbackSubmitted && (!onlyMine || p.id === auth.userId)));
  },
};
