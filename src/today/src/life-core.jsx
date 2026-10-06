// Shared helpers of the life/work modules (api, dates, money, per-user collections, page shell, form drawer).
// Split out of life.jsx so the Today page and small modules can use them without loading every life page;
// life.jsx re-exports all of it, so existing imports (and the seyfikhani studio build) keep working.
import { useEffect, useRef, useState } from 'react';
import { JalaliDateInput, isoToJ, MONTHS } from './jdate';

export const api = async (url, options) => {
  // the personal-site build (studio.jsx) routes these pages through its own proxy
  if (typeof window !== 'undefined' && window.__lifeosApi) return window.__lifeosApi(url, options);
  const r = await fetch(url, { credentials: 'include', cache: 'no-store', ...options, headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } });
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
export const num = v => { const n = Number(String(v ?? '').replace(/[,٬]/g, '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))); return Number.isFinite(n) ? n : 0; };
export const daysTo = iso => Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(todayIso() + 'T00:00:00Z')) / 864e5);
export const dueChip = iso => { if (!iso) return null; const d = daysTo(iso); const cls = d < 0 ? 'late' : d <= 7 ? 'soon' : ''; return <span className={`lf-due ${cls}`}>{d < 0 ? `${fa(-d)} روز گذشته` : d === 0 ? 'امروز' : d <= 30 ? `${fa(d)} روز دیگر` : jShort(iso)}</span>; };

// D1 currently stores the app state in one record.  Two simultaneous collection
// mutations can therefore write stale snapshots over one another.  Serialize
// browser-side collection writes so an optimistic tick cannot be undone by the
// next background checklist/project write.
let colMutationQueue = Promise.resolve();
const queueColMutation = work => {
  const next = colMutationQueue.then(work, work);
  colMutationQueue = next.catch(() => {});
  return next;
};

// Edits the server refused or never got (after the connection-level retries): kept on screen and listed in
// <SaveErrorBar> with a retry button, instead of silently reverting to the old value.
const saveFailures = new Map(), saveListeners = new Set();
const notifySave = () => saveListeners.forEach(f => f());
export function SaveErrorBar() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force(x => x + 1); saveListeners.add(f); return () => { saveListeners.delete(f); }; }, []);
  const list = [...saveFailures.values()];
  if (!list.length) return null;
  return <div className="lf-save-error" role="alert"><span>⚠ {fa(list.length)} تغییر ذخیره نشد{list[list.length - 1].message ? `: ${list[list.length - 1].message}` : ''}</span><button type="button" onClick={() => list.forEach(x => x.retry())}>تلاش دوباره</button></div>;
}
export function useCol(name) {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  // edits not yet confirmed by the server, re-applied over any reload that lands before them
  const unsaved = useRef(new Map());
  // a reload waits for writes already queued (the seyfikhani proxy is slow: a read sent right after an
  // edit used to return the old row, so the typed value vanished and came back seconds later)
  const load = () => colMutationQueue.then(() => api(`/api/col/${name}`)).then(d => setItems((d.items || []).map(x => unsaved.current.has(x.id) ? { ...x, ...unsaved.current.get(x.id) } : x))).catch(e => { setErr(e.message); setItems(xs => xs || []); });
  useEffect(() => { load(); }, [name]);
  const upsertLocal = (xs, row) => { const list = xs || [], index = list.findIndex(item => item.id === row.id); return index < 0 ? [...list, row] : list.map((item, i) => i === index ? row : item); };
  const add = async body => { const r = await queueColMutation(() => api(`/api/col/${name}`, { method: 'POST', body: JSON.stringify(body) })); setItems(xs => upsertLocal(xs, r)); return r; };
  const addMany = async rows => {
    if (!rows?.length) return [];
    const result = await queueColMutation(() => api(`/api/col/${name}`, { method: 'POST', body: JSON.stringify({ items: rows }) }));
    const made = result.items || [];
    setItems(xs => made.reduce((next, row) => upsertLocal(next, row), xs || []));
    return made;
  };
  // a server reply only replaces the row when no newer patch for it is in flight; otherwise quick
  // successive clicks flicker (reply #1 briefly undoes the optimistic state of click #2)
  const patchSeq = useRef({});
  const patch = async (id, body) => { const seq = patchSeq.current[id] = (patchSeq.current[id] || 0) + 1; unsaved.current.set(id, { ...(unsaved.current.get(id) || {}), ...body }); setItems(xs => (xs || []).map(x => x.id === id ? { ...x, ...body } : x)); try { const r = await queueColMutation(() => api(`/api/col/${name}/${id}`, { method: 'PATCH', body: JSON.stringify(body) })); if (patchSeq.current[id] === seq) { unsaved.current.delete(id); setItems(xs => (xs || []).map(x => x.id === id ? r : x)); if (saveFailures.delete(`${name}|${id}`)) notifySave(); } return r; } catch (e) { setErr(e.message); if (patchSeq.current[id] === seq) { const key = `${name}|${id}`; saveFailures.set(key, { message: e.message, retry: () => { saveFailures.delete(key); notifySave(); return patch(id, unsaved.current.get(id) || body); } }); notifySave(); } } };
  const remove = async id => { setItems(xs => (xs || []).filter(x => x.id !== id)); try { await queueColMutation(() => api(`/api/col/${name}/${id}`, { method: 'DELETE' })); } catch (e) { setErr(e.message); load(); } };
  return { items, add, addMany, patch, remove, reload: load, err, setErr };
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
// money fields show thousands separators even for values filled in by code (numgroup only reacts to typing)
const grp = x => { if (x === undefined || x === null || x === '') return ''; const t = String(x); return /^\d+$/.test(t) ? Number(t).toLocaleString('en-US') : typeof x === 'number' ? x.toLocaleString('en-US') : t; };
export function FormDrawer({ open, title, fields, initial, onClose, onSubmit, submitLabel = 'ذخیره', extra }) {
  const [v, setV] = useState({});
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  useEffect(() => { if (open) { setV({ ...(Object.fromEntries(fields.filter(f => f.def !== undefined).map(f => [f.k, typeof f.def === 'function' ? f.def() : f.def]))), ...(initial || {}) }); setErr(''); } }, [open]);
  useEffect(() => { if (!open) return; const k = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [open]);
  if (!open) return null;
  const set = (k, x) => setV(o => ({ ...o, [k]: x }));
  const submit = async e => {
    e.preventDefault();
    const vis = f => !f.show || f.show(v);
    const miss = fields.find(f => vis(f) && f.req && (v[f.k] === undefined || v[f.k] === ''));
    if (miss) { setErr(`«${miss.l}» لازم است.`); return; }
    const out = { ...v }; fields.forEach(f => { if (f.calc) out[f.k] = f.calc(v); else if (f.t === 'num' || f.t === 'money') out[f.k] = v[f.k] === '' || v[f.k] === undefined ? null : num(v[f.k]); });
    setBusy(true); try { await onSubmit(out); onClose(); } catch (x) { setErr(x.message); } setBusy(false);
  };
  return <div className="lf-drawer-bg" onClick={onClose}>
    <form className="lf-drawer" onClick={e => e.stopPropagation()} onSubmit={submit}>
      <header><h2>{title}</h2><button type="button" onClick={onClose} aria-label="بستن">×</button></header>
      <div className="lf-drawer-body">
        {fields.filter(f => !f.show || f.show(v)).map(f => { const value = f.calc ? f.calc(v) : v[f.k]; return <label key={f.k} className={`lf-field ${f.half ? 'half' : ''}`}>
          <span>{f.l}{f.req ? ' *' : ''}{f.hint ? <em> ({f.hint})</em> : null}</span>
          {f.t === 'days' ? <span className="lf-days">{f.o.map(([k, l]) => { const on = (v[f.k] || []).map(Number).includes(k); return <button type="button" key={k} className={on ? 'on' : ''} onClick={() => set(f.k, on ? (v[f.k] || []).filter(x => Number(x) !== k) : [...(v[f.k] || []), k])}>{l}</button>; })}</span>
            : f.t === 'check' ? <span className="lf-check-toggle"><input type="checkbox" checked={!!value} onChange={e => set(f.k, e.target.checked)} /> <b>{value ? 'انجام شد' : 'انجام نشده'}</b></span>
            : f.t === 'date' ? <JalaliDateInput value={v[f.k] || ''} onChange={x => set(f.k, x)} />
            : f.t === 'sel' ? <select value={v[f.k] ?? ''} onChange={e => set(f.k, e.target.value)}>{f.o.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select>
            : f.t === 'area' ? <textarea rows={f.rows || 3} value={value ?? ''} onChange={e => set(f.k, e.target.value)} placeholder={f.ph || ''} readOnly={!!f.calc} />
            : <input value={f.t === 'money' ? grp(value) : value ?? ''} onChange={e => set(f.k, e.target.value)} placeholder={f.ph || ''} inputMode={f.t === 'num' ? 'decimal' : f.t === 'money' ? 'numeric' : undefined} data-raw={f.t === 'num' ? '' : undefined} type={f.t === 'time' ? 'time' : 'text'} readOnly={!!f.calc} />}
        </label>; })}
        {extra ? extra(v, set) : null}
        {err ? <p className="lf-err">{err}</p> : null}
      </div>
      <footer><button className="lf-btn" disabled={busy}>{busy ? '…' : submitLabel}</button><button type="button" className="lf-btn ghost" onClick={onClose}>انصراف</button></footer>
    </form>
  </div>;
}
