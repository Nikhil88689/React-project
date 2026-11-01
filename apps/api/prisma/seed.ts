/* eslint-disable no-console */
import crypto from 'node:crypto';
import { faker } from '@faker-js/faker/locale/en_IN';
import { Prisma, PrismaClient, type CandidateSource, type InterviewType, type Recommendation, type Role, type StageType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DEFAULT_WORKFLOW, type EmploymentType, type ExperienceLevel, type WorkMode } from '@recruitflow/shared';
import { generateJobDescription } from '../src/modules/ai/engine/generators';
import { computeMatch } from '../src/modules/ai/engine/matcher';
import { makeTextPdf, resumeLines, type ResumeSource } from '../src/lib/pdf';
import { storage } from '../src/lib/storage';
import { defaultCompanySetup } from '../src/modules/company/defaults';

const prisma = new PrismaClient();
faker.seed(20261002);

const id = () => crypto.randomUUID().replace(/-/g, '').slice(0, 25);
const DAY = 86400_000;
const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * DAY);
const rnd = (min: number, max: number) => faker.number.float({ min, max });
const int = (min: number, max: number) => faker.number.int({ min, max });
const chance = (p: number) => faker.number.float({ min: 0, max: 1 }) < p;
const pick = <T,>(arr: readonly T[]) => faker.helpers.arrayElement(arr);
const pickN = <T,>(arr: readonly T[], n: number) => faker.helpers.arrayElements(arr, Math.min(n, arr.length));
const weighted = <T,>(items: [T, number][]) => faker.helpers.weightedArrayElement(items.map(([value, weight]) => ({ value, weight })));

const PASSWORD = 'Demo@1234';

/* ─────────────────────────── Reference data ─────────────────────────── */

type Family = 'frontend' | 'backend' | 'fullstack' | 'devops' | 'data' | 'mobile' | 'qa' | 'design' | 'product' | 'marketing' | 'sales' | 'people' | 'finance';

const FAMILY_SKILLS: Record<Family, string[]> = {
  frontend: ['React', 'TypeScript', 'JavaScript', 'Redux', 'Next.js', 'HTML', 'CSS', 'Tailwind CSS', 'Jest', 'REST APIs', 'Git', 'Webpack', 'GraphQL', 'Node.js', 'React Query'],
  backend: ['Node.js', 'TypeScript', 'Express', 'PostgreSQL', 'Redis', 'REST APIs', 'Docker', 'AWS', 'Microservices', 'MongoDB', 'Kafka', 'Go', 'Python', 'System Design', 'Git'],
  fullstack: ['React', 'Node.js', 'TypeScript', 'JavaScript', 'Express', 'PostgreSQL', 'MongoDB', 'REST APIs', 'Docker', 'AWS', 'Redis', 'Git', 'Next.js', 'GraphQL'],
  devops: ['AWS', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'Linux', 'Python', 'Go', 'GCP', 'Redis', 'PostgreSQL'],
  data: ['Python', 'SQL', 'PostgreSQL', 'Data Analysis', 'Machine Learning', 'AWS', 'Kafka', 'Docker'],
  mobile: ['React Native', 'TypeScript', 'JavaScript', 'Redux', 'REST APIs', 'Flutter', 'Git', 'Jest'],
  qa: ['Playwright', 'Cypress', 'Jest', 'JavaScript', 'TypeScript', 'CI/CD', 'REST APIs', 'Git'],
  design: ['Figma', 'UI Design', 'UX Research', 'HTML', 'CSS'],
  product: ['Product Management', 'Agile', 'SQL', 'Data Analysis', 'UX Research'],
  marketing: ['Data Analysis', 'SQL', 'Agile'],
  sales: ['Agile'],
  people: ['Agile'],
  finance: ['SQL', 'Data Analysis'],
};

const FAMILY_TITLES: Record<Family, string[]> = {
  frontend: ['Frontend Engineer', 'Senior Frontend Engineer', 'React Developer', 'UI Engineer', 'Software Engineer'],
  backend: ['Backend Engineer', 'Senior Backend Engineer', 'Node.js Developer', 'Software Engineer II', 'SDE II'],
  fullstack: ['Full Stack Developer', 'Software Engineer', 'MERN Stack Developer', 'Senior Software Engineer'],
  devops: ['DevOps Engineer', 'Site Reliability Engineer', 'Cloud Engineer', 'Platform Engineer'],
  data: ['Data Engineer', 'Data Scientist', 'ML Engineer', 'Analytics Engineer'],
  mobile: ['React Native Developer', 'Mobile Engineer', 'Android Developer'],
  qa: ['QA Automation Engineer', 'SDET', 'Test Engineer'],
  design: ['Product Designer', 'UI/UX Designer', 'Senior Product Designer', 'UX Researcher'],
  product: ['Product Manager', 'Associate Product Manager', 'Senior Product Manager'],
  marketing: ['Growth Marketer', 'Content Strategist', 'Marketing Manager'],
  sales: ['Account Executive', 'Sales Development Representative', 'Enterprise Sales Manager'],
  people: ['HR Business Partner', 'Technical Recruiter', 'Talent Acquisition Specialist'],
  finance: ['Financial Analyst', 'FP&A Analyst', 'Finance Associate'],
};

const COMPANIES = ['Flipkart', 'Swiggy', 'Zomato', 'Razorpay', 'Freshworks', 'Infosys', 'TCS', 'Wipro', 'PhonePe', 'CRED', 'Meesho', 'Zoho', 'Paytm', 'Myntra', 'Unacademy', 'Atlassian', 'Microsoft', 'Amazon', 'Groww', 'Zerodha', 'Postman', 'BrowserStack', 'Juspay', 'Dunzo', 'ShareChat', 'Nykaa', 'Ola', 'MakeMyTrip', 'HCLTech', 'Accenture'];
const INSTITUTIONS = ['IIT Bombay', 'IIT Delhi', 'NIT Trichy', 'BITS Pilani', 'VIT University', 'IIIT Hyderabad', 'Anna University', 'Manipal Institute of Technology', 'Delhi Technological University', 'Pune University', 'NIT Surathkal', 'Jadavpur University', 'SRM Institute of Science and Technology', 'Amity University'];
const CITIES = ['Bangalore', 'Bangalore', 'Bangalore', 'Hyderabad', 'Pune', 'Mumbai', 'Chennai', 'Gurugram', 'Noida', 'Delhi', 'Kolkata', 'Remote'];
const FIELDS: Record<Family, string[]> = {
  frontend: ['Computer Science', 'Information Technology', 'Electronics'],
  backend: ['Computer Science', 'Information Technology'],
  fullstack: ['Computer Science', 'Information Technology', 'Electronics'],
  devops: ['Computer Science', 'Electronics', 'Information Technology'],
  data: ['Computer Science', 'Mathematics', 'Statistics', 'Data Science'],
  mobile: ['Computer Science', 'Information Technology'],
  qa: ['Computer Science', 'Electronics', 'Information Technology'],
  design: ['Design', 'Fine Arts', 'Human Computer Interaction'],
  product: ['Computer Science', 'Business Administration', 'Economics'],
  marketing: ['Marketing', 'Business Administration', 'Mass Communication'],
  sales: ['Business Administration', 'Commerce', 'Economics'],
  people: ['Human Resources', 'Psychology', 'Business Administration'],
  finance: ['Commerce', 'Finance', 'Economics'],
};

const PROJECT_IDEAS = [
  ['DevBoard', 'Real-time collaborative kanban board'],
  ['ShopLite', 'Headless e-commerce storefront with cart and payments'],
  ['TrackMate', 'Expense tracker with budgets and insights'],
  ['ChatterBox', 'Group chat app with typing indicators and read receipts'],
  ['MetricHub', 'Analytics dashboard for product KPIs'],
  ['QuickHire', 'Job board with resume search'],
  ['CodeSnap', 'Code snippet sharing platform with syntax highlighting'],
  ['FleetOps', 'Logistics tracking system with live maps'],
  ['PayFlow', 'UPI payment reconciliation service'],
  ['Learnly', 'Course platform with video progress tracking'],
];

const CERTS = ['AWS Certified Developer – Associate', 'Google Professional Cloud Architect', 'Meta Front-End Developer Certificate', 'Certified Kubernetes Administrator', 'Scrum Master (PSM I)', 'Google UX Design Certificate', 'Microsoft Azure Fundamentals'];

interface JobSeed {
  title: string;
  department: string;
  family: Family;
  level: ExperienceLevel;
  exp: [number, number];
  salary: [number, number];
  location: string;
  workMode: WorkMode;
  type?: EmploymentType;
  status: 'PUBLISHED' | 'CLOSED' | 'DRAFT';
  skills: [string, number | null, 'REQUIRED' | 'PREFERRED'][];
  createdDaysAgo: number;
}

const JOBS: JobSeed[] = [
  { title: 'Senior React Developer', department: 'Engineering', family: 'frontend', level: 'SENIOR', exp: [3, 6], salary: [1800000, 3200000], location: 'Bangalore', workMode: 'HYBRID', status: 'PUBLISHED', createdDaysAgo: 40, skills: [['React', 3, 'REQUIRED'], ['TypeScript', 2, 'REQUIRED'], ['JavaScript', 3, 'REQUIRED'], ['Node.js', null, 'REQUIRED'], ['REST APIs', null, 'REQUIRED'], ['Git', null, 'REQUIRED'], ['AWS', null, 'PREFERRED'], ['Kubernetes', null, 'PREFERRED'], ['PostgreSQL', null, 'PREFERRED']] },
  { title: 'Node.js Backend Engineer', department: 'Engineering', family: 'backend', level: 'MID', exp: [2, 5], salary: [1500000, 2800000], location: 'Bangalore', workMode: 'HYBRID', status: 'PUBLISHED', createdDaysAgo: 35, skills: [['Node.js', 2, 'REQUIRED'], ['TypeScript', null, 'REQUIRED'], ['PostgreSQL', null, 'REQUIRED'], ['REST APIs', null, 'REQUIRED'], ['Redis', null, 'PREFERRED'], ['Docker', null, 'PREFERRED'], ['AWS', null, 'PREFERRED']] },
  { title: 'Full Stack Engineer (MERN)', department: 'Engineering', family: 'fullstack', level: 'MID', exp: [2, 4], salary: [1200000, 2400000], location: 'Pune', workMode: 'REMOTE', status: 'PUBLISHED', createdDaysAgo: 60, skills: [['React', 2, 'REQUIRED'], ['Node.js', 2, 'REQUIRED'], ['MongoDB', null, 'REQUIRED'], ['Express', null, 'REQUIRED'], ['JavaScript', null, 'REQUIRED'], ['AWS', null, 'PREFERRED'], ['Docker', null, 'PREFERRED']] },
  { title: 'Frontend Engineer', department: 'Engineering', family: 'frontend', level: 'MID', exp: [1, 3], salary: [1000000, 1800000], location: 'Hyderabad', workMode: 'HYBRID', status: 'PUBLISHED', createdDaysAgo: 28, skills: [['React', 1, 'REQUIRED'], ['JavaScript', null, 'REQUIRED'], ['HTML', null, 'REQUIRED'], ['CSS', null, 'REQUIRED'], ['TypeScript', null, 'PREFERRED'], ['Jest', null, 'PREFERRED']] },
  { title: 'UI Engineer', department: 'Engineering', family: 'frontend', level: 'MID', exp: [2, 4], salary: [1200000, 2000000], location: 'Bangalore', workMode: 'ONSITE', status: 'DRAFT', createdDaysAgo: 12, skills: [['React', null, 'REQUIRED'], ['CSS', null, 'REQUIRED'], ['Tailwind CSS', null, 'REQUIRED'], ['Figma', null, 'PREFERRED']] },
  { title: 'Senior Backend Engineer (Go)', department: 'Engineering', family: 'backend', level: 'SENIOR', exp: [5, 9], salary: [3000000, 5000000], location: 'Bangalore', workMode: 'HYBRID', status: 'PUBLISHED', createdDaysAgo: 50, skills: [['Go', 3, 'REQUIRED'], ['Microservices', null, 'REQUIRED'], ['PostgreSQL', null, 'REQUIRED'], ['Kafka', null, 'REQUIRED'], ['System Design', null, 'REQUIRED'], ['Kubernetes', null, 'PREFERRED']] },
  { title: 'DevOps Engineer', department: 'Engineering', family: 'devops', level: 'MID', exp: [3, 6], salary: [1800000, 3000000], location: 'Gurugram', workMode: 'HYBRID', status: 'PUBLISHED', createdDaysAgo: 45, skills: [['AWS', 2, 'REQUIRED'], ['Docker', null, 'REQUIRED'], ['Kubernetes', null, 'REQUIRED'], ['Terraform', null, 'REQUIRED'], ['CI/CD', null, 'REQUIRED'], ['Python', null, 'PREFERRED']] },
  { title: 'React Native Developer', department: 'Engineering', family: 'mobile', level: 'MID', exp: [2, 5], salary: [1400000, 2400000], location: 'Mumbai', workMode: 'HYBRID', status: 'PUBLISHED', createdDaysAgo: 22, skills: [['React Native', 2, 'REQUIRED'], ['TypeScript', null, 'REQUIRED'], ['Redux', null, 'REQUIRED'], ['REST APIs', null, 'REQUIRED'], ['Jest', null, 'PREFERRED']] },
  { title: 'QA Automation Engineer', department: 'Engineering', family: 'qa', level: 'MID', exp: [2, 5], salary: [1000000, 1800000], location: 'Chennai', workMode: 'ONSITE', status: 'PUBLISHED', createdDaysAgo: 30, skills: [['Playwright', null, 'REQUIRED'], ['Cypress', null, 'PREFERRED'], ['JavaScript', null, 'REQUIRED'], ['CI/CD', null, 'REQUIRED'], ['REST APIs', null, 'PREFERRED']] },
  { title: 'Engineering Manager', department: 'Engineering', family: 'backend', level: 'LEAD', exp: [8, 14], salary: [5000000, 8000000], location: 'Bangalore', workMode: 'HYBRID', status: 'PUBLISHED', createdDaysAgo: 70, skills: [['System Design', null, 'REQUIRED'], ['Microservices', null, 'REQUIRED'], ['Agile', null, 'REQUIRED'], ['AWS', null, 'PREFERRED']] },
  { title: 'Site Reliability Engineer', department: 'Engineering', family: 'devops', level: 'SENIOR', exp: [4, 8], salary: [2500000, 4000000], location: 'Remote', workMode: 'REMOTE', status: 'CLOSED', createdDaysAgo: 150, skills: [['Kubernetes', null, 'REQUIRED'], ['AWS', null, 'REQUIRED'], ['Linux', null, 'REQUIRED'], ['Go', null, 'PREFERRED'], ['Terraform', null, 'PREFERRED']] },
  { title: 'Data Engineer', department: 'Data', family: 'data', level: 'MID', exp: [2, 5], salary: [1600000, 2800000], location: 'Bangalore', workMode: 'HYBRID', status: 'PUBLISHED', createdDaysAgo: 33, skills: [['Python', 2, 'REQUIRED'], ['SQL', null, 'REQUIRED'], ['Kafka', null, 'PREFERRED'], ['AWS', null, 'REQUIRED'], ['Docker', null, 'PREFERRED']] },
  { title: 'Machine Learning Engineer', department: 'Data', family: 'data', level: 'SENIOR', exp: [3, 7], salary: [2500000, 4500000], location: 'Bangalore', workMode: 'HYBRID', status: 'PUBLISHED', createdDaysAgo: 18, skills: [['Python', 3, 'REQUIRED'], ['Machine Learning', 2, 'REQUIRED'], ['SQL', null, 'REQUIRED'], ['AWS', null, 'PREFERRED']] },
  { title: 'Data Analyst', department: 'Data', family: 'data', level: 'ENTRY', exp: [0, 2], salary: [600000, 1100000], location: 'Noida', workMode: 'ONSITE', status: 'CLOSED', createdDaysAgo: 140, skills: [['SQL', null, 'REQUIRED'], ['Data Analysis', null, 'REQUIRED'], ['Python', null, 'PREFERRED']] },
  { title: 'Product Manager', department: 'Product', family: 'product', level: 'SENIOR', exp: [4, 8], salary: [2800000, 4500000], location: 'Bangalore', workMode: 'HYBRID', status: 'PUBLISHED', createdDaysAgo: 38, skills: [['Product Management', 3, 'REQUIRED'], ['Data Analysis', null, 'REQUIRED'], ['Agile', null, 'REQUIRED'], ['SQL', null, 'PREFERRED']] },
  { title: 'Associate Product Manager', department: 'Product', family: 'product', level: 'ENTRY', exp: [0, 2], salary: [1200000, 1800000], location: 'Bangalore', workMode: 'ONSITE', status: 'CLOSED', createdDaysAgo: 120, skills: [['Product Management', null, 'REQUIRED'], ['SQL', null, 'PREFERRED'], ['Agile', null, 'PREFERRED']] },
  { title: 'Senior Product Designer', department: 'Design', family: 'design', level: 'SENIOR', exp: [4, 8], salary: [2200000, 3600000], location: 'Bangalore', workMode: 'HYBRID', status: 'PUBLISHED', createdDaysAgo: 26, skills: [['Figma', 3, 'REQUIRED'], ['UI Design', null, 'REQUIRED'], ['UX Research', null, 'REQUIRED']] },
  { title: 'UX Researcher', department: 'Design', family: 'design', level: 'MID', exp: [2, 5], salary: [1400000, 2200000], location: 'Remote', workMode: 'REMOTE', status: 'DRAFT', createdDaysAgo: 6, skills: [['UX Research', 2, 'REQUIRED'], ['Figma', null, 'PREFERRED']] },
  { title: 'Growth Marketing Manager', department: 'Marketing', family: 'marketing', level: 'SENIOR', exp: [4, 8], salary: [1800000, 3000000], location: 'Mumbai', workMode: 'HYBRID', status: 'PUBLISHED', createdDaysAgo: 41, skills: [['Data Analysis', null, 'REQUIRED'], ['SQL', null, 'PREFERRED']] },
  { title: 'Content Strategist', department: 'Marketing', family: 'marketing', level: 'MID', exp: [2, 5], salary: [800000, 1400000], location: 'Remote', workMode: 'REMOTE', status: 'DRAFT', createdDaysAgo: 4, skills: [['Agile', null, 'PREFERRED']] },
  { title: 'Enterprise Account Executive', department: 'Sales', family: 'sales', level: 'SENIOR', exp: [5, 10], salary: [2000000, 3500000], location: 'Delhi', workMode: 'ONSITE', status: 'PUBLISHED', createdDaysAgo: 55, skills: [['Agile', null, 'PREFERRED']] },
  { title: 'Sales Development Representative', department: 'Sales', family: 'sales', level: 'ENTRY', exp: [0, 2], salary: [500000, 900000], location: 'Bangalore', workMode: 'ONSITE', status: 'CLOSED', createdDaysAgo: 110, skills: [['Agile', null, 'PREFERRED']] },
  { title: 'HR Business Partner', department: 'People', family: 'people', level: 'MID', exp: [3, 7], salary: [1200000, 2000000], location: 'Bangalore', workMode: 'HYBRID', status: 'PUBLISHED', createdDaysAgo: 29, skills: [['Agile', null, 'PREFERRED']] },
  { title: 'Technical Recruiter', department: 'People', family: 'people', level: 'MID', exp: [2, 5], salary: [900000, 1600000], location: 'Bangalore', workMode: 'HYBRID', status: 'DRAFT', createdDaysAgo: 3, skills: [['Agile', null, 'PREFERRED']] },
  { title: 'Financial Analyst', department: 'Finance', family: 'finance', level: 'MID', exp: [2, 4], salary: [1000000, 1600000], location: 'Mumbai', workMode: 'ONSITE', status: 'CLOSED', createdDaysAgo: 100, skills: [['SQL', null, 'PREFERRED'], ['Data Analysis', null, 'REQUIRED']] },
];

const TEAM: { email: string; first: string; last: string; role: Role; title: string }[] = [
  { email: 'admin@demo.recruitflow.com', first: 'Nikhil', last: 'Verma', role: 'COMPANY_ADMIN', title: 'Head of Talent' },
  { email: 'recruiter@demo.recruitflow.com', first: 'Sneha', last: 'Iyer', role: 'RECRUITER', title: 'Senior Recruiter' },
  { email: 'interviewer@demo.recruitflow.com', first: 'Ankit', last: 'Sharma', role: 'INTERVIEWER', title: 'Staff Engineer' },
  { email: 'priya.nair@demo.recruitflow.com', first: 'Priya', last: 'Nair', role: 'INTERVIEWER', title: 'Engineering Manager' },
  { email: 'arjun.mehta@demo.recruitflow.com', first: 'Arjun', last: 'Mehta', role: 'RECRUITER', title: 'Technical Recruiter' },
  { email: 'kavya.reddy@demo.recruitflow.com', first: 'Kavya', last: 'Reddy', role: 'INTERVIEWER', title: 'Senior Product Designer' },
  { email: 'rohan.gupta@demo.recruitflow.com', first: 'Rohan', last: 'Gupta', role: 'INTERVIEWER', title: 'Backend Lead' },
  { email: 'meera.joshi@demo.recruitflow.com', first: 'Meera', last: 'Joshi', role: 'COMPANY_ADMIN', title: 'People Operations Manager' },
];

const avatar = (seed: string) => `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=e0e7ff,dbeafe,fce7f3,dcfce7,fef3c7`;

/* ─────────────────────────── Candidate builder ─────────────────────────── */

interface CandidateDraft {
  id: string;
  family: Family;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
  years: number;
  headline: string;
  currentCompany: string;
  source: CandidateSource;
  availability: string;
  skills: { name: string; years: number | null }[];
  experiences: { company: string; title: string; startDate: Date; endDate: Date | null; description: string }[];
  educations: { institution: string; degree: string; field: string; startYear: number; endYear: number }[];
  projects: { name: string; description: string; technologies: string[] }[];
  certifications: string[];
  resume: ResumeSource;
  createdAt: Date;
}

function buildCandidate(family: Family, overrides: Partial<CandidateDraft> & { skillYears?: Record<string, number> } = {}): CandidateDraft {
  const sex = pick(['female', 'male'] as const);
  const firstName = overrides.firstName ?? faker.person.firstName(sex);
  const lastName = overrides.lastName ?? faker.person.lastName();
  const years = overrides.years ?? Math.round(Math.min(14, Math.max(0.5, rnd(0.5, 3) + rnd(0, 6) * (chance(0.4) ? 1 : 0.4))) * 10) / 10;
  const pool = FAMILY_SKILLS[family];
  const skillNames = overrides.skillYears ? Object.keys(overrides.skillYears) : pickN(pool, int(Math.min(5, pool.length), Math.min(10, pool.length)));
  const skills = skillNames.map((name) => ({
    name,
    years: overrides.skillYears?.[name] ?? (chance(0.75) ? Math.max(0.5, Math.round(rnd(0.4, 1) * years * 2) / 2) : null),
  }));

  // Work history that adds up to `years`.
  const jobs = years < 2 ? 1 : years < 5 ? int(1, 2) : int(2, 3);
  const experiences: CandidateDraft['experiences'] = [];
  let cursor = now;
  let remaining = years * 365.25 * DAY;
  const companies = pickN(COMPANIES, jobs);
  for (let i = 0; i < jobs; i++) {
    const span = i === jobs - 1 ? remaining : remaining * rnd(0.35, 0.6);
    const start = new Date(cursor - span);
    const tech = pickN(skillNames, 3);
    const title = i === 0 ? (overrides.headline ?? pick(FAMILY_TITLES[family])) : pick(FAMILY_TITLES[family]).replace('Senior ', '');
    experiences.push({
      company: companies[i],
      title,
      startDate: start,
      endDate: i === 0 ? null : new Date(cursor),
      description: pick([
        `Built and shipped customer-facing features using ${tech.join(', ')}; improved performance by ${int(15, 60)}%.`,
        `Owned ${pick(['payments', 'search', 'onboarding', 'checkout', 'notifications', 'analytics'])} module end-to-end with ${tech.join(' and ')}.`,
        `Led a team of ${int(2, 6)} to deliver ${pick(['a platform migration', 'a design system', 'real-time dashboards', 'a new mobile experience'])} using ${tech.join(', ')}.`,
      ]),
    });
    cursor = start.getTime() - int(0, 60) * DAY;
    remaining -= span;
  }

  const gradYear = new Date(experiences[experiences.length - 1].startDate).getUTCFullYear() - (chance(0.7) ? 0 : 1);
  const educations = [
    {
      institution: pick(INSTITUTIONS),
      degree: ['design', 'marketing', 'sales', 'people', 'finance'].includes(family) ? pick(['Bachelor of Design', 'BBA', 'B.Com', 'Bachelor of Arts']) : pick(['B.Tech', 'B.E.', 'B.Tech', 'BCA']),
      field: pick(FIELDS[family]),
      startYear: gradYear - 4,
      endYear: gradYear,
    },
  ];
  if (chance(0.2)) educations.unshift({ institution: pick(INSTITUTIONS), degree: pick(['M.Tech', 'MBA', 'M.Sc', 'MCA']), field: pick(FIELDS[family]), startYear: gradYear + 1, endYear: gradYear + 3 });

  const projects = ['design', 'marketing', 'sales', 'people', 'finance'].includes(family)
    ? []
    : pickN(PROJECT_IDEAS, int(0, 3)).map(([name, desc]) => {
        const tech = pickN(skillNames, int(2, 3));
        return { name, description: `${desc} built with ${tech.join(', ')}.`, technologies: tech };
      });
  const certifications = chance(0.3) ? pickN(CERTS, int(1, 2)) : [];
  const location = overrides.location ?? pick(CITIES);
  const email = overrides.email ?? faker.internet.email({ firstName, lastName, provider: pick(['gmail.com', 'outlook.com', 'yahoo.in', 'proton.me']) }).toLowerCase();
  const phone = `+91 ${int(70000, 99999)} ${int(10000, 99999)}`;
  const headline = overrides.headline ?? experiences[0].title;

  const resume: ResumeSource = {
    firstName,
    lastName,
    headline,
    email,
    phone,
    location,
    linkedin: `linkedin.com/in/${firstName.toLowerCase()}${lastName.toLowerCase()}`,
    github: projects.length ? `github.com/${firstName.toLowerCase()}-${lastName.toLowerCase()}` : undefined,
    years,
    summary: `${headline} with ${years} years of experience in ${skillNames.slice(0, 3).join(', ')}. Passionate about building reliable, user-focused products and mentoring teammates.`,
    experiences: experiences.map((e) => ({ title: e.title, company: e.company, start: e.startDate, end: e.endDate, bullets: [e.description] })),
    educations,
    projects,
    skills: skillNames,
    certifications,
  };

  return {
    id: id(),
    family,
    firstName,
    lastName,
    email,
    phone,
    location,
    years,
    headline,
    currentCompany: experiences[0].company,
    source: overrides.source ?? weighted<CandidateSource>([['LINKEDIN', 38], ['CAREERS_PAGE', 27], ['REFERRAL', 21], ['INDEED', 10], ['NAUKRI', 4]]),
    availability: pick(['IMMEDIATE', '15_DAYS', '30_DAYS', '30_DAYS', '60_DAYS', '90_DAYS']),
    skills,
    experiences,
    educations,
    projects,
    certifications,
    resume,
    createdAt: daysAgo(0),
    ...overrides,
  } as CandidateDraft;
}

/* ───────────────────────────────── Main ───────────────────────────────── */

async function reset() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`);
}

async function main() {
  console.log('🌱 Seeding RecruitFlow demo data…');
  await reset();
  const passwordHash = await bcrypt.hash(PASSWORD, 11);

  /* Company & team */
  const company = await prisma.company.create({
    data: {
      name: 'Nimbus Labs',
      slug: 'nimbus-labs',
      industry: 'Software & Internet',
      size: '201-500',
      website: 'https://nimbuslabs.example.com',
      location: 'Bangalore, India',
      about: 'Nimbus Labs builds cloud tools that help 20,000+ Indian SMBs run payments, inventory and payroll from a single dashboard.',
      recruitingSpend: 765000,
      onboardingCompleted: true,
      createdAt: daysAgo(200),
    },
  });
  const setup = defaultCompanySetup(company.id);
  await prisma.companyStage.createMany({ data: setup.stages });
  await prisma.emailTemplate.createMany({ data: setup.templates });

  const users: Record<string, { id: string; role: Role; name: string }> = {};
  for (const [i, m] of TEAM.entries()) {
    const user = await prisma.user.create({
      data: { email: m.email, firstName: m.first, lastName: m.last, passwordHash, avatarUrl: avatar(m.first + m.last), emailVerified: true, lastActiveAt: daysAgo(i === 0 ? 0 : rnd(0, 6)), createdAt: daysAgo(190 - i * 5) },
    });
    await prisma.companyMember.create({ data: { companyId: company.id, userId: user.id, role: m.role, title: m.title, joinedAt: daysAgo(190 - i * 5) } });
    users[m.email] = { id: user.id, role: m.role, name: `${m.first} ${m.last}` };
  }
  await prisma.user.create({ data: { email: 'superadmin@demo.recruitflow.com', firstName: 'Platform', lastName: 'Admin', passwordHash, isSuperAdmin: true, emailVerified: true } });

  const admin = users['admin@demo.recruitflow.com'];
  const recruiters = TEAM.filter((t) => t.role === 'RECRUITER' || t.role === 'COMPANY_ADMIN').map((t) => users[t.email].id);
  const interviewerIds = {
    engineering: [users['interviewer@demo.recruitflow.com'].id, users['priya.nair@demo.recruitflow.com'].id, users['rohan.gupta@demo.recruitflow.com'].id],
    design: [users['kavya.reddy@demo.recruitflow.com'].id],
    other: [users['meera.joshi@demo.recruitflow.com'].id, users['priya.nair@demo.recruitflow.com'].id],
  };
  const interviewersFor = (dept: string) => (dept === 'Design' ? [...interviewerIds.design, interviewerIds.engineering[1]] : dept === 'Engineering' || dept === 'Data' ? interviewerIds.engineering : interviewerIds.other);

  await prisma.subscription.create({ data: { companyId: company.id, plan: 'GROWTH', status: 'ACTIVE', currentPeriodStart: daysAgo(10), currentPeriodEnd: new Date(now + 20 * DAY) } });
  await prisma.payment.createMany({
    data: [0, 1, 2, 3].map((m) => ({ companyId: company.id, amount: 4999, currency: 'INR', status: 'PAID', description: 'Growth plan — monthly', paidAt: daysAgo(10 + m * 30), createdAt: daysAgo(10 + m * 30) })),
  });

  /* Jobs */
  type JobRec = JobSeed & { id: string; stages: { id: string; name: string; type: StageType }[]; publishedAt: Date | null; closedAt: Date | null; createdAt: Date; hiringManagerId: string };
  const jobs: JobRec[] = [];
  const audits: Prisma.AuditLogCreateManyInput[] = [];
  for (const j of JOBS) {
    const jobId = id();
    const createdAt = daysAgo(j.status === 'PUBLISHED' ? Math.round(j.createdDaysAgo * 2.2) : j.createdDaysAgo);
    const publishedAt = j.status === 'DRAFT' ? null : new Date(createdAt.getTime() + int(1, 3) * DAY);
    const closedAt = j.status === 'CLOSED' ? daysAgo(int(5, Math.max(6, j.createdDaysAgo - 40))) : null;
    const jd = generateJobDescription({ prompt: `${j.title} with ${j.exp[0]}-${j.exp[1]} years ${j.skills.map((s) => s[0]).join(' ')}`, title: j.title, department: j.department, tone: 'PROFESSIONAL' });
    const creator = pick(recruiters);
    const stages = DEFAULT_WORKFLOW.map((s) => ({ id: id(), ...s }));
    await prisma.job.create({
      data: {
        id: jobId,
        companyId: company.id,
        createdById: creator,
        hiringManagerId: j.department === 'Engineering' ? admin.id : creator,
        title: j.title,
        slug: `${j.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${jobId.slice(0, 6)}`,
        department: j.department,
        location: j.location,
        workMode: j.workMode,
        employmentType: j.type ?? 'FULL_TIME',
        experienceLevel: j.level,
        experienceMin: j.exp[0],
        experienceMax: j.exp[1],
        salaryMin: j.salary[0],
        salaryMax: j.salary[1],
        openings: int(1, 3),
        description: jd.description,
        questions: [
          { id: 'q_why', label: `Why do you want to join ${company.name}?`, type: 'LONG_TEXT', required: true },
          ...(j.department === 'Engineering' ? [{ id: 'q_exp', label: `Describe your ${j.skills[0][0]} experience.`, type: 'LONG_TEXT', required: false }] : []),
          { id: 'q_relocate', label: `Are you willing to relocate to ${j.location === 'Remote' ? 'Bangalore occasionally' : j.location}?`, type: 'YES_NO', required: true },
        ],
        status: j.status,
        publishedAt,
        closedAt,
        createdAt,
        skills: { create: j.skills.map(([name, years, importance]) => ({ name, years, importance })) },
        stages: { create: stages.map((s, order) => ({ id: s.id, name: s.name, type: s.type, order })) },
      },
    });
    jobs.push({ ...j, id: jobId, stages, publishedAt, closedAt, createdAt, hiringManagerId: j.department === 'Engineering' ? admin.id : creator });
    audits.push({ companyId: company.id, actorId: creator, action: 'CREATE_JOB', entityType: 'job', entityId: jobId, summary: `created job "${j.title}"`, createdAt });
    if (publishedAt) audits.push({ companyId: company.id, actorId: creator, action: 'PUBLISH_JOB', entityType: 'job', entityId: jobId, summary: `published job "${j.title}"`, createdAt: publishedAt });
  }
  const openJobs = jobs.filter((j) => j.status !== 'DRAFT');
  const jobsByFamily = (f: Family) => {
    const direct = openJobs.filter((j) => j.family === f);
    if (direct.length) return direct;
    const related: Record<Family, Family[]> = { fullstack: ['frontend', 'backend'], frontend: ['fullstack'], backend: ['fullstack'], mobile: ['frontend'], qa: ['frontend'], devops: ['backend'], data: ['backend'], design: ['product'], product: ['design'], marketing: ['product'], sales: ['marketing'], people: ['sales'], finance: ['data'] };
    return openJobs.filter((j) => related[f].includes(j.family));
  };

  /* Candidates */
  const reactJob = jobs.find((j) => j.title === 'Senior React Developer')!;
  const nodeJob = jobs.find((j) => j.title === 'Node.js Backend Engineer')!;
  const featured: (CandidateDraft & { forJob: JobRec; stage: StageType; stageName?: string })[] = [
    {
      ...buildCandidate('frontend', {
        firstName: 'Rahul',
        lastName: 'Sharma',
        email: 'candidate@demo.recruitflow.com',
        location: 'Bangalore',
        years: 4.2,
        headline: 'Senior Frontend Engineer',
        source: 'LINKEDIN',
        skillYears: { React: 4, TypeScript: 3, JavaScript: 4.2, 'Node.js': 2, 'REST APIs': 4, Redux: 3, Git: 4, Jest: 2, PostgreSQL: 1, 'Tailwind CSS': 2 },
      }),
      forJob: reactJob,
      stage: 'INTERVIEW',
      stageName: 'Technical Interview',
    },
    { ...buildCandidate('backend', { firstName: 'Ananya', lastName: 'Singh', location: 'Pune', years: 3.5, headline: 'Backend Engineer', source: 'REFERRAL', skillYears: { 'Node.js': 3.5, TypeScript: 2.5, PostgreSQL: 3, 'REST APIs': 3.5, Redis: 1.5, Docker: 2, Express: 3 } }), forJob: nodeJob, stage: 'INTERVIEW', stageName: 'HR Round' },
    { ...buildCandidate('frontend', { firstName: 'Wendy', lastName: 'Pereira', location: 'Bangalore', years: 5.1, headline: 'Senior React Developer', source: 'REFERRAL', skillYears: { React: 5, TypeScript: 4, JavaScript: 5, 'Next.js': 2, 'Node.js': 3, AWS: 2, 'REST APIs': 5, Git: 5 } }), forJob: reactJob, stage: 'OFFER' },
    { ...buildCandidate('frontend', { firstName: 'Nate', lastName: 'Bondre', location: 'Hyderabad', years: 2.1, headline: 'Frontend Engineer', source: 'CAREERS_PAGE' }), forJob: reactJob, stage: 'SCREENING' },
    { ...buildCandidate('frontend', { firstName: 'Jessica', lastName: 'Halder', location: 'Bangalore', years: 3.8, headline: 'React Developer', source: 'LINKEDIN' }), forJob: reactJob, stage: 'SHORTLISTED' },
  ];

  const families: [Family, number][] = [['frontend', 22], ['backend', 18], ['fullstack', 14], ['devops', 8], ['data', 10], ['mobile', 6], ['qa', 5], ['design', 6], ['product', 5], ['marketing', 3], ['sales', 3], ['people', 2], ['finance', 2]];
  const candidates: (CandidateDraft & { forJob?: JobRec; stage?: StageType; stageName?: string })[] = [...featured];
  const usedEmails = new Set(candidates.map((c) => c.email));
  while (candidates.length < 300) {
    const c = buildCandidate(weighted(families));
    if (usedEmails.has(c.email)) continue;
    usedEmails.add(c.email);
    candidates.push(c);
  }

  const candidateUser = await prisma.user.create({
    data: { email: 'candidate@demo.recruitflow.com', firstName: 'Rahul', lastName: 'Sharma', passwordHash, avatarUrl: avatar('RahulSharma'), emailVerified: true },
  });

  /* Applications with realistic stage progression */
  const applicationRows: Prisma.ApplicationCreateManyInput[] = [];
  const historyRows: Prisma.ApplicationStageHistoryCreateManyInput[] = [];
  const interviewRows: Prisma.InterviewCreateManyInput[] = [];
  const participantRows: Prisma.InterviewParticipantCreateManyInput[] = [];
  const feedbackRows: Prisma.InterviewFeedbackCreateManyInput[] = [];
  const aiRows: Prisma.AiAnalysisCreateManyInput[] = [];
  const pending: { appId: string; job: JobRec; stageName: string; candidate: CandidateDraft }[] = [];

  const STEP_P = [0.62, 0.58, 0.6, 0.4, 0.55];
  const interviewStages = ['Recruiter Call', 'Technical Interview', 'HR Round'];
  const typeFor: Record<string, InterviewType> = { 'Recruiter Call': 'PHONE_SCREEN', 'Technical Interview': 'TECHNICAL', 'HR Round': 'HR' };
  const pairs = new Set<string>();

  const planApplication = (c: CandidateDraft, job: JobRec, forced?: { stage: StageType; stageName?: string }) => {
    const key = `${job.id}:${c.id}`;
    if (pairs.has(key)) return;
    pairs.add(key);

    const windowStart = job.publishedAt!.getTime();
    const windowEnd = job.closedAt ? job.closedAt.getTime() - 10 * DAY : now - 0.2 * DAY;
    const span = Math.max(DAY, windowEnd - windowStart);
    const appliedAt = forced ? new Date(now - int(8, 16) * DAY) : new Date(windowEnd - span * faker.number.float({ min: 0, max: 1 }));
    const stageOf = (name: string) => job.stages.find((s) => s.name === name)!;
    const firstOfType = (t: StageType) => job.stages.find((s) => s.type === t)!;

    // Ordered path of stage names the application travels through.
    const path: string[] = ['Applied'];
    let reached = 0;
    if (forced) {
      const order: StageType[] = ['APPLIED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED'];
      reached = order.indexOf(forced.stage);
    } else {
      while (reached < 5 && chance(STEP_P[reached])) reached++;
    }
    if (reached >= 1) path.push('Resume Screening');
    if (reached >= 2) path.push('Shortlisted');
    if (reached >= 3) {
      const depth = forced?.stageName ? interviewStages.indexOf(forced.stageName) + 1 : reached > 3 ? 3 : int(1, 3);
      path.push(...interviewStages.slice(0, depth));
    }
    if (reached >= 4) path.push('Offer');
    if (reached >= 5) path.push('Hired');

    // Walk the path in time; stop early if we run past "now".
    const times: Date[] = [appliedAt];
    let t = appliedAt.getTime();
    let cut = path.length;
    for (let i = 1; i < path.length; i++) {
      t += rnd(0.6, 5.5) * DAY;
      if (t > now - 0.1 * DAY) { cut = i; break; }
      times.push(new Date(t));
    }
    const finalPath = path.slice(0, forced ? path.length : cut);
    while (times.length < finalPath.length) times.push(new Date(Math.min(now - 0.2 * DAY, times[times.length - 1].getTime() + DAY)));

    let current = stageOf(finalPath[finalPath.length - 1]);
    let status: 'ACTIVE' | 'HIRED' | 'REJECTED' = current.type === 'HIRED' ? 'HIRED' : 'ACTIVE';
    let rejectedAt: Date | null = null;
    const lastTime = times[times.length - 1];
    const age = (now - lastTime.getTime()) / DAY;
    // Stalled applications that are older than ~2 weeks (or on closed jobs) get rejected.
    if (!forced && status === 'ACTIVE' && (job.status === 'CLOSED' || (age > 12 && chance(0.75)))) {
      rejectedAt = new Date(Math.min(now - 0.1 * DAY, lastTime.getTime() + rnd(1, 6) * DAY));
      status = 'REJECTED';
    }

    const appId = id();
    const changer = () => pick(recruiters);
    finalPath.forEach((name, i) => {
      const s = stageOf(name);
      const prev = i > 0 ? stageOf(finalPath[i - 1]) : null;
      historyRows.push({ id: id(), applicationId: appId, fromStageId: prev?.id ?? null, fromStageType: prev?.type ?? null, toStageId: s.id, toStageType: s.type, changedById: i === 0 ? null : changer(), changedAt: times[i] });
      if (i > 0) audits.push({ companyId: company.id, actorId: changer(), action: 'MOVE_CANDIDATE', entityType: 'candidate', entityId: c.id, summary: `moved ${c.firstName} ${c.lastName} to ${s.name}`, metadata: { applicationId: appId, jobId: job.id, from: prev!.name, to: s.name }, createdAt: times[i] });
    });
    if (rejectedAt) {
      const rej = firstOfType('REJECTED');
      historyRows.push({ id: id(), applicationId: appId, fromStageId: current.id, fromStageType: current.type, toStageId: rej.id, toStageType: 'REJECTED', changedById: changer(), changedAt: rejectedAt });
      audits.push({ companyId: company.id, actorId: changer(), action: 'MOVE_CANDIDATE', entityType: 'candidate', entityId: c.id, summary: `moved ${c.firstName} ${c.lastName} to Rejected`, metadata: { applicationId: appId, jobId: job.id }, createdAt: rejectedAt });
      current = rej;
    }
    audits.push({ companyId: company.id, actorId: null, action: 'CREATE_APPLICATION', entityType: 'candidate', entityId: c.id, summary: `${c.firstName} ${c.lastName} applied for ${job.title}`, metadata: { applicationId: appId, jobId: job.id }, createdAt: appliedAt });

    const match = computeMatch(
      { experienceYears: c.years, skills: c.skills, experiences: c.experiences, educations: c.educations, projects: c.projects, resumeText: resumeLines(c.resume).join('\n') },
      { title: job.title, experienceMin: job.exp[0], experienceMax: job.exp[1], skills: job.skills.map(([name, years, importance]) => ({ name, years, importance })) },
    );
    aiRows.push({ companyId: company.id, kind: 'MATCH', candidateId: c.id, jobId: job.id, applicationId: appId, score: match.overall, result: match as unknown as Prisma.InputJsonValue, engine: 'heuristic', createdAt: new Date(appliedAt.getTime() + 60_000) });

    applicationRows.push({
      id: appId,
      companyId: company.id,
      jobId: job.id,
      candidateId: c.id,
      stageId: current.id,
      stageType: current.type,
      status,
      source: c.source,
      matchScore: match.overall,
      answers: { q_why: `I admire ${company.name}'s product focus and want to build at scale.`, q_relocate: chance(0.7) ? 'Yes' : 'No' },
      appliedAt,
      stageChangedAt: rejectedAt ?? lastTime,
      hiredAt: status === 'HIRED' ? lastTime : null,
      rejectedAt,
      rejectionReason: rejectedAt ? pick(['Skills mismatch', 'Position filled', 'Candidate withdrew', 'Compensation mismatch', 'Not enough experience']) : null,
    });

    // Interviews for every interview stage passed (completed + feedback), current one upcoming.
    const interviewIdx = finalPath.map((n, i) => [n, i] as const).filter(([n]) => interviewStages.includes(n));
    for (const [name, i] of interviewIdx) {
      const isCurrent = status === 'ACTIVE' && current.name === name;
      const panel = pickN(interviewersFor(job.department), name === 'Technical Interview' ? 2 : 1);
      if (isCurrent) {
        pending.push({ appId, job, stageName: name, candidate: c });
        continue;
      }
      const ivId = id();
      const startsAt = new Date(times[i].getTime() + rnd(1, 3) * DAY);
      const startClamped = new Date(Math.min(startsAt.getTime(), (times[i + 1] ?? new Date(now - DAY)).getTime() - 3600_000));
      startClamped.setUTCMinutes(0, 0, 0);
      startClamped.setUTCHours(int(4, 11));
      interviewRows.push({ id: ivId, companyId: company.id, applicationId: appId, createdById: changer(), title: name, type: typeFor[name], status: 'COMPLETED', startsAt: startClamped, durationMins: pick([30, 45, 60]), meetingUrl: 'https://meet.google.com/abc-defg-hij', createdAt: times[i] });
      for (const p of panel) {
        participantRows.push({ id: id(), interviewId: ivId, userId: p });
        const advanced = i < finalPath.length - 1 && !(rejectedAt && i === finalPath.length - 1);
        const base = advanced ? rnd(3.3, 4.8) : rnd(1.8, 3.4);
        const ratings = { technical: 0, problemSolving: 0, communication: 0, roleSkill: 0, cultureAdd: 0 };
        for (const k of Object.keys(ratings) as (keyof typeof ratings)[]) ratings[k] = Math.max(1, Math.min(5, Math.round(base + rnd(-0.8, 0.8))));
        const overall = Math.round((Object.values(ratings).reduce((a, b) => a + b, 0) / 5) * 10) / 10;
        const recommendation: Recommendation = overall >= 4.2 ? 'STRONG_YES' : overall >= 3.4 ? 'PROCEED' : overall >= 2.6 ? 'HOLD' : 'NO';
        feedbackRows.push({ id: id(), interviewId: ivId, interviewerId: p, ratings, overallRating: overall, recommendation, strengths: pick(['Strong fundamentals and clear communication.', 'Great product sense and ownership mindset.', 'Excellent debugging approach under pressure.', 'Solid system design thinking.']), concerns: pick([null, 'Limited exposure to large-scale systems.', 'Needs to verify depth in cloud infrastructure.', 'Could improve on testing practices.']), privateNotes: chance(0.4) ? 'Would be a good fit for the platform squad.' : null, submittedAt: new Date(startClamped.getTime() + rnd(1, 20) * 3600_000) });
        audits.push({ companyId: company.id, actorId: p, action: 'SUBMIT_FEEDBACK', entityType: 'candidate', entityId: c.id, summary: `submitted ${name} feedback for ${c.firstName} ${c.lastName}`, metadata: { interviewId: ivId }, createdAt: new Date(startClamped.getTime() + 3 * 3600_000) });
      }
    }
  };

  for (const c of featured) planApplication(c, c.forJob, { stage: c.stage, stageName: c.stageName });
  for (const c of candidates.slice(featured.length)) {
    const options = jobsByFamily(c.family);
    if (!options.length) continue;
    planApplication(c, pick(options));
  }
  // Second applications to reach ~420.
  for (let guard = 0; applicationRows.length < 420 && guard < 5000; guard++) {
    const c = pick(candidates.slice(featured.length));
    const options = jobsByFamily(c.family);
    if (options.length > 1) planApplication(c, pick(options));
  }

  // Candidate createdAt = first application time.
  const firstApplied = new Map<string, Date>();
  for (const a of applicationRows) {
    const prev = firstApplied.get(a.candidateId);
    if (!prev || (a.appliedAt as Date) < prev) firstApplied.set(a.candidateId, a.appliedAt as Date);
  }

  await prisma.candidate.createMany({
    data: candidates.map((c) => ({
      id: c.id,
      companyId: company.id,
      userId: c.email === 'candidate@demo.recruitflow.com' ? candidateUser.id : null,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      location: c.location,
      headline: c.headline,
      currentCompany: c.currentCompany,
      experienceYears: c.years,
      linkedinUrl: `https://${c.resume.linkedin}`,
      githubUrl: c.resume.github ? `https://${c.resume.github}` : null,
      avatarUrl: chance(0.85) ? avatar(c.firstName + c.lastName) : null,
      summary: c.resume.summary,
      source: c.source,
      availability: c.availability,
      expectedSalary: Math.round((c.years * 4 + rnd(4, 10)) * 100000),
      noticePeriodDays: pick([0, 15, 30, 30, 60, 90]),
      tags: chance(0.25) ? pickN(['Top talent', 'Referral', 'Re-engage', 'Relocation', 'Fast-track'], int(1, 2)) : [],
      certifications: c.certifications,
      projects: c.projects,
      resumeText: resumeLines(c.resume).join('\n'),
      parseStatus: 'COMPLETE',
      createdAt: firstApplied.get(c.id) ?? daysAgo(int(1, 120)),
    })),
  });
  await prisma.candidateSkill.createMany({ data: candidates.flatMap((c) => c.skills.map((s) => ({ candidateId: c.id, name: s.name, years: s.years }))) });
  await prisma.candidateExperience.createMany({ data: candidates.flatMap((c) => c.experiences.map((e) => ({ candidateId: c.id, ...e }))) });
  await prisma.candidateEducation.createMany({ data: candidates.flatMap((c) => c.educations.map((e) => ({ candidateId: c.id, ...e }))) });
  await prisma.application.createMany({ data: applicationRows });
  await prisma.applicationStageHistory.createMany({ data: historyRows });

  /* Upcoming interviews (today/tomorrow for the demo), reserving slots to avoid clashes */
  const ankit = users['interviewer@demo.recruitflow.com'].id;
  const slot = (dayOffset: number, hourIst: number, minute = 0) => {
    const d = new Date(now + dayOffset * DAY);
    d.setUTCHours(hourIst - 5, minute - 30, 0, 0);
    return d;
  };
  const upcomingPlan: { match: (p: (typeof pending)[number]) => boolean; at: Date; panel?: string[] }[] = [
    { match: (p) => p.candidate.email === 'candidate@demo.recruitflow.com', at: slot(1, 10), panel: [ankit, users['priya.nair@demo.recruitflow.com'].id] },
    { match: (p) => p.candidate.firstName === 'Ananya' && p.candidate.lastName === 'Singh', at: slot(1, 11, 30), panel: [users['meera.joshi@demo.recruitflow.com'].id] },
  ];
  const used = new Set<string>();
  let todayCount = 0;
  let futureOffset = 0;
  for (const plan of upcomingPlan) {
    const p = pending.find((x) => plan.match(x) && !used.has(x.appId));
    if (!p) continue;
    used.add(p.appId);
    const ivId = id();
    interviewRows.push({ id: ivId, companyId: company.id, applicationId: p.appId, createdById: users['recruiter@demo.recruitflow.com'].id, title: p.stageName, type: typeFor[p.stageName], status: 'SCHEDULED', startsAt: plan.at, durationMins: p.stageName === 'Technical Interview' ? 60 : 45, meetingUrl: 'https://meet.google.com/rfw-tech-int', notes: 'Focus on React performance and state management.', createdAt: daysAgo(2) });
    for (const u of plan.panel ?? []) participantRows.push({ id: id(), interviewId: ivId, userId: u });
    audits.push({ companyId: company.id, actorId: users['recruiter@demo.recruitflow.com'].id, action: 'SCHEDULE_INTERVIEW', entityType: 'candidate', entityId: p.candidate.id, summary: `scheduled ${p.stageName} with ${p.candidate.firstName} ${p.candidate.lastName}`, metadata: { interviewId: ivId }, createdAt: daysAgo(2) });
  }
  for (const p of pending) {
    if (used.has(p.appId)) continue;
    used.add(p.appId);
    const ivId = id();
    const engineering = p.job.department === 'Engineering' || p.job.department === 'Data';
    const forAnkit = engineering && todayCount < 3;
    // A few interviews for Ankit around now (2 upcoming, 1 already happened awaiting feedback).
    const halfHour = 30 * 60_000;
    const aroundNow = (hours: number) => new Date(Math.round((now + hours * 3600_000) / halfHour) * halfHour);
    const at = forAnkit ? aroundNow([1, 3, -2][todayCount]) : slot(1 + Math.floor(futureOffset / 3), 10 + (futureOffset % 3) * 2);
    if (forAnkit) todayCount++;
    else futureOffset++;
    const isPast = at.getTime() < now;
    interviewRows.push({ id: ivId, companyId: company.id, applicationId: p.appId, createdById: pick(recruiters), title: p.stageName, type: typeFor[p.stageName], status: 'SCHEDULED', startsAt: at, durationMins: pick([30, 45, 60]), meetingUrl: 'https://meet.google.com/xyz-uvwx-rst', createdAt: daysAgo(int(1, 3)) });
    const panel = forAnkit ? [ankit] : pickN(interviewersFor(p.job.department), 1);
    for (const u of panel) participantRows.push({ id: id(), interviewId: ivId, userId: u });
    audits.push({ companyId: company.id, actorId: pick(recruiters), action: 'SCHEDULE_INTERVIEW', entityType: 'candidate', entityId: p.candidate.id, summary: `scheduled ${p.stageName} with ${p.candidate.firstName} ${p.candidate.lastName}`, metadata: { interviewId: ivId }, createdAt: isPast ? daysAgo(2) : daysAgo(1) });
  }

  // Keep the dataset near the target shape: ~70 interviews, ~40 feedback.
  const completed = interviewRows.filter((i) => i.status === 'COMPLETED');
  const keepCompleted = new Set(faker.helpers.shuffle(completed).slice(0, Math.max(0, 70 - (interviewRows.length - completed.length))).map((i) => i.id));
  const finalInterviews = interviewRows.filter((i) => i.status !== 'COMPLETED' || keepCompleted.has(i.id));
  const finalIds = new Set(finalInterviews.map((i) => i.id));
  const finalFeedback = feedbackRows.filter((f) => finalIds.has(f.interviewId)).slice(0, 40);

  const keptFeedback = new Set(finalFeedback.map((f) => `${f.interviewId}:${f.interviewerId}`));
  for (let i = audits.length - 1; i >= 0; i--) {
    const a = audits[i];
    const interviewId = (a.metadata as { interviewId?: string } | undefined)?.interviewId;
    if (a.action === 'SUBMIT_FEEDBACK' && !keptFeedback.has(`${interviewId}:${a.actorId}`)) audits.splice(i, 1);
  }

  await prisma.interview.createMany({ data: finalInterviews });
  await prisma.interviewParticipant.createMany({ data: participantRows.filter((p) => finalIds.has(p.interviewId)) });
  await prisma.interviewFeedback.createMany({ data: finalFeedback });
  await prisma.aiAnalysis.createMany({ data: aiRows });

  /* Resume PDFs for featured + a sample of candidates (exercises the real file pipeline) */
  const withFiles = [...featured, ...candidates.slice(featured.length, 40)];
  for (const c of withFiles) {
    const key = `${company.id}/resumes/seed/${c.id}.pdf`;
    const pdf = makeTextPdf(resumeLines(c.resume));
    await storage.putObject(key, pdf, 'application/pdf');
    await prisma.file.create({ data: { companyId: company.id, candidateId: c.id, kind: 'RESUME', status: 'UPLOADED', storageKey: key, filename: `${c.firstName}_${c.lastName}_Resume.pdf`, mimeType: 'application/pdf', size: pdf.length, createdAt: firstApplied.get(c.id) ?? daysAgo(5) } });
  }

  /* Notes, messages, talent pools */
  const rahul = featured[0];
  await prisma.candidateNote.createMany({
    data: [
      { candidateId: rahul.id, authorId: users['recruiter@demo.recruitflow.com'].id, body: 'Strong React fundamentals. Need to verify AWS experience.', createdAt: daysAgo(5) },
      { candidateId: rahul.id, authorId: admin.id, body: 'Great culture signals from the recruiter call — very collaborative. Fast-track if technical goes well.', createdAt: daysAgo(3) },
      ...faker.helpers.shuffle(candidates.slice(5)).slice(0, 40).map((c) => ({
        candidateId: c.id,
        authorId: pick(recruiters),
        body: pick(['Good communicator, solid on fundamentals.', 'Expected CTC slightly above band — discuss with hiring manager.', 'Open to relocation. Notice period negotiable.', 'Referred by Priya — strong recommendation.', 'Revisit in Q1 for the platform team.']),
        createdAt: daysAgo(int(1, 60)),
      })),
    ],
  });
  await prisma.message.createMany({
    data: [
      { companyId: company.id, candidateId: rahul.id, senderId: users['recruiter@demo.recruitflow.com'].id, subject: 'Technical Interview — Nimbus Labs', body: `Hi Rahul,\n\nYour technical interview for Senior React Developer is confirmed for tomorrow at 10:00 AM IST with Ankit and Priya.\n\nBest,\nSneha`, templateKey: 'INTERVIEW_INVITATION', status: 'SENT', sentAt: daysAgo(2), createdAt: daysAgo(2) },
      ...faker.helpers.shuffle(candidates.slice(5)).slice(0, 25).map((c) => ({ companyId: company.id, candidateId: c.id, senderId: pick(recruiters), subject: 'We received your application', body: `Hi ${c.firstName},\n\nThanks for applying to Nimbus Labs. We'll be in touch soon.`, templateKey: 'APPLICATION_RECEIVED', status: 'SENT' as const, sentAt: daysAgo(int(1, 90)), createdAt: daysAgo(int(1, 90)) })),
    ],
  });

  const poolDefs = [
    { name: 'Frontend Engineers', color: '#6366f1', families: ['frontend'] as Family[] },
    { name: 'React Developers', color: '#0ea5e9', families: ['frontend', 'fullstack'] as Family[] },
    { name: 'Senior Backend', color: '#10b981', families: ['backend'] as Family[], minYears: 5 },
    { name: 'Potential CTO', color: '#f59e0b', families: ['backend', 'fullstack', 'devops'] as Family[], minYears: 9 },
    { name: 'Future Candidates', color: '#ec4899', families: ['design', 'product', 'data'] as Family[] },
  ];
  for (const def of poolDefs) {
    const pool = await prisma.talentPool.create({ data: { companyId: company.id, name: def.name, color: def.color, description: `Curated ${def.name.toLowerCase()} for upcoming roles.`, createdById: pick(recruiters), createdAt: daysAgo(int(20, 90)) } });
    const members = candidates.filter((c) => def.families.includes(c.family) && c.years >= (def.minYears ?? 0)).slice(0, int(6, 14));
    await prisma.talentPoolMember.createMany({ data: members.map((m) => ({ poolId: pool.id, candidateId: m.id, addedById: pick(recruiters), addedAt: daysAgo(int(1, 30)) })), skipDuplicates: true });
  }

  /* Audit trail + notifications */
  for (const u of Object.values(users)) audits.push({ companyId: company.id, actorId: u.id, action: 'LOGIN', entityType: 'user', entityId: u.id, summary: 'signed in', ip: '103.21.58.12', metadata: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36' }, createdAt: daysAgo(rnd(0, 3)) });
  await prisma.auditLog.createMany({ data: audits.filter((a) => (a.createdAt as Date).getTime() <= now) });

  const notify = (userId: string, n: { type: string; title: string; body: string; link: string; ago: number; read?: boolean }) => ({
    userId,
    companyId: company.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    createdAt: new Date(now - n.ago * 60_000),
    readAt: n.read ? new Date(now - (n.ago - 1) * 60_000) : null,
  });
  const someCand = candidates[10];
  await prisma.notification.createMany({
    data: [admin.id, users['recruiter@demo.recruitflow.com'].id].flatMap((uid) => [
      notify(uid, { type: 'CANDIDATE_APPLIED', title: `${someCand.firstName} ${someCand.lastName} applied for ${reactJob.title}`, body: someCand.headline, link: `/candidates/${someCand.id}`, ago: 2 }),
      notify(uid, { type: 'INTERVIEW_REMINDER', title: 'Interview starts in 1 hour', body: `Technical Interview with ${featured[3].firstName} ${featured[3].lastName}`, link: '/interviews', ago: 20 }),
      notify(uid, { type: 'FEEDBACK_SUBMITTED', title: 'Ankit submitted feedback for Wendy Pereira', body: 'Technical Interview · 4.4/5', link: `/candidates/${featured[2].id}?tab=feedback`, ago: 60 }),
      notify(uid, { type: 'RESUME_PARSED', title: `AI analysis ready: Rahul Sharma — ${applicationRows.find((a) => a.candidateId === rahul.id)?.matchScore}% match`, body: 'Senior React Developer · Interview', link: `/candidates/${rahul.id}`, ago: 180 }),
      notify(uid, { type: 'JOB_PUBLISHED', title: 'Job "Machine Learning Engineer" published', body: 'Bangalore · Data', link: '/jobs', ago: 60 * 26, read: true }),
    ]),
  });
  await prisma.notification.createMany({
    data: [
      notify(ankit, { type: 'INTERVIEW_SCHEDULED', title: "You're interviewing Rahul Sharma", body: 'Technical Interview · tomorrow 10:00 AM', link: '/interviews', ago: 60 * 30 }),
      notify(ankit, { type: 'INTERVIEW_REMINDER', title: 'You have interviews today', body: 'Check My Interviews for details', link: '/interviews', ago: 90 }),
    ],
  });

  const hires = applicationRows.filter((a) => a.status === 'HIRED').length;
  console.log(`✅ Seeded: ${jobs.length} jobs · ${candidates.length} candidates · ${applicationRows.length} applications · ${finalInterviews.length} interviews · ${finalFeedback.length} feedback · ${hires} hires`);
  console.log(`   Demo login: admin@demo.recruitflow.com / ${PASSWORD} (also recruiter@, interviewer@, candidate@, superadmin@)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
