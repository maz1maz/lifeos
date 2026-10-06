import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Page, api, fa, faD, jShort, todayIso, addDays } from './life-core';
import { JalaliDateInput } from './jdate';

// «ورزش» (tab next to «سلامت»): quick log, weekly goal (WHO: 150 min), streak, 12-week chart, by-type split.
// Backend: GET /api/exercise?from&to, POST /api/exercise {type,minutes,date,km?,note?}, DELETE /api/exercise/:id.
const TYPES = [['پیاده‌روی', '🚶'], ['دویدن', '🏃'], ['باشگاه', '🏋️'], ['دوچرخه', '🚴'], ['شنا', '🏊'], ['یوگا', '🧘'], ['فوتبال', '⚽'], ['کوه', '⛰️']];
const ICON = Object.fromEntries(TYPES);
const DIST = new Set(['پیاده‌روی', 'دویدن', 'دوچرخه', 'شنا', 'کوه']);
const GOAL_KEY = 'lifeos-exercise-goal';
const readGoal = () => { try { return Number(localStorage.getItem(GOAL_KEY)) || 150; } catch { return 150; } };
// Weeks start on Saturday (Iranian week); returns the ISO date of that Saturday.
const weekStart = iso => { const d = new Date(iso + 'T12:00:00Z'), back = (d.getUTCDay() + 1) % 7; return addDays(iso, -back); };
const hm = m => m >= 60 ? `${fa(Math.floor(m / 60))} ساعت${m % 60 ? ` و ${fa(m % 60)} دقیقه` : ''}` : `${fa(m)} دقیقه`;

export function ExercisePage({ Nav }) {
  const today = todayIso(), from = addDays(weekStart(today), -77);
  const [items, setItems] = useState(null), [err, setErr] = useState(''), [goal, setGoal] = useState(readGoal);
  const [f, setF] = useState({ type: 'پیاده‌روی', minutes: '', km: '', note: '', date: today }), [busy, setBusy] = useState(false);
  const load = () => api(`/api/exercise?from=${from}&to=${today}`).then(d => setItems((d.items || []).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt))).catch(e => setErr(e.message));
  useEffect(() => { load(); }, []);
  const add = async e => {
    e.preventDefault();
    const minutes = Number(String(f.minutes).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    if (!f.type.trim() || !(minutes > 0)) { setErr('نوع ورزش و مدت (دقیقه) را بنویس.'); return; }
    setBusy(true); setErr('');
    try { await api('/api/exercise', { method: 'POST', body: JSON.stringify({ type: f.type.trim(), minutes, date: f.date || today, km: Number(String(f.km).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace('/', '.')) || undefined, note: f.note || undefined }) }); setF(o => ({ ...o, minutes: '', km: '', note: '' })); await load(); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  };
  const del = async x => { if (!window.confirm(`«${x.type}» ${jShort(x.date)} حذف شود؟`)) return; setItems(xs => xs.filter(y => y.id !== x.id)); await api(`/api/exercise/${x.id}`, { method: 'DELETE' }).catch(() => load()); };
  const saveGoal = v => { const n = Math.max(30, Math.min(1500, Number(v) || 150)); setGoal(n); try { localStorage.setItem(GOAL_KEY, String(n)); } catch {} };

  const s = useMemo(() => {
    const list = items || [], wk0 = weekStart(today);
    const weeks = Array.from({ length: 12 }, (_, i) => { const st = addDays(wk0, (i - 11) * 7), en = addDays(st, 6); return { st, min: list.filter(x => x.date >= st && x.date <= en).reduce((a, x) => a + x.minutes, 0) }; });
    const days = new Set(list.map(x => x.date));
    let streak = 0, d = days.has(today) ? today : addDays(today, -1);
    while (days.has(d)) { streak++; d = addDays(d, -1); }
    const month = today.slice(0, 7), mList = list.filter(x => x.date >= addDays(today, -29));
    const byType = Object.entries(mList.reduce((o, x) => (o[x.type] = (o[x.type] || 0) + x.minutes, o), {})).sort((a, b) => b[1] - a[1]);
    return { weeks, week: weeks[11].min, streak, mMin: mList.reduce((a, x) => a + x.minutes, 0), mDays: new Set(mList.map(x => x.date)).size, mKm: mList.reduce((a, x) => a + (x.km || 0), 0), byType, month };
  }, [items]);
  const max = Math.max(goal, ...s.weeks.map(w => w.min)), pct = Math.min(100, Math.round(s.week / goal * 100));
  const groups = useMemo(() => { const g = []; for (const x of (items || []).slice(0, 40)) { const last = g[g.length - 1]; if (last && last.date === x.date) last.list.push(x); else g.push({ date: x.date, list: [x] }); } return g; }, [items]);

  return <Page Nav={Nav} className="ex" kicker="سلامت" title="ورزش" sub="ثبت سریع تمرین، هدف هفتگی و روند ۱۲ هفتهٔ اخیر">
    <section className="lf-card ex-add">
      <h3>ثبت تمرین</h3>
      <div className="ex-types" role="group" aria-label="نوع ورزش">{TYPES.map(([t, ic]) => <button type="button" key={t} aria-pressed={f.type === t} className={f.type === t ? 'on' : ''} onClick={() => setF(o => ({ ...o, type: t }))}>{ic} {t}</button>)}</div>
      <form onSubmit={add} className="ex-form">
        <label>نوع<input value={f.type} onChange={e => setF(o => ({ ...o, type: e.target.value }))} maxLength={40} /></label>
        <label>مدت (دقیقه)<input value={f.minutes} onChange={e => setF(o => ({ ...o, minutes: e.target.value }))} inputMode="numeric" placeholder="۳۰" required /></label>
        {DIST.has(f.type) ? <label>مسافت (کیلومتر)<input value={f.km} onChange={e => setF(o => ({ ...o, km: e.target.value }))} inputMode="decimal" placeholder="اختیاری" /></label> : null}
        <label>تاریخ<JalaliDateInput value={f.date} onChange={v => setF(o => ({ ...o, date: v || today }))} clearable={false} /></label>
        <label className="ex-note">یادداشت<input value={f.note} onChange={e => setF(o => ({ ...o, note: e.target.value }))} maxLength={200} placeholder="اختیاری" /></label>
        <button type="submit" className="lf-btn" disabled={busy}>{busy ? '…' : 'ثبت'}</button>
      </form>
      {err ? <p className="ex-err" role="status">⚠ {err}</p> : null}
    </section>

    <div className="ex-stats">
      <section className="lf-card ex-goal">
        <h3>این هفته</h3>
        <div className="ex-ring" style={{ '--p': pct }} role="img" aria-label={`${fa(pct)} درصد هدف هفتگی`}><b>{fa(pct)}٪</b></div>
        <p>{hm(s.week)} از {hm(goal)}</p>
        <label className="ex-goal-in">هدف هفتگی (دقیقه)<input type="number" min={30} max={1500} step={10} value={goal} onChange={e => saveGoal(e.target.value)} /></label>
      </section>
      <section className="lf-card ex-kpis">
        <div><small>زنجیرهٔ روزهای پشت‌سرهم</small><b>{fa(s.streak)} روز</b></div>
        <div><small>۳۰ روز اخیر</small><b>{hm(s.mMin)}</b></div>
        <div><small>روزهای ورزش (۳۰ روز)</small><b>{fa(s.mDays)} روز</b></div>
        {s.mKm ? <div><small>مسافت (۳۰ روز)</small><b>{fa(s.mKm, 1)} کیلومتر</b></div> : null}
      </section>
    </div>

    <section className="lf-card ex-chart-card">
      <h3>دقیقه‌های هر هفته</h3>
      <div className="ex-chart" role="img" aria-label="نمودار دقیقه‌های ورزش در ۱۲ هفتهٔ اخیر">
        <i className="ex-goal-line" style={{ bottom: `${goal / max * 100}%` }} aria-hidden="true"><span>هدف</span></i>
        {s.weeks.map((w, i) => <div key={w.st} className={`ex-bar${w.min >= goal ? ' hit' : ''}${i === 11 ? ' now' : ''}`} title={`هفتهٔ ${jShort(w.st)}: ${hm(w.min)}`}><i style={{ height: `${w.min / max * 100}%` }} /></div>)}
      </div>
      <div className="ex-axis"><span>{jShort(s.weeks[0].st)}</span><span>این هفته</span></div>
    </section>

    {s.byType.length ? <section className="lf-card">
      <h3>تفکیک نوع (۳۰ روز)</h3>
      <ul className="ex-types-split">{s.byType.map(([t, m]) => <li key={t}><span>{ICON[t] || '🏅'} {t}</span><i><em style={{ width: `${m / s.byType[0][1] * 100}%` }} /></i><b>{hm(m)}</b></li>)}</ul>
    </section> : null}

    <section className="lf-card">
      <h3>تمرین‌های اخیر</h3>
      {items === null ? <p className="ex-muted">در حال بارگذاری…</p> : !groups.length ? <p className="ex-muted">هنوز تمرینی ثبت نکرده‌ای. اولین تمرین را بالا ثبت کن.</p>
        : groups.map(g => <div key={g.date} className="ex-day"><h4>{g.date === today ? 'امروز' : g.date === addDays(today, -1) ? 'دیروز' : jShort(g.date)}</h4>
          {g.list.map(x => <div key={x.id} className="ex-row"><span className="ex-ic" aria-hidden="true">{ICON[x.type] || '🏅'}</span><span className="ex-t"><b>{x.type}</b><small>{hm(x.minutes)}{x.km ? ` · ${fa(x.km, 2)} کیلومتر` : ''}{x.note ? ` · ${x.note}` : ''}</small></span><button type="button" className="ex-del" onClick={() => del(x)} aria-label={`حذف ${x.type}`}><Trash2 size={15} /></button></div>)}
        </div>)}
    </section>
  </Page>;
}
