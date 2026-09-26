import React, { useEffect, useRef, useState } from 'react';

// Shared Jalali (Shamsi) date input — stores/returns ISO Gregorian "YYYY-MM-DD" like <input type="date">,
// but shows and picks dates in the Persian calendar.
const div = (a, b) => Math.trunc(a / b), mod = (a, b) => a - Math.trunc(a / b) * b;
function jalCal(jy) {
  const br = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  let leapJ = -14, jp = br[0], jump, n;
  for (let i = 1; i < br.length; i += 1) { const jm = br[i]; jump = jm - jp; if (jy < jm) break; leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4); jp = jm; }
  n = jy - jp; leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4); if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const gy = jy + 621, leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150, march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4); if (leap === -1) leap = 4;
  return { leap, gy, march };
}
function g2d(gy, gm, gd) { const d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408; return d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752; }
function d2g(jdn) { let j = 4 * jdn + 139361631; j += div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908; const i = div(mod(j, 1461), 4) * 5 + 308; return { gd: div(mod(i, 153), 5) + 1, gm: mod(div(i, 153), 12) + 1, gy: div(j, 1461) - 100100 + div(8 - mod(div(i, 153), 12) - 1, 6) }; }
const j2d = (jy, jm, jd) => { const r = jalCal(jy); return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1; };
function d2j(jdn) { const gy = d2g(jdn).gy; let jy = gy - 621; const r = jalCal(jy); let k = jdn - g2d(gy, 3, r.march); if (k >= 0) { if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 }; k -= 186; } else { jy -= 1; k += 179; if (r.leap === 1) k += 1; } return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 }; }

export const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const WD = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
const faD = v => String(v ?? '').replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const pad = n => String(n).padStart(2, '0');
export const isoToJ = iso => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return d2j(g2d(y, m, d)); };
export const jToIso = (jy, jm, jd) => { const g = d2g(j2d(jy, jm, jd)); return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`; };
export const monthLen = (jy, jm) => jm <= 6 ? 31 : jm < 12 ? 30 : jalCal(jy).leap === 0 ? 30 : 29;
const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const validIso = v => /^\d{4}-\d{2}-\d{2}/.test(String(v || ''));
export const jLabel = iso => { if (!validIso(iso)) return ''; const j = isoToJ(iso); return `${faD(j.jd)} ${MONTHS[j.jm - 1]} ${faD(j.jy)}`; };

let EVENTS = null;
const loadEvents = () => (EVENTS ||= fetch('/data/iran-events.json').then(r => r.json()).catch(() => ({})));

export function JalaliDateInput({ value, defaultValue, onChange, name, required, placeholder = 'انتخاب تاریخ', clearable = true, className = '', min }) {
  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue || '');
  const val = controlled ? (value || '') : inner;
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const set = v => { if (!controlled) setInner(v); onChange && onChange(v); };
  useEffect(() => {
    if (!open) return;
    const down = e => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    const key = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', down); window.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down); window.removeEventListener('keydown', key); };
  }, [open]);
  return <span className={`jdi ${className}`} ref={wrap}>
    {name && <input type="hidden" name={name} value={val} />}
    <button type="button" className={`jdi-btn ${val ? 'has' : ''}`} onClick={() => setOpen(o => !o)} aria-haspopup="dialog" aria-invalid={required && !val ? true : undefined}>
      <span>{val && validIso(val) ? jLabel(val) : placeholder}</span>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
    </button>
    {open && <JPop value={validIso(val) ? val : ''} min={min} clearable={clearable && !required} onPick={v => { set(v); setOpen(false); }} />}
  </span>;
}

function JPop({ value, onPick, clearable, min }) {
  const t = todayIso();
  const start = isoToJ(value || t);
  const [ym, setYm] = useState({ jy: start.jy, jm: start.jm });
  const [events, setEvents] = useState({});
  useEffect(() => { loadEvents().then(setEvents); }, []);
  const shift = n => setYm(({ jy, jm }) => { const m = jm + n; return m < 1 ? { jy: jy - 1, jm: 12 } : m > 12 ? { jy: jy + 1, jm: 1 } : { jy, jm: m }; });
  const first = jToIso(ym.jy, ym.jm, 1);
  const [fy, fm, fd] = first.split('-').map(Number);
  const lead = (new Date(fy, fm - 1, fd).getDay() + 1) % 7;
  const len = monthLen(ym.jy, ym.jm);
  return <div className="jdi-pop" role="dialog" aria-label="انتخاب تاریخ">
    <div className="jdi-head">
      <button type="button" onClick={() => setYm(y => ({ ...y, jy: y.jy - 1 }))} aria-label="سال قبل">»</button>
      <button type="button" onClick={() => shift(-1)} aria-label="ماه قبل">›</button>
      <b>{MONTHS[ym.jm - 1]} {faD(ym.jy)}</b>
      <button type="button" onClick={() => shift(1)} aria-label="ماه بعد">‹</button>
      <button type="button" onClick={() => setYm(y => ({ ...y, jy: y.jy + 1 }))} aria-label="سال بعد">«</button>
    </div>
    <div className="jdi-grid">
      {WD.map((w, i) => <small key={w} className={i === 6 ? 'off' : ''}>{w}</small>)}
      {[...Array(lead)].map((_, i) => <span key={'b' + i} />)}
      {[...Array(len)].map((_, i) => {
        const iso = jToIso(ym.jy, ym.jm, i + 1), wd = (lead + i) % 7;
        const occ = events[`${ym.jy}${pad(ym.jm)}${pad(i + 1)}`] || [];
        const off = wd === 6 || occ.some(e => e.h);
        return <button type="button" key={iso} disabled={min && iso < min} title={occ.map(e => e.t.replace(/\[.*?\]/g, '').trim()).join('\n')}
          className={`${off ? 'off' : ''} ${iso === t ? 'today' : ''} ${iso === value ? 'sel' : ''}`} onClick={() => onPick(iso)}>{faD(i + 1)}</button>;
      })}
    </div>
    <div className="jdi-foot">
      <button type="button" onClick={() => onPick(t)}>امروز</button>
      {clearable && <button type="button" onClick={() => onPick('')}>پاک کردن</button>}
    </div>
  </div>;
}
