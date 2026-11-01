import type { AiAnalysisKind, Prisma } from '@prisma/client';
import {
  type AiAssistantInput,
  type AiJobDescriptionInput,
  type AiQuestionsInput,
  type AssistantReply,
  type CandidateProjectDTO,
  type CandidateSummaryResult,
  type GeneratedJobDescription,
  type InterviewQuestion,
  type MatchResult,
  STAGE_LABELS,
  STAGE_TYPES,
} from '@recruitflow/shared';
import { z } from 'zod';
import { invalidateCompanyCache } from '../../lib/cache';
import { errors } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import type { CompanyAuth } from '../../middleware/auth';
import { assertWithinLimit } from '../billing/limits';
import { candidatesService } from '../candidates/candidates.service';
import { renderTemplate, DEFAULT_EMAIL_TEMPLATES } from '../company/defaults';
import { interviewsService } from '../interviews/interviews.service';
import { generateInterviewQuestions, generateJobDescription, summarizeCandidate } from './engine/generators';
import { llmJson, withFallback } from './engine/llm';
import { computeMatch, type MatchCandidate, type MatchJob } from './engine/matcher';
import { describeFilters, HELP_REPLY, parseRecruiterQuery, type ParsedIntent } from './engine/queryParser';
import { parseResumeText, type ParsedResume } from './engine/resumeParser';

async function record(companyId: string, kind: AiAnalysisKind, result: unknown, extra: { candidateId?: string; jobId?: string; applicationId?: string; score?: number; engine: string }) {
  return prisma.aiAnalysis.create({
    data: { companyId, kind, result: result as Prisma.InputJsonValue, engine: extra.engine, candidateId: extra.candidateId, jobId: extra.jobId, applicationId: extra.applicationId, score: extra.score },
  });
}

async function loadCandidate(companyId: string, candidateId: string) {
  const c = await prisma.candidate.findFirst({
    where: { id: candidateId, companyId },
    include: { skills: true, experiences: true, educations: true },
  });
  if (!c) throw errors.notFound('Candidate');
  const matchShape: MatchCandidate = {
    experienceYears: c.experienceYears,
    skills: c.skills.map((s) => ({ name: s.name, years: s.years })),
    experiences: c.experiences,
    educations: c.educations,
    projects: (c.projects as unknown as CandidateProjectDTO[]) ?? [],
    resumeText: c.resumeText,
  };
  return { candidate: c, matchShape };
}

async function loadJob(companyId: string, jobId: string): Promise<MatchJob & { id: string }> {
  const job = await prisma.job.findFirst({ where: { id: jobId, companyId }, include: { skills: true } });
  if (!job) throw errors.notFound('Job');
  return { id: job.id, title: job.title, experienceMin: job.experienceMin, experienceMax: job.experienceMax, skills: job.skills };
}

/* ───────────────────────────── Matching ───────────────────────────── */

/** Computes (or reuses) the match for an application and stores the score on it. */
export async function matchApplication(applicationId: string, opts: { refresh?: boolean } = {}): Promise<MatchResult> {
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) throw errors.notFound('Application');
  if (!opts.refresh) {
    const existing = await prisma.aiAnalysis.findFirst({ where: { applicationId, kind: 'MATCH' }, orderBy: { createdAt: 'desc' } });
    if (existing) return existing.result as unknown as MatchResult;
  }
  const [{ matchShape }, job] = await Promise.all([loadCandidate(app.companyId, app.candidateId), loadJob(app.companyId, app.jobId)]);
  const result = computeMatch(matchShape, job);
  await record(app.companyId, 'MATCH', result, { applicationId, candidateId: app.candidateId, jobId: app.jobId, score: result.overall, engine: result.engine });
  await prisma.application.update({ where: { id: applicationId }, data: { matchScore: result.overall } });
  await invalidateCompanyCache(app.companyId);
  return result;
}

const summarySchema = z.object({
  headline: z.string(),
  summary: z.string(),
  strengths: z.array(z.string()).max(8),
  gaps: z.array(z.string()).max(8),
  evidence: z.array(z.object({ claim: z.string(), source: z.string() })).max(10),
});

async function buildSummary(companyId: string, candidateId: string, jobId: string | null, match: MatchResult | null): Promise<CandidateSummaryResult> {
  const { candidate, matchShape } = await loadCandidate(companyId, candidateId);
  const job = jobId ? await loadJob(companyId, jobId) : null;
  const ctx = job && match ? { title: job.title, missing: match.missing.map((m) => m.skill), verifyAreas: match.verifyAreas } : undefined;
  const heuristic = () => summarizeCandidate({ ...matchShape, firstName: candidate.firstName, headline: candidate.headline, currentCompany: candidate.currentCompany }, ctx);

  return withFallback(
    'candidate-summary',
    async () => {
      const out = summarySchema.parse(
        await llmJson([
          {
            role: 'system',
            content:
              'You are an assistant to a recruiter. Summarise the candidate factually from the data provided. Every strength and gap must be grounded in the data; cite the section it came from in `evidence`. Never recommend hiring or rejecting. Return JSON {headline, summary, strengths[], gaps[], evidence[{claim, source}]}.',
          },
          { role: 'user', content: JSON.stringify({ candidate: { name: candidate.firstName, ...matchShape, resumeText: candidate.resumeText?.slice(0, 6000) }, job: job ?? null, matchSignals: match ?? null }) },
        ]),
      );
      return { ...out, engine: 'llm' as const, generatedAt: new Date().toISOString() };
    },
    heuristic,
  );
}

export async function candidateInsights(auth: CompanyAuth, candidateId: string, jobId?: string, refresh = false) {
  await candidatesService.assertAccess(auth, candidateId);
  const applications = await prisma.application.findMany({
    where: { candidateId, companyId: auth.companyId, ...(jobId ? { jobId } : {}) },
    orderBy: { appliedAt: 'desc' },
    include: { job: { select: { id: true, title: true } } },
  });
  const app = applications[0] ?? null;

  if (refresh) await assertWithinLimit(auth.companyId, 'aiAnalyses');
  const match = app ? await matchApplication(app.id, { refresh }) : null;

  let summary: CandidateSummaryResult;
  const cached = refresh
    ? null
    : await prisma.aiAnalysis.findFirst({ where: { candidateId, kind: 'SUMMARY', jobId: app?.jobId ?? null }, orderBy: { createdAt: 'desc' } });
  if (cached) summary = cached.result as unknown as CandidateSummaryResult;
  else {
    summary = await buildSummary(auth.companyId, candidateId, app?.jobId ?? null, match);
    await record(auth.companyId, 'SUMMARY', summary, { candidateId, jobId: app?.jobId, engine: summary.engine });
  }

  return {
    application: app ? { id: app.id, jobId: app.job.id, jobTitle: app.job.title } : null,
    applications: applications.map((a) => ({ id: a.id, jobId: a.job.id, jobTitle: a.job.title, matchScore: a.matchScore })),
    match,
    summary,
  };
}

/* ──────────────────────── Job descriptions ──────────────────────── */

const jdSchema = z.object({
  title: z.string(),
  description: z.object({ about: z.string(), responsibilities: z.string(), requirements: z.string(), niceToHave: z.string(), benefits: z.string() }),
  skills: z.array(z.object({ name: z.string(), years: z.number().nullable(), importance: z.enum(['REQUIRED', 'PREFERRED']) })).max(20),
});

export async function generateJD(auth: CompanyAuth, input: AiJobDescriptionInput): Promise<GeneratedJobDescription> {
  await assertWithinLimit(auth.companyId, 'aiAnalyses');
  const company = await prisma.company.findUniqueOrThrow({ where: { id: auth.companyId } });
  const result = await withFallback(
    'job-description',
    async () => {
      const out = jdSchema.parse(
        await llmJson(
          [
            {
              role: 'system',
              content:
                'You write inclusive, specific job descriptions. Return JSON {title, description:{about, responsibilities, requirements, niceToHave, benefits}, skills:[{name, years, importance}]}. Each description field is HTML using <p>, <ul>, <li> only. Avoid gendered language and unnecessary requirements.',
            },
            { role: 'user', content: JSON.stringify({ company: company.name, industry: company.industry, ...input }) },
          ],
          { temperature: 0.7 },
        ),
      );
      return { ...out, engine: 'llm' as const };
    },
    () => generateJobDescription({ prompt: input.prompt, title: input.title, department: input.department, tone: input.tone }),
  );
  await record(auth.companyId, 'JOB_DESCRIPTION', result, { engine: result.engine });
  return result;
}

/* ──────────────────────── Interview questions ──────────────────────── */

const questionsSchema = z.object({
  questions: z.array(z.object({ question: z.string(), category: z.string(), difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']), lookFor: z.string() })).min(1),
});

export async function interviewQuestions(auth: CompanyAuth, input: AiQuestionsInput): Promise<{ questions: InterviewQuestion[]; engine: string }> {
  await assertWithinLimit(auth.companyId, 'aiAnalyses');
  const job = input.jobId ? await loadJob(auth.companyId, input.jobId) : null;
  let focusAreas: string[] = [];
  if (input.candidateId && input.jobId) {
    const app = await prisma.application.findFirst({ where: { candidateId: input.candidateId, jobId: input.jobId, companyId: auth.companyId } });
    if (app) {
      const match = await matchApplication(app.id);
      focusAreas = [...match.missing.map((m) => m.skill), ...match.strongMatches.filter((m) => m.requiredYears && (m.candidateYears ?? 0) < m.requiredYears).map((m) => m.skill)];
    }
  }
  const skills = job?.skills.map((s) => s.name) ?? [];

  const result = await withFallback(
    'interview-questions',
    async () => {
      const out = questionsSchema.parse(
        await llmJson(
          [
            { role: 'system', content: 'You are a senior interviewer. Generate structured interview questions. Return JSON {questions:[{question, category, difficulty, lookFor}]} where lookFor describes what a strong answer contains.' },
            { role: 'user', content: JSON.stringify({ role: input.role, round: input.round, difficulty: input.difficulty, count: input.count, jobSkills: skills, areasToVerify: focusAreas }) },
          ],
          { temperature: 0.8 },
        ),
      );
      return { questions: out.questions.slice(0, input.count), engine: 'llm' };
    },
    () => ({ questions: generateInterviewQuestions({ ...input, skills, focusAreas }), engine: 'heuristic' }),
  );
  await record(auth.companyId, 'INTERVIEW_QUESTIONS', result, { jobId: input.jobId, candidateId: input.candidateId, engine: result.engine });
  return result;
}

/* ─────────────────────────── Resume parsing ─────────────────────────── */

const parsedResumeSchema = z.object({
  name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  headline: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  githubUrl: z.string().nullable(),
  totalYears: z.number().nullable(),
  summary: z.string().nullable(),
  skills: z.array(z.object({ name: z.string(), years: z.number().nullable() })),
  experiences: z.array(z.object({ company: z.string(), title: z.string(), startDate: z.string(), endDate: z.string().nullable(), description: z.string().nullable() })),
  educations: z.array(z.object({ institution: z.string(), degree: z.string(), field: z.string().nullable(), startYear: z.number().nullable(), endYear: z.number().nullable() })),
  projects: z.array(z.object({ name: z.string(), description: z.string(), technologies: z.array(z.string()) })),
  certifications: z.array(z.string()),
});

export async function parseResume(text: string): Promise<{ parsed: ParsedResume; engine: 'llm' | 'heuristic' }> {
  return withFallback<{ parsed: ParsedResume; engine: 'llm' | 'heuristic' }>(
    'resume-parse',
    async () => ({
      parsed: parsedResumeSchema.parse(
        await llmJson(
          [
            { role: 'system', content: 'Extract structured data from the resume. Use ISO dates (YYYY-MM-01). Use null when unknown — never invent data. Return JSON matching: {name,email,phone,location,headline,linkedinUrl,githubUrl,totalYears,summary,skills[{name,years}],experiences[{company,title,startDate,endDate,description}],educations[{institution,degree,field,startYear,endYear}],projects[{name,description,technologies[]}],certifications[]}' },
            { role: 'user', content: text.slice(0, 15000) },
          ],
          { temperature: 0, maxTokens: 3000 },
        ),
      ),
      engine: 'llm' as const,
    }),
    () => ({ parsed: parseResumeText(text), engine: 'heuristic' as const }),
  );
}

/* ───────────────────────────── Assistant ───────────────────────────── */

const intentSchema: z.ZodType<ParsedIntent> = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('SEARCH_CANDIDATES'),
    filters: z.object({
      search: z.string().optional(),
      skills: z.array(z.string()).optional(),
      minExperience: z.number().optional(),
      location: z.string().optional(),
      stage: z.enum(STAGE_TYPES).optional(),
      availability: z.enum(['IMMEDIATE', '15_DAYS', '30_DAYS', '60_DAYS', '90_DAYS']).optional(),
      minMatch: z.number().optional(),
    }),
  }),
  z.object({ intent: z.literal('PENDING_FEEDBACK') }),
  z.object({ intent: z.literal('STAGE_STATS'), stage: z.enum(STAGE_TYPES), sinceDays: z.number(), label: z.string() }),
  z.object({ intent: z.literal('DRAFT_EMAIL'), nameQuery: z.string().nullable(), topic: z.enum(['RESCHEDULE', 'REJECTION', 'OFFER', 'FOLLOW_UP', 'INTERVIEW']) }),
  z.object({ intent: z.literal('HELP') }),
]);

const DRAFTS: Record<string, { subject: string; body: string }> = {
  RESCHEDULE: {
    subject: 'Rescheduling your interview — {{jobTitle}}',
    body: "Hi {{firstName}},\n\nI hope you're doing well. Due to a scheduling conflict on our side, we need to move your upcoming interview for the {{jobTitle}} role. Could you share two or three time slots that work for you over the next few days?\n\nApologies for the inconvenience, and thank you for your flexibility.\n\nBest,\n{{senderName}}",
  },
  REJECTION: DEFAULT_EMAIL_TEMPLATES.REJECTED,
  OFFER: DEFAULT_EMAIL_TEMPLATES.OFFER,
  FOLLOW_UP: DEFAULT_EMAIL_TEMPLATES.FOLLOW_UP,
  INTERVIEW: DEFAULT_EMAIL_TEMPLATES.INTERVIEW_INVITATION,
};

export async function assistant(auth: CompanyAuth, input: AiAssistantInput): Promise<AssistantReply> {
  await assertWithinLimit(auth.companyId, 'aiAnalyses');
  let engine = 'heuristic' as 'llm' | 'heuristic';
  const parsed = await withFallback(
    'assistant-intent',
    async () => {
      const out = intentSchema.parse(
        await llmJson([
          {
            role: 'system',
            content:
              `Classify the recruiter's request into one intent and extract parameters. Return JSON. Intents: ` +
              `SEARCH_CANDIDATES {filters:{search?,skills?[],minExperience?,location?,stage?(${STAGE_TYPES.join('|')}),availability?,minMatch?}}, ` +
              `PENDING_FEEDBACK {}, STAGE_STATS {stage, sinceDays, label}, DRAFT_EMAIL {nameQuery, topic(RESCHEDULE|REJECTION|OFFER|FOLLOW_UP|INTERVIEW)}, HELP {}.`,
          },
          ...input.history.slice(-6),
          { role: 'user', content: input.message },
        ]),
      );
      engine = 'llm';
      return out;
    },
    () => parseRecruiterQuery(input.message),
  );

  const reply = await executeIntent(auth, parsed);
  await record(auth.companyId, 'ASSISTANT', { message: input.message, intent: parsed.intent }, { engine });
  return { ...reply, engine };
}

async function executeIntent(auth: CompanyAuth, parsed: ParsedIntent): Promise<Omit<AssistantReply, 'engine'>> {
  switch (parsed.intent) {
    case 'SEARCH_CANDIDATES': {
      const result = await candidatesService.list(auth, { ...parsed.filters, limit: 8 });
      const desc = describeFilters(parsed.filters);
      return {
        intent: 'SEARCH_CANDIDATES',
        message: result.total ? `Found ${result.total} candidate${result.total === 1 ? '' : 's'}${desc ? ` matching ${desc}` : ''}.` : `No candidates match ${desc || 'that search'} yet.`,
        filters: parsed.filters,
        candidates: result.items,
        total: result.total,
      };
    }
    case 'PENDING_FEEDBACK': {
      const pending = await interviewsService.pendingFeedback(auth, auth.role === 'INTERVIEWER');
      return {
        intent: 'PENDING_FEEDBACK',
        message: pending.length ? `${pending.length} interview${pending.length === 1 ? ' is' : 's are'} waiting for feedback.` : 'All caught up — no interviews are waiting for feedback.',
        items: pending.slice(0, 10).map((i) => ({
          id: i.id,
          title: `${i.candidate.name} · ${i.title}`,
          subtitle: `Waiting on ${i.interviewers.filter((p) => !p.feedbackSubmitted).map((p) => p.name).join(', ')}`,
          link: `/interviews/${i.id}`,
        })),
      };
    }
    case 'STAGE_STATS': {
      const since = new Date(Date.now() - parsed.sinceDays * 86400_000);
      const rows = await prisma.applicationStageHistory.findMany({
        where: { toStageType: parsed.stage, changedAt: { gte: since }, application: { companyId: auth.companyId } },
        orderBy: { changedAt: 'desc' },
        include: { application: { include: { candidate: { select: { id: true, firstName: true, lastName: true } }, job: { select: { title: true } } } } },
      });
      const unique = new Map(rows.map((r) => [r.applicationId, r]));
      return {
        intent: 'STAGE_STATS',
        message: `${unique.size} candidate${unique.size === 1 ? '' : 's'} entered ${STAGE_LABELS[parsed.stage]} ${parsed.label}.`,
        items: [...unique.values()].slice(0, 8).map((r) => ({
          id: r.applicationId,
          title: `${r.application.candidate.firstName} ${r.application.candidate.lastName}`,
          subtitle: r.application.job.title,
          link: `/candidates/${r.application.candidate.id}`,
        })),
      };
    }
    case 'DRAFT_EMAIL': {
      const found = parsed.nameQuery ? await candidatesService.list(auth, { search: parsed.nameQuery, limit: 1 }) : null;
      const candidate = found?.items[0] ?? null;
      const [company, sender] = await Promise.all([
        prisma.company.findUniqueOrThrow({ where: { id: auth.companyId } }),
        prisma.user.findUniqueOrThrow({ where: { id: auth.userId } }),
      ]);
      const tpl = DRAFTS[parsed.topic];
      const vars = {
        firstName: candidate?.firstName ?? parsed.nameQuery ?? 'there',
        jobTitle: candidate?.latestApplication?.jobTitle ?? 'the role',
        companyName: company.name,
        senderName: `${sender.firstName} ${sender.lastName}`,
      };
      return {
        intent: 'DRAFT_EMAIL',
        message: candidate ? `Here's a draft for ${candidate.firstName} ${candidate.lastName}. Review and edit before sending.` : `I couldn't find "${parsed.nameQuery ?? 'that candidate'}", but here's a draft you can adapt.`,
        draft: { candidateId: candidate?.id ?? null, to: candidate?.email ?? '', subject: renderTemplate(tpl.subject, vars), body: renderTemplate(tpl.body, vars) },
      };
    }
    default:
      return HELP_REPLY;
  }
}
