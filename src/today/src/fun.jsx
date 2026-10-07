// Poker + bet combined: all-time and month totals in rial (bet converted at today's dollar rate),
// a cumulative P/L line chart and a 6-month net bar chart.
import { useEffect, useMemo, useState } from 'react';
import { isoToJ, jToIso, MONTHS } from './jdate';
import { api } from './life-core';
import './fun.css';

const faN = (n, d = 0) => Number(n || 0).toLocaleString('fa-IR', { maximumFractionDigits: d });
// display unit follows the finance page's ریال/تومان toggle (data is always stored in rial)
let U = 'rial';
export const setFunUnit = u => { U = u === 'toman' ? 'toman' : 'rial'; };
const UF = () => (U === 'toman' ? 'تومان' : 'ریال');
const cv = n => (U === 'toman' ? (Number(n) || 0) / 10 : Number(n) || 0);
const f1 = v => v.toLocaleString('fa-IR', { maximumFractionDigits: v >= 100 ? 0 : 1 });
const parts = n => { const a = Math.abs(cv(n)); return a >= 1e9 ? [f1(a / 1e9), 'میلیارد'] : a >= 1e6 ? [f1(a / 1e6), 'میلیون'] : a >= 1e3 ? [f1(a / 1e3), 'هزار'] : [faN(a), '']; };
const money = n => { const [v, w] = parts(n); return `${Number(n) < 0 ? '−' : ''}${v}${w ? ' ' + w : ''} ${UF()}`; };
// green/red already tells gain from loss; only a loss keeps its sign
const sign = n => (n < 0 ? '−' : '');
const signed = n => sign(n) + money(Math.abs(n)).replace(/^−/, '');
const usdTxt = n => `${sign(n)}$${faN(Math.abs(n), 2)}`;
const jKey = iso => { const j = isoToJ(iso); return `${j.jy}-${String(j.jm).padStart(2, '0')}`; };
const jLbl = iso => { const j = isoToJ(iso); return `${faN(j.jd)} ${MONTHS[j.jm - 1]}`; };

// Shared: TGJU daily dollar closes (fetched once per page) and "rate of that day" lookup.
let USD_HIST = null;
export function useUsdHistory(enabled = true) {
  const [hist, setHist] = useState([]);
  useEffect(() => { if (!enabled) return; (USD_HIST ||= api('/api/tgju/history?key=price_dollar_rl&days=730').then(d => (d.items || []).filter(x => x.price > 0 && x.date)).catch(() => { USD_HIST = null; return []; })).then(setHist); }, [enabled]);
  return hist;
}
export function makeRateOn(hist, rate) {
  return (date, own) => { if (own > 0) return own; let lo = 0, hi = hist.length - 1, best = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (hist[m].date <= date) { best = m; lo = m + 1; } else hi = m - 1; } return best >= 0 ? hist[best].price : hist.length && date < hist[0].date ? hist[0].price : rate || (hist.length ? hist[hist.length - 1].price : 0); };
}

function CumChart({ days, hasBet, mode = 'all' }) {
  const [hi, setHi] = useState(null);
  if (days.length < 2) return <p className="fu-empty">{days.length ? 'برای نمودار حداقل دو روز ثبت لازم است.' : 'در این بازه چیزی ثبت نشده — بازهٔ بزرگ‌تری انتخاب کن.'}</p>;
  const main = mode === 'poker' ? 'poker' : mode === 'bet' ? 'bet' : 'total';
  const lines = mode === 'all' ? ['poker', ...(hasBet ? ['bet'] : []), 'total'] : [main];
  const W = 720, H = 230, L = 8, R = 8, T = 16, B = 26;
  const vals = days.flatMap(d => [...lines.map(k => d[k]), 0]);
  let min = Math.min(...vals), max = Math.max(...vals); const pad = (max - min) * 0.08 || 1; min -= pad; max += pad;
  const x = i => L + (i / (days.length - 1)) * (W - L - R), y = v => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const path = k => days.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d[k]).toFixed(1)}`).join(' ');
  const z = y(0), last = days[days.length - 1];
  const area = `${path(main)} L${x(days.length - 1).toFixed(1)} ${z.toFixed(1)} L${x(0).toFixed(1)} ${z.toFixed(1)} Z`;
  const ticks = [0, Math.floor((days.length - 1) / 2), days.length - 1].filter((v, i, a) => a.indexOf(v) === i);
  const move = e => { const r = e.currentTarget.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; setHi(Math.max(0, Math.min(days.length - 1, Math.round(((px - L) / (W - L - R)) * (days.length - 1))))); };
  const h = hi != null ? days[hi] : null;
  return <div className={`fu-chart m-${main}`}>
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onMouseMove={move} onMouseLeave={() => setHi(null)} role="img" aria-label="روند سود و زیان تجمعی">
      <defs>
        <linearGradient id={`fuUp-${main}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={`var(--fu-${main})`} stopOpacity=".32" /><stop offset="1" stopColor={`var(--fu-${main})`} stopOpacity="0" /></linearGradient>
      </defs>
      <line x1={L} x2={W - R} y1={z} y2={z} className="fu-zero" />
      <path d={area} fill={`url(#fuUp-${main})`} />
      {lines.map(k => <path key={k} d={path(k)} className={`fu-l ${k}`} />)}
      <circle cx={x(days.length - 1)} cy={y(last[main])} r="4.5" className={`fu-dot ${main}`} />
      {h ? <g><line x1={x(hi)} x2={x(hi)} y1={T} y2={H - B} className="fu-cross" /><circle cx={x(hi)} cy={y(h[main])} r="4" className={`fu-dot ${main}`} /></g> : null}
    </svg>
    <div className="fu-ticks">{ticks.map(i => <span key={i} style={{ left: `${(x(i) / W) * 100}%` }} className={i === 0 ? 'first' : i === days.length - 1 ? 'last' : ''}>{jLbl(days[i].date)}</span>)}</div>
    {h ? <div className="fu-tip" style={{ insetInlineStart: `${Math.min(78, Math.max(2, 100 - (x(hi) / W) * 100 - 10))}%` }}>
      <b>{jLbl(h.date)}</b>
      {mode === 'all' ? <span><i className="total" />جمع {signed(h.total)}</span> : null}
      {mode !== 'bet' ? <span><i className="poker" />پوکر {signed(h.poker)}</span> : null}
      {hasBet && mode !== 'poker' ? <span><i className="bet" />بت {signed(h.bet)}</span> : null}
    </div> : null}
  </div>;
}

// Longest win / loss runs over poker sessions and bet days in date order (a push breaks both).
function streaks(units) {
  let bw = 0, bl = 0, cw = 0, cl = 0;
  for (const u of units) { if (u.v > 0) { cw++; cl = 0; } else if (u.v < 0) { cl++; cw = 0; } else { cw = 0; cl = 0; } bw = Math.max(bw, cw); bl = Math.max(bl, cl); }
  const last = units[units.length - 1], cur = !last || !last.v ? { n: 0, kind: '' } : { n: last.v > 0 ? cw : cl, kind: last.v > 0 ? 'win' : 'loss' };
  return { bestWin: bw, worstLoss: bl, cur };
}

function LossLimit({ status, onSave }) {
  const [edit, setEdit] = useState(false), [v, setV] = useState('');
  const lim = status?.limit || 0, loss = Math.max(0, -(status?.net || 0)), pct = lim ? Math.min(100, (loss / lim) * 100) : 0, over = lim && loss >= lim;
  const save = async e => { e.preventDefault(); const n = Number(String(v).replace(/[^\d]/g, '')) || 0; await onSave(U === 'toman' ? n * 10 : n); setEdit(false); };
  return <div className={`fu-limit ${over ? 'over' : pct >= 75 ? 'near' : ''}`}>
    <div className="fu-limit-head">
      <b>{over ? '🚨 حد ضرر این ماه رد شد' : '🛡 حد ضرر ماهانه'}</b>
      {edit ? <form onSubmit={save} className="fu-limit-form"><input autoFocus inputMode="numeric" value={v} onChange={e => setV(e.target.value)} placeholder={`سقف ضرر ماه (${UF()})`} /><button>ذخیره</button><button type="button" onClick={() => setEdit(false)}>انصراف</button></form>
        : <button type="button" className="fu-link" onClick={() => { setV(lim ? Math.round(cv(lim)).toLocaleString('en-US') : ''); setEdit(true); }}>{lim ? 'تغییر سقف' : 'تعیین سقف'}</button>}
    </div>
    {lim ? <>
      <div className="fu-limit-bar"><i style={{ width: `${pct}%` }} /></div>
      <small>{loss ? `ضرر این ماه ${money(loss)} از سقف ${money(lim)}` : `این ماه ضرری نداری · سقف ${money(lim)}`}{over ? ' — به تلگرام و اعلان هم خبر داده شد.' : pct >= 75 ? ' — نزدیک سقف هستی.' : ''}</small>
    </> : <small>اگر ضرر ماه (پوکر + بت) از این سقف بیشتر شود، در تلگرام و اعلان گوشی خبرت می‌کنم.</small>}
  </div>;
}

function Locations({ poker, title = 'پوکر بر اساس مکان' }) {
  const rows = useMemo(() => {
    const m = {};
    poker.forEach(p => { const k = (p.location || '').trim() || 'بدون مکان'; const r = (m[k] ||= { name: k, n: 0, net: 0, wins: 0, buy: 0 }); const v = p.cashOut - p.buyIn; r.n++; r.net += v; r.buy += p.buyIn; if (v > 0) r.wins++; });
    return Object.values(m).sort((a, b) => b.net - a.net);
  }, [poker]);
  if (!rows.length) return null;
  const max = Math.max(1, ...rows.map(r => Math.abs(r.net)));
  return <div className="fu-panel fu-locs"><h3>{title}</h3>
    {rows.map(r => <div key={r.name} className="fu-loc">
      <span className="nm">{r.name}<em>{faN(r.n)} جلسه · وین‌ریت {faN(r.n ? (r.wins / r.n) * 100 : 0)}٪ · میانگین {signed(r.net / r.n)}</em></span>
      <span className="bar"><i className={r.net >= 0 ? 'pos' : 'neg'} style={{ width: `${Math.max(3, (Math.abs(r.net) / max) * 100)}%` }} /></span>
      <b className={r.net > 0 ? 'pos' : r.net < 0 ? 'neg' : ''}>{signed(r.net)}</b>
    </div>)}
  </div>;
}

function NetBars({ items: all, mode, hasBet }) {
  const [hi, setHi] = useState(null);
  const items = mode === 'poker' ? all.filter(m => m.poker || m.sessions || m.key.length === 7) : mode === 'bet' ? all.filter(m => m.betUsd || m.key.length === 7) : all;
  if (!items.length) return <p className="fu-empty">در این بازه چیزی ثبت نشده.</p>;
  const keys = mode === 'poker' ? ['poker'] : mode === 'bet' ? ['bet'] : hasBet ? ['poker', 'bet'] : ['poker'];
  const val = (m, k) => (k === 'poker' ? m.poker : m.bet), tot = m => (mode === 'poker' ? m.poker : mode === 'bet' ? m.bet : m.net);
  const max = Math.max(1, ...items.flatMap(m => keys.map(k => Math.abs(val(m, k)))));
  const h = hi != null ? items[hi] : null;
  return <div className="fu-nb" onMouseLeave={() => setHi(null)}>
    <div className="fu-bars" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((m, i) => { const t = tot(m), [v, w] = parts(t); return <div key={m.key} className={`fu-bar ${hi === i ? 'on' : ''}`} onMouseEnter={() => setHi(i)} onClick={() => setHi(i)}>
        <div className="fu-bar-val"><b className={t > 0 ? 'pos' : t < 0 ? 'neg' : ''}>{t ? sign(t) + v : '—'}</b><em>{t ? w : ''}</em></div>
        <div className="fu-bar-half up">{keys.map(k => <i key={k} className={k} style={{ height: val(m, k) > 0 ? `${Math.max(3, (val(m, k) / max) * 100)}%` : 0 }} />)}</div>
        <div className="fu-bar-half down">{keys.map(k => <i key={k} className={k} style={{ height: val(m, k) < 0 ? `${Math.max(3, (-val(m, k) / max) * 100)}%` : 0 }} />)}</div>
        <span>{m.label}</span>
      </div>; })}
    </div>
    {h ? <div className="fu-nb-tip"><b>{h.title || h.label}</b>
      <span><i className="poker" />پوکر: {signed(h.poker)}{h.sessions ? ` · ${faN(h.sessions)} جلسه` : ''}</span>
      {h.betUsd ? <span><i className="bet" />بت: {usdTxt(h.betUsd)}{hasBet ? ` ≈ ${signed(h.bet)}` : ''}</span> : null}
      <span className="t"><i className="total" />جمع: <b className={h.net > 0 ? 'pos' : h.net < 0 ? 'neg' : ''}>{signed(h.net)}</b></span>
    </div> : <div className="fu-nb-tip muted">روی هر ستون برو تا جزئیات پوکر و بت آن را ببینی.</div>}
  </div>;
}

const RANGES = [['m', 'این ماه'], ['m2', 'این ماه و ماه قبل'], ['q', 'این فصل'], ['y', 'امسال'], ['all', 'از ابتدا']];
const todayTeh = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date());
function rangeFrom(r, today) {
  const j = isoToJ(today);
  if (r === 'm') return jToIso(j.jy, j.jm, 1);
  if (r === 'm2') return j.jm === 1 ? jToIso(j.jy - 1, 12, 1) : jToIso(j.jy, j.jm - 1, 1);
  if (r === 'q') return jToIso(j.jy, Math.floor((j.jm - 1) / 3) * 3 + 1, 1);
  if (r === 'y') return jToIso(j.jy, 1, 1);
  return '0000-00-00';
}

export function FunOverview({ poker = [], bet = [], usdRate = 0, monthTo }) {
  // The ranges count back from the month picked at the top of the finance page (not always from today):
  // «این ماه» = that month, «امسال» = its year, and nothing after its last day is included.
  const now = todayTeh(), anchor = monthTo && monthTo < now ? monthTo : now, past = anchor !== now;
  const aj = isoToJ(anchor), mName = MONTHS[aj.jm - 1], prevName = MONTHS[(aj.jm + 10) % 12];
  const ranges = past ? [['m', mName], ['m2', `${mName} و ${prevName}`], ['q', 'آن فصل'], ['y', `سال ${faN(aj.jy)}`], ['all', `تا آخر ${mName}`]] : RANGES;
  const [range, setRange] = useState(() => { try { return localStorage.getItem('lifeos-fun-range') || 'm2'; } catch { return 'm2'; } });
  const pick = r => { setRange(r); try { localStorage.setItem('lifeos-fun-range', r); } catch {} };
  const [mode, setModeS] = useState(() => { try { return localStorage.getItem('lifeos-fun-mode') || 'all'; } catch { return 'all'; } });
  const setMode = m => { setModeS(m); try { localStorage.setItem('lifeos-fun-mode', m); } catch {} };
  // Dollar rate of each bet day: the rate saved with the entry, else TGJU's daily close for that date (or the nearest earlier market day), else today's.
  const hist = useUsdHistory(bet.length > 0);
  const data = useMemo(() => {
    const rate = Number(usdRate) || 0, hasBet = bet.length > 0 && (rate > 0 || hist.length > 0), today = anchor, from = rangeFrom(range, today);
    const rateOn = makeRateOn(hist, rate);
    const byDate = {};
    poker.forEach(p => { const d = (byDate[p.date] ||= { poker: 0, bet: 0, betUsd: 0, n: 0 }); d.poker += (Number(p.cashOut) || 0) - (Number(p.buyIn) || 0); d.n = (d.n || 0) + 1; });
    bet.forEach(b => { const d = (byDate[b.date] ||= { poker: 0, bet: 0, betUsd: 0 }); d.betUsd += Number(b.result) || 0; d.bet += (Number(b.result) || 0) * rateOn(b.date, Number(b.usdRate)); });
    const betRial = list => list.reduce((s, b) => s + (Number(b.result) || 0) * rateOn(b.date, Number(b.usdRate)), 0);
    const dates = Object.keys(byDate).sort(), inR = dates.filter(d => d >= from && d <= today);
    const net = d => byDate[d].poker + (hasBet ? byDate[d].bet : 0);
    // running sum inside the chosen range, starting from zero at the range start
    let cp = 0, cb = 0; const days = inR.map(date => { cp += byDate[date].poker; cb += hasBet ? byDate[date].bet : 0; return { date, poker: cp, bet: cb, total: cp + cb }; });
    if (days.length && range !== 'all' && days[0].date > from) days.unshift({ date: from, poker: 0, bet: 0, total: 0 });
    if (days.length && days[days.length - 1].date < today) days.push({ ...days[days.length - 1], date: today });
    const upTo = x => x.date <= today, pokerUp = poker.filter(upTo), betUp = bet.filter(upTo);
    const pokerAll = pokerUp.reduce((s, p) => s + p.cashOut - p.buyIn, 0), betUsdAll = betUp.reduce((s, b) => s + (Number(b.result) || 0), 0);
    const pR = poker.filter(p => p.date >= from && p.date <= today), bR = bet.filter(b => b.date >= from && b.date <= today);
    const pokerR = pR.reduce((s, p) => s + p.cashOut - p.buyIn, 0), betUsdR = bR.reduce((s, b) => s + (Number(b.result) || 0), 0);
    const seq = [...poker.map(p => ({ d: p.date, c: p.createdAt || 0, v: p.cashOut - p.buyIn })), ...bet.map(b => ({ d: b.date, c: 0, v: Number(b.result) || 0 }))].sort((a, b) => a.d.localeCompare(b.d) || a.c - b.c);
    const st = streaks(seq), rUnits = [...pR.map(p => p.cashOut - p.buyIn), ...bR.map(b => Number(b.result) || 0)];
    // bars: per day for the short ranges, per Jalali month otherwise
    let bars;
    if (range === 'm' || range === 'm2') bars = inR.map(d => { const j = isoToJ(d), x = byDate[d]; return { key: d, label: faN(j.jd), title: jLbl(d), net: net(d), poker: x.poker, bet: hasBet ? x.bet : 0, betUsd: x.betUsd, sessions: x.n || 0 }; });
    else {
      const f = isoToJ(range === 'all' ? (dates[0] || today) : from), t = isoToJ(today), list = [];
      for (let y = f.jy, m = f.jm; y < t.jy || (y === t.jy && m <= t.jm); m === 12 ? (y++, m = 1) : m++) list.push({ key: `${y}-${String(m).padStart(2, '0')}`, label: MONTHS[m - 1], title: `${MONTHS[m - 1]} ${faN(y)}`, net: 0, poker: 0, bet: 0, betUsd: 0, sessions: 0 });
      const ix = Object.fromEntries(list.map((x, i) => [x.key, i]));
      inR.forEach(d => { const i = ix[jKey(d)], x = byDate[d]; if (i != null) { const r = list[i]; r.net += net(d); r.poker += x.poker; r.bet += hasBet ? x.bet : 0; r.betUsd += x.betUsd; r.sessions += x.n || 0; } });
      bars = list.slice(-24);
    }
    return { days, hasBet, rate, from, pokerAll, betUsdAll, pokerR, betUsdR, totalAll: pokerAll + (hasBet ? betRial(betUp) : 0), totalR: pokerR + (hasBet ? betRial(bR) : 0), betRialAll: betRial(betUp), betRialR: betRial(bR), histOk: hist.length > 0, winsR: rUnits.filter(v => v > 0).length, lossesR: rUnits.filter(v => v < 0).length, countR: rUnits.length, count: seq.length, bars, st, pR };
  }, [poker, bet, usdRate, range, hist, anchor]);
  const [status, setStatus] = useState(null);
  useEffect(() => { api(`/api/fun/status${usdRate ? `?usdRate=${Math.round(usdRate)}` : ''}`).then(setStatus).catch(() => {}); }, [usdRate, poker.length, bet.length]);
  const saveLimit = async v => { await api('/api/me', { method: 'PATCH', body: JSON.stringify({ funLossLimit: v }) }); setStatus(s => ({ ...(s || {}), limit: v })); };
  if (!data.count) return <section className="fn-glass fu-card"><LossLimit status={status} onSave={saveLimit} /></section>;
  const tone = n => (n > 0 ? 'pos' : n < 0 ? 'neg' : '');
  const rLabel = ranges.find(r => r[0] === range)?.[1] || '';
  return <section className="fn-glass fu-card">
    <div className="fu-head">
      <div><h2>وضعیت کلی پوکر و بت</h2><p>{data.hasBet ? (data.histOk ? 'بت با نرخ دلار همان روز به ریال تبدیل شده.' : `بت با دلار امروز (${faN(data.rate)} ریال) تبدیل شده؛ تاریخچهٔ نرخ در دسترس نبود.`) : bet.length ? 'نرخ دلار در دسترس نیست؛ بت فقط دلاری نشان داده می‌شود.' : 'فقط پوکر ثبت شده.'}</p></div>
      <div className="fu-seg fu-range">{ranges.map(([k, l]) => <button type="button" key={k} className={range === k ? 'on' : ''} onClick={() => pick(k)}>{l}</button>)}</div>
    </div>
    <div className="fu-kpis">
      <div className={`fu-kpi main ${tone(data.totalR)}`}><small>جمع · {rLabel}</small><b>{signed(data.totalR)}</b><em>{data.countR ? `${faN(data.winsR)} برد · ${faN(data.lossesR)} باخت · وین‌ریت ${faN((data.winsR / data.countR) * 100)}٪` : 'در این بازه چیزی ثبت نشده'}</em></div>
      <div className={`fu-kpi ${tone(data.totalAll)}`}><small>{past ? `جمع کل تا آخر ${mName}` : 'جمع کل از ابتدا'}</small><b>{signed(data.totalAll)}</b><em>پوکر {signed(data.pokerAll)} · بت {usdTxt(data.betUsdAll)}</em></div>
      <div className={`fu-kpi ${tone(data.pokerR)}`}><small>پوکر · {rLabel}</small><b>{signed(data.pokerR)}</b><em>{faN(data.pR.length)} جلسه</em></div>
      <div className={`fu-kpi ${tone(data.betUsdR)}`}><small>بت · {rLabel}</small><b>{usdTxt(data.betUsdR)}</b><em>{data.hasBet ? `≈ ${signed(data.betRialR)}` : 'بدون نرخ دلار'}</em></div>
    </div>
    <LossLimit status={status} onSave={saveLimit} />
    <div className="fu-streaks">
      <span className={data.st.cur.kind === 'win' ? 'pos' : data.st.cur.kind === 'loss' ? 'neg' : ''}><small>روند فعلی</small><b>{data.st.cur.n ? `${faN(data.st.cur.n)} ${data.st.cur.kind === 'win' ? 'برد' : 'باخت'} پشت‌سرهم` : '—'}</b></span>
      <span className="pos"><small>بیشترین برد پشت‌سرهم</small><b>{faN(data.st.bestWin)}</b></span>
      <span className="neg"><small>بیشترین باخت پشت‌سرهم</small><b>{faN(data.st.worstLoss)}</b></span>
    </div>
    <div className="fu-grid">
      <div className="fu-modebar"><div className="fu-seg">{[['all', 'جمع'], ['poker', 'پوکر'], ['bet', 'بت']].map(([k, l]) => <button type="button" key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{l}</button>)}</div>{mode === 'bet' && !data.hasBet ? <small>بدون نرخ دلار، بت به ریال قابل‌نمایش نیست.</small> : null}</div>
      <div className="fu-panel"><div className="fu-ph"><h3>روند · {rLabel}</h3><div className="fu-legend">{mode === 'all' ? <span><i className="total" />جمع</span> : null}{mode !== 'bet' ? <span><i className="poker" />پوکر</span> : null}{data.hasBet && mode !== 'poker' ? <span><i className="bet" />بت</span> : null}</div></div><CumChart days={data.days} hasBet={data.hasBet} mode={mode} /><p className="fu-how">هر نقطه = جمع سود و زیان از ابتدای بازه تا آن روز (پوکر به {UF()}، بت × نرخ دلار همان روز).</p></div>
      <div className="fu-panel"><div className="fu-ph"><h3>{range === 'm' || range === 'm2' ? 'خالص هر روز بازی' : 'خالص هر ماه'}{mode === 'all' ? '' : mode === 'poker' ? ' · پوکر' : ' · بت'}</h3><div className="fu-legend">{mode !== 'bet' ? <span><i className="poker" />پوکر</span> : null}{data.hasBet && mode !== 'poker' ? <span><i className="bet" />بت</span> : null}{mode === 'all' ? <span>عدد بالای ستون = جمع روز</span> : null}</div></div><NetBars items={data.bars} mode={mode} hasBet={data.hasBet} /></div>
    </div>
    <Locations poker={data.pR} title={`پوکر بر اساس مکان · ${rLabel}`} />
  </section>;
}

// Portfolio value vs cost over time (daily snapshots taken when the wealth tab is opened).
// `to` = end of the month picked at the top of the finance page (ranges count back from it).
export function PfTrend({ snaps, to }) {
  const [range, setRange] = useState('all'), [hi, setHi] = useState(null);
  const pts = useMemo(() => { const upto = to ? snaps.filter(x => x.date <= to) : snaps, days = { '1m': 31, '3m': 92, '6m': 183 }[range]; if (!days) return upto; const end = to ? Date.parse(to + 'T12:00:00Z') : Date.now(), cut = new Date(end - days * 864e5).toISOString().slice(0, 10); return upto.filter(x => x.date >= cut); }, [snaps, range, to]);
  const head = <div className="fu-pf-head"><h3>روند سبد</h3><div className="fu-seg">{[['1m', '۱ ماه'], ['3m', '۳ ماه'], ['6m', '۶ ماه'], ['all', 'همه']].map(([k, l]) => <button type="button" key={k} className={range === k ? 'on' : ''} onClick={() => setRange(k)}>{l}</button>)}</div></div>;
  if (pts.length < 2) return <div className="fu-panel fu-pf">{head}<p className="fu-empty">{to && snaps.length ? 'تا پایان این ماه روند ثبت‌شده‌ای نیست.' : snaps.length ? 'از امروز هر روزی که این صفحه را باز کنی ارزش سبد ثبت می‌شود؛ از فردا نمودار می‌آید.' : 'در حال آماده‌سازی…'}</p></div>;
  const W = 720, H = 200, L = 8, R = 8, T = 14, B = 24;
  const vals = pts.flatMap(p => [p.value, p.cost]); let min = Math.min(...vals), max = Math.max(...vals); const pad = (max - min) * 0.1 || max * 0.05 || 1; min -= pad; max += pad;
  // x follows the calendar (days without a snapshot leave a gap instead of being squeezed out)
  const ts = pts.map(p => Date.parse(p.date + 'T12:00:00Z')), t0 = ts[0], span = (ts[ts.length - 1] - t0) || 1;
  const x = i => L + ((ts[i] - t0) / span) * (W - L - R), y = v => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const line = k => pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p[k]).toFixed(1)}`).join(' ');
  const band = `${line('value')} ${pts.slice().reverse().map((p, j) => `L${x(pts.length - 1 - j).toFixed(1)} ${y(p.cost).toFixed(1)}`).join(' ')} Z`;
  // «change» = change in profit, not in value: money put in (new buys) raises value and cost alike and isn't a gain
  const last = pts[pts.length - 1], first = pts[0], pnl = last.value - last.cost, chg = pnl - (first.value - first.cost);
  const h = hi != null ? pts[hi] : null;
  const move = e => { const r = e.currentTarget.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; let best = 0; for (let i = 1; i < pts.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; setHi(best); };
  return <div className="fu-panel fu-pf">{head}
    <div className="fu-pf-kpis"><span><small>سود/زیان فعلی</small><b className={pnl >= 0 ? 'pos' : 'neg'}>{signed(pnl)}</b></span><span><small>تغییر سود در این بازه</small><b className={chg >= 0 ? 'pos' : 'neg'}>{signed(chg)}</b></span><span className="fu-legend"><span><i className="total" />ارزش</span><span><i className="cost" />بهای خرید</span></span></div>
    <div className="fu-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onMouseMove={move} onMouseLeave={() => setHi(null)} role="img" aria-label="روند ارزش سبد">
        <path d={band} className={pnl >= 0 ? 'fu-band pos' : 'fu-band neg'} />
        <path d={line('cost')} className="fu-l cost" />
        <path d={line('value')} className="fu-l total" />
        {pts.length <= 40 ? pts.map((p, i) => <circle key={p.date} cx={x(i)} cy={y(p.value)} r="3" className="fu-pt" />) : null}
        {h ? <g><line x1={x(hi)} x2={x(hi)} y1={T} y2={H - B} className="fu-cross" /><circle cx={x(hi)} cy={y(h.value)} r="4" className="fu-dot" /></g> : null}
      </svg>
      <div className="fu-ticks"><span className="first" style={{ left: '0%' }}>{jLbl(first.date)}</span><span className="last" style={{ left: '100%' }}>{jLbl(last.date)}</span></div>
      {h ? <div className="fu-tip" style={{ insetInlineStart: `${Math.min(78, Math.max(2, 100 - (x(hi) / W) * 100 - 10))}%` }}><b>{jLbl(h.date)}</b><span><i className="total" />ارزش {money(h.value)}</span><span><i className="cost" />بهای خرید {money(h.cost)}</span><span>سود/زیان {signed(h.value - h.cost)}</span></div> : null}
    </div>
  </div>;
}
