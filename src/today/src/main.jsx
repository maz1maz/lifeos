import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './today.css';
import './calendar.css';
import './planner.css';
import { NotesReact } from './notes';
import { ContactsReact } from './contacts';
import { DocumentsReact } from './documents';
import { PlannerReact, TaskDrawer, createPlannerItem } from './planner';
import { MediaReact } from './media';
import { MarketReact } from './market';
import { CalendarReact } from './calendar';
import { FootballReact } from './football';
import { FinanceReact } from './finance';
import { photoOfDay } from './season-photos.mjs';
import './home.css';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './vibefarsi-table';
import {
  House, CalendarDays, ListChecks, Wallet, LineChart, Trophy, Clapperboard, Film,
  Music, StickyNote, FolderOpen, Users, Settings, Bell, CheckSquare2, MapPin, Sparkles,
  Search, Star, X, Check, ChevronDown, ChevronLeft, ChevronRight, Trash2, Plus, Menu,
  Pencil, Repeat, CircleAlert, Hash, Clock, Sun, CircleDot, Flame, Compass
} from 'lucide-react';

const api = async (url, options) => {
  const response = await fetch(url, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'دریافت اطلاعات ناموفق بود.');
  return body;
};
const isoToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const fa = value => Number(value || 0).toLocaleString('fa-IR');
const faDigits = value => String(value ?? '').replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const jalali = date => new Intl.DateTimeFormat('fa-IR', { dateStyle: 'full', timeZone: 'Asia/Tehran' }).format(date);
const TGJU_LABELS = {
  price_dollar_rl: 'دلار آزاد', price_eur: 'یورو', price_gbp: 'پوند', price_aed: 'درهم', price_try: 'لیر',
  geram18: 'گرم ۱۸ عیار', geram24: 'گرم ۲۴ عیار', sekee: 'سکه امامی', sekeb: 'سکه بهار آزادی',
  rob: 'ربع سکه', nim: 'نیم سکه', mesghal: 'مثقال', oil_brent: 'نفت برنت', oil: 'نفت',
  nickel: 'نیکل', platinum: 'پلاتین', copper: 'مس', silver: 'نقره'
};
const TGJU_ICONS = {
  price_dollar_rl: '💵', price_eur: '💶', price_gbp: '💷', price_aed: '💴', price_try: '💴',
  geram18: '🟡', geram24: '🟡', sekee: '🪙', sekeb: '🪙', rob: '🪙', nim: '🪙', mesghal: '🟡',
  oil_brent: '🛢️', oil: '🛢️', nickel: '⚙️', platinum: '⚪', copper: '🟠', silver: '⚪'
};
const marketIcon = key => TGJU_ICONS[key] || (/^BTC/i.test(key) ? '₿' : /^ETH/i.test(key) ? 'Ξ' : '📈');
// /api/tgju آبجکتیه با کلیدهای کدی (مثل price_dollar_rl) — این تابع هم آرایه‌ی
// خام هم آبجکت رو به یه شکل یکسان با اسم فارسی خوانا تبدیل می‌کنه.
function tgjuRows(data) {
  const raw = data.items || data.data || data || {};
  const entries = Array.isArray(raw) ? raw.map((v, i) => [v.key || v.title || v.name || i, v]) : Object.entries(raw);
  return entries.map(([key, value]) => ({
    key,
    name: TGJU_LABELS[key] || value.title || value.name || key,
    p: value.p ?? value.price ?? value.value ?? 0,
    dp: value.dp != null ? Number(value.dp) : null,
    change: String(value.change ?? value.percent ?? '')
  }));
}
const nextDays = (date, count) => [...Array(count)].map((_, i) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + i));

function Card({ title, icon: Icon, action, className = '', children }) { return <section className={`card ${className}`}><header>{Icon && <span className="card-icon"><Icon size={16} strokeWidth={2.2} /></span>}<h2>{title}</h2>{action}</header>{children}</section>; }
function TeamBadge({ logo, name }) { return logo ? <img className="team-logo" src={logo} alt="" loading="lazy" onError={e => { e.target.style.display = 'none'; }} /> : <span className="team-logo team-logo-fallback">{(name || '?').trim().charAt(0)}</span>; }
function Sparkline({ data, up, width = 72, height = 28, uid = 'sp', color: forced }) {
  if (!data || data.length < 2) return <svg width={width} height={height} />;
  const max = Math.max(...data), min = Math.min(...data), span = max - min || 1;
  const coords = data.map((v, i) => [(i / (data.length - 1)) * width, height - ((v - min) / span) * (height - 4) - 2]);
  const line = coords.map(([x, y]) => `${x},${y}`).join(' ');
  const area = `0,${height} ${line} ${width},${height}`;
  const color = forced || (up ? '#34d399' : '#fb7185'), gid = `fill-${uid}-${up ? 'u' : 'd'}`;
  return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={up ? 'spark-up' : 'spark-down'} preserveAspectRatio="none">
    <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.35" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
    <polygon points={area} fill={`url(#${gid})`} />
    <polyline points={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
  </svg>;
}

const NAV_GROUPS = [
  ['روزانه', [['', 'امروز', House], ['calendar', 'تقویم', CalendarDays], ['planner', 'برنامه‌ریز', ListChecks]]],
  ['مالی', [['finance', 'مالی', Wallet], ['market', 'بازار', LineChart]]],
  ['سرگرمی', [['football', 'فوتبال', Trophy], ['series', 'سریال‌ها', Clapperboard], ['movies', 'فیلم‌ها', Film], ['media', 'رسانه', Music]]],
  ['آرشیو', [['notes', 'یادداشت‌ها', StickyNote], ['documents', 'مدارک', FolderOpen], ['contacts', 'مخاطبین', Users]]]
];
const NAV_PAGES = [...NAV_GROUPS.flatMap(([, items]) => items), ['settings', 'تنظیمات', Settings]];
function TopNav({ active, right }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.classList.toggle('nav-lock', open);
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.classList.remove('nav-lock'); window.removeEventListener('keydown', onKey); };
  }, [open]);
  const current = NAV_PAGES.find(([page]) => page === (active || '')) || NAV_PAGES[0];
  const link = ([page, label, Icon]) => <a className={page === (active || '') ? 'active' : ''} href={page ? `/?page=${page}` : '/'} key={page || 'home'} onClick={() => setOpen(false)}><Icon size={17} strokeWidth={2.1} /><span>{label}</span></a>;
  return (
    <nav className={`topbar${open ? ' menu-open' : ''}`}>
      <button type="button" className="nav-toggle" aria-label={open ? 'بستن منو' : 'بازکردن منو'} aria-expanded={open} onClick={() => setOpen(v => !v)}>
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      <a className="brand" href="/"><Sparkles size={20} /><span>LifeOS</span></a>
      <span className="nav-current">{current[1]}</span>
      <span className="nav-spacer" />
      {right}
      {open ? <button type="button" className="nav-scrim" aria-label="بستن منو" onClick={() => setOpen(false)} /> : null}
      <aside className={`drawer${open ? ' open' : ''}`} aria-hidden={!open}>
        <div className="drawer-head"><Sparkles size={18} /><b>LifeOS</b></div>
        {NAV_GROUPS.map(([title, items]) => <div className="drawer-group" key={title}><small>{title}</small>{items.map(link)}</div>)}
        <div className="drawer-foot">{link(['settings', 'تنظیمات', Settings])}</div>
      </aside>
    </nav>
  );
}

function App() {
  const today = useMemo(isoToday, []);
  const [data, setData] = useState({ tasks: [], reminders: [], transactions: [], daily: null, user: null, watchingSeries: [] });
  const [weather, setWeather] = useState(null);
  const [quick, setQuick] = useState({ type: 'task', title: '', amount: '', when: 'today', date: '', time: '' });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [drawerKind, setDrawerKind] = useState(null);
  const [editName, setEditName] = useState(null);
  const [notice, setNotice] = useState('');
  const [streak, setStreak] = useState(0);
  const [aqi, setAqi] = useState(null);
  const [feed, setFeed] = useState([]);
  const [scheduleNote, setScheduleNote] = useState('');

  const load = async () => {
    try {
      const [me, dashboard, tasks, reminders] = await Promise.all([
        api('/api/me'), api(`/api/dashboard?date=${today}`), api('/api/tasks'), api(`/api/reminders?from=${today}&to=${today}`)
      ]);
      setData({ ...dashboard, tasks: tasks.items || [], reminders: reminders.items || [], user: me.user || null });
    } catch (error) { setNotice(error.message); }
  };
  useEffect(() => { load(); }, []);
  const loadStreak = () => {
    const from = new Date(); from.setDate(from.getDate() - 60);
    api(`/api/daily?from=${from.toISOString().slice(0, 10)}&to=${today}`).then(d => {
      const dates = new Set((d.items || []).map(x => x.date));
      let n = 0, cur = new Date(today + 'T12:00:00');
      while (dates.has(cur.toISOString().slice(0, 10))) { n++; cur.setDate(cur.getDate() - 1); }
      setStreak(n);
    }).catch(() => {});
  };
  useEffect(loadStreak, [today]);
  useEffect(() => {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=35.69&longitude=51.39&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day,uv_index&hourly=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,uv_index_max,precipitation_probability_max&forecast_days=6&timezone=Asia%2FTehran')
      .then(r => r.json()).then(w => { if (w?.current) setWeather(w); }).catch(() => {});
    fetch('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=35.69&longitude=51.39&current=us_aqi,pm2_5&timezone=Asia%2FTehran')
      .then(r => r.json()).then(a => { if (a?.current) setAqi(a.current); }).catch(() => {});
    api(`/api/calendar/feed?from=${today}&to=${today}`).then(d => { setFeed(d.items || []); if (d.googleError) setScheduleNote(d.googleError); }).catch(() => {});
  }, []);
  const toggleTask = async task => { await api(`/api/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ done: !task.done }) }); load(); };
  const toggleReminder = async reminder => { await api(`/api/reminders/${reminder.id}`, { method: 'PATCH', body: JSON.stringify({ done: !reminder.done }) }); load(); };
  const quickDate = () => quick.when === 'tomorrow' ? addDaysIso(today, 1) : quick.when === 'pick' && quick.date ? quick.date : today;
  const submitQuick = async event => {
    event.preventDefault(); if (!quick.title.trim()) return;
    let title = quick.title.trim(), date = quickDate();
    const m = title.match(/^(پس[\s\u200c]?فردا|فردا|امروز)[\s،,:]+(.+)$/);
    if (m) { date = m[1] === 'امروز' ? today : addDaysIso(today, m[1] === 'فردا' ? 1 : 2); title = m[2].trim(); }
    const time = quick.time || null;
    const payload = quick.type === 'transaction'
      ? { title, amount: Number(String(quick.amount).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[^\d]/g, '')), kind: 'expense', category: 'متفرقه', account: 'بدون حساب', date }
      : quick.type === 'reminder' ? { title, date, time, whenLabel: date } : { title, date, startTime: time, priority: 'medium' };
    const endpoint = quick.type === 'transaction' ? '/api/transactions' : quick.type === 'reminder' ? '/api/reminders' : '/api/tasks';
    try {
      await api(endpoint, { method: 'POST', body: JSON.stringify(payload) });
      setQuick(q => ({ ...q, title: '', amount: '', time: '' }));
      setNotice(date === today ? 'با موفقیت ثبت شد.' : `برای ${jalaliDayLabel(date)} ثبت شد.`); load();
    } catch (error) { setNotice(error.message); }
  };
  const saveName = async e => { e.preventDefault(); const displayName = (editName || '').trim(); try { await api('/api/me', { method: 'PATCH', body: JSON.stringify({ displayName }) }); setData(d => ({ ...d, user: { ...d.user, displayName } })); setEditName(null); } catch (error) { setNotice(error.message); } };
  const saveDrawer = async body => { try { await createPlannerItem(drawerKind, body); setDrawerKind(null); setNotice('ثبت شد ✓'); load(); } catch (error) { setNotice(error.message); } };
  const saveDaily = async event => { event.preventDefault(); const form = new FormData(event.currentTarget); try { await api('/api/daily', { method: 'PUT', body: JSON.stringify({ date: today, mood: Number(form.get('mood')), sleep: form.get('sleep'), note: form.get('note'), bestMoment: form.get('bestMoment'), gratitude: form.get('gratitude'), tomorrowPlan: form.get('tomorrowPlan') }) }); setNotice('ثبت روزانه ذخیره شد.'); loadStreak(); load(); } catch (error) { setNotice(error.message); } };
  const allTasks = data.tasks.filter(t => !t.isReminder);
  const tasks = allTasks
    .filter(t => t.date === today || (!t.done && ((t.date && t.date < today) || (t.deadline && t.deadline <= today))))
    .sort((a, b) => (a.done - b.done) || String(a.date).localeCompare(String(b.date)) || String(a.startTime || '').localeCompare(String(b.startTime || '')));
  const overdueTasks = allTasks.filter(t => !t.done && t.deadline && t.deadline < today);
  const tomorrowIso = useMemo(() => { const d = new Date(today + 'T12:00:00'); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }, [today]);
  const dueTomorrowTasks = allTasks.filter(t => !t.done && t.deadline === tomorrowIso);
  const todaySpend = data.transactions.filter(t => t.kind === 'expense').reduce((n, t) => n + (Number(t.amount) || 0), 0);
  const done = tasks.filter(t => t.done).length;
  const nowHm = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tehran' }).format(new Date());
  const agenda = [
    ...tasks.map(t => ({ kind: 'task', id: t.id, title: t.title, done: !!t.done, time: t.startTime || '', date: (t.deadline && t.deadline < (t.date || today)) ? t.deadline : (t.date || today), raw: t })),
    ...data.reminders.map(r => ({ kind: 'reminder', id: r.id, title: r.title, done: !!r.done, time: r.time || '', date: r.date || today, raw: r }))
  ].map(x => ({ ...x, late: !x.done && x.date < today }))
    .sort((a, b) => (a.done - b.done) || (b.late - a.late) || String(a.time || '99').localeCompare(String(b.time || '99')) || String(a.date).localeCompare(String(b.date)));
  const lateLabel = date => { const days = Math.round((fromIso(today) - fromIso(date)) / 86400000); return days === 1 ? 'دیروز' : `${fa(days)} روز عقب`; };
  const schedule = feed.filter(ev => eventOnDate(ev, fromIso(today)) && (ev.source !== 'lifeos' || ev.time)).sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
  void scheduleNote;
  const weatherIcon = code => code === 0 ? '☀️' : code < 4 ? '⛅' : code < 70 ? '☁️' : '🌧️';
  const page = new URLSearchParams(location.search).get('page');
  if (page === 'calendar') return <CalendarReact Nav={TopNav} />;
  if (page === 'planner') return <PlannerReact Nav={TopNav} />;
  if (page === 'finance') return <FinanceReact Nav={TopNav} />;
  if (page === 'market') return <MarketReact Nav={TopNav} />;
  if (page === 'football') return <FootballReact Nav={TopNav} />;
  if (page === 'movies') return <MoviesReact />;
  if (page === 'series') return <SeriesReact />;
  if (page === 'media' || page === 'music' || page === 'youtube') return <MediaReact Nav={TopNav} initialTab={page === 'youtube' ? 'youtube' : page === 'music' ? 'spotify' : 'desk'} />;
  if (page === 'notes') return <NotesReact Nav={TopNav} />;
  if (page === 'documents') return <DocumentsReact Nav={TopNav} />;
  if (page === 'contacts') return <ContactsReact Nav={TopNav} />;
  if (page === 'settings') return <SettingsReact />;
  const nowHour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Tehran' }).format(new Date()));
  const greeting = nowHour < 5 ? 'شب بخیر' : nowHour < 12 ? 'صبح بخیر' : nowHour < 16 ? 'ظهر بخیر' : nowHour < 19 ? 'عصر بخیر' : 'شب بخیر';
  const firstName = (data.user?.displayName || '').trim() || (data.user?.name || '').trim().split(/\s+/)[0];
  const todayJ = toJalali(fromIso(today));
  const openCount = agenda.filter(x => !x.done).length;
  const nextEvent = schedule.find(x => x.time && x.time >= nowHm);
  const summary = [
    agenda.length ? `امروز ${fa(agenda.length)} کار و یادآوری داری و ${fa(agenda.length - openCount)} تا رو انجام دادی.` : 'برای امروز هنوز کاری ثبت نکردی.',
    overdueTasks.length ? `${fa(overdueTasks.length)} کار عقب‌افتاده منتظرته.` : '',
    nextEvent ? `برنامهٔ بعدی: ${nextEvent.title}، ساعت ${faDigits(nextEvent.time)}.` : ''
  ].filter(Boolean).join(' ');
  return <main>
    <TopNav active="" right={<div className="profile"><button aria-label="تغییر حالت روشن و تاریک" onClick={() => { const next = document.documentElement.dataset.mode === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.mode = next; localStorage.setItem('lifeos-mode', next); }}>◐</button><b>{data.user?.displayName || data.user?.name || 'سلام'}</b></div>} />
    <div className="page home">
      <section className="hero">
        <div className="hero-text">
          <div className="hero-chips">
            <span className="chip gold"><CalendarDays size={14} />{new Intl.DateTimeFormat('fa-IR', { weekday: 'long' }).format(fromIso(today))} {faDigits(todayJ.jd)} {JALALI_MONTHS[todayJ.jm - 1]} {faDigits(todayJ.jy)}</span>
            <span className="chip" dir="ltr">{new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(fromIso(today))}</span>
            {streak > 0 && <span className="chip"><Flame size={14} />{fa(streak)} روز پیوسته</span>}
          </div>
          {editName !== null
            ? <form className="name-edit" onSubmit={saveName}><h1>{greeting}،</h1><input autoFocus value={editName} onChange={e => setEditName(e.target.value)} placeholder="اسمت به فارسی" maxLength={40} /><button className="save">ذخیره</button><button type="button" className="outline" onClick={() => setEditName(null)}>انصراف</button></form>
            : <h1>{greeting}{firstName ? `، ${firstName}` : ''}<button type="button" className="name-btn" aria-label="تغییر اسم" title="تغییر اسم" onClick={() => setEditName(data.user?.displayName || '')}><Pencil size={16} /></button></h1>}
          <p>{summary}</p>
        </div>
        <form className="quick" onSubmit={submitQuick}>
          <button type="submit" className="save">＋ ثبت</button>
          <input className="quick-title" value={quick.title} onChange={e => setQuick({ ...quick, title: e.target.value })} placeholder={quick.type === 'transaction' ? 'برای چی خرج کردی؟' : quick.type === 'reminder' ? 'چی رو یادت بندازم؟ (مثلاً: فردا تماس با علی)' : 'چه کاری باید انجام بدی؟ (مثلاً: فردا خرید نان)'} />
          {quick.type === 'transaction' && <input className="amount" value={quick.amount} onChange={e => setQuick({ ...quick, amount: e.target.value })} inputMode="numeric" placeholder="مبلغ ریال" />}
          {quick.type !== 'transaction' && <input className="quick-time" type="time" value={quick.time} onChange={e => setQuick({ ...quick, time: e.target.value })} title="ساعت (اختیاری)" aria-label="ساعت" />}
          <div className="quick-when">
            {[['today', 'امروز'], ['tomorrow', 'فردا']].map(([w, label]) => <button type="button" key={w} className={quick.when === w ? 'selected' : ''} onClick={() => { setQuick({ ...quick, when: w }); setPickerOpen(false); }}>{label}</button>)}
            <button type="button" className={quick.when === 'pick' ? 'selected' : ''} onClick={() => setPickerOpen(o => !o)}><CalendarDays size={14} />{quick.when === 'pick' && quick.date ? jalaliDayLabel(quick.date) : 'تقویم'}</button>
            {pickerOpen && <JalaliPicker value={quick.date || today} today={today} onPick={d => { setQuick({ ...quick, when: 'pick', date: d }); setPickerOpen(false); }} onClose={() => setPickerOpen(false)} />}
          </div>
          <div className="quick-tabs">{[['task','کار',CheckSquare2],['reminder','یادآوری',Bell],['transaction','هزینه',Wallet]].map(([type, label, Icon]) => <button type="button" className={quick.type === type ? 'selected' : ''} onClick={() => setQuick({ ...quick, type })} key={type}><Icon size={14} />{label}</button>)}</div>
        </form>
      </section>
      {notice && <div className="notice">{notice}<button onClick={() => setNotice('')}>×</button></div>}
      <div className="grid home-top">
        <DayCard today={today} />
        <WeatherCard weather={weather} aqi={aqi} />
        <LiveCalendar today={today} />
      </div>
      <div className="grid home-grid">
        <Card className="agenda" icon={CheckSquare2} title="کارها و یادآوری‌ها" action={<span className="muted">{fa(agenda.length - openCount)} از {fa(agenda.length)}</span>}>
          <div className="progress"><i style={{ width: `${agenda.length ? (agenda.length - openCount) / agenda.length * 100 : 0}%` }} /></div>
          <div className="list">{agenda.slice(0, 12).map(item => {
            const late = !item.done && item.late;
            return <button className={`line ${item.done ? 'done' : ''} ${late ? 'overdue' : ''} ${item.kind}`} key={item.kind + item.id} onClick={() => item.kind === 'task' ? toggleTask(item.raw) : toggleReminder(item.raw)}>
              <i>{item.done ? '✓' : ''}</i>
              <span>{item.kind === 'reminder' && <Bell size={13} className="kind-icon" />}{item.title}</span>
              <small>{late ? `⛔ ${lateLabel(item.date)}` : item.time ? faDigits(item.time) : 'امروز'}</small>
            </button>;
          })}{!agenda.length && <p className="empty">امروز خلوته. با دکمه‌های پایین یه کار یا یادآوری اضافه کن.</p>}</div>
          {agenda.length > 12 && <a className="more" href="/?page=planner">{fa(agenda.length - 12)} مورد دیگر ←</a>}
          <div className="agenda-add"><button className="outline" onClick={() => setDrawerKind('task')}>＋ کار</button><button className="outline" onClick={() => setDrawerKind('reminder')}>＋ یادآوری</button></div>
        </Card>
        <Market />
        <Football />
        <FinanceMini todaySpend={todaySpend} />
        <Card title="ثبت روزانه" icon={StickyNote} className="daily" action={streak > 0 ? <span className="muted"><Flame size={14} style={{ verticalAlign: 'middle' }} /> {fa(streak)} روز</span> : null}><form onSubmit={saveDaily} key={data.daily ? `d-${data.daily.id || data.daily.date}` : 'empty'}><label>امروزت چطور بود؟ <input name="mood" type="range" min="1" max="10" defaultValue={data.daily?.mood || 7} /></label><div className="form-row"><input name="sleep" defaultValue={data.daily?.sleep || ''} placeholder="خواب (ساعت)" /><input name="note" defaultValue={data.daily?.note || ''} placeholder="یک جمله از امروز" /></div><div className="form-row"><input name="bestMoment" defaultValue={data.daily?.bestMoment || ''} placeholder="🌟 بهترین لحظهٔ امروز" /><input name="gratitude" defaultValue={data.daily?.gratitude || ''} placeholder="🙏 بابت چی شکرگزاری؟" /></div><input name="tomorrowPlan" defaultValue={data.daily?.tomorrowPlan || ''} placeholder="برنامهٔ فردا" /><button className="save">ذخیرهٔ روز</button></form></Card>
        <Card title="سریال‌های من" icon={Clapperboard} className="series" action={<a href="/?page=series">ادامه تماشا ←</a>}>{data.watchingSeries?.length ? <div className="series-list">{data.watchingSeries.slice(0, 6).map(item => { const denom = item.airedInSeason || item.totalEpisodes || 0, progress = denom ? Math.min(100, Math.round((item.currentEpisode || 0) / denom * 100)) : 0; return <div className="series-item" key={item.id}><div className="series-poster">{item.posterUrl ? <img src={item.posterUrl} alt={item.title} loading="lazy" onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'grid'; }} /> : null}<span className="series-fallback" style={{ display: item.posterUrl ? 'none' : 'grid' }}>🎬</span>{progress > 0 && <div className="series-progress"><i style={{ width: `${progress}%` }} /></div>}</div><b>{item.title}</b><small>{item.currentSeason ? `فصل ${fa(item.currentSeason)} · ` : ''}قسمت {fa(item.currentEpisode || 0)}</small></div>; })}</div> : <p className="empty">سریالی در حال تماشا نیست.</p>}</Card>
      </div>
    </div>
    <TaskDrawer open={!!drawerKind} kind={drawerKind || 'task'} initial={null} onClose={() => setDrawerKind(null)} onSubmit={saveDrawer} />
  </main>;
}
function Calendar() {
  const now = new Date(), j = toJalali(now), first = toGregorian(j.jy, j.jm, 1), len = jalaliMonthLength(j.jy, j.jm);
  const days = [...Array(len)].map((_, i) => addDays(first, i));
  return <Card className="calendar" icon={CalendarDays} title={`${JALALI_MONTHS[j.jm - 1]} ${faDigits(j.jy)}`} action={<a href="/?page=calendar">امروز</a>}><div className="weekdays">{WEEKDAYS.map(x => <span key={x}>{x}</span>)}</div><div className="calendar-days">{[...Array(weekdayIndex(first))].map((_, i) => <span key={`blank${i}`} />)}{days.map((day, i) => <b className={sameDate(day, now) ? 'today' : weekdayIndex(day) === 6 ? 'holiday' : ''} key={i}>{faDigits(i + 1)}</b>)}</div></Card>;
}
const JALALI_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const fromIso = value => { const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day); };
const jdiv = (a, b) => Math.trunc(a / b);
const jmod = (a, b) => a - Math.trunc(a / b) * b;
function jalCal(jy) { const breaks = [-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178]; let leapJ = -14, jp = breaks[0], jump, jm, n; for (let i = 1; i < breaks.length; i += 1) { jm = breaks[i]; jump = jm - jp; if (jy < jm) break; leapJ += jdiv(jump, 33) * 8 + jdiv(jmod(jump, 33), 4); jp = jm; } n = jy - jp; leapJ += jdiv(n, 33) * 8 + jdiv(jmod(n, 33) + 3, 4); if (jmod(jump, 33) === 4 && jump - n === 4) leapJ += 1; const gy = jy + 621, leapG = jdiv(gy, 4) - jdiv((jdiv(gy, 100) + 1) * 3, 4) - 150; const march = 20 + leapJ - leapG; if (jump - n < 6) n = n - jump + jdiv(jump + 4, 33) * 33; let leap = jmod(jmod(n + 1, 33) - 1, 4); if (leap === -1) leap = 4; return { leap, gy, march }; }
function g2d(gy, gm, gd) { let d = jdiv((gy + jdiv(gm - 8, 6) + 100100) * 1461, 4) + jdiv(153 * jmod(gm + 9, 12) + 2, 5) + gd - 34840408; return d - jdiv(jdiv(gy + 100100 + jdiv(gm - 8, 6), 100) * 3, 4) + 752; }
function d2g(jdn) { let j = 4 * jdn + 139361631; j += jdiv(jdiv(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908; const i = jdiv(jmod(j, 1461), 4) * 5 + 308; return { gd: jdiv(jmod(i, 153), 5) + 1, gm: jmod(jdiv(i, 153), 12) + 1, gy: jdiv(j, 1461) - 100100 + jdiv(8 - jmod(jdiv(i, 153), 12) - 1, 6) }; }
const j2d = (jy, jm, jd) => { const r = jalCal(jy); return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - jdiv(jm, 7) * (jm - 7) + jd - 1; };
function d2j(jdn) { const gy = d2g(jdn).gy; let jy = gy - 621, r = jalCal(jy), k = jdn - g2d(gy, 3, r.march); if (k >= 0) { if (k <= 185) return { jy, jm: 1 + jdiv(k, 31), jd: jmod(k, 31) + 1 }; k -= 186; } else { jy -= 1; k += 179; if (r.leap === 1) k += 1; } return { jy, jm: 7 + jdiv(k, 30), jd: jmod(k, 30) + 1 }; }
const toJalali = date => d2j(g2d(date.getFullYear(), date.getMonth() + 1, date.getDate()));
const toGregorian = (jy, jm, jd) => { const g = d2g(j2d(jy, jm, jd)); return new Date(g.gy, g.gm - 1, g.gd); };
const jalaliMonthLength = (year, month) => month <= 6 ? 31 : month < 12 ? 30 : jalCal(year).leap === 0 ? 30 : 29;
const addDays = (date, amount) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
const sameDate = (a, b) => iso(a) === iso(b);
const weekdayIndex = date => (date.getDay() + 1) % 7;
const eventOnDate = (event, day) => { const dayIso = iso(day), start = String(event.startDate || event.date || '').slice(0, 10), end = String(event.endDate || start).slice(0, 10); if (!start) return false; if (event.allDay) return dayIso >= start && dayIso < end; return dayIso === start || (end > start && dayIso <= end); };
const eventLabel = event => `${event.time ? `${event.time} · ` : ''}${event.title || 'رویداد'}`;

function seasonAiredCount(item, season) { const by = item.seasonEpisodes || {}; const s = by[season] || by[String(season)]; return s ? Number(s.aired) || 0 : 0; }
function seasonTotalCount(item, season) { const by = item.seasonEpisodes || {}; const s = by[season] || by[String(season)]; return s ? Number(s.total) || 0 : 0; }
function seriesHasFresh(item) {
  const cur = Number(item.currentSeason) || 1;
  if (seasonAiredCount(item, cur) > (Number(item.currentEpisode) || 0)) return true;
  const by = item.seasonEpisodes || {};
  return Object.keys(by).some(s => Number(s) > cur && (Number(by[s].aired) || 0) > 0);
}
function episodesWatchedCount(item) {
  const by = item.seasonEpisodes || {}, cur = Number(item.currentSeason) || 1;
  let n = 0;
  Object.keys(by).forEach(s => { if (Number(s) < cur) n += Number(by[s].total) || 0; });
  return n + (Number(item.currentEpisode) || 0);
}
function seriesAiredTotal(item) {
  const by = item.seasonEpisodes || {};
  return Object.values(by).reduce((n, s) => n + (Number(s.aired) || 0), 0);
}
const SERIES_TABS = [['all', 'همه'], ['watching', 'در حال تماشا'], ['watchlist', 'بعداً'], ['completed', 'تمام‌شده'], ['dropped', 'رها‌شده']];
const SERIES_STATUS_OPTIONS = [['watchlist', 'بعداً'], ['watching', 'در حال تماشا'], ['completed', 'تمام‌شده'], ['dropped', 'رها‌شده']];

function SeriesReact() {
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');
  const [toast, setToast] = useState('');
  const [bingersOpen, setBingersOpen] = useState(false);
  const [bingersLib, setBingersLib] = useState(null);
  const [bingersWatches, setBingersWatches] = useState(null);
  const [bingersPreview, setBingersPreview] = useState(null);
  const [bingersSelected, setBingersSelected] = useState(new Set());
  const [bingersBusy, setBingersBusy] = useState(false);

  const flash = msg => { setToast(msg); setTimeout(() => setToast(''), 2400); };
  const load = () => api('/api/movies').then(data => setItems((data.items || []).filter(x => x.type === 'series'))).catch(e => setNotice(e.message));
  useEffect(() => { load(); }, []);

  const readDataUrl = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const previewBingers = async () => {
    if (!bingersLib) return flash('فایل library.csv را انتخاب کن.');
    setBingersBusy(true);
    try {
      const libraryCsvBase64 = await readDataUrl(bingersLib);
      const watchesCsvBase64 = bingersWatches ? await readDataUrl(bingersWatches) : undefined;
      const data = await api('/api/movies/import-bingers/preview', { method: 'POST', body: JSON.stringify({ libraryCsvBase64, watchesCsvBase64 }) });
      setBingersPreview(data);
      setBingersSelected(new Set((data.items || []).filter(x => !x.duplicate).map((x, i) => i)));
    } catch (e) { flash(e.message); }
    setBingersBusy(false);
  };

  const commitBingers = async () => {
    if (!bingersPreview) return;
    const items = (bingersPreview.items || []).filter((x, i) => bingersSelected.has(i));
    if (!items.length) return flash('چیزی برای درون‌ریزی انتخاب نشده.');
    setBingersBusy(true);
    try {
      const res = await api('/api/movies/import-bingers/commit', { method: 'POST', body: JSON.stringify({ items }) });
      flash(`${fa(res.imported)} سریال اضافه شد${res.skipped ? ` · ${fa(res.skipped)} تکراری رد شد` : ''} ✓`);
      setBingersOpen(false); setBingersPreview(null); setBingersLib(null); setBingersWatches(null); setBingersSelected(new Set());
      load();
    } catch (e) { flash(e.message); }
    setBingersBusy(false);
  };

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(() => {
      api(`/api/movies/tvmaze/search?q=${encodeURIComponent(q)}`).then(d => setResults(d.items || [])).catch(() => setResults([])).finally(() => setSearching(false));
    }, 380);
    return () => clearTimeout(t);
  }, [query]);

  const addedIds = new Set(items.map(x => String(x.tvmazeId)));

  const addShow = async show => {
    try {
      await api('/api/movies/from-tvmaze', { method: 'POST', body: JSON.stringify({ tvmazeId: show.tvmazeId, status: 'watchlist' }) });
      setQuery(''); setResults([]); flash(`«${show.name}» اضافه شد ✓`); load();
    } catch (e) { flash(e.message); }
  };

  const quickWatch = async item => {
    setBusyId(item.id);
    const nextEp = (Number(item.currentEpisode) || 0) + 1;
    try {
      await api(`/api/movies/${item.id}`, { method: 'PATCH', body: JSON.stringify({ currentEpisode: nextEp, currentSeason: item.currentSeason || 1, status: item.status === 'watchlist' ? 'watching' : item.status }) });
      flash(`«${item.title}» → قسمت ${fa(nextEp)} دیده شد ✓`);
      load();
    } catch (e) { flash(e.message); }
    setBusyId(null);
  };

  const stats = useMemo(() => {
    const eps = items.reduce((n, x) => n + episodesWatchedCount(x), 0);
    const mins = items.reduce((n, x) => n + episodesWatchedCount(x) * (x.durationMinutes || 45), 0);
    return { count: items.length, eps, hours: Math.round(mins / 60), completed: items.filter(x => x.status === 'completed').length };
  }, [items]);

  const upNext = useMemo(() => items.filter(x => x.status === 'watching' && seriesHasFresh(x)).slice(0, 6), [items]);
  const shown = tab === 'all' ? items : items.filter(x => x.status === tab);

  return (
    <main className="strk" dir="rtl">
      <TopNav active="series" />
      <div className="strk-page">
        <header className="strk-hero">
          <div><p>ردیاب سریال‌ها</p><h1>سریال‌های من</h1></div>
          <div className="strk-stats">
            <div><b>{fa(stats.count)}</b><small>سریال</small></div>
            <div><b>{fa(stats.eps)}</b><small>قسمت دیده‌شده</small></div>
            <div><b>{fa(stats.hours)}</b><small>ساعت تماشا</small></div>
            <div><b>{fa(stats.completed)}</b><small>تمام‌شده</small></div>
          </div>
        </header>

        <div className="strk-search">
          <Search size={16} className="strk-search-ic" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="جستجوی سریال برای افزودن… (انگلیسی)" />
          {searching && <span className="strk-spinner" />}
          {results.length > 0 && (
            <div className="strk-results">
              {results.map(show => (
                <div className="strk-result-row" key={show.tvmazeId}>
                  {show.posterUrl ? <img src={show.posterUrl} alt="" /> : <span className="strk-result-fallback">🎬</span>}
                  <div className="strk-result-info"><b>{show.name}</b><small>{show.year}{show.genres?.length ? ' · ' + show.genres.join('، ') : ''}</small></div>
                  {addedIds.has(String(show.tvmazeId)) ? <span className="strk-added">اضافه شده</span> : <button className="strk-add-btn" onClick={() => addShow(show)}>+ افزودن</button>}
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="button" className="strk-more-btn" style={{ marginBottom: 14 }} onClick={() => setBingersOpen(v => !v)}>📥 ایمپورت از Bingers</button>
        {bingersOpen && (
          <section className="strk-upnext" style={{ marginBottom: 16 }}>
            <div className="strk-upnext-head"><h2>ایمپورت از Bingers</h2><span>library.csv الزامی · watches.csv اختیاری</span></div>
            {!bingersPreview ? (
              <div className="strk-upnext-list">
                <label className="strk-result-row" style={{ cursor: 'pointer' }}>
                  <span className="strk-result-info"><b>library.csv</b><small>{bingersLib ? bingersLib.name : 'فایلی انتخاب نشده'}</small></span>
                  <input type="file" accept=".csv,text/csv" hidden onChange={e => setBingersLib(e.target.files?.[0] || null)} />
                  <span className="strk-add-btn">انتخاب</span>
                </label>
                <label className="strk-result-row" style={{ cursor: 'pointer' }}>
                  <span className="strk-result-info"><b>watches.csv</b><small>{bingersWatches ? bingersWatches.name : 'اختیاری — برای تشخیص قسمت جاری'}</small></span>
                  <input type="file" accept=".csv,text/csv" hidden onChange={e => setBingersWatches(e.target.files?.[0] || null)} />
                  <span className="strk-add-btn">انتخاب</span>
                </label>
                <button type="button" className="strk-watch-btn-full" disabled={bingersBusy} onClick={previewBingers}>{bingersBusy ? '...' : 'پیش‌نمایش'}</button>
              </div>
            ) : (
              <div className="strk-upnext-list">
                <div className="strk-upnext-head"><span>{fa(bingersPreview.items.length)} سریال · {fa(bingersPreview.duplicateCount)} تکراری</span></div>
                {bingersPreview.items.map((it, i) => (
                  <label className="strk-upnext-row" key={i} style={{ opacity: it.duplicate ? .55 : 1 }}>
                    <input type="checkbox" checked={bingersSelected.has(i)} onChange={e => setBingersSelected(prev => { const n = new Set(prev); if (e.target.checked) n.add(i); else n.delete(i); return n; })} />
                    <div className="strk-upnext-info"><b>{it.title}</b><small>{it.year || ''}{it.duplicate ? ' · قبلاً اضافه شده' : ''}{it.episodesWatched ? ` · ${fa(it.episodesWatched)} قسمت دیده‌شده` : ''}</small></div>
                  </label>
                ))}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="strk-watch-btn-full" disabled={bingersBusy} onClick={commitBingers}>{bingersBusy ? '...' : `درون‌ریزی ${fa(bingersSelected.size)} مورد`}</button>
                  <button type="button" className="strk-more-btn" onClick={() => { setBingersPreview(null); setBingersSelected(new Set()); }}>بازگشت</button>
                </div>
              </div>
            )}
          </section>
        )}

        {notice && <div className="notice">{notice}<button onClick={() => setNotice('')}>×</button></div>}

        {upNext.length > 0 && (
          <section className="strk-upnext">
            <div className="strk-upnext-head"><h2>قسمت‌های بعدی</h2><span>{fa(upNext.length)} سریال</span></div>
            <div className="strk-upnext-list">
              {upNext.map(item => {
                const cur = Number(item.currentSeason) || 1, ep = (Number(item.currentEpisode) || 0) + 1;
                return (
                  <div className="strk-upnext-row" key={item.id}>
                    {item.posterUrl ? <img src={item.posterUrl} alt="" onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} /> : null}
                    <span className="strk-upnext-fallback" style={{ display: item.posterUrl ? 'none' : 'flex' }}>🎬</span>
                    <div className="strk-upnext-info"><b>{item.title}</b><small>فصل {fa(cur)} · قسمت {fa(ep)}</small></div>
                    <button disabled={busyId === item.id} className="strk-watch-btn" onClick={() => quickWatch(item)}>{busyId === item.id ? '...' : 'دیدمش ✓'}</button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="strk-tabs">
          {SERIES_TABS.map(([key, label]) => (
            <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
              {label} ({fa(key === 'all' ? items.length : items.filter(x => x.status === key).length)})
            </button>
          ))}
        </div>

        {shown.length === 0 && <p className="empty">چیزی اینجا نیست — از جستجوی بالا سریال اضافه کن.</p>}

        <div className="strk-grid">
          {shown.map(item => {
            const cur = Number(item.currentSeason) || 1, ep = Number(item.currentEpisode) || 0;
            const airedTotal = seriesAiredTotal(item), watched = episodesWatchedCount(item);
            const pct = airedTotal ? Math.min(100, Math.round((watched / airedTotal) * 100)) : 0;
            const fresh = item.status === 'watching' && seriesHasFresh(item);
            const seasonsCount = Object.keys(item.seasonEpisodes || {}).length;
            return (
              <div className="strk-card" key={item.id}>
                <div className="strk-poster" onClick={() => setOpen(item)}>
                  {fresh && <span className="strk-fresh">قسمت جدید!</span>}
                  {item.posterUrl ? <img src={item.posterUrl} alt={item.title} loading="lazy" onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} /> : null}
                  <span className="strk-poster-fallback" style={{ display: item.posterUrl ? 'none' : 'flex' }}>🎬</span>
                  {item.tmdbRating != null && <span className="strk-rating">★ {fa(Math.round(item.tmdbRating * 10) / 10)}</span>}
                  {!!seasonsCount && <span className="strk-seasons">{fa(seasonsCount)} فصل</span>}
                  {pct >= 100 && airedTotal > 0 && <span className="strk-done">✓ تمام</span>}
                </div>
                <div className="strk-body">
                  <b className="strk-title">{item.title}</b>
                  {airedTotal > 0 && (
                    <div className="strk-progress-row">
                      <span>{fa(watched)} از {fa(airedTotal)} قسمت</span><span>{fa(pct)}٪</span>
                    </div>
                  )}
                  {airedTotal > 0 && <div className="strk-progress"><i style={{ width: `${pct}%`, background: pct >= 100 ? '#34d399' : undefined }} /></div>}
                  {item.status === 'watching' ? (
                    fresh ? (
                      <button disabled={busyId === item.id} className="strk-watch-btn strk-watch-btn-full" onClick={() => quickWatch(item)}>
                        {busyId === item.id ? '...' : `✓ دیدم فصل ${fa(cur)} قسمت ${fa(ep + 1)}`}
                      </button>
                    ) : <div className="strk-uptodate">همه‌ی قسمت‌های پخش‌شده رو دیدی ✓</div>
                  ) : null}
                  <button className="strk-more-btn" onClick={() => setOpen(item)}>📋 همه فصل‌ها و قسمت‌ها</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {open && <SeriesDetail item={open} onClose={() => { setOpen(null); load(); }} flash={flash} />}
      {toast && <div className="strk-toast">{toast}</div>}
    </main>
  );
}

function SeriesDetail({ item, onClose, flash }) {
  const [row, setRow] = useState(item);
  const [episodes, setEpisodes] = useState(null);
  const [openSeason, setOpenSeason] = useState(Number(item.currentSeason) || 1);
  const [pendingKey, setPendingKey] = useState('');

  useEffect(() => {
    if (!item.tvmazeId) { setEpisodes([]); return; }
    api(`/api/movies/tvmaze/episodes?tvmazeId=${encodeURIComponent(item.tvmazeId)}`).then(d => setEpisodes(d.items || [])).catch(() => setEpisodes([]));
  }, [item.tvmazeId]);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const patch = async body => {
    try {
      const updated = await api(`/api/movies/${row.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setRow(updated);
      return updated;
    } catch (e) { flash(e.message); return null; }
  };

  const seasons = episodes && episodes.length
    ? [...new Set(episodes.map(e => e.season))].sort((a, b) => a - b)
    : Object.keys(row.seasonEpisodes || {}).map(Number).sort((a, b) => a - b);

  const isWatched = (season, number) => {
    const cur = Number(row.currentSeason) || 1;
    if (season < cur) return true;
    if (season > cur) return false;
    return number <= (Number(row.currentEpisode) || 0);
  };

  const toggleEpisode = async ep => {
    if (!ep.aired) return;
    const key = `${ep.season}-${ep.number}`;
    setPendingKey(key);
    if (isWatched(ep.season, ep.number)) await patch({ currentSeason: ep.season, currentEpisode: Math.max(0, ep.number - 1) });
    else await patch({ currentSeason: ep.season, currentEpisode: ep.number });
    setPendingKey('');
  };

  const markSeason = async season => {
    const aired = (episodes || []).filter(e => e.season === season && e.aired);
    const maxNum = aired.length ? Math.max(...aired.map(e => e.number)) : seasonAiredCount(row, season);
    await patch({ currentSeason: season, currentEpisode: maxNum });
    flash(`فصل ${fa(season)} دیده شد ✓`);
  };
  const clearSeason = async season => {
    await patch({ currentSeason: season, currentEpisode: 0 });
    flash(`فصل ${fa(season)} پاک شد`);
  };

  const del = async () => {
    if (!window.confirm(`«${row.title}» حذف شود؟`)) return;
    try { await api(`/api/movies/${row.id}`, { method: 'DELETE' }); onClose(); } catch (e) { flash(e.message); }
  };

  const totalEps = episodes ? episodes.filter(e => e.aired).length : seriesAiredTotal(row);
  const watchedEps = episodesWatchedCount(row);
  const pct = totalEps ? Math.min(100, Math.round((watchedEps / totalEps) * 100)) : 0;

  return (
    <div className="strk-modal-backdrop" onClick={onClose}>
      <div className="strk-modal" onClick={e => e.stopPropagation()}>
        <button className="strk-modal-close" onClick={onClose}><X size={18} /></button>
        <div className="strk-modal-head">
          {row.posterUrl ? <img src={row.posterUrl} alt="" onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} /> : null}
          <span className="strk-modal-poster-fallback" style={{ display: row.posterUrl ? 'none' : 'flex' }}>🎬</span>
          <div className="strk-modal-info">
            <h2>{row.title}</h2>
            <p className="strk-modal-meta">{[row.genre, row.network, row.year].filter(Boolean).join(' · ')}</p>
            {totalEps > 0 && (
              <>
                <div className="strk-progress-row"><span>{fa(watchedEps)} از {fa(totalEps)} قسمت دیده شده</span><span>{fa(pct)}٪</span></div>
                <div className="strk-progress"><i style={{ width: `${pct}%` }} /></div>
              </>
            )}
            <div className="strk-modal-controls">
              <select value={row.status} onChange={e => patch({ status: e.target.value })}>
                {SERIES_STATUS_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <div className="strk-stars" dir="ltr">
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <button key={n} onClick={() => patch({ rating: n })} className={row.rating && n <= row.rating ? 'on' : ''}><Star size={14} fill={row.rating && n <= row.rating ? 'currentColor' : 'none'} /></button>
                ))}
              </div>
              <button className="strk-del-btn" onClick={del}><Trash2 size={14} /> حذف</button>
            </div>
          </div>
        </div>

        {row.note && <p className="strk-modal-note">{row.note}</p>}

        <div className="strk-seasons-body">
          {episodes === null ? (
            <p className="empty">در حال دریافت قسمت‌ها…</p>
          ) : !seasons.length ? (
            <p className="empty">قسمتی یافت نشد.</p>
          ) : seasons.map(season => {
            const seasonEps = (episodes || []).filter(e => e.season === season);
            const aired = seasonEps.filter(e => e.aired);
            const watchedInSeason = aired.filter(e => isWatched(e.season, e.number)).length;
            const isOpen = openSeason === season;
            return (
              <div className="strk-season" key={season}>
                <button className="strk-season-head" onClick={() => setOpenSeason(isOpen ? null : season)}>
                  <ChevronDown size={16} className={isOpen ? 'open' : ''} />
                  <span className="strk-season-count">{fa(watchedInSeason)}/{fa(aired.length || seasonTotalCount(row, season))}</span>
                  <b>فصل {fa(season)}</b>
                  {watchedInSeason < aired.length && <span className="strk-new-badge">{fa(aired.length - watchedInSeason)} جدید</span>}
                </button>
                {isOpen && (
                  <div className="strk-season-body">
                    {seasonEps.length > 0 && (
                      <div className="strk-season-actions">
                        <button onClick={() => markSeason(season)}>همه‌ی قسمت‌های پخش‌شده رو دیدم ✓</button>
                        <button onClick={() => clearSeason(season)}>↺ پاک‌کردن فصل</button>
                      </div>
                    )}
                    <ul className="strk-ep-list">
                      {seasonEps.map(ep => {
                        const watched = isWatched(ep.season, ep.number), key = `${ep.season}-${ep.number}`;
                        return (
                          <li key={ep.id} className={!ep.aired ? 'strk-ep-unaired' : ''} onClick={() => toggleEpisode(ep)}>
                            <span className={`strk-ep-check ${watched ? 'on' : ''}`}>{pendingKey === key ? '…' : watched ? <Check size={12} /> : ''}</span>
                            <span className="strk-ep-info">
                              <b>{ep.name || `قسمت ${fa(ep.number)}`}</b>
                              <small>{ep.airdate || 'به‌زودی'}</small>
                            </span>
                            <span className="strk-ep-num">E{fa(ep.number)}</span>
                          </li>
                        );
                      })}
                      {!seasonEps.length && <li className="strk-ep-unaired"><span className="strk-ep-info"><small>داده‌ی قسمت‌به‌قسمت این فصل موجود نیست.</small></span></li>}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const MOVIE_TABS = [['all', 'همه'], ['watchlist', 'فهرست تماشا'], ['completed', 'دیده‌شده']];
const MOVIE_STATUS_OPTIONS = [['watchlist', 'فهرست تماشا'], ['completed', 'دیده‌شده']];

function MoviesReact() {
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');
  const [toast, setToast] = useState('');

  const flash = msg => { setToast(msg); setTimeout(() => setToast(''), 2400); };
  const load = () => api('/api/movies').then(data => setItems((data.items || []).filter(x => x.type === 'movie'))).catch(e => setNotice(e.message));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(() => {
      api(`/api/movies/tmdb/search?q=${encodeURIComponent(q)}`).then(d => setResults((d.items || []).filter(x => x.mediaType === 'movie'))).catch(e => { setResults([]); flash(e.message); }).finally(() => setSearching(false));
    }, 380);
    return () => clearTimeout(t);
  }, [query]);

  const addedIds = new Set(items.map(x => String(x.tmdbId)));

  const addMovie = async show => {
    try {
      await api('/api/movies/from-tmdb', { method: 'POST', body: JSON.stringify({ tmdbId: show.tmdbId, mediaType: 'movie', status: 'watchlist' }) });
      setQuery(''); setResults([]); flash(`«${show.title}» اضافه شد ✓`); load();
    } catch (e) { flash(e.message); }
  };

  const markWatched = async item => {
    setBusyId(item.id);
    try {
      await api(`/api/movies/${item.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'completed', date: isoToday() }) });
      flash(`«${item.title}» → دیده‌شده ✓`); load();
    } catch (e) { flash(e.message); }
    setBusyId(null);
  };

  const stats = useMemo(() => {
    const done = items.filter(x => x.status === 'completed');
    const mins = done.reduce((n, x) => n + (Number(x.durationMinutes) || 0), 0);
    const rated = done.filter(x => x.rating).map(x => Number(x.rating));
    return { count: items.length, done: done.length, hours: Math.round(mins / 60), avg: rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null };
  }, [items]);

  const shown = tab === 'all' ? items : items.filter(x => x.status === tab);

  return (
    <main className="strk" dir="rtl">
      <TopNav active="movies" />
      <div className="strk-page">
        <header className="strk-hero">
          <div><p>ردیاب فیلم‌ها</p><h1>فیلم‌های من</h1></div>
          <div className="strk-stats">
            <div><b>{fa(stats.count)}</b><small>فیلم</small></div>
            <div><b>{fa(stats.done)}</b><small>دیده‌شده</small></div>
            <div><b>{fa(stats.hours)}</b><small>ساعت تماشا</small></div>
            <div><b>{stats.avg ? fa(Math.round(stats.avg * 10) / 10) : '—'}</b><small>میانگین امتیاز</small></div>
          </div>
        </header>

        <div className="strk-search">
          <Search size={16} className="strk-search-ic" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="جستجوی فیلم برای افزودن…" />
          {searching && <span className="strk-spinner" />}
          {results.length > 0 && (
            <div className="strk-results">
              {results.map(show => (
                <div className="strk-result-row" key={show.tmdbId}>
                  {show.posterUrl ? <img src={show.posterUrl} alt="" /> : <span className="strk-result-fallback">🎬</span>}
                  <div className="strk-result-info"><b>{show.title}</b><small>{(show.date || '').slice(0, 4)}</small></div>
                  {addedIds.has(String(show.tmdbId)) ? <span className="strk-added">اضافه شده</span> : <button className="strk-add-btn" onClick={() => addMovie(show)}>+ افزودن</button>}
                </div>
              ))}
            </div>
          )}
        </div>

        {notice && <div className="notice">{notice}<button onClick={() => setNotice('')}>×</button></div>}

        <div className="strk-tabs">
          {MOVIE_TABS.map(([key, label]) => (
            <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
              {label} ({fa(key === 'all' ? items.length : items.filter(x => x.status === key).length)})
            </button>
          ))}
        </div>

        {shown.length === 0 && <p className="empty">چیزی اینجا نیست — از جستجوی بالا فیلم اضافه کن.</p>}

        <div className="strk-grid">
          {shown.map(item => (
            <div className="strk-card" key={item.id}>
              <div className="strk-poster" onClick={() => setOpen(item)}>
                {item.posterUrl ? <img src={item.posterUrl} alt={item.title} loading="lazy" onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} /> : null}
                <span className="strk-poster-fallback" style={{ display: item.posterUrl ? 'none' : 'flex' }}>🎬</span>
                {item.tmdbRating != null && <span className="strk-rating">★ {fa(Math.round(item.tmdbRating * 10) / 10)}</span>}
                {item.durationMinutes ? <span className="strk-seasons">{fa(item.durationMinutes)} د</span> : null}
                {item.status === 'completed' && <span className="strk-done">✓ دیده‌شده</span>}
              </div>
              <div className="strk-body">
                <b className="strk-title">{item.title}</b>
                {item.status !== 'completed' ? (
                  <button disabled={busyId === item.id} className="strk-watch-btn-full" onClick={() => markWatched(item)}>{busyId === item.id ? '...' : '✓ دیدمش'}</button>
                ) : item.rating ? (
                  <div className="strk-progress-row"><span>امتیاز تو</span><span>★ {fa(item.rating)}/۱۰</span></div>
                ) : null}
                <button className="strk-more-btn" onClick={() => setOpen(item)}>جزئیات</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {open && <MovieDetail item={open} onClose={() => { setOpen(null); load(); }} flash={flash} />}
      {toast && <div className="strk-toast">{toast}</div>}
    </main>
  );
}

function MovieDetail({ item, onClose, flash }) {
  const [row, setRow] = useState(item);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const patch = async body => {
    try {
      const updated = await api(`/api/movies/${row.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setRow(updated);
      return updated;
    } catch (e) { flash(e.message); return null; }
  };

  const del = async () => {
    if (!window.confirm(`«${row.title}» حذف شود؟`)) return;
    try { await api(`/api/movies/${row.id}`, { method: 'DELETE' }); onClose(); } catch (e) { flash(e.message); }
  };

  return (
    <div className="strk-modal-backdrop" onClick={onClose}>
      <div className="strk-modal" onClick={e => e.stopPropagation()}>
        <button className="strk-modal-close" onClick={onClose}><X size={18} /></button>
        <div className="strk-modal-head">
          {row.posterUrl ? <img src={row.posterUrl} alt="" onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} /> : null}
          <span className="strk-modal-poster-fallback" style={{ display: row.posterUrl ? 'none' : 'flex' }}>🎬</span>
          <div className="strk-modal-info">
            <h2>{row.title}</h2>
            <p className="strk-modal-meta">{[row.genre, row.director, row.durationMinutes && `${fa(row.durationMinutes)} دقیقه`].filter(Boolean).join(' · ')}</p>
            <div className="strk-modal-controls">
              <select value={row.status} onChange={e => patch({ status: e.target.value })}>
                {MOVIE_STATUS_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <div className="strk-stars" dir="ltr">
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <button key={n} onClick={() => patch({ rating: n })} className={row.rating && n <= row.rating ? 'on' : ''}><Star size={14} fill={row.rating && n <= row.rating ? 'currentColor' : 'none'} /></button>
                ))}
              </div>
              <button className="strk-del-btn" onClick={del}><Trash2 size={14} /> حذف</button>
            </div>
          </div>
        </div>
        {row.note && <p className="strk-modal-note">{row.note}</p>}
      </div>
    </div>
  );
}

function RecordsReact({ kind }) {
  const config = {
    notes: { title: 'یادداشت‌ها', endpoint: '/api/inbox', create: f => ({ title: f.get('title'), text: f.get('text'), tags: String(f.get('tags') || '').split(/[،,#]/).map(x => x.trim()).filter(Boolean), color: f.get('color'), pinned: f.get('pinned') === 'on' }) },
    documents: { title: 'مدارک', endpoint: '/api/documents', create: f => ({ title: f.get('title'), type: f.get('type'), expiryDate: f.get('expiryDate') || null, notes: f.get('text') }) },
    contacts: { title: 'مخاطبین', endpoint: '/api/contacts', create: f => ({ name: f.get('title'), relationship: f.get('relationship'), phone: f.get('phone'), email: f.get('email'), birthday: f.get('birthday') || null, followUpDate: f.get('followUpDate') || null, notes: f.get('text') }) }
  }[kind];
  const [items, setItems] = useState([]), [notice, setNotice] = useState(''), [editing, setEditing] = useState(null), [showArchived, setShowArchived] = useState(false);
  const load = async () => { try { const data = await api(`${config.endpoint}${kind === 'notes' && showArchived ? '?archived=1' : ''}`); setItems(data.items || []); } catch (error) { setNotice(error.message); } };
  useEffect(() => { load(); }, [kind, showArchived]);
  const save = async event => { event.preventDefault(); const form = new FormData(event.currentTarget); try { const body = config.create(form); const path = editing ? `${config.endpoint}/${editing.id}` : config.endpoint; await api(path, { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(body) }); event.currentTarget.reset(); setEditing(null); setNotice(editing ? 'ویرایش ذخیره شد.' : 'ثبت شد.'); load(); } catch (error) { setNotice(error.message); } };
  const remove = async item => { if (!window.confirm(`«${item.title || item.name}» حذف شود؟`)) return; try { await api(`${config.endpoint}/${item.id}`, { method: 'DELETE' }); setNotice('حذف شد.'); load(); } catch (error) { setNotice(error.message); } };
  const convert = async (item, type) => { try { await api(`/api/inbox/${item.id}/convert`, { method: 'POST', body: JSON.stringify({ type, date: isoToday() }) }); setNotice('یادداشت تبدیل و بایگانی شد.'); load(); } catch (error) { setNotice(error.message); } };
  const titleValue = item => item.title || item.name || '—';
  return <main className="planner-react records-react" dir="rtl"><TopNav active={kind} /><div className="planner-page"><header><div><p>داده‌های واقعی LifeOS</p><h1>{config.title}</h1></div>{kind === 'notes' && <button className="finance-action" onClick={() => setShowArchived(x => !x)}>{showArchived ? 'فقط فعال‌ها' : 'نمایش بایگانی'}</button>}</header>{notice && <div className="notice">{notice}<button onClick={() => setNotice('')}>×</button></div>}<div className="planner-layout"><form className="planner-form" onSubmit={save}><h2>{editing ? 'ویرایش' : 'افزودن'}</h2><input name="title" required placeholder={kind === 'contacts' ? 'نام مخاطب' : 'عنوان'} defaultValue={editing ? titleValue(editing) : ''} key={`title-${editing?.id || 'new'}`} />{kind === 'contacts' && <><div><select name="relationship" defaultValue={editing?.relationship || 'friend'}><option value="family">خانواده</option><option value="friend">دوست</option><option value="work">کاری</option><option value="other">سایر</option></select><input name="phone" placeholder="تلفن" defaultValue={editing?.phone || ''} /></div><input name="email" type="email" placeholder="ایمیل" defaultValue={editing?.email || ''} /><div><input name="birthday" type="date" defaultValue={editing?.birthday || ''} /><input name="followUpDate" type="date" defaultValue={editing?.followUpDate || ''} /></div></>}{kind === 'documents' && <><input name="type" placeholder="نوع سند" defaultValue={editing?.type || ''} /><input name="expiryDate" type="date" defaultValue={editing?.expiryDate || ''} /></>}{kind === 'notes' && <><input name="tags" placeholder="تگ‌ها، با ویرگول جدا" defaultValue={(editing?.tags || []).join(', ')} /><select name="color" defaultValue={editing?.color || 'cyan'}><option value="cyan">آبی</option><option value="violet">بنفش</option><option value="rose">صورتی</option><option value="amber">کهربایی</option><option value="green">سبز</option></select><label><input name="pinned" type="checkbox" defaultChecked={editing?.pinned} /> سنجاق شود</label></>}<textarea name="text" placeholder="توضیحات" defaultValue={editing?.text || editing?.notes || ''} key={`text-${editing?.id || 'new'}`} /><button className="save">{editing ? 'ذخیرهٔ تغییرات' : 'ذخیره'}</button>{editing && <button type="button" className="finance-action" onClick={() => setEditing(null)}>انصراف</button>}</form><section className="planner-list"><h2>فهرست</h2>{items.length ? items.map(item => <article key={item.id}><div><b>{titleValue(item)}</b><small>{kind === 'contacts' ? [item.relationship, item.phone, item.email, item.followUpDate && `پیگیری ${item.followUpDate}`].filter(Boolean).join(' · ') : kind === 'documents' ? [item.type, item.expiryDate && `انقضا ${item.expiryDate}`].filter(Boolean).join(' · ') : [item.noteDate?.slice(0, 10), ...(item.tags || []).map(tag => `#${tag}`)].filter(Boolean).join(' · ')}</small>{(item.text || item.notes) && <p>{item.text || item.notes}</p>}{kind === 'documents' && item.fileUrl && <a href={item.fileUrl} target="_blank" rel="noreferrer">بازکردن پیوست</a>}</div><div className="record-actions"><button className="finance-action" onClick={() => setEditing(item)}>ویرایش</button>{kind === 'notes' && <><button className="finance-action" onClick={() => convert(item, 'task')}>کار</button><button className="finance-action" onClick={() => convert(item, 'reminder')}>یادآور</button></>}<button className="planner-delete" onClick={() => remove(item)} aria-label={`حذف ${titleValue(item)}`}>×</button></div></article>) : <p className="empty">موردی برای نمایش نیست.</p>}</section></div></div></main>;
}

const DIGEST_HOURS = Array.from({ length: 24 }, (_, h) => h);

function SettingsReact() {
  const [integrations, setIntegrations] = useState({}), [notice, setNotice] = useState('');
  const [me, setMe] = useState(null);
  const [pinNew, setPinNew] = useState(''), [pinCur, setPinCur] = useState('');
  const [tgLink, setTgLink] = useState(null);
  const [tgBackupBusy, setTgBackupBusy] = useState(false);
  const [digest, setDigest] = useState({ tgMorningHour: 9, tgEveningHour: 23, tgMorningOn: true, tgEveningOn: true, tgReports: true });
  const [chatLog, setChatLog] = useState([]), [chatInput, setChatInput] = useState(''), [chatBusy, setChatBusy] = useState(false);

  const load = () => api('/api/integrations').then(setIntegrations).catch(error => setNotice(error.message));
  const loadMe = () => api('/api/me').then(data => {
    setMe(data.user || null);
    if (data.user) setDigest(prev => ({ ...prev, tgMorningHour: data.user.tgMorningHour ?? 9, tgEveningHour: data.user.tgEveningHour ?? 23, tgReports: data.user.tgReports !== false, tgMorningOn: data.user.tgMorningOn !== false, tgEveningOn: data.user.tgEveningOn !== false }));
  }).catch(error => setNotice(error.message));
  useEffect(() => { load(); loadMe(); }, []);

  const disconnect = async name => { try { await api(`/api/integrations/${name}/disconnect`, { method: 'POST', body: JSON.stringify({}) }); setNotice('اتصال قطع شد.'); load(); } catch (error) { setNotice(error.message); } };
  const syncCalendar = async () => { try { await api('/api/integrations/google-calendar/sync', { method: 'POST', body: JSON.stringify({}) }); setNotice('همگام‌سازی شد.'); load(); } catch (error) { setNotice(error.message); } };
  const cards = [['spotify','Spotify','music'], ['youtube','YouTube','youtube'], ['google-calendar','Google Calendar','calendar']];

  const savePin = async event => {
    event.preventDefault();
    const pin = pinNew.replace(/\D/g, '');
    if (pin.length < 4 || pin.length > 8) { setNotice('PIN باید ۴ تا ۸ رقم باشد.'); return; }
    try {
      await api('/api/security/pin', { method: 'PUT', body: JSON.stringify({ pin, currentPin: pinCur.replace(/\D/g, '') || undefined }) });
      setNotice('PIN ذخیره شد.'); setPinNew(''); setPinCur(''); loadMe();
    } catch (error) { setNotice(error.message); }
  };
  const clearPin = async () => {
    const cur = pinCur.replace(/\D/g, '');
    if (!cur) { setNotice('برای خاموش‌کردن قفل، PIN فعلی را در فیلد «PIN فعلی» بنویس.'); return; }
    try {
      await api('/api/security/pin', { method: 'DELETE', body: JSON.stringify({ pin: cur }) });
      setNotice('قفل PIN خاموش شد.'); setPinCur(''); loadMe();
    } catch (error) { setNotice(error.message); }
  };

  const tgLinkCode = async () => { try { setTgLink(await api('/api/telegram/link-code', { method: 'POST', body: JSON.stringify({}) })); } catch (error) { setNotice(error.message); } };
  const tgUnlink = async () => { try { await api('/api/telegram/unlink', { method: 'POST', body: JSON.stringify({}) }); setNotice('اتصال تلگرام قطع شد.'); setTgLink(null); load(); } catch (error) { setNotice(error.message); } };
  const tgBackupNow = async () => {
    setTgBackupBusy(true);
    try { await api('/api/backup/telegram', { method: 'POST', body: JSON.stringify({}) }); setNotice('بکاپ در تلگرامت ارسال شد.'); }
    catch (error) { setNotice(error.message); }
    finally { setTgBackupBusy(false); }
  };

  const saveDigest = async patch => {
    setDigest(prev => ({ ...prev, ...patch }));
    try { await api('/api/me', { method: 'PATCH', body: JSON.stringify(patch) }); } catch (error) { setNotice(error.message); }
  };

  const sendChat = async () => {
    const msg = chatInput.trim();
    if (!msg || chatBusy) return;
    const history = chatLog.map(m => ({ role: m.role, content: m.content }));
    setChatLog(log => [...log, { role: 'user', content: msg }]);
    setChatInput(''); setChatBusy(true);
    try {
      const data = await api('/api/ai/chat', { method: 'POST', body: JSON.stringify({ message: msg, history }) });
      setChatLog(log => [...log, { role: 'assistant', content: data.reply }]);
    } catch (error) {
      setChatLog(log => [...log, { role: 'assistant', content: 'خطا: ' + error.message }]);
    } finally { setChatBusy(false); }
  };

  return (
    <main className="planner-react" dir="rtl">
      <TopNav active="settings" />
      <div className="planner-page">
        <header><div><p>اتصال‌های حساب</p><h1>تنظیمات</h1></div></header>
        {notice && <div className="notice">{notice}<button onClick={() => setNotice('')}>×</button></div>}

        <section className="planner-list integration-list" id="googleCalendarCard">
          <h2>اتصال‌ها</h2>
          {cards.map(([id, title, page]) => {
            const state = integrations[id] || integrations[id.replace('-', '')] || {};
            const connected = Boolean(state.connected);
            return (
              <article key={id}>
                <div>
                  <b>{title}</b>
                  <small>{connected ? 'متصل است' : 'متصل نیست'}</small>
                  {id === 'google-calendar' && <p>تقویم اختصاصی LifeOS داخل حساب گوگلت ساخته می‌شود؛ حذف آن در گوگل دادهٔ هسته را پاک نمی‌کند.</p>}
                </div>
                {connected ? <>
                  <button className="finance-action" onClick={() => disconnect(id)}>قطع اتصال</button>
                  {id === 'google-calendar' && <button className="finance-action" onClick={syncCalendar}>همگام‌سازی</button>}
                </> : <a className="save" href={`/api/integrations/${id}/connect`}>اتصال</a>}
                <a className="finance-action" href={`/?page=${page}`}>بازکردن</a>
              </article>
            );
          })}
        </section>

        <section className="planner-list" id="telegramCard">
          <h2>اتصال تلگرام</h2>
          <article>
            <div>
              <b>بات شخصی تلگرام</b>
              <small>{integrations.telegram?.connected ? 'متصل است' : 'متصل نیست'}</small>
              <p>با یک کد یک‌بارمصرف (۱۵ دقیقه اعتبار) وصل شو؛ گزارش صبح/شب، ثبت سریع تراکنش و کارها و بکاپ روزانهٔ اطلاعات از همین بات فعال می‌شود.</p>
              {tgLink && <p>کد: <b dir="ltr">{tgLink.code}</b> — در بات بفرست: <code dir="ltr">/start {tgLink.code}</code></p>}
            </div>
            {integrations.telegram?.connected ? <>
              <button type="button" className="finance-action" onClick={tgUnlink}>قطع اتصال</button>
              <button type="button" className="finance-action" onClick={tgBackupNow} disabled={tgBackupBusy}>{tgBackupBusy ? 'در حال ارسال…' : '🗄 دریافت بکاپ الان'}</button>
            </> : <button type="button" className="save" onClick={tgLinkCode}>ساخت کد اتصال</button>}
          </article>
        </section>

        <form className="planner-form" id="pinCard" onSubmit={savePin}>
          <h2>PIN امنیتی</h2>
          <p>بعد از ورود، برای دیدن داشبورد PIN می‌خواهد — مناسب موبایل مشترک. برای خاموش‌کردن، فیلد PIN جدید را خالی بگذار و روی «خاموش‌کردن قفل» بزن.</p>
          <div>
            <div><label>PIN جدید (۴ تا ۸ رقم)</label><input type="password" inputMode="numeric" maxLength={8} value={pinNew} onChange={e => setPinNew(e.target.value)} placeholder="••••" /></div>
            <div><label>PIN فعلی (اگر داری)</label><input type="password" inputMode="numeric" maxLength={8} value={pinCur} onChange={e => setPinCur(e.target.value)} placeholder="اختیاری" /></div>
          </div>
          <div>
            <button type="submit" className="save">ذخیرهٔ PIN</button>
            <button type="button" className="finance-action" onClick={clearPin}>خاموش‌کردن قفل</button>
          </div>
          <small>وضعیت فعلی: {me?.pinEnabled ? 'فعال ✓' : 'خاموش'}</small>
        </form>

        <section className="planner-list" id="digestCard">
          <h2>دایجست صبح/عصر</h2>
          <article>
            <div><b>🌅 گزارش صبح</b><small>سررسید اشتراک‌ها و بدهی‌ها + بازی‌های امروز + برنامهٔ امروز</small></div>
            <div className="digest-controls">
              <select value={digest.tgMorningHour} onChange={e => saveDigest({ tgMorningHour: Number(e.target.value) })}>{DIGEST_HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:۰۰</option>)}</select>
              <button type="button" className={`plnr-switch ${digest.tgMorningOn ? 'on' : ''}`} role="switch" aria-checked={digest.tgMorningOn} onClick={() => saveDigest({ tgMorningOn: !digest.tgMorningOn })}><i /></button>
            </div>
          </article>
          <article>
            <div><b>🌙 گزارش عصر</b><small>جمع کارهای امروز + هزینهٔ روز + حال و خواب + یادآوری ثبت روزنگار</small></div>
            <div className="digest-controls">
              <select value={digest.tgEveningHour} onChange={e => saveDigest({ tgEveningHour: Number(e.target.value) })}>{DIGEST_HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:۰۰</option>)}</select>
              <button type="button" className={`plnr-switch ${digest.tgEveningOn ? 'on' : ''}`} role="switch" aria-checked={digest.tgEveningOn} onClick={() => saveDigest({ tgEveningOn: !digest.tgEveningOn })}><i /></button>
            </div>
          </article>
          <article>
            <div><b>ارسال گزارش‌ها در تلگرام</b><small>خاموش‌کردن یعنی هیچ دایجستی فرستاده نشود</small></div>
            <button type="button" className={`plnr-switch ${digest.tgReports ? 'on' : ''}`} role="switch" aria-checked={digest.tgReports} onClick={() => saveDigest({ tgReports: !digest.tgReports })}><i /></button>
          </article>
        </section>

        <section className="planner-list ai-chat-card" id="aiChatCard">
          <h2>چت با دستیار هوش مصنوعی</h2>
          <div className="ai-chat-log">
            {chatLog.length ? chatLog.map((m, index) => <p key={index} className={`ai-chat-msg ${m.role}`}><b>{m.role === 'user' ? 'تو' : 'دستیار'}:</b> {m.content}</p>)
              : <p className="empty">بر اساس دادهٔ واقعیِ این ماهت (مالی، خواب/مود ۷ روز اخیر، کارهای پیش‌رو، عادت‌ها) جواب می‌دهد؛ مثلاً بپرس «این ماه چرا بیشتر خرج کردم؟»</p>}
          </div>
          <div className="ai-chat-row">
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendChat(); }} placeholder="سوالت را بنویس…" disabled={chatBusy} />
            <button type="button" className="save" onClick={sendChat} disabled={chatBusy}>{chatBusy ? '…' : 'ارسال'}</button>
          </div>
        </section>
      </div>
    </main>
  );
}

function Market() {
  const [rows, setRows] = useState([]), [hist, setHist] = useState({}), [notice, setNotice] = useState('');
  useEffect(() => {
    api('/api/tgju').then(data => {
      const all = tgjuRows(data), pick = ['price_dollar_rl', 'price_eur', 'price_aed', 'sekee', 'geram18', 'nim'];
      const top = pick.map(k => all.find(r => r.key === k)).filter(Boolean);
      setRows(top);
      Promise.all(top.map(item => api(`/api/tgju/history?key=${encodeURIComponent(item.key)}&days=30`).then(d => [item.key, (d.items || []).map(x => x.price)]).catch(() => [item.key, null])))
        .then(pairs => setHist(Object.fromEntries(pairs)));
    }).catch(error => setNotice(error.message));
  }, []);
  return <Card className="market" icon={LineChart} title="بازارها" action={<a href="/?page=market">همه بازارها ←</a>}><small className="unit-note">قیمت‌ها به ریال</small>{rows.length ? rows.map(item => { const h = hist[item.key] || [], prev = h.length > 1 ? h[h.length - 2] : 0; let dp = item.dp; if (!dp && prev && item.p) { dp = (item.p - prev) / prev * 100; if (Math.abs(dp) > 25) dp = 0; } const change = dp ? `${dp > 0 ? '▲' : '▼'}${Math.abs(dp).toLocaleString('fa-IR', { maximumFractionDigits: 2 })}٪` : (item.change || '۰٪'); const up = !change.includes('▼'); return <div className="market-row" key={item.key}><span className="market-icon">{marketIcon(item.key)}</span><span>{item.name}</span>{hist[item.key]?.length > 1 && <Sparkline data={hist[item.key]} up={up} uid={item.key} />}<b>{fa(item.p)}</b><small className={change.includes('▼') ? 'negative' : dp ? 'positive' : ''}>{change}</small></div>; }) : <p className="empty">{notice || 'در حال دریافت بازار…'}</p>}</Card>;
}
const FOOT_LEAGUES = [['eng.1', 'لیگ برتر'], ['esp.1', 'لالیگا'], ['ita.1', 'سری آ'], ['ger.1', 'بوندس‌لیگا'], ['uefa.champions', 'لیگ قهرمانان']];
const readLs = (k, f) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v ?? f; } catch { return f; } };
const writeLs = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
function Football() {
  const [league, setLeague] = useState(() => readLs('lifeos-home-league', 'eng.1'));
  const [favs, setFavs] = useState(() => readLs('lifeos-fav-teams', []));
  const [onlyFav, setOnlyFav] = useState(false);
  const [matches, setMatches] = useState([]), [notice, setNotice] = useState('');
  useEffect(() => { setMatches([]); setNotice(''); writeLs('lifeos-home-league', league); api(`/api/football/remote/free/matches?league=${league}`).then(data => { setMatches(data.items || []); if (!(data.items || []).length) setNotice('مسابقه‌ای دریافت نشد.'); }).catch(error => setNotice(error.message)); }, [league]);
  const toggleFav = name => setFavs(f => { const n = f.includes(name) ? f.filter(x => x !== name) : [...f, name]; writeLs('lifeos-fav-teams', n); return n; });
  const isFav = m => favs.includes(m.home) || favs.includes(m.away);
  const rank = m => m.status === 'live' ? 0 : m.status === 'finished' ? 2 : 1;
  const ts = m => Date.parse(m.date) || 0;
  const list = matches.filter(m => !onlyFav || isFav(m)).sort((a, b) => (isFav(b) - isFav(a)) || (rank(a) - rank(b)) || (rank(a) === 2 ? ts(b) - ts(a) : ts(a) - ts(b))).slice(0, 6);
  const when = m => { const d = new Date(m.date); if (isNaN(d)) return ''; const tf = (o) => new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', ...o }).format(d); const sameDay = tf({ dateStyle: 'short' }) === new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'short' }).format(new Date()); return `${sameDay ? 'امروز' : tf({ weekday: 'short' })} ${tf({ hour: '2-digit', minute: '2-digit', hour12: false })}`; };
  const team = (name, logo, side) => <span className={`team ${favs.includes(name) ? 'fav' : ''}`}>{side === 'home' && <TeamBadge logo={logo} name={name} />}<button type="button" onClick={() => toggleFav(name)} title={favs.includes(name) ? 'حذف از تیم‌های من' : 'افزودن به تیم‌های من'}>{name}{favs.includes(name) && <Star size={11} fill="currentColor" />}</button>{side === 'away' && <TeamBadge logo={logo} name={name} />}</span>;
  return <Card className="football" icon={Trophy} title="فوتبال" action={<a href="/?page=football">همه مسابقات ←</a>}>
    <div className="score-tabs">{FOOT_LEAGUES.map(([id, name]) => <button type="button" key={id} className={league === id ? 'on' : ''} onClick={() => setLeague(id)}>{name}</button>)}{favs.length > 0 && <button type="button" className={`fav-toggle ${onlyFav ? 'on' : ''}`} onClick={() => setOnlyFav(v => !v)}><Star size={12} fill={onlyFav ? 'currentColor' : 'none'} />تیم‌های من</button>}</div>
    {list.length ? list.map((m, index) => <div className={`score-row ${isFav(m) ? 'is-fav' : ''}`} key={m.id || index}><small className={m.status === 'live' ? 'live' : ''}>{m.status === 'live' ? '● زنده' : m.status === 'finished' ? 'پایان' : when(m)}</small>{team(m.home, m.homeLogo, 'home')}<b>{m.status === 'upcoming' || !/\d/.test(m.score || '') ? '—' : faDigits(m.score)}</b>{team(m.away, m.awayLogo, 'away')}</div>)
      : <p className="empty">{notice || (onlyFav ? 'تیم‌هات این هفته بازی ندارن.' : 'در حال دریافت…')}</p>}
    {!favs.length && list.length > 0 && <small className="hint">روی اسم هر تیم بزن تا به «تیم‌های من» اضافه بشه.</small>}
  </Card>;
}
const WEATHER_TEXT = code => code === 0 ? 'صاف' : code <= 2 ? 'کمی ابری' : code === 3 ? 'ابری' : code <= 48 ? 'مه' : code <= 57 ? 'نم‌نم باران' : code <= 67 ? 'بارانی' : code <= 77 ? 'برفی' : code <= 82 ? 'رگبار' : code <= 86 ? 'بارش برف' : 'رعد و برق';
const WEATHER_ICON = (code, day = 1) => code === 0 ? (day ? '☀️' : '🌙') : code <= 2 ? (day ? '🌤️' : '☁️') : code === 3 ? '☁️' : code <= 48 ? '🌫️' : code <= 67 ? '🌧️' : code <= 77 ? '❄️' : code <= 82 ? '🌦️' : code <= 86 ? '🌨️' : '⛈️';
const AQI_LEVEL = v => v == null ? null : v <= 50 ? ['پاک', 'good'] : v <= 100 ? ['قابل قبول', 'ok'] : v <= 150 ? ['ناسالم برای حساس‌ها', 'warn'] : v <= 200 ? ['ناسالم', 'bad'] : v <= 300 ? ['بسیار ناسالم', 'bad'] : ['خطرناک', 'bad'];
const hm = iso => faDigits(String(iso || '').slice(11, 16));

const addDaysIso = (isoDate, n) => iso(addDays(fromIso(isoDate), n));
const jalaliDayLabel = isoDate => { const j = toJalali(fromIso(isoDate)); return `${faDigits(j.jd)} ${JALALI_MONTHS[j.jm - 1]}`; };
let IRAN_EVENTS_PROMISE = null;
const loadIranEvents = () => (IRAN_EVENTS_PROMISE ||= fetch('/data/iran-events.json').then(r => r.json()).catch(() => ({})));
const jKey = (jy, jm, jd) => `${jy}${String(jm).padStart(2, '0')}${String(jd).padStart(2, '0')}`;

function monthCells(jy, jm) {
  const first = toGregorian(jy, jm, 1), len = jalaliMonthLength(jy, jm);
  return { first, lead: weekdayIndex(first), days: [...Array(len)].map((_, i) => addDays(first, i)) };
}

function JalaliPicker({ value, today, onPick, onClose }) {
  const start = toJalali(fromIso(value || today));
  const [ym, setYm] = useState({ jy: start.jy, jm: start.jm });
  const { lead, days } = monthCells(ym.jy, ym.jm);
  const shift = n => setYm(({ jy, jm }) => { const m = jm + n; return m < 1 ? { jy: jy - 1, jm: 12 } : m > 12 ? { jy: jy + 1, jm: 1 } : { jy, jm: m }; });
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);
  return <div className="jpicker" role="dialog" aria-label="انتخاب تاریخ">
    <div className="jp-head"><button type="button" onClick={() => shift(-1)} aria-label="ماه قبل"><ChevronRight size={16} /></button><b>{JALALI_MONTHS[ym.jm - 1]} {faDigits(ym.jy)}</b><button type="button" onClick={() => shift(1)} aria-label="ماه بعد"><ChevronLeft size={16} /></button></div>
    <div className="jp-grid">{WEEKDAYS.map(w => <small key={w}>{w}</small>)}{[...Array(lead)].map((_, i) => <span key={'b' + i} />)}{days.map((d, i) => { const v = iso(d); return <button type="button" key={v} disabled={v < today} className={`${v === today ? 'is-today' : ''} ${v === value ? 'is-sel' : ''} ${weekdayIndex(d) === 6 ? 'is-fri' : ''}`} onClick={() => onPick(v)}>{faDigits(i + 1)}</button>; })}</div>
  </div>;
}

function LiveCalendar({ today }) {
  const t = toJalali(fromIso(today));
  const [ym, setYm] = useState({ jy: t.jy, jm: t.jm });
  const [items, setItems] = useState([]);
  const [events, setEvents] = useState({});
  const [note, setNote] = useState('');
  const { lead, days } = monthCells(ym.jy, ym.jm);
  const from = iso(days[0]), to = iso(days[days.length - 1]);
  useEffect(() => { loadIranEvents().then(setEvents); }, []);
  useEffect(() => {
    let live = true;
    api(`/api/calendar/feed?from=${from}&to=${to}`).then(d => { if (!live) return; setItems(d.items || []); setNote(d.googleError || ''); }).catch(() => live && setItems([]));
    return () => { live = false; };
  }, [from, to]);
  const shift = n => setYm(({ jy, jm }) => { const m = jm + n; return m < 1 ? { jy: jy - 1, jm: 12 } : m > 12 ? { jy: jy + 1, jm: 1 } : { jy, jm: m }; });
  const goToday = () => setYm({ jy: t.jy, jm: t.jm });
  // Untimed tasks/reminders live in the tasks card — the calendar marks timed items and external events only.
  const dayItems = d => items.filter(ev => (ev.source !== 'lifeos' || ev.time) && eventOnDate(ev, d));
  const todayCount = dayItems(fromIso(today)).length;
  const nowHm = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tehran' }).format(new Date());
  return <Card className="calendar live-cal" icon={CalendarDays} title={`${JALALI_MONTHS[ym.jm - 1]} ${faDigits(ym.jy)}`} action={<div className="lc-nav"><button type="button" onClick={() => shift(-1)} aria-label="ماه قبل"><ChevronRight size={15} /></button>{(ym.jy !== t.jy || ym.jm !== t.jm) && <button type="button" className="lc-today" onClick={goToday}>امروز</button>}<button type="button" onClick={() => shift(1)} aria-label="ماه بعد"><ChevronLeft size={15} /></button></div>}>
    <div className="weekdays">{WEEKDAYS.map(x => <span key={x}>{x}</span>)}</div>
    <div className="calendar-days">{[...Array(lead)].map((_, i) => <span key={`blank${i}`} />)}{days.map((day, i) => {
      const v = iso(day), evs = events[jKey(ym.jy, ym.jm, i + 1)] || [], holiday = weekdayIndex(day) === 6 || evs.some(e => e.h), n = dayItems(day).length;
      const tip = [...evs.map(e => e.t.replace(/\[.*?\]/g, '').trim()), ...dayItems(day).map(ev => `${ev.time ? faDigits(ev.time) + ' · ' : ''}${ev.title}`)].join('\n');
      return <button type="button" key={v} title={tip} className={`${v === today ? 'today' : ''} ${holiday ? 'holiday' : ''}`} onClick={() => { location.href = '/?page=calendar'; }}>{faDigits(i + 1)}{n > 0 && <i className="dot" />}</button>;
    })}</div>
    <div className="lc-foot"><span>{todayCount ? `امروز ${fa(todayCount)} برنامهٔ ساعت‌دار` : 'امروز برنامهٔ ساعت‌داری نداری'}</span><a href="/?page=calendar">تقویم کامل ←</a></div>
  </Card>;
}

function DayCard({ today }) {
  const d = fromIso(today), j = toJalali(d);
  const dayIndex = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  const photo = photoOfDay(j.jm, dayIndex);
  const [src, setSrc] = useState(photo.local);
  const [events, setEvents] = useState([]);
  useEffect(() => {
    const key = `${j.jy}${String(j.jm).padStart(2, '0')}${String(j.jd).padStart(2, '0')}`;
    fetch('/data/iran-events.json').then(r => r.json()).then(all => setEvents(all[key] || [])).catch(() => {});
  }, [today]);
  const holiday = events.some(e => e.h) || weekdayIndex(d) === 6;
  const onError = () => setSrc(cur => cur === photo.local ? photo.remote : '/assets/img/mountains-dusk.jpg');
  return <Card className={`day-card season-${photo.season}`} title={new Intl.DateTimeFormat('fa-IR', { weekday: 'long' }).format(d)} action={holiday ? <span className="holiday-tag">تعطیل</span> : null}>
    <img className="hero-bg-img" src={src} onError={onError} alt="" />
    <div className="hero-bg-fade" />
    <div className="date-number">{faDigits(j.jd)}</div>
    <h3>{faDigits(j.jd)} {JALALI_MONTHS[j.jm - 1]} {faDigits(j.jy)}</h3>
    <small dir="ltr">{new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(d)}</small>
    <div className="occasion">{events.length ? events.slice(0, 2).map((e, i) => <div key={i} className={e.h ? 'is-holiday' : ''}>▣ {e.t.replace(/\[.*?\]/g, '').trim()}</div>) : <div>▣ مناسبتی برای امروز ثبت نشده</div>}</div>
  </Card>;
}

// Picks a background scene from the current weather code, day/night and closeness to sunrise/sunset.
function sceneOf(c, dl) {
  const code = c.weather_code, t = String(c.time || '');
  const near = iso => { if (!iso) return false; const d = Math.abs(Date.parse(iso) - Date.parse(t)); return d < 50 * 60000; };
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (code === 45 || code === 48) return 'fog';
  if (code === 3) return c.is_day ? 'cloudy' : 'cloudy-night';
  if (near(dl.sunset?.[0]) || near(dl.sunrise?.[0])) return 'golden';
  if (!c.is_day) return code === 0 ? 'clear-night' : 'partly-night';
  return code === 0 ? 'clear-day' : 'partly-day';
}
function WeatherScene({ kind }) {
  const night = /night/.test(kind), cloudy = /partly|cloudy|rain|storm|snow|fog/.test(kind);
  const drops = kind === 'rain' || kind === 'storm' ? 70 : kind === 'snow' ? 55 : 0;
  return <div className={`wx-scene wx-${kind}`} aria-hidden="true">
    {(kind === 'clear-day' || kind === 'partly-day' || kind === 'golden') && <i className="wx-sun" />}
    {night && <><i className="wx-stars" /><i className="wx-moon" /></>}
    {cloudy && <><i className="wx-cloud c1" /><i className="wx-cloud c2" /><i className="wx-cloud c3" /></>}
    {kind === 'fog' && <><i className="wx-fog f1" /><i className="wx-fog f2" /></>}
    {kind === 'storm' && <i className="wx-flash" />}
    {drops > 0 && <div className={kind === 'snow' ? 'wx-snow' : 'wx-rain'}>{[...Array(drops)].map((_, i) => <b key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${((i * 53) % 100) / 50}s`, animationDuration: `${kind === 'snow' ? 4 + (i % 5) : 0.6 + (i % 4) * 0.12}s` }} />)}</div>}
    <i className="wx-fade" />
  </div>;
}

function WeatherCard({ weather, aqi }) {
  if (!weather) return <Card className="weather" icon={MapPin} title="تهران"><WeatherScene kind="clear-day" /><p className="empty weather-loading">در حال دریافت وضعیت هوا…</p></Card>;
  const c = weather.current, dl = weather.daily, lvl = AQI_LEVEL(aqi?.us_aqi);
  const nowIdx = Math.max(0, (weather.hourly?.time || []).findIndex(t => t >= c.time.slice(0, 13)));
  const hours = (weather.hourly?.temperature_2m || []).slice(nowIdx, nowIdx + 24);
  return <Card className="weather" icon={MapPin} title="تهران" action={<small>{WEATHER_TEXT(c.weather_code)}</small>}>
    <WeatherScene kind={sceneOf(c, dl)} />
    <div className="weather-now">
      <span className="weather-icon-badge">{WEATHER_ICON(c.weather_code, c.is_day)}</span>
      <strong>{fa(Math.round(c.temperature_2m))}<em>°C</em></strong>
      <div className="wn-meta"><b>حس‌شده {fa(Math.round(c.apparent_temperature))}°</b><span>بیشینه {fa(Math.round(dl.temperature_2m_max[0]))}° · کمینه {fa(Math.round(dl.temperature_2m_min[0]))}°</span></div>
      {lvl && <span className={`aqi aqi-${lvl[1]}`} title={`PM2.5: ${fa(Math.round(aqi.pm2_5 || 0))}`}><b>{fa(Math.round(aqi.us_aqi))}</b><small>AQI · {lvl[0]}</small></span>}
    </div>
    {hours.length > 1 && <div className="hourly"><Sparkline data={hours} up width={300} height={34} uid="wx" color="#e6b563" /><div className="hourly-labels"><span>اکنون</span><span>+۶ ساعت</span><span>+۱۲</span><span>+۱۸</span><span>+۲۴</span></div></div>}
    <div className="weather-grid">
      <div><small>رطوبت</small><b>{fa(c.relative_humidity_2m)}٪</b></div>
      <div><small>باد</small><b>{fa(Math.round(c.wind_speed_10m))} km/h</b></div>
      <div><small>UV</small><b>{fa(Math.round(c.uv_index ?? dl.uv_index_max?.[0] ?? 0))}</b></div>
      <div><small>احتمال بارش</small><b>{fa(dl.precipitation_probability_max?.[0] ?? 0)}٪</b></div>
      <div><small>طلوع</small><b>{hm(dl.sunrise?.[0])}</b></div>
      <div><small>غروب</small><b>{hm(dl.sunset?.[0])}</b></div>
    </div>
    <div className="forecast">{dl.time.slice(1, 6).map((day, index) => <div key={day}><small>{new Intl.DateTimeFormat('fa-IR', { weekday: 'short' }).format(new Date(`${day}T12:00`))}</small><b className="weather-icon-badge small">{WEATHER_ICON(dl.weather_code[index + 1])}</b><span>{fa(Math.round(dl.temperature_2m_max[index + 1]))}°<em>{fa(Math.round(dl.temperature_2m_min[index + 1]))}°</em></span></div>)}</div>
  </Card>;
}

function FinanceMini({ todaySpend }) {
  const [fin, setFin] = useState(null), [bud, setBud] = useState(null);
  useEffect(() => {
    const month = isoToday().slice(0, 7);
    api(`/api/finance?month=${month}`).then(setFin).catch(() => setFin({ income: 0, expense: 0, categories: {} }));
    api(`/api/budgets?month=${month}`).then(setBud).catch(() => {});
  }, []);
  const income = fin?.income || 0, expense = fin?.expense || 0;
  const hasBudget = !!bud?.totalBudget;
  const used = hasBudget ? (bud.totalSpent || 0) / bud.totalBudget : income ? expense / income : 0;
  const left = Math.max(0, 1 - used), pct = Math.round((hasBudget || income ? left : 0) * 100);
  const top = Object.entries(fin?.categories || {}).sort((a, b) => b[1] - a[1])[0];
  const R = 42, C = 2 * Math.PI * R;
  return <Card className="finance-mini" icon={Wallet} title="مالی · این ماه" action={<a href="/?page=finance">دفتر ←</a>}>
    {!fin ? <p className="empty">در حال دریافت…</p> : <div className="fm-body">
      <div className="fm-rows">
        <div><span>درآمد</span><b className="pos">{fa(income)}</b></div>
        <div><span>هزینه</span><b className="neg">{fa(expense)}</b></div>
        <div><span>خرج امروز</span><b>{fa(todaySpend)}</b></div>
        {top && <div><span>بیشترین خرج</span><b>{top[0]}</b></div>}
      </div>
      <div className={`ring ${used > 1 ? 'over' : used > .8 ? 'warn' : ''}`}>
        <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r={R} className="ring-bg" /><circle cx="50" cy="50" r={R} className="ring-fg" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} /></svg>
        <div><b>{fa(pct)}٪</b><small>{hasBudget ? 'بودجه مانده' : 'از درآمد مانده'}</small></div>
      </div>
    </div>}
    <small className="fm-unit">ارقام به ریال</small>
  </Card>;
}

createRoot(document.getElementById('root')).render(<App />);
