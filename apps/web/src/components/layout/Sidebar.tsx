import { PLANS, type BillingOverviewDTO } from '@recruitflow/shared';
import { useQuery } from '@tanstack/react-query';
import { ChevronsLeft, Sparkles } from 'lucide-react';
import { NavLink } from 'react-router';
import { Logo } from '@/components/domain';
import { Progress } from '@/components/ui/controls';
import { Tooltip } from '@/components/ui/menu';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuth, usePermission } from '@/stores/auth';
import { useUi } from '@/stores/ui';
import { MAIN_NAV, WORKSPACE_NAV, type NavItem } from './nav';

function NavSection({ title, items, collapsed, onNavigate }: { title: string; items: NavItem[]; collapsed: boolean; onNavigate?: () => void }) {
  const can = usePermission();
  const visible = items.filter((i) => !i.permission || can(i.permission));
  if (!visible.length) return null;
  return (
    <div className="space-y-0.5">
      {!collapsed && <p className="px-3 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{title}</p>}
      {collapsed && <div className="my-3 mx-3 h-px bg-border" />}
      {visible.map((item) => {
        const link = (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                isActive && 'bg-primary-soft text-primary-soft-foreground hover:bg-primary-soft hover:text-primary-soft-foreground',
                collapsed && 'justify-center px-0',
              )
            }
          >
            <item.icon className="size-[18px] shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        );
        return collapsed ? (
          <Tooltip key={item.to} content={item.label} side="right">
            {link}
          </Tooltip>
        ) : (
          link
        );
      })}
    </div>
  );
}

function PlanCard() {
  const can = usePermission();
  const { data } = useQuery({ queryKey: ['billing'], queryFn: () => api.get<BillingOverviewDTO>('/billing'), enabled: can('billing:view'), staleTime: 5 * 60_000 });
  if (!data) return null;
  const pct = Math.round((data.usage.activeJobs / data.limits.activeJobs) * 100);
  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-indigo-50 to-violet-50 p-3.5 dark:from-indigo-500/10 dark:to-violet-500/10">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold">{PLANS[data.plan].name} plan</p>
        {data.status === 'TRIALING' && <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-700">TRIAL</span>}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {data.usage.activeJobs} of {data.limits.activeJobs} active jobs
      </p>
      <Progress value={pct} className="mt-2 h-1.5 bg-white/70 dark:bg-white/10" />
      <NavLink to="/settings/billing" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
        <Sparkles className="size-3" /> Manage plan
      </NavLink>
    </div>
  );
}

export function SidebarContent({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const company = useAuth((s) => s.user?.company);
  const toggle = useUi((s) => s.toggleSidebar);
  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-16 items-center px-4', collapsed ? 'justify-center' : 'justify-between')}>
        <NavLink to="/dashboard" onClick={onNavigate} aria-label="RecruitFlow home">
          <Logo withText={!collapsed} />
        </NavLink>
        {!collapsed && (
          <button onClick={toggle} className="hidden rounded-md p-1 text-muted-foreground hover:bg-accent lg:block" aria-label="Collapse sidebar">
            <ChevronsLeft className="size-4" />
          </button>
        )}
      </div>
      {company && !collapsed && (
        <div className="mx-3 mb-1 flex items-center gap-2.5 rounded-lg border border-border bg-background/60 px-2.5 py-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-slate-900 text-xs font-bold text-white dark:bg-slate-700">{company.name[0]}</span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold leading-tight">{company.name}</p>
            <p className="text-[11px] text-muted-foreground">Workspace</p>
          </div>
        </div>
      )}
      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        <NavSection title="Recruiting" items={MAIN_NAV} collapsed={collapsed} onNavigate={onNavigate} />
        <NavSection title="Workspace" items={WORKSPACE_NAV} collapsed={collapsed} onNavigate={onNavigate} />
      </nav>
      {!collapsed && (
        <div className="p-3">
          <PlanCard />
        </div>
      )}
      {collapsed && (
        <button onClick={toggle} className="mx-auto mb-4 rounded-md p-2 text-muted-foreground hover:bg-accent" aria-label="Expand sidebar">
          <ChevronsLeft className="size-4 rotate-180" />
        </button>
      )}
    </div>
  );
}

export function Sidebar() {
  const collapsed = useUi((s) => s.sidebarCollapsed);
  return (
    <aside className={cn('sticky top-0 hidden h-screen shrink-0 border-r border-border bg-sidebar transition-[width] duration-200 lg:block', collapsed ? 'w-[72px]' : 'w-64')}>
      <SidebarContent collapsed={collapsed} />
    </aside>
  );
}
