import { zodResolver } from '@hookform/resolvers/zod';
import {
  COMPANY_SIZES,
  COMPANY_SIZE_LABELS,
  INDUSTRIES,
  candidateRegisterSchema,
  registerSchema,
  type AuthResponse,
  type CandidateRegisterInput,
  type RegisterInput,
} from '@recruitflow/shared';
import { useMutation } from '@tanstack/react-query';
import { Building2, Check, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/controls';
import { Field, Input, NativeSelect } from '@/components/ui/input';
import { useDocumentTitle } from '@/hooks';
import { api } from '@/lib/api';
import { applyServerErrors } from '@/lib/forms';
import { cn } from '@/lib/utils';
import { homePathFor, useAuth } from '@/stores/auth';
import { AuthLayout, Divider, GoogleButton } from './AuthLayout';

function PasswordStrength({ value }: { value: string }) {
  const checks = [value.length >= 8, /[A-Za-z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value) || value.length >= 12];
  const score = checks.filter(Boolean).length;
  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
  if (!value) return null;
  return (
    <div className="mt-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn('h-1 flex-1 rounded-full bg-muted', i < score && (score <= 1 ? 'bg-rose-500' : score === 2 ? 'bg-amber-500' : score === 3 ? 'bg-indigo-500' : 'bg-emerald-500'))} />
        ))}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{labels[score]} · at least 8 characters with a letter and a number</p>
    </div>
  );
}

function useFinishAuth() {
  const navigate = useNavigate();
  return ({ accessToken, user }: AuthResponse) => {
    useAuth.getState().setSession(accessToken, user);
    toast.success(`Welcome to RecruitFlow, ${user.firstName}!`);
    navigate(homePathFor(user), { replace: true });
  };
}

function CompanyForm() {
  const finish = useFinishAuth();
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '', companyName: '', companySize: undefined, industry: '' },
  });
  const register = useMutation({
    mutationFn: (v: RegisterInput) => api.post<AuthResponse>('/auth/register', v, { noRefresh: true }),
    onSuccess: finish,
    onError: (err) => applyServerErrors(err, form.setError),
  });
  const { errors } = form.formState;
  const password = form.watch('password');

  return (
    <form noValidate onSubmit={form.handleSubmit((v) => register.mutate(v))} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" htmlFor="firstName" error={errors.firstName?.message}>
          <Input id="firstName" autoComplete="given-name" aria-invalid={!!errors.firstName} {...form.register('firstName')} />
        </Field>
        <Field label="Last name" htmlFor="lastName" error={errors.lastName?.message}>
          <Input id="lastName" autoComplete="family-name" aria-invalid={!!errors.lastName} {...form.register('lastName')} />
        </Field>
      </div>
      <Field label="Work email" htmlFor="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" aria-invalid={!!errors.email} {...form.register('email')} />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password?.message}>
        <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...form.register('password')} />
        <PasswordStrength value={password} />
      </Field>
      <Field label="Company name" htmlFor="companyName" error={errors.companyName?.message}>
        <Input id="companyName" autoComplete="organization" placeholder="Acme Technologies" aria-invalid={!!errors.companyName} {...form.register('companyName')} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Company size" htmlFor="companySize" error={errors.companySize?.message}>
          <NativeSelect id="companySize" aria-invalid={!!errors.companySize} {...form.register('companySize')} defaultValue="">
            <option value="" disabled>
              Select…
            </option>
            {COMPANY_SIZES.map((s) => (
              <option key={s} value={s}>
                {COMPANY_SIZE_LABELS[s]} employees
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Industry" htmlFor="industry" error={errors.industry?.message}>
          <NativeSelect id="industry" aria-invalid={!!errors.industry} {...form.register('industry')} defaultValue="">
            <option value="" disabled>
              Select…
            </option>
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={register.isPending}>
        Create workspace
      </Button>
      <ul className="grid gap-1.5 pt-1 text-xs text-muted-foreground">
        {['14-day free trial of the Growth plan', 'No credit card required'].map((t) => (
          <li key={t} className="flex items-center gap-1.5">
            <Check className="size-3.5 text-emerald-500" /> {t}
          </li>
        ))}
      </ul>
    </form>
  );
}

function CandidateForm() {
  const finish = useFinishAuth();
  const form = useForm<CandidateRegisterInput>({ resolver: zodResolver(candidateRegisterSchema), defaultValues: { firstName: '', lastName: '', email: '', password: '' } });
  const register = useMutation({
    mutationFn: (v: CandidateRegisterInput) => api.post<AuthResponse>('/auth/register/candidate', v, { noRefresh: true }),
    onSuccess: finish,
    onError: (err) => applyServerErrors(err, form.setError),
  });
  const { errors } = form.formState;
  return (
    <form noValidate onSubmit={form.handleSubmit((v) => register.mutate(v))} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" htmlFor="c-first" error={errors.firstName?.message}>
          <Input id="c-first" {...form.register('firstName')} />
        </Field>
        <Field label="Last name" htmlFor="c-last" error={errors.lastName?.message}>
          <Input id="c-last" {...form.register('lastName')} />
        </Field>
      </div>
      <Field label="Email" htmlFor="c-email" error={errors.email?.message} hint="Use the email you applied with to see your applications.">
        <Input id="c-email" type="email" autoComplete="email" {...form.register('email')} />
      </Field>
      <Field label="Password" htmlFor="c-password" error={errors.password?.message}>
        <Input id="c-password" type="password" autoComplete="new-password" {...form.register('password')} />
        <PasswordStrength value={form.watch('password')} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={register.isPending}>
        Create candidate account
      </Button>
    </form>
  );
}

export function RegisterPage() {
  useDocumentTitle('Create your account');
  const [params] = useSearchParams();
  const [type, setType] = useState<'company' | 'candidate'>(params.get('type') === 'candidate' ? 'candidate' : 'company');
  return (
    <AuthLayout
      title={type === 'company' ? 'Start hiring with RecruitFlow' : 'Track your applications'}
      subtitle={type === 'company' ? 'Set up your workspace in under two minutes.' : 'See the status of every application in one place.'}
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <Segmented
        value={type}
        onChange={setType}
        className="mb-6 w-full [&>button]:flex-1 [&>button]:justify-center"
        options={[
          { value: 'company', label: <><Building2 /> I'm hiring</> },
          { value: 'candidate', label: <><UserRound /> I'm a candidate</> },
        ]}
      />
      {type === 'company' ? (
        <>
          <GoogleButton label="Sign up with Google" onClick={() => toast.info("Google sign-up isn't configured in this environment")} />
          <Divider />
          <CompanyForm />
        </>
      ) : (
        <CandidateForm />
      )}
    </AuthLayout>
  );
}
