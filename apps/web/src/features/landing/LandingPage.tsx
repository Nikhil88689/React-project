import { PLANS, PLAN_TIERS } from '@recruitflow/shared';
import { motion } from 'framer-motion';
import { ArrowRight, BarChart3, BrainCircuit, CalendarCheck2, Check, FileSearch, KanbanSquare, ShieldCheck, Sparkles, Star } from 'lucide-react';
import { Link } from 'react-router';
import { Logo, MatchScore } from '@/components/domain';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ThemeSwitch } from '@/components/layout/Topbar';
import { useDocumentTitle } from '@/hooks';
import { cn, formatCurrency } from '@/lib/utils';

const FEATURES = [
  { icon: BrainCircuit, title: 'AI resume screening', body: 'Parse PDFs and DOCX into structured profiles, then score every applicant against the role — with the evidence behind each score.' },
  { icon: KanbanSquare, title: 'Visual hiring pipeline', body: 'Drag candidates through your workflow. Every move is tracked, audited and synced live across your team.' },
  { icon: CalendarCheck2, title: 'Interview scheduling', body: 'Schedule panels, detect conflicts, send invites and automatic 24h and 1h reminders.' },
  { icon: FileSearch, title: 'Structured feedback', body: 'Scorecards with consistent criteria so decisions are fair, comparable and fast.' },
  { icon: BarChart3, title: 'Hiring analytics', body: 'Funnel conversion, time to hire, source quality and cost per hire — updated in real time.' },
  { icon: ShieldCheck, title: 'Roles & permissions', body: 'Admins, recruiters and interviewers see exactly what they need. Enforced on the server, logged in the audit trail.' },
];

const PREVIEW_COLUMNS = [
  { name: 'Applied', count: 42, color: 'bg-slate-400', people: [['Aarav Patel', 'Frontend Engineer', 82], ['Isha Kapoor', 'React Developer', 76]] },
  { name: 'Shortlisted', count: 18, color: 'bg-violet-500', people: [['Rahul Sharma', 'Senior Frontend Engineer', 91], ['Neha Rao', 'UI Engineer', 84]] },
  { name: 'Interview', count: 9, color: 'bg-indigo-500', people: [['Ananya Singh', 'Node.js Developer', 88]] },
  { name: 'Offer', count: 3, color: 'bg-amber-500', people: [['Wendy Pereira', 'Product Designer', 93]] },
] as const;

function ProductPreview() {
  return (
    <div className="relative mx-auto mt-16 max-w-5xl">
      <div className="absolute -inset-x-10 -top-10 bottom-0 -z-10 rounded-[3rem] bg-gradient-to-b from-indigo-500/15 via-violet-500/10 to-transparent blur-2xl" />
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-indigo-900/10">
        <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-rose-400" />
          <span className="size-2.5 rounded-full bg-amber-400" />
          <span className="size-2.5 rounded-full bg-emerald-400" />
          <span className="ml-3 rounded-md bg-card px-3 py-0.5 text-[11px] text-muted-foreground">app.recruitflow.ai/pipeline</span>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-4">
          {[
            ['Open positions', '16', '+12%'],
            ['Candidates', '1,284', '+18%'],
            ['Interviews', '57', '+9%'],
            ['Hired', '24', '+22%'],
          ].map(([label, value, change]) => (
            <div key={label} className="rounded-xl border border-border p-3.5">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-xl font-bold">{value}</p>
              <p className="text-[11px] font-medium text-emerald-600">{change} vs last month</p>
            </div>
          ))}
        </div>
        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-4">
          {PREVIEW_COLUMNS.map((col, i) => (
            <motion.div key={col.name} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.08 }} className="rounded-xl bg-muted/60 p-2.5">
              <div className="mb-2 flex items-center gap-2 px-1">
                <span className={cn('size-2 rounded-full', col.color)} />
                <span className="text-xs font-semibold">{col.name}</span>
                <span className="ml-auto text-[11px] text-muted-foreground">{col.count}</span>
              </div>
              <div className="space-y-2">
                {col.people.map(([name, role, score]) => (
                  <div key={name} className="rounded-lg border border-border bg-card p-2.5 shadow-xs">
                    <div className="flex items-center gap-2">
                      <Avatar name={name} size="xs" />
                      <span className="truncate text-xs font-semibold">{name}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="truncate text-[11px] text-muted-foreground">{role}</span>
                      <MatchScore score={score} />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  useDocumentTitle('Hire better. Move candidates faster.');
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-6">
          <Link to="/">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Product</a>
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <Link to="/careers/nimbus-labs" className="hover:text-foreground">Resources</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeSwitch className="hidden sm:inline-flex" />
            <Button variant="ghost" asChild>
              <Link to="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link to="/register">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden px-6 pb-24 pt-20">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.14),transparent_60%)]" />
        <div className="mx-auto max-w-4xl text-center">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs">
            <Sparkles className="size-3.5 text-violet-500" /> Evidence-based AI matching — now in every plan
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mt-6 text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl">
            Hire better.
            <br />
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 bg-clip-text text-transparent">Move candidates faster.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            RecruitFlow AI is the applicant tracking system for fast-growing teams — job posting, resume parsing, AI matching, interviews and analytics in one place.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/register">
                Start free trial <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/login?demo=1">Explore the live demo</Link>
            </Button>
          </motion.div>
          <p className="mt-4 text-xs text-muted-foreground">14-day trial · No credit card · Cancel anytime</p>
        </div>
        <ProductPreview />
      </section>

      <section className="border-y border-border bg-card/50 py-10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-12 gap-y-4 px-6 text-lg font-bold tracking-tight text-muted-foreground/60">
          {['Nimbus Labs', 'Kirana Cloud', 'PayStack India', 'Zephyr Health', 'Orbit EdTech', 'Lumen Retail'].map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
      </section>

      <section id="features" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold text-primary">Everything in one workspace</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">From job post to signed offer</h2>
            <p className="mt-4 text-muted-foreground">Replace spreadsheets, inbox threads and scattered notes with one system your whole hiring team actually enjoys using.</p>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ delay: i * 0.05 }}
                className="group rounded-2xl border border-border bg-card p-6 shadow-xs transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-900/5"
              >
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary transition group-hover:bg-primary group-hover:text-white">
                  <f.icon className="size-5" />
                </div>
                <h3 className="mt-5 text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="ai" className="px-6 pb-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 rounded-3xl border border-border bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 p-8 text-white sm:p-12 lg:grid-cols-2">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-violet-300">
              <Sparkles className="size-4" /> RecruitFlow AI
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">AI that shows its work</h2>
            <p className="mt-4 text-slate-300">
              Every match score comes with the evidence: which skills matched, where they appear in the resume, and what to verify in the interview. AI helps you prioritise — your team always makes the call.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-slate-200">
              {['Structured resume parsing in seconds', 'Explainable skill, experience and project matching', 'Interview questions generated for each round', 'Natural-language search: “React devs in Bangalore with 3+ years”'].map((t) => (
                <li key={t} className="flex items-center gap-2.5">
                  <Check className="size-4 text-emerald-400" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Rahul Sharma</p>
                <p className="text-xs text-slate-400">Senior React Developer</p>
              </div>
              <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-lg font-bold text-emerald-300">91%</span>
            </div>
            {[
              ['Skills', 94],
              ['Experience', 90],
              ['Projects', 88],
              ['Education', 85],
            ].map(([k, v]) => (
              <div key={k} className="mt-4">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>{k}</span>
                  <span>{v}%</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-400" style={{ width: `${v}%` }} />
                </div>
              </div>
            ))}
            <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-emerald-400/10 p-3">
                <p className="font-semibold text-emerald-300">Strong matches</p>
                <p className="mt-1 text-slate-300">React · TypeScript · Node.js · REST APIs</p>
              </div>
              <div className="rounded-lg bg-amber-400/10 p-3">
                <p className="font-semibold text-amber-300">To verify</p>
                <p className="mt-1 text-slate-300">Kubernetes · AWS depth</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="px-6 pb-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Simple, transparent pricing</h2>
            <p className="mt-4 text-muted-foreground">Start on any plan with a 14-day free trial. Upgrade or downgrade anytime.</p>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {PLAN_TIERS.map((tier) => {
              const plan = PLANS[tier];
              const featured = tier === 'GROWTH';
              return (
                <div key={tier} className={cn('relative rounded-2xl border bg-card p-7', featured ? 'border-primary shadow-xl shadow-indigo-900/10 ring-1 ring-primary' : 'border-border')}>
                  {featured && (
                    <span className="absolute -top-3 left-7 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-white">
                      <Star className="size-3" /> Most popular
                    </span>
                  )}
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
                  <p className="mt-6">
                    <span className="text-4xl font-bold tracking-tight">{formatCurrency(plan.priceMonthly)}</span>
                    <span className="text-sm text-muted-foreground"> /month</span>
                  </p>
                  <Button className="mt-6 w-full" variant={featured ? 'default' : 'outline'} asChild>
                    <Link to="/register">Start free trial</Link>
                  </Button>
                  <ul className="mt-7 space-y-2.5 text-sm">
                    <li className="flex gap-2"><Check className="size-4 text-primary" /> {plan.limits.activeJobs} active jobs</li>
                    <li className="flex gap-2"><Check className="size-4 text-primary" /> {plan.limits.teamMembers} team members</li>
                    <li className="flex gap-2"><Check className="size-4 text-primary" /> {plan.limits.aiAnalyses.toLocaleString('en-IN')} AI analyses / month</li>
                    {plan.features.map((f) => (
                      <li key={f} className="flex gap-2"><Check className="size-4 text-primary" /> {f}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <Logo />
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} RecruitFlow AI. Built for modern hiring teams.</p>
        </div>
      </footer>
    </div>
  );
}
