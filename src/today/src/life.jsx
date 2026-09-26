// Life & work modules: health, car, travel, projects (kanban), customers & sales, learning,
// journal, yearly goals, focus timer, shopping list, bills and life statistics.
// All of them sit on the generic per-user collections API (/api/col/<name>).
import { useEffect, useMemo, useRef, useState } from 'react';
import { JalaliDateInput, isoToJ, MONTHS } from './jdate';
import './life.css';

export const api = async (url, options) => {
  const r = await fetch(url, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.error || 'دریافت اطلاعات ناموفق بود.');
  return b;
};
export const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const faD = v => String(v ?? '').replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
export const fa = (n, max = 1) => Number(n || 0).toLocaleString('fa-IR', { maximumFractionDigits: max });
export const jl = iso => { if (!/^\d{4}-\d{2}-\d{2}/.test(iso || '')) return ''; const j = isoToJ(iso); return `${faD(j.jd)} ${MONTHS[j.jm - 1]} ${faD(j.jy)}`; };
export const jShort = iso => { if (!/^\d{4}-\d{2}-\d{2}/.test(iso || '')) return ''; const j = isoToJ(iso); return `${faD(j.jd)} ${MONTHS[j.jm - 1]}`; };
export const money = n => { const a = Math.abs(Number(n) || 0), f = v => v.toLocaleString('fa-IR', { maximumFractionDigits: v >= 100 ? 0 : 1 }); return (n < 0 ? '−' : '') + (a >= 1e9 ? `${f(a / 1e9)} میلیارد` : a >= 1e6 ? `${f(a / 1e6)} میلیون` : fa(a, 0)) + ' ریال'; };
const num = v => { const n = Number(String(v ?? '').replace(/[,٬]/g, '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))); return Number.isFinite(n) ? n : 0; };
export const daysTo = iso => Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(todayIso() + 'T00:00:00Z')) / 864e5);
const dueChip = iso => { if (!iso) return null; const d = daysTo(iso); const cls = d < 0 ? 'late' : d <= 7 ? 'soon' : ''; return <span className={`lf-due ${cls}`}>{d < 0 ? `${fa(-d)} روز گذشته` : d === 0 ? 'امروز' : d <= 30 ? `${fa(d)} روز دیگر` : jShort(iso)}</span>; };

export function useCol(name) {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  const load = () => api(`/api/col/${name}`).then(d => setItems(d.items || [])).catch(e => { setErr(e.message); setItems([]); });
  useEffect(() => { load(); }, [name]);
  const add = async body => { const r = await api(`/api/col/${name}`, { method: 'POST', body: JSON.stringify(body) }); setItems(xs => [...(xs || []), r]); return r; };
  const patch = async (id, body) => { setItems(xs => (xs || []).map(x => x.id === id ? { ...x, ...body } : x)); try { const r = await api(`/api/col/${name}/${id}`, { method: 'PATCH', body: JSON.stringify(body) }); setItems(xs => (xs || []).map(x => x.id === id ? r : x)); return r; } catch (e) { setErr(e.message); load(); } };
  const remove = async id => { setItems(xs => (xs || []).filter(x => x.id !== id)); try { await api(`/api/col/${name}/${id}`, { method: 'DELETE' }); } catch (e) { setErr(e.message); load(); } };
  return { items, add, patch, remove, reload: load, err, setErr };
}

export function Page({ Nav, kicker, title, sub, actions, children, className = '' }) {
  return <main className={`lf ${className}`} dir="rtl">
    <Nav />
    <div className="lf-page">
      <header className="lf-hero"><div><p>{kicker}</p><h1>{title}</h1>{sub ? <small>{sub}</small> : null}</div>{actions ? <div className="lf-hero-ops">{actions}</div> : null}</header>
      {children}
    </div>
  </main>;
}

// Side drawer with a form built from a field list; used by every module for add/edit.
export function FormDrawer({ open, title, fields, initial, onClose, onSubmit, submitLabel = 'ذخیره', extra }) {
  const [v, setV] = useState({});
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  useEffect(() => { if (open) { setV({ ...(Object.fromEntries(fields.filter(f => f.def !== undefined).map(f => [f.k, typeof f.def === 'function' ? f.def() : f.def]))), ...(initial || {}) }); setErr(''); } }, [open]);
  useEffect(() => { if (!open) return; const k = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [open]);
  if (!open) return null;
  const set = (k, x) => setV(o => ({ ...o, [k]: x }));
  const submit = async e => {
    e.preventDefault();
    const miss = fields.find(f => f.req && (v[f.k] === undefined || v[f.k] === ''));
    if (miss) { setErr(`«${miss.l}» لازم است.`); return; }
    const out = { ...v }; fields.forEach(f => { if (f.t === 'num' || f.t === 'money') out[f.k] = v[f.k] === '' || v[f.k] === undefined ? null : num(v[f.k]); });
    setBusy(true); try { await onSubmit(out); onClose(); } catch (x) { setErr(x.message); } setBusy(false);
  };
  return <div className="lf-drawer-bg" onClick={onClose}>
    <form className="lf-drawer" onClick={e => e.stopPropagation()} onSubmit={submit}>
      <header><h2>{title}</h2><button type="button" onClick={onClose} aria-label="بستن">×</button></header>
      <div className="lf-drawer-body">
        {fields.map(f => <label key={f.k} className={`lf-field ${f.half ? 'half' : ''}`}>
          <span>{f.l}{f.req ? ' *' : ''}{f.hint ? <em> ({f.hint})</em> : null}</span>
          {f.t === 'date' ? <JalaliDateInput value={v[f.k] || ''} onChange={x => set(f.k, x)} />
            : f.t === 'sel' ? <select value={v[f.k] ?? ''} onChange={e => set(f.k, e.target.value)}>{f.o.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select>
            : f.t === 'area' ? <textarea rows={f.rows || 3} value={v[f.k] ?? ''} onChange={e => set(f.k, e.target.value)} placeholder={f.ph || ''} />
            : <input value={v[f.k] ?? ''} onChange={e => set(f.k, e.target.value)} placeholder={f.ph || ''} inputMode={f.t === 'num' ? 'decimal' : f.t === 'money' ? 'numeric' : undefined} data-raw={f.t === 'num' ? '' : undefined} type={f.t === 'time' ? 'time' : 'text'} />}
        </label>)}
        {extra ? extra(v, set) : null}
        {err ? <p className="lf-err">{err}</p> : null}
      </div>
      <footer><button className="lf-btn" disabled={busy}>{busy ? '…' : submitLabel}</button><button type="button" className="lf-btn ghost" onClick={onClose}>انصراف</button></footer>
    </form>
  </div>;
}

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
export function ProjectsPage({ Nav }) {
  const projects = useCol('projects'), cards = useCol('cards');
  const [pid, setPid] = useState(() => { try { return localStorage.getItem('lifeos-project') || ''; } catch { return ''; } });
  const [edit, setEdit] = useState(null), [cardEdit, setCardEdit] = useState(null), [drag, setDrag] = useState(null), [quick, setQuick] = useState('');
  const list = (projects.items || []).filter(p => !p.archived);
  const cur = list.find(p => p.id === pid) || list[0] || null;
  useEffect(() => { if (cur) try { localStorage.setItem('lifeos-project', cur.id); } catch {} }, [cur?.id]);
  const mine = (cards.items || []).filter(c => cur && c.projectId === cur.id);
  const prog = p => { const cs = (cards.items || []).filter(c => c.projectId === p.id); return cs.length ? Math.round(cs.filter(c => c.col === 'done').length / cs.length * 100) : 0; };
  const pFields = [{ k: 'name', l: 'نام پروژه', req: true }, { k: 'client', l: 'کارفرما / مشتری', half: true }, { k: 'deadline', l: 'مهلت', t: 'date', half: true }, { k: 'color', l: 'رنگ', t: 'sel', o: PCOLORS.map((c, i) => [c, ['طلایی', 'آبی', 'سبز', 'صورتی', 'بنفش', 'نارنجی'][i]]), def: PCOLORS[0] }, { k: 'note', l: 'توضیح', t: 'area' }];
  const cFields = [{ k: 'title', l: 'عنوان', req: true }, { k: 'col', l: 'ستون', t: 'sel', o: COLS_K, def: 'todo', half: true }, { k: 'due', l: 'مهلت', t: 'date', half: true }, { k: 'owner', l: 'مسئول', half: true }, { k: 'prio', l: 'اولویت', t: 'sel', o: [['n', 'عادی'], ['h', 'بالا'], ['l', 'پایین']], def: 'n', half: true }, { k: 'note', l: 'جزئیات', t: 'area', rows: 4 }];
  const move = (c, col) => cards.patch(c.id, { col, doneAt: col === 'done' ? Date.now() : null });
  return <Page Nav={Nav} kicker="کار" title="پروژه‌ها" actions={<button className="lf-btn" onClick={() => setEdit({})}>＋ پروژه</button>}>
    {projects.items === null ? <p className="lf-empty">در حال دریافت…</p> : !list.length ? <p className="lf-empty">هنوز پروژه‌ای نساختی. برای هر پروژه یک تابلو با ستون‌های «انجام نشده، در حال انجام، بازبینی، انجام شد» ساخته می‌شود.</p> : <>
      <div className="lf-tabs">{list.map(p => <button key={p.id} className={cur?.id === p.id ? 'on' : ''} onClick={() => setPid(p.id)}><i style={{ background: p.color || PCOLORS[0] }} />{p.name}<em>{fa(prog(p))}٪</em></button>)}</div>
      {cur ? <section className="lf-card">
        <div className="lf-row-head"><div><h2 style={{ color: cur.color }}>{cur.name}</h2><small>{[cur.client, cur.deadline ? `مهلت ${jShort(cur.deadline)}` : ''].filter(Boolean).join(' · ')} {cur.deadline ? dueChip(cur.deadline) : null}</small></div>
          <div className="lf-ops"><button className="lf-link" onClick={() => setEdit(cur)}>ویرایش</button><button className="lf-link" onClick={() => projects.patch(cur.id, { archived: true })}>بایگانی</button></div></div>
        <div className="lf-prog"><i style={{ width: `${prog(cur)}%`, background: cur.color }} /></div>
        <form className="lf-inline" onSubmit={e => { e.preventDefault(); if (!quick.trim()) return; cards.add({ projectId: cur.id, title: quick.trim(), col: 'todo', prio: 'n' }); setQuick(''); }}><input value={quick} onChange={e => setQuick(e.target.value)} placeholder="کار تازه برای این پروژه… (Enter)" /><button className="lf-btn">＋</button></form>
        <div className="lf-kanban">{COLS_K.map(([k, label]) => {
          const cs = mine.filter(c => (c.col || 'todo') === k).sort((a, b) => (b.prio === 'h') - (a.prio === 'h') || String(a.due || '9').localeCompare(String(b.due || '9')));
          return <div key={k} className={`lf-kcol ${drag ? 'dropping' : ''}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const c = mine.find(x => x.id === drag); if (c && c.col !== k) move(c, k); setDrag(null); }}>
            <h3>{label}<em>{fa(cs.length)}</em></h3>
            {cs.map(c => <article key={c.id} className={`lf-kcard ${c.prio === 'h' ? 'hi' : ''}`} draggable onDragStart={() => setDrag(c.id)} onDragEnd={() => setDrag(null)} onClick={() => setCardEdit(c)}>
              <b>{c.title}</b>
              <small>{[c.owner, c.due ? jShort(c.due) : ''].filter(Boolean).join(' · ')}{c.due && c.col !== 'done' ? dueChip(c.due) : null}</small>
              <div className="lf-kmove" onClick={e => e.stopPropagation()}>{COLS_K.findIndex(x => x[0] === k) > 0 ? <button onClick={() => move(c, COLS_K[COLS_K.findIndex(x => x[0] === k) - 1][0])} aria-label="ستون قبل">›</button> : <span />}{COLS_K.findIndex(x => x[0] === k) < 3 ? <button onClick={() => move(c, COLS_K[COLS_K.findIndex(x => x[0] === k) + 1][0])} aria-label="ستون بعد">‹</button> : null}</div>
            </article>)}
          </div>;
        })}</div>
      </section> : null}
      {(projects.items || []).some(p => p.archived) ? <p className="lf-note">بایگانی: {(projects.items || []).filter(p => p.archived).map(p => <button key={p.id} className="lf-link" onClick={() => projects.patch(p.id, { archived: false })}>{p.name} ↩</button>)}</p> : null}
    </>}
    <FormDrawer open={!!edit} title={edit?.id ? 'ویرایش پروژه' : 'پروژهٔ تازه'} fields={pFields} initial={edit} onClose={() => setEdit(null)} onSubmit={async b => { if (edit.id) await projects.patch(edit.id, b); else { const r = await projects.add(b); setPid(r.id); } }} />
    <FormDrawer open={!!cardEdit} title="کارت" fields={cFields} initial={cardEdit} onClose={() => setCardEdit(null)} onSubmit={b => cards.patch(cardEdit.id, b)} extra={() => <button type="button" className="lf-link del" onClick={() => { cards.remove(cardEdit.id); setCardEdit(null); }}>حذف این کارت</button>} />
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
  return <Page Nav={Nav} kicker="روزنگار" title={jl(date)} sub={date === today ? 'امروز' : ''} actions={<><button className="lf-btn ghost" onClick={() => setDate(addDays(date, -1))}>› دیروز</button>{date !== today ? <button className="lf-btn ghost" onClick={() => setDate(addDays(date, 1))}>فردا ‹</button> : null}</>}>
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
  return <Page Nav={Nav} kicker="اهداف سالانه" title={`سال ${faD(year)}`} sub={items.length ? `پیشرفت کلی ${fa(avg)}٪` : ''} actions={<><button className="lf-btn ghost" onClick={() => setYear(year - 1)}>›</button><button className="lf-btn ghost" onClick={() => setYear(year + 1)}>‹</button><button className="lf-btn" onClick={() => setEdit({ year })}>＋ هدف</button></>}>
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

/* ───────────────────────── Focus timer (pomodoro) ───────────────────────── */
const FKEY = 'lifeos-focus';
const readFocus = () => { try { return JSON.parse(localStorage.getItem(FKEY) || 'null'); } catch { return null; } };
const writeFocus = v => { try { v ? localStorage.setItem(FKEY, JSON.stringify(v)) : localStorage.removeItem(FKEY); } catch {} window.dispatchEvent(new Event('lifeos:focus')); };
function useFocusTimer() {
  const [st, setSt] = useState(readFocus), [, tick] = useState(0);
  useEffect(() => { const f = () => setSt(readFocus()); window.addEventListener('lifeos:focus', f); window.addEventListener('storage', f); const t = setInterval(() => tick(x => x + 1), 1000); return () => { window.removeEventListener('lifeos:focus', f); window.removeEventListener('storage', f); clearInterval(t); }; }, []);
  const left = st ? Math.max(0, Math.round((st.endAt - Date.now()) / 1000)) : 0;
  return { st, left };
}
async function finishFocus(st, partial = false) {
  const minutes = Math.round(((partial ? Date.now() : st.endAt) - st.startAt) / 60000);
  writeFocus(null);
  if (st.kind === 'focus' && minutes >= 1) { try { await api('/api/col/focus', { method: 'POST', body: JSON.stringify({ date: todayIso(), minutes, label: st.label || 'بدون برچسب', projectId: st.projectId || null, at: Date.now() }) }); } catch {} }
  try { if ('Notification' in window && Notification.permission === 'granted') new Notification(st.kind === 'focus' ? '⏰ وقت استراحت!' : '💪 برگرد سر کار', { body: st.kind === 'focus' ? `${minutes} دقیقه تمرکز روی «${st.label || 'کار'}» ثبت شد.` : 'استراحت تمام شد.', icon: '/assets/img/icon-192.png' }); } catch {}
  try { const a = new AudioContext(), o = a.createOscillator(), g = a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.setValueAtTime(.2, a.currentTime); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + 1.2); o.start(); o.stop(a.currentTime + 1.2); } catch {}
  window.dispatchEvent(new Event('lifeos:focus-saved'));
}
const mmss = s => `${faD(String(Math.floor(s / 60)).padStart(2, '0'))}:${faD(String(s % 60).padStart(2, '0'))}`;
export function FocusControl({ compact = false }) {
  const { st, left } = useFocusTimer();
  const [label, setLabel] = useState(() => { try { return localStorage.getItem('lifeos-focus-label') || ''; } catch { return ''; } }), [len, setLen] = useState(25);
  const done = useRef(false);
  useEffect(() => { if (st && left === 0 && !done.current) { done.current = true; finishFocus(st); } if (!st || left > 0) done.current = false; }, [st, left]);
  const start = (kind, mins) => { try { localStorage.setItem('lifeos-focus-label', label); if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch {} writeFocus({ kind, label: kind === 'focus' ? label : 'استراحت', startAt: Date.now(), endAt: Date.now() + mins * 60000, mins }); };
  const total = st ? st.mins * 60 : len * 60, pct = st ? 100 - (left / total) * 100 : 0;
  return <div className={`lf-focus ${compact ? 'compact' : ''} ${st?.kind || ''}`}>
    <div className="lf-ring" style={{ '--p': `${pct}%` }}><div><b>{st ? mmss(left) : mmss(len * 60)}</b><small>{st ? (st.kind === 'focus' ? st.label || 'تمرکز' : 'استراحت') : 'آماده'}</small></div></div>
    {st ? <div className="lf-ops"><button className="lf-btn ghost" onClick={() => finishFocus(st, true)}>پایان و ثبت</button><button className="lf-link del" onClick={() => writeFocus(null)}>لغو</button></div> : <>
      <input className="lf-focus-label" value={label} onChange={e => setLabel(e.target.value)} placeholder="روی چه کاری تمرکز می‌کنی؟" />
      <div className="lf-ops">{[25, 50, 90].map(m => <button key={m} className={`lf-chip-btn ${len === m ? 'on' : ''}`} onClick={() => setLen(m)}>{fa(m)} دقیقه</button>)}</div>
      <div className="lf-ops"><button className="lf-btn" onClick={() => start('focus', len)}>▶ شروع تمرکز</button><button className="lf-btn ghost" onClick={() => start('break', 5)}>☕ ۵ دقیقه استراحت</button></div>
    </>}
  </div>;
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
export function FocusCard({ Card, Icon }) {
  return <Card className="mini-card focus-card" icon={Icon} title="تایمر تمرکز" action={<a href="/?page=focus">آمار ←</a>}><FocusControl compact /></Card>;
}

/* ───────────────────────── Shopping list (notes tab) ───────────────────────── */
export function ShoppingPanel() {
  const col = useCol('shopping');
  const [t, setT] = useState(''), [code, setCode] = useState(null), [msg, setMsg] = useState('');
  useEffect(() => { api('/api/me').then(d => setCode(d.user?.shopCode || null)).catch(() => {}); }, []);
  const add = async e => { e.preventDefault(); const parts = t.split(/[،,\n]+/).map(x => x.trim()).filter(Boolean); if (!parts.length) return; await api('/api/col/shopping', { method: 'POST', body: JSON.stringify({ items: parts.map(text => ({ text, done: false })) }) }); setT(''); col.reload(); };
  const share = async (reset = false) => { const r = await api('/api/shop/share', { method: 'POST', body: JSON.stringify({ reset }) }); setCode(r.code); const url = `${location.origin}/s/${r.code}`; try { await navigator.clipboard.writeText(url); setMsg('لینک کپی شد ✓ — برای خانواده بفرست.'); } catch { setMsg(url); } };
  const items = (col.items || []).slice().sort((a, b) => a.done - b.done || (b.createdAt || 0) - (a.createdAt || 0));
  return <section className="lf-card lf-shop" dir="rtl">
    <div className="lf-row-head"><h2>🛒 لیست خرید</h2><div className="lf-ops"><button className="lf-btn ghost" onClick={() => share(false)}>🔗 لینک مشترک</button>{code ? <button className="lf-link" onClick={() => share(true)} title="لینک قبلی باطل می‌شود">لینک تازه</button> : null}</div></div>
    <form className="lf-inline" onSubmit={add}><input value={t} onChange={e => setT(e.target.value)} placeholder="نان، شیر، پنیر… (با ویرگول چندتا با هم)" /><button className="lf-btn">افزودن</button></form>
    <ul className="lf-check big">{items.map(x => <li key={x.id} className={x.done ? 'done' : ''} onClick={() => col.patch(x.id, { done: !x.done })}><i>{x.done ? '✓' : ''}</i><span>{x.text}</span><button className="lf-x" onClick={e => { e.stopPropagation(); col.remove(x.id); }}>×</button></li>)}</ul>
    {items.some(x => x.done) ? <button className="lf-link del" onClick={() => items.filter(x => x.done).forEach(x => col.remove(x.id))}>پاک کردن خریده‌شده‌ها</button> : null}
    <p className="lf-note">{msg || 'با لینک مشترک، خانواده بدون حساب کاربری به همین لیست اضافه می‌کنند. در تلگرام هم: «/خرید نان، شیر» یا «/لیست».'}</p>
  </section>;
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
export function BillsWeekCard({ Card, Icon }) {
  const [items, setItems] = useState(null);
  useEffect(() => { api('/api/subscriptions').then(d => setItems((d.items || []).filter(x => x.nextDate <= addDays(todayIso(), 10)))).catch(() => setItems([])); }, []);
  return <Card className="mini-card" icon={Icon} title="قبض‌ها و اقساط نزدیک" action={<a href="/?page=finance&tab=bills">همه ←</a>}>
    {items === null ? <p className="empty">در حال دریافت…</p> : !items.length ? <p className="empty">تا ۱۰ روز آینده موعدی نیست.</p> : <div className="mini-list">{items.map(x => <a key={x.id} className="mini-note" href="/?page=finance&tab=bills"><b>{x.name} {dueChip(x.nextDate)}</b><small>{money(x.amount)}</small></a>)}</div>}
  </Card>;
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
    </>}
  </Page>;
}
