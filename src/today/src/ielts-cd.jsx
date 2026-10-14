import { useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Flag, Menu, Volume2, X } from 'lucide-react';

// Full-window exam shell for IELTS Reading/Listening in the LifeOS look (theme tokens, Persian chrome, RTL): a
// header with the test and time left, a part bar, the paper (English, LTR) and a footer with one section per part
// (question boxes for the active part, ⚑ = flagged for review), a hand-in button and previous/next. RTL rule of the
// site: «قبلی» on the right pointing right, «بعدی» on the left pointing left.
export function useLockScroll() {
  useEffect(() => { const b = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = b; }; }, []);
}

// Persian keyboard left on while typing an English answer: the box gets a hint instead of silently wrong text.
export const hasPersian = s => /[؀-ۿ]/.test(String(s || ''));

export const clock = sec => { sec = Math.max(0, Math.round(sec || 0)); const m = Math.floor(sec / 60), s = sec % 60; return `${m}:${String(s).padStart(2, '0')}`; };
export const minutesLeft = sec => `${clock(sec)} مانده`;

export function CdShell({ skill, title, status, urgent, partIndex, parts, intro, onPart, current, flagged, onFlag, onQuestion, onPrev, onNext, onSubmit, onExit, volume, onVolume, tools, notice, children, wide }) {
  const [menu, setMenu] = useState(false);
  useLockScroll();
  return <div className={`cd ${wide ? 'wide' : ''}`} dir="rtl" role="dialog" aria-modal="true" aria-label={`IELTS ${skill}`}>
    <header className="cd-head">
      <span className="cd-brand">IELTS</span>
      <div className="cd-cand"><b>{skill}</b><small dir="ltr">{title}</small></div>
      <span className={`cd-time ${urgent ? 'urgent' : ''}`} aria-live="polite">{status}</span>
      <div className="cd-right">
        {tools}
        {onVolume ? <label className="cd-vol" title="صدا"><Volume2 size={18} /><input type="range" min="0" max="1" step="0.05" value={volume} onChange={e => onVolume(Number(e.target.value))} aria-label="صدا" /></label> : null}
        <button type="button" className="cd-icon" aria-label="منو" aria-expanded={menu} onClick={() => setMenu(v => !v)}>{menu ? <X size={20} /> : <Menu size={20} />}</button>
        {menu ? <div className="cd-menu">
          <button type="button" onClick={() => { setMenu(false); onSubmit(); }}>تحویل و تصحیح</button>
          <button type="button" onClick={() => { setMenu(false); onExit(); }}>خروج (جواب‌ها روی همین مرورگر می‌مانند)</button>
        </div> : null}
      </div>
    </header>
    <div className="cd-sub"><b>{parts[partIndex]?.label}</b><span dir="ltr">{intro}</span>
      {onFlag && current ? <button type="button" className={`cd-flagbtn ${flagged ? 'on' : ''}`} aria-pressed={!!flagged} onClick={onFlag}><Flag size={14} />{flagged ? 'علامت مرور خورده' : `علامت برای مرور سؤال ${current}`}</button> : null}
    </div>
    {notice ? <div className="cd-notice">{notice}</div> : null}
    <main className="cd-body">{children}</main>
    <footer className="cd-foot">
      <nav className="cd-parts" aria-label="بخش‌ها">
        {parts.map((p, i) => i === partIndex
          ? <section key={i} className="cd-part on"><b>{p.label}</b>
            <div className="cd-qs" dir="ltr">{p.qs.map(q => <button type="button" key={q.n} className={`${q.done ? 'done' : ''} ${q.flag ? 'flag' : ''} ${String(current) === String(q.n) ? 'cur' : ''}`} aria-label={`سؤال ${q.n}${q.done ? '، جواب داده' : ''}${q.flag ? '، علامت مرور' : ''}`} onClick={() => onQuestion(q.n)}>{q.n}</button>)}</div>
          </section>
          : <button type="button" key={i} className="cd-part" onClick={() => onPart(i)}><b>{p.label}</b><small>{p.info}</small></button>)}
      </nav>
      <div className="cd-nav">
        <button type="button" aria-label="سؤال قبلی" onClick={onPrev} disabled={!onPrev}><ChevronRight size={22} /></button>
        <button type="button" aria-label="سؤال بعدی" onClick={onNext} disabled={!onNext}><ChevronLeft size={22} /></button>
      </div>
      <button type="button" className="cd-submit" onClick={onSubmit}><Check size={18} />تحویل</button>
    </footer>
  </div>;
}
