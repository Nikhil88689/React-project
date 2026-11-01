import { zodResolver } from '@hookform/resolvers/zod';
import {
  EVALUATION_CRITERIA,
  RECOMMENDATIONS,
  RECOMMENDATION_LABELS,
  feedbackSchema,
  type FeedbackInput,
  type InterviewDTO,
  type InterviewQuestion,
} from '@recruitflow/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Video } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router';
import { AvatarStack } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/feedback';
import { Field, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { QueryErrorPage } from '@/features/errors/ErrorPages';
import { useDocumentTitle } from '@/hooks';
import { api } from '@/lib/api';
import { applyServerErrors } from '@/lib/forms';
import { cn, formatDateTime } from '@/lib/utils';
import { useAuth, usePermission } from '@/stores/auth';

type InterviewDetail = InterviewDTO & {
  matchScore: number | null;
  jobSkills: { name: string; importance: string }[];
  isParticipant: boolean;
  myFeedback: { ratings: Record<string, number>; recommendation: FeedbackInput['recommendation']; strengths: string | null; concerns: string | null; privateNotes: string | null; submittedAt: string } | null;
};

export function InterviewDetailPage() {
  const { id = '' } = useParams();
  const can = usePermission();
  const user = useAuth((s) => s.user)!;
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({ queryKey: ['interview', id], queryFn: () => api.get<InterviewDetail>(`/interviews/${id}`) });
  useDocumentTitle(data ? `${data.candidate.name} · Interview` : 'Interview');

  const form = useForm<FeedbackInput>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      ratings: Object.fromEntries(EVALUATION_CRITERIA.map((c) => [c.key, 3])) as FeedbackInput['ratings'],
      recommendation: 'PROCEED',
      strengths: '',
      concerns: '',
      privateNotes: '',
    },
  });

  const submit = useMutation({
    mutationFn: (input: FeedbackInput) => api.post(`/interviews/${id}/feedback`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['interview', id] }),
    onError: (err) => applyServerErrors(err, form.setError),
    meta: { success: 'Feedback submitted' },
  });

  const [questions, setQuestions] = useState<InterviewQuestion[] | null>(null);
  const generate = useMutation({
    mutationFn: () =>
      api.post<InterviewQuestion[]>('/ai/interview-questions', {
        role: data?.application.jobTitle ?? 'Software Engineer',
        round: data?.type ?? 'TECHNICAL',
        difficulty: 'MEDIUM',
        count: 6,
        candidateId: data?.candidate.id,
        jobId: data?.application.jobId,
      }),
    onSuccess: setQuestions,
  });

  if (isError) return <QueryErrorPage error={error} />;
  if (isLoading || !data) return <Skeleton className="h-96" />;

  const mine = data.interviewers.some((i) => i.id === user.id);
  const submitted = Boolean(data.myFeedback);

  return (
    <>
      <PageHeader
        title={data.candidate.name}
        description={`${data.title} · ${data.application.jobTitle} · ${formatDateTime(data.startsAt)}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to={`/candidates/${data.candidate.id}`}>Open profile</Link>
            </Button>
            {data.meetingUrl && (
              <Button asChild>
                <a href={data.meetingUrl} target="_blank" rel="noreferrer">
                  <Video /> Join meeting
                </a>
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader title="Evaluation" description="Score consistently so decisions stay comparable across the panel." />
          <CardContent>
            {submitted ? (
              <div className="space-y-3 text-sm">
                <Badge variant="success">Submitted {formatDateTime(data.myFeedback!.submittedAt)}</Badge>
                <p>
                  Recommendation: <strong>{RECOMMENDATION_LABELS[data.myFeedback!.recommendation]}</strong>
                </p>
                {EVALUATION_CRITERIA.map((c) => (
                  <div key={c.key} className="flex justify-between">
                    <span className="text-muted-foreground">{c.label}</span>
                    <span className="font-semibold">{data.myFeedback!.ratings[c.key]}/5</span>
                  </div>
                ))}
                {data.myFeedback!.strengths && <p>{data.myFeedback!.strengths}</p>}
                {data.myFeedback!.concerns && <p className="text-muted-foreground">{data.myFeedback!.concerns}</p>}
              </div>
            ) : can('interviews:feedback') && mine ? (
              <form className="space-y-5" onSubmit={form.handleSubmit((v) => submit.mutate(v))}>
                {EVALUATION_CRITERIA.map((c) => (
                  <Field key={c.key} label={c.label} error={form.formState.errors.ratings?.[c.key]?.message}>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <label key={n} className={cn('flex size-9 cursor-pointer items-center justify-center rounded-lg border text-sm font-semibold', Number(form.watch(`ratings.${c.key}`)) === n ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-accent')}>
                          <input type="radio" className="sr-only" value={n} {...form.register(`ratings.${c.key}`, { valueAsNumber: true })} />
                          {n}
                        </label>
                      ))}
                    </div>
                  </Field>
                ))}
                <Field label="Overall recommendation" error={form.formState.errors.recommendation?.message}>
                  <div className="grid grid-cols-2 gap-2">
                    {RECOMMENDATIONS.map((r) => (
                      <label key={r} className={cn('cursor-pointer rounded-lg border px-3 py-2 text-sm', form.watch('recommendation') === r ? 'border-primary bg-primary-soft' : 'border-border')}>
                        <input type="radio" className="sr-only" value={r} {...form.register('recommendation')} />
                        {RECOMMENDATION_LABELS[r]}
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="Strengths">
                  <Textarea rows={3} {...form.register('strengths')} />
                </Field>
                <Field label="Concerns">
                  <Textarea rows={3} {...form.register('concerns')} />
                </Field>
                <Field label="Private notes" hint="Visible to recruiters and admins, not other interviewers.">
                  <Textarea rows={3} {...form.register('privateNotes')} />
                </Field>
                <Button type="submit" loading={submit.isPending}>
                  Submit feedback
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">Only assigned interviewers can submit a scorecard for this round.</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Panel" />
            <CardContent>
              <AvatarStack people={data.interviewers.map((p) => ({ name: p.name, avatarUrl: p.avatarUrl }))} size="sm" max={6} />
              <ul className="mt-3 space-y-1 text-sm">
                {data.interviewers.map((p) => (
                  <li key={p.id} className="flex justify-between">
                    <span>{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.feedbackSubmitted ? 'Submitted' : 'Pending'}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          {can('ai:use') && (
            <Card>
              <CardHeader title="Suggested questions" description="Generated for this role and round." />
              <CardContent>
                <Button variant="ai" size="sm" loading={generate.isPending} onClick={() => generate.mutate()}>
                  <Sparkles /> Generate questions
                </Button>
                {questions && (
                  <ol className="mt-4 list-decimal space-y-2 pl-4 text-sm">
                    {questions.map((q) => (
                      <li key={q.question}>
                        <p className="font-medium">{q.question}</p>
                        <p className="text-xs text-muted-foreground">{q.lookFor}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
