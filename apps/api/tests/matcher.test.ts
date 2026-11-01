import { describe, expect, it } from 'vitest';
import { computeMatch, type MatchCandidate, type MatchJob } from '../src/modules/ai/engine/matcher';

const candidate: MatchCandidate = {
  experienceYears: 4,
  skills: [
    { name: 'React', years: 4 },
    { name: 'TypeScript', years: 3 },
    { name: 'Node.js', years: 2 },
  ],
  experiences: [{ company: 'Nimbus', title: 'Frontend Engineer', description: 'Built React dashboards', startDate: '2022-01-01', endDate: null }],
  educations: [{ degree: 'B.Tech', field: 'Computer Science', institution: 'IIT' }],
  projects: [{ name: 'ATS', description: 'Hiring pipeline', technologies: ['React', 'TypeScript'] }],
  resumeText: 'React TypeScript Node.js REST APIs',
};

const job: MatchJob = {
  title: 'Senior React Developer',
  experienceMin: 3,
  experienceMax: 6,
  skills: [
    { name: 'React', years: 3, importance: 'REQUIRED' },
    { name: 'TypeScript', years: 2, importance: 'REQUIRED' },
    { name: 'AWS', years: 1, importance: 'PREFERRED' },
  ],
};

describe('computeMatch', () => {
  it('scores strong React/TypeScript evidence highly without auto-deciding hire', () => {
    const result = computeMatch(candidate, job);
    expect(result.overall).toBeGreaterThan(70);
    expect(result.strongMatches.map((m) => m.skill)).toEqual(expect.arrayContaining(['React', 'TypeScript']));
    expect(result.missing.some((m) => m.skill === 'AWS')).toBe(true);
    expect(result.engine).toBe('heuristic');
  });
});
