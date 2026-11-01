import { STAGE_LABELS, type JobStatus, type StageType } from '@recruitflow/shared';
import DOMPurify from 'dompurify';
import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn, matchTone } from '@/lib/utils';
import { Badge, type BadgeVariant } from './ui/badge';

export const STAGE_STYLES: Record<StageType, { dot: string; badge: BadgeVariant; bar: string }> = {
  APPLIED: { dot: 'bg-slate-400', badge: 'secondary', bar: '#94a3b8' },
  SCREENING: { dot: 'bg-sky-500', badge: 'info', bar: '#0ea5e9' },
  SHORTLISTED: { dot: 'bg-violet-500', badge: 'violet', bar: '#8b5cf6' },
  INTERVIEW: { dot: 'bg-indigo-500', badge: 'default', bar: '#6366f1' },
  OFFER: { dot: 'bg-amber-500', badge: 'warning', bar: '#f59e0b' },
  HIRED: { dot: 'bg-emerald-500', badge: 'success', bar: '#10b981' },
  REJECTED: { dot: 'bg-rose-500', badge: 'danger', bar: '#f43f5e' },
};

export function StageBadge({ type, name, className }: { type: StageType; name?: string; className?: string }) {
  return (
    <Badge variant={STAGE_STYLES[type].badge} className={className}>
      <span className={cn('size-1.5 rounded-full', STAGE_STYLES[type].dot)} />
      {name ?? STAGE_LABELS[type]}
    </Badge>
  );
}

const JOB_STATUS: Record<JobStatus, { label: string; variant: BadgeVariant }> = {
  PUBLISHED: { label: 'Published', variant: 'success' },
  DRAFT: { label: 'Draft', variant: 'secondary' },
  CLOSED: { label: 'Closed', variant: 'danger' },
  ARCHIVED: { label: 'Archived', variant: 'outline' },
};

export const JobStatusBadge = ({ status }: { status: JobStatus }) => <Badge variant={JOB_STATUS[status].variant}>{JOB_STATUS[status].label}</Badge>;

export function MatchScore({ score, size = 'sm', className }: { score: number | null | undefined; size?: 'sm' | 'md'; className?: string }) {
  if (score == null) return <span className={cn('text-xs text-muted-foreground', className)}>—</span>;
  return (
    <span
      title="AI match score — an assistive signal, not a hiring decision"
      className={cn('inline-flex items-center gap-1 rounded-full font-semibold tabular-nums', size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm', matchTone(score), className)}
    >
      <Sparkles className={size === 'sm' ? 'size-3' : 'size-3.5'} />
      {score}%
    </span>
  );
}

/** Circular score gauge used on profile and evaluation screens. */
export function ScoreRing({ score, size = 88, stroke = 8, label = 'match' }: { score: number; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = score >= 85 ? '#10b981' : score >= 70 ? '#6366f1' : score >= 50 ? '#f59e0b' : '#f43f5e';
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-muted)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-xl font-bold tabular-nums leading-none">{score}%</span>
        <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

/** Rich text from the API is sanitized server-side; DOMPurify here is defence in depth. */
export function RichText({ html, className }: { html: string; className?: string }) {
  return <div className={cn('prose-rf', className)} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html, { USE_PROFILES: { html: true } }) }} />;
}

export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-md shadow-indigo-600/30">
        <svg viewBox="0 0 24 24" className="size-4.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 17 9 11l4 4 7-8" />
          <path d="M15 7h5v5" />
        </svg>
      </span>
      {withText && (
        <span className="text-[17px] font-bold tracking-tight text-foreground">
          RecruitFlow<span className="ml-1 rounded bg-primary-soft px-1 py-px text-[11px] font-semibold text-primary-soft-foreground align-middle">AI</span>
        </span>
      )}
    </span>
  );
}

export function AiBadge({ className, children = 'AI' }: { className?: string; children?: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-500/10 to-fuchsia-500/10 px-2 py-0.5 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-500/20 dark:text-violet-300', className)}>
      <Sparkles className="size-3" />
      {children}
    </span>
  );
}
