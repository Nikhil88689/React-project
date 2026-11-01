import type { MatchEvidence, MatchResult } from '@recruitflow/shared';
import { normalizeSkill, textMentions } from './skills';

export interface MatchCandidate {
  experienceYears: number | null;
  skills: { name: string; years: number | null }[];
  experiences: { company: string; title: string; description: string | null; startDate: Date | string; endDate: Date | string | null }[];
  educations: { degree: string; field: string | null; institution: string }[];
  projects: { name: string; description: string; technologies: string[] }[];
  resumeText: string | null;
}

export interface MatchJob {
  title: string;
  experienceMin: number | null;
  experienceMax: number | null;
  skills: { name: string; years: number | null; importance: 'REQUIRED' | 'PREFERRED' }[];
}

export const MATCH_WEIGHTS = { skills: 0.5, experience: 0.25, education: 0.1, projects: 0.15 } as const;

const RELEVANT_FIELDS = /(computer|software|information|it\b|electronics|engineering|mathematics|data|design|statistics)/i;

function yearsBetween(start: Date | string, end: Date | string | null) {
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  return Math.max(0, (e - s) / (365.25 * 24 * 3600 * 1000));
}

export function totalExperienceYears(c: Pick<MatchCandidate, 'experienceYears' | 'experiences'>) {
  if (c.experienceYears != null) return c.experienceYears;
  return Math.round(c.experiences.reduce((sum, e) => sum + yearsBetween(e.startDate, e.endDate), 0) * 10) / 10;
}

function findEvidence(c: MatchCandidate, skill: string): string | null {
  for (const exp of c.experiences) {
    if (exp.description && textMentions(exp.description, skill)) return `Used as ${exp.title} at ${exp.company}`;
  }
  for (const p of c.projects) {
    if (p.technologies.some((t) => normalizeSkill(t) === skill) || textMentions(p.description, skill)) {
      return `Project: ${p.name}`;
    }
  }
  if (c.skills.some((s) => normalizeSkill(s.name) === skill)) return 'Listed in skills';
  if (c.resumeText && textMentions(c.resumeText, skill)) return 'Mentioned in resume';
  return null;
}

/**
 * Deterministic, explainable candidate ↔ job scoring. The score is an assistive
 * signal: every point is backed by evidence the recruiter can inspect.
 */
export function computeMatch(candidate: MatchCandidate, job: MatchJob): MatchResult {
  const candidateSkills = new Map<string, number | null>();
  for (const s of candidate.skills) candidateSkills.set(normalizeSkill(s.name), s.years);

  const evidence: MatchEvidence[] = job.skills.map((js) => {
    const canonical = normalizeSkill(js.name);
    const listedYears = candidateSkills.has(canonical) ? (candidateSkills.get(canonical) ?? null) : null;
    const source = findEvidence(candidate, canonical);
    return {
      skill: canonical,
      importance: js.importance,
      matched: candidateSkills.has(canonical) || source !== null,
      candidateYears: listedYears,
      requiredYears: js.years,
      evidence: source,
    };
  });

  // Skills: required weigh twice as much as preferred; partial credit when years fall short.
  let skillScore = 70;
  if (evidence.length) {
    let earned = 0;
    let possible = 0;
    for (const e of evidence) {
      const w = e.importance === 'REQUIRED' ? 1 : 0.5;
      possible += w;
      if (!e.matched) continue;
      let credit = 1;
      if (e.requiredYears && e.candidateYears != null) credit = Math.max(0.6, Math.min(1, e.candidateYears / e.requiredYears));
      else if (e.requiredYears) credit = 0.85;
      else if (e.evidence === 'Mentioned in resume') credit = 0.75;
      earned += w * credit;
    }
    skillScore = (earned / possible) * 100;
  }

  const years = totalExperienceYears(candidate);
  let expScore = 80;
  let experienceNote = `${years} years of total experience`;
  if (job.experienceMin != null) {
    if (years >= job.experienceMin && (job.experienceMax == null || years <= job.experienceMax + 2)) {
      expScore = 100;
      experienceNote += ` — within the ${job.experienceMin}${job.experienceMax != null ? `–${job.experienceMax}` : '+'} year range`;
    } else if (years < job.experienceMin) {
      expScore = Math.max(20, 100 - (job.experienceMin - years) * 22);
      experienceNote += ` — ${Math.round((job.experienceMin - years) * 10) / 10} years below the minimum`;
    } else {
      expScore = 85;
      experienceNote += ' — above the target range (may be overqualified)';
    }
  }

  let eduScore = 55;
  let educationNote = 'No formal education listed';
  if (candidate.educations.length) {
    const relevant = candidate.educations.find((e) => RELEVANT_FIELDS.test(`${e.degree} ${e.field ?? ''}`));
    const postgrad = candidate.educations.some((e) => /(master|m\.?tech|m\.?s\b|mca|mba|phd|m\.?sc)/i.test(e.degree));
    eduScore = relevant ? 88 : 72;
    if (postgrad) eduScore += 7;
    const top = relevant ?? candidate.educations[0];
    educationNote = `${top.degree}${top.field ? ` in ${top.field}` : ''}, ${top.institution}`;
  }

  const jobSkillSet = new Set(job.skills.map((s) => normalizeSkill(s.name)));
  let projScore = 45;
  let projectNote = 'No projects listed';
  if (candidate.projects.length) {
    const overlapping = candidate.projects.filter((p) =>
      p.technologies.some((t) => jobSkillSet.has(normalizeSkill(t))),
    );
    const techOverlap = new Set(
      candidate.projects.flatMap((p) => p.technologies.map(normalizeSkill)).filter((t) => jobSkillSet.has(t)),
    );
    const target = Math.max(2, Math.ceil(jobSkillSet.size / 2));
    projScore = 55 + 45 * Math.min(1, techOverlap.size / target);
    projectNote = `${overlapping.length} of ${candidate.projects.length} projects use the job's stack`;
  }

  const breakdown = {
    skills: Math.round(skillScore),
    experience: Math.round(expScore),
    education: Math.round(Math.min(100, eduScore)),
    projects: Math.round(projScore),
  };
  const overall = Math.round(
    breakdown.skills * MATCH_WEIGHTS.skills +
      breakdown.experience * MATCH_WEIGHTS.experience +
      breakdown.education * MATCH_WEIGHTS.education +
      breakdown.projects * MATCH_WEIGHTS.projects,
  );

  const strongMatches = evidence.filter((e) => e.matched);
  const missing = evidence.filter((e) => !e.matched);
  const verifyAreas = [
    ...missing.filter((m) => m.importance === 'REQUIRED').map((m) => `No visible ${m.skill} experience`),
    ...strongMatches
      .filter((m) => m.requiredYears && (m.candidateYears ?? 0) < m.requiredYears)
      .map((m) => `${m.skill} depth (${m.candidateYears ?? '?'} vs ${m.requiredYears} yrs required)`),
    ...strongMatches.filter((m) => m.evidence === 'Mentioned in resume').map((m) => `Hands-on ${m.skill} usage`),
  ];
  if (job.experienceMin != null && years < job.experienceMin) verifyAreas.push('Overall seniority for the role');

  return {
    overall: Math.max(0, Math.min(100, overall)),
    breakdown,
    strongMatches,
    missing,
    experienceNote,
    educationNote,
    projectNote,
    verifyAreas: verifyAreas.slice(0, 6),
    generatedAt: new Date().toISOString(),
    engine: 'heuristic',
  };
}
