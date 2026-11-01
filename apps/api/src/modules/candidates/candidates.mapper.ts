import type { Prisma } from '@prisma/client';
import type {
  ApplicationDTO,
  Availability,
  CandidateDTO,
  CandidateProjectDTO,
  CandidateSummaryDTO,
  ProcessingStep,
} from '@recruitflow/shared';

export const candidateSummaryInclude = {
  skills: { select: { name: true, years: true }, orderBy: { years: 'desc' }, take: 8 },
  applications: {
    orderBy: { appliedAt: 'desc' },
    select: {
      id: true,
      jobId: true,
      matchScore: true,
      stageType: true,
      job: { select: { title: true } },
      stage: { select: { name: true } },
    },
  },
} satisfies Prisma.CandidateInclude;

type CandidateSummaryRow = Prisma.CandidateGetPayload<{ include: typeof candidateSummaryInclude }>;

export function toCandidateSummary(c: CandidateSummaryRow): CandidateSummaryDTO {
  const latest = c.applications[0];
  const scores = c.applications.map((a) => a.matchScore).filter((s): s is number => s != null);
  return {
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    headline: c.headline,
    location: c.location,
    experienceYears: c.experienceYears,
    currentCompany: c.currentCompany,
    avatarUrl: c.avatarUrl,
    availability: c.availability as Availability | null,
    source: c.source,
    skills: c.skills.map((s) => s.name),
    tags: c.tags,
    bestMatch: scores.length ? Math.max(...scores) : null,
    latestApplication: latest
      ? { id: latest.id, jobId: latest.jobId, jobTitle: latest.job.title, stageName: latest.stage.name, stageType: latest.stageType }
      : null,
    createdAt: c.createdAt.toISOString(),
  };
}

export const candidateDetailInclude = {
  skills: { orderBy: { years: 'desc' } },
  experiences: { orderBy: { startDate: 'desc' } },
  educations: { orderBy: { endYear: 'desc' } },
  files: { where: { kind: 'RESUME', status: 'UPLOADED' }, orderBy: { createdAt: 'desc' }, take: 1 },
  poolEntries: { include: { pool: { select: { id: true, name: true, color: true } } } },
  applications: {
    orderBy: { appliedAt: 'desc' },
    include: { job: { select: { title: true } }, stage: { select: { name: true } } },
  },
} satisfies Prisma.CandidateInclude;

type CandidateDetailRow = Prisma.CandidateGetPayload<{ include: typeof candidateDetailInclude }>;

export function toApplicationDTO(a: CandidateDetailRow['applications'][number]): ApplicationDTO {
  return {
    id: a.id,
    jobId: a.jobId,
    jobTitle: a.job.title,
    candidateId: a.candidateId,
    stageId: a.stageId,
    stageName: a.stage.name,
    stageType: a.stageType,
    status: a.status,
    source: a.source,
    matchScore: a.matchScore,
    appliedAt: a.appliedAt.toISOString(),
    stageChangedAt: a.stageChangedAt.toISOString(),
    answers: (a.answers as Record<string, string>) ?? {},
  };
}

export function toCandidateDTO(c: CandidateDetailRow): CandidateDTO {
  const resume = c.files[0];
  const scores = c.applications.map((a) => a.matchScore).filter((s): s is number => s != null);
  const latest = c.applications[0];
  return {
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    headline: c.headline,
    location: c.location,
    experienceYears: c.experienceYears,
    currentCompany: c.currentCompany,
    avatarUrl: c.avatarUrl,
    availability: c.availability as Availability | null,
    source: c.source,
    skills: c.skills.map((s) => s.name),
    tags: c.tags,
    bestMatch: scores.length ? Math.max(...scores) : null,
    latestApplication: latest
      ? { id: latest.id, jobId: latest.jobId, jobTitle: latest.job.title, stageName: latest.stage.name, stageType: latest.stageType }
      : null,
    createdAt: c.createdAt.toISOString(),
    linkedinUrl: c.linkedinUrl,
    githubUrl: c.githubUrl,
    portfolioUrl: c.portfolioUrl,
    summary: c.summary,
    expectedSalary: c.expectedSalary,
    noticePeriodDays: c.noticePeriodDays,
    parseStatus: c.parseStatus as ProcessingStep,
    skillDetails: c.skills.map((s) => ({ id: s.id, name: s.name, years: s.years })),
    experiences: c.experiences.map((e) => ({
      id: e.id,
      company: e.company,
      title: e.title,
      startDate: e.startDate.toISOString(),
      endDate: e.endDate?.toISOString() ?? null,
      description: e.description,
    })),
    educations: c.educations.map((e) => ({
      id: e.id,
      institution: e.institution,
      degree: e.degree,
      field: e.field,
      startYear: e.startYear,
      endYear: e.endYear,
    })),
    projects: (c.projects as unknown as CandidateProjectDTO[]) ?? [],
    certifications: c.certifications,
    resume: resume
      ? { id: resume.id, filename: resume.filename, size: resume.size, mimeType: resume.mimeType, uploadedAt: resume.createdAt.toISOString() }
      : null,
    resumeText: c.resumeText,
    applications: c.applications.map(toApplicationDTO),
    pools: c.poolEntries.map((p) => p.pool),
  };
}
