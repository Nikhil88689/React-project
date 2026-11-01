import { Avatar as AvatarPrimitive } from 'radix-ui';
import { cn, initials } from '@/lib/utils';

const PALETTE = [
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200',
  'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200',
];

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

const SIZES = { xs: 'size-6 text-[10px]', sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-lg', xl: 'size-20 text-2xl' };

export function Avatar({ name, src, size = 'sm', className }: { name: string; src?: string | null; size?: keyof typeof SIZES; className?: string }) {
  return (
    <AvatarPrimitive.Root className={cn('relative inline-flex shrink-0 overflow-hidden rounded-full ring-2 ring-card', SIZES[size], className)}>
      {src && <AvatarPrimitive.Image src={src} alt={name} className="size-full object-cover" />}
      <AvatarPrimitive.Fallback delayMs={src ? 400 : 0} className={cn('flex size-full items-center justify-center font-semibold', PALETTE[hash(name) % PALETTE.length])}>
        {initials(name)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

export function AvatarStack({ people, max = 3, size = 'xs' }: { people: { name: string; avatarUrl?: string | null }[]; max?: number; size?: keyof typeof SIZES }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="flex -space-x-1.5">
      {shown.map((p) => (
        <Avatar key={p.name} name={p.name} src={p.avatarUrl} size={size} />
      ))}
      {rest > 0 && <span className={cn('inline-flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ring-2 ring-card', SIZES[size])}>+{rest}</span>}
    </div>
  );
}
