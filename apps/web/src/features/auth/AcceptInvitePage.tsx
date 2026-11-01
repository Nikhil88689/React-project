import { zodResolver } from '@hookform/resolvers/zod';
import { ROLE_LABELS, acceptInviteSchema, type AuthResponse, type Role } from '@recruitflow/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FullPageSpinner } from '@/components/ui/feedback';
import { Field, Input } from '@/components/ui/input';
import { useDocumentTitle } from '@/hooks';
import { api, errorMessage } from '@/lib/api';
import { applyServerErrors } from '@/lib/forms';
import { homePathFor, useAuth } from '@/stores/auth';
import { AuthLayout } from './AuthLayout';

type Values = z.infer<typeof acceptInviteSchema>;
type Invitation = { email: string; role: Role; companyName: string; existingUser: boolean };

export function AcceptInvitePage() {
  useDocumentTitle('Join your team');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const invite = useQuery({ queryKey: ['invite', token], queryFn: () => api.get<Invitation>(`/auth/invitations/${token}`), enabled: token.length >= 20, retry: false });
  const form = useForm<Values>({ resolver: zodResolver(acceptInviteSchema), defaultValues: { token, firstName: '', lastName: '', password: '' } });
  const accept = useMutation({
    mutationFn: (v: Values) => api.post<AuthResponse>('/auth/accept-invite', v, { noRefresh: true }),
    onSuccess: ({ accessToken, user }) => {
      useAuth.getState().setSession(accessToken, user);
      toast.success(`You've joined ${user.company?.name}`);
      navigate(homePathFor(user), { replace: true });
    },
    onError: (err) => applyServerErrors(err, form.setError),
  });

  if (invite.isLoading) return <FullPageSpinner />;
  if (!token || invite.isError) {
    return (
      <AuthLayout title="This invitation isn't valid" subtitle={invite.error ? errorMessage(invite.error) : 'The link is incomplete.'}>
        <p className="text-sm text-muted-foreground">Invitations expire after 7 days. Ask your admin to send a new one.</p>
        <Button asChild variant="outline" className="mt-6 w-full">
          <Link to="/login">Go to sign in</Link>
        </Button>
      </AuthLayout>
    );
  }

  const data = invite.data!;
  const { errors } = form.formState;
  return (
    <AuthLayout
      title={`Join ${data.companyName}`}
      subtitle={
        <>
          You've been invited as <strong className="text-foreground">{ROLE_LABELS[data.role]}</strong> ({data.email}).
          {data.existingUser && ' Enter your existing password to accept.'}
        </>
      }
    >
      <form noValidate onSubmit={form.handleSubmit((v) => accept.mutate(v))} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" htmlFor="firstName" error={errors.firstName?.message}>
            <Input id="firstName" {...form.register('firstName')} />
          </Field>
          <Field label="Last name" htmlFor="lastName" error={errors.lastName?.message}>
            <Input id="lastName" {...form.register('lastName')} />
          </Field>
        </div>
        <Field label={data.existingUser ? 'Your password' : 'Create a password'} htmlFor="password" error={errors.password?.message}>
          <Input id="password" type="password" autoComplete={data.existingUser ? 'current-password' : 'new-password'} {...form.register('password')} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={accept.isPending}>
          Accept invitation
        </Button>
      </form>
    </AuthLayout>
  );
}
