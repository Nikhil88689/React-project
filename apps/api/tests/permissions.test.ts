import { describe, expect, it } from 'vitest';
import { hasPermission } from '@recruitflow/shared';

describe('RBAC', () => {
  it('lets recruiters move candidates but not manage billing', () => {
    expect(hasPermission('RECRUITER', 'applications:move')).toBe(true);
    expect(hasPermission('RECRUITER', 'billing:manage')).toBe(false);
  });

  it('keeps interviewers off the pipeline mutation surface', () => {
    expect(hasPermission('INTERVIEWER', 'interviews:feedback')).toBe(true);
    expect(hasPermission('INTERVIEWER', 'applications:move')).toBe(false);
    expect(hasPermission('CANDIDATE', 'candidates:view')).toBe(false);
  });
});
