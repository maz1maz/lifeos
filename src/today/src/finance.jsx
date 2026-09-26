import { useCallback, useEffect, useState } from 'react'
import './finance.css'
import { jalaliShort, jalaliDay } from './jalali'
import { JalaliDateInput, isoToJ, jToIso, MONTHS as JMONTHS, monthLen } from './jdate';

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
      <button type="button" className="fn-mp-nav" onClick={() => onChange(shiftMonth(value, -1))} aria-label="ماه قبل">›</button>
      <button type="button" className="fn-mp-btn" onClick={() => setOpen((v) => !v)}>{JMONTHS[m - 1]} {faD(y)} <span>▾</span></button>
      <button type="button" className="fn-mp-nav" onClick={() => onChange(shiftMonth(value, 1))} aria-label="ماه بعد">‹</button>
      {value !== cur ? <button type="button" className="fn-mp-today" onClick={() => onChange(cur)}>این ماه</button> : null}
      {open ? (
        <div className="fn-mp-pop">
          <div className="fn-mp-year"><button type="button" onClick={() => setYy(yy + 1)}>›</button><b>{faD(yy)}</b><button type="button" onClick={() => setYy(yy - 1)}>‹</button></div>
          <div className="fn-mp-grid">{JMONTHS.map((name, i) => { const k = `${yy}-${String(i + 1).padStart(2, '0')}`; return <button type="button" key={k} className={`${k === value ? 'on' : ''} ${k === cur ? 'cur' : ''}`} onClick={() => { onChange(k); setOpen(false) }}>{name}</button> })}</div>
        </div>
      ) : null}
    </div>
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
  { id: 'wealth', label: 'بدهی و سرمایه' },
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

export function FinanceReact({ Nav }) {
  const [month, setMonth] = useState(() => jKeyOf(isoToday()))
  const [unit, setUnit] = useState(() => { try { return localStorage.getItem('lifeos-fin-unit') || 'rial' } catch { return 'rial' } })
  UNIT = unit
  const switchUnit = (u) => { setUnit(u); try { localStorage.setItem('lifeos-fin-unit', u) } catch {} }
  const [tab, setTab] = useState('dash')
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
  const [editing, setEditing] = useState(null)
  const [holdAssetType, setHoldAssetType] = useState('crypto')
  const [importPreview, setImportPreview] = useState(null)
  const [poker, setPoker] = useState([])
  const [pokerSummary, setPokerSummary] = useState({ sessions: 0, profit: 0, wins: 0, losses: 0, pushes: 0, totalBuyIn: 0, totalCashOut: 0 })
  const [bet, setBet] = useState({ items: [], stats: {}, suggestedStart: 0, suggestedStartDate: null })
  const [alerts, setAlerts] = useState([])
  const [recatPreview, setRecatPreview] = useState(null)
  const [recatBusy, setRecatBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const months = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5))
      const { from, to } = jRange(month), rq = `from=${from}&to=${to}`
      const [sum, list, acc, bud, debt, pf, pk, pkSum, bt, al, ...hist] = await Promise.all([
        api(`/api/finance?${rq}`),
        api(`/api/transactions?${rq}`),
        api('/api/accounts'),
        api(`/api/budgets?month=${month}&legacy=${legacyKey(month)}&${rq}`),
        api('/api/debts'),
        api('/api/portfolio'),
        api(`/api/poker?${rq}`).catch(() => ({ items: [] })),
        api(`/api/poker/summary?${rq}`).catch(() => ({})),
        api(`/api/bet?${rq}`).catch(() => ({ items: [], stats: {} })),
        api('/api/investments/alerts').catch(() => ({ items: [] })),
        ...months.map((m) => { const r = jRange(m); return api(`/api/finance?from=${r.from}&to=${r.to}`).catch(() => ({ income: 0, expense: 0 })) }),
      ])
      setSummary(sum)
      setTxs(list.items || [])
      setAccounts(acc.accounts || [])
      setBudgets(bud || { budgets: [] })
      setDebts(debt.items || [])
      setPortfolio(pf || { items: [], totals: {} })
      setPoker(pk.items || [])
      setPokerSummary(pkSum || {})
      setBet(bt || { items: [], stats: {} })
      setAlerts(al.items || [])
      setTrend(hist.map((h, i) => ({ month: months[i], label: JMONTHS[jParts(months[i])[1] - 1], income: h.income || 0, expense: h.expense || 0 })))
    } catch (e) { setNotice(e.message) }
  }, [month])

  useEffect(() => { load() }, [load])

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
    try { const r = await api(`/api/transactions/${item.id}`, { method: 'PATCH', body: JSON.stringify({ category, learn: true }) }); setNotice(`«${item.title}» ← ${category}${r.learned ? ` · ${fa(r.learned)} تراکنش مشابه هم دسته‌بندی شد` : ''}`); await load() } catch (e) { setNotice(e.message) }
  }
  const betMax = Math.max(1, ...betMonthItems.map((d) => Math.abs(d.result || 0)))

  const submitTx = (e) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    send('/api/transactions', { title: f.get('title'), amount: Number(f.get('amount')), kind: f.get('kind'), category: f.get('category') || '', account: f.get('account') || 'بدون حساب', date: f.get('date') || isoToday(), tags: f.get('tags') }, 'تراکنش ثبت شد.')
    e.currentTarget.reset()
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

  const submitPoker = (e) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    send('/api/poker', { date: f.get('date'), buyIn: Number(f.get('buyIn')), cashOut: Number(f.get('cashOut')), location: f.get('location'), note: f.get('note') }, 'جلسهٔ پوکر ثبت شد.')
    e.currentTarget.reset()
  }

  const submitBet = (e) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const body = { date: f.get('date'), deposit: Number(f.get('deposit') || 0), withdraw: Number(f.get('withdraw') || 0), balance: Number(f.get('balance')), note: f.get('note') }
    const start = f.get('start')
    if (start !== '') body.start = Number(start)
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

        {notice ? <div className="notice">{notice}<button type="button" onClick={() => setNotice('')}>×</button></div> : null}

        <section className="fn-glass" style={{ padding: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 }}>
            <MonthPicker value={month} onChange={setMonth} />
            <div className="fn-chips">
              <span className="fn-unit" role="radiogroup" aria-label="واحد نمایش">{[['rial', 'ریال'], ['toman', 'تومان']].map(([k, l]) => <button key={k} type="button" className={unit === k ? 'on' : ''} onClick={() => switchUnit(k)}>{l}</button>)}</span>
              <span className="fn-chip">دارایی: {compact(netWorth)}</span>
              <span className="fn-chip">طلب: {compact(receivable)}</span>
              <span className="fn-chip">بدهی: {compact(payable)}</span>
            </div>
          </div>
          {tab === 'dash' ? <>
          <div className="fn-kpis">
            <div className="fn-kpi green" title={faMoney(income)}><small>💰 درآمد ماه</small><b>{short(income, false)}</b><small className="fn-u">{UNIT_FA()}</small></div>
            <div className="fn-kpi rose" title={faMoney(expense)}><small>💸 هزینه ماه</small><b>{short(expense, false)}</b><small className="fn-u">{UNIT_FA()}</small></div>
            <div className={`fn-kpi ${balance >= 0 ? 'cyan' : 'amber'}`} title={faMoney(balance)}><small>⚖️ مانده ماه</small><b>{short(balance, false)}</b><small className="fn-u">{UNIT_FA()}</small></div>
            <div className="fn-kpi cyan">
              <small>نرخ پس‌انداز {fa(savings)}٪</small>
              <div className="fn-gauge" style={{ marginTop: 10 }}><i style={{ width: `${Math.max(0, Math.min(100, savings))}%` }} /></div>
              <small style={{ marginTop: 8 }}>{fa(txs.length)} تراکنش</small>
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
              <h2>روند ۶ ماهه</h2>
              <p className="sub">درآمد سبز · هزینه صورتی · از خلاصهٔ ماهانهٔ LifeOS</p>
              <AreaChart series={trend} />
            </section>
            <section className="fn-glass fn-card">
              <h2>ترکیب هزینه‌ها</h2>
              <p className="sub">سهم دسته از هزینهٔ ماه</p>
              {cats.length ? <Donut slices={cats.slice(0, 7).map(([name, value]) => ({ name, value }))} /> : <p className="fn-empty">داده‌ای نیست.</p>}
            </section>
          </div>
        ) : null}

        {tab === 'ledger' ? (
          <div className="fn-ledger" id="ledger">
            <section className="fn-glass fn-list">
              <div className="fn-head"><h2>دفتر {monthFa(month)}</h2><Drawer label="تراکنش تازه">
<form className="fn-form" onSubmit={submitTx}>
              <input name="title" required placeholder="شرح" />
              <input name="amount" required inputMode="numeric" placeholder="مبلغ (ریال)" />
              <div>
                <select name="kind"><option value="expense">هزینه</option><option value="income">درآمد</option></select>
                <select name="category"><option value="">دسته: خودکار از روی شرح</option>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
              </div>
              <select name="account">
                <option value="بدون حساب">بدون حساب</option>
                {accounts.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
              </select>
              <input name="tags" placeholder="تگ‌ها، با ویرگول" />
              <JalaliDateInput name="date" defaultValue={isoToday()} />
              <button className="fn-save">ثبت تراکنش</button>
            </form>
              </Drawer></div>
              <div className="fn-recat">
                <button type="button" className="fn-action" onClick={previewRecat} disabled={recatBusy}>🧹 دسته‌بندی متفرقه‌ها</button>
                <button type="button" className="fn-action" onClick={revertRecat} disabled={recatBusy}>↩ بازگردانی آخرین اعمال</button>
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
              )) : <p className="fn-empty">تراکنشی در این ماه نیست.</p>}
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
              <div className="fn-accounts">
                {accounts.map((a) => (
                  <div key={a.id} className="fn-soft">
                    <b>{a.name}</b>
                    <small>{a.type} · {faMoney(a.balance ?? a.openingBalance ?? 0)}</small>
                    <button type="button" className="fn-ops" onClick={() => setEditing({ type: 'account', item: a })} style={{ marginTop: 8 }}>ویرایش</button>
                  </div>
                ))}
              </div>
            </section>
            <section className="fn-glass fn-list">
              <div className="fn-head"><h2>بودجهٔ {monthFa(month)}</h2><Drawer label="بودجه" title="سقف بودجه">
<form className="fn-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); send('/api/budgets', { month, category: f.get('category'), limit: Number(f.get('limit')) }, 'بودجه ذخیره شد.'); e.currentTarget.reset() }}>
                <select name="category"><option value="__total__">سقف کل ماه</option>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
                <input name="limit" required inputMode="numeric" placeholder="سقف، ریال" />
                <button className="fn-save">ذخیرهٔ بودجه</button>
              </form>
</Drawer></div>
              <p className="sub">{budgets.totalBudget ? `${short(budgets.totalSpent || 0, false)} از ${short(budgets.totalBudget)}` : `هزینهٔ ماه: ${short(budgets.totalSpent || 0)}`}</p>
              <div className="fn-budget">
                {(budgets.budgets || []).map((item) => {
                  const pct = item.limit ? Math.min(100, Math.round((item.spent / item.limit) * 100)) : 0
                  return (
                    <article key={item.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>{item.category}</b><small>{short(item.spent, false)} / {short(item.limit)}</small></div>
                      <div className={`fn-gauge${item.spent > item.limit ? ' over' : ''}`}><i style={{ width: `${pct}%` }} /></div>
                    </article>
                  )
                })}
              </div>
              <div style={{ marginTop: 18 }}>
                <h2>درون‌ریزی صورت‌حساب</h2>
                <p className="sub">CSV / XLS / XLSX — فقط پیش‌نمایش، بعد تأیید</p>
                <input type="file" accept=".csv,.xls,.xlsx" onChange={previewImport} />
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

        {tab === 'wealth' ? (
          <>
          <div className="fn-2" id="debts">
            <section className="fn-glass fn-list">
              <div className="fn-head"><h2>بدهی و طلب</h2><Drawer label="بدهی / طلب">
<form className="fn-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); send('/api/debts', { person: f.get('person'), amount: Number(f.get('amount')), type: f.get('type'), currency: f.get('currency'), dueDate: f.get('dueDate') || null, note: f.get('note') }, 'ثبت شد.'); e.currentTarget.reset() }}>
                <input name="person" required placeholder="نام شخص" />
                <div>
                  <select name="type"><option value="payable">بدهی من</option><option value="receivable">طلب من</option></select>
                  <select name="currency"><option value="IRR">ریال</option><option value="USD">دلار</option></select>
                </div>
                <input name="amount" required inputMode="numeric" placeholder="مبلغ" />
                <JalaliDateInput name="dueDate" />
                <input name="note" placeholder="یادداشت" />
                <button className="fn-save">افزودن</button>
              </form>
</Drawer></div>
              {debts.length ? debts.map((item) => (
                <article key={item.id} className="fn-row">
                  <div>
                    <b>{item.type === 'payable' ? 'بدهی به ' : 'طلب از '}{item.person}</b>
                    <small>{item.currency === 'USD' ? `${fa(item.amount)} دلار` : faMoney(item.amount)}{item.dueDate ? ` · ${jalaliShort(item.dueDate)}` : ''}{item.note ? ` · ${item.note}` : ''}</small>
                  </div>
                  <button type="button" onClick={() => send(`/api/debts/${item.id}/settle`, { account: item.currency === 'IRR' ? (accounts.find((a) => !a.archived)?.name || '') : '' }, 'تسویه شد.')}>تسویه</button>
                </article>
              )) : <p className="fn-empty">بدهی یا طلب بازی نیست.</p>}
            </section>
            <section className="fn-glass fn-list">
              <div className="fn-head"><h2>سبد سرمایه</h2><Drawer label="خرید / فروش" title="تراکنش سرمایه‌گذاری">
<form className="fn-form" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const body = { assetType: holdAssetType, type: f.get('type'), quantity: Number(f.get('quantity')), fee: Number(f.get('fee') || 0), date: f.get('date'), note: f.get('note') }; if (!face) { body.symbol = f.get('symbol'); body.price = Number(f.get('price')) } send('/api/investments/tx', body, 'تراکنش سرمایه‌گذاری ثبت شد.'); e.currentTarget.reset() }}>
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
                  <input name="price" required={!face} disabled={face} placeholder={face ? 'قیمت لازم نیست' : 'قیمت واحد'} />
                </div>
                <input name="fee" inputMode="decimal" placeholder="کارمزد" />
                <JalaliDateInput name="date" defaultValue={isoToday()} />
                <input name="note" placeholder="یادداشت" />
                <button className="fn-save">ثبت سرمایه‌گذاری</button>
              </form>
</Drawer></div>
              <p className="sub">{Object.entries(portfolio.totals || {}).length ? Object.entries(portfolio.totals).map(([c, t]) => {
                const pnl = Number(t?.unrealizedPnl || 0)
                return `${fa(t?.value || 0)} ${c} · سود/زیان ${pnl >= 0 ? '+' : ''}${fa(pnl)}`
              }).join(' · ') : 'ارزش گزارش‌شده: —'}</p>
              {portfolio.items?.length ? portfolio.items.map((item) => {
                const pnl = Number(item.unrealizedPnl || 0)
                return (
                  <article key={`${item.assetType}-${item.symbol}`} className="fn-row">
                    <div><b>{item.symbol}</b><small>{item.assetType} · تعداد {fa(item.quantity)}</small></div>
                    <span className={`amt ${pnl >= 0 ? 'pos' : 'neg'}`}>{pnl >= 0 ? '+' : ''}{fa(pnl)}</span>
                    <b>{fa(item.marketValue || item.value || 0)} {item.currency || ''}</b>
                  </article>
                )
              }) : <p className="fn-empty">دارایی ثبت نشده.</p>}
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

          <div className="fn-2">
            <section className="fn-glass fn-list">
              <div className="fn-head"><h2>پوکر</h2><Drawer label="جلسه" title="جلسهٔ پوکر">
<form className="fn-form" onSubmit={submitPoker}>
                <JalaliDateInput name="date" defaultValue={isoToday()} />
                <div>
                  <input name="buyIn" required inputMode="numeric" placeholder="ورودی (ریال)" />
                  <input name="cashOut" required inputMode="numeric" placeholder="خروجی (ریال)" />
                </div>
                <input name="location" placeholder="مکان (اختیاری)" />
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

      {editing ? (
        <div className="fn-modal" onClick={() => setEditing(null)}>
          <form className="fn-glass fn-form" onClick={(e) => e.stopPropagation()} onSubmit={(e) => {
            e.preventDefault()
            const f = new FormData(e.currentTarget)
            const body = editing.type === 'account'
              ? { name: f.get('name'), type: f.get('type'), balance: Number(f.get('amount')), archived: f.get('archived') === 'on' }
              : editing.type === 'poker'
              ? { date: f.get('date'), buyIn: Number(f.get('buyIn')), cashOut: Number(f.get('cashOut')), location: f.get('location'), note: f.get('note') }
              : editing.type === 'bet'
              ? { date: f.get('date'), start: Number(f.get('start') || 0), deposit: Number(f.get('deposit') || 0), withdraw: Number(f.get('withdraw') || 0), balance: Number(f.get('balance')), note: f.get('note') }
              : { title: f.get('title'), amount: Number(f.get('amount')), category: f.get('category'), kind: f.get('kind'), account: f.get('account'), date: f.get('date'), tags: f.get('tags') }
            const path = editing.type === 'account' ? 'accounts' : editing.type === 'poker' ? 'poker' : editing.type === 'bet' ? 'bet' : 'transactions'
            send(`/api/${path}/${editing.item.id}`, body, 'ذخیره شد.', 'PATCH')
            setEditing(null)
          }}>
            <h2>ویرایش {editing.type === 'account' ? 'حساب' : editing.type === 'poker' ? 'جلسهٔ پوکر' : editing.type === 'bet' ? 'روز بت' : 'تراکنش'}</h2>
            {editing.type === 'account' ? (
              <>
                <input name="name" required defaultValue={editing.item.name} />
                <div>
                  <select name="type" defaultValue={editing.item.type}><option value="bank">بانک</option><option value="card">کارت</option><option value="cash">نقدی</option></select>
                  <input name="amount" inputMode="numeric" defaultValue={editing.item.balance ?? editing.item.openingBalance ?? 0} />
                </div>
                <label><input name="archived" type="checkbox" defaultChecked={editing.item.archived} /> بایگانی</label>
              </>
            ) : editing.type === 'poker' ? (
              <>
                <JalaliDateInput name="date" required defaultValue={editing.item.date} />
                <div>
                  <input name="buyIn" required inputMode="numeric" defaultValue={editing.item.buyIn} placeholder="ورودی" />
                  <input name="cashOut" required inputMode="numeric" defaultValue={editing.item.cashOut} placeholder="خروجی" />
                </div>
                <input name="location" defaultValue={editing.item.location} placeholder="مکان" />
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
