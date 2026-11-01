import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useDraggable } from '@dnd-kit/core';
import type { JobSummaryDTO, PipelineCardDTO, PipelineColumnDTO } from '@recruitflow/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, KanbanSquare, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { MatchScore, STAGE_STYLES } from '@/components/domain';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { confirm, EmptyState, ErrorState, PageHeader } from '@/components/ui/feedback';
import { Input, NativeSelect } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebounce, useDocumentTitle } from '@/hooks';
import { api, errorMessage } from '@/lib/api';
import { cn, formatDay, pluralize } from '@/lib/utils';

interface PipelinePayload {
  columns: PipelineColumnDTO[];
  job: { id: string; title: string } | null;
}

function CardView({ card, overlay }: { card: PipelineCardDTO; overlay?: boolean }) {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-3 shadow-xs', overlay && 'rotate-1 shadow-lg')}>
      <div className="flex items-center gap-2">
        <Avatar name={card.candidateName} src={card.avatarUrl} size="xs" />
        <span className="truncate text-[13px] font-semibold">{card.candidateName}</span>
      </div>
      <p className="mt-1.5 truncate text-[11px] text-muted-foreground">{card.jobTitle}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-muted-foreground">{card.experienceYears != null ? `${card.experienceYears} yrs` : card.headline}</span>
        <MatchScore score={card.matchScore} />
      </div>
      {card.nextInterview && (
        <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-300">
          <CalendarDays className="size-3" /> {formatDay(card.nextInterview.startsAt)}
        </p>
      )}
    </div>
  );
}

function DraggableCard({ card }: { card: PipelineCardDTO }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id, data: { card } });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }} className={cn(isDragging && 'opacity-40')} {...listeners} {...attributes}>
      <Link to={`/candidates/${card.candidateId}`} onClick={(e) => isDragging && e.preventDefault()}>
        <CardView card={card} />
      </Link>
    </div>
  );
}

function Column({ col }: { col: PipelineColumnDTO }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id, data: { column: col } });
  return (
    <div className={cn('flex w-72 shrink-0 flex-col rounded-xl bg-muted/60 p-2', isOver && 'ring-2 ring-primary/40')}>
      <div className="mb-2 flex items-center gap-2 px-1.5 pt-1">
        <span className={cn('size-2 rounded-full', STAGE_STYLES[col.type].dot)} />
        <span className="text-[13px] font-semibold">{col.name}</span>
        <span className="ml-auto rounded-full bg-card px-1.5 text-[11px] font-semibold text-muted-foreground">{col.total}</span>
      </div>
      <div ref={setNodeRef} className="flex min-h-32 flex-1 flex-col gap-2">
        {col.cards.length === 0 && <p className="px-2 py-8 text-center text-xs text-muted-foreground">Drop candidates here</p>}
        {col.cards.map((card) => (
          <DraggableCard key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}

export function PipelinePage() {
  useDocumentTitle('Pipeline');
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const jobId = params.get('jobId') ?? '';
  const minMatch = params.get('minMatch') ?? '';
  const [search, setSearch] = useState(params.get('search') ?? '');
  const q = useDebounce(search.trim());
  const [active, setActive] = useState<PipelineCardDTO | null>(null);

  const jobs = useQuery({
    queryKey: ['jobs', { limit: 100, status: 'PUBLISHED' }],
    queryFn: () => api.get<{ items: JobSummaryDTO[] }>('/jobs', { limit: 100, status: 'PUBLISHED' }),
  });
  const query = { jobId, minMatch, search: q, limitPerStage: 50 };
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['pipeline', query],
    queryFn: () => api.get<PipelinePayload>('/applications', query),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const move = useMutation({
    mutationFn: ({ id, stageId }: { id: string; stageId: string; previous: PipelinePayload | undefined }) => api.patch(`/applications/${id}/stage`, { stageId }),
    onMutate: async ({ id, stageId }) => {
      await qc.cancelQueries({ queryKey: ['pipeline', query] });
      const previous = qc.getQueryData<PipelinePayload>(['pipeline', query]);
      if (previous) {
        const from = previous.columns.find((c) => c.cards.some((card) => card.id === id));
        const to = previous.columns.find((c) => c.id === stageId);
        const card = from?.cards.find((c) => c.id === id);
        if (from && to && card) {
          qc.setQueryData<PipelinePayload>(['pipeline', query], {
            ...previous,
            columns: previous.columns.map((col) => {
              if (col.id === from.id) return { ...col, total: col.total - 1, cards: col.cards.filter((c) => c.id !== id) };
              if (col.id === to.id) return { ...col, total: col.total + 1, cards: [{ ...card, stageId: to.id, stageType: to.type }, ...col.cards] };
              return col;
            }),
          });
        }
      }
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(['pipeline', query], ctx.previous);
      toast.error(errorMessage(err, 'Unable to move candidate. Please try again.'));
    },
    onSuccess: () => {
      toast.success('Candidate moved');
      qc.invalidateQueries({ queryKey: ['pipeline'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['candidates'] });
    },
  });

  const columns = data?.columns ?? [];
  const totals = useMemo(() => columns.reduce((n, c) => n + c.total, 0), [columns]);

  const onDragEnd = async (e: DragEndEvent) => {
    setActive(null);
    const card = e.active.data.current?.card as PipelineCardDTO | undefined;
    const overId = e.over?.id;
    if (!card || !overId) return;
    const target = columns.find((c) => c.id === overId || c.cards.some((x) => x.id === overId));
    if (!target || target.id === card.stageId) return;
    if (target.type === 'REJECTED') {
      const ok = await confirm({
        title: `Reject ${card.candidateName}?`,
        description: 'They’ll be marked as not selected. You can move them back later.',
        confirmLabel: 'Reject',
        destructive: true,
      });
      if (!ok) return;
    }
    move.mutate({ id: card.id, stageId: target.id, previous: data });
  };

  return (
    <>
      <PageHeader
        title="Hiring pipeline"
        description={data?.job ? data.job.title : totals ? `${pluralize(totals, 'active application')} across open roles.` : 'Drag candidates between stages. Every move is audited.'}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <NativeSelect
          value={jobId}
          className="w-64"
          onChange={(e) => {
            const next = new URLSearchParams(params);
            if (e.target.value) next.set('jobId', e.target.value);
            else next.delete('jobId');
            setParams(next, { replace: true });
          }}
        >
          <option value="">All jobs</option>
          {(jobs.data?.items ?? []).map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </NativeSelect>
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              const next = new URLSearchParams(params);
              if (e.target.value) next.set('search', e.target.value);
              else next.delete('search');
              setParams(next, { replace: true });
            }}
            placeholder="Search candidates…"
            className="pl-9"
          />
        </div>
        <NativeSelect
          value={minMatch}
          className="w-36"
          onChange={(e) => {
            const next = new URLSearchParams(params);
            if (e.target.value) next.set('minMatch', e.target.value);
            else next.delete('minMatch');
            setParams(next, { replace: true });
          }}
        >
          <option value="">Any match</option>
          <option value="80">80%+</option>
          <option value="70">70%+</option>
        </NativeSelect>
      </div>

      {isError ? (
        <ErrorState message="We couldn't load the pipeline." onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="flex gap-3 overflow-x-auto">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[420px] w-72 shrink-0 rounded-xl" />
          ))}
        </div>
      ) : columns.length === 0 ? (
        <EmptyState icon={KanbanSquare} title="No applications yet" description="Publish a job and candidates will land on this board." action={<Button asChild><Link to="/jobs/new">Create job</Link></Button>} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(e: DragStartEvent) => setActive((e.active.data.current?.card as PipelineCardDTO) ?? null)} onDragEnd={onDragEnd}>
          <div className="scrollbar-thin flex gap-3 overflow-x-auto pb-4">
            {columns.map((col) => (
              <Column key={col.id} col={col} />
            ))}
          </div>
          <DragOverlay>{active ? <CardView card={active} overlay /> : null}</DragOverlay>
        </DndContext>
      )}
    </>
  );
}
