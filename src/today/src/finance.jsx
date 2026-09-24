import { useCallback, useEffect, useState } from 'react'
import './finance.css'

const api = async (url, options) => {
  const response = await fetch(url, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'دریافت اطلاعات ناموفق بود.')
  return body
}

const isoToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const fa = (n) => Number(n || 0).toLocaleString('fa-IR')
const faMoney = (n) => `${fa(n)} ریال`
const compact = (n) => {
  const x = Number(n) || 0
  if (Math.abs(x) >= 1e9) return `${fa(x / 1e9)} میلیارد ریال`
  if (Math.abs(x) >= 1e6) return `${fa(x / 1e6)} میلیون ریال`
  return faMoney(x)
}
const monthFa = (key) => {
  try { return new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long' }).format(new Date(`${key}-01T12:00:00`)) } catch { return key }
}
const shiftMonth = (key, d) => {
  const [y, m] = key.split('-').map(Number)
  const dt = new Date(y, m - 1 + d, 1)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
}
const CATS = ['خوراک', 'حمل‌ونقل', 'قبض', 'مسکن', 'سلامت', 'تفریح', 'آموزش', 'پوشاک', 'حقوق', 'سرمایه‌گذاری', 'هدیه', 'سفر', 'متفرقه']
const ICONS = { 'خوراک': '🍔', 'حمل‌ونقل': '🚕', 'قبض': '🧾', 'مسکن': '🏠', 'سلامت': '💊', 'تفریح': '🎮', 'آموزش': '📚', 'پوشاک': '👕', 'حقوق': '💼', 'سرمایه‌گذاری': '📈', 'هدیه': '🎁', 'سفر': '✈️', 'متفرقه': '📦', 'انتقال': '🔄' }
const COLORS = ['#22d3ee', '#a78bfa', '#fbbf24', '#34d399', '#f472b6', '#60a5fa', '#fb7185', '#4ade80', '#f97316']
const TABS = [
  { id: 'dash', label: 'داشبورد' },
  { id: 'ledger', label: 'تراکنش‌ها' },
  { id: 'budget', label: 'بودجه و حساب‌ها' },
  { id: 'wealth', label: 'بدهی و سرمایه' },
]
const FILTERS = [['all', 'همه'], ['expense', 'هزینه'], ['income', 'درآمد'], ['transfer', 'انتقال']]

function AreaChart({ series }) {
  const w = 640, h = 220, pad = 28
  const vals = series.flatMap((s) => [s.income, s.expense])
  const max = Math.max(...vals, 1)
  const x = (i) => pad + (i / Math.max(1, series.length - 1)) * (w - pad * 2)
  const y = (v) => h - pad - (v / max) * (h - pad * 2)
  const path = (key) => series.map((s, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(s[key])}`).join(' ')
  const area = (key) => `${path(key)} L ${x(series.length - 1)} ${h - pad} L ${x(0)} ${h - pad} Z`
  if (!series.length) return <p className="fn-empty">برای نمودار به چند ماه تراکنش نیاز است.</p>
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="fn-svg" role="img" aria-label="روند درآمد و هزینه">
      <defs>
        <linearGradient id="fnInc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity="0.4" /><stop offset="100%" stopColor="#34d399" stopOpacity="0" /></linearGradient>
        <linearGradient id="fnExp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fb7185" stopOpacity="0.4" /><stop offset="100%" stopColor="#fb7185" stopOpacity="0" /></linearGradient>
      </defs>
      <path d={area('income')} fill="url(#fnInc)" />
      <path d={area('expense')} fill="url(#fnExp)" />
      <path d={path('income')} fill="none" stroke="#34d399" strokeWidth="2.4" />
      <path d={path('expense')} fill="none" stroke="#fb7185" strokeWidth="2.4" />
      {series.map((s, i) => <text key={s.month} x={x(i)} y={h - 8} textAnchor="middle" fill="#8aa0b8" fontSize="11">{s.month.slice(5)}</text>)}
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
        {slices.map((s, i) => <div key={s.name}><span style={{ background: COLORS[i % COLORS.length] }} />{s.name} · {faMoney(s.value)}</div>)}
      </div>
    </div>
  )
}

export function FinanceReact({ Nav }) {
  const [month, setMonth] = useState(() => isoToday().slice(0, 7))
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

  const load = useCallback(async () => {
    try {
      const months = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5))
      const [sum, list, acc, bud, debt, pf, ...hist] = await Promise.all([
        api(`/api/finance?month=${month}`),
        api(`/api/transactions?from=${month}-01&to=${month}-31`),
        api('/api/accounts'),
        api(`/api/budgets?month=${month}`),
        api('/api/debts'),
        api('/api/portfolio'),
        ...months.map((m) => api(`/api/finance?month=${m}`).catch(() => ({ month: m, income: 0, expense: 0 }))),
      ])
      setSummary(sum)
      setTxs(list.items || [])
      setAccounts(acc.accounts || [])
      setBudgets(bud || { budgets: [] })
      setDebts(debt.items || [])
      setPortfolio(pf || { items: [], totals: {} })
      setTrend(hist.map((h, i) => ({ month: months[i], income: h.income || 0, expense: h.expense || 0 })))
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
  const shown = txs.filter((t) => (filter === 'all' || t.kind === filter) && (!q.trim() || `${t.title} ${t.category} ${t.account || ''}`.includes(q.trim())))
  const face = holdAssetType === 'dollar' || holdAssetType === 'euro'

  const submitTx = (e) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    send('/api/transactions', { title: f.get('title'), amount: Number(f.get('amount')), kind: f.get('kind'), category: f.get('category') || 'متفرقه', account: f.get('account') || 'بدون حساب', date: f.get('date') || `${month}-01`, tags: f.get('tags') }, 'تراکنش ثبت شد.')
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

  return (
    <div className="fn finance-react" dir="rtl">
      {Nav ? <Nav active="finance" /> : null}
      <div className="fn-page">
        <header className="fn-glass fn-top">
          <div className="fn-brand">
            <div className="fn-mark">💠</div>
            <div>
              <p>نمای ماهانه · دادهٔ واقعی LifeOS</p>
              <h1>دستیار مالی شخصی</h1>
            </div>
          </div>
          <nav className="fn-tabs">
            {TABS.map((t) => <button key={t.id} type="button" className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>)}
          </nav>
        </header>

        {notice ? <div className="notice">{notice}<button type="button" onClick={() => setNotice('')}>×</button></div> : null}

        <section className="fn-glass" style={{ padding: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 }}>
            <div className="fn-month">
              <button type="button" onClick={() => setMonth(shiftMonth(month, -1))}>ماه قبل</button>
              <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="ماه" />
              <button type="button" onClick={() => setMonth(shiftMonth(month, 1))}>ماه بعد</button>
              <b>{monthFa(month)}</b>
            </div>
            <div className="fn-chips">
              <span className="fn-chip">دارایی: {compact(netWorth)}</span>
              <span className="fn-chip">طلب: {compact(receivable)}</span>
              <span className="fn-chip">بدهی: {compact(payable)}</span>
            </div>
          </div>
          <div className="fn-kpis">
            <div className="fn-kpi green"><small>💰 درآمد ماه</small><b>{fa(income)}</b></div>
            <div className="fn-kpi rose"><small>💸 هزینه ماه</small><b>{fa(expense)}</b></div>
            <div className={`fn-kpi ${balance >= 0 ? 'cyan' : 'amber'}`}><small>⚖️ مانده ماه</small><b>{fa(balance)}</b></div>
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
                <small>{faMoney(value)}</small>
                <div className="fn-bar"><i style={{ width: `${Math.min(100, Math.round((value / (expense || 1)) * 100))}%`, background: COLORS[i % COLORS.length] }} /></div>
              </div>
            ))}
            {!cats.length ? <p className="fn-empty" style={{ gridColumn: '1/-1' }}>هنوز هزینه‌ای برای این ماه نیست.</p> : null}
          </div>
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
          <div className="fn-layout" id="ledger">
            <form className="fn-glass fn-form" onSubmit={submitTx}>
              <h2>تراکنش تازه</h2>
              <input name="title" required placeholder="شرح" />
              <input name="amount" required inputMode="numeric" placeholder="مبلغ (ریال)" />
              <div>
                <select name="kind"><option value="expense">هزینه</option><option value="income">درآمد</option></select>
                <select name="category">{CATS.map((c) => <option key={c}>{c}</option>)}</select>
              </div>
              <select name="account">
                <option value="بدون حساب">بدون حساب</option>
                {accounts.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
              </select>
              <input name="tags" placeholder="تگ‌ها، با ویرگول" />
              <input name="date" type="date" defaultValue={isoToday()} />
              <button className="fn-save">ثبت تراکنش</button>
            </form>
            <section className="fn-glass fn-list">
              <h2>دفتر {monthFa(month)}</h2>
              <div className="fn-filters">
                {FILTERS.map(([k, l]) => <button key={k} type="button" className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>)}
              </div>
              <input className="fn-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو در شرح و دسته…" />
              {shown.length ? shown.map((item) => (
                <article key={item.id} className="fn-row">
                  <div>
                    <b>{item.title}</b>
                    <small>{item.date} · {item.category} · {item.account}{item.tags?.length ? ` · ${item.tags.map((t) => `#${t}`).join(' ')}` : ''}</small>
                  </div>
                  <span className={`amt ${item.kind === 'income' ? 'pos' : 'neg'}`}>{item.kind === 'income' ? '+' : item.kind === 'transfer' ? '↔' : '−'}{fa(item.amount)}</span>
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
              <h2>حساب‌ها</h2>
              <div className="fn-accounts">
                {accounts.map((a) => (
                  <div key={a.id} className="fn-soft">
                    <b>{a.name}</b>
                    <small>{a.type} · {faMoney(a.balance ?? a.openingBalance ?? 0)}</small>
                    <button type="button" className="fn-ops" onClick={() => setEditing({ type: 'account', item: a })} style={{ marginTop: 8 }}>ویرایش</button>
                  </div>
                ))}
              </div>
              <form className="fn-form" style={{ marginTop: 12, padding: 0 }} onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); send('/api/accounts', { name: f.get('name'), type: f.get('type'), openingBalance: Number(f.get('openingBalance') || 0) }, 'حساب ثبت شد.'); e.currentTarget.reset() }}>
                <input name="name" required placeholder="نام حساب" />
                <div>
                  <select name="type"><option value="bank">بانک</option><option value="card">کارت</option><option value="cash">نقدی</option></select>
                  <input name="openingBalance" inputMode="numeric" placeholder="ماندهٔ اولیه" />
                </div>
                <button className="fn-save">افزودن حساب</button>
              </form>
              <form className="fn-form" style={{ marginTop: 12, padding: 0 }} onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); send('/api/transfers', { fromAccount: f.get('fromAccount'), toAccount: f.get('toAccount'), amount: Number(f.get('amount')), date: f.get('date'), title: f.get('title') }, 'انتقال ثبت شد.'); e.currentTarget.reset() }}>
                <h2>انتقال بین حساب‌ها</h2>
                <input name="title" placeholder="شرح انتقال" />
                <div>
                  <select name="fromAccount" required><option value="">از حساب</option>{accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}</select>
                  <select name="toAccount" required><option value="">به حساب</option>{accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}</select>
                </div>
                <div>
                  <input name="amount" required inputMode="numeric" placeholder="مبلغ" />
                  <input name="date" type="date" defaultValue={isoToday()} />
                </div>
                <button className="fn-save">ثبت انتقال</button>
              </form>
            </section>
            <section className="fn-glass fn-list">
              <h2>بودجهٔ {monthFa(month)}</h2>
              <p className="sub">{budgets.totalBudget ? `${fa(budgets.totalSpent || 0)} از ${fa(budgets.totalBudget)} ریال` : `هزینهٔ ماه: ${fa(budgets.totalSpent || 0)} ریال`}</p>
              <div className="fn-budget">
                {(budgets.budgets || []).map((item) => {
                  const pct = item.limit ? Math.min(100, Math.round((item.spent / item.limit) * 100)) : 0
                  return (
                    <article key={item.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>{item.category}</b><small>{fa(item.spent)} / {fa(item.limit)}</small></div>
                      <div className={`fn-gauge${item.spent > item.limit ? ' over' : ''}`}><i style={{ width: `${pct}%` }} /></div>
                    </article>
                  )
                })}
              </div>
              <form className="fn-form" style={{ marginTop: 12, padding: 0 }} onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); send('/api/budgets', { month, category: f.get('category'), limit: Number(f.get('limit')) }, 'بودجه ذخیره شد.'); e.currentTarget.reset() }}>
                <select name="category"><option value="__total__">سقف کل ماه</option>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
                <input name="limit" required inputMode="numeric" placeholder="سقف، ریال" />
                <button className="fn-save">ذخیرهٔ بودجه</button>
              </form>
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
          <div className="fn-2" id="debts">
            <section className="fn-glass fn-list">
              <h2>بدهی و طلب</h2>
              {debts.length ? debts.map((item) => (
                <article key={item.id} className="fn-row">
                  <div>
                    <b>{item.type === 'payable' ? 'بدهی به ' : 'طلب از '}{item.person}</b>
                    <small>{fa(item.amount)} {item.currency === 'USD' ? 'دلار' : 'ریال'}{item.dueDate ? ` · ${item.dueDate}` : ''}{item.note ? ` · ${item.note}` : ''}</small>
                  </div>
                  <button type="button" onClick={() => send(`/api/debts/${item.id}/settle`, { account: item.currency === 'IRR' ? (accounts.find((a) => !a.archived)?.name || '') : '' }, 'تسویه شد.')}>تسویه</button>
                </article>
              )) : <p className="fn-empty">بدهی یا طلب بازی نیست.</p>}
              <form className="fn-form" style={{ marginTop: 12, padding: 0 }} onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); send('/api/debts', { person: f.get('person'), amount: Number(f.get('amount')), type: f.get('type'), currency: f.get('currency'), dueDate: f.get('dueDate') || null, note: f.get('note') }, 'ثبت شد.'); e.currentTarget.reset() }}>
                <input name="person" required placeholder="نام شخص" />
                <div>
                  <select name="type"><option value="payable">بدهی من</option><option value="receivable">طلب من</option></select>
                  <select name="currency"><option value="IRR">ریال</option><option value="USD">دلار</option></select>
                </div>
                <input name="amount" required inputMode="numeric" placeholder="مبلغ" />
                <input name="dueDate" type="date" />
                <input name="note" placeholder="یادداشت" />
                <button className="fn-save">افزودن</button>
              </form>
            </section>
            <section className="fn-glass fn-list">
              <h2>سبد سرمایه</h2>
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
              <form className="fn-form" style={{ marginTop: 12, padding: 0 }} onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const body = { assetType: holdAssetType, type: f.get('type'), quantity: Number(f.get('quantity')), fee: Number(f.get('fee') || 0), date: f.get('date'), note: f.get('note') }; if (!face) { body.symbol = f.get('symbol'); body.price = Number(f.get('price')) } send('/api/investments/tx', body, 'تراکنش سرمایه‌گذاری ثبت شد.'); e.currentTarget.reset() }}>
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
                <input name="date" type="date" defaultValue={isoToday()} />
                <input name="note" placeholder="یادداشت" />
                <button className="fn-save">ثبت سرمایه‌گذاری</button>
              </form>
            </section>
          </div>
        ) : null}
      </div>

      {editing ? (
        <div className="fn-modal" onClick={() => setEditing(null)}>
          <form className="fn-glass fn-form" onClick={(e) => e.stopPropagation()} onSubmit={(e) => {
            e.preventDefault()
            const f = new FormData(e.currentTarget)
            const body = editing.type === 'account'
              ? { name: f.get('name'), type: f.get('type'), balance: Number(f.get('amount')), archived: f.get('archived') === 'on' }
              : { title: f.get('title'), amount: Number(f.get('amount')), category: f.get('category'), kind: f.get('kind'), account: f.get('account'), date: f.get('date'), tags: f.get('tags') }
            send(`/api/${editing.type === 'account' ? 'accounts' : 'transactions'}/${editing.item.id}`, body, 'ذخیره شد.', 'PATCH')
            setEditing(null)
          }}>
            <h2>ویرایش {editing.type === 'account' ? 'حساب' : 'تراکنش'}</h2>
            {editing.type === 'account' ? (
              <>
                <input name="name" required defaultValue={editing.item.name} />
                <div>
                  <select name="type" defaultValue={editing.item.type}><option value="bank">بانک</option><option value="card">کارت</option><option value="cash">نقدی</option></select>
                  <input name="amount" inputMode="numeric" defaultValue={editing.item.balance ?? editing.item.openingBalance ?? 0} />
                </div>
                <label><input name="archived" type="checkbox" defaultChecked={editing.item.archived} /> بایگانی</label>
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
                <input name="date" type="date" defaultValue={editing.item.date} />
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
