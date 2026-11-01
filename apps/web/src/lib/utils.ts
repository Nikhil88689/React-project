import { clsx, type ClassValue } from 'clsx';
import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday } from 'date-fns';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fullName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`;

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export const formatCurrency = (n: number, currency = 'INR') =>
  currency === 'INR' ? inr.format(n) : new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);

/** ₹18L – ₹32L style salary ranges, which is how Indian recruiters read CTC. */
export function formatSalaryRange(min: number | null, max: number | null, currency = 'INR') {
  if (min == null && max == null) return null;
  const fmt = (n: number) => {
    if (currency !== 'INR') return formatCurrency(n, currency);
    if (n >= 10_000_000) return `₹${+(n / 10_000_000).toFixed(1)}Cr`;
    if (n >= 100_000) return `₹${+(n / 100_000).toFixed(1)}L`;
    return inr.format(n);
  };
  if (min != null && max != null) return `${fmt(min)} – ${fmt(max)}`;
  return min != null ? `From ${fmt(min)}` : `Up to ${fmt(max!)}`;
}

export const formatNumber = (n: number) => new Intl.NumberFormat('en-IN').format(n);

export const timeAgo = (iso: string) => formatDistanceToNowStrict(new Date(iso), { addSuffix: true });

export function formatDay(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEE, d MMM');
}

export const formatTime = (iso: string) => format(new Date(iso), 'h:mm a');
export const formatDate = (iso: string) => format(new Date(iso), 'd MMM yyyy');
export const formatDateTime = (iso: string) => format(new Date(iso), "d MMM yyyy, h:mm a");

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export const formatBytes = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`;

export const pluralize = (n: number, word: string, plural = `${word}s`) => `${formatNumber(n)} ${n === 1 ? word : plural}`;

export function matchTone(score: number | null | undefined) {
  if (score == null) return 'text-muted-foreground bg-muted';
  if (score >= 85) return 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/15';
  if (score >= 70) return 'text-indigo-700 bg-indigo-50 dark:text-indigo-300 dark:bg-indigo-500/15';
  if (score >= 50) return 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/15';
  return 'text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-500/15';
}

export const stripHtml = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
