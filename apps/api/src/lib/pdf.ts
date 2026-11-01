/**
 * Tiny dependency-free PDF writer (Helvetica, text only). Used to generate demo
 * resumes for seed data and test fixtures so the real upload → parse pipeline runs.
 */
const escapePdf = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7E]/g, '-');

function wrap(line: string, max = 95): string[] {
  if (line.length <= max) return [line];
  const words = line.split(' ');
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) {
      out.push(cur.trim());
      cur = w;
    } else cur += ' ' + w;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function makeTextPdf(lines: string[]): Buffer {
  const wrapped = lines.flatMap((l) => (l.trim() ? wrap(l) : ['']));
  const perPage = 54;
  const pages: string[][] = [];
  for (let i = 0; i < wrapped.length; i += perPage) pages.push(wrapped.slice(i, i + perPage));
  if (!pages.length) pages.push(['']);

  const objects: string[] = [];
  const pageIds: number[] = [];
  // 1 catalog, 2 pages, 3 font, then (page, content) pairs
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  let next = 4;
  for (const page of pages) {
    const pageId = next++;
    const contentId = next++;
    pageIds.push(pageId);
    const body = `BT /F1 10 Tf 14 TL 50 760 Td ${page.map((l, i) => `${i === 0 ? '' : 'T* '}(${escapePdf(l)}) Tj`).join(' ')} ET`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`;
    objects[contentId] = `<< /Length ${Buffer.byteLength(body, 'latin1')} >>\nstream\n${body}\nendstream`;
  }
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(pdf, 'latin1');
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

export interface ResumeSource {
  firstName: string;
  lastName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  github?: string;
  years: number;
  summary: string;
  experiences: { title: string; company: string; start: Date; end: Date | null; bullets: string[] }[];
  educations: { degree: string; field: string; institution: string; startYear: number; endYear: number }[];
  projects: { name: string; description: string }[];
  skills: string[];
  certifications: string[];
}

const fmt = (d: Date) => d.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/** Renders resume content in the plain layout the heuristic parser understands. */
export function resumeLines(r: ResumeSource): string[] {
  return [
    `${r.firstName} ${r.lastName}`,
    r.headline,
    `${r.location}, India | ${r.email} | ${r.phone}`,
    [r.linkedin, r.github].filter(Boolean).join(' | '),
    '',
    'Summary',
    r.summary,
    '',
    'Experience',
    ...r.experiences.flatMap((e) => [`${e.title}, ${e.company} | ${fmt(e.start)} - ${e.end ? fmt(e.end) : 'Present'}`, ...e.bullets.map((b) => `- ${b}`)]),
    '',
    'Education',
    ...r.educations.map((e) => `${e.degree} in ${e.field}, ${e.institution} | ${e.startYear} - ${e.endYear}`),
    '',
    'Projects',
    ...r.projects.map((p) => `${p.name}: ${p.description}`),
    '',
    'Skills',
    r.skills.join(', '),
    ...(r.certifications.length ? ['', 'Certifications', ...r.certifications.map((c) => `- ${c}`)] : []),
  ];
}
