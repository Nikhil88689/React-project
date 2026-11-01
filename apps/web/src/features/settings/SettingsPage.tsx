import { zodResolver } from '@hookform/resolvers/zod';
import {
  COMPANY_SIZES,
  COMPANY_SIZE_LABELS,
  INDUSTRIES,
  PLANS,
  PLAN_TIERS,
  STAGE_LABELS,
  STAGE_TYPES,
  changePasswordSchema,
  companyUpdateSchema,
  profileUpdateSchema,
  type AuthUser,
  type BillingOverviewDTO,
  type CompanyUpdateInput,
  type ProfileUpdateInput,
  type StageType,
} from '@recruitflow/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Building2, CreditCard, Plug, Shield, User, Workflow } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { STAGE_STYLES } from '@/components/domain';
import { SortableList } from '@/components/SortableList';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/controls';
import { confirm, PageHeader } from '@/components/ui/feedback';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useDocumentTitle } from '@/hooks';
import { api } from '@/lib/api';
import { applyServerErrors } from '@/lib/forms';
import { uploadWorkspaceFile } from '@/lib/upload';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { useAuth, usePermission } from '@/stores/auth';
import { useState } from 'react';

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'company', label: 'Company', icon: Building2, permission: 'company:manage' as const },
  { id: 'workflow', label: 'Hiring workflow', icon: Workflow, permission: 'company:manage' as const },
  { id: 'notifications', label: 'Notifications', icon: Bell, permission: 'messages:send' as const },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'billing', label: 'Billing', icon: CreditCard, permission: 'billing:view' as const },
];

export function SettingsPage() {
  const { tab = 'profile' } = useParams();
  const can = usePermission();
  const current = TABS.find((t) => t.id === tab && (!t.permission || can(t.permission))) ?? TABS[0];
  useDocumentTitle('Settings');

  return (
    <>
      <PageHeader title="Settings" description="Workspace, security and billing." />
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col">
          {TABS.filter((t) => !t.permission || can(t.permission)).map((t) => (
            <Link
              key={t.id}
              to={`/settings/${t.id}`}
              className={cn('inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium', current.id === t.id ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground')}
            >
              <t.icon className="size-4" />
              {t.label}
            </Link>
          ))}
        </nav>
        <div>
          {current.id === 'profile' && <ProfileTab />}
          {current.id === 'company' && <CompanyTab />}
          {current.id === 'workflow' && <WorkflowTab />}
          {current.id === 'notifications' && <TemplatesTab />}
          {current.id === 'integrations' && <IntegrationsTab />}
          {current.id === 'security' && <SecurityTab />}
          {current.id === 'billing' && <BillingTab />}
        </div>
      </div>
    </>
  );
}

function ProfileTab() {
  const user = useAuth((s) => s.user)!;
  const form = useForm<ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: { firstName: user.firstName, lastName: user.lastName, phone: user.phone ?? '', timezone: user.timezone, title: user.title ?? '' },
  });
  const save = useMutation({
    mutationFn: (input: ProfileUpdateInput) => api.patch<AuthUser>('/users/me', input),
    onSuccess: (me) => useAuth.getState().setUser(me),
    onError: (err) => applyServerErrors(err, form.setError),
    meta: { success: 'Profile updated' },
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const done = await uploadWorkspaceFile(file, 'AVATAR');
      return api.patch<AuthUser>('/users/me', { avatarUrl: done.url ?? undefined });
    },
    onSuccess: (me) => useAuth.getState().setUser(me),
    meta: { success: 'Photo updated' },
  });
  return (
    <Card>
      <CardHeader title="Your profile" />
      <CardContent className="space-y-4">
        <Field label="Photo">
          <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" error={form.formState.errors.firstName?.message}>
            <Input {...form.register('firstName')} />
          </Field>
          <Field label="Last name">
            <Input {...form.register('lastName')} />
          </Field>
          <Field label="Email" hint="Email is used for login and cannot be changed here.">
            <Input value={user.email} disabled />
          </Field>
          <Field label="Phone">
            <Input {...form.register('phone')} />
          </Field>
          <Field label="Timezone">
            <Input {...form.register('timezone')} />
          </Field>
          <Field label="Title">
            <Input {...form.register('title')} />
          </Field>
        </div>
        <Button loading={save.isPending} onClick={form.handleSubmit((v) => save.mutate(v))}>
          Save profile
        </Button>
      </CardContent>
    </Card>
  );
}

function CompanyTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['company'],
    queryFn: () => api.get<{ name: string; industry: string | null; size: string | null; website: string | null; location: string | null; about: string | null; logoUrl: string | null; slug: string }>(
      '/company',
    ),
  });
  const form = useForm<CompanyUpdateInput>({
    resolver: zodResolver(companyUpdateSchema),
    values: data
      ? {
          name: data.name,
          industry: data.industry ?? undefined,
          size: (data.size as CompanyUpdateInput['size']) ?? undefined,
          website: data.website ?? undefined,
          location: data.location ?? undefined,
          about: data.about ?? undefined,
          logoUrl: data.logoUrl ?? undefined,
        }
      : undefined,
  });
  const save = useMutation({
    mutationFn: (input: CompanyUpdateInput) => api.patch('/company', input),
    onError: (err) => applyServerErrors(err, form.setError),
    meta: { success: 'Company updated' },
  });
  const logo = useMutation({
    mutationFn: async (file: File) => {
      const done = await uploadWorkspaceFile(file, 'LOGO');
      return api.patch('/company', { logoUrl: done.url ?? undefined });
    },
    meta: { success: 'Logo updated' },
  });
  if (isLoading || !data) return <Skeleton className="h-80" />;
  return (
    <Card>
      <CardHeader title="Company" description={`Public careers page: /careers/${data.slug}`} />
      <CardContent className="space-y-4">
        <Field label="Logo">
          <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && logo.mutate(e.target.files[0])} />
        </Field>
        <Field label="Name">
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
          <Field label="Size">
            <NativeSelect {...form.register('size')}>
              {COMPANY_SIZES.map((s) => (
                <option key={s} value={s}>
                  {COMPANY_SIZE_LABELS[s]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Website">
            <Input {...form.register('website')} />
          </Field>
          <Field label="Location">
            <Input {...form.register('location')} />
          </Field>
        </div>
        <Field label="About">
          <Textarea rows={4} {...form.register('about')} />
        </Field>
        <Button loading={save.isPending} onClick={form.handleSubmit((v) => save.mutate(v))}>
          Save company
        </Button>
      </CardContent>
    </Card>
  );
}

function WorkflowTab() {
  const { data } = useQuery({
    queryKey: ['workflow'],
    queryFn: () => api.get<{ id: string; name: string; type: StageType }[]>('/company/workflow'),
  });
  const [rows, setRows] = useState<{ id: string; name: string; type: StageType }[] | null>(null);
  const stages = rows ?? data ?? [];
  const save = useMutation({
    mutationFn: () => api.put('/company/workflow', { stages: stages.map(({ name, type }) => ({ name, type })) }),
    meta: { success: 'Workflow saved' },
  });
  return (
    <Card>
      <CardHeader title="Default hiring workflow" description="New jobs inherit this pipeline. Existing jobs keep their own stages." />
      <CardContent className="space-y-3">
        <SortableList
          items={stages}
          onMove={(from, to) => {
            const next = [...stages];
            const [item] = next.splice(from, 1);
            next.splice(to, 0, item);
            setRows(next);
          }}
          renderItem={(s, i, handle) => (
            <div className="flex items-center gap-2 rounded-lg border border-border px-2 py-2">
              {handle}
              <span className={cn('size-2 rounded-full', STAGE_STYLES[s.type].dot)} />
              <Input value={s.name} onChange={(e) => setRows(stages.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))} className="h-8" />
              <NativeSelect value={s.type} className="h-8 w-36" onChange={(e) => setRows(stages.map((r, idx) => (idx === i ? { ...r, type: e.target.value as StageType } : r)))}>
                {STAGE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {STAGE_LABELS[t]}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
        />
        <Button loading={save.isPending} onClick={() => save.mutate()}>
          Save workflow
        </Button>
      </CardContent>
    </Card>
  );
}

function TemplatesTab() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => api.get<{ id: string; key: string; name: string; subject: string; body: string }[]>('/company/email-templates'),
  });
  const [key, setKey] = useState<string | null>(null);
  const selected = data?.find((t) => t.key === (key ?? data[0]?.key));
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const active = selected ? (key === selected.key ? { subject: subject || selected.subject, body: body || selected.body } : selected) : null;
  const save = useMutation({
    mutationFn: () => api.put(`/company/email-templates/${selected!.key}`, { subject: active!.subject, body: active!.body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-templates'] }),
    meta: { success: 'Template saved' },
  });
  if (!data) return <Skeleton className="h-80" />;
  return (
    <Card>
      <CardHeader title="Email templates" description="Used when you message candidates. Variables are filled in on the server." />
      <CardContent className="grid gap-4 sm:grid-cols-[200px_1fr]">
        <div className="space-y-1">
          {data.map((t) => (
            <button key={t.key} onClick={() => { setKey(t.key); setSubject(t.subject); setBody(t.body); }} className={cn('block w-full rounded-lg px-3 py-2 text-left text-sm', (key ?? data[0].key) === t.key ? 'bg-accent font-medium' : 'hover:bg-accent/50')}>
              {t.name}
            </button>
          ))}
        </div>
        {selected && (
          <div className="space-y-3">
            <Field label="Subject">
              <Input value={subject || selected.subject} onChange={(e) => { setKey(selected.key); setSubject(e.target.value); }} />
            </Field>
            <Field label="Body">
              <Textarea rows={10} value={body || selected.body} onChange={(e) => { setKey(selected.key); setBody(e.target.value); }} />
            </Field>
            <Button loading={save.isPending} onClick={() => save.mutate()}>
              Save template
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IntegrationsTab() {
  return (
    <Card>
      <CardHeader title="Integrations" description="Connect calendars, chat and payments when you are ready." />
      <CardContent className="space-y-3 text-sm">
        {[
          ['Google Calendar', 'Interview events sync automatically once OAuth is configured.'],
          ['Slack', 'Pipeline moves and interview reminders in your hiring channel.'],
          ['Stripe', 'Live subscription billing. Works in test mode today — see Billing.'],
          ['OpenAPI', 'Machine-readable API at /api/docs for your own automations.'],
        ].map(([name, desc]) => (
          <div key={name} className="flex items-center justify-between rounded-xl border border-border p-4">
            <div>
              <p className="font-medium">{name}</p>
              <p className="text-muted-foreground">{desc}</p>
            </div>
            <Badge variant="secondary">{name === 'OpenAPI' || name === 'Stripe' ? 'Available' : 'Coming soon'}</Badge>
          </div>
        ))}
        <Button variant="outline" asChild>
          <a href="/api/docs" target="_blank" rel="noreferrer">
            Open API docs
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

function SecurityTab() {
  const form = useForm({ resolver: zodResolver(changePasswordSchema), defaultValues: { currentPassword: '', newPassword: '' } });
  const change = useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) => api.post('/auth/change-password', input),
    onError: (err) => applyServerErrors(err, form.setError),
    meta: { success: 'Password changed. Other sessions were signed out.' },
  });
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => api.get<{ id: string; browser: string; os: string; ip: string | null; lastUsedAt: string; current: boolean }[]>('/auth/sessions') });
  const history = useQuery({ queryKey: ['login-history'], queryFn: () => api.get<{ id: string; action: string; ip: string | null; createdAt: string; browser: string; os: string }[]>('/auth/login-history') });
  const qc = useQueryClient();
  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/auth/sessions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
    meta: { success: 'Session revoked' },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Change password" />
        <CardContent className="space-y-3">
          <Field label="Current password" error={form.formState.errors.currentPassword?.message}>
            <Input type="password" {...form.register('currentPassword')} />
          </Field>
          <Field label="New password" error={form.formState.errors.newPassword?.message}>
            <Input type="password" {...form.register('newPassword')} />
          </Field>
          <Button loading={change.isPending} onClick={form.handleSubmit((v) => change.mutate(v))}>
            Update password
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Two-factor authentication" description="TOTP 2FA is on the roadmap. Session revocation and password rotation are enforced today." />
        <CardContent>
          <Badge variant="secondary">Coming soon</Badge>
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Active sessions" />
        <CardContent className="space-y-3">
          {(sessions.data ?? []).map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
              <div>
                <p className="font-medium">
                  {s.browser} · {s.os}
                  {s.current && <span className="ml-2 text-xs text-emerald-600">This device</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.ip ?? 'Unknown IP'} · last active {formatDate(s.lastUsedAt)}
                </p>
              </div>
              {!s.current && (
                <Button size="sm" variant="outline" onClick={() => revoke.mutate(s.id)}>
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Login history" />
        <CardContent className="space-y-2 text-sm">
          {(history.data ?? []).map((h) => (
            <div key={h.id} className="flex justify-between">
              <span>
                {h.action} · {h.browser} · {h.os}
              </span>
              <span className="text-muted-foreground">{formatDate(h.createdAt)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function BillingTab() {
  const can = usePermission();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['billing'], queryFn: () => api.get<BillingOverviewDTO>('/billing') });
  const change = useMutation({
    mutationFn: (plan: (typeof PLAN_TIERS)[number]) => api.post<{ checkoutUrl: string | null; plan?: string }>('/billing/change-plan', { plan }),
    onSuccess: (res) => {
      if (res.checkoutUrl) window.location.href = res.checkoutUrl;
      else {
        qc.invalidateQueries({ queryKey: ['billing'] });
        toast.success('Plan updated');
      }
    },
  });
  const cancel = useMutation({
    mutationFn: () => api.post<{ cancelAtPeriodEnd: boolean }>('/billing/cancel'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing'] }),
    meta: { success: 'Billing preference updated' },
  });

  if (isLoading || !data) return <Skeleton className="h-80" />;
  const usage = [
    { label: 'Jobs', used: data.usage.activeJobs, max: data.limits.activeJobs },
    { label: 'Team members', used: data.usage.teamMembers, max: data.limits.teamMembers },
    { label: 'Candidates', used: data.usage.candidates, max: data.limits.candidates },
    { label: 'AI analyses', used: data.usage.aiAnalyses, max: data.limits.aiAnalyses },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Current plan"
          description={`${PLANS[data.plan].name} · ${formatCurrency(data.priceMonthly)}/month · renews ${formatDate(data.currentPeriodEnd)}`}
          action={<Badge variant={data.status === 'ACTIVE' || data.status === 'TRIALING' ? 'success' : 'warning'}>{data.status.toLowerCase()}</Badge>}
        />
        <CardContent className="space-y-4">
          {usage.map((u) => (
            <div key={u.label}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{u.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {u.used} / {u.max}
                </span>
              </div>
              <Progress value={(u.used / Math.max(u.max, 1)) * 100} />
            </div>
          ))}
          {can('billing:manage') && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => cancel.mutate()}>
                {data.cancelAtPeriodEnd ? 'Resume subscription' : 'Cancel at period end'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        {PLAN_TIERS.map((tier) => {
          const plan = PLANS[tier];
          const current = data.plan === tier;
          return (
            <Card key={tier} className={cn('p-5', current && 'ring-2 ring-primary')}>
              <p className="font-semibold">{plan.name}</p>
              <p className="mt-1 text-2xl font-bold">{formatCurrency(plan.priceMonthly)}</p>
              <p className="text-xs text-muted-foreground">/month</p>
              <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
                <li>{plan.limits.activeJobs} active jobs</li>
                <li>{plan.limits.teamMembers} team members</li>
                <li>{plan.limits.aiAnalyses.toLocaleString('en-IN')} AI analyses</li>
              </ul>
              {can('billing:manage') && !current && (
                <Button
                  className="mt-4 w-full"
                  variant={tier === 'GROWTH' ? 'default' : 'outline'}
                  loading={change.isPending}
                  onClick={async () => {
                    if (await confirm({ title: `Switch to ${plan.name}?`, confirmLabel: 'Continue' })) change.mutate(tier);
                  }}
                >
                  Upgrade
                </Button>
              )}
              {current && <p className="mt-4 text-center text-xs font-medium text-primary">Your plan</p>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
