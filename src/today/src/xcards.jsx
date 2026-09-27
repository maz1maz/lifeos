// Expandable card group (idea from "Minimal Card Expand", rebuilt without Tailwind/framer):
// tap a card → it moves to the top at full width and shows more; the others shrink to a compact row.
// Positions animate with a tiny FLIP; outside click / Esc collapses.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import './xcards.css';

export const XC_SURFACES = ['violet', 'graphite', 'cyan', 'blue', 'gold', 'green', 'rose'];

export function XCards({ items, getKey = x => x.id, surface = (x, i) => XC_SURFACES[i % XC_SURFACES.length], renderBody, renderMore, open: openProp, onOpen, cols = 2, className = '' }) {
  const [openLocal, setOpenLocal] = useState(null);
  const open = openProp !== undefined ? openProp : openLocal;
  const setOpen = v => { if (onOpen) onOpen(v); if (openProp === undefined) setOpenLocal(v); };
  const wrap = useRef(null), rects = useRef(new Map());
  const snapshot = () => { const m = new Map(); wrap.current?.querySelectorAll(':scope > .xc').forEach(el => m.set(el.dataset.k, el.getBoundingClientRect())); rects.current = m; };
  const toggle = k => { snapshot(); setOpen(open === k ? null : k); };
  useLayoutEffect(() => {
    const prev = rects.current; if (!prev.size || !wrap.current) return;
    wrap.current.querySelectorAll(':scope > .xc').forEach(el => {
      const a = prev.get(el.dataset.k), b = el.getBoundingClientRect(); if (!a) return;
      const dx = a.left - b.left, dy = a.top - b.top; if (!dx && !dy) return;
      el.style.transition = 'none'; el.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => { el.style.transition = ''; el.style.transform = ''; });
    });
    rects.current = new Map();
  }, [open]);
  useEffect(() => {
    if (open == null) return;
    const down = e => { if (wrap.current && !wrap.current.contains(e.target) && !e.target.closest?.('.lf-drawer-bg,.fn-modal')) { snapshot(); setOpen(null); } };
    const key = e => { if (e.key === 'Escape') { snapshot(); setOpen(null); } };
    document.addEventListener('pointerdown', down); window.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down); window.removeEventListener('keydown', key); };
  }, [open]);
  return <div ref={wrap} className={`xcards ${open != null ? 'has-open' : ''} ${className}`} style={{ '--xc-cols': cols }}>
    {items.map((it, i) => { const k = String(getKey(it)), st = open == null ? 'normal' : String(open) === k ? 'open' : 'compact';
      return <div key={k} data-k={k} className={`xc xc-${surface(it, i)} ${st}`}>
        <button type="button" className="xc-hit" onClick={() => toggle(k)} aria-expanded={st === 'open'} aria-label={st === 'open' ? 'بستن' : 'باز کردن'} />
        <div className="xc-body">{renderBody(it, st)}</div>
        {st === 'open' && renderMore ? <div className="xc-more" onClick={e => e.stopPropagation()}>{renderMore(it)}</div> : null}
        <span className="xc-dots" aria-hidden="true">{st === 'open' ? '×' : '•••'}</span>
      </div>; })}
  </div>;
}

export function CopyBtn({ text, label }) {
  const [ok, setOk] = useState(false);
  if (!text) return null;
  return <button type="button" className="xc-copy" onClick={async e => { e.stopPropagation(); try { await navigator.clipboard.writeText(String(text).replace(/[\s-]/g, '')); } catch { window.prompt('کپی کن:', text); } setOk(true); setTimeout(() => setOk(false), 1400); }}>
    <span>{label}</span><b dir="ltr">{/^\d{16}$/.test(String(text).replace(/[\s-]/g, '')) ? String(text).replace(/[\s-]/g, '').replace(/(\d{4})(?=\d)/g, '$1 ') : text}</b><i>{ok ? '✓' : '⧉'}</i>
  </button>;
}

export function Spark({ data, up, h = 44 }) {
  if (!data || data.length < 2) return null;
  const w = 220, min = Math.min(...data), max = Math.max(...data), sp = max - min || 1;
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - 3 - ((v - min) / sp) * (h - 6)).toFixed(1)}`).join(' ');
  return <svg className={`xc-spark ${up ? 'up' : 'down'}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none"><polyline points={pts} /></svg>;
}
