import { EMPLOYMENT_TYPE_LABELS, EXPERIENCE_LEVEL_LABELS, WORK_MODE_LABELS, type EmploymentType, type ExperienceLevel, type JobDescription, type WorkMode } from '@recruitflow/shared';
import { Banknote, Briefcase, Clock, MapPin } from 'lucide-react';
import type { ReactNode } from 'react';
import { RichText } from '@/components/domain';
import { Badge } from '@/components/ui/badge';
import { formatSalaryRange } from '@/lib/utils';
import { DESCRIPTION_SECTIONS } from './jobForm';

export interface PostingJob {
  title: string;
  department: string;
  location: string;
  workMode: WorkMode;
  employmentType: EmploymentType;
  experienceLevel: ExperienceLevel;
  experienceMin?: number | null;
  experienceMax?: number | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency: string;
  description: JobDescription;
  skills: { name: string; importance: 'REQUIRED' | 'PREFERRED' }[];
}

export function JobMeta({ job }: { job: PostingJob }) {
  const salary = formatSalaryRange(job.salaryMin ?? null, job.salaryMax ?? null, job.salaryCurrency);
  const exp = job.experienceMin != null ? `${job.experienceMin}${job.experienceMax != null ? `–${job.experienceMax}` : '+'} yrs` : EXPERIENCE_LEVEL_LABELS[job.experienceLevel];
  const items: [ReactNode, string][] = [
    [<MapPin key="l" />, `${job.location} · ${WORK_MODE_LABELS[job.workMode]}`],
    [<Briefcase key="t" />, EMPLOYMENT_TYPE_LABELS[job.employmentType]],
    [<Clock key="e" />, exp],
  ];
  if (salary) items.push([<Banknote key="s" />, `${salary} / year`]);
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground [&_svg]:size-4">
      {items.map(([icon, text]) => (
        <span key={text} className="inline-flex items-center gap-1.5">
          {icon}
          {text}
        </span>
      ))}
    </div>
  );
}

export function JobPostingBody({ job }: { job: PostingJob }) {
  const required = job.skills.filter((s) => s.importance === 'REQUIRED');
  const preferred = job.skills.filter((s) => s.importance === 'PREFERRED');
  return (
    <div className="space-y-8">
      {DESCRIPTION_SECTIONS.map((s) =>
        job.description[s.key] ? (
          <section key={s.key}>
            <h2 className="mb-3 text-lg font-semibold tracking-tight">{s.label}</h2>
            <RichText html={job.description[s.key]} />
          </section>
        ) : null,
      )}
      {job.skills.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold tracking-tight">Skills</h2>
          <div className="flex flex-wrap gap-2">
            {required.map((s) => (
              <Badge key={s.name} className="px-2.5 py-1 text-[13px]">
                {s.name}
              </Badge>
            ))}
            {preferred.map((s) => (
              <Badge key={s.name} variant="secondary" className="px-2.5 py-1 text-[13px]">
                {s.name} <span className="text-muted-foreground">· preferred</span>
              </Badge>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
