import { zodResolver } from '@hookform/resolvers/zod';
import { RESUME_UPLOAD, publicApplySchema, type PublicApplyInput, type PublicJobDTO } from '@recruitflow/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FileText, Upload } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { Logo } from '@/components/domain';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input';
import { QueryErrorPage } from '@/features/errors/ErrorPages';
import { useDocumentTitle } from '@/hooks';
import { api, errorMessage } from '@/lib/api';
import { applyServerErrors } from '@/lib/forms';
import { uploadResumePublic } from '@/lib/upload';
import { cn, formatBytes } from '@/lib/utils';

export function ApplyPage() {
  const { companySlug = '', jobSlug = '' } = useParams();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: job, isError, error } = useQuery({
    queryKey: ['public-job', jobSlug],
    queryFn: () => api.get<PublicJobDTO>(`/public/jobs/${jobSlug}`),
  });
  useDocumentTitle(job ? `Apply · ${job.title}` : 'Apply');

  const form = useForm<PublicApplyInput>({
    resolver: zodResolver(publicApplySchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      resumeFileId: '',
      linkedinUrl: '',
      githubUrl: '',
      portfolioUrl: '',
      currentCompany: '',
      experienceYears: 0,
      expectedSalary: null,
      noticePeriodDays: null,
      answers: {},
      source: 'CAREERS_PAGE',
    },
  });

  const submit = useMutation({
    mutationFn: async (values: PublicApplyInput) => {
      if (!file) throw new Error('Please upload your resume');
      setUploading(true);
      try {
        const resumeFileId = await uploadResumePublic(jobSlug, file);
        return api.post<{ applicationId: string; trackingToken: string }>(`/public/jobs/${jobSlug}/apply`, { ...values, resumeFileId, answers: values.answers ?? {} });
      } finally {
        setUploading(false);
      }
    },
    onSuccess: (res) => navigate(`/track/${res.trackingToken}`),
    onError: (err) => applyServerErrors(err, form.setError, { toastFallback: true }),
  });

  if (isError) return <QueryErrorPage error={error} />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <Link to={`/careers/${companySlug}/${jobSlug}`} className="flex items-center gap-2">
            <Logo />
            <span className="hidden font-semibold sm:inline">{job?.company.name}</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight">Apply for {job?.title ?? 'this role'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your application is reviewed by a person. AI matching is only an assistive signal for recruiters.</p>

        <Card className="mt-8">
          <CardContent className="space-y-5 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" required error={form.formState.errors.firstName?.message}>
                <Input {...form.register('firstName')} />
              </Field>
              <Field label="Last name" required error={form.formState.errors.lastName?.message}>
                <Input {...form.register('lastName')} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email" required error={form.formState.errors.email?.message}>
                <Input type="email" {...form.register('email')} />
              </Field>
              <Field label="Phone" required error={form.formState.errors.phone?.message}>
                <Input {...form.register('phone')} />
              </Field>
            </div>

            <Field label="Resume" required error={form.formState.errors.resumeFileId?.message} hint={`PDF or DOCX, up to ${RESUME_UPLOAD.maxBytes / 1024 / 1024} MB`}>
              <label
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 text-center transition',
                  drag ? 'border-primary bg-primary-soft' : 'border-border hover:border-ring/50 hover:bg-accent/40',
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  const f = e.dataTransfer.files[0];
                  if (f) {
                    setFile(f);
                    form.setValue('resumeFileId', 'pending', { shouldValidate: true });
                  }
                }}
              >
                <Upload className="mb-2 size-6 text-muted-foreground" />
                <p className="text-sm font-medium">Drop resume here or click to upload</p>
                <p className="mt-1 text-xs text-muted-foreground">PDF / DOCX</p>
                <input
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setFile(f);
                      form.setValue('resumeFileId', 'pending', { shouldValidate: true });
                    }
                  }}
                />
              </label>
              {file && (
                <p className="mt-2 inline-flex items-center gap-2 text-sm">
                  <FileText className="size-4 text-primary" />
                  {file.name} · {formatBytes(file.size)}
                </p>
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="LinkedIn">
                <Input {...form.register('linkedinUrl')} placeholder="https://linkedin.com/in/…" />
              </Field>
              <Field label="GitHub">
                <Input {...form.register('githubUrl')} placeholder="https://github.com/…" />
              </Field>
              <Field label="Portfolio">
                <Input {...form.register('portfolioUrl')} />
              </Field>
              <Field label="Current company">
                <Input {...form.register('currentCompany')} />
              </Field>
              <Field label="Years of experience" required>
                <Input type="number" min={0} step="0.5" {...form.register('experienceYears', { valueAsNumber: true })} />
              </Field>
              <Field label="Expected CTC (₹ / year)">
                <Input
                  type="number"
                  min={0}
                  onChange={(e) => form.setValue('expectedSalary', e.target.value === '' ? null : Number(e.target.value))}
                />
              </Field>
              <Field label="Notice period (days)">
                <NativeSelect onChange={(e) => form.setValue('noticePeriodDays', e.target.value === '' ? null : Number(e.target.value))}>
                  <option value="">Select</option>
                  <option value="0">Immediate</option>
                  <option value="15">15 days</option>
                  <option value="30">30 days</option>
                  <option value="60">60 days</option>
                  <option value="90">90 days</option>
                </NativeSelect>
              </Field>
            </div>

            {(job?.questions ?? []).map((q) => (
              <Field key={q.id} label={q.label} required={q.required} error={form.formState.errors.answers?.[q.id]?.message as string | undefined}>
                {q.type === 'YES_NO' ? (
                  <NativeSelect {...form.register(`answers.${q.id}`)}>
                    <option value="">Select</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </NativeSelect>
                ) : q.type === 'LONG_TEXT' ? (
                  <Textarea rows={4} {...form.register(`answers.${q.id}`)} />
                ) : (
                  <Input {...form.register(`answers.${q.id}`)} />
                )}
              </Field>
            ))}

            {submit.error && !form.formState.errors.resumeFileId && <p className="text-sm text-destructive">{errorMessage(submit.error)}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" asChild>
                <Link to={`/careers/${companySlug}/${jobSlug}`}>Cancel</Link>
              </Button>
              <Button loading={submit.isPending || uploading} onClick={form.handleSubmit((v) => submit.mutate(v))}>
                Submit application
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
