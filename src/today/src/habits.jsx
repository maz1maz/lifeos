import { useEffect, useMemo, useState } from 'react';
import { isoToJ, MONTHS } from './jdate';
import './habits.css';

const api = async (url, options) => {
  const r = await fetch(url, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error || 'دریافت اطلاعات ناموفق بود.');
  return b;
};
const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const faD = v => String(v ?? '').replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const fa = n => Number(n || 0).toLocaleString('fa-IR');
const jLabel = iso => { const j = isoToJ(iso); return `${faD(j.jd)} ${MONTHS[j.jm - 1]}`; };
// Iranian week starts on Saturday (getUTCDay 6)
const weekStart = iso => { const d = new Date(iso + 'T12:00:00Z'), back = (d.getUTCDay() + 1) % 7; return addDays(iso, -back); };
const WD = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
const ICONS = ['✓', '💧', '🏃', '📖', '🧘', '💪', '🥗', '😴', '🚭', '✍️', '🇬🇧', '🙏'];
const WEEKS = 16;

export function HabitsPage({ Nav }) {
  const today = todayIso();
  const [habits, setHabits] = useState(null);
  const [logs, setLogs] = useState([]);
  const [name, setName] = useState(''), [icon, setIcon] = useState('✓');
  const [msg, setMsg] = useState('');
  const start = weekStart(addDays(today, -7 * (WEEKS - 1)));
  const load = async () => {
    try {
      const [h, hist] = await Promise.all([api(`/api/habits?date=${today}`), api(`/api/habits/history?from=${start}&to=${today}`)]);
      setHabits(h.items || []); setLogs(hist.logs || []);
    } catch (e) { setMsg(e.message); setHabits([]); }
  };
  useEffect(() => { load(); }, []);
  const doneSet = useMemo(() => new Set(logs.filter(l => l.done).map(l => l.habitId + '|' + l.date)), [logs]);
  const days = useMemo(() => { const out = []; for (let d = start; d <= today; d = addDays(d, 1)) out.push(d); return out; }, [start, today]);

  const toggle = async (h, date = today) => {
    const k = h.id + '|' + date, was = doneSet.has(k);
    setLogs(ls => was ? ls.filter(l => !(l.habitId === h.id && l.date === date)) : [...ls, { habitId: h.id, date, done: true }]);
    if (date === today) setHabits(hs => hs.map(x => x.id === h.id ? { ...x, done: !was, streak: Math.max(0, (x.streak || 0) + (was ? -1 : 1)) } : x));
    try { await api(`/api/habits/${h.id}/toggle`, { method: 'POST', body: JSON.stringify({ date }) }); if (date !== today) load(); } catch (e) { setMsg(e.message); load(); }
  };
  const add = async e => {
    e.preventDefault(); if (!name.trim()) return;
    try { await api('/api/habits', { method: 'POST', body: JSON.stringify({ name: name.trim(), icon }) }); setName(''); load(); } catch (err) { setMsg(err.message); }
  };
  const remove = async h => { if (!window.confirm(`عادت «${h.name}» و همهٔ سابقه‌اش حذف شود؟`)) return; await api(`/api/habits/${h.id}`, { method: 'DELETE' }).catch(() => {}); load(); };
  const rename = async h => { const n = window.prompt('نام تازه:', h.name); if (!n || n === h.name) return; await api(`/api/habits/${h.id}`, { method: 'PATCH', body: JSON.stringify({ name: n }) }).catch(() => {}); load(); };

  const stats = h => {
    let best = 0, run = 0;
    for (const d of days) { if (doneSet.has(h.id + '|' + d)) { run++; best = Math.max(best, run); } else run = 0; }
    const last30 = days.slice(-30).filter(d => doneSet.has(h.id + '|' + d)).length;
    return { best, pct30: Math.round(last30 / 30 * 100) };
  };
  const doneToday = (habits || []).filter(h => doneSet.has(h.id + '|' + today)).length;

  return <main className="hb" dir="rtl">
    <Nav />
    <div className="hb-page">
      <header className="hb-hero">
        <div><p>هر روز یک قدم</p><h1>عادت‌ها</h1></div>
        {habits?.length ? <div className="hb-today"><b>{fa(doneToday)}<small>/{fa(habits.length)}</small></b><span>امروز</span><i style={{ '--p': `${habits.length ? doneToday / habits.length * 100 : 0}%` }} /></div> : null}
      </header>
      {msg && <div className="notice">{msg}<button onClick={() => setMsg('')}>×</button></div>}
      <form className="hb-add" onSubmit={add}>
        <select value={icon} onChange={e => setIcon(e.target.value)} aria-label="آیکن">{ICONS.map(i => <option key={i}>{i}</option>)}</select>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="عادت تازه… مثلاً ۸ لیوان آب، ۲۰ دقیقه مطالعه" />
        <button className="hb-btn">افزودن</button>
      </form>
      {habits === null ? <p className="hb-empty">در حال دریافت…</p> : !habits.length ? <p className="hb-empty">هنوز عادتی نساختی. از بالا یکی اضافه کن؛ هر روز تیکش بزن تا زنجیره‌اش بلند شود 🔥</p> :
        <div className="hb-list">{habits.map(h => {
          const st = stats(h), on = doneSet.has(h.id + '|' + today);
          return <article key={h.id} className={`hb-card ${on ? 'on' : ''}`}>
            <div className="hb-top">
              <button type="button" className={`hb-check ${on ? 'on' : ''}`} onClick={() => toggle(h)} aria-pressed={on} aria-label={`${h.name} امروز`}>{on ? '✓' : h.icon || '✓'}</button>
              <div className="hb-title"><b>{h.name}</b><small>🔥 {fa(h.streak || 0)} روز پشت‌سرهم · رکورد {fa(st.best)} · ۳۰ روز اخیر {fa(st.pct30)}٪</small></div>
              <span className="hb-ops"><button type="button" onClick={() => rename(h)}>ویرایش</button><button type="button" className="del" onClick={() => remove(h)}>حذف</button></span>
            </div>
            <div className="hb-heat" style={{ gridTemplateColumns: `18px repeat(${Math.ceil(days.length / 7)}, 1fr)` }}>
              {WD.map((w, r) => <span key={'w' + r} className="hb-wd" style={{ gridRow: r + 1, gridColumn: 1 }}>{r % 2 === 0 ? w : ''}</span>)}
              {days.map((d, i) => { const k = doneSet.has(h.id + '|' + d), col = Math.floor(i / 7) + 2, row = (i % 7) + 1; return <button type="button" key={d} className={`hb-cell ${k ? 'on' : ''} ${d === today ? 'today' : ''}`} style={{ gridColumn: col, gridRow: row }} title={`${jLabel(d)}${k ? ' ✓' : ''}`} onClick={() => toggle(h, d)} />; })}
            </div>
          </article>;
        })}</div>}
      <p className="hb-note">روی هر خانهٔ جدول بزن تا روزهای قبل را هم تیک بزنی یا برداری. خلاصهٔ هفته جمعه‌شب به تلگرام می‌آید.</p>
    </div>
  </main>;
}

export function WeeklyPage({ Nav }) {
  const today = todayIso();
  const [ws, setWs] = useState(() => weekStart(today));
  const [data, setData] = useState(null), [prio, setPrio] = useState(''), [saved, setSaved] = useState('');
  const we = addDays(ws, 6);
  useEffect(() => {
    setData(null);
    api(`/api/weekly-review?from=${ws}&to=${we}`).then(d => { setData(d); setPrio(d.priority || ''); }).catch(e => setData({ error: e.message }));
  }, [ws]);
  const save = async () => { try { await api('/api/weekly-review', { method: 'PUT', body: JSON.stringify({ weekStart: ws, priority: prio }) }); setSaved('ذخیره شد ✓'); setTimeout(() => setSaved(''), 1800); } catch (e) { setSaved(e.message); } };
  const isCur = ws === weekStart(today);
  const short = n => { const a = Math.abs(n || 0), f = v => v.toLocaleString('fa-IR', { maximumFractionDigits: v >= 100 ? 0 : 1 }); return a >= 1e9 ? `${f(a / 1e9)} میلیارد` : a >= 1e6 ? `${f(a / 1e6)} میلیون` : fa(a); };
  return <main className="hb" dir="rtl">
    <Nav />
    <div className="hb-page">
      <header className="hb-hero">
        <div><p>مرور هفتگی</p><h1>{jLabel(ws)} تا {jLabel(we)}</h1></div>
        <div className="hb-weeknav">
          <button type="button" onClick={() => setWs(addDays(ws, -7))} aria-label="هفتهٔ قبل">›</button>
          {!isCur && <button type="button" className="txt" onClick={() => setWs(weekStart(today))}>این هفته</button>}
          <button type="button" onClick={() => setWs(addDays(ws, 7))} disabled={isCur} aria-label="هفتهٔ بعد">‹</button>
        </div>
      </header>
      {!data ? <p className="hb-empty">در حال دریافت…</p> : data.error ? <p className="hb-empty">{data.error}</p> : <>
        <div className="hb-kpis">
          <div><small>کارهای انجام‌شده</small><b>{fa(data.wins?.length)}</b></div>
          <div className={data.overdue?.length ? 'bad' : ''}><small>عقب‌افتاده</small><b>{fa(data.overdue?.length)}</b></div>
          <div><small>ساعت کار ثبت‌شده</small><b>{fa(Math.round((data.workMinutes || 0) / 6) / 10)}</b></div>
          <div><small>هزینهٔ هفته (ریال)</small><b>{short(data.expense)}</b></div>
        </div>
        <div className="hb-grid2">
          <section className="hb-box">
            <h2>✅ کارهای انجام‌شده</h2>
            {data.wins?.length ? <ul className="hb-ul">{data.wins.slice(0, 30).map(t => <li key={t.id}><span>{t.title}</span><small>{jLabel(t.date)}</small></li>)}</ul> : <p className="hb-empty">این هفته کاری تیک نخورده.</p>}
            {data.overdue?.length ? <><h2 className="bad">⛔ عقب‌افتاده‌ها</h2><ul className="hb-ul">{data.overdue.slice(0, 15).map(t => <li key={t.id}><span>{t.title}</span><small>مهلت {jLabel(t.deadline)}</small></li>)}</ul></> : null}
          </section>
          <section className="hb-box">
            <h2>🔥 عادت‌ها</h2>
            {data.habits?.length ? data.habits.map(h => <div key={h.id} className="hb-wrow"><span>{h.icon} {h.name}</span><i className="hb-dots">{[...Array(7)].map((_, i) => <u key={i} className={i < h.doneCount ? 'on' : ''} />)}</i><small>{fa(h.doneCount)}/۷</small></div>) : <p className="hb-empty">عادتی تعریف نشده.</p>}
            {data.football?.total ? <p className="hb-note">⚽ پیش‌بینی‌ها: {fa(data.football.correct)} درست از {fa(data.football.total)}</p> : null}
            <h2 style={{ marginTop: 18 }}>🎯 مهم‌ترین کار هفتهٔ بعد</h2>
            <textarea value={prio} onChange={e => setPrio(e.target.value)} placeholder="یک یا دو اولویت اصلی برای هفتهٔ بعد…" rows={4} />
            <div className="hb-save"><button type="button" className="hb-btn" onClick={save}>ذخیره</button><small>{saved}</small></div>
          </section>
        </div>
      </>}
    </div>
  </main>;
}
