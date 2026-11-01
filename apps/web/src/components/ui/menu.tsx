import { Check } from 'lucide-react';
import { DropdownMenu as M, Popover as P, Tooltip as T } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* ─────────────── Dropdown ─────────────── */

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;
export const MenuSub = M.Sub;

const surface = 'z-50 min-w-44 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl shadow-slate-900/10';

export function MenuContent({ className, align = 'end', sideOffset = 6, ...props }: ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content align={align} sideOffset={sideOffset} className={cn(surface, className)} {...props} />
    </M.Portal>
  );
}

const itemCls =
  'relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors data-[highlighted]:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground';

export function MenuItem({ className, destructive, ...props }: ComponentProps<typeof M.Item> & { destructive?: boolean }) {
  return <M.Item className={cn(itemCls, destructive && 'text-destructive data-[highlighted]:bg-destructive/10 [&_svg]:text-destructive', className)} {...props} />;
}

export function MenuCheckItem({ checked, children, ...props }: ComponentProps<typeof M.CheckboxItem>) {
  return (
    <M.CheckboxItem checked={checked} className={cn(itemCls, 'pl-7')} {...props}>
      <M.ItemIndicator className="absolute left-2">
        <Check className="size-4" />
      </M.ItemIndicator>
      {children}
    </M.CheckboxItem>
  );
}

export function MenuSubTrigger({ className, ...props }: ComponentProps<typeof M.SubTrigger>) {
  return <M.SubTrigger className={cn(itemCls, 'data-[state=open]:bg-accent', className)} {...props} />;
}

export function MenuSubContent({ className, ...props }: ComponentProps<typeof M.SubContent>) {
  return (
    <M.Portal>
      <M.SubContent sideOffset={6} className={cn(surface, className)} {...props} />
    </M.Portal>
  );
}

export const MenuLabel = ({ children }: { children: ReactNode }) => <M.Label className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{children}</M.Label>;
export const MenuSeparator = () => <M.Separator className="-mx-1 my-1 h-px bg-border" />;

/* ─────────────── Popover ─────────────── */

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverClose = P.Close;

export function PopoverContent({ className, align = 'end', sideOffset = 8, ...props }: ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content align={align} sideOffset={sideOffset} className={cn('z-50 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl shadow-slate-900/10 outline-none', className)} {...props} />
    </P.Portal>
  );
}

/* ─────────────── Tooltip ─────────────── */

export const TooltipProvider = T.Provider;

export function Tooltip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'right' | 'bottom' | 'left' }) {
  return (
    <T.Root delayDuration={250}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content side={side} sideOffset={6} className="z-[60] max-w-xs rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-lg dark:bg-slate-700">
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
