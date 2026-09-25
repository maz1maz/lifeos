import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownRight, ArrowUpRight, Bell, Calculator, Clock, RefreshCw, Search, Star, TrendingDown, TrendingUp
} from 'lucide-react'
import './market.css'
import { MarketLogo } from './market-logos'
import { jalaliShort } from './jalali'

const FAV_KEY = 'lifeos-market-favs'
const ALERT_KEY = 'lifeos-market-alerts'

const TGJU_LABELS = {
  price_dollar_rl: 'دلار آزاد', price_eur: 'یورو', price_gbp: 'پوند', price_aed: 'درهم', price_try: 'لیر',
  geram18: 'گرم ۱۸ عیار', geram24: 'گرم ۲۴ عیار', sekee: 'سکه امامی', sekeb: 'سکه بهار آزادی',
  rob: 'ربع سکه', nim: 'نیم سکه', mesghal: 'مثقال', oil_brent: 'نفت برنت', oil: 'نفت',
  nickel: 'نیکل', platinum: 'پلاتین', copper: 'مس', silver: 'نقره',
}
const TGJU_ICONS = {
  price_dollar_rl: '💵', price_eur: '💶', price_gbp: '💷', price_aed: '💴', price_try: '💴',
  geram18: '🟡', geram24: '🟡', sekee: '🪙', sekeb: '🪙', rob: '🪙', nim: '🪙', mesghal: '🟡',
  oil_brent: '🛢️', oil: '🛢️', nickel: '⚙️', platinum: '⚪', copper: '🟠', silver: '⚪',
}
const CAT = {
  currency: new Set(['price_dollar_rl', 'price_eur', 'price_gbp', 'price_aed', 'price_try']),
  gold: new Set(['geram18', 'geram24', 'sekee', 'sekeb', 'rob', 'nim', 'mesghal']),
  global: new Set(['oil_brent', 'oil', 'nickel', 'platinum', 'copper', 'silver']),
}

const fa = (n, d = 0) => {
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return x.toLocaleString('fa-IR', { maximumFractionDigits: d })
}

function parseChange(value) {
  if (value == null) return 0
  if (typeof value === 'number') return value
  const n = parseFloat(String(value).replace(/[^\d.+-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function tgjuRows(data) {
  const raw = data.items || data.data || data || {}
  const entries = Array.isArray(raw) ? raw.map((v, i) => [v.key || v.title || v.name || i, v]) : Object.entries(raw)
  return entries.map(([key, value]) => {
    const p = Number(value.p ?? value.price ?? value.value ?? 0) || 0
    const dp = value.dp != null ? Number(value.dp) : parseChange(value.change ?? value.percent)
    return {
      id: `t:${key}`,
      key,
      name: TGJU_LABELS[key] || value.title || value.name || key,
      icon: TGJU_ICONS[key] || '📈',
      price: p,
      change: dp,
      market: 'tehran',
      category: CAT.currency.has(key) ? 'currency' : CAT.gold.has(key) ? 'gold' : CAT.global.has(key) ? 'global' : 'other',
      sparkline: [],
    }
  }).filter((x) => x.name)
}

function loadJson(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '')
    return v ?? fallback
  } catch { return fallback }
}

function Sparkline({ data, up, uid = 's' }) {
  if (!data || data.length < 2) return <svg className="mk-spark" width="80" height="28" />
  const w = 80, h = 28
  const max = Math.max(...data), min = Math.min(...data), span = max - min || 1
  const coords = data.map((v, i) => [(i / (data.length - 1)) * w, h - ((v - min) / span) * (h - 6) - 3])
  const line = coords.map(([x, y]) => `${x},${y}`).join(' ')
  const area = `0,${h} ${line} ${w},${h}`
  const color = up ? '#00E676' : '#FF5252'
  const gid = `mkf-${uid}`
  return (
    <svg className="mk-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gid})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SkeletonRow() {
  return (
    <div className="mk-skel">
      <i style={{ width: 28, height: 28, borderRadius: 99 }} />
      <i style={{ width: 120 }} />
      <i style={{ width: 72 }} />
      <i style={{ width: 48, height: 22, borderRadius: 99 }} />
    </div>
  )
}

function ChangeBadge({ n }) {
  const up = Number(n) >= 0
  return (
    <span className={`mk-chg ${up ? 'up' : 'dn'}`}>
      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {fa(Math.abs(Number(n) || 0), 2)}٪
    </span>
  )
}

function marketHours(now) {
  const hour = now.getHours()
  const day = now.getDay()
  const tehran = day !== 4 && day !== 5 && hour >= 9 && hour < 16
  const us = day !== 5 && day !== 6 && (hour >= 18 || hour < 1)
  return { tehran, us }
}

// TGJU free-market dollar is in rial; older feeds sent toman — normalise to rial.
function rialRate(dollarPrice) {
  const n = Number(dollarPrice) || 0
  if (!n) return 0
  return n > 200000 ? n : n * 10
}

export function MarketReact({ Nav }) {
  const [tab, setTab] = useState('tehran')
  const [sub, setSub] = useState('currency')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('default')
  const [clock, setClock] = useState('')
  const [tehran, setTehran] = useState([])
  const [stocks, setStocks] = useState([])
  const [crypto, setCrypto] = useState([])
  const [hist, setHist] = useState({})
  const [selected, setSelected] = useState(null)
  const [history, setHistory] = useState([])
  const [loadingT, setLoadingT] = useState(true)
  const [loadingC, setLoadingC] = useState(true)
  const [notice, setNotice] = useState('')
  const [toast, setToast] = useState('')
  const [favs, setFavs] = useState(() => loadJson(FAV_KEY, ['t:price_dollar_rl', 'c:bitcoin', 't:geram18']))
  const [alerts, setAlerts] = useState(() => loadJson(ALERT_KEY, []))
  const [showConv, setShowConv] = useState(false)
  const [showAlert, setShowAlert] = useState(null)
  const [convAmt, setConvAmt] = useState(1)
  const [convFrom, setConvFrom] = useState('USDT')
  const [alertTarget, setAlertTarget] = useState('')

  const flash = (m) => { setToast(m); window.setTimeout(() => setToast(''), 4200) }

  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString('fa-IR')), 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => { localStorage.setItem(FAV_KEY, JSON.stringify(favs)) }, [favs])
  useEffect(() => { localStorage.setItem(ALERT_KEY, JSON.stringify(alerts)) }, [alerts])

  const loadTehran = useCallback(async () => {
    setLoadingT(true)
    try {
      const [local, us] = await Promise.all([
        fetch('/api/tgju', { credentials: 'include' }).then((r) => r.json()),
        fetch('/api/market/stocks', { credentials: 'include' }).then(async (r) => {
          const j = await r.json().catch(() => ({}))
          if (!r.ok) return { items: [], error: j.error }
          return j
        }),
      ])
      const rows = tgjuRows(local)
      setTehran(rows)
      setStocks((us.items || []).map((s) => ({
        id: `u:${(s.symbol || '').toLowerCase()}`,
        symbol: s.symbol,
        name: s.name || s.symbol,
        price: s.price,
        change: parseChange(s.changePercent),
        market: 'us',
        sparkline: [],
      })))
      if (us.error) setNotice(us.error)
      const top = rows.slice(0, 8)
      const pairs = await Promise.all(top.map((item) =>
        fetch(`/api/tgju/history?key=${encodeURIComponent(item.key)}&days=30`, { credentials: 'include' })
          .then((r) => r.json())
          .then((d) => [item.key, (d.items || []).map((x) => Number(x.price ?? x.p ?? x.value)).filter(Number.isFinite)])
          .catch(() => [item.key, []]),
      ))
      setHist(Object.fromEntries(pairs))
    } catch (e) {
      setNotice(e.message || 'دریافت بازار تهران ناموفق بود')
    } finally { setLoadingT(false) }
  }, [])

  const loadCrypto = useCallback(async () => {
    setLoadingC(true)
    try {
      const r = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana,binancecoin,ripple,dogecoin,the-open-network,tron,tether&sparkline=true')
      if (!r.ok) throw new Error('coingecko')
      const data = await r.json()
      setCrypto((data || []).map((c) => ({
        id: `c:${c.id}`,
        cg: c.id,
        name: c.name,
        symbol: (c.symbol || '').toUpperCase(),
        price: c.current_price,
        change: c.price_change_percentage_24h,
        image: c.image,
        sparkline: c.sparkline_in_7d?.price || [],
        market: 'crypto',
      })))
    } catch {
      setNotice((n) => n || 'کریپتو از CoinGecko نیامد — بقیهٔ بازار از LifeOS است.')
      setCrypto([])
    } finally { setLoadingC(false) }
  }, [])

  useEffect(() => { loadTehran(); loadCrypto() }, [loadTehran, loadCrypto])

  const usdRial = useMemo(() => rialRate(tehran.find((x) => x.key === 'price_dollar_rl')?.price), [tehran])
  const hours = marketHours(new Date())

  const withSpark = (list) => list.map((x) => x.market === 'tehran' && hist[x.key]?.length ? { ...x, sparkline: hist[x.key] } : x)

  const all = useMemo(() => withSpark([...tehran, ...crypto, ...stocks]), [tehran, crypto, stocks, hist])

  useEffect(() => {
    if (!all.length || !alerts.length) return
    const hit = []
    const rest = []
    for (const a of alerts) {
      const item = all.find((x) => x.id === a.id)
      if (!item || item.price == null) { rest.push(a); continue }
      const ok = a.above ? item.price >= a.target : item.price <= a.target
      if (ok) hit.push(`${item.name}: به ${fa(a.target, 4)} رسید`)
      else rest.push(a)
    }
    if (hit.length) { setAlerts(rest); flash(hit.join(' · ')) }
  }, [all]) // eslint-disable-line react-hooks/exhaustive-deps

  const filterSort = (list) => {
    let out = list
    const s = q.trim().toLowerCase()
    if (s) out = out.filter((x) => `${x.name} ${x.symbol || ''} ${x.key || ''}`.toLowerCase().includes(s))
    if (sort === 'gainers') out = [...out].sort((a, b) => (b.change || 0) - (a.change || 0))
    if (sort === 'losers') out = [...out].sort((a, b) => (a.change || 0) - (b.change || 0))
    return out
  }

  const toggleFav = (id) => setFavs((xs) => xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id])

  const openHist = async (item) => {
    if (item.market !== 'tehran') { setSelected(item); setHistory([]); return }
    setSelected(item)
    try {
      const d = await fetch(`/api/tgju/history?key=${encodeURIComponent(item.key)}`, { credentials: 'include' }).then((r) => r.json())
      setHistory(d.items || d.data || [])
    } catch { setHistory([]) }
  }

  const saveAlert = () => {
    const target = Number(String(alertTarget).replace(/,/g, ''))
    if (!showAlert || !target) return
    setAlerts((xs) => [...xs.filter((a) => a.id !== showAlert.id), { id: showAlert.id, name: showAlert.name, target, above: target >= (showAlert.price || 0) }])
    setShowAlert(null)
    setAlertTarget('')
    flash('هشدار ذخیره شد')
  }

  const convOut = useMemo(() => {
    if (!usdRial) return 0
    if (convFrom === 'USDT') return convAmt * usdRial
    const coin = crypto.find((c) => c.symbol === convFrom)
    if (coin?.price) return convAmt * coin.price * usdRial
    return 0
  }, [convAmt, convFrom, crypto, usdRial])

  const summaries = [
    tehran.find((x) => x.key === 'price_dollar_rl'),
    tehran.find((x) => x.key === 'geram18'),
    crypto[0],
    stocks[0],
  ].filter(Boolean)

  const list = tab === 'favorites' ? all.filter((x) => favs.includes(x.id))
    : tab === 'tehran' ? tehran.filter((x) => x.category === sub)
    : tab === 'crypto' ? crypto
    : stocks

  const shown = filterSort(withSpark(list))

  const priceLabel = (item) => {
    if (item.market === 'crypto' || item.market === 'us') return `$${Number(item.price || 0).toLocaleString()}`
    return `${fa(item.price)}`
  }

  return (
    <div className="mk" dir="rtl">
      {Nav ? <Nav active="market" /> : null}
      <div className="mk-page">
        <header className="mk-card mk-hero">
          <div>
            <p className="mk-live"><span className="mk-dot" /> به‌روزرسانی لحظه‌ای · تهران از LifeOS · کریپتو CoinGecko</p>
            <h1>ترمینال هوشمند بازار</h1>
            <div className="mk-status">
              <span className="mk-pill"><Clock size={14} color="#60a5fa" /> {clock || '—'}</span>
              <span>تهران: {hours.tehran ? <b className="mk-open">● باز</b> : <b className="mk-closed">● بسته</b>}</span>
              <span>آمریکا: {hours.us ? <b className="mk-open">● باز</b> : <b className="mk-closed">● بسته</b>}</span>
              <span>کریپتو: <b className="mk-open">● ۲۴/۷</b></span>
            </div>
          </div>
          <div className="mk-actions">
            <button type="button" className="mk-btn" onClick={() => setShowConv(true)}><Calculator size={15} /> مبدل ارز</button>
            <button type="button" className="mk-btn" onClick={() => { loadTehran(); loadCrypto() }} title="تازه‌سازی">
              <RefreshCw size={15} className={loadingT || loadingC ? 'spin' : ''} />
            </button>
          </div>
          <div className="mk-tools">
            <div className="mk-search">
              <Search size={15} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی ارز، سکه، نماد (دلار، بیت‌کوین، AAPL)…" />
            </div>
            <div className="mk-sorts">
              <button type="button" className={sort === 'default' ? 'on' : ''} onClick={() => setSort('default')}>پیش‌فرض</button>
              <button type="button" className={`up${sort === 'gainers' ? ' on' : ''}`} onClick={() => setSort('gainers')}><TrendingUp size={14} /> بیشترین رشد</button>
              <button type="button" className={`dn${sort === 'losers' ? ' on' : ''}`} onClick={() => setSort('losers')}><TrendingDown size={14} /> بیشترین ریزش</button>
            </div>
          </div>
        </header>

        {notice ? <div className="notice">{notice} <button type="button" onClick={() => setNotice('')}>بستن</button></div> : null}

        <div className="mk-summaries">
          {summaries.map((item) => {
            const up = (item.change || 0) >= 0
            return (
              <article key={item.id} className="mk-card mk-sum">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <small className="mk-sum-name">{item.market === 'tehran' ? <MarketLogo k={item.key} size={20} fallback={item.icon} /> : (item.icon || '')} {item.name}</small>
                  <ChangeBadge n={item.change} />
                </div>
                <b>{priceLabel(item)} <em>{item.market === 'tehran' ? '' : item.market === 'us' ? 'دلار' : 'USD'}</em></b>
                <Sparkline data={item.sparkline} up={up} uid={item.id} />
              </article>
            )
          })}
        </div>

        <nav className="mk-tabs">
          <button type="button" className={`fav${tab === 'favorites' ? ' on' : ''}`} onClick={() => setTab('favorites')}><Star size={14} fill="currentColor" /> نشان‌شده‌ها ({fa(favs.length)})</button>
          <button type="button" className={tab === 'tehran' ? 'on' : ''} onClick={() => setTab('tehran')}>بازار تهران</button>
          <button type="button" className={tab === 'crypto' ? 'on' : ''} onClick={() => setTab('crypto')}>کریپتو</button>
          <button type="button" className={tab === 'us' ? 'on' : ''} onClick={() => setTab('us')}>سهام آمریکا</button>
        </nav>

        {tab === 'tehran' ? (
          <div className="mk-subs">
            {[['currency', 'ارز آزاد'], ['gold', 'طلا و سکه'], ['global', 'بازار جهانی']].map(([k, l]) => (
              <button key={k} type="button" className={sub === k ? 'on' : ''} onClick={() => setSub(k)}>{l}</button>
            ))}
          </div>
        ) : null}

        <section className="mk-card mk-list">
          <div className="mk-list-head">
            <b>{tab === 'favorites' ? 'لیست دیده‌بان' : tab === 'tehran' ? 'ارز، طلا و فلزات' : tab === 'crypto' ? 'رمزارز · CoinGecko' : 'NASDAQ / NYSE'}</b>
            <span>{tab === 'crypto' ? 'نمودار ۷روزه واقعی' : 'داده از سرویس LifeOS'}</span>
          </div>

          {tab === 'crypto' && loadingC ? <><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /></> : null}
          {tab === 'tehran' && loadingT ? <><SkeletonRow /><SkeletonRow /><SkeletonRow /></> : null}

          {!((tab === 'crypto' && loadingC) || (tab === 'tehran' && loadingT)) && !shown.length ? (
            <div className="mk-empty">{tab === 'favorites' ? 'ستاره بزنید تا اینجا جمع شود.' : tab === 'us' ? 'سهام نیامد — کلید سرویس باید فعال باشد.' : tab === 'crypto' ? 'رمزارزی دریافت نشد.' : 'داده‌ای برای این دسته نیست.'}</div>
          ) : shown.map((item) => {
            const up = (item.change || 0) >= 0
            const rialEq = (item.market === 'crypto' || item.category === 'global') && usdRial && item.price ? fa(Math.round(item.price * usdRial)) : ''
            return (
              <article key={item.id} className="mk-row">
                <div className="mk-name">
                  <button type="button" className={`mk-star${favs.includes(item.id) ? ' on' : ''}`} onClick={() => toggleFav(item.id)} aria-label="علاقه‌مندی">
                    <Star size={16} fill={favs.includes(item.id) ? 'currentColor' : 'none'} />
                  </button>
                  {item.image ? <img src={item.image} alt="" /> : item.market === 'tehran' ? <MarketLogo k={item.key} size={34} fallback={item.icon} /> : <span className="mk-ico">{item.icon || '📈'}</span>}
                  <div>
                    <b>{item.name} {item.symbol ? <small>({item.symbol})</small> : null}</b>
                    {rialEq ? <small>≈ {rialEq} ریال</small> : null}
                  </div>
                </div>
                <div className="mk-price">
                  {priceLabel(item)}
                  {item.market === 'tehran' ? <small>{item.category === 'global' ? 'دلار' : 'ریال'}</small> : null}
                </div>
                <Sparkline data={item.sparkline} up={up} uid={item.id} />
                <div className="mk-row-ops">
                  <ChangeBadge n={item.change} />
                  <button type="button" className="mk-bell" title="هشدار قیمت" onClick={() => { setShowAlert(item); setAlertTarget(String(item.price || '')) }}><Bell size={14} /></button>
                  {item.market === 'tehran' ? <button type="button" className="mk-btn" onClick={() => openHist(item)}>نمودار</button> : null}
                </div>
              </article>
            )
          })}

          {selected && history.length ? (
            <div className="mk-hist">
              <h3>تاریخچهٔ {selected.name}</h3>
              <div className="mk-bars">
                {history.slice(-30).map((point, i) => {
                  const v = Number(point.p || point.price || point.value || 0)
                  const max = Math.max(...history.map((x) => Number(x.p || x.price || x.value || 0)), 1)
                  return <span key={point.date || i} title={`${point.date ? jalaliShort(point.date) : ''}: ${v}`} style={{ height: `${Math.max(8, Math.min(100, v / max * 100))}%` }} />
                })}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {showConv ? (
        <div className="mk-modal" onClick={() => setShowConv(false)}>
          <div className="mk-card mk-modal-box" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3><Calculator size={18} color="#60a5fa" /> مبدل ارز</h3>
              <button type="button" onClick={() => setShowConv(false)}>✕</button>
            </header>
            <label>مقدار</label>
            <input type="number" value={convAmt} onChange={(e) => setConvAmt(Number(e.target.value))} />
            <label>از</label>
            <select value={convFrom} onChange={(e) => setConvFrom(e.target.value)}>
              <option value="USDT">تتر / دلار</option>
              {crypto.filter((c) => c.symbol !== 'USDT').map((c) => <option key={c.id} value={c.symbol}>{c.name} ({c.symbol})</option>)}
            </select>
            <div className="mk-conv-out">
              <small>معادل ریالی با دلار آزاد LifeOS</small>
              <b>{usdRial ? fa(Math.round(convOut)) : '—'} <em style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'normal' }}>ریال</em></b>
            </div>
          </div>
        </div>
      ) : null}

      {showAlert ? (
        <div className="mk-modal" onClick={() => setShowAlert(null)}>
          <div className="mk-card mk-modal-box" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3 style={{ color: '#fbbf24' }}><Bell size={16} /> هشدار {showAlert.name}</h3>
              <button type="button" onClick={() => setShowAlert(null)}>✕</button>
            </header>
            <p style={{ margin: '0 0 10px', color: '#94a3b8', fontSize: 12 }}>وقتی قیمت به این عدد برسد در همین صفحه خبر می‌دهیم. روی سرور ذخیره نمی‌شود.</p>
            <label>قیمت هدف</label>
            <input value={alertTarget} onChange={(e) => setAlertTarget(e.target.value)} />
            <button type="button" className="mk-btn primary" style={{ width: '100%', marginTop: 14 }} onClick={saveAlert}>ثبت هشدار</button>
          </div>
        </div>
      ) : null}

      {toast ? <div className="mk-toast">{toast}</div> : null}
    </div>
  )
}
