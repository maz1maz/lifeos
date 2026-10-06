// Life widgets the Today page shows (focus timer, shopping list, upcoming bills). Kept apart from life.jsx so
// the Today page doesn't pull every life page into the first bundle; life.jsx re-exports them.
import { useEffect, useRef, useState } from 'react';
import { api, todayIso, addDays, faD, fa, money, dueChip, useCol } from './life-core';

/* ───────────────────────── Focus timer (pomodoro) ───────────────────────── */
const FKEY = 'lifeos-focus';
const readFocus = () => { try { return JSON.parse(localStorage.getItem(FKEY) || 'null'); } catch { return null; } };
const writeFocus = v => { try { v ? localStorage.setItem(FKEY, JSON.stringify(v)) : localStorage.removeItem(FKEY); } catch {} window.dispatchEvent(new Event('lifeos:focus')); };
function useFocusTimer() {
  const [st, setSt] = useState(readFocus), [, tick] = useState(0);
  useEffect(() => { const f = () => setSt(readFocus()); window.addEventListener('lifeos:focus', f); window.addEventListener('storage', f); const t = setInterval(() => tick(x => x + 1), 1000); return () => { window.removeEventListener('lifeos:focus', f); window.removeEventListener('storage', f); clearInterval(t); }; }, []);
  const left = st ? Math.max(0, Math.round((st.endAt - Date.now()) / 1000)) : 0;
  return { st, left };
}
async function finishFocus(st, partial = false) {
  const minutes = Math.round(((partial ? Date.now() : st.endAt) - st.startAt) / 60000);
  writeFocus(null);
  if (st.kind === 'focus' && minutes >= 1) { try { await api('/api/col/focus', { method: 'POST', body: JSON.stringify({ date: todayIso(), minutes, label: st.label || 'بدون برچسب', projectId: st.projectId || null, at: Date.now() }) }); } catch {} }
  try { if ('Notification' in window && Notification.permission === 'granted') new Notification(st.kind === 'focus' ? '⏰ وقت استراحت!' : '💪 برگرد سر کار', { body: st.kind === 'focus' ? `${minutes} دقیقه تمرکز روی «${st.label || 'کار'}» ثبت شد.` : 'استراحت تمام شد.', icon: '/assets/img/icon-192.png' }); } catch {}
  try { const a = new AudioContext(), o = a.createOscillator(), g = a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.setValueAtTime(.2, a.currentTime); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + 1.2); o.start(); o.stop(a.currentTime + 1.2); } catch {}
  window.dispatchEvent(new Event('lifeos:focus-saved'));
}
const mmss = s => `${faD(String(Math.floor(s / 60)).padStart(2, '0'))}:${faD(String(s % 60).padStart(2, '0'))}`;
export function FocusControl({ compact = false }) {
  const { st, left } = useFocusTimer();
  const [label, setLabel] = useState(() => { try { return localStorage.getItem('lifeos-focus-label') || ''; } catch { return ''; } }), [len, setLen] = useState(25);
  const done = useRef(false);
  useEffect(() => { if (st && left === 0 && !done.current) { done.current = true; finishFocus(st); } if (!st || left > 0) done.current = false; }, [st, left]);
  const start = (kind, mins) => { try { localStorage.setItem('lifeos-focus-label', label); if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch {} writeFocus({ kind, label: kind === 'focus' ? label : 'استراحت', startAt: Date.now(), endAt: Date.now() + mins * 60000, mins }); };
  const total = st ? st.mins * 60 : len * 60, pct = st ? 100 - (left / total) * 100 : 0;
  return <div className={`lf-focus ${compact ? 'compact' : ''} ${st?.kind || ''}`}>
    <div className="lf-ring" style={{ '--p': `${pct}%` }}><div><b>{st ? mmss(left) : mmss(len * 60)}</b><small>{st ? (st.kind === 'focus' ? st.label || 'تمرکز' : 'استراحت') : 'آماده'}</small></div></div>
    {st ? <div className="lf-ops"><button className="lf-btn ghost" onClick={() => finishFocus(st, true)}>پایان و ثبت</button><button className="lf-link del" onClick={() => writeFocus(null)}>لغو</button></div> : <>
      <input className="lf-focus-label" value={label} onChange={e => setLabel(e.target.value)} placeholder="روی چه کاری تمرکز می‌کنی؟" />
      <div className="lf-ops">{[25, 50, 90].map(m => <button key={m} className={`lf-chip-btn ${len === m ? 'on' : ''}`} onClick={() => setLen(m)}>{fa(m)} دقیقه</button>)}</div>
      <div className="lf-ops"><button className="lf-btn" onClick={() => start('focus', len)}>▶ شروع تمرکز</button><button className="lf-btn ghost" onClick={() => start('break', 5)}>☕ ۵ دقیقه استراحت</button></div>
    </>}
  </div>;
}
export function FocusCard({ Card, Icon }) {
  return <Card className="mini-card focus-card" icon={Icon} title="تایمر تمرکز" action={<a href="/?page=focus">آمار ←</a>}><FocusControl compact /></Card>;
}

/* ───────────────────────── Shopping list (notes tab) ───────────────────────── */
export function ShoppingPanel() {
  const col = useCol('shopping');
  const [t, setT] = useState(''), [code, setCode] = useState(null), [msg, setMsg] = useState('');
  useEffect(() => { api('/api/me').then(d => setCode(d.user?.shopCode || null)).catch(() => {}); }, []);
  const add = async e => { e.preventDefault(); const parts = t.split(/[،,\n]+/).map(x => x.trim()).filter(Boolean); if (!parts.length) return; await api('/api/col/shopping', { method: 'POST', body: JSON.stringify({ items: parts.map(text => ({ text, done: false })) }) }); setT(''); col.reload(); };
  const share = async (reset = false) => { const r = await api('/api/shop/share', { method: 'POST', body: JSON.stringify({ reset }) }); setCode(r.code); const url = `${location.origin}/s/${r.code}`; try { await navigator.clipboard.writeText(url); setMsg('لینک کپی شد ✓ — برای خانواده بفرست.'); } catch { setMsg(url); } };
  const items = (col.items || []).slice().sort((a, b) => a.done - b.done || (b.createdAt || 0) - (a.createdAt || 0));
  return <section className="lf-card lf-shop" dir="rtl">
    <div className="lf-row-head"><h2>🛒 لیست خرید</h2><div className="lf-ops"><button className="lf-btn ghost" onClick={() => share(false)}>🔗 لینک مشترک</button>{code ? <button className="lf-link" onClick={() => share(true)} title="لینک قبلی باطل می‌شود">لینک تازه</button> : null}</div></div>
    <form className="lf-inline" onSubmit={add}><input value={t} onChange={e => setT(e.target.value)} placeholder="نان، شیر، پنیر… (با ویرگول چندتا با هم)" /><button className="lf-btn">افزودن</button></form>
    <ul className="lf-check big">{items.map(x => <li key={x.id} className={x.done ? 'done' : ''} onClick={() => col.patch(x.id, { done: !x.done })}><i>{x.done ? '✓' : ''}</i><span>{x.text}</span><button className="lf-x" onClick={e => { e.stopPropagation(); col.remove(x.id); }}>×</button></li>)}</ul>
    {items.some(x => x.done) ? <button className="lf-link del" onClick={() => items.filter(x => x.done).forEach(x => col.remove(x.id))}>پاک کردن خریده‌شده‌ها</button> : null}
    <p className="lf-note">{msg || 'با لینک مشترک، خانواده بدون حساب کاربری به همین لیست اضافه می‌کنند. در تلگرام هم: «/خرید نان، شیر» یا «/لیست».'}</p>
  </section>;
}

export function BillsWeekCard({ Card, Icon }) {
  const [items, setItems] = useState(null);
  useEffect(() => { api('/api/subscriptions').then(d => setItems((d.items || []).filter(x => x.nextDate <= addDays(todayIso(), 10)))).catch(() => setItems([])); }, []);
  return <Card className="mini-card" icon={Icon} title="قبض‌ها و اقساط نزدیک" action={<a href="/?page=finance&tab=bills">همه ←</a>}>
    {items === null ? <p className="empty">در حال دریافت…</p> : !items.length ? <p className="empty">تا ۱۰ روز آینده موعدی نیست.</p> : <div className="mini-list">{items.map(x => <a key={x.id} className="mini-note" href="/?page=finance&tab=bills"><b>{x.name} {dueChip(x.nextDate)}</b><small>{money(x.amount)}</small></a>)}</div>}
  </Card>;
}
