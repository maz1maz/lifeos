import { useEffect, useMemo, useRef, useState } from 'react';
import './palette.css';
import { isoToJ, MONTHS } from './jdate';

const norm = v => String(v || '').toLowerCase().replace(/[يى]/g, 'ی').replace(/ك/g, 'ک');
const faD = v => String(v ?? '').replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);

// Global Ctrl+K / ⌘K palette: jump to any page or find anything (tasks, money, notes, series, contacts, documents…)
export function CommandPalette({ pages }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null), listRef = useRef(null);

  useEffect(() => {
    const onKey = e => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K' || e.code === 'KeyK')) { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }
      else if (e.key === '/' && !typing && !open) { e.preventDefault(); setOpen(true); }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('lifeos:search', onOpen);
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('lifeos:search', onOpen); };
  }, [open]);
  useEffect(() => { if (open) { setQ(''); setItems([]); setSel(0); setTimeout(() => inputRef.current?.focus(), 20); document.body.classList.add('nav-lock'); } else document.body.classList.remove('nav-lock'); }, [open]);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setItems([]); setBusy(false); return; }
    setBusy(true);
    const h = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(t)}`, { credentials: 'include' }).then(r => r.json()).then(d => setItems(d.items || [])).catch(() => setItems([])).finally(() => setBusy(false));
    }, 220);
    return () => clearTimeout(h);
  }, [q]);

  const commands = useMemo(() => {
    const t = norm(q.trim());
    const base = [
      ...pages.map(([page, label]) => ({ kind: 'page', icon: '↗', text: label, sub: 'رفتن به صفحه', href: page ? `/?page=${page}` : '/' })),
      { kind: 'act', icon: '💸', text: 'ثبت تراکنش تازه', sub: 'مالی', href: '/?page=finance&tab=ledger' },
      { kind: 'act', icon: '📊', text: 'گزارش ماهانهٔ مالی', sub: 'مالی', href: '/?page=finance' },
      { kind: 'act', icon: '🎯', text: 'اهداف پس‌انداز', sub: 'مالی', href: '/?page=finance&tab=wealth' },
      { kind: 'act', icon: '📅', text: 'تقویم پخش سریال‌ها', sub: 'فیلم و سریال', href: '/?page=upcoming' },
      { kind: 'act', icon: '✨', text: 'پیشنهاد سریال و فیلم', sub: 'فیلم و سریال', href: '/?page=discover' },
      { kind: 'act', icon: '🌓', text: 'تغییر حالت روشن / تاریک', sub: 'ظاهر', run: () => { const next = document.documentElement.dataset.mode === 'light' ? 'dark' : 'light'; document.documentElement.dataset.mode = next; try { localStorage.setItem('lifeos-mode', next); } catch {} } },
    ];
    return t ? base.filter(c => norm(c.text + ' ' + c.sub).includes(t)) : base;
  }, [q, pages]);
  const rows = useMemo(() => [...commands.slice(0, q.trim() ? 5 : 30), ...items.map(x => ({ kind: 'hit', ...x }))], [commands, items, q]);
  useEffect(() => { setSel(0); }, [q, items.length]);
  useEffect(() => { listRef.current?.querySelector('.cp-row.on')?.scrollIntoView({ block: 'nearest' }); }, [sel]);

  const go = r => { if (!r) return; setOpen(false); if (r.run) r.run(); else if (r.href) location.href = r.href; };
  const onKey = e => {
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(rows.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(rows[sel]); }
  };
  if (!open) return null;
  let lastType = null;
  return <div className="cp-bg" onMouseDown={() => setOpen(false)}>
    <div className="cp" dir="rtl" role="dialog" aria-label="جستجو" onMouseDown={e => e.stopPropagation()}>
      <div className="cp-in">
        <span aria-hidden="true">🔍</span>
        <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey} placeholder="جستجو در همه‌چیز، یا نام صفحه…" aria-label="جستجو" />
        {busy ? <i className="cp-spin" /> : <kbd>Esc</kbd>}
      </div>
      <div className="cp-list" ref={listRef}>
        {rows.map((r, i) => {
          const head = r.kind === 'hit' ? r.type : r.kind === 'page' ? 'صفحه‌ها' : 'کارها';
          const showHead = head !== lastType; lastType = head;
          return <div key={i}>
            {showHead ? <div className="cp-head">{head}</div> : null}
            <button type="button" className={`cp-row ${i === sel ? 'on' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => go(r)}>
              <span className="cp-ic">{r.icon}</span>
              <span className="cp-txt"><b dir="auto">{r.text}</b>{r.sub ? <small dir="auto">{faD(r.sub)}</small> : null}</span>
              {/^\d{4}-\d{2}-\d{2}/.test(r.date || '') ? <em>{(() => { const j = isoToJ(r.date); return `${faD(j.jd)} ${MONTHS[j.jm - 1]} ${faD(j.jy)}`; })()}</em> : null}
            </button>
          </div>;
        })}
        {q.trim().length >= 2 && !busy && !items.length ? <p className="cp-empty">چیزی با «{q.trim()}» پیدا نشد.</p> : null}
      </div>
      <div className="cp-foot"><span><kbd>↑</kbd><kbd>↓</kbd> جابه‌جایی</span><span><kbd>Enter</kbd> باز کردن</span><span><kbd>Ctrl</kbd>+<kbd>K</kbd> یا <kbd>/</kbd> از هر صفحه</span></div>
    </div>
  </div>;
}
