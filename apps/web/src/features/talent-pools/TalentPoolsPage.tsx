import { talentPoolSchema } from '@recruitflow/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderHeart, Plus, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { AvatarStack } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { confirm, EmptyState, PageHeader } from '@/components/ui/feedback';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useDocumentTitle } from '@/hooks';
import { api } from '@/lib/api';
import { applyServerErrors } from '@/lib/forms';
import { pluralize } from '@/lib/utils';
import { useState } from 'react';
import { z } from 'zod';

interface Pool {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  count: number;
  createdBy: string;
  createdAt: string;
  preview: { id: string; name: string; avatarUrl: string | null }[];
}

export function TalentPoolsPage() {
  useDocumentTitle('Talent pools');
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['pools'], queryFn: () => api.get<Pool[]>('/talent-pools') });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/talent-pools/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pools'] }),
    meta: { success: 'Pool deleted' },
  });

  return (
    <>
      <PageHeader
        title="Talent pools"
        description="Save people for future roles even when they aren't in an active pipeline."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus /> New collection
          </Button>
        }
      />
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : !data?.length ? (
        <Card>
          <EmptyState icon={FolderHeart} title="No collections yet" description="Group React developers, future leads, or silver-medalists from past searches." action={<Button onClick={() => setOpen(true)}>Create a pool</Button>} />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{p.description || pluralize(p.count, 'candidate')}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${p.name}`}
                  onClick={async () => {
                    if (await confirm({ title: `Delete “${p.name}”?`, destructive: true, confirmLabel: 'Delete' })) remove.mutate(p.id);
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <AvatarStack people={p.preview.map((m) => ({ name: m.name, avatarUrl: m.avatarUrl }))} />
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/candidates?poolId=${p.id}`}>View</Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <CreatePool open={open} onOpenChange={setOpen} />
    </>
  );
}

function CreatePool({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const form = useForm<z.infer<typeof talentPoolSchema>>({ resolver: zodResolver(talentPoolSchema), defaultValues: { name: '', description: '', color: '#6366f1' } });
  const create = useMutation({
    mutationFn: (input: z.infer<typeof talentPoolSchema>) => api.post('/talent-pools', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pools'] });
      onOpenChange(false);
      form.reset();
    },
    onError: (err) => applyServerErrors(err, form.setError),
    meta: { success: 'Pool created' },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="New talent pool"
        footer={
          <Button loading={create.isPending} onClick={form.handleSubmit((v) => create.mutate(v))}>
            Create
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label="Name" required error={form.formState.errors.name?.message}>
            <Input {...form.register('name')} placeholder="React developers" />
          </Field>
          <Field label="Description">
            <Textarea rows={3} {...form.register('description')} />
          </Field>
        </div>
      </DialogContent>
    </Dialog>
  );
}
