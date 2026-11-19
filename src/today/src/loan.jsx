// Loan calculator (equal monthly installments — the usual Iranian bank loan, «اقساط مساوی»).
// payment = P·r / (1 − (1+r)^−n), r = yearly rate / 12; zero rate → P / n. Money is whole rial (Math.round).
import { useState } from 'react'

export function loanPlan(principal, yearlyRatePct, months) {
  const P = Math.round(Number(principal) || 0), n = Math.round(Number(months) || 0), r = (Number(yearlyRatePct) || 0) / 100 / 12
  if (!(P > 0) || !(n > 0) || r < 0) return null
  const payment = r === 0 ? Math.round(P / n) : Math.round((P * r) / (1 - Math.pow(1 + r, -n)))
  const total = payment * n
  return { payment, total, interest: total - P, months: n }
}

const faN = (n) => Number(n || 0).toLocaleString('fa-IR')
const latin = (s) => String(s || '').replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[,٬\s]/g, '').replace(/٫/g, '.')

export function LoanCalc({ unitFa = 'ریال', toRial = (v) => v, fromRial = (v) => v }) {
  const [p, setP] = useState(''), [rate, setRate] = useState('23'), [n, setN] = useState('36')
  const plan = loanPlan(toRial(Number(latin(p))), Number(latin(rate)), Number(latin(n)))
  return <section className="fn-glass fn-list fl-loan" dir="rtl">
    <div className="fn-head"><h2>🧮 محاسبهٔ قسط وام</h2></div>
    <p className="sub">اقساط مساوی (روش معمول بانک‌ها). فقط محاسبه است و چیزی ذخیره نمی‌کند.</p>
    <div className="fl-loan-in">
      <label>مبلغ وام ({unitFa})<input inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} placeholder="مثلاً ۱۰۰٬۰۰۰٬۰۰۰" /></label>
      <label>سود سالانه (٪)<input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></label>
      <label>تعداد ماه<input inputMode="numeric" value={n} onChange={(e) => setN(e.target.value)} /></label>
    </div>
    {plan ? <div className="fl-loan-out">
      <div><small>قسط ماهانه</small><b>{faN(fromRial(plan.payment))} {unitFa}</b></div>
      <div><small>جمع بازپرداخت</small><b>{faN(fromRial(plan.total))} {unitFa}</b></div>
      <div><small>کل سود</small><b>{faN(fromRial(plan.interest))} {unitFa}</b></div>
    </div> : <p className="fl-hint">مبلغ، سود و تعداد ماه را بنویس.</p>}
  </section>
}
