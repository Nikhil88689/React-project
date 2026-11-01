import type { Prisma } from '@prisma/client';
import {
  INTERVIEW_TYPE_LABELS,
  RECOMMENDATION_LABELS,
  type CandidateCreateInput,
  type CandidateListQuery,
  type FeedbackDTO,
  type NoteDTO,
  type Recommendation,
} from '@recruitflow/shared';
import { candidateUpdateSchema } from '@recruitflow/shared';
import type { z } from 'zod';
import { audit } from '../../lib/audit';
import { invalidateCompanyCache } from '../../lib/cache';
import { errors } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import type { CompanyAuth } from '../../middleware/auth';
import { normalizeSkill } from '../ai/engine/skills';
import { createApplication } from '../applications/applications.service';
import { assertWithinLimit } from '../billing/limits';
import { toCandidateDTO, toCandidateSummary } from './candidates.mapper';
import { candidatesRepository as repo } from './candidates.repository';

/** Interviewers only see candidates they are scheduled to interview (row-level authorization). */
export function candidateScope(auth: CompanyAuth): Prisma.CandidateWhereInput {
  if (auth.role === 'INTERVIEWER') {
    return {
      companyId: auth.companyId,
      applications: { some: { interviews: { some: { participants: { some: { userId: auth.userId } } } } } },
    };
  }
  return { companyId: auth.companyId };
}

export function buildCandidateWhere(auth: CompanyAuth, q: Partial<CandidateListQuery>): Prisma.CandidateWhereInput {
  const and: Prisma.CandidateWhereInput[] = [candidateScope(auth)];

  if (q.search) {
    const tokens = q.search.split(/\s+/).filter(Boolean).slice(0, 4);
    for (const token of tokens) {
      and.push({
        OR: [
          { firstName: { contains: token, mode: 'insensitive' } },
          { lastName: { contains: token, mode: 'insensitive' } },
          { email: { contains: token, mode: 'insensitive' } },
          { headline: { contains: token, mode: 'insensitive' } },
          { currentCompany: { contains: token, mode: 'insensitive' } },
          { skills: { some: { name: { equals: normalizeSkill(token), mode: 'insensitive' } } } },
        ],
      });
    }
  }
  for (const skill of q.skills ?? []) {
    and.push({ skills: { some: { name: { equals: normalizeSkill(skill), mode: 'insensitive' } } } });
  }
  if (q.minExperience != null) and.push({ experienceYears: { gte: q.minExperience } });
  if (q.maxExperience != null) and.push({ experienceYears: { lte: q.maxExperience } });
  if (q.location) and.push({ location: { contains: q.location, mode: 'insensitive' } });
  if (q.availability) and.push({ availability: q.availability });
  if (q.source) and.push({ source: q.source });
  if (q.poolId) and.push({ poolEntries: { some: { poolId: q.poolId } } });

  const appFilter: Prisma.ApplicationWhereInput = {};
  if (q.stage) appFilter.stageType = q.stage;
  if (q.minMatch != null) appFilter.matchScore = { gte: q.minMatch };
  if (q.jobId) appFilter.jobId = q.jobId;
  if (Object.keys(appFilter).length) and.push({ applications: { some: appFilter } });

  return { AND: and };
}

const userName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;

export const candidatesService = {
  async list(auth: CompanyAuth, q: CandidateListQuery) {
    const where = buildCandidateWhere(auth, q);
    const [rows, total] = await Promise.all([repo.findPage(where, q.limit, q.cursor), repo.count(where)]);
    const hasMore = rows.length > q.limit;
    const page = hasMore ? rows.slice(0, q.limit) : rows;
    return { items: page.map(toCandidateSummary), nextCursor: hasMore ? page[page.length - 1].id : null, total };
  },

  async get(auth: CompanyAuth, id: string) {
    const candidate = await repo.findDetail({ AND: [candidateScope(auth), { id }] });
    if (!candidate) throw errors.notFound('Candidate');
    return toCandidateDTO(candidate);
  },

  async create(auth: CompanyAuth, input: CandidateCreateInput) {
    await assertWithinLimit(auth.companyId, 'candidates');
    const exists = await repo.findOne({ companyId: auth.companyId, email: input.email });
    if (exists) throw errors.conflict('A candidate with this email already exists', 'CANDIDATE_EXISTS', { candidateId: exists.id });

    const { skills, jobId, ...fields } = input;
    const candidate = await repo.create({
      ...fields,
      company: { connect: { id: auth.companyId } },
      skills: skills?.length ? { create: [...new Set(skills.map(normalizeSkill))].map((name) => ({ name })) } : undefined,
    });
    await audit({ companyId: auth.companyId, actorId: auth.userId, action: 'CREATE_CANDIDATE', entityType: 'candidate', entityId: candidate.id, summary: `added candidate ${candidate.firstName} ${candidate.lastName}` });
    if (jobId) await createApplication(auth, { candidateId: candidate.id, jobId, source: input.source });
    await invalidateCompanyCache(auth.companyId);
    return this.get(auth, candidate.id);
  },

  async update(auth: CompanyAuth, id: string, input: z.infer<typeof candidateUpdateSchema>) {
    const existing = await repo.findOne({ id, companyId: auth.companyId });
    if (!existing) throw errors.notFound('Candidate');
    const { skills, ...fields } = input;
    await prisma.$transaction(async (tx) => {
      await tx.candidate.update({ where: { id }, data: fields });
      if (skills) {
        const current = await tx.candidateSkill.findMany({ where: { candidateId: id } });
        const wanted = new Set(skills.map(normalizeSkill));
        await tx.candidateSkill.deleteMany({ where: { candidateId: id, name: { notIn: [...wanted] } } });
        const have = new Set(current.map((s) => s.name));
        const toAdd = [...wanted].filter((s) => !have.has(s));
        if (toAdd.length) await tx.candidateSkill.createMany({ data: toAdd.map((name) => ({ candidateId: id, name })) });
      }
    });
    await audit({ companyId: auth.companyId, actorId: auth.userId, action: 'UPDATE_CANDIDATE', entityType: 'candidate', entityId: id, summary: `updated ${existing.firstName} ${existing.lastName}'s profile` });
    return this.get(auth, id);
  },

  async remove(auth: CompanyAuth, id: string) {
    const existing = await repo.findOne({ id, companyId: auth.companyId });
    if (!existing) throw errors.notFound('Candidate');
    await repo.delete(id);
    await invalidateCompanyCache(auth.companyId);
  },

  async listNotes(auth: CompanyAuth, candidateId: string): Promise<NoteDTO[]> {
    await this.assertAccess(auth, candidateId);
    const notes = await prisma.candidateNote.findMany({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    });
    return notes.map((n) => ({
      id: n.id,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
      author: { id: n.author.id, name: userName(n.author), avatarUrl: n.author.avatarUrl },
    }));
  },

  async addNote(auth: CompanyAuth, candidateId: string, body: string) {
    const c = await this.assertAccess(auth, candidateId);
    const note = await prisma.candidateNote.create({ data: { candidateId, authorId: auth.userId, body } });
    await audit({ companyId: auth.companyId, actorId: auth.userId, action: 'ADD_NOTE', entityType: 'candidate', entityId: candidateId, summary: `added a note on ${c.firstName} ${c.lastName}` });
    return note;
  },

  async deleteNote(auth: CompanyAuth, candidateId: string, noteId: string) {
    await this.assertAccess(auth, candidateId);
    const note = await prisma.candidateNote.findFirst({ where: { id: noteId, candidateId } });
    if (!note) throw errors.notFound('Note');
    if (note.authorId !== auth.userId && auth.role !== 'COMPANY_ADMIN') throw errors.forbidden('You can only delete your own notes');
    await prisma.candidateNote.delete({ where: { id: noteId } });
  },

  async assertAccess(auth: CompanyAuth, candidateId: string) {
    const c = await repo.findOne({ AND: [candidateScope(auth), { id: candidateId }] });
    if (!c) throw errors.notFound('Candidate');
    return c;
  },

  /** Interview feedback across all of the candidate's applications, with bias-aware visibility. */
  async feedback(auth: CompanyAuth, candidateId: string): Promise<FeedbackDTO[]> {
    await this.assertAccess(auth, candidateId);
    const rows = await prisma.interviewFeedback.findMany({
      where: {
        interview: { application: { candidateId } },
        ...(auth.role === 'INTERVIEWER' ? { interviewerId: auth.userId } : {}),
      },
      orderBy: { submittedAt: 'desc' },
      include: {
        interview: { select: { id: true, title: true } },
        interviewer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });
    return rows.map((f) => ({
      id: f.id,
      interviewId: f.interviewId,
      interviewTitle: f.interview.title,
      interviewer: { id: f.interviewer.id, name: userName(f.interviewer), avatarUrl: f.interviewer.avatarUrl },
      ratings: f.ratings as Record<string, number>,
      overallRating: f.overallRating,
      recommendation: f.recommendation,
      strengths: f.strengths,
      concerns: f.concerns,
      privateNotes: auth.role === 'INTERVIEWER' && f.interviewerId !== auth.userId ? null : f.privateNotes,
      submittedAt: f.submittedAt.toISOString(),
    }));
  },

  /** Unified, chronological event timeline for a candidate. */
  async timeline(auth: CompanyAuth, candidateId: string) {
    await this.assertAccess(auth, candidateId);
    const [apps, notes, messages] = await Promise.all([
      prisma.application.findMany({
        where: { candidateId },
        include: {
          job: { select: { title: true } },
          history: { include: { toStage: { select: { name: true } }, changedBy: { select: { firstName: true, lastName: true } } } },
          interviews: {
            include: {
              createdBy: { select: { firstName: true, lastName: true } },
              feedback: { include: { interviewer: { select: { firstName: true, lastName: true } } } },
            },
          },
        },
      }),
      prisma.candidateNote.findMany({ where: { candidateId }, include: { author: { select: { firstName: true, lastName: true } } } }),
      prisma.message.findMany({ where: { candidateId }, include: { sender: { select: { firstName: true, lastName: true } } } }),
    ]);

    type Item = { id: string; type: string; title: string; description: string | null; at: string; actor: string | null };
    const items: Item[] = [];
    for (const a of apps) {
      items.push({ id: `app-${a.id}`, type: 'APPLIED', title: `Applied for ${a.job.title}`, description: `via ${a.source.replace('_', ' ').toLowerCase()}`, at: a.appliedAt.toISOString(), actor: null });
      for (const h of a.history) {
        if (!h.fromStageId) continue;
        items.push({ id: `h-${h.id}`, type: h.toStageType === 'REJECTED' ? 'REJECTED' : h.toStageType === 'HIRED' ? 'HIRED' : 'MOVED', title: `Moved to ${h.toStage.name}`, description: a.job.title, at: h.changedAt.toISOString(), actor: h.changedBy ? userName(h.changedBy) : null });
      }
      for (const i of a.interviews) {
        items.push({ id: `i-${i.id}`, type: 'INTERVIEW', title: `${INTERVIEW_TYPE_LABELS[i.type]} scheduled`, description: `For ${i.startsAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })} · ${a.job.title}`, at: i.createdAt.toISOString(), actor: userName(i.createdBy) });
        for (const f of i.feedback) {
          items.push({ id: `f-${f.id}`, type: 'FEEDBACK', title: `${i.title} feedback submitted`, description: `${RECOMMENDATION_LABELS[f.recommendation as Recommendation]} · ${f.overallRating.toFixed(1)}/5`, at: f.submittedAt.toISOString(), actor: userName(f.interviewer) });
        }
      }
    }
    for (const n of notes) items.push({ id: `n-${n.id}`, type: 'NOTE', title: 'Note added', description: n.body.slice(0, 140), at: n.createdAt.toISOString(), actor: userName(n.author) });
    for (const m of messages) items.push({ id: `m-${m.id}`, type: 'EMAIL', title: `Email sent: ${m.subject}`, description: null, at: m.createdAt.toISOString(), actor: userName(m.sender) });

    return items.sort((a, b) => b.at.localeCompare(a.at));
  },
};
