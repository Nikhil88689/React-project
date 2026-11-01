import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Logo, MatchScore } from '@/components/domain';
import { Avatar } from '@/components/ui/avatar';

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link to="/" className="w-fit">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-[28px] font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
            <div className="mt-8">{children}</div>
          </motion.div>
        </div>
        {footer && <div className="text-center text-sm text-muted-foreground">{footer}</div>}
      </div>

      <div className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(217,70,239,0.3),transparent_45%)]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="max-w-md">
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-200">RecruitFlow AI</p>
            <h2 className="mt-4 text-4xl font-bold leading-tight tracking-tight">Every great hire starts with a better process.</h2>
          </div>

          <div className="space-y-4">
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="ml-auto w-80 rounded-2xl bg-white p-4 text-slate-900 shadow-2xl">
              <div className="flex items-center gap-3">
                <Avatar name="Rahul Sharma" size="md" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">Rahul Sharma</p>
                  <p className="text-xs text-slate-500">Senior React Developer</p>
                </div>
                <MatchScore score={91} size="md" />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {['React', 'TypeScript', 'Node.js', 'AWS'].map((s) => (
                  <span key={s} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                    {s}
                  </span>
                ))}
              </div>
              <p className="mt-3 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700">Technical Interview · Tomorrow, 10:00 AM</p>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }} className="w-72 rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 backdrop-blur">
              <p className="text-xs text-indigo-100">Time to hire</p>
              <p className="mt-1 text-2xl font-bold">
                18 days <span className="text-sm font-medium text-emerald-300">↓ 32%</span>
              </p>
            </motion.div>
          </div>

          <figure className="max-w-md">
            <Quote className="size-6 text-indigo-300" />
            <blockquote className="mt-3 text-lg leading-relaxed text-indigo-50">“We cut our time-to-hire nearly in half. The AI match evidence makes shortlisting a 10-minute job instead of an afternoon.”</blockquote>
            <figcaption className="mt-4 flex items-center gap-3">
              <Avatar name="Meera Joshi" size="sm" />
              <span className="text-sm">
                <span className="block font-semibold">Meera Joshi</span>
                <span className="text-indigo-200">VP People, Nimbus Labs</span>
              </span>
            </figcaption>
          </figure>
        </div>
      </div>
    </div>
  );
}

export function GoogleButton({ onClick, label = 'Continue with Google' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} className="flex h-10 w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-card text-sm font-medium shadow-xs transition hover:bg-accent">
      <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7Z" />
        <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
        <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
        <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" />
      </svg>
      {label}
    </button>
  );
}

export const Divider = ({ label = 'or' }: { label?: string }) => (
  <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
    <span className="h-px flex-1 bg-border" />
    {label}
    <span className="h-px flex-1 bg-border" />
  </div>
);
