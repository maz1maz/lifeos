import { useEffect, useState } from 'react';
import { BookOpenCheck, Headphones, Trash2, Upload, Users } from 'lucide-react';
import { api, fa, jl } from './life-core';
import { Loader } from './loader';
import { Review, band } from './ielts-paper';
import { ListeningExam } from './ielts-listening';
import { MarkedPassages, ReadingExam } from './ielts-reading';

// «آزمون‌ها» on the IELTS tab: Reading and Listening tests imported as JSON (questions + key, passages or tapescript;
// never in the repo — the books are copyrighted and the repository is public). Listening audio goes to the user's
// Telegram chat. API: /api/ielts/exams (cloudflare/lib/api.js + lib/ielts.js).
function AddTest({ onAdded, admin }) {
  const [msg, setMsg] = useState(''), [busy, setBusy] = useState(false), [shared, setShared] = useState(true);
  const pick = async e => {
    const files = [...(e.target.files || [])]; e.target.value = ''; if (!files.length) return;
    setBusy(true); setMsg('');
    const done = [], bad = [];
    for (const f of files) {
      try { const r = await fetch(`/api/ielts/exams/tests${admin && shared ? '?shared=1' : ''}`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: await f.text() }); const j = await r.json(); if (!r.ok) throw new Error(j.error); done.push(j.title); }
      catch (er) { bad.push(`${f.name}: ${er.message}`); }
    }
    setMsg([done.length ? `${fa(done.length)} آزمون اضافه شد.` : '', ...bad].filter(Boolean).join(' · ')); setBusy(false); onAdded();
  };
  return <div className="lt-add">
    <label className="ie-btn ghost lt-file"><Upload size={15} />{busy ? 'در حال افزودن…' : 'افزودن آزمون (فایل JSON)'}<input type="file" accept="application/json,.json" multiple onChange={pick} hidden />{msg ? <small>{msg}</small> : null}</label>
    {admin ? <label className="lt-sharechk"><input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} />برای همهٔ کاربران</label> : null}
  </div>;
}

function AudioUpload({ test, onDone }) {
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState('');
  const pick = async e => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    setBusy(true); setMsg('');
    try { const r = await fetch(`/api/ielts/exams/tests/${test.id}/audio`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': f.type || 'audio/mpeg' }, body: f }); const j = await r.json(); if (!r.ok) throw new Error(j.error); onDone(); }
    catch (er) { setMsg(er.message); } finally { setBusy(false); }
  };
  return <label className="ie-btn ghost lt-file"><Upload size={15} />{busy ? 'در حال آپلود…' : test.audio ? 'تعویض صوت' : 'آپلود صوت'}<input type="file" accept="audio/*" onChange={pick} hidden />{msg ? <small className="ie-err">{msg}</small> : null}</label>;
}

export function ExamsCard({ onOpen, skill = 'reading' }) {
  const [d, setD] = useState(null), [err, setErr] = useState('');
  const load = () => api('/api/ielts/exams').then(setD).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);
  const share = async t => { await api(`/api/ielts/exams/tests/${t.id}`, { method: 'PATCH', body: JSON.stringify({ shared: !t.shared }) }).catch(e => setErr(e.message)); load(); };
  const del = async t => { if (!window.confirm(t.shared ? `«${t.title}» از کتابخانهٔ مشترک برای همهٔ کاربران حذف شود؟` : `«${t.title}» و نتیجه‌هایش حذف شود؟`)) return; await api(`/api/ielts/exams/tests/${t.id}`, { method: 'DELETE' }).catch(e => setErr(e.message)); load(); };
  const title = id => d?.tests.find(t => t.id === id)?.title || id;
  const tests = (d?.tests || []).filter(t => (t.skill || 'listening') === skill).sort((a, b) => (a.book || 99) - (b.book || 99) || (a.test || 0) - (b.test || 0) || a.title.localeCompare(b.title));
  const attempts = (d?.attempts || []).filter(a => (a.skill || 'listening') === skill);
  return <section className="ie-card ie-wide">
    <header><h2>{skill === 'reading' ? <BookOpenCheck size={18} /> : <Headphones size={18} />}آزمون‌های {skill === 'reading' ? 'ریدینگ' : 'لیسنینگ'}</h2><span className="ie-muted">کمبریج؛ تصحیح خودکار و نمرهٔ باند</span></header>
    {err ? <p className="ie-err">{err}</p> : null}
    {!d ? <Loader /> : <>
      {tests.length ? <ul className="lt-tests">{tests.map(t => <li key={t.id}>
        <div><b dir="ltr">{t.title}</b>{t.shared ? <span className="lt-badge"><Users size={12} />مشترک</span> : null}<small>{t.module === 'general' ? 'جنرال · ' : t.module === 'academic' ? 'آکادمیک · ' : ''}{fa(t.total)} سؤال · {t.attempts ? `${fa(t.attempts)} بار · بهترین باند ${band(t.best)}` : 'هنوز انجام نداده‌ای'}{skill === 'listening' && !t.audio ? ' · صوت آپلود نشده' : ''}</small></div>
        <div className="lt-ops">
          {skill === 'reading' ? <>
            <button type="button" className="ie-btn" onClick={() => onOpen({ testId: t.id, skill, mode: 'exam' })}>آزمون ۶۰ دقیقه</button>
            <button type="button" className="ie-btn ghost" onClick={() => onOpen({ testId: t.id, skill, mode: 'practice' })}>تمرین</button>
            <select className="lt-passel" value="" aria-label="فقط یک پسیج" onChange={e => { const i = Number(e.target.value); if (e.target.value !== '') onOpen({ testId: t.id, skill, mode: 'exam', parts: [i] }); }}>
              <option value="">یک پسیج (۲۰ دقیقه)…</option>{(t.parts || [0, 1, 2]).map((_, i) => <option key={i} value={i}>پسیج {fa(i + 1)}</option>)}
            </select>
          </> : <>
            {t.audio ? <><button type="button" className="ie-btn" onClick={() => onOpen({ testId: t.id, skill, mode: 'exam' })}>شروع آزمون</button>
              <button type="button" className="ie-btn ghost" onClick={() => onOpen({ testId: t.id, skill, mode: 'practice' })}>تمرین</button></> : null}
            {t.mine || d.admin ? <AudioUpload test={t} onDone={load} /> : null}
          </>}
          {d.admin ? <button type="button" className="ie-btn ghost" onClick={() => share(t)} title={t.shared ? 'فقط برای من' : 'اشتراک با همهٔ کاربران'}><Users size={14} />{t.shared ? 'فقط برای من' : 'برای همه'}</button> : null}
          {t.mine || d.admin ? <button type="button" className="ie-x" aria-label="حذف آزمون" onClick={() => del(t)}><Trash2 size={15} /></button> : null}
        </div>
      </li>)}</ul> : <p className="ie-muted">{!d.admin ? 'هنوز آزمونی اضافه نشده.' : skill === 'reading' ? 'هنوز آزمون ریدینگی اضافه نشده. فایل JSON آزمون‌ها را اضافه کن.' : 'هنوز آزمون لیسنینگی اضافه نشده. فایل JSON آزمون را اضافه کن و بعد صوتش را آپلود کن؛ صوت در چت تلگرام خودت نگه داشته می‌شود.'}</p>}
      {d.admin ? <AddTest onAdded={load} admin /> : null}
      {attempts.length ? <><h3 className="ie-h3">نتیجه‌های اخیر</h3>
        <ul className="ie-hist">{attempts.slice(0, 8).map(a => <li key={a.id}>
          <button type="button" className="ie-hrow" onClick={() => onOpen({ testId: a.testId, skill, attemptId: a.id })}>
            <span className="ie-band">{band(a.band)}</span>
            <span><b>{fa(a.raw)} از {fa(a.total)}</b> · {a.parts ? `پسیج ${a.parts.map(i => fa(i + 1)).join('، ')}` : a.mode === 'practice' ? 'تمرین' : 'آزمون'} · {jl(a.date)}<small dir="ltr">{title(a.testId)}</small></span>
          </button>
        </li>)}</ul></> : null}
    </>}
  </section>;
}

// Full-page view: a run, or the review of an earlier attempt.
export function ExamView({ open, onBack }) {
  const [past, setPast] = useState(null), [test, setTest] = useState(null), [err, setErr] = useState('');
  useEffect(() => {
    if (!open.attemptId) return;
    Promise.all([api(`/api/ielts/exams/attempts/${open.attemptId}`), api(`/api/ielts/exams/tests/${open.testId}`)]).then(([a, t]) => { setPast(a); setTest(t); }).catch(e => setErr(e.message));
  }, [open.attemptId]);
  if (open.attemptId) return err ? <p className="ie-err">{err}</p> : past && test ? <Review r={past} test={test} onBack={onBack} extra={test.skill === 'reading' ? <MarkedPassages test={test} marks={past.marks || []} only={past.parts} /> : null} /> : <Loader />;
  return open.skill === 'reading' ? <ReadingExam testId={open.testId} mode={open.mode} parts={open.parts} onBack={onBack} /> : <ListeningExam testId={open.testId} mode={open.mode} onBack={onBack} />;
}
