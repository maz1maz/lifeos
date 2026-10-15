import { useEffect, useRef, useState } from 'react';
import { Mic, RefreshCw, Square } from 'lucide-react';
import { fa } from './life-core';
import { SpeakingBook } from './ielts-book';

// «اسپیکینگ» on the IELTS tab: the test format and criteria, Part 2 cue cards with the real timing (1 minute to
// prepare, up to 2 to speak) and an optional recording that stays in this browser (MediaRecorder, nothing is sent),
// plus Part 1 / Part 3 practice questions. Cue cards and questions are written for LifeOS (not from a book).
const CUES = [
  ['Describe a place in your city that you like to visit.', ['where it is', 'how often you go there', 'what you do there', 'and explain why you like it']],
  ['Describe a skill you learned that is useful to you.', ['what the skill is', 'when and how you learned it', 'how often you use it', 'and explain why it is useful']],
  ['Describe a person who has had a strong influence on you.', ['who this person is', 'how you know them', 'what they have done', 'and explain how they influenced you']],
  ['Describe a book or film that made you think.', ['what it was', 'when you read or watched it', 'what it was about', 'and explain why it made you think']],
  ['Describe a time you helped someone.', ['who you helped', 'what the problem was', 'what you did', 'and explain how you felt afterwards']],
  ['Describe a journey you remember well.', ['where you went', 'who you went with', 'what happened on the way', 'and explain why you remember it']],
  ['Describe a piece of technology you use every day.', ['what it is', 'how long you have had it', 'what you use it for', 'and explain how your life would be without it']],
  ['Describe a goal you want to achieve in the next five years.', ['what the goal is', 'why you chose it', 'what you are doing to reach it', 'and explain how you will feel when you achieve it']],
  ['Describe a traditional meal from your country.', ['what it is', 'how it is made', 'when people usually eat it', 'and explain why it is special']],
  ['Describe a time you had to make a difficult decision.', ['what the decision was', 'when it happened', 'what choices you had', 'and explain why it was difficult']],
  ['Describe a hobby you would like to start.', ['what it is', 'how you heard about it', 'what you would need to begin', 'and explain why it interests you']],
  ['Describe a celebration you enjoyed.', ['what was celebrated', 'where it took place', 'who was there', 'and explain why you enjoyed it']],
];
const PART1 = [
  ['Work or studies', ['Do you work or are you a student?', 'What do you like most about it?', 'Would you like to change anything about it?']],
  ['Home', ['Do you live in a house or an apartment?', 'Which room do you spend the most time in?', 'Would you like to move in the future?']],
  ['Free time', ['What do you usually do in your free time?', 'Do you prefer spending free time alone or with others?', 'Has the way you spend free time changed?']],
  ['Food', ['What is your favourite food?', 'Do you often cook at home?', 'Is there any food you did not like as a child?']],
  ['Weather', ['What is the weather like where you live?', 'Which season do you like most, and why?', 'Does the weather change your mood?']],
];
const PART3 = [
  ['Technology', ['How has technology changed the way people communicate?', 'Do you think young people rely too much on their phones?', 'What problems might new technology cause in the future?']],
  ['Education', ['Should schools teach practical skills such as cooking or managing money?', 'Is online learning as effective as learning in a classroom?', 'Who should pay for university education?']],
  ['Cities', ['What are the advantages of living in a big city?', 'How could cities be made more pleasant to live in?', 'Why do some people move from cities to the countryside?']],
];
const CRITERIA = [['Fluency & Coherence', 'روانی و انسجام'], ['Lexical Resource', 'دامنهٔ واژگان'], ['Grammatical Range & Accuracy', 'دستور زبان'], ['Pronunciation', 'تلفظ']];
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function CueCard({ book, onClear }) {
  const [i, setI] = useState(() => Math.floor(Math.random() * CUES.length));
  const [phase, setPhase] = useState('idle'), [left, setLeft] = useState(0), [rec, setRec] = useState(null), [err, setErr] = useState('');
  const mr = useRef(null), chunks = useRef([]);
  useEffect(() => {
    if (phase !== 'prep' && phase !== 'talk') return;
    const id = setInterval(() => setLeft(s => {
      if (s > 1) return s - 1;
      clearInterval(id);
      if (phase === 'prep') startTalk(); else stop();
      return 0;
    }), 1000);
    return () => clearInterval(id);
  }, [phase]);
  useEffect(() => () => { try { mr.current?.stream.getTracks().forEach(t => t.stop()); } catch {} if (rec) URL.revokeObjectURL(rec); }, []);
  const startTalk = async () => {
    setPhase('talk'); setLeft(120); setErr('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = []; const m = new MediaRecorder(stream); mr.current = m;
      m.ondataavailable = e => e.data.size && chunks.current.push(e.data);
      m.onstop = () => { stream.getTracks().forEach(t => t.stop()); setRec(old => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(new Blob(chunks.current, { type: m.mimeType || 'audio/webm' })); }); };
      m.start();
    } catch (e) { setErr('ضبط صدا ممکن نشد (اجازهٔ میکروفون را بده)؛ بدون ضبط هم می‌توانی تمرین کنی.'); }
  };
  const stop = () => { try { if (mr.current && mr.current.state !== 'inactive') mr.current.stop(); } catch {} setPhase('done'); };
  const next = () => { stop(); setPhase('idle'); onClear?.(); setI(x => (x + 1 + Math.floor(Math.random() * (CUES.length - 1))) % CUES.length); };
  const [notes, setNotes] = useState(false);
  useEffect(() => { setPhase('idle'); setNotes(false); }, [book]);
  const [title, points] = book ? [book.title, book.ask || []] : CUES[i];
  return <section className="ie-card ie-wide">
    <header><h2><Mic size={18} />{book ? 'کارت کتاب' : 'Part 2 — کارت موضوع'}</h2><span className="ie-muted">۱ دقیقه آماده‌سازی، تا ۲ دقیقه صحبت؛ ضبط فقط روی همین مرورگر</span></header>
    <div className="sp-cue" dir="ltr"><b>{title}</b>{book ? <p>{book.text}</p> : null}{points.length ? <><p>{book ? 'Ask the examiner about:' : 'You should say:'}</p><ul>{points.map(x => <li key={x}>{x}</li>)}</ul></> : null}</div>
    {book?.notes ? <>
      <button type="button" className="ie-btn ghost" aria-expanded={notes} onClick={() => setNotes(v => !v)}>{notes ? 'پنهان کردن' : 'نمایش'} یادداشت ممتحن (بعد از تمرین ببین)</button>
      {notes ? <p className="sp-notes" dir="ltr">{book.notes}</p> : null}
    </> : null}
    <div className="ie-row">
      {phase === 'idle' || phase === 'done' ? <button type="button" className="ie-btn" onClick={() => { setPhase('prep'); setLeft(60); }}>شروع (۱ دقیقه آماده‌سازی)</button> : null}
      {phase === 'prep' ? <><span className="sp-time">آماده‌سازی {mmss(left)}</span><button type="button" className="ie-btn" onClick={startTalk}><Mic size={15} />همین الان شروع به صحبت</button></> : null}
      {phase === 'talk' ? <><span className="sp-time live">صحبت {mmss(left)}</span><button type="button" className="ie-btn ghost" onClick={stop}><Square size={14} />پایان</button></> : null}
      <button type="button" className="ie-btn ghost" onClick={next}><RefreshCw size={14} />کارت دیگر</button>
    </div>
    {err ? <p className="ie-err">{err}</p> : null}
    {rec && phase === 'done' ? <div className="sp-rec"><span className="ie-muted">ضبط تو — گوش بده و ببین کجا مکث کردی یا کلمه کم آوردی:</span><audio controls src={rec} /></div> : null}
  </section>;
}

const QSet = ({ title, sets }) => <section className="ie-card">
  <header><h2>{title}</h2></header>
  {sets.map(([topic, qs]) => <div key={topic} className="sp-set"><h3 className="ie-h3">{topic}</h3><ul dir="ltr">{qs.map(q => <li key={q}>{q}</li>)}</ul></div>)}
</section>;

export function SpeakingPanel() {
  const [book, setBook] = useState(null);
  const pick = c => { setBook(c); setTimeout(() => document.querySelector('.sp-cue')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); };
  return <>
    <section className="ie-card">
      <header><h2>ساختار آزمون اسپیکینگ</h2><span className="ie-muted">۱۱ تا ۱۴ دقیقه</span></header>
      <ul className="ie-list">
        <li><b>Part 1</b> (۴–۵ دقیقه): سؤال‌های کوتاه دربارهٔ خودت، کار، خانه و علاقه‌ها.</li>
        <li><b>Part 2</b> (۳–۴ دقیقه): یک کارت موضوع؛ {fa(1)} دقیقه آماده‌سازی و تا {fa(2)} دقیقه صحبت.</li>
        <li><b>Part 3</b> (۴–۵ دقیقه): بحث عمیق‌تر دربارهٔ همان موضوع.</li>
      </ul>
      <h3 className="ie-h3">چهار معیار نمره</h3>
      <ul className="ie-list">{CRITERIA.map(([en, f]) => <li key={en}><span dir="ltr">{en}</span> — {f}</li>)}</ul>
    </section>
    <section className="ie-card">
      <header><h2>تمرین مکالمه با معلم هوشمند</h2></header>
      <p className="ie-muted">در اپ زبان، تب «معلم» حالت‌های «مکالمه» و «نقش‌آفرینی» دارد: سؤال می‌پرسد، اشتباه‌ها را کوتاه اصلاح می‌کند و صدا را هم می‌فهمد.</p>
      <a className="ie-btn" href="/?page=vocab">رفتن به معلم زبان</a>
      <p className="ie-muted">بانک سؤال Part 1 با واژگان کلاس هم در «جزوه» اپ زبان هست.</p>
    </section>
    <SpeakingBook onPick={pick} />
    <CueCard book={book} onClear={() => setBook(null)} />
    <QSet title="Part 1 — سؤال‌های تمرینی" sets={PART1} />
    <QSet title="Part 3 — سؤال‌های بحث" sets={PART3} />
  </>;
}
