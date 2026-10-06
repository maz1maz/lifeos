import { useEffect, useMemo, useRef, useState } from 'react';
import './palette.css';
import { isoToJ, MONTHS } from './jdate';

const norm = v => String(v || '').toLowerCase().replace(/[يى]/g, 'ی').replace(/ك/g, 'ک');
const faD = v => String(v ?? '').replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const post = (url, body) => fetch(url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'ثبت نشد.'); return d; });
const localIso = (add = 0) => { const d = new Date(); d.setDate(d.getDate() + add); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const whenFa = (date, time) => { const day = !date ? '' : date === localIso() ? 'امروز' : date === localIso(1) ? 'فردا' : (() => { const j = isoToJ(date); return `${faD(j.jd)} ${MONTHS[j.jm - 1]}`; })(); return [day, time ? faD(time) : ''].filter(Boolean).join(' ساعت '); };
// One parsed action (same parser as the Telegram bot: /api/ai/process) → a short Persian line for the preview.
const tomanFa = rial => `${Math.round(Number(rial || 0) / 10).toLocaleString('fa-IR')} تومان`;
export function describe(a) {
  switch (a.type) {
    case 'transaction': return `${a.kind === 'income' ? '💰 درآمد' : '💸 خرج'}: ${a.title || ''} · ${tomanFa(a.amount)}${a.category ? ` · ${a.category}` : ''}`;
    case 'task': return `✅ کار: ${a.title} · ${whenFa(a.date, a.startTime) || 'امروز'}`;
    case 'reminder': return `⏰ یادآوری: ${a.title} · ${whenFa(a.date, a.time) || a.whenLabel || ''}`;
    case 'time': return `⏱ زمان کار: ${faD(a.minutes)} دقیقه${a.title ? ` · ${a.title}` : ''}`;
    case 'mood': return `🙂 حال امروز: ${faD(a.value)}`;
    case 'sleep': return `😴 خواب: ${faD(a.value)}`;
    case 'series': return `🎬 ${a.title} · فصل ${faD(a.season)} قسمت ${faD(a.episode)}`;
    case 'gambleNote': return '🎲 یادداشت بت و پوکر';
    default: return `• ${a.title || a.type}`;
  }
}

// Global Ctrl+K / ⌘K palette: jump to any page or find anything (tasks, money, notes, series, contacts, documents…)
export function CommandPalette({ pages }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(0);
  const [parsed, setParsed] = useState([]), [parsedFor, setParsedFor] = useState(''); // actions the free-text parser found in q (preview only, nothing saved)
  const [flash, setFlash] = useState(null); // { ok, text } after a capture
  const inputRef = useRef(null), listRef = useRef(null), enterWaiting = useRef(false);
  // Voice input (Web Speech API, Persian). Chrome/Edge/Safari only; the mic button is hidden elsewhere.
  const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  const [listening, setListening] = useState(false), recRef = useRef(null);
  const toggleMic = () => {
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SR(); rec.lang = 'fa-IR'; rec.interimResults = true; rec.maxAlternatives = 1;
    rec.onresult = e => { setQ([...e.results].map(r => r[0].transcript).join(' ')); };
    rec.onerror = e => { setFlash({ ok: false, text: e.error === 'not-allowed' ? 'اجازهٔ میکروفون داده نشد.' : 'صدا شناخته نشد؛ دوباره امتحان کن.' }); };
    rec.onend = () => { setListening(false); recRef.current = null; inputRef.current?.focus(); };
    recRef.current = rec; setFlash(null); setListening(true);
    try { rec.start(); } catch { setListening(false); }
  };
  useEffect(() => { if (!open) recRef.current?.abort?.(); }, [open]);

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
  useEffect(() => { if (open) { enterWaiting.current = false; setQ(''); setItems([]); setParsed([]); setFlash(null); setSel(0); setTimeout(() => inputRef.current?.focus(), 20); document.body.classList.add('nav-lock'); } else document.body.classList.remove('nav-lock'); }, [open]);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setItems([]); setBusy(false); return; }
    setBusy(true);
    const h = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(t)}`, { credentials: 'include' }).then(r => r.json()).then(d => setItems(d.items || [])).catch(() => setItems([])).finally(() => setBusy(false));
    }, 220);
    return () => clearTimeout(h);
  }, [q]);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 3) { setParsed([]); setParsedFor(t); return; }
    let live = true;
    const h = setTimeout(() => { post('/api/ai/process', { text: t, preview: true }).then(d => { if (live) { setParsed(d.actions || []); setParsedFor(t); } }).catch(() => { if (live) { setParsed([]); setParsedFor(t); } }); }, 260);
    return () => { live = false; clearTimeout(h); };
  }, [q]);

  // Quick capture straight from the palette. Parsed text goes through the same endpoint as the bot;
  // plain text can become a task for today or a note.
  const capture = async (run, okText) => {
    try {
      const msg = await run();
      setFlash({ ok: true, text: typeof msg === 'string' ? msg : okText }); setQ(''); setParsed([]);
      // pages that show what was just saved (Today, planner, money, notes, …) refetch their data — the app
      // re-mounts the current page on this event (see App in main.jsx); no full page reload
      const page = new URLSearchParams(location.search).get('page') || '';
      const unaffected = /^(market|football|media|music|youtube|settings|contacts|documents|vocab|admin|courses|projects|crm|car|travel|learning)$/.test(page);
      setTimeout(() => { setOpen(false); if (!unaffected) window.dispatchEvent(new Event('lifeos:captured')); }, 1300);
    } catch (e) { setFlash({ ok: false, text: e.message || 'ثبت نشد.' }); }
  };
  const captureRows = useMemo(() => {
    const t = q.trim();
    if (t.length < 2) return [];
    if (parsed.length) return [{ kind: 'cap', icon: '⚡', text: parsed.map(describe).join('  +  '), sub: 'Enter = ثبت', run: () => capture(async () => { const d = await post('/api/ai/process', { text: t }); if (!(d.done || []).length) throw new Error('چیزی ثبت نشد.'); return 'ثبت شد: ' + d.done.join('، '); }) }];
    return [
      { kind: 'cap', icon: '➕', text: `کار برای امروز: «${t}»`, sub: 'برنامه‌ریز', run: () => capture(() => post('/api/tasks', { title: t, date: localIso() }), `کار «${t}» برای امروز ثبت شد.`) },
      { kind: 'cap', icon: '📝', text: `یادداشت: «${t}»`, sub: 'یادداشت‌ها', run: () => capture(() => post('/api/inbox', { text: t }), 'یادداشت ذخیره شد.') },
      ...(t.split(/\s+/).length >= 3 ? [{ kind: 'cap', icon: '✨', text: `بفهم و ثبت کن: «${t}»`, sub: 'با دستیار هوشمند', run: () => capture(async () => { const d = await post('/api/ai/process', { text: t }); if (!(d.done || []).length) throw new Error('دستیار چیزی برای ثبت پیدا نکرد.'); return 'ثبت شد: ' + d.done.join('، '); }) }] : []),
    ];
  }, [q, parsed]);

  const commands = useMemo(() => {
    const t = norm(q.trim());
    const base = [
      ...pages.map(([page, label]) => ({ kind: 'page', icon: '↗', text: label, sub: 'رفتن به صفحه', href: page ? `/?page=${page}` : '/' })),
      { kind: 'act', icon: '💸', text: 'ثبت تراکنش تازه', sub: 'مالی', href: '/?page=finance&tab=ledger' },
      { kind: 'act', icon: '📊', text: 'گزارش ماهانهٔ مالی', sub: 'مالی', href: '/?page=finance' },
      { kind: 'act', icon: '✨', text: 'دستیار هوشمند', sub: 'پرسیدن دربارهٔ داده‌های همین صفحه', run: () => window.dispatchEvent(new Event('lifeos:assistant')) },
      { kind: 'act', icon: '🎯', text: 'اهداف پس‌انداز', sub: 'مالی', href: '/?page=finance&tab=wealth' },
      { kind: 'act', icon: '📅', text: 'تقویم پخش سریال‌ها', sub: 'فیلم و سریال', href: '/?page=upcoming' },
      { kind: 'act', icon: '✨', text: 'پیشنهاد سریال و فیلم', sub: 'فیلم و سریال', href: '/?page=discover' },
      { kind: 'act', icon: '🎯', text: 'حالت تمرکز روشن / خاموش', sub: 'پنهان‌کردن بخش‌های سرگرمی', run: () => window.dispatchEvent(new Event('lifeos:focus-toggle')) },
      { kind: 'act', icon: '🌓', text: 'تغییر حالت روشن / تاریک', sub: 'ظاهر', run: () => { const next = document.documentElement.dataset.mode === 'light' ? 'dark' : 'light'; document.documentElement.dataset.mode = next; try { localStorage.setItem('lifeos-mode', next); } catch {} } },
    ];
    return t ? base.filter(c => norm(c.text + ' ' + c.sub).includes(t)) : base;
  }, [q, pages]);
  const rows = useMemo(() => {
    const cmd = commands.slice(0, q.trim() ? 5 : 30), hits = items.map(x => ({ kind: 'hit', ...x }));
    return parsed.length ? [...captureRows, ...cmd, ...hits] : [...cmd, ...hits, ...captureRows];
  }, [commands, items, q, captureRows, parsed.length]);
  useEffect(() => { setSel(0); }, [q, items.length, parsed.length]);
  useEffect(() => { if (enterWaiting.current && parsedFor === q.trim()) { enterWaiting.current = false; go(rows[0]); } }, [parsedFor, rows]);
  useEffect(() => { listRef.current?.querySelector('.cp-row.on')?.scrollIntoView({ block: 'nearest' }); }, [sel]);

  const go = r => { if (!r) return; if (r.kind === 'cap') { r.run(); return; } setOpen(false); if (r.run) r.run(); else if (r.href) location.href = r.href; };
  const onKey = e => {
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(rows.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (parsedFor === q.trim()) go(rows[sel]); else enterWaiting.current = true; } // Enter while the parse is in flight runs once it lands, so it never saves the wrong thing
  };
  if (!open) return null;
  let lastType = null;
  return <div className="cp-bg" onMouseDown={() => setOpen(false)}>
    <div className="cp" dir="rtl" role="dialog" aria-label="جستجو" onMouseDown={e => e.stopPropagation()}>
      <div className="cp-in">
        <span aria-hidden="true">🔍</span>
        <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey} placeholder="جستجو یا ثبت سریع — مثلاً «۸۰ هزار تاکسی»" aria-label="جستجو یا ثبت سریع" />
        {SR ? <button type="button" className={`cp-mic ${listening ? 'on' : ''}`} onClick={toggleMic} aria-pressed={listening} aria-label={listening ? 'توقف ضبط صدا' : 'گفتن با صدا'} title="گفتن با صدا (فارسی)">🎙</button> : null}
        {busy ? <i className="cp-spin" /> : <kbd>Esc</kbd>}
      </div>
      {flash ? <div className={`cp-flash ${flash.ok ? 'ok' : 'bad'}`} role="status">{flash.ok ? '✓ ' : '⚠ '}{flash.text}</div> : null}
      <div className="cp-list" ref={listRef}>
        {rows.map((r, i) => {
          const head = r.kind === 'hit' ? r.type : r.kind === 'page' ? 'صفحه‌ها' : r.kind === 'cap' ? 'ثبت سریع' : 'کارها';
          const showHead = head !== lastType; lastType = head;
          return <div key={i}>
            {showHead ? <div className="cp-head">{head}</div> : null}
            <button type="button" className={`cp-row ${i === sel ? 'on' : ''}${r.kind === 'cap' ? ' cap' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => go(r)}>
              <span className="cp-ic">{r.icon}</span>
              <span className="cp-txt"><b dir="auto">{r.text}</b>{r.sub ? <small dir="auto">{faD(r.sub)}</small> : null}</span>
              {/^\d{4}-\d{2}-\d{2}/.test(r.date || '') ? <em>{(() => { const j = isoToJ(r.date); return `${faD(j.jd)} ${MONTHS[j.jm - 1]} ${faD(j.jy)}`; })()}</em> : null}
            </button>
          </div>;
        })}
        {q.trim().length >= 2 && !busy && !items.length && !captureRows.length ? <p className="cp-empty">چیزی با «{q.trim()}» پیدا نشد.</p> : null}
      </div>
      <div className="cp-foot"><span><kbd>↑</kbd><kbd>↓</kbd> جابه‌جایی</span><span><kbd>Enter</kbd> باز کردن</span><span><kbd>Ctrl</kbd>+<kbd>K</kbd> یا <kbd>/</kbd> از هر صفحه</span></div>
    </div>
  </div>;
}
