import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Upload, Plus, Trash2, ArrowRight, LineChart as LineIcon } from 'lucide-react';
import { Page, useCol, num, api } from './life-core';
import { Loader } from './loader';

// «کیف‌پول کریپتو»: balances of several wallets with live CoinGecko prices, 24h change, value over time and charts.
// Storage: /api/col/cryptoWallets {name, note?, holdings:[{coin, chain, amount, price, flag?}]}
//          /api/col/cryptoHistory {day:'YYYY-MM-DD'|'backfill', points:[{t, total, wallets:{walletId:value}, est?}]}
// The browser reads prices straight from CoinGecko (allowed in connect-src) and appends a snapshot at most every 30 minutes
// while the page is open (the Worker's cron adds one every 6h and sends a Telegram alert on a big 24h move: /api/crypto/alert);
// `holdings[].price` is the manual fallback for coins CoinGecko does not price.
const CG_IDS = { USDT: 'tether', USDC: 'usd-coin', BTC: 'bitcoin', XRP: 'ripple', CAKE: 'pancakeswap-token', TWT: 'trust-wallet-token', AVAX: 'avalanche-2', TRX: 'tron', ONE: 'harmony', FLOW: 'flow', LTC: 'litecoin', LINK: 'chainlink', AAVE: 'aave', UNI: 'uniswap', MKR: 'maker', BNB: 'binancecoin', ZRX: '0x', EOS: 'eos', NEO: 'neo', COMP: 'compound-governance-token', ONT: 'ontology', SHIB: 'shiba-inu', MANA: 'decentraland', BTT: 'bittorrent', WIN: 'wink', KSM: 'kusama', QTUM: 'qtum', ATOM: 'cosmos', BNT: 'bancor', UMA: 'uma', CELR: 'celer-network', IOTA: 'iota', CHZ: 'chiliz', RSR: 'reserve-rights-token', EGLD: 'elrond-erd-2', SUSHI: 'sushi', KAVA: 'kava', BAND: 'band-protocol', COTI: 'coti', SNX: 'havven', ETH: 'ethereum', FTT: 'ftx-token', IOST: 'iostoken', BCH: 'bitcoin-cash', ADA: 'cardano', ETC: 'ethereum-classic', DOT: 'polkadot', ALGO: 'algorand', DASH: 'dash', POL: 'polygon-ecosystem-token', FIL: 'filecoin', CELO: 'celo', SOL: 'solana', ARB: 'arbitrum', DOGE: 'dogecoin', TON: 'the-open-network', XLM: 'stellar', NEAR: 'near', XMR: 'monero',
  SC: 'siacoin', VIC: 'tomochain', SXP: 'swipe', KMD: 'komodo', GRT: 'the-graph', ICP: 'internet-computer', RUNE: 'thorchain', XEM: 'nem', BTS: 'bitshares', BAL: 'balancer', SRM: 'serum', ORN: 'orion-protocol', BAKE: 'bakerytoken', ALPHA: 'alpha-finance', FTM: 'fantom', MIR: 'mirror-protocol', WAN: 'wanchain', DEGO: 'dego-finance', SCRT: 'secret', REEF: 'reef', BEAM: 'beam', DOGE: 'dogecoin' };
const NET = { TRC20: 'Tron', 'C-Chain': 'Avalanche', ERC20: 'Ethereum', BEP20: 'BNB Chain', BEP2: 'BNB Beacon (BEP2)', Ripple: 'XRP Ledger' };
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];
const RANGES = [[7, '۷ روز'], [30, '۱ ماه'], [90, '۳ ماه'], [365, '۱ سال'], [0, '۲ سال']];
const SNAP_EVERY = 30 * 60e3;
// market charts: same setup as IDouble/Customizable-Crypto-Currency-Dashboard-with-Chart (MIT) — TradingView, weekly, Binance,
// Pivots HL + RSI + Stoch RSI + Volume. Embedded as TradingView's own iframe (frame-src only; no third-party script on this page).
const CHARTS = [['BTC', 'بیت‌کوین', 'BINANCE:BTCUSD'], ['ETH', 'اتریوم', 'BINANCE:ETHUSD'], ['BNB', 'بی‌ان‌بی', 'BINANCE:BNBUSD'], ['SOL', 'سولانا', 'BINANCE:SOLUSD'], ['ARB', 'آربیتروم', 'BINANCE:ARBUSDT']];
const STUDIES = ['PivotPointsHighLow@tv-basicstudies', 'RSI@tv-basicstudies', 'StochasticRSI@tv-basicstudies', 'Volume@tv-basicstudies'];
const tvSrc = symbol => 'https://s.tradingview.com/widgetembed/?' + new URLSearchParams({ frameElementId: 'cw_tv', symbol, interval: 'W', hidesidetoolbar: '0', symboledit: '1', saveimage: '1', toolbarbg: 'f1f3f6', studies: STUDIES.join('\x1f') /* tv.js joins study ids with U+001F */, theme: 'dark', style: '1', timezone: 'Asia/Tehran', withdateranges: '1', locale: 'en' });
const chartHref = c => `/?page=crypto&chart=${encodeURIComponent(c)}`;
// Every other coin: Binance <COIN>USDT, except tickers Binance renamed. The widget keeps its symbol box, so a wrong guess can be fixed on the page.
const TV_OVERRIDE = { BTT: 'BINANCE:BTTCUSDT', EOS: 'BINANCE:AUSDT' };
const NO_CHART = new Set(['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FDUSD']); // stablecoins: a flat line at $1
const NO_PAIR = new Set(['MKR']); // Binance stopped trading these pairs: the chart would end in the past
// «خرید در برابر موجودی»: /api/col/cryptoTrades {date, type:'buy'|'sell', coin, amount, usd} from the exchange's CSV export
const ALIAS = { MATIC: 'POL' };
const DEAD = new Set(['ORK', 'NRV', 'JULD']); // projects that no longer trade anywhere: no price lookup
const scale = (coin, iso) => coin === 'BTT' && iso < '2022-02-11' ? 1000 : 1; // Binance redenominated BTT 1:1000 (BTT → BTTC)
const TSTATUS = { missing: ['گم‌شده', 'bad'], less: ['کمتر از خرید', 'warn'], more: ['بیشتر از خرید', 'info'], extra: ['خرید ثبت‌نشده', ''], ok: ['درست', 'ok'] };
const tradeKey = t => [t.date, t.type, t.coin, Number(t.amount)].join('|');
// Date,Type,Buy Amount,Currency,Sell Amount,Currency,… — the side paid in USD/USDT is the money; the other side is the coin
function parseTradesCsv(text) {
  const cells = l => { const out = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur.trim()); cur = ''; } else cur += ch; } out.push(cur.trim()); return out; };
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
  const head = cells(lines[0] || '').map(x => x.toLowerCase());
  if (head[0] !== 'date' || !/buy amount/.test(head[2] || '')) throw new Error('ستون‌های Date, Type, Buy Amount, … پیدا نشد.');
  const money = c => ['USD', 'USDT', 'USDC'].includes(c);
  return lines.slice(1).map(cells).map(([d, , ba, bc, sa, sc]) => {
    const m = String(d).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (!m) return null;
    bc = String(bc || '').trim().toUpperCase(); sc = String(sc || '').trim().toUpperCase();
    const buy = money(sc) && !money(bc), sell = money(bc) && !money(sc);
    if (!buy && !sell) return null;
    const t = { date: `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`, type: buy ? 'buy' : 'sell', coin: buy ? bc : sc, amount: num(buy ? ba : sa), usd: num(buy ? sa : ba) };
    return t.amount > 0 ? t : null;
  }).filter(Boolean);
}
const ALERTS = [[0, 'خاموش'], [5, '۵٪'], [10, '۱۰٪'], [15, '۱۵٪'], [20, '۲۰٪']];
const tvSymbol = coin => (CHARTS.find(c => c[0] === coin) || [])[2] || TV_OVERRIDE[coin] || `BINANCE:${coin}USDT`;
const chartable = h => !h.flag && /^[A-Z0-9]{2,10}$/.test(sym(h)) && !NO_CHART.has(sym(h)) && !NO_PAIR.has(sym(h));
const coinChip = (h, live) => h.flag ? <span className="cw-chip warn">{h.flag}</span> : <>{!live ? <span className="cw-chip">قیمت دستی</span> : null}{NO_PAIR.has(sym(h)) ? <span className="cw-chip" title="جفت‌ارز این ارز در Binance دیگر معامله نمی‌شود">بدون نمودار</span> : null}</>;

function ChartView({ Nav, coin }) {
  const main = CHARTS.find(x => x[0] === coin), name = main ? main[1] : coin;
  return <Page Nav={Nav} className="cw cw-chartpage" kicker="کیف‌پول کریپتو" title={`${name} (${main ? coin : coin + '/USDT'})`} sub="نمودار هفتگی Binance با Pivots، RSI، Stoch RSI و حجم معاملات. نماد را از بالای نمودار می‌شود عوض کرد."
    actions={<a className="lf-btn ghost" href="/?page=crypto"><ArrowRight size={15} /> بازگشت به کیف‌پول‌ها</a>}>
    <nav className="cw-coins" aria-label="ارزها">{[...CHARTS.map(([k, n]) => [k, n]), ...(main ? [] : [[coin, coin]])].map(([k, n]) => <a key={k} href={chartHref(k)} className="cw-sort" aria-current={k === coin ? 'page' : undefined}>{k === n ? k : `${k} · ${n}`}</a>)}</nav>
    <div className="cw-tv"><iframe key={coin} src={tvSrc(tvSymbol(coin))} title={`نمودار ${name}`} allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div>
  </Page>;
}

const usd = v => '$' + (Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const amt = v => (Number(v) || 0).toLocaleString('en-US', { maximumFractionDigits: 8 });
const sym = h => String(h.coin || '').trim().toUpperCase();
const net = h => NET[String(h.chain || '').trim()] || String(h.chain || '').trim() || 'نامشخص';
const shortName = n => String(n || '').split('·').pop().trim();
const pctTxt = (d, base) => { const prev = base - d, p = prev ? d / prev * 100 : 0; return `${d >= 0 ? '+' : '−'}${Math.abs(p).toFixed(1)}%`; };

// prices: {usd:{SYM:price}, change24:{SYM:pct}}
function makeCalc(prices) {
  const live = h => prices.usd[sym(h)];
  const priceOf = h => live(h) ?? (Number(h.price) || 0);
  const val = h => (Number(h.amount) || 0) * priceOf(h);
  const chg = h => { const p = prices.change24[sym(h)], v = val(h); return p == null ? 0 : v - v / (1 + p / 100); };
  return { live, priceOf, val, chg };
}
function sumRows(hs, key, val) {
  const by = {};
  hs.forEach(h => { const k = key(h); by[k] = (by[k] || 0) + val(h); });
  return Object.entries(by).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
}
// rows at 1%+ (at most `max`), the rest as «سایر» — shown only when it also reaches 1%
function foldSmall(rows, max = Infinity) {
  const total = rows.reduce((s, [, v]) => s + v, 0), keep = rows.filter(([, v]) => v >= total * 0.01).slice(0, max);
  const rest = total - keep.reduce((s, [, v]) => s + v, 0);
  return rest > 0 && rest >= total * 0.01 ? [...keep, ['سایر', rest]] : keep; // no wallets yet: nothing, not «سایر NaN%»
}

async function fetchPrices(symbols, extraIds) {
  const ids = {};
  for (const s of symbols) if (CG_IDS[s] || extraIds[s]) ids[s] = CG_IDS[s] || extraIds[s];
  for (const s of symbols.filter(s => !ids[s] && /^[A-Z0-9]{2,10}$/.test(s))) {
    // unknown symbol: best-ranked CoinGecko coin with exactly that ticker
    try { const r = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(s)}`), d = await r.json(); const c = (d.coins || []).filter(c => String(c.symbol).toUpperCase() === s).sort((a, b) => (a.market_cap_rank || 1e9) - (b.market_cap_rank || 1e9))[0]; if (c) ids[s] = extraIds[s] = c.id; } catch {}
  }
  const list = [...new Set(Object.values(ids))];
  if (!list.length) return { usd: {}, change24: {}, at: Date.now() };
  const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd&include_24hr_change=true&ids=${list.join(',')}`);
  if (!r.ok) throw new Error('CoinGecko پاسخ نداد؛ قیمت‌های دستی نمایش داده می‌شوند.');
  const d = await r.json(), out = { usd: {}, change24: {}, at: Date.now() };
  for (const [s, id] of Object.entries(ids)) if (d[id]) { out.usd[s] = d[id].usd; if (d[id].usd_24h_change != null) out.change24[s] = d[id].usd_24h_change; }
  return out;
}

function Chg({ d, base, compact, on }) {
  if (!on) return <span className="cw-muted">—</span>;
  return <span className={`cw-num ${d >= 0 ? 'up' : 'down'}`}>{compact ? pctTxt(d, base) : `${d >= 0 ? '+' : '−'}${usd(Math.abs(d))} (${pctTxt(d, base)})`}</span>;
}

function HBars({ rows, total }) {
  const max = rows.length ? rows[0][1] : 0;
  return <div className="cw-hbars">{rows.map(([k, v], i) => <div className="cw-hrow" key={k}>
    <b>{k}</b><span className="cw-track"><i style={{ width: `${max ? v / max * 100 : 0}%`, background: COLORS[i % 8] }} /></span>
    <span className="cw-num cw-muted">{usd(v)}{total ? ` · ${(v / total * 100).toFixed(1)}%` : ''}</span>
  </div>)}</div>;
}

// donut from circles: the circumference of r=15.9155 is 100, so dash lengths are percentages
function Donut({ rows, total }) {
  let acc = 0;
  return <div className="cw-donutbox">
    <svg viewBox="0 0 42 42" className="cw-donut" role="img" aria-label="سهم هر ارز">
      <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--g-border-2)" strokeWidth="6" />
      {rows.map(([k, v], i) => { const p = total ? v / total * 100 : 0, off = 25 - acc; acc += p; return <circle key={k} cx="21" cy="21" r="15.9155" fill="none" stroke={COLORS[i % 8]} strokeWidth="6" strokeDasharray={`${p} ${100 - p}`} strokeDashoffset={off}><title>{`${k}: ${p.toFixed(1)}% · ${usd(v)}`}</title></circle>; })}
      <text x="21" y="22.5" textAnchor="middle" fill="currentColor" fontSize="4.2" fontWeight="700">{total >= 1000 ? `$${(total / 1000).toFixed(1)}k` : usd(total)}</text>
    </svg>
    <ul className="cw-legend col">{rows.map(([k, v], i) => <li key={k}><i style={{ background: COLORS[i % 8] }} />{k} <span className="cw-num">{(total ? v / total * 100 : 0).toFixed(1)}%</span></li>)}</ul>
  </div>;
}

// value-over-time chart; drag, hover or arrow keys move a marker and show that point in the strip above
function LineChart({ pts, h = 200, label }) {
  const [idx, setIdx] = useState(null), svgRef = useRef(null);
  const W = 600, H = h + 14, L = 6, R = 78, T = 10, B = 30;
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t || t0 + 1, span = t1 - t0;
  let lo = Math.min(...pts.map(p => p.v)), hi = Math.max(...pts.map(p => p.v));
  if (hi - lo < hi * 0.002) { lo -= hi * 0.001 + 1; hi += hi * 0.001 + 1; } // a flat line still gets a visible band
  const x = t => L + (span > 0 ? (t - t0) / span : 1) * (W - L - R), y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const color = pts[pts.length - 1].v >= pts[0].v ? '#34d399' : '#ef4444';
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const money = v => v >= 1e5 ? `$${(v / 1000).toFixed(0)}k` : v >= 1e4 ? `$${(v / 1000).toFixed(1)}k` : '$' + Math.round(v).toLocaleString('en-US');
  const fmtT = t => new Date(t).toLocaleString('fa-IR', span > 120 * 864e5 ? { year: 'numeric', month: 'short' } : span > 2 * 864e5 ? { month: 'short', day: 'numeric' } : { hour: '2-digit', minute: '2-digit' });
  const nearest = clientX => { const r = svgRef.current.getBoundingClientRect(), vx = (clientX - r.left) / r.width * W; let best = 0; pts.forEach((p, i) => { if (Math.abs(x(p.t) - vx) < Math.abs(x(pts[best].t) - vx)) best = i; }); return best; };
  const clamp = i => Math.max(0, Math.min(pts.length - 1, i));
  const key = e => { const step = { ArrowRight: 1, ArrowLeft: -1, ArrowUp: 1, ArrowDown: -1 }[e.key]; if (step) { e.preventDefault(); setIdx(i => clamp((i ?? pts.length - 1) + step * (e.shiftKey ? 10 : 1))); } else if (e.key === 'Home') setIdx(0); else if (e.key === 'End') setIdx(pts.length - 1); };
  const p = idx == null ? null : pts[idx], first = pts[0].v, dv = p ? p.v - first : 0;
  return <div className="cw-scrub" tabIndex={0} aria-label="برای دیدن ارزش هر روز روی نمودار حرکت کنید یا از کلیدهای جهت استفاده کنید"
    onPointerMove={e => setIdx(nearest(e.clientX))} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); setIdx(nearest(e.clientX)); }}
    onPointerLeave={e => { if (e.pointerType === 'mouse') setIdx(null); }} onKeyDown={key} onBlur={() => setIdx(null)}>
    <div className="cw-readout" aria-live="polite">{p ? <>
      <small>{new Date(p.t).toLocaleString('fa-IR', p.est ? { year: 'numeric', month: 'long', day: 'numeric' } : { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}{p.est ? ' · تخمینی' : ''}</small>
      <b className="cw-num">{usd(p.v)}</b>
      <span className={`cw-num ${dv >= 0 ? 'up' : 'down'}`}>{dv >= 0 ? '+' : '−'}{usd(Math.abs(dv))} ({dv >= 0 ? '+' : '−'}{Math.abs(first ? dv / first * 100 : 0).toFixed(1)}%) نسبت به اول بازه</span>
    </> : <small className="cw-muted">روی نمودار حرکت کنید تا ارزش هر روز را ببینید.</small>}</div>
    {/* direction ltr: in the rtl page, text-anchor «start» would push the date labels off the left edge */}
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="cw-line" direction="ltr" role="img" aria-label={label}>
      {[0, .25, .5, .75, 1].map(f => { const v = lo + (hi - lo) * f; return <g key={f}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--g-border-2)" /><text x={W - R + 8} y={y(v) + 4}>{money(v)}</text></g>; })}
      {[0, .25, .5, .75, 1].map((f, i) => { const tx = x(t0 + span * f); return <g key={f}><line x1={tx} x2={tx} y1={H - B} y2={H - B + 5} stroke="currentColor" opacity=".5" /><text x={tx} y={H - 8} className={i % 2 ? 'cw-mid' : undefined} textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}>{fmtT(t0 + span * f)}</text></g>; })}
      <path d={`${d}L${x(t1)},${H - B}L${x(t0)},${H - B}Z`} fill={color} fillOpacity=".12" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <circle cx={x(pts[pts.length - 1].t)} cy={y(pts[pts.length - 1].v)} r="4" fill={color} />
      {p ? <><line x1={x(p.t)} x2={x(p.t)} y1={T} y2={H - B} stroke="currentColor" strokeDasharray="3 3" opacity=".6" /><circle cx={x(p.t)} cy={y(p.v)} r="5" fill={color} stroke="var(--g-panel)" strokeWidth="2" /></> : null}
    </svg>
  </div>;
}

function WalletCard({ w, calc, on, sortBy, sortBtn, history, onSave, onRemove }) {
  const [edit, setEdit] = useState(null), [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false);
  const hs = w.holdings || [], total = hs.reduce((s, h) => s + calc.val(h), 0), rows = foldSmall(sumRows(hs, h => String(h.coin || '?').trim(), calc.val), 7);
  const pts = history(p => p.wallets && p.wallets[w.id]);
  const start = () => { setConfirm(false); setEdit({ name: w.name || '', rows: hs.map(h => ({ ...h })) }); };
  const set = (i, k, v) => setEdit(e => ({ ...e, rows: e.rows.map((r, j) => j === i ? { ...r, [k]: v } : r) }));
  const save = async () => {
    setBusy(true);
    const holdings = edit.rows.map(r => ({ coin: String(r.coin || '').trim(), chain: String(r.chain || '').trim(), amount: num(r.amount), price: num(r.price), ...(r.flag ? { flag: r.flag } : {}) })).filter(r => r.coin);
    await onSave(w.id, { name: edit.name.trim() || w.name || 'بدون نام', holdings });
    setBusy(false); setEdit(null);
  };
  return <article className="lf-card cw-card">
    <div className="cw-head">
      {edit ? <input className="cw-in cw-name" value={edit.name} maxLength={60} onChange={e => setEdit(x => ({ ...x, name: e.target.value }))} aria-label="نام کیف‌پول" /> : <h3>{w.name || 'بدون نام'}</h3>}
      <span className="cw-headv"><Chg d={hs.reduce((s, h) => s + calc.chg(h), 0)} base={total} on={on} /><b className="cw-num">{usd(total)}</b></span>
    </div>
    {!edit && pts.length >= 2 ? <>
      <LineChart pts={pts} h={180} label={`ارزش ${w.name} در طول زمان`} />
      <p className="cw-muted cw-small">در این بازه: از {usd(pts[0].v)} به {usd(pts[pts.length - 1].v)} <span className={`cw-num ${pts[pts.length - 1].v >= pts[0].v ? 'up' : 'down'}`} dir="ltr">({pctTxt(pts[pts.length - 1].v - pts[0].v, pts[pts.length - 1].v)}, {pts[pts.length - 1].v >= pts[0].v ? '+' : '−'}{usd(Math.abs(pts[pts.length - 1].v - pts[0].v))})</span></p>
    </> : null}
    {w.note ? <p className="cw-muted cw-note">{w.note}</p> : null}
    {!edit && rows.length ? <div className="cw-charts"><Donut rows={rows} total={total} /><HBars rows={rows} total={total} /></div> : null}
    <div className="cw-tablebox"><table className="cw-table">
      <thead><tr>{edit ? ['ارز', 'شبکه', 'مقدار', 'قیمت دستی (دلار)', ''].map((t, i) => <th key={i}>{t}</th>)
        : <>{sortBtn('coin', 'ارز')}<th>شبکه</th>{sortBtn('amount', 'مقدار', 'r')}{sortBtn('price', 'قیمت (دلار)', 'r')}{sortBtn('value', 'ارزش', 'r')}{sortBtn('chg', '۲۴ ساعت', 'r')}</>}</tr></thead>
      <tbody>{edit ? edit.rows.map((r, i) => <tr key={i}>
        {['coin', 'chain', 'amount', 'price'].map(k => <td key={k}><input className="cw-in" value={r[k] ?? ''} onChange={e => set(i, k, e.target.value)} dir={k === 'amount' || k === 'price' ? 'ltr' : undefined} inputMode={k === 'amount' || k === 'price' ? 'decimal' : undefined} aria-label={k} /></td>)}
        <td><button type="button" className="cw-icon" onClick={() => setEdit(e => ({ ...e, rows: e.rows.filter((_, j) => j !== i) }))} aria-label="حذف ردیف"><Trash2 size={15} /></button></td>
      </tr>) : sortBy(hs, calc).map((h, i) => <tr key={i}>
        <td>{chartable(h) ? <a className="cw-coinlink" href={chartHref(sym(h))} title={`نمودار ${sym(h)}`}><b>{h.coin}</b></a> : <b>{h.coin || '?'}</b>}{coinChip(h, calc.live(h) != null)}</td>
        <td>{h.chain || '—'}</td><td className="r cw-num">{amt(h.amount)}</td><td className="r cw-num">{amt(calc.priceOf(h))}</td>
        <td className="r cw-num">{usd(calc.val(h))}</td><td className="r"><Chg d={calc.chg(h)} base={calc.val(h)} compact on={on} /></td>
      </tr>)}</tbody>
    </table></div>
    <div className="cw-ops">
      {edit ? <>
        <button type="button" className="lf-btn ghost" onClick={() => setEdit(e => ({ ...e, rows: [...e.rows, { coin: '', chain: '', amount: '', price: '' }] }))}><Plus size={15} /> ردیف جدید</button>
        <button type="button" className="lf-btn" disabled={busy} onClick={save}>{busy ? '…' : 'ذخیره'}</button>
        <button type="button" className="lf-btn ghost" onClick={() => setEdit(null)}>انصراف</button>
      </> : confirm ? <>
        <span>این کیف‌پول برای همیشه پاک شود؟</span>
        <button type="button" className="lf-btn danger" onClick={() => onRemove(w.id)}>بله، پاک کن</button>
        <button type="button" className="lf-btn ghost" onClick={() => setConfirm(false)}>نه</button>
      </> : <>
        <button type="button" className="lf-btn ghost" onClick={start}>ویرایش نام و موجودی</button>
        <button type="button" className="lf-btn ghost danger" onClick={() => setConfirm(true)}>حذف کیف‌پول</button>
      </>}
    </div>
  </article>;
}

// purchases from the exchange's export against what the wallets hold now: what matches, what is missing, profit/loss per coin
function TradesCard({ trades, ws, calc }) {
  const [skip, setSkip] = useState(() => { try { return JSON.parse(localStorage.getItem('lifeos-cw-trade-skip') || '[]'); } catch { return []; } });
  const [show, setShow] = useState('all'), [sort, setSort] = useState({ k: 'cost', dir: -1 }), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false), [confirm, setConfirm] = useState(false), [all, setAll] = useState(false);
  const fileRef = useRef(null), items = trades.items || [];
  const toggle = id => setSkip(s => { const n = s.includes(id) ? s.filter(x => x !== id) : [...s, id]; try { localStorage.setItem('lifeos-cw-trade-skip', JSON.stringify(n)); } catch {} return n; });
  const rows = useMemo(() => {
    const by = {}, row = c => by[c] ||= { coin: c, bought: 0, cost: 0, have: 0, value: 0 };
    for (const t of items) { const c = ALIAS[t.coin] || t.coin, r = row(c), q = (Number(t.amount) || 0) * scale(c, t.date), sign = t.type === 'sell' ? -1 : 1; r.bought += sign * q; r.cost += sign * (Number(t.usd) || 0); }
    for (const w of ws) if (!skip.includes(w.id)) for (const h of w.holdings || []) if (!h.flag) { const r = row(ALIAS[sym(h)] || sym(h)); r.have += Number(h.amount) || 0; r.value += calc.val(h); }
    return Object.values(by).filter(r => r.bought > 1e-9 || r.have > 0).map(r => {
      const live = DEAD.has(r.coin) ? 0 : (r.have ? r.value / r.have : calc.live({ coin: r.coin })), traded = r.bought > 1e-9, diff = r.have - (traded ? r.bought : 0);
      const st = !traded ? 'extra' : !r.have ? 'missing' : Math.abs(diff) <= r.bought * 0.02 ? 'ok' : diff < 0 ? 'less' : 'more';
      return { ...r, st, diff, diffValue: live != null ? diff * live : null, pl: traded ? r.value - r.cost : null, plPct: traded && r.cost > 0 ? (r.value - r.cost) / r.cost * 100 : null };
    });
  }, [items, ws, calc, skip]);
  const traded = rows.filter(r => r.st !== 'extra'), cost = traded.reduce((s, r) => s + r.cost, 0), value = traded.reduce((s, r) => s + r.value, 0);
  const lost = rows.filter(r => r.st === 'missing').reduce((s, r) => s + (r.diffValue ? -r.diffValue : 0), 0);
  const count = k => rows.filter(r => r.st === k).length;
  const key = { coin: r => r.coin, st: r => Object.keys(TSTATUS).indexOf(r.st), cost: r => r.cost, value: r => r.value, pl: r => r.pl ?? -Infinity, plPct: r => r.plPct ?? -Infinity, diff: r => r.diffValue ?? 0 };
  const list = rows.filter(r => show === 'all' || r.st === show).sort((a, b) => { const x = key[sort.k](a), y = key[sort.k](b); return (typeof x === 'string' ? x.localeCompare(y) : x - y) * sort.dir; });
  const th = (k, label, cls = '') => <th className={cls}><button type="button" className="cw-sort" aria-pressed={sort.k === k} onClick={() => setSort(s => s.k === k ? { k, dir: -s.dir } : { k, dir: ['coin', 'st'].includes(k) ? 1 : -1 })}>{label}{sort.k === k ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}</button></th>;
  const signed = v => v == null ? '—' : `${v >= 0 ? '+' : '−'}${usd(Math.abs(v))}`;

  const importCsv = async file => {
    setBusy(true); setMsg('');
    try {
      const parsed = parseTradesCsv(await file.text()), have = new Set(items.map(tradeKey)), fresh = parsed.filter(t => !have.has(tradeKey(t)));
      for (let i = 0; i < fresh.length; i += 200) await trades.addMany(fresh.slice(i, i + 200).map(t => ({ ...t, source: file.name.slice(0, 80) })));
      setMsg(`${fresh.length.toLocaleString('fa-IR')} معاملهٔ تازه وارد شد${parsed.length > fresh.length ? ` (${(parsed.length - fresh.length).toLocaleString('fa-IR')} تکراری کنار گذاشته شد)` : ''}.`);
    } catch (e) { setMsg('فایل وارد نشد: ' + e.message); }
    setBusy(false);
  };
  const clearAll = async () => { setBusy(true); setConfirm(false); for (const t of items) await trades.remove(t.id); setBusy(false); setMsg('همهٔ خریدها پاک شد.'); };

  return <section className="lf-card cw-trades">
    <div className="cw-head"><h3>خرید در برابر موجودی</h3>
      <div className="cw-ops">
        <button type="button" className="lf-btn ghost" disabled={busy} onClick={() => fileRef.current?.click()}><Upload size={15} /> {items.length ? 'افزودن CSV خرید' : 'ورود CSV خریدها'}</button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={e => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ''; }} />
        {items.length ? confirm ? <><span>همهٔ {items.length.toLocaleString('fa-IR')} معامله پاک شود؟</span><button type="button" className="lf-btn danger" onClick={clearAll}>بله</button><button type="button" className="lf-btn ghost" onClick={() => setConfirm(false)}>نه</button></>
          : <button type="button" className="lf-btn ghost danger" disabled={busy} onClick={() => setConfirm(true)}><Trash2 size={15} /> پاک کردن خریدها</button> : null}
      </div></div>
    {msg ? <p className="cw-msg" role="status">{msg}</p> : null}
    {!items.length ? <p className="cw-muted">فایل CSV تاریخچهٔ خرید صرافی (ستون‌های Date, Type, Buy Amount, Currency, Sell Amount, Currency) را وارد کن تا برای هر ارز ببینی چقدر خریدی، چقدر در کیف‌ها مانده و سود و زیانش چقدر است.</p> : <>
      <div className="cw-ranges" role="group" aria-label="کیف‌پول‌های حساب‌شده">{ws.map(w => <button type="button" key={w.id} className="cw-sort" aria-pressed={!skip.includes(w.id)} onClick={() => toggle(w.id)}>{w.name || 'بدون نام'}</button>)}</div>
      <section className="cw-summary">
        <div><small>هزینهٔ خرید</small><b className="cw-num">{usd(cost)}</b></div>
        <div><small>ارزش الان</small><b className="cw-num">{usd(value)}</b></div>
        <div><small>سود / زیان</small><b className={`cw-num ${value >= cost ? 'up' : 'down'}`}>{signed(value - cost)} ({cost ? `${value >= cost ? '+' : '−'}${Math.abs((value - cost) / cost * 100).toFixed(1)}%` : '—'})</b></div>
        {lost > 0 ? <div><small>ارزش گم‌شده‌ها اگر پیدا شوند</small><b className="cw-num">{usd(lost)}</b></div> : null}
      </section>
      <div className="cw-ranges" role="group" aria-label="وضعیت">
        <button type="button" className="cw-sort" aria-pressed={show === 'all'} onClick={() => setShow('all')}>همه {rows.length.toLocaleString('fa-IR')}</button>
        {Object.entries(TSTATUS).map(([k, [l]]) => count(k) ? <button type="button" key={k} className="cw-sort" aria-pressed={show === k} onClick={() => setShow(k)}>{l} {count(k).toLocaleString('fa-IR')}</button> : null)}
      </div>
      <div className="cw-tablebox"><table className="cw-table">
        <thead><tr>{th('coin', 'ارز')}{th('st', 'وضعیت')}<th className="r">خرید</th><th className="r">موجودی</th>{th('diff', 'اختلاف', 'r')}{th('cost', 'هزینه', 'r')}{th('value', 'ارزش الان', 'r')}{th('pl', 'سود/زیان', 'r')}{th('plPct', '٪', 'r')}</tr></thead>
        <tbody>{(all ? list : list.slice(0, 15)).map(r => <tr key={r.coin}>
          <td><b>{r.coin}</b></td>
          <td><span className={`cw-chip ${TSTATUS[r.st][1]}`}>{TSTATUS[r.st][0]}</span></td>
          <td className="r cw-num">{r.st === 'extra' ? '—' : amt(r.bought)}</td><td className="r cw-num">{amt(r.have)}</td>
          <td className="r cw-num">{r.st === 'ok' ? '—' : <>{r.diff >= 0 ? '+' : '−'}{amt(Math.abs(r.diff))}{r.diffValue != null && Math.abs(r.diffValue) >= 0.01 ? <small className="cw-muted"> ({usd(Math.abs(r.diffValue))})</small> : null}</>}</td>
          <td className="r cw-num">{r.st === 'extra' ? '—' : usd(r.cost)}</td><td className="r cw-num">{usd(r.value)}</td>
          <td className={`r cw-num ${r.pl == null ? '' : r.pl >= 0 ? 'up' : 'down'}`}>{signed(r.pl)}</td>
          <td className={`r cw-num ${r.plPct == null ? '' : r.plPct >= 0 ? 'up' : 'down'}`}>{r.plPct == null ? '—' : `${r.plPct >= 0 ? '+' : '−'}${Math.abs(r.plPct).toFixed(0)}%`}</td>
        </tr>)}</tbody>
      </table></div>
      {list.length > 15 ? <button type="button" className="lf-btn ghost" onClick={() => setAll(x => !x)}>{all ? 'نمایش ۱۵ ردیف اول' : `نمایش همهٔ ${list.length.toLocaleString('fa-IR')} ردیف`}</button> : null}
      <p className="cw-muted cw-small">«درست» یعنی موجودی تا ۲٪ با خرید فرق دارد. «کمتر» معمولاً کارمزد برداشت است و «بیشتر» سود staking یا خریدی که در فایل نیست. MATIC به POL و BTT قبل از ۲۰۲۲ ضربدر ۱۰۰۰ حساب شده. خریدهای «ثبت‌نشده» در جمع سود و زیان نیستند.</p>
    </>}
  </section>;
}

export function CryptoPage({ Nav }) {
  const chart = new URLSearchParams(location.search).get('chart');
  return chart ? <ChartView Nav={Nav} coin={chart.toUpperCase()} /> : <WalletsPage Nav={Nav} />;
}

function WalletsPage({ Nav }) {
  const wallets = useCol('cryptoWallets'), hist = useCol('cryptoHistory'), trades = useCol('cryptoTrades');
  const [prices, setPrices] = useState({ usd: {}, change24: {}, at: 0 }), [perr, setPerr] = useState('');
  const [range, setRange] = useState(0), [sort, setSort] = useState({ k: 'value', dir: -1 }), [newName, setNewName] = useState(''), [msg, setMsg] = useState('');
  const [alert, setAlert] = useState(null);
  const extraIds = useRef({}), snapping = useRef(false), fileRef = useRef(null);
  const ws = wallets.items || [], all = ws.flatMap(w => w.holdings || []);
  const symbols = useMemo(() => [...new Set([...all.filter(h => !h.flag).map(sym), ...CHARTS.map(c => c[0]), ...(trades.items || []).map(t => ALIAS[t.coin] || t.coin).filter(c => !DEAD.has(c))])].sort().join(','), [wallets.items, trades.items]);
  const calc = useMemo(() => makeCalc(prices), [prices]), on = prices.at > 0;

  useEffect(() => {
    if (!symbols) return;
    let stop = false;
    const go = () => fetchPrices(symbols.split(','), extraIds.current).then(p => { if (!stop) { setPrices(p); setPerr(''); } }).catch(e => !stop && setPerr(e.message));
    go(); const t = setInterval(go, 5 * 60e3);
    return () => { stop = true; clearInterval(t); };
  }, [symbols]);

  useEffect(() => { api('/api/crypto/alert').then(setAlert).catch(() => {}); }, []);
  const saveAlert = pct => api('/api/crypto/alert', { method: 'PATCH', body: JSON.stringify({ pct }) }).then(setAlert).catch(e => setMsg(e.message));

  // keep a value snapshot at most every 30 minutes, in one document per Tehran day
  useEffect(() => {
    if (!on || !wallets.items || !hist.items || snapping.current || !ws.length) return;
    const last = Math.max(0, ...hist.items.flatMap(d => (d.points || []).filter(p => !p.est).map(p => Date.parse(p.t) || 0)));
    if (Date.now() - last < SNAP_EVERY) return;
    snapping.current = true;
    const vals = Object.fromEntries(ws.map(w => [w.id, Math.round((w.holdings || []).reduce((s, h) => s + calc.val(h), 0) * 100) / 100]));
    const point = { t: new Date().toISOString(), total: Math.round(Object.values(vals).reduce((a, b) => a + b, 0) * 100) / 100, wallets: vals };
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date()), doc = hist.items.find(d => d.day === day);
    (doc ? hist.patch(doc.id, { points: [...(doc.points || []), point] }) : hist.add({ day, points: [point] })).finally(() => { snapping.current = false; });
  }, [prices, wallets.items, hist.items]);

  const grand = all.reduce((s, h) => s + calc.val(h), 0);
  const history = pick => { const from = range ? Date.now() - range * 864e5 : 0; return (hist.items || []).flatMap(d => d.points || []).map(p => ({ t: Date.parse(p.t), v: pick(p), est: !!p.est })).filter(p => p.t >= from && typeof p.v === 'number').sort((a, b) => a.t - b.t); };
  const totalPts = history(p => p.total), alloc = foldSmall(sumRows(all, h => String(h.coin || '?').trim(), calc.val), 7);
  const est = totalPts.filter(p => p.est);

  const keyOf = { coin: h => String(h.coin || '').trim(), amount: h => Number(h.amount) || 0, price: h => calc.priceOf(h), value: h => calc.val(h), chg: h => prices.change24[sym(h)] ?? 0 };
  const cmp = (a, b) => (typeof a === 'string' ? a.localeCompare(b) : a - b) * sort.dir;
  const sortBy = hs => keyOf[sort.k] ? [...hs].sort((a, b) => cmp(keyOf[sort.k](a), keyOf[sort.k](b))) : hs;
  // text columns start A→Z, number columns start largest first
  const sortBtn = (k, label, cls = '') => <th key={k + label} className={cls}><button type="button" className="cw-sort" aria-pressed={sort.k === k} onClick={() => setSort(s => s.k === k ? { k, dir: -s.dir } : { k, dir: ['coin', 'wallets'].includes(k) ? 1 : -1 })}>{label}{sort.k === k ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}</button></th>;

  const combined = useMemo(() => {
    const by = {};
    ws.forEach(w => (w.holdings || []).forEach(h => { const k = String(h.coin || '?').trim(), r = by[k] ||= { coin: k, amount: 0, value: 0, d: 0, chg: prices.change24[sym(h)] ?? 0, price: calc.priceOf(h), live: calc.live(h) != null, flag: h.flag, wallets: new Set() }; r.amount += Number(h.amount) || 0; r.value += calc.val(h); r.d += calc.chg(h); r.wallets.add(shortName(w.name)); }));
    const rk = r => sort.k === 'wallets' ? [...r.wallets].join('، ') : r[sort.k];
    return Object.values(by).sort((a, b) => cmp(rk(a), rk(b)));
  }, [wallets.items, calc, sort]);

  const addWallet = async e => { e.preventDefault(); if (!newName.trim()) return; await wallets.add({ name: newName.trim(), holdings: [] }); setNewName(''); };
  const exportCsv = () => {
    const cell = v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
    const lines = [['wallet', 'coin', 'network', 'chain', 'amount', 'price_usd', 'value_usd', 'change_24h_pct', 'price_source'], ...ws.flatMap(w => (w.holdings || []).map(h => [w.name || '', h.coin || '', net(h), h.chain || '', Number(h.amount) || 0, calc.priceOf(h), calc.val(h).toFixed(2), prices.change24[sym(h)] != null ? prices.change24[sym(h)].toFixed(2) : '', calc.live(h) != null ? 'CoinGecko' : 'manual']))];
    // BOM so Excel reads the Persian names as UTF-8
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + lines.map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv' })); a.download = `wallets-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  // one-time move from the old dashboard: {wallets:[{id,name,note,holdings}], history:[{day,points}]}; wallet ids inside points are remapped
  const importJson = async file => {
    try {
      const d = JSON.parse(await file.text());
      if (!Array.isArray(d.wallets) || !d.wallets.every(w => w && typeof w.name === 'string' && Array.isArray(w.holdings))) throw new Error('ساختار فایل درست نیست.');
      const made = await wallets.addMany(d.wallets.map(({ name, note, holdings }) => ({ name, note, holdings })));
      const map = Object.fromEntries(d.wallets.map((w, i) => [w.id, made?.[i]?.id]).filter(([a, b]) => a && b));
      const remap = p => ({ ...p, wallets: Object.fromEntries(Object.entries(p.wallets || {}).map(([k, v]) => [map[k] || k, v])) });
      for (const h of d.history || []) if (h && typeof h.day === 'string' && Array.isArray(h.points)) await hist.add({ day: h.day, points: h.points.map(remap) });
      setMsg(`${d.wallets.length.toLocaleString('fa-IR')} کیف‌پول و ${(d.history || []).length.toLocaleString('fa-IR')} روز تاریخچه وارد شد.`);
    } catch (e) { setMsg('فایل وارد نشد: ' + e.message); }
  };

  return <Page Nav={Nav} className="cw" kicker="مالی" title="کیف‌پول‌های کریپتو" sub="موجودی همهٔ کیف‌پول‌ها با قیمت لحظه‌ای CoinGecko"
    actions={<>
      <button type="button" className="lf-btn ghost" onClick={exportCsv} disabled={!ws.length}><Download size={15} /> CSV برای Excel</button>
      <button type="button" className="lf-btn ghost" onClick={() => fileRef.current?.click()}><Upload size={15} /> ورود از فایل</button>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} />
    </>}>
    {msg ? <p className="cw-msg" role="status">{msg}</p> : null}
    {wallets.err || perr ? <p className="cw-err" role="status">⚠ {wallets.err || perr}</p> : null}
    {wallets.items === null ? <Loader /> : <>
      <section className="cw-summary">
        <div><small>ارزش کل</small><b className="cw-total cw-num">{usd(grand)}</b></div>
        <div><small>تغییر ۲۴ ساعته</small><b><Chg d={all.reduce((s, h) => s + calc.chg(h), 0)} base={grand} on={on} /></b></div>
        <div><small>تعداد کیف‌پول</small><b>{ws.length.toLocaleString('fa-IR')}</b></div>
        <div><small>بیشترین سهم</small><b>{alloc.length && grand ? `${alloc[0][0]} · ${(alloc[0][1] / grand * 100).toFixed(0)}%` : '—'}</b></div>
      </section>
      {alloc.length ? <section className="cw-alloc">
        <div className="cw-bar">{alloc.map(([k, v], i) => <span key={k} title={k} style={{ width: `${v / grand * 100}%`, background: COLORS[i % 8] }} />)}</div>
        <ul className="cw-legend">{alloc.map(([k, v], i) => <li key={k}><i style={{ background: COLORS[i % 8] }} />{k} <span className="cw-num">{(v / grand * 100).toFixed(1)}%</span></li>)}</ul>
      </section> : null}
      <section className="cw-market" aria-label="نمودار بازار">
        {CHARTS.map(([k, n]) => { const p = prices.usd[k], c = prices.change24[k]; return <a key={k} href={chartHref(k)} className="lf-card cw-coin">
          <span className="cw-coin-h"><b>{k}</b><small className="cw-muted">{n}</small><LineIcon size={15} aria-hidden="true" /></span>
          <b className="cw-num">{p != null ? usd(p) : '—'}</b>
          {c != null ? <span className={`cw-num ${c >= 0 ? 'up' : 'down'}`}>{c >= 0 ? '+' : '−'}{Math.abs(c).toFixed(2)}%</span> : <span className="cw-muted">—</span>}
        </a>; })}
      </section>
      {symbols ? <p className="cw-muted cw-small">{on ? `قیمت لحظه‌ای از CoinGecko · آخرین به‌روزرسانی ${new Date(prices.at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })} (هر ۵ دقیقه)` : 'در حال گرفتن قیمت لحظه‌ای…'}</p> : null}

      <section className="lf-card">
        <div className="cw-head"><h3>ارزش کل در طول زمان</h3>
          <div className="cw-ranges" role="group" aria-label="بازهٔ زمانی">{RANGES.map(([d, l]) => <button type="button" key={d} className="cw-sort" aria-pressed={range === d} onClick={() => setRange(d)}>{l}</button>)}</div></div>
        {totalPts.length >= 2 ? <LineChart pts={totalPts} label="ارزش کل در طول زمان" /> : <p className="cw-muted">این نمودار وقتی صفحه باز است هر ۳۰ دقیقه، و از طرف سرور هر ۶ ساعت، یک نقطه می‌گیرد و از نقطهٔ دوم نمایش داده می‌شود.</p>}
        {totalPts.length >= 2 ? <p className="cw-muted cw-small">از {usd(totalPts[0].v)} به {usd(totalPts[totalPts.length - 1].v)} ({pctTxt(totalPts[totalPts.length - 1].v - totalPts[0].v, totalPts[totalPts.length - 1].v)}){est.length ? ` · روزهای قبل از ${new Date(est[est.length - 1].t + 864e5).toLocaleDateString('fa-IR')} تخمینی است: مقدار فعلی ارزها × قیمت پایانی آن روز (Binance). خرید و فروش‌های گذشته در آن حساب نشده.` : ''}</p> : null}
      </section>

      {alert ? <section className="lf-card cw-alert">
        <div className="cw-head"><h3>هشدار تلگرام</h3>
          <div className="cw-ranges" role="group" aria-label="آستانهٔ هشدار">{ALERTS.map(([v, l]) => <button type="button" key={v} className="cw-sort" aria-pressed={alert.pct === v} onClick={() => saveAlert(v)}>{l}</button>)}</div></div>
        <p className="cw-muted cw-small">{alert.pct ? `وقتی ارزش کل در ۲۴ ساعت ${alert.pct.toLocaleString('fa-IR')}٪ یا بیشتر بالا یا پایین برود، به تلگرام پیام می‌آید (حداکثر هر ۱۲ ساعت یک بار؛ سرور هر ساعت قیمت‌ها را چک می‌کند).` : 'هشدار خاموش است.'}{alert.telegram ? '' : ' تلگرام هنوز وصل نیست؛ از «تنظیمات» وصلش کن.'}{alert.lastAlertAt ? ` آخرین هشدار: ${new Date(alert.lastAlertAt).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' })}` : ''}</p>
      </section> : null}

      <div className="cw-pair">
        {all.length ? <section className="lf-card"><h3>بر اساس شبکه</h3><HBars rows={foldSmall(sumRows(all, net, calc.val))} total={grand} /></section> : null}
        {ws.length > 1 ? <section className="lf-card"><h3>مقایسهٔ کیف‌پول‌ها</h3><HBars rows={ws.map(w => [w.name || 'بدون نام', (w.holdings || []).reduce((s, h) => s + calc.val(h), 0)]).sort((a, b) => b[1] - a[1])} total={grand} /></section> : null}
      </div>

      {combined.length ? <section className="lf-card"><h3>مجموع همهٔ کیف‌پول‌ها</h3>
        <div className="cw-tablebox"><table className="cw-table">
          <thead><tr>{sortBtn('coin', 'ارز')}{sortBtn('amount', 'مقدار کل', 'r')}{sortBtn('price', 'قیمت (دلار)', 'r')}{sortBtn('value', 'ارزش', 'r')}{sortBtn('chg', '۲۴ ساعت', 'r')}{sortBtn('value', 'سهم', 'r')}{sortBtn('wallets', 'کیف‌پول')}</tr></thead>
          <tbody>{combined.map(r => <tr key={r.coin}>
            <td>{chartable({ coin: r.coin, flag: r.flag }) ? <a className="cw-coinlink" href={chartHref(r.coin.toUpperCase())} title={`نمودار ${r.coin}`}><b>{r.coin}</b></a> : <b>{r.coin}</b>}{coinChip({ coin: r.coin, flag: r.flag }, r.live)}</td>
            <td className="r cw-num">{amt(r.amount)}</td><td className="r cw-num">{amt(r.price)}</td><td className="r cw-num">{usd(r.value)}</td>
            <td className="r"><Chg d={r.d} base={r.value} compact on={on} /></td><td className="r cw-num">{grand ? (r.value / grand * 100).toFixed(1) + '%' : '—'}</td>
            <td className="cw-nowrap">{[...r.wallets].join('، ')}</td>
          </tr>)}</tbody>
          <tfoot><tr><td>جمع</td><td /><td /><td className="r cw-num">{usd(grand)}</td><td className="r"><Chg d={combined.reduce((s, r) => s + r.d, 0)} base={grand} compact on={on} /></td><td className="r cw-num">100%</td><td /></tr></tfoot>
        </table></div></section> : null}

      {ws.length ? <TradesCard trades={trades} ws={ws} calc={calc} /> : null}

      <h2 className="cw-h2">هر کیف‌پول جدا</h2>
      <form className="cw-add" onSubmit={addWallet}>
        <input className="cw-in" value={newName} onChange={e => setNewName(e.target.value)} maxLength={60} placeholder="نام کیف‌پول جدید (مثلاً Ledger یا صرافی)" aria-label="نام کیف‌پول جدید" />
        <button type="submit" className="lf-btn"><Plus size={15} /> افزودن کیف‌پول</button>
      </form>
      {!ws.length ? <p className="cw-muted">هنوز کیف‌پولی نداری. اسم اولین کیف‌پول را بالا بنویس، یا فایل منتقل‌شده را با «ورود از فایل» بیاور.</p> : null}
      {ws.map(w => <WalletCard key={w.id} w={w} calc={calc} on={on} sortBy={sortBy} sortBtn={sortBtn} history={history} onSave={wallets.patch} onRemove={wallets.remove} />)}
    </>}
  </Page>;
}
