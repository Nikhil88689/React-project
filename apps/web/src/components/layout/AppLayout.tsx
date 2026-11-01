import { Suspense } from 'react';
import { Outlet, ScrollRestoration } from 'react-router';
import { FullPageSpinner } from '@/components/ui/feedback';
import { useRealtime } from '@/hooks/useRealtime';
import { usePermission } from '@/stores/auth';
import { AiAssistant } from './AiAssistant';
import { CommandPalette } from './CommandPalette';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppLayout() {
  useRealtime();
  const can = usePermission();
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1440px]">
            <Suspense fallback={<FullPageSpinner />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      <CommandPalette />
      {can('ai:use') && <AiAssistant />}
      <ScrollRestoration />
    </div>
  );
}
