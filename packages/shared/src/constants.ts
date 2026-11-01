export const STAGE_TYPES = [
  'APPLIED',
  'SCREENING',
  'SHORTLISTED',
  'INTERVIEW',
  'OFFER',
  'HIRED',
  'REJECTED',
] as const;
export type StageType = (typeof STAGE_TYPES)[number];

/** Stage types that form the forward-moving hiring funnel (REJECTED is terminal & off-funnel). */
export const FUNNEL_STAGE_TYPES: StageType[] = ['APPLIED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED'];

export const STAGE_LABELS: Record<StageType, string> = {
  APPLIED: 'Applied',
  SCREENING: 'Screening',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  HIRED: 'Hired',
  REJECTED: 'Rejected',
};

/** Candidate-facing wording, so internal stage names never leak to applicants. */
export const CANDIDATE_STAGE_LABELS: Record<StageType, string> = {
  APPLIED: 'Application received',
  SCREENING: 'Under review',
  SHORTLISTED: 'Under review',
  INTERVIEW: 'Interviewing',
  OFFER: 'Offer extended',
  HIRED: 'Hired',
  REJECTED: 'Not selected',
};

export const DEFAULT_WORKFLOW: { name: string; type: StageType }[] = [
  { name: 'Applied', type: 'APPLIED' },
  { name: 'Resume Screening', type: 'SCREENING' },
  { name: 'Shortlisted', type: 'SHORTLISTED' },
  { name: 'Recruiter Call', type: 'INTERVIEW' },
  { name: 'Technical Interview', type: 'INTERVIEW' },
  { name: 'HR Round', type: 'INTERVIEW' },
  { name: 'Offer', type: 'OFFER' },
  { name: 'Hired', type: 'HIRED' },
  { name: 'Rejected', type: 'REJECTED' },
];

export const JOB_STATUSES = ['DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  INTERNSHIP: 'Internship',
};

export const WORK_MODES = ['ONSITE', 'HYBRID', 'REMOTE'] as const;
export type WorkMode = (typeof WORK_MODES)[number];
export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  ONSITE: 'On-site',
  HYBRID: 'Hybrid',
  REMOTE: 'Remote',
};

export const EXPERIENCE_LEVELS = ['ENTRY', 'MID', 'SENIOR', 'LEAD'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];
export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  ENTRY: 'Entry (0–2 yrs)',
  MID: 'Mid (2–5 yrs)',
  SENIOR: 'Senior (5–8 yrs)',
  LEAD: 'Lead (8+ yrs)',
};

export const DEPARTMENTS = ['Engineering', 'Product', 'Design', 'Data', 'Marketing', 'Sales', 'Operations', 'People', 'Finance'] as const;

export const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'] as const;
export const COMPANY_SIZE_LABELS: Record<(typeof COMPANY_SIZES)[number], string> = {
  '1-10': '1–10',
  '11-50': '11–50',
  '51-200': '51–200',
  '201-500': '201–500',
  '500+': '500+',
};

export const INDUSTRIES = [
  'Software & Internet',
  'Fintech',
  'E-commerce',
  'Healthcare',
  'Education',
  'Consulting',
  'Manufacturing',
  'Media',
  'Other',
] as const;

export const CANDIDATE_SOURCES = ['LINKEDIN', 'CAREERS_PAGE', 'REFERRAL', 'INDEED', 'NAUKRI', 'AGENCY', 'OTHER'] as const;
export type CandidateSource = (typeof CANDIDATE_SOURCES)[number];
export const SOURCE_LABELS: Record<CandidateSource, string> = {
  LINKEDIN: 'LinkedIn',
  CAREERS_PAGE: 'Careers page',
  REFERRAL: 'Referral',
  INDEED: 'Indeed',
  NAUKRI: 'Naukri',
  AGENCY: 'Agency',
  OTHER: 'Other',
};

export const AVAILABILITY = ['IMMEDIATE', '15_DAYS', '30_DAYS', '60_DAYS', '90_DAYS'] as const;
export type Availability = (typeof AVAILABILITY)[number];
export const AVAILABILITY_LABELS: Record<Availability, string> = {
  IMMEDIATE: 'Immediate',
  '15_DAYS': '15 days',
  '30_DAYS': '30 days',
  '60_DAYS': '60 days',
  '90_DAYS': '90 days',
};

export const INTERVIEW_TYPES = ['PHONE_SCREEN', 'TECHNICAL', 'SYSTEM_DESIGN', 'HR', 'CULTURE_FIT', 'FINAL'] as const;
export type InterviewType = (typeof INTERVIEW_TYPES)[number];
export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  PHONE_SCREEN: 'Recruiter Call',
  TECHNICAL: 'Technical Interview',
  SYSTEM_DESIGN: 'System Design',
  HR: 'HR Round',
  CULTURE_FIT: 'Culture Fit',
  FINAL: 'Final Round',
};

export const INTERVIEW_STATUSES = ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export const RECOMMENDATIONS = ['STRONG_YES', 'PROCEED', 'HOLD', 'NO'] as const;
export type Recommendation = (typeof RECOMMENDATIONS)[number];
export const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  STRONG_YES: 'Strong hire',
  PROCEED: 'Proceed',
  HOLD: 'Hold',
  NO: 'Do not proceed',
};

export const EVALUATION_CRITERIA = [
  { key: 'technical', label: 'Technical Knowledge' },
  { key: 'problemSolving', label: 'Problem Solving' },
  { key: 'communication', label: 'Communication' },
  { key: 'roleSkill', label: 'Role-specific Skill' },
  { key: 'cultureAdd', label: 'Culture Add' },
] as const;

export const EMAIL_TEMPLATE_KEYS = ['APPLICATION_RECEIVED', 'INTERVIEW_INVITATION', 'REJECTED', 'OFFER', 'FOLLOW_UP'] as const;
export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

export const AUDIT_ACTIONS = [
  'LOGIN',
  'LOGOUT',
  'REGISTER',
  'CREATE_JOB',
  'UPDATE_JOB',
  'PUBLISH_JOB',
  'CLOSE_JOB',
  'DELETE_JOB',
  'CREATE_CANDIDATE',
  'UPDATE_CANDIDATE',
  'CREATE_APPLICATION',
  'MOVE_CANDIDATE',
  'SCHEDULE_INTERVIEW',
  'CANCEL_INTERVIEW',
  'SUBMIT_FEEDBACK',
  'ADD_NOTE',
  'SEND_MESSAGE',
  'INVITE_MEMBER',
  'CHANGE_ROLE',
  'REMOVE_MEMBER',
  'UPDATE_COMPANY',
  'UPDATE_WORKFLOW',
  'CHANGE_PLAN',
  'CHANGE_PASSWORD',
  'REVOKE_SESSION',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const NOTIFICATION_TYPES = [
  'CANDIDATE_APPLIED',
  'CANDIDATE_MOVED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEW_REMINDER',
  'FEEDBACK_SUBMITTED',
  'JOB_PUBLISHED',
  'RESUME_PARSED',
  'MENTION',
  'SYSTEM',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const RESUME_UPLOAD = {
  maxBytes: 5 * 1024 * 1024,
  mimeTypes: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  extensions: ['.pdf', '.docx'],
} as const;

export const PROCESSING_STEPS = ['UPLOADING', 'PROCESSING', 'EXTRACTING', 'PARSING', 'ANALYZING', 'COMPLETE', 'FAILED'] as const;
export type ProcessingStep = (typeof PROCESSING_STEPS)[number];
