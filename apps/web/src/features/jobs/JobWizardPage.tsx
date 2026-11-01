import { zodResolver } from '@hookform/resolvers/zod';
import {
  DEPARTMENTS,
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_LEVELS,
  EXPERIENCE_LEVEL_LABELS,
  STAGE_LABELS,
  STAGE_TYPES,
  WORK_MODES,
  WORK_MODE_LABELS,
  type GeneratedJobDescription,
  type JobDTO,
  type StageType,
} from '@recruitflow/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CircleAlert, ListChecks, Lock, Plus, Rocket, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useFieldArray, useForm, type FieldPath } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { JobStatusBadge, STAGE_STYLES } from '@/components/domain';
import { RichTextEditor } from '@/components/RichTextEditor';
import { SortableList } from '@/components/SortableList';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Segmented, Switch } from '@/components/ui/controls';
import { FullPageSpinner } from '@/components/ui/feedback';
import { Field, Input, NativeSelect } from '@/components/ui/input';
import { QueryErrorPage } from '@/features/errors/ErrorPages';
import { useDocumentTitle, useUnsavedChanges } from '@/hooks';
import { api, isApiError } from '@/lib/api';
import { applyServerErrors } from '@/lib/forms';
import { cn, formatSalaryRange, stripHtml } from '@/lib/utils';
import { useAuth, usePermission } from '@/stores/auth';
import { AiJobGenerator } from './AiJobGenerator';
import { DESCRIPTION_SECTIONS, STEPS, emptyJob, jobFormSchema, jobToForm, type JobFormValues } from './jobForm';
import { JobMeta, JobPostingBody } from './JobPostingView';

const LAKH = 100_000;
const toLakhs = (v: number | null | undefined) => (v == null ? '' : String(+(v / LAKH).toFixed(2)));
const fromLakhs = (s: string) => (s.trim() === '' ? null : Math.round(Number(s) * LAKH));
const optionalInt = (v: string) => (v === '' ? null : Number(v));

function LakhInput({ value, onChange, onBlur, ...props }: { value: number | null | undefined; onChange: (v: number | null) => void; onBlur: () => void; placeholder: string; 'aria-label': string; 'aria-invalid'?: boolean }) {
  const [text, setText] = useState(toLakhs(value));
  useEffect(() => {
    if (fromLakhs(text) !== (value ?? null)) setText(toLakhs(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only resync when the form value changes externally
  }, [value]);
  return (
    <Input
      type="number"
      min={0}
      step="0.5"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(fromLakhs(e.target.value));
      }}
      onBlur={onBlur}
      {...props}
    />
  );
}

function Stepper({ current, maxVisited, onGo }: { current: number; maxVisited: number; onGo: (i: number) => void }) {
  return (
    <ol className="scrollbar-thin flex items-center gap-1 overflow-x-auto pb-1">
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const reachable = i <= maxVisited;
        return (
          <li key={s.key} className="flex items-center">
            <button
              type="button"
              disabled={!reachable}
              onClick={() => onGo(i)}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium transition',
                active ? 'bg-primary text-primary-foreground shadow-sm' : done ? 'text-foreground hover:bg-accent' : 'text-muted-foreground',
                !reachable && 'cursor-not-allowed opacity-60',
              )}
            >
              <span className={cn('flex size-5 items-center justify-center rounded-full text-[11px] font-bold', active ? 'bg-white/20' : done ? 'bg-emerald-500 text-white' : 'bg-muted')}>{done ? <Check className="size-3" strokeWidth={3} /> : i + 1}</span>
              {s.label}
            </button>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-4 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

export function JobWizardPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const can = usePermission();
  const company = useAuth((s) => s.user?.company);
  const [step, setStep] = useState(0);
  const [maxVisited, setMaxVisited] = useState(editing ? STEPS.length - 1 : 0);
  const [done, setDone] = useState(false);

  const existing = useQuery({ queryKey: ['job', id], queryFn: () => api.get<JobDTO>(`/jobs/${id}`), enabled: editing });
  const workflow = useQuery({ queryKey: ['workflow'], queryFn: () => api.get<{ name: string; type: StageType }[]>('/company/workflow'), enabled: !editing, staleTime: 5 * 60_000 });
  useDocumentTitle(editing ? `Edit ${existing.data?.title ?? 'job'}` : 'Create job');

  const form = useForm<JobFormValues>({ resolver: zodResolver(jobFormSchema) as never, defaultValues: emptyJob(), mode: 'onTouched' });
  const { register, control, formState, watch, setValue, getValues, trigger, reset } = form;
  const { errors, isDirty } = formState;
  const skills = useFieldArray({ control, name: 'skills' });
  const stages = useFieldArray({ control, name: 'stages', keyName: 'key' });
  const questions = useFieldArray({ control, name: 'questions', keyName: 'key' });

  useEffect(() => {
    if (existing.data) reset(jobToForm(existing.data));
  }, [existing.data, reset]);
  useEffect(() => {
    if (!editing && workflow.data?.length && !isDirty) reset(emptyJob(workflow.data));
  }, [editing, workflow.data, isDirty, reset]);

  useUnsavedChanges(isDirty && !done);

  const values = watch();

  const save = useMutation({
    mutationFn: async ({ publish }: { publish: boolean }) => {
      const body = getValues();
      const job = editing ? await api.patch<JobDTO>(`/jobs/${id}`, body) : await api.post<JobDTO>('/jobs', body);
      if (publish && job.status !== 'PUBLISHED') return api.post<JobDTO>(`/jobs/${job.id}/publish`);
      return job;
    },
    onSuccess: (job, { publish }) => {
      setDone(true);
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['job', job.id] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(publish ? 'Job published 🎉' : editing ? 'Changes saved' : 'Draft saved', { description: publish ? 'It is live on your careers page and accepting applications.' : undefined });
      setTimeout(() => navigate(`/jobs/${job.id}`), 0);
    },
    onError: (err) => {
      if (isApiError(err) && err.code === 'STAGE_IN_USE') {
        setStep(3);
        toast.error(err.message);
        return;
      }
      if (!applyServerErrors(err, form.setError, { toastFallback: false })) toast.error(isApiError(err) ? err.message : 'Could not save the job');
      else toast.error('Some fields need attention');
    },
  });

  const go = (i: number) => {
    setStep(i);
    setMaxVisited((m) => Math.max(m, i));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const next = async () => {
    const fields = STEPS[step].fields as readonly FieldPath<JobFormValues>[];
    const valid = fields.length ? await trigger(fields as FieldPath<JobFormValues>[], { shouldFocus: true }) : true;
    if (step === 1 && !stripHtml(getValues('description.about'))) {
      form.setError('description.about', { message: 'Add a short description of the role' });
      return;
    }
    if (valid) go(step + 1);
  };

  const applyDraft = (draft: GeneratedJobDescription, advance: boolean) => {
    setValue('description', draft.description, { shouldDirty: true });
    if (!getValues('title')) setValue('title', draft.title, { shouldDirty: true });
    const existingSkills = new Set(getValues('skills').map((s) => s.name.toLowerCase()));
    const added = draft.skills.filter((s) => !existingSkills.has(s.name.toLowerCase()));
    if (added.length) skills.append(added);
    form.clearErrors('description');
    toast.success(advance ? 'AI draft accepted' : 'Draft added — edit it below', { description: added.length ? `${added.length} suggested skills were added to Requirements.` : undefined });
    if (advance) go(2);
  };

  if (editing && existing.isLoading) return <FullPageSpinner />;
  if (editing && existing.isError) return <QueryErrorPage error={existing.error} />;

  const stageTypes = values.stages.map((s) => s.type);
  const status = existing.data?.status;

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link to={editing ? `/jobs/${id}` : '/jobs'} aria-label="Back">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-tight">{editing ? `Edit: ${existing.data?.title}` : 'Create a new job'}</h1>
          <p className="text-sm text-muted-foreground">{editing ? 'Changes to published jobs go live immediately.' : 'Seven quick steps — you can save a draft at any time.'}</p>
        </div>
        {status && <JobStatusBadge status={status} />}
        {step < 6 && (
          <Button variant="outline" onClick={() => save.mutate({ publish: false })} loading={save.isPending && !save.variables?.publish} disabled={!values.title}>
            <Save /> {editing ? 'Save' : 'Save draft'}
          </Button>
        )}
      </div>

      <Card className="mb-6 px-3 py-2.5">
        <Stepper current={step} maxVisited={maxVisited} onGo={go} />
      </Card>

      <Card>
        <CardContent className="p-6 sm:p-8">
          {step === 0 && (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Job title" htmlFor="title" required error={errors.title?.message} className="sm:col-span-2">
                <Input id="title" placeholder="e.g. Senior React Developer" autoFocus aria-invalid={!!errors.title} {...register('title')} />
              </Field>
              <Field label="Department" htmlFor="department" required error={errors.department?.message}>
                <NativeSelect id="department" {...register('department')}>
                  {DEPARTMENTS.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Employment type" htmlFor="employmentType" required>
                <NativeSelect id="employmentType" {...register('employmentType')}>
                  {EMPLOYMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {EMPLOYMENT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Location" htmlFor="location" required error={errors.location?.message}>
                <Input id="location" placeholder="e.g. Bangalore" aria-invalid={!!errors.location} {...register('location')} />
              </Field>
              <Field label="Work mode" required>
                <Controller control={control} name="workMode" render={({ field }) => <Segmented value={field.value} onChange={field.onChange} options={WORK_MODES.map((m) => ({ value: m, label: WORK_MODE_LABELS[m] }))} />} />
              </Field>
              <Field label="Experience level" htmlFor="experienceLevel" required>
                <NativeSelect id="experienceLevel" {...register('experienceLevel')}>
                  {EXPERIENCE_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {EXPERIENCE_LEVEL_LABELS[l]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Openings" htmlFor="openings" required error={errors.openings?.message}>
                <Input id="openings" type="number" min={1} max={100} {...register('openings', { valueAsNumber: true })} />
              </Field>
              <Field label="Salary range (₹ lakhs per annum)" error={errors.salaryMax?.message ?? errors.salaryMin?.message} hint={formatSalaryRange(values.salaryMin ?? null, values.salaryMax ?? null) ?? 'Optional — shown on the job post'} className="sm:col-span-2">
                <div className="flex items-center gap-2">
                  <Controller control={control} name="salaryMin" render={({ field }) => <LakhInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} placeholder="Min, e.g. 18" aria-label="Minimum salary in lakhs" />} />
                  <span className="text-muted-foreground">–</span>
                  <Controller control={control} name="salaryMax" render={({ field }) => <LakhInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} placeholder="Max, e.g. 32" aria-label="Maximum salary in lakhs" aria-invalid={!!errors.salaryMax} />} />
                </div>
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              {can('ai:use') && <AiJobGenerator values={values} onApply={applyDraft} />}
              {DESCRIPTION_SECTIONS.map((s) => (
                <Field key={s.key} label={s.label} required={s.key === 'about'} error={errors.description?.[s.key]?.message}>
                  <Controller control={control} name={`description.${s.key}`} render={({ field }) => <RichTextEditor value={field.value} onChange={field.onChange} placeholder={s.placeholder} invalid={!!errors.description?.[s.key]} minHeight={s.key === 'about' ? 120 : 100} />} />
                </Field>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Minimum experience (years)" htmlFor="experienceMin" error={errors.experienceMin?.message}>
                  <Input id="experienceMin" type="number" min={0} max={40} {...register('experienceMin', { setValueAs: optionalInt })} />
                </Field>
                <Field label="Maximum experience (years)" htmlFor="experienceMax" error={errors.experienceMax?.message}>
                  <Input id="experienceMax" type="number" min={0} max={40} {...register('experienceMax', { setValueAs: optionalInt })} />
                </Field>
              </div>
              <div>
                <div className="mb-3 flex items-end justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">Skills</h3>
                    <p className="text-xs text-muted-foreground">Required skills weigh more in AI matching. Years are optional.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => skills.append({ name: '', years: null, importance: 'REQUIRED' })}>
                    <Plus /> Add skill
                  </Button>
                </div>
                {skills.fields.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">No skills yet. Add the skills candidates must have, or generate them with AI in the Description step.</div>
                ) : (
                  <div className="space-y-2">
                    <div className="hidden grid-cols-[1fr_120px_180px_36px] gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
                      <span>Skill</span>
                      <span>Min. years</span>
                      <span>Importance</span>
                    </div>
                    {skills.fields.map((f, i) => (
                      <div key={f.id} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_120px_180px_36px]">
                        <Input placeholder="e.g. React" aria-label={`Skill ${i + 1}`} aria-invalid={!!errors.skills?.[i]?.name} {...register(`skills.${i}.name`)} />
                        <Input type="number" min={0} max={30} placeholder="Any" aria-label="Minimum years" className="max-sm:hidden" {...register(`skills.${i}.years`, { setValueAs: optionalInt })} />
                        <Controller
                          control={control}
                          name={`skills.${i}.importance`}
                          render={({ field }) => (
                            <Segmented
                              value={field.value}
                              onChange={field.onChange}
                              className="max-sm:hidden"
                              options={[
                                { value: 'REQUIRED', label: 'Required' },
                                { value: 'PREFERRED', label: 'Preferred' },
                              ]}
                            />
                          )}
                        />
                        <Button type="button" variant="ghost" size="icon" onClick={() => skills.remove(i)} aria-label="Remove skill">
                          <Trash2 className="text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold">Hiring stages</h3>
                  <p className="text-xs text-muted-foreground">Drag to reorder. Every workflow needs an Applied and a Hired stage. Stage type drives analytics and the candidate-facing status.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => stages.insert(Math.max(1, stages.fields.length - 2), { name: 'New stage', type: 'INTERVIEW' })}>
                  <Plus /> Add stage
                </Button>
              </div>
              <SortableList
                items={stages.fields.map((f) => ({ ...f, id: f.key }))}
                onMove={stages.move}
                renderItem={(f, i, handle) => (
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2 pr-3">
                    {handle}
                    <span className={cn('size-2.5 shrink-0 rounded-full', STAGE_STYLES[values.stages[i]?.type ?? 'APPLIED'].dot)} />
                    <span className="w-6 text-center text-xs font-semibold text-muted-foreground">{i + 1}</span>
                    <Input className="flex-1" aria-label={`Stage ${i + 1} name`} aria-invalid={!!errors.stages?.[i]?.name} {...register(`stages.${i}.name`)} />
                    <NativeSelect className="w-40" aria-label="Stage type" {...register(`stages.${i}.type`)}>
                      {STAGE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {STAGE_LABELS[t]}
                        </option>
                      ))}
                    </NativeSelect>
                    <Button type="button" variant="ghost" size="icon-sm" disabled={stages.fields.length <= 2} onClick={() => stages.remove(i)} aria-label={`Remove ${f.name}`}>
                      <Trash2 className="text-muted-foreground" />
                    </Button>
                  </div>
                )}
              />
              {(errors.stages?.root?.message || errors.stages?.message) && (
                <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-destructive">
                  <CircleAlert className="size-4" /> {errors.stages.root?.message ?? errors.stages.message}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {(['APPLIED', 'HIRED'] as const).map((t) => (
                  <Badge key={t} variant={stageTypes.includes(t) ? 'success' : 'danger'}>
                    {stageTypes.includes(t) ? <Check /> : <CircleAlert />} {STAGE_LABELS[t]} stage
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold">Always collected</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {['Full name', 'Email', 'Phone', 'Resume (PDF/DOCX)', 'Years of experience', 'LinkedIn / GitHub / Portfolio', 'Expected salary', 'Notice period'].map((f) => (
                    <span key={f} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
                      <Lock className="size-3" /> {f}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-3 flex items-end justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">Screening questions</h3>
                    <p className="text-xs text-muted-foreground">Optional questions shown on the application form.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" disabled={questions.fields.length >= 15} onClick={() => questions.append({ id: `q_${crypto.randomUUID().slice(0, 8)}`, label: '', type: 'SHORT_TEXT', required: false })}>
                    <Plus /> Add question
                  </Button>
                </div>
                {questions.fields.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    <ListChecks className="mx-auto mb-2 size-5" />
                    No screening questions. Add questions like “Why do you want to join us?” or “Are you open to relocating?”
                  </div>
                ) : (
                  <div className="space-y-3">
                    {questions.fields.map((q, i) => (
                      <div key={q.key} className="rounded-xl border border-border p-3">
                        <div className="flex gap-2">
                          <Input className="flex-1" placeholder="Question" aria-label={`Question ${i + 1}`} aria-invalid={!!errors.questions?.[i]?.label} {...register(`questions.${i}.label`)} />
                          <NativeSelect className="w-36" aria-label="Answer type" {...register(`questions.${i}.type`)}>
                            <option value="SHORT_TEXT">Short answer</option>
                            <option value="LONG_TEXT">Paragraph</option>
                            <option value="YES_NO">Yes / No</option>
                          </NativeSelect>
                          <Button type="button" variant="ghost" size="icon" onClick={() => questions.remove(i)} aria-label="Remove question">
                            <Trash2 className="text-muted-foreground" />
                          </Button>
                        </div>
                        <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <Controller control={control} name={`questions.${i}.required`} render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
                          Required
                        </label>
                        {errors.questions?.[i]?.label && <p className="mt-1 text-xs text-destructive">{errors.questions[i]!.label!.message}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="mx-auto max-w-3xl">
              <p className="mb-6 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">This is how candidates will see the job on your careers page.</p>
              <p className="text-sm font-medium text-primary">
                {company?.name} · {values.department}
              </p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight">{values.title || 'Untitled job'}</h2>
              <div className="mt-3">
                <JobMeta job={values} />
              </div>
              <hr className="my-8 border-border" />
              <JobPostingBody job={values} />
              {values.questions.length > 0 && (
                <section className="mt-8">
                  <h2 className="mb-3 text-lg font-semibold">Application questions</h2>
                  <ol className="list-decimal space-y-1 pl-5 text-sm">
                    {values.questions.map((q) => (
                      <li key={q.id}>
                        {q.label} {q.required && <span className="text-destructive">*</span>}
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="mx-auto max-w-xl text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                <Rocket className="size-6" />
              </div>
              <h2 className="mt-4 text-xl font-semibold">{status === 'PUBLISHED' ? 'Save your changes' : 'Ready to publish?'}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{status === 'PUBLISHED' ? 'This job is live — changes apply immediately.' : 'Publishing makes the job live on your careers page and starts accepting applications.'}</p>
              <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm">
                {[
                  [Boolean(values.title), 'Title and basics'],
                  [Boolean(stripHtml(values.description.about)), 'Job description'],
                  [values.skills.length > 0, `${values.skills.length} skills`],
                  [stageTypes.includes('APPLIED') && stageTypes.includes('HIRED'), `${values.stages.length}-stage interview process`],
                  [true, `${values.questions.length} screening questions`],
                ].map(([ok, label]) => (
                  <li key={String(label)} className="flex items-center gap-2">
                    {ok ? <CheckCircle2 className="size-4 text-emerald-500" /> : <CircleAlert className="size-4 text-amber-500" />}
                    {label}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {status === 'PUBLISHED' ? (
                  <Button size="lg" onClick={() => save.mutate({ publish: false })} loading={save.isPending}>
                    <Save /> Save changes
                  </Button>
                ) : (
                  <>
                    <Button size="lg" variant="outline" onClick={() => save.mutate({ publish: false })} loading={save.isPending && !save.variables?.publish}>
                      <Save /> Save as draft
                    </Button>
                    {can('jobs:publish') && (
                      <Button size="lg" onClick={() => save.mutate({ publish: true })} loading={save.isPending && save.variables?.publish}>
                        <Rocket /> Publish job
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>

        {step < 6 && (
          <div className="flex items-center justify-between border-t border-border px-6 py-4 sm:px-8">
            <Button variant="ghost" onClick={() => go(step - 1)} disabled={step === 0}>
              <ArrowLeft /> Back
            </Button>
            <span className="text-xs text-muted-foreground">
              Step {step + 1} of {STEPS.length}
            </span>
            <Button onClick={next}>
              {step === 5 ? 'Continue to publish' : 'Continue'} <ArrowRight />
            </Button>
          </div>
        )}
      </Card>
    </form>
  );
}
