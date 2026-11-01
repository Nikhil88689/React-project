import type { PublicJobDTO } from '@recruitflow/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { Logo } from '@/components/domain';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { JobMeta, JobPostingBody } from '@/features/jobs/JobPostingView';
import { QueryErrorPage } from '@/features/errors/ErrorPages';
import { useDocumentTitle } from '@/hooks';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

export function PublicJobPage() {
  const { companySlug = '', jobSlug = '' } = useParams();
  const { data: job, isLoading, isError, error } = useQuery({
    queryKey: ['public-job', jobSlug],
    queryFn: () => api.get<PublicJobDTO>(`/public/jobs/${jobSlug}`),
  });
  useDocumentTitle(job ? `${job.title} · ${job.company.name}` : 'Job');

  if (isError) return <QueryErrorPage error={error} />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to={`/careers/${companySlug}`} className="flex items-center gap-2">
            {job?.company.logoUrl ? <img src={job.company.logoUrl} alt="" className="size-8 rounded-lg object-cover" /> : <Logo />}
            <span className="font-semibold">{job?.company.name ?? 'Careers'}</span>
          </Link>
          {job && (
            <Button asChild>
              <Link to={`/careers/${companySlug}/${jobSlug}/apply`}>Apply now</Link>
            </Button>
          )}
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-8 px-6 py-10 lg:grid-cols-[1fr_280px]">
        <div>
          {isLoading || !job ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <>
              <Link to={`/careers/${companySlug}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-3.5" /> All open roles
              </Link>
              <h1 className="mt-3 text-3xl font-bold tracking-tight">{job.title}</h1>
              <p className="mt-1 text-muted-foreground">{job.company.name}</p>
              <div className="mt-4">
                <JobMeta job={job} />
              </div>
              <div className="mt-10">
                <JobPostingBody job={job} />
              </div>
            </>
          )}
        </div>
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <Card>
            <CardContent className="space-y-4">
              <p className="text-sm font-semibold">Ready to apply?</p>
              <p className="text-sm text-muted-foreground">Takes about 5 minutes. Upload your resume and we'll parse it automatically.</p>
              <Button className="w-full" asChild disabled={!job}>
                <Link to={`/careers/${companySlug}/${jobSlug}/apply`}>Apply now</Link>
              </Button>
              {job?.publishedAt && <p className="text-xs text-muted-foreground">Posted {formatDate(job.publishedAt)}</p>}
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}
