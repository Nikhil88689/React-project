import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium [&_svg]:size-3', {
  variants: {
    variant: {
      default: 'border-transparent bg-primary-soft text-primary-soft-foreground',
      secondary: 'border-transparent bg-secondary text-secondary-foreground',
      outline: 'border-border text-foreground',
      success: 'border-transparent bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
      warning: 'border-transparent bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
      danger: 'border-transparent bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
      info: 'border-transparent bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
      violet: 'border-transparent bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    },
  },
  defaultVariants: { variant: 'default' },
});

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;

export function Badge({ className, variant, ...props }: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
