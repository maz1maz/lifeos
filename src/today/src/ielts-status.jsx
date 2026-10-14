import { useEffect, useState } from 'react';
import { CalendarClock, Target } from 'lucide-react';
import { api, fa } from './life-core';

// Top of the IELTS page: the four skills as tabs, each with its latest band, plus an overall estimate, the target
// band and a countdown to the exam day. Bands come from /api/ielts/exams (Reading/Listening attempts) and
// /api/ielts/writing (AI-marked essays); the goal is a per-browser setting.
const GOAL_KEY = 'lifeos-ielts-goal';
const loadGoal = () => { try { return JSON.parse(localStorage.getItem(GOAL_KEY)) || {}; } catch { return {}; } };
const saveGoal = g => { try { localStorage.setItem(GOAL_KEY, JSON.stringify(g)); } catch {} };
// IELTS rounds the mean of the four skills to the nearest half band (.25 → .5, .75 → next whole band)
export const overallBand = bands => { const v = bands.filter(b => b != null); if (!v.length) return null; const m = v.reduce((a, b) => a + b, 0) / v.length; return Math.floor(m * 2 + 0.5) / 2; };
const daysTo = iso => { if (!iso) return null; const d = Math.ceil((new Date(iso + 'T00:00:00') - new Date(new Date().toDateString())) / 864e5); return Number.isFinite(d) ? d : null; };
const jdate = iso => { try { return new Date(iso + 'T00:00:00').toLocaleDateString('fa-IR-u-ca-persian', { day: 'numeric', month: 'long' }); } catch { return iso; } };
const b1 = b => b == null ? '—' : fa(b, 1);

export function useIeltsBands() {
  const [s, setS] = useState({});
  useEffect(() => {
    let live = true;
    Promise.all([api('/api/ielts/exams').catch(() => null), api('/api/ielts/writing').catch(() => null)]).then(([ex, wr]) => {
      if (!live) return;
      const last = skill => { const a = (ex?.attempts || []).filter(x => x.skill === skill); const full = a.find(x => !x.parts); return full ? { band: full.band } : a[0] ? { band: a[0].band, part: true } : null; };
      const w = (wr?.items || [])[0];
      setS({ reading: last('reading'), listening: last('listening'), writing: w ? { band: w.overall } : null, speaking: null });
    });
    return () => { live = false; };
  }, []);
  return s;
}

export function IeltsStatus({ tabs, skill, onPick }) {
  const bands = useIeltsBands(), [goal, setGoal] = useState(loadGoal), [edit, setEdit] = useState(false);
  const upd = g => { setGoal(g); saveGoal(g); };
  const overall = overallBand(tabs.map(([k]) => bands[k]?.band)), have = tabs.filter(([k]) => bands[k]).length;
  const left = daysTo(goal.date);
  return <section className="ie-status">
    <div className="ie-st-top">
      <div className="ie-st-title"><h1>آیلتس</h1>
        <span className="ie-st-overall" title="میانگین آخرین باند مهارت‌ها، گرد به نیم‌باند">باند تخمینی {b1(overall)}{overall != null && have < 4 ? <small> (از {fa(have)} مهارت)</small> : null}</span>
      </div>
      <div className="ie-st-goal">
        {edit ? <>
          <label>هدف <select value={goal.band || ''} onChange={e => upd({ ...goal, band: Number(e.target.value) || null })}><option value="">—</option>{[5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9].map(b => <option key={b} value={b}>{fa(b, 1)}</option>)}</select></label>
          <label>روز آزمون <input type="date" value={goal.date || ''} onChange={e => upd({ ...goal, date: e.target.value || null })} /></label>
          <button type="button" className="ie-btn ghost" onClick={() => setEdit(false)}>تمام</button>
        </> : <button type="button" className="ie-st-goalbtn" onClick={() => setEdit(true)}>
          <Target size={15} />{goal.band ? `هدف ${fa(goal.band, 1)}` : 'هدف را تعیین کن'}
          {left != null ? <><CalendarClock size={15} />{left > 0 ? `${fa(left)} روز تا آزمون (${jdate(goal.date)})` : left === 0 ? 'آزمون امروز است' : 'روز آزمون گذشته'}</> : null}
        </button>}
      </div>
    </div>
    <nav className="ie-skills" role="tablist" aria-label="مهارت‌های آیلتس">
      {tabs.map(([k, t, I]) => { const b = bands[k]; const gap = goal.band && b ? b.band - goal.band : null; return <button key={k} type="button" role="tab" aria-selected={skill === k} className={skill === k ? 'on' : ''} onClick={() => onPick(k)}>
        <span className="ie-sk-name"><I size={18} />{t}</span>
        <span className={`ie-sk-band ${gap != null ? (gap >= 0 ? 'ok' : 'low') : ''}`}>{b ? b1(b.band) : '—'}{b?.part ? <small> (یک پسیج)</small> : null}</span>
      </button>; })}
    </nav>
  </section>;
}
