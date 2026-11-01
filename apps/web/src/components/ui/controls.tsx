import { Check, Minus } from 'lucide-react';
import { Checkbox as C, Progress as Pr, Switch as S, Tabs as T } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* ─────────────── Tabs ─────────────── */

export const Tabs = T.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof T.List>) {
  return <T.List className={cn('scrollbar-thin flex items-center gap-1 overflow-x-auto border-b border-border', className)} {...props} />;
}

export function TabsTrigger({ className, children, count, ...props }: ComponentProps<typeof T.Trigger> & { count?: number }) {
  return (
    <T.Trigger
      className={cn(
        'relative -mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground',
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined && <span className="rounded-full bg-muted px-1.5 py-px text-[11px] font-semibold text-muted-foreground">{count}</span>}
    </T.Trigger>
  );
}

export const TabsContent = ({ className, ...props }: ComponentProps<typeof T.Content>) => <T.Content className={cn('outline-none', className)} {...props} />;

/* ─────────────── Segmented control (pill tabs) ─────────────── */

export function Segmented<T extends string>({ value, onChange, options, className, size = 'sm' }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string; size?: 'sm' | 'xs' }) {
  return (
    <div role="radiogroup" className={cn('inline-flex items-center rounded-lg bg-muted p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md font-medium text-muted-foreground transition [&_svg]:size-3.5',
            size === 'sm' ? 'px-3 py-1 text-[13px]' : 'px-2 py-0.5 text-xs',
            value === o.value && 'bg-card text-foreground shadow-sm',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ─────────────── Switch / Checkbox / Progress ─────────────── */

export function Switch({ className, ...props }: ComponentProps<typeof S.Root>) {
  return (
    <S.Root
      className={cn('peer inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-input transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=checked]:bg-primary disabled:opacity-50', className)}
      {...props}
    >
      <S.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
    </S.Root>
  );
}

export function Checkbox({ className, checked, ...props }: ComponentProps<typeof C.Root>) {
  return (
    <C.Root
      checked={checked}
      className={cn('peer flex size-4 shrink-0 items-center justify-center rounded border border-input bg-card shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary text-white', className)}
      {...props}
    >
      <C.Indicator>{checked === 'indeterminate' ? <Minus className="size-3" /> : <Check className="size-3" strokeWidth={3} />}</C.Indicator>
    </C.Root>
  );
}

export function Progress({ value, className, indicatorClassName }: { value: number; className?: string; indicatorClassName?: string }) {
  return (
    <Pr.Root value={value} className={cn('relative h-2 w-full overflow-hidden rounded-full bg-muted', className)}>
      <Pr.Indicator className={cn('h-full rounded-full bg-primary transition-all duration-500', indicatorClassName)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </Pr.Root>
  );
}
