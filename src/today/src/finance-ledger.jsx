// Finance «تراکنش‌ها» — one dense, editable ledger (replaces the old dashboard + list + edit drawer).
//  • summary strip (income / expense / net, pass-through shown apart) and a one-line quick add
//  • full-width rows grouped by day; click a row to edit it in place (title, amount, date, category, account, tags,
//    note, «عبوری»); tick rows to see their sum/average and to change category / pass-through / account / delete in bulk
//  • the filtered list always shows its own totals
// Amounts are stored in rial; this view shows the unit chosen at the top (rial/toman) and converts back when saving.
import { useEffect, useMemo, useRef, useState } from 'react'
import { JalaliDateInput } from './jdate'
import { jalaliShort } from './jalali'

const api = async (url, options) => {
  const response = await fetch(url, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'انجام نشد.')
  return body
}
const faN = (n) => Number(n || 0).toLocaleString('fa-IR')
const enDigits = (s) => String(s || '').replace(/[۰-۹]/g, (c) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c))
// «۲۵۰ هزار» / «2.5 میلیون» / «1,200,000» → number (in the unit the user is working in)
export function parseMoney(text) {
  const s = enDigits(text).replace(/[٬,،\s]/g, '').replace(/٫/g, '.')
  const m = /^(\d+(?:\.\d+)?)(میلیارد|میلیون|ملیون|هزار|ه|م)?$/.exec(s)
  if (!m) return NaN
  const k = { 'میلیارد': 1e9, 'میلیون': 1e6, 'ملیون': 1e6, 'هزار': 1e3, 'ه': 1e3, 'م': 1e6 }[m[2]] || 1
  return Math.round(Number(m[1]) * k)
}
// A signed short amount: the minus stays glued to the left of the digits (an LTR island inside the RTL line),
// the unit word («میلیارد») follows in normal RTL order. Without this the bidi rules float «−» to the far right.
function Signed({ n, fmt, unit = false }) {
  const neg = n < 0, txt = fmt.short(Math.abs(n), unit), m = /^(\S+)(\s[\s\S]*)?$/.exec(txt) || [null, txt, '']
  return <><bdi dir="ltr">{neg ? '−' : ''}{m[1]}</bdi>{m[2] || ''}</>
}
const NEW_CAT = '__new__'
// asks for a name, saves it to the user's categories (addCat) and returns it; null when cancelled
async function askNewCat(addCat, notify) {
  const name = String(window.prompt('نام دستهٔ تازه (مثلاً «هوش مصنوعی»، «ماشین»، «مامان»):') || '').replace(/\s+/g, ' ').trim().slice(0, 40)
  if (!name) return null
  try { await addCat(name); return name } catch (e) { notify(e.message || 'دسته ذخیره نشد.'); return null }
}
const dayLabel = (iso) => { try { return new Date(iso + 'T12:00:00').toLocaleDateString('fa-IR-u-ca-persian', { weekday: 'long', day: 'numeric', month: 'long' }) } catch { return iso } }
const FILTERS = [['all', 'همه'], ['expense', 'هزینه'], ['income', 'درآمد'], ['pass', 'عبوری'], ['misc', 'بدون دسته'], ['transfer', 'انتقال']]
const isTransfer = (t) => t.kind === 'transfer' || t.category === 'انتقال'
const isMiscRow = (t) => !t.passThrough && (t.kind === 'expense' || t.kind === 'income') && (!t.category || String(t.category).trim() === 'متفرقه')
const counts = (t) => !t.passThrough && !isTransfer(t) && !(t.kind === 'income' && t.notIncome)  // counted in income / expense
const matchFilter = (t, f) => f === 'all' ? true : f === 'pass' ? !!t.passThrough : f === 'misc' ? isMiscRow(t) : f === 'transfer' ? isTransfer(t) : f === 'income' ? t.kind === 'income' && counts(t) : t.kind === 'expense' && counts(t)

function QuickAdd({ accounts, unitFa, toRial, onAdded, notify }) {
  const [amount, setAmount] = useState(''), [title, setTitle] = useState(''), [kind, setKind] = useState('expense')
  const [account, setAccount] = useState(() => { try { return localStorage.getItem('lifeos-fin-quick-acct') || '' } catch { return '' } })
  const [date, setDate] = useState(''), [dateOpen, setDateOpen] = useState(false), [busy, setBusy] = useState(false)
  const amountRef = useRef(null)
  const acc = accounts.filter((a) => !a.archived)
  const value = parseMoney(amount)
  const submit = async (e) => {
    e?.preventDefault()
    if (busy) return
    if (!(value > 0)) { notify("مبلغ را بنویس."); amountRef.current?.focus(); return }
    if (!title.trim()) { notify('شرح را بنویس.'); return }
    setBusy(true)
    try {
      await api('/api/transactions', { method: 'POST', body: JSON.stringify({ title: title.trim(), amount: toRial(value), kind, account: account || 'بدون حساب', ...(date ? { date } : {}), category: '' }) })
      try { localStorage.setItem('lifeos-fin-quick-acct', account) } catch {}
      setAmount(''); setTitle(''); setDate(''); setDateOpen(false); amountRef.current?.focus(); onAdded()
    } catch (err) { notify(err.message) } finally { setBusy(false) }
  }
  return <form className="fl-quick" onSubmit={submit}>
    <span className="fl-kind" role="radiogroup" aria-label="نوع">
      <button type="button" className={kind === 'expense' ? 'on exp' : ''} onClick={() => setKind('expense')}>هزینه</button>
      <button type="button" className={kind === 'income' ? 'on inc' : ''} onClick={() => setKind('income')}>درآمد</button>
    </span>
    <input ref={amountRef} className="fl-q-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`مبلغ (${unitFa})`} aria-label="مبلغ" />
    <input className="fl-q-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="شرح — مثلاً نان، بنزین، اجاره" aria-label="شرح" />
    <select className="fl-q-acct" value={account} onChange={(e) => setAccount(e.target.value)} aria-label="حساب"><option value="">بدون حساب</option>{acc.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}</select>
    {dateOpen ? <JalaliDateInput name="date" defaultValue={date || undefined} onChange={(v) => setDate(v?.target ? v.target.value : v)} /> : <button type="button" className="fl-ghost" onClick={() => setDateOpen(true)} title="تاریخ دیگر">📅 امروز</button>}
    <button type="submit" className="fl-primary" disabled={busy || !(value > 0) || !title.trim()}>{busy ? '…' : '＋ ثبت'}</button>
  </form>
}

function Editor({ item, accounts, cats, unit, conv, toRial, onSaved, onClose, notify, addCat }) {
  const [f, setF] = useState(() => ({ title: item.title || '', amount: String(conv(item.amount)), kind: item.kind === 'income' ? 'income' : 'expense', date: item.date, category: item.category || 'متفرقه', account: item.account || 'بدون حساب', tags: (item.tags || []).join('، '), note: item.note || '', passThrough: !!item.passThrough, learn: false }))
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const transfer = item.kind === 'transfer'
  const save = async (e) => {
    e?.preventDefault()
    const v = parseMoney(f.amount)
    if (!(v > 0)) { notify('مبلغ معتبر نیست.'); return }
    if (!f.title.trim()) { notify('شرح خالی است.'); return }
    setBusy(true)
    try {
      const body = { title: f.title.trim(), amount: toRial(v), date: f.date, category: f.category, account: f.account, tags: f.tags, note: f.note, passThrough: f.passThrough }
      if (!transfer) body.kind = f.kind
      if (f.learn && f.category !== item.category) body.learn = true
      await api(`/api/transactions/${item.id}`, { method: 'PATCH', body: JSON.stringify(body) })
      onSaved('ذخیره شد.')
    } catch (err) { notify(err.message) } finally { setBusy(false) }
  }
  const del = async () => {
    if (!window.confirm(`«${item.title}» حذف شود؟`)) return
    try { await api(`/api/transactions/${item.id}`, { method: 'DELETE' }); onSaved('حذف شد.') } catch (err) { notify(err.message) }
  }
  const acc = accounts.filter((a) => !a.archived)
  return <form className="fl-editor" onSubmit={save} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
    <label className="fl-f wide"><span>شرح</span><input value={f.title} onChange={(e) => set('title', e.target.value)} autoFocus /></label>
    <label className="fl-f"><span>مبلغ ({unit})</span><input inputMode="decimal" value={f.amount} onChange={(e) => set('amount', e.target.value)} /></label>
    {transfer ? null : <label className="fl-f"><span>نوع</span><select value={f.kind} onChange={(e) => set('kind', e.target.value)}><option value="expense">هزینه</option><option value="income">درآمد</option></select></label>}
    <label className="fl-f"><span>تاریخ</span><JalaliDateInput name="date" defaultValue={f.date} onChange={(v) => set('date', v?.target ? v.target.value : v)} /></label>
    <label className="fl-f"><span>دسته</span><select value={f.category} onChange={async (e) => { const v = e.target.value; if (v !== NEW_CAT) return set('category', v); const n = await askNewCat(addCat, notify); if (n) set('category', n) }}>{[...new Set([f.category, ...cats, 'انتقال'])].map((c) => <option key={c}>{c}</option>)}<option value={NEW_CAT}>＋ دستهٔ تازه…</option></select></label>
    <label className="fl-f"><span>حساب</span><select value={f.account} onChange={(e) => set('account', e.target.value)}><option value="بدون حساب">بدون حساب</option>{acc.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}{f.account !== 'بدون حساب' && !acc.some((a) => a.name === f.account) ? <option>{f.account}</option> : null}</select></label>
    <label className="fl-f"><span>تگ‌ها</span><input value={f.tags} onChange={(e) => set('tags', e.target.value)} placeholder="با ویرگول" /></label>
    <label className="fl-f wide"><span>یادداشت</span><input value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="هر توضیحی که بعداً لازم داری" /></label>
    <div className="fl-checks">
      <label title="فقط از حساب شما رد شده (حواله به/از شخص دیگر)؛ در درآمد و هزینه حساب نمی‌شود"><input type="checkbox" checked={f.passThrough} onChange={(e) => set('passThrough', e.target.checked)} /> عبوری (در درآمد/هزینه نیاید)</label>
      {f.category !== item.category ? <label><input type="checkbox" checked={f.learn} onChange={(e) => set('learn', e.target.checked)} /> برای مشابه‌های بدون دسته هم همین دسته</label> : null}
      {item.smsTitle && item.smsTitle !== item.title ? <small className="fl-orig">متن بانک: {item.smsTitle}</small> : null}
    </div>
    <div className="fl-ed-actions">
      <button type="submit" className="fl-primary" disabled={busy}>{busy ? '…' : 'ذخیره'}</button>
      <button type="button" className="fl-ghost" onClick={onClose}>انصراف</button>
      {item.receipt ? <a className="fl-ghost" href={item.receipt} target="_blank" rel="noreferrer">🧾 رسید</a> : null}
      <button type="button" className="fl-danger" onClick={del}>حذف</button>
    </div>
  </form>
}

export function PassThroughTool({ fmt, onChanged, notify }) {
  const [pv, setPv] = useState(null), [busy, setBusy] = useState(false)
  const run = async (body, msg) => { setBusy(true); try { const r = await api('/api/transactions/passthrough', { method: 'POST', body: JSON.stringify(body) }); if (msg) notify(msg(r)); return r } catch (e) { notify(e.message) } finally { setBusy(false) } }
  const scan = async () => { const r = await run({}); if (r) setPv(r) }
  return <div className="fl-pt">
    <b>حواله‌های «عبوری»</b>
    <p>ساتنا، پایا، پل و کارت‌به‌کارت با شخص دیگر پولی نیست که درآمد یا هزینهٔ تو باشد؛ فقط از حساب رد شده. با این ابزار از جمع درآمد/هزینه کنار می‌روند (موجودی حساب‌ها همان می‌ماند) و جدا نشان داده می‌شوند.</p>
    <div className="fl-ed-actions">
      <button type="button" className="fl-ghost" onClick={scan} disabled={busy}>🔍 پیش‌نمایش</button>
      <button type="button" className="fl-ghost" disabled={busy} onClick={async () => { if (window.confirm('قانون عبوری برداشته شود؟ فقط علامت‌هایی که خودِ قانون زده برمی‌گردد.')) { const r = await run({ revert: true }, (x) => `${faN(x.reverted)} علامت برداشته شد.`); if (r) { setPv(null); onChanged() } } }}>↩ برگرداندن قانون</button>
    </div>
    {pv ? <div className="fl-pt-box">
      {pv.count ? <>
        <p><b>{faN(pv.count)}</b> تراکنش پیدا شد: واریز {fmt.short(pv.inSum)} · برداشت {fmt.short(pv.outSum)}{pv.already ? ` (از قبل ${faN(pv.already)} عبوری داری)` : ''}.</p>
        <ul>{pv.sample.map((s, i) => <li key={i}>{jalaliShort(s.date)} · {s.title} · <span className={s.kind === 'income' ? 'pos' : 'neg'}>{fmt.amt(s.amount)}</span></li>)}</ul>
        <p className="fl-hint">با «اعمال»، پیامک و صورت‌حساب‌های بعدی هم خودکار علامت می‌خورند. هر ردیف را می‌شود جدا از حالت عبوری درآورد.</p>
        <div className="fl-ed-actions"><button type="button" className="fl-primary" disabled={busy} onClick={async () => { const r = await run({ apply: true }, (x) => `${faN(x.applied)} تراکنش عبوری شد.`); if (r) { setPv(null); onChanged() } }}>اعمال روی {faN(pv.count)} تراکنش</button><button type="button" className="fl-ghost" onClick={() => setPv(null)}>بستن</button></div>
      </> : <p>مورد تازه‌ای پیدا نشد{pv.already ? ` — ${faN(pv.already)} تراکنش عبوری داری` : ''}.</p>}
    </div> : null}
  </div>
}

export function LedgerView({ addCat, txs, accounts, cats, summary, monthLabel, fmt, toolsSlot, analysisSlot, bannersSlot, netChips, filter, setFilter, acctFilter, setAcctFilter, onChanged, notify, emptySlot }) {
  const [q, setQ] = useState(''), [catF, setCatF] = useState(''), [sort, setSort] = useState('date'), [open, setOpen] = useState(null)
  const [sel, setSel] = useState(() => new Set()), [limit, setLimit] = useState(120), [bulkBusy, setBulkBusy] = useState(false)
  const [analysisOn, setAnalysisOn] = useState(() => { try { return localStorage.getItem('lifeos-fin-analysis') === '1' } catch { return false } })
  const toggleAnalysis = () => setAnalysisOn((v) => { const n = !v; try { localStorage.setItem('lifeos-fin-analysis', n ? '1' : '0') } catch {} return n })
  useEffect(() => { setSel(new Set()); setOpen(null); setLimit(120) }, [monthLabel])
  const norm = (s) => enDigits(String(s || '')).replace(/ي/g, 'ی').replace(/ك/g, 'ک').toLowerCase()
  const shown = useMemo(() => {
    const nq = norm(q).trim()
    const list = txs.filter((t) => matchFilter(t, filter) && (acctFilter === 'all' || t.account === acctFilter || t.toAccount === acctFilter) && (!catF || (t.category || 'متفرقه') === catF) &&
      (!nq || norm(`${t.title} ${t.category} ${t.account} ${(t.tags || []).join(' ')} ${t.note || ''} ${t.smsTitle || ''} ${t.amount} ${fmt.conv(t.amount)}`).includes(nq)))
    const by = { date: (a, b) => String(b.date).localeCompare(String(a.date)) || String(b.time || '').localeCompare(String(a.time || '')) || (b.createdAt || 0) - (a.createdAt || 0), big: (a, b) => b.amount - a.amount, small: (a, b) => a.amount - b.amount }
    return [...list].sort(by[sort] || by.date)
  }, [txs, filter, acctFilter, catF, q, sort, fmt])
  const stats = (rows) => { let inc = 0, exp = 0, pass = 0; for (const t of rows) { if (t.passThrough) pass++; if (counts(t)) { if (t.kind === 'income') inc += t.amount; else if (t.kind === 'expense') exp += t.amount } } return { inc, exp, pass } }
  const shownStats = useMemo(() => stats(shown), [shown])
  const selRows = shown.filter((t) => sel.has(t.id)), selStats = stats(selRows)
  const selSum = selRows.reduce((n, t) => n + (t.kind === 'income' ? t.amount : t.kind === 'expense' ? -t.amount : 0), 0)
  const selAbs = selRows.reduce((n, t) => n + t.amount, 0)
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allVisibleSelected = shown.length > 0 && shown.every((t) => sel.has(t.id))
  const bulk = async (body, msg) => {
    if (!sel.size) return
    setBulkBusy(true)
    try { const r = await api('/api/transactions/bulk', { method: 'POST', body: JSON.stringify({ ids: [...sel], ...body }) }); setSel(new Set()); notify(msg(r)); onChanged() } catch (e) { notify(e.message) } finally { setBulkBusy(false) }
  }
  const quickCat = async (t, picked) => { const category = picked === NEW_CAT ? await askNewCat(addCat, notify) : picked; if (!category) return; try { await api(`/api/transactions/${t.id}`, { method: 'PATCH', body: JSON.stringify({ category }) }); onChanged() } catch (e) { notify(e.message) } }
  const groups = useMemo(() => {
    if (sort !== 'date') return [['', shown.slice(0, limit)]]
    const g = []; let cur = null
    for (const t of shown.slice(0, limit)) { if (!cur || cur[0] !== t.date) { cur = [t.date, []]; g.push(cur) } cur[1].push(t) }
    return g
  }, [shown, sort, limit])
  const net = (summary.income || 0) - (summary.expense || 0)
  const accNames = accounts.filter((a) => !a.archived).map((a) => a.name)
  const usedCats = useMemo(() => [...new Set(txs.map((t) => t.category || 'متفرقه'))].sort(), [txs])

  return <div className="fl">
    <section className="fl-sum" aria-label="خلاصهٔ ماه">
      <button type="button" className={`fl-stat inc ${filter === 'income' ? 'on' : ''}`} onClick={() => setFilter(filter === 'income' ? 'all' : 'income')} title={fmt.faMoney(summary.income)}><small>درآمد</small><b>{summary.income ? fmt.short(summary.income, false) : '—'}</b></button>
      <button type="button" className={`fl-stat exp ${filter === 'expense' ? 'on' : ''}`} onClick={() => setFilter(filter === 'expense' ? 'all' : 'expense')} title={fmt.faMoney(summary.expense)}><small>هزینه</small><b>{summary.expense ? fmt.short(summary.expense, false) : '—'}</b></button>
      <div className={`fl-stat net ${net >= 0 ? 'pos' : 'neg'}`} title={fmt.faMoney(net)}><small>خالص</small><b>{net ? <Signed n={net} fmt={fmt} /> : '—'}</b></div>
      {summary.passCount ? <button type="button" className={`fl-stat pass ${filter === 'pass' ? 'on' : ''}`} onClick={() => setFilter(filter === 'pass' ? 'all' : 'pass')} title="حواله‌هایی که فقط از حساب رد شده‌اند؛ در درآمد و هزینه نیستند"><small>عبوری · {faN(summary.passCount)}</small><b>{fmt.short((summary.passIn || 0) + (summary.passOut || 0), false)}</b></button> : null}
      <span className="fl-unit-note">{fmt.unitFa} · {monthLabel} · {faN(txs.length)} تراکنش</span>
      <button type="button" className={`fl-ghost fl-an ${analysisOn ? 'on' : ''}`} onClick={toggleAnalysis} aria-expanded={analysisOn}>📊 تحلیل</button>
      {netChips}
    </section>
    {bannersSlot}
    {analysisOn ? <div className="fl-analysis">{analysisSlot}</div> : null}
    <QuickAdd accounts={accounts} unitFa={fmt.unitFa} toRial={fmt.toRial} onAdded={() => { notify('ثبت شد ✓'); onChanged() }} notify={notify} />
    <div className="fl-filters">
      <input className="fl-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو: شرح، دسته، تگ، یادداشت، مبلغ…" aria-label="جستجو" />
      <div className="fl-chips" role="tablist" aria-label="نوع">{FILTERS.map(([k, l]) => <button key={k} type="button" className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}{k === 'misc' && summary.miscCount ? ` ${faN(summary.miscCount)}` : ''}</button>)}</div>
      <select value={acctFilter} onChange={(e) => setAcctFilter(e.target.value)} aria-label="حساب"><option value="all">همهٔ حساب‌ها</option>{accNames.map((n) => <option key={n} value={n}>{n}</option>)}</select>
      <select value={catF} onChange={(e) => setCatF(e.target.value)} aria-label="دسته"><option value="">همهٔ دسته‌ها</option>{usedCats.map((c) => <option key={c} value={c}>{c}</option>)}</select>
      <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="مرتب‌سازی"><option value="date">جدیدترین</option><option value="big">بزرگ‌ترین مبلغ</option><option value="small">کوچک‌ترین مبلغ</option></select>
      <details className="fl-tools"><summary>⋯ ابزارها</summary><div className="fl-tools-body">{toolsSlot}</div></details>
    </div>

    {sel.size ? <div className="fl-selbar" role="region" aria-label="انتخاب‌شده‌ها">
      <b>{faN(sel.size)} انتخاب</b>
      <span className="fl-calc" title="درآمد منهای هزینه‌ی ردیف‌های انتخاب‌شده">خالص <b className={selSum >= 0 ? 'pos' : 'neg'}><Signed n={selSum} fmt={fmt} /></b> · جمع مبلغ <b>{fmt.short(selAbs, false)}</b>{selStats.exp ? <> · هزینه <b className="neg">{fmt.short(selStats.exp, false)}</b></> : null}{selStats.inc ? <> · درآمد <b className="pos">{fmt.short(selStats.inc, false)}</b></> : null} · میانگین <b>{fmt.short(selAbs / (sel.size || 1), false)}</b></span>
      <select defaultValue="" onChange={async (e) => { const v = e.target.value; e.target.value = ''; const c = v === NEW_CAT ? await askNewCat(addCat, notify) : v; if (c) bulk({ patch: { category: c } }, (r) => `دستهٔ ${faN(r.changed)} تراکنش «${c}» شد.`) }} disabled={bulkBusy} aria-label="دسته برای انتخاب‌شده‌ها"><option value="">دسته…</option>{cats.map((c) => <option key={c}>{c}</option>)}<option value={NEW_CAT}>＋ دستهٔ تازه…</option></select>
      <select defaultValue="" onChange={(e) => { const a = e.target.value; e.target.value = ''; if (a) bulk({ patch: { account: a } }, (r) => `حساب ${faN(r.changed)} تراکنش عوض شد.`) }} disabled={bulkBusy} aria-label="حساب برای انتخاب‌شده‌ها"><option value="">حساب…</option><option value="بدون حساب">بدون حساب</option>{accNames.map((n) => <option key={n}>{n}</option>)}</select>
      <button type="button" className="fl-ghost" disabled={bulkBusy} onClick={() => bulk({ patch: { passThrough: true } }, (r) => `${faN(r.changed)} تراکنش عبوری شد.`)}>عبوری</button>
      <button type="button" className="fl-ghost" disabled={bulkBusy} onClick={() => bulk({ patch: { passThrough: false } }, (r) => `${faN(r.changed)} تراکنش از عبوری درآمد.`)}>غیرعبوری</button>
      <button type="button" className="fl-danger" disabled={bulkBusy} onClick={() => { if (window.confirm(`${faN(sel.size)} تراکنش حذف شود؟`)) bulk({ delete: true }, (r) => `${faN(r.deleted)} تراکنش حذف شد.`) }}>حذف</button>
      <button type="button" className="fl-ghost" onClick={() => setSel(new Set())}>لغو</button>
    </div> : null}

    <section className="fl-list" aria-label="تراکنش‌ها">
      <div className="fl-head">
        <label className="fl-chk" title="انتخاب همهٔ نمایش‌داده‌شده‌ها"><input type="checkbox" checked={allVisibleSelected} onChange={() => setSel(allVisibleSelected ? new Set() : new Set(shown.map((t) => t.id)))} aria-label="انتخاب همه" /></label>
        <span className="fl-h-title">شرح</span><span className="fl-h-cat">دسته</span><span className="fl-h-acct">حساب</span><span className="fl-h-amt">مبلغ</span>
      </div>
      {shown.length ? groups.map(([date, rows]) => {
        const ds = stats(rows), dayNet = ds.inc - ds.exp
        return <div key={date || 'all'} className="fl-day">
          {date ? <div className="fl-day-h"><b>{dayLabel(date)}</b><small>{ds.exp ? `هزینه ${fmt.short(ds.exp, false)}` : ''}{ds.exp && ds.inc ? ' · ' : ''}{ds.inc ? `درآمد ${fmt.short(ds.inc, false)}` : ''}{!ds.exp && !ds.inc ? 'عبوری/انتقال' : ''}</small>{ds.exp && ds.inc ? <small className={dayNet >= 0 ? 'pos' : 'neg'}><Signed n={dayNet} fmt={fmt} /></small> : null}</div> : null}
          {rows.map((t) => {
            const isOpen = open === t.id, misc = isMiscRow(t), pass = !!t.passThrough
            return <div key={t.id} className={`fl-item ${isOpen ? 'open' : ''} ${pass ? 'pass' : ''} ${sel.has(t.id) ? 'sel' : ''}`}>
              <div className="fl-row" role="button" tabIndex={0} onClick={(e) => { if (e.target.closest('.fl-chk,select,a,button')) return; setOpen(isOpen ? null : t.id) }} onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); setOpen(isOpen ? null : t.id) } }} aria-expanded={isOpen}>
                <label className="fl-chk"><input type="checkbox" checked={sel.has(t.id)} onChange={() => toggle(t.id)} aria-label={`انتخاب ${t.title}`} /></label>
                <div className="fl-title">
                  <b title={t.title}>{t.title}</b>
                  <small>{t.source === 'sms' ? '📩 ' : ''}{t.labeledAt ? '💬 ' : ''}{sort !== 'date' ? `${jalaliShort(t.date)} · ` : ''}{(t.tags || []).map((g) => `#${g}`).join(' ')}{t.note ? ` ${(t.tags || []).length ? '· ' : ''}${t.note}` : ''}{pass ? ' · عبوری' : ''}</small>
                </div>
                <select className={`fl-cat ${misc ? 'misc' : ''}`} value={t.category || 'متفرقه'} onChange={(e) => quickCat(t, e.target.value)} aria-label="دسته" onClick={(e) => e.stopPropagation()}>
                  {[...new Set([t.category || 'متفرقه', ...cats, 'انتقال'])].map((c) => <option key={c}>{c}</option>)}<option value={NEW_CAT}>＋ دستهٔ تازه…</option>
                </select>
                <span className="fl-acct" title={t.account}>{t.account && t.account !== 'بدون حساب' ? t.account : '—'}</span>
                <span className={`fl-amt ${pass ? 'pass' : t.kind === 'income' ? 'pos' : t.kind === 'transfer' || isTransfer(t) ? 'xfer' : 'neg'}`}>{t.kind === 'income' ? '+' : t.kind === 'expense' ? '−' : ''}{fmt.amt(t.amount)}</span>
              </div>
              {isOpen ? <Editor addCat={addCat} item={t} accounts={accounts} cats={cats} unit={fmt.unitFa} conv={fmt.conv} toRial={fmt.toRial} notify={notify} onClose={() => setOpen(null)} onSaved={(m) => { notify(m); setOpen(null); onChanged() }} /> : null}
            </div>
          })}
        </div>
      }) : (emptySlot || <p className="fl-empty">تراکنشی با این فیلترها نیست.</p>)}
      {shown.length > limit ? <button type="button" className="fl-more" onClick={() => setLimit((n) => n + 200)}>نمایش بیشتر ({faN(shown.length - limit)} مورد دیگر)</button> : null}
      <div className="fl-foot">
        <span>{faN(shown.length)} از {faN(txs.length)} تراکنش</span>
        {shownStats.exp ? <span>هزینه <b className="neg">{fmt.short(shownStats.exp)}</b></span> : null}
        {shownStats.inc ? <span>درآمد <b className="pos">{fmt.short(shownStats.inc)}</b></span> : null}
        {shownStats.exp || shownStats.inc ? <span>خالص <b className={shownStats.inc - shownStats.exp >= 0 ? 'pos' : 'neg'}><Signed n={shownStats.inc - shownStats.exp} fmt={fmt} unit /></b></span> : null}
        {shownStats.pass ? <span>عبوری {faN(shownStats.pass)} مورد</span> : null}
      </div>
    </section>
  </div>
}
