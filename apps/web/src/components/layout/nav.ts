import type { Permission } from '@recruitflow/shared';
import {
  BarChart3,
  Briefcase,
  CalendarDays,
  FolderHeart,
  KanbanSquare,
  LayoutDashboard,
  ScrollText,
  Settings,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  permission?: Permission;
}

export const MAIN_NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/jobs', label: 'Jobs', icon: Briefcase, permission: 'jobs:view' },
  { to: '/candidates', label: 'Candidates', icon: Users, permission: 'candidates:view' },
  { to: '/pipeline', label: 'Pipeline', icon: KanbanSquare, permission: 'applications:view' },
  { to: '/interviews', label: 'Interviews', icon: CalendarDays, permission: 'interviews:view' },
  { to: '/talent-pools', label: 'Talent Pools', icon: FolderHeart, permission: 'talentpool:manage' },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, permission: 'analytics:view' },
];

export const WORKSPACE_NAV: NavItem[] = [
  { to: '/team', label: 'Team', icon: UsersRound, permission: 'team:view' },
  { to: '/audit-logs', label: 'Audit Log', icon: ScrollText, permission: 'audit:view' },
  { to: '/settings', label: 'Settings', icon: Settings },
];
