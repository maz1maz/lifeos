// Life & work modules: health, car, travel, projects (kanban), customers & sales, learning,
// journal, yearly goals, focus timer, shopping list, bills and life statistics.
// All of them sit on the generic per-user collections API (/api/col/<name>).
import { useEffect, useMemo, useRef, useState } from 'react';
import { askMath } from './mathConfirm';
import { JalaliDateInput, isoToJ, jToIso, MONTHS } from './jdate';
import { SideLayout } from './sidelist';
import './life.css';
import { VocabStats } from './vocab';
import { printProjectReport, sendProjectReportToTelegram, printCompareReport } from './projectReportPrint';

import { api, todayIso, addDays, faD, fa, jl, jShort, money, daysTo, dueChip, SaveErrorBar, useCol, Page, FormDrawer, num } from './life-core';
import { FocusControl } from './life-cards';
import { StatementWorkbook, hasWorkbook, grossUpTo } from './statement';
export { api, todayIso, addDays, faD, fa, jl, jShort, money, daysTo, dueChip, SaveErrorBar, useCol, Page, FormDrawer } from './life-core';
export { FocusControl, FocusCard, ShoppingPanel, BillsWeekCard } from './life-cards';

// Tiny SVG charts (no library)
export function LineChart({ points, unit = '', height = 150, color = 'var(--g-accent)' }) {
  const pts = points.filter(p => Number.isFinite(p.y));
  if (pts.length < 2) return <p className="lf-empty">برای نمودار حداقل دو ثبت لازم است.</p>;
  const w = 600, h = height, pad = 26, ys = pts.map(p => p.y), min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1;
  const x = i => pad + (i / (pts.length - 1)) * (w - pad * 2), y = v => h - pad - ((v - min) / span) * (h - pad * 2);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.y).toFixed(1)}`).join(' ');
  return <svg className="lf-chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img">
    <path d={`${d} L${x(pts.length - 1)} ${h - pad} L${x(0)} ${h - pad} Z`} fill={color} opacity=".12" />
    <path d={d} fill="none" stroke={color} strokeWidth="2.4" vectorEffect="non-scaling-stroke" />
    {pts.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.y)} r="3" fill={color}><title>{`${jShort(p.x)}: ${fa(p.y)}${unit}`}</title></circle>)}
    <text x={w - pad} y={14} fontSize="12" fill="var(--g-muted)" textAnchor="end">{fa(max)}{unit}</text>
    <text x={w - pad} y={h - 8} fontSize="12" fill="var(--g-muted)" textAnchor="end">{fa(min)}{unit}</text>
  </svg>;
}
export function Bars({ data, height = 120, color = 'var(--g-accent)', unit = '', rtl = false }) {
  const max = Math.max(1, ...data.map(d => d.v || 0));
  return <div className="lf-bars" style={{ height, direction: rtl ? 'rtl' : 'ltr' }}>{data.map((d, i) => <div key={i} title={`${d.label}: ${fa(d.v)}${unit}`}><i style={{ height: `${Math.max(d.v ? 4 : 1, (d.v || 0) / max * 100)}%`, background: d.color || color }} /><small>{d.short ?? ''}</small></div>)}</div>;
}

/* ───────────────────────── Health ───────────────────────── */
export function HealthPage({ Nav }) {
  const col = useCol('health');
  const today = todayIso();
  const byDate = useMemo(() => { const m = {}; for (const x of col.items || []) m[x.date] = x; return m; }, [col.items]);
  const cur = byDate[today] || { date: today };
  const [f, setF] = useState(null);
  useEffect(() => { if (col.items) setF({ weight: cur.weight ?? '', sleepH: cur.sleepH ?? '', steps: cur.steps ?? '', water: cur.water ?? 0, workoutMin: cur.workoutMin ?? '', workout: cur.workout || '' }); }, [col.items === null]);
  const save = async patch => {
    const next = { ...(f || {}), ...patch }; setF(next);
    const body = { date: today, weight: next.weight === '' ? null : num(next.weight), sleepH: next.sleepH === '' ? null : num(next.sleepH), steps: next.steps === '' ? null : num(next.steps), water: num(next.water), workoutMin: next.workoutMin === '' ? null : num(next.workoutMin), workout: next.workout || '' };
    if (byDate[today]?.id) await col.patch(byDate[today].id, body); else await col.add(body);
  };
  const last = n => { const out = []; for (let i = n - 1; i >= 0; i--) { const d = addDays(today, -i); out.push({ d, e: byDate[d] }); } return out; };
  const w90 = last(90).filter(x => x.e && x.e.weight).map(x => ({ x: x.d, y: x.e.weight }));
  const d30 = last(30);
  const avg = k => { const v = d30.map(x => x.e?.[k]).filter(x => Number.isFinite(x) && x > 0); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const wFirst = w90[0]?.y, wLast = w90[w90.length - 1]?.y;
  return <Page Nav={Nav} kicker="هر روز چند ثانیه" title="سلامت" sub={`ثبت امروز · ${jl(today)}`}>
    {!f ? <p className="lf-empty">در حال دریافت…</p> : <>
      <section className="lf-card lf-today">
        <label><span>⚖️ وزن (کیلو)</span><input inputMode="decimal" data-raw value={f.weight} onChange={e => setF({ ...f, weight: e.target.value })} onBlur={() => save({})} placeholder="—" /></label>
        <label><span>😴 خواب (ساعت)</span><input inputMode="decimal" data-raw value={f.sleepH} onChange={e => setF({ ...f, sleepH: e.target.value })} onBlur={() => save({})} placeholder="—" /></label>
        <label><span>🚶 قدم</span><input inputMode="numeric" value={f.steps} onChange={e => setF({ ...f, steps: e.target.value })} onBlur={() => save({})} placeholder="—" /></label>
        <label><span>🏋️ ورزش (دقیقه)</span><input inputMode="numeric" value={f.workoutMin} onChange={e => setF({ ...f, workoutMin: e.target.value })} onBlur={() => save({})} placeholder="—" /></label>
        <div className="lf-water"><span>💧 آب ({fa(f.water || 0)} لیوان)</span><div>{[...Array(10)].map((_, i) => <button type="button" key={i} className={i < (f.water || 0) ? 'on' : ''} onClick={() => save({ water: i < (f.water || 0) ? i : i + 1 })} aria-label={`${i + 1} لیوان`} />)}</div></div>
      </section>
      <div className="lf-kpis">
        <div><small>وزن فعلی</small><b>{wLast ? fa(wLast) : '—'}</b><em>{wFirst && wLast && w90.length > 1 ? `${wLast - wFirst >= 0 ? '+' : '−'}${fa(Math.abs(wLast - wFirst))} در ۹۰ روز` : ''}</em></div>
        <div><small>میانگین خواب ۳۰ روز</small><b>{avg('sleepH') ? fa(avg('sleepH')) : '—'}</b><em>ساعت</em></div>
        <div><small>میانگین قدم</small><b>{avg('steps') ? fa(avg('steps'), 0) : '—'}</b><em>در روز</em></div>
        <div><small>روزهای ورزش (۳۰ روز)</small><b>{fa(d30.filter(x => (x.e?.workoutMin || 0) > 0).length)}</b><em>روز</em></div>
      </div>
      <div className="lf-grid2">
        <section className="lf-card"><h2>روند وزن (۹۰ روز)</h2><LineChart points={w90} unit=" kg" /></section>
        <section className="lf-card"><h2>خواب ۳۰ روز اخیر</h2><Bars data={d30.map(x => ({ label: jShort(x.d), short: '', v: x.e?.sleepH || 0, color: (x.e?.sleepH || 0) < 6 ? '#fb7185' : '#60a5fa' }))} unit=" ساعت" /></section>
        <section className="lf-card"><h2>آب</h2><Bars data={d30.map(x => ({ label: jShort(x.d), v: x.e?.water || 0, color: '#38bdf8' }))} unit=" لیوان" /></section>
        <section className="lf-card"><h2>ورزش</h2><Bars data={d30.map(x => ({ label: jShort(x.d), v: x.e?.workoutMin || 0, color: '#34d399' }))} unit=" دقیقه" /></section>
      </div>
    </>}
  </Page>;
}

/* ───────────────────────── Car ───────────────────────── */
const LOG_T = [['fuel', '⛽ بنزین'], ['service', '🔧 سرویس'], ['repair', '🛠 تعمیر'], ['insurance', '📄 بیمه'], ['wash', '🧽 کارواش'], ['other', '• سایر']];
export function CarPage({ Nav }) {
  const cars = useCol('vehicles'), logs = useCol('carlogs');
  const [edit, setEdit] = useState(null), [logFor, setLogFor] = useState(null);
  const vFields = [{ k: 'name', l: 'نام خودرو', req: true, ph: 'مثلاً پژو ۲۰۶' }, { k: 'plate', l: 'پلاک', half: true }, { k: 'odometer', l: 'کیلومتر فعلی', t: 'num', half: true }, { k: 'insuranceUntil', l: 'پایان بیمه بدنه/ثالث', t: 'date', half: true }, { k: 'inspectionUntil', l: 'پایان معاینهٔ فنی', t: 'date', half: true }, { k: 'nextServiceDate', l: 'سرویس بعدی (تاریخ)', t: 'date', half: true }, { k: 'nextServiceKm', l: 'سرویس بعدی (کیلومتر)', t: 'num', half: true }, { k: 'note', l: 'یادداشت', t: 'area' }];
  const lFields = [{ k: 'type', l: 'نوع', t: 'sel', o: LOG_T, def: 'fuel', half: true }, { k: 'date', l: 'تاریخ', t: 'date', def: todayIso, half: true }, { k: 'amount', l: 'مبلغ (ریال)', t: 'money', half: true }, { k: 'liters', l: 'لیتر', t: 'num', half: true, hint: 'برای بنزین' }, { k: 'odometer', l: 'کیلومتر', t: 'num' }, { k: 'note', l: 'شرح', ph: 'مثلاً تعویض روغن و فیلتر' }];
  const saveLog = async b => { await logs.add({ ...b, vehicleId: logFor.id }); if (b.odometer && b.odometer > (logFor.odometer || 0)) await cars.patch(logFor.id, { odometer: b.odometer }); };
  return <Page Nav={Nav} kicker="هزینه و موعدها" title="خودرو" actions={<button className="lf-btn" onClick={() => setEdit({})}>＋ خودرو</button>}>
    {cars.items === null ? <p className="lf-empty">در حال دریافت…</p> : !cars.items.length ? <p className="lf-empty">هنوز خودرویی ثبت نکردی. بیمه، معاینهٔ فنی و سرویس را ثبت کن تا به‌موقع یادآوری شود.</p> :
      cars.items.map(v => {
        const my = (logs.items || []).filter(l => l.vehicleId === v.id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
        const mStart = addDays(todayIso(), -30), month = my.filter(l => l.date >= mStart).reduce((a, l) => a + (l.amount || 0), 0), year = my.filter(l => l.date >= addDays(todayIso(), -365)).reduce((a, l) => a + (l.amount || 0), 0);
        const fuel = my.filter(l => l.type === 'fuel' && l.liters && l.odometer).sort((a, b) => a.odometer - b.odometer);
        const cons = fuel.length >= 2 ? (fuel.slice(1).reduce((a, l) => a + l.liters, 0) / (fuel[fuel.length - 1].odometer - fuel[0].odometer)) * 100 : null;
        const kmLeft = v.nextServiceKm && v.odometer ? v.nextServiceKm - v.odometer : null;
        return <section key={v.id} className="lf-card lf-car">
          <div className="lf-row-head"><div><h2>🚗 {v.name}</h2><small>{[v.plate, v.odometer ? `${fa(v.odometer, 0)} کیلومتر` : ''].filter(Boolean).join(' · ')}</small></div>
            <div className="lf-ops"><button className="lf-btn" onClick={() => setLogFor(v)}>＋ ثبت هزینه</button><button className="lf-link" onClick={() => setEdit(v)}>ویرایش</button><button className="lf-link del" onClick={() => window.confirm(`«${v.name}» حذف شود؟`) && cars.remove(v.id)}>حذف</button></div></div>
          <div className="lf-chips">
            <span className="lf-chip">بیمه {v.insuranceUntil ? dueChip(v.insuranceUntil) : '—'}</span>
            <span className="lf-chip">معاینهٔ فنی {v.inspectionUntil ? dueChip(v.inspectionUntil) : '—'}</span>
            <span className="lf-chip">سرویس {v.nextServiceDate ? dueChip(v.nextServiceDate) : ''}{kmLeft != null ? <span className={`lf-due ${kmLeft < 0 ? 'late' : kmLeft < 1000 ? 'soon' : ''}`}>{kmLeft < 0 ? `${fa(-kmLeft, 0)} کیلومتر گذشته` : `${fa(kmLeft, 0)} کیلومتر مانده`}</span> : !v.nextServiceDate ? '—' : null}</span>
          </div>
          <div className="lf-kpis sm"><div><small>هزینهٔ ۳۰ روز</small><b>{money(month)}</b></div><div><small>هزینهٔ یک سال</small><b>{money(year)}</b></div><div><small>مصرف سوخت</small><b>{cons ? `${fa(cons)} لیتر` : '—'}</b><em>{cons ? 'در ۱۰۰ کیلومتر' : 'با ثبت لیتر و کیلومتر'}</em></div></div>
          {my.length ? <ul className="lf-list">{my.slice(0, 12).map(l => <li key={l.id}><span>{(LOG_T.find(t => t[0] === l.type) || LOG_T[5])[1]}</span><b>{l.note || ''}</b><small>{jShort(l.date)}{l.liters ? ` · ${fa(l.liters)} لیتر` : ''}{l.odometer ? ` · ${fa(l.odometer, 0)} km` : ''}</small><em>{l.amount ? money(l.amount) : ''}</em><button className="lf-x" onClick={() => logs.remove(l.id)} aria-label="حذف">×</button></li>)}</ul> : <p className="lf-empty">هنوز هزینه‌ای ثبت نشده.</p>}
        </section>;
      })}
    <FormDrawer open={!!edit} title={edit?.id ? 'ویرایش خودرو' : 'خودروی تازه'} fields={vFields} initial={edit} onClose={() => setEdit(null)} onSubmit={b => edit.id ? cars.patch(edit.id, b) : cars.add(b)} />
    <FormDrawer open={!!logFor} title={`ثبت برای ${logFor?.name || ''}`} fields={lFields} onClose={() => setLogFor(null)} onSubmit={saveLog} />
  </Page>;
}

/* ───────────────────────── Travel ───────────────────────── */
const TRIP_CHECK = ['گذرنامه / کارت ملی', 'بلیت', 'رزرو اقامت', 'شارژر و پاوربانک', 'دارو', 'لباس', 'پول نقد / کارت'];
export function TravelPage({ Nav }) {
  const trips = useCol('trips');
  const [edit, setEdit] = useState(null), [openId, setOpenId] = useState(null), [newItem, setNewItem] = useState(''), [exp, setExp] = useState({ t: '', a: '' });
  const fields = [{ k: 'title', l: 'عنوان سفر', req: true, ph: 'مثلاً شمال — عید' }, { k: 'dest', l: 'مقصد', half: true }, { k: 'budget', l: 'بودجه (ریال)', t: 'money', half: true }, { k: 'from', l: 'رفت', t: 'date', half: true }, { k: 'to', l: 'برگشت', t: 'date', half: true }, { k: 'notes', l: 'یادداشت', t: 'area', ph: 'رزروها، آدرس‌ها، شماره‌ها…' }];
  const list = (trips.items || []).slice().sort((a, b) => String(b.from || '').localeCompare(String(a.from || '')));
  const t = list.find(x => x.id === openId) || null;
  const upd = (b) => trips.patch(t.id, b);
  return <Page Nav={Nav} kicker="برنامه، بودجه و وسایل" title="سفرها" actions={<button className="lf-btn" onClick={() => setEdit({ checklist: TRIP_CHECK.map(text => ({ text, done: false })) })}>＋ سفر تازه</button>}>
    {trips.items === null ? <p className="lf-empty">در حال دریافت…</p> : !list.length ? <p className="lf-empty">هنوز سفری ثبت نکردی.</p> :
      <div className="lf-cards">{list.map(x => {
        const spent = (x.expenses || []).reduce((a, e) => a + (e.amount || 0), 0), done = (x.checklist || []).filter(c => c.done).length, d = x.from ? daysTo(x.from) : null;
        return <button key={x.id} className={`lf-card lf-trip ${openId === x.id ? 'on' : ''}`} onClick={() => setOpenId(openId === x.id ? null : x.id)}>
          <b>✈️ {x.title}</b><small>{[x.dest, x.from ? `${jShort(x.from)}${x.to ? ' تا ' + jShort(x.to) : ''}` : ''].filter(Boolean).join(' · ')}</small>
          <div className="lf-chips">{d != null && d >= 0 ? <span className="lf-due soon">{d === 0 ? 'امروز' : `${fa(d)} روز مانده`}</span> : d != null ? <span className="lf-due">انجام شده</span> : null}<span className="lf-chip">وسایل {fa(done)}/{fa((x.checklist || []).length)}</span>{x.budget ? <span className={`lf-chip ${spent > x.budget ? 'bad' : ''}`}>{money(spent)} از {money(x.budget)}</span> : null}</div>
        </button>;
      })}</div>}
    {t ? <section className="lf-card lf-trip-detail">
      <div className="lf-row-head"><h2>{t.title}</h2><div className="lf-ops"><button className="lf-link" onClick={() => setEdit(t)}>ویرایش</button><button className="lf-link del" onClick={() => { if (window.confirm('این سفر حذف شود؟')) { trips.remove(t.id); setOpenId(null); } }}>حذف</button></div></div>
      {t.notes ? <p className="lf-note">{t.notes}</p> : null}
      <div className="lf-grid2">
        <div><h3>🧳 لیست وسایل و مدارک</h3>
          <ul className="lf-check">{(t.checklist || []).map((c, i) => <li key={i} className={c.done ? 'done' : ''} onClick={() => upd({ checklist: t.checklist.map((y, j) => j === i ? { ...y, done: !y.done } : y) })}><i>{c.done ? '✓' : ''}</i><span>{c.text}</span><button className="lf-x" onClick={e => { e.stopPropagation(); upd({ checklist: t.checklist.filter((_, j) => j !== i) }); }}>×</button></li>)}</ul>
          <form className="lf-inline" onSubmit={e => { e.preventDefault(); if (!newItem.trim()) return; upd({ checklist: [...(t.checklist || []), { text: newItem.trim(), done: false }] }); setNewItem(''); }}><input value={newItem} onChange={e => setNewItem(e.target.value)} placeholder="افزودن به لیست…" /><button className="lf-btn">＋</button></form>
        </div>
        <div><h3>💸 هزینه‌های سفر</h3>
          <ul className="lf-list">{(t.expenses || []).map((e, i) => <li key={i}><b>{e.title}</b><small>{jShort(e.date)}</small><em>{money(e.amount)}</em><button className="lf-x" onClick={() => upd({ expenses: t.expenses.filter((_, j) => j !== i) })}>×</button></li>)}</ul>
          <form className="lf-inline" onSubmit={ev => { ev.preventDefault(); if (!exp.t.trim() || !num(exp.a)) return; upd({ expenses: [...(t.expenses || []), { title: exp.t.trim(), amount: num(exp.a), date: todayIso() }] }); setExp({ t: '', a: '' }); }}><input value={exp.t} onChange={e => setExp({ ...exp, t: e.target.value })} placeholder="شرح" /><input value={exp.a} onChange={e => setExp({ ...exp, a: e.target.value })} inputMode="numeric" placeholder="مبلغ" style={{ maxWidth: 150 }} /><button className="lf-btn">＋</button></form>
          <p className="lf-note">جمع: {money((t.expenses || []).reduce((a, e) => a + (e.amount || 0), 0))}{t.budget ? ` از بودجهٔ ${money(t.budget)}` : ''}</p>
        </div>
      </div>
    </section> : null}
    <FormDrawer open={!!edit} title={edit?.id ? 'ویرایش سفر' : 'سفر تازه'} fields={fields} initial={edit} onClose={() => setEdit(null)} onSubmit={async b => { if (edit.id) await trips.patch(edit.id, b); else { const r = await trips.add({ ...b, checklist: edit.checklist, expenses: [] }); setOpenId(r.id); } }} />
  </Page>;
}

/* ───────────────────────── Projects (kanban) ───────────────────────── */
const COLS_K = [['todo', 'انجام نشده'], ['doing', 'در حال انجام'], ['review', 'بازبینی'], ['done', 'انجام شد']];
const PCOLORS = ['#d8a44c', '#60a5fa', '#34d399', '#f472b6', '#a78bfa', '#fb923c'];
/* Project charts: status split, burn-up (created vs done), weekly throughput, forecast */
const KCOL = { todo: '#94a3b8', doing: '#60a5fa', review: '#fbbf24', done: '#34d399' };
const dayOf = ms => ms ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms)) : '';
function BurnUp({ cards, deadline, color }) {
  const today = todayIso();
  const first = cards.reduce((m, c) => { const d = dayOf(c.createdAt) || today; return d < m ? d : m; }, today);
  let start = first < addDays(today, -60) ? addDays(today, -60) : first; if (start === today) start = addDays(today, -6);
  const end = deadline && deadline > today && deadline <= addDays(today, 60) ? deadline : today;
  const days = []; for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const pts = days.map(d => ({ d, total: cards.filter(c => (dayOf(c.createdAt) || start) <= d).length, done: d > today ? null : cards.filter(c => c.col === 'done' && (dayOf(c.doneAt) || dayOf(c.updatedAt) || today) <= d).length }));
  const W = 600, H = 170, P = 22, max = Math.max(1, ...pts.map(p => p.total));
  const x = i => P + (i / Math.max(1, days.length - 1)) * (W - P * 2), y = v => H - P - (v / max) * (H - P * 2);
  const line = k => pts.map((p, i) => p[k] == null ? '' : `${i && pts[i - 1][k] != null ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p[k]).toFixed(1)}`).join(' ');
  const ti = days.indexOf(today);
  return <svg className="lf-chart lf-burn" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="نمودار پیشرفت">
    {[0, .5, 1].map(f => <line key={f} x1={P} x2={W - P} y1={y(max * f)} y2={y(max * f)} stroke="var(--g-border)" strokeDasharray="3 4" />)}
    <path d={`${line('done')} L${x(ti)} ${H - P} L${x(0)} ${H - P} Z`} fill={color} opacity=".14" />
    <path d={line('total')} fill="none" stroke="var(--g-muted)" strokeWidth="2" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
    <path d={line('done')} fill="none" stroke={color} strokeWidth="2.6" vectorEffect="non-scaling-stroke" />
    {ti < days.length - 1 ? <g><line x1={x(ti)} x2={x(ti)} y1={P} y2={H - P} stroke="var(--g-border-2)" /><line x1={x(days.length - 1)} x2={x(days.length - 1)} y1={P} y2={H - P} stroke="#fb7185" strokeDasharray="4 3" /></g> : null}
    <text x={P} y={H - 5} fontSize="11" fill="var(--g-muted)" textAnchor="start">{jShort(start)}</text>
    <text x={W - P} y={H - 5} fontSize="11" fill={ti < days.length - 1 ? '#fb7185' : 'var(--g-muted)'} textAnchor="end">{ti < days.length - 1 ? `مهلت ${jShort(end)}` : 'امروز'}</text>
    <text x={P} y={14} fontSize="11" fill="var(--g-muted)" textAnchor="start">{fa(max)} کارت</text>
  </svg>;
}
function ProjectStats({ project, cards }) {
  const today = todayIso(), n = cards.length;
  if (!n) return null;
  const by = k => cards.filter(c => (c.col || 'todo') === k).length;
  const done = by('done'), pct = Math.round(done / n * 100), open = n - done;
  const late = cards.filter(c => c.col !== 'done' && c.due && c.due < today).length;
  const hi = cards.filter(c => c.col !== 'done' && c.prio === 'h').length;
  const weeks = Array.from({ length: 8 }, (_, i) => { const to = addDays(today, -7 * (7 - i)), from = addDays(to, -6); const v = cards.filter(c => c.col === 'done' && c.doneAt && dayOf(c.doneAt) >= from && dayOf(c.doneAt) <= to).length; const j = isoToJ(to); return { label: `${jShort(from)} تا ${jShort(to)}`, short: i === 7 ? 'این هفته' : `${faD(j.jd)}/${faD(j.jm)}`, v }; });
  const pace = weeks.slice(-4).reduce((a, w) => a + w.v, 0) / 4;
  const eta = open && pace > 0 ? addDays(today, Math.ceil(open / pace * 7)) : null;
  const risk = eta && project.deadline && eta > project.deadline;
  return <div className="lf-pstats">
    <div className="lf-pgrid">
      <section className="lf-card"><h3>وضعیت کارت‌ها</h3>
        <div className="lf-stack">{COLS_K.map(([k]) => by(k) ? <i key={k} style={{ flex: by(k), background: KCOL[k] }} title={`${fa(by(k))}`} /> : null)}</div>
        <ul className="lf-legend">{COLS_K.map(([k, l]) => <li key={k}><i style={{ background: KCOL[k] }} />{l}<b>{fa(by(k))}</b><em>{fa(Math.round(by(k) / n * 100))}٪</em></li>)}</ul>
      </section>
      <section className="lf-card"><h3>روند انجام <small>— خط‌چین: کل کارت‌ها</small></h3><BurnUp cards={cards} deadline={project.deadline} color={project.color || PCOLORS[0]} /></section>
      <section className="lf-card"><h3>کارهای انجام‌شده در هفته</h3><Bars data={weeks} height={130} color={project.color || PCOLORS[0]} /></section>
    </div>
  </div>;
}
// pace of the last 4 weeks → estimated finish date
function projEta(cs, today) {
  const done = cs.filter(c => c.col === 'done'), open = cs.length - done.length;
  const pace = done.filter(c => c.doneAt && Date.now() - c.doneAt < 28 * 864e5).length / 4;
  return { pace, open, eta: open && pace > 0 ? addDays(today, Math.ceil(open / pace * 7)) : null };
}
function ProjectStrip({ list, cards, cur, onPick }) {
  if (!list.length) return null;
  const today = todayIso();
  const rows = list.map(p => { const cs = cards.filter(c => c.projectId === p.id), by = Object.fromEntries(COLS_K.map(([k]) => [k, cs.filter(c => (c.col || 'todo') === k).length])); return { p, n: cs.length, by, late: cs.filter(c => c.col !== 'done' && c.due && c.due < today).length }; })
    .sort((a, b) => (!a.n) - (!b.n) || String(a.p.deadline || '9999').localeCompare(String(b.p.deadline || '9999')) || b.n - a.n);
  return <div className="lf-pstrip" role="tablist">{rows.map(({ p, n, by, late }) => { const c = p.color || PCOLORS[0], pct = n ? Math.round(by.done / n * 100) : 0, on = cur === p.id;
    return <button key={p.id} role="tab" aria-selected={on} className={`lf-pchip ${on ? 'on' : ''} ${n ? '' : 'empty'} ${lightHex(c) ? 'light' : ''}`} style={{ '--pc': c }} onClick={() => onPick(p.id)}>
      {on ? <span className="ok">✓</span> : null}
      <b>{p.name}</b>
      <span className="bar">{n ? COLS_K.map(([k]) => by[k] ? <i key={k} style={{ flex: by[k], background: KCOL[k] }} /> : null) : null}</span>
      <small>{n ? `${fa(by.done)} از ${fa(n)} · ${fa(pct)}٪${late ? ` · ${fa(late)} عقب` : ''}` : 'هنوز کارتی ندارد'}</small>
    </button>; })}</div>;
}
const lightHex = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return false; const n = parseInt(m[1], 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.62; };
// "ارسال نقشه‌ها ! @علی ۱۵ مهر" → title + high priority + owner + due date
function parseQuick(text) {
  let t = ' ' + String(text || '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)) + ' ', prio = null, owner = '', due = '';
  if (/[!！]/.test(t)) { prio = 'h'; t = t.replace(/[!！]+/g, ' '); }
  const at = t.match(/\s@([^\s@!]+)/); if (at) { owner = at[1].replace(/_/g, ' '); t = t.replace(at[0], ' '); }
  const today = todayIso();
  const rel = [[/\s(پس[‌\s]?فردا)(?=\s)/, 2], [/\s(فردا)(?=\s)/, 1], [/\s(امروز)(?=\s)/, 0]];
  for (const [re, n] of rel) { const m = t.match(re); if (m) { due = addDays(today, n); t = t.replace(m[0], ' '); break; } }
  if (!due) { const re = new RegExp('\\s(\\d{1,2})\\s*(' + MONTHS.join('|') + ')(?=\\s)'); const m = t.match(re); if (m) { const d = Number(m[1]), mi = MONTHS.indexOf(m[2]) + 1, j = isoToJ(today); if (d >= 1 && d <= 31) { let iso = jToIso(j.jy, mi, d); if (iso < today) iso = jToIso(j.jy + 1, mi, d); due = iso; t = t.replace(m[0], ' '); } } }
  return { title: t.replace(/\s+/g, ' ').trim(), prio, owner, due };
}
const PNAMES = ['طلایی', 'آبی', 'سبز', 'صورتی', 'بنفش', 'نارنجی'];

const PROJECT_FILE_TABS = [['overview', 'اطلاعات پروژه و قرارداد'], ['finance', 'اطلاعات مالی'], ['supply', 'مراحل اجرایی'], ['report', 'گزارش']];
// Checklist = fixed project stages + the per-item stages repeated for every contract item (پنجره، کرتن‌وال، …).
// A per-item stage's title is `${base} — ${item}`; with no item chosen yet one generic copy (no suffix) is shown.
const FIXED_STAGES = [
  ['کنترل پروژه', 'ابلاغ قرارداد'],
  ['کنترل پروژه', 'تأیید رنگ از کارفرما'],
  ['کنترل پروژه', 'سفارش بیلت'],
  ['کنترل پروژه', 'سفارش یراق‌آلات']
];
const ITEM_STAGES = [
  ['کنترل پروژه', 'فرم ابعادبرداری برآوردی'],
  ['اجرا', 'ابعادبرداری برآوردی'],
  ['فنی', 'تهیه جزئیات برآورد جهت تأیید به کارفرما'],
  ['کنترل پروژه', 'دریافت تأیید جزئیات برآورد از کارفرما'],
  ['فنی', 'ارسال جزئیات برآورد به کارخانه'],
  ['کنترل پروژه', 'فرم ابعادبرداری دقیق'],
  ['اجرا', 'ابعادبرداری دقیق'],
  ['فنی', 'تهیه نقشهٔ جزئیات ساخت'],
  ['کنترل پروژه', 'دریافت تأیید نقشهٔ جزئیات ساخت از کارفرما'],
  ['فنی', 'ارسال جزئیات ساخت به کارخانه'],
  ['فنی', 'تهیه لیست شیشه'],
  ['تأمین', 'سفارش شیشه'],
  ['تأمین', 'ارسال به پروژه'],
  ['اجرا', 'شروع نصب'],
  ['اجرا', 'پایان نصب']
];
const FINAL_STAGES = [['اجرا', 'تحویل پروژه']];
// extra stages only some items have, inserted after the given base stage
// yes/no options some items carry (shown in the item's header in the checklist and in the PDF)
export const ITEM_OPTIONS = { 'پنجره': [['rokoob', 'روکوب'], ['reinforce', 'رین‌فورس']] };
const optionsKey = item => Object.keys(ITEM_OPTIONS).find(k => normItem(k) === normItem(item));
// «روکوب: دارد · رین‌فورس: ندارد» for items that have options, '' otherwise (used by both reports)
export const itemOptionsText = (contract, item) => { const k = optionsKey(item); return k ? ITEM_OPTIONS[k].map(([key, label]) => { const v = itemOption(contract, item, key); return `${label}: ${v === true ? 'دارد' : v === false ? 'ندارد' : 'نامشخص'}`; }).join(' · ') : ''; };
export const itemOption = (contract, item, key) => { const k = optionsKey(item), o = contract?.itemOptions || {}; const v = (o[item] ?? (k ? o[k] : undefined))?.[key]; return v === false ? false : v === true ? true : null; };
export const PROCESS_DEPARTMENTS = ['کنترل پروژه', 'فنی', 'تأمین', 'اجرا'];
const CONTRACT_ITEMS = ['پنجره', 'کرتن‌وال', 'هندریل', 'اسکای‌فورس', 'توری', 'درب پیووت', 'لوور'];
const normItem = x => String(x || '').replace(/[\s‌]+/g, '').replace(/کرتن/g, 'کرتین');
const ITEM_SEP = ' — ';
// contract → { picked: chosen standard items, other: free text } (falls back to parsing the old free-text subject)
const splitItems = v => String(v || '').split(/[،,\n]+/).map(x => x.trim()).filter(Boolean);
// standard items first (menu order), then custom ones in the order they were added; duplicates dropped
const orderItems = list => { const std = CONTRACT_ITEMS.filter(i => list.some(x => normItem(x) === normItem(i))), out = [...std]; for (const x of list) if (!out.some(y => normItem(y) === normItem(x))) out.push(x); return out; };
// contract → its facade items: `items` (standard + custom) plus the older free-text `itemsOther`, or the old free-text subject
export function contractScope(contract) {
  if (Array.isArray(contract?.items)) return orderItems([...contract.items, ...splitItems(contract.itemsOther)]);
  return orderItems(splitItems(contract?.subject).map(x => x.replace(/^سایر( اقلام نما)?\s*:\s*/, '')));
}
export function processTemplate(contract) {
  const items = contractScope(contract);
  const out = FIXED_STAGES.map(([department, title]) => ({ department, title, base: title, item: '', group: 'start' }));
  for (const item of items.length ? items : ['']) for (const [department, base] of ITEM_STAGES) out.push({ department, base, item, group: `item:${item}`, title: item ? `${base}${ITEM_SEP}${item}` : base });
  for (const [department, title] of FINAL_STAGES) out.push({ department, title, base: title, item: '', group: 'end' });
  return out.map((s, order) => ({ ...s, order }));
}
// Weighted progress. Each contract item is its own 0–100 (inside it: control 10, technical 15, supply 30,
// execution 45; execution stages weighted by EXEC_BASE). The project = fixed stages (FIXED_WEIGHT, in %) +
// the items, each item's share proportional to its contract area (items with no area count as the average;
// no areas at all → equal shares).
const DEPT_WEIGHT = { 'کنترل پروژه': 10, 'فنی': 15, 'تأمین': 30, 'اجرا': 45 };
const EXEC_BASE = { 'ابعادبرداری برآوردی': 1, 'ابعادبرداری دقیق': 2, 'شروع نصب': 3, 'پایان نصب': 12 };
const FIXED_WEIGHT = { 'ابلاغ قرارداد': 1, 'تأیید رنگ از کارفرما': 1, 'سفارش بیلت': 1, 'سفارش یراق‌آلات': 1, 'تحویل پروژه': 2 };
const baseOf = s => s.base || String(s.title || '').split(ITEM_SEP)[0];
const itemOfStage = s => s.item ?? (String(s.title || '').split(ITEM_SEP)[1] || '');
const isFixedStage = s => !itemOfStage(s) && FIXED_WEIGHT[baseOf(s)] != null;
const baseWeight = s => s.department === 'اجرا' ? (EXEC_BASE[baseOf(s)] || 1) : 1;
// shares of the project (0–1) per item, from contract areas
export function itemShares(items, areas) {
  const a = items.map(i => (i ? itemArea(areas, i) : 0));
  const known = a.filter(x => x > 0), avg = known.length ? known.reduce((x, y) => x + y, 0) / known.length : 1;
  const w = a.map(x => x > 0 ? x : avg), total = w.reduce((x, y) => x + y, 0) || 1;
  return Object.fromEntries(items.map((i, k) => [i, w[k] / total]));
}
function withWeights(stages, areas) {
  const itemStages = stages.filter(s => !isFixedStage(s));
  const items = [...new Set(itemStages.map(itemOfStage))];
  const sum = {}; // per item, per department
  for (const s of itemStages) { const k = `${itemOfStage(s)}|${s.department}`; sum[k] = (sum[k] || 0) + baseWeight(s); }
  const inner = s => (DEPT_WEIGHT[s.department] || 0) * baseWeight(s) / (sum[`${itemOfStage(s)}|${s.department}`] || 1);
  const innerTotal = {}; for (const s of itemStages) innerTotal[itemOfStage(s)] = (innerTotal[itemOfStage(s)] || 0) + inner(s);
  const shares = itemShares(items, areas);
  const fixedTotal = stages.filter(isFixedStage).reduce((t, s) => t + FIXED_WEIGHT[baseOf(s)], 0), itemsTotal = items.length ? 100 - fixedTotal : 0;
  const scale = items.length ? 1 : 100 / (fixedTotal || 1);
  return stages.map(s => {
    if (isFixedStage(s)) return { ...s, weight: FIXED_WEIGHT[baseOf(s)] * scale, itemWeight: null };
    const iw = inner(s) / (innerTotal[itemOfStage(s)] || 1) * 100; // weight inside its item (item sums to 100)
    return { ...s, itemWeight: iw, weight: shares[itemOfStage(s)] * itemsTotal * iw / 100 };
  });
}
// 0–100 for one contract item on its own
export function itemProgress(stages, item, department) {
  const list = (stages || []).some(s => s.weight == null) ? withWeights(stages || []) : (stages || []);
  let total = 0, got = 0;
  for (const s of list) { if (isFixedStage(s) || normItem(itemOfStage(s)) !== normItem(item) || (department && s.department !== department)) continue; total += s.itemWeight; got += s.itemWeight * stageCredit(s); }
  if (!total) return 0;
  const pct = got / total * 100;
  return pct >= 99.999 ? 100 : Math.min(99, Math.round(pct));
}
// Old fixed-checklist rows (before per-item stages) → new stage; `items` limits which contract items inherit it ('' = generic copy).
const OLD_ITEMS = ['', 'پنجره', 'کرتن‌وال'];
const LEGACY_STAGES = [
  ['تأمین|سفارش بیلت بر اساس قرارداد', 'سفارش بیلت'], ['کنترل پروژه|سفارش بیلت بر اساس قرارداد', 'سفارش بیلت'],
  ['تأمین|سفارش یراق‌آلات بر اساس قرارداد', 'سفارش یراق‌آلات'], ['کنترل پروژه|سفارش یراق‌آلات بر اساس قرارداد', 'سفارش یراق‌آلات'],
  ['کنترل پروژه|فرم ابعادبرداری برآوردی', 'فرم ابعادبرداری برآوردی', OLD_ITEMS],
  ['کنترل پروژه|فرم ابعادبرداری دقیق', 'فرم ابعادبرداری دقیق', OLD_ITEMS],
  ['اجرا|ابعادبرداری دقیق', 'ابعادبرداری دقیق', OLD_ITEMS],
  ['کنترل پروژه|ارسال تیپ‌بندی پنجره بر اساس قرارداد به کارفرما جهت تأیید', 'تهیه جزئیات برآورد جهت تأیید به کارفرما', ['پنجره']],
  ['کنترل پروژه|دریافت تأیید برآورد پنجره از کارفرما', 'دریافت تأیید جزئیات برآورد از کارفرما', ['پنجره']],
  ['فنی|ارسال جزئیات برآورد پنجره جهت تأمین به کارخانه', 'ارسال جزئیات برآورد به کارخانه', ['پنجره']],
  ['کنترل پروژه|ارسال تیپ‌بندی کرتین‌وال بر اساس قرارداد به کارفرما جهت تأیید', 'تهیه جزئیات برآورد جهت تأیید به کارفرما', ['کرتن‌وال']],
  ['کنترل پروژه|دریافت تأیید برآورد کرتین‌وال از کارفرما', 'دریافت تأیید جزئیات برآورد از کارفرما', ['کرتن‌وال']],
  ['فنی|ارسال جزئیات برآورد کرتین‌وال جهت تأمین به کارخانه', 'ارسال جزئیات برآورد به کارخانه', ['کرتن‌وال']],
  ['فنی|تهیه نقشهٔ جزئیات ساخت دقیق', 'تهیه نقشهٔ جزئیات ساخت', OLD_ITEMS],
  ['کنترل پروژه|دریافت تأیید نقشهٔ جزئیات ساخت از کارفرما', 'دریافت تأیید نقشهٔ جزئیات ساخت از کارفرما', OLD_ITEMS],
  ['فنی|ارسال جزئیات ساخت دقیق به کارخانه', 'ارسال جزئیات ساخت به کارخانه', OLD_ITEMS],
  ['فنی|تهیه لیست ابعاد شیشه', 'تهیه لیست شیشه', OLD_ITEMS],
  ['تأمین|عقد قرارداد شیشه', 'سفارش شیشه', OLD_ITEMS],
  ['تأمین|ارسال پنجره به پروژه', 'ارسال به پروژه', ['پنجره']], ['تأمین|ارسال کرتین‌وال به پروژه', 'ارسال به پروژه', ['کرتن‌وال']],
  ['اجرا|شروع نصب پنجره', 'شروع نصب', ['پنجره']], ['اجرا|شروع نصب کرتین‌وال', 'شروع نصب', ['کرتن‌وال']],
  ['اجرا|اتمام نصب پنجره', 'پایان نصب', ['پنجره']], ['اجرا|اتمام نصب کرتین‌وال', 'پایان نصب', ['کرتن‌وال']]
];
const LEGACY_FIELDS = ['status', 'date', 'owner', 'note', 'percent', 'reminderDate'];
// fields a new stage row inherits from an older row (only fields with data), or {}:
// first the generic copy shown before any item was chosen, then the old fixed-checklist row it replaced
const carryOf = old => { const c = {}; if (old) for (const f of LEGACY_FIELDS) if (old[f] != null && old[f] !== '') c[f] = old[f]; return Object.keys(c).length ? c : null; };
function legacyCarry(stage, byKey) {
  if (stage.item) { const c = carryOf(byKey.get(keyOf(stage.department, stage.base))); if (c) return c; }
  for (const [oldKey, base, items] of LEGACY_STAGES) {
    if (base !== stage.base || (items ? !items.includes(stage.item) : stage.item)) continue;
    const c = carryOf(byKey.get(keyOf(...oldKey.split('|')))); if (c) return c;
  }
  return {};
}
// Ticking «تحویل پروژه» finishes the project even if earlier rows were skipped.
export const isDelivered = stages => (stages || []).some(x => x.department === 'اجرا' && x.title === 'تحویل پروژه' && x.status === 'done');
const keyOf = (department, title) => `${department}|${normItem(title)}`;
const stageKey = s => keyOf(s.department, s.title);
// the project's current checklist with stored rows merged in (old rows outside the template stay stored but hidden)
export function projectStages(contract, rows) {
  const byKey = new Map((rows || []).map(x => [stageKey(x), x]));
  return withWeights(processTemplate(contract).map(t => { const row = byKey.get(stageKey(t)); return row ? { ...row, department: t.department, title: t.title, base: t.base, item: t.item, group: t.group, order: t.order } : { ...t, status: 'todo', ...legacyCarry(t, byKey), carried: true }; }), contract?.itemAreas);
}
function ContractTimeline({ contract }) {
  const start = contract?.contractStartDate || '';
  const end = contract?.contractEndDate || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return <div className="lf-contract-timeline empty"><b>زمان قرارداد</b><span>تاریخ شروع و اتمام قرارداد را وارد کنید</span></div>;
  const today = todayIso(), total = Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 864e5)), elapsed = Math.round((Date.parse(today) - Date.parse(start)) / 864e5), remaining = Math.round((Date.parse(end) - Date.parse(today)) / 864e5), overdue = remaining < 0, pct = Math.max(0, Math.min(100, Math.round(elapsed / total * 100)));
  return <div className={`lf-contract-timeline ${overdue ? 'overdue' : ''}`}><div><b>زمان قرارداد</b><strong>{fa(pct)}٪</strong><span>{overdue ? `${fa(-remaining)} روز از اتمام گذشته` : remaining === 0 ? 'امروز آخرین روز قرارداد است' : `${fa(remaining)} روز تا اتمام قرارداد`}</span></div><div className="lf-contract-timeline-bar"><i style={{ width: `${pct}%` }} /></div><small>{jShort(start)} تا {jShort(end)}</small></div>;
}
export const isInstallStage = s => s?.department === 'اجرا' && baseOf(s) === 'پایان نصب';
export const stageWeight = (s, stages) => s?.weight ?? (withWeights(stages || [s]).find(x => stageKey(x) === stageKey(s))?.weight || 0);
export const stageCredit = s => s?.status === 'done' ? 1 : s && isInstallStage(s) ? Math.max(0, Math.min(100, Number(s.percent) || 0)) / 100 : 0;
// 0–100 for the whole project, or for one department; only a fully finished scope reads 100.
// `stages` is a full checklist from projectStages().
export function weightedProgress(stages, department) {
  const list = (stages || []).some(s => s.weight == null) ? withWeights(stages || []) : (stages || []);
  let total = 0, got = 0;
  for (const s of list) { if (department && s.department !== department) continue; total += s.weight; got += s.weight * stageCredit(s); }
  if (!total) return 0;
  const pct = got / total * 100;
  return pct >= 99.999 ? 100 : Math.min(99, Math.round(pct));
}
// پنل پیشرفت آیتم‌ها: نوار سهم (عرض هر بخش = سهم آیتم از پروژه، پرشدگی = پیشرفت آن آیتم) + کارت حلقه‌ای
// برای هر آیتم با ریز پیشرفت چهار واحد
const DEPT_SHORT = { 'کنترل پروژه': 'کنترل', 'فنی': 'فنی', 'تأمین': 'تأمین', 'اجرا': 'اجرا' };
export function ItemsPanel({ items, stages, shares, onPick }) {
  const data = items.map(it => { const mine = stages.filter(x => x.item === it); return { it, pct: itemProgress(stages, it), share: shares[it] || 0, done: mine.filter(x => x.status === 'done').length, total: mine.length, depts: PROCESS_DEPARTMENTS.map(d => [d, mine.some(x => x.department === d) ? itemProgress(stages, it, d) : null]) }; });
  return <section className="lf-items-panel" aria-label="پیشرفت آیتم‌ها">
    <header><b>پیشرفت آیتم‌ها</b><small>عرض هر بخش = سهم از پروژه (بر اساس متراژ) · پرشدگی = پیشرفت</small></header>
    <div className="lf-share-bar">{data.map((x, i) => <button type="button" key={x.it} style={{ flex: Math.max(x.share, 0.02), '--c': ITEM_COLORS[i % ITEM_COLORS.length] }} onClick={() => onPick?.(x.it)} title={`${x.it} · سهم ${fa(Math.round(x.share * 100))}٪ · پیشرفت ${fa(x.pct)}٪`}><i style={{ width: `${x.pct}%` }} />{x.share >= 0.09 ? <span>{x.it}</span> : null}</button>)}</div>
    <div className="lf-share-legend">{data.map((x, i) => <button type="button" key={x.it} style={{ '--c': ITEM_COLORS[i % ITEM_COLORS.length] }} onClick={() => onPick?.(x.it)}><i />{x.it}<em>{fa(Math.round(x.share * 100))}٪</em></button>)}</div>
    <div className="lf-item-cards">{data.map((x, i) => <button type="button" key={x.it} className={`lf-item-card ${x.pct === 100 ? 'complete' : ''}`} style={{ '--c': x.pct === 100 ? '#34d399' : ITEM_COLORS[i % ITEM_COLORS.length], '--p': x.pct }} onClick={() => onPick?.(x.it)}>
      <span className="lf-ring"><strong>{fa(x.pct)}٪</strong></span>
      <span className="lf-item-card-body"><b>{x.it}{x.pct === 100 ? <em>تمام شد</em> : null}</b><small>سهم {fa(Math.round(x.share * 100))}٪ · {fa(x.done)} از {fa(x.total)} مرحله</small>
        <span className="lf-item-depts">{x.depts.filter(([, v]) => v != null).map(([d, v]) => <span key={d} className={`dept-${d.replaceAll(' ', '-')}`} title={`${d}: ${fa(v)}٪`}><i><em style={{ width: `${v}%` }} /></i><small>{DEPT_SHORT[d]}</small></span>)}</span>
      </span>
    </button>)}</div>
  </section>;
}
const ITEM_COLORS = ['#60a5fa', '#f472b6', '#f5c36a', '#a78bfa', '#2dd4bf', '#fb923c', '#a3e635', '#38bdf8'];
const GROUP_TITLES = { start: 'مراحل عمومی پروژه', 'item:': 'مراحل اجرایی', end: 'تحویل پروژه' };
function StageGroupHead({ title, rows }) {
  const done = rows.filter(x => x.status === 'done').length, all = rows.length;
  return <div className={`lf-process-group fixed ${all && done === all ? 'done' : ''}`}><b>{title}{all && done === all ? ' ✓' : ''}</b><small>{fa(done)} از {fa(all)} مرحله</small></div>;
}
// سرتیتر هر آیتم: پیشرفت مستقل آیتم (۰–۱۰۰) + سهمش از کل پروژه (بر اساس متراژ)
function ItemGroupHead({ item, stages, share, anchor, contract, onPatchContract }) {
  const mine = stages.filter(x => x.item === item), pct = itemProgress(stages, item);
  return <div id={anchor} className={`lf-process-group ${pct === 100 ? 'done' : ''}`}>
    <b>{item}{pct === 100 ? ' ✓ تمام شد' : ''}</b>
    <ItemOptionToggles contract={contract} item={item} onChange={onPatchContract} />
    <i className="lf-process-group-bar"><em style={{ width: `${pct}%` }} /></i>
    <small><strong>{fa(pct)}٪</strong> · {fa(mine.filter(x => x.status === 'done').length)} از {fa(mine.length)} مرحله · سهم از پروژه {fa(Math.round((share || 0) * 100))}٪</small>
  </div>;
}
function ProcessChecklist({ projectId, items, contract, onPatchContract, onToggle, onPatch, onAdd, onSeed, onCompletionChange }) {
  const [departmentFilter, setDepartmentFilter] = useState('');
  // Rows that exist are shown straight from useCol (its optimistic patch is the single source of truth).
  // Stages not stored yet (virtual `template-N` rows) keep their in-flight edits here, keyed by stage, so a
  // re-render or a concurrent seeding reply can never flash the tick off and on again.
  const [pending, setPending] = useState({});
  const creating = useRef({});
  useEffect(() => { setPending({}); creating.current = {}; }, [projectId]);
  const tpl = useMemo(() => processTemplate(contract), [contract]);
  // once a stored row carries every pending field (and no create for it is still in flight — a seeding
  // reply can match by accident before the create's own reply lands), the overlay is no longer needed
  useEffect(() => {
    if (!Object.keys(pending).length) return;
    const byKey = new Map((items || []).map(x => [stageKey(x), x]));
    const left = Object.fromEntries(Object.entries(pending).filter(([k, p]) => { const row = byKey.get(k); return creating.current[k] || !row || Object.entries(p).some(([f, v]) => row[f] !== v); }));
    if (Object.keys(left).length !== Object.keys(pending).length) setPending(left);
  }, [items, pending]);
  // Older checklist rows (and rows of items removed from the contract) stay stored but are not shown.
  const visibleItems = projectStages(contract, items).map(x => { const p = pending[stageKey(x)]; const y = p ? { ...x, ...p } : x; return y.id ? y : { ...y, id: `template-${y.order}`, projectId }; });
  const createStage = (item, body) => {
    const k = stageKey(item);
    setPending(ps => ({ ...ps, [k]: { ...(ps[k] || {}), ...body } }));
    if (creating.current[k]) return creating.current[k].then(r => r && onPatch(r.id, body).then(() => r));
    // a virtual row may show data carried over from an older/generic row: store it with the first edit
    const job = Promise.resolve(onAdd({ projectId: item.projectId, department: item.department, title: item.title, order: item.order, status: item.status || 'todo', ...(item.carried ? carryOf(item) : null), ...body }))
      .then(r => r, error => { setPending(ps => { const { [k]: _, ...rest } = ps; return rest; }); throw error; })
      .finally(() => { delete creating.current[k]; setPending(ps => ({ ...ps })); });
    creating.current[k] = job.catch(() => null);
    return job;
  };
  const patch = async (id, body) => {
    const item = visibleItems.find(x => x.id === id);
    const isNew = String(id).startsWith('template-');
    if (!isNew && item) { const k = stageKey(item); setPending(ps => ps[k] ? { ...ps, [k]: { ...ps[k], ...body } } : ps); }
    const saved = isNew ? (item ? createStage(item, body) : undefined) : Promise.resolve(onPatch(id, body));
    // The fixed checklist is the source of truth for project completion.
    // Wait for the stage write before changing the project's status; otherwise
    // the two old JSON snapshots can race and restore the unchecked stage.
    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      const after = visibleItems.map(x => x.id === id ? { ...x, ...body } : x);
      const nextDone = after.filter(x => x.status === 'done').length;
      try {
        const result = saved ? await saved : undefined;
        if (result !== undefined) await onCompletionChange?.(nextDone === tpl.length || isDelivered(after));
      } catch { /* useCol reloads the row after a failed optimistic write */ }
    }
    return saved;
  };
  const save = (item, key, value) => { if (value !== (item[key] || '')) patch(item.id, { [key]: value }); };
  // no contract item picked yet: the generic per-item stages would be renamed (and hidden) as soon as one is
  // picked, so they are not offered at all — unless older data already sits on them
  const generic = visibleItems.filter(x => x.group === 'item:');
  const needItems = generic.length > 0 && !generic.some(x => x.status === 'done' || x.date || x.owner || x.note || x.reminderDate || Number(x.percent) > 0);
  // counters follow what is on screen (hidden generic stages are not counted)
  const shown = needItems ? visibleItems.filter(x => x.group !== 'item:') : visibleItems;
  const done = shown.filter(x => x.status === 'done').length;
  const ordered = visibleItems.slice().sort((a, b) => a.order - b.order).filter(item => (!departmentFilter || item.department === departmentFilter) && !(needItems && item.group === 'item:'));
  const deptClass = department => `dept-${String(department).replaceAll(' ', '-')}`;
  const depts = PROCESS_DEPARTMENTS.map(department => { const all = shown.filter(x => x.department === department), complete = all.filter(x => x.status === 'done').length; return { department, total: all.length, complete, pct: all.length ? weightedProgress(visibleItems, department) : 0 }; });
  const pct = weightedProgress(visibleItems);
  const scopeItems = [...new Set(visibleItems.filter(x => x.item).map(x => x.item))];
  const shares = itemShares(scopeItems, contract?.itemAreas);
  const row = (item, index) => {
    const number = item.order + 1;
    return <article key={item.id} className={`lf-process-row ${deptClass(item.department)} ${item.status === 'done' ? 'done' : ''}`}>
      <div className="lf-process-row-head">
        <button type="button" className="lf-process-check" onClick={() => patch(item.id, { status: item.status === 'done' ? 'todo' : 'done' })} aria-label={item.status === 'done' ? `برگرداندن ${item.title}` : `انجام ${item.title}`}>{item.status === 'done' ? '✓' : ''}</button>
        <span className="lf-process-no">{fa(number)}</span>
        <b className="lf-process-title" title={item.title}>{isInstallStage(item) && item.status !== 'done' ? <label className="lf-process-pct" title="درصد نصب انجام‌شده"><input type="number" min="0" max="100" inputMode="numeric" defaultValue={item.percent || ''} placeholder="۰" onBlur={e => { const v = Math.max(0, Math.min(100, Math.round(num(e.target.value)))); if (v >= 100) patch(item.id, { percent: 100, status: 'done' }); else if (v !== (Number(item.percent) || 0)) patch(item.id, { percent: v }); }} /><span>٪ نصب</span></label> : null}{item.title}</b>
        <span className={`lf-process-dept ${deptClass(item.department)}`} title="وزن این مرحله در پیشرفت کل">{item.department} <em className="lf-process-w">{fa(stageWeight(item), 1)}٪</em></span>
      </div>
      <div className="lf-process-row-fields">
        <label className="lf-process-field lf-process-reminder-field"><span className="lf-process-field-label">یادآوری</span><JalaliDateInput className="lf-process-reminder" value={item.reminderDate || ''} onChange={value => save(item, 'reminderDate', value)} placeholder="یادآوری" /></label>
        <label className="lf-process-field lf-process-date-field"><span className="lf-process-field-label">تاریخ انجام</span><JalaliDateInput className="lf-process-date" value={item.date || ''} onChange={value => save(item, 'date', value)} placeholder="تاریخ انجام" /></label>
        <label className="lf-process-field lf-process-owner-field"><span className="lf-process-field-label">مسئول</span><input className="lf-process-owner" defaultValue={item.owner || ''} placeholder="نام مسئول" onBlur={e => save(item, 'owner', e.target.value.trim())} /></label>
        <label className="lf-process-field lf-process-note-field"><span className="lf-process-field-label">توضیحات</span><textarea id={`note-${item.id}`} className="lf-process-note" rows={1} defaultValue={item.note || ''} placeholder="توضیحات مرحله" onBlur={e => save(item, 'note', e.target.value.trim())} /></label>
      </div>
    </article>;
  };
  return <div className="lf-processes"><section>
    <h4>مراحل پروژه<em>{fa(done)} از {fa(shown.length)} انجام</em></h4>
    <div className="lf-process-metrics">
      <div className="lf-process-dept-stats lf-process-departments" aria-label="فیلتر مراحل بر اساس واحد">{depts.map(x => <button type="button" key={x.department} className={`${deptClass(x.department)} ${departmentFilter === x.department ? 'on' : ''}`} onClick={() => setDepartmentFilter(current => current === x.department ? '' : x.department)} aria-pressed={departmentFilter === x.department} title={departmentFilter === x.department ? 'نمایش همهٔ مراحل' : `فقط مراحل ${x.department}`}><span><b>{x.department}</b><small>{fa(x.complete)} از {fa(x.total)}</small></span><i><em style={{ width: `${x.pct}%` }} /></i><small>{fa(x.pct)}٪ تکمیل</small></button>)}</div>
      <div className="lf-process-summary"><ContractTimeline contract={contract} /><div className="lf-process-progress">
        <div className="lf-process-progress-top"><b>پیشرفت کل پروژه</b><strong>{fa(pct)}٪</strong><span>{fa(done)} از {fa(shown.length)} مرحله</span></div>
        <div className="lf-process-progress-bar"><i style={{ width: `${pct}%` }} /></div>
      </div></div>
    </div>
    {scopeItems.length ? <ItemsPanel items={scopeItems} stages={visibleItems} shares={shares} onPick={it => document.getElementById(`pg-${projectId}-${it}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} /> : null}
    {needItems ? <div className="lf-process-need-items" role="note"><b>اول آیتم‌های قرارداد را انتخاب کن</b><span>مراحل اجرایی برای هر آیتم (پنجره، کرتن‌وال، …) جدا ساخته می‌شوند. آیتم‌ها را در تب «اطلاعات پروژه و قرارداد» انتخاب کن.</span></div> : null}
    {departmentFilter ? <div className="lf-process-filter-note"><b>فیلتر: {departmentFilter}</b><button type="button" onClick={() => setDepartmentFilter('')}>نمایش همه ×</button></div> : null}
    {ordered.map((item, i) => item.group && item.group !== ordered[i - 1]?.group ? [
      item.item ? <ItemGroupHead key={`g-${item.group}`} anchor={`pg-${projectId}-${item.item}`} contract={contract} onPatchContract={onPatchContract} item={item.item} stages={visibleItems} share={shares[item.item]} /> : <StageGroupHead key={`g-${item.group}`} title={GROUP_TITLES[item.group] || GROUP_TITLES['item:']} rows={visibleItems.filter(x => x.group === item.group)} />,
      <div key={`c-${item.group}`} className="lf-process-cols"><span>انجام</span><span>ردیف</span><span>یادآوری</span><span>واحد</span><span>مراحل پروژه</span><span>تاریخ</span><span>مسئول</span><span>توضیحات</span></div>,
      row(item, i)] : row(item, i))}
  </section></div>;
}
function ContractFinancials({ contract, onPatch, onAddStatement }) {
  const save = (key, value) => { const next = { ...(contract || {}), [key]: num(value) }; next.remainingAmount = Math.max(0, num(next.amount) - num(next.advancePayment)); onPatch(next); };
  return <section className="lf-contract-financials"><header className="lf-contract-financials-head"><h4>اطلاعات مالی قرارداد</h4><button type="button" className="lf-btn ghost" onClick={onAddStatement}>＋ صورت‌وضعیت</button></header><div><label><span>مبلغ کل قرارداد</span><input defaultValue={contract?.amount || ''} inputMode="numeric" onBlur={e => save('amount', e.target.value)} /></label><label><span>مبلغ پیش‌پرداخت</span><input defaultValue={contract?.advancePayment || ''} inputMode="numeric" onBlur={e => save('advancePayment', e.target.value)} /></label><label><span>مانده از قرارداد (مبلغ کل − پیش‌پرداخت)</span><output>{fa(contract?.remainingAmount ?? Math.max(0, num(contract?.amount) - num(contract?.advancePayment)), 0)} ریال</output></label></div></section>;
}
export const nextStatementNo = rows => Math.max(0, ...(rows || []).map(r => Number(r.statementNo) || 0)) + 1;
// Statement amounts are entered cumulatively (each one = total work to date), payments are individual deposits.
// So: total billed = the latest statement's amount; remaining = that − all payments; per statement,
// remaining = its amount − payments up to and including it.
export function statementLedger(rows) {
  const sorted = (rows || []).slice().sort((a, b) => (Number(a.statementNo) || 0) - (Number(b.statementNo) || 0) || (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));
  let paidSoFar = 0;
  const list = sorted.map(r => { paidSoFar += num(r.paidAmount); return { ...r, paidToDate: paidSoFar, remaining: Math.max(0, num(r.amount) - paidSoFar) }; });
  const billed = num([...sorted].reverse().find(r => num(r.amount) > 0)?.amount);
  return { list, billed, paid: paidSoFar, remaining: Math.max(0, billed - paidSoFar) };
}
function StatementCards({ items, project, contract, onPatchContract, onPatch, onRemove, onAddStatement, onCreateStatement }) {
  const ledger = statementLedger(items);
  // older versions numbered statements per item, leaving duplicates (two «شماره ۱»): renumber 1…n in the current order
  const nos = ledger.list.map(x => Number(x.statementNo) || 0), dup = nos.some((x, i) => !x || nos.indexOf(x) !== i);
  const renumber = () => ledger.list.forEach((x, i) => { if ((Number(x.statementNo) || 0) !== i + 1) onPatch(x.id, { statementNo: i + 1 }); });
  const save = (item, key, value) => { if (value !== (item[key] || '')) onPatch(item.id, { [key]: value }); };
  // the card's (cumulative) amount follows the statement workbook unless typed by hand; a hand-typed one that differs is flagged
  const autoOf = item => { const no = Number(item.statementNo) || 0; return no && hasWorkbook(contract) && (contract.measures || []).some(m => Number(m.statementNo) === no) ? grossUpTo(contract.boq, contract.measures, no) : null; };
  const syncKey = items.map(x => `${x.id}:${x.statementNo}:${x.amount}:${x.amountSource || ''}`).join() + '|' + JSON.stringify([contract?.boq, contract?.measures]);
  // every statement in the workbook gets its card (once per number, so a deleted card is not recreated in this session)
  const madeCards = useRef(new Set());
  useEffect(() => { if (!onCreateStatement) return; const have = new Set(items.map(x => Number(x.statementNo) || 0)); const want = [...new Set((contract?.measures || []).map(m => Number(m.statementNo) || 0))].filter(no => no > 0 && !have.has(no) && !madeCards.current.has(no)).sort((a, b) => a - b); for (const no of want) { madeCards.current.add(no); onCreateStatement(no); } }, [JSON.stringify((contract?.measures || []).map(m => m.statementNo)), items.length]);
  useEffect(() => { for (const x of items) { const a = autoOf(x); if (a != null && x.amountSource !== 'manual' && num(x.amount) !== a) onPatch(x.id, { amount: a, amountSource: 'auto' }); } }, [syncKey]);
  const stage = (item, check, date, label) => <div className="lf-statement-stage"><label><input type="checkbox" checked={!!item[check]} onChange={e => onPatch(item.id, { [check]: e.target.checked })} />{label}</label><JalaliDateInput value={item[date] || ''} onChange={value => onPatch(item.id, { [date]: value })} /></div>;
  return <><ContractFinancials contract={contract} onPatch={onPatchContract} onAddStatement={onAddStatement} /><StatementWorkbook contract={contract} project={project} payments={items} onPatchContract={onPatchContract} /><div className="lf-finance-summary"><div><small>آخرین صورت‌وضعیت (تجمعی)</small><b>{money(ledger.billed)}</b></div><div><small>جمع واریزی کارفرما</small><b>{money(ledger.paid)}</b></div><div><small>مطالبات معوق (آخرین صورت‌وضعیت − واریزی‌ها)</small><b>{money(ledger.remaining)}</b></div></div>{dup ? <div className="lf-statement-dup"><span>شمارهٔ چند صورت‌وضعیت تکراری است.</span><button type="button" className="lf-btn ghost" onClick={renumber}>مرتب‌سازی شماره‌ها (۱ تا {fa(ledger.list.length)})</button></div> : null}<div className="lf-statement-cards">{ledger.list.map(item => <article className="lf-statement-card" key={item.id}><header><b>صورت‌وضعیت شماره {item.statementNo ? fa(item.statementNo) : '—'}</b><button type="button" className="lf-link del" onClick={() => window.confirm('این صورت‌وضعیت حذف شود؟') && onRemove(item.id)}>حذف</button></header><div className="lf-statement-stages">{stage(item, 'noticeSent', 'noticeSentDate', 'ارسال اعلام وضعیت')}{stage(item, 'noticeApproved', 'noticeApprovedDate', 'تأیید اعلام وضعیت')}{stage(item, 'statementSent', 'statementSentDate', 'ارسال صورت‌وضعیت')}</div><div className="lf-statement-money"><label>مبلغ صورت‌وضعیت<input key={`amt-${item.amount}`} defaultValue={item.amount || ''} inputMode="numeric" placeholder="مبلغ" onBlur={e => { const v = num(e.target.value); if (v !== num(item.amount)) onPatch(item.id, { amount: v, amountSource: 'manual' }); }} />{autoOf(item) == null ? null : item.amountSource === 'manual' && num(item.amount) !== autoOf(item) ? <span className="lf-statement-auto warn">با ریزمتره ({money(autoOf(item))}) فرق دارد <button type="button" className="lf-link" onClick={() => onPatch(item.id, { amount: autoOf(item), amountSource: 'auto' })}>استفاده از ریزمتره</button></span> : <span className="lf-statement-auto">✓ از ریزمتره</span>}</label><label>تاریخ واریز<JalaliDateInput value={item.paymentDate || ''} onChange={value => onPatch(item.id, { paymentDate: value })} /></label><label>واریزی کارفرما<input defaultValue={item.paidAmount || ''} inputMode="numeric" placeholder="مبلغ واریزی" onBlur={e => save(item, 'paidAmount', num(e.target.value))} /></label><div><small>باقی‌مانده تا این صورت‌وضعیت</small><b>{money(item.remaining)}</b></div></div><input className="lf-statement-note" defaultValue={item.note || ''} placeholder="توضیحات صورت‌وضعیت" onBlur={e => save(item, 'note', e.target.value.trim())} /></article>)}</div></>;
}
function projectMetrics(project, contract, financials, processes) {
  const stages = projectStages(contract, processes);
  const today = todayIso(), valid = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
  const done = stages.filter(x => x.status === 'done').length, progress = weightedProgress(stages);
  const late = stages.filter(x => x.status !== 'done' && valid(x.date) && x.date < today).length;
  const start = contract?.contractStartDate, end = contract?.contractEndDate;
  const days = valid(start) && valid(end) ? Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 864e5)) : 0;
  const timePct = days ? Math.round(Math.max(0, Math.min(days, Math.round((Date.parse(today) - Date.parse(start)) / 864e5))) / days * 100) : null;
  const daysLeft = valid(end) ? Math.round((Date.parse(end) - Date.parse(today)) / 864e5) : null;
  const amount = num(contract?.amount), advance = num(contract?.advancePayment);
  const ledger = statementLedger(financials), stTotal = ledger.billed, paid = ledger.paid;
  const received = advance + paid, variance = timePct == null ? null : progress - timePct;
  const state = progress === 100 || isDelivered(stages) ? 'done' : (variance != null && variance < -15) || late ? 'bad' : variance != null && variance < 0 ? 'warn' : !contract || (!days && !amount) ? 'none' : 'ok';
  return { done, total: stages.length, progress, late, timePct, variance, daysLeft, end, amount, received, receivedPct: amount ? Math.min(100, Math.round(received / amount * 100)) : null, outstanding: Math.max(0, stTotal - paid), state, nextSteps: nextStepsOf(stages) };
}
// per contract item: its next action = the first stage not done after the item's last done stage (stages skipped
// earlier don't count) → [{ item, base }]
export function nextStepsOf(stages) {
  const byItem = new Map();
  for (const s of stages || []) { if (isFixedStage(s)) continue; const k = itemOfStage(s); if (!byItem.has(k)) byItem.set(k, []); byItem.get(k).push(s); }
  const out = [];
  for (const [item, list] of byItem) {
    list.sort((a, b) => a.order - b.order);
    let last = -1; list.forEach((s, i) => { if (s.status === 'done') last = i; });
    const next = list.slice(last + 1).find(s => s.status !== 'done');
    if (next) out.push({ item, base: baseOf(next) });
  }
  return out;
}
// «خط تولید»: every item's next action grouped by stage, in checklist order → [{ base, department, projects: [{ p, items }] }]
export function nextStepPipeline(rows) {
  const order = ITEM_STAGES.map(([, b]) => b), dept = Object.fromEntries(ITEM_STAGES.map(([d, b]) => [b, d])), map = new Map();
  for (const r of rows) for (const s of r.m.nextSteps || []) { if (!map.has(s.base)) map.set(s.base, new Map()); const pm = map.get(s.base); if (!pm.has(r.p.id)) pm.set(r.p.id, { p: r.p, items: [] }); if (s.item) pm.get(r.p.id).items.push(s.item); }
  return [...map].sort((a, b) => (order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99)).map(([base, pm]) => ({ base, department: dept[base] || '', projects: [...pm.values()] }));
}
// stages the comparison lists separately (who is ready for shipping / for installation)
export const NEXT_WATCH = [['ارسال به پروژه', 'آمادهٔ ارسال به پروژه'], ['شروع نصب', 'آمادهٔ شروع نصب']];
const STATE_LABEL = { ok: 'مطابق برنامه', warn: 'اندکی عقب', bad: 'نیازمند پیگیری', done: 'تکمیل‌شده', none: 'قرارداد ناقص' };
// every stage that is some item's next action: how many projects wait on it (bar = share of projects), click → the projects
function PipelineReport({ rows, onOpen }) {
  const [open, setOpen] = useState('');
  const pipe = nextStepPipeline(rows), max = Math.max(1, ...pipe.map(x => x.projects.length));
  if (!pipe.length) return null;
  return <div className="lf-pipeline"><h3>خط تولید · اقدام بعدی پروژه‌ها<small>هر ردیف: چند پروژه اقدام بعدی‌شان این مرحله است (روی ردیف بزن تا پروژه‌ها را ببینی)</small></h3>
    {pipe.map(x => <div key={x.base} className={`lf-pipe-row ${NEXT_WATCH.some(([b]) => b === x.base) ? 'hot' : ''} ${open === x.base ? 'open' : ''}`}>
      <button type="button" onClick={() => setOpen(o => o === x.base ? '' : x.base)}><span className={`dept dept-${String(x.department).replaceAll(' ', '-')}`}>{x.department}</span><b>{x.base}</b><i><em style={{ width: `${x.projects.length / max * 100}%` }} /></i><strong>{fa(x.projects.length)}</strong></button>
      {open === x.base ? <ul>{x.projects.map(({ p, items }) => <li key={p.id} onClick={() => onOpen(p.id)} style={{ '--c': p.color || PCOLORS[0] }}><i /><b>{p.name}</b>{items.map(it => <span key={it}>{it}</span>)}</li>)}</ul> : null}
    </div>)}
  </div>;
}
function ProjectsCompare({ projects, contracts, financials, processes, onOpen, printRef }) {
  const [sort, setSort] = useState('order');
  const rows = projects.map((p, i) => ({ p, i, m: projectMetrics(p, contracts.find(x => x.projectId === p.id), financials.filter(x => x.projectId === p.id), processes.filter(x => x.projectId === p.id)) }));
  const key = { order: r => r.i, progress: r => -r.m.progress, variance: r => r.m.variance ?? 999, end: r => r.m.daysLeft ?? 1e9, outstanding: r => -r.m.outstanding }[sort];
  rows.sort((a, b) => key(a) - key(b));
  const sum = f => rows.reduce((a, r) => a + f(r.m), 0);
  // the «چاپ / PDF» button lives in the page actions, next to «بازگشت به پروژه»; it prints the rows in their current order
  if (printRef) printRef.current = async () => { const brand = await api('/api/report-brand').catch(() => ({})); await printCompareReport({ rows, brand: brand || {} }); };
  const th = (k, l) => <th><button type="button" className={sort === k ? 'on' : ''} onClick={() => setSort(k)}>{l}</button></th>;
  const counts = ['bad', 'warn', 'ok', 'done', 'none'].map(k => [k, rows.filter(r => r.m.state === k).length]).filter(([, n]) => n);
  return <section className="lf-card lf-compare">
    <div className="lf-compare-head"><h2>مقایسهٔ پروژه‌ها</h2><div className="lf-compare-chips">{counts.map(([k, n]) => <span key={k} className={`st-${k}`}>{STATE_LABEL[k]}: {fa(n)}</span>)}</div></div>
    <div className="lf-compare-wrap"><table>
      <thead><tr>{th('order', 'پروژه')}{th('progress', 'پیشرفت')}<th>زمان</th>{th('variance', 'انحراف')}{th('end', 'پایان قرارداد')}<th>مبلغ قرارداد</th><th>وصولی</th>{th('outstanding', 'معوق')}<th>مراحل عقب</th><th>وضعیت</th></tr></thead>
      <tbody>{rows.map(({ p, m }) => <tr key={p.id} onClick={() => onOpen(p.id)} style={{ '--c': p.color || PCOLORS[0] }}>
        <td className="nm"><i />{p.name}{p.client ? <small>{p.client}</small> : null}</td>
        <td><div className="lf-compare-bar"><em style={{ width: `${m.progress}%` }} /></div><small>{fa(m.progress)}٪ ({fa(m.done)} از {fa(m.total)})</small></td>
        <td>{m.timePct == null ? '—' : `${fa(m.timePct)}٪`}</td>
        <td className={m.variance == null ? '' : m.variance < 0 ? 'neg' : 'pos'}>{m.variance == null ? '—' : m.variance === 0 ? 'منطبق' : `${fa(Math.abs(m.variance))}٪ ${m.variance < 0 ? 'عقب' : 'جلو'}`}</td>
        <td>{m.end ? jShort(m.end) : '—'}{m.daysLeft != null ? <small>{m.daysLeft >= 0 ? `${fa(m.daysLeft)} روز مانده` : `${fa(-m.daysLeft)} روز گذشته`}</small> : null}</td>
        <td>{m.amount ? money(m.amount) : '—'}</td>
        <td>{m.amount ? money(m.received) : '—'}{m.receivedPct != null ? <small>{fa(m.receivedPct)}٪</small> : null}</td>
        <td className={m.outstanding ? 'neg' : ''}>{m.outstanding ? money(m.outstanding) : '—'}</td>
        <td className={m.late ? 'neg' : ''}>{m.late ? fa(m.late) : '—'}</td>
        <td><span className={`lf-compare-state st-${m.state}`}>{STATE_LABEL[m.state]}</span></td>
      </tr>)}</tbody>
      <tfoot><tr><td>جمع {fa(rows.length)} پروژه</td><td>{rows.length ? `${fa(Math.round(sum(m => m.progress) / rows.length))}٪ میانگین` : ''}</td><td /><td /><td /><td>{money(sum(m => m.amount))}</td><td>{money(sum(m => m.received))}</td><td>{money(sum(m => m.outstanding))}</td><td>{fa(sum(m => m.late))}</td><td /></tr></tfoot>
    </table></div>
    <div className="lf-compare-next">{NEXT_WATCH.map(([base, label]) => { const list = rows.map(r => ({ ...r, items: r.m.nextSteps.filter(x => x.base === base).map(x => x.item) })).filter(r => r.items.length);
      return <div key={base}><h3>{label}<em>{fa(list.length)} پروژه</em></h3><small>اقدام بعدی این پروژه‌ها «{base}» است</small>
        {list.length ? <ul>{list.map(({ p, items }) => <li key={p.id} onClick={() => onOpen(p.id)} style={{ '--c': p.color || PCOLORS[0] }}><i /><b>{p.name}</b>{items.filter(Boolean).map(it => <span key={it}>{it}</span>)}</li>)}</ul> : <p>پروژه‌ای در این مرحله نیست.</p>}
      </div>; })}</div>
    <PipelineReport rows={rows} onOpen={onOpen} />
    <p className="lf-compare-hint">روی هر ردیف بزن تا پروژه باز شود. سرستون‌های پررنگ قابل مرتب‌سازی‌اند.</p>
  </section>;
}
function ProjectReport({ project, contract, financials, processes }) {
  const [reportBrand, setReportBrand] = useState({ headerText: '', footerText: '', logo: '' });
  useEffect(() => {
    let active = true;
    api('/api/report-brand').then(data => { if (active) setReportBrand(data || {}); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const stages = projectStages(contract, processes);
  const completed = stages.filter(item => item.status === 'done').length;
  const progress = weightedProgress(stages);
  const departments = ['کنترل پروژه', 'فنی', 'تأمین', 'اجرا'].map(department => {
    const rows = stages.filter(item => item.department === department), done = rows.filter(item => item.status === 'done').length;
    return { department, done, total: rows.length, progress: weightedProgress(stages, department) };
  });
  const reportItems = (() => { const its = [...new Set(stages.filter(x => x.item).map(x => x.item))], sh = itemShares(its, contract?.itemAreas); return its.map(item => ({ item, progress: itemProgress(stages, item), share: Math.round(sh[item] * 100) })); })();
  const ledger = statementLedger(financials);
  const statementRows = ledger.list, statementTotal = ledger.billed, paidTotal = ledger.paid;
  const contractTotal = num(contract?.amount), advance = num(contract?.advancePayment);
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '');
  const start = contract?.contractStartDate || '', end = contract?.contractEndDate || '';
  const contractDays = validDate(start) && validDate(end) ? Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 864e5)) : 0;
  const elapsed = contractDays ? Math.max(0, Math.min(contractDays, Math.round((Date.parse(todayIso()) - Date.parse(start)) / 864e5))) : 0;
  const timeProgress = contractDays ? Math.round(elapsed / contractDays * 100) : null;
  const received = advance + paidTotal;
  const receivedProgress = contractTotal ? Math.max(0, Math.min(100, Math.round(received / contractTotal * 100))) : 0;
  const timelineBehind = timeProgress != null && timeProgress > progress + 15;
  const projectState = progress === 100 ? 'تکمیل شده' : timelineBehind ? 'نیازمند پیگیری' : 'در جریان';
  const value = item => item || '—';
  const reportHeaderText = String(reportBrand.headerText || '').trim();
  const reportFooterText = String(reportBrand.footerText || '').trim();
  const reportLogo = /^data:image\/(?:png|jpeg|webp);base64,/i.test(String(reportBrand.logo || '')) ? reportBrand.logo : '';
  const hasReportBrand = !!(reportHeaderText || reportLogo);
  const printedAt = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Tehran' }).format(new Date());
  const [sendState, setSendState] = useState({ busy: false, msg: '', error: false });
  const reportData = () => ({ project, contract, brand: { headerText: reportHeaderText, footerText: reportFooterText, logo: reportLogo }, stages, departments, statements: statementRows, items: reportItems });
  const printReport = () => printProjectReport(reportData());
  const sendReport = async () => {
    if (sendState.busy) return;
    setSendState({ busy: true, msg: 'در حال ساخت PDF و ارسال…', error: false });
    try {
      await sendProjectReportToTelegram(reportData());
      setSendState({ busy: false, msg: '✓ PDF گزارش به تلگرام ارسال شد.', error: false });
    } catch (e) { setSendState({ busy: false, msg: e.message || 'ارسال به تلگرام ناموفق بود.', error: true }); }
  };
  return <article className="lf-project-report" dir="rtl">
    <header className={`lf-report-head ${hasReportBrand ? 'has-report-brand' : ''}`}>
      {hasReportBrand ? <aside className="lf-report-print-brand" aria-label="سربرگ گزارش">{reportLogo ? <img src={reportLogo} alt="لوگوی گزارش" /> : null}{reportHeaderText ? <b>{reportHeaderText}</b> : null}</aside> : null}
      <div><p>گزارش عملکرد پروژه</p><h2>{project.name}</h2><small>تهیه‌شده در {printedAt}</small></div>
      <div className={`lf-report-status ${timelineBehind ? 'attention' : progress === 100 ? 'complete' : ''}`}><b>{projectState}</b><span>{fa(progress)}٪ پیشرفت اجرایی</span></div>
      <div className="lf-report-actions"><div className="lf-report-btns"><button type="button" className="lf-btn lf-report-print" onClick={printReport}>🖨 چاپ / ذخیرهٔ PDF</button><button type="button" className="lf-btn ghost lf-report-print" onClick={sendReport} disabled={sendState.busy}>{sendState.busy ? '⏳ در حال ارسال…' : '✈ ارسال به تلگرام'}</button></div>{sendState.msg ? <small className={`lf-report-send ${sendState.error ? 'err' : ''}`} role="status">{sendState.msg}</small> : null}</div>
    </header>
    <section className="lf-report-metrics">
      <div className="lf-report-chart report-progress"><div className="lf-report-ring" style={{ '--progress': `${progress * 3.6}deg` }}><b>{fa(progress)}٪</b><small>اجرایی</small></div><div><small>پیشرفت مراحل</small><b>{fa(completed)} از {fa(stages.length)} مرحله</b><span>مراحل اجرایی تکمیل شده</span></div></div>
      <div className={`lf-report-chart report-time ${timelineBehind ? 'attention' : ''}`}><div className={`lf-report-ring ${timeProgress == null ? 'empty' : ''}`} style={{ '--progress': `${(timeProgress || 0) * 3.6}deg` }}><b>{timeProgress == null ? '—' : `${fa(timeProgress)}٪`}</b><small>زمان</small></div><div><small>زمان قرارداد</small><b>{validDate(end) ? jShort(end) : 'تاریخ ثبت نشده'}</b><span>{contractDays ? `${fa(elapsed)} از ${fa(contractDays)} روز قرارداد` : 'برای نمودار، تاریخ شروع و اتمام را وارد کنید'}</span></div></div>
      <div className="lf-report-money report-contract"><small>مبلغ کل قرارداد</small><b>{money(contractTotal)}</b><span>پیش‌پرداخت: {money(advance)}</span></div>
      <div className="lf-report-money report-received"><small>دریافتی از کارفرما</small><b>{money(received)}</b><i className="lf-report-inline-meter"><em style={{ width: `${receivedProgress}%` }} /></i><span>{fa(receivedProgress)}٪ از مبلغ قرارداد</span></div>
    </section>
    <section className="lf-report-section lf-report-info"><h3>اطلاعات پروژه و قرارداد</h3><dl>
      <div><dt>کد پروژه</dt><dd>{value(project.projectCode)}</dd></div><div><dt>کارفرما</dt><dd>{value(project.client)}</dd></div><div><dt>شماره تماس کارفرما</dt><dd dir="ltr">{value(project.clientPhone)}</dd></div><div><dt>مسئول ارتباط پروژه</dt><dd>{value(project.owner)}</dd></div><div><dt>شماره تماس مسئول</dt><dd dir="ltr">{value(project.contactPhone)}</dd></div><div><dt>شماره قرارداد</dt><dd>{value(contract?.contractNo)}</dd></div><div><dt>آیتم‌های قرارداد</dt><dd>{value(contract?.subject)}</dd></div><div><dt>متراژ قرارداد</dt><dd>{contractAreaText(contract) || '—'}</dd></div>{contractScope(contract).filter(optionsKey).map(it => <div key={`opt-${it}`}><dt>گزینه‌های {it}</dt><dd>{itemOptionsText(contract, it)}</dd></div>)}<div><dt>نوع تسویه</dt><dd>{{ cash: 'نقدی', check: 'چک', statement: 'صورت‌وضعیتی', barter: 'تهاتری', other: 'سایر' }[contract?.settlementType] || '—'}</dd></div><div><dt>شروع قرارداد</dt><dd>{validDate(start) ? jl(start) : '—'}</dd></div><div><dt>اتمام قرارداد</dt><dd>{validDate(end) ? jl(end) : '—'}</dd></div>
    </dl>{project.note || contract?.note ? <div className="lf-report-notes">{project.note ? <p><b>توضیحات پروژه:</b> {project.note}</p> : null}{contract?.note ? <p><b>توضیحات قرارداد:</b> {contract.note}</p> : null}</div> : null}</section>
    <section className="lf-report-section"><h3>نمودار پیشرفت واحدها</h3><div className="lf-report-departments">{departments.map(item => <div key={item.department} className={`dept-${item.department.replaceAll(' ', '-')}`}><div><b>{item.department}</b><span>{fa(item.done)} از {fa(item.total)}</span></div><i><em style={{ width: `${item.progress}%` }} /></i><small>{fa(item.progress)}٪ تکمیل</small></div>)}</div>{reportItems.length ? <ItemsPanel items={reportItems.map(x => x.item)} stages={stages} shares={Object.fromEntries(reportItems.map(x => [x.item, x.share / 100]))} /> : null}</section>
    <section className="lf-report-section"><h3>خلاصهٔ مالی و صورت‌وضعیت‌ها</h3><div className="lf-report-finance"><div><small>آخرین صورت‌وضعیت (تجمعی)</small><b>{money(statementTotal)}</b></div><div><small>جمع واریزی‌ها</small><b>{money(paidTotal)}</b></div><div><small>مطالبات معوق</small><b>{money(Math.max(0, statementTotal - paidTotal))}</b></div></div>
      {statementRows.length ? <div className="lf-report-table-wrap"><table><thead><tr><th>شماره</th><th>اعلام وضعیت</th><th>تأیید</th><th>ارسال صورت‌وضعیت</th><th>مبلغ</th><th>واریزی</th><th>مانده</th></tr></thead><tbody>{statementRows.map(item => <tr key={item.id}><td>{fa(item.statementNo)}</td><td>{item.noticeSent ? '✓' : '—'} {item.noticeSentDate ? jShort(item.noticeSentDate) : ''}</td><td>{item.noticeApproved ? '✓' : '—'} {item.noticeApprovedDate ? jShort(item.noticeApprovedDate) : ''}</td><td>{item.statementSent ? '✓' : '—'} {item.statementSentDate ? jShort(item.statementSentDate) : ''}</td><td>{money(item.amount)}</td><td>{money(item.paidAmount)}</td><td>{money(item.remaining)}</td></tr>)}{statementRows.filter(x => x.note).map(item => <tr key={`n-${item.id}`} className="lf-report-note-row"><td colSpan={7}>توضیحات صورت‌وضعیت {fa(item.statementNo)}: {item.note}</td></tr>)}</tbody></table></div> : <p className="lf-empty">هنوز صورت‌وضعیتی ثبت نشده است.</p>}
    </section>
    <section className="lf-report-section lf-report-stages"><h3>وضعیت مراحل اجرایی</h3><div className="lf-report-table-wrap"><table className="lf-report-stage-table"><thead><tr><th>ردیف</th><th>مرحله</th><th>واحد</th><th>وضعیت</th><th>تاریخ انجام</th><th>مسئول</th><th>توضیحات</th></tr></thead><tbody>{(() => { let n = 0; const groups = []; for (const st of stages) { const g = st.group || (st.item ? `item:${st.item}` : 'start'); let G = groups.find(x => x.key === g); if (!G) groups.push(G = { key: g, item: st.item || '', rows: [] }); G.rows.push(st); }
          return groups.map(G => { const dn = G.rows.filter(x => x.status === 'done').length, ri = reportItems.find(x => x.item === G.item);
            return [<tr key={`g-${G.key}`} className={`lf-report-stage-group ${(ri ? ri.progress === 100 : dn === G.rows.length) ? 'complete' : ''}`}><td colSpan={7}><b>{G.item || GROUP_TITLES[G.key] || GROUP_TITLES['item:']}</b>{ri ? <><i className="lf-report-gbar"><em style={{ width: `${ri.progress}%` }} /></i><span>{fa(ri.progress)}٪ · سهم {fa(ri.share)}٪</span></> : null}<small>{fa(dn)} از {fa(G.rows.length)} انجام‌شده</small>{G.item && itemOptionsText(contract, G.item) ? <em className="lf-report-gopts">{itemOptionsText(contract, G.item)}</em> : null}</td></tr>,
              ...G.rows.map(item => <tr key={`${item.department}|${item.title}`} className={item.status === 'done' ? 'done' : ''}><td>{fa(++n)}</td><td>{item.base || item.title}</td><td>{item.department}</td><td>{item.status === 'done' ? '✓ انجام شد' : isInstallStage(item) && Number(item.percent) ? `${fa(Number(item.percent))}٪ نصب` : 'در انتظار'}</td><td>{item.date ? jShort(item.date) : '—'}</td><td>{item.owner || '—'}</td><td className="note">{item.note || '—'}</td></tr>)]; }); })()}</tbody></table></div></section>
    {reportFooterText ? <footer className="lf-report-print-footer"><span>{reportFooterText}</span></footer> : null}
  </article>;
}
// چند-انتخابی؛ آیتم جدید به منو اضافه می‌شود و در همهٔ پروژه‌ها قابل انتخاب است.
// subject (متنی) برای گزارش و داده‌های قبلی هم‌گام می‌ماند.
function ContractItemsField({ contract, knownItems = [], onChange }) {
  const picked = contractScope(contract);
  const [adding, setAdding] = useState(false);
  const menu = orderItems([...CONTRACT_ITEMS, ...knownItems, ...picked]);
  const has = i => picked.some(x => normItem(x) === normItem(i));
  const commit = items => { const list = orderItems(items), areas = contract?.itemAreas; onChange({ items: list, itemsOther: '', subject: list.join('، '), ...(areas ? { area: sumAreas(areas, list) } : {}) }); };
  // removing a chosen item hides its stages, so it asks a small sum first
  const toggle = async i => { if (has(i)) { if (!await askMath({ title: `«${i}» از آیتم‌های قرارداد حذف شود؟`, detail: 'مراحل و سهم این آیتم از چک‌لیست پنهان می‌شود (اطلاعات ثبت‌شده‌اش پاک نمی‌شود و با انتخاب دوباره برمی‌گردد).' })) return; commit(picked.filter(x => normItem(x) !== normItem(i))); } else commit([...picked, i]); };
  const add = text => { const news = splitItems(text); if (news.length) commit([...picked, ...news]); setAdding(false); };
  return <div className="lf-sheet-field wide lf-contract-items"><span>آیتم‌های قرارداد</span>
    <div className="lf-item-chips" role="group" aria-label="آیتم‌های قرارداد">
      {menu.map(i => <button type="button" key={i} className={has(i) ? 'on' : ''} aria-pressed={has(i)} onClick={() => toggle(i)}>{has(i) ? '✓ ' : ''}{i}</button>)}
      {adding ? <input className="lf-item-add" autoFocus placeholder="نام آیتم نما (مثلاً کامپوزیت)" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const v = e.currentTarget.value; e.currentTarget.value = ''; add(v); } else if (e.key === 'Escape') setAdding(false); }} onBlur={e => add(e.target.value)} />
        : <button type="button" className="add" onClick={() => setAdding(true)}>＋ آیتم جدید</button>}
    </div>
  </div>;
}
// متراژ جدا برای هر آیتم قرارداد؛ area = جمع آن‌ها (برای گزارش و داده‌های قبلی)
// متراژ: اعشاری (۱۲٫۵)، بدون جداکنندهٔ هزارگان
const dec = v => num(String(v ?? '').replace(/[٫/]/g, '.'));
const faArea = v => Number(v || 0).toLocaleString('fa-IR', { useGrouping: false, maximumFractionDigits: 2 });
// itemAreas keys may use an older spelling (کرتین‌وال) — match like the item chips do
export const itemArea = (areas, item) => dec(areas?.[item] ?? Object.entries(areas || {}).find(([k]) => normItem(k) === normItem(item))?.[1]);
const sumAreas = (areas, items) => Math.round(items.reduce((a, i) => a + itemArea(areas, i), 0) * 100) / 100;
export const contractAreaText = contract => { const per = contractScope(contract).filter(i => itemArea(contract?.itemAreas, i) > 0); return per.length ? per.map(i => `${i}: ${faArea(itemArea(contract.itemAreas, i))}`).join(' · ') + ` (جمع ${faArea(dec(contract.area))} مترمربع)` : dec(contract?.area) ? `${faArea(dec(contract.area))} مترمربع` : ''; };
function ContractAreaField({ contract, onChange, fallback }) {
  const items = contractScope(contract);
  if (!items.length) return fallback;
  const areas = contract?.itemAreas || {};
  const save = (item, value) => { const v = dec(value); if (v === itemArea(areas, item)) return; const next = Object.fromEntries(Object.entries(areas).filter(([k]) => normItem(k) !== normItem(item))); next[item] = v; onChange({ itemAreas: next, area: sumAreas(next, items) }); };
  return <div className="lf-sheet-field wide lf-item-areas"><span>متراژ قرارداد (مترمربع)<em>جمع: {faArea(sumAreas(areas, items))}</em></span>
    <div>{items.map(i => <label key={i}><small>{i}</small><input key={`${i}-${itemArea(areas, i)}`} defaultValue={itemArea(areas, i) || ''} inputMode="decimal" data-raw dir="ltr" placeholder="0" onBlur={e => save(i, e.target.value)} /></label>)}</div>
  </div>;
}
// دارد/ندارد برای گزینه‌های هر آیتم (مثلاً روکوب و رین‌فورس پنجره)
function ItemOptionToggles({ contract, item, onChange }) {
  const k = optionsKey(item);
  if (!k || !onChange) return null;
  const set = (key, v) => { const all = { ...(contract?.itemOptions || {}) }; all[item] = { ...(all[item] || {}), [key]: v }; onChange({ itemOptions: all }); };
  return <span className="lf-item-options">{ITEM_OPTIONS[k].map(([key, label]) => { const v = itemOption(contract, item, key); return <span key={key} className="lf-yn" role="radiogroup" aria-label={`${label} ${item}`}><b>{label}</b><button type="button" role="radio" aria-checked={v === true} className={v === true ? 'on yes' : ''} onClick={e => { e.stopPropagation(); set(key, true); }}>دارد</button><button type="button" role="radio" aria-checked={v === false} className={v === false ? 'on no' : ''} onClick={e => { e.stopPropagation(); set(key, false); }}>ندارد</button></span>; })}</span>;
}
function ProjectInfoSheet({ project, contract, knownItems, onPatchProject, onPatchContract }) {
  const setProject = (key, value) => onPatchProject({ [key]: value });
  const setContract = (key, value) => {
    const next = { ...(contract || {}), [key]: value };
    if (key === 'amount' || key === 'advancePayment') next.remainingAmount = Math.max(0, num(next.amount) - num(next.advancePayment));
    onPatchContract(next);
  };
  const input = (group, key, label, opts = {}) => <label className={`lf-sheet-field ${opts.wide ? 'wide' : ''}`}><span>{label}</span><input defaultValue={(group === 'project' ? project : contract)?.[key] || ''} placeholder={opts.placeholder || ''} inputMode={opts.money ? 'numeric' : undefined} onBlur={e => (group === 'project' ? setProject : setContract)(key, opts.money ? num(e.target.value) : e.target.value.trim())} /></label>;
  const date = (key, label) => <label className="lf-sheet-field"><span>{label}</span><JalaliDateInput value={contract?.[key] || ''} onChange={value => setContract(key, value)} /></label>;
  return <div className="lf-project-sheet">
    <h4>اطلاعات پروژه و قرارداد</h4>
    <div className="lf-project-sheet-grid">
      {input('project', 'projectCode', 'کد پروژه')}{input('project', 'name', 'نام پروژه', { placeholder: 'نام پروژه' })}
      {input('project', 'client', 'کارفرما')}{input('project', 'clientPhone', 'شماره تماس کارفرما')}
      {input('project', 'owner', 'مسئول ارتباط پروژه')}{input('project', 'contactPhone', 'شماره تماس مسئول ارتباط')}
      {input('contract', 'contractNo', 'شماره قرارداد')}<ContractItemsField contract={contract} knownItems={knownItems} onChange={onPatchContract} />
      {date('contractStartDate', 'تاریخ شروع قرارداد')}{date('contractEndDate', 'تاریخ اتمام قرارداد')}
      <ContractAreaField contract={contract} onChange={onPatchContract} fallback={<label className="lf-sheet-field"><span>متراژ قرارداد (مترمربع)</span><input defaultValue={contract?.area || ''} inputMode="decimal" data-raw dir="ltr" onBlur={e => onPatchContract({ area: dec(e.target.value) })} /></label>} />
      <label className="lf-sheet-field"><span>نوع تسویه</span><select value={contract?.settlementType || 'cash'} onChange={e => setContract('settlementType', e.target.value)}><option value="cash">نقدی</option><option value="check">چک</option><option value="statement">صورت‌وضعیتی</option><option value="barter">تهاتری</option><option value="other">سایر</option></select></label>
      <label className="lf-sheet-field wide"><span>توضیحات پروژه</span><textarea defaultValue={project.note || ''} placeholder="توضیحات پروژه" onBlur={e => setProject('note', e.target.value.trim())} /></label>
      <label className="lf-sheet-field wide"><span>توضیحات قرارداد</span><textarea defaultValue={contract?.note || ''} placeholder="توضیحات قرارداد" onBlur={e => setContract('note', e.target.value.trim())} /></label>
    </div>
  </div>;
}
function ProjectFile({ project, contracts, knownItems, financials, supplies, processes, onEdit, onPatchProject, onPatchContract, onToggleProcess, onPatchProcess, onAddProcess, onSeedProcesses, onCompletionChange, onAddFinance, onPatchFinance, onRemoveFinance }) {
  const [tab, setTab] = useState('overview');
  const contract = contracts[0] || null;
  return <section className="lf-card lf-project-file">
    <div className="lf-tabs">{PROJECT_FILE_TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}{k === 'finance' ? <em>{fa(financials.length)}</em> : null}</button>)}</div>
    {tab === 'overview' ? <ProjectInfoSheet project={project} contract={contract} knownItems={knownItems} onPatchProject={onPatchProject} onPatchContract={onPatchContract} /> : tab === 'finance' ? <StatementCards items={financials} project={project} contract={contract} onPatchContract={onPatchContract} onPatch={onPatchFinance} onRemove={onRemoveFinance} onAddStatement={() => onAddFinance(nextStatementNo(financials))} onCreateStatement={no => onAddFinance(no)} /> : tab === 'supply' ? <ProcessChecklist projectId={project.id} items={processes} contract={contract} onPatchContract={onPatchContract} onToggle={onToggleProcess} onPatch={onPatchProcess} onAdd={onAddProcess} onSeed={onSeedProcesses} onCompletionChange={onCompletionChange} /> : <ProjectReport project={project} contract={contract} financials={financials} processes={processes} />}
  </section>;
}
export function ProjectsPage({ Nav }) {
  const projects = useCol('projects'), cards = useCol('cards'), contracts = useCol('projectContracts'), financials = useCol('projectFinancials'), supplies = useCol('projectSupplies'), processes = useCol('projectProcesses');
  const [pid, setPidRaw] = useState(() => { const u = new URLSearchParams(location.search).get('pid'); if (u) return u; try { return localStorage.getItem('lifeos-project') || ''; } catch { return ''; } });
  // a project remembered from last visit is only reopened while it is still active; an explicit pick (click, deep link) always wins
  const [picked, setPicked] = useState(() => !!new URLSearchParams(location.search).get('pid'));
  const setPid = id => { setPicked(true); setPidRaw(id); };
  const [edit, setEdit] = useState(null), [cardEdit, setCardEdit] = useState(null), [fileEdit, setFileEdit] = useState(null), [drag, setDrag] = useState(null), [quick, setQuick] = useState('');
  const processSeeds = useRef(new Set());
  const contractSeeds = useRef(new Set());
  const contractReminderSeeds = useRef(new Set());
  const processReminderFlights = useRef(new Set());
  // Projects no longer have an archive view; older archived records remain
  // visible instead of becoming inaccessible.
  const [compare, setCompare] = useState(false);
  const [deleting, setDeleting] = useState('');
  const comparePrint = useRef(null), [printBusy, setPrintBusy] = useState(false);
  const list = projects.items || [];
  // manual order from drag-and-drop in the side list; projects without `order` keep creation order at the end
  const ordered = list.map((p, i) => [p, Number.isFinite(p.order) ? p.order : 1e6 + i]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
  const reorderProjects = ids => { const pos = new Map(ordered.map((p, i) => [p.id, i])), group = ids.map(id => pos.get(id)).sort((a, b) => a - b); ids.forEach((id, i) => { const p = list.find(x => x.id === id); if (p && p.order !== group[i]) projects.patch(id, { order: group[i] }); }); ordered.forEach((p, i) => { if (!ids.includes(p.id) && p.order !== i) projects.patch(p.id, { order: i }); }); };
  // custom facade items used in any contract show up in every project's item menu
  const knownItems = useMemo(() => orderItems((contracts.items || []).flatMap(contractScope)), [contracts.items]);
  const contractOf = id => (contracts.items || []).find(x => x.projectId === id);
  const stagesOf = p => projectStages(contractOf(p.id), (processes.items || []).filter(x => x.projectId === p.id));
  const isArchived = p => !!p.archivedAt || p.status === 'archived';
  const isFinished = p => { if (isArchived(p)) return true; if (p.status === 'done') return true; const st = stagesOf(p); return isDelivered(st) || st.every(x => x.status === 'done'); };
  // only archived projects can be deleted; asks a sum first, then removes the project and every row that belongs to it
  const deleteProject = async p => {
    if (!isArchived(p)) return;
    if (!await askMath({ title: `پروژهٔ «${p.name}» برای همیشه حذف شود؟`, detail: 'قرارداد، صورت‌وضعیت‌ها، مراحل، کارت‌ها و یادآوری‌های این پروژه هم پاک می‌شوند. این کار برگشت ندارد.', confirmLabel: 'حذف برای همیشه' })) return;
    setDeleting(p.name);
    try {
      contractSeeds.current.add(p.id); // no contract re-seed for it while it goes
      // LifeOS deletes the project with all its rows and reminders in one request; the seyfikhani panel's API
      // refuses while rows exist, so there the rows go first, one by one
      try { await api(`/api/col/projects/${p.id}`, { method: 'DELETE' }); }
      catch {
        for (const r of (processes.items || []).filter(x => x.projectId === p.id)) if (r.reminderId) await api(`/api/reminders/${r.reminderId}`, { method: 'DELETE' }).catch(() => {});
        for (const [col, name] of [[processes, 'projectProcesses'], [financials, 'projectFinancials'], [contracts, 'projectContracts'], [supplies, 'projectSupplies'], [cards, 'cards']]) for (const r of (col.items || []).filter(x => x.projectId === p.id)) await api(`/api/col/${name}/${r.id}`, { method: 'DELETE' }).catch(() => {});
        await api(`/api/col/projects/${p.id}`, { method: 'DELETE' });
      }
      setPidRaw('');
      await Promise.all([projects, processes, financials, contracts, supplies, cards].map(col => col.reload()));
    } catch (e) { window.alert(`حذف پروژه انجام نشد: ${e.message}`); }
    finally { setDeleting(''); }
  };
  const cur = (() => { const p = list.find(x => x.id === pid); if (p && (picked || !isFinished(p))) return p; return ordered.find(x => !isFinished(x)) || p || ordered.find(x => !isArchived(x)) || ordered[0] || null; })();
  useEffect(() => { if (cur) try { localStorage.setItem('lifeos-project', cur.id); } catch {} }, [cur?.id]);
  const mine = (cards.items || []).filter(c => cur && c.projectId === cur.id);
  // Creating a project deliberately asks for only its name. Everything else is
  // filled in the always-open project/contract sheet immediately afterwards.
  const pFields = [{ k: 'name', l: 'نام پروژه', req: true, ph: 'مثال: مجتمع آفتاب' }];
  // Contract identity and dates live on the contract record, not the project.
  const contractFields = [{ k: 'contractNo', l: 'شماره قرارداد', half: true }, { k: 'contractStartDate', l: 'تاریخ شروع قرارداد', t: 'date', half: true }, { k: 'contractEndDate', l: 'تاریخ اتمام قرارداد', t: 'date', half: true }, { k: 'subject', l: 'آیتم‌های قرارداد', ph: 'مثال: پنجره، کرتن‌وال، لوور (چند مورد را با ویرگول جدا کنید)', half: true }, { k: 'area', l: 'متراژ قرارداد (مترمربع)', t: 'num', half: true }, { k: 'amount', l: 'مبلغ کل قرارداد', t: 'money', half: true }, { k: 'advancePayment', l: 'مبلغ پیش‌پرداخت', t: 'money', half: true }, { k: 'remainingAmount', l: 'مبلغ باقی‌مانده', t: 'money', calc: v => Math.max(0, num(v.amount) - num(v.advancePayment)), hint: 'خودکار', half: true }, { k: 'settlementType', l: 'نوع تسویه', t: 'sel', o: [['cash', 'نقدی'], ['check', 'چک'], ['statement', 'صورت‌وضعیتی'], ['barter', 'تهاتری'], ['other', 'سایر']], def: 'cash', half: true }, { k: 'note', l: 'توضیح', t: 'area' }];
  const financialFields = [{ k: 'statementNo', l: 'شماره صورت‌وضعیت', t: 'num', req: true, half: true }, { k: 'noticeSent', l: 'ارسال اعلام وضعیت به کارفرما', t: 'check', def: false, half: true }, { k: 'noticeSentDate', l: 'تاریخ ارسال اعلام وضعیت', t: 'date', half: true }, { k: 'noticeApproved', l: 'تأیید اعلام وضعیت', t: 'check', def: false, half: true }, { k: 'noticeApprovedDate', l: 'تاریخ تأیید اعلام وضعیت', t: 'date', half: true }, { k: 'statementSent', l: 'ارسال صورت‌وضعیت', t: 'check', def: false, half: true }, { k: 'statementSentDate', l: 'تاریخ ارسال صورت‌وضعیت', t: 'date', half: true }, { k: 'amount', l: 'مبلغ صورت‌وضعیت', t: 'money', half: true }, { k: 'paymentDate', l: 'تاریخ واریز کارفرما', t: 'date', half: true }, { k: 'paidAmount', l: 'مبلغ واریز کارفرما بابت صورت‌وضعیت', t: 'money', half: true }, { k: 'remainingAmount', l: 'مبلغ باقی‌مانده', t: 'money', calc: v => Math.max(0, num(v.amount) - num(v.paidAmount)), hint: 'خودکار', half: true }, { k: 'note', l: 'توضیح', t: 'area' }];
  const supplyFields = [{ k: 'title', l: 'عنوان تأمین / اجرا', req: true }, { k: 'category', l: 'دسته‌بندی', half: true }, { k: 'supplier', l: 'تأمین‌کننده', half: true }, { k: 'date', l: 'تاریخ', t: 'date', half: true }, { k: 'quantity', l: 'مقدار', t: 'num', half: true }, { k: 'unit', l: 'واحد', half: true }, { k: 'unitPrice', l: 'قیمت واحد', t: 'money', half: true }, { k: 'note', l: 'توضیح', t: 'area' }];
  const processFields = [{ k: 'title', l: 'مرحله', req: true }, { k: 'department', l: 'واحد', t: 'sel', o: [['کنترل پروژه', 'کنترل پروژه'], ['فنی', 'فنی'], ['تأمین', 'تأمین'], ['اجرا', 'اجرا']], half: true }, { k: 'status', l: 'وضعیت', t: 'sel', o: [['todo', 'انجام نشده'], ['doing', 'در حال انجام'], ['done', 'انجام شد']], def: 'todo', half: true }, { k: 'date', l: 'تاریخ', t: 'date', half: true }, { k: 'owner', l: 'مسئول', half: true }, { k: 'note', l: 'توضیح', t: 'area' }];
  const fileConfig = { contract: { col: contracts, fields: contractFields, title: 'اطلاعات قرارداد' }, finance: { col: financials, fields: financialFields, title: 'ثبت مالی پروژه' }, supply: { col: supplies, fields: supplyFields, title: 'مراحل اجرایی' }, process: { col: processes, fields: processFields, title: 'مرحلهٔ پروژه' } };
  const cFields = [{ k: 'title', l: 'عنوان', req: true }, { k: 'col', l: 'ستون', t: 'sel', o: COLS_K, def: 'todo', half: true }, { k: 'due', l: 'مهلت', t: 'date', half: true }, { k: 'owner', l: 'مسئول', half: true }, { k: 'prio', l: 'اولویت', t: 'sel', o: [['n', 'عادی'], ['h', 'بالا'], ['l', 'پایین']], def: 'n', half: true }, { k: 'note', l: 'جزئیات', t: 'area', rows: 4 }];
  const move = (c, col) => cards.patch(c.id, { col, doneAt: col === 'done' ? Date.now() : null });
  const toggleProcess = item => processes.patch(item.id, { status: item.status === 'done' ? 'todo' : 'done' });
  const patchProcess = async (id, body) => {
    const item = (processes.items || []).find(x => x.id === id);
    await processes.patch(id, body);
    if (!item || (!Object.prototype.hasOwnProperty.call(body, 'reminderDate') && !Object.prototype.hasOwnProperty.call(body, 'owner') && !Object.prototype.hasOwnProperty.call(body, 'note'))) return;
    const next = { ...item, ...body };
    const title = `یادآوری پروژهٔ ${cur.name}: ${item.title}`;
    const notes = [`مسئول: ${next.owner || 'تعیین نشده'}`, `توضیحات: ${next.note || '—'}`].join('\n');
    try {
      if (next.reminderDate) {
        const payload = { title, date: next.reminderDate, time: '09:00', whenLabel: next.reminderDate, notes };
        if (next.reminderId) await api(`/api/reminders/${next.reminderId}`, { method: 'PATCH', body: JSON.stringify(payload) });
        else if (!processReminderFlights.current.has(id)) {
          processReminderFlights.current.add(id);
          try { const r = await api('/api/reminders', { method: 'POST', body: JSON.stringify(payload) }); if (r?.id) await processes.patch(id, { reminderId: r.id }); }
          finally { processReminderFlights.current.delete(id); }
        }
      } else if (next.reminderId) {
        await api(`/api/reminders/${next.reminderId}`, { method: 'DELETE' });
        await processes.patch(id, { reminderId: null });
      }
    } catch { /* the date remains visible locally even if notification sync is temporarily unavailable */ }
  };
  useEffect(() => {
    if (!projects.items || !processes.items) return;
    // Upgrade every existing project, not just the one currently open, to the
    // current fixed checklist. Legacy rows remain stored for safety but are
    // not displayed by the checklist.
    if (!contracts.items) return;
    (projects.items || []).forEach(project => {
      const contract = contracts.items.find(x => x.projectId === project.id);
      if (!contract) return; // the checklist still shows virtual rows; seed once the contract (and its items) exists
      const tpl = processTemplate(contract), seedKey = `${project.id}|${tpl.map(stageKey).join(',')}`;
      if (processSeeds.current.has(seedKey)) return;
      processSeeds.current.add(seedKey);
      const rows = (processes.items || []).filter(x => x.projectId === project.id);
      const byKey = new Map(rows.map(x => [stageKey(x), x]));
      const missing = tpl.filter(t => !byKey.has(stageKey(t)));
      if (!missing.length) return;
      (async () => {
        try {
          await processes.addMany(missing.map(t => ({ projectId: project.id, department: t.department, title: t.title, order: t.order, status: 'todo', ...legacyCarry(t, byKey) })));
        } catch { processSeeds.current.delete(seedKey); }
      })();
    });
  }, [projects.items, processes.items, contracts.items]);
  useEffect(() => {
    if (!cur || !contracts.items || contracts.items.some(x => x.projectId === cur.id) || contractSeeds.current.has(cur.id)) return;
    contractSeeds.current.add(cur.id);
    contracts.add({ projectId: cur.id, settlementType: 'cash', amount: 0, advancePayment: 0, remainingAmount: 0 }).catch(() => contractSeeds.current.delete(cur.id));
  }, [cur?.id, contracts.items]);
  useEffect(() => {
    const contract = (contracts.items || []).find(x => cur && x.projectId === cur.id);
    const end = contract?.contractEndDate || '';
    if (!cur || !contract?.id || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return;
    const key = `${contract.id}:${end}`;
    if (contractReminderSeeds.current.has(key)) return;
    contractReminderSeeds.current.add(key);
    const date = end < todayIso() ? todayIso() : addDays(end, -7);
    const payload = { title: `تمدید قرارداد پروژهٔ ${cur.name}`, date, time: '09:00', whenLabel: date, notes: `تاریخ اتمام قرارداد: ${jShort(end)}` };
    (async () => {
      try {
        if (contract.contractRenewalReminderId) await api(`/api/reminders/${contract.contractRenewalReminderId}`, { method: 'PATCH', body: JSON.stringify(payload) });
        else { const reminder = await api('/api/reminders', { method: 'POST', body: JSON.stringify(payload) }); if (reminder?.id) await contracts.patch(contract.id, { contractRenewalReminderId: reminder.id }); }
      } catch { contractReminderSeeds.current.delete(key); }
    })();
  }, [cur?.id, cur?.name, contracts.items]);
  // deep link from Today / calendar / planner: ?page=projects&pid=…&card=… opens that card
  useEffect(() => {
    if (!cards.items) return; const u = new URLSearchParams(location.search), id = u.get('card'); if (!id) return;
    const c = cards.items.find(x => x.id === id); if (c) { setPid(c.projectId); setCardEdit(c); }
    u.delete('card'); u.delete('pid'); try { history.replaceState(null, '', location.pathname + '?' + u.toString()); } catch {}
  }, [cards.items === null]);
  // once: projects that all got the default gold get distinct colours (you can change any of them later)
  useEffect(() => {
    const items = projects.items; if (!items || items.length < 2) return;
    try { if (localStorage.getItem('lifeos-proj-recolor')) return; localStorage.setItem('lifeos-proj-recolor', '1'); } catch { return; }
    const same = items.filter(p => !p.color || p.color === PCOLORS[0]); if (same.length < 2) return;
    same.slice(1).forEach((p, i) => projects.patch(p.id, { color: PCOLORS[(i + 1) % PCOLORS.length] }));
  }, [projects.items === null]);
  return <Page Nav={Nav} className="wide" kicker="کار" title="پروژه‌ها" actions={<>{list.length > 1 ? <button className={`lf-btn ${compare ? '' : 'ghost'}`} onClick={() => setCompare(c => !c)}>{compare ? 'بازگشت به پروژه' : '⚖ مقایسهٔ پروژه‌ها'}</button> : null}{compare && list.length > 1 ? <button className="lf-btn ghost" disabled={printBusy} onClick={async () => { setPrintBusy(true); try { await comparePrint.current?.(); } catch (e) { window.alert(`ساخت PDF انجام نشد: ${e.message}`); } finally { setPrintBusy(false); } }}>{printBusy ? '⏳ در حال آماده‌سازی…' : '🖨 چاپ / PDF'}</button> : null}<button className="lf-btn" onClick={() => setEdit({})}>＋ پروژه</button></>}>
    <SaveErrorBar />
    {projects.items === null ? <p className="lf-empty">در حال دریافت…</p> : !(projects.items || []).length ? <p className="lf-empty">هنوز پروژه‌ای نساختی. با «＋ پروژه» فقط نامش را وارد کن؛ سپس اطلاعات پروژه و قرارداد را کامل می‌کنی.</p> : <>
      {compare && list.length > 1 ? <ProjectsCompare printRef={comparePrint} projects={ordered} contracts={contracts.items || []} financials={financials.items || []} processes={processes.items || []} onOpen={id => { setPid(id); setCompare(false); }} /> : <SideLayout storageKey="lifeos-proj-side" title="پروژه‌ها" selected={cur?.id} onPick={setPid} tabs={[['active', 'فعال'], ['done', 'تمام‌شده'], ['archived', 'آرشیو']]}
        onReorder={reorderProjects}
        items={ordered.map(p => { const stages = stagesOf(p), total = stages.length, done = stages.filter(x => x.status === 'done').length, pct = weightedProgress(stages);
          return { id: p.id, name: p.name, color: p.color || PCOLORS[0], dim: false, group: isArchived(p) ? 'archived' : (p.status === 'done' || done === total || isDelivered(stages)) ? 'done' : 'active', bar: [{ flex: pct, color: '#34d399' }, { flex: 100 - pct, color: '#334155' }], sub: `${fa(pct)}٪ پیشرفت · ${fa(done)} از ${fa(total)} مرحله` }; })}>
      {cur ? <section className="lf-card sl-top" style={{ '--c': cur.color || PCOLORS[0] }}>
        {(() => { const today = todayIso(), late = mine.filter(c => c.col !== 'done' && c.due && c.due < today).sort((a, b) => a.due.localeCompare(b.due)), soon = mine.filter(c => c.col !== 'done' && c.due && c.due >= today && c.due <= addDays(today, 7)).sort((a, b) => a.due.localeCompare(b.due));
          return <>
            <div className="lf-row-head lf-phead"><div><h2 style={{ color: cur.color || PCOLORS[0] }}>{cur.name}</h2><small>{[cur.client, cur.deadline ? `مهلت ${jShort(cur.deadline)}` : ''].filter(Boolean).join(' · ')} {cur.deadline ? dueChip(cur.deadline) : null}</small></div>
              <div className="lf-pops"><div className="lf-dots" role="radiogroup" aria-label="رنگ پروژه">{PCOLORS.map((c, i) => <button key={c} role="radio" aria-checked={(cur.color || PCOLORS[0]) === c} title={PNAMES[i]} className={(cur.color || PCOLORS[0]) === c ? 'on' : ''} style={{ background: c }} onClick={() => projects.patch(cur.id, { color: c })} />)}</div>
                {isArchived(cur) ? <><button type="button" className="lf-btn ghost" onClick={() => projects.patch(cur.id, { archivedAt: null, ...(cur.status === 'archived' ? { status: 'active' } : {}) })}>↩ بازگردانی</button><button type="button" className="lf-btn ghost danger" disabled={!!deleting} onClick={() => deleteProject(cur)}>🗑 حذف پروژه</button></>
                  : <button type="button" className="lf-btn ghost" onClick={() => window.confirm(`پروژهٔ «${cur.name}» آرشیو شود؟`) && projects.patch(cur.id, { archivedAt: todayIso() })} title="انتقال به آرشیو">🗄 آرشیو</button>}
              </div></div>
            {deleting ? <div className="lf-deleting" role="status">⏳ در حال حذف پروژهٔ «{deleting}»…</div> : null}
            {isArchived(cur) ? <div className="lf-archived-note">این پروژه در آرشیو است. می‌توانی بازگردانی‌اش کنی یا برای همیشه حذفش کنی.</div> : null}
            {late.length || soon.length ? <div className="lf-palerts">{late.slice(0, 4).map(c => <button key={c.id} className="late" onClick={() => setCardEdit(c)}>⛔ {c.title} · {jShort(c.due)}</button>)}{soon.slice(0, 4).map(c => <button key={c.id} className="soon" onClick={() => setCardEdit(c)}>⏳ {c.title} · {jShort(c.due)}</button>)}</div> : null}
          </>; })()}
        <ProjectFile key={cur.id} project={cur} knownItems={knownItems} contracts={(contracts.items || []).filter(x => x.projectId === cur.id)} financials={(financials.items || []).filter(x => x.projectId === cur.id)} supplies={(supplies.items || []).filter(x => x.projectId === cur.id)} processes={(processes.items || []).filter(x => x.projectId === cur.id)} onEdit={(kind, row) => setFileEdit({ kind, row })} onPatchProject={body => projects.patch(cur.id, body)} onPatchContract={body => { const existing = (contracts.items || []).find(x => x.projectId === cur.id); return existing ? contracts.patch(existing.id, body) : contracts.add({ ...body, projectId: cur.id }); }} onToggleProcess={toggleProcess} onPatchProcess={patchProcess} onAddProcess={body => processes.add({ ...body, projectId: cur.id })} onCompletionChange={complete => { if (isArchived(cur)) return Promise.resolve(); const status = complete ? 'done' : 'active', completedAt = complete ? (cur.completedAt || todayIso()) : null; if ((cur.status || 'active') === status && (!complete || cur.completedAt)) return Promise.resolve(); return projects.patch(cur.id, { status, completedAt }); }} onAddFinance={next => financials.add({ projectId: cur.id, statementNo: next })} onPatchFinance={(id, body) => financials.patch(id, body)} onRemoveFinance={id => financials.remove(id)} onSeedProcesses={async () => { if ((processes.items || []).some(x => x.projectId === cur.id)) return; for (const t of processTemplate(contractOf(cur.id))) await processes.add({ projectId: cur.id, department: t.department, title: t.title, order: t.order, status: 'todo' }); }} />
      </section> : <p className="lf-empty">پروژه‌ای نیست — با «＋ پروژه» یک پروژه بساز.</p>}
      </SideLayout>}
    </>}
    <FormDrawer open={!!edit} title={edit?.id ? 'ویرایش پروژه' : 'پروژهٔ تازه'} submitLabel={edit?.id ? 'ذخیره' : 'ساخت پروژه'} fields={pFields} initial={edit} onClose={() => setEdit(null)} onSubmit={async b => { if (edit.id) await projects.patch(edit.id, b); else { const color = PCOLORS.find(c => !list.some(p => (p.color || PCOLORS[0]) === c)) || PCOLORS[list.length % PCOLORS.length]; const r = await projects.add({ ...b, color }); setPid(r.id); } }} />
    <FormDrawer open={!!fileEdit} title={fileEdit ? `${fileConfig[fileEdit.kind].title}${fileEdit.row?.id ? ' — ویرایش' : ''}` : ''} fields={fileEdit ? fileConfig[fileEdit.kind].fields : []} initial={fileEdit?.row} onClose={() => setFileEdit(null)} onSubmit={async b => { const cfg = fileConfig[fileEdit.kind]; if (fileEdit.row?.id) await cfg.col.patch(fileEdit.row.id, b); else await cfg.col.add({ ...b, projectId: cur.id }); }} extra={() => fileEdit?.row?.id ? <button type="button" className="lf-link del" onClick={() => { fileConfig[fileEdit.kind].col.remove(fileEdit.row.id); setFileEdit(null); }}>حذف</button> : null} />
    <FormDrawer open={!!cardEdit} title={cardEdit?.id ? 'کارت' : 'کار تازه'} fields={cFields} initial={cardEdit} onClose={() => setCardEdit(null)} onSubmit={b => cardEdit.id ? cards.patch(cardEdit.id, b) : cards.add({ ...b, projectId: cardEdit.projectId, doneAt: b.col === 'done' ? Date.now() : null })} extra={() => cardEdit?.id ? <button type="button" className="lf-link del" onClick={() => { cards.remove(cardEdit.id); setCardEdit(null); }}>حذف این کارت</button> : null} />
  </Page>;
}

/* ───────────────────────── Customers & sales (CRM) ───────────────────────── */
const STAGES = [['lead', 'سرنخ', '#94a3b8'], ['quote', 'پیش‌فاکتور', '#60a5fa'], ['nego', 'مذاکره', '#fbbf24'], ['won', 'قطعی شد', '#34d399'], ['lost', 'از دست رفت', '#fb7185']];
export function CrmPage({ Nav }) {
  const customers = useCol('customers'), deals = useCol('deals');
  const [tab, setTab] = useState('deals'), [q, setQ] = useState(''), [cEdit, setCEdit] = useState(null), [dEdit, setDEdit] = useState(null), [quote, setQuote] = useState(null);
  const cById = useMemo(() => Object.fromEntries((customers.items || []).map(c => [c.id, c])), [customers.items]);
  const cFields = [{ k: 'name', l: 'نام', req: true }, { k: 'company', l: 'شرکت', half: true }, { k: 'phone', l: 'تلفن', half: true }, { k: 'city', l: 'شهر', half: true }, { k: 'type', l: 'نوع', t: 'sel', o: [['client', 'مشتری'], ['prospect', 'مشتری بالقوه'], ['partner', 'همکار / تأمین‌کننده']], def: 'client', half: true }, { k: 'nextFollowUp', l: 'پیگیری بعدی', t: 'date' }, { k: 'note', l: 'یادداشت', t: 'area' }];
  const dFields = [{ k: 'title', l: 'عنوان معامله / سفارش', req: true }, { k: 'customerId', l: 'مشتری', t: 'sel', o: [['', '— انتخاب —'], ...(customers.items || []).map(c => [c.id, c.name + (c.company ? ` (${c.company})` : '')])] }, { k: 'stage', l: 'مرحله', t: 'sel', o: STAGES.map(s => [s[0], s[1]]), def: 'lead', half: true }, { k: 'followUp', l: 'پیگیری', t: 'date', half: true }, { k: 'note', l: 'یادداشت', t: 'area' }];
  const total = d => (d.lines || []).reduce((a, l) => a + (l.qty || 0) * (l.price || 0), 0) * (1 + (d.vat ? 0.1 : 0)) || d.amount || 0;
  const today = todayIso();
  const ds = (deals.items || []).filter(d => !q || `${d.title} ${cById[d.customerId]?.name || ''}`.includes(q));
  const cs = (customers.items || []).filter(c => !q || `${c.name} ${c.company || ''} ${c.phone || ''} ${c.city || ''}`.includes(q));
  const pipeline = STAGES.slice(0, 3).reduce((a, s) => a + ds.filter(d => d.stage === s[0]).reduce((x, d) => x + total(d), 0), 0);
  const wonMonth = ds.filter(d => d.stage === 'won' && (d.wonAt || '') >= addDays(today, -30)).reduce((x, d) => x + total(d), 0);
  const follow = [...(customers.items || []).filter(c => c.nextFollowUp && c.nextFollowUp <= addDays(today, 3)).map(c => ({ k: 'c' + c.id, t: `📞 ${c.name}${c.company ? ' · ' + c.company : ''}`, d: c.nextFollowUp, o: () => setCEdit(c) })), ...(deals.items || []).filter(d => d.followUp && d.followUp <= addDays(today, 3) && !['won', 'lost'].includes(d.stage)).map(d => ({ k: 'd' + d.id, t: `💼 ${d.title}`, d: d.followUp, o: () => setDEdit(d) }))].sort((a, b) => a.d.localeCompare(b.d));
  const setStage = (d, stage) => deals.patch(d.id, { stage, wonAt: stage === 'won' ? today : d.wonAt || null });
  return <Page Nav={Nav} kicker="کار" title="مشتری و فروش" actions={<><button className="lf-btn ghost" onClick={() => setCEdit({})}>＋ مشتری</button><button className="lf-btn" onClick={() => setDEdit({ lines: [] })}>＋ معامله / پیش‌فاکتور</button></>}>
    <div className="lf-kpis">
      <div><small>در جریان (سرنخ تا مذاکره)</small><b>{money(pipeline)}</b></div>
      <div><small>قطعی‌شده ۳۰ روز اخیر</small><b className="pos">{money(wonMonth)}</b></div>
      <div><small>مشتری‌ها</small><b>{fa((customers.items || []).length)}</b></div>
      <div className={follow.length ? 'warn' : ''}><small>پیگیری‌های امروز تا ۳ روز</small><b>{fa(follow.length)}</b></div>
    </div>
    {follow.length ? <section className="lf-card lf-follow"><h2>📌 پیگیری‌ها</h2>{follow.map(f => <button key={f.k} onClick={f.o}><span>{f.t}</span>{dueChip(f.d)}</button>)}</section> : null}
    <div className="lf-tabs"><button className={tab === 'deals' ? 'on' : ''} onClick={() => setTab('deals')}>معاملات</button><button className={tab === 'customers' ? 'on' : ''} onClick={() => setTab('customers')}>مشتری‌ها</button><input className="lf-search" value={q} onChange={e => setQ(e.target.value)} placeholder="جستجو…" /></div>
    {tab === 'deals' ? <div className="lf-kanban five">{STAGES.map(([k, label, color]) => {
      const list = ds.filter(d => (d.stage || 'lead') === k);
      return <div key={k} className="lf-kcol"><h3 style={{ color }}>{label}<em>{fa(list.length)} · {money(list.reduce((a, d) => a + total(d), 0))}</em></h3>
        {list.map(d => <article key={d.id} className="lf-kcard" onClick={() => setDEdit(d)}>
          <b>{d.title}</b><small>{cById[d.customerId]?.name || '—'}{d.followUp && !['won', 'lost'].includes(k) ? dueChip(d.followUp) : null}</small>
          <strong>{total(d) ? money(total(d)) : ''}</strong>
          <div className="lf-kmove" onClick={e => e.stopPropagation()}><select value={k} onChange={e => setStage(d, e.target.value)}>{STAGES.map(s => <option key={s[0]} value={s[0]}>{s[1]}</option>)}</select>{(d.lines || []).length ? <button onClick={() => setQuote(d)} title="پیش‌فاکتور">🧾</button> : null}</div>
        </article>)}
      </div>;
    })}</div> : <div className="lf-cards">{cs.map(c => {
      const cd = (deals.items || []).filter(d => d.customerId === c.id), won = cd.filter(d => d.stage === 'won').reduce((a, d) => a + total(d), 0);
      return <button key={c.id} className="lf-card lf-cust" onClick={() => setCEdit(c)}><b>{c.name}</b><small>{[c.company, c.city, c.phone].filter(Boolean).join(' · ')}</small><div className="lf-chips"><span className="lf-chip">{fa(cd.length)} معامله</span>{won ? <span className="lf-chip ok">{money(won)}</span> : null}{c.nextFollowUp ? dueChip(c.nextFollowUp) : null}</div></button>;
    })}{!cs.length ? <p className="lf-empty">مشتری‌ای نیست.</p> : null}</div>}
    <FormDrawer open={!!cEdit} title={cEdit?.id ? 'ویرایش مشتری' : 'مشتری تازه'} fields={cFields} initial={cEdit} onClose={() => setCEdit(null)} onSubmit={b => cEdit.id ? customers.patch(cEdit.id, b) : customers.add(b)} extra={() => cEdit?.id ? <button type="button" className="lf-link del" onClick={() => { if (window.confirm('مشتری حذف شود؟')) { customers.remove(cEdit.id); setCEdit(null); } }}>حذف مشتری</button> : null} />
    <FormDrawer open={!!dEdit} title={dEdit?.id ? 'ویرایش معامله' : 'معاملهٔ تازه'} fields={dFields} initial={dEdit} onClose={() => setDEdit(null)} submitLabel="ذخیره"
      onSubmit={b => { const body = { ...b, lines: b.lines || [], vat: !!b.vat, wonAt: b.stage === 'won' ? (dEdit.wonAt || today) : dEdit.wonAt || null }; return dEdit.id ? deals.patch(dEdit.id, body) : deals.add(body); }}
      extra={(v, set) => <QuoteLines v={v} set={set} onPrint={() => setQuote({ ...dEdit, ...v })} onDelete={dEdit?.id ? () => { if (window.confirm('معامله حذف شود؟')) { deals.remove(dEdit.id); setDEdit(null); } } : null} />} />
    {quote ? <QuotePrint deal={quote} customer={cById[quote.customerId]} onClose={() => setQuote(null)} /> : null}
  </Page>;
}
function QuoteLines({ v, set, onPrint, onDelete }) {
  const lines = v.lines || [];
  const up = (i, k, x) => set('lines', lines.map((l, j) => j === i ? { ...l, [k]: k === 'desc' ? x : num(x) } : l));
  const sub = lines.reduce((a, l) => a + (l.qty || 0) * (l.price || 0), 0);
  return <div className="lf-quote-lines">
    <span className="lf-sub">اقلام پیش‌فاکتور</span>
    {lines.map((l, i) => <div key={i} className="lf-qline"><input value={l.desc || ''} onChange={e => up(i, 'desc', e.target.value)} placeholder="شرح کالا / خدمت" /><input value={l.qty ?? ''} onChange={e => up(i, 'qty', e.target.value)} inputMode="decimal" data-raw placeholder="تعداد" /><input value={l.unit || ''} onChange={e => set('lines', lines.map((y, j) => j === i ? { ...y, unit: e.target.value } : y))} placeholder="واحد" /><input value={l.price ? Number(l.price).toLocaleString('en-US') : ''} onChange={e => up(i, 'price', e.target.value)} inputMode="numeric" placeholder="فی (ریال)" /><button type="button" className="lf-x" onClick={() => set('lines', lines.filter((_, j) => j !== i))}>×</button></div>)}
    <button type="button" className="lf-link" onClick={() => set('lines', [...lines, { desc: '', qty: 1, unit: '', price: 0 }])}>＋ ردیف</button>
    <label className="lf-checkline"><input type="checkbox" checked={!!v.vat} onChange={e => set('vat', e.target.checked)} /> ۱۰٪ مالیات بر ارزش افزوده</label>
    <p className="lf-note">جمع: <b>{money(sub * (v.vat ? 1.1 : 1))}</b></p>
    <div className="lf-ops">{lines.length ? <button type="button" className="lf-btn ghost" onClick={onPrint}>🧾 نمایش / چاپ پیش‌فاکتور</button> : null}{onDelete ? <button type="button" className="lf-link del" onClick={onDelete}>حذف معامله</button> : null}</div>
  </div>;
}
function QuotePrint({ deal, customer, onClose }) {
  const lines = deal.lines || [], sub = lines.reduce((a, l) => a + (l.qty || 0) * (l.price || 0), 0), vat = deal.vat ? sub * 0.1 : 0;
  return <div className="lf-print-bg" onClick={onClose}><div className="lf-print" onClick={e => e.stopPropagation()} dir="rtl">
    <div className="lf-print-ops no-print"><button className="lf-btn" onClick={() => window.print()}>چاپ / ذخیرهٔ PDF</button><button className="lf-btn ghost" onClick={onClose}>بستن</button></div>
    <h1>پیش‌فاکتور</h1>
    <div className="lf-print-meta"><div><b>خریدار:</b> {customer?.name || '—'}{customer?.company ? ` · ${customer.company}` : ''}{customer?.phone ? ` · ${faD(customer.phone)}` : ''}</div><div><b>تاریخ:</b> {jl(todayIso())}</div><div><b>موضوع:</b> {deal.title}</div></div>
    <table><thead><tr><th>#</th><th>شرح</th><th>تعداد</th><th>واحد</th><th>فی (ریال)</th><th>مبلغ (ریال)</th></tr></thead>
      <tbody>{lines.map((l, i) => <tr key={i}><td>{fa(i + 1)}</td><td>{l.desc}</td><td>{fa(l.qty)}</td><td>{l.unit}</td><td>{fa(l.price, 0)}</td><td>{fa((l.qty || 0) * (l.price || 0), 0)}</td></tr>)}</tbody>
      <tfoot><tr><td colSpan={5}>جمع</td><td>{fa(sub, 0)}</td></tr>{vat ? <tr><td colSpan={5}>مالیات بر ارزش افزوده (۱۰٪)</td><td>{fa(vat, 0)}</td></tr> : null}<tr className="grand"><td colSpan={5}>مبلغ قابل پرداخت</td><td>{fa(sub + vat, 0)}</td></tr></tfoot></table>
    {deal.note ? <p>{deal.note}</p> : null}
  </div></div>;
}

/* ───────────────────────── Learning ───────────────────────── */
export function LearningPage({ Nav }) {
  const col = useCol('learning');
  const [edit, setEdit] = useState(null), [tab, setTab] = useState('active');
  const fields = [{ k: 'kind', l: 'نوع', t: 'sel', o: [['book', '📘 کتاب'], ['course', '🎓 دوره'], ['podcast', '🎧 پادکست / صوتی'], ['other', '• سایر']], def: 'book', half: true }, { k: 'status', l: 'وضعیت', t: 'sel', o: [['active', 'در حال خواندن / دیدن'], ['queue', 'بعداً'], ['done', 'تمام شد']], def: 'active', half: true }, { k: 'title', l: 'عنوان', req: true }, { k: 'author', l: 'نویسنده / مدرس', half: true }, { k: 'total', l: 'کل (صفحه / جلسه)', t: 'num', half: true }, { k: 'progress', l: 'تا الان', t: 'num', half: true }, { k: 'rating', l: 'امتیاز', t: 'sel', o: [['', '—'], ['1', '★'], ['2', '★★'], ['3', '★★★'], ['4', '★★★★'], ['5', '★★★★★']], half: true }, { k: 'notes', l: 'یادداشت و نکته‌های مهم', t: 'area', rows: 5 }];
  const items = (col.items || []).filter(x => (x.status || 'active') === tab).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const year = String(todayIso()).slice(0, 4), doneYear = (col.items || []).filter(x => x.status === 'done' && String(x.finishedAt || '').slice(0, 4) === year).length;
  const bump = (x, n) => { const p = Math.max(0, Math.min(x.total || 1e9, (x.progress || 0) + n)); col.patch(x.id, { progress: p, ...(x.total && p >= x.total ? { status: 'done', finishedAt: todayIso() } : {}) }); };
  return <Page Nav={Nav} kicker="کتاب و دوره" title="یادگیری" sub={`${fa(doneYear)} مورد امسال تمام شده`} actions={<button className="lf-btn" onClick={() => setEdit({})}>＋ کتاب / دوره</button>}>
    <div className="lf-tabs">{[['active', 'در جریان'], ['queue', 'بعداً'], ['done', 'تمام‌شده']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}<em>{fa((col.items || []).filter(x => (x.status || 'active') === k).length)}</em></button>)}</div>
    {col.items === null ? <p className="lf-empty">در حال دریافت…</p> : !items.length ? <p className="lf-empty">چیزی اینجا نیست.</p> :
      <div className="lf-cards">{items.map(x => { const pct = x.total ? Math.min(100, Math.round((x.progress || 0) / x.total * 100)) : null; return <article key={x.id} className="lf-card lf-learn">
        <div className="lf-row-head"><div><b>{{ book: '📘', course: '🎓', podcast: '🎧' }[x.kind] || '•'} {x.title}</b><small>{[x.author, x.rating ? '★'.repeat(x.rating) : ''].filter(Boolean).join(' · ')}</small></div><button className="lf-link" onClick={() => setEdit(x)}>ویرایش</button></div>
        {pct != null ? <><div className="lf-prog"><i style={{ width: `${pct}%` }} /></div><small className="lf-note">{fa(x.progress || 0)} از {fa(x.total)} {x.kind === 'book' ? 'صفحه' : 'جلسه'} · {fa(pct)}٪</small></> : null}
        {x.status !== 'done' ? <div className="lf-ops"><button className="lf-btn ghost" onClick={() => bump(x, x.kind === 'book' ? 10 : 1)}>＋{x.kind === 'book' ? '۱۰ صفحه' : '۱ جلسه'}</button><button className="lf-link" onClick={() => col.patch(x.id, { status: 'done', finishedAt: todayIso(), progress: x.total || x.progress })}>تمام شد ✓</button></div> : <small className="lf-note">تمام شد {x.finishedAt ? jShort(x.finishedAt) : ''}</small>}
        {x.notes ? <p className="lf-note clamp">{x.notes}</p> : null}
      </article>; })}</div>}
    <FormDrawer open={!!edit} title={edit?.id ? 'ویرایش' : 'کتاب / دورهٔ تازه'} fields={fields} initial={edit ? { ...edit, rating: edit.rating ? String(edit.rating) : '' } : null} onClose={() => setEdit(null)} onSubmit={b => { const body = { ...b, rating: b.rating ? Number(b.rating) : null, ...(b.status === 'done' && !edit.finishedAt ? { finishedAt: todayIso() } : {}) }; return edit.id ? col.patch(edit.id, body) : col.add(body); }} extra={() => edit?.id ? <button type="button" className="lf-link del" onClick={() => { col.remove(edit.id); setEdit(null); }}>حذف</button> : null} />
  </Page>;
}

/* ───────────────────────── Journal (with photos + "on this day") ───────────────────────── */
const readDataUrl = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
async function shrinkImage(file) {
  if (!/^image\//.test(file.type)) return readDataUrl(file);
  const img = await new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { URL.revokeObjectURL(u); res(im); }; im.onerror = rej; im.src = u; });
  const k = Math.min(1, 1800 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}
const MOODS = ['😞', '🙁', '😐', '🙂', '😄'];
export function JournalPage({ Nav }) {
  const col = useCol('journal');
  const today = todayIso();
  const [date, setDate] = useState(today), [text, setText] = useState(''), [mood, setMood] = useState(3), [busy, setBusy] = useState(false), [msg, setMsg] = useState(''), [q, setQ] = useState('');
  const [daily, setDaily] = useState([]);
  useEffect(() => { api('/api/daily?from=2015-01-01&to=' + today).then(d => setDaily(d.items || [])).catch(() => {}); }, []);
  const entry = (col.items || []).find(x => x.date === date);
  useEffect(() => { setText(entry?.text || ''); setMood(entry?.mood ?? 3); }, [date, col.items === null, entry?.id]);
  const save = async () => { setBusy(true); try { if (entry) await col.patch(entry.id, { text, mood }); else await col.add({ date, text, mood, photos: [] }); setMsg('ذخیره شد ✓'); setTimeout(() => setMsg(''), 1500); } catch (e) { setMsg(e.message); } setBusy(false); };
  const addPhotos = async files => {
    setBusy(true); setMsg('در حال ارسال عکس به تلگرام…');
    try {
      let e = entry || await col.add({ date, text, mood, photos: [] }), photos = [...(e.photos || [])];
      for (const f of files) { const r = await api('/api/attachments', { method: 'POST', body: JSON.stringify({ ownerType: 'col', ownerId: e.id, name: f.name.replace(/\.[^.]+$/, '') + '.jpg', dataUrl: await shrinkImage(f) }) }); photos.push({ url: r.url, id: r.id }); }
      await col.patch(e.id, { photos }); setMsg('عکس‌ها ذخیره شدند ✓');
    } catch (err) { setMsg(err.message); }
    setBusy(false);
  };
  const j = isoToJ(date);
  const onThisDay = [...(col.items || []).filter(x => x.date !== date && x.text), ...daily.filter(x => x.note || x.bestMoment).map(x => ({ id: 'd' + x.date, date: x.date, text: [x.note, x.bestMoment && `بهترین لحظه: ${x.bestMoment}`].filter(Boolean).join(' · '), daily: true }))]
    .filter(x => { const k = isoToJ(x.date); return k.jm === j.jm && k.jd === j.jd && k.jy < j.jy; }).sort((a, b) => b.date.localeCompare(a.date));
  const list = (col.items || []).filter(x => x.date !== date && (!q || String(x.text || '').includes(q))).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60);
  return <Page Nav={Nav} kicker="روزنگار" title={jl(date)} sub={date === today ? 'امروز' : ''} actions={<><button className="lf-btn ghost" onClick={() => setDate(addDays(date, -1))}>‹ دیروز</button>{date !== today ? <button className="lf-btn ghost" onClick={() => setDate(addDays(date, 1))}>فردا ›</button> : null}</>}>
    <section className="lf-card lf-journal">
      <div className="lf-moods">{MOODS.map((m, i) => <button key={i} className={mood === i + 1 ? 'on' : ''} onClick={() => setMood(i + 1)}>{m}</button>)}</div>
      <textarea rows={8} value={text} onChange={e => setText(e.target.value)} placeholder="امروز چه گذشت؟ چی یاد گرفتی؟ بابت چی ممنونی؟" />
      {entry?.photos?.length ? <div className="lf-photos">{entry.photos.map(p => <a key={p.url} href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt="" loading="lazy" /></a>)}</div> : null}
      <div className="lf-ops"><button className="lf-btn" onClick={save} disabled={busy}>ذخیره</button><label className="lf-btn ghost">📷 افزودن عکس<input type="file" accept="image/*" multiple hidden onChange={e => { const fs = [...(e.target.files || [])]; e.target.value = ''; if (fs.length) addPhotos(fs); }} /></label><small>{msg}</small></div>
    </section>
    {onThisDay.length ? <section className="lf-card lf-otd"><h2>🕰 در همین روز، سال‌های قبل</h2>{onThisDay.map(x => <article key={x.id}><b>{faD(isoToJ(x.date).jy)} · {Math.round(daysTo(x.date) / -365) > 0 ? `${fa(Math.round(daysTo(x.date) / -365))} سال پیش` : ''}</b><p>{x.text}</p>{x.photos?.length ? <div className="lf-photos sm">{x.photos.map(p => <img key={p.url} src={p.url} alt="" loading="lazy" />)}</div> : null}</article>)}</section> : null}
    <section className="lf-card"><div className="lf-row-head"><h2>نوشته‌های قبلی</h2><input className="lf-search" value={q} onChange={e => setQ(e.target.value)} placeholder="جستجو…" /></div>
      {list.length ? <div className="lf-jlist">{list.map(x => <button key={x.id} onClick={() => { setDate(x.date); window.scrollTo(0, 0); }}><b>{MOODS[(x.mood || 3) - 1]} {jl(x.date)}</b><span>{String(x.text || '').slice(0, 160)}</span>{x.photos?.length ? <em>📷 {fa(x.photos.length)}</em> : null}</button>)}</div> : <p className="lf-empty">هنوز چیزی ننوشتی.</p>}
    </section>
  </Page>;
}

/* ───────────────────────── Yearly goals ───────────────────────── */
export function GoalsPage({ Nav }) {
  const col = useCol('ygoals');
  const jy = isoToJ(todayIso()).jy;
  const [year, setYear] = useState(jy), [edit, setEdit] = useState(null), [ms, setMs] = useState({});
  const fields = [{ k: 'title', l: 'هدف', req: true, ph: 'مثلاً ۲۴ کتاب بخوانم' }, { k: 'area', l: 'حوزه', t: 'sel', o: [['work', '💼 کار'], ['money', '💰 مالی'], ['health', '💪 سلامت'], ['learn', '📚 یادگیری'], ['family', '❤️ خانواده'], ['personal', '✨ شخصی']], def: 'personal', half: true }, { k: 'target', l: 'عدد هدف', t: 'num', half: true, hint: 'اختیاری' }, { k: 'unit', l: 'واحد', half: true, ph: 'کتاب، کیلو، میلیون…' }, { k: 'current', l: 'تا الان', t: 'num', half: true }, { k: 'why', l: 'چرا مهم است؟', t: 'area' }];
  const items = (col.items || []).filter(g => Number(g.year) === year);
  const pct = g => g.target ? Math.min(100, Math.round((g.current || 0) / g.target * 100)) : (g.milestones || []).length ? Math.round((g.milestones.filter(m => m.done).length / g.milestones.length) * 100) : (g.done ? 100 : 0);
  const avg = items.length ? Math.round(items.reduce((a, g) => a + pct(g), 0) / items.length) : 0;
  const AREA = { work: '💼', money: '💰', health: '💪', learn: '📚', family: '❤️', personal: '✨' };
  return <Page Nav={Nav} kicker="اهداف سالانه" title={`سال ${faD(year)}`} sub={items.length ? `پیشرفت کلی ${fa(avg)}٪` : ''} actions={<><button dir="ltr" className="lf-btn ghost" onClick={() => setYear(year - 1)} aria-label="سال قبل">›</button><button dir="ltr" className="lf-btn ghost" onClick={() => setYear(year + 1)} aria-label="سال بعد">‹</button><button className="lf-btn" onClick={() => setEdit({ year })}>＋ هدف</button></>}>
    {col.items === null ? <p className="lf-empty">در حال دریافت…</p> : !items.length ? <p className="lf-empty">برای {faD(year)} هدفی تعریف نشده. هدف‌های بزرگ را بنویس و به گام‌های کوچک بشکن.</p> :
      <div className="lf-cards">{items.map(g => <article key={g.id} className={`lf-card lf-goal ${pct(g) >= 100 ? 'done' : ''}`}>
        <div className="lf-row-head"><div><b>{AREA[g.area] || '✨'} {g.title}</b>{g.why ? <small>{g.why}</small> : null}</div><strong>{fa(pct(g))}٪</strong></div>
        <div className="lf-prog"><i style={{ width: `${pct(g)}%` }} /></div>
        {g.target ? <div className="lf-ops"><small className="lf-note">{fa(g.current || 0)} از {fa(g.target)} {g.unit || ''}</small><button className="lf-btn ghost" onClick={() => col.patch(g.id, { current: (g.current || 0) + 1 })}>＋۱</button></div> : null}
        <ul className="lf-check">{(g.milestones || []).map((m, i) => <li key={i} className={m.done ? 'done' : ''} onClick={() => col.patch(g.id, { milestones: g.milestones.map((y, j) => j === i ? { ...y, done: !y.done } : y) })}><i>{m.done ? '✓' : ''}</i><span>{m.text}</span><button className="lf-x" onClick={e => { e.stopPropagation(); col.patch(g.id, { milestones: g.milestones.filter((_, j) => j !== i) }); }}>×</button></li>)}</ul>
        <form className="lf-inline" onSubmit={e => { e.preventDefault(); const t = (ms[g.id] || '').trim(); if (!t) return; col.patch(g.id, { milestones: [...(g.milestones || []), { text: t, done: false }] }); setMs({ ...ms, [g.id]: '' }); }}><input value={ms[g.id] || ''} onChange={e => setMs({ ...ms, [g.id]: e.target.value })} placeholder="گام کوچک بعدی…" /><button className="lf-btn">＋</button></form>
        <div className="lf-ops"><button className="lf-link" onClick={() => setEdit(g)}>ویرایش</button><button className="lf-link del" onClick={() => window.confirm('هدف حذف شود؟') && col.remove(g.id)}>حذف</button></div>
      </article>)}</div>}
    <FormDrawer open={!!edit} title={edit?.id ? 'ویرایش هدف' : 'هدف تازه'} fields={fields} initial={edit} onClose={() => setEdit(null)} onSubmit={b => edit.id ? col.patch(edit.id, b) : col.add({ ...b, year: edit.year, milestones: [] })} />
  </Page>;
}

export function FocusPage({ Nav }) {
  const col = useCol('focus');
  useEffect(() => { const f = () => col.reload(); window.addEventListener('lifeos:focus-saved', f); return () => window.removeEventListener('lifeos:focus-saved', f); }, []);
  const today = todayIso(), items = col.items || [];
  const sum = (from) => items.filter(x => x.date >= from).reduce((a, x) => a + (x.minutes || 0), 0);
  const days = [...Array(14)].map((_, i) => addDays(today, i - 13));
  const byLabel = Object.entries(items.filter(x => x.date >= addDays(today, -6)).reduce((m, x) => { m[x.label] = (m[x.label] || 0) + (x.minutes || 0); return m; }, {})).sort((a, b) => b[1] - a[1]);
  const h = m => m >= 60 ? `${fa(Math.floor(m / 60))} ساعت${m % 60 ? ` و ${fa(m % 60)} دقیقه` : ''}` : `${fa(m)} دقیقه`;
  return <Page Nav={Nav} kicker="تمرکز عمیق" title="تایمر تمرکز" sub="۲۵ دقیقه کار، ۵ دقیقه استراحت — زمان هر کار خودکار ثبت می‌شود">
    <div className="lf-grid2">
      <section className="lf-card"><FocusControl /></section>
      <section className="lf-card">
        <div className="lf-kpis sm"><div><small>امروز</small><b>{h(sum(today))}</b></div><div><small>۷ روز</small><b>{h(sum(addDays(today, -6)))}</b></div><div><small>جلسه‌ها امروز</small><b>{fa(items.filter(x => x.date === today).length)}</b></div></div>
        <h3>۱۴ روز اخیر</h3>
        <Bars data={days.map(d => ({ label: jShort(d), short: faD(isoToJ(d).jd), v: items.filter(x => x.date === d).reduce((a, x) => a + (x.minutes || 0), 0) }))} unit=" دقیقه" />
        <h3>این هفته روی چه کارهایی</h3>
        {byLabel.length ? <ul className="lf-list">{byLabel.map(([l, m]) => <li key={l}><b>{l}</b><em>{h(m)}</em></li>)}</ul> : <p className="lf-empty">هنوز جلسه‌ای ثبت نشده.</p>}
      </section>
    </div>
  </Page>;
}
/* ───────────────────────── Bills & subscriptions (finance tab) ───────────────────────── */
const CYC = [['monthly', 'ماهانه'], ['yearly', 'سالانه'], ['weekly', 'هفتگی']];
export function BillsPanel({ onChanged }) {
  const [items, setItems] = useState(null), [edit, setEdit] = useState(null), [msg, setMsg] = useState('');
  const load = () => api('/api/subscriptions').then(d => setItems(d.items || [])).catch(() => setItems([]));
  useEffect(() => { load(); }, []);
  const fields = [{ k: 'name', l: 'نام', req: true, ph: 'قبض برق، اینترنت، نتفلیکس…' }, { k: 'kind', l: 'نوع', t: 'sel', o: [['bill', '🧾 قبض'], ['sub', '🔁 اشتراک'], ['install', '🏦 قسط'], ['other', '• سایر']], def: 'bill', half: true }, { k: 'cycle', l: 'دوره', t: 'sel', o: CYC, def: 'monthly', half: true }, { k: 'amount', l: 'مبلغ تقریبی (ریال)', t: 'money', req: true, half: true }, { k: 'nextDate', l: 'موعد بعدی', t: 'date', req: true, half: true }, { k: 'note', l: 'یادداشت', ph: 'شناسهٔ قبض، حساب…' }];
  const save = async b => { if (edit.id) await api(`/api/subscriptions/${edit.id}`, { method: 'PATCH', body: JSON.stringify(b) }); else await api('/api/subscriptions', { method: 'POST', body: JSON.stringify(b) }); load(); };
  const pay = async x => { const amt = window.prompt(`مبلغ پرداخت‌شدهٔ «${x.name}» (ریال):`, String(x.amount)); if (amt === null) return; if (num(amt) && num(amt) !== x.amount) await api(`/api/subscriptions/${x.id}`, { method: 'PATCH', body: JSON.stringify({ amount: num(amt) }) }); await api(`/api/subscriptions/${x.id}/pay`, { method: 'POST' }); setMsg(`«${x.name}» پرداخت شد و به تراکنش‌ها رفت ✓`); load(); onChanged?.(); };
  const monthly = (items || []).reduce((a, x) => a + (x.cycle === 'yearly' ? x.amount / 12 : x.cycle === 'weekly' ? x.amount * 4.3 : x.amount), 0);
  const KIND = { bill: '🧾', sub: '🔁', install: '🏦', other: '•' };
  return <section className="fn-glass fn-list" dir="rtl">
    <div className="fn-head"><h2>🧾 قبض‌ها، اشتراک‌ها و اقساط</h2><button type="button" className="fn-add" onClick={() => setEdit({})}>＋ مورد تازه</button></div>
    <p className="sub">جمع ماهانهٔ تقریبی: <b>{money(monthly)}</b> · موعدها در پیام صبح تلگرام و صفحهٔ اصلی یادآوری می‌شوند.</p>
    {msg ? <p className="lf-note">{msg}</p> : null}
    {items === null ? <p className="fn-empty">در حال دریافت…</p> : !items.length ? <p className="fn-empty">موردی ثبت نشده.</p> : items.map(x => <article key={x.id} className="fn-rec">
      <div><b>{KIND[x.kind] || '🧾'} {x.name}</b><small>{(CYC.find(c => c[0] === x.cycle) || CYC[0])[1]}{x.note ? ` · ${x.note}` : ''}</small></div>
      {dueChip(x.nextDate)}
      <span className="amt neg">{money(x.amount)}</span>
      <span className="lf-ops"><button className="fn-add" onClick={() => pay(x)}>پرداخت شد</button><button className="lf-link" onClick={() => setEdit(x)}>ویرایش</button><button className="lf-link del" onClick={async () => { if (window.confirm('حذف شود؟')) { await api(`/api/subscriptions/${x.id}`, { method: 'DELETE' }); load(); } }}>حذف</button></span>
    </article>)}
    <FormDrawer open={!!edit} title={edit?.id ? 'ویرایش' : 'قبض / اشتراک تازه'} fields={fields} initial={edit} onClose={() => setEdit(null)} onSubmit={save} />
  </section>;
}
/* ───────────────────────── Life statistics (week hub tab) ───────────────────────── */
const pearson = (xs, ys) => { const n = xs.length; if (n < 5) return null; const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n; let num_ = 0, dx = 0, dy = 0; for (let i = 0; i < n; i++) { num_ += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; } return dx && dy ? num_ / Math.sqrt(dx * dy) : null; };
export function LifeStatsPage({ Nav }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    const today = todayIso(), from = addDays(today, -89);
    Promise.all([api(`/api/daily?from=${from}&to=${today}`).catch(() => ({ items: [] })), api('/api/col/health').catch(() => ({ items: [] })), api(`/api/transactions?from=${from}&to=${today}`).catch(() => ({ items: [] })), api('/api/col/focus').catch(() => ({ items: [] })), api(`/api/tasks?from=${from}&to=${today}`).catch(() => ({ items: [] })), api('/api/col/journal').catch(() => ({ items: [] }))])
      .then(([daily, health, tx, focus, tasks, journal]) => {
        const days = [...Array(90)].map((_, i) => addDays(from, i)), m = {};
        days.forEach(d => { m[d] = { d }; });
        (daily.items || []).forEach(x => { if (m[x.date]) { if (x.mood) m[x.date].mood = Number(x.mood); const s = parseFloat(String(x.sleep || '').replace(/[^\d.]/g, '')); if (s) m[x.date].sleep = s; } });
        (journal.items || []).forEach(x => { if (m[x.date] && x.mood && !m[x.date].mood) m[x.date].mood = x.mood * 2; });
        (health.items || []).forEach(x => { if (m[x.date]) { if (x.sleepH) m[x.date].sleep = x.sleepH; if (x.workoutMin) m[x.date].workout = x.workoutMin; if (x.steps) m[x.date].steps = x.steps; } });
        (tx.items || []).filter(x => x.kind === 'expense' && x.category !== 'انتقال').forEach(x => { if (m[x.date]) m[x.date].spend = (m[x.date].spend || 0) + x.amount; });
        (focus.items || []).forEach(x => { if (m[x.date]) m[x.date].focus = (m[x.date].focus || 0) + (x.minutes || 0); });
        (tasks.items || []).filter(x => x.done).forEach(x => { if (m[x.date]) m[x.date].done = (m[x.date].done || 0) + 1; });
        setData(days.map(d => m[d]));
      });
  }, []);
  const pairs = [['sleep', 'mood', 'خواب', 'حال'], ['sleep', 'spend', 'خواب', 'خرج'], ['workout', 'mood', 'ورزش', 'حال'], ['sleep', 'focus', 'خواب', 'تمرکز'], ['mood', 'spend', 'حال', 'خرج'], ['focus', 'done', 'تمرکز', 'کارهای انجام‌شده']];
  const insights = !data ? [] : pairs.map(([a, b, la, lb]) => { const rows = data.filter(x => Number.isFinite(x[a]) && Number.isFinite(x[b] ?? (b === 'spend' || b === 'done' || b === 'focus' ? 0 : NaN))).map(x => [x[a], x[b] ?? 0]); const r = pearson(rows.map(x => x[0]), rows.map(x => x[1])); return { a, b, la, lb, r, n: rows.length }; }).filter(x => x.r != null && Math.abs(x.r) >= 0.25).sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
  const say = x => `${x.r > 0 ? 'هر وقت' : 'هر وقت'} ${x.la} ${x.r > 0 ? 'بیشتر' : 'بیشتر'} بوده، ${x.lb} ${x.r > 0 ? 'هم بیشتر' : 'کمتر'} بوده`;
  const strength = r => Math.abs(r) >= 0.6 ? 'قوی' : Math.abs(r) >= 0.4 ? 'متوسط' : 'ضعیف';
  const avg = k => { const v = (data || []).map(x => x[k]).filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const wd = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
  const byWd = k => { const s = Array(7).fill(0), c = Array(7).fill(0); (data || []).forEach(x => { if (Number.isFinite(x[k])) { const i = new Date(x.d + 'T12:00:00Z').getUTCDay(); s[i] += x[k]; c[i]++; } }); return [6, 0, 1, 2, 3, 4, 5].map(i => ({ label: wd[i], short: wd[i].slice(0, 1), v: c[i] ? s[i] / c[i] : 0 })); };
  return <Page Nav={Nav} kicker="۹۰ روز اخیر" title="آمار زندگی" sub="رابطهٔ خواب، حال، ورزش، تمرکز و خرج‌ها — از روی داده‌های خودت">
    {!data ? <p className="lf-empty">در حال تحلیل…</p> : <>
      <div className="lf-kpis">
        <div><small>میانگین خواب</small><b>{avg('sleep') ? fa(avg('sleep')) : '—'}</b><em>ساعت</em></div>
        <div><small>میانگین حال</small><b>{avg('mood') ? fa(avg('mood')) : '—'}</b><em>از ۱۰</em></div>
        <div><small>تمرکز روزانه</small><b>{avg('focus') ? fa(avg('focus'), 0) : '—'}</b><em>دقیقه</em></div>
        <div><small>خرج روزانه</small><b>{avg('spend') ? money(avg('spend')) : '—'}</b></div>
      </div>
      <section className="lf-card"><h2>🔎 کشف‌ها</h2>
        {insights.length ? <ul className="lf-insights">{insights.map(x => <li key={x.a + x.b} className={x.r > 0 ? 'pos' : 'neg'}><b>{say(x)}</b><small>همبستگی {strength(x.r)} ({fa(x.r, 2)}) · {fa(x.n)} روز داده</small></li>)}</ul>
          : <p className="lf-empty">هنوز الگوی معناداری پیدا نشد. هرچه خواب، حال (روزنگار)، ورزش و تمرکز را بیشتر ثبت کنی، این‌جا دقیق‌تر می‌شود.</p>}
        <p className="lf-note">همبستگی یعنی «با هم تغییر کرده‌اند»، نه لزوماً «یکی باعث دیگری شده».</p>
      </section>
      <div className="lf-grid2">
        <section className="lf-card"><h2>خرج به تفکیک روز هفته</h2><Bars data={byWd('spend')} color="#fb7185" rtl /></section>
        <section className="lf-card"><h2>حال به تفکیک روز هفته</h2><Bars data={byWd('mood')} color="#34d399" rtl /></section>
      </div>
      <VocabStats />
    </>}
  </Page>;
}
