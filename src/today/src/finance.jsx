import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './finance.css'
import { jalaliShort, jalaliDay } from './jalali'
import { JalaliDateInput, isoToJ, jToIso, MONTHS as JMONTHS, monthLen } from './jdate';
import { BillsPanel } from './life';
import { FunOverview, PfTrend, useUsdHistory, makeRateOn, setFunUnit } from './fun';
import { XCards, CopyBtn, Spark, xcAuto } from './xcards';

const api = async (url, options) => {
  const response = await fetch(url, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'دریافت اطلاعات ناموفق بود.')
  return body
}

const isoToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const fa = (n) => Number(n || 0).toLocaleString('fa-IR')
const faD = (v) => String(v ?? '').replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])
// display unit (data is always stored in rial); set from the component on every render
let UNIT = 'rial'
const UNIT_FA = () => (UNIT === 'toman' ? 'تومان' : 'ریال')
const conv = (n) => (UNIT === 'toman' ? Math.round((Number(n) || 0) / 10) : Number(n) || 0)
const amt = (n) => fa(conv(n))
const faMoney = (n) => `${amt(n)} ${UNIT_FA()}`
const short = (n, withUnit = true) => {
  const x = conv(n), a = Math.abs(x), f = (v) => v.toLocaleString('fa-IR', { maximumFractionDigits: v >= 100 ? 0 : v >= 10 ? 1 : 2 })
  const s = a >= 1e9 ? `${f(x / 1e9)} میلیارد` : a >= 1e6 ? `${f(x / 1e6)} میلیون` : a >= 1e4 ? `${f(x / 1e3)} هزار` : fa(x)
  return withUnit ? `${s} ${UNIT_FA()}` : s
}
const compact = (n) => short(n)
// Jalali months — key "1405-07"
const jKeyOf = (iso) => { const j = isoToJ(iso); return `${j.jy}-${String(j.jm).padStart(2, '0')}` }
const jParts = (k) => k.split('-').map(Number)
const jRange = (k) => { const [y, m] = jParts(k); return { from: jToIso(y, m, 1), to: jToIso(y, m, monthLen(y, m)) } }
const legacyKey = (k) => { const [y, m] = jParts(k); return jToIso(y, m, 15).slice(0, 7) }
const monthFa = (k) => { const [y, m] = jParts(k); return `${JMONTHS[m - 1]} ${faD(y)}` }
const shiftMonth = (k, d) => { let [y, m] = jParts(k); m += d; while (m > 12) { m -= 12; y++ } while (m < 1) { m += 12; y-- } return `${y}-${String(m).padStart(2, '0')}` }
const ACC_FA = { bank: 'بانک', card: 'کارت', cash: 'نقدی' }
const GOLD_FA = { geram18: 'طلای ۱۸ عیار (گرم)', geram24: 'طلای ۲۴ عیار (گرم)', sekee: 'سکه امامی', sekeb: 'سکه بهار آزادی', nim: 'نیم‌سکه', rob: 'ربع‌سکه', gerami: 'سکه گرمی', mesghal: 'مثقال طلا' }
const ASSET_FA = { crypto: 'رمزارز', stock: 'سهام', gold: 'طلا', dollar: 'ارز', euro: 'ارز', other: 'سایر' }
const dueInfo = (iso) => {
  if (!iso) return { label: 'بی‌سررسید', cls: '' }
  const d = Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${isoToday()}T00:00:00Z`)) / 864e5)
  if (d < 0) return { label: `${fa(-d)} روز گذشته`, cls: 'late' }
  if (d === 0) return { label: 'امروز', cls: 'soon' }
  if (d <= 7) return { label: `${fa(d)} روز مانده`, cls: 'soon' }
  return { label: jalaliShort(iso), cls: '' }
}
// When the money was lent/borrowed (not a due date): «۱۵ مهر · ۲۰ روز پیش». Old rows with only a dueDate keep the due chip.
const givenInfo = (item) => {
  const iso = item.date || (item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : '')
  if (item.dueDate && !item.date) return dueInfo(item.dueDate)
  if (!iso) return { label: '', cls: '' }
  const d = Math.round((Date.parse(`${isoToday()}T00:00:00Z`) - Date.parse(`${iso}T00:00:00Z`)) / 864e5)
  return { label: `${new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric', month: 'long', ...(iso.slice(0, 4) !== isoToday().slice(0, 4) ? { year: 'numeric' } : {}), timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z'))}${d > 0 ? ` · ${fa(d)} روز پیش` : d === 0 ? ' · امروز' : ''}`, cls: '' }
}
const isMisc = (t) => t.kind === 'expense' && (!t.category || String(t.category).trim() === 'متفرقه')

function MonthPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [y, m] = jParts(value)
  const [yy, setYy] = useState(y)
  useEffect(() => { if (open) setYy(y) }, [open])
  useEffect(() => { if (!open) return; const c = (e) => { if (!e.target.closest?.('.fn-mp')) setOpen(false) }; document.addEventListener('pointerdown', c); return () => document.removeEventListener('pointerdown', c) }, [open])
  const cur = jKeyOf(isoToday())
  return (
    <div className="fn-mp">
      <button type="button" className="fn-mp-nav" onClick={() => onChange(shiftMonth(value, -1))} aria-label="ماه قبل"><ChevronRight size={18} aria-hidden="true" /></button>
      <button type="button" className="fn-mp-btn" onClick={() => setOpen((v) => !v)}>{JMONTHS[m - 1]} {faD(y)} <span>▾</span></button>
      <button type="button" className="fn-mp-nav" onClick={() => onChange(shiftMonth(value, 1))} aria-label="ماه بعد"><ChevronLeft size={18} aria-hidden="true" /></button>
      {value !== cur ? <button type="button" className="fn-mp-today" onClick={() => onChange(cur)}>این ماه</button> : null}
      {open ? (
        <div className="fn-mp-pop">
          <div className="fn-mp-year"><button type="button" onClick={() => setYy(yy - 1)} aria-label="سال قبل"><ChevronRight size={18} aria-hidden="true" /></button><b>{faD(yy)}</b><button type="button" onClick={() => setYy(yy + 1)} aria-label="سال بعد"><ChevronLeft size={18} aria-hidden="true" /></button></div>
          <div className="fn-mp-grid">{JMONTHS.map((name, i) => { const k = `${yy}-${String(i + 1).padStart(2, '0')}`; return <button type="button" key={k} className={`${k === value ? 'on' : ''} ${k === cur ? 'cur' : ''}`} onClick={() => { onChange(k); setOpen(false) }}>{name}</button> })}</div>
        </div>
      ) : null}
    </div>
  )
}

function BudgetInline({ cat, value, hint, onSave, onCancel }) {
  return (
    <form className="fn-pay fn-binline" onSubmit={(e) => { e.preventDefault(); const v = Number(String(new FormData(e.currentTarget).get('limit') || '').replace(/[^\d]/g, '')); if (v > 0) onSave(cat, v) }}>
      <input name="limit" required inputMode="numeric" autoFocus defaultValue={value || ''} placeholder={`سقف ${cat === '__total__' ? 'کل ماه' : cat} (ریال)${hint ? ` — این ماه ${Math.round(hint).toLocaleString('fa-IR')}` : ''}`} />
      <button className="fn-save">ذخیره</button>
      <button type="button" className="fn-link" onClick={onCancel}>انصراف</button>
    </form>
  )
}

// "+" button that opens a side drawer holding a form; closes itself after a successful submit
function Drawer({ label, title, children }) {
  const [open, setOpen] = useState(false)
  useEffect(() => { if (!open) return; const k = (e) => e.key === 'Escape' && setOpen(false); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [open])
  return (
    <>
      <button type="button" className="fn-add" onClick={() => setOpen(true)}>＋ {label}</button>
      {open ? (
        <div className="fn-drawer-bg" onClick={() => setOpen(false)}>
          <aside className="fn-drawer" onClick={(e) => e.stopPropagation()} onSubmit={() => setTimeout(() => setOpen(false), 0)}>
            <header><h2>{title || label}</h2><button type="button" onClick={() => setOpen(false)} aria-label="بستن">×</button></header>
            {children}
          </aside>
        </div>
      ) : null}
    </>
  )
}
const CATS = ['خوراک', 'حمل‌ونقل', 'قبض', 'مسکن', 'سلامت', 'تفریح', 'آموزش', 'پوشاک', 'حقوق', 'سرمایه‌گذاری', 'هدیه', 'سفر', 'متفرقه']
const ICONS = { 'خوراک': '🍔', 'حمل‌ونقل': '🚕', 'قبض': '🧾', 'مسکن': '🏠', 'سلامت': '💊', 'تفریح': '🎮', 'آموزش': '📚', 'پوشاک': '👕', 'حقوق': '💼', 'سرمایه‌گذاری': '📈', 'هدیه': '🎁', 'سفر': '✈️', 'متفرقه': '📦', 'انتقال': '🔄' }
const COLORS = ['#22d3ee', '#a78bfa', '#fbbf24', '#34d399', '#f472b6', '#60a5fa', '#fb7185', '#4ade80', '#f97316']
const usd = (n) => `$${fa(Math.round((Math.abs(Number(n) || 0)) * 100) / 100)}`
const signedUsd = (n) => `${Number(n) >= 0 ? '+' : '−'}${usd(n)}`
const ALERT_COND = { price_above: 'قیمت بالاتر از', price_below: 'قیمت پایین‌تر از', pnl_pct_above: 'سود٪ بالاتر از', pnl_pct_below: 'زیان٪ پایین‌تر از' }
const TABS = [
  { id: 'dash', label: 'داشبورد' },
  { id: 'ledger', label: 'تراکنش‌ها' },
  { id: 'budget', label: 'بودجه و حساب‌ها' },
  { id: 'bills', label: 'قبض و اشتراک' },
  { id: 'wealth', label: 'بدهی و سرمایه' },
  { id: 'fun', label: 'بت و پوکر' },
]
const FILTERS = [['all', 'همه'], ['expense', 'هزینه'], ['income', 'درآمد'], ['transfer', 'انتقال'], ['misc', 'بدون دسته']]

function AreaChart({ series }) {
  const w = 640, h = 220, pad = 28
  const withNet = series.map((s) => ({ ...s, net: (s.income || 0) - (s.expense || 0) }))
  const vals = withNet.flatMap((s) => [s.income, s.expense, s.net])
  const max = Math.max(...vals, 1)
  const min = Math.min(0, ...vals)
  const span = Math.max(1, max - min)
  const x = (i) => pad + (i / Math.max(1, withNet.length - 1)) * (w - pad * 2)
  const y = (v) => h - pad - ((v - min) / span) * (h - pad * 2)
  const zeroY = y(0)
  const path = (key) => withNet.map((s, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(s[key])}`).join(' ')
  const area = (key) => `${path(key)} L ${x(withNet.length - 1)} ${zeroY} L ${x(0)} ${zeroY} Z`
  if (!series.length) return <p className="fn-empty">برای نمودار به چند ماه تراکنش نیاز است.</p>
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="fn-svg" role="img" aria-label="روند درآمد، هزینه و خالص">
      <defs>
        <linearGradient id="fnInc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity="0.4" /><stop offset="100%" stopColor="#34d399" stopOpacity="0" /></linearGradient>
        <linearGradient id="fnExp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fb7185" stopOpacity="0.4" /><stop offset="100%" stopColor="#fb7185" stopOpacity="0" /></linearGradient>
      </defs>
      {min < 0 ? <line x1={pad} x2={w - pad} y1={zeroY} y2={zeroY} stroke="#334155" strokeWidth="1" strokeDasharray="3 3" /> : null}
      <path d={area('income')} fill="url(#fnInc)" />
      <path d={area('expense')} fill="url(#fnExp)" />
      <path d={path('income')} fill="none" stroke="#34d399" strokeWidth="2.4" />
      <path d={path('expense')} fill="none" stroke="#fb7185" strokeWidth="2.4" />
      <path d={path('net')} fill="none" stroke="#fbbf24" strokeWidth="2" strokeDasharray="5 3" />
      {withNet.map((s, i) => <text key={s.month} x={x(i)} y={h - 8} textAnchor="middle" fill="#8aa0b8" fontSize="12">{s.label || s.month.slice(5)}</text>)}
    </svg>
  )
}

function Donut({ slices }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1
  const r = 54, c = 2 * Math.PI * r
  let off = 0
  return (
    <div className="fn-donut">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <g transform="translate(70,70) rotate(-90)">
          {slices.map((s, i) => {
            const len = (s.value / total) * c
            const el = <circle key={s.name} r={r} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth="16" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off} />
            off += len
            return el
          })}
        </g>
      </svg>
      <div className="fn-legend">
        {slices.map((s, i) => <div key={s.name} title={faMoney(s.value)}><span style={{ background: COLORS[i % COLORS.length] }} />{s.name} · {short(s.value)}</div>)}
      </div>
    </div>
  )
}


// expanded asset card: quantity, cost, P/L and a 30-day price sparkline from TGJU (gold / dollar / euro)
// The buys/sells behind one holding, each editable (quantity, unit price, date) or removable.
function AssetTxs({ row, onChanged }) {
  const [items, setItems] = useState(null), [edit, setEdit] = useState(null), [err, setErr] = useState('')
  const load = () => api(`/api/investments/tx?symbol=${encodeURIComponent(row.item.symbol)}`).then((d) => setItems((d.items || []).filter((t) => t.assetType === row.item.assetType))).catch((e) => setErr(e.message))
  useEffect(() => { load() }, [row.item.symbol])
  const face = row.item.assetType === 'dollar' || row.item.assetType === 'euro'
  const save = async (e) => {
    e.preventDefault(); const f = new FormData(e.currentTarget), num = (v) => Number(String(v || '').replace(/[,٬]/g, '').replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    const body = { quantity: num(f.get('quantity')), date: f.get('date') || edit.date, type: f.get('type') }
    if (!face) body.price = num(f.get('price'))
    if (!(body.quantity > 0) || (!face && !(body.price > 0))) { setErr('تعداد و قیمت معتبر لازم است.'); return }
    try { await api(`/api/investments/tx/${edit.id}`, { method: 'PATCH', body: JSON.stringify(body) }); setEdit(null); setErr(''); await load(); onChanged() } catch (x) { setErr(x.message) }
  }
  const del = async (t) => { if (!window.confirm(`این ${t.type === 'sell' ? 'فروش' : 'خرید'} (${fa(t.quantity)} واحد · ${jalaliShort(t.date)}) حذف شود؟`)) return; try { await api(`/api/investments/tx/${t.id}`, { method: 'DELETE' }); await load(); onChanged() } catch (x) { setErr(x.message) } }
  if (items === null) return <p className="xc-sub">{err || 'در حال دریافت خریدها…'}</p>
  return <div className="xc-txs">
    <small className="xc-txh">خرید و فروش‌ها</small>
    {items.map((t) => edit?.id === t.id ? <form key={t.id} className="xc-txedit" onSubmit={save} onClick={(e) => e.stopPropagation()}>
      <select name="type" defaultValue={t.type}><option value="buy">خرید</option><option value="sell">فروش</option></select>
      <input name="quantity" defaultValue={t.quantity} inputMode="decimal" aria-label="تعداد" placeholder="تعداد" />
      {face ? null : <input name="price" defaultValue={t.price} inputMode="decimal" aria-label="قیمت واحد" placeholder="قیمت واحد" />}
      <JalaliDateInput name="date" defaultValue={t.date} clearable={false} />
      <button className="fn-save">ذخیره</button><button type="button" className="fn-link" onClick={() => setEdit(null)}>انصراف</button>
    </form> : <div key={t.id} className="xc-tx">
      <span>{t.type === 'sell' ? 'فروش' : t.type === 'buy' ? 'خرید' : t.type === 'dividend' ? 'سود نقدی' : 'کارمزد'} · {jalaliShort(t.date)}</span>
      <b>{t.quantity ? `${fa(t.quantity)} واحد` : ''}{t.price && !face ? ` × ${faMoney(t.price)}` : t.amount ? faMoney(t.amount) : ''}</b>
      <span className="xc-txops"><button type="button" onClick={(e) => { e.stopPropagation(); setEdit(t) }}>ویرایش</button><button type="button" className="del" onClick={(e) => { e.stopPropagation(); del(t) }}>حذف</button></span>
    </div>)}
    {err ? <p className="xc-sub">⚠ {err}</p> : null}
  </div>
}

// Today's price of a holding: Tehran-exchange stocks fetch theirs from TSETMC, anything else can be typed in.
function AssetPrice({ row, onChanged }) {
  const it = row.item, tse = it.assetType === 'stock' && /[\u0600-\u06FF]/.test(it.symbol), live = it.assetType === 'crypto' || tse
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState(''), [val, setVal] = useState('')
  if (it.assetType === 'dollar' || it.assetType === 'euro' || it.assetType === 'gold') return null
  const ago = it.priceUpdatedAt ? Math.round((Date.now() - it.priceUpdatedAt) / 60000) : null
  const refresh = async (e) => { e.stopPropagation(); setBusy(true); setMsg(''); try { const r = await api('/api/investments/price/refresh', { method: 'POST', body: JSON.stringify({ symbol: it.symbol, assetType: it.assetType }) }); setMsg(`قیمت روز: ${faMoney(r.price)}`); onChanged() } catch (x) { setMsg(x.message) } setBusy(false) }
  const saveManual = async (e) => { e.preventDefault(); e.stopPropagation(); const price = Number(String(val).replace(/[,٬]/g, '').replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))); if (!(price > 0)) { setMsg('قیمت معتبر بنویس.'); return } try { await api('/api/investments/price', { method: 'POST', body: JSON.stringify({ symbol: it.symbol, assetType: it.assetType, price }) }); setVal(''); setMsg('قیمت ثبت شد.'); onChanged() } catch (x) { setMsg(x.message) } }
  return <div className="xc-price" onClick={(e) => e.stopPropagation()}>
    <span><small>قیمت روز</small><b>{faMoney(it.currentPrice)}</b><em>{it.priceSource === 'bourse' || it.priceSource === 'tsetmc' ? 'از بورس' : it.priceSource === 'live' ? 'خودکار' : 'دستی / قیمت خرید'}{ago != null ? ` · ${ago < 60 ? `${fa(ago)} دقیقه` : ago < 1440 ? `${fa(Math.round(ago / 60))} ساعت` : `${fa(Math.round(ago / 1440))} روز`} پیش` : ''}</em></span>
    {live ? <button type="button" disabled={busy} onClick={refresh}>{busy ? '…' : tse ? 'قیمت از بورس' : 'قیمت روز'}</button> : null}
    <form onSubmit={saveManual}><input value={val} onChange={(e) => setVal(e.target.value)} inputMode="decimal" data-raw="" placeholder="قیمت دستی" aria-label="قیمت روز دستی" /><button type="submit">ثبت</button></form>
    {msg ? <small className="xc-pmsg">{msg}</small> : null}
  </div>
}

// Paste a portfolio (one holding per line: «نماد تعداد میانگین‌قیمت», any separators, Persian digits ok) → buys.
// With «جایگزین» the symbol's earlier buys/sells are removed first, so pasting again never double-counts.
const toLatin = (v) => String(v).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
function parsePortfolio(text) {
  return String(text || '').split(/\n+/).map((line) => {
    const sym = (line.match(/[\u0621-\u064A\u067E-\u06D3][\u0621-\u064A\u067E-\u06D3\u200c]*/) || [])[0]?.trim()
    const nums = (toLatin(line).replace(/\([^)]*\)/g, ' ').match(/\d[\d,٬]*(?:\.\d+)?/g) || []).map((n) => Number(n.replace(/[,٬]/g, ''))).filter((n) => n > 0)
    return sym && nums.length >= 2 ? { symbol: sym, quantity: nums[0], price: nums[1] } : null
  }).filter(Boolean)
}
function PortfolioImport({ onDone }) {
  const [text, setText] = useState(''), [replace, setReplace] = useState(true), [busy, setBusy] = useState(false), [msg, setMsg] = useState('')
  const rows = parsePortfolio(text)
  const run = async (e) => {
    e.preventDefault(); if (!rows.length) return; setBusy(true); let done = 0; const bad = []
    for (const r of rows) {
      setMsg(`در حال ثبت ${fa(done + 1)} از ${fa(rows.length)}: ${r.symbol}…`)
      try {
        if (replace) { const old = await api(`/api/investments/tx?symbol=${encodeURIComponent(r.symbol)}`); for (const t of old.items || []) if (t.assetType === 'stock') await api(`/api/investments/tx/${t.id}`, { method: 'DELETE' }) }
        await api('/api/investments/tx', { method: 'POST', body: JSON.stringify({ assetType: 'stock', symbol: r.symbol, type: 'buy', quantity: r.quantity, price: r.price, currency: 'IRR', date: isoToday(), note: 'وارد شده از پرتفوی' }) })
        await api('/api/investments/price/refresh', { method: 'POST', body: JSON.stringify({ symbol: r.symbol, assetType: 'stock' }) }).catch(() => {})
        done++
      } catch (x) { bad.push(`${r.symbol} (${x.message})`) }
    }
    setBusy(false); setMsg(`${fa(done)} نماد ثبت شد.${bad.length ? ` نشد: ${bad.join('، ')}` : ''}`); if (done) { setText(''); onDone() }
  }
  return <form className="fn-form fn-import" onSubmit={run}>
    <p className="fn-note">هر سهم در یک خط: نماد، تعداد، میانگین قیمت خرید (ریال). مثلاً:<br /><span dir="rtl">عیار ۲۹۱۹ ۵۳۴٬۸۰۸</span></p>
    <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder={'عیار 2919 534808\nسیلور 23532 13209\nشکیمیا 533 5941'} aria-label="متن پرتفوی" />
    {rows.length ? <table className="fn-imp-t"><thead><tr><th>نماد</th><th>تعداد</th><th>میانگین خرید</th><th>بهای کل</th></tr></thead><tbody>{rows.map((r, i) => <tr key={i}><td>{r.symbol}</td><td>{fa(r.quantity)}</td><td>{fa(r.price)}</td><td>{short(r.quantity * r.price)}</td></tr>)}</tbody></table> : text.trim() ? <p className="fn-note">خطی پیدا نشد که نماد و دو عدد (تعداد و قیمت) داشته باشد.</p> : null}
    <button type="button" className={`fn-toggle${replace ? ' on' : ''}`} role="switch" aria-checked={replace} onClick={() => setReplace((v) => !v)}><i aria-hidden="true" /><span>جایگزین ثبت‌های قبلی همین نمادها</span></button>
    <button className="fn-save" disabled={busy || !rows.length}>{busy ? '…' : `ثبت ${rows.length ? fa(rows.length) + ' نماد' : ''}`}</button>
    {msg ? <p className="fn-note" role="status">{msg}</p> : null}
  </form>
}

function AssetMore({ row, onChanged }) {
  const key = row.item.assetType === 'gold' ? row.item.symbol : row.item.assetType === 'dollar' ? 'price_dollar_rl' : row.item.assetType === 'euro' ? 'price_eur' : null
  const [hist, setHist] = useState(null)
  useEffect(() => { if (key) api(`/api/tgju/history?key=${encodeURIComponent(key)}&days=30`).then((d) => setHist((d.items || []).map((x) => x.price).filter((v) => v > 0))).catch(() => setHist([])) }, [key])
  const pct = row.cost ? (row.pnl / row.cost) * 100 : 0, ch = hist && hist.length > 1 ? ((hist[hist.length - 1] - hist[0]) / hist[0]) * 100 : null
  return <>
    <div className="xc-kv">
      <div><small>ارزش روز</small><b>{faMoney(row.value)}</b></div>
      <div><small>بهای خرید</small><b>{row.cost ? faMoney(row.cost) : '—'}</b></div>
      <div><small>سود / زیان</small><b>{row.pnl ? `${row.pnl >= 0 ? '+' : '−'}${short(Math.abs(row.pnl))}` : '—'}{row.cost ? ` (${pct >= 0 ? '+' : '−'}${fa(Math.abs(Math.round(pct * 10) / 10))}٪)` : ''}</b></div>
      <div><small>مقدار</small><b>{fa(row.item.quantity)} واحد</b></div>
    </div>
    <AssetPrice row={row} onChanged={onChanged} />
    <AssetTxs row={row} onChanged={onChanged} />
    {key ? (hist === null ? <p className="xc-sub">در حال دریافت نمودار…</p> : hist.length > 1 ? <div><Spark data={hist} up={hist[hist.length - 1] >= hist[0]} /><p className="xc-sub">قیمت ۳۰ روز اخیر{ch != null ? ` · ${ch >= 0 ? '+' : '−'}${fa(Math.abs(Math.round(ch * 10) / 10))}٪` : ''}</p></div> : <p className="xc-sub">تاریخچهٔ قیمت در دسترس نیست.</p>) : null}
  </>
}

function EmptyTx({ hint, onJump }) {
  return <div className="fn-empty">
    <p>تراکنشی در این ماه نیست.</p>
    {hint ? <p>کل تراکنش‌های حساب: {fa(hint.total)}</p> : null}
    {hint?.latest ? <p>آخرین تراکنش ثبت‌شده: {jalaliShort(hint.latest)} <button type="button" className="fn-link" onClick={() => onJump(hint.latest)}>برو به آن ماه ←</button></p> : null}
    {hint?.bad ? <p>⚠️ {fa(hint.bad)} تراکنش تاریخ نامعتبر دارند و در هیچ ماهی دیده نمی‌شوند.</p> : null}
  </div>
}

export function FinanceReact({ Nav }) {
  const [month, setMonth] = useState(() => jKeyOf(isoToday()))
  const [unit, setUnit] = useState(() => { try { return localStorage.getItem('lifeos-fin-unit') || 'rial' } catch { return 'rial' } })
  UNIT = unit
  setFunUnit(unit)
  const switchUnit = (u) => { setUnit(u); try { localStorage.setItem('lifeos-fin-unit', u) } catch {} }
  const [tab, setTab] = useState(() => { try { const t = new URLSearchParams(location.search).get('tab'); return TABS.some((x) => x.id === t) ? t : 'dash' } catch { return 'dash' } })
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0, categories: {} })
  const [trend, setTrend] = useState([])
  const [txs, setTxs] = useState([])
  const [accounts, setAccounts] = useState([])
  const [budgets, setBudgets] = useState({ budgets: [], totalBudget: null, totalSpent: 0 })
  const [debts, setDebts] = useState([])
  const [portfolio, setPortfolio] = useState({ items: [], totals: {} })
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [notice, setNotice] = useState('')
  const [undoBatch, setUndoBatch] = useState(null)
  const [editing, setEditing] = useState(null)
  const [holdAssetType, setHoldAssetType] = useState('crypto')
  const [importPreview, setImportPreview] = useState(null)
  const [poker, setPoker] = useState([])
  const [pokerAll, setPokerAll] = useState([])
  const [pfSnaps, setPfSnaps] = useState(null)
  const usdHist = useUsdHistory(tab === 'fun')
  const snapSent = useRef(false)
  const [pokerSummary, setPokerSummary] = useState({ sessions: 0, profit: 0, wins: 0, losses: 0, pushes: 0, totalBuyIn: 0, totalCashOut: 0 })
  const [bet, setBet] = useState({ items: [], stats: {}, suggestedStart: 0, suggestedStartDate: null })
  const [alerts, setAlerts] = useState([])
  const [recatPreview, setRecatPreview] = useState(null)
  const [recatBusy, setRecatBusy] = useState(false)
  const [rates, setRates] = useState({})
  const [paying, setPaying] = useState(null)
  const [budEdit, setBudEdit] = useState(null)
  const [report, setReport] = useState(null)
  const [recurring, setRecurring] = useState([])
  const [goals, setGoals] = useState([])
  const [year, setYear] = useState(null)
  const [yearKind, setYearKind] = useState('expense')
  const [draft, setDraft] = useState({ key: 0 })
  const [scanning, setScanning] = useState(false)
  const [goalDep, setGoalDep] = useState(null)
  const [emptyHint, setEmptyHint] = useState(null)

  const load = useCallback(async () => {
    try {
      const months = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5))
      const { from, to } = jRange(month), rq = `from=${from}&to=${to}`
      const [sum, list, acc, bud, debt, pf, pk, pkSum, bt, al, pkAll, ...hist] = await Promise.all([
        api(`/api/finance?${rq}`),
        api(`/api/transactions?${rq}`),
        api('/api/accounts').catch(() => ({ accounts: [] })),
        api(`/api/budgets?month=${month}&legacy=${legacyKey(month)}&${rq}`).catch(() => ({ budgets: [] })),
        api('/api/debts').catch(() => ({ items: [] })),
        api('/api/portfolio').catch(() => ({ items: [], totals: {} })),
        api(`/api/poker?${rq}`).catch(() => ({ items: [] })),
        api(`/api/poker/summary?${rq}`).catch(() => ({})),
        api(`/api/bet?${rq}`).catch(() => ({ items: [], stats: {} })),
        api('/api/investments/alerts').catch(() => ({ items: [] })),
        api('/api/poker').catch(() => ({ items: [] })),
        ...months.map((m) => { const r = jRange(m); return api(`/api/finance?from=${r.from}&to=${r.to}`).catch(() => ({ income: 0, expense: 0 })) }),
      ])
      setSummary(sum)
      setTxs(list.items || [])
      setEmptyHint(null)
      if (!(list.items || []).length) api('/api/transactions?from=0000-01-01&to=9999-12-31').then((all) => {
        const items = all.items || [], iso = items.filter((t) => /^\d{4}-\d{2}-\d{2}/.test(t.date || '') && t.date >= '1900')
        setEmptyHint({ total: items.length, latest: iso.length ? iso.reduce((a, t) => (t.date > a ? t.date : a), '') : null, bad: items.length - iso.length })
      }).catch(() => {})
      setAccounts(acc.accounts || [])
      setBudgets(bud || { budgets: [] })
      setDebts(debt.items || [])
      setPortfolio(pf || { items: [], totals: {} })
      setPoker(pk.items || [])
      setPokerAll(pkAll.items || [])
      setPokerSummary(pkSum || {})
      setBet(bt || { items: [], stats: {} })
      setAlerts(al.items || [])
      api('/api/transactions/recurring').then((d) => setRecurring(d.items || [])).catch(() => {})
      api('/api/savings-goals').then((d) => setGoals(d.items || [])).catch(() => {})
      api(`/api/finance/year?jy=${jParts(month)[0]}`).then(setYear).catch(() => setYear(null))
      setTrend(hist.map((h, i) => ({ month: months[i], label: JMONTHS[jParts(months[i])[1] - 1], income: h.income || 0, expense: h.expense || 0 })))
    } catch (e) { setNotice(e.message) }
  }, [month])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    api('/api/tgju').then((d) => {
      const raw = d.items || d.data || {}, out = {}
      for (const [k, v] of Object.entries(raw)) { const n = Number(String(v?.p ?? v?.price ?? '').replace(/[^\d.]/g, '')); if (n) out[k] = n }
      setRates(out)
    }).catch(() => {})
  }, [])

  const send = async (path, body, message, method = 'POST') => {
    try { await api(path, { method, body: JSON.stringify(body) }); setNotice(message); await load() }
    catch (e) { setNotice(e.message) }
  }

  const cats = Object.entries(summary.categories || {}).sort((a, b) => b[1] - a[1])
  const expense = summary.expense || 0
  const income = summary.income || 0
  const balance = summary.balance || 0
  const savings = income ? Math.round(((income - expense) / income) * 100) : 0
  const netWorth = accounts.reduce((s, a) => s + Number(a.balance ?? a.openingBalance ?? 0), 0)
  const receivable = debts.filter((d) => d.type !== 'payable').reduce((s, d) => s + d.amount, 0)
  const payable = debts.filter((d) => d.type === 'payable').reduce((s, d) => s + d.amount, 0)
  const shown = txs.filter((t) => (filter === 'all' || (filter === 'misc' ? isMisc(t) : t.kind === filter)) && (!q.trim() || `${t.title} ${t.category} ${t.account || ''}`.includes(q.trim())))
  const face = holdAssetType === 'dollar' || holdAssetType === 'euro'
  const mRange = jRange(month)
  const betMonthItems = (bet.items || []).filter((d) => d.date >= mRange.from && d.date <= mRange.to)
  const miscSum = cats.filter(([n]) => n === 'متفرقه').reduce((a, [, v]) => a + v, 0)
  const miscPct = expense ? Math.round((miscSum / expense) * 100) : 0
  const setCat = async (item, category) => {
    if (!category) return
    try { const r = await api(`/api/transactions/${item.id}`, { method: 'PATCH', body: JSON.stringify({ category, learn: true }) }); setNotice(`«${item.title}» ← ${category}${r.learned ? ` · ${fa(r.learned)} تراکنش مشابه هم دسته‌بندی شد` : r.learnSkipped ? ' · عنوان عمومی است؛ فقط همین یکی عوض شد' : ''}`); setUndoBatch(r.learnBatch || null); await load() } catch (e) { setNotice(e.message) }
  }
  const betMax = Math.max(1, ...betMonthItems.map((d) => Math.abs(d.result || 0)))

  const usdRate = rates.price_dollar_rl || 0, eurRate = rates.price_eur || 0
  const toRial = (n, cur) => (cur === 'USD' ? (usdRate ? n * usdRate : 0) : cur === 'EUR' ? (eurRate ? n * eurRate : 0) : n)
  const debtGroups = { receivable: debts.filter((d) => d.type !== 'payable'), payable: debts.filter((d) => d.type === 'payable') }
  const debtTot = {
    rec: debtGroups.receivable.reduce((a, d) => a + toRial(Number(d.amount) || 0, d.currency || 'IRR'), 0),
    pay: debtGroups.payable.reduce((a, d) => a + toRial(Number(d.amount) || 0, d.currency || 'IRR'), 0),
    hasUsd: debts.some((d) => d.currency === 'USD'), usdMissing: debts.some((d) => d.currency === 'USD') && !usdRate,
  }
  const pf = (() => {
    const rows = (portfolio.items || []).map((item) => {
      const cur = item.currency || 'IRR', q = Number(item.quantity) || 0
      const live = item.assetType === 'gold' && rates[item.symbol] ? rates[item.symbol] * q : null
      const value = live != null ? live : item.assetType === 'dollar' ? q * usdRate : item.assetType === 'euro' ? q * eurRate : toRial(Number(item.marketValue || item.value || 0), cur)
      const cost = toRial(Number(item.costBasis || 0), cur)
      const pnl = live != null || item.assetType === 'dollar' || item.assetType === 'euro' ? (cost ? value - cost : 0) : toRial(Number(item.unrealizedPnl || 0), cur)
      const native = cur !== 'IRR' && item.assetType !== 'dollar' && item.assetType !== 'euro' ? `${fa(Math.round((Number(item.marketValue || 0)) * 100) / 100)} ${cur === 'USD' ? '$' : cur}` : ''
      const label = item.assetType === 'dollar' ? 'دلار' : item.assetType === 'euro' ? 'یورو' : GOLD_FA[item.symbol] || item.symbol
      return { item, value, cost, pnl, native, label }
    }).sort((a, b) => b.value - a.value)
    const total = rows.reduce((a, r) => a + r.value, 0), cost = rows.reduce((a, r) => a + r.cost, 0), pnl = rows.reduce((a, r) => a + r.pnl, 0)
    return { rows, total, cost, pnl }
  })()
  // Portfolio history: one snapshot per day (rial value + cost), taken when the wealth tab is opened with live rates.
  useEffect(() => { if (tab === 'wealth' && pfSnaps === null) api('/api/portfolio/snapshots').then((d) => setPfSnaps(d.items || [])).catch(() => setPfSnaps([])) }, [tab])
  useEffect(() => {
    if (tab !== 'wealth' || snapSent.current || !pf.rows.length || !(pf.total > 0) || !Object.keys(rates).length || pfSnaps === null) return
    if (pf.rows.some((r) => r.item.assetType === 'dollar' || (r.item.currency || 'IRR') === 'USD') && !usdRate) return
    // today's point follows the portfolio: re-sent whenever value or cost moved more than 0.5% (an edited buy, a new price)
    const cur = (pfSnaps || []).find((x) => x.date === isoToday()), cost = Math.max(0, pf.total - pf.pnl), off = (a, b) => !b || Math.abs(a - b) / b > 0.005
    if (cur && !off(pf.total, cur.value) && !off(cost, cur.cost)) return
    snapSent.current = true
    api('/api/portfolio/snapshots', { method: 'POST', body: JSON.stringify({ value: pf.total, cost: Math.max(0, pf.total - pf.pnl) }) })
      .then((r) => { snapSent.current = false; if (r && r.date) setPfSnaps((list) => [...(list || []).filter((x) => x.date !== r.date), r].sort((a, b) => String(a.date).localeCompare(String(b.date)))) }).catch(() => { snapSent.current = false })
  }, [tab, pf.total, pf.pnl, usdRate, rates, pfSnaps])

  const bud = (() => {
    const bmap = Object.fromEntries((budgets.budgets || []).map((b) => [b.category, Number(b.limit) || 0]))
    const spentBy = summary.categories || {}
    const spent = Number(budgets.totalSpent ?? expense) || 0
    const total = Number(budgets.totalBudget) || 0
    const names = [...new Set([...Object.keys(spentBy), ...Object.keys(bmap)])].filter((c) => c && c !== 'انتقال')
    const stateOf = (pct) => (pct > 100 ? 'over' : pct >= 80 ? 'warn' : 'ok')
    const rows = names.map((cat) => { const sp = Number(spentBy[cat]) || 0, limit = bmap[cat] || 0, pct = limit ? Math.round((sp / limit) * 100) : 0; return { cat, spent: sp, limit, pct, share: expense ? Math.round((sp / expense) * 100) : 0, state: limit ? stateOf(pct) : 'none' } })
      .sort((a, b) => (b.limit ? 1 : 0) - (a.limit ? 1 : 0) || b.pct - a.pct || b.spent - a.spent)
    const { from, to } = jRange(month), t = isoToday(), dayMs = 864e5
    const len = Math.round((Date.parse(to) - Date.parse(from)) / dayMs) + 1
    const inMonth = t >= from && t <= to
    const daysLeft = inMonth ? Math.round((Date.parse(to) - Date.parse(t)) / dayMs) + 1 : 0
    const timePct = inMonth ? Math.round(((len - daysLeft + 1) / len) * 100) : null
    const pct = total ? Math.round((spent / total) * 100) : 0
    return { rows, spent, total, left: total - spent, pct, state: stateOf(pct), daysLeft, timePct }
  })()
  const saveBudget = async (category, limit, remove = false) => {
    try { await api('/api/budgets', { method: 'POST', body: JSON.stringify(remove ? { month, category, remove: true } : { month, category, limit: Number(limit) }) }); setBudEdit(null); setNotice(remove ? 'سقف حذف شد.' : 'سقف ذخیره شد.'); await load() } catch (e) { setNotice(e.message) }
  }
  const copyBudgets = async () => {
    try {
      const pm = shiftMonth(month, -1), r = jRange(pm)
      const prev = await api(`/api/budgets?month=${pm}&legacy=${legacyKey(pm)}&from=${r.from}&to=${r.to}`)
      const list = [...(prev.budgets || []).map((b) => [b.category, b.limit]), ...(prev.totalBudget ? [['__total__', prev.totalBudget]] : [])]
      if (!list.length) return setNotice(`${monthFa(pm)} هم بودجه‌ای نداشت.`)
      for (const [category, limit] of list) await api('/api/budgets', { method: 'POST', body: JSON.stringify({ month, category, limit }) })
      setNotice(`${fa(list.length)} سقف از ${monthFa(pm)} کپی شد.`); await load()
    } catch (e) { setNotice(e.message) }
  }

  const openReport = async (k = month) => {
    const [jy, jm] = jParts(k)
    setReport({ k, text: '' })
    try { const r = await api(`/api/finance/monthly-report?jy=${jy}&jm=${jm}`); setReport({ k, text: r.text }) } catch (e) { setReport({ k, text: e.message }) }
  }
  const sendReport = async () => {
    const [jy, jm] = jParts(report.k)
    try { await api(`/api/finance/monthly-report?jy=${jy}&jm=${jm}`, { method: 'POST' }); setNotice('گزارش به تلگرام فرستاده شد ✓') } catch (e) { setNotice(e.message) }
  }

  const submitTx = (e) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const rec = f.get('recurrence') || null
    send('/api/transactions', { title: f.get('title'), amount: Number(f.get('amount')), kind: f.get('kind'), category: f.get('category') || '', account: f.get('account') || 'بدون حساب', date: f.get('date') || isoToday(), tags: f.get('tags'), recurrence: rec }, rec ? 'تراکنش تکراری ثبت شد 🔁' : 'تراکنش ثبت شد.')
    e.currentTarget.reset(); setDraft((d) => ({ key: d.key + 1 }))
  }

  const previewImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const base64 = await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result).split(',')[1])
        r.onerror = reject
        r.readAsDataURL(file)
      })
      const preview = await api('/api/transactions/import-bank/preview', { method: 'POST', body: JSON.stringify({ fileBase64: base64, filename: file.name, fileType: file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'xlsx', amountUnit: 'IRR' }) })
      setImportPreview(preview)
    } catch (err) { setNotice(err.message) }
    e.target.value = ''
  }

  const scanReceipt = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setScanning(true)
    try {
      const img = await new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { URL.revokeObjectURL(u); res(im) }; im.onerror = rej; im.src = u })
      const k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas')
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      const r = await api('/api/transactions/receipt-scan', { method: 'POST', body: JSON.stringify({ image: c.toDataURL('image/jpeg', 0.85) }) })
      setDraft((d) => ({ key: d.key + 1, title: r.title, amount: r.amount ? Number(r.amount).toLocaleString('en-US') : '', category: CATS.includes(r.category) ? r.category : '', kind: r.kind, date: r.date || isoToday(), scanned: true }))
    } catch (err) { setNotice(err.message) }
    setScanning(false)
  }
  const stopRecurring = async (r) => { if (!window.confirm(`تکرار «${r.title}» متوقف شود؟ (تراکنش‌های ثبت‌شده می‌مانند)`)) return; await send('/api/transactions/recurring/stop', { recurrenceId: r.recurrenceId }, 'تکرار متوقف شد.') }
  const REC_FA = { jmonthly: 'ماهانه (شمسی)', monthly: 'ماهانه (میلادی)', weekly: 'هفتگی', yearly: 'سالانه', daily: 'روزانه' }
  const goalInfo = (g) => {
    const pct = g.target ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0, left = Math.max(0, g.target - g.saved)
    let perMonth = null, monthsLeft = null
    if (g.deadline && left > 0) { const days = Math.round((Date.parse(g.deadline) - Date.parse(isoToday())) / 864e5); monthsLeft = Math.max(1, Math.ceil(days / 30)); perMonth = days > 0 ? left / monthsLeft : null }
    return { pct, left, perMonth, monthsLeft, late: g.deadline && g.deadline < isoToday() && left > 0 }
  }

  const submitPoker = (e) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    send('/api/poker', { date: f.get('date'), buyIn: Number(f.get('buyIn')), cashOut: Number(f.get('cashOut')), location: f.get('location'), note: f.get('note'), usdRate: rates.price_dollar_rl || undefined }, 'جلسهٔ پوکر ثبت شد.')
    e.currentTarget.reset()
  }

  const submitBet = (e) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const body = { date: f.get('date'), deposit: Number(f.get('deposit') || 0), withdraw: Number(f.get('withdraw') || 0), balance: Number(f.get('balance')), note: f.get('note') }
    const start = f.get('start')
    if (start !== '') body.start = Number(start)
    if (rates.price_dollar_rl) body.usdRate = rates.price_dollar_rl
    send('/api/bet', body, 'روز بت ثبت شد.')
    e.currentTarget.reset()
  }

  const recategorize = async (payload, doneMessage) => {
    setRecatBusy(true)
    try {
      const r = await api('/api/transactions/recategorize', { method: 'POST', body: JSON.stringify(payload) })
      setRecatPreview(payload.revert ? null : r)
      setNotice(doneMessage ? doneMessage(r) : '')
      if (payload.apply || payload.revert) await load()
    } catch (e) { setNotice(e.message) }
    setRecatBusy(false)
  }
  const previewRecat = () => recategorize({}, () => '')
  const applyRecat = () => recategorize({ apply: true }, (r) => `دستهٔ ${fa(r.matched)} تراکنش به‌روزرسانی شد.`)
  const revertRecat = () => recategorize({ revert: true }, (r) => r.message || 'بازگردانی شد.')
  const undoLearn = async () => { const b = undoBatch; setUndoBatch(null); try { const r = await api('/api/transactions/recategorize', { method: 'POST', body: JSON.stringify({ revert: true, learnBatch: b }) }); setNotice(r.message || 'برگشت.'); await load() } catch (e) { setNotice(e.message) } }

  return (
    <div className="fn finance-react" dir="rtl">
      {Nav ? <Nav active="finance" /> : null}
      <div className="fn-page">
        <header className="fn-glass fn-top">
          <div className="fn-brand">
            <div className="fn-mark">💠</div>
            <div>
              <p>نمای ماهانه · دادهٔ واقعی LifeOS</p>
              <h1>مالی</h1>
            </div>
          </div>
          <nav className="fn-tabs">
            {TABS.map((t) => <button key={t.id} type="button" className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>)}
          </nav>
        </header>

        {notice ? <div className="notice">{notice}{undoBatch ? <button type="button" className="fn-link" onClick={undoLearn}>↩ برگردان مشابه‌ها</button> : null}<button type="button" onClick={() => { setNotice(''); setUndoBatch(null) }}>×</button></div> : null}

        <section className="fn-glass" style={{ padding: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 }}>
            <MonthPicker value={month} onChange={setMonth} />
            <div className="fn-chips">
              <span className="fn-unit" role="radiogroup" aria-label="واحد نمایش">{[['rial', 'ریال'], ['toman', 'تومان']].map(([k, l]) => <button key={k} type="button" className={unit === k ? 'on' : ''} onClick={() => switchUnit(k)}>{l}</button>)}</span>
              <span className="fn-chip">دارایی: {compact(netWorth)}</span>
              <span className="fn-chip">طلب: {compact(debtTot.rec)}</span>
              <span className="fn-chip">بدهی: {compact(debtTot.pay)}</span>
            </div>
          </div>
          {tab === 'dash' ? <>
          <div className="fn-kpis">
            <div className="fn-kpi green" title={faMoney(income)}><small>💰 درآمد ماه</small><b>{income ? short(income, false) : '—'}</b><small className="fn-u">{income ? UNIT_FA() : 'بدون تراکنش'}</small></div>
            <div className="fn-kpi rose" title={faMoney(expense)}><small>💸 هزینه ماه</small><b>{expense ? short(expense, false) : '—'}</b><small className="fn-u">{expense ? UNIT_FA() : 'بدون تراکنش'}</small></div>
            <div className={`fn-kpi ${balance >= 0 ? 'cyan' : 'amber'}`} title={faMoney(balance)}><small>⚖️ مانده ماه</small><b>{balance ? short(balance, false) : '—'}</b><small className="fn-u">{balance ? UNIT_FA() : 'بدون تراکنش'}</small></div>
            <div className="fn-kpi cyan">
              <small>نرخ پس‌انداز {fa(savings)}٪</small>
              <div className="fn-gauge" style={{ marginTop: 10 }}><i style={{ width: `${Math.max(0, Math.min(100, savings))}%` }} /></div>
              <button type="button" className="fn-link" style={{ marginTop: 8 }} onClick={() => setTab('ledger')}>{fa(txs.length)} تراکنش ←</button>
            </div>
          </div>
          <div className="fn-cats">
            {cats.slice(0, 5).map(([name, value], i) => (
              <div key={name} className="fn-soft fn-cat">
                <b>{ICONS[name] || '•'} {name}</b>
                <small title={faMoney(value)}>{short(value)} · {fa(Math.round((value / (expense || 1)) * 100))}٪</small>
                <div className="fn-bar"><i style={{ width: `${Math.min(100, Math.round((value / (expense || 1)) * 100))}%`, background: COLORS[i % COLORS.length] }} /></div>
              </div>
            ))}
            {!cats.length ? <p className="fn-empty" style={{ gridColumn: '1/-1' }}>هنوز هزینه‌ای برای این ماه نیست.</p> : null}
          </div>
          {summary.miscCount ? (
            <div className="fn-banner">
              <span>📦 <b>{fa(summary.miscCount)}</b> هزینه بدون دسته (متفرقه) — <b>{fa(miscPct)}٪</b> هزینهٔ این ماه. دسته‌بندی‌شان کن تا گزارش واقعی شود؛ هر دسته‌ای بدهی، روی تراکنش‌های هم‌نام هم اعمال و برای بعد یاد گرفته می‌شود.</span>
              <button type="button" className="fn-save" onClick={() => { setTab('ledger'); setFilter('misc') }}>دسته‌بندی کن</button>
            </div>
          ) : null}
          {summary.transferCount ? <p className="fn-note">🔄 {fa(summary.transferCount)} انتقال ({short(summary.transferOut)}) جزو هزینه حساب نشده.</p> : null}
          </> : null}
        </section>

        {tab === 'dash' ? (
          <div className="fn-grid">
            <section className="fn-glass fn-card">
              <div className="fn-head"><h2>روند ۶ ماهه</h2><button type="button" className="fn-add" onClick={() => openReport()}>📊 گزارش {monthFa(month)}</button></div>
              <p className="sub">درآمد سبز · هزینه صورتی · از خلاصهٔ ماهانهٔ LifeOS</p>
              <AreaChart series={trend} />
            </section>
            <section className="fn-glass fn-card">
              <h2>ترکیب هزینه‌ها</h2>
              <p className="sub">سهم دسته از هزینهٔ ماه</p>
              {cats.length ? <Donut slices={cats.slice(0, 7).map(([name, value]) => ({ name, value }))} /> : <p className="fn-empty">داده‌ای نیست.</p>}
            </section>
            <section className="fn-glass fn-card fn-recent">
              <div className="fn-head"><h2>تراکنش‌های {monthFa(month)}</h2><button type="button" className="fn-add" onClick={() => setTab('ledger')}>همه ({fa(txs.length)}) ←</button></div>
              {txs.length ? txs.slice(0, 8).map((t) => (
                <article key={t.id} className="fn-row">
                  <div><b>{t.title}</b><small>{jalaliShort(t.date)} · {t.category}{t.account ? ` · ${t.account}` : ''}</small></div>
                  <span className={`amt ${t.kind === 'income' ? 'pos' : 'neg'}`}>{t.kind === 'income' ? '+' : t.kind === 'transfer' ? '↔' : '−'}{amt(t.amount)}</span>
                </article>
              )) : <EmptyTx hint={emptyHint} onJump={(d) => setMonth(jKeyOf(d))} />}
            </section>
          </div>
        ) : null}

        {tab === 'dash' && year ? (() => {
          const cur = year.current || [], prev = year.previous || [], key = yearKind
          const max = Math.max(1, ...cur.map((x) => x[key]), ...prev.map((x) => x[key]))
          const upto = cur.filter((x) => !x.future).length
          const tc = cur.slice(0, upto).reduce((a, x) => a + x[key], 0), tp = prev.slice(0, upto).reduce((a, x) => a + x[key], 0)
          const ch = tp ? Math.round(((tc - tp) / tp) * 100) : null
          return (
            <section className="fn-glass fn-card fn-year">
              <div className="fn-head"><h2>مقایسهٔ سالانه · {faD(year.jy)} با {faD(year.jy - 1)}</h2>
                <span className="fn-unit">{[['expense', 'هزینه'], ['income', 'درآمد']].map(([k, l]) => <button key={k} type="button" className={yearKind === k ? 'on' : ''} onClick={() => setYearKind(k)}>{l}</button>)}</span>
              </div>
              <p className="sub">از ابتدای سال تا {JMONTHS[Math.max(0, upto - 1)]}: {short(tc)} {ch != null ? <b className={(key === 'expense' ? ch <= 0 : ch >= 0) ? 'pos' : 'neg'}>{ch >= 0 ? '▲' : '▼'} {fa(Math.abs(ch))}٪</b> : null} نسبت به همین بازهٔ پارسال ({short(tp)})</p>
              <div className="fn-ybars">
                {cur.map((x, i) => (
                  <div key={x.m} className={`fn-ycol ${x.future ? 'future' : ''}`} title={`${JMONTHS[i]} — امسال ${faMoney(x[key])} · پارسال ${faMoney(prev[i]?.[key] || 0)}`}>
                    <div className="fn-ypair"><i className="prev" style={{ height: `${Math.round(((prev[i]?.[key] || 0) / max) * 100)}%` }} /><i className={`cur ${key}`} style={{ height: `${Math.round((x[key] / max) * 100)}%` }} /></div>
                    <span>{JMONTHS[i]}</span>
                  </div>
                ))}
              </div>
              <p className="fn-note"><i className="fn-lg cur" /> {faD(year.jy)} <i className="fn-lg prev" /> {faD(year.jy - 1)}</p>
            </section>
          )
        })() : null}

        {tab === 'ledger' ? (
          <div className="fn-ledger" id="ledger">
            <section className="fn-glass fn-list">
              <div className="fn-head"><h2>دفتر {monthFa(month)}</h2><Drawer label="تراکنش تازه">
<form className="fn-form" onSubmit={submitTx} key={draft.key}>
              <label className={`fn-file fn-scan ${scanning ? 'busy' : ''}`}>{scanning ? '⏳ در حال خواندن رسید…' : '📷 پر کردن از روی عکس رسید / پیامک'}<input type="file" accept="image/*" capture="environment" hidden onChange={scanReceipt} disabled={scanning} /></label>
              {draft.scanned ? <p className="fn-note">✓ از روی تصویر پر شد — قبل از ثبت چک کن.</p> : null}
              <input name="title" required placeholder="شرح" defaultValue={draft.title || ''} />
              <input name="amount" required inputMode="numeric" placeholder="مبلغ (ریال)" defaultValue={draft.amount || ''} />
              <div>
                <select name="kind" defaultValue={draft.kind || 'expense'}><option value="expense">هزینه</option><option value="income">درآمد</option></select>
                <select name="category" defaultValue={draft.category || ''}><option value="">دسته: خودکار از روی شرح</option>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
              </div>
              <select name="recurrence" defaultValue=""><option value="">بدون تکرار</option><option value="jmonthly">🔁 هر ماه (همان روز ماه شمسی)</option><option value="weekly">🔁 هر هفته</option><option value="yearly">🔁 هر سال</option></select>
              <select name="account">
                <option value="بدون حساب">بدون حساب</option>
                {accounts.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
              </select>
              <input name="tags" placeholder="تگ‌ها، با ویرگول" />
              <JalaliDateInput name="date" defaultValue={draft.date || isoToday()} />
              <button className="fn-save">ثبت تراکنش</button>
            </form>
              </Drawer></div>
              <div className="fn-recat">
                <button type="button" className="fn-action" onClick={previewRecat} disabled={recatBusy}>🧹 دسته‌بندی متفرقه‌ها</button>
                <button type="button" className="fn-action" onClick={revertRecat} disabled={recatBusy}>↩ بازگردانی آخرین اعمال</button>
                <button type="button" className="fn-action" onClick={() => recategorize({ revert: true, genericLearned: true }, (r) => r.message || 'برگشت.')} disabled={recatBusy} title="دسته‌هایی که از روی عنوان‌های عمومی مثل «خرید از فروشگاه» روی همه پخش شده بود">↩ برگرداندن دسته‌بندی گروهی اشتباه</button>
              </div>
              {recatPreview ? (
                <div className="fn-soft fn-recat-box">
                  <p className="sub">بررسی‌شده {fa(recatPreview.scanned)} · تطبیق‌یافته {fa(recatPreview.matched)} · بدون تغییر {fa(recatPreview.untouched)}{recatPreview.applied ? ' · اعمال شد' : ' · فقط پیش‌نمایش'}</p>
                  {recatPreview.summary && Object.keys(recatPreview.summary).length ? (
                    <ul>
                      {Object.entries(recatPreview.summary).map(([cat, s]) => <li key={cat}>{cat} · {fa(s.count)} مورد · {faMoney(s.sum)}</li>)}
                    </ul>
                  ) : null}
                  <div className="fn-recat-actions">
                    {!recatPreview.applied && recatPreview.matched ? <button type="button" className="fn-save" onClick={applyRecat} disabled={recatBusy}>اعمال تغییرات</button> : null}
                    <button type="button" onClick={() => setRecatPreview(null)}>بستن</button>
                  </div>
                </div>
              ) : null}
              <div className="fn-filters">
                {FILTERS.map(([k, l]) => <button key={k} type="button" className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>)}
              </div>
              <input className="fn-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو در شرح و دسته…" />
              {shown.length ? shown.map((item) => (
                <article key={item.id} className="fn-row">
                  <div>
                    <b>{item.title}</b>
                    <small>{jalaliShort(item.date)} · {isMisc(item) ? <select className="fn-catpick" value="" onChange={(e) => setCat(item, e.target.value)} aria-label="انتخاب دسته"><option value="">متفرقه — دسته؟</option>{CATS.filter((c) => c !== 'متفرقه' && c !== 'حقوق').map((c) => <option key={c} value={c}>{c}</option>)}<option value="انتقال">انتقال (هزینه نیست)</option></select> : item.category} · {item.account}{item.tags?.length ? ` · ${item.tags.map((t) => `#${t}`).join(' ')}` : ''}</small>
                  </div>
                  <span className={`amt ${item.kind === 'income' ? 'pos' : 'neg'}`}>{item.kind === 'income' ? '+' : item.kind === 'transfer' ? '↔' : '−'}{amt(item.amount)}</span>
                  <div className="fn-ops">
                    <button type="button" onClick={() => setEditing({ type: 'transaction', item })}>ویرایش</button>
                    <button type="button" className="del" onClick={() => { if (window.confirm(`«${item.title}» حذف شود؟`)) send(`/api/transactions/${item.id}`, {}, 'حذف شد.', 'DELETE') }}>حذف</button>
                  </div>
                </article>
              )) : <EmptyTx hint={emptyHint} onJump={(d) => setMonth(jKeyOf(d))} />}
            </section>
          </div>
        ) : null}

        {tab === 'budget' ? (
          <div className="fn-2" id="budget">
            <section className="fn-glass fn-list">
              <div className="fn-head"><h2>حساب‌ها</h2><Drawer label="حساب" title="حساب تازه">
<form className="fn-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); send('/api/accounts', { name: f.get('name'), type: f.get('type'), openingBalance: Number(f.get('openingBalance') || 0) }, 'حساب ثبت شد.'); e.currentTarget.reset() }}>
                <input name="name" required placeholder="نام حساب" />
                <div>
                  <select name="type"><option value="bank">بانک</option><option value="card">کارت</option><option value="cash">نقدی</option></select>
                  <input name="openingBalance" inputMode="numeric" placeholder="ماندهٔ اولیه" />
                </div>
                <button className="fn-save">افزودن حساب</button>
              </form>
</Drawer><Drawer label="انتقال" title="انتقال بین حساب‌ها">
<form className="fn-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); send('/api/transfers', { fromAccount: f.get('fromAccount'), toAccount: f.get('toAccount'), amount: Number(f.get('amount')), date: f.get('date'), title: f.get('title') }, 'انتقال ثبت شد.'); e.currentTarget.reset() }}>
                <input name="title" placeholder="شرح انتقال" />
                <div>
                  <select name="fromAccount" required><option value="">از حساب</option>{accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}</select>
                  <select name="toAccount" required><option value="">به حساب</option>{accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}</select>
                </div>
                <div>
                  <input name="amount" required inputMode="numeric" placeholder="مبلغ" />
                  <JalaliDateInput name="date" defaultValue={isoToday()} />
                </div>
                <button className="fn-save">ثبت انتقال</button>
              </form>
</Drawer></div>
              <XCards className="fn-xacc" items={accounts} surface={(a) => a.color || xcAuto(a.id)}
                renderBody={(a) => <>
                  <div className="xc-top"><span className="xc-ic">{a.type === 'cash' ? '💵' : a.type === 'bank' ? '🏦' : '💳'}</span><span className="xc-name">{a.name}</span></div>
                  <div><div className="xc-val" title={faMoney(a.balance ?? a.openingBalance ?? 0)}>{short(a.balance ?? a.openingBalance ?? 0)}</div><div className="xc-sub keep">{ACC_FA[a.type] || a.type}{a.cardNo ? ` · ${String(a.cardNo).replace(/\D/g, '').slice(-4)}` : ''}</div></div>
                </>}
                renderMore={(a) => { const mine = txs.filter((t) => t.account === a.name || t.toAccount === a.name).slice(0, 5); return <>
                  <div className="xc-kv"><div><small>موجودی دقیق</small><b>{faMoney(a.balance ?? a.openingBalance ?? 0)}</b></div><div><small>تراکنش‌های این ماه</small><b>{fa(txs.filter((t) => t.account === a.name || t.toAccount === a.name).length)}</b></div></div>
                  {a.cardNo ? <CopyBtn label="شماره کارت" text={a.cardNo} /> : null}
                  {a.sheba ? <CopyBtn label="شبا" text={a.sheba} /> : null}
                  {mine.length ? <div className="xc-list">{mine.map((t) => <div key={t.id}><span>{t.title}<small> · {jalaliShort(t.date)}</small></span><b>{t.kind === 'income' || t.toAccount === a.name ? '+' : '−'}{short(t.amount)}</b></div>)}</div> : <p className="xc-sub">این ماه تراکنشی با این حساب نیست.</p>}
                  <div className="xc-row"><button type="button" className="xc-pill" onClick={() => setEditing({ type: 'account', item: a })}>ویرایش و شماره کارت</button></div>
                </> }} />
              <div className="fn-head" style={{ marginTop: 18 }}><h2>🔁 پرداخت‌ها و دریافت‌های تکراری</h2></div>
              {recurring.length ? recurring.map((r) => {
                const due = dueInfo(r.nextDate)
                return (
                  <article key={r.recurrenceId} className="fn-rec">
                    <div><b>{r.title}</b><small>{REC_FA[r.recurrence] || r.recurrence} · {r.category} · {fa(r.count)} بار ثبت شده</small></div>
                    <span className={`fn-due ${due.cls}`}>بعدی: {due.label === 'امروز' ? 'امروز' : jalaliShort(r.nextDate)}</span>
                    <span className={`amt ${r.kind === 'income' ? 'pos' : 'neg'}`}>{short(r.amount)}</span>
                    <button type="button" className="fn-link del" onClick={() => stopRecurring(r)}>توقف</button>
                  </article>
                )
              }) : <p className="fn-empty">تراکنش تکراری نداری. در «تراکنش تازه»، گزینهٔ «تکرار» را انتخاب کن تا اجاره، قسط یا حقوق هر ماه خودکار ثبت شود و قبلش در پیام صبح یادآوری بیاید.</p>}
              {recurring.length ? <p className="fn-note">جمع تکراری ماهانه: هزینه {short(recurring.filter((r) => r.kind !== 'income').reduce((a, r) => a + (r.recurrence === 'weekly' ? r.amount * 4.3 : r.recurrence === 'yearly' ? r.amount / 12 : r.amount), 0))} · درآمد {short(recurring.filter((r) => r.kind === 'income').reduce((a, r) => a + (r.recurrence === 'weekly' ? r.amount * 4.3 : r.recurrence === 'yearly' ? r.amount / 12 : r.amount), 0))}</p> : null}
            </section>
            <section className="fn-glass fn-list">
              <div className="fn-head"><h2>بودجهٔ {monthFa(month)}</h2></div>
              <div className={`fn-btotal ${bud.total ? bud.state : ''}`}>
                <div className="fn-btotal-top">
                  <div><small>هزینهٔ ماه</small><b title={faMoney(bud.spent)}>{short(bud.spent)}</b></div>
                  {bud.total ? <div><small>سقف کل</small><b title={faMoney(bud.total)}>{short(bud.total)}</b></div> : null}
                  {bud.total ? <div><small>{bud.left >= 0 ? 'باقی‌مانده' : 'بیش از سقف'}</small><b className={bud.left >= 0 ? 'pos' : 'neg'}>{short(Math.abs(bud.left))}</b></div> : null}
                  {bud.total && bud.daysLeft > 0 && bud.left > 0 ? <div><small>روزانه تا آخر ماه ({fa(bud.daysLeft)} روز)</small><b>{short(bud.left / bud.daysLeft)}</b></div> : null}
                </div>
                {bud.total ? <div className="fn-bbar"><i style={{ width: `${Math.min(100, bud.pct)}%` }} />{bud.timePct != null ? <u style={{ insetInlineStart: `${bud.timePct}%` }} title="امروز" /> : null}</div> : <p className="fn-note">سقف کل ماه تعیین نشده.{' '}<button type="button" className="fn-link" onClick={() => setBudEdit('__total__')}>تعیین سقف کل</button></p>}
                {budEdit === '__total__' ? <BudgetInline cat="__total__" value={bud.total} onSave={saveBudget} onCancel={() => setBudEdit(null)} /> : null}
                {bud.total ? <div className="fn-bt-ops"><button type="button" className="fn-link" onClick={() => setBudEdit(budEdit === '__total__' ? null : '__total__')}>تغییر سقف کل</button></div> : null}
              </div>
              {!(budgets.budgets || []).length ? <div className="fn-banner"><span>برای {monthFa(month)} هنوز بودجهٔ دسته‌ای نداری.</span><button type="button" className="fn-save" onClick={copyBudgets}>کپی از {monthFa(shiftMonth(month, -1))}</button></div> : null}
              <div className="fn-brows">
                {bud.rows.map((r) => (
                  <article key={r.cat} className={`fn-brow ${r.state}`}>
                    <div className="fn-brow-top">
                      <b>{ICONS[r.cat] || '•'} {r.cat}</b>
                      <span className="fn-brow-num">{short(r.spent, false)}{r.limit ? <> / {short(r.limit)}</> : <em> · بدون سقف</em>}</span>
                    </div>
                    {r.limit ? <div className="fn-bbar sm"><i style={{ width: `${Math.min(100, r.pct)}%` }} /></div> : null}
                    <div className="fn-brow-foot">
                      <small>{r.limit ? (r.spent > r.limit ? `${short(r.spent - r.limit)} بیشتر از سقف` : `${short(r.limit - r.spent)} مانده · ${fa(r.pct)}٪`) : `${fa(r.share)}٪ هزینهٔ ماه`}</small>
                      <span>
                        <button type="button" className="fn-link" onClick={() => setBudEdit(budEdit === r.cat ? null : r.cat)}>{r.limit ? 'تغییر سقف' : 'سقف بگذار'}</button>
                        {r.limit ? <button type="button" className="fn-link del" onClick={() => saveBudget(r.cat, 0, true)}>حذف سقف</button> : null}
                      </span>
                    </div>
                    {budEdit === r.cat ? <BudgetInline cat={r.cat} value={r.limit} hint={r.spent} onSave={saveBudget} onCancel={() => setBudEdit(null)} /> : null}
                  </article>
                ))}
                {!bud.rows.length ? <p className="fn-empty">هنوز هزینه‌ای برای این ماه نیست.</p> : null}
                <div className="fn-brow-add">
                  <select value="" onChange={(e) => e.target.value && setBudEdit(e.target.value)} aria-label="سقف برای دستهٔ دیگر"><option value="">＋ سقف برای دستهٔ دیگر…</option>{CATS.filter((c) => c !== 'حقوق' && !bud.rows.some((r) => r.cat === c)).map((c) => <option key={c} value={c}>{c}</option>)}</select>
                  {budEdit && budEdit !== '__total__' && !bud.rows.some((r) => r.cat === budEdit) ? <BudgetInline cat={budEdit} value={0} onSave={saveBudget} onCancel={() => setBudEdit(null)} /> : null}
                </div>
              </div>
              <div style={{ marginTop: 18 }}>
                <h2>درون‌ریزی صورت‌حساب</h2>
                <p className="sub">CSV / XLS / XLSX — فقط پیش‌نمایش، بعد تأیید</p>
                <label className="fn-file">📄 انتخاب فایل صورت‌حساب<input type="file" accept=".csv,.xls,.xlsx" onChange={previewImport} hidden /></label>
                {importPreview ? (
                  <form className="fn-form" style={{ padding: 0, marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const items = (importPreview.items || []).filter((x) => !x.duplicate); send('/api/transactions/import-bank/commit', { items, account: f.get('account') }, `${fa(items.length)} تراکنش ارسال شد.`); setImportPreview(null) }}>
                    <p>{fa(importPreview.newCount || 0)} تازه · {fa(importPreview.duplicateCount || 0)} تکراری</p>
                    <select name="account"><option value="بدون حساب">بدون حساب</option>{accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}</select>
                    <button className="fn-save">ورود تراکنش‌های تازه</button>
                    <button type="button" onClick={() => setImportPreview(null)}>لغو</button>
                  </form>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}

        {tab === 'bills' ? <div style={{ marginTop: 12 }}><BillsPanel onChanged={load} /></div> : null}

        {tab === 'wealth' ? (
          <>
          <section className="fn-glass fn-list fn-goals">
            <div className="fn-head"><h2>🎯 اهداف پس‌انداز</h2><Drawer label="هدف" title="هدف پس‌انداز تازه">
              <form className="fn-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); send('/api/savings-goals', { title: f.get('title'), icon: f.get('icon') || '🎯', target: Number(f.get('target')), saved: Number(f.get('saved') || 0), deadline: f.get('deadline') || null }, 'هدف ثبت شد.'); e.currentTarget.reset() }}>
                <div><input name="icon" placeholder="🎯" maxLength={4} style={{ maxWidth: 70, textAlign: 'center' }} /><input name="title" required placeholder="مثلاً لپ‌تاپ، سفر، ماشین" /></div>
                <input name="target" required inputMode="numeric" placeholder="مبلغ هدف (ریال)" />
                <input name="saved" inputMode="numeric" placeholder="تا الان جمع کرده‌ام (اختیاری)" />
                <JalaliDateInput name="deadline" placeholder="تا چه تاریخی؟ (اختیاری)" />
                <button className="fn-save">ثبت هدف</button>
              </form>
            </Drawer></div>
            {goals.length ? <div className="fn-goal-grid">{goals.map((g) => {
              const gi = goalInfo(g)
              return (
                <article key={g.id} className={`fn-goal ${gi.pct >= 100 ? 'done' : ''} ${gi.late ? 'late' : ''}`}>
                  <div className="fn-goal-top"><span className="fn-goal-ic">{g.icon || '🎯'}</span><div><b>{g.title}</b><small>{g.deadline ? `تا ${jalaliShort(g.deadline)}` : 'بدون مهلت'}</small></div><strong>{fa(gi.pct)}٪</strong></div>
                  <div className="fn-bbar"><i style={{ width: `${gi.pct}%` }} /></div>
                  <div className="fn-goal-nums"><span title={faMoney(g.saved)}>{short(g.saved, false)}</span><span>از {short(g.target)}</span></div>
                  <small className="fn-goal-hint">{gi.pct >= 100 ? '🎉 به هدف رسیدی!' : gi.late ? `مهلت گذشته · ${short(gi.left)} مانده` : gi.perMonth ? `ماهی ${short(gi.perMonth)} تا ${fa(gi.monthsLeft)} ماه دیگر` : `${short(gi.left)} مانده`}</small>
                  {goalDep === g.id ? (
                    <form className="fn-pay" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget), v = Number(f.get('amount')); send(`/api/savings-goals/${g.id}/deposit`, { amount: f.get('dir') === 'out' ? -v : v }, 'ثبت شد.'); setGoalDep(null) }}>
                      <select name="dir"><option value="in">واریز</option><option value="out">برداشت</option></select>
                      <input name="amount" required inputMode="numeric" placeholder="مبلغ" autoFocus />
                      <button className="fn-save">ثبت</button>
                    </form>
                  ) : (
                    <div className="fn-goal-ops">
                      <button type="button" className="fn-add" onClick={() => setGoalDep(g.id)}>＋ واریز / برداشت</button>
                      <button type="button" className="fn-link del" onClick={() => { if (window.confirm(`هدف «${g.title}» حذف شود؟`)) send(`/api/savings-goals/${g.id}`, {}, 'حذف شد.', 'DELETE') }}>حذف</button>
                    </div>
                  )}
                </article>
              )
            })}</div> : <p className="fn-empty">هدفی ثبت نشده. برای خرید بزرگ یا سفر هدف بگذار تا ببینی ماهی چقدر باید کنار بگذاری.</p>}
          </section>

          <div className="fn-2" id="debts">
            <section className="fn-glass fn-list">
              <div className="fn-head"><h2>بدهی و طلب</h2><Drawer label="بدهی / طلب">
<form className="fn-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); send('/api/debts', { person: f.get('person'), amount: Number(f.get('amount')), type: f.get('type'), currency: f.get('currency'), date: f.get('date') || isoToday(), note: f.get('note') }, 'ثبت شد.'); e.currentTarget.reset() }}>
                <input name="person" required placeholder="نام شخص" />
                <div>
                  <select name="type"><option value="payable">بدهی من</option><option value="receivable">طلب من</option></select>
                  <select name="currency"><option value="IRR">ریال</option><option value="USD">دلار</option></select>
                </div>
                <input name="amount" required inputMode="numeric" placeholder="مبلغ" />
                <label className="fn-field">تاریخ دادن / گرفتن پول<JalaliDateInput name="date" defaultValue={isoToday()} clearable={false} /></label>
                <input name="note" placeholder="یادداشت" />
                <button className="fn-save">افزودن</button>
              </form>
</Drawer></div>
              <div className="fn-debt-sum">
                <div className="pos"><small>طلب من</small><b title={faMoney(debtTot.rec)}>{short(debtTot.rec)}</b><em>{fa(debtGroups.receivable.length)} مورد</em></div>
                <div className="neg"><small>بدهی من</small><b title={faMoney(debtTot.pay)}>{short(debtTot.pay)}</b><em>{fa(debtGroups.payable.length)} مورد</em></div>
                <div className={debtTot.rec - debtTot.pay >= 0 ? 'pos net' : 'neg net'}><small>خالص</small><b title={faMoney(debtTot.rec - debtTot.pay)}>{debtTot.rec - debtTot.pay >= 0 ? '+' : '−'}{short(Math.abs(debtTot.rec - debtTot.pay))}</b><em>{debtTot.usdMissing ? 'دلاری‌ها بدون نرخ روز' : debtTot.hasUsd ? `دلار به نرخ ${short(rates.price_dollar_rl, false)}` : ' '}</em></div>
              </div>
              {!debts.length ? <p className="fn-empty">بدهی یا طلب بازی نیست.</p> : [['receivable', 'طلب‌های من'], ['payable', 'بدهی‌های من']].map(([k, title]) => debtGroups[k].length ? (
                <div key={k} className={`fn-debt-group ${k}`}>
                  <h3>{title}</h3>
                  {debtGroups[k].map((item) => {
                    const due = givenInfo(item)
                    return (
                      <article key={item.id} className={`fn-debt ${due.cls}`}>
                        <div className="fn-debt-main">
                          <b>{item.person}</b>
                          <small>{item.note || ' '}{item.paid ? ` · ${item.currency === 'USD' ? fa(item.paid) + ' دلار' : short(item.paid)} پرداخت‌شده` : ''}</small>
                        </div>
                        <span className={`fn-due ${due.cls}`}>{due.label}</span>
                        <span className={`amt ${k === 'receivable' ? 'pos' : 'neg'}`} title={item.currency === 'USD' ? '' : faMoney(item.amount)}>{item.currency === 'USD' ? `${fa(item.amount)} $` : short(item.amount)}</span>
                        <div className="fn-ops">
                          <button type="button" onClick={() => setPaying(paying === item.id ? null : item.id)}>{k === 'receivable' ? 'دریافت بخشی' : 'پرداخت بخشی'}</button>
                          <button type="button" onClick={() => setEditing({ type: 'debt', item })}>ویرایش</button>
                          <button type="button" className="ok" onClick={() => { if (window.confirm(`${k === 'receivable' ? 'طلب از' : 'بدهی به'} ${item.person} کامل تسویه شد؟`)) send(`/api/debts/${item.id}/settle`, { account: item.currency === 'IRR' ? (accounts.find((a) => !a.archived)?.name || '') : '' }, 'تسویه شد.') }}>تسویه</button>
                        </div>
                        {paying === item.id ? (
                          <form className="fn-pay" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); send(`/api/debts/${item.id}/pay`, { amount: Number(f.get('amount')), date: f.get('date') || isoToday(), account: item.currency === 'IRR' && f.get('account') !== '' ? f.get('account') : '' }, 'ثبت شد.'); setPaying(null) }}>
                            <input name="amount" required inputMode="numeric" placeholder={`مبلغ (${item.currency === 'USD' ? 'دلار' : 'ریال'})`} autoFocus />
                            {item.currency === 'IRR' ? <select name="account"><option value="">بدون ثبت تراکنش</option>{accounts.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}</select> : null}
                            <button className="fn-save">ثبت</button>
                          </form>
                        ) : null}
                      </article>
                    )
                  })}
                </div>
              ) : null)}
            </section>
            <section className="fn-glass fn-list">
              <div className="fn-head"><h2>سبد سرمایه</h2><Drawer label="وارد کردن پرتفوی" title="وارد کردن پرتفوی بورس"><PortfolioImport onDone={load} /></Drawer><Drawer label="خرید / فروش" title="تراکنش سرمایه‌گذاری">
<form className="fn-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const body = { assetType: holdAssetType, type: f.get('type'), quantity: Number(f.get('quantity')), fee: Number(f.get('fee') || 0), date: f.get('date'), note: f.get('note'), ...(f.get('currency') ? { currency: f.get('currency') } : {}) }; if (!face) { body.symbol = f.get('symbol'); body.price = Number(f.get('price')) } send('/api/investments/tx', body, 'تراکنش سرمایه‌گذاری ثبت شد.'); e.currentTarget.reset() }}>
                <div>
                  <select value={holdAssetType} onChange={(e) => setHoldAssetType(e.target.value)}>
                    <option value="crypto">رمزارز</option><option value="stock">سهام</option><option value="gold">طلا</option>
                    <option value="dollar">دلار</option><option value="euro">یورو</option><option value="other">سایر</option>
                  </select>
                  <select name="type"><option value="buy">خرید</option><option value="sell">فروش</option></select>
                </div>
                <input name="symbol" required={!face} disabled={face} placeholder={face ? 'نماد لازم نیست' : 'نماد'} />
                <div>
                  <input name="quantity" required inputMode="decimal" placeholder="تعداد" />
                  <input name="price" required={!face} disabled={face} inputMode="decimal" placeholder={face ? 'قیمت لازم نیست' : 'قیمت واحد'} />
                </div>
                {holdAssetType === 'stock' || holdAssetType === 'other' ? <select name="currency" defaultValue="IRR" aria-label="واحد قیمت"><option value="IRR">قیمت به ریال (بورس تهران)</option><option value="USD">قیمت به دلار (بورس خارجی)</option></select> : null}
                <input name="fee" inputMode="decimal" placeholder="کارمزد" />
                <JalaliDateInput name="date" defaultValue={isoToday()} />
                <input name="note" placeholder="یادداشت" />
                <button className="fn-save">ثبت سرمایه‌گذاری</button>
              </form>
</Drawer></div>
              {portfolio.items?.length ? (
                <div className="fn-pf-sum">
                  <div><small>ارزش روز سبد</small><b title={faMoney(pf.total)}>{short(pf.total)}</b></div>
                  <div className={pf.pnl >= 0 ? 'pos' : 'neg'}><small>سود / زیان</small><b>{pf.pnl >= 0 ? '+' : '−'}{short(Math.abs(pf.pnl))}</b>{pf.cost ? <em>{pf.pnl >= 0 ? '+' : '−'}{fa(Math.abs(Math.round((pf.pnl / pf.cost) * 1000) / 10))}٪</em> : null}</div>
                  <p className="fn-note">نرخ‌ها از بازار: {rates.price_dollar_rl ? `دلار ${short(rates.price_dollar_rl, false)}` : 'دلار —'}{rates.price_eur ? ` · یورو ${short(rates.price_eur, false)}` : ''}</p>
                </div>
              ) : null}
              {portfolio.items?.length ? <PfTrend snaps={pfSnaps || []} /> : null}
              {portfolio.items?.length ? <XCards className="fn-xpf" items={pf.rows} getKey={(r) => `${r.item.assetType}-${r.item.symbol}`}
                surface={(r) => r.item.assetType === 'gold' ? 'gold' : r.item.assetType === 'dollar' ? 'green' : r.item.assetType === 'euro' ? 'blue' : r.item.assetType === 'crypto' ? 'violet' : r.item.assetType === 'stock' ? 'cyan' : 'graphite'}
                renderBody={(row) => <>
                  <div className="xc-top"><span className="xc-ic">{row.item.assetType === 'gold' ? '🪙' : row.item.assetType === 'dollar' ? '💵' : row.item.assetType === 'euro' ? '💶' : row.item.assetType === 'crypto' ? '₿' : row.item.assetType === 'stock' ? '📈' : '📦'}</span><span className="xc-name">{row.label}</span></div>
                  <div><div className="xc-val" title={faMoney(row.value)}>{row.value ? short(row.value) : '—'}</div><div className="xc-sub">{fa(row.item.quantity)} واحد{row.pnl ? ` · ${row.pnl >= 0 ? '+' : '−'}${short(Math.abs(row.pnl), false)}` : ''}</div></div>
                </>}
                renderMore={(row) => <AssetMore row={row} onChanged={load} />} /> : <p className="fn-empty">دارایی ثبت نشده.</p>}
              <div className="fn-alerts">
                <div className="fn-head"><h2>هشدار قیمت</h2><Drawer label="هشدار" title="هشدار قیمت">
<form className="fn-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); send('/api/investments/alerts', { symbol: f.get('symbol'), condition: f.get('condition'), value: Number(f.get('value')) }, 'هشدار ثبت شد.'); e.currentTarget.reset() }}>
                  <div>
                    <input name="symbol" required placeholder="نماد" />
                    <input name="value" required inputMode="decimal" placeholder="مقدار" />
                  </div>
                  <select name="condition">
                    <option value="price_above">قیمت بالاتر از</option>
                    <option value="price_below">قیمت پایین‌تر از</option>
                    <option value="pnl_pct_above">سود٪ بالاتر از</option>
                    <option value="pnl_pct_below">زیان٪ پایین‌تر از</option>
                  </select>
                  <button className="fn-save">افزودن هشدار</button>
                </form>
</Drawer></div>
                {alerts.length ? alerts.map((a) => (
                  <article key={a.id} className="fn-row">
                    <div><b>{a.symbol}</b><small>{ALERT_COND[a.condition] || a.condition} {fa(a.value)}{a.condition?.startsWith('pnl') ? '٪' : ''}{a.active === false ? ' · غیرفعال' : ''}</small></div>
                    <button type="button" className="del" onClick={() => { if (window.confirm(`هشدار ${a.symbol} حذف شود؟`)) send(`/api/investments/alerts/${a.id}`, {}, 'حذف شد.', 'DELETE') }}>حذف</button>
                  </article>
                )) : <p className="fn-empty">هشداری ثبت نشده.</p>}
              </div>
            </section>
          </div>

          </>
        ) : null}

        {tab === 'fun' ? (
          <>
          <p className="fn-note fn-fun-note">پوکر و بت جدا از درآمد و هزینه‌اند و در آمار ماه حساب نمی‌شوند.</p>
          <FunOverview poker={pokerAll} bet={bet.items || []} usdRate={usdRate} monthFrom={mRange.from} monthTo={mRange.to} />
          <div className="fn-2">
            <section className="fn-glass fn-list">
              <div className="fn-head"><h2>پوکر</h2><Drawer label="جلسه" title="جلسهٔ پوکر">
<form className="fn-form" onSubmit={submitPoker}>
                <JalaliDateInput name="date" defaultValue={isoToday()} />
                <div>
                  <input name="buyIn" required inputMode="numeric" placeholder="ورودی (ریال)" />
                  <input name="cashOut" required inputMode="numeric" placeholder="خروجی (ریال)" />
                </div>
                <input name="location" list="fn-poker-locs" placeholder="مکان (اختیاری)" /><datalist id="fn-poker-locs">{[...new Set(pokerAll.map((x) => (x.location || '').trim()).filter(Boolean))].map((l) => <option key={l} value={l} />)}</datalist>
                <input name="note" placeholder="یادداشت" />
                <button className="fn-save">ثبت جلسه</button>
              </form>
</Drawer></div>
              <div className="fn-cats fn-poker-stats">
                <div className="fn-soft fn-cat"><b>سود/زیان ماه</b><small>{faMoney(pokerSummary.profit || 0)}</small></div>
                <div className="fn-soft fn-cat"><b>جلسات</b><small>{fa(pokerSummary.sessions || 0)} ({fa(pokerSummary.wins || 0)} برد · {fa(pokerSummary.losses || 0)} باخت)</small></div>
                <div className="fn-soft fn-cat"><b>مجموع ورودی</b><small>{short(pokerSummary.totalBuyIn || 0)}</small></div>
                <div className="fn-soft fn-cat"><b>مجموع خروجی</b><small>{short(pokerSummary.totalCashOut || 0)}</small></div>
              </div>
              {poker.length ? poker.map((item) => {
                const pnl = item.cashOut - item.buyIn
                return (
                  <article key={item.id} className="fn-row">
                    <div>
                      <b>{item.location || 'جلسهٔ پوکر'}</b>
                      <small>{jalaliShort(item.date)} · ورود {amt(item.buyIn)} · خروج {amt(item.cashOut)}{item.note ? ` · ${item.note}` : ''}</small>
                    </div>
                    <span className={`amt ${pnl >= 0 ? 'pos' : 'neg'}`}>{pnl >= 0 ? '+' : '−'}{amt(Math.abs(pnl))}</span>
                    <div className="fn-ops">
                      <button type="button" onClick={() => setEditing({ type: 'poker', item })}>ویرایش</button>
                      <button type="button" className="del" onClick={() => { if (window.confirm('این جلسه حذف شود؟')) send(`/api/poker/${item.id}`, {}, 'حذف شد.', 'DELETE') }}>حذف</button>
                    </div>
                  </article>
                )
              }) : <p className="fn-empty">جلسه‌ای در این ماه نیست.</p>}
            </section>
            <section className="fn-glass fn-list">
              <div className="fn-head"><h2>بت (دلاری)</h2><Drawer label="روز" title="روز بت">
<form className="fn-form" onSubmit={submitBet} key={bet.suggestedStartDate || 'bet-form'}>
                <JalaliDateInput name="date" defaultValue={isoToday()} />
                <div>
                  <input name="start" inputMode="decimal" defaultValue={bet.suggestedStart || 0} placeholder="مبلغی که داشتم ($)" />
                  <input name="balance" required inputMode="decimal" placeholder="موجودی پایان روز ($)" />
                </div>
                <div>
                  <input name="deposit" inputMode="decimal" placeholder="واریز ($)" />
                  <input name="withdraw" inputMode="decimal" placeholder="برداشت ($)" />
                </div>
                <input name="note" placeholder="یادداشت" />
                <button className="fn-save">ثبت روز</button>
              </form>
</Drawer></div>
              <p className="sub">هیچ تراکنشی نمی‌سازد و در آمار درآمد/هزینه نمی‌آید.</p>
              <div className="fn-cats fn-poker-stats">
                <div className="fn-soft fn-cat"><b>سود/زیان ماه</b><small>{signedUsd(bet.stats?.profit || 0)}</small></div>
                <div className="fn-soft fn-cat"><b>روزها</b><small>{fa(bet.stats?.days || 0)} ({fa(bet.stats?.wins || 0)} برد · {fa(bet.stats?.losses || 0)} باخت)</small></div>
                <div className="fn-soft fn-cat"><b>وین‌ریت</b><small>{fa(bet.stats?.winRate || 0)}٪</small></div>
                <div className="fn-soft fn-cat"><b>بهترین/بدترین روز</b><small>{bet.stats?.best ? signedUsd(bet.stats.best.result) : '—'} · {bet.stats?.worst ? signedUsd(bet.stats.worst.result) : '—'}</small></div>
              </div>
              {betMonthItems.length ? (
                <div className="fn-bet-mini">
                  {betMonthItems.map((d) => (
                    <div key={d.id} className="fn-bet-bar" title={`${jalaliShort(d.date)} · ${signedUsd(d.result)}`}>
                      <i className={d.result >= 0 ? 'pos' : 'neg'} style={{ height: `${Math.max(6, Math.round((Math.abs(d.result) / betMax) * 44))}px` }} />
                      <span>{jalaliDay(d.date)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {betMonthItems.length ? betMonthItems.slice().reverse().map((item) => (
                <article key={item.id} className="fn-row">
                  <div>
                    <b>{jalaliShort(item.date)}</b>
                    <small>داشتم {usd(item.start)} · واریز {usd(item.deposit)} · برداشت {usd(item.withdraw)} · موجودی {usd(item.balance)}{item.note ? ` · ${item.note}` : ''}</small>
                    {(() => { const r = makeRateOn(usdHist, usdRate)(item.date, Number(item.usdRate)); return r ? <small className="fn-bet-rial">دلار {fa(Math.round(r))} · ≈ <span className={item.result >= 0 ? 'pos' : 'neg'}>{item.result >= 0 ? '+' : '−'}{short(Math.abs(item.result * r))}</span></small> : null })()}
                  </div>
                  <span className={`amt ${item.result >= 0 ? 'pos' : 'neg'}`}>{signedUsd(item.result)}</span>
                  <div className="fn-ops">
                    <button type="button" onClick={() => setEditing({ type: 'bet', item })}>ویرایش</button>
                    <button type="button" className="del" onClick={() => { if (window.confirm('این روز حذف شود؟')) send(`/api/bet/${item.id}`, {}, 'حذف شد.', 'DELETE') }}>حذف</button>
                  </div>
                </article>
              )) : <p className="fn-empty">روزی برای این ماه ثبت نشده.</p>}
            </section>
          </div>
          </>
        ) : null}
      </div>

      {report ? (
        <div className="fn-modal" onClick={() => setReport(null)}>
          <div className="fn-glass fn-report" onClick={(e) => e.stopPropagation()}>
            <div className="fn-head"><h2>گزارش ماهانه</h2>
              <button type="button" className="fn-mp-nav" onClick={() => openReport(shiftMonth(report.k, -1))} aria-label="ماه قبل"><ChevronRight size={18} aria-hidden="true" /></button>
              <b>{monthFa(report.k)}</b>
              <button type="button" className="fn-mp-nav" onClick={() => openReport(shiftMonth(report.k, 1))} aria-label="ماه بعد"><ChevronLeft size={18} aria-hidden="true" /></button>
            </div>
            <pre>{report.text || 'در حال ساخت…'}</pre>
            <div className="fn-report-ops">
              <button type="button" className="fn-save" onClick={sendReport}>ارسال به تلگرام</button>
              <button type="button" className="fn-link" onClick={() => { try { navigator.clipboard.writeText(report.text); setNotice('کپی شد.') } catch {} }}>کپی متن</button>
              <button type="button" className="fn-link" onClick={() => setReport(null)}>بستن</button>
            </div>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="fn-modal" onClick={() => setEditing(null)}>
          <form className="fn-glass fn-form" onClick={(e) => e.stopPropagation()} onSubmit={(e) => {
            e.preventDefault()
            const f = new FormData(e.currentTarget)
            const body = editing.type === 'debt'
              ? { person: f.get('person'), amount: Number(f.get('amount')), type: f.get('type'), currency: f.get('currency'), date: f.get('date') || editing.item.date || isoToday(), dueDate: null, note: f.get('note') }
              : editing.type === 'account'
              ? { name: f.get('name'), type: f.get('type'), balance: Number(f.get('amount')), archived: f.get('archived') === 'on', cardNo: f.get('cardNo') || '', sheba: f.get('sheba') || '', color: f.get('color') || '' }
              : editing.type === 'poker'
              ? { date: f.get('date'), buyIn: Number(f.get('buyIn')), cashOut: Number(f.get('cashOut')), location: f.get('location'), note: f.get('note') }
              : editing.type === 'bet'
              ? { date: f.get('date'), start: Number(f.get('start') || 0), deposit: Number(f.get('deposit') || 0), withdraw: Number(f.get('withdraw') || 0), balance: Number(f.get('balance')), note: f.get('note') }
              : { title: f.get('title'), amount: Number(f.get('amount')), category: f.get('category'), kind: f.get('kind'), account: f.get('account'), date: f.get('date'), tags: f.get('tags') }
            const path = editing.type === 'debt' ? 'debts' : editing.type === 'account' ? 'accounts' : editing.type === 'poker' ? 'poker' : editing.type === 'bet' ? 'bet' : 'transactions'
            send(`/api/${path}/${editing.item.id}`, body, 'ذخیره شد.', 'PATCH')
            setEditing(null)
          }}>
            <h2>ویرایش {editing.type === 'debt' ? 'بدهی / طلب' : editing.type === 'account' ? 'حساب' : editing.type === 'poker' ? 'جلسهٔ پوکر' : editing.type === 'bet' ? 'روز بت' : 'تراکنش'}</h2>
            {editing.type === 'debt' ? (
              <>
                <input name="person" required defaultValue={editing.item.person} placeholder="نام شخص" />
                <div>
                  <select name="type" defaultValue={editing.item.type}><option value="payable">بدهی من</option><option value="receivable">طلب من</option></select>
                  <select name="currency" defaultValue={editing.item.currency || 'IRR'}><option value="IRR">ریال</option><option value="USD">دلار</option></select>
                </div>
                <input name="amount" required inputMode="numeric" defaultValue={editing.item.amount} placeholder="مبلغ باقی‌مانده" />
                <label className="fn-field">تاریخ دادن / گرفتن پول<JalaliDateInput name="date" defaultValue={editing.item.date || (editing.item.createdAt ? new Date(editing.item.createdAt).toISOString().slice(0, 10) : isoToday())} clearable={false} /></label>
                <input name="note" defaultValue={editing.item.note} placeholder="یادداشت" />
              </>
            ) : editing.type === 'account' ? (
              <>
                <input name="name" required defaultValue={editing.item.name} />
                <div>
                  <select name="type" defaultValue={editing.item.type}><option value="bank">بانک</option><option value="card">کارت</option><option value="cash">نقدی</option></select>
                  <input name="amount" inputMode="numeric" defaultValue={editing.item.balance ?? editing.item.openingBalance ?? 0} />
                </div>
                <input name="cardNo" dir="ltr" data-raw defaultValue={editing.item.cardNo || ''} placeholder="شماره کارت (اختیاری)" />
                <input name="sheba" dir="ltr" defaultValue={editing.item.sheba || ''} placeholder="شبا IR… (اختیاری)" />
                <select name="color" defaultValue={editing.item.color || ''}><option value="">رنگ کارت: خودکار</option>{[['violet', 'بنفش'], ['graphite', 'مشکی'], ['cyan', 'فیروزه‌ای'], ['blue', 'آبی'], ['gold', 'طلایی'], ['green', 'سبز'], ['rose', 'قرمز']].map(([k, l]) => <option key={k} value={k}>رنگ کارت: {l}</option>)}</select>
                <label><input name="archived" type="checkbox" defaultChecked={editing.item.archived} /> بایگانی</label>
              </>
            ) : editing.type === 'poker' ? (
              <>
                <JalaliDateInput name="date" required defaultValue={editing.item.date} />
                <div>
                  <input name="buyIn" required inputMode="numeric" defaultValue={editing.item.buyIn} placeholder="ورودی" />
                  <input name="cashOut" required inputMode="numeric" defaultValue={editing.item.cashOut} placeholder="خروجی" />
                </div>
                <input name="location" list="fn-poker-locs" defaultValue={editing.item.location} placeholder="مکان" />
                <input name="note" defaultValue={editing.item.note} placeholder="یادداشت" />
              </>
            ) : editing.type === 'bet' ? (
              <>
                <JalaliDateInput name="date" required defaultValue={editing.item.date} />
                <div>
                  <input name="start" inputMode="decimal" defaultValue={editing.item.start} placeholder="مبلغی که داشتم" />
                  <input name="balance" required inputMode="decimal" defaultValue={editing.item.balance} placeholder="موجودی" />
                </div>
                <div>
                  <input name="deposit" inputMode="decimal" defaultValue={editing.item.deposit} placeholder="واریز" />
                  <input name="withdraw" inputMode="decimal" defaultValue={editing.item.withdraw} placeholder="برداشت" />
                </div>
                <input name="note" defaultValue={editing.item.note} placeholder="یادداشت" />
              </>
            ) : (
              <>
                <input name="title" required defaultValue={editing.item.title} />
                <input name="amount" required inputMode="numeric" defaultValue={editing.item.amount} />
                <div>
                  <select name="kind" defaultValue={editing.item.kind}><option value="expense">هزینه</option><option value="income">درآمد</option><option value="transfer">انتقال</option></select>
                  <input name="category" defaultValue={editing.item.category} />
                </div>
                <select name="account" defaultValue={editing.item.account}>{accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}</select>
                <JalaliDateInput name="date" defaultValue={editing.item.date} />
                <input name="tags" defaultValue={(editing.item.tags || []).join(', ')} />
              </>
            )}
            <button className="fn-save">ذخیره</button>
            <button type="button" onClick={() => setEditing(null)}>بستن</button>
          </form>
        </div>
      ) : null}
    </div>
  )
}
