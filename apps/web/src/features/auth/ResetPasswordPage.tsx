import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema } from '@recruitflow/shared';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { useDocumentTitle } from '@/hooks';
import { api, errorMessage } from '@/lib/api';
import { AuthLayout } from './AuthLayout';

const schema = resetPasswordSchema
  .extend({ confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ['confirm'] });
type Values = z.infer<typeof schema>;

export function ResetPasswordPage() {
  useDocumentTitle('Choose a new password');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { token, password: '', confirm: '' } });
  const reset = useMutation({
    mutationFn: ({ token, password }: Values) => api.post('/auth/reset-password', { token, password }, { noRefresh: true }),
    onSuccess: () => {
      toast.success('Password updated — sign in with your new password');
      navigate('/login', { replace: true });
    },
    onError: (err) => form.setError('root', { message: errorMessage(err) }),
  });

  if (!token) {
    return (
      <AuthLayout title="Invalid reset link" subtitle="This link is missing its token. Request a new one to continue.">
        <Button asChild className="w-full">
          <Link to="/forgot-password">Request a new link</Link>
        </Button>
      </AuthLayout>
    );
  }

  const { errors } = form.formState;
  return (
    <AuthLayout title="Choose a new password" subtitle="Signing in again will be required on all your devices.">
      <form noValidate onSubmit={form.handleSubmit((v) => reset.mutate(v))} className="space-y-4">
        {errors.root && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{errors.root.message}</p>}
        <Field label="New password" htmlFor="password" error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="new-password" {...form.register('password')} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={errors.confirm?.message}>
          <Input id="confirm" type="password" autoComplete="new-password" {...form.register('confirm')} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={reset.isPending}>
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}
