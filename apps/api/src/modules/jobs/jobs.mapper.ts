import type { Job, JobSkill, JobStage, User } from '@prisma/client';
import type { JobDTO, JobDescription, JobQuestion, JobSummaryDTO } from '@recruitflow/shared';

type JobWithRelations = Job & {
  hiringManager?: Pick<User, 'id' | 'firstName' | 'lastName'> | null;
  _count?: { applications: number };
};

const EMPTY_DESCRIPTION: JobDescription = { about: '', responsibilities: '', requirements: '', niceToHave: '', benefits: '' };

export function toJobSummary(job: JobWithRelations, newApplications = 0): JobSummaryDTO {
  return {
    id: job.id,
    title: job.title,
    slug: job.slug,
    department: job.department,
    location: job.location,
    workMode: job.workMode,
    employmentType: job.employmentType,
    experienceLevel: job.experienceLevel,
    status: job.status,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    salaryCurrency: job.salaryCurrency,
    openings: job.openings,
    createdAt: job.createdAt.toISOString(),
    publishedAt: job.publishedAt?.toISOString() ?? null,
    applicationCount: job._count?.applications ?? 0,
    newApplicationCount: newApplications,
    hiringManager: job.hiringManager
      ? { id: job.hiringManager.id, name: `${job.hiringManager.firstName} ${job.hiringManager.lastName}` }
      : null,
  };
}

export function toJobDTO(
  job: JobWithRelations & { skills: JobSkill[]; stages: JobStage[] },
  stageCounts: Record<string, number>,
  newApplications = 0,
): JobDTO {
  return {
    ...toJobSummary(job, newApplications),
    experienceMin: job.experienceMin,
    experienceMax: job.experienceMax,
    description: { ...EMPTY_DESCRIPTION, ...(job.description as Partial<JobDescription>) },
    questions: (job.questions as JobQuestion[]) ?? [],
    skills: job.skills.map((s) => ({ id: s.id, name: s.name, years: s.years, importance: s.importance })),
    stages: [...job.stages].sort((a, b) => a.order - b.order).map((s) => ({ id: s.id, name: s.name, type: s.type, order: s.order })),
    stageCounts,
  };
}
