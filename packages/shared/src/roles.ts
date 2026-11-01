export const ROLES = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'RECRUITER', 'INTERVIEWER', 'CANDIDATE'] as const;
export type Role = (typeof ROLES)[number];

/** Roles that can be assigned to members of a company workspace. */
export const COMPANY_ROLES = ['COMPANY_ADMIN', 'RECRUITER', 'INTERVIEWER'] as const;
export type CompanyRole = (typeof COMPANY_ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  COMPANY_ADMIN: 'Company Admin',
  RECRUITER: 'Recruiter',
  INTERVIEWER: 'Interviewer',
  CANDIDATE: 'Candidate',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  SUPER_ADMIN: 'Platform administration',
  COMPANY_ADMIN: 'Manage company, jobs, team and billing',
  RECRUITER: 'Manage candidates and hiring',
  INTERVIEWER: 'Conduct interviews and submit feedback',
  CANDIDATE: 'Apply and track applications',
};
