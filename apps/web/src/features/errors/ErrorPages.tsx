import { ArrowLeft, Compass, Home, LockKeyhole, RefreshCw, ServerCrash, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, isRouteErrorResponse, useNavigate, useRouteError } from 'react-router';
import { Logo } from '@/components/domain';
import { Button } from '@/components/ui/button';
import { isApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

function ErrorLayout({ code, icon, title, description, actions, embedded, details }: { code?: string; icon: ReactNode; title: string; description: string; actions: ReactNode; embedded?: boolean; details?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 text-center', embedded ? 'min-h-[60vh]' : 'min-h-screen bg-background')}>
      {!embedded && (
        <Link to="/" className="absolute left-6 top-6">
          <Logo />
        </Link>
      )}
      <div className="relative mb-6">
        <div className="absolute inset-0 -m-6 rounded-full bg-primary-soft blur-2xl" />
        <div className="relative flex size-16 items-center justify-center rounded-2xl border border-border bg-card shadow-sm [&_svg]:size-7 [&_svg]:text-primary">{icon}</div>
      </div>
      {code && <p className="text-sm font-semibold tracking-widest text-primary">{code}</p>}
      <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      <p className="mt-2 max-w-md text-[15px] text-muted-foreground">{description}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">{actions}</div>
      {details && <p className="mt-6 font-mono text-xs text-muted-foreground">{details}</p>}
    </div>
  );
}

const Back = () => {
  const navigate = useNavigate();
  return (
    <Button variant="outline" onClick={() => navigate(-1)}>
      <ArrowLeft /> Go back
    </Button>
  );
};

const HomeBtn = () => (
  <Button asChild>
    <Link to="/dashboard">
      <Home /> Back to dashboard
    </Link>
  </Button>
);

export const NotFoundPage = ({ embedded }: { embedded?: boolean }) => (
  <ErrorLayout embedded={embedded} code="404" icon={<Compass />} title="We couldn't find that page" description="The link may be broken, or the page may have been moved or removed." actions={<><Back /><HomeBtn /></>} />
);

export const ForbiddenPage = ({ embedded }: { embedded?: boolean }) => (
  <ErrorLayout
    embedded={embedded}
    code="403"
    icon={<LockKeyhole />}
    title="You don't have access to this"
    description="Your role doesn't include permission for this page. Ask a workspace admin if you think you should have access."
    actions={<><Back /><HomeBtn /></>}
  />
);

export const ServerErrorPage = ({ embedded, requestId }: { embedded?: boolean; requestId?: string }) => (
  <ErrorLayout
    embedded={embedded}
    code="500"
    icon={<ServerCrash />}
    title="Something went wrong on our side"
    description="We've logged the problem. Try again in a moment — if it keeps happening, contact support with the reference below."
    details={requestId ? `Reference: ${requestId}` : undefined}
    actions={
      <Button onClick={() => window.location.reload()}>
        <RefreshCw /> Reload page
      </Button>
    }
  />
);

export const NetworkErrorPage = ({ embedded }: { embedded?: boolean }) => (
  <ErrorLayout
    embedded={embedded}
    icon={<WifiOff />}
    title="You're offline"
    description="We can't reach RecruitFlow right now. Check your internet connection and we'll pick up where you left off."
    actions={
      <Button onClick={() => window.location.reload()}>
        <RefreshCw /> Try again
      </Button>
    }
  />
);

export function RouteErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  if (isApiError(error)) {
    if (error.status === 0) return <NetworkErrorPage />;
    if (error.status === 403) return <ForbiddenPage />;
    if (error.status === 404) return <NotFoundPage />;
    return <ServerErrorPage requestId={error.requestId} />;
  }
  if (error instanceof Error && /Failed to fetch dynamically imported module|Importing a module script failed/.test(error.message)) {
    return <ServerErrorPage />;
  }
  console.error(error);
  return <ServerErrorPage />;
}

/** Inline handler for query errors on a page: maps API errors to the right full-page state. */
export function QueryErrorPage({ error }: { error: unknown }) {
  if (isApiError(error)) {
    if (error.status === 0) return <NetworkErrorPage embedded />;
    if (error.status === 403) return <ForbiddenPage embedded />;
    if (error.status === 404) return <NotFoundPage embedded />;
    return <ServerErrorPage embedded requestId={error.requestId} />;
  }
  return <ServerErrorPage embedded />;
}
