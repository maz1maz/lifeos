import { useEffect, useState } from 'react';
import { ArrowRight, BookOpenCheck, ChevronDown, ChevronUp, ExternalLink, PenLine, Trash2 } from 'lucide-react';
import { Page, api, fa, jl } from './life-core';
import { Loader } from './loader';
import { ExamsCard, ExamView } from './ielts-exams';

// «آیلتس» tab of the learning hub: the Persian build of IELTS Atlas (static app in public/ielts/, behind the
// login; synced with scripts/sync-ielts.js), question-bank numbers from /ielts/lifeos-stats.json, AI Writing
// marking (/api/ielts/writing) and links to outside practice and resources.
const PARTS = [['P1', 'پسیج ۱', 'آسان‌تر · ۲۰ دقیقه'], ['P2', 'پسیج ۲', 'متوسط · ۲۰ دقیقه'], ['P3', 'پسیج ۳', 'سخت‌تر · ۲۰ دقیقه']];
const KINDS = [
  ['تکمیل (جدول، خلاصه، جمله، یادداشت…)', /_completion$/],
  ['تطبیق', /^matching$/],
  ['True/False/Not Given و Yes/No', /_not_given$/],
  ['چندگزینه‌ای', /choice$/],
  ['جواب کوتاه', /^short_answer$/],
  ['دسته‌بندی', /^classification$/],
];
const CRIT = { ta: 'Task Achievement', tr: 'Task Response', cc: 'Coherence & Cohesion', lr: 'Lexical Resource', gra: 'Grammar Range & Accuracy' };
const CRIT_FA = { ta: 'پاسخ به خواستهٔ تسک', tr: 'پاسخ به سؤال', cc: 'انسجام و پیوستگی', lr: 'دامنهٔ واژگان', gra: 'دستور زبان' };
const LINKS = [
  ['https://ieltsonlinetests.com', 'IELTS Online Tests', 'آزمون آزمایشی کامل آکادمیک و جنرال'],
  ['https://practicepteonline.com', 'Practice Online', '۱۸۴ لیسنینگ، ۲۲۵ ریدینگ آکادمیک، ۱۰۰ جنرال'],
  ['https://ielts-up.com', 'IELTS-up', 'لیسنینگ، ریدینگ و لغات رایتینگ و اسپیکینگ'],
  ['https://www.ieltsbuddy.com', 'IELTS Buddy', 'نمونه‌انشا و راهنمای تسک ۱'],
  ['https://writing9.com', 'Writing9', 'موضوعات تسک ۲ و نمونه‌ها'],
  ['https://ieltsliz.com', 'IELTS Liz', 'نکته و درس رایگان (با VPN)'],
];
const RES = [
  ['https://ielts.org/take-a-test/preparation-resources/understanding-band-scores', 'معیارهای رسمی نمره (Band Descriptors)', 'همان چهار معیاری که تصحیح هوشمند پایین با آن نمره می‌دهد'],
  ['https://github.com/Ecattea/COCA-English-Anki-Deck', '۵۰۰۰ لغت پرکاربرد COCA برای Anki', 'فایل apkg را در Anki وارد کن؛ فقط استفادهٔ شخصی'],
  ['/?page=vocab', 'اپ زبان هِسته', '۴۴۹۴ واژهٔ آیلتس با مرور فاصله‌دار'],
];
const words = s => (String(s || '').match(/[A-Za-z0-9'’-]+/g) || []).length;
const band = b => b == null ? '—' : fa(b, 1);

function BankStats() {
  const [s, setS] = useState(null);
  useEffect(() => { fetch('/ielts/lifeos-stats.json', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(setS).catch(() => setS(null)); }, []);
  if (!s) return null;
  const kinds = KINDS.map(([label, re]) => [label, Object.entries(s.kinds || {}).filter(([k]) => re.test(k)).reduce((a, [, n]) => a + n, 0)]).filter(([, n]) => n);
  const maxK = Math.max(1, ...kinds.map(([, n]) => n));
  return <section className="ie-card">
    <header><h2>بانک سؤال ریدینگ</h2><span className="ie-muted">{fa(s.passages)} متن · {fa(s.questions)} سؤال</span></header>
    <div className="ie-parts">
      {PARTS.map(([k, t, sub]) => { const p = s.parts?.[k]; if (!p) return null; return <div key={k}>
        <b>{t}</b><small>{sub}</small>
        <span className="ie-big">{fa(p.passages)} <small>متن</small></span>
        <small>{fa(p.questions)} سؤال · سختی {p.difficulty ? `${fa(p.difficulty, 1)} از ۵` : '—'}</small>
        <small>پرتکرار {fa(p.high + p.medium)} · کم‌تکرار {fa(p.low)}</small>
      </div>; })}
    </div>
    <h3 className="ie-h3">بخش‌های سؤال</h3>
    <ul className="ie-bars">{kinds.map(([label, n]) => <li key={label}><span>{label}</span><i><em style={{ width: `${Math.round(n / maxK * 100)}%` }} /></i><b>{fa(n)}</b></li>)}</ul>
  </section>;
}

function Result({ r }) {
  const [open, setOpen] = useState(false);
  return <div className="ie-result">
    <div className="ie-overall"><span>نمرهٔ کل</span><b>{band(r.overall)}</b><small>{r.task === 'task1' ? 'Task 1' : 'Task 2'} · {fa(r.words)} کلمه</small></div>
    <div className="ie-crit">
      {Object.entries(r.criteria || {}).map(([k, c]) => <div key={k}>
        <header><b>{CRIT_FA[k]}</b><small dir="ltr">{CRIT[k]}</small><span className="ie-band">{band(c.band)}</span></header>
        <i className="ie-meter"><em style={{ width: `${(c.band || 0) / 9 * 100}%` }} /></i>
        <p>{c.feedback}</p>
      </div>)}
    </div>
    {r.strengths?.length ? <><h3 className="ie-h3">نقاط قوت</h3><ul className="ie-list">{r.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul></> : null}
    {r.improvements?.length ? <><h3 className="ie-h3">برای نمرهٔ بالاتر</h3><ul className="ie-list">{r.improvements.map((x, i) => <li key={i}>{x}</li>)}</ul></> : null}
    {r.mistakes?.length ? <><h3 className="ie-h3">اشتباه‌ها</h3><ul className="ie-mist">{r.mistakes.map((m, i) => <li key={i}><s dir="ltr">{m.original}</s><b dir="ltr">{m.fix}</b><small>{m.why}</small></li>)}</ul></> : null}
    {r.improved ? <>
      <button type="button" className="ie-btn ghost" onClick={() => setOpen(o => !o)} aria-expanded={open}>{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}نسخهٔ بازنویسی‌شده (حدود ۷٫۵ تا ۸)</button>
      {open ? <p className="ie-improved" dir="ltr">{r.improved}</p> : null}
    </> : null}
  </div>;
}

function Writing() {
  const [task, setTask] = useState('task2'), [question, setQuestion] = useState(''), [essay, setEssay] = useState('');
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [cur, setCur] = useState(null), [hist, setHist] = useState(null), [openId, setOpenId] = useState(null);
  const load = () => api('/api/ielts/writing').then(x => setHist(x.items || [])).catch(() => setHist([]));
  useEffect(() => { load(); }, []);
  const n = words(essay), min = task === 'task1' ? 150 : 250;
  const send = async () => {
    setBusy(true); setErr(''); setCur(null);
    try { const r = await api('/api/ielts/writing', { method: 'POST', body: JSON.stringify({ task, question, essay }) }); setCur(r); load(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const del = async id => { setHist(h => h.filter(x => x.id !== id)); try { await api(`/api/ielts/writing/${id}`, { method: 'DELETE' }); } catch (e) { setErr(e.message); load(); } };
  return <section className="ie-card ie-wide">
    <header><h2><PenLine size={18} />تصحیح رایتینگ با هوش مصنوعی</h2><span className="ie-muted">با ۴ معیار رسمی؛ بازخورد به فارسی</span></header>
    <div className="ie-seg" role="radiogroup" aria-label="نوع تسک">
      {[['task1', 'Task 1 (گزارش/نامه)'], ['task2', 'Task 2 (انشا)']].map(([k, t]) => <button key={k} type="button" role="radio" aria-checked={task === k} className={task === k ? 'on' : ''} onClick={() => setTask(k)}>{t}</button>)}
    </div>
    <label className="ie-label" htmlFor="ie-q">صورت سؤال (اختیاری ولی برای نمرهٔ دقیق لازم)</label>
    <textarea id="ie-q" dir="ltr" rows={3} value={question} onChange={e => setQuestion(e.target.value)} placeholder="Some people believe that…" />
    <label className="ie-label" htmlFor="ie-e">متن تو</label>
    <textarea id="ie-e" dir="ltr" rows={12} value={essay} onChange={e => setEssay(e.target.value)} />
    <div className="ie-row">
      <button type="button" className="ie-btn" disabled={busy || n < 50} onClick={send}>{busy ? 'در حال تصحیح…' : 'تصحیح کن'}</button>
      <small className={n && n < min ? 'ie-warn' : ''}>{fa(n)} کلمه{n && n < min ? ` · کمتر از حداقل ${fa(min)} کلمه (نمره کم می‌شود)` : ''}</small>
    </div>
    {busy ? <Loader /> : null}
    {err ? <p className="ie-err" role="alert">{err}</p> : null}
    {cur ? <Result r={cur} /> : null}
    {hist?.length ? <>
      <h3 className="ie-h3">تصحیح‌های قبلی</h3>
      <ul className="ie-hist">{hist.map(h => <li key={h.id}>
        <button type="button" className="ie-hrow" onClick={() => setOpenId(openId === h.id ? null : h.id)} aria-expanded={openId === h.id}>
          <span className="ie-band">{band(h.overall)}</span>
          <span><b>{h.task === 'task1' ? 'Task 1' : 'Task 2'}</b> · {jl(h.date)} · {fa(h.words)} کلمه<small dir="ltr">{(h.question || h.essay).slice(0, 90)}</small></span>
        </button>
        <button type="button" className="ie-x" aria-label="حذف" onClick={() => del(h.id)}><Trash2 size={15} /></button>
        {openId === h.id ? <Result r={h} /> : null}
      </li>)}</ul>
    </> : null}
  </section>;
}

const LinkList = ({ items }) => <ul className="ie-links">{items.map(([href, t, d]) => <li key={href}>
  <a href={href} {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}><b>{t}</b>{href.startsWith('http') ? <ExternalLink size={14} /> : null}</a><small>{d}</small>
</li>)}</ul>;

// The app runs inside LifeOS (iframe under the menu) instead of a separate tab; ?page=ielts&app=1 keeps it open on
// reload. Its practice windows still open as popups (the app talks to them through window.opener).
const appUrl = on => { try { const u = new URL(location.href); if (on) u.searchParams.set('app', '1'); else u.searchParams.delete('app'); history.replaceState(null, '', u.pathname + u.search); } catch {} };
function IeltsApp({ Nav, onBack }) {
  return <main className="lf ielts-app" dir="rtl">
    <Nav />
    <div className="ie-appbar">
      <button type="button" className="ie-btn ghost" onClick={onBack}><ArrowRight size={16} />بازگشت به آیلتس</button>
      <a className="ie-applink" href="/ielts/index.html" target="_blank" rel="noopener">باز کردن در پنجرهٔ جدا<ExternalLink size={14} /></a>
    </div>
    <iframe className="ie-frame" src="/ielts/index.html" title="تمرین آیلتس (IELTS Atlas)" />
  </main>;
}

export function IeltsPage({ Nav }) {
  const [app, setApp] = useState(() => new URLSearchParams(location.search).get('app') === '1');
  const toggle = on => { appUrl(on); setApp(on); window.scrollTo(0, 0); };
  const onOpen = () => toggle(true);
  const [lt, setLt] = useState(null);
  if (app) return <IeltsApp Nav={Nav} onBack={() => toggle(false)} />;
  if (lt) return <main className="lf ielts-page" dir="rtl"><Nav /><div className="lf-page"><ExamView open={lt} onBack={() => { setLt(null); window.scrollTo(0, 0); }} /></div></main>;
  return <Page Nav={Nav} className="ielts-page" kicker="یادگیری" title="آیلتس" sub="تمرین ریدینگ، آزمون لیسنینگ، تصحیح رایتینگ و منابع">
    <div className="ie-grid">
      <section className="ie-card ie-hero">
        <header><h2><BookOpenCheck size={18} />تمرین ریدینگ (IELTS Atlas)</h2></header>
        <p className="ie-muted">۲۴۲ متن واقعی ریدینگ با زمان‌سنج، توضیح جواب، دیکشنری و سابقهٔ تمرین. تمرین‌ها در پنجرهٔ جدا باز می‌شوند. سابقه فقط در همین مرورگر ذخیره می‌شود؛ از داخل خود برنامه پشتیبان بگیر.</p>
        <button type="button" className="ie-btn" onClick={onOpen}>باز کردن تمرین آیلتس</button>
        <small className="ie-muted">برنامه متن‌باز (GPL-3.0) از sallowayma-git/IELTS-practice، فارسی‌شده؛ فقط برای استفادهٔ شخصی.</small>
      </section>
      <BankStats />
      <ExamsCard onOpen={o => { setLt(o); window.scrollTo(0, 0); }} />
      <Writing />
      <section className="ie-card"><header><h2>تمرین آنلاین</h2></header><LinkList items={LINKS} /></section>
      <section className="ie-card"><header><h2>منابع</h2></header><LinkList items={RES} /></section>
    </div>
  </Page>;
}
