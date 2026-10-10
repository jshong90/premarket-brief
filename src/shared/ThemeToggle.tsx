import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

const initialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'dark';
  try { return window.localStorage.getItem('warren-theme') === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
};

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
    try { window.localStorage.setItem('warren-theme', theme); } catch {}
  }, [theme]);
  const next = theme === 'dark' ? 'light' : 'dark';
  return <button className="theme-toggle" type="button" onClick={() => setTheme(next)} aria-label={`Switch to ${next} theme`} aria-pressed={theme === 'light'}>{theme === 'dark' ? <Sun/> : <Moon/>}<span className="theme-toggle-label">{theme === 'dark' ? 'Light' : 'Dark'}</span></button>;
}
