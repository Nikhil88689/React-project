import { X } from 'lucide-react';
import { Dialog as D } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

const overlay = 'fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in';

interface ContentProps {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onInteractOutside?: (e: Event) => void;
}

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export function DialogContent({ title, description, children, footer, className, size = 'md', onInteractOutside }: ContentProps) {
  return (
    <D.Portal>
      <D.Overlay className={overlay} />
      <D.Content
        onInteractOutside={onInteractOutside}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 flex max-h-[min(90vh,860px)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl shadow-slate-900/10 outline-none data-[state=open]:animate-pop-in',
          SIZES[size],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-1">
          <div className="min-w-0">
            <D.Title className="text-base font-semibold tracking-tight">{title}</D.Title>
            {description ? <D.Description className="mt-1 text-sm text-muted-foreground">{description}</D.Description> : <D.Description className="sr-only">{String(title)}</D.Description>}
          </div>
          <D.Close className="-mr-2 rounded-md p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground" aria-label="Close">
            <X className="size-4" />
          </D.Close>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-3.5">{footer}</div>}
      </D.Content>
    </D.Portal>
  );
}

export function SheetContent({ title, description, children, footer, className, side = 'right' }: Omit<ContentProps, 'size'> & { side?: 'right' | 'left' }) {
  return (
    <D.Portal>
      <D.Overlay className={overlay} />
      <D.Content
        className={cn(
          'fixed inset-y-0 z-50 flex w-full max-w-md flex-col border-border bg-popover shadow-2xl outline-none',
          side === 'right' ? 'right-0 border-l data-[state=open]:animate-slide-in-right' : 'left-0 border-r data-[state=open]:animate-slide-in-left',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <D.Title className="text-base font-semibold">{title}</D.Title>
            {description ? <D.Description className="mt-0.5 text-sm text-muted-foreground">{description}</D.Description> : <D.Description className="sr-only">{String(title)}</D.Description>}
          </div>
          <D.Close className="rounded-md p-1.5 text-muted-foreground hover:bg-accent" aria-label="Close">
            <X className="size-4" />
          </D.Close>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
      </D.Content>
    </D.Portal>
  );
}
