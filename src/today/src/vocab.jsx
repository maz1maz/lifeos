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

// Home dashboard card (inside the draggable grid, styled like the other cards).
export function VocabHomeCard({ Card, Icon }) {
  const [s, setS] = useState(undefined), [wd, setWd] = useState(null);
  const pick = () => api('/api/vocab/summary?hard=1&word=1').then(d => { setWd(d.hard ? { ...d.hard, hard: true } : d.word || null); return d.summary || null; }).catch(() => null);
  useEffect(() => { pick().then(setS); }, []);
  const say = w => { try { const u = new SpeechSynthesisUtterance(w); u.lang = 'en-US'; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch {} };
  const todo = s ? s.due + s.newLeft : 0, done = s ? s.today.r + s.today.n : 0, goal = Math.max(1, done + todo);
  return <Card className="mini-card vc-home" icon={Icon} title="زبان" action={<a href="/?page=vocab">{s && !todo ? 'باز کن ←' : 'شروع ←'}</a>}>
    {s === undefined ? <p className="muted">…</p> : !s ? <a className="vc-home-start" href="/?page=vocab">شروع ۷۰۰۰ واژهٔ آیلتس — روزی ۱۵ واژهٔ نو</a> : <>
      <div className="vc-home-kpis">
        <a href="/?page=vocab"><b>{fa(s.due)}</b><small>مرور</small></a>
        <a href="/?page=vocab"><b>{fa(s.newLeft)}</b><small>واژهٔ نو</small></a>
        <a href="/?page=vocab"><b>{fa(s.streak)}</b><small>روز پیاپی{s.streak ? ' 🔥' : ''}</small></a>
      </div>
      <div className="vc-home-bar" title={`امروز ${done} کارت`}><i style={{ width: `${Math.min(100, done / goal * 100)}%` }} /></div>
      <small className="muted">{todo ? `امروز ${fa(done)} کارت زدی · ${fa(todo)} مانده` : `امروز تمام شد ✓ · ${fa(done)} کارت`}</small>
      {wd ? <div className="vc-home-word">
        <div className="vc-hw-top"><span className="vc-hw-tag">{wd.hard ? 'واژهٔ سخت' : 'واژهٔ روز'}</span>{wd.hard ? <button type="button" onClick={pick} title="یک واژهٔ سخت دیگر" aria-label="واژهٔ دیگر">↻</button> : null}</div>
        <button type="button" className="vc-hw-w" dir="ltr" onClick={() => say(wd.w)} title="تلفظ">{wd.w} <span>🔊</span>{wd.p ? <small>{wd.p}</small> : null}</button>
        <p className="vc-hw-fa">{wd.fa}</p>
        {wd.e ? <p className="vc-hw-e" dir="ltr">{wd.e}</p> : null}
        {wd.ef ? <p className="vc-hw-ef">{wd.ef}</p> : null}
      </div> : null}
    </>}
  </Card>;
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
