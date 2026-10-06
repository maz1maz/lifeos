import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { Page, api, fa, todayIso } from './life-core';
import { JalaliDateInput, isoToJ, MONTHS, jLabel } from './jdate';


// «دفتر و مرور»: a Jalali-month review (numbers + your own reflection + AI note when a key is set), the wins
// log and the decision journal. Backend: /api/life-review (period=jmonthly), /api/wins, /api/decisions.
const toman = rial => `${fa(Math.round(Number(rial || 0) / 10))} تومان`;
const mKey = (jy, jm) => `${jy}-${String(jm).padStart(2, '0')}`;
const tehranDay = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const faY = y => String(y).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);

function MonthReview() {
  const t = isoToJ(todayIso());
  const [ym, setYm] = useState({ jy: t.jy, jm: t.jm });
  const [d, setD] = useState(null), [text, setText] = useState(''), [saved, setSaved] = useState('');
  const key = mKey(ym.jy, ym.jm);
  useEffect(() => {
    setD(null); setSaved('');
    api(`/api/life-review?period=jmonthly&key=${key}`).then(x => { setD(x); setText(x.reflection || ''); }).catch(e => setD({ error: e.message }));
  }, [key]);
  const shift = n => setYm(({ jy, jm }) => { let m = jm + n, y = jy; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } return { jy: y, jm: m }; });
  const isCur = ym.jy === t.jy && ym.jm === t.jm;
  const save = async () => { try { await api('/api/life-review', { method: 'PUT', body: JSON.stringify({ period: 'jmonthly', periodKey: key, reflection: text }) }); setSaved('ذخیره شد ✓'); } catch (e) { setSaved(e.message); } };
  const s = d?.stats;
  return <section className="lb-card lb-month">
    <header>
      <h2>مرور ماه</h2>
      {/* RTL: «ماه قبل» on the right pointing right, «ماه بعد» on the left pointing left */}
      <div className="lb-nav">
        <button type="button" onClick={() => shift(-1)} aria-label="ماه قبل"><ChevronRight size={16} /></button>
        <b>{MONTHS[ym.jm - 1]} {faY(ym.jy)}</b>
        <button type="button" onClick={() => shift(1)} disabled={isCur} aria-label="ماه بعد"><ChevronLeft size={16} /></button>
      </div>
    </header>
    {!d ? <p className="lb-muted">در حال بارگذاری…</p> : d.error ? <p className="lb-muted">⚠ {d.error}</p> : <>
      <div className="lb-tiles">
        <div><span>💸 خرج</span><b>{toman(s.expense)}</b></div>
        <div><span>✅ کار انجام‌شده</span><b>{fa(s.tasksDone)}</b></div>
        <div><span>🏆 پیروزی</span><b>{fa(s.winsCount)}</b></div>
        <div><span>🙂 میانگین حال</span><b>{s.avgMood != null ? fa(s.avgMood) : '—'}</b></div>
      </div>
      {d.narrative ? <p className="lb-ai">✨ {d.narrative}</p> : null}
      <label className="lb-label" htmlFor="lb-reflect">این ماه برای خودت چه بود؟ (فقط خودت می‌بینی)</label>
      <textarea id="lb-reflect" rows={4} value={text} onChange={e => { setText(e.target.value); setSaved(''); }} placeholder="چه چیزی خوب پیش رفت؟ چه چیزی را ماه بعد عوض می‌کنی؟" />
      <div className="lb-row"><button type="button" className="lb-btn" onClick={save}>ذخیرهٔ مرور</button><small>{saved}</small></div>
    </>}
  </section>;
}

function Wins() {
  const [items, setItems] = useState(null), [text, setText] = useState(''), [date, setDate] = useState(todayIso()), [err, setErr] = useState('');
  const load = () => api('/api/wins').then(x => setItems(x.items || [])).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);
  const add = async e => { e.preventDefault(); if (!text.trim()) return; try { await api('/api/wins', { method: 'POST', body: JSON.stringify({ text, date }) }); setText(''); setErr(''); load(); } catch (x) { setErr(x.message); } };
  const del = async w => { if (!window.confirm('این پیروزی حذف شود؟')) return; await api(`/api/wins/${w.id}`, { method: 'DELETE' }).catch(() => {}); load(); };
  return <section className="lb-card">
    <header><h2>🏆 پیروزی‌ها</h2><small className="lb-muted">{items ? `${fa(items.length)} مورد` : ''}</small></header>
    <form className="lb-add" onSubmit={add}>
      <input value={text} onChange={e => setText(e.target.value)} placeholder="یک پیروزی کوچک یا بزرگ… مثلاً «قرارداد را بستم»" aria-label="متن پیروزی" />
      <JalaliDateInput value={date} onChange={setDate} clearable={false} />
      <button type="submit" className="lb-btn">ثبت</button>
    </form>
    {err ? <p className="lb-muted">⚠ {err}</p> : null}
    {items === null ? <p className="lb-muted">در حال بارگذاری…</p> : !items.length ? <p className="lb-muted">هنوز چیزی ثبت نشده. ثبت پیروزی‌ها در روزهای سخت یادت می‌آورد چقدر جلو آمده‌ای.</p>
      : <ul className="lb-list">{items.map(w => <li key={w.id}><span><b>{w.text}</b><small>{jLabel(w.date)}</small></span><button type="button" className="lb-x" onClick={() => del(w)} aria-label="حذف"><Trash2 size={15} /></button></li>)}</ul>}
  </section>;
}

function Decisions() {
  const empty = { title: '', options: '', reasoning: '', decision: '', reviewDate: '' };
  const [items, setItems] = useState(null), [f, setF] = useState(empty), [open, setOpen] = useState(false), [err, setErr] = useState(''), [outcomes, setOutcomes] = useState({});
  const load = () => api('/api/decisions').then(x => setItems(x.items || [])).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const add = async e => { e.preventDefault(); if (!f.title.trim()) { setErr('عنوان تصمیم لازم است.'); return; } try { await api('/api/decisions', { method: 'POST', body: JSON.stringify({ ...f, reviewDate: f.reviewDate || null }) }); setF(empty); setOpen(false); setErr(''); load(); } catch (x) { setErr(x.message); } };
  const saveOutcome = async x => { await api(`/api/decisions/${x.id}`, { method: 'PATCH', body: JSON.stringify({ outcome: outcomes[x.id] ?? x.outcome }) }).catch(() => {}); load(); };
  const del = async x => { if (!window.confirm('این تصمیم حذف شود؟')) return; await api(`/api/decisions/${x.id}`, { method: 'DELETE' }).catch(() => {}); load(); };
  const today = todayIso();
  const due = (items || []).filter(x => x.reviewDate && x.reviewDate <= today && !x.outcome);
  return <section className="lb-card">
    <header><h2>⚖️ دفتر تصمیم‌ها</h2>{due.length ? <span className="lb-chip">{fa(due.length)} تصمیم منتظر بازبینی</span> : null}<button type="button" className="lb-btn ghost" onClick={() => setOpen(o => !o)}>{open ? 'بستن' : '＋ تصمیم تازه'}</button></header>
    <p className="lb-muted">تصمیم مهم را با دلیلش بنویس، و در تاریخ بازبینی نتیجه‌اش را. کم‌کم می‌بینی کدام نوع تصمیم‌ها برایت خوب جواب می‌دهد.</p>
    {open ? <form className="lb-form" onSubmit={add}>
      <input value={f.title} onChange={e => set('title', e.target.value)} placeholder="تصمیم دربارهٔ چه؟ (مثلاً «خرید ماشین»)" aria-label="عنوان تصمیم" />
      <textarea rows={2} value={f.options} onChange={e => set('options', e.target.value)} placeholder="گزینه‌ها" aria-label="گزینه‌ها" />
      <textarea rows={2} value={f.reasoning} onChange={e => set('reasoning', e.target.value)} placeholder="دلیل‌ها و فرض‌ها" aria-label="دلیل‌ها" />
      <input value={f.decision} onChange={e => set('decision', e.target.value)} placeholder="چه تصمیمی گرفتی؟" aria-label="تصمیم" />
      <label className="lb-label">تاریخ بازبینی <JalaliDateInput value={f.reviewDate} onChange={v => set('reviewDate', v)} /></label>
      <button type="submit" className="lb-btn">ثبت تصمیم</button>
    </form> : null}
    {err ? <p className="lb-muted">⚠ {err}</p> : null}
    {items === null ? <p className="lb-muted">در حال بارگذاری…</p> : !items.length ? <p className="lb-muted">هنوز تصمیمی ثبت نشده.</p>
      : <ul className="lb-dec">{items.map(x => {
        const isDue = x.reviewDate && x.reviewDate <= today && !x.outcome;
        return <li key={x.id} className={isDue ? 'due' : ''}>
          <div className="lb-dec-head"><b>{x.title}</b><small>{jLabel(tehranDay(x.createdAt))}{x.reviewDate ? ` · بازبینی ${jLabel(x.reviewDate)}` : ''}</small><button type="button" className="lb-x" onClick={() => del(x)} aria-label="حذف"><Trash2 size={15} /></button></div>
          {x.decision ? <p><em>تصمیم:</em> {x.decision}</p> : null}
          {x.reasoning ? <p><em>دلیل:</em> {x.reasoning}</p> : null}
          {x.options ? <p><em>گزینه‌ها:</em> {x.options}</p> : null}
          <div className="lb-outcome"><input value={outcomes[x.id] ?? x.outcome ?? ''} onChange={e => setOutcomes(o => ({ ...o, [x.id]: e.target.value }))} placeholder={isDue ? 'وقت بازبینی است: نتیجه چه شد؟' : 'نتیجه (بعداً)'} aria-label="نتیجهٔ تصمیم" />
            {(outcomes[x.id] ?? x.outcome ?? '') !== (x.outcome || '') ? <button type="button" className="lb-btn" onClick={() => saveOutcome(x)}>ذخیره</button> : null}</div>
        </li>;
      })}</ul>}
  </section>;
}

export function LogbookPage({ Nav }) {
  return <Page Nav={Nav} className="lb" kicker="دفتر و مرور" title="دفتر زندگی" sub="مرور هر ماه، پیروزی‌ها و تصمیم‌های مهم — یک‌جا">
    <MonthReview />
    <div className="lb-grid"><Wins /><Decisions /></div>
  </Page>;
}
