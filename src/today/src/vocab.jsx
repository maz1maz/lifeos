// «زبان»: the IELTS flashcard app lives at /vocab/ (static, same origin) and syncs progress to /api/vocab.
// This file wraps it in the LifeOS shell and adds the Today card + stats block.
import { useEffect, useState } from 'react';
import { api, fa } from './life-core';
import './vocab.css';

export function VocabPage({ Nav }) {
  // phones: the app takes the whole screen (no LifeOS top bar, tabs or bottom bar — they stole room and the page
  // panned sideways while swiping a card). The vocab app shows its own «خانه» link to get back.
  const phone = typeof matchMedia === 'function' && matchMedia('(max-width:700px)').matches;
  useEffect(() => {
    if (!phone) return;
    document.documentElement.classList.add('vc-full'); document.body.classList.add('vc-full'); scrollTo(0, 0);
    return () => { document.documentElement.classList.remove('vc-full'); document.body.classList.remove('vc-full'); };
  }, [phone]);
  return <main className={`vc-page${phone ? ' vc-fixed' : ''}`}>{phone ? null : <Nav />}<iframe className="vc-frame" src="/vocab/index.html" title="زبان — فلش‌کارت آیلتس" allow="autoplay" /></main>;
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
        <div className="vc-hw-top"><span className="vc-hw-tag">{wd.hard ? 'واژهٔ سخت' : 'واژهٔ روز'}</span>{wd.hard ? <span className="vc-hw-acts"><button type="button" className="vc-hw-ok" onClick={() => api('/api/vocab/learned', { method: 'POST', body: JSON.stringify({ w: wd.w }) }).then(pick).catch(() => {})} title="دیگر جزو واژه‌های سخت نباشد">✓ یاد گرفتم</button><button type="button" onClick={pick} title="یک واژهٔ سخت دیگر" aria-label="واژهٔ دیگر">↻</button></span> : null}</div>
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
  const days = compact ? s.days.slice(-7) : s.days, max = Math.max(1, ...days.map(d => d.r + d.n));
  const prev = s.days.slice(0, 7).reduce((a, d) => a + d.r + d.n, 0), cur = s.week.r + s.week.n;
  const wd = d => new Intl.DateTimeFormat('fa-IR', { weekday: compact ? 'short' : 'narrow', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));
  return <section className="lf-card vc-stats">
    <h3>📘 زبان {compact ? '· این هفته' : ''}</h3>
    <div className="vc-kpis">
      <div><b>{fa(s.streak)}</b><small>روز پیوسته 🔥</small></div>
      <div><b>{fa(s.mastered)}</b><small>واژهٔ مسلط</small></div>
      <div><b>{fa(s.learning)}</b><small>در حال یادگیری</small></div>
      <div><b>{fa(cur)}</b><small>کارت در ۷ روز · {fa(s.week.n)} نو</small></div>
    </div>
    <div className={`vc-chart${compact ? ' wk' : ''}`} role="img" aria-label={`کارت‌های ${fa(days.length)} روز اخیر`}>
      {days.map(d => <div key={d.date} className="vc-col" title={`${d.date}: ${d.r} مرور · ${d.n} نو`}>
        <em>{d.r + d.n ? fa(d.r + d.n) : ''}</em>
        <span className="vc-stack" style={{ height: `${(d.r + d.n) / max * 100}%` }}><i className="n" style={{ flexGrow: d.n }} /><i className="r" style={{ flexGrow: d.r }} /></span>
        <small>{wd(d.date)}</small>
      </div>)}
    </div>
    <div className="vc-legend"><span><i className="r" />مرور</span><span><i className="n" />واژهٔ نو</span>{prev || cur ? <span className="vc-delta">{cur >= prev ? '▲' : '▼'} {fa(Math.abs(cur - prev))} کارت نسبت به هفتهٔ قبل</span> : null}</div>
    <a className="lf-link" href="/?page=vocab">رفتن به زبان ←</a>
  </section>;
}
