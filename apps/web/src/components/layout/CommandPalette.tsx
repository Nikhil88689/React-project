import type { SearchResultsDTO } from '@recruitflow/shared';
import { useQuery } from '@tanstack/react-query';
import { Command } from 'cmdk';
import { Dialog as D } from 'radix-ui';
import { BarChart3, Briefcase, CalendarPlus, CalendarDays, FileUser, KanbanSquare, LayoutDashboard, Plus, Search, Settings, Sparkles, UserPlus, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Kbd, Spinner } from '@/components/ui/feedback';
import { useDebounce, useHotkey } from '@/hooks';
import { api } from '@/lib/api';
import { formatDay, formatTime } from '@/lib/utils';
import { usePermission } from '@/stores/auth';
import { useUi } from '@/stores/ui';

function Item({ icon, children, hint, onSelect, value }: { icon: ReactNode; children: ReactNode; hint?: ReactNode; onSelect: () => void; value: string }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-default items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground aria-selected:bg-accent [&_svg]:size-4 [&_svg]:text-muted-foreground"
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="shrink-0 text-xs text-muted-foreground">{hint}</span>}
    </Command.Item>
  );
}

const groupCls = '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground/80';

export function CommandPalette() {
  const open = useUi((s) => s.commandOpen);
  const setOpen = useUi((s) => s.setCommandOpen);
  const openAssistant = useUi((s) => s.openAssistant);
  const navigate = useNavigate();
  const can = usePermission();
  const [query, setQuery] = useState('');
  const q = useDebounce(query.trim(), 200);

  useHotkey(
    'k',
    (e) => {
      e.preventDefault();
      setOpen(!useUi.getState().commandOpen);
    },
    { meta: true },
  );

  const { data, isFetching } = useQuery({
    queryKey: ['search', q],
    queryFn: ({ signal }) => api.get<SearchResultsDTO>('/search', { q }, signal),
    enabled: open && q.length >= 2 && can('candidates:view'),
    staleTime: 10_000,
  });

  const go = (path: string) => {
    setOpen(false);
    setQuery('');
    navigate(path);
  };

  const hasResults = data && (data.candidates.length || data.jobs.length || data.applications.length || data.interviews.length);

  return (
    <D.Root open={open} onOpenChange={(o) => (setOpen(o), !o && setQuery(''))}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <D.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl shadow-slate-900/20 outline-none">
          <D.Title className="sr-only">Command centre</D.Title>
          <D.Description className="sr-only">Search RecruitFlow or run a quick action</D.Description>
          <Command shouldFilter={false} loop className="flex flex-col">
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="size-4 text-muted-foreground" />
              <Command.Input value={query} onValueChange={setQuery} placeholder="Search candidates, jobs, interviews… or ask AI" className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground" />
              {isFetching ? <Spinner className="size-4" /> : <Kbd>Esc</Kbd>}
            </div>
            <Command.List className="scrollbar-thin max-h-[60vh] overflow-y-auto p-2">
              {query.trim() && can('ai:use') && (
                <Command.Group heading="AI" className={groupCls}>
                  <Item value="ask-ai" icon={<Sparkles className="!text-violet-500" />} onSelect={() => (openAssistant(query.trim()), setQuery(''))} hint="Enter">
                    Ask RecruitFlow AI: <span className="font-medium">“{query.trim()}”</span>
                  </Item>
                </Command.Group>
              )}

              {hasResults ? (
                <>
                  {data!.candidates.length > 0 && (
                    <Command.Group heading="Candidates" className={groupCls}>
                      {data!.candidates.map((c) => (
                        <Item key={c.id} value={`c-${c.id}`} icon={<FileUser />} onSelect={() => go(`/candidates/${c.id}`)} hint={c.headline}>
                          {c.name}
                        </Item>
                      ))}
                    </Command.Group>
                  )}
                  {data!.jobs.length > 0 && (
                    <Command.Group heading="Jobs" className={groupCls}>
                      {data!.jobs.map((j) => (
                        <Item key={j.id} value={`j-${j.id}`} icon={<Briefcase />} onSelect={() => go(`/jobs/${j.id}`)} hint={`${j.department} · ${j.status.toLowerCase()}`}>
                          {j.title}
                        </Item>
                      ))}
                    </Command.Group>
                  )}
                  {data!.applications.length > 0 && (
                    <Command.Group heading="Applications" className={groupCls}>
                      {data!.applications.map((a) => (
                        <Item key={a.id} value={`a-${a.id}`} icon={<KanbanSquare />} onSelect={() => go(`/candidates/${a.candidateId}`)} hint={a.stageName}>
                          {a.candidateName} <span className="text-muted-foreground">→ {a.jobTitle}</span>
                        </Item>
                      ))}
                    </Command.Group>
                  )}
                  {data!.interviews.length > 0 && (
                    <Command.Group heading="Interviews" className={groupCls}>
                      {data!.interviews.map((i) => (
                        <Item key={i.id} value={`i-${i.id}`} icon={<CalendarDays />} onSelect={() => go(`/interviews/${i.id}`)} hint={`${formatDay(i.startsAt)} ${formatTime(i.startsAt)}`}>
                          {i.title} · {i.candidateName}
                        </Item>
                      ))}
                    </Command.Group>
                  )}
                </>
              ) : q.length >= 2 && !isFetching ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matches for “{q}”.</p>
              ) : null}

              {!q && (
                <>
                  <Command.Group heading="Quick actions" className={groupCls}>
                    {can('jobs:create') && <Item value="new-job" icon={<Plus />} onSelect={() => go('/jobs/new')}>Create a job</Item>}
                    {can('candidates:create') && <Item value="new-candidate" icon={<UserPlus />} onSelect={() => go('/candidates?new=1')}>Add a candidate</Item>}
                    {can('interviews:create') && <Item value="schedule" icon={<CalendarPlus />} onSelect={() => go('/interviews?schedule=1')}>Schedule an interview</Item>}
                    {can('ai:use') && <Item value="ai" icon={<Sparkles />} onSelect={() => openAssistant()}>Open AI assistant</Item>}
                  </Command.Group>
                  <Command.Group heading="Go to" className={groupCls}>
                    <Item value="dash" icon={<LayoutDashboard />} onSelect={() => go('/dashboard')}>Dashboard</Item>
                    {can('jobs:view') && <Item value="jobs" icon={<Briefcase />} onSelect={() => go('/jobs')}>Jobs</Item>}
                    {can('candidates:view') && <Item value="cands" icon={<Users />} onSelect={() => go('/candidates')}>Candidates</Item>}
                    {can('applications:view') && <Item value="pipe" icon={<KanbanSquare />} onSelect={() => go('/pipeline')}>Pipeline</Item>}
                    {can('interviews:view') && <Item value="ints" icon={<CalendarDays />} onSelect={() => go('/interviews')}>Interviews</Item>}
                    {can('analytics:view') && <Item value="analytics" icon={<BarChart3 />} onSelect={() => go('/analytics')}>Analytics</Item>}
                    <Item value="settings" icon={<Settings />} onSelect={() => go('/settings')}>Settings</Item>
                  </Command.Group>
                </>
              )}
            </Command.List>
            <div className="flex items-center gap-4 border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
              <span className="flex items-center gap-1"><Kbd>↵</Kbd> open</span>
              <span className="ml-auto flex items-center gap-1"><Sparkles className="size-3 text-violet-500" /> Type a question to ask AI</span>
            </div>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
