import { useEffect, useState } from 'react';
import { BookOpenCheck, ChevronDown, ChevronUp, Dices, ExternalLink, Headphones, Mic, PenLine, Trash2 } from 'lucide-react';
import { randomTopic } from './ielts-topics';
import { api, fa, jl } from './life-core';
import { Loader } from './loader';
import { ExamsCard, ExamView } from './ielts-exams';
import { SpeakingPanel } from './ielts-speaking';
import { WritingBook } from './ielts-book';
import { IeltsStatus } from './ielts-status';
import { clock } from './ielts-cd';

// «آیلتس» tab of the learning hub, one tab per skill: Reading and Listening tests from the shared library
// (/api/ielts/exams, run in ielts-reading.jsx / ielts-listening.jsx), AI Writing marking (/api/ielts/writing),
// Speaking practice and links to outside practice and resources.
const CRIT = { ta: 'Task Achievement', tr: 'Task Response', cc: 'Coherence & Cohesion', lr: 'Lexical Resource', gra: 'Grammar Range & Accuracy' };
const CRIT_FA = { ta: 'پاسخ به خواستهٔ تسک', tr: 'پاسخ به سؤال', cc: 'انسجام و پیوستگی', lr: 'دامنهٔ واژگان', gra: 'دستور زبان' };
// outside practice and resources, per skill
const LINKS = {
  reading: [['https://ieltsonlinetests.com', 'IELTS Online Tests', 'آزمون آزمایشی کامل آکادمیک و جنرال'], ['https://practicepteonline.com', 'Practice Online', '۲۲۵ ریدینگ آکادمیک و ۱۰۰ جنرال'], ['https://ielts-up.com', 'IELTS-up', 'تمرین ریدینگ و لغات']],
  listening: [['https://ieltsonlinetests.com', 'IELTS Online Tests', 'آزمون لیسنینگ کامل با صوت'], ['https://practicepteonline.com', 'Practice Online', '۱۸۴ آزمون لیسنینگ'], ['https://ielts-up.com', 'IELTS-up', 'تمرین لیسنینگ بخش به بخش']],
  writing: [['https://www.ieltsbuddy.com', 'IELTS Buddy', 'نمونه‌انشا و راهنمای تسک ۱'], ['https://writing9.com', 'Writing9', 'موضوعات تسک ۲ و نمونه‌ها'], ['https://ieltsliz.com', 'IELTS Liz', 'نکته و درس رایگان (با VPN)'], ['https://ielts.org/take-a-test/preparation-resources/understanding-band-scores', 'معیارهای رسمی نمره (Band Descriptors)', 'همان چهار معیاری که تصحیح هوشمند با آن نمره می‌دهد']],
  speaking: [['https://ielts-up.com', 'IELTS-up', 'لغات و نمونه‌پاسخ اسپیکینگ'], ['https://ieltsliz.com', 'IELTS Liz', 'سؤال‌ها و نکته‌های اسپیکینگ (با VPN)'], ['https://ielts.org/take-a-test/preparation-resources/understanding-band-scores', 'معیارهای رسمی نمره', 'چهار معیار اسپیکینگ']],
};
const VOCAB_RES = [
  ['/?page=vocab', 'اپ زبان هِسته', 'بیش از ۷۰۰۰ واژهٔ آیلتس با مرور فاصله‌دار، جزوه و معلم'],
  ['https://github.com/Ecattea/COCA-English-Anki-Deck', '۵۰۰۰ لغت پرکاربرد COCA برای Anki', 'فایل apkg را در Anki وارد کن؛ فقط استفادهٔ شخصی'],
];
const words = s => (String(s || '').match(/[A-Za-z0-9'’-]+/g) || []).length;
const band = b => b == null ? '—' : fa(b, 1);

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

// A book task picked in WritingBook fills the form: its prompt, chart and a countdown (20 / 40 minutes, as in the test).
function Timer({ minutes }) {
  const [left, setLeft] = useState(null);
  useEffect(() => { setLeft(null); }, [minutes]);
  useEffect(() => {
    if (left == null || left <= 0) return;
    const id = setTimeout(() => setLeft(s => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);
  return left == null ? <button type="button" className="ie-btn ghost" onClick={() => setLeft(minutes * 60)}>شروع زمان ({fa(minutes)} دقیقه)</button>
    : <span className={`sp-time ${left < 120 ? 'live' : ''}`}>{left > 0 ? `${clock(left)} مانده` : 'زمان تمام شد'}</span>;
}

function Writing({ preset, onClear }) {
  const [task, setTask] = useState('task2'), [question, setQuestion] = useState(''), [essay, setEssay] = useState('');
  useEffect(() => { if (!preset) return; setTask(preset.task); setQuestion(preset.prompt); setCur(null); }, [preset]);
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [cur, setCur] = useState(null), [hist, setHist] = useState(null), [openId, setOpenId] = useState(null);
  const load = () => api('/api/ielts/writing').then(x => setHist(x.items || [])).catch(() => setHist([]));
  useEffect(() => { load(); }, []);
  const n = words(essay), min = task === 'task1' ? 150 : 250;
  const send = async () => {
    setBusy(true); setErr(''); setCur(null);
    // the marker can't see the chart: the task's chart in words goes with the question
    const q = preset && preset.data && question === preset.prompt ? `${question}\n\n[The chart/diagram shows] ${preset.data}`.slice(0, 2000) : question;
    try { const r = await api('/api/ielts/writing', { method: 'POST', body: JSON.stringify({ task, question: q, essay }) }); setCur(r); load(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const del = async id => { setHist(h => h.filter(x => x.id !== id)); try { await api(`/api/ielts/writing/${id}`, { method: 'DELETE' }); } catch (e) { setErr(e.message); load(); } };
  return <section className="ie-card ie-wide">
    <header><h2><PenLine size={18} />تصحیح رایتینگ با هوش مصنوعی</h2><span className="ie-muted">با ۴ معیار رسمی؛ بازخورد به فارسی</span></header>
    {preset ? <div className="bk-sel">
      <div className="ie-row"><b dir="ltr">{preset.title} · {preset.task === 'task1' ? 'Task 1' : 'Task 2'}</b><span className="ie-row"><Timer minutes={preset.task === 'task1' ? 20 : 40} /><button type="button" className="ie-btn ghost" onClick={onClear}>سؤال آزاد</button></span></div>
      {preset.image ? <img className="bk-img" src={preset.image} alt="Task chart" /> : null}
    </div> : null}
    <div className="ie-seg" role="radiogroup" aria-label="نوع تسک">
      {[['task1', 'Task 1 (گزارش/نامه)'], ['task2', 'Task 2 (انشا)']].map(([k, t]) => <button key={k} type="button" role="radio" aria-checked={task === k} className={task === k ? 'on' : ''} onClick={() => setTask(k)}>{t}</button>)}
    </div>
    <div className="ie-qhead"><label className="ie-label" htmlFor="ie-q">صورت سؤال (اختیاری ولی برای نمرهٔ دقیق لازم)</label>
      <button type="button" className="ie-btn ghost" onClick={() => { onClear?.(); setQuestion(q => randomTopic(task, q)); setCur(null); }} title={task === 'task1' ? 'نامهٔ جنرال؛ Task 1 آکادمیک (نمودار) در فهرست کتاب‌های بالاست' : 'یک موضوع انشای تازه'}><Dices size={15} />موضوع پیشنهادی</button>{!preset && question ? <Timer minutes={task === 'task1' ? 20 : 40} /> : null}</div>
    <textarea id="ie-q" dir="ltr" rows={question.length > 180 ? 6 : 3} value={question} onChange={e => setQuestion(e.target.value)} placeholder="Some people believe that…" />
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

const SKILL_TABS = [['reading', 'ریدینگ', BookOpenCheck], ['listening', 'لیسنینگ', Headphones], ['writing', 'رایتینگ', PenLine], ['speaking', 'اسپیکینگ', Mic]];
const skillFromUrl = () => { const v = new URLSearchParams(location.search).get('s'); return SKILL_TABS.some(([k]) => k === v) ? v : 'reading'; };

export function IeltsPage({ Nav }) {
  const [lt, setLt] = useState(null), [skill, setSkill] = useState(skillFromUrl), [wp, setWp] = useState(null);
  const pick = k => { setSkill(k); try { const u = new URL(location.href); u.searchParams.set('s', k); history.replaceState(null, '', u.pathname + u.search); } catch {} };
  const openExam = o => { setLt(o); window.scrollTo(0, 0); };
  if (lt) return <main className="lf ielts-page" dir="rtl"><Nav /><div className="lf-page"><ExamView open={lt} onBack={() => { setLt(null); window.scrollTo(0, 0); }} /></div></main>;
  const links = <details className="ie-card ie-more"><summary>تمرین و منابع بیرونی</summary><LinkList items={LINKS[skill]} /></details>;
  return <main className="lf ielts-page" dir="rtl"><Nav /><div className="lf-page">
    <IeltsStatus tabs={SKILL_TABS} skill={skill} onPick={pick} />
    <div className="ie-grid" role="tabpanel">
      {skill === 'reading' ? <>
        <ExamsCard skill="reading" onOpen={openExam} />
        <section className="ie-card"><header><h2>واژگان</h2></header><LinkList items={VOCAB_RES} /></section>
        {links}
      </> : null}
      {skill === 'listening' ? <><ExamsCard skill="listening" onOpen={openExam} />{links}</> : null}
      {skill === 'writing' ? <><WritingBook onPick={k => { setWp(k); setTimeout(() => document.getElementById('ie-e')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); }} /><Writing preset={wp} onClear={() => setWp(null)} />{links}</> : null}
      {skill === 'speaking' ? <><SpeakingPanel />{links}</> : null}
    </div>
  </div></main>;
}
