import { ROLE_LABELS, type NotificationDTO } from '@recruitflow/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BriefcaseBusiness, CalendarClock, CheckCheck, FileCheck2, LogOut, Menu as MenuIcon, MessageSquareText, Monitor, Moon, Search, Settings, Sparkles, Sun, UserRound, UserPlus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/controls';
import { Dialog, SheetContent } from '@/components/ui/dialog';
import { EmptyState, Kbd, Spinner } from '@/components/ui/feedback';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Popover, PopoverContent, PopoverTrigger } from '@/components/ui/menu';
import { api } from '@/lib/api';
import { cn, fullName, timeAgo } from '@/lib/utils';
import { useAuth } from '@/stores/auth';
import { useUi, type Theme } from '@/stores/ui';
import { SidebarContent } from './Sidebar';

type NotificationPage = { items: NotificationDTO[]; unread: number; nextCursor: string | null };

const NOTIFICATION_ICONS: Record<string, typeof Bell> = {
  CANDIDATE_APPLIED: UserPlus,
  CANDIDATE_MOVED: BriefcaseBusiness,
  INTERVIEW_SCHEDULED: CalendarClock,
  INTERVIEW_REMINDER: CalendarClock,
  FEEDBACK_SUBMITTED: MessageSquareText,
  RESUME_PARSED: FileCheck2,
};

function NotificationBell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['notifications'], queryFn: () => api.get<NotificationPage>('/notifications', { limit: 20 }), refetchInterval: 120_000 });
  const markAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onMutate: () => qc.setQueryData<NotificationPage>(['notifications'], (old) => old && { ...old, unread: 0, items: old.items.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) }),
  });
  const markOne = useMutation({ mutationFn: (id: string) => api.patch(`/notifications/${id}/read`), meta: { silent: true } });

  const open = (n: NotificationDTO) => {
    if (!n.readAt) {
      markOne.mutate(n.id);
      qc.setQueryData<NotificationPage>(['notifications'], (old) => old && { ...old, unread: Math.max(0, old.unread - 1), items: old.items.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)) });
    }
    if (n.link) navigate(n.link);
  };

  const unread = data?.unread ?? 0;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}>
          <Bell className="size-[18px]" />
          {unread > 0 && <span className="absolute right-1.5 top-1.5 flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-card">{unread > 9 ? '9+' : unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <button onClick={() => markAll.mutate()} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <CheckCheck className="size-3.5" /> Mark all read
            </button>
          )}
        </div>
        <div className="scrollbar-thin max-h-[420px] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : !data?.items.length ? (
            <EmptyState compact icon={Bell} title="You're all caught up" description="New applications, interviews and feedback will show up here." />
          ) : (
            data.items.map((n) => {
              const Icon = NOTIFICATION_ICONS[n.type] ?? Bell;
              return (
                <button key={n.id} onClick={() => open(n)} className={cn('flex w-full gap-3 border-b border-border/60 px-4 py-3 text-left transition hover:bg-accent/60', !n.readAt && 'bg-primary-soft/40')}>
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium leading-snug">{n.title}</span>
                    {n.body && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{n.body}</span>}
                    <span className="mt-1 block text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.readAt && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const THEME_OPTIONS: { value: Theme; label: ReactNode }[] = [
  { value: 'light', label: <Sun aria-label="Light" /> },
  { value: 'dark', label: <Moon aria-label="Dark" /> },
  { value: 'system', label: <Monitor aria-label="System" /> },
];

export function ThemeSwitch({ className }: { className?: string }) {
  const theme = useUi((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);
  return <Segmented size="xs" value={theme} onChange={setTheme} options={THEME_OPTIONS} className={className} />;
}

export function UserMenu() {
  const user = useAuth((s) => s.user)!;
  const navigate = useNavigate();
  const logout = async () => {
    await api.post('/auth/logout', {}, { noRefresh: true }).catch(() => undefined);
    useAuth.getState().clear();
    navigate('/login');
  };
  const name = fullName(user);
  return (
    <Menu>
      <MenuTrigger asChild>
        <button className="flex items-center gap-2.5 rounded-lg p-1 pr-2 transition hover:bg-accent" aria-label="Account menu">
          <Avatar name={name} src={user.avatarUrl} size="sm" />
          <span className="hidden text-left md:block">
            <span className="block text-[13px] font-semibold leading-tight">{name}</span>
            <span className="block text-[11px] text-muted-foreground">{ROLE_LABELS[user.role]}</span>
          </span>
        </button>
      </MenuTrigger>
      <MenuContent className="w-60">
        <div className="px-2 py-2">
          <p className="text-sm font-semibold">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <MenuSeparator />
        {user.company && (
          <>
            <MenuItem onSelect={() => navigate('/settings/profile')}>
              <UserRound /> Profile
            </MenuItem>
            <MenuItem onSelect={() => navigate('/settings')}>
              <Settings /> Settings
            </MenuItem>
          </>
        )}
        <MenuSeparator />
        <MenuLabel>Theme</MenuLabel>
        <div className="px-2 pb-2">
          <ThemeSwitch className="w-full justify-between" />
        </div>
        <MenuSeparator />
        <MenuItem onSelect={logout}>
          <LogOut /> Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

export function Topbar() {
  const setCommandOpen = useUi((s) => s.setCommandOpen);
  const openAssistant = useUi((s) => s.openAssistant);
  const mobileNavOpen = useUi((s) => s.mobileNavOpen);
  const setMobileNav = useUi((s) => s.setMobileNav);
  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
  const canAi = useAuth((s) => s.user?.permissions.includes('ai:use'));

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
      <Dialog open={mobileNavOpen} onOpenChange={setMobileNav}>
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open navigation">
          <MenuIcon className="size-5" />
        </Button>
        <SheetContent side="left" title="Navigation" className="max-w-72 [&>div:first-child]:hidden">
          <SidebarContent onNavigate={() => setMobileNav(false)} />
        </SheetContent>
      </Dialog>

      <button
        onClick={() => setCommandOpen(true)}
        className="group flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground shadow-xs transition hover:border-ring/40"
      >
        <Search className="size-4" />
        <span className="flex-1 truncate text-left">Search candidates, jobs, interviews…</span>
        <span className="hidden items-center gap-0.5 sm:flex">
          <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        {canAi && (
          <Button variant="soft" size="sm" className="hidden md:inline-flex" onClick={() => openAssistant()}>
            <Sparkles /> Ask AI
          </Button>
        )}
        <NotificationBell />
        <div className="mx-1 hidden h-6 w-px bg-border sm:block" />
        <UserMenu />
      </div>
    </header>
  );
}