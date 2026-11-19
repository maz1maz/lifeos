// «اگر…» for the portfolio: what the portfolio is worth if some asset groups move by a percentage.
// Works on the allocation the finance page already computes (pf.mix: [{type, label, value}], value in rial).
// Money stays whole rial. Presets reflect how the Iranian market moves together: dollar-priced groups
// (dollar, euro, gold, crypto in rial) follow the dollar rate.
import { useState } from 'react'

export function whatIfScenario(mix, changes) {
  const rows = (mix || []).map((m) => {
    const pct = Number(changes?.[m.type]) || 0, value = Math.round(Number(m.value) || 0), after = Math.round(value * (1 + pct / 100))
    return { type: m.type, label: m.label, value, pct, after, delta: after - value }
  })
  const before = rows.reduce((a, r) => a + r.value, 0), after = rows.reduce((a, r) => a + r.after, 0)
  return { rows, before, after, delta: after - before, pct: before ? Math.round(((after - before) / before) * 1000) / 10 : 0 }
}

const DOLLARISH = ['dollar', 'euro', 'gold', 'crypto']
export const WHATIF_PRESETS = [
  ['دلار +۲۰٪', Object.fromEntries(DOLLARISH.map((t) => [t, 20]))],
  ['دلار −۱۵٪', Object.fromEntries(DOLLARISH.map((t) => [t, -15]))],
  ['بورس −۲۰٪', { stock: -20 }],
  ['کریپتو −۳۰٪', { crypto: -30 }],
  ['همه −۱۰٪', { stock: -10, dollar: -10, euro: -10, gold: -10, crypto: -10, other: -10 }],
]
const faN = (n) => Number(n || 0).toLocaleString('fa-IR', { maximumFractionDigits: 1 })

export function WhatIfPanel({ mix, short }) {
  const [ch, setCh] = useState({}), [preset, setPreset] = useState('')
  if (!mix || !mix.length) return null
  const sc = whatIfScenario(mix, ch)
  const setOne = (t, v) => { setPreset(''); setCh((c) => ({ ...c, [t]: v })) }
  const sign = (n) => (n > 0 ? '+' : n < 0 ? '−' : '')
  return <section className="fn-glass fn-list fl-whatif" dir="rtl">
    <div className="fn-head"><h2>🔮 اگر…</h2><button type="button" className="fn-link" onClick={() => { setCh({}); setPreset('') }}>صفر کن</button></div>
    <p className="sub">اگر قیمت این گروه‌ها این‌قدر عوض شود، ارزش سبد چه می‌شود؟ فقط محاسبه است؛ چیزی ذخیره نمی‌شود.</p>
    <div className="fl-chips">{WHATIF_PRESETS.map(([label, c]) => <button key={label} type="button" className={preset === label ? 'on' : ''} onClick={() => { setPreset(label); setCh(c) }}>{label}</button>)}</div>
    <div className="fl-wi-rows">
      {sc.rows.map((r) => <div key={r.type} className="fl-wi-row">
        <span>{r.label}</span>
        <small>{short(r.value)}</small>
        <label><input inputMode="decimal" value={ch[r.type] ?? ''} onChange={(e) => setOne(r.type, e.target.value.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[^\d.\-]/g, ''))} placeholder="۰" aria-label={`درصد تغییر ${r.label}`} />٪</label>
        <b className={r.delta > 0 ? 'pos' : r.delta < 0 ? 'neg' : ''}>{r.delta ? <bdi dir="ltr">{sign(r.delta)}{short(Math.abs(r.delta), false)}</bdi> : '—'}</b>
      </div>)}
    </div>
    <div className={`fl-wi-total ${sc.delta > 0 ? 'pos' : sc.delta < 0 ? 'neg' : ''}`}>
      <span>ارزش سبد: {short(sc.before)} ← <b>{short(sc.after)}</b></span>
      <span>تغییر: <b><bdi dir="ltr">{sign(sc.delta)}{short(Math.abs(sc.delta), false)}</bdi> ({<bdi dir="ltr">{sign(sc.pct)}{faN(Math.abs(sc.pct))}٪</bdi>})</b></span>
    </div>
  </section>
}
