import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type AuthResponse, type LoginInput } from '@recruitflow/shared';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { useDocumentTitle } from '@/hooks';
import { api, errorMessage } from '@/lib/api';
import { homePathFor, useAuth } from '@/stores/auth';
import { AuthLayout, Divider, GoogleButton } from './AuthLayout';

const DEMO_ACCOUNTS = [
  { email: 'admin@demo.recruitflow.com', label: 'Company admin' },
  { email: 'recruiter@demo.recruitflow.com', label: 'Recruiter' },
  { email: 'interviewer@demo.recruitflow.com', label: 'Interviewer' },
  { email: 'candidate@demo.recruitflow.com', label: 'Candidate' },
];

export function LoginPage() {
  useDocumentTitle('Sign in');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const login = useMutation({
    mutationFn: (input: LoginInput) => api.post<AuthResponse>('/auth/login', input, { noRefresh: true }),
    onSuccess: ({ accessToken, user }) => {
      useAuth.getState().setSession(accessToken, user);
      toast.success(`Welcome back, ${user.firstName}`);
      const next = params.get('next');
      navigate(next && next.startsWith('/') && !next.startsWith('//') ? next : homePathFor(user), { replace: true });
    },
    onError: (err) => setFormError(errorMessage(err)),
  });

  const fillDemo = (email: string) => {
    form.setValue('email', email, { shouldValidate: true });
    form.setValue('password', 'Demo@1234', { shouldValidate: true });
    setFormError(null);
  };

  const { errors } = form.formState;
  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your RecruitFlow workspace."
      footer={
        <>
          New to RecruitFlow?{' '}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <GoogleButton onClick={() => toast.info("Google sign-in isn't configured in this environment", { description: 'Use email and password, or one of the demo accounts below.' })} />
      <Divider label="or sign in with email" />

      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit((v) => {
          setFormError(null);
          login.mutate(v);
        })}
      >
        {formError && (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {formError}
          </div>
        )}
        <Field label="Work email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" aria-invalid={!!errors.email} {...form.register('email')} />
        </Field>
        <Field
          label={
            <span className="flex w-full items-center justify-between">
              Password
              <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                Forgot password?
              </Link>
            </span>
          }
          htmlFor="password"
          error={errors.password?.message}
        >
          <div className="relative">
            <Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••" className="pr-10" aria-invalid={!!errors.password} {...form.register('password')} />
            <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground" aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
          Sign in
        </Button>
      </form>

      <div className="mt-8 rounded-xl border border-dashed border-border bg-muted/40 p-4">
        <p className="text-xs font-semibold text-foreground">Try a demo account</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Password for all demo users: Demo@1234</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((a) => (
            <button key={a.email} type="button" onClick={() => fillDemo(a.email)} className="rounded-lg border border-border bg-card px-2.5 py-2 text-left text-xs transition hover:border-primary/50">
              <span className="block font-semibold">{a.label}</span>
              <span className="block truncate text-muted-foreground">{a.email.split('@')[0]}@…</span>
            </button>
          ))}
        </div>
      </div>
    </AuthLayout>
  );
}
