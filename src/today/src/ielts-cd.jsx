import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Menu, Volume2, X } from 'lucide-react';

// The computer-delivered IELTS look (same layout as the reading app in /ielts/): red IELTS header with time left,
// a "Part n" instruction bar, the paper, and a footer with one section per part (question boxes for the active
// part), a submit tick and floating previous/next arrows. Covers the whole window while the test runs; the content
// is English, so the shell is LTR and the arrows follow the real test (← previous, → next).
export function useLockScroll() {
  useEffect(() => { const b = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = b; }; }, []);
}

// Persian keyboard left on while typing an English answer: the box gets a hint instead of silently wrong text.
export const hasPersian = s => /[؀-ۿ]/.test(String(s || ''));

export function CdShell({ skill, status, partIndex, parts, intro, onPart, current, onQuestion, onPrev, onNext, onSubmit, onExit, volume, onVolume, headerExtra, notice, children }) {
  const [menu, setMenu] = useState(false);
  useLockScroll();
  return <div className="cd" dir="ltr" role="dialog" aria-modal="true" aria-label={`IELTS ${skill}`}>
    <header className="cd-head">
      <span className="cd-brand">IELTS</span>
      <div className="cd-cand"><b>{skill}</b><small>{status}</small></div>
      <div className="cd-right">
        {headerExtra}
        {onVolume ? <label className="cd-vol" title="Volume"><Volume2 size={20} /><input type="range" min="0" max="1" step="0.05" value={volume} onChange={e => onVolume(Number(e.target.value))} aria-label="Volume" /></label> : null}
        <button type="button" className="cd-icon" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(v => !v)}>{menu ? <X size={22} /> : <Menu size={22} />}</button>
        {menu ? <div className="cd-menu" dir="rtl">
          <button type="button" onClick={() => { setMenu(false); onSubmit(); }}>تحویل و تصحیح</button>
          <button type="button" onClick={() => { setMenu(false); onExit(); }}>خروج (جواب‌ها روی همین مرورگر می‌مانند)</button>
        </div> : null}
      </div>
    </header>
    <div className="cd-sub"><b>Part {parts[partIndex]?.n}</b><span>{intro}</span></div>
    {notice ? <div className="cd-notice" dir="rtl">{notice}</div> : null}
    <main className="cd-body">{children}</main>
    <footer className="cd-foot">
      <nav className="cd-parts" aria-label="Parts">
        {parts.map((p, i) => i === partIndex
          ? <section key={p.n} className="cd-part on"><b>Part {p.n}</b>
            {p.qs ? <div className="cd-qs">{p.qs.map(q => <button type="button" key={q.n} className={`${q.done ? 'done' : ''} ${String(current) === String(q.n) ? 'cur' : ''}`} aria-label={`Question ${q.n}${q.done ? ' answered' : ''}`} onClick={() => onQuestion(q.n)}>{q.n}</button>)}</div>
              : <small>{p.info}</small>}
          </section>
          : <button type="button" key={p.n} className="cd-part" onClick={() => onPart(i)}><b>Part {p.n}</b><small>{p.info}</small></button>)}
      </nav>
      <button type="button" className="cd-submit" aria-label="Submit" onClick={onSubmit}><Check size={26} /></button>
    </footer>
    <div className="cd-float">
      <button type="button" aria-label="Previous" onClick={onPrev} disabled={!onPrev}><ArrowLeft size={24} /></button>
      <button type="button" aria-label="Next" onClick={onNext} disabled={!onNext}><ArrowRight size={24} /></button>
    </div>
  </div>;
}

export const minutesLeft = sec => { const m = Math.ceil(Math.max(0, sec) / 60); return m <= 1 && sec > 0 ? `${Math.max(0, Math.ceil(sec))} seconds remaining` : `${m} minutes remaining`; };
