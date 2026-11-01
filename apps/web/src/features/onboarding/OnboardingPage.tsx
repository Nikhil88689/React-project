import { zodResolver } from '@hookform/resolvers/zod';
import {
  COMPANY_SIZES,
  COMPANY_SIZE_LABELS,
  INDUSTRIES,
  ROLE_LABELS,
  STAGE_LABELS,
  STAGE_TYPES,
  companyUpdateSchema,
  inviteMemberSchema,
  type AuthUser,
  type CompanyUpdateInput,
  type InviteMemberInput,
  type StageType,
} from '@recruitflow/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Briefcase, Building2, Check, Plus, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Logo, STAGE_STYLES } from '@/components/domain';
import { SortableList } from '@/components/SortableList';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input';
import { useDocumentTitle } from '@/hooks';
import { api } from '@/lib/api';
import { applyServerErrors } from '@/lib/forms';
import { cn } from '@/lib/utils';
import { useAuth } from '@/stores/auth';

const STEPS = [
  { key: 'company', title: 'Company', icon: Building2 },
  { key: 'team', title: 'Team', icon: Users },
  { key: 'workflow', title: 'Hiring workflow', icon: Check },
  { key: 'job', title: 'First job', icon: Briefcase },
] as const;

type StageRow = { id: string; name: string; type: StageType };

export function OnboardingPage() {
  useDocumentTitle('Set up your workspace');
  const navigate = useNavigate();
  const user = useAuth((s) => s.user)!;
  const [step, setStep] = useState(0);

  const finish = async () => {
    await api.patch('/company', { onboardingCompleted: true });
    const me = await api.get<AuthUser>('/auth/me');
    useAuth.getState().setUser(me);
    toast.success('Workspace ready. Welcome to RecruitFlow.');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Logo />
          <span className="text-sm text-muted-foreground">{user.company?.name}</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <ol className="mb-10 flex items-center justify-between">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex flex-1 items-center">
              <button type="button" onClick={() => i < step && setStep(i)} className="flex items-center gap-2 text-left" disabled={i > step}>
                <span className={cn('flex size-8 items-center justify-center rounded-full text-sm font-semibold', i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-primary text-white' : 'bg-muted text-muted-foreground')}>
                  {i < step ? <Check className="size-4" /> : i + 1}
                </span>
                <span className={cn('hidden text-sm font-medium sm:block', i === step ? 'text-foreground' : 'text-muted-foreground')}>{s.title}</span>
              </button>
              {i < STEPS.length - 1 && <span className={cn('mx-3 h-px flex-1', i < step ? 'bg-emerald-400' : 'bg-border')} />}
            </li>
          ))}
        </ol>

        {step === 0 && <CompanyStep onNext={() => setStep(1)} />}
        {step === 1 && <TeamStep onBack={() => setStep(0)} onNext={() => setStep(2)} />}
        {step === 2 && <WorkflowStep onBack={() => setStep(1)} onNext={() => setStep(3)} />}
        {step === 3 && (
          <Card>
            <CardContent className="py-10 text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                <Briefcase className="size-5" />
              </div>
              <h2 className="text-xl font-semibold">Create your first job</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Publish a role to start collecting applications, or jump into the dashboard and explore the seeded demo data.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={async () => {
                    await finish();
                    navigate('/dashboard');
                  }}
                >
                  Explore dashboard
                </Button>
                <Button
                  onClick={async () => {
                    await finish();
                    navigate('/jobs/new');
                  }}
                >
                  Create your first job <ArrowRight />
                </Button>
              </div>
              <Button variant="ghost" className="mt-4" onClick={() => setStep(2)}>
                <ArrowLeft /> Back
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function CompanyStep({ onNext }: { onNext: () => void }) {
  const user = useAuth((s) => s.user)!;
  const form = useForm<CompanyUpdateInput>({
    resolver: zodResolver(companyUpdateSchema),
    defaultValues: { name: user.company?.name ?? '', industry: 'Software & Internet', size: '11-50', website: '', location: '', about: '' },
  });
  const save = useMutation({
    mutationFn: (input: CompanyUpdateInput) => api.patch('/company', input),
    onSuccess: onNext,
    onError: (err) => applyServerErrors(err, form.setError),
  });
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <h2 className="text-lg font-semibold">Tell us about your company</h2>
          <p className="mt-1 text-sm text-muted-foreground">This appears on your public careers page.</p>
        </div>
        <Field label="Company name" required error={form.formState.errors.name?.message}>
          <Input {...form.register('name')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Industry">
            <NativeSelect {...form.register('industry')}>
              {INDUSTRIES.map((i) => (
                <option key={i}>{i}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Company size">
            <NativeSelect {...form.register('size')}>
              {COMPANY_SIZES.map((s) => (
                <option key={s} value={s}>
                  {COMPANY_SIZE_LABELS[s]}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Website">
            <Input {...form.register('website')} placeholder="https://" />
          </Field>
          <Field label="Location">
            <Input {...form.register('location')} placeholder="Bengaluru, India" />
          </Field>
        </div>
        <Field label="About">
          <Textarea rows={4} {...form.register('about')} placeholder="A short blurb candidates will see on your careers page." />
        </Field>
        <div className="flex justify-end">
          <Button loading={save.isPending} onClick={form.handleSubmit((v) => save.mutate(v))}>
            Continue <ArrowRight />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TeamStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const form = useForm<InviteMemberInput>({ resolver: zodResolver(inviteMemberSchema), defaultValues: { email: '', role: 'RECRUITER' } });
  const invite = useMutation({
    mutationFn: (input: InviteMemberInput) => api.post<{ id: string; devInviteUrl?: string }>('/team/invitations', input),
    onSuccess: (res) => {
      toast.success('Invitation sent');
      if (res.devInviteUrl) toast.message('Dev invite link', { description: res.devInviteUrl });
      form.reset({ email: '', role: 'RECRUITER' });
    },
    onError: (err) => applyServerErrors(err, form.setError),
  });
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <h2 className="text-lg font-semibold">Invite your hiring team</h2>
          <p className="mt-1 text-sm text-muted-foreground">You can skip this and add people later from Settings → Team.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
          <Field label="Work email" error={form.formState.errors.email?.message}>
            <Input type="email" {...form.register('email')} placeholder="recruiter@company.com" />
          </Field>
          <Field label="Role">
            <NativeSelect {...form.register('role')}>
              {(['COMPANY_ADMIN', 'RECRUITER', 'INTERVIEWER'] as const).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="flex items-end">
            <Button variant="outline" loading={invite.isPending} onClick={form.handleSubmit((v) => invite.mutate(v))}>
              Send invite
            </Button>
          </div>
        </div>
        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft /> Back
          </Button>
          <Button onClick={onNext}>
            Continue <ArrowRight />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function WorkflowStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['workflow'],
    queryFn: () => api.get<{ id: string; name: string; type: StageType; order: number }[]>('/company/workflow'),
  });
  const [stages, setStages] = useState<StageRow[] | null>(null);
  const rows = stages ?? data?.map((s) => ({ id: s.id, name: s.name, type: s.type })) ?? [];

  const save = useMutation({
    mutationFn: () => api.put('/company/workflow', { stages: rows.map(({ name, type }) => ({ name, type })) }),
    onSuccess: onNext,
    meta: { success: 'Hiring workflow saved' },
  });

  const move = (from: number, to: number) => {
    const next = [...rows];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setStages(next);
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div>
          <h2 className="text-lg font-semibold">Hiring workflow</h2>
          <p className="mt-1 text-sm text-muted-foreground">These stages become the default pipeline for every new job. You can still customise per role.</p>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading workflow…</p>
        ) : (
          <SortableList
            items={rows}
            onMove={move}
            renderItem={(s, i, handle) => (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-2">
                {handle}
                <span className={cn('size-2 rounded-full', STAGE_STYLES[s.type].dot)} />
                <Input
                  value={s.name}
                  onChange={(e) => setStages(rows.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))}
                  className="h-8 flex-1"
                />
                <NativeSelect
                  value={s.type}
                  className="h-8 w-36"
                  onChange={(e) => setStages(rows.map((r, idx) => (idx === i ? { ...r, type: e.target.value as StageType } : r)))}
                >
                  {STAGE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {STAGE_LABELS[t]}
                    </option>
                  ))}
                </NativeSelect>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={rows.length <= 2}
                  onClick={() => setStages(rows.filter((_, idx) => idx !== i))}
                  aria-label="Remove stage"
                >
                  <Trash2 />
                </Button>
              </div>
            )}
          />
        )}
        <Button variant="outline" size="sm" onClick={() => setStages([...rows, { id: `new-${rows.length}`, name: 'New stage', type: 'INTERVIEW' }])}>
          <Plus /> Add stage
        </Button>
        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft /> Back
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            Continue <ArrowRight />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
