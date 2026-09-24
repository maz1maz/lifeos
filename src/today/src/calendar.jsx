import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bell, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Grid3x3, LayoutGrid, List, Plus, Search, Trash2
} from 'lucide-react'
import './calendar.css'

const api = async (url, options) => {
  const response = await fetch(url, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'دریافت اطلاعات ناموفق بود.')
  return body
}

const J_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
const G_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEK_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']
const WEEK_FULL = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']
const KIND_LABEL = { task: 'کار', reminder: 'یادآوری', google: 'Google', occasion: 'مناسبت' }
const OCCASIONS = [
  [1, 1, 'جشن نوروز', 1], [1, 2, 'عیدنوروز', 1], [1, 3, 'عیدنوروز', 1], [1, 4, 'عیدنوروز', 1],
  [1, 12, 'روز جمهوری اسلامی', 1], [1, 13, 'سیزده‌به‌در', 1], [2, 10, 'روز ملی خلیج فارس', 0],
  [3, 14, 'رحلت امام خمینی', 1], [3, 15, 'قیام ۱۵ خرداد', 1], [7, 1, 'آغاز سال تحصیلی', 0],
  [7, 20, 'روز حافظ', 0], [8, 13, 'روز دانش‌آموز', 0], [9, 16, 'روز دانشجو', 0],
  [11, 22, 'پیروزی انقلاب اسلامی', 1], [12, 29, 'ملی شدن صنعت نفت', 1], [12, 25, 'روز درختکاری', 0],
]
const occasionsFor = (jm, jd) => OCCASIONS.filter((o) => o[0] === jm && o[1] === jd).map((o) => ({ title: o[2], holiday: !!o[3] }))

const isoToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const faNum = (v) => String(v ?? '').replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])
const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fromIso = (v) => { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d) }
const isoAdd = (s, n) => iso(new Date(fromIso(s).getFullYear(), fromIso(s).getMonth(), fromIso(s).getDate() + n))
const weekdayIndex = (s) => (fromIso(s).getDay() + 1) % 7

const jdiv = (a, b) => Math.trunc(a / b)
const jmod = (a, b) => a - Math.trunc(a / b) * b
function jalCal(jy) {
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178]
  let leapJ = -14, jp = breaks[0], jump = 0, n
  for (let i = 1; i < breaks.length; i += 1) {
    const jm = breaks[i]; jump = jm - jp
    if (jy < jm) break
    leapJ += jdiv(jump, 33) * 8 + jdiv(jmod(jump, 33), 4); jp = jm
  }
  n = jy - jp
  leapJ += jdiv(n, 33) * 8 + jdiv(jmod(n, 33) + 3, 4)
  if (jmod(jump, 33) === 4 && jump - n === 4) leapJ += 1
  const gy = jy + 621, leapG = jdiv(gy, 4) - jdiv((jdiv(gy, 100) + 1) * 3, 4) - 150
  const march = 20 + leapJ - leapG
  if (jump - n < 6) n = n - jump + jdiv(jump + 4, 33) * 33
  let leap = jmod(jmod(n + 1, 33) - 1, 4)
  if (leap === -1) leap = 4
  return { leap, gy, march }
}
function g2d(gy, gm, gd) {
  let d = jdiv((gy + jdiv(gm - 8, 6) + 100100) * 1461, 4) + jdiv(153 * jmod(gm + 9, 12) + 2, 5) + gd - 34840408
  return d - jdiv(jdiv(gy + 100100 + jdiv(gm - 8, 6), 100) * 3, 4) + 752
}
function d2g(jdn) {
  let j = 4 * jdn + 139361631
  j += jdiv(jdiv(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908
  const i = jdiv(jmod(j, 1461), 4) * 5 + 308
  return { gd: jdiv(jmod(i, 153), 5) + 1, gm: jmod(jdiv(i, 153), 12) + 1, gy: jdiv(j, 1461) - 100100 + jdiv(8 - jmod(jdiv(i, 153), 12) - 1, 6) }
}
const j2d = (jy, jm, jd) => { const r = jalCal(jy); return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - jdiv(jm, 7) * (jm - 7) + jd - 1 }
function d2j(jdn) {
  const gy = d2g(jdn).gy; let jy = gy - 621, r = jalCal(jy), k = jdn - g2d(gy, 3, r.march)
  if (k >= 0) { if (k <= 185) return { jy, jm: 1 + jdiv(k, 31), jd: jmod(k, 31) + 1 }; k -= 186 }
  else { jy -= 1; k += 179; if (r.leap === 1) k += 1 }
  return { jy, jm: 7 + jdiv(k, 30), jd: jmod(k, 30) + 1 }
}
const toJ = (s) => { const d = fromIso(s); return d2j(g2d(d.getFullYear(), d.getMonth() + 1, d.getDate())) }
const jalaliToIso = (jy, jm, jd) => { const g = d2g(j2d(jy, jm, jd)); return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}` }
const monthLen = (jy, jm) => (jm <= 6 ? 31 : jm < 12 ? 30 : jalCal(jy).leap === 0 ? 30 : 29)
const jalaliLine = (s) => { const j = toJ(s); return `${WEEK_FULL[weekdayIndex(s)]} ${faNum(j.jd)} ${J_MONTHS[j.jm - 1]} ${faNum(j.jy)}` }
const gregLine = (s) => fromIso(s).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

function monthGrid(jy, jm) {
  const first = jalaliToIso(jy, jm, 1)
  const start = isoAdd(first, -weekdayIndex(first))
  return Array.from({ length: 42 }, (_, i) => isoAdd(start, i))
}
function weekDays(cursor) {
  const start = isoAdd(cursor, -weekdayIndex(cursor))
  return Array.from({ length: 7 }, (_, i) => isoAdd(start, i))
}

function eventOnDay(event, day) {
  const start = String(event.startDate || event.date || '').slice(0, 10)
  const end = String(event.endDate || start).slice(0, 10)
  if (!start) return false
  if (event.allDay) return day >= start && day < (end > start ? end : isoAdd(start, 1))
  if (event.recurrence === 'daily' && day >= start) return true
  if (event.recurrence === 'weekly' && day >= start) return weekdayIndex(day) === weekdayIndex(start)
  if (event.recurrence === 'monthly' && day >= start) return toJ(day).jd === toJ(start).jd
  return day === start || (end > start && day <= end)
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6)

export function CalendarReact({ Nav }) {
  const today = isoToday()
  const todayJ = toJ(today)
  const [mode, setMode] = useState('jalali')
  const [view, setView] = useState('month')
  const [cursor, setCursor] = useState(today)
  const [selected, setSelected] = useState(today)
  const [feed, setFeed] = useState({ items: [], connected: false })
  const [note, setNote] = useState('')
  const [noteSaved, setNoteSaved] = useState('')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({ task: true, reminder: true, google: true, occasion: true })
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [dialog, setDialog] = useState(null)
  const [toast, setToast] = useState('')
  const [notifOn, setNotifOn] = useState(false)
  const fired = useRef(new Set())

  const jcur = toJ(cursor)
  const days = useMemo(() => {
    if (mode === 'gregorian') {
      const first = new Date(fromIso(cursor).getFullYear(), fromIso(cursor).getMonth(), 1)
      const start = iso(new Date(first.getFullYear(), first.getMonth(), 1 - ((first.getDay() + 1) % 7)))
      return Array.from({ length: 42 }, (_, i) => isoAdd(start, i))
    }
    return monthGrid(jcur.jy, jcur.jm)
  }, [mode, cursor, jcur.jy, jcur.jm])

  const range = useMemo(() => {
    if (view === 'week') { const w = weekDays(cursor); return { from: w[0], to: w[6] } }
    if (view === 'day') return { from: cursor, to: cursor }
    if (view === 'agenda') return { from: cursor, to: isoAdd(cursor, 45) }
    return { from: days[0], to: days[41] }
  }, [view, cursor, days])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api(`/api/calendar/feed?from=${range.from}&to=${range.to}`)
      setFeed(data)
    } catch (e) { setStatus(e.message) }
    finally { setLoading(false) }
  }, [range.from, range.to])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    let live = true
    api(`/api/daily?date=${selected}`).then((d) => { if (live) setNote(d.item?.note || '') }).catch(() => live && setNote(''))
    return () => { live = false }
  }, [selected])

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (feed.items || []).filter((ev) => {
      const kind = ev.kind || 'google'
      if (!filters[kind]) return false
      if (q && !`${ev.title || ''} ${ev.calendarName || ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [feed.items, filters, query])

  const onDay = (day) => items.filter((ev) => eventOnDay(ev, day))
  const selectedItems = onDay(selected)
  const selJ = toJ(selected)
  const selOcc = occasionsFor(selJ.jm, selJ.jd)

  const monthStats = useMemo(() => {
    const first = jalaliToIso(jcur.jy, jcur.jm, 1)
    const last = jalaliToIso(jcur.jy, jcur.jm, monthLen(jcur.jy, jcur.jm))
    let events = 0, tasks = 0, holidays = 0
    for (const ev of items) {
      const d = String(ev.date || ev.startDate || '').slice(0, 10)
      if (d >= first && d <= last) {
        events += 1
        if (ev.kind === 'task') tasks += 1
      }
    }
    for (let d = 1; d <= monthLen(jcur.jy, jcur.jm); d += 1) {
      if (occasionsFor(jcur.jm, d).some((o) => o.holiday)) holidays += 1
    }
    return { events, tasks, holidays }
  }, [items, jcur.jy, jcur.jm])

  const yearMonths = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const jm = i + 1
    const len = monthLen(jcur.jy, jm)
    let holidays = 0
    for (let d = 1; d <= len; d += 1) {
      if (occasionsFor(jm, d).some((o) => o.holiday)) holidays += 1
    }
    return { jm, len, holidays }
  }), [jcur.jy])

  function shift(step) {
    if (view === 'year') {
      const jy = jcur.jy + step
      setCursor(jalaliToIso(jy, jcur.jm, Math.min(jcur.jd, monthLen(jy, jcur.jm))))
    } else if (view === 'month') {
      if (mode === 'gregorian') {
        const d = fromIso(cursor)
        setCursor(iso(new Date(d.getFullYear(), d.getMonth() + step, 1)))
      } else {
        let jm = jcur.jm + step, jy = jcur.jy
        if (jm < 1) { jm = 12; jy -= 1 }
        if (jm > 12) { jm = 1; jy += 1 }
        setCursor(jalaliToIso(jy, jm, Math.min(jcur.jd, monthLen(jy, jm))))
      }
    } else if (view === 'week') setCursor(isoAdd(cursor, 7 * step))
    else if (view === 'agenda') setCursor(isoAdd(cursor, 45 * step))
    else setCursor(isoAdd(cursor, step))
  }

  const gotoToday = () => { setCursor(today); setSelected(today) }

  async function saveNote() {
    try {
      await api('/api/daily', { method: 'PUT', body: JSON.stringify({ date: selected, note }) })
      setNoteSaved('ذخیره شد ✓')
      setTimeout(() => setNoteSaved(''), 2000)
    } catch (e) { setStatus(e.message) }
  }

  async function toggleItem(ev) {
    if (ev.kind === 'google') return
    try {
      const path = ev.kind === 'reminder' ? `/api/reminders/${ev.id}` : `/api/tasks/${ev.id}`
      await api(path, { method: 'PATCH', body: JSON.stringify({ done: !ev.done }) })
      load()
    } catch (e) { setStatus(e.message) }
  }

  async function saveDialog(draft) {
    if (!draft.title.trim()) { setStatus('عنوان را وارد کنید'); return }
    try {
      if (draft.kind === 'reminder') {
        const payload = { title: draft.title.trim(), date: draft.date, time: draft.time || null, whenLabel: draft.date, recurrence: draft.recurrence || null }
        if (draft.id && !String(draft.id).startsWith('new')) await api(`/api/reminders/${draft.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        else await api('/api/reminders', { method: 'POST', body: JSON.stringify(payload) })
      } else {
        const payload = { title: draft.title.trim(), date: draft.date, startTime: draft.time || null, priority: draft.priority || 'medium', notes: draft.notes || '', recurrence: draft.recurrence || null }
        if (draft.id && !String(draft.id).startsWith('new')) await api(`/api/tasks/${draft.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        else await api('/api/tasks', { method: 'POST', body: JSON.stringify(payload) })
      }
      setDialog(null)
      load()
    } catch (e) { setStatus(e.message) }
  }

  async function deleteDialog(draft) {
    if (!draft?.id || draft.kind === 'google') return
    try {
      const path = draft.kind === 'reminder' ? `/api/reminders/${draft.id}` : `/api/tasks/${draft.id}`
      await api(path, { method: 'DELETE' })
      setDialog(null)
      load()
    } catch (e) { setStatus(e.message) }
  }

  const openNew = (day = selected, time = '') => setDialog({ id: 'new', title: '', date: day, time, kind: 'task', priority: 'medium', recurrence: '', notes: '' })
  const openEdit = (ev) => {
    if (ev.kind === 'google') { if (ev.url) window.open(ev.url, '_blank', 'noreferrer'); return }
    setDialog({ id: ev.id, title: ev.title, date: String(ev.date || ev.startDate || selected).slice(0, 10), time: ev.time || ev.startTime || '', kind: ev.kind === 'reminder' ? 'reminder' : 'task', priority: ev.priority || 'medium', recurrence: ev.recurrence || '', notes: ev.notes || '' })
  }

  useEffect(() => {
    const tick = () => {
      const now = Date.now()
      for (const ev of items) {
        if (!ev.time || ev.done) continue
        const d = String(ev.date || '').slice(0, 10)
        if (d !== today) continue
        const at = new Date(`${d}T${ev.time}:00`).getTime()
        const key = `${ev.kind}-${ev.id}`
        if (at <= now && now - at < 120000 && !fired.current.has(key)) {
          fired.current.add(key)
          setToast(`${ev.title} · ${faNum(ev.time)}`)
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try { new Notification(ev.title, { body: jalaliLine(d) }) } catch { /* ignore */ }
          }
        }
      }
    }
    tick()
    const id = window.setInterval(tick, 20000)
    return () => window.clearInterval(id)
  }, [items, today])

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 8000); return () => clearTimeout(t) }, [toast])

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      if (e.key === 'Escape') { setDialog(null); return }
      if (typing) return
      if (e.key === 'n' || e.key === 'ن') { e.preventDefault(); openNew() }
      else if (e.key === 't' || e.key === 'ف') { e.preventDefault(); gotoToday() }
      else if (e.key === 'ArrowLeft') shift(1)
      else if (e.key === 'ArrowRight') shift(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const titleLine = view === 'year' ? `سال ${faNum(jcur.jy)}`
    : view === 'agenda' ? 'برنامهٔ پیش رو'
    : view === 'month' && mode === 'jalali' ? `${J_MONTHS[jcur.jm - 1]} ${faNum(jcur.jy)}`
    : view === 'month' ? fromIso(cursor).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : jalaliLine(cursor)
  const subLine = view === 'year'
    ? (() => {
        const gStart = fromIso(jalaliToIso(jcur.jy, 1, 1)).getFullYear()
        const gEnd = fromIso(jalaliToIso(jcur.jy, 12, monthLen(jcur.jy, 12))).getFullYear()
        return gStart === gEnd ? `برابر با ${gStart} میلادی` : `برابر با ${gStart}–${gEnd} میلادی`
      })()
    : view === 'month' && mode === 'jalali'
    ? `${G_MONTHS[fromIso(jalaliToIso(jcur.jy, jcur.jm, 15)).getMonth()]} ${fromIso(jalaliToIso(jcur.jy, jcur.jm, 15)).getFullYear()}`
    : view === 'agenda' ? `${faNum(45)} روز آینده · کارها، یادآوری‌ها و Google`
    : gregLine(cursor)

  const openTasks = items.filter((x) => x.kind === 'task' && !x.done).slice(0, 6)

  return (
    <div className="cal" dir="rtl">
      {Nav ? <Nav active="calendar" /> : null}
      <header className="cal-hero">
        <div className="cal-wrap">
          <div className="cal-kicker">
            <b>تقویم شمسی و میلادی با یادداشت و یادآوری</b>
            <span>N رویداد تازه · T امروز · ← → جابه‌جایی</span>
          </div>
          <h1>{titleLine}</h1>
          <p className="sub">{subLine}</p>
          <dl className="cal-stats">
            <div><dt>رویداد این بازه</dt><dd className="c1">{faNum(monthStats.events)}</dd></div>
            <div><dt>کار ثبت‌شده</dt><dd className="c2">{faNum(monthStats.tasks)}</dd></div>
            <div><dt>تعطیلات رسمی</dt><dd className="c3">{faNum(monthStats.holidays)}</dd></div>
          </dl>
        </div>
      </header>

      <div className="cal-wrap">
        <div className="cal-bar">
          <button type="button" onClick={() => shift(1)} aria-label="بعد"><ChevronLeft size={16} /></button>
          <button type="button" onClick={() => shift(-1)} aria-label="قبل"><ChevronRight size={16} /></button>
          <button type="button" className="today-btn" onClick={gotoToday}>امروز</button>
          <select value={jcur.jm} onChange={(e) => setCursor(jalaliToIso(jcur.jy, Number(e.target.value), Math.min(jcur.jd, monthLen(jcur.jy, Number(e.target.value)))))} aria-label="ماه">
            {J_MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={jcur.jy} onChange={(e) => setCursor(jalaliToIso(Number(e.target.value), jcur.jm, Math.min(jcur.jd, monthLen(Number(e.target.value), jcur.jm))))} aria-label="سال">
            {Array.from({ length: 16 }, (_, i) => 1395 + i).map((y) => <option key={y} value={y}>{faNum(y)}</option>)}
          </select>
          <div className="views">
            {[['month', 'ماه', LayoutGrid], ['week', 'هفته', CalendarDays], ['day', 'روز', Clock], ['agenda', 'برنامه', List], ['year', 'سال', Grid3x3]].map(([id, label, Icon]) => (
              <button key={id} type="button" className={view === id ? 'on' : ''} onClick={() => setView(id)}><Icon size={14} /> {label}</button>
            ))}
          </div>
          <button type="button" className={mode === 'gregorian' ? 'on' : ''} onClick={() => setMode((m) => m === 'jalali' ? 'gregorian' : 'jalali')}>
            {mode === 'jalali' ? 'نمایش میلادی' : 'نمایش شمسی'}
          </button>
          <div className="cal-search">
            <Search size={14} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جست‌وجوی رویداد، کار یا یادداشت…" />
          </div>
          {['task', 'reminder', 'google', 'occasion'].map((k) => (
            <button key={k} type="button" className={filters[k] ? 'on' : ''} onClick={() => setFilters((f) => ({ ...f, [k]: !f[k] }))}>{KIND_LABEL[k]}</button>
          ))}
          <button type="button" className={notifOn ? 'on' : ''} title="یادآوری مرورگر" onClick={() => {
            if (typeof Notification === 'undefined') return
            Notification.requestPermission().then((p) => setNotifOn(p === 'granted'))
          }}><Bell size={15} /></button>
          <button type="button" className="cal-add" onClick={() => openNew()}><Plus size={15} /> رویداد تازه</button>
        </div>

        <p className="cal-sync">
          {loading ? 'در حال دریافت رویدادها…' : feed.connected ? `Google Calendar متصل است · ${faNum(feed.googleCalendars || 0)} تقویم` : 'کارها و یادآوری‌های LifeOS'}
          {feed.partial ? ' · بخشی از رویدادهای Google نمایش داده شده‌اند' : ''}
          {feed.googleError ? ` · ${feed.googleError}` : ''}
        </p>
        {status ? <div className="notice">{status} <button type="button" onClick={() => setStatus('')}>×</button></div> : null}

        <div className="cal-body">
          <aside className="cal-rail">
            <div className="cal-rail-head">
              <h2>{faNum(selJ.jd)} {J_MONTHS[selJ.jm - 1]} {faNum(selJ.jy)}</h2>
              <p>{WEEK_FULL[weekdayIndex(selected)]}{selected === today ? ' · امروز' : ''}</p>
              <p className="g">{gregLine(selected)}</p>
              {selOcc.map((o) => <p key={o.title} className="cal-holiday">{o.holiday ? 'تعطیل · ' : ''}{o.title}</p>)}
            </div>
            <div className="cal-rail-sec">
              <h3>برنامه‌های روز <button type="button" className="ghost" onClick={() => openNew(selected)}>+ افزودن</button></h3>
              {!selectedItems.length && !selOcc.length ? <p className="cal-empty">موردی برای این روز ثبت نشده است.</p> : null}
              {filters.occasion ? selOcc.map((o) => <div key={o.title} className="cal-item" style={{ borderRightColor: '#e2574c' }}><b>{o.title}</b><small>مناسبت</small></div>) : null}
              {selectedItems.map((ev) => (
                <div key={`${ev.kind}-${ev.id}`} className={`cal-item ${ev.kind || 'google'}${ev.done ? ' done' : ''}`}>
                  {ev.kind !== 'google' ? <button type="button" className={`cal-check${ev.done ? ' on' : ''}`} onClick={() => toggleItem(ev)}>{ev.done ? <Check size={12} /> : null}</button> : null}
                  <button type="button" style={{ flex: 1, background: 'none', border: 0, color: 'inherit', textAlign: 'right', cursor: 'pointer' }} onClick={() => openEdit(ev)}>
                    <b>{ev.title}</b>
                    <small>{KIND_LABEL[ev.kind || 'google']}{ev.time ? ` · ${faNum(ev.time)}` : ' · تمام‌روز'}{ev.calendarName ? ` · ${ev.calendarName}` : ''}</small>
                  </button>
                </div>
              ))}
            </div>
            <div className="cal-rail-sec">
              <h3>کارهای باز</h3>
              {openTasks.length ? openTasks.map((t) => (
                <button type="button" key={t.id} className="cal-item task" onClick={() => openEdit(t)}><b>{t.title}</b><small>{String(t.date || '').slice(0, 10)}</small></button>
              )) : <p className="cal-empty">کار بازی در این بازه نیست.</p>}
            </div>
            <div className="cal-rail-sec">
              <h3>یادداشت این روز</h3>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="قرار، حس‌وحال یا نکته‌ای از این روز…" />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <small style={{ color: '#34d399' }}>{noteSaved}</small>
                <button type="button" className="cal-save" onClick={saveNote}>ذخیرهٔ یادداشت</button>
              </div>
            </div>
          </aside>

          <section>
            {view === 'month' ? (
              <div className="cal-board">
                <div className="cal-weekdays">{WEEK_SHORT.map((w, i) => <span key={w} className={i === 6 ? 'fri' : ''}>{w}</span>)}</div>
                <div className="cal-grid">
                  {days.map((day) => {
                    const j = toJ(day)
                    const inMonth = mode === 'jalali' ? (j.jy === jcur.jy && j.jm === jcur.jm) : fromIso(day).getMonth() === fromIso(cursor).getMonth()
                    const occ = occasionsFor(j.jm, j.jd)
                    const evs = onDay(day)
                    const hol = occ.some((o) => o.holiday)
                    return (
                      <button
                        type="button"
                        key={day}
                        className={`cal-day${inMonth ? '' : ' out'}${day === today ? ' today' : ''}${day === selected ? ' sel' : ''}${hol ? ' hol' : ''}`}
                        onClick={() => setSelected(day)}
                        onDoubleClick={() => openNew(day)}
                      >
                        <span className="n">
                          {mode === 'jalali' ? faNum(j.jd) : faNum(fromIso(day).getDate())}
                          <em>{mode === 'jalali' ? `${fromIso(day).getMonth() + 1}/${fromIso(day).getDate()}` : `${j.jm}/${j.jd}`}</em>
                        </span>
                        {filters.occasion && occ[0] ? <span className="cal-chip occasion">{occ[0].title}</span> : null}
                        {evs.slice(0, 3).map((ev) => <span key={`${ev.kind}-${ev.id}`} className={`cal-chip ${ev.kind || 'google'}`}>{ev.time ? `${ev.time} ` : ''}{ev.title}</span>)}
                        {evs.length > 3 ? <span className="cal-chip">+{faNum(evs.length - 3)}</span> : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {view === 'year' ? (
              <div className="cal-board cal-year">
                <div className="cal-year-grid">
                  {yearMonths.map(({ jm, len, holidays }) => {
                    const isCurrent = jm === todayJ.jm && jcur.jy === todayJ.jy
                    const isCursor = jm === jcur.jm
                    return (
                      <button
                        type="button"
                        key={jm}
                        className={`cal-year-card${isCurrent ? ' today' : ''}${isCursor ? ' sel' : ''}`}
                        onClick={() => { setCursor(jalaliToIso(jcur.jy, jm, 1)); setView('month') }}
                      >
                        <b>{J_MONTHS[jm - 1]}</b>
                        <span className="cal-year-meta">{faNum(len)} روز{holidays ? ` · ${faNum(holidays)} تعطیل` : ''}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {view === 'week' || view === 'day' ? (
              <div className="cal-board cal-time">
                {(() => {
                  const cols = view === 'day' ? [cursor] : weekDays(cursor)
                  const template = `52px repeat(${cols.length}, minmax(0,1fr))`
                  return (
                    <>
                      <div className="cal-time-head" style={{ gridTemplateColumns: template }}>
                        <div />
                        {cols.map((day) => {
                          const j = toJ(day)
                          const occ = occasionsFor(j.jm, j.jd)
                          return (
                            <div key={day} onClick={() => setSelected(day)} style={{ cursor: 'pointer', background: day === today ? 'rgba(216,166,87,0.08)' : undefined }}>
                              <div style={{ fontSize: 11, color: '#8ca0c4' }}>{WEEK_FULL[weekdayIndex(day)]}</div>
                              <b style={{ color: occ.some((o) => o.holiday) ? '#e2574c' : undefined }}>{faNum(j.jd)}</b>
                              {occ[0] ? <div className="cal-holiday">{occ[0].title}</div> : null}
                            </div>
                          )
                        })}
                      </div>
                      {HOURS.map((h) => (
                        <div key={h} className="cal-time-row" style={{ gridTemplateColumns: template }}>
                          <div className="cal-hour">{faNum(pad(h))}:۰۰</div>
                          {cols.map((day) => {
                            const hourItems = onDay(day).filter((ev) => Number(String(ev.time || '99').slice(0, 2)) === h)
                            return (
                              <div key={day} className="cal-slot" onDoubleClick={() => openNew(day, `${pad(h)}:00`)}>
                                {hourItems.map((ev) => (
                                  <button type="button" key={`${ev.kind}-${ev.id}`} className={`cal-chip ${ev.kind || 'google'}`} onClick={() => openEdit(ev)}>{ev.title}</button>
                                ))}
                              </div>
                            )
                          })}
                        </div>
                      ))}
                    </>
                  )
                })()}
              </div>
            ) : null}

            {view === 'agenda' ? (
              <div className="cal-agenda">
                {(() => {
                  const daysList = []
                  for (let i = 0; i <= 45; i += 1) {
                    const day = isoAdd(cursor, i)
                    const evs = onDay(day)
                    const occ = occasionsFor(toJ(day).jm, toJ(day).jd)
                    if (evs.length || (filters.occasion && occ.length)) daysList.push({ day, evs, occ })
                  }
                  if (!daysList.length) return <p className="cal-empty" style={{ padding: 28, textAlign: 'center' }}>در این بازه چیزی ثبت نشده است.</p>
                  return daysList.map(({ day, evs, occ }) => {
                    const j = toJ(day)
                    return (
                      <article key={day} className="cal-agenda-day">
                        <button type="button" onClick={() => { setSelected(day); setView('day'); setCursor(day) }}>
                          <b>{faNum(j.jd)} {J_MONTHS[j.jm - 1]}</b>
                          <div style={{ color: '#8ca0c4', fontSize: 12 }}>{WEEK_FULL[weekdayIndex(day)]}</div>
                          {occ[0] ? <div className="cal-holiday">{occ[0].title}</div> : null}
                        </button>
                        <ul>
                          {occ.map((o) => <li key={o.title} className="cal-chip occasion" style={{ marginBottom: 4 }}>{o.title}</li>)}
                          {evs.map((ev) => (
                            <li key={`${ev.kind}-${ev.id}`}>
                              <button type="button" className={`cal-item ${ev.kind || 'google'}`} onClick={() => openEdit(ev)}>
                                <b>{ev.title}</b>
                                <small>{KIND_LABEL[ev.kind || 'google']}{ev.time ? ` · ${faNum(ev.time)}` : ''}</small>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </article>
                    )
                  })
                })()}
              </div>
            ) : null}

            <div className="cal-legend">
              <span><i style={{ background: '#37c9c0' }} />کار</span>
              <span><i style={{ background: '#d8a657' }} />یادآوری</span>
              <span><i style={{ background: '#5d9cff' }} />Google</span>
              <span><i style={{ background: '#e2574c' }} />مناسبت / تعطیل</span>
              <span style={{ marginRight: 'auto' }}>دوبار روی روز بزنید تا رویداد تازه‌ای ساخته شود</span>
            </div>
          </section>
        </div>
      </div>

      {dialog ? (
        <div className="cal-modal" onClick={() => setDialog(null)}>
          <div className="cal-modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>
              {dialog.id === 'new' ? 'رویداد تازه' : 'ویرایش'}
              <button type="button" className="ghost" onClick={() => setDialog(null)}>✕</button>
            </h3>
            <p style={{ margin: '0 0 10px', color: '#8ca0c4', fontSize: 12 }}>{jalaliLine(dialog.date)} · {gregLine(dialog.date)}</p>
            <div className="cal-types">
              <button type="button" className={dialog.kind === 'task' ? 'on' : ''} onClick={() => setDialog({ ...dialog, kind: 'task' })}>کار</button>
              <button type="button" className={dialog.kind === 'reminder' ? 'on' : ''} onClick={() => setDialog({ ...dialog, kind: 'reminder' })}>یادآوری</button>
            </div>
            <label>عنوان</label>
            <input value={dialog.title} onChange={(e) => setDialog({ ...dialog, title: e.target.value })} autoFocus />
            <label>ساعت (خالی = تمام‌روز)</label>
            <input type="time" value={dialog.time || ''} onChange={(e) => setDialog({ ...dialog, time: e.target.value })} />
            <label>اولویت</label>
            <select value={dialog.priority} onChange={(e) => setDialog({ ...dialog, priority: e.target.value })}>
              <option value="low">کم</option>
              <option value="medium">متوسط</option>
              <option value="high">زیاد</option>
            </select>
            <label>تکرار</label>
            <select value={dialog.recurrence || ''} onChange={(e) => setDialog({ ...dialog, recurrence: e.target.value })}>
              <option value="">بدون تکرار</option>
              <option value="daily">هر روز</option>
              <option value="weekly">هفتگی</option>
              <option value="monthly">ماهانه</option>
            </select>
            <label>یادداشت</label>
            <textarea value={dialog.notes || ''} onChange={(e) => setDialog({ ...dialog, notes: e.target.value })} />
            <div className="cal-modal-ops">
              {dialog.id !== 'new' ? <button type="button" className="ghost" onClick={() => deleteDialog(dialog)}><Trash2 size={14} /> حذف</button> : null}
              <button type="button" className="primary" onClick={() => saveDialog(dialog)}>ذخیره در LifeOS</button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <div className="cal-toast"><b>یادآوری</b><p style={{ margin: '6px 0 0' }}>{toast}</p></div> : null}
    </div>
  )
}
