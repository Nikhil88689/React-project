import { useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router';
import { confirm } from '@/components/ui/feedback';

export function useDebounce<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (title) document.title = `${title} · RecruitFlow AI`;
  }, [title]);
}

/** Blocks in-app navigation and tab close while a form has unsaved edits. */
export function useUnsavedChanges(dirty: boolean, message = 'You have unsaved changes. Leave without saving?') {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  const prompting = useRef(false);

  useEffect(() => {
    if (blocker.state !== 'blocked' || prompting.current) return;
    prompting.current = true;
    confirm({ title: 'Discard changes?', description: message, confirmLabel: 'Leave page', cancelLabel: 'Keep editing', destructive: true }).then((ok) => {
      prompting.current = false;
      if (ok) blocker.proceed();
      else blocker.reset();
    });
  }, [blocker, message]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
}

export function useHotkey(key: string, handler: (e: KeyboardEvent) => void, opts: { meta?: boolean } = {}) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (opts.meta && !(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      ref.current(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [key, opts.meta]);
}
