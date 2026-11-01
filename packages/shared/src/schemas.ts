import { z } from 'zod';
import {
  AVAILABILITY,
  CANDIDATE_SOURCES,
  COMPANY_SIZES,
  EMAIL_TEMPLATE_KEYS,
  EMPLOYMENT_TYPES,
  EVALUATION_CRITERIA,
  EXPERIENCE_LEVELS,
  INTERVIEW_TYPES,
  JOB_STATUSES,
  RECOMMENDATIONS,
  STAGE_TYPES,
  WORK_MODES,
} from './constants';
import { COMPANY_ROLES } from './roles';
import { PLAN_TIERS } from './plans';

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');
const optionalUrl = z
  .string()
  .trim()
  .url('Enter a valid URL')
  .max(500)
  .optional()
  .or(z.literal('').transform(() => undefined));
const nullableInt = (max: number) => z.number().int().min(0).max(max).nullable().optional();

/* ---------------------------------- Auth ---------------------------------- */

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(60),
  lastName: z.string().trim().min(1, 'Last name is required').max(60),
  email,
  password,
  companyName: z.string().trim().min(2, 'Company name is required').max(120),
  companySize: z.enum(COMPANY_SIZES, { errorMap: () => ({ message: 'Select a company size' }) }),
  industry: z.string().trim().min(1, 'Select an industry').max(80),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const candidateRegisterSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email,
  password,
});
export type CandidateRegisterInput = z.infer<typeof candidateRegisterSchema>;

export const forgotPasswordSchema = z.object({ email });
export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password,
});
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: password,
});
export const acceptInviteSchema = z.object({
  token: z.string().min(20).max(200),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  password,
});

/* --------------------------------- Company -------------------------------- */

export const companyUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  industry: z.string().trim().max(80).optional(),
  size: z.enum(COMPANY_SIZES).optional(),
  website: optionalUrl,
  location: z.string().trim().max(120).optional(),
  logoUrl: optionalUrl,
  about: z.string().trim().max(2000).optional(),
  onboardingCompleted: z.boolean().optional(),
});
export type CompanyUpdateInput = z.infer<typeof companyUpdateSchema>;

export const profileUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  phone: z.string().trim().max(30).optional(),
  timezone: z.string().trim().max(60).optional(),
  avatarUrl: optionalUrl,
  title: z.string().trim().max(80).optional(),
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

export const workflowStageSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'Stage name is required').max(60),
  type: z.enum(STAGE_TYPES),
});
export type WorkflowStageInput = z.infer<typeof workflowStageSchema>;

const workflowStagesArray = z
  .array(workflowStageSchema)
  .min(2, 'A workflow needs at least two stages')
  .max(15)
  .refine((stages) => stages.some((s) => s.type === 'APPLIED'), 'Workflow must include an Applied stage')
  .refine((stages) => stages.some((s) => s.type === 'HIRED'), 'Workflow must include a Hired stage');

export const workflowUpdateSchema = z.object({ stages: workflowStagesArray });

/* ---------------------------------- Team ---------------------------------- */

export const inviteMemberSchema = z.object({
  email,
  role: z.enum(COMPANY_ROLES),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberSchema = z.object({
  role: z.enum(COMPANY_ROLES).optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
});

/* ---------------------------------- Jobs ---------------------------------- */

export const jobSkillSchema = z.object({
  name: z.string().trim().min(1, 'Skill name is required').max(60),
  years: nullableInt(30),
  importance: z.enum(['REQUIRED', 'PREFERRED']),
});
export type JobSkillInput = z.infer<typeof jobSkillSchema>;

export const jobQuestionSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().trim().min(1, 'Question is required').max(300),
  type: z.enum(['SHORT_TEXT', 'LONG_TEXT', 'YES_NO']),
  required: z.boolean(),
});
export type JobQuestion = z.infer<typeof jobQuestionSchema>;

export const jobDescriptionSchema = z.object({
  about: z.string().max(20000),
  responsibilities: z.string().max(20000),
  requirements: z.string().max(20000),
  niceToHave: z.string().max(20000),
  benefits: z.string().max(20000),
});
export type JobDescription = z.infer<typeof jobDescriptionSchema>;

export const jobBaseSchema = z.object({
  title: z.string().trim().min(3, 'Job title must be at least 3 characters').max(120),
  department: z.string().trim().min(1, 'Department is required').max(60),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  experienceLevel: z.enum(EXPERIENCE_LEVELS),
  experienceMin: nullableInt(40),
  experienceMax: nullableInt(40),
  location: z.string().trim().min(2, 'Location is required').max(120),
  workMode: z.enum(WORK_MODES),
  salaryMin: z.number().int().nonnegative().nullable().optional(),
  salaryMax: z.number().int().nonnegative().nullable().optional(),
  salaryCurrency: z.string().length(3),
  openings: z.number().int().min(1).max(100),
  description: jobDescriptionSchema,
  skills: z.array(jobSkillSchema).max(40),
  stages: workflowStagesArray.optional(),
  questions: z.array(jobQuestionSchema).max(15),
});

const salaryRangeValid = (v: { salaryMin?: number | null; salaryMax?: number | null }) =>
  v.salaryMin == null || v.salaryMax == null || v.salaryMin <= v.salaryMax;
const experienceRangeValid = (v: { experienceMin?: number | null; experienceMax?: number | null }) =>
  v.experienceMin == null || v.experienceMax == null || v.experienceMin <= v.experienceMax;

export const createJobSchema = jobBaseSchema
  .refine(salaryRangeValid, { message: 'Minimum salary cannot exceed maximum', path: ['salaryMax'] })
  .refine(experienceRangeValid, { message: 'Minimum experience cannot exceed maximum', path: ['experienceMax'] });
export type CreateJobInput = z.infer<typeof createJobSchema>;

export const updateJobSchema = jobBaseSchema
  .partial()
  .refine(salaryRangeValid, { message: 'Minimum salary cannot exceed maximum', path: ['salaryMax'] });
export type UpdateJobInput = z.infer<typeof updateJobSchema>;

export const jobListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(JOB_STATUSES).optional(),
  department: z.string().trim().max(60).optional(),
  location: z.string().trim().max(120).optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  createdAfter: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['createdAt', 'title', 'applications']).default('createdAt'),
});

/* ------------------------------- Candidates ------------------------------- */

export const candidateListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  skills: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined)),
  minExperience: z.coerce.number().min(0).max(50).optional(),
  maxExperience: z.coerce.number().min(0).max(50).optional(),
  location: z.string().trim().max(120).optional(),
  stage: z.enum(STAGE_TYPES).optional(),
  minMatch: z.coerce.number().int().min(0).max(100).optional(),
  availability: z.enum(AVAILABILITY).optional(),
  jobId: z.string().optional(),
  source: z.enum(CANDIDATE_SOURCES).optional(),
  poolId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});
export type CandidateListQuery = z.infer<typeof candidateListQuerySchema>;

export const candidateCreateSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email,
  phone: z.string().trim().max(30).optional(),
  location: z.string().trim().max(120).optional(),
  headline: z.string().trim().max(160).optional(),
  currentCompany: z.string().trim().max(120).optional(),
  experienceYears: z.number().min(0).max(60).optional(),
  linkedinUrl: optionalUrl,
  githubUrl: optionalUrl,
  portfolioUrl: optionalUrl,
  source: z.enum(CANDIDATE_SOURCES).default('OTHER'),
  skills: z.array(z.string().trim().min(1).max(60)).max(60).optional(),
  jobId: z.string().optional(),
});
export type CandidateCreateInput = z.infer<typeof candidateCreateSchema>;

export const candidateUpdateSchema = candidateCreateSchema
  .omit({ jobId: true })
  .partial()
  .extend({
    availability: z.enum(AVAILABILITY).optional(),
    tags: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
    summary: z.string().trim().max(4000).optional(),
  });

export const noteSchema = z.object({
  body: z.string().trim().min(1, 'Note cannot be empty').max(5000),
});

export const sendMessageSchema = z.object({
  candidateId: z.string().min(1),
  subject: z.string().trim().min(1, 'Subject is required').max(200),
  body: z.string().trim().min(1, 'Message is required').max(20000),
  templateKey: z.enum(EMAIL_TEMPLATE_KEYS).optional(),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

/* ------------------------------ Applications ------------------------------ */

export const moveStageSchema = z
  .object({
    stageId: z.string().optional(),
    stageType: z.enum(STAGE_TYPES).optional(),
    rejectionReason: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.stageId || v.stageType, 'stageId or stageType is required');
export type MoveStageInput = z.infer<typeof moveStageSchema>;

export const applicationListQuerySchema = z.object({
  jobId: z.string().optional(),
  stage: z.enum(STAGE_TYPES).optional(),
  minMatch: z.coerce.number().int().min(0).max(100).optional(),
  search: z.string().trim().max(100).optional(),
  limitPerStage: z.coerce.number().int().min(1).max(200).default(50),
});

export const createApplicationSchema = z.object({
  candidateId: z.string().min(1),
  jobId: z.string().min(1),
  source: z.enum(CANDIDATE_SOURCES).optional(),
});

/** Public application form submitted by candidates on the careers page. */
export const publicApplySchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(60),
  lastName: z.string().trim().min(1, 'Last name is required').max(60),
  email,
  phone: z.string().trim().min(6, 'Enter a valid phone number').max(30),
  resumeFileId: z.string().min(1, 'Please upload your resume'),
  linkedinUrl: optionalUrl,
  githubUrl: optionalUrl,
  portfolioUrl: optionalUrl,
  currentCompany: z.string().trim().max(120).optional(),
  experienceYears: z.number().min(0).max(60),
  expectedSalary: z.number().int().nonnegative().nullable().optional(),
  noticePeriodDays: z.number().int().min(0).max(365).nullable().optional(),
  answers: z.record(z.string().max(5000)).default({}),
  source: z.enum(CANDIDATE_SOURCES).default('CAREERS_PAGE'),
});
export type PublicApplyInput = z.infer<typeof publicApplySchema>;

export const presignUploadSchema = z.object({
  filename: z.string().trim().min(1).max(200),
  mimeType: z.string().max(200),
  size: z.number().int().positive(),
});
export type PresignUploadInput = z.infer<typeof presignUploadSchema>;

/* ------------------------------- Interviews ------------------------------- */

export const createInterviewSchema = z.object({
  applicationId: z.string().min(1, 'Select a candidate'),
  type: z.enum(INTERVIEW_TYPES),
  title: z.string().trim().max(120).optional(),
  interviewerIds: z.array(z.string()).min(1, 'Select at least one interviewer').max(10),
  startsAt: z.coerce.date(),
  durationMins: z.number().int().min(15).max(480),
  meetingUrl: optionalUrl,
  location: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(5000).optional(),
});
export type CreateInterviewInput = z.infer<typeof createInterviewSchema>;

export const updateInterviewSchema = z.object({
  startsAt: z.coerce.date().optional(),
  durationMins: z.number().int().min(15).max(480).optional(),
  meetingUrl: optionalUrl,
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
  notes: z.string().trim().max(5000).optional(),
});

export const interviewListQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  mine: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
  candidateId: z.string().optional(),
});

const ratingsShape = Object.fromEntries(
  EVALUATION_CRITERIA.map((c) => [c.key, z.number().int().min(1, 'Required').max(5)]),
) as Record<(typeof EVALUATION_CRITERIA)[number]['key'], z.ZodNumber>;

export const feedbackSchema = z.object({
  ratings: z.object(ratingsShape),
  recommendation: z.enum(RECOMMENDATIONS, { errorMap: () => ({ message: 'Select a recommendation' }) }),
  strengths: z.string().trim().max(5000).optional(),
  concerns: z.string().trim().max(5000).optional(),
  privateNotes: z.string().trim().max(5000).optional(),
});
export type FeedbackInput = z.infer<typeof feedbackSchema>;

/* ------------------------------- Talent pool ------------------------------ */

export const talentPoolSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  description: z.string().trim().max(500).optional(),
  color: z.string().trim().max(20).optional(),
});
export const talentPoolMemberSchema = z.object({ candidateIds: z.array(z.string()).min(1).max(200) });

/* ----------------------------------- AI ----------------------------------- */

export const aiJobDescriptionSchema = z.object({
  prompt: z.string().trim().min(5, 'Describe the role in a few words').max(2000),
  title: z.string().trim().max(120).optional(),
  department: z.string().trim().max(60).optional(),
  experienceLevel: z.enum(EXPERIENCE_LEVELS).optional(),
  tone: z.enum(['PROFESSIONAL', 'FRIENDLY', 'CONCISE']).default('PROFESSIONAL'),
});
export type AiJobDescriptionInput = z.infer<typeof aiJobDescriptionSchema>;

export const aiQuestionsSchema = z.object({
  jobId: z.string().optional(),
  candidateId: z.string().optional(),
  role: z.string().trim().min(2).max(120),
  round: z.enum(INTERVIEW_TYPES),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  count: z.number().int().min(3).max(15).default(6),
});
export type AiQuestionsInput = z.infer<typeof aiQuestionsSchema>;

export const aiMatchSchema = z.object({
  candidateId: z.string().min(1),
  jobId: z.string().min(1),
  refresh: z.boolean().default(false),
});

export const aiAssistantSchema = z.object({
  message: z.string().trim().min(1).max(1000),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) }))
    .max(20)
    .default([]),
});
export type AiAssistantInput = z.infer<typeof aiAssistantSchema>;

/* --------------------------------- Billing -------------------------------- */

export const changePlanSchema = z.object({ plan: z.enum(PLAN_TIERS) });

/* ---------------------------------- Misc ---------------------------------- */

export const searchQuerySchema = z.object({ q: z.string().trim().min(1).max(100) });

export const auditLogQuerySchema = z.object({
  action: z.string().max(40).optional(),
  actorId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const analyticsQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d', '180d', '365d']).default('30d'),
  jobId: z.string().optional(),
});
