import type { GeneratedJobDescription } from '@recruitflow/shared';
import { useMutation } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, PencilLine, RefreshCw, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { AiBadge, RichText } from '@/components/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/controls';
import { Textarea } from '@/components/ui/input';
import { api } from '@/lib/api';
import type { JobFormValues } from './jobForm';
import { DESCRIPTION_SECTIONS } from './jobForm';

type Tone = 'PROFESSIONAL' | 'FRIENDLY' | 'CONCISE';

export function AiJobGenerator({ values, onApply }: { values: JobFormValues; onApply: (draft: GeneratedJobDescription, advance: boolean) => void }) {
  const defaultPrompt = [values.title || 'Role', values.experienceMin != null ? `with ${values.experienceMin}+ years` : '', values.skills.length ? `skills: ${values.skills.map((s) => s.name).join(', ')}` : '', values.location ? `based in ${values.location}` : '']
    .filter(Boolean)
    .join(' ');
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [tone, setTone] = useState<Tone>('PROFESSIONAL');
  const gen = useMutation({
    mutationFn: () => api.post<GeneratedJobDescription>('/ai/job-description', { prompt, title: values.title || undefined, department: values.department, experienceLevel: values.experienceLevel, tone }),
  });

  return (
    <div className="overflow-hidden rounded-xl border border-violet-200 bg-gradient-to-br from-indigo-50/80 via-violet-50/60 to-fuchsia-50/40 dark:border-violet-500/30 dark:from-indigo-500/10 dark:via-violet-500/10 dark:to-fuchsia-500/5">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <span className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-md shadow-violet-500/30">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Draft this job description with AI</p>
          <p className="text-xs text-muted-foreground">Describe the role in a sentence. You can regenerate, edit or accept the result.</p>
        </div>
        {!open && (
          <Button type="button" variant="ai" onClick={() => setOpen(true)}>
            <Sparkles /> Generate with AI
          </Button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-violet-200/70 dark:border-violet-500/20">
            <div className="space-y-3 p-4">
              <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} maxLength={2000} placeholder="e.g. Senior React Developer, 4+ years, TypeScript, Node.js, AWS, Bangalore hybrid" aria-label="Describe the role" className="bg-card" />
              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  value={tone}
                  onChange={setTone}
                  options={[
                    { value: 'PROFESSIONAL', label: 'Professional' },
                    { value: 'FRIENDLY', label: 'Friendly' },
                    { value: 'CONCISE', label: 'Concise' },
                  ]}
                />
                <div className="ml-auto flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => (setOpen(false), gen.reset())}>
                    <X /> Cancel
                  </Button>
                  <Button type="button" variant="ai" size="sm" loading={gen.isPending} disabled={prompt.trim().length < 5} onClick={() => gen.mutate()}>
                    {gen.data ? <RefreshCw /> : <Sparkles />} {gen.data ? 'Regenerate' : 'Generate'}
                  </Button>
                </div>
              </div>

              {gen.isPending && !gen.data && (
                <div className="space-y-2 rounded-lg border border-border bg-card p-4">
                  {[80, 95, 70, 88].map((w, i) => (
                    <div key={i} className="h-3 animate-pulse rounded bg-muted" style={{ width: `${w}%` }} />
                  ))}
                </div>
              )}

              {gen.data && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: gen.isPending ? 0.5 : 1, y: 0 }} className="rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                    <AiBadge>AI draft</AiBadge>
                    <span className="text-xs text-muted-foreground">Review before publishing — AI can be wrong.</span>
                  </div>
                  <div className="scrollbar-thin max-h-80 space-y-4 overflow-y-auto px-4 py-3">
                    {DESCRIPTION_SECTIONS.map((s) =>
                      gen.data.description[s.key] ? (
                        <section key={s.key}>
                          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</h4>
                          <RichText html={gen.data.description[s.key]} className="text-[13px]" />
                        </section>
                      ) : null,
                    )}
                    {gen.data.skills.length > 0 && (
                      <section>
                        <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Suggested skills</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {gen.data.skills.map((s) => (
                            <Badge key={s.name} variant={s.importance === 'REQUIRED' ? 'default' : 'secondary'}>
                              {s.name}
                              {s.years ? ` · ${s.years}+ yrs` : ''}
                            </Badge>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                  <div className="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-2.5">
                    <Button type="button" variant="outline" size="sm" onClick={() => gen.mutate()} loading={gen.isPending}>
                      <RefreshCw /> Regenerate
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => (onApply(gen.data!, false), setOpen(false), gen.reset())}>
                      <PencilLine /> Edit
                    </Button>
                    <Button type="button" size="sm" onClick={() => (onApply(gen.data!, true), setOpen(false), gen.reset())}>
                      <Check /> Accept
                    </Button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
