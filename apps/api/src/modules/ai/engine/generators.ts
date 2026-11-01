import {
  INTERVIEW_TYPE_LABELS,
  type CandidateSummaryResult,
  type GeneratedJobDescription,
  type InterviewQuestion,
  type InterviewType,
} from '@recruitflow/shared';
import type { MatchCandidate } from './matcher';
import { totalExperienceYears } from './matcher';
import { extractSkills, normalizeSkill, skillFamily } from './skills';

const ul = (items: string[]) => `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
const pick = <T,>(arr: T[], n: number) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);

const FAMILY_DEFAULTS: Record<string, { skills: string[]; responsibilities: string[]; title: string }> = {
  frontend: {
    title: 'Frontend Engineer',
    skills: ['React', 'TypeScript', 'JavaScript', 'HTML', 'CSS', 'REST APIs', 'Git'],
    responsibilities: [
      'Build fast, accessible and well-tested user interfaces used by thousands of customers',
      'Own features end-to-end — from technical design through rollout and iteration',
      'Collaborate closely with design and product to turn ideas into polished experiences',
      'Improve performance, reliability and developer experience across the frontend codebase',
      'Review code, share knowledge and help raise the engineering bar of the team',
    ],
  },
  backend: {
    title: 'Backend Engineer',
    skills: ['Node.js', 'TypeScript', 'PostgreSQL', 'REST APIs', 'Redis', 'Docker', 'Git'],
    responsibilities: [
      'Design and build scalable APIs and services that power our product',
      'Model data and write efficient queries against relational databases',
      'Own reliability: observability, alerting, and performance of the services you ship',
      'Work with frontend engineers to define clear, versioned API contracts',
      'Contribute to architecture decisions and technical roadmap',
    ],
  },
  data: {
    title: 'Data Engineer',
    skills: ['Python', 'SQL', 'PostgreSQL', 'Data Analysis', 'AWS'],
    responsibilities: [
      'Build reliable data pipelines and models that the business depends on',
      'Partner with analysts and product teams to answer high-impact questions',
      'Ensure data quality, lineage and documentation',
      'Optimise storage and query performance at scale',
    ],
  },
  devops: {
    title: 'DevOps Engineer',
    skills: ['AWS', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'Linux'],
    responsibilities: [
      'Own and evolve our cloud infrastructure as code',
      'Build CI/CD pipelines that let engineers ship safely many times a day',
      'Improve observability, incident response and system reliability',
      'Drive cost efficiency and security best practices',
    ],
  },
  design: {
    title: 'Product Designer',
    skills: ['Figma', 'UI Design', 'UX Research'],
    responsibilities: [
      'Lead design for core product areas from discovery to delivery',
      'Run user research and usability tests to validate ideas',
      'Contribute to and evolve our design system',
      'Partner with engineering to ship high-quality experiences',
    ],
  },
  general: {
    title: 'Software Engineer',
    skills: ['JavaScript', 'TypeScript', 'Git', 'REST APIs'],
    responsibilities: [
      'Build and maintain high-quality product features',
      'Collaborate across product, design and engineering',
      'Write clean, tested and well-documented code',
      'Continuously improve our systems and processes',
    ],
  },
};

const BENEFITS = [
  'Competitive salary with performance bonus and ESOPs',
  'Comprehensive health insurance for you and your family',
  'Flexible working hours and hybrid work options',
  'Annual learning budget for courses, books and conferences',
  'Latest hardware and a home-office setup allowance',
  '24 days of paid leave plus public holidays',
  'Wellness programmes and team offsites',
];

/** Template-driven JD drafting used when no LLM is configured. */
export function generateJobDescription(input: {
  prompt: string;
  title?: string;
  department?: string;
  tone: 'PROFESSIONAL' | 'FRIENDLY' | 'CONCISE';
}): GeneratedJobDescription {
  const text = `${input.title ?? ''} ${input.prompt}`;
  const mentioned = extractSkills(text);
  const family =
    (mentioned.map(skillFamily).find((f) => f !== 'general' && f !== 'testing' && f !== 'mobile') as string | undefined) ??
    (/design/i.test(text) ? 'design' : /devops|sre|infra/i.test(text) ? 'devops' : /data|analytics/i.test(text) ? 'data' : 'general');
  const defaults = FAMILY_DEFAULTS[family] ?? FAMILY_DEFAULTS.general;

  const range = text.match(/(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*(?:years|yrs)/i);
  const plus = text.match(/(\d{1,2})\+?\s*(?:years|yrs)/i);
  const minYears = range ? Number(range[1]) : plus ? Number(plus[1]) : null;
  const maxYears = range ? Number(range[2]) : null;
  const senior = /senior|sr\.?|lead|principal/i.test(text) || (minYears ?? 0) >= 5;

  const roleFromPrompt = text.match(/(?:need|hiring|looking for)(?: an?| a)?\s+([a-z .]+?(?:developer|engineer|designer|manager|analyst))/i)?.[1];
  const title =
    input.title?.trim() ||
    (roleFromPrompt ? roleFromPrompt.replace(/\b\w/g, (c) => c.toUpperCase()).trim() : `${senior ? 'Senior ' : ''}${defaults.title}`);

  const required = [...new Set([...mentioned, ...defaults.skills])].slice(0, 7);
  const preferred = pick(
    ['AWS', 'Docker', 'CI/CD', 'GraphQL', 'Redis', 'Jest', 'System Design', 'Next.js', 'Kubernetes'].filter((s) => !required.includes(s)),
    3,
  );
  const yearsText = minYears != null ? `${minYears}${maxYears ? `–${maxYears}` : '+'} years` : senior ? '5+ years' : '2+ years';

  const intro =
    input.tone === 'FRIENDLY'
      ? `We're looking for a ${title} who loves building great products and wants to grow with a fast-moving team. You'll work on problems that matter, with people who care about craft.`
      : input.tone === 'CONCISE'
        ? `We are hiring a ${title} to build and scale core parts of our product.`
        : `We are seeking an experienced ${title} to join our ${input.department ?? 'Engineering'} team. In this role you will design, build and ship high-impact features while helping shape our technical direction.`;

  return {
    title,
    engine: 'heuristic',
    skills: [
      ...required.map((name, i) => ({ name, years: i < 2 && minYears ? Math.max(1, minYears - 1) : null, importance: 'REQUIRED' as const })),
      ...preferred.map((name) => ({ name, years: null, importance: 'PREFERRED' as const })),
    ],
    description: {
      about: `<p>${intro}</p>`,
      responsibilities: ul(input.tone === 'CONCISE' ? defaults.responsibilities.slice(0, 3) : defaults.responsibilities),
      requirements: ul([
        `${yearsText} of professional experience in a similar role`,
        `Strong hands-on experience with ${required.slice(0, 3).join(', ')}`,
        `Working knowledge of ${required.slice(3).join(', ') || 'modern engineering practices'}`,
        'Solid understanding of software design, testing and code review practices',
        'Clear written and verbal communication',
      ]),
      niceToHave: ul([...preferred.map((s) => `Experience with ${s}`), 'Contributions to open source or side projects']),
      benefits: ul(input.tone === 'CONCISE' ? BENEFITS.slice(0, 4) : BENEFITS),
    },
  };
}

/* ─────────────────────────── Interview questions ─────────────────────────── */

type Q = Omit<InterviewQuestion, 'category'>;
const SKILL_QUESTIONS: Record<string, Q[]> = {
  React: [
    { question: 'Explain React reconciliation and how keys influence it.', difficulty: 'MEDIUM', lookFor: 'Virtual DOM diffing, stable keys, why index keys break state' },
    { question: 'How would you optimise a large React application that feels sluggish?', difficulty: 'HARD', lookFor: 'Profiling first, memoisation, virtualisation, code splitting, avoiding prop drilling re-renders' },
    { question: 'What is the difference between useMemo and useCallback? When is each worth it?', difficulty: 'MEDIUM', lookFor: 'Referential equality, cost of memoisation, measuring' },
    { question: 'How does useEffect cleanup work, and what bugs does it prevent?', difficulty: 'EASY', lookFor: 'Subscriptions, race conditions, strict-mode double invoke' },
    { question: 'Compare server state and client state. How do you manage each?', difficulty: 'MEDIUM', lookFor: 'React Query/SWR for server cache, local/global state for UI' },
    { question: 'Walk through how you would implement optimistic updates with rollback.', difficulty: 'HARD', lookFor: 'Snapshot, update cache, rollback on error, invalidate on settle' },
  ],
  TypeScript: [
    { question: 'Explain the difference between `type` and `interface` in TypeScript.', difficulty: 'EASY', lookFor: 'Declaration merging, unions, extension' },
    { question: 'How would you type a generic API client that returns typed responses per endpoint?', difficulty: 'HARD', lookFor: 'Generics, mapped types, inference' },
    { question: 'What are discriminated unions and why are they useful?', difficulty: 'MEDIUM', lookFor: 'Narrowing, exhaustive checks with never' },
  ],
  JavaScript: [
    { question: 'Explain the event loop, microtasks and macrotasks.', difficulty: 'MEDIUM', lookFor: 'Call stack, promise queue ordering, rendering' },
    { question: 'What is a closure? Give a practical example.', difficulty: 'EASY', lookFor: 'Lexical scope, data privacy, stale closures in hooks' },
    { question: 'Implement a debounce function and explain where you would use it.', difficulty: 'MEDIUM', lookFor: 'Timers, this/args forwarding, search inputs' },
  ],
  'Node.js': [
    { question: 'How does Node.js handle concurrency with a single thread?', difficulty: 'MEDIUM', lookFor: 'libuv, non-blocking I/O, worker threads for CPU work' },
    { question: 'How would you structure a large Express codebase?', difficulty: 'MEDIUM', lookFor: 'Layering (controller/service/repository), validation, error middleware' },
    { question: 'How would you find and fix a memory leak in a Node service?', difficulty: 'HARD', lookFor: 'Heap snapshots, closures, caches without bounds, listeners' },
  ],
  PostgreSQL: [
    { question: 'When would you add an index, and what does it cost?', difficulty: 'MEDIUM', lookFor: 'Read vs write trade-offs, composite index order, EXPLAIN' },
    { question: 'Explain transaction isolation levels and a bug each one prevents.', difficulty: 'HARD', lookFor: 'Dirty/non-repeatable/phantom reads' },
    { question: 'Offset vs cursor pagination — trade-offs?', difficulty: 'MEDIUM', lookFor: 'Performance at depth, consistency, stable sort keys' },
  ],
  'REST APIs': [
    { question: 'How do you design idempotent APIs? Why does it matter?', difficulty: 'MEDIUM', lookFor: 'PUT/DELETE semantics, idempotency keys, retries' },
    { question: 'How would you version a public API?', difficulty: 'EASY', lookFor: 'URL/header versioning, deprecation policy' },
  ],
  AWS: [
    { question: 'How would you let users upload files directly to S3 securely?', difficulty: 'MEDIUM', lookFor: 'Presigned URLs, content-type/size limits, private buckets' },
    { question: 'Describe a highly available deployment on AWS for a web app.', difficulty: 'HARD', lookFor: 'Multi-AZ, load balancer, autoscaling, RDS replicas' },
  ],
  Docker: [
    { question: 'How do you keep Docker images small and builds fast?', difficulty: 'MEDIUM', lookFor: 'Multi-stage builds, layer caching, .dockerignore' },
  ],
  Redis: [
    { question: 'What would you use Redis for in a web application?', difficulty: 'EASY', lookFor: 'Caching, queues, rate limiting, pub/sub, TTLs' },
    { question: 'How do you handle cache invalidation?', difficulty: 'HARD', lookFor: 'TTL, write-through, versioned keys, stampede protection' },
  ],
  'System Design': [
    { question: 'Design a scalable notification system (in-app + email).', difficulty: 'HARD', lookFor: 'Event-driven fan-out, queues, retries, user preferences, idempotency' },
    { question: 'Design a URL shortener. What are the bottlenecks?', difficulty: 'MEDIUM', lookFor: 'ID generation, caching, read-heavy scaling' },
  ],
};

const ROUND_QUESTIONS: Partial<Record<InterviewType, Q[]>> = {
  PHONE_SCREEN: [
    { question: 'Walk me through your current role and a project you are proud of.', difficulty: 'EASY', lookFor: 'Ownership, clarity, impact' },
    { question: 'What are you looking for in your next role?', difficulty: 'EASY', lookFor: 'Motivation and alignment with the role' },
    { question: 'What is your notice period and salary expectation?', difficulty: 'EASY', lookFor: 'Logistics fit' },
  ],
  HR: [
    { question: 'Tell me about a time you disagreed with a teammate. How did you resolve it?', difficulty: 'MEDIUM', lookFor: 'Empathy, communication, outcome' },
    { question: 'Describe a time you failed. What did you learn?', difficulty: 'MEDIUM', lookFor: 'Self-awareness, growth' },
    { question: 'How do you prioritise when everything feels urgent?', difficulty: 'EASY', lookFor: 'Frameworks, stakeholder communication' },
  ],
  CULTURE_FIT: [
    { question: 'What does a great team look like to you?', difficulty: 'EASY', lookFor: 'Values, collaboration' },
    { question: 'Tell me about feedback that changed how you work.', difficulty: 'MEDIUM', lookFor: 'Openness to feedback' },
  ],
  SYSTEM_DESIGN: SKILL_QUESTIONS['System Design'],
  FINAL: [
    { question: 'Where do you see the biggest opportunity for impact in this role?', difficulty: 'MEDIUM', lookFor: 'Product thinking, preparation' },
    { question: 'What would your first 90 days look like?', difficulty: 'MEDIUM', lookFor: 'Structured onboarding plan' },
  ],
};

export function generateInterviewQuestions(input: {
  role: string;
  round: InterviewType;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  count: number;
  skills: string[];
  focusAreas?: string[];
}): InterviewQuestion[] {
  const pool: InterviewQuestion[] = [];
  const skills = [...new Set([...(input.focusAreas ?? []), ...input.skills, ...extractSkills(input.role)].map(normalizeSkill))];
  const isTechnical = input.round === 'TECHNICAL' || input.round === 'FINAL';

  if (isTechnical) {
    for (const skill of skills) for (const q of SKILL_QUESTIONS[skill] ?? []) pool.push({ ...q, category: skill });
  }
  for (const q of ROUND_QUESTIONS[input.round] ?? []) pool.push({ ...q, category: INTERVIEW_TYPE_LABELS[input.round] });
  if (pool.length < input.count) {
    for (const [skill, qs] of Object.entries(SKILL_QUESTIONS)) for (const q of qs) pool.push({ ...q, category: skill });
  }

  const rank = (q: InterviewQuestion) => (q.difficulty === input.difficulty ? 0 : 1) + Math.random() * 0.9;
  const seen = new Set<string>();
  return pool
    .sort((a, b) => rank(a) - rank(b))
    .filter((q) => (seen.has(q.question) ? false : (seen.add(q.question), true)))
    .slice(0, input.count);
}

/* ──────────────────────────── Candidate summary ──────────────────────────── */

export function summarizeCandidate(
  c: MatchCandidate & { firstName: string; headline: string | null; currentCompany: string | null },
  jobContext?: { title: string; missing: string[]; verifyAreas: string[] },
): CandidateSummaryResult {
  const years = totalExperienceYears(c);
  const latest = [...c.experiences].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];
  const topSkills = [...c.skills].sort((a, b) => (b.years ?? 0) - (a.years ?? 0)).slice(0, 5);
  const role = latest?.title ?? c.headline ?? 'professional';
  const company = latest?.company ?? c.currentCompany;

  const evidence: CandidateSummaryResult['evidence'] = [];
  if (latest) evidence.push({ claim: `Currently ${latest.title}`, source: `Experience · ${latest.company}` });
  for (const s of topSkills.slice(0, 3)) {
    evidence.push({ claim: `${s.name}${s.years ? ` — ${s.years} yrs` : ''}`, source: 'Skills section' });
  }
  if (c.projects[0]) evidence.push({ claim: `Built ${c.projects[0].name}`, source: 'Projects' });
  if (c.educations[0]) evidence.push({ claim: c.educations[0].degree, source: `Education · ${c.educations[0].institution}` });

  const gaps = jobContext
    ? jobContext.verifyAreas.length
      ? jobContext.verifyAreas
      : jobContext.missing.map((m) => `No visible ${m} experience`)
    : c.projects.length === 0
      ? ['No side projects or portfolio listed']
      : [];

  return {
    headline: `${years} yrs · ${role}${company ? ` at ${company}` : ''}`,
    summary:
      `${c.firstName} has ${years} years of experience${latest ? `, most recently as ${latest.title} at ${latest.company}` : ''}. ` +
      (topSkills.length ? `Strongest skills include ${topSkills.slice(0, 3).map((s) => s.name).join(', ')}. ` : '') +
      (c.projects.length ? `Has ${c.projects.length} documented project${c.projects.length > 1 ? 's' : ''}. ` : '') +
      (jobContext ? `Assessed against ${jobContext.title}.` : ''),
    strengths: topSkills.map((s) => (s.years ? `${s.name} (${s.years} yrs)` : s.name)),
    gaps: gaps.slice(0, 5),
    evidence,
    engine: 'heuristic',
    generatedAt: new Date().toISOString(),
  };
}
