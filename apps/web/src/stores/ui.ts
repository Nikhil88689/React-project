import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

interface UiState {
  theme: Theme;
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  commandOpen: boolean;
  assistantOpen: boolean;
  assistantPrompt: string | null;
  setTheme: (t: Theme) => void;
  toggleSidebar: () => void;
  setMobileNav: (open: boolean) => void;
  setCommandOpen: (open: boolean) => void;
  openAssistant: (prompt?: string) => void;
  closeAssistant: () => void;
  consumeAssistantPrompt: () => string | null;
}

export const useUi = create<UiState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      sidebarCollapsed: false,
      mobileNavOpen: false,
      commandOpen: false,
      assistantOpen: false,
      assistantPrompt: null,
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setMobileNav: (mobileNavOpen) => set({ mobileNavOpen }),
      setCommandOpen: (commandOpen) => set({ commandOpen }),
      openAssistant: (prompt) => set({ assistantOpen: true, assistantPrompt: prompt ?? null, commandOpen: false }),
      closeAssistant: () => set({ assistantOpen: false }),
      consumeAssistantPrompt: () => {
        const p = get().assistantPrompt;
        if (p) set({ assistantPrompt: null });
        return p;
      },
    }),
    {
      name: 'rf-ui',
      partialize: (s) => ({ theme: s.theme, sidebarCollapsed: s.sidebarCollapsed }),
      onRehydrateStorage: () => (state) => state && applyTheme(state.theme),
    },
  ),
);

const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && Boolean(media?.matches));
  document.documentElement.classList.toggle('dark', dark);
  try {
    localStorage.setItem('rf-theme', theme);
  } catch {
    /* storage may be unavailable in private mode */
  }
}

media?.addEventListener('change', () => {
  if (useUi.getState().theme === 'system') applyTheme('system');
});
