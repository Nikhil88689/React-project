import type { ProcessingStep } from '@recruitflow/shared';
import { useQuery } from '@tanstack/react-query';
import { Check, Circle, Loader2, X } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { Logo } from '@/components/domain';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { QueryErrorPage } from '@/features/errors/ErrorPages';
import { useDocumentTitle } from '@/hooks';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';

const STEP_LABELS: Record<ProcessingStep, string> = {
  UPLOADING: 'Uploading resume',
  PROCESSING: 'Processing file',
  EXTRACTING: 'Extracting text',
  PARSING: 'Parsing resume',
  ANALYZING: 'AI analysis',
  COMPLETE: 'Complete',
  FAILED: 'Could not parse resume',
};

const ORDER: ProcessingStep[] = ['UPLOADING', 'PROCESSING', 'EXTRACTING', 'PARSING', 'ANALYZING', 'COMPLETE'];

interface TrackPayload {
  jobTitle: string;
  companyName: string;
  firstName: string;
  processingStep: ProcessingStep;
  status: string;
  appliedAt: string;
}

export function TrackApplicationPage() {
  const { token = '' } = useParams();
  const { data, isError, error } = useQuery({
    queryKey: ['track', token],
    queryFn: () => api.get<TrackPayload>(`/public/applications/${token}`),
    refetchInterval: (q) => {
      const step = q.state.data?.processingStep;
      return step && step !== 'COMPLETE' && step !== 'FAILED' ? 2000 : false;
    },
  });
  useDocumentTitle('Application received');

  if (isError) return <QueryErrorPage error={error} />;
  const current = data?.processingStep ?? 'PROCESSING';
  const idx = ORDER.indexOf(current === 'FAILED' ? 'PARSING' : current);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <Logo />
      </header>
      <main className="mx-auto max-w-lg px-6 py-16">
        <Card>
          <CardContent className="py-10 text-center">
            <h1 className="text-2xl font-bold tracking-tight">Application received</h1>
            {data && (
              <p className="mt-2 text-sm text-muted-foreground">
                Thanks {data.firstName}. {data.companyName} has your application for <span className="font-medium text-foreground">{data.jobTitle}</span>.
              </p>
            )}
            <ol className="mx-auto mt-8 max-w-xs space-y-3 text-left">
              {ORDER.map((step, i) => {
                const done = current === 'COMPLETE' || i < idx;
                const active = current !== 'FAILED' && i === idx && current !== 'COMPLETE';
                const failed = current === 'FAILED' && step === 'PARSING';
                return (
                  <li key={step} className="flex items-center gap-3 text-sm">
                    <span className={cn('flex size-7 items-center justify-center rounded-full', done ? 'bg-emerald-500 text-white' : failed ? 'bg-rose-500 text-white' : active ? 'bg-primary text-white' : 'bg-muted text-muted-foreground')}>
                      {done ? <Check className="size-3.5" /> : failed ? <X className="size-3.5" /> : active ? <Loader2 className="size-3.5 animate-spin" /> : <Circle className="size-3.5" />}
                    </span>
                    <span className={cn(done || active ? 'font-medium' : 'text-muted-foreground')}>{STEP_LABELS[step]}</span>
                  </li>
                );
              })}
            </ol>
            {data && (
              <p className="mt-6 text-sm text-muted-foreground">
                Current status: <span className="font-medium text-foreground">{data.status}</span> · Applied {formatDate(data.appliedAt)}
              </p>
            )}
            <Button className="mt-8" variant="outline" asChild>
              <Link to="/">Back to RecruitFlow</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
