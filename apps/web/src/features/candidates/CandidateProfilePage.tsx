import {
  STAGE_TYPES,
  STAGE_LABELS,
  type CandidateDTO,
  type CandidateSummaryResult,
  type FeedbackDTO,
  type InterviewQuestion,
  type MatchResult,
  type NoteDTO,
  type Recommendation,
} from '@recruitflow/shared';
import { EVALUATION_CRITERIA, RECOMMENDATION_LABELS } from '@recruitflow/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, ExternalLink, Github, Linkedin, Mail, MapPin, Phone, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { AiBadge, MatchScore, ScoreRing, StageBadge } from '@/components/domain';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/controls';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { EmptyState, PageHeader } from '@/components/ui/feedback';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Skeleton, SkeletonRows } from '@/components/ui/skeleton';
import { QueryErrorPage } from '@/features/errors/ErrorPages';
import { ScheduleInterviewDialog } from '@/features/interviews/ScheduleInterviewDialog';
import { useDocumentTitle } from '@/hooks';
import { api } from '@/lib/api';
import { formatDate, formatDateTime, formatSalaryRange, fullName, timeAgo } from '@/lib/utils';
import { usePermission } from '@/stores/auth';

interface Insights {
  application: { id: string; jobId: string; jobTitle: string } | null;
  applications: { id: string; jobId: string; jobTitle: string; matchScore: number | null }[];
  match: MatchResult | null;
  summary: CandidateSummaryResult;
}

export function CandidateProfilePage() {
  const { id = '' } = useParams();
  const can = usePermission();
  const qc = useQueryClient();
  const [tab, setTab] = useState('overview');
  const [schedule, setSchedule] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const { data: candidate, isLoading, isError, error } = useQuery({
    queryKey: ['candidate', id],
    queryFn: () => api.get<CandidateDTO>(`/candidates/${id}`),
  });
  useDocumentTitle(candidate ? fullName(candidate) : 'Candidate');

  const insights = useQuery({
    queryKey: ['insights', id],
    queryFn: () => api.get<Insights>(`/ai/candidates/${id}/insights`),
    enabled: Boolean(candidate) && can('ai:use'),
  });

  const move = useMutation({
    mutationFn: ({ applicationId, stageType }: { applicationId: string; stageType: string }) => api.patch(`/applications/${applicationId}/stage`, { stageType }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidate', id] });
      qc.invalidateQueries({ queryKey: ['pipeline'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    meta: { success: 'Candidate moved' },
  });

  if (isError) return <QueryErrorPage error={error} />;
  if (isLoading || !candidate) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <SkeletonRows rows={8} />
      </div>
    );
  }

  const latest = candidate.applications[0];
  const name = fullName(candidate);

  return (
    <>
      <PageHeader
        eyebrow={latest ? <StageBadge type={latest.stageType} name={latest.stageName} /> : undefined}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={name} src={candidate.avatarUrl} size="lg" />
            {name}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>{candidate.headline ?? latest?.jobTitle ?? 'Candidate'}</span>
            {candidate.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" /> {candidate.location}
              </span>
            )}
            {candidate.email && (
              <a href={`mailto:${candidate.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                <Mail className="size-3.5" /> {candidate.email}
              </a>
            )}
            {candidate.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3.5" /> {candidate.phone}
              </span>
            )}
          </span>
        }
        actions={
          <>
            {latest && can('applications:move') && (
              <NativeSelect defaultValue="" className="w-44" onChange={(e) => e.target.value && move.mutate({ applicationId: latest.id, stageType: e.target.value })}>
                <option value="">Move stage</option>
                {STAGE_TYPES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABELS[s]}
                  </option>
                ))}
              </NativeSelect>
            )}
            {latest && can('interviews:create') && (
              <Button variant="outline" onClick={() => setSchedule(true)}>
                <CalendarPlus /> Schedule interview
              </Button>
            )}
            {can('messages:send') && (
              <Button onClick={() => setEmailOpen(true)}>
                <Mail /> Send email
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="resume">Resume</TabsTrigger>
              <TabsTrigger value="applications" count={candidate.applications.length}>
                Applications
              </TabsTrigger>
              <TabsTrigger value="interviews">Interviews</TabsTrigger>
              <TabsTrigger value="feedback">Feedback</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              {can('candidates:notes') && <TabsTrigger value="notes">Notes</TabsTrigger>}
            </TabsList>
            <TabsContent value="overview" className="mt-6 space-y-6">
              {candidate.summary && (
                <Card>
                  <CardHeader title="Professional summary" />
                  <CardContent className="text-sm leading-relaxed text-muted-foreground">{candidate.summary}</CardContent>
                </Card>
              )}
              <Card>
                <CardHeader title="Skills" />
                <CardContent className="flex flex-wrap gap-2">
                  {candidate.skillDetails.length === 0 && <p className="text-sm text-muted-foreground">No skills extracted yet.</p>}
                  {candidate.skillDetails.map((s) => (
                    <Badge key={s.id} variant="secondary">
                      {s.name}
                      {s.years != null ? ` · ${s.years}y` : ''}
                    </Badge>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader title="Experience" />
                <CardContent className="space-y-4">
                  {candidate.experiences.length === 0 && <EmptyState compact icon={Sparkles} title="No experience parsed yet" />}
                  {candidate.experiences.map((e) => (
                    <div key={e.id}>
                      <p className="font-medium">{e.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {e.company} · {e.startDate}
                        {e.endDate ? ` – ${e.endDate}` : ' – Present'}
                      </p>
                      {e.description && <p className="mt-1 text-sm text-muted-foreground">{e.description}</p>}
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader title="Education" />
                <CardContent className="space-y-3">
                  {candidate.educations.map((e) => (
                    <div key={e.id}>
                      <p className="font-medium">{e.degree}</p>
                      <p className="text-sm text-muted-foreground">
                        {e.institution}
                        {e.field ? ` · ${e.field}` : ''}
                        {e.endYear ? ` · ${e.endYear}` : ''}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
              {candidate.projects.length > 0 && (
                <Card>
                  <CardHeader title="Projects" />
                  <CardContent className="space-y-3">
                    {candidate.projects.map((p) => (
                      <div key={p.name}>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-sm text-muted-foreground">{p.description}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {p.technologies.map((t) => (
                            <Badge key={t} variant="outline">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            <TabsContent value="resume" className="mt-6">
              <Card>
                <CardHeader title={candidate.resume?.filename ?? 'Resume'} description={candidate.parseStatus === 'COMPLETE' ? 'Parsed and stored as structured data. Original file is not kept in the database.' : `Parse status: ${candidate.parseStatus}`} />
                <CardContent>
                  {candidate.resumeText ? <pre className="max-h-[640px] overflow-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted-foreground">{candidate.resumeText}</pre> : <p className="text-sm text-muted-foreground">Resume text will appear once parsing finishes.</p>}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="applications" className="mt-6">
              <Card className="divide-y divide-border">
                {candidate.applications.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <Link to={`/jobs/${a.jobId}`} className="font-medium hover:text-primary">
                        {a.jobTitle}
                      </Link>
                      <p className="text-xs text-muted-foreground">Applied {formatDate(a.appliedAt)}</p>
                    </div>
                    <StageBadge type={a.stageType} name={a.stageName} />
                    <MatchScore score={a.matchScore} />
                  </div>
                ))}
              </Card>
            </TabsContent>
            <TabsContent value="interviews" className="mt-6">
              <InterviewsTab candidateId={id} />
            </TabsContent>
            <TabsContent value="feedback" className="mt-6">
              <FeedbackTab candidateId={id} />
            </TabsContent>
            <TabsContent value="activity" className="mt-6">
              <ActivityTab candidateId={id} />
            </TabsContent>
            <TabsContent value="notes" className="mt-6">
              <NotesTab candidateId={id} />
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <Card>
            <CardContent className="space-y-3 text-sm">
              <Row label="Email" value={candidate.email} />
              <Row label="Phone" value={candidate.phone} />
              <Row label="Experience" value={candidate.experienceYears != null ? `${candidate.experienceYears} years` : '—'} />
              <Row label="Expected CTC" value={formatSalaryRange(candidate.expectedSalary, candidate.expectedSalary) ?? '—'} />
              <Row label="Notice" value={candidate.noticePeriodDays != null ? `${candidate.noticePeriodDays} days` : '—'} />
              <div className="flex gap-2 pt-1">
                {candidate.linkedinUrl && (
                  <Button size="icon-sm" variant="outline" asChild>
                    <a href={candidate.linkedinUrl} target="_blank" rel="noreferrer" aria-label="LinkedIn">
                      <Linkedin />
                    </a>
                  </Button>
                )}
                {candidate.githubUrl && (
                  <Button size="icon-sm" variant="outline" asChild>
                    <a href={candidate.githubUrl} target="_blank" rel="noreferrer" aria-label="GitHub">
                      <Github />
                    </a>
                  </Button>
                )}
                {candidate.portfolioUrl && (
                  <Button size="icon-sm" variant="outline" asChild>
                    <a href={candidate.portfolioUrl} target="_blank" rel="noreferrer" aria-label="Portfolio">
                      <ExternalLink />
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          {can('ai:use') && <AiWorkspace insights={insights.data} loading={insights.isLoading} onRefresh={() => insights.refetch()} jobTitle={latest?.jobTitle} />}
        </aside>
      </div>

      {latest && <ScheduleInterviewDialog open={schedule} onOpenChange={setSchedule} applicationId={latest.id} candidateLabel={name} />}
      <ComposeEmail open={emailOpen} onOpenChange={setEmailOpen} candidate={candidate} />
    </>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium">{value || '—'}</span>
    </div>
  );
}

function AiWorkspace({ insights, loading, onRefresh, jobTitle }: { insights?: Insights; loading: boolean; onRefresh: () => void; jobTitle?: string }) {
  const [questions, setQuestions] = useState<InterviewQuestion[] | null>(null);
  const generate = useMutation({
    mutationFn: () =>
      api.post<InterviewQuestion[]>('/ai/interview-questions', {
        role: jobTitle ?? 'Software Engineer',
        round: 'TECHNICAL',
        difficulty: 'MEDIUM',
        count: 6,
        jobId: insights?.application?.jobId,
        candidateId: insights?.application ? undefined : undefined,
      }),
    onSuccess: setQuestions,
  });

  if (loading || !insights) {
    return (
      <Card>
        <CardContent>
          <SkeletonRows rows={6} />
        </CardContent>
      </Card>
    );
  }

  const match = insights.match;
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <AiBadge>AI Hiring Insights</AiBadge>
          </span>
        }
        description="Assistive signal — not a hiring decision."
        action={
          <Button size="xs" variant="ghost" onClick={onRefresh}>
            Refresh
          </Button>
        }
      />
      <CardContent className="space-y-4">
        {match && (
          <div className="flex items-center gap-4">
            <ScoreRing score={match.overall} />
            <div className="flex-1 space-y-1.5 text-xs">
              {Object.entries(match.breakdown).map(([k, v]) => (
                <div key={k}>
                  <div className="flex justify-between capitalize text-muted-foreground">
                    <span>{k}</span>
                    <span className="tabular-nums">{v}%</span>
                  </div>
                  <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${v}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div>
          <p className="text-[13px] font-semibold">{insights.summary.headline}</p>
          <p className="mt-1 text-sm text-muted-foreground">{insights.summary.summary}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Strong evidence</p>
          <ul className="mt-1 space-y-1 text-sm">
            {(match?.strongMatches ?? []).slice(0, 5).map((m) => (
              <li key={m.skill}>✓ {m.skill}{m.evidence ? ` — ${m.evidence}` : ''}</li>
            ))}
            {insights.summary.strengths.slice(0, 4).map((s) => (
              <li key={s}>• {s}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Areas to verify</p>
          <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
            {(match?.missing ?? []).slice(0, 4).map((m) => (
              <li key={m.skill}>△ {m.skill}</li>
            ))}
            {insights.summary.gaps.map((g) => (
              <li key={g}>△ {g}</li>
            ))}
          </ul>
        </div>
        <Button variant="ai" size="sm" className="w-full" loading={generate.isPending} onClick={() => generate.mutate()}>
          <Sparkles /> Generate questions
        </Button>
        {questions && (
          <ol className="list-decimal space-y-2 pl-4 text-sm">
            {questions.map((q) => (
              <li key={q.question}>
                <p className="font-medium">{q.question}</p>
                <p className="text-xs text-muted-foreground">Look for: {q.lookFor}</p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function NotesTab({ candidateId }: { candidateId: string }) {
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['notes', candidateId], queryFn: () => api.get<NoteDTO[]>(`/candidates/${candidateId}/notes`) });
  const add = useMutation({
    mutationFn: () => api.post(`/candidates/${candidateId}/notes`, { body }),
    onSuccess: () => {
      setBody('');
      qc.invalidateQueries({ queryKey: ['notes', candidateId] });
    },
    meta: { success: 'Note added' },
  });
  return (
    <Card>
      <CardContent className="space-y-4">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Private note — candidates never see this." rows={3} />
        <Button size="sm" disabled={!body.trim()} loading={add.isPending} onClick={() => add.mutate()}>
          Add note
        </Button>
        {isLoading ? <SkeletonRows rows={3} /> : (data ?? []).map((n) => (
          <div key={n.id} className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Avatar name={n.author.name} src={n.author.avatarUrl} size="xs" />
              {n.author.name} · {timeAgo(n.createdAt)}
            </div>
            <p className="mt-2 text-sm whitespace-pre-wrap">{n.body}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function FeedbackTab({ candidateId }: { candidateId: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['candidate-feedback', candidateId], queryFn: () => api.get<FeedbackDTO[]>(`/candidates/${candidateId}/feedback`) });
  if (isLoading) return <SkeletonRows rows={4} />;
  if (!data?.length) return <EmptyState compact icon={Sparkles} title="No feedback yet" />;
  return (
    <div className="space-y-3">
      {data.map((f) => (
        <Card key={f.id}>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar name={f.interviewer.name} src={f.interviewer.avatarUrl} size="sm" />
                <div>
                  <p className="text-sm font-medium">{f.interviewer.name}</p>
                  <p className="text-xs text-muted-foreground">{f.interviewTitle}</p>
                </div>
              </div>
              <Badge variant={f.recommendation === 'NO' ? 'danger' : f.recommendation === 'STRONG_YES' ? 'success' : 'secondary'}>{RECOMMENDATION_LABELS[f.recommendation as Recommendation]}</Badge>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {EVALUATION_CRITERIA.map((c) => (
                <div key={c.key} className="flex justify-between">
                  <span className="text-muted-foreground">{c.label}</span>
                  <span className="font-semibold">{f.ratings[c.key] ?? '—'}/5</span>
                </div>
              ))}
            </div>
            {f.strengths && <p className="mt-3 text-sm">{f.strengths}</p>}
            {f.concerns && <p className="mt-1 text-sm text-muted-foreground">{f.concerns}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ActivityTab({ candidateId }: { candidateId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['timeline', candidateId],
    queryFn: () => api.get<{ id: string; type: string; title: string; description: string | null; at: string; actor: string | null }[]>(`/candidates/${candidateId}/timeline`),
  });
  if (isLoading) return <SkeletonRows rows={6} />;
  return (
    <ol className="relative space-y-4 border-l border-border pl-6">
      {(data ?? []).map((item) => (
        <li key={item.id}>
          <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full bg-primary" />
          <p className="text-sm font-medium">{item.title}</p>
          <p className="text-xs text-muted-foreground">
            {item.actor ? `${item.actor} · ` : ''}
            {formatDateTime(item.at)}
          </p>
          {item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}
        </li>
      ))}
    </ol>
  );
}

function InterviewsTab({ candidateId }: { candidateId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['interviews', { candidateId }],
    queryFn: () => api.get<import('@recruitflow/shared').InterviewDTO[]>('/interviews', { candidateId }),
  });
  if (isLoading) return <SkeletonRows rows={3} />;
  if (!data?.length) return <EmptyState compact icon={CalendarPlus} title="No interviews scheduled" />;
  return (
    <Card className="divide-y divide-border">
      {data.map((i) => (
        <Link key={i.id} to={`/interviews/${i.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-accent/40">
          <div>
            <p className="font-medium">{i.title}</p>
            <p className="text-xs text-muted-foreground">{formatDateTime(i.startsAt)}</p>
          </div>
          <Badge>{i.status}</Badge>
        </Link>
      ))}
    </Card>
  );
}

function ComposeEmail({ open, onOpenChange, candidate }: { open: boolean; onOpenChange: (o: boolean) => void; candidate: CandidateDTO }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [templateKey, setTemplateKey] = useState<string>('');
  const templates = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => api.get<{ key: string; name: string; subject: string; body: string }[]>('/company/email-templates'),
    enabled: open,
  });
  const send = useMutation({
    mutationFn: () => api.post('/messages', { candidateId: candidate.id, subject, body, templateKey: templateKey || undefined }),
    onSuccess: () => onOpenChange(false),
    meta: { success: 'Email queued' },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        title={`Email ${fullName(candidate)}`}
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button loading={send.isPending} disabled={!subject.trim() || !body.trim()} onClick={() => send.mutate()}>
              Send
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Template">
            <NativeSelect
              value={templateKey}
              onChange={(e) => {
                setTemplateKey(e.target.value);
                const t = templates.data?.find((x) => x.key === e.target.value);
                if (t) {
                  setSubject(t.subject);
                  setBody(t.body);
                }
              }}
            >
              <option value="">Blank</option>
              {(templates.data ?? []).map((t) => (
                <option key={t.key} value={t.key}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="To">
            <Input value={candidate.email} disabled />
          </Field>
          <Field label="Subject">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label="Message" hint="Variables like {{firstName}} and {{jobTitle}} are filled in on the server.">
            <Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
        </div>
      </DialogContent>
    </Dialog>
  );
}
