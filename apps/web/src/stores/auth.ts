import type { AuthUser, Permission } from '@recruitflow/shared';
import { create } from 'zustand';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthState {
  /** Access token lives only in memory; the refresh token is an httpOnly cookie the JS can't read. */
  accessToken: string | null;
  user: AuthUser | null;
  status: Status;
  sessionExpired: boolean;
  setSession: (accessToken: string, user: AuthUser) => void;
  setUser: (user: AuthUser) => void;
  setAccessToken: (token: string) => void;
  clear: (opts?: { expired?: boolean }) => void;
  dismissExpired: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  status: 'loading',
  sessionExpired: false,
  setSession: (accessToken, user) => set({ accessToken, user, status: 'authenticated', sessionExpired: false }),
  setUser: (user) => set({ user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  clear: (opts) => set({ accessToken: null, user: null, status: 'anonymous', sessionExpired: Boolean(opts?.expired) }),
  dismissExpired: () => set({ sessionExpired: false }),
}));

export const usePermission = () => {
  const permissions = useAuth((s) => s.user?.permissions);
  return (p: Permission | Permission[]) => {
    if (!permissions) return false;
    return Array.isArray(p) ? p.some((x) => permissions.includes(x)) : permissions.includes(p);
  };
};

export function homePathFor(user: AuthUser | null) {
  if (!user) return '/login';
  if (user.role === 'CANDIDATE') return '/portal';
  if (user.role === 'SUPER_ADMIN') return '/admin';
  if (user.company && !user.company.onboardingCompleted && user.role === 'COMPANY_ADMIN') return '/onboarding';
  return '/dashboard';
}
