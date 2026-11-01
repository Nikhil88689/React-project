import type { AssistantReply, CandidateFilters } from '@recruitflow/shared';
import { useMutation } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Copy, ExternalLink, Minus, RotateCcw, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { MatchScore } from '@/components/domain';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { api, errorMessage } from '@/lib/api';
import { cn, fullName } from '@/lib/utils';
import { useAuth } from '@/stores/auth';
import { useUi } from '@/stores/ui';

type Msg = { id: string; role: 'user' | 'assistant'; content: string; reply?: AssistantReply; error?: boolean };

const SUGGESTIONS = [
  'Show React developers with 3+ years in Bangalore',
  'Which interviews are still waiting for feedback?',
  'How many candidates are in each stage?',
  'Draft a follow-up email for Rahul Sharma',
];

export function filtersToSearch(f: CandidateFilters) {
  const p = new URLSearchParams();
  if (f.search) p.set('search', f.search);
  if (f.skills?.length) p.set('skills', f.skills.join(','));
  if (f.minExperience != null) p.set('minExperience', String(f.minExperience));
  if (f.location) p.set('location', f.location);
  if (f.stage) p.set('stage', f.stage);
  if (f.availability) p.set('availability', f.availability);
  if (f.minMatch != null) p.set('minMatch', String(f.minMatch));
  return p.toString();
}

function ReplyBody({ reply, onNavigate }: { reply: AssistantReply; onNavigate: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-2.5">
      <p className="whitespace-pre-line">{reply.message}</p>
      {reply.candidates && reply.candidates.length > 0 && (
        <div className="space-y-1.5">
          {reply.candidates.slice(0, 5).map((c) => (
            <Link key={c.id} to={`/candidates/${c.id}`} onClick={onNavigate} className="flex items-center gap-2.5 rounded-lg border border-border bg-card p-2 transition hover:border-ring/40">
              <Avatar name={fullName(c)} src={c.avatarUrl} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{fullName(c)}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {c.headline} · {c.experienceYears ?? '?'} yrs · {c.location}
                </span>
              </span>
              <MatchScore score={c.bestMatch} />
            </Link>
          ))}
          {reply.filters && (
            <Button
              variant="link"
              size="xs"
              onClick={() => {
                onNavigate();
                navigate(`/candidates?${filtersToSearch(reply.filters!)}`);
              }}
            >
              View all {reply.total ?? reply.candidates.length} in Candidates <ExternalLink className="size-3" />
            </Button>
          )}
        </div>
      )}
      {reply.items && reply.items.length > 0 && (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {reply.items.slice(0, 8).map((i) => (
            <Link key={i.id} to={i.link} onClick={onNavigate} className="block px-3 py-2 transition hover:bg-accent/60">
              <span className="block text-[13px] font-medium">{i.title}</span>
              <span className="block text-[11px] text-muted-foreground">{i.subtitle}</span>
            </Link>
          ))}
        </div>
      )}
      {reply.draft && (
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">To {reply.draft.to}</p>
          <p className="mt-1 text-[13px] font-semibold">{reply.draft.subject}</p>
          <p className="mt-2 whitespace-pre-line text-[13px] text-muted-foreground">{reply.draft.body}</p>
          <div className="mt-3 flex gap-2">
            <Button
              size="xs"
              variant="outline"
              onClick={() => navigator.clipboard.writeText(`${reply.draft!.subject}\n\n${reply.draft!.body}`).then(() => toast.success('Draft copied'))}
            >
              <Copy /> Copy
            </Button>
            {reply.draft.candidateId && (
              <Button size="xs" variant="soft" onClick={() => (onNavigate(), navigate(`/candidates/${reply.draft!.candidateId}?compose=1`))}>
                Open in composer
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AiAssistant() {
  const open = useUi((s) => s.assistantOpen);
  const openAssistant = useUi((s) => s.openAssistant);
  const close = useUi((s) => s.closeAssistant);
  const firstName = useAuth((s) => s.user?.firstName);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const ask = useMutation({
    mutationFn: (message: string) =>
      api.post<AssistantReply>('/ai/assistant', {
        message,
        history: messages.filter((m) => !m.error).slice(-8).map((m) => ({ role: m.role, content: m.content.slice(0, 3900) })),
      }),
    onSuccess: (reply) => setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', content: reply.message, reply }]),
    onError: (err) => setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'assistant', content: errorMessage(err, 'The assistant is unavailable right now.'), error: true }]),
  });

  const send = (text: string) => {
    const message = text.trim();
    if (!message || ask.isPending) return;
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'user', content: message }]);
    setInput('');
    ask.mutate(message);
  };

  useEffect(() => {
    if (!open) return;
    const prompt = useUi.getState().consumeAssistantPrompt();
    if (prompt) send(prompt);
    setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, ask.isPending]);

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.9 }}
            onClick={() => openAssistant()}
            className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 py-3 pl-4 pr-5 text-sm font-semibold text-white shadow-xl shadow-violet-600/30 transition hover:brightness-110"
          >
            <Sparkles className="size-4" /> RecruitFlow AI
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog"
            aria-label="RecruitFlow AI assistant"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="fixed inset-x-3 bottom-3 z-50 flex h-[min(640px,calc(100vh-6rem))] flex-col overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl shadow-slate-900/20 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[420px]"
            onKeyDown={(e) => e.key === 'Escape' && close()}
          >
            <header className="flex items-center gap-3 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 px-4 py-3 text-white">
              <span className="flex size-8 items-center justify-center rounded-lg bg-white/15">
                <Sparkles className="size-4" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold leading-tight">RecruitFlow AI</p>
                <p className="text-[11px] text-white/75">Assistive only — you make the hiring decisions</p>
              </div>
              {messages.length > 0 && (
                <button onClick={() => setMessages([])} className="rounded-md p-1.5 text-white/80 hover:bg-white/15" aria-label="New conversation">
                  <RotateCcw className="size-4" />
                </button>
              )}
              <button onClick={close} className="rounded-md p-1.5 text-white/80 hover:bg-white/15" aria-label="Minimise assistant">
                <Minus className="size-4" />
              </button>
            </header>

            <div ref={scrollRef} className="scrollbar-thin flex-1 space-y-3 overflow-y-auto px-4 py-4 text-[13.5px] leading-relaxed">
              {messages.length === 0 && (
                <div className="pt-2">
                  <p className="text-[15px] font-semibold">Hi {firstName} 👋</p>
                  <p className="mt-1 text-muted-foreground">I can search your talent pool, summarise your pipeline, find pending feedback and draft candidate emails.</p>
                  <div className="mt-4 grid gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} onClick={() => send(s)} className="rounded-xl border border-border bg-card px-3 py-2.5 text-left text-[13px] transition hover:border-violet-400/60 hover:bg-violet-50/50 dark:hover:bg-violet-500/10">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[88%] rounded-2xl px-3.5 py-2.5',
                      m.role === 'user' ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-muted text-foreground',
                      m.error && 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
                    )}
                  >
                    {m.reply ? <ReplyBody reply={m.reply} onNavigate={close} /> : <p className="whitespace-pre-line">{m.content}</p>}
                  </div>
                </div>
              ))}
              {ask.isPending && (
                <div className="flex">
                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-muted px-4 py-3">
                    {[0, 1, 2].map((i) => (
                      <motion.span key={i} className="size-1.5 rounded-full bg-muted-foreground/60" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <form
              className="border-t border-border p-3"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <div className="flex items-end gap-2 rounded-xl border border-input bg-card p-1.5 pl-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/15">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  maxLength={1000}
                  placeholder="Ask about candidates, jobs, interviews…"
                  className="max-h-28 min-h-8 flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
                  aria-label="Message RecruitFlow AI"
                />
                <Button type="submit" size="icon-sm" variant="ai" disabled={!input.trim() || ask.isPending} aria-label="Send">
                  <ArrowUp />
                </Button>
              </div>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
