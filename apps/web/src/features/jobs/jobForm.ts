import { createJobSchema, DEFAULT_WORKFLOW, type CreateJobInput, type JobDTO } from '@recruitflow/shared';

export type JobFormValues = CreateJobInput & { stages: NonNullable<CreateJobInput['stages']> };

export const jobFormSchema = createJobSchema;

export const EMPTY_DESCRIPTION = { about: '', responsibilities: '', requirements: '', niceToHave: '', benefits: '' };

export function emptyJob(stages = DEFAULT_WORKFLOW): JobFormValues {
  return {
    title: '',
    department: 'Engineering',
    employmentType: 'FULL_TIME',
    experienceLevel: 'MID',
    experienceMin: null,
    experienceMax: null,
    location: '',
    workMode: 'HYBRID',
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: 'INR',
    openings: 1,
    description: EMPTY_DESCRIPTION,
    skills: [],
    stages: stages.map((s) => ({ name: s.name, type: s.type })),
    questions: [],
  };
}

export function jobToForm(job: JobDTO): JobFormValues {
  return {
    title: job.title,
    department: job.department,
    employmentType: job.employmentType,
    experienceLevel: job.experienceLevel,
    experienceMin: job.experienceMin,
    experienceMax: job.experienceMax,
    location: job.location,
    workMode: job.workMode,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    salaryCurrency: job.salaryCurrency,
    openings: job.openings,
    description: { ...EMPTY_DESCRIPTION, ...job.description },
    skills: job.skills.map((s) => ({ name: s.name, years: s.years, importance: s.importance })),
    stages: job.stages.map((s) => ({ id: s.id, name: s.name, type: s.type })),
    questions: job.questions,
  };
}

export const STEPS = [
  { key: 'basics', label: 'Basic info', fields: ['title', 'department', 'employmentType', 'experienceLevel', 'location', 'workMode', 'openings', 'salaryMin', 'salaryMax', 'salaryCurrency'] },
  { key: 'description', label: 'Description', fields: ['description'] },
  { key: 'requirements', label: 'Requirements', fields: ['skills', 'experienceMin', 'experienceMax'] },
  { key: 'process', label: 'Interview process', fields: ['stages'] },
  { key: 'form', label: 'Application form', fields: ['questions'] },
  { key: 'preview', label: 'Preview', fields: [] },
  { key: 'publish', label: 'Publish', fields: [] },
] as const;

export const DESCRIPTION_SECTIONS = [
  { key: 'about', label: 'About the role', placeholder: 'What will this person own? Why does the role matter?' },
  { key: 'responsibilities', label: 'Responsibilities', placeholder: 'What they will do day to day…' },
  { key: 'requirements', label: 'Requirements', placeholder: 'Must-have skills and experience…' },
  { key: 'niceToHave', label: 'Nice to have', placeholder: 'Bonus skills…' },
  { key: 'benefits', label: 'Benefits', placeholder: 'Compensation, perks, growth…' },
] as const;
