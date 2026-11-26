import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'cet-theme';

function readInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* Storage can be unavailable; fall back to the document state. */
  }

  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>(readInitialTheme());
  const isDark = computed(() => theme.value === 'dark');

  function apply(next: Theme): void {
    theme.value = next;

    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', next === 'dark');
      document.documentElement.style.colorScheme = next;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* Preference persistence is optional. */
    }
  }

  function init(): void {
    apply(theme.value);
  }

  function setTheme(next: Theme): void {
    apply(next);
  }

  function toggleTheme(): void {
    apply(theme.value === 'dark' ? 'light' : 'dark');
  }

  return { theme, isDark, init, setTheme, toggleTheme };
});
