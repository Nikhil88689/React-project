import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema } from '@recruitflow/shared';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { useDocumentTitle } from '@/hooks';
import { api } from '@/lib/api';
import { AuthLayout } from './AuthLayout';

type Values = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  useDocumentTitle('Reset your password');
  const form = useForm<Values>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });
  const send = useMutation({ mutationFn: (v: Values) => api.post('/auth/forgot-password', v, { noRefresh: true }) });

  if (send.isSuccess) {
    return (
      <AuthLayout title="Check your inbox" subtitle={`If an account exists for ${form.getValues('email')}, we've sent a link to reset your password. It expires in 1 hour.`}>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <span className="flex size-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15">
            <MailCheck className="size-5" />
          </span>
          <p className="text-sm text-muted-foreground">Didn't get it? Check spam, or try again in a few minutes.</p>
        </div>
        <Button variant="outline" className="mt-6 w-full" asChild>
          <Link to="/login">
            <ArrowLeft /> Back to sign in
          </Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Forgot your password?" subtitle="Enter your email and we'll send you a reset link.">
      <form noValidate onSubmit={form.handleSubmit((v) => send.mutate(v))} className="space-y-4">
        <Field label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" autoFocus {...form.register('email')} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={send.isPending}>
          Send reset link
        </Button>
        <Button variant="ghost" className="w-full" asChild>
          <Link to="/login">
            <ArrowLeft /> Back to sign in
          </Link>
        </Button>
      </form>
    </AuthLayout>
  );
}
