import { useEffect, useRef, useState } from 'react';
import { Send, Sparkles, Trash2, X } from 'lucide-react';
import { api } from './life-core';

// Side panel of the AI assistant, available on every page. It sends the current page with each question so the
// Worker (/api/ai/chat) adds that page's own recent rows to the context. The chat lives in sessionStorage.
const KEY = 'lifeos-assistant-log';
const PAGE_FA = { '': 'امروز', planner: 'برنامه‌ریز', calendar: 'تقویم', finance: 'مالی', projects: 'پروژه‌ها', courses: 'دوره‌ها', health: 'سلامت', car: 'خودرو', travel: 'سفر', notes: 'یادداشت‌ها', journal: 'روزنگار', habits: 'عادت‌ها', goals: 'اهداف', review: 'مرور', logbook: 'دفتر', contacts: 'مخاطبین', documents: 'مدارک', learning: 'یادگیری', reading: 'خواندنی‌ها', crm: 'فروش', series: 'سریال‌ها', movies: 'فیلم‌ها' };
const SUGGEST = {
  '': ['امروز روی چه چیزی تمرکز کنم؟', 'این هفته حالم چطور بوده؟'],
  finance: ['بیشترین خرج این ماه کجا بوده؟', 'کجا می‌توانم صرفه‌جویی کنم؟'],
  planner: ['کارهای عقب‌افتاده‌ام را اولویت‌بندی کن', 'برنامهٔ فردا را بچین'],
  calendar: ['این هفته چه کارهای مهمی دارم؟'],
  projects: ['کدام پروژه بیشتر عقب است؟', 'خلاصهٔ وضعیت پروژه‌ها'],
  habits: ['کدام عادت را بیشتر جا انداخته‌ام؟'],
  health: ['روند سلامتم را خلاصه کن'],
  notes: ['یادداشت‌هایم را دسته‌بندی کن'],
  goals: ['کدام هدف بیشتر به توجه نیاز دارد؟'],
};
const pageNow = () => new URLSearchParams(location.search).get('page') || '';
const readLog = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch { return []; } };

export default function AssistantPanel({ onClose }) {
  const [log, setLog] = useState(readLog), [text, setText] = useState(''), [busy, setBusy] = useState(false);
  const page = pageNow(), listRef = useRef(null), inputRef = useRef(null);
  useEffect(() => { try { sessionStorage.setItem(KEY, JSON.stringify(log.slice(-30))); } catch {} listRef.current?.scrollTo(0, 1e6); }, [log]);
  useEffect(() => { inputRef.current?.focus(); const k = e => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  const ask = async q => {
    const msg = String(q ?? text).trim(); if (!msg || busy) return;
    const history = log.slice(-10).map(m => ({ role: m.role, content: m.content }));
    setLog(l => [...l, { role: 'user', content: msg }]); setText(''); setBusy(true);
    try { const d = await api('/api/ai/chat', { method: 'POST', body: JSON.stringify({ message: msg, history, page }) }); setLog(l => [...l, { role: 'assistant', content: d.reply }]); }
    catch (e) { setLog(l => [...l, { role: 'assistant', content: '⚠ ' + e.message, err: true }]); }
    setBusy(false); inputRef.current?.focus();
  };
  return <aside className="as-panel" dir="rtl" role="dialog" aria-label="دستیار هوشمند">
    <header>
      <Sparkles size={18} aria-hidden="true" /><b>دستیار</b><small>صفحهٔ {PAGE_FA[page] || page}</small>
      <span className="as-sp" />
      {log.length ? <button type="button" className="as-ic" onClick={() => setLog([])} aria-label="پاک کردن گفتگو" title="پاک کردن گفتگو"><Trash2 size={16} /></button> : null}
      <button type="button" className="as-ic" onClick={onClose} aria-label="بستن دستیار"><X size={18} /></button>
    </header>
    <div className="as-log" ref={listRef} aria-live="polite">
      {!log.length ? <div className="as-empty">
        <p>هر سؤالی دربارهٔ داده‌های خودت داری بپرس؛ دستیار داده‌های همین صفحه را هم می‌بیند.</p>
        <div className="as-sug">{(SUGGEST[page] || SUGGEST['']).map(s => <button type="button" key={s} onClick={() => ask(s)}>{s}</button>)}</div>
      </div> : log.map((m, i) => <div key={i} className={`as-msg ${m.role}${m.err ? ' err' : ''}`} dir="auto">{m.content}</div>)}
      {busy ? <div className="as-msg assistant as-typing" aria-label="در حال نوشتن"><i /><i /><i /></div> : null}
    </div>
    <form className="as-in" onSubmit={e => { e.preventDefault(); ask(); }}>
      <textarea ref={inputRef} rows={1} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }} placeholder="سؤالت را بنویس…" aria-label="پیام به دستیار" />
      <button type="submit" disabled={busy || !text.trim()} aria-label="فرستادن"><Send size={17} /></button>
    </form>
  </aside>;
}
