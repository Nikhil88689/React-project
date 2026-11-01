import { zodResolver } from '@hookform/resolvers/zod';
import {
  INTERVIEW_TYPES,
  INTERVIEW_TYPE_LABELS,
  createInterviewSchema,
  type CreateInterviewInput,
  type InterviewDTO,
  type TeamMemberDTO,
} from '@recruitflow/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addMinutes, format } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/input';
import { useDebounce } from '@/hooks';
import { api } from '@/lib/api';
import { applyServerErrors } from '@/lib/forms';

export interface ApplicationOption {
  id: string;
  candidateId: string;
  candidateName: string;
  email: string;
  jobTitle: string;
  stageName: string;
}

const DURATIONS = [30, 45, 60, 90];

function defaultStart() {
  const d = new Date();
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  if (d.getHours() < 9) d.setHours(10, 0, 0, 0);
  return d;
}

export function ScheduleInterviewDialog({
  open,
  onOpenChange,
  applicationId,
  candidateLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId?: string;
  candidateLabel?: string;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const q = useDebounce(search.trim(), 250);
  const start = useMemo(() => defaultStart(), [open]);

  const form = useForm<CreateInterviewInput>({
    resolver: zodResolver(createInterviewSchema),
    defaultValues: {
      applicationId: applicationId ?? '',
      type: 'TECHNICAL',
      title: INTERVIEW_TYPE_LABELS.TECHNICAL,
      interviewerIds: [],
      startsAt: start,
      durationMins: 45,
      meetingUrl: 'https://meet.google.com/new',
      location: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      applicationId: applicationId ?? '',
      type: 'TECHNICAL',
      title: INTERVIEW_TYPE_LABELS.TECHNICAL,
      interviewerIds: [],
      startsAt: defaultStart(),
      durationMins: 45,
      meetingUrl: 'https://meet.google.com/new',
      location: '',
      notes: '',
    });
  }, [open, applicationId, form]);

  const type = form.watch('type');
  useEffect(() => {
    if (!form.formState.dirtyFields.title) form.setValue('title', INTERVIEW_TYPE_LABELS[type]);
  }, [type, form]);

  const team = useQuery({
    queryKey: ['team'],
    queryFn: () => api.get<{ members: TeamMemberDTO[] }>('/team'),
    enabled: open,
  });
  const options = useQuery({
    queryKey: ['application-options', q],
    queryFn: () => api.get<ApplicationOption[]>('/applications/options', { search: q }),
    enabled: open && !applicationId,
  });

  const interviewers = (team.data?.members ?? []).filter((m) => m.status === 'ACTIVE' && m.role !== 'CANDIDATE');
  const selected = form.watch('interviewerIds');

  const create = useMutation({
    mutationFn: (input: CreateInterviewInput) => api.post<InterviewDTO>('/interviews', { ...input, startsAt: new Date(input.startsAt).toISOString() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interviews'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['pipeline'] });
      qc.invalidateQueries({ queryKey: ['candidate'] });
      onOpenChange(false);
    },
    onError: (err) => applyServerErrors(err, form.setError),
    meta: { success: 'Interview scheduled — invites are on their way' },
  });

  const startsAt = form.watch('startsAt');
  const duration = form.watch('durationMins');
  const ends = startsAt ? addMinutes(new Date(startsAt), duration) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="lg"
        title="Schedule interview"
        description={candidateLabel ? `Set up a conversation with ${candidateLabel}.` : 'Pick a candidate, panel, and time. Confirmations go out automatically.'}
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button loading={create.isPending} onClick={form.handleSubmit((v) => create.mutate(v))}>
              Schedule
            </Button>
          </>
        }
      >
        <form className="grid gap-4" onSubmit={form.handleSubmit((v) => create.mutate(v))}>
          {!applicationId && (
            <Field label="Candidate" required error={form.formState.errors.applicationId?.message}>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name…" className="mb-2" />
              <NativeSelect {...form.register('applicationId')} aria-invalid={Boolean(form.formState.errors.applicationId)}>
                <option value="">Select an application</option>
                {(options.data ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.candidateName} — {o.jobTitle} ({o.stageName})
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Interview type" required>
              <NativeSelect {...form.register('type')}>
                {INTERVIEW_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {INTERVIEW_TYPE_LABELS[t]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Title">
              <Input {...form.register('title')} />
            </Field>
          </div>

          <Field label="Interviewers" required error={form.formState.errors.interviewerIds?.message} hint="Everyone selected receives a calendar invite.">
            <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-2">
              {interviewers.map((m) => (
                <label key={m.userId} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                  <input
                    type="checkbox"
                    className="accent-indigo-600"
                    checked={selected.includes(m.userId)}
                    onChange={(e) => {
                      const next = e.target.checked ? [...selected, m.userId] : selected.filter((id) => id !== m.userId);
                      form.setValue('interviewerIds', next, { shouldValidate: true });
                    }}
                  />
                  <span className="flex-1">{m.name}</span>
                  <span className="text-xs text-muted-foreground">{m.title ?? m.role}</span>
                </label>
              ))}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Date" required className="sm:col-span-1">
              <Input
                type="date"
                value={startsAt ? format(new Date(startsAt), 'yyyy-MM-dd') : ''}
                onChange={(e) => {
                  const d = new Date(startsAt ?? start);
                  const [y, m, day] = e.target.value.split('-').map(Number);
                  d.setFullYear(y, m - 1, day);
                  form.setValue('startsAt', d, { shouldValidate: true });
                }}
              />
            </Field>
            <Field label="Start time" required>
              <Input
                type="time"
                value={startsAt ? format(new Date(startsAt), 'HH:mm') : ''}
                onChange={(e) => {
                  const d = new Date(startsAt ?? start);
                  const [h, min] = e.target.value.split(':').map(Number);
                  d.setHours(h, min, 0, 0);
                  form.setValue('startsAt', d, { shouldValidate: true });
                }}
              />
            </Field>
            <Field label="Duration">
              <NativeSelect {...form.register('durationMins', { valueAsNumber: true })}>
                {DURATIONS.map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          {ends && <p className="text-xs text-muted-foreground">Ends at {format(ends, 'h:mm a')} · reminders go out 24 hours and 1 hour before.</p>}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Meeting link" error={form.formState.errors.meetingUrl?.message}>
              <Input {...form.register('meetingUrl')} placeholder="https://meet.google.com/…" />
            </Field>
            <Field label="Location">
              <Input {...form.register('location')} placeholder="Office / phone" />
            </Field>
          </div>
          <Field label="Notes for the panel">
            <Textarea rows={3} {...form.register('notes')} placeholder="Focus areas, take-home to review…" />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
