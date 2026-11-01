import { Router } from 'express';
import {
  CANDIDATE_STAGE_LABELS,
  presignUploadSchema,
  publicApplySchema,
  type JobDescription,
  type JobQuestion,
  type PublicJobDTO,
} from '@recruitflow/shared';
import { randomToken } from '../../lib/crypto';
import { errors } from '../../lib/errors';
import { ok, param, parse } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { enqueue } from '../../lib/queue';
import { publicApplyLimiter } from '../../middleware/rateLimit';
import { createApplication } from '../applications/applications.service';
import { createUpload, finalizeUpload } from '../files/files.service';

export const publicRouter = Router();

type JobRow = NonNullable<Awaited<ReturnType<typeof findJob>>>;

function findJob(slug: string) {
  return prisma.job.findFirst({ where: { slug, status: 'PUBLISHED' }, include: { skills: true, company: true } });
}

const toPublicJob = (job: JobRow): PublicJobDTO => ({
  id: job.id,
  title: job.title,
  slug: job.slug,
  department: job.department,
  location: job.location,
  workMode: job.workMode,
  employmentType: job.employmentType,
  experienceLevel: job.experienceLevel,
  experienceMin: job.experienceMin,
  experienceMax: job.experienceMax,
  salaryMin: job.salaryMin,
  salaryMax: job.salaryMax,
  salaryCurrency: job.salaryCurrency,
  description: job.description as JobDescription,
  questions: job.questions as JobQuestion[],
  skills: job.skills.map((s) => ({ name: s.name, importance: s.importance })),
  publishedAt: job.publishedAt?.toISOString() ?? null,
  company: {
    name: job.company.name,
    slug: job.company.slug,
    logoUrl: job.company.logoUrl,
    about: job.company.about,
    website: job.company.website,
    industry: job.company.industry,
  },
});

publicRouter.get('/jobs/:slug', async (req, res) => {
  const job = await findJob(param(req.params.slug));
  if (!job) throw errors.notFound('Job');
  ok(res, toPublicJob(job));
});

publicRouter.get('/companies/:slug/jobs', async (req, res) => {
  const company = await prisma.company.findUnique({ where: { slug: param(req.params.slug) } });
  if (!company) throw errors.notFound('Company');
  const jobs = await prisma.job.findMany({
    where: { companyId: company.id, status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    select: { id: true, title: true, slug: true, department: true, location: true, workMode: true, employmentType: true, publishedAt: true },
  });
  ok(res, { company: { name: company.name, slug: company.slug, logoUrl: company.logoUrl, about: company.about, industry: company.industry }, jobs });
});

publicRouter.post('/jobs/:slug/resume', publicApplyLimiter, async (req, res) => {
  const job = await findJob(param(req.params.slug));
  if (!job) throw errors.notFound('Job');
  ok(res, await createUpload({ kind: 'RESUME', companyId: job.companyId, input: parse(presignUploadSchema, req.body) }), 201);
});

publicRouter.post('/jobs/:slug/apply', publicApplyLimiter, async (req, res) => {
  const job = await findJob(param(req.params.slug));
  if (!job) throw errors.notFound('Job');
  const input = parse(publicApplySchema, req.body);

  const missing = (job.questions as JobQuestion[]).filter((q) => q.required && !input.answers[q.id]?.trim());
  if (missing.length) throw errors.validation({ fieldErrors: Object.fromEntries(missing.map((q) => [`answers.${q.id}`, ['This question is required']])) });

  const file = await finalizeUpload(input.resumeFileId, { companyId: job.companyId });
  if (file.candidateId) throw errors.badRequest('This resume was already used for another application', undefined, 'FILE_IN_USE');

  const existing = await prisma.candidate.findUnique({ where: { companyId_email: { companyId: job.companyId, email: input.email } } });
  const linkedUser = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  const fields = {
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    linkedinUrl: input.linkedinUrl ?? null,
    githubUrl: input.githubUrl ?? null,
    portfolioUrl: input.portfolioUrl ?? null,
    currentCompany: input.currentCompany ?? null,
    experienceYears: input.experienceYears,
    expectedSalary: input.expectedSalary ?? null,
    noticePeriodDays: input.noticePeriodDays ?? null,
    parseStatus: 'PROCESSING' as const,
    userId: linkedUser?.id ?? existing?.userId ?? null,
  };
  const candidate = existing
    ? await prisma.candidate.update({ where: { id: existing.id }, data: fields })
    : await prisma.candidate.create({ data: { ...fields, companyId: job.companyId, email: input.email, source: input.source } });

  const trackingToken = randomToken(18);
  const application = await createApplication(
    { companyId: job.companyId, userId: null },
    { candidateId: candidate.id, jobId: job.id, source: input.source, answers: input.answers, trackingToken },
  );
  await prisma.file.update({ where: { id: file.id }, data: { candidateId: candidate.id } });
  await enqueue('resume.process', { fileId: file.id, candidateId: candidate.id, applicationId: application.id, companyId: job.companyId });

  ok(res, { applicationId: application.id, trackingToken }, 201);
});

/** Lets the applicant watch resume processing progress without an account. */
publicRouter.get('/applications/:token', async (req, res) => {
  const app = await prisma.application.findUnique({
    where: { trackingToken: param(req.params.token) },
    include: { job: { select: { title: true, company: { select: { name: true } } } }, candidate: { select: { firstName: true, parseStatus: true } } },
  });
  if (!app) throw errors.notFound('Application');
  ok(res, {
    jobTitle: app.job.title,
    companyName: app.job.company.name,
    firstName: app.candidate.firstName,
    processingStep: app.candidate.parseStatus,
    status: CANDIDATE_STAGE_LABELS[app.stageType],
    appliedAt: app.appliedAt.toISOString(),
  });
});
