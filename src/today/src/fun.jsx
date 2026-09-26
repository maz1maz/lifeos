// Poker + bet combined: all-time and month totals in rial (bet converted at today's dollar rate),
// a cumulative P/L line chart and a 6-month net bar chart.
import { useMemo, useState } from 'react';
import { isoToJ, MONTHS } from './jdate';
import { money } from './life';
import './fun.css';

const faN = (n, d = 0) => Number(n || 0).toLocaleString('fa-IR', { maximumFractionDigits: d });
const sign = n => (n > 0 ? '+' : n < 0 ? '−' : '');
const signed = n => sign(n) + money(Math.abs(n)).replace(/^−/, '');
const usdTxt = n => `${sign(n)}$${faN(Math.abs(n), 2)}`;
const jKey = iso => { const j = isoToJ(iso); return `${j.jy}-${String(j.jm).padStart(2, '0')}`; };
const jLbl = iso => { const j = isoToJ(iso); return `${faN(j.jd)} ${MONTHS[j.jm - 1]}`; };

function CumChart({ days, hasBet }) {
  const [hi, setHi] = useState(null);
  if (days.length < 2) return <p className="fu-empty">برای نمودار حداقل دو روز ثبت لازم است.</p>;
  const W = 720, H = 230, L = 8, R = 8, T = 16, B = 26;
  const vals = days.flatMap(d => [d.total, d.poker, ...(hasBet ? [d.bet] : []), 0]);
  let min = Math.min(...vals), max = Math.max(...vals); const pad = (max - min) * 0.08 || 1; min -= pad; max += pad;
  const x = i => L + (i / (days.length - 1)) * (W - L - R), y = v => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const path = k => days.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d[k]).toFixed(1)}`).join(' ');
  const z = y(0), last = days[days.length - 1];
  const area = `${path('total')} L${x(days.length - 1).toFixed(1)} ${z.toFixed(1)} L${x(0).toFixed(1)} ${z.toFixed(1)} Z`;
  const ticks = [0, Math.floor((days.length - 1) / 2), days.length - 1].filter((v, i, a) => a.indexOf(v) === i);
  const move = e => { const r = e.currentTarget.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; setHi(Math.max(0, Math.min(days.length - 1, Math.round(((px - L) / (W - L - R)) * (days.length - 1))))); };
  const h = hi != null ? days[hi] : null;
  return <div className="fu-chart">
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onMouseMove={move} onMouseLeave={() => setHi(null)} role="img" aria-label="روند سود و زیان تجمعی">
      <defs>
        <linearGradient id="fuUp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--fu-total)" stopOpacity=".32" /><stop offset="1" stopColor="var(--fu-total)" stopOpacity="0" /></linearGradient>
      </defs>
      <line x1={L} x2={W - R} y1={z} y2={z} className="fu-zero" />
      <path d={area} fill="url(#fuUp)" />
      <path d={path('poker')} className="fu-l poker" />
      {hasBet ? <path d={path('bet')} className="fu-l bet" /> : null}
      <path d={path('total')} className="fu-l total" />
      <circle cx={x(days.length - 1)} cy={y(last.total)} r="4.5" className="fu-dot" />
      {h ? <g><line x1={x(hi)} x2={x(hi)} y1={T} y2={H - B} className="fu-cross" /><circle cx={x(hi)} cy={y(h.total)} r="4" className="fu-dot" /></g> : null}
      {ticks.map(i => <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === days.length - 1 ? 'end' : 'middle'} className="fu-tick">{jLbl(days[i].date)}</text>)}
    </svg>
    {h ? <div className="fu-tip" style={{ insetInlineStart: `${Math.min(78, Math.max(2, 100 - (x(hi) / W) * 100 - 10))}%` }}>
      <b>{jLbl(h.date)}</b>
      <span><i className="total" />جمع {signed(h.total)}</span>
      <span><i className="poker" />پوکر {signed(h.poker)}</span>
      {hasBet ? <span><i className="bet" />بت {signed(h.bet)}</span> : null}
    </div> : null}
  </div>;
}

function MonthBars({ months }) {
  const max = Math.max(1, ...months.map(m => Math.abs(m.net)));
  return <div className="fu-bars">
    {months.map(m => <div key={m.key} className="fu-bar" title={`${m.label}: ${signed(m.net)}`}>
      <div className="fu-bar-half up">{m.net > 0 ? <i className="pos" style={{ height: `${Math.max(4, (m.net / max) * 100)}%` }} /> : null}</div>
      <div className="fu-bar-half down">{m.net < 0 ? <i className="neg" style={{ height: `${Math.max(4, (-m.net / max) * 100)}%` }} /> : null}</div>
      <small className={m.net > 0 ? 'pos' : m.net < 0 ? 'neg' : ''}>{m.net ? sign(m.net) + money(Math.abs(m.net)).replace(' ریال', '') : '—'}</small>
      <span>{m.label}</span>
    </div>)}
  </div>;
}

export function FunOverview({ poker = [], bet = [], usdRate = 0, monthFrom, monthTo }) {
  const data = useMemo(() => {
    const rate = Number(usdRate) || 0, hasBet = bet.length > 0 && rate > 0;
    const byDate = {};
    poker.forEach(p => { const d = (byDate[p.date] ||= { poker: 0, bet: 0, betUsd: 0 }); d.poker += (Number(p.cashOut) || 0) - (Number(p.buyIn) || 0); });
    bet.forEach(b => { const d = (byDate[b.date] ||= { poker: 0, bet: 0, betUsd: 0 }); d.betUsd += Number(b.result) || 0; d.bet += (Number(b.result) || 0) * rate; });
    const dates = Object.keys(byDate).sort();
    let cp = 0, cb = 0; const days = dates.map(date => { cp += byDate[date].poker; cb += hasBet ? byDate[date].bet : 0; return { date, poker: cp, bet: cb, total: cp + cb }; });
    const inMonth = d => d >= monthFrom && d <= monthTo;
    const pokerAll = poker.reduce((s, p) => s + p.cashOut - p.buyIn, 0), betUsdAll = bet.reduce((s, b) => s + (Number(b.result) || 0), 0);
    const pokerM = poker.filter(p => inMonth(p.date)).reduce((s, p) => s + p.cashOut - p.buyIn, 0), betUsdM = bet.filter(b => inMonth(b.date)).reduce((s, b) => s + (Number(b.result) || 0), 0);
    const units = [...poker.map(p => p.cashOut - p.buyIn), ...bet.map(b => Number(b.result) || 0)];
    const wins = units.filter(v => v > 0).length, losses = units.filter(v => v < 0).length;
    // last 6 Jalali months ending at the selected month
    const endKey = jKey(monthTo), [ey, em] = endKey.split('-').map(Number), months = [];
    for (let i = 5; i >= 0; i--) { let m = em - i, yy = ey; while (m < 1) { m += 12; yy--; } months.push({ key: `${yy}-${String(m).padStart(2, '0')}`, label: MONTHS[m - 1], net: 0 }); }
    const mIx = Object.fromEntries(months.map((m, i) => [m.key, i]));
    dates.forEach(d => { const i = mIx[jKey(d)]; if (i != null) months[i].net += byDate[d].poker + (hasBet ? byDate[d].bet : 0); });
    return { days, hasBet, rate, pokerAll, betUsdAll, pokerM, betUsdM, totalAll: pokerAll + (hasBet ? betUsdAll * rate : 0), totalM: pokerM + (hasBet ? betUsdM * rate : 0), wins, losses, months, count: units.length };
  }, [poker, bet, usdRate, monthFrom, monthTo]);
  if (!data.count) return null;
  const tone = n => (n > 0 ? 'pos' : n < 0 ? 'neg' : '');
  return <section className="fn-glass fu-card">
    <div className="fu-head">
      <div><h2>وضعیت کلی پوکر و بت</h2><p>{data.hasBet ? `بت با دلار ${faN(data.rate)} ریال به ریال تبدیل شده.` : bet.length ? 'نرخ دلار در دسترس نیست؛ بت فقط دلاری نشان داده می‌شود.' : 'فقط پوکر ثبت شده.'}</p></div>
      <div className="fu-legend"><span><i className="total" />جمع</span><span><i className="poker" />پوکر</span>{data.hasBet ? <span><i className="bet" />بت</span> : null}</div>
    </div>
    <div className="fu-kpis">
      <div className={`fu-kpi main ${tone(data.totalAll)}`}><small>جمع کل از ابتدا</small><b>{signed(data.totalAll)}</b><em>{faN(data.wins)} برد · {faN(data.losses)} باخت · وین‌ریت {faN(data.count ? (data.wins / data.count) * 100 : 0)}٪</em></div>
      <div className={`fu-kpi ${tone(data.totalM)}`}><small>این ماه</small><b>{signed(data.totalM)}</b><em>پوکر {signed(data.pokerM)}</em></div>
      <div className={`fu-kpi ${tone(data.pokerAll)}`}><small>پوکر · کل</small><b>{signed(data.pokerAll)}</b><em>{faN(poker.length)} جلسه</em></div>
      <div className={`fu-kpi ${tone(data.betUsdAll)}`}><small>بت · کل</small><b>{usdTxt(data.betUsdAll)}</b><em>{data.hasBet ? `≈ ${signed(data.betUsdAll * data.rate)}` : `${faN(bet.length)} روز`}</em></div>
    </div>
    <div className="fu-grid">
      <div className="fu-panel"><h3>روند تجمعی</h3><CumChart days={data.days} hasBet={data.hasBet} /></div>
      <div className="fu-panel"><h3>خالص ۶ ماه اخیر</h3><MonthBars months={data.months} /></div>
    </div>
  </section>;
}
