import { extractSkills, normalizeSkill } from './skills';

export interface ParsedResume {
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  headline: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  totalYears: number | null;
  summary: string | null;
  skills: { name: string; years: number | null }[];
  experiences: { company: string; title: string; startDate: string; endDate: string | null; description: string | null }[];
  educations: { institution: string; degree: string; field: string | null; startYear: number | null; endYear: number | null }[];
  projects: { name: string; description: string; technologies: string[] }[];
  certifications: string[];
}

const SECTION_HEADINGS: Record<string, RegExp> = {
  summary: /^(summary|profile|professional summary|about me|objective)\s*:?$/i,
  experience: /^(experience|work experience|professional experience|employment( history)?|work history)\s*:?$/i,
  education: /^(education|academics|academic background|qualifications)\s*:?$/i,
  projects: /^(projects|personal projects|key projects|selected projects)\s*:?$/i,
  skills: /^(skills|technical skills|core competencies|tech stack|technologies)\s*:?$/i,
  certifications: /^(certifications|certificates|licenses|courses)\s*:?$/i,
};

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};
const DATE = String.raw`((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|\d{4})`;
const RANGE_RE = new RegExp(`${DATE}\\s*(?:-|–|—|to)\\s*(${DATE.slice(1, -1)}|present|current|now)`, 'i');
const DEGREE_RE = /(b\.?\s?tech|b\.?\s?e\b|bachelor[a-z]*|m\.?\s?tech|master[a-z]*|m\.?s\b|mca|bca|b\.?sc|m\.?sc|mba|ph\.?d|diploma)/i;
const CITIES = ['Bangalore', 'Bengaluru', 'Mumbai', 'Pune', 'Hyderabad', 'Chennai', 'Delhi', 'New Delhi', 'Gurugram', 'Gurgaon', 'Noida', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Kochi', 'Remote'];

function parseDate(raw: string): Date | null {
  const s = raw.trim().toLowerCase();
  if (/present|current|now/.test(s)) return null;
  const m = s.match(/^([a-z]+)\.?\s+(\d{4})$/);
  if (m) return new Date(Date.UTC(Number(m[2]), MONTHS[m[1].slice(0, 3)] ?? 0, 1));
  const n = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (n) return new Date(Date.UTC(Number(n[2]), Number(n[1]) - 1, 1));
  const y = s.match(/^(\d{4})$/);
  if (y) return new Date(Date.UTC(Number(y[1]), 0, 1));
  return null;
}

function splitSections(lines: string[]) {
  const sections: Record<string, string[]> = { header: [] };
  let current = 'header';
  for (const line of lines) {
    const heading = Object.entries(SECTION_HEADINGS).find(([, re]) => re.test(line));
    if (heading) {
      current = heading[0];
      sections[current] = sections[current] ?? [];
      continue;
    }
    (sections[current] ??= []).push(line);
  }
  return sections;
}

const cleanBullet = (l: string) => l.replace(/^[•\-*–▪●◦]\s*/, '').trim();

function parseExperience(lines: string[]): ParsedResume['experiences'] {
  const out: ParsedResume['experiences'] = [];
  let current: (ParsedResume['experiences'][number] & { desc: string[] }) | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    const range = line.match(RANGE_RE);
    if (range) {
      if (current) out.push({ ...current, description: current.desc.join(' ') || null });
      const head = line.replace(range[0], '').replace(/[|,()–—-]+\s*$/, '').trim();
      const [title, company] = head.includes(' at ')
        ? head.split(' at ').map((s) => s.trim())
        : head.split(/\s*[|,–—]\s*|\s+-\s+/).map((s) => s.trim());
      const start = parseDate(range[1]) ?? new Date();
      current = {
        title: title || 'Engineer',
        company: company || 'Company',
        startDate: start.toISOString(),
        endDate: parseDate(range[2])?.toISOString() ?? null,
        description: null,
        desc: [],
      };
    } else if (current && line) {
      current.desc.push(cleanBullet(line));
    }
  }
  if (current) out.push({ ...current, description: current.desc.join(' ') || null });
  return out.slice(0, 10);
}

function parseEducation(lines: string[]): ParsedResume['educations'] {
  const out: ParsedResume['educations'] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const degree = line.match(DEGREE_RE);
    if (!degree) continue;
    const years = [...line.matchAll(/(19|20)\d{2}/g)].map((m) => Number(m[0]));
    const fieldMatch = line.match(/\bin\s+([A-Za-z &]+?)(?:[,|–—(-]|\d|$)/);
    const parts = line.split(/\s*[|,–—]\s*/);
    const institution =
      parts.find((p) => /(university|institute|college|iit|nit|school|academy)/i.test(p)) ??
      (lines[i + 1] && !DEGREE_RE.test(lines[i + 1]) ? lines[i + 1] : parts[1]) ??
      'Unknown institution';
    out.push({
      degree: degree[0].replace(/\s+/g, ' '),
      field: fieldMatch?.[1]?.trim() ?? null,
      institution: institution.replace(/(19|20)\d{2}.*$/, '').trim(),
      startYear: years.length > 1 ? years[0] : null,
      endYear: years.length ? years[years.length - 1] : null,
    });
  }
  return out.slice(0, 5);
}

function parseProjects(lines: string[]): ParsedResume['projects'] {
  const out: ParsedResume['projects'] = [];
  for (const raw of lines) {
    const line = cleanBullet(raw);
    const m = line.match(/^([A-Z][\w .&'-]{2,50}?)\s*[:–—-]\s+(.{10,})$/);
    if (m) out.push({ name: m[1].trim(), description: m[2].trim(), technologies: extractSkills(m[2]) });
    else if (out.length && line) {
      const last = out[out.length - 1];
      last.description += ` ${line}`;
      last.technologies = [...new Set([...last.technologies, ...extractSkills(line)])];
    }
  }
  return out.slice(0, 8);
}

/** Best-effort structured extraction from raw resume text (used when no LLM is configured). */
export function parseResumeText(text: string): ParsedResume {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const sections = splitSections(lines);

  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? null;
  const phone = text.match(/(\+?\d{1,3}[\s-]?)?(\(?\d{3,5}\)?[\s-]?)\d{3,5}[\s-]?\d{3,5}/)?.[0]?.trim() ?? null;
  const linkedinUrl = text.match(/(https?:\/\/)?(www\.)?linkedin\.com\/in\/[\w-]+/i)?.[0] ?? null;
  const githubUrl = text.match(/(https?:\/\/)?(www\.)?github\.com\/[\w-]+/i)?.[0] ?? null;

  const header = sections.header ?? [];
  const name =
    header.find((l) => /^[A-Z][a-z]+(\s[A-Z][a-z]+){1,3}$/.test(l) && !/@/.test(l)) ??
    (header[0] && header[0].split(' ').length <= 4 ? header[0] : null);
  const headline = header.find((l) => /(engineer|developer|designer|manager|analyst|scientist|architect|lead)/i.test(l) && l !== name) ?? null;
  const location = CITIES.find((c) => new RegExp(`\\b${c}\\b`, 'i').test(header.join(' '))) ?? null;

  const yearsMatch = text.match(/(\d{1,2}(?:\.\d)?)\+?\s*(?:years|yrs)(?:\s+of)?\s+(?:professional\s+|industry\s+|total\s+)?experience/i);

  const experiences = parseExperience(sections.experience ?? []);
  const skillsText = (sections.skills ?? []).join(', ');
  const listed = skillsText
    .split(/[,|•;\n]/)
    .map((s) => s.replace(/^[^:]*:\s*/, '').trim())
    .filter((s) => s.length > 0 && s.length < 40)
    .map(normalizeSkill);
  const skillNames = [...new Set([...listed, ...extractSkills(text)])];

  const skills = skillNames.map((name) => {
    const m = text.match(new RegExp(`(\\d{1,2}(?:\\.\\d)?)\\+?\\s*(?:years|yrs)[^.\\n]{0,20}${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'));
    return { name, years: m ? Number(m[1]) : null };
  });

  let totalYears = yearsMatch ? Number(yearsMatch[1]) : null;
  if (totalYears == null && experiences.length) {
    const ms = experiences.reduce((sum, e) => sum + ((e.endDate ? new Date(e.endDate).getTime() : Date.now()) - new Date(e.startDate).getTime()), 0);
    totalYears = Math.round((ms / (365.25 * 24 * 3600 * 1000)) * 10) / 10;
  }

  return {
    name,
    email,
    phone,
    location,
    headline,
    linkedinUrl,
    githubUrl,
    totalYears,
    summary: (sections.summary ?? []).join(' ').slice(0, 1200) || null,
    skills: skills.slice(0, 40),
    experiences,
    educations: parseEducation(sections.education ?? []),
    projects: parseProjects(sections.projects ?? []),
    certifications: (sections.certifications ?? []).map(cleanBullet).filter((l) => l.length > 3).slice(0, 10),
  };
}
