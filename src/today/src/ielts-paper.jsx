import { useState } from 'react';
import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, XCircle } from 'lucide-react';
import { fa } from './life-core';
import { hasPersian } from './ielts-cd';

// The question paper shared by Reading and Listening (tests imported as JSON, see cloudflare/lib/ielts.js).
// Group kinds: questions with own options (multiple choice), questions + `choices` (TRUE/FALSE/NOT GIVEN, YES/NO…),
// questions + `options` (matching: a list A–H, one select per question), `lines` with [n] gaps (free text, or a
// select when the group has a word `bank`), `table` cells with [n] gaps, and `pick` (choose N letters, any order).
export const band = b => b == null ? '—' : fa(b, 1);
const GAP = /(\[\d{1,3}\])/;
const gapsIn = text => [...String(text).matchAll(/\[(\d{1,3})\]/g)].map(m => Number(m[1]));

// question numbers of a section, in paper order
export const sectionQs = s => s.groups.flatMap(g => [
  ...(g.questions || []).map(q => q.n), ...(g.lines || []).flatMap(gapsIn),
  ...((g.table && g.table.rows) || []).flatMap(r => r.flatMap(gapsIn)), ...(g.pick || [])]);

export const goTo = n => {
  const el = document.getElementById(`q-${n}`); if (!el) return;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.querySelector('input,select,button[aria-checked="true"],button')?.focus({ preventScroll: true });
};

const cls = (r, v) => `lt-gap ${r ? (r.ok ? 'ok' : 'bad') : ''} ${hasPersian(v) ? 'fa' : ''}`;

// text with inline answer boxes for every [n]
function Gaps({ text, answers, set, review, bank, items }) {
  return String(text).split(GAP).map((x, i) => {
    const m = /^\[(\d{1,3})\]$/.exec(x);
    if (!m) return <span key={i}>{x}</span>;
    const n = m[1], r = review?.[n];
    return <label key={i} id={`q-${n}`} className={cls(r, answers[n])}><b>{n}</b>
      {items ? <select value={answers[n] || ''} onChange={e => set(n, e.target.value)} disabled={!!review} aria-label={`Question ${n}`}>
        <option value="">—</option>{items.map(o => <option key={o.k} value={o.k}>{o.k}</option>)}</select>
        : bank ? <select value={answers[n] || ''} onChange={e => set(n, e.target.value)} disabled={!!review} aria-label={`Question ${n}`}>
        <option value="">—</option>{bank.map(w => <option key={w} value={w}>{w}</option>)}</select>
        : <input value={answers[n] || ''} onChange={e => set(n, e.target.value)} readOnly={!!review} autoComplete="off" spellCheck="false" aria-label={`Question ${n}`} />}
    </label>;
  });
}

function Choice({ n, options, answers, set, review, image }) {
  const r = review?.[n];
  return <div className={`lt-opts ${image ? 'pics' : ''}`} role="radiogroup" aria-label={`Question ${n}`}>
    {options.map(o => {
      const on = (answers[n] || '') === o.k, right = r && r.accepted.includes(o.k);
      return <button type="button" key={o.k} role="radio" aria-checked={on} disabled={!!review}
        className={`${on ? 'on' : ''} ${r && on && !r.ok ? 'bad' : ''} ${right ? 'right' : ''} ${o.t ? '' : 'word'}`} onClick={() => set(n, on ? '' : o.k)}>
        <b>{o.k}</b>{o.t ? <span>{o.t}</span> : null}
      </button>;
    })}
  </div>;
}

const OptionList = ({ title, options }) => <div className="lt-box">{title ? <h5>{title}</h5> : null}
  <ul className="lt-picklist">{options.map(o => <li key={o.k}><b>{o.k}</b> {o.t}</li>)}</ul></div>;

export function Group({ g, answers, set, review, flags }) {
  const flag = n => flags?.[n] ? <span className="lt-flag" aria-label="flagged">⚑</span> : null;
  return <section className="lt-group">
    {g.title ? <h4>{g.title}</h4> : null}
    {g.instr ? <p className="lt-instr">{g.instr}</p> : null}
    {g.image ? <img className="lt-gimg" src={g.image} alt="" loading="lazy" /> : null}
    {g.questions && g.options && !g.choices ? <OptionList title={g.listTitle} options={g.options} /> : null}
    {g.example ? <div className="lt-example"><i>Example</i> {g.example.q} <b>({g.example.answer})</b></div> : null}
    {g.questions ? g.questions.map(q => <div key={q.n} id={`q-${q.n}`} className={`lt-q ${g.options && !g.choices ? 'match' : ''}`}>
      <p><b>{q.n}</b>{flag(q.n)} {q.q}</p>
      {q.image ? <img src={q.image} alt={`Question ${q.n} pictures`} loading="lazy" /> : null}
      {q.options ? <Choice n={q.n} options={q.options} answers={answers} set={set} review={review} image={!!q.image} />
        : g.choices ? <Choice n={q.n} options={g.choices.map(k => ({ k, t: '' }))} answers={answers} set={set} review={review} />
        : g.options ? <label className={cls(review?.[q.n])}><select value={answers[q.n] || ''} onChange={e => set(q.n, e.target.value)} disabled={!!review} aria-label={`Question ${q.n}`}>
          <option value="">—</option>{g.options.map(o => <option key={o.k} value={o.k}>{o.k}</option>)}</select></label>
        : null}
    </div>) : null}
    {g.lines ? <div className="lt-box">{g.box ? <h5>{g.box}</h5> : null}
      {g.bank ? <ul className="lt-bank">{g.bank.map(w => <li key={w}>{w}</li>)}</ul> : null}
      {g.lines.map((l, i) => <p key={i} className="lt-line"><Gaps text={l} answers={answers} set={set} review={review} bank={g.bank} items={g.bankItems} /></p>)}
      {g.bankItems ? <ul className="lt-picklist lt-bankitems">{g.bankItems.map(o => <li key={o.k}><b>{o.k}</b> {o.t}</li>)}</ul> : null}</div> : null}
    {g.table ? <div className="lt-tablewrap"><table className="lt-qtable">
      {g.table.head ? <thead><tr>{g.table.head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead> : null}
      <tbody>{g.table.rows.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j}><Gaps text={c} answers={answers} set={set} review={review} /></td>)}</tr>)}</tbody>
    </table></div> : null}
    {g.pick ? <div className="lt-box">{g.box ? <h5>{g.box}</h5> : null}
      <ul className="lt-picklist">{g.options.map(o => <li key={o.k}><b>{o.k}</b> {o.t}</li>)}</ul>
      <div className="lt-picks">{g.pick.map(n => <label key={n} id={`q-${n}`} className={cls(review?.[n])}><b>{n}</b>
        <select value={answers[n] || ''} onChange={e => set(String(n), e.target.value)} disabled={!!review} aria-label={`Question ${n}`}>
          <option value="">—</option>{g.options.map(o => <option key={o.k} value={o.k}>{o.k}</option>)}
        </select></label>)}</div>
    </div> : null}
  </section>;
}

const mins = s => !s ? '—' : s < 60 ? `${fa(s)} ثانیه` : `${fa(Math.floor(s / 60))} دقیقه${s % 60 ? ` و ${fa(s % 60)} ثانیه` : ''}`;

export function Review({ r, test, onBack, extra }) {
  const [open, setOpen] = useState({}), [allEx, setAllEx] = useState(false);
  const reading = test.skill === 'reading';
  return <div className="lt-review">
    <div className="lt-score">
      <div><span>{r.parts ? 'باند (تخمینی)' : 'نمرهٔ باند'}</span><b>{band(r.band)}</b></div>
      <div><span>جواب درست</span><b>{fa(r.raw)} از {fa(r.total)}</b></div>
      <div><span>حالت</span><b>{r.mode === 'practice' ? 'تمرین' : 'آزمون'}</b></div>
      {r.seconds ? <div><span>زمان</span><b>{mins(r.seconds)}</b></div> : null}
      <button type="button" className="ie-btn ghost" onClick={onBack}><ArrowRight size={16} />بازگشت</button>
    </div>
    {extra}
    {test.sections.map(s => {
      const qs = new Set(sectionQs(s)), rows = r.results.filter(x => qs.has(x.n));
      if (!rows.length) return null;
      const right = rows.filter(x => x.ok).length, tape = (r.tape || []).find(t => t.section === s.n);
      return <section key={s.n} className="ie-card lt-rsec">
        <header><h3 dir="ltr">{s.title}{reading && s.passage ? ` — ${s.passage.title}` : ''}</h3><span className="ie-muted">{fa(right)} از {fa(rows.length)}</span></header>
        <table className="lt-table" dir="ltr"><thead><tr><th>#</th><th>Your answer</th><th>Correct</th><th /></tr></thead>
          <tbody>{rows.map(x => <tr key={x.n} className={x.ok ? 'ok' : 'bad'}>
            <td>{x.n}</td><td>{x.given || <i>—</i>}</td><td>{x.accepted.slice(0, 3).join(' / ')}</td>
            <td>{x.ok ? <CheckCircle2 size={16} aria-label="درست" /> : <XCircle size={16} aria-label="غلط" />}</td>
          </tr>)}</tbody></table>
        {rows.some(x => r.evidence?.[x.n]) ? <div className="lt-evid">
          <header><h4>{allEx ? 'توضیح همهٔ سؤال‌ها' : reading ? 'توضیح جواب‌های غلط' : 'جای جواب‌های غلط در متن صوت'}</h4>
            <button type="button" className="ie-btn ghost" onClick={() => setAllEx(v => !v)}>{allEx ? 'فقط غلط‌ها' : 'همهٔ توضیح‌ها'}</button></header>
          {rows.filter(x => (allEx || !x.ok) && r.evidence?.[x.n]).map(x => <div key={x.n} className={`lt-ex ${x.ok ? 'ok' : ''}`}><b dir="ltr">Q{x.n}</b>{String(r.evidence[x.n]).split('\n').filter(l => l.trim()).map((l, i) => <p key={i} dir="auto">{l}</p>)}</div>)}
        </div> : null}
        {tape ? <>
          <button type="button" className="ie-btn ghost" aria-expanded={!!open[s.n]} onClick={() => setOpen(o => ({ ...o, [s.n]: !o[s.n] }))}>{open[s.n] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}متن کامل صوت این بخش</button>
          {open[s.n] ? <div className="lt-tape" dir="ltr">{tape.lines.map((l, i) => <p key={i}>{l}</p>)}</div> : null}
        </> : null}
      </section>;
    })}
  </div>;
}
