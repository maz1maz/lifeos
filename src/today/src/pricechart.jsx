import React, { useEffect, useMemo, useRef, useState } from 'react';

// Line chart for a TGJU symbol with range tabs (week … 2 years), min/max, hover crosshair.
const RANGES = [['7', 'هفته', 7], ['30', 'ماه', 30], ['90', '۳ ماه', 90], ['365', 'سال', 365], ['730', '۲ سال', 730]];
const fa = (n, d = 0) => { const v = Number(n || 0); return v.toLocaleString('fa-IR', { maximumFractionDigits: Math.abs(v) >= 1000 ? 0 : d }); };
const jDate = iso => { try { return new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${iso}T12:00:00`)); } catch { return iso; } };
const CACHE = {};

export function PriceChart({ symbol, name, unit = 'ریال', onClose }) {
  const [range, setRange] = useState('30');
  const [all, setAll] = useState(null), [err, setErr] = useState('');
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);
  useEffect(() => {
    let live = true; setAll(null); setErr('');
    (CACHE[symbol] ||= fetch(`/api/tgju/history?key=${encodeURIComponent(symbol)}&days=730`, { credentials: 'include' }).then(r => r.json()))
      .then(d => { if (!live) return; if (d.error) { setErr(d.error); delete CACHE[symbol]; } setAll((d.items || []).filter(x => Number(x.price) > 0)); })
      .catch(() => { if (live) { setErr('دریافت تاریخچه ناموفق بود.'); setAll([]); delete CACHE[symbol]; } });
    return () => { live = false; };
  }, [symbol]);
  useEffect(() => { const k = e => e.key === 'Escape' && onClose && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);

  const days = RANGES.find(r => r[0] === range)[2];
  const pts = useMemo(() => (all || []).slice(-days), [all, days]);
  const W = 640, H = 240, P = { t: 14, r: 12, b: 26, l: 12 };
  const vals = pts.map(p => Number(p.price)), min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const x = i => P.l + (pts.length > 1 ? i / (pts.length - 1) : 0) * (W - P.l - P.r);
  const y = v => P.t + (1 - (v - min) / span) * (H - P.t - P.b);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.price).toFixed(1)}`).join('');
  const area = pts.length ? `${line}L${x(pts.length - 1)},${H - P.b}L${x(0)},${H - P.b}Z` : '';
  const first = vals[0], last = vals[vals.length - 1], chg = first ? (last - first) / first * 100 : 0, up = chg >= 0;
  const color = up ? '#34d399' : '#f87171';
  const onMove = e => {
    if (!pts.length || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W;
    const i = Math.max(0, Math.min(pts.length - 1, Math.round((px - P.l) / (W - P.l - P.r) * (pts.length - 1))));
    setHover(i);
  };
  const h = hover != null ? pts[hover] : null;
  const grid = [0, .25, .5, .75, 1].map(f => min + span * f);

  return <div className="pc-backdrop" onClick={onClose}>
    <div className="pc-box" onClick={e => e.stopPropagation()} role="dialog" aria-label={`نمودار ${name}`}>
      <div className="pc-head">
        <div><b>{name}</b><span>{h ? jDate(h.date) : pts.length ? `${jDate(pts[0].date)} تا ${jDate(pts[pts.length - 1].date)}` : ''}</span></div>
        <div className="pc-price"><strong>{fa(h ? h.price : last, 2)}</strong><small>{unit}</small>{pts.length > 1 && !h && <em className={up ? 'up' : 'down'}>{up ? '▲' : '▼'} {fa(Math.abs(chg), 2)}٪</em>}</div>
        <button type="button" className="pc-x" onClick={onClose} aria-label="بستن">×</button>
      </div>
      <div className="pc-ranges">{RANGES.map(([k, l]) => <button type="button" key={k} className={range === k ? 'on' : ''} onClick={() => { setRange(k); setHover(null); }}>{l}</button>)}</div>
      {all === null ? <div className="pc-empty">در حال دریافت…</div> : pts.length < 2 ? <div className="pc-empty">{err || 'دادهٔ کافی برای این بازه نیست.'}</div> :
        <svg ref={svgRef} className="pc-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onMouseMove={onMove} onMouseLeave={() => setHover(null)} onTouchMove={e => onMove(e.touches[0])} onTouchEnd={() => setHover(null)}>
          <defs><linearGradient id="pcfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".28" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
          {grid.map((g, i) => <line key={i} x1={P.l} x2={W - P.r} y1={y(g)} y2={y(g)} className="pc-grid" />)}
          <path d={area} fill="url(#pcfill)" />
          <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          {h && <><line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} className="pc-cross" /><circle cx={x(hover)} cy={y(h.price)} r="4" fill={color} stroke="#0a0a0b" strokeWidth="2" /></>}
        </svg>}
      {pts.length > 1 && <div className="pc-foot"><span>کمترین <b>{fa(min, 2)}</b></span><span>بیشترین <b>{fa(max, 2)}</b></span><span>{fa(pts.length)} روز معاملاتی</span></div>}
    </div>
  </div>;
}
