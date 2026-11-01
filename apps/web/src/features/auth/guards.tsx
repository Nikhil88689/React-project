import type { Permission, Role } from '@recruitflow/shared';
import { LogIn } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FullPageSpinner } from '@/components/ui/feedback';
import { refreshSession } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { homePathFor, useAuth } from '@/stores/auth';
import { ForbiddenPage } from '@/features/errors/ErrorPages';

let bootstrapped = false;

/** Restores the session from the httpOnly refresh cookie on first load. */
export function useAuthBootstrap() {
  useEffect(() => {
    if (bootstrapped) return;
    bootstrapped = true;
    refreshSession().then((ok) => {
      if (!ok) useAuth.getState().clear();
    });
  }, []);
}

export function RequireAuth({ roles, permission, children }: { roles?: Role[]; permission?: Permission; children?: ReactNode }) {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'anonymous' || !user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homePathFor(user)} replace />;
  if (permission && !user.permissions.includes(permission)) return <ForbiddenPage embedded />;
  return children ?? <Outlet />;
}

/** Workspace routes: company members only; candidates and platform admins have their own areas. */
export function RequireWorkspace() {
  const user = useAuth((s) => s.user);
  const location = useLocation();
  return (
    <RequireAuth roles={['COMPANY_ADMIN', 'RECRUITER', 'INTERVIEWER']}>
      {user?.company && !user.company.onboardingCompleted && user.role === 'COMPANY_ADMIN' && location.pathname !== '/onboarding' ? <Navigate to="/onboarding" replace /> : <Outlet />}
    </RequireAuth>
  );
}

export function GuestOnly() {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'authenticated' && user) {
    const next = new URLSearchParams(location.search).get('next');
    return <Navigate to={next && next.startsWith('/') && !next.startsWith('//') ? next : homePathFor(user)} replace />;
  }
  return <Outlet />;
}

export function SessionExpiredDialog() {
  const expired = useAuth((s) => s.sessionExpired);
  const dismiss = useAuth((s) => s.dismissExpired);
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (expired) queryClient.clear();
  }, [expired]);
  const signIn = () => {
    dismiss();
    navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
  };
  return (
    <Dialog open={expired} onOpenChange={(o) => !o && signIn()}>
      <DialogContent
        size="sm"
        title="Your session has expired"
        description="For your security we signed you out. Sign in again to pick up where you left off."
        footer={
          <Button onClick={signIn}>
            <LogIn /> Sign in again
          </Button>
        }
      >
        {null}
      </DialogContent>
    </Dialog>
  );
}
