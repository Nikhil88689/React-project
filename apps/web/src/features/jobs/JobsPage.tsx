import { DEPARTMENTS, EMPLOYMENT_TYPES, EMPLOYMENT_TYPE_LABELS, WORK_MODE_LABELS, type JobDTO, type JobStatus, type JobSummaryDTO, type PageMeta } from '@recruitflow/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, ChevronLeft, ChevronRight, Copy, ExternalLink, Eye, Link2, MapPin, MoreHorizontal, Pencil, Plus, Rocket, Search, Trash2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { JobStatusBadge } from '@/components/domain';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { confirm, EmptyState, ErrorState, PageHeader } from '@/components/ui/feedback';
import { Input, NativeSelect } from '@/components/ui/input';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebounce, useDocumentTitle } from '@/hooks';
import { api } from '@/lib/api';
import { cn, formatDate, formatSalaryRange } from '@/lib/utils';
import { useAuth, usePermission } from '@/stores/auth';

type JobList = { items: JobSummaryDTO[]; statusCounts: Partial<Record<JobStatus, number>> };

const TABS: { value: JobStatus | ''; label: string }[] = [
  { value: '', label: 'All jobs' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'CLOSED', label: 'Closed' },
];

export const publicJobUrl = (companySlug: string, jobSlug: string) => `${window.location.origin}/careers/${companySlug}/${jobSlug}`;

export function useJobActions() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['jobs'] });
    qc.invalidateQueries({ queryKey: ['job'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const publish = useMutation({ mutationFn: (id: string) => api.post<JobDTO>(`/jobs/${id}/publish`), onSuccess: invalidate, meta: { success: 'Job published — it is now live on your careers page' } });
  const close = useMutation({ mutationFn: (id: string) => api.post<JobDTO>(`/jobs/${id}/close`), onSuccess: invalidate, meta: { success: 'Job closed' } });
  const duplicate = useMutation({
    mutationFn: (id: string) => api.post<JobDTO>(`/jobs/${id}/duplicate`),
    onSuccess: (job) => {
      invalidate();
      toast.success('Job duplicated as a draft');
      navigate(`/jobs/${job.id}/edit`);
    },
  });
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/jobs/${id}`), onSuccess: invalidate, meta: { success: 'Job deleted' } });

  return {
    publish: (id: string) => publish.mutate(id),
    close: async (job: { id: string; title: string }) => {
      if (await confirm({ title: `Close “${job.title}”?`, description: 'The job will be removed from your careers page and stop accepting applications. Existing candidates stay in the pipeline.', confirmLabel: 'Close job', destructive: true })) close.mutate(job.id);
    },
    duplicate: (id: string) => duplicate.mutate(id),
    remove: async (job: { id: string; title: string }) => {
      if (await confirm({ title: `Delete “${job.title}”?`, description: 'This permanently deletes the job. Jobs with applications can only be closed.', confirmLabel: 'Delete job', destructive: true })) remove.mutate(job.id);
    },
    pending: publish.isPending || close.isPending || duplicate.isPending,
  };
}

function JobRowMenu({ job }: { job: JobSummaryDTO }) {
  const can = usePermission();
  const navigate = useNavigate();
  const companySlug = useAuth((s) => s.user?.company?.slug ?? '');
  const actions = useJobActions();
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${job.title}`}>
          <MoreHorizontal />
        </Button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem onSelect={() => navigate(`/jobs/${job.id}`)}>
          <Eye /> View job
        </MenuItem>
        {can('jobs:update') && (
          <MenuItem onSelect={() => navigate(`/jobs/${job.id}/edit`)}>
            <Pencil /> Edit
          </MenuItem>
        )}
        {can('jobs:create') && (
          <MenuItem onSelect={() => actions.duplicate(job.id)}>
            <Copy /> Duplicate
          </MenuItem>
        )}
        {job.status === 'PUBLISHED' && (
          <>
            <MenuItem onSelect={() => navigator.clipboard.writeText(publicJobUrl(companySlug, job.slug)).then(() => toast.success('Public link copied'))}>
              <Link2 /> Copy public link
            </MenuItem>
            <MenuItem onSelect={() => window.open(publicJobUrl(companySlug, job.slug), '_blank')}>
              <ExternalLink /> View on careers page
            </MenuItem>
          </>
        )}
        {can('jobs:publish') && (
          <>
            <MenuSeparator />
            {job.status !== 'PUBLISHED' ? (
              <MenuItem onSelect={() => actions.publish(job.id)}>
                <Rocket /> Publish
              </MenuItem>
            ) : (
              <MenuItem onSelect={() => actions.close(job)}>
                <XCircle /> Close job
              </MenuItem>
            )}
          </>
        )}
        {can('jobs:delete') && (
          <MenuItem destructive onSelect={() => actions.remove(job)}>
            <Trash2 /> Delete
          </MenuItem>
        )}
      </MenuContent>
    </Menu>
  );
}

export function JobsPage() {
  useDocumentTitle('Jobs');
  const can = usePermission();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') ?? '') as JobStatus | '';
  const department = params.get('department') ?? '';
  const employmentType = params.get('employmentType') ?? '';
  const page = Number(params.get('page') ?? 1);
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [location, setLocation] = useState(params.get('location') ?? '');
  const q = useDebounce(search.trim());
  const loc = useDebounce(location.trim());

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const query = { status, department, employmentType, search: q, location: loc, page, limit: 15 };
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['jobs', query],
    queryFn: () => api.getEnvelope<JobList>('/jobs', query),
    placeholderData: keepPreviousData,
  });
  const jobs = data?.data.items ?? [];
  const meta = data?.meta as PageMeta | undefined;
  const counts = data?.data.statusCounts ?? {};
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
  const filtered = Boolean(q || loc || department || employmentType);

  return (
    <>
      <PageHeader
        title="Jobs"
        description="Create roles, publish them to your careers page and track every applicant."
        actions={
          can('jobs:create') && (
            <Button onClick={() => navigate('/jobs/new')}>
              <Plus /> Create job
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-1 border-b border-border">
        {TABS.map((t) => {
          const count = t.value ? (counts[t.value] ?? 0) : total;
          const active = status === t.value;
          return (
            <button
              key={t.value}
              onClick={() => setParam('status', t.value)}
              className={cn('-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition', active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}
            >
              {t.label}
              <span className={cn('rounded-full px-1.5 text-[11px] font-semibold', active ? 'bg-primary-soft text-primary-soft-foreground' : 'bg-muted text-muted-foreground')}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => (setSearch(e.target.value), setParam('search', e.target.value))} placeholder="Search title, department, skill…" className="pl-9" aria-label="Search jobs" />
        </div>
        <NativeSelect value={department} onChange={(e) => setParam('department', e.target.value)} className="w-40" aria-label="Department">
          <option value="">All departments</option>
          {DEPARTMENTS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </NativeSelect>
        <NativeSelect value={employmentType} onChange={(e) => setParam('employmentType', e.target.value)} className="w-36" aria-label="Employment type">
          <option value="">All types</option>
          {EMPLOYMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {EMPLOYMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </NativeSelect>
        <div className="relative w-40">
          <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={location} onChange={(e) => (setLocation(e.target.value), setParam('location', e.target.value))} placeholder="Location" className="pl-9" aria-label="Location" />
        </div>
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              setLocation('');
              setParams(status ? { status } : {}, { replace: true });
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <Card className={cn('overflow-hidden transition-opacity', isFetching && !isLoading && 'opacity-70')}>
        {isError ? (
          <ErrorState message="We couldn't load jobs." onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="ml-auto h-4 w-24" />
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title={filtered || status ? 'No jobs match these filters' : 'Create your first job'}
            description={filtered || status ? 'Try a different search or clear the filters.' : 'Describe the role and let AI draft the job description for you. Publish it to start collecting applications.'}
            action={
              !filtered && !status && can('jobs:create') ? (
                <Button onClick={() => navigate('/jobs/new')}>
                  <Plus /> Create job
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Job</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Applicants</th>
                  <th className="px-3 py-3 font-medium">Salary</th>
                  <th className="px-3 py-3 font-medium">Hiring manager</th>
                  <th className="px-3 py-3 font-medium">Created</th>
                  <th className="w-12 px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {jobs.map((job) => (
                  <tr key={job.id} className="group transition hover:bg-accent/40">
                    <td className="px-5 py-3.5">
                      <Link to={`/jobs/${job.id}`} className="font-semibold text-foreground hover:text-primary">
                        {job.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {job.department} · {job.location} · {WORK_MODE_LABELS[job.workMode]} · {EMPLOYMENT_TYPE_LABELS[job.employmentType]}
                      </p>
                    </td>
                    <td className="px-3 py-3.5">
                      <JobStatusBadge status={job.status} />
                    </td>
                    <td className="px-3 py-3.5">
                      <Link to={`/jobs/${job.id}?tab=pipeline`} className="font-semibold tabular-nums hover:text-primary">
                        {job.applicationCount}
                      </Link>
                      {job.newApplicationCount > 0 && <span className="ml-2 rounded-full bg-emerald-50 px-1.5 py-px text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">+{job.newApplicationCount} new</span>}
                    </td>
                    <td className="px-3 py-3.5 text-muted-foreground">{formatSalaryRange(job.salaryMin, job.salaryMax, job.salaryCurrency) ?? '—'}</td>
                    <td className="px-3 py-3.5">
                      {job.hiringManager ? (
                        <span className="flex items-center gap-2">
                          <Avatar name={job.hiringManager.name} size="xs" />
                          <span className="truncate">{job.hiringManager.name}</span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-3.5 text-muted-foreground">{formatDate(job.createdAt)}</td>
                    <td className="px-3 py-3.5 text-right">
                      <JobRowMenu job={job} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm text-muted-foreground">
            <span>
              Showing {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon-sm" disabled={meta.page <= 1} onClick={() => setParam('page', String(meta.page - 1))} aria-label="Previous page">
                <ChevronLeft />
              </Button>
              <Button variant="outline" size="icon-sm" disabled={meta.page >= meta.totalPages} onClick={() => setParam('page', String(meta.page + 1))} aria-label="Next page">
                <ChevronRight />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
