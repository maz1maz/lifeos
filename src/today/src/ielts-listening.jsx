import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Headphones, Trash2, Upload, XCircle } from 'lucide-react';
import { api, fa, jl } from './life-core';
import { Loader } from './loader';
import { CdShell, hasPersian, minutesLeft } from './ielts-cd';

// «آزمون لیسنینگ» on the IELTS tab. Tests are imported as JSON (questions + key + tapescript, never in the repo: the
// book is copyrighted and the repository is public) and their audio goes to the user's Telegram chat; the Worker
// marks the answers (/api/ielts/listening, lib/ielts.js). Exam mode: audio plays once, no pause or seek, then 10
// minutes to check answers. Practice mode: normal player.
const TRANSFER_SEC = 10 * 60;
const draftKey = id => `lifeos-ielts-lt-${id}`;
const loadDraft = id => { try { return JSON.parse(localStorage.getItem(draftKey(id)) || '{}') || {}; } catch { return {}; } };
const saveDraft = (id, a) => { try { localStorage.setItem(draftKey(id), JSON.stringify(a)); } catch {} };
const dropDraft = id => { try { localStorage.removeItem(draftKey(id)); } catch {} };
const band = b => b == null ? '—' : fa(b, 1);

// "Name: Mary [6]" → text with inline answer boxes
function GapLine({ line, answers, set, review }) {
  const parts = String(line).split(/(\[\d{1,3}\])/);
  return <p className="lt-line">{parts.map((x, i) => {
    const m = /^\[(\d{1,3})\]$/.exec(x);
    if (!m) return <span key={i}>{x}</span>;
    const n = m[1], r = review?.[n];
    return <label key={i} id={`q-${n}`} className={`lt-gap ${r ? (r.ok ? 'ok' : 'bad') : ''} ${hasPersian(answers[n]) ? 'fa' : ''}`}><b>{n}</b>
      <input value={answers[n] || ''} onChange={e => set(n, e.target.value)} readOnly={!!review} autoComplete="off" spellCheck="false" aria-label={`Question ${n}`} /></label>;
  })}</p>;
}

function Choice({ n, options, answers, set, review, image }) {
  const r = review?.[n];
  return <div className={`lt-opts ${image ? 'pics' : ''}`} role="radiogroup" aria-label={`Question ${n}`}>
    {options.map(o => {
      const on = (answers[n] || '') === o.k, right = r && r.accepted.includes(o.k);
      return <button type="button" key={o.k} role="radio" aria-checked={on} disabled={!!review}
        className={`${on ? 'on' : ''} ${r && on && !r.ok ? 'bad' : ''} ${right ? 'right' : ''}`} onClick={() => set(n, on ? '' : o.k)}>
        <b>{o.k}</b>{o.t ? <span>{o.t}</span> : null}
      </button>;
    })}
  </div>;
}

function Group({ g, answers, set, review }) {
  return <section className="lt-group">
    <h4>{g.title}</h4>
    <p className="lt-instr">{g.instr}</p>
    {g.example ? <div className="lt-example"><i>Example</i> {g.example.q} <b>({g.example.answer})</b></div> : null}
    {g.questions ? g.questions.map(q => <div key={q.n} id={`q-${q.n}`} className="lt-q">
      <p><b>{q.n}</b> {q.q}</p>
      {q.image ? <img src={q.image} alt={`Question ${q.n} pictures A–D`} loading="lazy" /> : null}
      <Choice n={q.n} options={q.options} answers={answers} set={set} review={review} image={!!q.image} />
    </div>) : null}
    {g.lines ? <div className="lt-box">{g.box ? <h5>{g.box}</h5> : null}{g.lines.map((l, i) => <GapLine key={i} line={l} answers={answers} set={set} review={review} />)}</div> : null}
    {g.pick ? <div className="lt-box">{g.box ? <h5>{g.box}</h5> : null}
      <ul className="lt-picklist">{g.options.map(o => <li key={o.k}><b>{o.k}</b> {o.t}</li>)}</ul>
      <div className="lt-picks">{g.pick.map(n => <label key={n} id={`q-${n}`} className={`lt-gap ${review?.[n] ? (review[n].ok ? 'ok' : 'bad') : ''}`}><b>{n}</b>
        <select value={answers[n] || ''} onChange={e => set(String(n), e.target.value)} disabled={!!review} aria-label={`Question ${n}`}>
          <option value="">—</option>{g.options.map(o => <option key={o.k} value={o.k}>{o.k}</option>)}
        </select></label>)}</div>
    </div> : null}
  </section>;
}

// Audio as a blob: the file streams from Telegram without range support, and a blob plays (and seeks) everywhere.
function useAudio(testId) {
  const [src, setSrc] = useState(null), [err, setErr] = useState('');
  useEffect(() => {
    let url = null, live = true;
    fetch(`/api/ielts/listening/tests/${testId}/audio`, { credentials: 'same-origin' })
      .then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'صوت آزمون بارگذاری نشد.'); return r.blob(); })
      .then(b => { if (!live) return; url = URL.createObjectURL(b); setSrc(url); })
      .catch(e => live && setErr(e.message));
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [testId]);
  return { src, err };
}

function Review({ r, test, onBack }) {
  const [open, setOpen] = useState({});
  return <div className="lt-review">
    <div className="lt-score">
      <div><span>نمرهٔ باند</span><b>{band(r.band)}</b></div>
      <div><span>جواب درست</span><b>{fa(r.raw)} از {fa(r.total)}</b></div>
      <div><span>حالت</span><b>{r.mode === 'practice' ? 'تمرین' : 'آزمون'}</b></div>
      <button type="button" className="ie-btn ghost" onClick={onBack}><ArrowRight size={16} />بازگشت</button>
    </div>
    {test.sections.map(s => {
      const rows = r.results.filter(x => s.groups.some(g => (g.questions || []).some(q => q.n === x.n) || (g.pick || []).includes(x.n) || (g.lines || []).some(l => l.includes(`[${x.n}]`))));
      const right = rows.filter(x => x.ok).length, tape = (r.tape || []).find(t => t.section === s.n);
      return <section key={s.n} className="ie-card lt-rsec">
        <header><h3>{s.title}</h3><span className="ie-muted">{fa(right)} از {fa(rows.length)}</span></header>
        <table className="lt-table" dir="ltr"><thead><tr><th>#</th><th>Your answer</th><th>Correct</th><th /></tr></thead>
          <tbody>{rows.map(x => <tr key={x.n} className={x.ok ? 'ok' : 'bad'}>
            <td>{x.n}</td><td>{x.given || <i>—</i>}</td><td>{x.accepted.slice(0, 3).join(' / ')}</td>
            <td>{x.ok ? <CheckCircle2 size={16} aria-label="درست" /> : <XCircle size={16} aria-label="غلط" />}</td>
          </tr>)}</tbody></table>
        {rows.filter(x => !x.ok && r.evidence?.[x.n]).length ? <div className="lt-evid">
          <h4>جای جواب‌های غلط در متن صوت</h4>
          {rows.filter(x => !x.ok && r.evidence?.[x.n]).map(x => <p key={x.n} dir="ltr"><b>Q{x.n}</b> {r.evidence[x.n]}</p>)}
        </div> : null}
        {tape ? <>
          <button type="button" className="ie-btn ghost" aria-expanded={!!open[s.n]} onClick={() => setOpen(o => ({ ...o, [s.n]: !o[s.n] }))}>{open[s.n] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}متن کامل صوت این بخش</button>
          {open[s.n] ? <div className="lt-tape" dir="ltr">{tape.lines.map((l, i) => <p key={i}>{l}</p>)}</div> : null}
        </> : null}
      </section>;
    })}
  </div>;
}

// question numbers of a section, in paper order
const sectionQs = s => s.groups.flatMap(g => [...(g.questions || []).map(q => q.n), ...(g.lines || []).flatMap(l => [...String(l).matchAll(/\[(\d{1,3})\]/g)].map(m => Number(m[1]))), ...(g.pick || [])]);
const goTo = n => { const el = document.getElementById(`q-${n}`); if (!el) return; el.scrollIntoView({ block: 'center', behavior: 'smooth' }); const f = el.querySelector('input,select,button[aria-checked="true"],button'); f?.focus({ preventScroll: true }); };

function Exam({ testId, mode, onDone, onBack }) {
  const [test, setTest] = useState(null), [err, setErr] = useState('');
  const [answers, setAnswers] = useState(() => loadDraft(testId));
  const [phase, setPhase] = useState(mode === 'practice' ? 'practice' : 'ready'), [t, setT] = useState(0), [dur, setDur] = useState(0), [left, setLeft] = useState(TRANSFER_SEC);
  const [result, setResult] = useState(null), [busy, setBusy] = useState(false), [part, setPart] = useState(0), [cur, setCur] = useState(null), [vol, setVol] = useState(1), [faWarn, setFaWarn] = useState(false);
  const audio = useRef(null), { src, err: aErr } = useAudio(testId);
  useEffect(() => { api(`/api/ielts/listening/tests/${testId}`).then(setTest).catch(e => setErr(e.message)); }, [testId]);
  useEffect(() => { if (audio.current) audio.current.volume = vol; }, [vol, src]);
  const set = (n, v) => { setFaWarn(hasPersian(v)); setCur(String(n)); setAnswers(a => { const x = { ...a, [n]: v }; saveDraft(testId, x); return x; }); };
  const submit = async () => {
    if (busy) return; setBusy(true); setErr('');
    try { const r = await api('/api/ielts/listening/attempts', { method: 'POST', body: JSON.stringify({ testId, answers, mode }) }); dropDraft(testId); audio.current?.pause(); setResult(r); setPhase('done'); onDone?.(); window.scrollTo(0, 0); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  // exam: after the recording, 10 minutes to check answers, then it hands in by itself
  useEffect(() => {
    if (phase !== 'transfer') return;
    const id = setInterval(() => setLeft(s => { if (s <= 1) { clearInterval(id); submit(); return 0; } return s - 1; }), 1000);
    return () => clearInterval(id);
  }, [phase]);
  const start = () => { const a = audio.current; if (!a) return; a.play().then(() => setPhase('playing')).catch(e => setErr('پخش صوت شروع نشد: ' + e.message)); };
  if (err && !test) return <p className="ie-err" role="alert">{err}</p>;
  if (!test) return <Loader />;
  if (result) return <Review r={result} test={test} onBack={onBack} />;
  const order = test.sections.map(sectionQs), flat = order.flat();
  const filled = n => !!String(answers[n] || '').trim();
  const answered = flat.filter(filled).length;
  const askSubmit = () => { const miss = flat.length - answered; if (busy) return; if (miss > 0 && !window.confirm(`${fa(miss)} سؤال بی‌جواب مانده. تحویل بدهی؟`)) return; submit(); };
  const focusQ = n => { const i = order.findIndex(qs => qs.includes(Number(n))); if (i >= 0 && i !== part) setPart(i); setCur(String(n)); setTimeout(() => goTo(n), 30); };
  const ci = flat.indexOf(Number(cur));
  const sec = test.sections[part];
  const status = phase === 'ready' ? `${flat.length} questions · about ${Math.round((dur || 0) / 60) || 30} minutes`
    : phase === 'playing' ? minutesLeft(dur - t + TRANSFER_SEC)
    : phase === 'transfer' ? `${minutesLeft(left)} · check your answers`
    : `${answered} of ${flat.length} answered · practice`;
  const exit = () => { audio.current?.pause(); onBack(); };
  return <CdShell skill="Listening" status={status} partIndex={part} intro={`Listen and answer questions ${sec.range}.`}
    parts={test.sections.map((s, i) => ({ n: s.n, info: `${order[i].filter(filled).length} of ${order[i].length}`, qs: order[i].map(n => ({ n, done: filled(n) })) }))}
    onPart={i => { setPart(i); document.querySelector('.cd-body')?.scrollTo(0, 0); }} current={cur} onQuestion={focusQ}
    onPrev={ci > 0 ? () => focusQ(flat[ci - 1]) : ci < 0 && part > 0 ? () => focusQ(order[part - 1][0]) : null}
    onNext={ci < flat.length - 1 ? () => focusQ(flat[ci < 0 ? flat.indexOf(order[part][0]) : ci + 1]) : null}
    onSubmit={askSubmit} onExit={exit} volume={vol} onVolume={setVol}
    headerExtra={src && mode === 'practice' ? <audio ref={audio} src={src} controls className="cd-audio" /> : src ? <audio ref={audio} src={src} onTimeUpdate={e => setT(e.currentTarget.currentTime)} onLoadedMetadata={e => setDur(e.currentTarget.duration)} onEnded={() => setPhase('transfer')} /> : null}
    notice={aErr ? aErr : !src ? 'در حال بارگذاری صوت آزمون…' : faWarn ? 'کیبورد فارسی است؛ جواب‌ها باید انگلیسی باشند — زبان کیبورد را عوض کن.' : busy ? 'در حال تصحیح…' : err || null}>
    {phase === 'ready' ? <div className="cd-start">
      <h2>IELTS Listening</h2>
      <p>You will hear the recording <b>once only</b>. You cannot pause or replay it. Answer the questions as you listen. After the recording ends you have <b>10 minutes</b> to check your answers; then the test is handed in automatically.</p>
      <p dir="rtl">صوت فقط یک بار پخش می‌شود و توقف ندارد. بعد از پایان صوت ۱۰ دقیقه برای بازبینی داری و بعد خودکار تحویل می‌شود. جواب‌ها روی همین مرورگر ذخیره می‌شوند.</p>
      <button type="button" className="cd-play" disabled={!src} onClick={start}>{src ? 'Play — start the test' : 'Loading audio…'}</button>
    </div> : null}
    <div className="cd-paper" onFocus={e => { const q = e.target.closest('[id^="q-"]'); if (q) setCur(q.id.slice(2)); }}>
      {sec.groups.map((g, i) => <Group key={`${part}-${i}`} g={g} answers={answers} set={set} />)}
    </div>
  </CdShell>;
}

function AddTest({ onAdded }) {
  const [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  const pick = async e => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    setBusy(true); setMsg('');
    try { const r = await fetch('/api/ielts/listening/tests', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: await f.text() }); const j = await r.json(); if (!r.ok) throw new Error(j.error); setMsg(`«${j.title}» اضافه شد؛ حالا صوتش را آپلود کن.`); onAdded(); }
    catch (er) { setMsg(er.message); } finally { setBusy(false); }
  };
  return <label className="ie-btn ghost lt-file"><Upload size={15} />{busy ? 'در حال افزودن…' : 'افزودن آزمون (JSON)'}<input type="file" accept="application/json,.json" onChange={pick} hidden />{msg ? <small>{msg}</small> : null}</label>;
}

function AudioUpload({ test, onDone }) {
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState('');
  const pick = async e => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    setBusy(true); setMsg('');
    try { const r = await fetch(`/api/ielts/listening/tests/${test.id}/audio`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': f.type || 'audio/mpeg' }, body: f }); const j = await r.json(); if (!r.ok) throw new Error(j.error); onDone(); }
    catch (er) { setMsg(er.message); } finally { setBusy(false); }
  };
  return <label className="ie-btn ghost lt-file"><Upload size={15} />{busy ? 'در حال آپلود…' : test.audio ? 'تعویض صوت' : 'آپلود صوت'}<input type="file" accept="audio/*" onChange={pick} hidden />{msg ? <small className="ie-err">{msg}</small> : null}</label>;
}

export function ListeningCard({ onOpen }) {
  const [d, setD] = useState(null), [err, setErr] = useState('');
  const load = () => api('/api/ielts/listening').then(setD).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);
  const del = async t => { if (!window.confirm(`«${t.title}» و نتیجه‌هایش حذف شود؟`)) return; await api(`/api/ielts/listening/tests/${t.id}`, { method: 'DELETE' }).catch(e => setErr(e.message)); load(); };
  const title = id => d?.tests.find(t => t.id === id)?.title || id;
  return <section className="ie-card ie-wide">
    <header><h2><Headphones size={18} />آزمون لیسنینگ</h2><span className="ie-muted">۴ بخش، ۴۰ سؤال؛ تصحیح خودکار و نمرهٔ باند</span></header>
    {err ? <p className="ie-err">{err}</p> : null}
    {!d ? <Loader /> : <>
      {d.tests.length ? <ul className="lt-tests">{d.tests.map(t => <li key={t.id}>
        <div><b dir="ltr">{t.title}</b><small>{fa(t.total)} سؤال · {t.attempts ? `${fa(t.attempts)} بار · بهترین باند ${band(t.best)}` : 'هنوز آزمون نداده‌ای'}{t.audio ? '' : ' · صوت آپلود نشده'}</small></div>
        <div className="lt-ops">
          {t.audio ? <><button type="button" className="ie-btn" onClick={() => onOpen({ testId: t.id, mode: 'exam' })}>شروع آزمون</button>
            <button type="button" className="ie-btn ghost" onClick={() => onOpen({ testId: t.id, mode: 'practice' })}>تمرین</button></> : null}
          <AudioUpload test={t} onDone={load} />
          <button type="button" className="ie-x" aria-label="حذف آزمون" onClick={() => del(t)}><Trash2 size={15} /></button>
        </div>
      </li>)}</ul> : <p className="ie-muted">هنوز آزمونی اضافه نشده. فایل JSON آزمون را اضافه کن و بعد صوتش را آپلود کن؛ صوت در چت تلگرام خودت نگه داشته می‌شود.</p>}
      <AddTest onAdded={load} />
      {d.attempts.length ? <><h3 className="ie-h3">نتیجه‌های اخیر</h3>
        <ul className="ie-hist">{d.attempts.slice(0, 8).map(a => <li key={a.id}>
          <button type="button" className="ie-hrow" onClick={() => onOpen({ testId: a.testId, attemptId: a.id })}>
            <span className="ie-band">{band(a.band)}</span>
            <span><b>{fa(a.raw)} از {fa(a.total)}</b> · {a.mode === 'practice' ? 'تمرین' : 'آزمون'} · {jl(a.date)}<small dir="ltr">{title(a.testId)}</small></span>
          </button>
        </li>)}</ul></> : null}
    </>}
  </section>;
}

// Full-page view: an exam/practice run, or the review of an earlier attempt.
export function ListeningView({ open, onBack }) {
  const [past, setPast] = useState(null), [test, setTest] = useState(null), [err, setErr] = useState('');
  useEffect(() => {
    if (!open.attemptId) return;
    Promise.all([api(`/api/ielts/listening/attempts/${open.attemptId}`), api(`/api/ielts/listening/tests/${open.testId}`)]).then(([a, t]) => { setPast(a); setTest(t); }).catch(e => setErr(e.message));
  }, [open.attemptId]);
  if (open.attemptId) return err ? <p className="ie-err">{err}</p> : past && test ? <Review r={past} test={test} onBack={onBack} /> : <Loader />;
  return <Exam testId={open.testId} mode={open.mode} onBack={onBack} />;
}
