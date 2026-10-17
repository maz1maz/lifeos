import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { api, fa } from './life-core';
import { Loader } from './loader';
import { CdShell, clock, hasPersian } from './ielts-cd';
import { Group, Review, goTo, sectionQs } from './ielts-paper';
import { dropDraft, loadDraft, saveDraft } from './ielts-exams-store';

// IELTS Listening run (opened from ielts-exams.jsx). Audio comes from the user's Telegram chat through the Worker and
// plays from a blob (no range support needed). Exam mode: plays once, no pause or seek, then 10 minutes to check
// answers and an automatic hand-in. Practice mode: normal player. Marking happens on the Worker.
const TRANSFER_SEC = 10 * 60;

function useAudio(testId) {
  const [src, setSrc] = useState(null), [err, setErr] = useState('');
  useEffect(() => {
    let url = null, live = true;
    fetch(`/api/ielts/exams/tests/${testId}/audio`, { credentials: 'same-origin' })
      .then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'صوت آزمون بارگذاری نشد.'); return r.blob(); })
      .then(b => { if (!live) return; url = URL.createObjectURL(b); setSrc(url); })
      .catch(e => live && setErr(e.message));
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [testId]);
  return { src, err };
}

export function ListeningExam({ testId, mode, onDone, onBack }) {
  const dk = `lt-${testId}`;
  const [test, setTest] = useState(null), [err, setErr] = useState('');
  const [draft, setDraft] = useState(() => loadDraft(dk)), answers = draft.answers || {}, flags = draft.flags || {};
  const [phase, setPhase] = useState(mode === 'practice' ? 'practice' : 'ready'), [t, setT] = useState(0), [dur, setDur] = useState(0), [left, setLeft] = useState(TRANSFER_SEC);
  const [result, setResult] = useState(null), [busy, setBusy] = useState(false), [part, setPart] = useState(0), [cur, setCur] = useState(null), [vol, setVol] = useState(1), [faWarn, setFaWarn] = useState(false);
  const audio = useRef(null), started = useRef(Date.now()), { src, err: aErr } = useAudio(testId);
  useEffect(() => { api(`/api/ielts/exams/tests/${testId}`).then(setTest).catch(e => setErr(e.message)); }, [testId]);
  useEffect(() => { if (audio.current) audio.current.volume = vol; }, [vol, src]);
  const upd = f => setDraft(d => { const x = f(d); saveDraft(dk, x); return x; });
  const set = (n, v) => { setFaWarn(hasPersian(v)); setCur(String(n)); upd(d => ({ ...d, answers: { ...(d.answers || {}), [n]: v } })); };
  const submit = async () => {
    if (busy) return; setBusy(true); setErr('');
    try { const r = await api('/api/ielts/exams/attempts', { method: 'POST', body: JSON.stringify({ testId, answers, mode, seconds: (Date.now() - started.current) / 1000 }) }); dropDraft(dk); audio.current?.pause(); setResult(r); onDone?.(); window.scrollTo(0, 0); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
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
  const ci = flat.indexOf(Number(cur)), sec = test.sections[part];
  const status = phase === 'ready' ? `${fa(flat.length)} سؤال`
    : phase === 'playing' ? `صوت ${clock(t)} / ${clock(dur)}`
    : phase === 'transfer' ? `بازبینی ${clock(left)}`
    : `${fa(answered)} از ${fa(flat.length)} · تمرین`;
  return <CdShell skill="Listening" title={test.title} status={status} urgent={phase === 'transfer' && left < 120} partIndex={part} intro={`Listen and answer questions ${sec.range}.`}
    parts={test.sections.map((s, i) => ({ label: `بخش ${fa(s.n)}`, info: `${fa(order[i].filter(filled).length)} از ${fa(order[i].length)}`, qs: order[i].map(n => ({ n, done: filled(n), flag: flags[n] })) }))}
    onPart={i => { setPart(i); document.querySelector('.cd-body')?.scrollTo(0, 0); }} current={cur} onQuestion={focusQ}
    flagged={cur && flags[cur]} onFlag={() => upd(d => ({ ...d, flags: { ...(d.flags || {}), [cur]: !(d.flags || {})[cur] } }))}
    onPrev={ci > 0 ? () => focusQ(flat[ci - 1]) : null}
    onNext={ci < flat.length - 1 ? () => focusQ(flat[ci < 0 ? flat.indexOf(order[part][0]) : ci + 1]) : null}
    onSubmit={askSubmit} onExit={() => { audio.current?.pause(); onBack(); }} volume={vol} onVolume={setVol}
    tools={src && mode === 'practice' ? <audio ref={audio} src={src} controls className="cd-audio" /> : src ? <audio ref={audio} src={src} onTimeUpdate={e => setT(e.currentTarget.currentTime)} onLoadedMetadata={e => setDur(e.currentTarget.duration)} onEnded={() => setPhase('transfer')} /> : null}
    notice={aErr ? aErr : !src ? 'در حال بارگذاری صوت آزمون…' : faWarn ? 'کیبورد فارسی است؛ جواب‌ها باید انگلیسی باشند — زبان کیبورد را عوض کن.' : busy ? 'در حال تصحیح…' : err || null}>
    {phase === 'ready' ? <div className="cd-start">
      <h2>آزمون لیسنینگ</h2>
      <p>صوت فقط <b>یک بار</b> پخش می‌شود و توقف یا عقب‌بردن ندارد. هم‌زمان با شنیدن جواب بده. بعد از پایان صوت <b>۱۰ دقیقه</b> برای بازبینی داری و بعد خودکار تحویل می‌شود. جواب‌ها روی همین مرورگر ذخیره می‌شوند.</p>
      <button type="button" className="ie-btn" disabled={!src} onClick={start}><Play size={16} />{src ? 'شروع آزمون' : 'در حال بارگذاری صوت…'}</button>
    </div> : null}
    <div className="cd-paper" dir="ltr" onFocus={e => { const q = e.target.closest('[id^="q-"]'); if (q) setCur(q.id.slice(2)); }}>
      {sec.groups.map((g, i) => <Group key={`${part}-${i}`} g={g} answers={answers} set={set} flags={flags} />)}
    </div>
  </CdShell>;
}
