import type { JobDTO, PipelineColumnDTO } from '@recruitflow/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, Pencil } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router';
import { JobStatusBadge, MatchScore, STAGE_STYLES } from '@/components/domain';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/controls';
import { PageHeader } from '@/components/ui/feedback';
import { Skeleton } from '@/components/ui/skeleton';
import { QueryErrorPage } from '@/features/errors/ErrorPages';
import { useJobActions, publicJobUrl } from '@/features/jobs/JobsPage';
import { JobMeta, JobPostingBody } from '@/features/jobs/JobPostingView';
import { useDocumentTitle } from '@/hooks';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuth, usePermission } from '@/stores/auth';

export function JobDetailPage() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'overview';
  const can = usePermission();
  const slug = useAuth((s) => s.user?.company?.slug ?? '');
  const actions = useJobActions();
  const { data: job, isLoading, isError, error } = useQuery({ queryKey: ['job', id], queryFn: () => api.get<JobDTO>(`/jobs/${id}`) });
  useDocumentTitle(job?.title ?? 'Job');

  if (isError) return <QueryErrorPage error={error} />;
  if (isLoading || !job) return <Skeleton className="h-96" />;

  return (
    <>
      <PageHeader
        eyebrow={<JobStatusBadge status={job.status} />}
        title={job.title}
        description={<JobMeta job={job} />}
        actions={
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/jobs">
                <ArrowLeft /> Jobs
              </Link>
            </Button>
            {job.status === 'PUBLISHED' && (
              <Button variant="outline" asChild>
                <a href={publicJobUrl(slug, job.slug)} target="_blank" rel="noreferrer">
                  <ExternalLink /> Careers page
                </a>
              </Button>
            )}
            {can('jobs:update') && (
              <Button variant="outline" asChild>
                <Link to={`/jobs/${job.id}/edit`}>
                  <Pencil /> Edit
                </Link>
              </Button>
            )}
            {can('jobs:publish') && job.status !== 'PUBLISHED' && <Button onClick={() => actions.publish(job.id)}>Publish</Button>}
            {can('jobs:publish') && job.status === 'PUBLISHED' && (
              <Button variant="outline" onClick={() => actions.close(job)}>
                Close job
              </Button>
            )}
          </>
        }
      />
      <Tabs value={tab} onValueChange={(v) => setParams(v === 'overview' ? {} : { tab: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pipeline" count={job.applicationCount}>
            Pipeline
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-6">
          <JobPostingBody job={job} />
        </TabsContent>
        <TabsContent value="pipeline" className="mt-6">
          <JobPipeline jobId={job.id} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function JobPipeline({ jobId }: { jobId: string }) {
  const { data } = useQuery({
    queryKey: ['pipeline', { jobId }],
    queryFn: () => api.get<{ columns: PipelineColumnDTO[] }>('/applications', { jobId, limitPerStage: 40 }),
  });
  const columns = data?.columns ?? [];
  return (
    <div className="scrollbar-thin flex gap-3 overflow-x-auto pb-4">
      {columns.map((col) => (
        <div key={col.id} className="w-64 shrink-0 rounded-xl bg-muted/60 p-2">
          <div className="mb-2 flex items-center gap-2 px-1.5 pt-1">
            <span className={cn('size-2 rounded-full', STAGE_STYLES[col.type].dot)} />
            <span className="text-[13px] font-semibold">{col.name}</span>
            <span className="ml-auto text-[11px] text-muted-foreground">{col.total}</span>
          </div>
          <div className="space-y-2">
            {col.cards.map((card) => (
              <Link key={card.id} to={`/candidates/${card.candidateId}`} className="block rounded-lg border border-border bg-card p-2.5">
                <div className="flex items-center gap-2">
                  <Avatar name={card.candidateName} src={card.avatarUrl} size="xs" />
                  <span className="truncate text-[13px] font-medium">{card.candidateName}</span>
                </div>
                <div className="mt-2 flex justify-end">
                  <MatchScore score={card.matchScore} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
