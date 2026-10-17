import { useEffect, useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Mic, PenLine, Trash2 } from 'lucide-react';
import { api, fa } from './life-core';
import { Loader } from './loader';
import { AddTest } from './ielts-exams';

// Writing tasks and Speaking cards from the Cambridge books, kept in the shared test library like Reading/Listening
// (skill 'writing' / 'speaking', imported as JSON by the admin; never in the repo — the books are copyrighted).
// Writing: pick a task → it fills the AI marker form (chart image shown, the chart in words goes to the marker).
// Speaking: pick a card → it goes to the cue-card timer and recorder.
function useLibrary(skill) {
  const [d, setD] = useState(null), [err, setErr] = useState('');
  const load = () => api('/api/ielts/exams').then(setD).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);
  const tests = (d?.tests || []).filter(t => t.skill === skill).sort((a, b) => (a.book || 99) - (b.book || 99) || (a.module === 'general') - (b.module === 'general') || (a.test || 0) - (b.test || 0));
  const del = async t => { if (!window.confirm(`«${t.title}» از کتابخانهٔ مشترک حذف شود؟`)) return; await api(`/api/ielts/exams/tests/${t.id}`, { method: 'DELETE' }).catch(e => setErr(e.message)); load(); };
  return { d, err, tests, load, del };
}

function useTest(id) {
  const [t, setT] = useState(null), [err, setErr] = useState('');
  useEffect(() => { if (id) api(`/api/ielts/exams/tests/${id}`).then(setT).catch(e => setErr(e.message)); }, [id]);
  return { t, err };
}

const label = t => `${t.book ? `کمبریج ${fa(t.book)}` : ''}${t.test ? ` · تست ${fa(t.test)}` : ''}${t.module === 'general' ? ' · جنرال' : t.module === 'academic' ? ' · آکادمیک' : ''}`;

function WritingTest({ id, onPick }) {
  const { t, err } = useTest(id), [model, setModel] = useState(null);
  if (err) return <p className="ie-err">{err}</p>;
  if (!t) return <Loader />;
  return <div className="bk-tasks">{t.tasks.map((k, i) => <div key={i} className="bk-task">
    <b><span dir="ltr">{k.task === 'task1' ? 'Task 1' : 'Task 2'}</span><small>{k.task === 'task1' ? '۲۰ دقیقه · حداقل ۱۵۰ کلمه' : '۴۰ دقیقه · حداقل ۲۵۰ کلمه'}</small></b>
    <p dir="ltr" className="bk-prompt">{k.prompt}</p>
    {k.image ? <img className="bk-img" src={k.image} alt={`Task ${i + 1} chart`} loading="lazy" /> : null}
    <div className="ie-row">
      <button type="button" className="ie-btn" onClick={() => onPick({ ...k, title: t.title })}><PenLine size={15} />همین را بنویس</button>
      {k.model ? <button type="button" className="ie-btn ghost" aria-expanded={model === i} onClick={() => setModel(model === i ? null : i)}>{model === i ? <ChevronUp size={15} /> : <ChevronDown size={15} />}نمونه‌پاسخ کتاب</button> : null}
    </div>
    {model === i ? <p className="ie-improved" dir="ltr">{k.model}</p> : null}
  </div>)}</div>;
}

export function WritingBook({ onPick }) {
  const { d, err, tests, load, del } = useLibrary('writing'), [open, setOpen] = useState(null);
  return <section className="ie-card ie-wide">
    <header><h2><BookOpen size={18} />تسک‌های رایتینگ کتاب‌ها</h2><span className="ie-muted">انتخاب کن، بنویس، با هوش مصنوعی تصحیح کن</span></header>
    {err ? <p className="ie-err">{err}</p> : null}
    {!d ? <Loader /> : tests.length ? <ul className="lt-tests bk-list">{tests.map(t => <li key={t.id}>
      <button type="button" className="bk-head" aria-expanded={open === t.id} onClick={() => setOpen(open === t.id ? null : t.id)}>
        <span><b dir="ltr">{t.title}</b><small>{label(t)} · {fa(t.total)} تسک</small></span>{open === t.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {d.admin ? <button type="button" className="ie-x" aria-label="حذف" onClick={() => del(t)}><Trash2 size={15} /></button> : null}
      {open === t.id ? <WritingTest id={t.id} onPick={onPick} /> : null}
    </li>)}</ul> : <p className="ie-muted">هنوز تسکی از کتاب اضافه نشده.</p>}
    {d?.admin ? <AddTest onAdded={load} admin /> : null}
  </section>;
}

function SpeakingTest({ id, onPick }) {
  const { t, err } = useTest(id);
  if (err) return <p className="ie-err">{err}</p>;
  if (!t) return <Loader />;
  return <div className="bk-tasks">{t.cards.map((c, i) => <div key={i} className="bk-task">
    <b dir="ltr">{c.title}</b>
    <p dir="ltr" className="bk-prompt">{c.text}</p>
    <button type="button" className="ie-btn" onClick={() => onPick({ ...c, book: t.title })}><Mic size={15} />تمرین با این کارت</button>
  </div>)}</div>;
}

export function SpeakingBook({ onPick }) {
  const { d, err, tests, load, del } = useLibrary('speaking'), [open, setOpen] = useState(null);
  return <section className="ie-card ie-wide">
    <header><h2><BookOpen size={18} />کارت‌های اسپیکینگ کتاب‌ها</h2><span className="ie-muted">کارت را انتخاب کن؛ پایین با تایمر و ضبط تمرین کن</span></header>
    {err ? <p className="ie-err">{err}</p> : null}
    {!d ? <Loader /> : tests.length ? <ul className="lt-tests bk-list">{tests.map(t => <li key={t.id}>
      <button type="button" className="bk-head" aria-expanded={open === t.id} onClick={() => setOpen(open === t.id ? null : t.id)}>
        <span><b dir="ltr">{t.title}</b><small>{label(t)} · {fa(t.total)} کارت</small></span>{open === t.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {d.admin ? <button type="button" className="ie-x" aria-label="حذف" onClick={() => del(t)}><Trash2 size={15} /></button> : null}
      {open === t.id ? <SpeakingTest id={t.id} onPick={onPick} /> : null}
    </li>)}</ul> : <p className="ie-muted">هنوز کارتی از کتاب اضافه نشده.</p>}
    {d?.admin ? <AddTest onAdded={load} admin /> : null}
  </section>;
}
