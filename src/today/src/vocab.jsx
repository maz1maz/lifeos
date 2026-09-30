// «زبان»: the IELTS flashcard app lives at /vocab/ (static, same origin) and syncs progress to /api/vocab.
// This file wraps it in the LifeOS shell and adds the Today card + stats block.
import { useEffect, useState } from 'react';
import { api, fa } from './life';
import './vocab.css';

export function VocabPage({ Nav }) {
  return <main className="vc-page"><Nav /><iframe className="vc-frame" src="/vocab/index.html" title="زبان — فلش‌کارت آیلتس" allow="autoplay" /></main>;
}

let SUM = null;
export const vocabSummary = () => (SUM ||= api('/api/vocab/summary').then(d => d.summary || null).catch(() => null));

export function VocabTodayCard() {
  const [s, setS] = useState(undefined);
  useEffect(() => { vocabSummary().then(setS); }, []);
  if (s === undefined) return null;
  const todo = s ? s.due + s.newLeft : 0, doneToday = s ? s.today.r + s.today.n : 0;
  return <a className="vc-today" href="/?page=vocab">
    <b>📘 زبان</b>
    {!s ? <span>شروع ۷۰۰۰ واژهٔ آیلتس — روزی ۱۵ واژهٔ نو</span>
      : todo ? <span>{fa(s.due)} کارت برای مرور · {fa(s.newLeft)} واژهٔ نو{doneToday ? ` · امروز ${fa(doneToday)} کارت زدی` : ''}</span>
      : <span>امروز تمام شد ✓ · {fa(doneToday)} کارت</span>}
    {s?.streak ? <em>🔥 {fa(s.streak)} روز</em> : null}
    <i>{todo || !s ? 'شروع ←' : 'باز کن ←'}</i>
  </a>;
}

// Stats block for Life stats / weekly review.
export function VocabStats({ compact = false }) {
  const [s, setS] = useState(undefined);
  useEffect(() => { vocabSummary().then(setS); }, []);
  if (!s) return null;
  const max = Math.max(1, ...s.days.map(d => d.r + d.n));
  return <section className="lf-card vc-stats">
    <h3>📘 زبان {compact ? '· این هفته' : ''}</h3>
    <div className="vc-kpis">
      <div><b>{fa(s.streak)}</b><small>روز پیوسته 🔥</small></div>
      <div><b>{fa(s.mastered)}</b><small>واژهٔ مسلط</small></div>
      <div><b>{fa(s.learning)}</b><small>در حال یادگیری</small></div>
      <div><b>{fa(s.week.r + s.week.n)}</b><small>کارت در ۷ روز · {fa(s.week.n)} نو</small></div>
    </div>
    {compact ? null : <div className="vc-bars" title="کارت‌های ۱۴ روز اخیر">{s.days.map(d => <i key={d.date} style={{ height: `${(d.r + d.n) / max * 100}%` }} title={`${d.date}: ${d.r + d.n}`} />)}</div>}
    <a className="lf-link" href="/?page=vocab">رفتن به زبان ←</a>
  </section>;
}
