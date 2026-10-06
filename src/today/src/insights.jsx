import { useEffect, useState } from 'react';
import { Page, api, fa } from './life-core';
import { isoToJ, MONTHS } from './jdate';

// «بینش»: what the backend already knows about you, in one place — period report (AI text when a key is set),
// tomorrow's priorities, spending insights, sleep/mood/exercise correlations and «a year ago today».
const PERIODS = [['daily', 'امروز'], ['weekly', 'هفتهٔ اخیر'], ['monthly', 'این ماه']];
const toman = rial => `${fa(Math.round(Number(rial || 0) / 10))} تومان`;
const jDay = iso => { if (!/^\d{4}-\d{2}-\d{2}/.test(iso || '')) return ''; const j = isoToJ(iso); return `${fa(j.jd)} ${MONTHS[j.jm - 1]} ${fa(j.jy, 0).replace(/٬/g, '')}`; };
const tomorrowIso = () => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const load = (url, set) => api(url).then(set).catch(e => set({ error: e.message || 'بارگذاری نشد.' }));

function Section({ title, sub, children, className = '' }) {
  return <section className={`ins-card ${className}`}><header><h2>{title}</h2>{sub ? <small>{sub}</small> : null}</header>{children}</section>;
}
const Wait = ({ v }) => v === null ? <p className="ins-muted">در حال بارگذاری…</p> : v?.error ? <p className="ins-muted">⚠ {v.error}</p> : null;

function ReportCard() {
  const [period, setPeriod] = useState('weekly');
  const [r, setR] = useState(null);
  useEffect(() => { setR(null); load(`/api/ai/report?period=${period}`, setR); }, [period]);
  const d = r?.data;
  const tiles = d ? [
    ['💸', 'خرج', toman(d.expense)], ['💰', 'درآمد', toman(d.income)], ['✅', 'کار انجام‌شده', fa(d.tasksDone)],
    ['⏱', 'ساعت کار', fa(d.workHours)], ['🔥', 'عادت انجام‌شده', fa(d.habitsDone)], ['🙂', 'میانگین حال', d.avgMood != null ? fa(d.avgMood) : '—'],
  ] : [];
  return <Section title="گزارش" sub={d ? (d.from === d.to ? jDay(d.from) : `${jDay(d.from)} تا ${jDay(d.to)}`) : ''} className="ins-report">
    <div className="ins-tabs" role="tablist">{PERIODS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={period === k} className={period === k ? 'on' : ''} onClick={() => setPeriod(k)}>{l}</button>)}</div>
    <Wait v={r} />
    {d ? <>
      <div className="ins-tiles">{tiles.map(([ic, l, v]) => <div key={l}><span>{ic} {l}</span><b>{v}</b></div>)}</div>
      {r.report ? <p className="ins-ai">✨ {r.report}</p> : <p className="ins-muted">{r.aiOff ? 'متن هوشمند گزارش وقتی کلید AI روی سرور تنظیم باشد اینجا می‌آید.' : ''}</p>}
    </> : null}
  </Section>;
}

function PrioritiesCard() {
  const [p, setP] = useState(null), [busy, setBusy] = useState('');
  const refresh = () => load('/api/ai/tomorrow-priorities', setP);
  useEffect(refresh, []);
  const act = async (task, body) => { setBusy(task.id); try { await api(`/api/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify(body) }); await refresh(); } catch {} setBusy(''); };
  const Row = ({ t, late }) => <li><span><b>{t.title}</b><small>{late ? `ددلاین گذشته · ${jDay(t.deadline)}` : 'ددلاین فردا'}</small></span>
    <span className="ins-ops"><button type="button" disabled={busy === t.id} onClick={() => act(t, { done: true })}>انجام شد</button>{late ? <button type="button" disabled={busy === t.id} onClick={() => act(t, { date: tomorrowIso(), deadline: tomorrowIso() })}>بگذار برای فردا</button> : null}</span></li>;
  const empty = p && !p.error && !p.overdueTasks.length && !p.dueTomorrowTasks.length && !p.pendingHabits.length;
  return <Section title="اولویت‌های فردا" sub="از روی ددلاین‌ها و عادت‌های امروز">
    <Wait v={p} />
    {p?.narrative ? <p className="ins-ai">✨ {p.narrative}</p> : null}
    {empty ? <p className="ins-muted">چیز عقب‌افتاده‌ای نیست. فردا را آزاد شروع می‌کنی 🌿</p> : null}
    {p && !p.error ? <ul className="ins-list">
      {p.overdueTasks.map(t => <Row key={t.id} t={t} late />)}
      {p.dueTomorrowTasks.map(t => <Row key={t.id} t={t} />)}
    </ul> : null}
    {p?.pendingHabits?.length ? <p className="ins-habits">🔥 عادت‌های امروز که مانده: {p.pendingHabits.map(h => h.name).join('، ')} · <a href="/?page=habits">عادت‌ها ←</a></p> : null}
  </Section>;
}

function InsightsList() {
  const [v, setV] = useState(null);
  useEffect(() => { load('/api/insights', setV); }, []);
  return <Section title="نکته‌های این ماه">
    <Wait v={v} />
    {v?.items ? (v.items.length ? <ul className="ins-notes">{v.items.map((x, i) => <li key={i}><i>{x.icon}</i><span>{x.text}</span></li>)}</ul> : <p className="ins-muted">هنوز دادهٔ کافی برای نکته نیست.</p>) : null}
  </Section>;
}

function Correlations() {
  const [v, setV] = useState(null);
  useEffect(() => { load('/api/ai/correlations?days=60', setV); }, []);
  const found = (v?.correlations || []).filter(c => c.r != null);
  return <Section title="چه چیزی روی حالت اثر دارد؟" sub={v?.days ? `${fa(v.days)} روز اخیر · ${fa(v.sampleSize)} روز با داده` : ''}>
    <Wait v={v} />
    {v?.correlations ? (found.length ? <ul className="ins-corr">{found.map(c => <li key={c.pair}>
      <span>{c.label}</span>
      <i className="bar"><i style={{ width: `${Math.round(Math.abs(c.r) * 100)}%` }} className={c.r < 0 ? 'neg' : ''} /></i>
      <small>{c.strength}{c.direction ? ` · ${c.direction}` : ''} ({fa(c.sampleSize)} روز)</small>
    </li>)}</ul> : <p className="ins-muted">برای پیدا کردن الگو، چند روز خواب، حال (روزنگار) و ورزش را ثبت کن.</p>) : null}
    <p className="ins-foot">همبستگی یعنی «با هم تغییر کرده‌اند»، نه لزوماً «یکی باعث دیگری شده».</p>
  </Section>;
}

function YearAgo() {
  const [v, setV] = useState(null);
  useEffect(() => { load('/api/one-year-ago', setV); }, []);
  return <Section title="یک سال پیش، امروز" sub={v?.date ? jDay(v.date) : ''}>
    <Wait v={v} />
    {v && !v.error ? (v.hasAnything ? <ul className="ins-notes">
      {v.daily?.note ? <li><i>📔</i><span>{v.daily.note}</span></li> : null}
      {v.tasksDone.map(t => <li key={t.id}><i>✅</i><span>{t.title}</span></li>)}
      {v.transactions.map(t => <li key={t.id}><i>{t.kind === 'expense' ? '💸' : '💰'}</i><span>{t.title} · {toman(t.amount)}</span></li>)}
      {v.moviesWatched.map(m => <li key={m.id}><i>🎬</i><span>{m.title}</span></li>)}
      {v.wins.map(w => <li key={w.id}><i>🏆</i><span>{w.title || w.text}</span></li>)}
    </ul> : <p className="ins-muted">از پارسال همین روز چیزی ثبت نشده. از امروز که ثبت کنی، سال دیگر اینجا می‌بینی‌اش.</p>) : null}
  </Section>;
}

function OnThisDay() {
  const [v, setV] = useState(null);
  useEffect(() => { load('/api/calendar/on-this-day?fa=1', setV); }, []);
  const en = v?.lang === 'en';
  return <Section title="امروز در تاریخ" sub={en ? 'از ویکی‌پدیا (انگلیسی؛ با کلید AI فارسی می‌شود)' : 'از ویکی‌پدیا'}>
    <Wait v={v} />
    {v?.events ? (v.events.length ? <ul className="ins-notes">{v.events.map((e, i) => <li key={i}><i className="ins-year">{fa(e.year, 0).replace(/٬/g, '')}</i><span dir={en ? 'ltr' : undefined}>{e.text}</span></li>)}</ul> : <p className="ins-muted">رویدادی پیدا نشد.</p>) : null}
  </Section>;
}

export function InsightsPage({ Nav }) {
  return <Page Nav={Nav} className="ins" kicker="دستیار هسته" title="بینش" sub="خلاصه، اولویت‌ها و الگوهایی که از داده‌های خودت پیدا شده">
    <div className="ins-grid">
      <ReportCard />
      <PrioritiesCard />
      <InsightsList />
      <Correlations />
      <YearAgo />
      <OnThisDay />
    </div>
  </Page>;
}
