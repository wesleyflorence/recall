'use client';

import { useEffect, useMemo, useState } from 'react';

const DARK_CLASS = 'dark';
const STORAGE_KEY = 'recall-theme';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const stored = localStorage.getItem(STORAGE_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored ? stored === DARK_CLASS : prefersDark;

    setDark(isDark);
    root.classList.toggle(DARK_CLASS, isDark);
  }, []);

  const label = useMemo(() => (dark ? 'Switch to light mode' : 'Switch to dark mode'), [dark]);

  const onToggle = () => {
    const next = !dark;
    setDark(next);

    document.documentElement.classList.toggle(DARK_CLASS, next);
    localStorage.setItem(STORAGE_KEY, next ? DARK_CLASS : 'light');
  };

  return (
    <button
      type="button"
      className="btn btn-secondary"
      onClick={onToggle}
      aria-label={label}
      title={label}
      style={{ fontSize: '12px', height: '28px', padding: '0 8px' }}
    >
      {dark ? '☀ Light' : '⏾ Dark'}
    </button>
  );
}
