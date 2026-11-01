import { MutationCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { errorMessage, isApiError } from './api';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: { silent?: boolean; success?: string };
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (count, err) => {
        if (isApiError(err) && err.status >= 400 && err.status < 500) return false;
        return count < 2;
      },
    },
  },
  mutationCache: new MutationCache({
    onSuccess: (_data, _vars, _ctx, mutation) => {
      if (mutation.meta?.success) toast.success(mutation.meta.success);
    },
    onError: (err, _vars, _ctx, mutation) => {
      if (mutation.meta?.silent || mutation.options.onError) return;
      if (isApiError(err) && err.code === 'PLAN_LIMIT_REACHED') {
        toast.error(err.message, { action: { label: 'Upgrade', onClick: () => (window.location.href = '/settings/billing') } });
        return;
      }
      toast.error(errorMessage(err));
    },
  }),
});
