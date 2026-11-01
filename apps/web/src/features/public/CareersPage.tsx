import { EMPLOYMENT_TYPE_LABELS, WORK_MODE_LABELS, type EmploymentType, type WorkMode } from '@recruitflow/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Briefcase, MapPin } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { Logo } from '@/components/domain';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/feedback';
import { Skeleton } from '@/components/ui/skeleton';
import { QueryErrorPage } from '@/features/errors/ErrorPages';
import { useDocumentTitle } from '@/hooks';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface CareersJob {
  id: string;
  title: string;
  slug: string;
  department: string;
  location: string;
  workMode: WorkMode;
  employmentType: EmploymentType;
  publishedAt: string | null;
}

interface CareersPayload {
  company: { name: string; slug: string; logoUrl: string | null; about: string | null; industry: string | null };
  jobs: CareersJob[];
}

export function CareersPage() {
  const { companySlug = '' } = useParams();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['careers', companySlug],
    queryFn: () => api.get<CareersPayload>(`/public/companies/${companySlug}/jobs`),
  });
  useDocumentTitle(data ? `Careers at ${data.company.name}` : 'Careers');

  if (isError) return <QueryErrorPage error={error} />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            {data?.company.logoUrl ? <img src={data.company.logoUrl} alt="" className="size-8 rounded-lg object-cover" /> : <Logo />}
            <span className="font-semibold">{data?.company.name ?? 'Careers'}</span>
          </Link>
          <Button variant="outline" size="sm" asChild>
            <Link to="/login">Recruiter login</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-12">
        {isLoading || !data ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">We're hiring</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Open roles at {data.company.name}</h1>
            {data.company.about && <p className="mt-3 max-w-2xl text-muted-foreground">{data.company.about}</p>}
            <div className="mt-10 space-y-3">
              {data.jobs.length === 0 ? (
                <Card>
                  <EmptyState icon={Briefcase} title="No open roles right now" description="Check back soon — new positions are posted here first." />
                </Card>
              ) : (
                data.jobs.map((job) => (
                  <Link key={job.id} to={`/careers/${companySlug}/${job.slug}`} className="block">
                    <Card className="flex flex-col gap-2 p-5 transition hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{job.title}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                          <span>{job.department}</span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3.5" /> {job.location} · {WORK_MODE_LABELS[job.workMode]}
                          </span>
                          <span>{EMPLOYMENT_TYPE_LABELS[job.employmentType]}</span>
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                        {job.publishedAt ? `Posted ${formatDate(job.publishedAt)}` : 'Open'} <ArrowRight className="size-4" />
                      </span>
                    </Card>
                  </Link>
                ))
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
