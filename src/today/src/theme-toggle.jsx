import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

// Light/dark switch (top bar of every page, and the full-window IELTS exam). Watches data-mode so the Ctrl+K
// «تغییر حالت» command updates the icon too.
export function ThemeToggle({ className = 'nav-theme' }) {
  const [, tick] = useState(0);
  useEffect(() => { const mo = new MutationObserver(() => tick(t => t + 1)); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] }); return () => mo.disconnect(); }, []);
  const light = document.documentElement.dataset.mode === 'light';
  const flip = () => { const next = light ? 'dark' : 'light'; document.documentElement.dataset.mode = next; try { localStorage.setItem('lifeos-mode', next); } catch {} };
  return <button type="button" className={className} onClick={flip} aria-label={light ? 'حالت تاریک' : 'حالت روشن'} title={light ? 'حالت تاریک' : 'حالت روشن'}>{light ? <Moon size={17} /> : <Sun size={17} />}</button>;
}
