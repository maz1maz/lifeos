import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, BookmarkPlus, ChevronDown, ChevronUp, Highlighter, ListChecks, Minus, NotebookPen, Plus, StickyNote, Trash2, X } from 'lucide-react';
import { api, fa } from './life-core';
import { Loader } from './loader';
import { CdShell, clock, hasPersian } from './ielts-cd';
import { Group, Review, goTo, sectionQs } from './ielts-paper';
import { dropDraft, loadDraft, saveDraft } from './ielts-exams-store';

// IELTS Reading run (opened from ielts-exams.jsx): passage | questions side by side (a draggable divider; one pane at a
// time on phones), highlighting and notes on the passage (select text → «هایلایت» / «یادداشت»; click a highlight to
// edit or remove it; all notes in the «یادداشت‌ها» drawer), question flags, text size, and a timer: exam = 60 minutes
// (20 per passage when practising one passage) with an automatic hand-in, practice = a stopwatch. Everything unsent is
// kept in this browser; highlights and notes go with the attempt so the review shows them. Marking: the Worker.
const FS_KEY = 'lifeos-ielts-fs', SPLIT_KEY = 'lifeos-ielts-split';
const pref = (k, d) => { try { const v = Number(localStorage.getItem(k)); return Number.isFinite(v) && v > 0 ? v : d; } catch { return d; } };
const keep = (k, v) => { try { localStorage.setItem(k, String(v)); } catch {} };
const uid = () => Math.random().toString(36).slice(2, 9);

// character offset of (node, offset) inside a paragraph's text span
const offsetIn = (el, node, offset) => { const r = document.createRange(); r.setStart(el, 0); r.setEnd(node, offset); return r.toString().length; };

// add [a,b) to a paragraph's marks, merging anything it overlaps (notes are joined)
function addMark(marks, m) {
  const same = marks.filter(x => x.s === m.s && x.p === m.p && x.a < m.b && m.a < x.b);
  if (!same.length) return [...marks, m];
  const a = Math.min(m.a, ...same.map(x => x.a)), b = Math.max(m.b, ...same.map(x => x.b));
  const note = [...same.map(x => x.note), m.note].filter(Boolean).join('\n');
  return [...marks.filter(x => !same.includes(x)), { ...m, id: same[0].id, a, b, note }];
}

function ParaText({ text, marks, onMark }) {
  const ms = marks.slice().sort((x, y) => x.a - y.a), out = [];
  let at = 0;
  for (const m of ms) {
    if (m.a > at) out.push(text.slice(at, m.a));
    out.push(<mark key={m.id} data-id={m.id} className={m.note ? 'noted' : ''} onClick={onMark ? e => onMark(m, e) : undefined}>{text.slice(Math.max(m.a, at), m.b)}</mark>);
    at = Math.max(at, m.b);
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

export function Passage({ sec, si, marks, onMark, fs }) {
  const p = sec.passage;
  return <article className="rd-passage" style={fs ? { fontSize: fs } : undefined}>
    <p className="rd-kicker">READING PASSAGE {sec.n}</p>
    <h2>{p.title}</h2>
    {p.subtitle ? <p className="rd-sub">{p.subtitle}</p> : null}
    {p.intro ? <p className="rd-intro">{p.intro}</p> : null}
    {p.image ? <img src={p.image} alt="" /> : null}
    {p.paragraphs.map((q, i) => <div key={i} className={`rd-p ${q.label ? 'lab' : ''}`}>
      {q.label ? <b className="rd-plabel">{q.label}</b> : null}
      <span className="rd-txt" data-s={si} data-p={i}><ParaText text={q.text} marks={marks.filter(m => m.s === si && m.p === i)} onMark={onMark} /></span>
    </div>)}
    {p.author ? <p className="rd-author">{p.author}</p> : null}
  </article>;
}

export function ReadingExam({ testId, mode, parts: only, onDone, onBack }) {
  const dk = `rd-${testId}${only ? '-p' + only.join('') : ''}`;
  const [test, setTest] = useState(null), [err, setErr] = useState('');
  const [draft, setDraft] = useState(() => loadDraft(dk));
  const answers = draft.answers || {}, flags = draft.flags || {}, marks = draft.marks || [];
  const [result, setResult] = useState(null), [busy, setBusy] = useState(false), [cur, setCur] = useState(null), [faWarn, setFaWarn] = useState(false);
  const [elapsed, setElapsed] = useState(draft.elapsed || 0), [fs, setFs] = useState(() => pref(FS_KEY, 17)), [split, setSplit] = useState(() => pref(SPLIT_KEY, 50));
  const [tip, setTip] = useState(null), [pop, setPop] = useState(null), [drawer, setDrawer] = useState(false), [pane, setPane] = useState('text');
  const shown = useMemo(() => test ? (only && only.length ? only : test.sections.map((_, i) => i)) : [], [test, only]);
  const [pi, setPi] = useState(0), si = shown[pi] ?? 0;
  const body = useRef(null), elapsedRef = useRef(elapsed);
  useEffect(() => { api(`/api/ielts/exams/tests/${testId}`).then(setTest).catch(e => setErr(e.message)); }, [testId]);
  const upd = f => setDraft(d => { const x = f(d); saveDraft(dk, x); return x; });
  const limit = mode === 'exam' && test ? (only && only.length ? 20 * only.length : (test.minutes || 60)) * 60 : null;
  // the clock: one tick a second, saved every 5 s; an exam hands itself in at zero
  useEffect(() => {
    if (!test || result) return;
    const id = setInterval(() => {
      elapsedRef.current += 1; setElapsed(elapsedRef.current);
      if (elapsedRef.current % 5 === 0) upd(d => ({ ...d, elapsed: elapsedRef.current }));
      if (limit && elapsedRef.current >= limit) { clearInterval(id); submit(true); }
    }, 1000);
    return () => clearInterval(id);
  }, [test, result, limit]);
  const set = (n, v) => { setFaWarn(hasPersian(v)); setCur(String(n)); upd(d => ({ ...d, answers: { ...(d.answers || {}), [n]: v } })); };
  const submit = async auto => {
    if (busy) return; setBusy(true); setErr('');
    try {
      const d = loadDraft(dk);
      const r = await api('/api/ielts/exams/attempts', { method: 'POST', body: JSON.stringify({ testId, answers: d.answers || answers, mode, parts: only || null, seconds: elapsedRef.current, marks: d.marks || marks }) });
      dropDraft(dk); setResult({ ...r, auto }); onDone?.(); window.scrollTo(0, 0);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  // selection inside the passage → a small toolbar over it
  const onSelect = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) { setTip(null); return; }
    const range = sel.getRangeAt(0), host = body.current?.querySelector('.rd-passage');
    if (!host || !host.contains(range.commonAncestorContainer)) { setTip(null); return; }
    const pieces = [...host.querySelectorAll('.rd-txt')].filter(el => range.intersectsNode(el)).map(el => {
      const a = el.contains(range.startContainer) ? offsetIn(el, range.startContainer, range.startOffset) : 0;
      const b = el.contains(range.endContainer) ? offsetIn(el, range.endContainer, range.endOffset) : el.textContent.length;
      return { s: Number(el.dataset.s), p: Number(el.dataset.p), a, b };
    }).filter(x => x.b > x.a);
    if (!pieces.length) { setTip(null); return; }
    const rc = range.getBoundingClientRect(), txt = sel.toString().trim();
    setTip({ pieces, x: rc.left + rc.width / 2, y: rc.top, word: /^[A-Za-z][A-Za-z'-]*( [A-Za-z][A-Za-z'-]*)?$/.test(txt) ? txt.replace(/'s$/, '') : null });
  };
  const highlight = note => {
    if (!tip) return;
    upd(d => ({ ...d, marks: tip.pieces.reduce((ms, x, i) => addMark(ms, { id: uid(), ...x, note: i === 0 ? note || '' : '' }), d.marks || []) }));
    window.getSelection()?.removeAllRanges(); setTip(null);
  };
  const editMark = (m, e) => { e.stopPropagation(); const rc = e.currentTarget.getBoundingClientRect(); setTip(null); setPop({ id: m.id, note: m.note || '', x: rc.left + rc.width / 2, y: rc.bottom, fresh: false }); };
  const saveNote = () => { upd(d => ({ ...d, marks: (d.marks || []).map(m => m.id === pop.id ? { ...m, note: pop.note.trim() } : m) })); setPop(null); };
  const removeMark = id => { upd(d => ({ ...d, marks: (d.marks || []).filter(m => m.id !== id) })); setPop(null); };
  const noteFromTip = () => {
    if (!tip) return;
    const first = tip.pieces[0], next = tip.pieces.reduce((ms, x) => addMark(ms, { id: uid(), ...x, note: '' }), marks);
    const m = next.find(x => x.s === first.s && x.p === first.p && x.a <= first.a && x.b >= first.b);
    upd(d => ({ ...d, marks: next }));
    window.getSelection()?.removeAllRanges(); setPop({ id: m.id, note: m.note || '', x: tip.x, y: tip.y + 30, fresh: true }); setTip(null);
  };
  // a selected word → starred in the language app's flashcards (/api/vocab/star)
  const [wordMsg, setWordMsg] = useState('');
  const addWord = async () => {
    const w = tip?.word; if (!w) return;
    window.getSelection()?.removeAllRanges(); setTip(null);
    try { const r = await api('/api/vocab/star', { method: 'POST', body: JSON.stringify({ w }) }); setWordMsg(`«${r.w}»${r.fa ? ` (${r.fa})` : ''} ${r.added ? 'به واژه‌های ستاره‌دار اپ زبان اضافه شد.' : 'از قبل ستاره‌دار بود.'}`); }
    catch (e) { setWordMsg(e.message); }
    setTimeout(() => setWordMsg(''), 4000);
  };
  const startDrag = e => {
    const box = e.currentTarget.parentElement.getBoundingClientRect();
    const move = ev => { const v = Math.min(75, Math.max(25, (ev.clientX - box.left) / box.width * 100)); setSplit(v); keep(SPLIT_KEY, Math.round(v)); };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const size = d => setFs(v => { const x = Math.min(24, Math.max(13, v + d)); keep(FS_KEY, x); return x; });
  if (err && !test) return <p className="ie-err" role="alert">{err}</p>;
  if (!test) return <Loader />;
  if (result) return <Review r={result} test={test} onBack={onBack} extra={<>
    {result.auto ? <p className="ie-muted">وقت تمام شد و آزمون خودکار تحویل شد.</p> : null}
    <MarkedPassages test={test} marks={result.marks || []} only={result.parts} />
  </>} />;
  const order = test.sections.map(sectionQs), flat = shown.flatMap(i => order[i]);
  const filled = n => !!String(answers[n] || '').trim();
  const answered = flat.filter(filled).length;
  const askSubmit = () => { const miss = flat.length - answered; if (busy) return; if (miss > 0 && !window.confirm(`${fa(miss)} سؤال بی‌جواب مانده. تحویل بدهی؟`)) return; submit(false); };
  const focusQ = n => { const k = shown.findIndex(i => order[i].includes(Number(n))); if (k >= 0 && k !== pi) setPi(k); setCur(String(n)); setPane('qs'); setTimeout(() => goTo(n), 40); };
  const ci = flat.indexOf(Number(cur)), sec = test.sections[si];
  const left = limit ? limit - elapsed : null;
  const notes = marks.filter(m => shown.includes(m.s)).sort((x, y) => x.s - y.s || x.p - y.p || x.a - y.a);
  const goMark = m => { const k = shown.indexOf(m.s); if (k >= 0) setPi(k); setPane('text'); setDrawer(false); setTimeout(() => document.querySelector(`mark[data-id="${m.id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60); };
  return <CdShell wide skill="Reading" title={test.title} status={limit ? `${clock(left)} مانده` : `${clock(elapsed)} · تمرین`} urgent={limit && left < 300}
    partIndex={pi} intro={`Read the text and answer questions ${sec.range}.`}
    parts={shown.map(i => ({ label: `پسیج ${fa(test.sections[i].n)}`, info: `${fa(order[i].filter(filled).length)} از ${fa(order[i].length)}`, qs: order[i].map(n => ({ n, done: filled(n), flag: flags[n] })) }))}
    onPart={k => { setPi(k); setTip(null); setPop(null); }} current={cur} onQuestion={focusQ}
    flagged={cur && flags[cur]} onFlag={() => upd(d => ({ ...d, flags: { ...(d.flags || {}), [cur]: !(d.flags || {})[cur] } }))}
    onPrev={ci > 0 ? () => focusQ(flat[ci - 1]) : null}
    onNext={ci < flat.length - 1 ? () => focusQ(flat[ci < 0 ? flat.indexOf(order[si][0]) : ci + 1]) : null}
    onSubmit={askSubmit} onExit={() => { upd(d => ({ ...d, elapsed: elapsedRef.current })); onBack(); }}
    tools={<>
      <span className="cd-size" role="group" aria-label="اندازهٔ متن"><button type="button" onClick={() => size(-1)} aria-label="کوچک‌تر"><Minus size={15} /></button><b>Aa</b><button type="button" onClick={() => size(1)} aria-label="بزرگ‌تر"><Plus size={15} /></button></span>
      <button type="button" className={`cd-tool ${drawer ? 'on' : ''}`} onClick={() => setDrawer(v => !v)} aria-expanded={drawer}><StickyNote size={16} />یادداشت‌ها{notes.length ? ` (${fa(notes.length)})` : ''}</button>
    </>}
    notice={faWarn ? 'کیبورد فارسی است؛ جواب‌ها باید انگلیسی باشند — زبان کیبورد را عوض کن.' : busy ? 'در حال تصحیح…' : err || wordMsg || null}>
    <div className="rd-panes-switch" role="tablist" aria-label="نما">
      <button type="button" role="tab" aria-selected={pane === 'text'} className={pane === 'text' ? 'on' : ''} onClick={() => setPane('text')}><BookOpen size={15} />متن</button>
      <button type="button" role="tab" aria-selected={pane === 'qs'} className={pane === 'qs' ? 'on' : ''} onClick={() => setPane('qs')}><ListChecks size={15} />سؤال‌ها</button>
    </div>
    <div className={`rd-split show-${pane}`} dir="ltr" ref={body} style={{ '--split': `${split}%` }}>
      <section className="rd-left" onMouseUp={onSelect} onTouchEnd={() => setTimeout(onSelect, 50)} onScroll={() => setTip(null)}>
        <Passage sec={sec} si={si} marks={marks} onMark={editMark} fs={fs} />
      </section>
      <div className="rd-divider" onPointerDown={startDrag} role="separator" aria-orientation="vertical" aria-label="تغییر پهنای متن و سؤال‌ها" />
      <section className="rd-right" style={{ fontSize: fs - 1 }} onFocus={e => { const q = e.target.closest('[id^="q-"]'); if (q) setCur(q.id.slice(2)); }}>
        {sec.groups.map((g, i) => <Group key={`${si}-${i}`} g={g} answers={answers} set={set} flags={flags} />)}
      </section>
    </div>
    {tip ? <div className="rd-tip" style={{ left: tip.x, top: tip.y }} dir="rtl" onMouseDown={e => e.preventDefault()}>
      <button type="button" onClick={() => highlight('')}><Highlighter size={15} />هایلایت</button>
      <button type="button" onClick={noteFromTip}><NotebookPen size={15} />یادداشت</button>
      {tip.word ? <button type="button" onClick={addWord} title="ستاره‌دار در اپ زبان (فلش‌کارت)"><BookmarkPlus size={15} />واژه</button> : null}
    </div> : null}
    {pop ? <div className="rd-pop" style={{ left: pop.x, top: pop.y }} dir="rtl">
      <textarea autoFocus dir="auto" rows={3} value={pop.note} placeholder="یادداشت تو برای این قسمت…" onChange={e => setPop(p => ({ ...p, note: e.target.value }))} />
      <div><button type="button" className="ie-btn" onClick={saveNote}>ذخیره</button>
        {pop.fresh ? <button type="button" className="ie-btn ghost" onClick={() => setPop(null)}>فقط هایلایت</button>
          : <button type="button" className="ie-btn ghost" onClick={() => removeMark(pop.id)}><Trash2 size={14} />حذف هایلایت</button>}
        <button type="button" className="ie-x" aria-label="بستن" onClick={() => setPop(null)}><X size={14} /></button></div>
    </div> : null}
    {drawer ? <aside className="rd-drawer">
      <header><b>یادداشت‌ها و هایلایت‌ها</b><button type="button" className="ie-x" aria-label="بستن" onClick={() => setDrawer(false)}><X size={14} /></button></header>
      {notes.length ? <ul>{notes.map(m => { const t = test.sections[m.s].passage.paragraphs[m.p].text.slice(m.a, m.b); return <li key={m.id}>
        <button type="button" onClick={() => goMark(m)}><small>پسیج {fa(test.sections[m.s].n)}</small><q dir="ltr">{t.length > 120 ? t.slice(0, 120) + '…' : t}</q>{m.note ? <span>{m.note}</span> : null}</button>
        <button type="button" className="ie-x" aria-label="حذف" onClick={() => removeMark(m.id)}><Trash2 size={13} /></button>
      </li>; })}</ul> : <p className="ie-muted">بخشی از متن را انتخاب کن و «هایلایت» یا «یادداشت» را بزن.</p>}
    </aside> : null}
  </CdShell>;
}

// review: the passages with the highlights and notes made during the attempt
export function MarkedPassages({ test, marks, only }) {
  const [open, setOpen] = useState(null);
  const idx = only && only.length ? only : test.sections.map((_, i) => i);
  return <section className="ie-card lt-rsec">
    <header><h3>متن پسیج‌ها با هایلایت‌های تو</h3><span className="ie-muted">{fa(marks.length)} هایلایت</span></header>
    <div className="ie-seg">{idx.map(i => <button key={i} type="button" className={open === i ? 'on' : ''} aria-expanded={open === i} onClick={() => setOpen(o => o === i ? null : i)}>
      {open === i ? <ChevronUp size={14} /> : <ChevronDown size={14} />} پسیج {fa(test.sections[i].n)}</button>)}</div>
    {open != null ? <div className="rd-review-text" dir="ltr"><Passage sec={test.sections[open]} si={open} marks={marks} />
      {marks.filter(m => m.s === open && m.note).map(m => <p key={m.id} className="rd-rnote" dir="auto"><q>{test.sections[open].passage.paragraphs[m.p]?.text.slice(m.a, m.b)}</q> — {m.note}</p>)}</div> : null}
  </section>;
}
