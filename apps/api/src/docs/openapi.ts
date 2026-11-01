/** Hand-maintained OpenAPI 3.1 description of the public API surface, served at /api/docs. */
type Op = { tag: string; summary: string; auth?: boolean; body?: string; permission?: string };

const ops: Record<string, Partial<Record<'get' | 'post' | 'patch' | 'put' | 'delete', Op>>> = {
  '/auth/register': { post: { tag: 'Auth', summary: 'Create account + company workspace', auth: false, body: 'Register' } },
  '/auth/login': { post: { tag: 'Auth', summary: 'Sign in (sets httpOnly refresh cookie)', auth: false, body: 'Login' } },
  '/auth/refresh': { post: { tag: 'Auth', summary: 'Rotate refresh token and get a new access token', auth: false } },
  '/auth/logout': { post: { tag: 'Auth', summary: 'Revoke current session' } },
  '/auth/me': { get: { tag: 'Auth', summary: 'Current user, role, permissions and workspace' } },
  '/auth/forgot-password': { post: { tag: 'Auth', summary: 'Email a password reset link', auth: false } },
  '/auth/reset-password': { post: { tag: 'Auth', summary: 'Reset password with token', auth: false } },
  '/auth/sessions': { get: { tag: 'Auth', summary: 'List active sessions' } },
  '/auth/sessions/{id}': { delete: { tag: 'Auth', summary: 'Revoke a session' } },
  '/jobs': {
    get: { tag: 'Jobs', summary: 'List jobs (search, status, department, location, pagination)', permission: 'jobs:view' },
    post: { tag: 'Jobs', summary: 'Create job with skills, workflow and application questions', permission: 'jobs:create', body: 'CreateJob' },
  },
  '/jobs/{id}': {
    get: { tag: 'Jobs', summary: 'Job detail with stage counts', permission: 'jobs:view' },
    patch: { tag: 'Jobs', summary: 'Update job', permission: 'jobs:update' },
    delete: { tag: 'Jobs', summary: 'Delete job (only without applications)', permission: 'jobs:delete' },
  },
  '/jobs/{id}/publish': { post: { tag: 'Jobs', summary: 'Publish job (enforces plan limits)', permission: 'jobs:publish' } },
  '/jobs/{id}/close': { post: { tag: 'Jobs', summary: 'Close job', permission: 'jobs:publish' } },
  '/candidates': {
    get: { tag: 'Candidates', summary: 'Cursor-paginated candidate search (skills, experience, stage, match…)', permission: 'candidates:view' },
    post: { tag: 'Candidates', summary: 'Add candidate manually', permission: 'candidates:create' },
  },
  '/candidates/{id}': {
    get: { tag: 'Candidates', summary: 'Full candidate profile', permission: 'candidates:view' },
    patch: { tag: 'Candidates', summary: 'Update candidate', permission: 'candidates:update' },
    delete: { tag: 'Candidates', summary: 'Delete candidate', permission: 'candidates:delete' },
  },
  '/candidates/{id}/notes': { get: { tag: 'Candidates', summary: 'Private team notes', permission: 'candidates:notes' }, post: { tag: 'Candidates', summary: 'Add note', permission: 'candidates:notes' } },
  '/candidates/{id}/timeline': { get: { tag: 'Candidates', summary: 'Unified event timeline', permission: 'candidates:view' } },
  '/candidates/{id}/feedback': { get: { tag: 'Candidates', summary: 'Interview feedback', permission: 'candidates:view' } },
  '/applications': {
    get: { tag: 'Applications', summary: 'Kanban pipeline (per job or cross-job)', permission: 'applications:view' },
    post: { tag: 'Applications', summary: 'Add candidate to a job', permission: 'applications:move' },
  },
  '/applications/{id}/stage': { patch: { tag: 'Applications', summary: 'Move to stage — records history, audit, realtime event', permission: 'applications:move', body: 'MoveStage' } },
  '/applications/{id}/history': { get: { tag: 'Applications', summary: 'Stage change history', permission: 'applications:view' } },
  '/interviews': {
    get: { tag: 'Interviews', summary: 'List interviews in a date range', permission: 'interviews:view' },
    post: { tag: 'Interviews', summary: 'Schedule interview (conflict detection, emails, reminders)', permission: 'interviews:create' },
  },
  '/interviews/{id}': { get: { tag: 'Interviews', summary: 'Interview detail', permission: 'interviews:view' }, patch: { tag: 'Interviews', summary: 'Reschedule / cancel / complete', permission: 'interviews:create' } },
  '/interviews/{id}/feedback': { post: { tag: 'Interviews', summary: 'Submit scorecard (assigned interviewers only)', permission: 'interviews:feedback' } },
  '/interviews/pending-feedback': { get: { tag: 'Interviews', summary: 'Interviews missing feedback', permission: 'interviews:view' } },
  '/ai/job-description': { post: { tag: 'AI', summary: 'Generate a job description', permission: 'ai:use' } },
  '/ai/match': { post: { tag: 'AI', summary: 'Evidence-based candidate ↔ job match', permission: 'ai:use' } },
  '/ai/candidates/{id}/insights': { get: { tag: 'AI', summary: 'AI hiring insights: match + summary + evidence', permission: 'ai:use' } },
  '/ai/interview-questions': { post: { tag: 'AI', summary: 'Generate interview questions', permission: 'ai:use' } },
  '/ai/assistant': { post: { tag: 'AI', summary: 'Natural language → structured query', permission: 'ai:use' } },
  '/files/presign': { post: { tag: 'Files', summary: 'Get a presigned upload URL (S3 or local)' } },
  '/files/{id}/complete': { post: { tag: 'Files', summary: 'Verify upload (size + file signature) and queue parsing' } },
  '/public/jobs/{slug}': { get: { tag: 'Public', summary: 'Public job page', auth: false } },
  '/public/jobs/{slug}/resume': { post: { tag: 'Public', summary: 'Presigned resume upload for applicants', auth: false } },
  '/public/jobs/{slug}/apply': { post: { tag: 'Public', summary: 'Submit application', auth: false } },
  '/public/applications/{token}': { get: { tag: 'Public', summary: 'Track resume processing', auth: false } },
  '/analytics/dashboard': { get: { tag: 'Analytics', summary: 'Dashboard KPIs, funnel, activity', permission: 'analytics:view' } },
  '/analytics': { get: { tag: 'Analytics', summary: 'Recruitment analytics', permission: 'analytics:view' } },
  '/notifications': { get: { tag: 'Notifications', summary: 'List notifications' } },
  '/notifications/read-all': { post: { tag: 'Notifications', summary: 'Mark all read' } },
  '/team': { get: { tag: 'Team', summary: 'Members and pending invitations', permission: 'team:view' } },
  '/team/invitations': { post: { tag: 'Team', summary: 'Invite a member', permission: 'team:manage' } },
  '/team/{memberId}': { patch: { tag: 'Team', summary: 'Change role / disable', permission: 'team:manage' }, delete: { tag: 'Team', summary: 'Remove member', permission: 'team:manage' } },
  '/billing': { get: { tag: 'Billing', summary: 'Plan, usage and invoices', permission: 'billing:view' } },
  '/billing/change-plan': { post: { tag: 'Billing', summary: 'Upgrade/downgrade (Stripe Checkout when configured)', permission: 'billing:manage' } },
  '/audit-logs': { get: { tag: 'Audit', summary: 'Audit trail', permission: 'audit:view' } },
  '/search': { get: { tag: 'Search', summary: 'Global search', permission: 'candidates:view' } },
  '/health': { get: { tag: 'System', summary: 'Health check', auth: false } },
};

const bodies: Record<string, unknown> = {
  Login: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', example: 'admin@demo.recruitflow.com' }, password: { type: 'string', example: 'Demo@1234' } } },
  Register: {
    type: 'object',
    required: ['firstName', 'lastName', 'email', 'password', 'companyName', 'companySize', 'industry'],
    properties: { firstName: { type: 'string' }, lastName: { type: 'string' }, email: { type: 'string' }, password: { type: 'string' }, companyName: { type: 'string' }, companySize: { type: 'string', enum: ['1-10', '11-50', '51-200', '201-500', '500+'] }, industry: { type: 'string' } },
  },
  MoveStage: { type: 'object', properties: { stageId: { type: 'string' }, stageType: { type: 'string', enum: ['APPLIED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'] }, rejectionReason: { type: 'string' } } },
  CreateJob: { type: 'object', required: ['title', 'department', 'employmentType', 'experienceLevel', 'location', 'workMode', 'description'], properties: { title: { type: 'string', example: 'Senior React Developer' } } },
};

export function buildOpenApi() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const [path, methods] of Object.entries(ops)) {
    paths[path] = {};
    for (const [method, op] of Object.entries(methods)) {
      paths[path][method] = {
        tags: [op.tag],
        summary: op.summary,
        description: op.permission ? `Requires permission \`${op.permission}\`.` : undefined,
        security: op.auth === false ? [] : [{ bearerAuth: [] }],
        parameters: [...path.matchAll(/\{(\w+)\}/g)].map((m) => ({ name: m[1], in: 'path', required: true, schema: { type: 'string' } })),
        requestBody: op.body ? { required: true, content: { 'application/json': { schema: { $ref: `#/components/schemas/${op.body}` } } } } : undefined,
        responses: {
          '200': { description: 'Success', content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } },
          '4XX': { description: 'Error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      };
    }
  }
  return {
    openapi: '3.1.0',
    info: { title: 'RecruitFlow AI API', version: '1.0.0', description: 'Applicant tracking & recruitment operations API. All responses use `{ success, data, meta }` or `{ success: false, error: { code, message } }`.' },
    servers: [{ url: '/api' }],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: {
        ...bodies,
        Success: { type: 'object', properties: { success: { type: 'boolean', const: true }, data: {}, meta: { type: 'object' } } },
        Error: { type: 'object', properties: { success: { type: 'boolean', const: false }, error: { type: 'object', properties: { code: { type: 'string', example: 'JOB_NOT_FOUND' }, message: { type: 'string', example: 'Job not found' }, requestId: { type: 'string' } } } } },
      },
    },
    paths,
  };
}
