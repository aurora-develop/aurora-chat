import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  resolved: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  init: () => void;
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'system',
  resolved: 'light',

  setTheme: (theme: Theme) => {
    localStorage.setItem('aurora-theme', theme);
    const resolved = theme === 'system' ? getSystemTheme() : theme;
    applyTheme(resolved);
    set({ theme, resolved });
  },

  init: () => {
    const stored = localStorage.getItem('aurora-theme') as Theme | null;
    const theme = stored || 'system';
    const resolved = theme === 'system' ? getSystemTheme() : theme;
    applyTheme(resolved);
    set({ theme, resolved });

    // 监听系统主题变化
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (get().theme === 'system') {
        const newResolved = e.matches ? 'dark' : 'light';
        applyTheme(newResolved);
        set({ resolved: newResolved });
      }
    });
  },
}));
