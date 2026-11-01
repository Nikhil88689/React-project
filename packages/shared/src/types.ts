import type {
  Availability,
  CandidateSource,
  EmploymentType,
  ExperienceLevel,
  InterviewStatus,
  InterviewType,
  JobStatus,
  NotificationType,
  ProcessingStep,
  Recommendation,
  StageType,
  WorkMode,
} from './constants';
import type { Permission } from './permissions';
import type { PlanLimits, PlanTier } from './plans';
import type { Role } from './roles';
import type { JobDescription, JobQuestion } from './schemas';

/* ------------------------------ API envelope ------------------------------ */

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PageMeta | CursorMeta;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CursorMeta {
  nextCursor: string | null;
  limit: number;
  total?: number;
}

/* ---------------------------------- Auth ---------------------------------- */

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  phone: string | null;
  timezone: string;
  title: string | null;
  role: Role;
  permissions: Permission[];
  company: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    onboardingCompleted: boolean;
    plan: PlanTier;
  } | null;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

/* ---------------------------------- Jobs ---------------------------------- */

export interface JobStageDTO {
  id: string;
  name: string;
  type: StageType;
  order: number;
}

export interface JobSkillDTO {
  id: string;
  name: string;
  years: number | null;
  importance: 'REQUIRED' | 'PREFERRED';
}

export interface JobSummaryDTO {
  id: string;
  title: string;
  slug: string;
  department: string;
  location: string;
  workMode: WorkMode;
  employmentType: EmploymentType;
  experienceLevel: ExperienceLevel;
  status: JobStatus;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  openings: number;
  createdAt: string;
  publishedAt: string | null;
  applicationCount: number;
  newApplicationCount: number;
  hiringManager: { id: string; name: string } | null;
}

export interface JobDTO extends JobSummaryDTO {
  experienceMin: number | null;
  experienceMax: number | null;
  description: JobDescription;
  questions: JobQuestion[];
  skills: JobSkillDTO[];
  stages: JobStageDTO[];
  stageCounts: Record<string, number>;
}

export interface PublicJobDTO {
  id: string;
  title: string;
  slug: string;
  department: string;
  location: string;
  workMode: WorkMode;
  employmentType: EmploymentType;
  experienceLevel: ExperienceLevel;
  experienceMin: number | null;
  experienceMax: number | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  description: JobDescription;
  questions: JobQuestion[];
  skills: { name: string; importance: 'REQUIRED' | 'PREFERRED' }[];
  publishedAt: string | null;
  company: { name: string; slug: string; logoUrl: string | null; about: string | null; website: string | null; industry: string | null };
}

/* ------------------------------- Candidates ------------------------------- */

export interface CandidateSummaryDTO {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  headline: string | null;
  location: string | null;
  experienceYears: number | null;
  currentCompany: string | null;
  avatarUrl: string | null;
  availability: Availability | null;
  source: CandidateSource;
  skills: string[];
  tags: string[];
  bestMatch: number | null;
  latestApplication: {
    id: string;
    jobId: string;
    jobTitle: string;
    stageName: string;
    stageType: StageType;
  } | null;
  createdAt: string;
}

export interface CandidateExperienceDTO {
  id: string;
  company: string;
  title: string;
  startDate: string;
  endDate: string | null;
  description: string | null;
}

export interface CandidateEducationDTO {
  id: string;
  institution: string;
  degree: string;
  field: string | null;
  startYear: number | null;
  endYear: number | null;
}

export interface CandidateProjectDTO {
  name: string;
  description: string;
  technologies: string[];
}

export interface CandidateDTO extends CandidateSummaryDTO {
  phone: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  summary: string | null;
  expectedSalary: number | null;
  noticePeriodDays: number | null;
  parseStatus: ProcessingStep;
  skillDetails: { id: string; name: string; years: number | null }[];
  experiences: CandidateExperienceDTO[];
  educations: CandidateEducationDTO[];
  projects: CandidateProjectDTO[];
  certifications: string[];
  resume: { id: string; filename: string; size: number; mimeType: string; uploadedAt: string } | null;
  resumeText: string | null;
  applications: ApplicationDTO[];
  pools: { id: string; name: string; color: string | null }[];
}

export interface NoteDTO {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null };
}

/* ------------------------------ Applications ------------------------------ */

export interface ApplicationDTO {
  id: string;
  jobId: string;
  jobTitle: string;
  candidateId: string;
  stageId: string;
  stageName: string;
  stageType: StageType;
  status: 'ACTIVE' | 'HIRED' | 'REJECTED' | 'WITHDRAWN';
  source: CandidateSource;
  matchScore: number | null;
  appliedAt: string;
  stageChangedAt: string;
  answers?: Record<string, string>;
}

export interface PipelineCardDTO {
  id: string;
  candidateId: string;
  candidateName: string;
  avatarUrl: string | null;
  headline: string | null;
  jobId: string;
  jobTitle: string;
  stageId: string;
  stageType: StageType;
  matchScore: number | null;
  experienceYears: number | null;
  appliedAt: string;
  stageChangedAt: string;
  nextInterview: { id: string; startsAt: string; title: string } | null;
  skills: string[];
}

export interface PipelineColumnDTO {
  id: string;
  name: string;
  type: StageType;
  total: number;
  cards: PipelineCardDTO[];
}

export interface StageHistoryDTO {
  id: string;
  fromStageName: string | null;
  toStageName: string;
  changedAt: string;
  changedBy: { id: string; name: string } | null;
}

/* ------------------------------- Interviews ------------------------------- */

export interface InterviewDTO {
  id: string;
  title: string;
  type: InterviewType;
  status: InterviewStatus;
  startsAt: string;
  durationMins: number;
  meetingUrl: string | null;
  location: string | null;
  notes: string | null;
  application: { id: string; jobId: string; jobTitle: string; stageName: string };
  candidate: { id: string; name: string; email: string; avatarUrl: string | null; headline: string | null };
  interviewers: { id: string; name: string; avatarUrl: string | null; feedbackSubmitted: boolean }[];
  feedbackCount: number;
}

export interface FeedbackDTO {
  id: string;
  interviewId: string;
  interviewTitle: string;
  interviewer: { id: string; name: string; avatarUrl: string | null };
  ratings: Record<string, number>;
  overallRating: number;
  recommendation: Recommendation;
  strengths: string | null;
  concerns: string | null;
  privateNotes: string | null;
  submittedAt: string;
}

/* ------------------------------ Notifications ----------------------------- */

export interface NotificationDTO {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface ActivityDTO {
  id: string;
  action: string;
  summary: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  actor: { id: string; name: string; avatarUrl: string | null } | null;
  metadata?: Record<string, unknown> | null;
}

/* ----------------------------------- AI ----------------------------------- */

export interface MatchEvidence {
  skill: string;
  importance: 'REQUIRED' | 'PREFERRED';
  matched: boolean;
  candidateYears: number | null;
  requiredYears: number | null;
  evidence: string | null;
}

export interface MatchResult {
  overall: number;
  breakdown: { skills: number; experience: number; education: number; projects: number };
  strongMatches: MatchEvidence[];
  missing: MatchEvidence[];
  experienceNote: string;
  educationNote: string;
  projectNote: string;
  verifyAreas: string[];
  generatedAt: string;
  engine: 'heuristic' | 'llm';
}

export interface CandidateSummaryResult {
  headline: string;
  summary: string;
  strengths: string[];
  gaps: string[];
  evidence: { claim: string; source: string }[];
  engine: 'heuristic' | 'llm';
  generatedAt: string;
}

export interface InterviewQuestion {
  question: string;
  category: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  lookFor: string;
}

export interface GeneratedJobDescription {
  title: string;
  description: JobDescription;
  skills: { name: string; years: number | null; importance: 'REQUIRED' | 'PREFERRED' }[];
  engine: 'heuristic' | 'llm';
}

export interface CandidateFilters {
  search?: string;
  skills?: string[];
  minExperience?: number;
  location?: string;
  stage?: StageType;
  availability?: Availability;
  minMatch?: number;
}

export interface AssistantReply {
  intent: 'SEARCH_CANDIDATES' | 'PENDING_FEEDBACK' | 'STAGE_STATS' | 'DRAFT_EMAIL' | 'HELP';
  message: string;
  filters?: CandidateFilters;
  candidates?: CandidateSummaryDTO[];
  total?: number;
  draft?: { candidateId: string | null; to: string; subject: string; body: string };
  items?: { id: string; title: string; subtitle: string; link: string }[];
  engine: 'heuristic' | 'llm';
}

/* --------------------------------- Billing -------------------------------- */

export interface BillingOverviewDTO {
  plan: PlanTier;
  status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
  priceMonthly: number;
  currency: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  limits: PlanLimits;
  usage: { activeJobs: number; teamMembers: number; candidates: number; aiAnalyses: number; storageMb: number };
  stripeEnabled: boolean;
  payments: { id: string; amount: number; currency: string; status: string; description: string; paidAt: string | null }[];
}

/* -------------------------------- Analytics ------------------------------- */

export interface DashboardDTO {
  kpis: {
    openPositions: { value: number; change: number };
    candidates: { value: number; change: number };
    interviews: { value: number; change: number };
    hires: { value: number; change: number };
  };
  funnel: { stage: StageType; label: string; count: number }[];
  upcomingInterviews: InterviewDTO[];
  activity: ActivityDTO[];
  applicationsTrend: { date: string; applications: number; hires: number }[];
}

export interface AnalyticsDTO {
  kpis: {
    timeToHireDays: number;
    costPerHire: number;
    offerAcceptance: number;
    applicationToInterview: number;
  };
  applicationsOverTime: { date: string; applications: number; interviews: number; hires: number }[];
  funnel: { stage: StageType; label: string; count: number; conversion: number }[];
  sources: { source: CandidateSource; label: string; applications: number; interviews: number; offers: number; hires: number; conversion: number; share: number }[];
  departments: { department: string; openJobs: number; applications: number; hires: number }[];
  timeInStage: { stage: string; days: number }[];
  topJobs: { id: string; title: string; applications: number; hires: number }[];
}

/* ---------------------------------- Team ---------------------------------- */

export interface TeamMemberDTO {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
  title: string | null;
  status: 'ACTIVE' | 'INVITED' | 'DISABLED';
  lastActiveAt: string | null;
  joinedAt: string | null;
}

export interface SearchResultsDTO {
  candidates: { id: string; name: string; headline: string | null; email: string }[];
  jobs: { id: string; title: string; status: JobStatus; department: string }[];
  applications: { id: string; candidateName: string; jobTitle: string; stageName: string; candidateId: string }[];
  interviews: { id: string; title: string; candidateName: string; startsAt: string }[];
}
