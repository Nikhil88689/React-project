import type { Role } from './roles';

export const PERMISSIONS = [
  'jobs:view',
  'jobs:create',
  'jobs:update',
  'jobs:delete',
  'jobs:publish',
  'candidates:view',
  'candidates:create',
  'candidates:update',
  'candidates:delete',
  'candidates:notes',
  'applications:view',
  'applications:move',
  'interviews:view',
  'interviews:create',
  'interviews:feedback',
  'analytics:view',
  'team:view',
  'team:manage',
  'company:manage',
  'billing:view',
  'billing:manage',
  'audit:view',
  'ai:use',
  'messages:send',
  'talentpool:manage',
  'portal:view',
  'platform:admin',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const RECRUITER_PERMISSIONS: Permission[] = [
  'jobs:view',
  'jobs:create',
  'jobs:update',
  'jobs:publish',
  'candidates:view',
  'candidates:create',
  'candidates:update',
  'candidates:notes',
  'applications:view',
  'applications:move',
  'interviews:view',
  'interviews:create',
  'interviews:feedback',
  'analytics:view',
  'team:view',
  'ai:use',
  'messages:send',
  'talentpool:manage',
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: ['platform:admin'],
  COMPANY_ADMIN: PERMISSIONS.filter((p) => p !== 'platform:admin' && p !== 'portal:view'),
  RECRUITER: RECRUITER_PERMISSIONS,
  INTERVIEWER: [
    'jobs:view',
    'candidates:view',
    'candidates:notes',
    'interviews:view',
    'interviews:feedback',
    'ai:use',
  ],
  CANDIDATE: ['portal:view'],
};

export function hasPermission(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function hasAnyPermission(role: Role | null | undefined, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}
