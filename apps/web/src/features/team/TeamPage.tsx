import { zodResolver } from '@hookform/resolvers/zod';
import { ROLE_LABELS, inviteMemberSchema, type InviteMemberInput, type Role, type TeamMemberDTO } from '@recruitflow/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, UserPlus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { confirm, PageHeader } from '@/components/ui/feedback';
import { Field, Input, NativeSelect } from '@/components/ui/input';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useDocumentTitle } from '@/hooks';
import { api } from '@/lib/api';
import { applyServerErrors } from '@/lib/forms';
import { formatDate, timeAgo } from '@/lib/utils';
import { useAuth, usePermission } from '@/stores/auth';
import { useState } from 'react';

interface TeamPayload {
  members: TeamMemberDTO[];
  invitations: { id: string; email: string; role: Role; invitedBy: string; createdAt: string; expiresAt: string }[];
}

export function TeamPage() {
  useDocumentTitle('Team');
  const can = usePermission();
  const me = useAuth((s) => s.user)!;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['team'], queryFn: () => api.get<TeamPayload>('/team') });

  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string; role?: Role; status?: 'ACTIVE' | 'DISABLED' }) => api.patch(`/team/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }),
    meta: { success: 'Team member updated' },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/team/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }),
    meta: { success: 'Member removed' },
  });
  const revokeInvite = useMutation({
    mutationFn: (id: string) => api.delete(`/team/invitations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }),
    meta: { success: 'Invitation revoked' },
  });

  return (
    <>
      <PageHeader
        title="Team"
        description="Invite recruiters and interviewers. Role changes take effect immediately."
        actions={
          can('team:manage') && (
            <Button onClick={() => setOpen(true)}>
              <UserPlus /> Invite member
            </Button>
          )
        }
      />
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-5">
            <Skeleton className="h-64" />
          </div>
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Role</th>
                <th className="px-3 py-3 font-medium">Last active</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(data?.members ?? []).map((m) => (
                <tr key={m.id}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={m.name} src={m.avatarUrl} size="sm" />
                      <div>
                        <p className="font-medium">
                          {m.name}
                          {m.userId === me.id && <span className="ml-2 text-xs text-muted-foreground">you</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">{ROLE_LABELS[m.role]}</td>
                  <td className="px-3 py-3 text-muted-foreground">{m.lastActiveAt ? timeAgo(m.lastActiveAt) : '—'}</td>
                  <td className="px-3 py-3">
                    <Badge variant={m.status === 'ACTIVE' ? 'success' : 'secondary'}>{m.status.toLowerCase()}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    {can('team:manage') && m.userId !== me.id && (
                      <Menu>
                        <MenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${m.name}`}>
                            <MoreHorizontal />
                          </Button>
                        </MenuTrigger>
                        <MenuContent>
                          {(['COMPANY_ADMIN', 'RECRUITER', 'INTERVIEWER'] as const).map((r) => (
                            <MenuItem key={r} onSelect={() => update.mutate({ id: m.id, role: r })}>
                              Make {ROLE_LABELS[r]}
                            </MenuItem>
                          ))}
                          <MenuItem
                            onSelect={() => update.mutate({ id: m.id, status: m.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' })}
                          >
                            {m.status === 'ACTIVE' ? 'Disable' : 'Re-enable'}
                          </MenuItem>
                          <MenuItem
                            destructive
                            onSelect={async () => {
                              if (await confirm({ title: `Remove ${m.name}?`, description: 'They will lose access immediately.', confirmLabel: 'Remove', destructive: true })) {
                                remove.mutate(m.id);
                              }
                            }}
                          >
                            Remove
                          </MenuItem>
                        </MenuContent>
                      </Menu>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {(data?.invitations.length ?? 0) > 0 && (
        <Card className="mt-6 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <th className="px-5 py-3 font-medium">Pending invitations</th>
                <th className="px-3 py-3 font-medium">Role</th>
                <th className="px-3 py-3 font-medium">Expires</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data!.invitations.map((i) => (
                <tr key={i.id}>
                  <td className="px-5 py-3">{i.email}</td>
                  <td className="px-3 py-3">{ROLE_LABELS[i.role]}</td>
                  <td className="px-3 py-3 text-muted-foreground">{formatDate(i.expiresAt)}</td>
                  <td className="px-3 py-3 text-right">
                    {can('team:manage') && (
                      <Button variant="ghost" size="sm" onClick={() => revokeInvite.mutate(i.id)}>
                        Revoke
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <InviteDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const form = useForm<InviteMemberInput>({ resolver: zodResolver(inviteMemberSchema), defaultValues: { email: '', role: 'RECRUITER' } });
  const invite = useMutation({
    mutationFn: (input: InviteMemberInput) => api.post<{ devInviteUrl?: string }>('/team/invitations', input),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['team'] });
      if (res.devInviteUrl) toast.message('Dev invite link', { description: res.devInviteUrl });
      onOpenChange(false);
      form.reset();
    },
    onError: (err) => applyServerErrors(err, form.setError),
    meta: { success: 'Invitation sent' },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Invite a teammate"
        footer={
          <Button loading={invite.isPending} onClick={form.handleSubmit((v) => invite.mutate(v))}>
            Send invitation
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label="Work email" required error={form.formState.errors.email?.message}>
            <Input type="email" {...form.register('email')} />
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
