import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

// Guard for destructive actions: the user must solve a small sum/difference before it goes ahead.
// askMath({ title, detail, confirmLabel }) → Promise<boolean>
const faN = n => Number(n).toLocaleString('fa-IR', { useGrouping: false });
const toLatin = s => String(s || '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).trim();
const rnd = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
function makeQuestion() {
  if (Math.random() < 0.5) { const a = rnd(11, 49), b = rnd(3, 29); return { text: `${faN(a)} + ${faN(b)}`, answer: a + b }; }
  const a = rnd(21, 69), b = rnd(3, 19); return { text: `${faN(a)} − ${faN(b)}`, answer: a - b };
}

function MathConfirm({ title, detail, confirmLabel = 'حذف', onDone }) {
  const [q] = useState(makeQuestion);
  const [value, setValue] = useState(''), [wrong, setWrong] = useState(false);
  const input = useRef(null);
  useEffect(() => { input.current?.focus(); const esc = e => { if (e.key === 'Escape') onDone(false); }; window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc); }, []);
  const submit = e => { e.preventDefault(); if (Number(toLatin(value)) === q.answer) onDone(true); else { setWrong(true); setValue(''); input.current?.focus(); } };
  return <div className="mq-back" dir="rtl" onMouseDown={e => { if (e.target === e.currentTarget) onDone(false); }}>
    <form className="mq-box" role="alertdialog" aria-modal="true" aria-label={title} onSubmit={submit}>
      <b className="mq-title">{title}</b>
      {detail ? <p className="mq-detail">{detail}</p> : null}
      <label className="mq-q"><span>برای تأیید، حاصل را بنویس:</span><strong dir="ltr">{q.text} = ?</strong>
        <input ref={input} value={value} onChange={e => { setValue(e.target.value); setWrong(false); }} inputMode="numeric" data-raw dir="ltr" aria-invalid={wrong} placeholder="جواب" /></label>
      {wrong ? <small className="mq-wrong">جواب درست نیست؛ دوباره امتحان کن.</small> : null}
      <div className="mq-actions"><button type="submit" className="mq-ok">{confirmLabel}</button><button type="button" className="mq-cancel" onClick={() => onDone(false)}>انصراف</button></div>
    </form>
  </div>;
}

export function askMath(opts = {}) {
  return new Promise(resolve => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = ok => { root.unmount(); host.remove(); resolve(ok); };
    root.render(<MathConfirm {...opts} onDone={done} />);
  });
}
