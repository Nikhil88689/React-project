import type { Permission } from '@recruitflow/shared';
import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { ConfirmHost, FullPageSpinner } from '@/components/ui/feedback';
import { GuestOnly, RequireAuth, RequireWorkspace, SessionExpiredDialog, useAuthBootstrap } from '@/features/auth/guards';
import { ForbiddenPage, NetworkErrorPage, NotFoundPage, RouteErrorBoundary, ServerErrorPage } from '@/features/errors/ErrorPages';

function page<M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M) {
  const C = lazy(() => load().then((m) => ({ default: m[name] as ComponentType })));
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <C />
    </Suspense>
  );
}

const guard = (permission: Permission, el: ReactNode) => <RequireAuth permission={permission}>{el}</RequireAuth>;

function Root() {
  useAuthBootstrap();
  return (
    <>
      <Outlet />
      <SessionExpiredDialog />
      <ConfirmHost />
    </>
  );
}

export const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: '/', element: page(() => import('@/features/landing/LandingPage'), 'LandingPage') },
      { path: '/careers/:companySlug', element: page(() => import('@/features/public/CareersPage'), 'CareersPage') },
      { path: '/careers/:companySlug/:jobSlug', element: page(() => import('@/features/public/PublicJobPage'), 'PublicJobPage') },
      { path: '/careers/:companySlug/:jobSlug/apply', element: page(() => import('@/features/public/ApplyPage'), 'ApplyPage') },
      { path: '/track/:token', element: page(() => import('@/features/public/TrackApplicationPage'), 'TrackApplicationPage') },
      { path: '/accept-invite', element: page(() => import('@/features/auth/AcceptInvitePage'), 'AcceptInvitePage') },
      { path: '/reset-password', element: page(() => import('@/features/auth/ResetPasswordPage'), 'ResetPasswordPage') },
      {
        element: <GuestOnly />,
        children: [
          { path: '/login', element: page(() => import('@/features/auth/LoginPage'), 'LoginPage') },
          { path: '/register', element: page(() => import('@/features/auth/RegisterPage'), 'RegisterPage') },
          { path: '/forgot-password', element: page(() => import('@/features/auth/ForgotPasswordPage'), 'ForgotPasswordPage') },
        ],
      },
      {
        element: <RequireWorkspace />,
        children: [
          { path: '/onboarding', element: page(() => import('@/features/onboarding/OnboardingPage'), 'OnboardingPage') },
          {
            element: <AppLayout />,
            children: [
              { path: '/dashboard', element: page(() => import('@/features/dashboard/DashboardPage'), 'DashboardPage') },
              { path: '/jobs', element: guard('jobs:view', page(() => import('@/features/jobs/JobsPage'), 'JobsPage')) },
              { path: '/jobs/new', element: guard('jobs:create', page(() => import('@/features/jobs/JobWizardPage'), 'JobWizardPage')) },
              { path: '/jobs/:id', element: guard('jobs:view', page(() => import('@/features/jobs/JobDetailPage'), 'JobDetailPage')) },
              { path: '/jobs/:id/edit', element: guard('jobs:update', page(() => import('@/features/jobs/JobWizardPage'), 'JobWizardPage')) },
              { path: '/candidates', element: guard('candidates:view', page(() => import('@/features/candidates/CandidatesPage'), 'CandidatesPage')) },
              { path: '/candidates/:id', element: guard('candidates:view', page(() => import('@/features/candidates/CandidateProfilePage'), 'CandidateProfilePage')) },
              { path: '/pipeline', element: guard('applications:view', page(() => import('@/features/pipeline/PipelinePage'), 'PipelinePage')) },
              { path: '/interviews', element: guard('interviews:view', page(() => import('@/features/interviews/InterviewsPage'), 'InterviewsPage')) },
              { path: '/interviews/:id', element: guard('interviews:view', page(() => import('@/features/interviews/InterviewDetailPage'), 'InterviewDetailPage')) },
              { path: '/talent-pools', element: guard('talentpool:manage', page(() => import('@/features/talent-pools/TalentPoolsPage'), 'TalentPoolsPage')) },
              { path: '/analytics', element: guard('analytics:view', page(() => import('@/features/analytics/AnalyticsPage'), 'AnalyticsPage')) },
              { path: '/team', element: guard('team:view', page(() => import('@/features/team/TeamPage'), 'TeamPage')) },
              { path: '/audit-logs', element: guard('audit:view', page(() => import('@/features/audit/AuditLogPage'), 'AuditLogPage')) },
              { path: '/billing', element: <Navigate to="/settings/billing" replace /> },
              { path: '/settings', element: <Navigate to="/settings/profile" replace /> },
              { path: '/settings/:tab', element: page(() => import('@/features/settings/SettingsPage'), 'SettingsPage') },
              { path: '/403', element: <ForbiddenPage embedded /> },
            ],
          },
        ],
      },
      { path: '/portal', element: <RequireAuth roles={['CANDIDATE']}>{page(() => import('@/features/portal/PortalPage'), 'PortalPage')}</RequireAuth> },
      { path: '/admin', element: <RequireAuth roles={['SUPER_ADMIN']}>{page(() => import('@/features/admin/AdminPage'), 'AdminPage')}</RequireAuth> },
      { path: '/offline', element: <NetworkErrorPage /> },
      { path: '/500', element: <ServerErrorPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
